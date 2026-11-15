#!/usr/bin/env python3
"""Build the 2026 Office/Shop subtype slice, independent of the broken usage label."""
import gzip
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'work/dubai-commercial-capture/dld_sales_transactions.parquet'
OUT = ROOT / 'data/uae-evidence/dubai'
PACKED = OUT / 'commercial-unit-sales-2026-subtype-20261111.json.gz'
REPORT = OUT / 'commercial-unit-sales-2026-subtype-validation.json'
BASELINE = OUT / 'commercial-unit-sales-validation.json'
SOURCE_ID = 'dred-dld-office-shop-subtype-sales-2026-partial-20261111'
COLUMNS = ['transactionId','date','areaId','areaName','projectName','buildingName','spaceType','registration','areaSqm','priceAed','qualityFlags','usageLabel']

def sha(data): return hashlib.sha256(data).hexdigest()

def verify(packed, report):
    assert len(packed) == report['compressedBytes'] and sha(packed) == report['compressedSha256']
    raw = gzip.decompress(packed)
    assert len(raw) == report['rawBytes'] and sha(raw) == report['rawSha256']
    data = json.loads(raw)
    rows = data['rows']
    assert data['sourceId'] == report['sourceId'] == SOURCE_ID and data['columns'] == COLUMNS
    assert len(rows) == report['rows'] == 5452 and len({r[0] for r in rows}) == len(rows)
    assert sum(r[10] == 0 for r in rows) == report['cleanRows']
    assert len({r[2] for r in rows}) == report['distinctAreaIds'] == 48
    assert all('2026-01-01' <= r[1] <= '2026-10-31' and r[6] in ('Office','Shop') and r[7] in ('Ready','Off-Plan') for r in rows)
    assert rows[0][1] == '2026-10-31' and rows[-1][1] == '2026-01-01'
    assert report['commercialUsageRows'] == sum(r[11] == 'Commercial' for r in rows)
    assert report['residentialUsageRows'] == sum(r[11] == 'Residential' for r in rows)
    assert report['commercialUsageRows'] + report['residentialUsageRows'] == len(rows)
    assert report['commercialUsageRows'] == 1133 and report['residentialUsageRows'] == 4319
    return rows

if '--check' in sys.argv:
    report = json.loads(REPORT.read_text())
    verify(PACKED.read_bytes(), report)
    print(json.dumps({'passed':True,'rows':report['rows'],'cleanRows':report['cleanRows']}))
    raise SystemExit

baseline = json.loads(BASELINE.read_text())
source = SOURCE.read_bytes()
assert len(source) == baseline['sourceParquetBytes'] and sha(source) == baseline['sourceParquetSha256'], 'Pinned DLD-derived source changed'
import duckdb  # Build-only dependency; --check uses the standard library.

query = """select transaction_id, instance_date, area_id, area_name_en,
project_name, building_name, property_sub_type, reg_type_label,
area_sqm, price_aed, quality_flags, usage_label
from read_parquet(?)
where instance_date >= '2026-01-01' and instance_date < '2026-11-01'
and property_type_label = 'Unit' and property_sub_type in ('Office','Shop')
order by instance_date desc, transaction_id"""
fetched = duckdb.connect().execute(query, [str(SOURCE)]).fetchall()
rows = [[value.isoformat() if hasattr(value,'isoformat') else value for value in row] for row in fetched]
usage = [row[11] for row in fetched]
assert set(usage) == {'Commercial','Residential'}
data = {'sourceId':SOURCE_ID,'columns':COLUMNS,'rows':rows}
raw = (json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n').encode()
packed = gzip.compress(raw,compresslevel=9,mtime=0)
report = {
    'sourceId':SOURCE_ID,'publisher':baseline['publisher'],'sourceUrl':baseline['sourceUrl'],
    'originalSourceUrl':baseline['originalSourceUrl'],'license':baseline['license'],
    'licenseUrl':baseline['licenseUrl'],'sourceSnapshotDate':baseline['sourceSnapshotDate'],
    'sourceParquetBytes':len(source),'sourceParquetSha256':sha(source),
    'captureRule':'DLD-derived 2026 sale registrations through October 31 with property type Unit and subtype Office or Shop, regardless of usage label. The source changes Office/Shop usage from Commercial to Residential on February 9–10; subtype is retained but this mismatch requires source verification. Not a full-year count.',
    'periodStatus':'partial_2026_subtype_based_usage_label_conflict',
    'rows':len(rows),'cleanRows':sum(r[10] == 0 for r in rows),
    'commercialUsageRows':usage.count('Commercial'),'residentialUsageRows':usage.count('Residential'),
    'distinctAreaIds':len({r[2] for r in rows}),
    'dateRange':[rows[-1][1],rows[0][1]],
    'compressedBytes':len(packed),'compressedSha256':sha(packed),
    'rawBytes':len(raw),'rawSha256':sha(raw),
    'limits':'Registered Office and Shop subtype rows from a licensed secondary DLD copy; 4,319 rows have a conflicting Residential usage label and need primary source verification. Interpret them as subtype-based candidate commercial evidence. No current availability, asking rent, other commercial types, exact coordinates, or complete 2026 year. Values and medians use quality_flags=0 only.'
}
verify(packed,report)
PACKED.write_bytes(packed)
REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'rows':len(rows),'cleanRows':report['cleanRows'],'commercialUsageRows':report['commercialUsageRows'],'residentialUsageRows':report['residentialUsageRows'],'compressedBytes':len(packed)}))
