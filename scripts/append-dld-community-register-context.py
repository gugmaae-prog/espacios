#!/usr/bin/env python3
"""Append verified DLD master-project register context to the published snapshot."""
import gzip
import hashlib
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = ROOT / 'data/historical-intelligence'
SNAPSHOT_PATH = ROOT / 'data/historical-intelligence-20261003.json'
PUBLICATION_PATH = BASE / 'publication-manifest.json'
SIDECAR_PATH = BASE / 'dld-project-register-community-context-20261008.json'
VERSION = '20261008-enrichment-v25'

def canonical(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), sort_keys=True).encode()

def digest(blob):
    return hashlib.sha256(blob).hexdigest()

def immutable(blob, suffix, kind):
    sha = digest(blob)
    rel = f'objects/{sha}{suffix}'
    path = BASE / rel
    if path.exists() and path.read_bytes() != blob:
        raise ValueError(f'Immutable object collision: {rel}')
    if not path.exists():
        path.write_bytes(blob)
    return {'key': f'research/published/2026-10-08/historical-intelligence/{rel}',
            'path': str(path.relative_to(ROOT)), 'sha256': sha, 'bytes': len(blob),
            'kind': kind, 'compression': 'gzip' if suffix.endswith('.gz') else None}

def sql_literal(value):
    return "'" + str(value).replace("'", "''") + "'"

snapshot = json.loads(SNAPSHOT_PATH.read_text())
publication = json.loads(PUBLICATION_PATH.read_text())
sidecar = json.loads(SIDECAR_PATH.read_text())
if snapshot['version'] != '20261008-enrichment-v24' or publication['version'] != snapshot['version']:
    raise ValueError('Expected the verified published V24 baseline')
if publication['counts']['records'] != 1860 or publication['counts']['historicalRows'] != 563675 or publication['counts']['series'] != 15063 or publication['counts']['sources'] != 3253:
    raise ValueError('Published baseline counts changed')
if publication.get('d1Index') is None:
    raise ValueError('Published D1 index is required')

old_snapshot = json.loads(json.dumps(snapshot))
old_source_ids = {source['id'] for source in snapshot['sources']}
source = sidecar['sources'][0]
if source['id'] in old_source_ids:
    raise ValueError('Source ID already exists; do not overwrite published evidence')
snapshot['sources'].append(source)
records = {record['id']: record for record in snapshot['records']}
fact_ids = set()
for fact in sidecar['facts']:
    if fact.get('status') != 'accepted' or fact.get('kind') != 'register':
        raise ValueError('Only accepted register facts are allowed in this pass')
    if fact['sourceId'] != source['id'] or fact.get('sourceIds') != [source['id']]:
        raise ValueError('Fact source differs from the pinned DLD register source')
    if fact.get('scope') != 'community_context' or fact.get('identityVerified') is not True:
        raise ValueError('DLD register context must remain verified community context')
    if fact.get('publishedAt') is not None:
        raise ValueError('Unknown publication date must remain unknown')
    record = records.get(fact['recordId'])
    if not record or record.get('type') != 'community':
        raise ValueError('Register context may only attach to an existing community')
    if fact['id'] in fact_ids or any(item.get('id') == fact['id'] for item in record.get('registerEvidence', [])):
        raise ValueError('Duplicate register fact ID')
    fact_ids.add(fact['id'])
    available = fact.get('firstAvailableAt') or source['firstAvailableAt']
    record.setdefault('registerEvidence', []).append({
        'id': fact['id'], 'sourceIds': [source['id']], 'publishedAt': None,
        'firstAvailableAt': available, 'retrievedAt': source['retrievedAt'],
        'identityBasis': fact['identityBasis'], 'identitySourceIds': [source['id']],
        'fields': fact['fields'], 'classification': fact['evidenceClass'],
        'registeredProjectId': fact.get('registeredProjectId'),
        'scope': 'community_context', 'identityVerified': True,
    })
if len(fact_ids) != 43:
    raise ValueError(f'Expected 43 exact community facts, got {len(fact_ids)}')

