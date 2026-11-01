#!/usr/bin/env python3
"""Acceptance and preservation checks for the V50 ADREC market-data candidate."""
import gzip, hashlib, json, math, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = ROOT / 'data/historical-intelligence'
PASS = BASE / 'adrec-market-data-pass50'
VERSION = '20261022-enrichment-v50'
LATEST_VERSIONS = {'20261022-enrichment-v52', '20261022-enrichment-v53'}
CURRENT_VERSION = '20261027-enrichment-v55'
capture = json.loads((PASS / 'capture.json').read_bytes())
packet = json.loads((PASS / 'accepted-packet.json').read_bytes())
receipt = json.loads((PASS / 'reconciliation.json').read_bytes())
snapshot_raw = gzip.decompress((ROOT / 'data/historical-intelligence-20261003.json.gz').read_bytes())
snapshot = json.loads(snapshot_raw)
publication = json.loads((BASE / 'publication-manifest.json').read_bytes())
root_entry = publication['rootIndex']
root_raw = (ROOT / root_entry['path']).read_bytes()
root = json.loads(gzip.decompress(root_raw))

def check(condition, message):
    if not condition:
        raise AssertionError(message)

expected = {
    'adrec:10': ('Leonardo Residences', 199),
    'adrec:20': ('Al Hadeel', 140),
    'adrec:21': ('Al Bandar', 314),
    'adrec:23': ('Mayan', 837),
    'adrec:33': ("Water's Edge - Precinct B", 1755),
    'adrec:34': ('Al Zeina', 441),
    'adrec:365': ('Yas Beach Residence', 108),
    'adrec:367': ('Bawabat Al Sharq - Phase 2', 145),
    'adrec:37': ('Golf Gardens', 135),
    'adrec:38': ('Al Raha Gardens', 573),
    'adrec:391': ('Bloom Gardens', 63),
    'adrec:410': ('Al Mahra Residence', 182),
    'adrec:435': ('Al Reeman 2 - Phase 2', 758),
    'adrec:452': ('Perla 1', 119),
    'adrec:453': ('Perla 2', 63),
    'adrec:464': ('Jubail Terraces', 160),
    'adrec:487': ('Sea La Vie', 805),
    'adrec:495': ('Reeman Living 2', 520),
    'adrec:513': ('Manarat Living II', 289),
    'adrec:68': ('Yas Acres - The Dahlias', 194),
}

check(snapshot['version'] == publication['version'] and snapshot['version'] in {VERSION, *LATEST_VERSIONS, CURRENT_VERSION}, 'V50/latest snapshot/manifest mismatch')
check(receipt['version'] == VERSION, 'V50 receipt version changed')
check(snapshot['asOf'] == publication['asOf'] == ('2026-10-27' if snapshot['version'] == CURRENT_VERSION else '2026-10-22'), 'V50 cutoff mismatch')
check(len(snapshot['records']) == publication['counts']['records'] == 1860, 'Catalog size changed')
check(publication['counts']['projects'] == 1645 and publication['counts']['communities'] == 215, 'Catalog type counts changed')
check(len(snapshot['sources']) == publication['counts']['sources'] == (3529 if snapshot['version'] == CURRENT_VERSION else 3453 if snapshot['version'] in LATEST_VERSIONS else 3426), 'V50/latest source count mismatch')
check(publication['counts']['historicalRows'] == 633891 and publication['counts']['series'] == 16872, 'Prior native history counts changed')
check(receipt['nativeSeriesCount'] == 16872 and receipt['nativeSeriesDigestBefore'] == receipt['nativeSeriesDigestAfter'], 'Native history digest changed')
check(receipt['historicalRowsPreserved'] == 633891 and receipt['remoteWrites'] == 0, 'Preservation or no-remote-write receipt failed')
check(receipt['coverageBefore'] == receipt['coverageAfter'] and not any(receipt['coverageDelta'].values()), 'Coverage ledger changed')
check(receipt['publicationState'] == 'unmerged_candidate_only_reuse_rights_pending_not_published', 'Candidate publication boundary changed')

