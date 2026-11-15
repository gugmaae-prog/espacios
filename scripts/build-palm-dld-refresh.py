#!/usr/bin/env python3
"""Reconcile the public 2 November DLD export to the accepted Palm area history.

The two raw Data Dubai downloads stay outside the repository. Only source
checksums, cohort counts, and explicitly withheld partial-period prices ship.
"""
import argparse
import csv
import gzip
import hashlib
import json
import math
import statistics
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASELINE = ROOT / "data/palm-jebel-ali-history-20261103.json"
OUTPUT = ROOT / "data/palm-jebel-ali-dld-refresh-20261103.json"
SQM_PER_SQFT = 10.763910416709722
FILES = (
    ("pja-dld-20261102-1.csv.gz", "transactions_2026-11-02_17-44-57_0001.csv.gz", 81774779, 581003826,
     "a776a572d60fc1598f7bee3c8bc04e74ae1a75fd21b0bf456b40cf427f330e07"),
    ("pja-dld-20261102-2.csv.gz", "transactions_2026-11-02_17-44-57_0002.csv.gz", 81783077, 581124654,
     "09cfc14b46539d8f64d7179ac95d23b62d22a53098444b5eb2f753bccf74c9b5"),
)
COHORTS = {
    "land": ("Commercial", "Land", "Existing Properties"),
    "unit": ("Residential", "Unit", "Off-Plan Properties"),
    "building": ("Commercial", "Building", "Existing Properties"),
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def quantile(values, fraction):
    ordered = sorted(values)
    position = (len(ordered) - 1) * fraction
    lower, upper = math.floor(position), math.ceil(position)
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def period(day):
    assert len(day) == 10 and day[4] == "-" and day[7] == "-"
    return f"{day[:4]}Q{(int(day[5:7]) - 1) // 3 + 1}"


def build(source_dir):
    baseline = json.loads(BASELINE.read_text())
    if baseline["version"] != "20261103-palm-jebel-ali-history-v2" or baseline["aggregateDistinctSaleCounts"]["total"] != 2102:
        raise ValueError("Accepted Palm baseline changed")
    rows = defaultdict(lambda: defaultdict(list))
    ids = set()
    area_rows = 0
    excluded_non_sales = Counter()
    source_files = []
    for local_name, source_name, compressed_bytes, uncompressed_bytes, sha256 in FILES:
        path = source_dir / local_name
        raw = path.read_bytes()
        if len(raw) != compressed_bytes or digest(raw) != sha256:
            raise ValueError("Source bytes or SHA-256 changed: " + local_name)
        if len(gzip.decompress(raw)) != uncompressed_bytes:
            raise ValueError("Uncompressed source length changed: " + local_name)
        source_files.append({"name": source_name, "compressedBytes": compressed_bytes,
                             "uncompressedBytes": uncompressed_bytes, "sha256": sha256})
        with gzip.open(path, "rt", encoding="utf-8-sig", newline="") as stream:
            for row in csv.DictReader(stream):
                if row["area_id"] != "411":
                    continue
                area_rows += 1
                if row["area_name_en"] != "Palm Jabal Ali":
                    raise ValueError("DLD area ID/name mismatch")
                transaction_id = row["transaction_id"]
                if not transaction_id or transaction_id in ids:
                    raise ValueError("Missing or repeated Palm transaction ID")
                ids.add(transaction_id)
                if row["trans_group_en"] != "Sales":
                    excluded_non_sales[row["trans_group_en"]] += 1
                    continue
                matching = [kind for kind, spec in COHORTS.items()
                            if (row["property_usage_en"], row["property_type_en"], row["reg_type_en"]) == spec]
                if len(matching) != 1:
                    raise ValueError("New DLD Palm sale class needs review")
                worth, area = float(row["actual_worth"]), float(row["procedure_area"])
                if not all(math.isfinite(n) and n > 0 for n in (worth, area)):
                    raise ValueError("Invalid sale worth or area")
                rows[matching[0]][period(row["instance_date"])].append(worth / area / SQM_PER_SQFT)
    if area_rows != 2218 or excluded_non_sales != {"Gifts": 53, "Mortgages": 24}:
        raise ValueError("Palm source inventory changed")

    reconciled = 0
    for series in baseline["series"]:
        kind = series["kind"]
        for point in series["points"]:
            if not point["periodComplete"]:
                continue
            values = rows[kind][point["period"]]
            if len(values) != point["saleCount"]:
                raise ValueError(f"Prior count changed: {kind} {point['period']}")
            if point["medianAEDPerSqft"] is not None:
                for key, fraction in (("medianAEDPerSqft", .5), ("p25AEDPerSqft", .25), ("p75AEDPerSqft", .75)):
                    if abs(quantile(values, fraction) - point[key]) > .0051:
                        raise ValueError(f"Prior price statistic changed: {kind} {point['period']} {key}")
            reconciled += 1
    if set(rows) != set(COHORTS) or any(p != "2026Q4" for kind in rows for p in rows[kind] if
                                            p not in {x["period"] for s in baseline["series"] if s["kind"] == kind for x in s["points"]}):
        raise ValueError("Unexpected new period or cohort")
    latest_counts = {kind: len(rows[kind].get("2026Q4", [])) for kind in COHORTS}
    if latest_counts != {"land": 31, "unit": 13, "building": 0}:
        raise ValueError("Latest Palm period changed")
    previous_q4 = {s["kind"]: next((p["saleCount"] for p in s["points"] if p["period"] == "2026Q4"), 0)
                   for s in baseline["series"]}
    new_total = sum(len(values) for cohort in rows.values() for values in cohort.values())
    if new_total != 2141 or new_total - 2102 != 39:
        raise ValueError("Latest Palm sale count does not reconcile")

    return {
        "version": "20261103-palm-jebel-ali-dld-refresh-v1",
        "asOf": "2026-11-03",
        "classification": "newer_dld_derived_area_sale_snapshot",
        "source": {"id": "dld-pja-transactions-export-20261102", "publisher": "Dubai Land Department / Data Dubai",
                   "url": "https://data.dubai/en/l/470061", "exportFolderDate": "2026-11-02",
                   "retrieved": "2026-11-03", "classification": "official_open_data_export",
                   "licence": "Dubai Open Data Licence; attributed derivatives allowed; original data resale prohibited",
                   "files": source_files, "rawRowsRedistributed": False},
        "geography": {"sourceAreaId": 411, "sourceAreaName": "Palm Jabal Ali", "scope": "cadastral_area_context"},
        "reconciliation": {"acceptedVersion": baseline["acceptedV48Version"], "acceptedSnapshotSales": 2102,
                           "priorPeriodPointsMatched": reconciled, "priorDisplayedMedianAndQuartilesMatched": True,
                           "newerSnapshotSales": new_total, "netCountDifference": 39,
                           "identityCaveat": "The older focused archive retains aggregate counts, not a comparable transaction-ID list. The +39 is a net source-vintage difference, not a certified ID-level addition."},
        "sourceInventory": {"areaRows": area_rows, "distinctAreaTransactionIds": len(ids),
                            "excludedGifts": excluded_non_sales["Gifts"], "excludedMortgages": excluded_non_sales["Mortgages"]},
        "latestPeriod": {"period": "2026Q4", "periodComplete": False, "throughDate": "2026-10-30",
                         "landSales": latest_counts["land"], "residentialUnitSales": latest_counts["unit"],
                         "commercialBuildingSales": latest_counts["building"],
                         "previousSnapshotLandSales": previous_q4["land"],
                         "previousSnapshotResidentialUnitSales": previous_q4["unit"],
                         "medianAEDPerSqft": None, "withheldReason": "partial_quarter",
                         "note": "Q4 counts are incomplete. The 13 residential unit sales also remain below the 20-sale display gate. No Q4 price anchor or villa price is inferred."},
        "saleCohortTotals": {kind: sum(map(len, periods.values())) for kind, periods in rows.items()},
        "methodology": "Exact DLD area 411; Sales only; commercial existing Land/Building and residential off-plan Unit cohorts remain separate. Positive worth and area, distinct source transaction IDs, and exact reconciliation of all prior quarterly counts and displayed price statistics. Q4 count-only; price statistics withheld while the quarter is open. Native project names do not certify a marketed villa transaction.",
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.source_dir:
        output = json.dumps(build(args.source_dir), indent=2, ensure_ascii=False) + "\n"
        if args.check:
            if OUTPUT.read_text() != output:
                raise ValueError("Palm DLD refresh output differs")
        else:
            OUTPUT.write_text(output)
    else:
        if not args.check:
            parser.error("--source-dir is required to build")
        data = json.loads(OUTPUT.read_text())
        if data["reconciliation"]["newerSnapshotSales"] != 2141 or data["latestPeriod"]["medianAEDPerSqft"] is not None:
            raise ValueError("Published Palm DLD refresh changed")
    print(json.dumps({"version": json.loads(OUTPUT.read_text())["version"], "status": "checked" if args.check else "built"}))


if __name__ == "__main__":
    main()
