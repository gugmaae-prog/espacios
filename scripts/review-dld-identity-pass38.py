#!/usr/bin/env python3
"""Reproduce two pending identity reviews without changing published coverage.

Requires the retained lawful DLD captures and primary-page captures in private
.local-data. Output contains review metadata/counts, never raw transaction rows.
"""
import csv
import hashlib
import json
import math
import re
import unicodedata
from collections import Counter
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / '.local-data/dld-open-20261008'
CAPTURES = ROOT / '.local-data/dld-identity-pass38'
OUTPUT = ROOT / 'docs/verification/dld-identity-review-2026-10-09/review.json'
SPECS = [
    {'recordId': 'project:jumeirah-asora-bay-by-meraas-in-la-mer-dubai',
     'name': 'Jumeirah Asora Bay', 'projectNumber': 3445, 'projectId': 691710228,
     'areaId': 317, 'developerId': 452208509,
     'buildingName': 'Jumeirah Residences Asora Bay', 'captureIds': ['asora-official']},
    {'recordId': 'project:avida-residences-iquna-properties-dubai-islands',
     'name': 'Avida Residences', 'projectNumber': 4066, 'projectId': 808700174,
     'areaId': 432, 'developerId': 685297965,
     'buildingName': 'Avida Residences', 'captureIds': ['iquna-avida', 'avida-official', 'avida-brochure']},
]
PINS = {
    'asora-official': '497492e71dc2ec1a37204f7d32abd6cb28fab346e654d12df23f4359fc2993e6',
    'iquna-avida': 'cbfd4c1cdd40ffddfebb4f372e06cc486b26fc8bcaca3e7b3ca5e647ac61db0a',
    'avida-official': '8d911c0612fac39936293792774a16799cd523490129f874b5b31b5bfcc8a03f',
    'avida-brochure': '101e9033278ccd57c0b1d30efb908e65dacaaba0eefef6bf5d036bba313cc526',
    'open-data-licence': 'f380f9fe755c9f298bba40f94bf2638abd06de851dc813a0c35ad8a9adacbadc',
}


def norm(value):
    return ' '.join(re.findall(r'\w+', unicodedata.normalize('NFKC', str(value or '')).casefold()))


def integer(value):
    """Preserve integer IDs; do not round fractional keys through float()."""
    try:
        n = Decimal(str(value).strip())
        if not n.is_finite() or n != n.to_integral_value() or n <= 0:
            raise ValueError('Not a positive integral source ID')
        return int(n)
    except InvalidOperation as exc:
        raise ValueError('Invalid source ID') from exc


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def candidate_reason(row, spec, cutoff):
    """Financial eligibility is separate from unresolved catalogue identity."""
    try:
        if integer(row.get('project_number')) != spec['projectNumber'] or integer(row.get('area_id')) != spec['areaId']:
            return 'register_key_conflict'
    except ValueError:
        return 'invalid_source_key'
    if row.get('trans_group_en') != 'Sales':
        return 'not_sale'
    if row.get('property_usage_en') != 'Residential' or row.get('property_type_en') != 'Unit' or row.get('property_sub_type_en') != 'Flat':
        return 'not_residential_flat'
    if norm(row.get('project_name_en')) != norm(spec['name']) or norm(row.get('building_name_en')) != norm(spec['buildingName']):
        return 'project_or_building_name_conflict'
    if row.get('reg_type_en') not in {'Off-Plan Properties', 'Existing Properties'}:
        return 'unsupported_registration'
    if not row.get('transaction_id', '').strip():
        return 'missing_transaction_id'
    try:
        day = date.fromisoformat(row.get('instance_date', '')[:10])
        if day.year < 1900 or day > cutoff:
            return 'date_outside_capture_cutoff'
        worth, area, metre_price = (float(row.get(key, '')) for key in ['actual_worth', 'procedure_area', 'meter_sale_price'])
        if not all(math.isfinite(v) and v > 0 for v in [worth, area, metre_price]):
            return 'invalid_amount_or_area'
        if abs(worth / area - metre_price) > max(0.03, metre_price * 0.001):
            return 'price_formula_conflict'
    except (ValueError, TypeError):
        return 'invalid_date_or_number'
    return None


