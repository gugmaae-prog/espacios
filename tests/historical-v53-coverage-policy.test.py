#!/usr/bin/env python3
"""Verify the V53 evidence-presence policy and its V52 preservation boundary."""
import collections
import gzip
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = ROOT / 'data/historical-intelligence'
VERSION = '20261022-enrichment-v53'
V52_ROOT = '1792c42000ba305e5514a1981d8493a22b3fd78c3e3866240c08fbe97ba76cf2'
V53_ROOT = '297f01d6dc212ad7e4f63b1e716d6b55b97044917e9cabafd44e7103d1ff5b3b'
ADVANCED = {
    'complete_registered_sale_history',
    'complete_signed_rent_history',
    'validated_price_forecast',
    'validated_rent_forecast',
    'validated_net_return_forecast',
}


def load(path):
    return json.loads(path.read_bytes())


snapshot = json.loads(gzip.decompress((BASE / 'objects' / f'{V53_ROOT}.json.gz').read_bytes()))
prior = json.loads(gzip.decompress((BASE / 'objects' / f'{V52_ROOT}.json.gz').read_bytes()))
receipt = load(BASE / 'coverage-policy-v2/reconciliation.json')
publication = load(BASE / 'publication-manifest.json')

assert snapshot['version'] == receipt['version'] == VERSION
assert publication['version'] in {VERSION, '20261027-enrichment-v54','20261027-enrichment-v55', '20261027-enrichment-v55'}
assert len(snapshot['records']) == len(prior['records']) == 1860
assert snapshot['sources'] == prior['sources'] and snapshot['events'] == prior['events'] and snapshot['exposures'] == prior['exposures']
assert len(snapshot['sources']) == 3453
assert publication['counts']['series'] == 16872 and publication['counts']['historicalRows'] == 633891

policy = snapshot['manifest']['coveragePolicy']
assert policy['id'] == 'evidence-presence-v2'
assert set(policy['advancedAuditItems']) == ADVANCED
assert len(policy['primaryItems']) == 18 and not set(policy['primaryItems']).intersection(ADVANCED)

before = {record['id']: record for record in prior['records']}
changed = set(receipt['changedRecords'])
assert len(changed) == receipt['registeredSaleRecordsPromoted'] == 27
credited = 0
for record in snapshot['records']:
    old = before[record['id']]
    if record['id'] not in changed:
        for key, value in old.items():
            if key != 'historySeriesIds':
                assert record[key] == value
        assert record['historySeriesIds'] == old['historySeriesIds']
        continue
    assert record['lifecycle'] == old['lifecycle']
    assert record['observations'] == old['observations']
    assert record['registerEvidence'] == old['registerEvidence']
    for key, value in record['researchStatus']['itemCoverage'].items():
        if key != 'registered_sale_history':
            assert value == old['researchStatus']['itemCoverage'][key]
    sale = record['researchStatus']['itemCoverage']['registered_sale_history']
    assert old['researchStatus']['itemCoverage']['registered_sale_history']['status'] == 'missing'
    assert sale['status'] == 'present' and sale['coverageBasis'] == 'bounded_exact_subject_authority_transactions'
    assert sale['completeLifetimeHistory'] is False and sale['transactionObservationCount'] > 0
    assert record['researchStatus']['itemCoverage']['complete_registered_sale_history']['status'] == 'unestablished'
    credited += sale['transactionObservationCount']

assert credited == receipt['registeredTransactionsCredited'] == 9941

primary = collections.Counter()
advanced = collections.Counter()
all_items = collections.Counter()
for record in snapshot['records']:
    for key, item in record['researchStatus']['itemCoverage'].items():
        all_items[item['status']] += 1
        (advanced if key in ADVANCED else primary)[item['status']] += 1

states = ('present', 'partial', 'missing', 'unestablished', 'disputed', 'inaccessible', 'pre-applicability')
assert {'total': sum(primary.values()), **{state: primary[state] for state in states}} == receipt['primaryCoverage']
assert {'total': sum(advanced.values()), **{state: advanced[state] for state in states}} == receipt['advancedAuditCoverage']
assert receipt['primaryCoverage'] == {'total': 33480, 'present': 3407, 'partial': 3402, 'missing': 26671,
                                      'unestablished': 0, 'disputed': 0, 'inaccessible': 0, 'pre-applicability': 0}
assert receipt['advancedAuditCoverage']['total'] == receipt['advancedAuditCoverage']['unestablished'] == 9300
assert receipt['numericForecastsAdded'] == receipt['sourcesAdded'] == receipt['observationsAdded'] == receipt['remoteWrites'] == 0

print(json.dumps({'version': VERSION, 'creditedTransactions': credited, 'promotedRecords': len(changed),
                  'primaryCoverage': receipt['primaryCoverage'], 'advancedAudit': receipt['advancedAuditCoverage']}))
