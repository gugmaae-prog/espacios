#!/usr/bin/env python3
"""Rank every pending project identity using pinned DLD evidence, without promotion.

Only exact normalized project/building names discover candidates. Matching names
are not identity proof. Private transaction rows/identifiers never enter output.
"""
import csv
import hashlib
import importlib.util
import json
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / '.local-data/dld-open-20261008'
OUT = ROOT / 'docs/verification/dld-queue-review-2026-10-09'
BASE_SHA = 'c112efc54c153338e1a1543a882a16c31894d8d4c16bc00ca66adab38fd58d98'
module = importlib.util.spec_from_file_location('identity_review', ROOT / 'scripts/review-dld-identity-pass38.py')
review = importlib.util.module_from_spec(module)
module.loader.exec_module(review)


def name_owners(records):
    owners = defaultdict(set)
    for record in records:
        if record['type'] == 'project':
            owners[review.norm(record['name'])].add(record['id'])
    return owners


def matched_records(row, owners):
    return owners.get(review.norm(row.get('project_name_en')), set()) | owners.get(review.norm(row.get('building_name_en')), set())


def financial_reason(row):
    try:
        spec = {'projectNumber': review.integer(row.get('project_number')),
                'areaId': review.integer(row.get('area_id')),
                'name': row.get('project_name_en'), 'buildingName': row.get('building_name_en')}
    except ValueError:
        return 'invalid_source_key'
    if not spec['name'] or not spec['buildingName']:
        return 'missing_project_or_building_name'
    return review.candidate_reason(row, spec, date(2026, 10, 7))


def reconcile_copy(item, row):
    """A revision outside the name match still invalidates an earlier candidate."""
    fingerprint = hashlib.sha256(json.dumps(row, sort_keys=True).encode()).hexdigest()
    item['allCopies'] += 1
    item['conflict'] |= fingerprint != item['fingerprint']