check(capture['baseVersion'] == '20261015-enrichment-v49' and capture['passId'] == packet['passId'], 'Pass identity mismatch')
check(capture['counts'] == {'projects': 20, 'apiRows': 7828, 'includedTransactions': 7800, 'excludedRows': 28}, 'Capture counts changed')
check(capture['requestCount'] == len(capture['requests']) == 23, 'Bounded request count changed')
check(capture['rawResponsesRetained'] is False and capture['personalFieldsRetained'] is False, 'Raw or personal fields retained')
check(capture['termsReview']['status'] == 'reuse_rights_unresolved', 'Reuse-rights gate removed')
check(len(capture['transactions']) == len(packet['facts']) == 7800, 'Normalized transaction count mismatch')
check(len({f['id'] for f in packet['facts']}) == 7800, 'Observation IDs are not unique')
check(len({f['observation']['sourceObservationId'] for f in packet['facts']}) == 7800, 'Source row hashes are not unique')
check(receipt['countsByRecord'] == {rid: count for rid, (_, count) in expected.items()}, 'Per-record receipt changed')
check(set(receipt['changedRecords']) == set(expected) and receipt['unaffectedRecordsPreserved'] == 1840, 'Record preservation receipt mismatch')
check(receipt['acceptedFacts'] == receipt['registeredTransactionsAdded'] == 7800, 'Accepted transaction count mismatch')
check(receipt['signedRentsAdded'] == receipt['valuationsAdded'] == receipt['askingPriceObservationsAdded'] == 0, 'Wrong evidence class was added')
check(receipt['numericForecastsAdded'] == 0 and not packet['numericForecasts'], 'Numeric forecast was added')
check(receipt['sourceCaptureSHA256'] == hashlib.sha256((PASS / 'capture.json').read_bytes()).hexdigest(), 'Capture checksum mismatch')
check(packet['captureSHA256'] == receipt['sourceCaptureSHA256'], 'Packet/capture checksum mismatch')
check(packet['rightsStatus'] == 'candidate_only_not_published_reuse_rights_unresolved', 'Reuse-rights disposition changed')

capture_counts = {x['recordId']: x['includedFullShareResidentialRows'] for x in capture['projects']}
check(capture_counts == receipt['countsByRecord'], 'Capture and receipt counts differ')
for rid, (project_name, expected_count) in expected.items():
    record = next(r for r in snapshot['records'] if r['id'] == rid)
    facts = [o for o in record['observations'] if o.get('id', '').startswith('adrec50-sale-')]
    check(record['emirate'] == 'Abu Dhabi' and record['type'] == 'project', f'Wrong record type/emirate for {rid}')
    check(len(facts) == expected_count, f'Fact count mismatch for {rid}')
    for o in facts:
        check(o['evidenceClass'] == 'registered_sale_transaction_primary_adrec_dashboard', 'Evidence class changed')
        check(o['scope'] == 'subject' and o['identityVerified'] is True and o['primaryEvidence'] is True, 'Subject identity not verified')
        check(o['observationKind'] == 'transaction' and o['transactionKind'] == 'sale', 'Sale observation mislabeled')
        check(o['sourceProjectName'] == project_name, f'Project name filter mismatch for {rid}')
        check(o['soldShare'] == 1.0 and o['sampleCount'] == 1, 'Partial share or aggregate was admitted')
        check(o['unit'] == 'AED/sqft' and math.isclose(o['value'], o['priceAED'] / o['areaSqm'] / 10.763910416709722, rel_tol=1e-10), 'Sale price/area arithmetic mismatch')
        check(o.get('transactionId') is None and o['sourceObservationId'].startswith('adrec-sha256:'), 'Native transaction ID was fabricated')
        check(o['publishedAt'] is None and o['firstAvailableAt'][:10] == '2026-10-22', 'Historical source availability was backdated')
        check(o['currentSnapshotEligible'] is False and o['includeInCurrentSnapshot'] is False, 'Historical sale promoted to current valuation')

sources = {s['id']: s for s in snapshot['sources']}
for source in packet['sources']:
    stored = sources[source['id']]
    check(stored['termsReviewStatus'] == 'reuse_rights_unresolved_candidate_only', 'Source reuse status missing')
    check(stored['rawTransactionRowsRetained'] is False and stored['rawTransactionIdsAvailable'] is False, 'Raw transaction source claim changed')
    check(source['totalElements'] == source['includedFullShareResidentialRows'] + sum(source['excludedRows'].values()), 'Source row reconciliation failed')

check(hashlib.sha256(root_raw).hexdigest() == root_entry['sha256'] and root['version'] == snapshot['version'], 'Root index integrity/version failure')
check(len(root['records']) == 1860 and len(root['sources']) == len(snapshot['sources']) and len(root['series']) == 16872, 'Root inventory mismatch')
for obj in publication['objects']:
    if obj['kind'] not in {'full_snapshot_index', 'd1_append_only_index'}:
        continue
    path = ROOT / obj['path']
    check(path.exists() and path.stat().st_size == obj['bytes'], f'Manifest object missing or wrong length: {obj["path"]}')
    check(hashlib.sha256(path.read_bytes()).hexdigest() == obj['sha256'], f'Manifest checksum mismatch: {obj["path"]}')

print(json.dumps({'version': VERSION, 'projects': len(expected), 'transactions': len(packet['facts']),
                  'unchangedRecords': receipt['unaffectedRecordsPreserved'], 'sources': len(packet['sources']),
                  'reuseRights': packet['rightsStatus'], 'rootAndObjects': 'verified'}))
