#!/usr/bin/env python3
"""Acceptance checks for the bounded V54 ADREC registered-sale candidate."""
import collections
import gzip
import hashlib
import json
import math
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = ROOT / 'data/historical-intelligence'
PASS = BASE / 'adrec-market-data-pass54'
VERSION = '20261027-enrichment-v54'
ADVANCED = {
    'complete_registered_sale_history', 'complete_signed_rent_history',
    'validated_price_forecast', 'validated_rent_forecast', 'validated_net_return_forecast',
}
EXPECTED = {
    'adrec:29': ("Water's Edge - Precinct A", 1387),
    'adrec:478': ('The Sustainable City - Yas Island - Phase 1', 1236),
    'adrec:465': ('Saadiyat Lagoons - Wilds - Phase 1', 775),
    'adrec:470': ('Saadiyat Lagoons - Phase 2 - Al Sidr', 751),
    'adrec:695': ('Hudayriyat Golf Estates - Townhomes', 685),
    'adrec:455': ('Bloom Living - Toledo', 577),
    'adrec:547': ('Bloom Living - Granada 1', 545),
    'adrec:505': ('Bloom Living - Casares', 529),
    'adrec:694': ('Hudayriyat Golf Estates - Villas', 527),
    'adrec:559': ('Bloom Living - Seville', 508),
    'adrec:619': ('Bloom Living - Granada 2', 446),
    'adrec:621': ('Bloom Living - Carmona', 379),
    'adrec:442': ('Bloom Living - Cordoba', 371),
    'adrec:573': ('Bloom Living - Olvera', 350),
    'adrec:471': ('Saadiyat Lagoons - Phase 2 - Ethir', 251),
    'adrec:469': ('Saadiyat Lagoons - Wilds - Phase 2', 226),
    'adrec:49': ('West Yas (Plots)', 193),
    'adrec:628': ('Bayn - Lagoon 2', 149),
    'adrec:623': ('Bayn - Waterway', 141),
    'adrec:638': ('Fay Hills - Fay Gardens', 120),
    'adrec:586': ('Merito', 90), 'adrec:578': ('Mamsha Gardens A', 86),
    'adrec:600': ('Brabus Island', 84), 'adrec:613': ('Perla 3', 83),
    'adrec:394': ('The View', 82),
    'adrec:474': ('Al Reeman 2 - Phase 3 - Fay Al Reeman II', 0),
}
STATES = ('present', 'partial', 'missing', 'unestablished', 'disputed', 'inaccessible', 'pre-applicability')


def load(path):
    return json.loads(path.read_bytes())


def check(value, message):
    if not value:
        raise AssertionError(message)


snapshot = json.loads(gzip.decompress((ROOT / 'data/historical-intelligence-20261003.json.gz').read_bytes()))
publication = load(BASE / 'publication-manifest.json')
plan = load(PASS / 'source-plan.json')
capture = load(PASS / 'capture.json')
packet = load(PASS / 'accepted-packet.json')
receipt = load(PASS / 'reconciliation.json')
root_entry = publication['rootIndex']
root_raw = (ROOT / root_entry['path']).read_bytes()
root = json.loads(gzip.decompress(root_raw))
records = {record['id']: record for record in snapshot['records']}
sources = {source['id']: source for source in snapshot['sources']}

