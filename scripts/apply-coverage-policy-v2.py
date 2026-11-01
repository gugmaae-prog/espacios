#!/usr/bin/env python3
"""Apply the evidence-presence coverage policy to the reviewed V52 candidate."""
import argparse
import collections
import copy
import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'data/historical-intelligence'
PASS = BASE / 'coverage-policy-v2'
PRIOR = '20261022-enrichment-v52'
VERSION = '20261022-enrichment-v53'
PRIOR_SHA = '7a9a072f3f8025714615ee328afe517946bb9221463f7ce5b77395e52c6b4c46'
STATES = ('present', 'partial', 'missing', 'unestablished', 'disputed', 'inaccessible', 'pre-applicability')
ADVANCED_ITEMS = (
    'complete_registered_sale_history',
    'complete_signed_rent_history',
    'validated_price_forecast',
    'validated_rent_forecast',
    'validated_net_return_forecast',
)

canonical = lambda value: json.dumps(value, ensure_ascii=False, separators=(',', ':'), sort_keys=True).encode()
digest = lambda value: hashlib.sha256(value).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def counts(snapshot, keys=None):
    counter = collections.Counter()
    total = 0
    for record in snapshot['records']:
        for key, item in record['researchStatus']['itemCoverage'].items():
            if keys is not None and key not in keys:
                continue
            counter[item['status']] += 1
            total += 1
    return {'total': total, **{state: counter[state] for state in STATES}}


def eligible_sale_observations(record):
    return [item for item in record.get('observations', [])
            if item.get('scope') == 'subject'
            and item.get('identityVerified') is True
            and item.get('metric') == 'price'
            and item.get('observationKind') == 'transaction'
            and item.get('transactionKind') == 'sale'
            and item.get('status') == 'source_observed'
            and isinstance(item.get('value'), (int, float))
            and not isinstance(item.get('value'), bool)
            and item['value'] > 0
            and item.get('sourceId')]


