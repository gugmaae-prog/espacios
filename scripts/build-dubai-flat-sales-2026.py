#!/usr/bin/env python3
"""Build a bounded, reproducible DLD-derived 2026 flat-sales aggregate."""
import gzip
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'work/dubai-commercial-capture/dld_sales_transactions.parquet'
OUT = ROOT / 'data/uae-evidence/dubai'
PACKED = OUT / 'flat-sales-2026-partial-20261111.json.gz'
REPORT = OUT / 'flat-sales-2026-partial-validation.json'
BASELINE = OUT / 'commercial-unit-sales-validation.json'
SOURCE_ID = 'dred-dld-registered-flat-sales-2026-partial-20261111'
AREA_COLUMNS = ['month', 'areaId', 'areaName', 'registration', 'saleCount', 'cleanPriceCount', 'medianCleanPriceAedPerSqft', 'cleanSaleValueAed']
MONTH_COLUMNS = ['month', 'registration', 'saleCount', 'cleanPriceCount', 'medianCleanPriceAedPerSqft', 'cleanSaleValueAed']
WHERE = "instance_date >= '2026-01-01' and instance_date < '2026-11-01' and usage_label = 'Residential' and property_type_label = 'Unit' and property_sub_type = 'Flat'"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def verify(packed, report):
    assert len(packed) == report['compressedBytes'] and sha(packed) == report['compressedSha256']
    raw = gzip.decompress(packed)
    assert len(raw) == report['rawBytes'] and sha(raw) == report['rawSha256']
    data = json.loads(raw)
    areas, months = data['areaMonthRows'], data['monthlyTotals']
    assert data['sourceId'] == report['sourceId'] == SOURCE_ID
    assert data['areaColumns'] == AREA_COLUMNS and data['monthColumns'] == MONTH_COLUMNS
    assert len(areas) == report['areaMonthRows'] == 1117 and len(months) == report['monthlyRows'] == 20
    assert sum(r[4] for r in areas) == sum(r[2] for r in months) == report['sourceRows'] == 105473
    assert sum(r[5] for r in areas) == sum(r[3] for r in months) == report['cleanRows'] == 103804
    assert len({(r[0], r[1], r[3]) for r in areas}) == len(areas)
    assert all(r[6] is None and r[7] is None for r in areas if r[5] < 10)
    assert all(r[6] is not None and r[7] is not None for r in areas if r[5] >= 10)
    assert report['suppressedAreaMonetaryGroups'] == sum(r[5] < 10 for r in areas)
    assert all(r[0] >= '2026-01' and r[0] <= '2026-10' and r[3] in ('Ready', 'Off-Plan') for r in areas)
    assert report['unknownAreaSaleRows'] == sum(r[4] for r in areas if r[1] is None) == 35
    assert report['distinctAreaIds'] == len({r[1] for r in areas if r[1] is not None}) == 70
    return data


if '--check' in sys.argv:
    report = json.loads(REPORT.read_text())
    verify(PACKED.read_bytes(), report)
    print(json.dumps({'passed': True, 'sourceRows': report['sourceRows'], 'areaMonthRows': report['areaMonthRows']}))
    raise SystemExit

baseline = json.loads(BASELINE.read_text())
source = SOURCE.read_bytes()
assert len(source) == baseline['sourceParquetBytes'] and sha(source) == baseline['sourceParquetSha256'], 'DLD-derived source snapshot changed'
import duckdb  # Only capture/build needs DuckDB. --check uses the standard library.

db = duckdb.connect()
population = db.execute(f"select count(*), count(distinct transaction_id), count(*) filter (where quality_flags = 0), min(instance_date), max(instance_date) from read_parquet(?) where {WHERE}", [str(SOURCE)]).fetchone()
assert population[:3] == (105473, 105473, 103804)
assert population[3].isoformat() == '2026-01-01' and population[4].isoformat() == '2026-10-31'

measure = "count(*) as sales, count(*) filter (where quality_flags = 0) as clean, median(price_psf) filter (where quality_flags = 0) as median_psf, sum(price_aed) filter (where quality_flags = 0) as clean_value"
area_query = f"select strftime(instance_date, '%Y-%m') as month, area_id, area_name_en, reg_type_label, {measure} from read_parquet(?) where {WHERE} group by 1,2,3,4 order by 1,2 nulls last,4"
month_query = f"select strftime(instance_date, '%Y-%m') as month, reg_type_label, {measure} from read_parquet(?) where {WHERE} group by 1,2 order by 1,2"


def area_row(row):
    month, area_id, name, registration, sales, clean, median, value = row
    return [month, area_id, name, registration, sales, clean, round(median) if clean >= 10 else None, value if clean >= 10 else None]


def month_row(row):
    month, registration, sales, clean, median, value = row
    return [month, registration, sales, clean, round(median) if clean >= 10 else None, value]


areas = [area_row(row) for row in db.execute(area_query, [str(SOURCE)]).fetchall()]
months = [month_row(row) for row in db.execute(month_query, [str(SOURCE)]).fetchall()]
data = {'sourceId': SOURCE_ID, 'areaColumns': AREA_COLUMNS, 'monthColumns': MONTH_COLUMNS, 'areaMonthRows': areas, 'monthlyTotals': months}
raw = (json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
packed = gzip.compress(raw, compresslevel=9, mtime=0)
report = {
    'sourceId': SOURCE_ID,
    'publisher': baseline['publisher'],
    'sourceUrl': baseline['sourceUrl'],
    'originalSourceUrl': baseline['originalSourceUrl'],
    'license': baseline['license'],
    'licenseUrl': baseline['licenseUrl'],
    'sourceSnapshotDate': baseline['sourceSnapshotDate'],
    'sourceParquetBytes': len(source),
    'sourceParquetSha256': sha(source),
    'captureRule': 'DLD-derived Sale records from 2026-01-01 through 2026-10-31 with usage Residential, property type Unit, subtype Flat. Ready and Off-Plan remain separate. The source is a 2 November 2026 snapshot, not the complete year or all property types.',
    'qualityRule': 'Sale counts include all rows. Monetary sums and price-per-sqft medians use quality_flags=0. Area-month monetary values and medians require at least 10 clean records; null means withheld for sparse groups, not zero. Monthly totals are computed independently from source records. No weighted or averaged median is derived from group medians.',
    'sourceRows': population[0],
    'cleanRows': population[2],
    'areaMonthRows': len(areas),
    'monthlyRows': len(months),
    'suppressedAreaMonetaryGroups': sum(r[5] < 10 for r in areas),
    'distinctAreaIds': len({r[1] for r in areas if r[1] is not None}),
    'unknownAreaSaleRows': sum(r[4] for r in areas if r[1] is None),
    'dateRange': ['2026-01-01', '2026-10-31'],
    'compressedBytes': len(packed), 'compressedSha256': sha(packed),
    'rawBytes': len(raw), 'rawSha256': sha(raw),
    'limits': 'Registered flat sale aggregates only, not individual transaction records in this endpoint, a full UAE census, live availability, asking inventory, rent, or a valuation. Source categories after 9 February mislabel Office/Shop subtypes as Residential; this subset explicitly requires Flat and excludes them. DLD area IDs are cadastral labels, not verified building or unit coordinates. Snapshot may receive later revisions.',
}
verify(packed, report)
PACKED.write_bytes(packed)
REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'sourceRows': population[0], 'cleanRows': population[2], 'areaMonthRows': len(areas), 'monthlyRows': len(months), 'compressedBytes': len(packed)}))
