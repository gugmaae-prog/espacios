#!/usr/bin/env python3
"""Acceptance checks for the bounded V51 and V52 ADREC sale candidates."""
import gzip
import hashlib
import json
import math
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = ROOT / 'data/historical-intelligence'
VERSION = '20261022-enrichment-v52'
LATEST_VERSION = '20261022-enrichment-v53'


def load(path):
    return json.loads(path.read_bytes())


def check(condition, message):
    if not condition:
        raise AssertionError(message)


snapshot = json.loads(gzip.decompress((ROOT / 'data/historical-intelligence-20261003.json.gz').read_bytes()))
publication = load(BASE / 'publication-manifest.json')
root_entry = publication['rootIndex']
root_raw = (ROOT / root_entry['path']).read_bytes()
root = json.loads(gzip.decompress(root_raw))
records = {record['id']: record for record in snapshot['records']}
stored_sources = {source['id']: source for source in snapshot['sources']}

passes = {
    51: {
        'version': '20261022-enrichment-v51',
        'baseVersion': '20261022-enrichment-v50',
        'apiRows': 7935,
        'included': 7899,
        'excluded': 36,
        'projects': 13,
        'requests': 16,
        'sourcesAfter': 3439,
        'prefix': 'adrec51-sale-',
        'expected': {
            'adrec:48': ('Noya - Phase 1', 980),
            'adrec:485': ('Reeman Living', 894),
            'adrec:540': ('Mangrove Village', 306),
            'adrec:560': ('Royal Park', 433),
            'adrec:561': ('Bal Ghaiylam', 1460),
            'adrec:564': ('Al Naseem', 999),
            'adrec:567': ('Nawayef West B', 361),
            'adrec:581': ('Mamsha Gardens B', 400),
            'adrec:590': ('Manarat Living III', 417),
            'adrec:603': ('Nawayef Village Townhouses', 376),
            'adrec:609': ('Fahid Beach Residences', 426),
            'adrec:617': ('Fahid Beach Terraces', 397),
            'adrec:620': ('Al Deem Townhomes', 450),
        },
    },
    52: {
        'version': VERSION,
        'baseVersion': '20261022-enrichment-v51',
        'apiRows': 2043,
        'included': 2042,
        'excluded': 1,
        'projects': 14,
        'requests': 16,
        'sourcesAfter': 3453,
        'prefix': 'adrec52-sale-',
        'expected': {
            'adrec:466': ('The Bay Residence', 139),
            'adrec:496': ('C3 Garden', 92),
            'adrec:507': ('Mayyas at the Bay', 185),
            'adrec:534': ('Sama Yas', 238),
            'adrec:555': ('Icon', 135),
            'adrec:580': ('Bab Al Qasr Residence 25', 116),
            'adrec:582': ('The Fountain View Residences', 211),
            'adrec:591': ('Selina Bay', 275),
            'adrec:596': ('Bab Al Qasr Residence 31', 105),
            'adrec:601': ('Yas Links Luxury Living', 125),
            'adrec:607': ('Juman 1', 99),
            'adrec:627': ('Juman 2', 113),
            'adrec:635': ('Al Sharq Heights', 100),
            'adrec:645': ('Juman 3', 109),
        },
    },
}

check(snapshot['version'] == publication['version'] and snapshot['version'] in {VERSION, LATEST_VERSION}, 'V52/latest snapshot/manifest mismatch')
check(snapshot['asOf'] == publication['asOf'] == '2026-10-22', 'V52 cutoff mismatch')
check(len(snapshot['records']) == publication['counts']['records'] == len(root['records']) == 1860, 'Catalog size changed')
check(publication['counts']['projects'] == 1645 and publication['counts']['communities'] == 215, 'Catalog type counts changed')
check(len(snapshot['sources']) == publication['counts']['sources'] == len(root['sources']) == 3453, 'V52 source count mismatch')
check(publication['counts']['historicalRows'] == 633891 and publication['counts']['series'] == len(root['series']) == 16872, 'Native history changed')
check(hashlib.sha256(root_raw).hexdigest() == root_entry['sha256'] and root['version'] == snapshot['version'], 'Root integrity/version failure')

