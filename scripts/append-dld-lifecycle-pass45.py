#!/usr/bin/env python3
"""Append dated authority lifecycle reports to V45 without changing financial evidence."""
import collections
import gzip
import hashlib
import importlib.util
import json
from copy import deepcopy
from pathlib import Path

from historical_enrichment import apply_enrichment

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'data/historical-intelligence'
SNAPSHOT_PATH = ROOT / 'data/historical-intelligence-20261003.json'
PUBLICATION_PATH = BASE / 'publication-manifest.json'
PACKET_PATH = BASE / 'dld-lifecycle-pass45-20261013.json'
VERSION = '20261013-enrichment-v45'
PRIOR = '20261012-enrichment-v44'


def canonical(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), sort_keys=True).encode()


def digest(value):
    return hashlib.sha256(value).hexdigest()


def sql_literal(value):
    return "'" + str(value).replace("'", "''") + "'"


def immutable(blob, suffix, kind):
    checksum = digest(blob)
    path = BASE / 'objects' / f'{checksum}{suffix}'
    if path.exists() and path.read_bytes() != blob:
        raise ValueError('Immutable collision')
    if not path.exists():
        path.write_bytes(blob)
    return {
        'key': f'research/published/2026-10-13/historical-intelligence/objects/{path.name}',
        'path': str(path.relative_to(ROOT)),
        'sha256': checksum,
        'bytes': len(blob),
        'kind': kind,
        'compression': 'gzip',
    }