snapshot['version'] = VERSION
manifest = snapshot['manifest']
manifest['version'] = VERSION
manifest['sourcesCountBeforeDldRegisterRecapture'] = len(old_source_ids)
manifest['dldProjectRegisterCommunityContext'] = {
    'classification': 'official_project_register_community_context',
    'sourceId': source['id'], 'datasetId': source['datasetId'],
    'sourceSha256': source['sha256'], 'sourceRows': source['sourceRecordCount'],
    'uniqueProjectIds': source['uniqueProjectIdCount'],
    'exactCommunityRecords': len(fact_ids),
    'matchedRegisteredProjectRows': sum(f['fields']['registeredProjectRecordsInSource'] for f in sidecar['facts']),
    'ambiguousOrUnmatchedRowsExcluded': 1210,
    'financialObservationsAdded': 0,
    'fullCommunityInventoryClaim': False,
    'rawSourceBodyRetainedOrRedistributed': False,
}
manifest['completionDefinition'] = 'Every record evaluated; observed financial coverage remains incomplete; DLD project-register context is not price history.'

# Verify that the only record changes are the new community-context facts.
for before, after in zip(old_snapshot['records'], snapshot['records']):
    before_copy = json.loads(json.dumps(before)); after_copy = json.loads(json.dumps(after))
    after_copy.pop('registerEvidence', None)
    before_copy.pop('registerEvidence', None)
    if before_copy != after_copy:
        raise ValueError('Unrelated record evidence changed during append')
if len(snapshot['records']) != len(old_snapshot['records']) or len(snapshot['events']) != len(old_snapshot['events']) or len(snapshot['exposures']) != len(old_snapshot['exposures']):
    raise ValueError('Catalogue or event history changed during append')

# Reuse the immutable native history partitions and point descriptors from V24.
old_root = json.loads(gzip.decompress((ROOT / publication['rootIndex']['path']).read_bytes()))
root = dict(old_root)
# A runtime partition is version-bound. Re-encode every native history object
# under V25 while retaining its exact native series and point arrays.
new_history_objects = []
partition_pointers = {}
for prior in publication['objects']:
    if prior['kind'] != 'history_partition':
        continue
    archived = json.loads(gzip.decompress((ROOT / prior['path']).read_bytes()))
    if archived.get('version') != old_snapshot['version'] or archived.get('asOf') != snapshot['asOf']:
        raise ValueError('Native history partition does not match the V24 baseline')
    archived['version'] = VERSION
    obj = immutable(gzip.compress(canonical(archived), mtime=0), '.json.gz', 'history_partition')
    new_history_objects.append(obj)
    pointer = {k: obj[k] for k in ['key', 'sha256', 'bytes', 'compression']}
    for series in archived['series']:
        if series['id'] in partition_pointers:
            raise ValueError('Native series occurs in multiple source partitions')
        partition_pointers[series['id']] = pointer
if len(partition_pointers) != len(old_root['series']):
    raise ValueError('Re-versioned native partition inventory differs from the immutable root')
for series in snapshot['records']:
    for link in series.get('historySeries', []):
        if link.get('partition'):
            link['partition'] = partition_pointers[link['id']]
root.update({'version': VERSION, 'asOf': snapshot['asOf'], 'manifest': manifest,
             'sources': snapshot['sources']})
for series in root['series']:
    series['partition'] = partition_pointers[series['id']]
compact_records = []
for full, compact in zip(snapshot['records'], old_root['records']):
    row = dict(compact)
    if 'registerEvidence' in full:
        row['registerEvidence'] = full['registerEvidence']
    compact_records.append(row)
root['records'] = compact_records
root_obj = immutable(gzip.compress(canonical(root), mtime=0), '.json.gz', 'full_snapshot_index')

objects = [o for o in publication['objects'] if o['kind'] not in ['runtime_history_partition', 'runtime_record_shard', 'runtime_index', 'history_partition', 'full_snapshot_index']]
objects.extend(new_history_objects)
objects.append(root_obj)
counts = dict(publication['counts'])
counts['sources'] = len(snapshot['sources'])
new_publication = {'version': VERSION, 'asOf': snapshot['asOf'], 'rootIndex': root_obj,
                   'objects': objects, 'counts': counts}