check(snapshot['version'] == publication['version'] == root['version'] == receipt['version'] == VERSION, 'V54 version mismatch')
check(snapshot['asOf'] == publication['asOf'] == '2026-10-27', 'V54 cutoff mismatch')
check(hashlib.sha256(root_raw).hexdigest() == root_entry['sha256'] == receipt['rootSHA256'], 'V54 root integrity mismatch')
check(receipt['canonicalSHA256'] == hashlib.sha256(gzip.decompress((ROOT / 'data/historical-intelligence-20261003.json.gz').read_bytes())).hexdigest(), 'V54 canonical digest mismatch')
check(len(snapshot['records']) == publication['counts']['records'] == len(root['records']) == 1860, 'Catalogue changed')
check(publication['counts']['projects'] == 1645 and publication['counts']['communities'] == 215, 'Catalogue type counts changed')
check(len(snapshot['sources']) == publication['counts']['sources'] == len(root['sources']) == receipt['sourcesAfter'] == 3479, 'V54 source count mismatch')
check(publication['counts']['series'] == len(root['series']) == receipt['nativeSeriesCount'] == 16872, 'Native series changed')
check(publication['counts']['historicalRows'] == receipt['historicalRowsPreserved'] == 633891, 'Historical row count changed')

check(plan['baseVersion'] == capture['baseVersion'] == receipt['priorVersion'] == '20261022-enrichment-v53', 'V54 lineage changed')
check(plan['asOf'] == capture['asOf'] == '2026-10-27' and plan['dateWindow']['to'] == '2026-10-22', 'Capture and transaction cutoffs conflated')
check(capture['counts'] == {'projects': 26, 'apiRows': 11219, 'includedTransactions': 10571, 'excludedRows': 648}, 'V54 capture counts changed')
check(capture['requestCount'] == len(capture['requests']) == 30, 'V54 request bound changed')
check(capture['rawResponsesRetained'] is False and capture['personalFieldsRetained'] is False, 'Raw or personal data retained')
check(capture['termsReview']['status'] == 'reuse_rights_unresolved', 'Reuse-rights gate changed')
check(hashlib.sha256((PASS / 'capture.json').read_bytes()).hexdigest() == packet['captureSHA256'] == receipt['sourceCaptureSHA256'], 'Capture digest mismatch')
check(len(packet['facts']) == receipt['acceptedFacts'] == receipt['registeredTransactionsAdded'] == 10571, 'Accepted count mismatch')
check(len(packet['sources']) == receipt['sourcesAdded'] == 26, 'Source count mismatch')
check(receipt['countsByRecord'] == {rid: count for rid, (_, count) in EXPECTED.items()}, 'Per-record counts changed')
check(set(receipt['changedRecords']) == set(EXPECTED), 'Reviewed record set changed')
check(receipt['coverageBefore'] == {'present': 3407, 'partial': 3402, 'missing': 26671, 'unestablished': 9300, 'disputed': 0, 'inaccessible': 0, 'pre-applicability': 0}, 'V53 coverage baseline changed')
check(receipt['coverageAfter'] == {'present': 3432, 'partial': 3402, 'missing': 26646, 'unestablished': 9300, 'disputed': 0, 'inaccessible': 0, 'pre-applicability': 0}, 'V54 coverage result changed')
check(receipt['coverageDelta'] == {'present': 25, 'partial': 0, 'missing': -25, 'unestablished': 0, 'disputed': 0, 'inaccessible': 0, 'pre-applicability': 0}, 'V54 coverage delta changed')
check(receipt['signedRentsAdded'] == receipt['valuationsAdded'] == receipt['askingPriceObservationsAdded'] == receipt['numericForecastsAdded'] == 0, 'Wrong evidence class added')
check(receipt['remoteWrites'] == 0 and receipt['publicationState'] == 'unmerged_candidate_only_reuse_rights_pending_not_published', 'Publication boundary changed')
check(packet['rightsStatus'] == 'candidate_only_not_published_reuse_rights_unresolved' and not packet['numericForecasts'], 'Rights or forecast boundary changed')
check(len({fact['id'] for fact in packet['facts']}) == 10571, 'Duplicate V54 fact IDs')

