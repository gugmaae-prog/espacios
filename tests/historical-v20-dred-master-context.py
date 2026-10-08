#!/usr/bin/env python3
"""Verify V20 DRED master-community history remains contextual and deduplicated."""
import csv
import gzip
import hashlib
import json
import sys
import tempfile
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from historical_enrichment import load_enrichment

BASE = ROOT / 'data/historical-intelligence'
PASS_ID = 'pass44-dred-master-community-context'
SOURCE_ID = 'v19-dred-sales-20261005'


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def test_sidecar_loading_is_explicit_and_keeps_the_vintage():
    with tempfile.TemporaryDirectory() as temp:
        base = Path(temp)
        (base / 'scrape-enrichment.json').write_text(json.dumps({
            'schemaVersion': 1, 'asOf': '2026-10-07', 'collection': {'passes': []},
            'sources': [], 'facts': [], 'seriesLinks': [], 'historyInputs': [],
            'licensedArchives': [], 'additionalDatasets': [], 'recordResearch': [], 'sourceCandidates': [],
        }))
        raw = b'Period,Value\n2025-01,100\n'
        blob = gzip.compress(raw, mtime=0)
        (base / 'monthly.csv.gz').write_bytes(blob)
        (base / 'pass44.json').write_text(json.dumps({
            'schemaVersion': 1, 'passId': PASS_ID, 'asOf': '2026-10-08',
            'sources': [], 'facts': [], 'seriesLinks': [], 'licensedArchives': [],
            'additionalDatasets': [], 'recordResearch': [], 'sourceCandidates': [],
            'collection': {'passId': PASS_ID}, 'methodology': 'context only',
            'historyInputs': [{'id': 'monthly', 'path': 'monthly.csv.gz', 'sha256': hashlib.sha256(blob).hexdigest(),
                               'uncompressedSHA256': hashlib.sha256(raw).hexdigest(), 'compression': 'gzip'}],
        }))
        packet = load_enrichment(base, ['pass44.json'])
        check(packet['asOf'] == '2026-10-08', 'Explicit sidecar did not advance the evidence cutoff.')
        check(packet['collection']['passes'] == [{'passId': PASS_ID}], 'Sidecar pass receipt was not retained.')
        check(packet['historyInputs'][0]['rows'] == [{'Period': '2025-01', 'Value': '100'}], 'Sidecar input checksum/decode failed.')