def review_rows(rows, spec, cutoff):
    grouped = {}
    for row in rows:
        # Compare all source fields. A changed duplicate is quarantined, even
        # when one copy appears financially eligible and the other does not.
        key = row.get('transaction_id', '').strip()
        grouped.setdefault(key, []).append(row)
    rejected = Counter()
    eligible = []
    duplicate_rows = 0
    for key, copies in grouped.items():
        if not key:
            rejected['missing_transaction_id'] += len(copies)
            continue
        duplicate_rows += len(copies) - 1
        if any(copy != copies[0] for copy in copies[1:]):
            rejected['conflicting_duplicate_transaction_id'] += 1
            continue
        reason = candidate_reason(copies[0], spec, cutoff)
        if reason:
            rejected[reason] += 1
        else:
            eligible.append(copies[0])
    days = sorted(r['instance_date'][:10] for r in eligible)
    return {
        'sourceRows': len(rows), 'duplicateRows': duplicate_rows,
        'financiallyEligibleUniqueCandidates': len(eligible),
        'firstCandidateRegistrationDate': days[0] if days else None,
        'lastCandidateRegistrationDate': days[-1] if days else None,
        'excludedOrQuarantined': dict(sorted(rejected.items())),
        'monthlyCandidateCounts': dict(sorted(Counter(d[:7] for d in days).items())),
        'acceptedFacts': 0, 'coverageCredit': 0, 'identityStatus': 'review_pending',
        'registrationDateBasis': 'DLD instance_date; not contract execution or first-ever sale',
    }


def main():
    snapshot = json.loads((ROOT / 'data/historical-intelligence-20261003.json').read_text())
    assert snapshot['version'] == '20261008-enrichment-v37', 'Review requires the pinned V37 baseline'
    records = {r['id']: r for r in snapshot['records']}
    manifest = json.loads((RAW / 'capture-manifest.json').read_text())
    assert manifest['retrievedAt'] == '2026-10-08T14:13:10Z'
    for item in manifest['files']:
        path = RAW / item['name']
        assert path.stat().st_size == item['bytes'] and digest(path) == item['sha256'], item['name']
    projects = list(csv.DictReader((RAW / 'projects_2026-07-06_16-25-21_0001.csv.gz').open(encoding='utf-8-sig')))
    developers = list(csv.DictReader((RAW / 'developers_2026-10-01_23-34-28_0001.csv.gz').open(encoding='utf-8-sig')))
    by_number = {s['projectNumber']: [] for s in SPECS}
    scanned = 0
    for meta in manifest['files']:
        if not meta['name'].startswith('transactions_'):
            continue
        with (RAW / meta['name']).open(encoding='utf-8-sig', newline='') as stream:
            for row in csv.DictReader(stream):
                scanned += 1
                try:
                    number = integer(row['project_number'])
                except ValueError:
                    continue
                if number in by_number:
                    by_number[number].append(row)
    captures = []
    for key, pin in PINS.items():
        meta = json.loads((CAPTURES / (key + '-capture.json')).read_text())
        extension = '.pdf' if 'pdf' in meta['contentType'] else '.html'
        path = CAPTURES / (key + extension)
        assert meta['httpStatus'] == 200 and meta['sha256'] == pin == digest(path)
        assert path.stat().st_size == meta['bytes']
        captures.append({**meta, 'publicationDate': None, 'firstKnownAvailability': meta['retrievedAt'], 'coverageCredit': 0, 'rawBodyRedistributed': False})
    reviews = []
    for spec in SPECS:
        record = records[spec['recordId']]
        assert record['name'] == spec['name'] and record['emirate'] == 'Dubai'
        ps = [r for r in projects if integer(r['project_number']) == spec['projectNumber']]
        ds = [r for r in developers if integer(r['developer_id']) == spec['developerId']]
        assert len(ps) == len(ds) == 1, 'Register key is not unique'
        project = ps[0]
        for field, key in [('project_id', 'projectId'), ('area_id', 'areaId'), ('developer_id', 'developerId')]:
            assert integer(project[field]) == spec[key], 'Register key mismatch'
        reviews.append({**spec, **review_rows(by_number[spec['projectNumber']], spec, date(2026, 10, 6)),
                        'registeredDeveloperName': ds[0]['developer_name_en'],
                        'registerLoadedAt': project['load_timestamp'],
                        'existingSaleCoverageStatus': record['researchStatus']['itemCoverage']['registered_sale_history']['status'],
                        'unresolved': ['Marketing-brand/legal-entity relationship requires explicit review; not inferred from a name token.',
                                       'Confirm exact catalogue/component scope before promoting any transaction.',
                                       'Check cross-record ownership and earlier source vintages before publication.']})
    result = {'schemaVersion': 1, 'reviewId': 'dld-identity-pass38-review-20261009',
              'baselineVersion': snapshot['version'], 'sourceRowsScanned': scanned,
              'acceptedFacts': 0, 'coverageCredit': 0, 'publishedDataChanged': False,
              'sourceCaptures': captures, 'dldCaptureManifest': manifest,
              'records': reviews,
              'limitations': ['Candidate counts do not establish verified subject history or complete lifetime coverage.',
                              'Land sales and gifts remain separate; they do not become apartment prices.',
                              'The July project export carries June row load dates; it does not prove current project status.',
                              'No price medians, current valuations, scenario anchors or 2080 forecasts are generated.']}
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'output': str(OUTPUT), 'scanned': scanned, 'records': reviews, 'coverageCredit': 0}))


if __name__ == '__main__':
    main()