def main():
    snapshot = json.loads(SNAPSHOT_PATH.read_bytes())
    publication = json.loads(PUBLICATION_PATH.read_bytes())
    packet = json.loads(PACKET_PATH.read_bytes())
    assert snapshot['version'] == publication['version'] == packet['priorVersion'] == PRIOR
    assert packet['passId'] == 'dld-lifecycle-pass45-20261013'
    # The packet pins the published, compressed V44 root—not the editable
    # working snapshot—so provenance is checked against that immutable object.
    prior_root_path = ROOT / publication['rootIndex']['path']
    assert digest(prior_root_path.read_bytes()) == packet['priorRootSHA256']

    original = deepcopy(snapshot)
    prior_root = json.loads(gzip.decompress(prior_root_path.read_bytes()))
    assert digest(prior_root_path.read_bytes()) == publication['rootIndex']['sha256']
    backup = ROOT / '.local-data/identity-pass45/baseline'
    backup.mkdir(parents=True, exist_ok=True)
    for source in [SNAPSHOT_PATH, PUBLICATION_PATH]:
        target = backup / source.name
        if not target.exists():
            target.write_bytes(source.read_bytes())

    records = {record['id']: record for record in snapshot['records']}
    changed = {fact['recordId'] for fact in packet['facts']}
    assert len(changed) == 8 and len(packet['facts']) == 31
    assert not packet['sources'] and packet['financialObservationsAdded'] == 0
    for check in packet['recordIdentityChecks']:
        record = records[check['recordId']]
        assert (record['name'], record['type'], record['emirate']) == (check['catalogueName'], 'project', 'Dubai')
        assert check['authorityProjectNumber'] and check['authorityDeveloperNumber']

    sources = {source['id']: source for source in snapshot['sources']}
    def no_new_source(source):
        raise ValueError(f'V45 must use retained source, not create {source["id"]}')

    affected = [record for record in snapshot['records'] if record['id'] in changed]
    snapshot['asOf'] = packet['asOf']
    snapshot['manifest']['asOf'] = packet['asOf']
    result = apply_enrichment(packet, affected, {}, sources, no_new_source, {}, snapshot['asOf'])

    previous = {record['id']: record for record in original['records']}
    for record in affected:
        before = previous[record['id']]
        assert record['currentSnapshot'] == before['currentSnapshot']
        assert record['scenarioInputs'] == before['scenarioInputs']
        assert record['scenarioCoverage'] == before['scenarioCoverage']
        assert record['observations'] == before['observations']
        assert record['lifecycle'][:len(before['lifecycle'])] == before['lifecycle']
        additions = record['lifecycle'][len(before['lifecycle']):]
        assert additions and all(item['sourceIds'] for item in additions)
    for before, after in zip(original['records'], snapshot['records']):
        if before['id'] not in changed:
            assert before == after
    assert snapshot['sources'] == original['sources']
    assert snapshot['events'] == original['events'] and snapshot['exposures'] == original['exposures']
    assert len(snapshot['records']) == 1860 and sum(record['type'] == 'project' for record in snapshot['records']) == 1645

    snapshot['version'] = VERSION
    snapshot['manifest']['version'] = VERSION
    snapshot['manifest']['dldLifecyclePass45'] = {
        'factsAdded': 31,
        'recordsChanged': 8,
        'sourcesAdded': 0,
        'packetSHA256': digest(PACKET_PATH.read_bytes()),
        'packetPath': str(PACKET_PATH.relative_to(ROOT)),
        'futureDatedInspectionExcluded': 1,
    }
    snapshot['manifest']['sourceEnrichment'].setdefault('supplementalPasses', []).append({
        'passId': packet['passId'], **result,
    })

    new_history, pointers = [], {}
    for prior in publication['objects']:
        if prior['kind'] != 'history_partition':
            continue
        blob = (ROOT / prior['path']).read_bytes()
        assert digest(blob) == prior['sha256']
        archive = json.loads(gzip.decompress(blob))
        assert archive['version'] == PRIOR
        archive['version'] = VERSION
        archive['asOf'] = snapshot['asOf']
        object_row = immutable(gzip.compress(canonical(archive), mtime=0), '.json.gz', 'history_partition')
        new_history.append(object_row)
        pointer = {key: object_row[key] for key in ['key', 'sha256', 'bytes', 'compression']}
        for series in archive['series']:
            assert series['id'] not in pointers
            pointers[series['id']] = pointer
    assert len(pointers) == len(prior_root['series'])
    for record in snapshot['records']:
        for series in record.get('historySeries', []):
            if series.get('partition'):
                series['partition'] = pointers[series['id']]
    for series in prior_root['series']:
        series['partition'] = pointers[series['id']]

    compact = []
    for record in prior_root['records']:
        if record['id'] in changed:
            full = records[record['id']]
            for key in ['lifecycle', 'researchStatus', 'coverageSummary']:
                record[key] = deepcopy(full[key])
        compact.append(record)
    prior_root.update(version=VERSION, asOf=snapshot['asOf'], manifest=snapshot['manifest'], sources=snapshot['sources'], records=compact)
    root = immutable(gzip.compress(canonical(prior_root), mtime=0), '.json.gz', 'full_snapshot_index')
    replaced = {'runtime_history_partition', 'runtime_record_shard', 'runtime_index', 'history_partition', 'full_snapshot_index'}
    objects = [item for item in publication['objects'] if item['kind'] not in replaced] + new_history + [root]
    publication_next = {'version': VERSION, 'asOf': snapshot['asOf'], 'rootIndex': root, 'objects': objects, 'counts': dict(publication['counts'])}

    sql = ['PRAGMA foreign_keys = ON;']
    def insert(table, columns, values):
        rendered = ','.join(str(value) if isinstance(value, int) else sql_literal(value) for value in values)
        sql.append(f"INSERT OR IGNORE INTO {table}({','.join(columns)}) VALUES({rendered});")
    manifest = snapshot['manifest']
    insert('hi_snapshots', ['snapshot_version', 'as_of', 'record_count', 'manifest_json', 'root_sha256'], [VERSION, snapshot['asOf'], 1860, canonical(manifest).decode(), root['sha256']])
    for record in compact:
        insert('hi_records', ['snapshot_version', 'record_id', 'record_type', 'name', 'emirate', 'record_json'], [VERSION, record['id'], record['type'], record['name'], record['emirate'], canonical({key:value for key,value in record.items() if key != 'historySeriesIds'}).decode()])
    for source in snapshot['sources']:
        insert('hi_sources', ['snapshot_version', 'source_id', 'url', 'source_json'], [VERSION, source['id'], source.get('url', ''), canonical(source).decode()])
    for event in snapshot['events']:
        insert('hi_events', ['snapshot_version', 'event_id', 'event_json'], [VERSION, event['id'], canonical(event).decode()])
    for exposure in snapshot['exposures']:
        insert('hi_exposures', ['snapshot_version', 'exposure_id', 'event_id', 'record_id', 'scope', 'verified', 'exposure_json'], [VERSION, exposure['id'], exposure['eventId'], exposure['recordId'], exposure['scope'], int(exposure['verified']), canonical(exposure).decode()])
    descriptors = {series['id']: series for series in prior_root['series']}
    for series in prior_root['series']:
        insert('hi_series', ['snapshot_version', 'series_id', 'source_id', 'series_json'], [VERSION, series['id'], series['sourceId'], canonical(series).decode()])
    for record in compact:
        for series_id in record.get('historySeriesIds', []):
            series = descriptors[series_id]
            insert('hi_record_series', ['snapshot_version', 'record_id', 'series_id', 'scope', 'identity_verified'], [VERSION, record['id'], series_id, series.get('scope', 'area_context'), int(series.get('identityVerified', False))])
    publication_next['d1Index'] = immutable(gzip.compress(('\n'.join(sql) + '\n').encode(), mtime=0), '.sql.gz', 'd1_append_only_index')

    SNAPSHOT_PATH.write_bytes(canonical(snapshot) + b'\n')
    SNAPSHOT_PATH.with_suffix('.json.gz').write_bytes(gzip.compress(SNAPSHOT_PATH.read_bytes(), compresslevel=9, mtime=0))
    PUBLICATION_PATH.write_bytes(canonical(publication_next) + b'\n')
    spec = importlib.util.spec_from_file_location('build_historical_data', ROOT / 'scripts/build-historical-data.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.build_runtime_index(snapshot, publication_next)
    ledger = collections.Counter(item['status'] for record in snapshot['records'] for item in record['researchStatus']['itemCoverage'].values())
    receipt = {
        'version': VERSION,
        'changedRecords': sorted(changed),
        'newLifecycleFacts': 31,
        'newAdvertisedBedroomQuotes': 0,
        'newRegisteredSales': 0,
        'newRegisteredRents': 0,
        'newSources': 0,
        'historicalRowsPreserved': publication_next['counts']['historicalRows'],
        'seriesPreserved': publication_next['counts']['series'],
        'ledger': dict(ledger),
        'rootSHA256': root['sha256'],
    }
    (BASE / 'dld-lifecycle-pass45-reconciliation.json').write_bytes(canonical(receipt) + b'\n')
    print(json.dumps(receipt))


if __name__ == '__main__':
    main()