# Rebuild a versioned, append-only D1 index from the same immutable root.
sql = ['PRAGMA foreign_keys = ON;']
sql.append(f'INSERT OR IGNORE INTO hi_snapshots(snapshot_version,as_of,record_count,manifest_json,root_sha256) VALUES({sql_literal(VERSION)},{sql_literal(snapshot["asOf"])},1860,{sql_literal(canonical(manifest).decode())},{sql_literal(root_obj["sha256"])});')
for record in compact_records:
    row = {k: v for k, v in record.items() if k not in ['historySeriesIds']}
    sql.append(f'INSERT OR IGNORE INTO hi_records(snapshot_version,record_id,record_type,name,emirate,record_json) VALUES({sql_literal(VERSION)},{sql_literal(record["id"])},{sql_literal(record["type"])},{sql_literal(record["name"])},{sql_literal(record["emirate"])},{sql_literal(canonical(row).decode())});')
for item in snapshot['sources']:
    sql.append(f'INSERT OR IGNORE INTO hi_sources(snapshot_version,source_id,url,source_json) VALUES({sql_literal(VERSION)},{sql_literal(item["id"])},{sql_literal(item["url"])},{sql_literal(canonical(item).decode())});')
for event in snapshot['events']:
    sql.append(f'INSERT OR IGNORE INTO hi_events(snapshot_version,event_id,event_json) VALUES({sql_literal(VERSION)},{sql_literal(event["id"])},{sql_literal(canonical(event).decode())});')
for exposure in snapshot['exposures']:
    sql.append(f'INSERT OR IGNORE INTO hi_exposures(snapshot_version,exposure_id,event_id,record_id,scope,verified,exposure_json) VALUES({sql_literal(VERSION)},{sql_literal(exposure["id"])},{sql_literal(exposure["eventId"])},{sql_literal(exposure["recordId"])},{sql_literal(exposure["scope"])},{int(exposure["verified"])},{sql_literal(canonical(exposure).decode())});')
for series in root['series']:
    sql.append(f'INSERT OR IGNORE INTO hi_series(snapshot_version,series_id,source_id,series_json) VALUES({sql_literal(VERSION)},{sql_literal(series["id"])},{sql_literal(series["sourceId"])},{sql_literal(canonical(series).decode())});')
for record in compact_records:
    for series_id in record.get('historySeriesIds', []):
        # Scope and identity are already recorded in the historical series descriptor.
        descriptor = next(item for item in root['series'] if item['id'] == series_id)
        sql.append(f'INSERT OR IGNORE INTO hi_record_series(snapshot_version,record_id,series_id,scope,identity_verified) VALUES({sql_literal(VERSION)},{sql_literal(record["id"])},{sql_literal(series_id)},{sql_literal(descriptor.get("scope", "area_context"))},{int(descriptor.get("identityVerified", False))});')
d1_obj = immutable(gzip.compress(('\n'.join(sql) + '\n').encode(), mtime=0), '.sql.gz', 'd1_append_only_index')
new_publication['d1Index'] = d1_obj

# Commit local candidate files only after all structural checks are complete.
SNAPSHOT_PATH.write_bytes(canonical(snapshot) + b'\n')
PUBLICATION_PATH.write_bytes(canonical(new_publication) + b'\n')

# Rebuild only the bounded runtime from the enriched canonical snapshot.
sys.path.insert(0, str(ROOT / 'scripts'))
import importlib.util
spec = importlib.util.spec_from_file_location('build_historical_data', ROOT / 'scripts/build-historical-data.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.build_runtime_index(snapshot, new_publication)

print(json.dumps({'version': VERSION, 'records': len(snapshot['records']),
                  'projects': counts['projects'], 'communities': counts['communities'],
                  'historicalRowsPreserved': counts['historicalRows'],
                  'seriesPreserved': counts['series'], 'priorSources': len(old_source_ids),
                  'newSources': 1, 'newCommunityContextFacts': len(fact_ids),
                  'matchedRegisterProjectRows': manifest['dldProjectRegisterCommunityContext']['matchedRegisteredProjectRows'],
                  'financialObservationsAdded': 0, 'approved2080ForecastRecords': manifest['approved2080ForecastRecords']}))
