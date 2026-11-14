#!/usr/bin/env python3
"""Verify and publish the explicitly incomplete 2026 DLD office/shop sales slice."""

import gzip
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "work/dubai-commercial-capture/dld_sales_transactions.parquet"
OUT = ROOT / "data/uae-evidence/dubai"
PACKED = OUT / "commercial-unit-sales-2026-partial-20261110.json.gz"
REPORT = OUT / "commercial-unit-sales-2026-partial-validation.json"
BASELINE = OUT / "commercial-unit-sales-validation.json"
COLUMNS = ["transactionId", "date", "areaId", "areaName", "projectName", "buildingName", "spaceType", "registration", "areaSqm", "priceAed", "qualityFlags"]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def verify(packed, report):
    assert len(packed) == report["compressedBytes"] and sha(packed) == report["compressedSha256"]
    raw = gzip.decompress(packed)
    assert len(raw) == report["rawBytes"] and sha(raw) == report["rawSha256"]
    data = json.loads(raw)
    rows = data["rows"]
    assert data["sourceId"] == report["sourceId"] and data["columns"] == COLUMNS
    assert len(rows) == report["rows"] == 1133
    assert len({row[0] for row in rows}) == len(rows)
    assert sum(row[10] == 0 for row in rows) == report["cleanRows"]
    assert len({row[2] for row in rows}) == report["distinctAreaIds"]
    assert all("2026-01-01" <= row[1] <= "2026-02-09" and row[6] in ("Office", "Shop") and row[7] in ("Ready", "Off-Plan") for row in rows)
    assert rows[0][1] == "2026-02-09" and rows[-1][1] == "2026-01-01"
    assert report["periodStatus"] == "partial_source_classification_stops_2026-02-09"
    return rows


if "--check" in sys.argv:
    rows = verify(PACKED.read_bytes(), json.loads(REPORT.read_text()))
    print(json.dumps({"passed": True, "rows": len(rows)}))
    raise SystemExit

baseline = json.loads(BASELINE.read_text())
source = SOURCE.read_bytes()
assert len(source) == baseline["sourceParquetBytes"] and sha(source) == baseline["sourceParquetSha256"]
import duckdb  # Capture-only dependency; --check uses standard library.

query = """select transaction_id, instance_date, area_id, area_name_en,
project_name, building_name, property_sub_type, reg_type_label,
area_sqm, price_aed, quality_flags
from read_parquet(?)
where usage_label='Commercial' and property_type_label='Unit'
and property_sub_type in ('Office','Shop')
and instance_date>='2026-01-01' and instance_date<='2026-02-09'
order by instance_date desc, transaction_id"""
fetched = duckdb.connect().execute(query, [str(SOURCE)]).fetchall()
db = duckdb.connect()
later_sales, latest_later_sale = db.execute(
    "select count(*), max(instance_date) from read_parquet(?) where instance_date>'2026-02-09' and instance_date<'2027-01-01'",
    [str(SOURCE)],
).fetchone()
assert later_sales == 113302 and latest_later_sale.isoformat() == "2026-11-02"
rows = [[value.isoformat() if hasattr(value, "isoformat") else value for value in row] for row in fetched]
data = {"sourceId": "dred-dld-commercial-unit-sales-2026-partial-20261102", "columns": COLUMNS, "rows": rows}
raw = (json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
packed = gzip.compress(raw, compresslevel=9, mtime=0)
report = {
    "sourceId": data["sourceId"],
    "publisher": baseline["publisher"],
    "sourceUrl": baseline["sourceUrl"],
    "originalSourceUrl": baseline["originalSourceUrl"],
    "license": baseline["license"],
    "licenseUrl": baseline["licenseUrl"],
    "sourceSnapshotDate": baseline["sourceSnapshotDate"],
    "sourceRows": baseline["sourceRows"],
    "sourceParquetBytes": len(source),
    "sourceParquetSha256": sha(source),
    "captureRule": "DLD Sales; usage Commercial; property type Unit; subtype Office or Shop; registration dates 2026-01-01 to 2026-02-09 inclusive. Source commercial-unit classification stops on 9 February while other classes continue. This is a partial period and cannot represent full-year 2026 activity.",
    "periodStatus": "partial_source_classification_stops_2026-02-09",
    "other2026SalesAfterCommercialCutoff": later_sales,
    "latestOther2026SaleDate": latest_later_sale.isoformat(),
    "rows": len(rows),
    "cleanRows": sum(row[10] == 0 for row in rows),
    "distinctAreaIds": len({row[2] for row in rows}),
    "dateRange": [rows[-1][1], rows[0][1]],
    "compressedBytes": len(packed), "compressedSha256": sha(packed),
    "rawBytes": len(raw), "rawSha256": sha(raw),
}
verify(packed, report)
PACKED.write_bytes(packed)
REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({"rows": len(rows), "cleanRows": report["cleanRows"], "distinctAreaIds": report["distinctAreaIds"]}))