for rid, (project_name, expected_count) in EXPECTED.items():
    record = records[rid]
    observations = [item for item in record['observations'] if item.get('id', '').startswith('adrec54-sale-')]
    check(record['type'] == 'project' and record['emirate'] == 'Abu Dhabi', f'Wrong subject for {rid}')
    check(len(observations) == expected_count, f'V54 observation count mismatch for {rid}')
    sale_coverage = record['researchStatus']['itemCoverage']['registered_sale_history']
    check(sale_coverage['status'] == ('present' if expected_count else 'missing'), f'Coverage promotion mismatch for {rid}')
    check(record['researchStatus']['itemCoverage']['complete_registered_sale_history']['status'] == 'unestablished', f'Lifetime completeness changed for {rid}')
    for item in observations:
        check(item['evidenceClass'] == 'registered_sale_transaction_primary_adrec_dashboard', 'Evidence class changed')
        check(item['scope'] == 'subject' and item['identityVerified'] is True and item['primaryEvidence'] is True, 'Identity gate changed')
        check(item['observationKind'] == 'transaction' and item['transactionKind'] == 'sale', 'Sale mislabeled')
        check(item['sourceProjectName'] == project_name and item['soldShare'] == 1.0 and item['sampleCount'] == 1, 'Filter or full-share gate changed')
        check(item['unit'] == 'AED/sqft' and math.isclose(item['value'], item['priceAED'] / item['areaSqm'] / 10.763910416709722, rel_tol=1e-10), 'Sale arithmetic mismatch')
        check(item['transactionId'] == item['sourceObservationId'] and item['sourceObservationId'].startswith('adrec-sha256:'), 'Stable normalized transaction key changed')
        check(item['publishedAt'] is None and item['firstAvailableAt'][:10] == '2026-10-27', 'Availability date changed')
        check(item['currentSnapshotEligible'] is False and item['includeInCurrentSnapshot'] is False, 'Historical sale became current valuation')

for source in packet['sources']:
    stored = sources[source['id']]
    check(stored['termsReviewStatus'] == 'reuse_rights_unresolved_candidate_only', 'Stored source rights changed')
    check(stored['rawTransactionRowsRetained'] is False and stored['rawTransactionIdsAvailable'] is False, 'Stored raw-data claim changed')
    check(source['totalElements'] == source['includedFullShareResidentialRows'] + sum(source['excludedRows'].values()), 'Source row reconciliation failed')

primary = collections.Counter()
advanced = collections.Counter()
for record in snapshot['records']:
    for key, item in record['researchStatus']['itemCoverage'].items():
        (advanced if key in ADVANCED else primary)[item['status']] += 1
expected_primary = {'total': 33480, 'present': 3432, 'partial': 3402, 'missing': 26646, 'unestablished': 0, 'disputed': 0, 'inaccessible': 0, 'pre-applicability': 0}
expected_advanced = {'total': 9300, 'present': 0, 'partial': 0, 'missing': 0, 'unestablished': 9300, 'disputed': 0, 'inaccessible': 0, 'pre-applicability': 0}
check({'total': sum(primary.values()), **{state: primary[state] for state in STATES}} == expected_primary, 'Primary coverage summary changed')
check({'total': sum(advanced.values()), **{state: advanced[state] for state in STATES}} == expected_advanced, 'Advanced audit changed')
check(snapshot['manifest']['coverageSummary']['primary'] == expected_primary, 'Manifest primary coverage is stale')
check(snapshot['manifest']['coverageSummary']['advancedAudit'] == expected_advanced, 'Manifest advanced coverage is stale')
check(snapshot['manifest']['directSubjectSaleHistoryRecords'] == 432, 'Direct subject sale-history count changed')
check(receipt['nativeSeriesDigestBefore'] == receipt['nativeSeriesDigestAfter'] == 'eb270ec89dd5bef9cb4402d2d21459078f2222c241cfe2c6bc11b8faef240456', 'Native series digest changed')

print(json.dumps({'version': VERSION, 'reviewedProjects': 26, 'promotedProjects': 25, 'transactions': 10571,
                  'apiRows': 11219, 'excludedRows': 648, 'sources': 3479,
                  'primaryCoverage': expected_primary, 'advancedAudit': expected_advanced,
                  'publication': 'candidate-only'}))
