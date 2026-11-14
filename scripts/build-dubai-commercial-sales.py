#!/usr/bin/env python3
"""Publish a bounded, reproducible Dubai office/shop registered-sales snapshot."""

import gzip
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "work/dubai-commercial-capture/dld_sales_transactions.parquet"
OUT = ROOT / "data/uae-evidence/dubai"
PACKED = OUT / "commercial-unit-sales-20261110.json.gz"
REPORT = OUT / "commercial-unit-sales-validation.json"
SOURCE_URL = "https://huggingface.co/datasets/dubairealestatedata/dubai-real-estate-sales-transactions"
SOURCE_SHA = "8294c3dd83dde2e16e64eaf1ef155a1ad14ec16b6b39384561777afb8425417e"
COLUMNS = ["transactionId", "date", "areaId", "areaName", "projectName", "buildingName", "spaceType", "registration", "areaSqm", "priceAed", "qualityFlags"]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def verify(packed, report):
    assert len(packed) == report["compressedBytes"] and sha(packed) == report["compressedSha256"]
    raw = gzip.decompress(packed)
    assert len(raw) == report["rawBytes"] and sha(raw) == report["rawSha256"]
    data = json.loads(raw)
    rows = data["rows"]
    assert data["columns"] == COLUMNS and len(rows) == report["rows"] == 66366
    assert len({row[0] for row in rows}) == len(rows)
    assert sum(row[10] == 0 for row in rows) == report["cleanRows"] == 64151
    assert len({row[2] for row in rows}) == report["distinctAreaIds"] == 51
    assert all("2006-01-01" <= row[1] <= "2025-12-31" and row[6] in ("Office", "Shop") and row[7] in ("Ready", "Off-Plan") for row in rows)
    assert rows[0][1] == "2025-12-31" and rows[-1][1] == "2006-02-16"
    return rows


if "--check" in sys.argv:
    rows = verify(PACKED.read_bytes(), json.loads(REPORT.read_text()))
    print(json.dumps({"passed": True, "rows": len(rows)}))
    raise SystemExit

assert SOURCE.exists(), "Download the source Parquet into work/dubai-commercial-capture first"
source = SOURCE.read_bytes()
assert len(source) == 22819023 and sha(source) == SOURCE_SHA, "Source snapshot changed"
import duckdb  # Capture-only dependency; --check uses the standard library.

query = """select transaction_id, instance_date, area_id, area_name_en,
project_name, building_name, property_sub_type, reg_type_label,
area_sqm, price_aed, quality_flags
from read_parquet(?)
where usage_label='Commercial' and property_type_label='Unit'
and property_sub_type in ('Office','Shop') and instance_date<'2026-01-01'
order by instance_date desc, transaction_id"""
fetched = duckdb.connect().execute(query, [str(SOURCE)]).fetchall()
rows = [[value.isoformat() if hasattr(value, "isoformat") else value for value in row] for row in fetched]
data = {
    "sourceId": "dred-dld-commercial-unit-sales-20261102",
    "columns": COLUMNS,
    "rows": rows,
}
raw = (json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
packed = gzip.compress(raw, compresslevel=9, mtime=0)
report = {
    "sourceId": data["sourceId"],
    "publisher": "Dubai Real Estate Data, based on Dubai Land Department open data",
    "sourceUrl": SOURCE_URL,
    "originalSourceUrl": "https://dubailand.gov.ae/en/open-data/real-estate-data/",
    "license": "CC BY 4.0; derived subset with attribution",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
    "sourceSnapshotDate": "2026-11-02",
    "sourceRows": 1382848,
    "sourceParquetBytes": len(source),
    "sourceParquetSha256": SOURCE_SHA,
    "captureRule": "DLD Sales; usage Commercial; property type Unit; subtype Office or Shop; registration date before 2026-01-01. Retains quality flags. Source classification for these unit types stops on 2026-02-09, so 2026 is withheld as incomplete.",
    "rows": len(rows),
    "cleanRows": sum(row[10] == 0 for row in rows),
    "distinctAreaIds": len({row[2] for row in rows}),
    "dateRange": [rows[-1][1], rows[0][1]],
    "compressedBytes": len(packed),
    "compressedSha256": sha(packed),
    "rawBytes": len(raw),
    "rawSha256": sha(raw),
}
verify(packed, report)
PACKED.write_bytes(packed)
REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({"rows": len(rows), "cleanRows": report["cleanRows"], "compressedBytes": len(packed)}))