def apply(snapshot):
    require(snapshot['version'] == PRIOR, 'Exact V52 baseline required')
    require(digest(canonical(snapshot) + b'\n') == PRIOR_SHA, 'Canonical V52 checksum mismatch')
    out = copy.deepcopy(snapshot)
    receipts = [json.loads((BASE / f'adrec-market-data-pass{number}/reconciliation.json').read_bytes())
                for number in (51, 52)]
    target_ids = sorted({record_id for receipt in receipts for record_id in receipt['changedRecords']})
    require(len(target_ids) == 27, 'Expected 27 V51/V52 exact ADREC project records')
    records = {record['id']: record for record in out['records']}
    before = counts(out)
    changed = []
    credited_observations = 0
    for record_id in target_ids:
        record = records[record_id]
        observations = eligible_sale_observations(record)
        require(observations, f'No eligible registered-sale observation for {record_id}')
        require(record['researchStatus']['itemCoverage']['registered_sale_history']['status'] == 'missing',
                f'V52 sale status was not missing for {record_id}')
        source_ids = list(dict.fromkeys(item['sourceId'] for item in observations))
        periods = sorted({item['period'] for item in observations if item.get('period')})
        record['researchStatus']['itemCoverage']['registered_sale_history'] = {
            'status': 'present',
            'evidenceIds': [item['id'] for item in observations],
            'sourceIds': source_ids,
            'reason': ('Verified exact-subject authority transactions establish bounded registered-sale evidence '
                       'under the evidence-presence policy. The observed window does not certify lifetime completeness.'),
            'nativePointCount': 0,
            'nativeSeriesCount': 0,
            'transactionObservationCount': len(observations),
            'distinctTransactionDateCount': len(periods),
            'observationStart': periods[0],
            'observationEnd': periods[-1],
            'coverageBasis': 'bounded_exact_subject_authority_transactions',
            'completeLifetimeHistory': False,
            'sparseNativePointCount': 0,
            'sparseObservedPeriodCount': 0,
        }
        gaps = record['researchStatus'].get('gaps', [])
        record['researchStatus']['gaps'] = [gap for gap in gaps if gap != 'direct_registered_sale_history']
        require('complete_registered_sale_history' in record['researchStatus']['gaps'],
                f'Lifetime completeness gap was lost for {record_id}')
        credited_observations += len(observations)
        changed.append(record_id)
    require(credited_observations == 9941, 'Expected 9,941 V51/V52 observations to receive bounded coverage credit')

    all_keys = tuple(out['records'][0]['researchStatus']['itemCoverage'])
    require(all(tuple(record['researchStatus']['itemCoverage']) == all_keys for record in out['records']),
            'Coverage item schema differs across records')
    core_items = tuple(key for key in all_keys if key not in ADVANCED_ITEMS)
    require(len(all_keys) == 23 and len(core_items) == 18, 'Unexpected coverage item schema')
    policy = {
        'id': 'evidence-presence-v2',
        'effectiveAsOf': out['asOf'],
        'primaryCriteria': ('A core evidence item receives present status when exact-subject, source-backed evidence exists. '
                            'Bounded observed periods count without implying lifetime completeness.'),
        'primaryItems': list(core_items),
        'advancedAuditItems': list(ADVANCED_ITEMS),
        'advancedAuditTreatment': ('Lifetime completeness and validated forecasts remain visible in a separate advanced audit '
                                   'and do not reduce the primary evidence-presence score.'),
        'forecastBoundary': 'Conditional scenarios are not validated forecasts.',
    }
    out['manifest']['coveragePolicy'] = policy
    out['manifest']['directSubjectSaleHistoryRecords'] = sum(
        record['researchStatus']['itemCoverage']['registered_sale_history']['status'] == 'present'
        for record in out['records'])
    out['version'] = out['manifest']['version'] = VERSION
    after = counts(out)
    core = counts(out, set(core_items))
    advanced = counts(out, set(ADVANCED_ITEMS))
    require(after['present'] - before['present'] == 27 and after['missing'] - before['missing'] == -27,
            'Unexpected raw ledger delta')
    require(core == {'total': 33480, 'present': 3407, 'partial': 3402, 'missing': 26671,
                     'unestablished': 0, 'disputed': 0, 'inaccessible': 0, 'pre-applicability': 0},
            'Unexpected primary coverage totals')
    require(advanced == {'total': 9300, 'present': 0, 'partial': 0, 'missing': 0,
                         'unestablished': 9300, 'disputed': 0, 'inaccessible': 0, 'pre-applicability': 0},
            'Unexpected advanced audit totals')
    out['manifest']['coverageSummary'] = {'primary': core, 'advancedAudit': advanced, 'allItems': after}
    receipt = {
        'schemaVersion': 1,
        'version': VERSION,
        'priorVersion': PRIOR,
        'priorSHA256': PRIOR_SHA,
        'policy': policy,
        'changedRecords': changed,
        'changedRecordsByEmirate': {'Abu Dhabi': len(changed)},
        'registeredTransactionsCredited': credited_observations,
        'registeredSaleRecordsPromoted': len(changed),
        'coverageBeforeAllItems': before,
        'coverageAfterAllItems': after,
        'primaryCoverage': core,
        'advancedAuditCoverage': advanced,
        'numericForecastsAdded': 0,
        'sourcesAdded': 0,
        'observationsAdded': 0,
        'publicationState': 'unmerged_candidate_only_reuse_rights_pending_not_published',
        'remoteWrites': 0,
    }
    return out, receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise SystemExit('New output directory required')
    raw = gzip.decompress(args.snapshot.read_bytes()) if args.snapshot.suffix == '.gz' else args.snapshot.read_bytes()
    snapshot = json.loads(raw)
    out, receipt = apply(snapshot)
    args.output.mkdir(parents=True)
    (args.output / 'candidate-snapshot.json').write_bytes(canonical(out) + b'\n')
    (args.output / 'reconciliation.json').write_bytes(canonical(receipt) + b'\n')
    PASS.mkdir(parents=True, exist_ok=True)
    (PASS / 'reconciliation.json').write_bytes(canonical(receipt) + b'\n')
    print(json.dumps({'version': VERSION, 'changedRecords': len(receipt['changedRecords']),
                      'registeredTransactionsCredited': receipt['registeredTransactionsCredited'],
                      'primaryCoverage': receipt['primaryCoverage'],
                      'advancedAuditCoverage': receipt['advancedAuditCoverage']}))


if __name__ == '__main__':
    main()
