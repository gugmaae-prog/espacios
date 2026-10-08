#!/usr/bin/env python3
"""Prepare exact-name, source-native DLD master-community sale cohorts.

Only privacy-preserving monthly and quarterly aggregates are written. Raw DLD
transaction rows and identifiers stay in the local temporary source files.
"""
import argparse
import csv
import gzip
import hashlib
import io
import json
import math
import re
import statistics
import unicodedata
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "data/historical-intelligence"
AS_OF = "2026-10-08"
CUTOFF = date(2026, 10, 6)
SOURCE_ID = "dld-official-community-master-transactions-20261007"
SOURCE_URL = "https://data.dubai/en/l/470061"
LICENCE = "Dubai Open Data Licence; attribution required, commercial derivatives allowed, original data resale prohibited"
TRANSACTION_FILES = {
    "dld-transactions-2026-10-07-0001.csv.gz": {
        "sourceFileName": "transactions_2026-10-07_17-55-58_0001.csv.gz",
        "sha256": "6625f13f9896c725cf6599e30051d0fef9be208bd8757141d2eac93e148d57de",
    },
    "dld-transactions-2026-10-07-0002.csv.gz": {
        "sourceFileName": "transactions_2026-10-07_17-55-58_0002.csv.gz",
        "sha256": "cf479f282632cea3525648db3f42d8f9a956a949dff92ca400e2b68f88fee1e5",
    },
}
FIELDS = [
    "Series ID", "Emirate", "Geography", "Scope", "Segment", "Registration", "Period",
    "Frequency", "Metric", "Value", "Unit", "Sample rows", "P25", "P75",
    "Eligible value AED", "Quality", "Class", "Source ID", "Source URL", "Raw source emirate",
    "Gross yield pct", "Blocked rows", "Published date", "Observation basis", "Source area ID",
    "Native row JSON", "Endpoint",
]


def sha(blob):
    return hashlib.sha256(blob).hexdigest()


def norm(value):
    value = unicodedata.normalize("NFKC", str(value or "")).casefold()
    return " ".join(re.sub(r"[^\w]+", " ", value).split())


def number(raw):
    value = float(raw)
    if not math.isfinite(value):
        raise ValueError("non-finite number")
    return value


def quarter(day):
    return f"{day.year}-Q{(day.month - 1) // 3 + 1}"


def period_for(day, frequency):
    return day.strftime("%Y-%m") if frequency == "month" else quarter(day)


def quantile(values, p):
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    pos = (len(ordered) - 1) * p
    low, high = math.floor(pos), math.ceil(pos)
    return ordered[low] + (ordered[high] - ordered[low]) * (pos - low)


def clean(value):
    return "" if value is None else f"{value:.4f}"


def read_snapshot(path):
    if path:
        blob = path.read_bytes()
        if path.suffix == ".gz":
            blob = gzip.decompress(blob)
        return json.loads(blob), path
    manifest = json.loads((BASE / "publication-manifest.json").read_text())
    root = ROOT / manifest["rootIndex"]["path"]
    return json.loads(gzip.decompress(root.read_bytes())), root


