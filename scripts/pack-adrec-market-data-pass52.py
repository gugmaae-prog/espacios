#!/usr/bin/env python3
"""Pack V52 as a new immutable local candidate. No remote or deployment writes."""
import argparse, gzip, hashlib, importlib.util, json
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'data/historical-intelligence'
PASS = BASE / 'adrec-market-data-pass52'
PRIOR = '20261022-enrichment-v51'
VERSION = '20261022-enrichment-v52'
canonical = lambda x: json.dumps(x, ensure_ascii=False, separators=(',', ':'), sort_keys=True).encode()
digest = lambda x: hashlib.sha256(x).hexdigest()

def require(ok, message):
    if not ok:
        raise ValueError(message)

def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def immutable(blob, suffix, kind):
    sha = digest(blob)
    path = BASE / 'objects' / (sha + suffix)
    if path.exists():
        require(path.read_bytes() == blob, 'Immutable object collision')
    else:
        path.write_bytes(blob)
    return {'key': 'research/published/2026-10-22/historical-intelligence/objects/' + path.name,
            'path': str(path.relative_to(ROOT)), 'sha256': sha, 'bytes': len(blob),
            'kind': kind, 'compression': 'gzip'}

def pack(directory):
    archive_path = ROOT / 'data/historical-intelligence-20261003.json.gz'
    manifest_path = BASE / 'publication-manifest.json'
    snapshot = json.loads((directory / 'candidate-snapshot.json').read_bytes())
    receipt = json.loads((directory / 'reconciliation.json').read_bytes())
    publication = json.loads(manifest_path.read_bytes())
    original_raw = gzip.decompress(archive_path.read_bytes())
    original = json.loads(original_raw)
    require(snapshot['version'] == receipt['version'] == VERSION and original['version'] == publication['version'] == PRIOR,
            'Snapshot version mismatch')
    require(snapshot['asOf'] == '2026-10-22', 'Snapshot cutoff mismatch')
    require(digest(original_raw) == 'b69121dd4e5718353df00b6459f94b448daabd80a17f1e5a5fdfec7586b26c54',
            'Canonical V51 archive checksum mismatch')
    root_obj = publication['rootIndex']
    root_raw = (ROOT / root_obj['path']).read_bytes()
    require(digest(root_raw) == root_obj['sha256'], 'V51 root index checksum mismatch')
    root = json.loads(gzip.decompress(root_raw))
    require(root['version'] == PRIOR, 'Root baseline version mismatch')
    changed = set(receipt['changedRecords'])
    known = {r['id']: r for r in snapshot['records']}
    require(len(known) == 1860 and {r['id'] for r in original['records']} == known.keys(), 'Catalogue changed')
    for old, new in zip(original['records'], snapshot['records']):
        if old['id'] not in changed:
            require(old == new, 'Unaffected record changed')
    require(snapshot['sources'][:len(original['sources'])] == original['sources'], 'Prior sources changed')
    require(snapshot['events'] == original['events'] and snapshot['exposures'] == original['exposures'], 'Events changed')

    new_history, pointers = [], {}
    native_before, native_after, native_count = hashlib.sha256(), hashlib.sha256(), 0
    history_objects = [obj for obj in publication['objects'] if obj['kind'] == 'history_partition']

    def transform_history(obj):
        data = (ROOT / obj['path']).read_bytes()
        require(digest(data) == obj['sha256'], 'Prior history partition checksum mismatch')
        old = json.loads(gzip.decompress(data))
        require(old['version'] == PRIOR, 'Native history partition version mismatch')
        series_blob = canonical(old['series'])
        before_count = len(old['series'])
        old['version'], old['asOf'] = VERSION, snapshot['asOf']
        return old, series_blob, before_count, gzip.compress(canonical(old), mtime=0)

    # These immutable partitions can live on a cloud-backed filesystem. Bounded
    # parallel reads keep the integrity walk practical without changing output
    # order, checksums, or the append-only publication model.
    with ThreadPoolExecutor(max_workers=32) as executor:
        for old, series_blob, before_count, new_blob in executor.map(transform_history, history_objects):
            native_before.update(series_blob)
            native_count += before_count
            new = immutable(new_blob, '.json.gz', 'history_partition')
            new_history.append(new)
            native_after.update(canonical(old['series']))
            pointer = {k: new[k] for k in ['key', 'sha256', 'bytes', 'compression']}
            for series in old['series']:
                require(series['id'] not in pointers, 'Duplicate native series')
                pointers[series['id']] = pointer
    require(native_before.digest() == native_after.digest(), 'Native series changed')
    require(native_count == len(root['series']) == 16872, 'Native series count changed')
    for record in snapshot['records']:
        for series in record.get('historySeries', []):
            if series.get('partition'):
                series['partition'] = pointers[series['id']]
    for series in root['series']:
        series['partition'] = pointers[series['id']]
    for record in root['records']:
        if record['id'] in changed:
            full = known[record['id']]
            for key in ['lifecycle', 'observations', 'researchStatus', 'coverageSummary']:
                record[key] = deepcopy(full[key])
    root.update(version=VERSION, asOf=snapshot['asOf'], manifest=snapshot['manifest'], sources=snapshot['sources'])
    new_root = immutable(gzip.compress(canonical(root), mtime=0), '.json.gz', 'full_snapshot_index')
    replaced = {'runtime_history_partition', 'runtime_record_shard', 'runtime_index', 'history_partition', 'full_snapshot_index'}
    objects = [x for x in publication['objects'] if x['kind'] not in replaced] + new_history + [new_root]
    counts = dict(publication['counts'])
    counts['sources'] = len(snapshot['sources'])
    new_manifest = dict(version=VERSION, asOf=snapshot['asOf'], rootIndex=new_root, objects=objects, counts=counts)

    sql = ['PRAGMA foreign_keys = ON;']
    literal = lambda x: "'" + str(x).replace("'", "''") + "'"
    def insert(table, columns, values):
        sql.append(f"INSERT OR IGNORE INTO {table}({','.join(columns)}) VALUES({','.join(str(v) if isinstance(v, int) else literal(v) for v in values)});")
    insert('hi_snapshots', ['snapshot_version','as_of','record_count','manifest_json','root_sha256'],
           [VERSION, snapshot['asOf'], 1860, canonical(snapshot['manifest']).decode(), new_root['sha256']])
    for record in root['records']:
        insert('hi_records', ['snapshot_version','record_id','record_type','name','emirate','record_json'],
               [VERSION, record['id'], record['type'], record['name'], record['emirate'], canonical({k:v for k,v in record.items() if k!='historySeriesIds'}).decode()])
    for source in snapshot['sources']:
        insert('hi_sources', ['snapshot_version','source_id','url','source_json'],
               [VERSION, source['id'], source.get('url',''), canonical(source).decode()])
    for event in snapshot['events']:
        insert('hi_events', ['snapshot_version','event_id','event_json'], [VERSION, event['id'], canonical(event).decode()])
    for exposure in snapshot['exposures']:
        insert('hi_exposures', ['snapshot_version','exposure_id','event_id','record_id','scope','verified','exposure_json'],
               [VERSION, exposure['id'], exposure['eventId'], exposure['recordId'], exposure['scope'], int(exposure['verified']), canonical(exposure).decode()])
    descriptors = {s['id']: s for s in root['series']}
    for series in root['series']:
        insert('hi_series', ['snapshot_version','series_id','source_id','series_json'],
               [VERSION, series['id'], series['sourceId'], canonical(series).decode()])
    for record in root['records']:
        for sid in record.get('historySeriesIds', []):
            series = descriptors[sid]
            insert('hi_record_series', ['snapshot_version','record_id','series_id','scope','identity_verified'],
                   [VERSION, record['id'], sid, series.get('scope','area_context'), int(series.get('identityVerified',False))])
    new_manifest['d1Index'] = immutable(gzip.compress(('\n'.join(sql) + '\n').encode(), mtime=0), '.sql.gz', 'd1_append_only_index')

    target = ROOT / 'data/historical-intelligence-20261003.json'
    target.write_bytes(canonical(snapshot) + b'\n')
    archive_path.write_bytes(gzip.compress(target.read_bytes(), compresslevel=9, mtime=0))
    manifest_path.write_bytes(canonical(new_manifest) + b'\n')
    builder = load_module('historical_builder', ROOT / 'scripts/build-historical-data.py')
    builder.ASOF = snapshot['asOf']
    builder.build_runtime_index(snapshot, new_manifest)
    receipt.update(nativeSeriesDigestBefore=native_before.hexdigest(), nativeSeriesDigestAfter=native_after.hexdigest(),
                   nativeSeriesCount=native_count, historicalRowsPreserved=counts['historicalRows'],
                   rootSHA256=new_root['sha256'], canonicalSHA256=digest(target.read_bytes()),
                   publicationState='unmerged_candidate_only_reuse_rights_pending_not_published', remoteWrites=0,
                   sourcesAfter=len(snapshot['sources']), totalRecords=len(snapshot['records']))
    (PASS / 'reconciliation.json').write_bytes(canonical(receipt) + b'\n')
    print(json.dumps({k:v for k,v in receipt.items() if k not in {'coverageBefore','coverageAfter','coverageDelta'}}))

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--candidate-dir', type=Path, required=True)
    pack(parser.parse_args().candidate_dir)

if __name__ == '__main__':
    main()
