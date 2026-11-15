#!/usr/bin/env python3
"""Promote exact Asora residential-building sales after dated register review."""
import csv
import hashlib
import importlib.util
import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'data/historical-intelligence'
RAW = ROOT / '.local-data/dld-open-20261008'
CAPTURE = ROOT / '.local-data/dld-identity-pass38'
RID = 'project:jumeirah-asora-bay-by-meraas-in-la-mer-dubai'
ARCHIVE = 'project:jumeirah-asora-bay-la-mer-dubai'
SOURCE = 'dld38-asora-normalized-sales-20261008'
SPEC_PATH = ROOT / 'scripts/review-dld-identity-pass38.py'
spec = importlib.util.spec_from_file_location('review', SPEC_PATH)
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)


def key(transaction_id):
    return 'dld-sha256:' + hashlib.sha256(('DLD:' + transaction_id.strip()).encode()).hexdigest()


def main():
    snapshot = json.loads((ROOT / 'data/historical-intelligence-20261003.json').read_text())
    assert snapshot['version'] == '20261008-enrichment-v37'
    records = {r['id']: r for r in snapshot['records']}
    target = records[RID]
    assert target['name'] == 'Jumeirah Asora Bay' and target['communityId'] == 'community:Dubai:la-mer'
    assert not any(s.get('scope') == 'subject' for s in target['historySeries'])
    assert target['researchStatus']['identityCandidateCount'] == 1
    raw_manifest = json.loads((RAW / 'capture-manifest.json').read_text())
    assert raw_manifest['retrievedAt'] == '2026-10-08T14:13:10Z'
    for item in raw_manifest['files']:
        p = RAW / item['name']
        assert review.digest(p) == item['sha256'] and p.stat().st_size == item['bytes']
    project_rows = list(csv.DictReader((RAW / 'projects_2026-07-06_16-25-21_0001.csv.gz').open(encoding='utf-8-sig')))
    ps = [r for r in project_rows if review.integer(r['project_number']) == 3445]
    assert len(ps) == 1
    p = ps[0]
    assert (review.integer(p['project_id']), review.integer(p['developer_id']), review.integer(p['area_id'])) == (691710228, 452208509, 317)
    assert p['developer_name'] == 'مراس العقارية (ش.ذ.م.م)'
    assert 'Jumeirah Residences Asora Bay Residential Building' in p['project_description_en'] and '29 no. units' in p['project_description_en']
    developers = list(csv.DictReader((RAW / 'developers_2026-10-01_23-34-28_0001.csv.gz').open(encoding='utf-8-sig')))
    ds = [d for d in developers if review.integer(d['developer_id']) == 452208509]
    assert len(ds) == 1 and ds[0]['developer_name_en'] == 'DHRE 2 BTS L.L.C'
    assert review.integer(p['developer_number']) == review.integer(ds[0]['developer_number']) == 1510
    page = json.loads((CAPTURE / 'asora-official-capture.json').read_text())
    assert page['httpStatus'] == 200 and page['sha256'] == review.PINS['asora-official'] == review.digest(CAPTURE / 'asora-official.html')
    assert page['url'] == 'https://meraas.com/en/project/jumeirah-asora-bay'
    html = (CAPTURE / 'asora-official.html').read_text()
    assert all(term in html for term in ['Jumeirah Asora Bay', 'La Mer', 'Penthouse'])

    by_id = {}; scanned = 0
    for file in raw_manifest['files']:
        if not file['name'].startswith('transactions_'):
            continue
        with (RAW / file['name']).open(encoding='utf-8-sig', newline='') as stream:
            for row in csv.DictReader(stream):
                scanned += 1
                try:
                    number = review.integer(row['project_number'])
                except ValueError:
                    continue
                if number != 3445:
                    continue
                assert review.candidate_reason(row, review.SPECS[0], date(2026, 10, 6)) is None
                tid = row['transaction_id'].strip()
                assert tid not in by_id or by_id[tid] == row, 'Conflicting transaction ID'
                by_id[tid] = row
    assert scanned == 1798873 and len(by_id) == 30
    # Keep the existing archived catalogue row. It has a centroid fallback and
    # a different unverified developer label; do not fan out the current record's
    # transactions or declare the archive a proven equivalent identity.
    catalogue = json.loads((ROOT / '.local-data/rak-identity-pass35/live-catalogue-before.json').read_text())
    core = {r['id']: r for r in catalogue['projects']}
    assert core[RID]['archived'] is False and core[RID]['developer'] == 'Meraas'
    assert core[ARCHIVE]['archived'] is True and core[ARCHIVE]['developer'] == 'jumeirah'
    assert len([r for r in catalogue['projects'] if not r['archived'] and review.norm(r['name']) == review.norm(target['name']) and r['developer'] == 'Meraas']) == 1
    keys = set(by_id) | {key(t) for t in by_id}
    for record in snapshot['records']:
        for observation in record['observations']:
            assert not keys.intersection([observation.get('transactionId'), observation.get('sourceObservationId')]), 'Already-owned individual transaction'
        for series in record['historySeries']:
            if series.get('scope') == 'subject' and series.get('identityVerified'):
                # Existing project series retain native registered IDs in their
                # descriptors or points. Any Asora subject owner needs review.
                assert not ('asora' in json.dumps(series, ensure_ascii=False).casefold()), 'Existing Asora subject series'

    prior_sources = {s['id']: s for s in snapshot['sources']}
    parent = prior_sources['dld-official-transactions-recapture-20261008']
    proof = ['dld-official-projects-20260706', 'dld-official-developers-20261001', 'dld-official-areas-20261002', 'dld38-meraas-asora-page']
    primary = {**page, 'id': proof[-1], 'title': 'Meraas Jumeirah Asora Bay project page',
               'publisher': 'Meraas', 'classification': 'primary_developer_project_identity',
               'primaryEvidence': True, 'publishedAt': None, 'firstAvailableAt': page['retrievedAt'],
               'publicationDateStatus': 'Unknown; current captured vintage is not historical publication evidence',
               'licence': 'Minimal attributed identity facts; raw webpage and media not redistributed', 'rawBodyRedistributed': False}
    same = [s for s in snapshot['sources'] if s.get('url') == primary['url']]
    if same:
        primary.update(preserveRevision=True, revisionOfSourceId=same[-1]['id'])
    days = sorted(r['instance_date'][:10] for r in by_id.values())
    source = {**parent, 'id': SOURCE, 'revisionOfSourceId': parent['id'], 'preserveRevision': True,
              'title': 'DLD normalized individual Asora residential-building sale evidence, October 2026 capture',
              'classification': 'official_primary_registered_sale_normalized_extract',
              'primaryEvidence': True, 'rawTransactionRowsRedistributed': False, 'rawTransactionIdsRedistributed': False,
              'derivedIndividualObservationsPublished': True,
              'observationCoverage': {'start': days[0], 'end': days[-1], 'basis': '30 exact residential-building sale registrations; incomplete lifetime history'},
              'note': 'Selected normalized residential flat prices and dates with derived AED/sqft. Raw export rows, party details and native transaction IDs are not redistributed. Stable public keys are SHA256 of DLD: plus the native transaction ID. No aggregate median or current valuation is inferred.'}
    basis = ('Exact current catalogue Jumeirah Asora Bay / Meraas / La Mer record. The official project register uniquely maps project_number 3445 to project_id 691710228, area_id 317 and developer_id 452208509 / developer_number 1510. Its June-loaded Arabic developer label is Meraas Real Estate; the October developer register names DHRE 2 BTS L.L.C. against the same two stable developer keys. Both dated labels remain; no legal rename date or corporate ownership is inferred. The Meraas primary page corroborates the named La Mer development. Only Residential/Unit/Flat transactions naming Jumeirah Residences Asora Bay are included, matching the register residential-building description. Hotel rooms, Ocean Mansions, land and the separate archived catalogue candidate receive no transaction links.')
    facts = []
    for tid, row in sorted(by_id.items(), key=lambda pair: (pair[1]['instance_date'], pair[0])):
        price, area = float(row['actual_worth']), float(row['procedure_area'])
        transaction_key = key(tid)
        facts.append({'id': 'dld38-asora-' + transaction_key.split(':')[1], 'recordId': RID,
                      'status': 'accepted', 'kind': 'financial', 'scope': 'subject',
                      'sourceIds': [SOURCE], 'identitySourceIds': proof, 'identityBasis': basis,
                      'identityVerified': True, 'primaryEvidence': True, 'publishedAt': None,
                      'firstAvailableAt': page['retrievedAt'], 'evidenceClass': 'registered_sale_transaction_primary_dld',
                      'observation': {'metric': 'price', 'value': price / area / 10.763910416709722,
                                      'unit': 'AED/sqft', 'priceAED': price, 'areaSqm': area,
                                      'period': row['instance_date'][:10], 'frequency': 'daily',
                                      'observationKind': 'transaction', 'transactionKind': 'sale',
                                      'transactionId': transaction_key, 'sourceObservationId': transaction_key,
                                      'transactionKeyAlgorithm': 'sha256(UTF8("DLD:" + native_transaction_id))',
                                      'sampleCount': 1, 'usage': 'Residential', 'propertyType': 'Unit', 'propertySubtype': 'Flat',
                                      'registration': row['reg_type_en'], 'procedureId': review.integer(row['procedure_id']),
                                      'procedureName': row['procedure_name_en'], 'bedroomsLabel': row['rooms_en'],
                                      'sourceProjectNumber': 3445, 'registeredProjectId': 691710228,
                                      'registeredDeveloperId': 452208509, 'sourceAreaId': 317,
                                      'sourceBuildingName': 'Jumeirah Residences Asora Bay',
                                      'observationDateBasis': 'DLD instance_date registration day; not contract execution, first-ever sale or current valuation',
                                      'currentSnapshotEligible': False, 'includeInCurrentSnapshot': False}})
    packet = {'schemaVersion': 1, 'passId': 'dld-asora-pass38-20261008', 'asOf': snapshot['asOf'],
              'priorVersion': snapshot['version'], 'candidateVersion': '20261008-enrichment-v38',
              'sources': [primary, source], 'facts': facts, 'seriesLinks': [],
              'recordIdentityChecks': [{'recordId': RID, 'catalogueName': target['name'], 'type': 'project', 'emirate': 'Dubai',
                                        'basis': basis, 'sourceIds': proof, 'registeredDeveloperLabels': [
                                            {'label': p['developer_name'], 'loadedAt': p['load_timestamp'], 'developerId': 452208509, 'developerNumber': 1510},
                                            {'label': ds[0]['developer_name_en'], 'loadedAt': ds[0]['load_timestamp'], 'developerId': 452208509, 'developerNumber': 1510}]}],
              'recordResearch': [{'recordId': RID, 'asOf': snapshot['asOf'], 'sourceIds': [SOURCE] + proof,
                                  'status': '30 verified residential-building sale registrations; complete lifetime history remains unestablished',
                                  'acceptedTransactionObservationCount': 30,
                                  'identityReview': {'status': 'verified_exact_name_developer_and_area', 'identityBasis': basis,
                                                     'identitySourceIds': proof, 'resolvedCandidateCount': 1, 'remainingCandidateCount': 0}}],
              'collection': {'sourceRowsScanned': scanned, 'acceptedTransactionRows': 30, 'newSources': 2,
                             'firstRegistrationDate': days[0], 'lastRegistrationDate': days[-1], 'sourceCaptureManifest': raw_manifest,
                             'newAggregateMedians': 0, 'currentValuationsAdded': 0, 'approved2080Forecasts': 0,
                             'rawRowsAndNativeTransactionIdsRedistributed': False, 'completeLifetimeHistory': False},
              'excludedCandidates': [{'recordId': ARCHIVE, 'reason': 'Archived catalogue candidate remains preserved and unmapped; different unverified developer label and centroid location do not independently establish the same record identity.'},
                                     {'recordId': 'project:avida-residences-iquna-properties-dubai-islands', 'reason': '40 financial candidates remain identity-review pending; no primary marketing/legal developer bridge verified.'}],
              'conflicts': [{'field': 'developer_name', 'resolution': 'Retain dated Arabic Meraas and English DHRE 2 BTS labels attached to the identical official developer ID and number; no invented rename date.'}],
              'methodology': 'Exact source project/building/area keys, stable official developer keys across dated registers, primary developer corroboration, per-transaction identity ownership and price/area reconciliation. Sparse individual observations remain, without publishing an aggregate median. Current snapshots, rentals, prior evidence and 2080 scenarios remain unchanged.'}
    out = BASE / 'dld-asora-pass38-20261008.json'
    out.write_text(json.dumps(packet, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'path': str(out), 'facts': len(facts), 'sources': len(packet['sources']), 'first': days[0], 'last': days[-1]}))


if __name__ == '__main__':
    main()