def community_targets(snapshot):
    candidates = defaultdict(list)
    for record in snapshot["records"]:
        if record.get("type") == "community" and record.get("emirate") == "Dubai":
            candidates[norm(record.get("name"))].append(record)

    targets = {}
    ambiguous, already_covered = [], []
    for key, group in candidates.items():
        if not key:
            continue
        if len(group) != 1:
            ambiguous.extend(item["id"] for item in group)
            continue
        record = group[0]
        coverage = record.get("coverageSummary", {})
        has_subject_price = any(
            series.get("scope") == "subject"
            and series.get("identityVerified") is True
            and series.get("metric") in {"price", "median_sale_aed_sqft"}
            for series in record.get("historySeries", [])
        )
        has_direct_sale = any(
            obs.get("scope") == "subject"
            and obs.get("identityVerified") is True
            and obs.get("metric") == "price"
            and obs.get("observationKind") == "transaction"
            and obs.get("transactionKind") == "sale"
            for obs in record.get("observations", [])
        )
        if int(coverage.get("directSalePeriods", 0) or 0) > 0 or has_subject_price or has_direct_sale:
            already_covered.append(record["id"])
            continue
        targets[key] = record
    return targets, ambiguous, already_covered


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--transactions", nargs=2, type=Path, required=True)
    parser.add_argument("--snapshot", type=Path)
    parser.add_argument("--out-history", type=Path, default=BASE / "dld-20261007-community-master-monthly-quarterly-sales.csv.gz")
    parser.add_argument("--out-sidecar", type=Path, default=BASE / "dld-20261007-community-master-history-enrichment.json")
    args = parser.parse_args()

    snapshot, snapshot_path = read_snapshot(args.snapshot)
    if snapshot.get("version") != "20261008-enrichment-v22":
        raise ValueError(f"Expected the reviewed V22 catalogue baseline; found {snapshot.get('version')!r}")
    targets, ambiguous_catalogue, already_covered = community_targets(snapshot)
    baseline = json.loads((BASE / "scrape-enrichment.json").read_text())
    if any(source.get("id") == SOURCE_ID for source in baseline.get("sources", [])):
        raise ValueError(f"Source id already exists: {SOURCE_ID}")

    files = sorted(args.transactions, key=lambda path: path.name)
    if {path.name for path in files} != set(TRANSACTION_FILES):
        raise ValueError("Expected the two pinned 2026-10-07 official DLD transaction snapshot files")
    hashes = {}
    for path in files:
        digest = sha(path.read_bytes())
        if digest != TRANSACTION_FILES[path.name]["sha256"]:
            raise ValueError(f"Official DLD transaction checksum mismatch: {path.name}")
        hashes[path.name] = digest

    # Key each exact DLD master label to exactly one Dubai catalogue community.
    master_to_record = {}
    for key, record in targets.items():
        master_to_record[key] = record

    grouped = defaultdict(list)
    areas_by_record = defaultdict(set)
    master_spelling_by_record = defaultdict(set)
    tx_owner = {}
    duplicate_ids = 0
    malformed_dates = 0
    quarantines = Counter()
    selected_rows = 0
    formula_checks = 0
    formula_discrepancies = 0
    observed_days = []

    for path in files:
        with gzip.open(path, "rt", encoding="utf-8-sig", newline="") as stream:
            for row in csv.DictReader(stream):
                master_name = row.get("master_project_en") or ""
                record = master_to_record.get(norm(master_name))
                if not record:
                    continue
                # Preserve the exact source label and do not infer neighbouring areas.
                if not (
                    row.get("trans_group_en") == "Sales"
                    and row.get("property_usage_en") == "Residential"
                    and row.get("property_type_en") in {"Unit", "Villa"}
                    and row.get("reg_type_en") in {"Off-Plan Properties", "Existing Properties"}
                ):
                    continue
                try:
                    day = date.fromisoformat((row.get("instance_date") or "")[:10])
                except ValueError:
                    malformed_dates += 1
                    continue
                if day.year < 1900 or day > CUTOFF:
                    quarantines["outside_snapshot_window"] += 1
                    continue
                try:
                    area_id = int(float(row.get("area_id") or ""))
                    actual_worth = number(row.get("actual_worth") or "")
                    procedure_area = number(row.get("procedure_area") or "")
                    meter_price = number(row.get("meter_sale_price") or "")
                except (ValueError, TypeError):
                    quarantines["invalid_area_or_price"] += 1
                    continue
                area_name = " ".join((row.get("area_name_en") or "").split())
                if area_id <= 0 or not area_name or min(actual_worth, procedure_area, meter_price) <= 0:
                    quarantines["nonpositive_or_missing_area_price"] += 1
                    continue
                formula_checks += 1
                if abs(actual_worth / procedure_area - meter_price) > max(0.03, meter_price * 0.001):
                    formula_discrepancies += 1
                    quarantines["price_formula_discrepancy"] += 1
                    continue
                transaction_id = row.get("transaction_id")
                if not transaction_id:
                    quarantines["missing_transaction_id"] += 1
                    continue
                identity = (record["id"], area_id, norm(master_name))
                row_signature = (
                    row.get("instance_date"), row.get("project_number"), row.get("property_type_en"),
                    row.get("property_sub_type_en"), row.get("reg_type_en"),
                    row.get("actual_worth"), row.get("procedure_area"), row.get("meter_sale_price"),
                )
                prior = tx_owner.get(transaction_id)
                if prior:
                    if prior[0] != identity:
                        raise ValueError("One DLD transaction identifier fans out to multiple community identities")
                    if prior[1] != row_signature:
                        raise ValueError("Duplicate DLD transaction identifier has conflicting source values")
                    duplicate_ids += 1
                    continue
                tx_owner[transaction_id] = (identity, row_signature)

                aed_sqft = actual_worth / procedure_area / 10.763910416709722
                subtype = " ".join((row.get("property_sub_type_en") or "Unknown").split()) or "Unknown"
                segment_key = (row["property_type_en"], subtype)
                source_name = " ".join(master_name.split())
                master_spelling_by_record[record["id"]].add(source_name)
                areas_by_record[record["id"]].add((area_id, area_name))
                for frequency in ("month", "quarter"):
                    key = (record["id"], area_id, area_name, row["reg_type_en"], *segment_key, frequency, period_for(day, frequency))
                    grouped[key].append({"aedSqft": aed_sqft, "actualWorthAED": actual_worth, "day": day.isoformat()})
                selected_rows += 1
                observed_days.append(day.isoformat())

    if not grouped:
        raise ValueError("No exact DLD master-label sales matched an uncovered Dubai community")
    source_available = "2026-10-08T02:17:55Z"
    retrieved = "2026-10-08T02:19:43Z"
    out = io.StringIO(newline="")
    writer = csv.DictWriter(out, fieldnames=FIELDS, lineterminator="\n")
    writer.writeheader()
    cells = Counter()
    records_cells = Counter()
    sparse_cells = 0
    priced_cells = 0
    series_signatures = {}
    links = []
    basis_by_record = {}
    for record_id in sorted(areas_by_record):
        record = targets[norm(next(item["name"] for item in snapshot["records"] if item["id"] == record_id))]
        labels = sorted(master_spelling_by_record[record_id])
        area_rows = sorted(areas_by_record[record_id])
        basis_by_record[record_id] = (
            f"The unique Dubai catalogue community {record['name']!r} exactly matches the official DLD transaction field "
            f"master_project_en after case/spacing/punctuation normalization. All rows are selected only under that native "
            f"master label; native DLD area IDs and names are retained as separate series. Exact source labels observed: {labels!r}; "
            f"registered area IDs/names: {area_rows!r}. This scope follows the DLD master label and does not assert a legal or wider geographic boundary."
        )

    for key in sorted(grouped):
        record_id, area_id, area_name, registration, property_type, subtype, frequency, period = key
        values = grouped[key]
        count = len(values)
        prices = [row["aedSqft"] for row in values]
        value = statistics.median(prices) if count >= 20 else None
        p25, p75 = (quantile(prices, 0.25), quantile(prices, 0.75)) if count >= 20 else (None, None)
        record = next(item for item in snapshot["records"] if item["id"] == record_id)
        registration_slug = "offplan" if registration == "Off-Plan Properties" else "existing"
        component = re.sub(r"[^a-z0-9]+", "-", f"{property_type}-{subtype}".casefold()).strip("-")
        segment_hash = hashlib.sha256(f"{area_name}|{property_type}|{subtype}".encode()).hexdigest()[:8]
        id_hash = hashlib.sha256(record_id.encode()).hexdigest()[:12]
        series_id = f"{SOURCE_ID}-{id_hash}-area-{area_id}-{frequency}-{registration_slug}-{component}-{segment_hash}"
        signature = (record_id, area_id, area_name, registration, property_type, subtype, frequency)
        if series_id in series_signatures and series_signatures[series_id] != signature:
            raise ValueError(f"Derived series id collision: {series_id}")
        is_new_series = series_id not in series_signatures
        series_signatures[series_id] = signature
        source_dates = [row["day"] for row in values]
        detail = {
            "aggregation": "median and inclusive linear-interpolation quartiles of actual_worth / procedure_area / 10.763910416709722",
            "sampleCount": count,
            "minimumDisplaySample": 20,
            "statisticPublished": count >= 20,
            "sparseMedianPolicy": "withheld; eligible row count retained",
            "firstRegistrationDate": min(source_dates),
            "lastRegistrationDate": max(source_dates),
            "registrationDateBasis": "DLD instance_date",
            "masterProjectLabel": next(iter(master_spelling_by_record[record_id])) if len(master_spelling_by_record[record_id]) == 1 else sorted(master_spelling_by_record[record_id]),
            "scopeNote": "Exact official DLD master_project_en label; not a legal or wider geographic boundary.",
            "areaId": area_id,
            "areaName": area_name,
            "propertyType": property_type,
            "propertySubtype": subtype,
            "registration": registration,
            "snapshotDate": "2026-10-07",
            "observationCutoff": CUTOFF.isoformat(),
            "sourceFirstObservedAt": source_available,
            "backtestUse": "not admissible before first source retrieval",
        }
        writer.writerow({
            "Series ID": series_id,
            "Emirate": "Dubai",
            "Geography": record["name"],
            "Scope": "subject",
            "Segment": f"{property_type} / {subtype}",
            "Registration": registration,
            "Period": period,
            "Frequency": frequency,
            "Metric": "median_sale_aed_sqft",
            "Value": clean(value),
            "Unit": "AED/sqft",
            "Sample rows": count,
            "P25": clean(p25),
            "P75": clean(p75),
            "Eligible value AED": clean(sum(row["actualWorthAED"] for row in values)),
            "Quality": "eligible official DLD registered residential sales; n>=20" if count >= 20 else f"sparse official DLD sales; n={count}; median withheld below 20",
            "Class": "official DLD derived primary community-master cohort snapshot",
            "Source ID": SOURCE_ID,
            "Source URL": SOURCE_URL,
            "Raw source emirate": "Dubai",
            "Observation basis": "DLD instance_date is registration date, not contract execution or transfer date. Exact DLD master label and area ID; snapshot first retrieved 2026-10-08, not a complete or first-ever history.",
            "Source area ID": area_id,
            "Native row JSON": json.dumps(detail, ensure_ascii=False, separators=(",", ":"), sort_keys=True),
            "Endpoint": SOURCE_URL,
        })
        cells[frequency] += 1
        records_cells[record_id] += 1
        sparse_cells += int(value is None)
        priced_cells += int(value is not None)
        if is_new_series:
            links.append({
                "seriesId": series_id,
                "recordId": record_id,
                "scope": "subject",
                "identityVerified": True,
                "identityBasis": basis_by_record[record_id],
                "identitySourceIds": [SOURCE_ID],
            })

    csv_bytes = out.getvalue().encode("utf-8")
    compressed = gzip.compress(csv_bytes, mtime=0)
    args.out_history.parent.mkdir(parents=True, exist_ok=True)
    args.out_history.write_bytes(compressed)

    record_reviews = []
    for record_id in sorted(records_cells):
        record = next(item for item in snapshot["records"] if item["id"] == record_id)
        record_reviews.append({
            "recordId": record_id,
            "asOf": AS_OF,
            "status": "Exact official DLD master-label sale cohorts appended; complete or lifetime community price history remains unestablished.",
            "sourceIds": [SOURCE_ID],
            "collectionPasses": [{
                "passId": "pass46-dld-community-master-sales-20261007",
                "reviewedAt": AS_OF,
                "nativeMasterProjectLabels": sorted(master_spelling_by_record[record_id]),
                "nativeDldAreas": [{"areaId": area_id, "areaName": area_name} for area_id, area_name in sorted(areas_by_record[record_id])],
                "uniqueEligibleTransactionRows": sum(
                    len(values) for key, values in grouped.items() if key[0] == record_id and key[6] == "month"
                ),
                "monthlyQuarterlyAggregateCells": records_cells[record_id],
                "priceStatisticCellsAtOrAboveMinimum": sum(
                    1 for key, values in grouped.items() if key[0] == record_id and len(values) >= 20
                ),
                "smallSampleCellsRetainedWithoutPriceStatistic": sum(
                    1 for key, values in grouped.items() if key[0] == record_id and len(values) < 20
                ),
                "earliestSourceRegistrationDate": min(
                    row["day"] for key, values in grouped.items() if key[0] == record_id for row in values
                ),
                "latestSourceRegistrationDate": max(
                    row["day"] for key, values in grouped.items() if key[0] == record_id for row in values
                ),
                "sourcePublicationDate": "unknown",
                "fullHistoryClaim": False,
                "geographicScope": "exact DLD master_project_en label; not a legal or wider geographic boundary",
            }],
        })

    source = {
        "id": SOURCE_ID,
        "revisionOfSourceId": "dld-official-transactions-20261007",
        "preserveRevision": True,
        "url": SOURCE_URL,
        "publisher": "Dubai Land Department via Dubai Data and Statistics Establishment",
        "title": "DLD transactions, exact master-project community cohorts",
        "classification": "official_latest_vintage_open_data_snapshot",
        "sourceSnapshotDate": "2026-10-07",
        "publicationDateStatus": "unknown; portal publication time not independently established",
        "publishedAt": None,
        "firstAvailableAt": source_available,
        "retrievedAt": retrieved,
        "datePrecision": "minute",
        "availabilityBasis": "earliest local retrieval mtime of the two pinned snapshot parts; conservative point-in-time cutoff",
        "licence": LICENCE,
        "licenceURL": "https://data.dubai/en/terms-conditions",
        "snapshotFiles": [
            {"fileName": TRANSACTION_FILES[path.name]["sourceFileName"], "bytes": path.stat().st_size, "sha256": hashes[path.name]}
            for path in files
        ],
        "observationCoverage": {
            "start": min(observed_days),
            "end": max(observed_days),
            "basis": "eligible residential sales under exact native DLD master_project_en labels linked to unique Dubai community records; not complete community or lifetime coverage",
        },
        "rawTransactionRowsRedistributed": False,
        "rawTransactionIdsRedistributed": False,
        "note": "Only derived monthly and quarterly summaries are published. Area IDs remain separate; sparse cells retain counts and dates with price statistics withheld.",
    }
    sidecar = {
        "schemaVersion": 1,
        "passId": "pass46-dld-community-master-sales-20261007",
        "asOf": AS_OF,
        "sources": [source],
        "facts": [],
        "seriesLinks": links,
        "historyInputs": [{
            "id": "pass46-dld-community-master-cohort-history",
            "path": args.out_history.name,
            "sha256": sha(compressed),
            "uncompressedSHA256": sha(csv_bytes),
            "compression": "gzip",
            "rowCount": len(grouped),
            "sourceId": SOURCE_ID,
            "firstAvailableAt": source_available,
            "note": "Exact official DLD master_project_en matches to unique Dubai community records; separate area, registration, residential property subtype, monthly/quarterly cohorts; no raw transaction IDs or rows published.",
        }],
        "recordResearch": record_reviews,
        "licensedArchives": [],
        "additionalDatasets": [],
        "sourceCandidates": [],
        "collection": {
            "passId": "pass46-dld-community-master-sales-20261007",
            "inputFiles": {
                "transactionFiles": [
                    {"localFileName": name, "sourceFileName": TRANSACTION_FILES[name]["sourceFileName"], "sha256": hashes[name]}
                    for name in sorted(hashes)
                ],
                "reviewedSnapshot": {"fileName": snapshot_path.name, "version": snapshot["version"], "sha256": sha(snapshot_path.read_bytes())},
            },
            "matchedExactDubaiCommunities": len(records_cells),
            "ambiguousCatalogueCommunityNames": sorted(ambiguous_catalogue),
            "previouslyCoveredCommunitiesSkipped": sorted(already_covered),
            "uniqueSourceTransactionRowsSelected": selected_rows,
            "uniqueTransactionIdsSelected": len(tx_owner),
            "duplicateTransactionIdsDeduplicated": duplicate_ids,
            "malformedDates": malformed_dates,
            "identityQuarantines": dict(quarantines),
            "priceFormulaChecks": formula_checks,
            "priceFormulaDiscrepancies": formula_discrepancies,
            "minimumDisplaySample": 20,
            "aggregateCellsByFrequency": dict(cells),
            "sparseCellsWithheldMedian": sparse_cells,
            "cellsMeetingMinimum": priced_cells,
            "sourceObservationCoverage": {"start": min(observed_days), "end": max(observed_days)},
            "sourcePublicationDate": "unknown; latest-vintage research only, not admissible for earlier backtests",
            "scope": "official DLD master_project_en exact-name community cohorts; area IDs kept separate; no area-name or neighbouring-area inference",
            "rawRowsAndTransactionIdsRedistributed": False,
        },
        "methodology": (
            "The primary source is the official Dubai Land Department transactions open dataset. A DLD master_project_en value is linked only when its normalized exact name matches one unique Dubai catalogue community. "
            "Eligible rows are Sales / Residential / Unit or Villa / Off-Plan or Existing, with positive actual_worth, procedure_area and meter_sale_price; price-per-area is checked against the DLD meter_sale_price field. "
            "The official master label is the geographic scope; each native area_id and area_name_en remains a separate series to avoid merging different cadastral areas. This is not a legal boundary or a claim to every nearby property. "
            "DLD instance_date is the registration date. Monthly and quarterly medians and inclusive P25/P75 are published only for n >= 20; smaller cells preserve counts and date ranges with statistics withheld. Monthly and quarterly samples overlap. "
            "The snapshot was first retrieved on 2026-10-08 and its publication timestamp is unknown, so it is not a point-in-time input to earlier backtests. These rows add verified observations but do not establish complete or earliest-ever community histories, rents, valuations or forecasts. "
            "Only derived aggregates are written; raw transaction rows and transaction IDs remain local."
        ),
    }
    args.out_sidecar.parent.mkdir(parents=True, exist_ok=True)
    args.out_sidecar.write_text(json.dumps(sidecar, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n")
    print(json.dumps({
        "history": str(args.out_history),
        "historySHA256": sha(compressed),
        "historyRows": len(grouped),
        "sidecar": str(args.out_sidecar),
        "sidecarSHA256": sha(args.out_sidecar.read_bytes()),
        "communities": len(records_cells),
        "selectedTransactions": selected_rows,
        "uniqueTransactionIds": len(tx_owner),
        "duplicatesDeduplicated": duplicate_ids,
        "formulaChecks": formula_checks,
        "formulaDiscrepancies": formula_discrepancies,
        "aggregateCellsByFrequency": dict(cells),
        "sparseCells": sparse_cells,
        "priceStatisticCells": priced_cells,
        "dateRange": {"start": min(observed_days), "end": max(observed_days)},
    }, sort_keys=True))


if __name__ == "__main__":
    main()
