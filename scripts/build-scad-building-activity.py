#!/usr/bin/env python3
"""Extract selected SCAD quarterly building activity from checksum-pinned XLSX files.

Requires openpyxl. Raw workbooks are fetched from the official publication URLs
and retained locally; only numerical facts and source receipts are committed.
"""

import argparse
import hashlib
import json
from pathlib import Path

import openpyxl


ROOT = Path(__file__).resolve().parents[1]
SOURCES = [
    ("2025Q1", "first-quarter-2025", "2025-06-30", 179896, "5064e540d0094374fd5942019030e1c633cee07f9b9222aedf0b1d0e19d380b5"),
    ("2025Q2", "second-quarter-2025", "2025-09-30", 180466, "5dd02aa933caffdd841f3ed875252e695a0071af54c77d3a6ee65dba3b376b28"),
    ("2025Q3", "third-quarter-2025", "2025-12-31", 404686, "7fca27e7bcdb1e323c04550cdefbb7dc7083f9af3ace3513fdd5226326b17cd4"),
    ("2025Q4", "fourth-quarter-2025", "2026-04-09", 179797, "d4b1faf00397ba416d37f074da15f8e7c8bcfa07650ac6ebe2ebe27af24ddcd2"),
    ("2026Q2", "second-quarter-2026", "2026-09-30", 180386, "e32ec929607267b4c2516fd6cbc01f14b4fdadf43b2319e58507298bc3af7089"),
]
REGIONS = ("abuDhabi", "alAin", "alDhafra", "emirateTotal")
TABLE_KEYS = {
    "Table 1": ("permitByType", {"total": "total", "new buildings": "newBuildings", "additions": "additions", "other (modification)": "modifications"}),
    "Table 2": ("permitByUsage", {"total": "total", "residential": "residential", "commercial": "commercial", "industrial": "industrial", "public facilities": "publicFacilities", "agricultural": "agricultural", "other": "other", "others": "other"}),
    "Table 3": ("completionByConstruction", {"total": "total", "new building": "newBuilding", "additions": "additions", "other - modification": "modifications"}),
}


def table_rows(sheet, keys):
    rows = {}
    for row in sheet.iter_rows(min_row=5, max_row=13):
        raw = row[1].value
        if not isinstance(raw, str):
            continue
        label = " ".join(raw.lower().split())
        key = keys.get(label)
        if key is None:
            continue
        assert key not in rows, (sheet.title, key)
        values = [row[i].value for i in range(2, 6)]
        assert all(isinstance(value, int) and value >= 0 for value in values), (sheet.title, key, values)
        assert sum(values[:3]) == values[3], (sheet.title, key, values)
        rows[key] = dict(zip(REGIONS, values))
    assert set(rows) == set(keys.values()), (sheet.title, rows.keys())
    for region in REGIONS:
        assert sum(row[region] for key, row in rows.items() if key != "total") == rows["total"][region], (sheet.title, region)
    return rows


def build(directory):
    downloads = json.loads((directory / "scad-building-quarters-downloads.json").read_text())
    observations, receipts = [], []
    for period, slug, published, expected_bytes, expected_sha in SOURCES:
        raw = (directory / f"scad-{slug}.xlsx").read_bytes()
        assert len(raw) == expected_bytes and hashlib.sha256(raw).hexdigest() == expected_sha, slug
        receipt = downloads[slug]
        assert receipt["bytes"] == expected_bytes and receipt["sha256"] == expected_sha
        book = openpyxl.load_workbook(directory / f"scad-{slug}.xlsx", read_only=True, data_only=True)
        parsed = {}
        for table, (name, keys) in TABLE_KEYS.items():
            sheet = book[table]
            assert str(sheet["B2"].value).startswith({"Table 1": "Table 1: Number of permits", "Table 2": "Table 2: Number of permits", "Table 3": "Table 3: Building completions"}[table]), (period, table)
            parsed[name] = table_rows(sheet, keys)
        # Table 1 and 2 are alternative breakdowns of the same permits.
        assert parsed["permitByType"]["total"] == parsed["permitByUsage"]["total"]
        assert book["Table 4"]["C7"].value == parsed["completionByConstruction"]["total"]["emirateTotal"]
        assert [book["Table 4"][f"C{i}"].value for i in (8, 9, 10)] == [parsed["completionByConstruction"]["total"][region] for region in REGIONS[:3]]
        observations.append({"period": period, "publicationDate": published, "preliminary": True, **parsed})
        receipts.append({"period": period, "publicationPageUrl": receipt["page"], "workbookUrl": receipt["fileUrl"], "retrievedAt": "2026-11-10", "bytes": expected_bytes, "sha256": expected_sha, "readback": "second independent GET matched bytes and SHA-256", "tables": ["Table 1", "Table 2", "Table 3", "Table 4 cross-check"]})
        book.close()
    data = {
        "sourceId": "scad-abu-dhabi-quarterly-building-activity-20261110",
        "publisher": "Statistics Centre - Abu Dhabi (SCAD)",
        "underlyingSource": "Department of Municipalities and Transport",
        "evidenceClass": "official_quarterly_building_permit_and_completion_aggregates",
        "emirate": "Abu Dhabi",
        "grain": "quarter × permit type or building use or completion construction type × region",
        "unit": "count",
        "regions": ["Abu Dhabi Region", "Al Ain Region", "Al Dhafra Region", "Emirate total"],
        "periodsUnavailable": ["2026Q1"],
        "limits": "Preliminary quarterly counts from selected SCAD publications. Permit type and usage are alternative breakdowns of the same permits and must not be added together. Completion counts include all uses; the source does not split completions by commercial use. Q1 2026 is not in this verified set. Counts are not completed commercial units, registered sales, prices, project identities, or current availability.",
        "observations": observations,
    }
    target = ROOT / "data/uae-evidence/abu-dhabi/building-activity-20261110.json"
    target.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    raw = target.read_bytes()
    report = {
        "sourceId": data["sourceId"], "rows": len(observations),
        "dataBytes": len(raw), "dataSha256": hashlib.sha256(raw).hexdigest(),
        "sourcePageUrl": "https://www.scad.gov.ae/industry-construction?ThemeID=3294937&tab=Publications",
        "captureReports": receipts,
        "rightsScope": "Selected numerical facts and official source links with SCAD attribution under its published open-data policy; original workbooks are not republished.",
        "verification": "Each of five official workbooks was fetched twice with matching bytes and SHA-256. The source Table 1 and Table 2 permit totals match, every regional breakdown sums to its emirate total, each component sums to its own total, and Table 3 completion totals match Table 4.",
        "limits": data["limits"],
    }
    (ROOT / "data/uae-evidence/abu-dhabi/building-activity-validation.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"periods": [row["period"] for row in observations], "latestCommercialPermits": observations[-1]["permitByUsage"]["commercial"]["emirateTotal"], "dataSha256": report["dataSha256"]}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, default=Path("/tmp"))
    build(parser.parse_args().source_dir)