combined_facts = 0
combined_records = set()
for number, config in passes.items():
    folder = BASE / f'adrec-market-data-pass{number}'
    capture = load(folder / 'capture.json')
    packet = load(folder / 'accepted-packet.json')
    receipt = load(folder / 'reconciliation.json')
    expected_counts = {rid: count for rid, (_, count) in config['expected'].items()}
    check(capture['baseVersion'] == config['baseVersion'] and receipt['version'] == config['version'], f'V{number} pass lineage changed')
    check(capture['counts'] == {'projects': config['projects'], 'apiRows': config['apiRows'], 'includedTransactions': config['included'], 'excludedRows': config['excluded']}, f'V{number} capture counts changed')
    check(capture['requestCount'] == len(capture['requests']) == config['requests'], f'V{number} request bound changed')
    check(capture['rawResponsesRetained'] is False and capture['personalFieldsRetained'] is False, f'V{number} retained raw or personal data')
    check(capture['termsReview']['status'] == 'reuse_rights_unresolved', f'V{number} reuse-rights gate changed')
    check(len(packet['facts']) == receipt['acceptedFacts'] == receipt['registeredTransactionsAdded'] == config['included'], f'V{number} accepted count mismatch')
    check(receipt['countsByRecord'] == expected_counts and set(receipt['changedRecords']) == set(expected_counts), f'V{number} record reconciliation changed')
    check(receipt['sourcesAfter'] == config['sourcesAfter'] and receipt['sourcesAdded'] == config['projects'], f'V{number} source reconciliation changed')
    check(receipt['nativeSeriesCount'] == 16872 and receipt['historicalRowsPreserved'] == 633891, f'V{number} native history changed')
    check(receipt['coverageBefore'] == receipt['coverageAfter'] and not any(receipt['coverageDelta'].values()), f'V{number} coverage ledger changed')
    check(receipt['signedRentsAdded'] == receipt['valuationsAdded'] == receipt['askingPriceObservationsAdded'] == receipt['numericForecastsAdded'] == 0, f'V{number} wrong evidence class added')
    check(receipt['remoteWrites'] == 0 and receipt['publicationState'] == 'unmerged_candidate_only_reuse_rights_pending_not_published', f'V{number} publication boundary changed')
    check(receipt['sourceCaptureSHA256'] == hashlib.sha256((folder / 'capture.json').read_bytes()).hexdigest() == packet['captureSHA256'], f'V{number} capture checksum mismatch')
    check(packet['rightsStatus'] == 'candidate_only_not_published_reuse_rights_unresolved' and not packet['numericForecasts'], f'V{number} rights or forecast boundary changed')
    check(len({fact['id'] for fact in packet['facts']}) == config['included'], f'V{number} duplicate fact IDs')
    for rid, (project_name, expected_count) in config['expected'].items():
        record = records[rid]
        observations = [item for item in record['observations'] if item.get('id', '').startswith(config['prefix'])]
        check(record['type'] == 'project' and record['emirate'] == 'Abu Dhabi', f'Wrong subject identity for {rid}')
        check(len(observations) == expected_count, f'V{number} fact count mismatch for {rid}')
        for item in observations:
            check(item['evidenceClass'] == 'registered_sale_transaction_primary_adrec_dashboard', 'Evidence class changed')
            check(item['scope'] == 'subject' and item['identityVerified'] is True and item['primaryEvidence'] is True, 'Exact identity gate changed')
            check(item['observationKind'] == 'transaction' and item['transactionKind'] == 'sale', 'Sale observation mislabeled')
            check(item['sourceProjectName'] == project_name and item['soldShare'] == 1.0 and item['sampleCount'] == 1, 'Project filter or full-share gate changed')
            check(item['unit'] == 'AED/sqft' and math.isclose(item['value'], item['priceAED'] / item['areaSqm'] / 10.763910416709722, rel_tol=1e-10), 'Sale arithmetic mismatch')
            check(item.get('transactionId') is None and item['sourceObservationId'].startswith('adrec-sha256:'), 'Native transaction ID fabricated')
            check(item['publishedAt'] is None and item['firstAvailableAt'][:10] == '2026-10-22', 'Availability backdated')
            check(item['currentSnapshotEligible'] is False and item['includeInCurrentSnapshot'] is False, 'Historical sale promoted to current valuation')
        combined_records.add(rid)
    for source in packet['sources']:
        stored = stored_sources[source['id']]
        check(stored['termsReviewStatus'] == 'reuse_rights_unresolved_candidate_only', 'Stored source rights changed')
        check(stored['rawTransactionRowsRetained'] is False and stored['rawTransactionIdsAvailable'] is False, 'Stored source raw-data claim changed')
        check(source['totalElements'] == source['includedFullShareResidentialRows'] + sum(source['excludedRows'].values()), 'Source row reconciliation failed')
    combined_facts += len(packet['facts'])

check(combined_facts == 9941 and combined_facts >= 9000, 'Combined V51/V52 target was not met')
check(len(combined_records) == 27, 'Combined exact-project count changed')
expected_coverage = {'disputed': 0, 'inaccessible': 0, 'missing': 26698, 'partial': 3402, 'pre-applicability': 0, 'present': 3380, 'unestablished': 9300}
check(passes[52] and load(BASE / 'adrec-market-data-pass52/reconciliation.json')['coverageAfter'] == expected_coverage, 'Coverage ledger totals changed')

print(json.dumps({'version': snapshot['version'], 'passes': [51, 52], 'projects': len(combined_records), 'transactions': combined_facts, 'sources': len(snapshot['sources']), 'coverage': expected_coverage, 'publication': 'candidate-only'}))