def test_community_rollups_keep_identity_scope_and_sparse_medians_explicit():
    sidecar = json.loads((BASE / 'community-master-context-enrichment.json').read_text())
    history = sidecar['historyInputs'][0]
    check(history['rowCount'] == 13586, 'Supplement input row count is incorrect.')
    path = BASE / history['path']
    payload = path.read_bytes()
    check(hashlib.sha256(payload).hexdigest() == history['sha256'], 'Immutable V20 CSV hash changed.')
    uncompressed = gzip.decompress(payload)
    check(hashlib.sha256(uncompressed).hexdigest() == history['uncompressedSHA256'], 'V20 CSV content hash changed.')
    check(sidecar['collection']['matchedSourceTransactionRows'] == 561282, 'Exact master-label source population changed.')
    check(sidecar['collection']['existingRecordTransactionPairsDeduplicated'] == 67268, 'Prior transaction de-duplication changed.')
    check(sidecar['collection']['newSourceTransactionsAtRecordNotPreviouslyLinked'] == 494014, 'Newly represented source rows changed.')
    check(sidecar['collection']['newCommunityRecords'] == 44, 'New community count changed.')
    check(sidecar['collection']['recordObservedDateEnvelope'] == {'start': '2003-06-02', 'end': '2026-07-31'}, 'Observed date envelope changed.')

    snapshot = json.loads((ROOT / 'data/historical-intelligence-20261003.json').read_text())
    check(snapshot['version'] in {'20261008-enrichment-v22', '20261008-enrichment-v23', '20261008-enrichment-v24','20261008-enrichment-v25','20261008-enrichment-v26','20261008-enrichment-v27','20261008-enrichment-v28', '20261008-enrichment-v29','20261008-enrichment-v30','20261008-enrichment-v31','20261008-enrichment-v32'} and snapshot['asOf'] == '2026-10-08', 'V22 or later snapshot identity/cutoff changed.')
    supplemental = snapshot['manifest']['sourceEnrichment']['supplementalPasses']
    receipt = next(item for item in supplemental if item['passId'] == PASS_ID)
    sidecar_path = BASE / 'community-master-context-enrichment.json'
    check(receipt['path'] == sidecar_path.name and receipt['sha256'] == hashlib.sha256(sidecar_path.read_bytes()).hexdigest(), 'Supplemental pass provenance is not pinned in the snapshot manifest.')
    records = {record['id']: record for record in snapshot['records']}
    names = {record['id']: record['name'] for record in snapshot['records'] if record['type'] == 'community' and record['emirate'] == 'Dubai'}
    dred_source = next(source for source in snapshot['sources'] if source['id'] == SOURCE_ID)
    check('CC BY 4.0' in dred_source['licence'] and 'Dubai Real Estate Data' in dred_source['publisher'], 'Source attribution or declared license was lost.')
    point_counts = Counter()
    sample_counts = Counter()
    represented_source_rows = 0
    withheld = 0
    series_ids = set()
    with gzip.open(path, 'rt', encoding='utf-8', newline='') as stream:
        for row in csv.DictReader(stream):
            check(row['Observation kind'] == 'aggregate' and row['Frequency'] == 'monthly', 'Raw transaction rows must not be silently implied by monthly context.')
            check(row['Record ID'] in names, 'A community link targets a missing or non-Dubai identity.')
            check(row['Geography'].strip().casefold() == names[row['Record ID']].strip().casefold(), 'A non-exact master label was accepted.')
            check(row['Source area ID'].isdigit(), 'Native source area ID was discarded.')
            check(row['Source ID'] == SOURCE_ID and row['Metric'] == 'price' and row['Unit'] == 'AED/sqft', 'Source or price unit changed.')
            check(row['Period'].startswith('20') and len(row['Period']) == 7, 'Monthly native period precision changed.')
            check(row['Label'].startswith('DRED master-community context'), 'Context label is not visible in the financial-series selector.')
            sample = int(row['Sample rows'])
            represented_source_rows += sample
            sample_counts['eligible' if sample >= 20 else 'sparse'] += 1
            if sample < 20:
                withheld += 1
                check(row['Value'] == '' and row['Quality'] == 'withheld median: sparse/invalid', 'A sparse median was not withheld.')
            else:
                check(float(row['Value']) > 0 and row['Quality'] == 'sample >=20 and positive median', 'An eligible median is invalid.')
            native = json.loads(row['Native row JSON'])
            check(native['transactionCount'] == sample and native['sourceMasterProjectName'].strip().casefold() == names[row['Record ID']].strip().casefold(), 'Monthly native sample metadata changed.')
            check('overlap' in native['geographyOverlapWarning'].lower(), 'Overlapping geographies are not identified.')
            series_ids.add(row['Series ID'])
            point_counts[row['Record ID']] += 1
    check(sum(point_counts.values()) == 13586, 'Monthly row count changed.')
    check(represented_source_rows == 539872, 'Monthly sample rows no longer reconcile to the retained cohort population.')
    check(len(point_counts) == 44, 'Monthly data no longer covers exactly the 44 incremented communities.')
    check(withheld == 8912 and sample_counts == {'sparse': 8912, 'eligible': 4674}, 'Sparse-sample gate changed.')
    check(len(series_ids) == 208, 'Monthly cohort series count changed.')

    linked = set()
    for record_id, points in point_counts.items():
        record = records[record_id]
        series = [item for item in record['historySeries'] if item.get('sourceId') == SOURCE_ID and item.get('scope') == 'community_context']
        check(series and all(item.get('identityVerified') is False for item in series), 'Master labels were promoted to verified subject history.')
        check(all(item.get('identityBasis') and item.get('partition') for item in series), 'Context evidence or immutable history partition is missing.')
        linked.add(record_id)
    check(len(linked) == 44, 'V20 context series are not attached to every matched catalogue record.')
    check(snapshot['manifest']['approved2080ForecastRecords'] == 0, 'Observed context was incorrectly promoted to a validated 2080 forecast.')
    check(snapshot['manifest']['recordCount'] == 1860 and snapshot['manifest']['projectCount'] == 1645 and snapshot['manifest']['communityCount'] == 215, 'Catalogue records were lost.')


if __name__ == '__main__':
    test_sidecar_loading_is_explicit_and_keeps_the_vintage()
    test_community_rollups_keep_identity_scope_and_sparse_medians_explicit()
    print('V20 DRED master-community context preserved in V22.')