def main():
    baseline = ROOT / 'data/historical-intelligence-20261003.json'
    assert review.digest(baseline) == BASE_SHA, 'Requires exact reviewed V39 baseline'
    snapshot = json.loads(baseline.read_text())
    pending = [r for r in snapshot['records'] if r['type'] == 'project' and r['researchStatus'].get('identityCandidateCount', 0) > 0]
    assert len(pending) == snapshot['manifest']['identityCandidateProjects'] == 246
    owners = name_owners(snapshot['records'])
    pending_ids = {r['id'] for r in pending}
    manifest = json.loads((RAW / 'capture-manifest.json').read_text())
    for item in manifest['files']:
        path = RAW / item['name']
        assert path.stat().st_size == item['bytes'] and review.digest(path) == item['sha256'], item['name']
    def read_csv(name):
        with (RAW / name).open(encoding='utf-8-sig', newline='') as stream:
            yield from csv.DictReader(stream)
    projects = defaultdict(list)
    for p in read_csv('projects_2026-07-06_16-25-21_0001.csv.gz'):
        projects[review.integer(p['project_number'])].append(p)
    developers = defaultdict(list)
    for d in read_csv('developers_2026-10-01_23-34-28_0001.csv.gz'):
        developers[review.integer(d['developer_id'])].append(d)
    # Deduplicate by exact source ID across both files, including revisions that
    # change property use, registration, prices, dates or source geography.
    transactions = {}
    scanned = 0
    for item in manifest['files']:
        if not item['name'].startswith('transactions_'):
            continue
        for row in read_csv(item['name']):
            scanned += 1
            targets = matched_records(row, owners) & pending_ids
            if not targets:
                continue
            key = row.get('transaction_id', '').strip()
            fingerprint = hashlib.sha256(json.dumps(row, sort_keys=True).encode()).hexdigest()
            # Missing IDs must not coalesce into a single apparent transaction.
            key = key or 'missing-id-row:' + str(scanned)
            if key in transactions:
                old = transactions[key]
                old['copies'] += 1
                old['conflict'] |= old['fingerprint'] != fingerprint
                old['targets'].update(targets)
            else:
                transactions[key] = {'row': row, 'fingerprint': fingerprint, 'copies': 1, 'conflict': False, 'targets': set(targets)}
    for item in transactions.values():
        item['allCopies'] = 0
    # A second full scan checks IDs even when a revision changes both names
    # and therefore falls outside the initial discovery set.
    reconciled_rows = 0
    for source in manifest['files']:
        if source['name'].startswith('transactions_'):
            for row in read_csv(source['name']):
                reconciled_rows += 1
                key = row.get('transaction_id', '').strip()
                if key and key in transactions:
                    reconcile_copy(transactions[key], row)
    assert reconciled_rows == scanned
    for item in transactions.values():
        item['copies'] = max(item['copies'], item['allCopies'])
    groups = defaultdict(lambda: {'sourceRows': 0, 'uniqueCandidateKeys': 0, 'duplicateRows': 0, 'eligible': [], 'exclusions': Counter(), 'allCatalogueNameOwners': set()})
    for item in transactions.values():
        row = item['row']
        reason = 'conflicting_duplicate_transaction_id' if item['conflict'] else financial_reason(row)
        for rid in item['targets']:
            key = (rid, row.get('project_number'), row.get('area_id'), row.get('project_name_en'), row.get('building_name_en'))
            g = groups[key]
            g['sourceRows'] += item['copies']
            g['uniqueCandidateKeys'] += 1
            g['duplicateRows'] += item['copies'] - 1
            g['allCatalogueNameOwners'].update(matched_records(row, owners))
            if reason:
                g['exclusions'][reason] += 1
            else:
                g['eligible'].append(row['instance_date'][:10])
    by_record = defaultdict(list)
    for (rid, number, area, project_name, building_name), g in groups.items():
        try:
            registered = projects.get(review.integer(number), [])
        except ValueError:
            registered = []
        authorities = []
        for p in registered:
            ds = developers.get(review.integer(p['developer_id']), [])
            authorities.append({'projectId': p['project_id'], 'projectNumber': p['project_number'], 'areaId': p['area_id'], 'areaName': p['area_name_en'], 'masterProject': p['master_project_en'], 'developerId': p['developer_id'], 'developerNumber': p['developer_number'], 'registerDeveloperLabel': p['developer_name'], 'developerRegisterNames': [d['developer_name_en'] for d in ds], 'developerKeyConsistency': len(ds) == 1 and review.integer(ds[0]['developer_number']) == review.integer(p['developer_number']), 'projectRegisterLoadedAt': p['load_timestamp'], 'areaKeyMatches': p['area_id'] == area})
        dates = sorted(g.pop('eligible'))
        by_record[rid].append({'projectNumber': number, 'areaId': area, 'projectName': project_name, 'buildingName': building_name,
                              **{k: v for k, v in g.items() if k not in ('exclusions', 'allCatalogueNameOwners')},
                              'financiallyEligibleCandidates': len(dates), 'firstRegistration': dates[0] if dates else None, 'lastRegistration': dates[-1] if dates else None,
                              'nativeMonthlyCandidateCounts': dict(sorted(Counter(d[:7] for d in dates).items())), 'exclusions': dict(g['exclusions']),
                              'allCatalogueNameOwners': sorted(g['allCatalogueNameOwners']), 'registerCandidates': authorities})
    results = []
    for record in pending:
        candidates = sorted(by_record[record['id']], key=lambda g: (-g['financiallyEligibleCandidates'], str(g['projectNumber']), g['buildingName'] or ''))
        results.append({'recordId': record['id'], 'name': record['name'], 'emirate': record['emirate'], 'communityId': record.get('communityId'),
                        'existingSaleCoverage': record['researchStatus']['itemCoverage']['registered_sale_history']['status'],
                        'candidateGroups': candidates, 'financiallyEligibleCandidates': sum(g['financiallyEligibleCandidates'] for g in candidates),
                        'reviewStatus': 'primary_identity_and_component_review_required' if candidates else 'no_exact_name_in_this_capture; aliases_and_other_sources_require_research',
                        'acceptedObservations': 0, 'coverageCredit': 0})
    results.sort(key=lambda r: (r['existingSaleCoverage'] != 'missing', -r['financiallyEligibleCandidates'], r['recordId']))
    out = {'baselineVersion': snapshot['version'], 'baselineSHA256': BASE_SHA, 'asOf': '2026-10-09', 'sourceRetrievedAt': manifest['retrievedAt'], 'sourceFiles': manifest['files'],
           'recordsReviewed': len(results), 'sourceRowsScanned': scanned, 'duplicateReconciliationRowsScanned': reconciled_rows, 'projectsWithExactNameCandidates': sum(bool(r['candidateGroups']) for r in results),
           'projectsWithFinanciallyEligibleCandidates': sum(r['financiallyEligibleCandidates'] > 0 for r in results), 'acceptedObservations': 0, 'coverageCredit': 0,
           'missingSaleProjectsWithCandidates': sum(r['existingSaleCoverage'] == 'missing' and r['financiallyEligibleCandidates'] > 0 for r in results),
           'existingSaleCoverageDistribution': dict(Counter(r['existingSaleCoverage'] for r in results)),
           'financialCandidateScope': 'Residential Unit Flat sales only. Villas, land, gifts, mortgages and rows lacking building names remain separately excluded; no inference that their history is absent.',
           'methodology': 'Exact normalized name discovery across all pending projects, checked against all catalogue project names. Project/area/developer stable keys and financially eligible residential-flat sales remain candidates until primary identity, component scope and existing transaction ownership are reviewed. Counts across records can overlap and must not be summed as unique sales. No name-only identity promotion.',
           'records': results}
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'review.json').write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: v for k, v in out.items() if k not in ('sourceFiles', 'records', 'methodology')}, indent=2))
    for r in results[:20]:
        print(r['name'], r['financiallyEligibleCandidates'], len(r['candidateGroups']))


if __name__ == '__main__':
    main()
