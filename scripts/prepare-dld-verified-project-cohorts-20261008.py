#!/usr/bin/env python3
"""Build source-backed DLD sale cohorts for exact-ID uncovered projects.

Raw authority exports remain in ignored .local-data. The output contains only
monthly/quarterly distribution summaries and counts. Existing direct subject
sale series are excluded; candidate names are corroborated against exact DLD
transaction name fields and the official DLD project/developer/area registers.
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
SQM_PER_SQFT = 10.763910416709722
SOURCE_ID = "dld-official-transactions-recapture-20261008"
TX_URL = "https://data.dubai/en/l/470061"
PROJECTS_URL = "https://data.dubai/en/l/467654"
DEVELOPERS_URL = "https://data.dubai/en/l/462802"
AREAS_URL = "https://data.dubai/en/l/465592"
LICENCE = "Dubai Open Data Licence; attribution required, commercial derivatives allowed, original data resale prohibited"
TX_FILES = [
    "transactions_2026-10-07_17-55-58_0001.csv.gz",
    "transactions_2026-10-07_17-55-58_0002.csv.gz",
]
REGISTER_FILES = {
    "projects_2026-07-06_16-25-21_0001.csv.gz": "2026-07-06",
    "developers_2026-10-01_23-34-28_0001.csv.gz": "2026-10-01",
    "lkp_areas_2026-10-02_06-34-03_0001.csv.gz": "2026-10-02",
}
SPECS = [
    ("project:skyvue-solair-sobha-realty-sobha-hartland-2", "Skyvue Solair", "Sobha", 3435, 689316963, 405, 10097270, "building_name", "Skyvue Solair"),
    ("project:the-tranquil-sobha-central-szr-dubai", "The Tranquil at Sobha Central", "Sobha", 4042, 802999842, 445, 10097270, "building_name", "The Tranquil at Sobha Central"),
    ("project:skyvue-spectra-sobha-realty-sobha-hartland-2", "Skyvue Spectra", "Sobha", 3435, 689316963, 405, 10097270, "building_name", "Skyvue Spectra"),
    ("project:skyscape-aura-by-sobha-realty-in-sobha-hartland-2-dubai", "Skyscape Aura", "Sobha", 3160, 628042026, 405, 10097270, "building_name", "Skyscape Aura"),
    ("project:apartments-skyscape-avenue-project-sobha-hartland-dubai", "Skyscape Avenue", "Sobha", 3160, 628042026, 405, 10097270, "building_name", "Skyscape Avenue"),
    ("project:skyscape-altius-by-sobha-realty-in-sobha-hartland-2", "Skyscape Altius", "Sobha", 3160, 628042026, 405, 10097270, "building_name", "Skyscape Altius"),
    ("project:sobha-seahaven-tower-b-apartments-for-sale-in-dubai", "Sobha Seahaven Tower B", "Sobha", 2762, 534689505, 330, 10097270, "building_name", "SOBHA SEAHAVEN - TOWER B"),
    ("project:apartments-skyvue-stellar-sobha-hartland-2", "Skyvue Stellar", "Sobha", 3435, 689316963, 405, 10097270, "building_name", "Skyvue Stellar"),
    ("project:azizi-farishta-al-furjan-apartments-for-sale-in-dubai", "Azizi Farishta", "Azizi", 1810, 35224499, 445, 12595870, "building_name", "AZIZI FARISHTA"),
    ("project:azizi-samia-al-furjan-apartments-for-sale-in-dubai", "Azizi Samia", "Azizi", 1814, 35483874, 445, 12595870, "building_name", "AZIZI SAMIA"),
    ("project:samana-greens-apartments-for-sale-in-arjan-dubai", "Samana Greens", "Samana", 2032, 165012706, 409, 164137069, "building_name", "SAMANA GREENS"),
]
HISTORY_FIELDS = [
    "Series ID", "Emirate", "Geography", "Scope", "Segment", "Registration", "Period", "Frequency",
    "Metric", "Value", "Unit", "Sample rows", "P25", "P75", "Eligible value AED", "Quality",
    "Class", "Source ID", "Source URL", "Raw source emirate", "Gross yield pct", "Blocked rows",
    "Published date", "Observation basis", "Source area ID", "Native row JSON", "Endpoint",
]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def norm(value):
    return " ".join(re.findall(r"[\w]+", unicodedata.normalize("NFKC", str(value or "")).casefold(), flags=re.UNICODE))


def int_value(value):
    return int(float(str(value).strip()))


def number(value):
    result = float(value)
    if not math.isfinite(result):
        raise ValueError("non-finite numeric field")
    return result


def quantile(values, probability):
    values = sorted(values)
    if len(values) == 1:
        return values[0]
    index = (len(values) - 1) * probability
    lo, hi = math.floor(index), math.ceil(index)
    return values[lo] + (values[hi] - values[lo]) * (index - lo)


def period_for(day, frequency):
    return day.strftime("%Y-%m") if frequency == "month" else f"{day.year}-Q{(day.month - 1) // 3 + 1}"


def clean(value):
    return "" if value is None else f"{value:.4f}"


def read_csv(path):
    # The download API returned HTTP Content-Encoding:gzip and requests decoded
    # it; the saved capture named *.csv.gz is therefore plain UTF-8 CSV.
    with path.open(encoding="utf-8-sig", newline="") as stream:
        yield from csv.DictReader(stream)


def has_direct_dld_sale(record):
    return any(
        item.get("scope") == "subject" and item.get("identityVerified") is True and item.get("metric") == "price"
        and (str(item.get("sourceId") or "").startswith("dld-official-transactions")
             or item.get("sourceId") == "dred-sale-snapshot-20260919")
        for item in record.get("historySeries", [])
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, default=ROOT / ".local-data/dld-open-20261008")
    parser.add_argument("--candidate-file", type=Path, default=BASE / "inputs/projectCandidates-db54d6086200ae820a502d97aef96e93c51ba7b531e9468370f8e38335bacccc.gz")
    parser.add_argument("--records", type=Path, default=ROOT / "data/historical-intelligence-20261003.json")
    parser.add_argument("--out-history", type=Path, default=BASE / "dld-verified-project-sales-20261008.csv.gz")
    parser.add_argument("--out-sidecar", type=Path, default=BASE / "dld-verified-project-sales-enrichment-20261008.json")
    args = parser.parse_args()

    capture_path = args.source_dir / "capture-manifest.json"
    capture_bytes = capture_path.read_bytes()
    capture = json.loads(capture_bytes)
    if capture.get("retrievedAt") != "2026-10-08T14:13:10Z":
        raise ValueError("Unexpected DLD capture manifest or retrieval timestamp")
    by_file = {item["name"]: item for item in capture["files"]}
    required_files = list(REGISTER_FILES) + TX_FILES
    local_files = {}
    for name in required_files:
        path = args.source_dir / name
        blob = path.read_bytes()
        meta = by_file.get(name)
        if not meta or len(blob) != meta["bytes"] or sha(blob) != meta["sha256"]:
            raise ValueError("DLD capture checksum mismatch: " + name)
        local_files[name] = {"path": path, "meta": meta}

    baseline = json.loads(args.records.read_text())
    if baseline.get("version") != "20261008-enrichment-v28":
        raise ValueError("This reviewed increment expects the V28 catalogue snapshot")
    records = {row["id"]: row for row in baseline["records"]}

    projects = defaultdict(list)
    for row in read_csv(local_files[required_files[0]]["path"]):
        projects[int_value(row["project_number"])].append(row)
    developers = defaultdict(list)
    for row in read_csv(local_files[required_files[1]]["path"]):
        developers[int_value(row["developer_id"])].append(row)
    areas = defaultdict(list)
    for row in read_csv(local_files[required_files[2]]["path"]):
        areas[int_value(row["area_id"])].append(row)

    with gzip.open(args.candidate_file, "rt", encoding="utf-8-sig", newline="") as stream:
        candidate_rows = list(csv.DictReader(stream))
    candidates_by_record = defaultdict(list)
    for row in candidate_rows:
        record_id = row.get("Record ID") or row.get("\ufeffRecord ID")
        candidates_by_record[record_id].append(row)

    specs = {}
    lookup = defaultdict(list)
    for record_id, title, developer_token, project_number, project_id, area_id, developer_id, source_field, source_name in SPECS:
        if record_id not in records:
            raise ValueError("Catalogue record missing: " + record_id)
        record = records[record_id]
        if record.get("type") != "project" or record.get("name") != title:
            raise ValueError("Catalogue name/type conflict: " + record_id)
        if has_direct_dld_sale(record):
            raise ValueError("Refusing to duplicate existing direct DLD sale history: " + record_id)
        project_matches = projects[project_number]
        developer_matches = developers[developer_id]
        area_matches = areas[area_id]
        if len(project_matches) != 1 or len(developer_matches) != 1 or len(area_matches) != 1:
            raise ValueError("DLD register key is missing or non-unique: " + record_id)
        project = project_matches[0]
        developer = developer_matches[0]
        area = area_matches[0]
        if int_value(project["project_id"]) != project_id or int_value(project["area_id"]) != area_id or int_value(project["developer_id"]) != developer_id:
            raise ValueError("DLD project/project_id/area/developer crosswalk conflict: " + record_id)
        if not norm(developer_token) in norm(developer.get("developer_name_en", "")):
            raise ValueError("DLD legal developer name does not corroborate catalogue brand: " + record_id)
        alias_rows = [row for row in candidates_by_record[record_id]
                      if row.get("Source field") == source_field
                      and norm(row.get("Registered source name")) == norm(source_name)
                      and int_value(row.get("Source area ID", "-1")) == area_id]
        if not alias_rows or any(int_value(row.get("Catalogue same-name records", "0")) != 1 for row in alias_rows):
            raise ValueError("No unique retained transaction-name candidate alias: " + record_id)
        identity = {
            "record": record,
            "projectNumber": project_number,
            "projectId": project_id,
            "areaId": area_id,
            "areaName": area.get("name_en", ""),
            "developerId": developer_id,
            "developerNameEn": developer.get("developer_name_en", ""),
            "sourceField": source_field,
            "sourceName": source_name,
            "aliasRows": len(alias_rows),
            "rows": {},
            "aliasPairs": set(),
        }
        shared_parent_note = ""
        if sum(1 for spec in SPECS if spec[3] == project_number) > 1:
            shared_parent_note = " This DLD project number is shared by separately named buildings; exact building_name_en matches and transaction-ID uniqueness keep the building cohorts separate."
        identity["identityBasis"] = (
            f"Exact official DLD {source_field} field {source_name!r} matches the catalogue project/phase. "
            f"Its DLD project_number {project_number} maps to unique registered project_id {project_id}; the official project register agrees on area_id {area_id} ({identity['areaName']}) and developer_id {developer_id}. "
            f"The official developer register names {identity['developerNameEn']!r}, corroborating the catalogue developer brand. Every retained transaction repeats the registered project number and area; no name-only fan-out is allowed.{shared_parent_note}"
        )
        specs[record_id] = identity
        for row in alias_rows:
            lookup[(source_field, norm(source_name), area_id)].append((record_id, identity, row))

    missing_transaction_ids = 0
    duplicate_ids = Counter()
    duplicate_conflicts = set()
    global_rows = {}
    cross_record_ids = set()
    matched_record_ids_by_transaction = defaultdict(set)
    source_rows_scanned = 0
    filtered_rows = Counter()
    for filename in TX_FILES:
        with local_files[filename]["path"].open(encoding="utf-8-sig", newline="") as stream:
            reader = csv.DictReader(stream)
            for raw in reader:
                source_rows_scanned += 1
                if raw.get("trans_group_en") != "Sales" or raw.get("property_usage_en") != "Residential":
                    continue
                if raw.get("property_type_en") not in {"Unit", "Villa"}:
                    filtered_rows["not_unit_or_villa"] += 1
                    continue
                if raw.get("reg_type_en") not in {"Off-Plan Properties", "Existing Properties"}:
                    filtered_rows["unsupported_registration"] += 1
                    continue
                try:
                    area_id = int_value(raw.get("area_id", ""))
                    project_number = int_value(raw.get("project_number", ""))
                except (TypeError, ValueError):
                    continue
                hits = []
                for field, source_name in (("project_name", raw.get("project_name_en")), ("building_name", raw.get("building_name_en"))):
                    hits.extend(lookup.get((field, norm(source_name), area_id), []))
                if not hits:
                    continue
                row = {
                    "transactionId": str(raw.get("transaction_id") or "").strip(),
                    "projectNumber": project_number,
                    "areaId": area_id,
                    "projectNameEn": " ".join((raw.get("project_name_en") or "").split()),
                    "buildingNameEn": " ".join((raw.get("building_name_en") or "").split()),
                    "day": (raw.get("instance_date") or "")[:10],
                    "registration": raw.get("reg_type_en"),
                    "propertyType": raw.get("property_type_en"),
                    "propertySubtype": " ".join((raw.get("property_sub_type_en") or "Unknown").split()) or "Unknown",
                    "actualWorth": raw.get("actual_worth"),
                    "procedureArea": raw.get("procedure_area"),
                    "meterSalePrice": raw.get("meter_sale_price"),
                }
                if not row["transactionId"]:
                    missing_transaction_ids += 1
                    continue
                tid = row["transactionId"]
                normalized = json.dumps(row, sort_keys=True, separators=(",", ":"))
                if tid in global_rows:
                    duplicate_ids["duplicateRows"] += 1
                    if global_rows[tid]["normalized"] != normalized:
                        duplicate_conflicts.add(tid)
                    else:
                        continue
                else:
                    global_rows[tid] = {"row": row, "normalized": normalized}
                for record_id, identity, _candidate in hits:
                    identity["aliasPairs"].add((project_number, area_id))
                    matched_record_ids_by_transaction[tid].add(record_id)
                    identity["rows"].setdefault(tid, row)

    for tid, record_ids in matched_record_ids_by_transaction.items():
        if len(record_ids) > 1:
            cross_record_ids.add(tid)

    alias_quarantines = Counter()
    eligible_rows = defaultdict(list)
    transaction_quarantines = Counter()
    formula_checks = 0
    for record_id, identity in specs.items():
        if identity["aliasPairs"] != {(identity["projectNumber"], identity["areaId"])}:
            alias_quarantines["candidate_alias_does_not_resolve_only_to_registered_project_and_area"] += 1
    for tid, record_ids in matched_record_ids_by_transaction.items():
        if tid in cross_record_ids:
            transaction_quarantines["transaction_matched_to_multiple_catalogue_records"] += 1
            continue
        record_id = next(iter(record_ids))
        identity = specs[record_id]
        row = identity["rows"][tid]
        if (row["projectNumber"], row["areaId"]) != (identity["projectNumber"], identity["areaId"]):
            transaction_quarantines["transaction_register_key_conflict"] += 1
            continue
        if tid in duplicate_conflicts:
            transaction_quarantines["conflicting_duplicate_transaction_id"] += 1
            continue
        try:
            observed_day = date.fromisoformat(row["day"])
        except ValueError:
            transaction_quarantines["unparseable_registration_date"] += 1
            continue
        if observed_day.year < 1900 or observed_day > CUTOFF:
            transaction_quarantines["registration_date_outside_snapshot_cutoff"] += 1
            continue
        try:
            actual = number(row["actualWorth"])
            area = number(row["procedureArea"])
            meter = number(row["meterSalePrice"])
        except (ValueError, TypeError):
            transaction_quarantines["invalid_price_or_area"] += 1
            continue
        if actual <= 0 or area <= 0 or meter <= 0:
            transaction_quarantines["nonpositive_price_or_area"] += 1
            continue
        formula_checks += 1
        if abs(actual / area - meter) > max(0.03, meter * 0.001):
            transaction_quarantines["meter_price_formula_discrepancy"] += 1
            continue
        row["day"] = observed_day.isoformat()
        row["saleAED"] = actual
        row["saleAEDSqft"] = actual / area / SQM_PER_SQFT
        eligible_rows[record_id].append(row)

    no_sale_projects = [record_id for record_id in specs if not eligible_rows[record_id]]
    if no_sale_projects:
        raise ValueError("Exact DLD identity produced no eligible sale rows: " + ", ".join(no_sale_projects))
    if alias_quarantines:
        raise ValueError("Verified candidate aliases conflict with official registers: " + json.dumps(dict(alias_quarantines), sort_keys=True))

    capture_at = capture["retrievedAt"]
    aggregates = defaultdict(list)
    dates_by_record = defaultdict(list)
    for record_id, rows in eligible_rows.items():
        for row in rows:
            day = date.fromisoformat(row["day"])
            dates_by_record[record_id].append(day)
            for frequency in ("month", "quarter"):
                aggregates[(record_id, frequency, row["registration"], row["propertyType"], row["propertySubtype"], period_for(day, frequency))].append(row)

    source = {
        "id": SOURCE_ID,
        "revisionOfSourceId": "dld-official-transactions-20261007",
        "preserveRevision": True,
        "url": TX_URL,
        "publisher": "Dubai Land Department via Dubai Data and Statistics Establishment",
        "title": "DLD transactions, official Data Dubai recapture retrieved 8 October 2026",
        "classification": "official_latest_vintage_open_data_snapshot",
        "sourceSnapshotDate": "2026-10-07",
        "publicationDateStatus": "unknown; portal publication timestamp not independently established",
        "publishedAt": None,
        "firstAvailableAt": capture_at,
        "retrievedAt": capture_at,
        "datePrecision": "minute",
        "availabilityBasis": "retrieval timestamp from the preserved official export manifest; earlier availability is not inferred",
        "licence": LICENCE,
        "licenceURL": "https://data.dubai/en/terms-conditions",
        "snapshotFiles": [{"fileName": name, "bytes": by_file[name]["bytes"], "sha256": by_file[name]["sha256"], "representation": "CSV payload after HTTP Content-Encoding:gzip decoding"} for name in TX_FILES],
        "observationCoverage": {
            "start": min(day.isoformat() for days in dates_by_record.values() for day in days),
            "end": max(day.isoformat() for days in dates_by_record.values() for day in days),
            "basis": "selected exact-ID residential sales by DLD registration date; not first-ever sales or complete lifetime coverage",
        },
        "rawTransactionRowsRedistributed": False,
        "rawTransactionIdsRedistributed": False,
        "note": "Derived monthly and quarterly sale summaries for 11 exact-ID catalogue projects. Raw source records and transaction IDs remain local; sample counts remain visible when price statistics are withheld below n=20.",
    }
    source_ids = [SOURCE_ID, "dld-official-projects-20260706", "dld-official-developers-20261001", "dld-official-areas-20261002"]
    prior_sources = {item["id"] for item in json.loads((BASE / "scrape-enrichment.json").read_text())["sources"]}
    if any(source_id not in prior_sources for source_id in source_ids[1:]):
        raise ValueError("Required DLD identity register sources are absent from the retained source register")

    observation_basis = (
        "DLD instance_date is the registration date, not contract execution or transfer date. Latest-vintage official export; "
        "publication time is unknown and the capture is unavailable to earlier backtests. These observations are partial subject evidence, "
        "not continuous or complete lifetime history."
    )
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=HISTORY_FIELDS, lineterminator="\n")
    writer.writeheader()
    links = []
    link_ids = set()
    record_reviews = []
    sparse_cells = eligible_cells = 0
    cells_by_frequency_metric = Counter()
    per_record_cells = Counter()
    per_record_series = Counter()
    for (record_id, frequency, registration, property_type, subtype, period), rows in sorted(aggregates.items()):
        identity = specs[record_id]
        n = len(rows)
        reg_slug = "offplan" if registration == "Off-Plan Properties" else "existing"
        type_slug = re.sub(r"[^a-z0-9]+", "-", (property_type + "-" + subtype).casefold()).strip("-")
        record_slug = re.sub(r"[^a-z0-9]+", "-", record_id.split(":", 1)[1].casefold()).strip("-")
        dates = [row["day"] for row in rows]
        first_day, last_day = min(dates), max(dates)
        for metric, unit, value_field in [
            ("median_sale_aed_sqft", "AED/sqft", "saleAEDSqft"),
            ("median_sale_aed", "AED/transaction", "saleAED"),
        ]:
            series_id = f"dld-20261008-{record_slug}-{frequency}-{reg_slug}-{type_slug}-{metric.removeprefix('median_sale_')}"
            values = [row[value_field] for row in rows]
            stat = statistics.median(values) if n >= 20 else None
            p25 = quantile(values, .25) if n >= 20 else None
            p75 = quantile(values, .75) if n >= 20 else None
            native = {
                "aggregation": "median and inclusive linear-interpolation quartiles of actual_worth; AED/sqft uses actual_worth / procedure_area / 10.763910416709722",
                "sampleCount": n,
                "minimumDisplaySample": 20,
                "statisticPublished": n >= 20,
                "sparseMedianPolicy": "withheld; eligible unique transaction count retained",
                "firstRegistrationDate": first_day,
                "lastRegistrationDate": last_day,
                "registrationDateBasis": "DLD instance_date",
                "propertyType": property_type,
                "propertySubtype": subtype,
                "registration": registration,
                "projectNumber": identity["projectNumber"],
                "registeredProjectId": identity["projectId"],
                "registeredDeveloperId": identity["developerId"],
                "registeredDeveloperNameEn": identity["developerNameEn"],
                "areaId": identity["areaId"],
                "areaName": identity["areaName"],
                "snapshotDate": "2026-10-07",
                "observationCutoff": CUTOFF.isoformat(),
                "sourceFirstAvailableAt": capture_at,
                "backtestUse": "not admissible before first source retrieval",
                "metric": metric,
            }
            writer.writerow({
                "Series ID": series_id, "Emirate": "Dubai", "Geography": identity["record"]["name"], "Scope": "subject",
                "Segment": f"{property_type} / {subtype}", "Registration": registration, "Period": period,
                "Frequency": frequency, "Metric": metric, "Value": clean(stat), "Unit": unit, "Sample rows": n,
                "P25": clean(p25), "P75": clean(p75), "Eligible value AED": clean(sum(row["saleAED"] for row in rows)),
                "Quality": "eligible registered residential sales; n>=20" if n >= 20 else f"sparse registered sales; n={n}; median withheld below 20",
                "Class": "official DLD derived primary project cohort snapshot", "Source ID": SOURCE_ID,
                "Source URL": TX_URL, "Raw source emirate": "Dubai", "Gross yield pct": "", "Blocked rows": 0,
                "Published date": "", "Observation basis": observation_basis, "Source area ID": identity["areaId"],
                "Native row JSON": json.dumps(native, ensure_ascii=False, separators=(",", ":"), sort_keys=True), "Endpoint": TX_URL,
            })
            if series_id not in link_ids:
                links.append({"seriesId": series_id, "recordId": record_id, "scope": "subject", "identityVerified": True,
                              "identityBasis": identity["identityBasis"], "identitySourceIds": source_ids})
                link_ids.add(series_id)
                per_record_series[record_id] += 1
            sparse_cells += n < 20
            eligible_cells += n >= 20
            cells_by_frequency_metric[(frequency, metric)] += 1
            per_record_cells[(record_id, n >= 20)] += 1

    history_csv = output.getvalue().encode("utf-8")
    history_gzip = gzip.compress(history_csv, mtime=0)
    args.out_history.parent.mkdir(parents=True, exist_ok=True)
    args.out_history.write_bytes(history_gzip)

    for record_id, identity in sorted(specs.items()):
        days = [row["day"] for row in eligible_rows[record_id]]
        transaction_count = len(eligible_rows[record_id])
        record_reviews.append({
            "recordId": record_id,
            "asOf": AS_OF,
            "status": "Exact DLD registered residential sale cohorts added; evidence is partial and not a complete or lifetime history.",
            "sourceIds": source_ids,
            "acceptedTransactionObservationCount": 0,
            "collectionPasses": [{
                "passId": "dld-verified-project-sales-20261008",
                "reviewedAt": AS_OF,
                "registeredProjectNumber": identity["projectNumber"],
                "registeredProjectId": identity["projectId"],
                "registeredDeveloperId": identity["developerId"],
                "registeredDeveloperNameEn": identity["developerNameEn"],
                "areaId": identity["areaId"],
                "areaName": identity["areaName"],
                "sourceField": identity["sourceField"],
                "sourceName": identity["sourceName"],
                "verifiedCandidateAliasCount": identity["aliasRows"],
                "eligibleUniqueTransactionRows": transaction_count,
                "monthlyQuarterlySeriesCount": per_record_series[record_id],
                "monthlyQuarterlyAggregateCells": sum(value for (rid, _met), value in per_record_cells.items() if rid == record_id) // 2,
                "cellsMeetingMinimum": per_record_cells[(record_id, True)],
                "sparseCellsWithMedianWithheld": per_record_cells[(record_id, False)],
                "earliestObservedRegistrationDateInCapture": min(days),
                "latestObservedRegistrationDateInCapture": max(days),
                "sourcePublicationDate": "unknown",
                "rawRowsOrTransactionIdsRedistributed": False,
                "fullHistoryClaim": False,
            }],
            "identityReview": {
                "status": "verified_exact_name_developer_and_area",
                "identityBasis": identity["identityBasis"],
                "identitySourceIds": source_ids,
                "registeredProjectId": identity["projectId"],
                "resolvedCandidateCount": identity["aliasRows"],
                "remainingCandidateCount": max(0, len(candidates_by_record[record_id]) - identity["aliasRows"]),
            },
        })

    candidate_bytes = gzip.decompress(args.candidate_file.read_bytes())
    capture_file = {"fileName": capture_path.name, "sha256": sha(capture_bytes), "retrievedAt": capture_at}
    input_files = {
        "captureManifest": capture_file,
        "transactionFiles": [{"fileName": name, "bytes": by_file[name]["bytes"], "sha256": by_file[name]["sha256"], "representation": "HTTP Content-Encoding:gzip decoded CSV"} for name in TX_FILES],
        "projectRegisterFile": {"fileName": required_files[0], "bytes": by_file[required_files[0]]["bytes"], "sha256": by_file[required_files[0]]["sha256"], "snapshotDate": REGISTER_FILES[required_files[0]]},
        "developerRegisterFile": {"fileName": required_files[1], "bytes": by_file[required_files[1]]["bytes"], "sha256": by_file[required_files[1]]["sha256"], "snapshotDate": REGISTER_FILES[required_files[1]]},
        "areaRegisterFile": {"fileName": required_files[2], "bytes": by_file[required_files[2]]["bytes"], "sha256": by_file[required_files[2]]["sha256"], "snapshotDate": REGISTER_FILES[required_files[2]]},
        "candidateDiscoveryInput": {"path": str(args.candidate_file.relative_to(ROOT)), "sha256": sha(candidate_bytes), "usedFor": "exact-name discovery only; no third-party numeric values enter this pass"},
    }
    candidate_ids = {row.get("Record ID") or row.get("\ufeffRecord ID") for row in candidate_rows}
    candidate_zero_sales = {record_id for record_id in candidate_ids if record_id in records and int(records[record_id].get("coverageSummary", {}).get("directSaleTransactionCount", 0) or 0) == 0}
    existing_direct_candidates = {record_id for record_id in candidate_zero_sales if has_direct_dld_sale(records[record_id])}
    unresolved_candidate_count = len(candidate_zero_sales - existing_direct_candidates - set(specs))
    sidecar = {
        "schemaVersion": 1,
        "passId": "dld-verified-project-sales-20261008",
        "asOf": AS_OF,
        "sources": [source],
        "facts": [],
        "seriesLinks": links,
        "historyInputs": [{
            "id": "dld-verified-project-cohort-history-20261008", "path": args.out_history.name,
            "sha256": sha(history_gzip), "uncompressedSHA256": sha(history_csv), "compression": "gzip",
            "rowCount": sum(1 for _ in history_csv.decode("utf-8").splitlines()) - 1,
            "sourceId": SOURCE_ID, "firstAvailableAt": capture_at,
            "note": "Monthly and quarterly median AED/transaction and AED/sqft sale summaries by exact project, registration, property type and subtype; sparse cells retain sample counts with statistics withheld below n=20. No transaction IDs or individual prices are published.",
        }],
        "recordResearch": record_reviews,
        "licensedArchives": [], "additionalDatasets": [], "sourceCandidates": [],
        "collection": {
            "inputFiles": input_files,
            "candidateRecordsWithNoExistingDirectSaleCount": len(candidate_zero_sales),
            "candidatesAlreadyWithDirectDldSeriesDespiteZeroSummaryCount": len(existing_direct_candidates),
            "newExactIdentityRecords": len(specs),
            "candidateRecordsStillUnresolvedAfterPass": unresolved_candidate_count,
            "sourceRowsScanned": source_rows_scanned,
            "eligibleUniqueTransactionRowsSelected": sum(len(rows) for rows in eligible_rows.values()),
            "uniqueTransactionIdsSelected": sum(len(rows) for rows in eligible_rows.values()),
            "duplicateTransactionRows": dict(duplicate_ids),
            "conflictingDuplicateTransactionIds": len(duplicate_conflicts),
            "crossRecordTransactionIdsQuarantined": len(cross_record_ids),
            "missingTransactionIdsQuarantined": missing_transaction_ids,
            "aliasIdentityQuarantines": dict(alias_quarantines),
            "transactionQuarantines": dict(transaction_quarantines),
            "sourceRowFilters": dict(filtered_rows),
            "priceFormulaChecks": formula_checks,
            "priceFormulaDiscrepancies": transaction_quarantines.get("meter_price_formula_discrepancy", 0),
            "minimumDisplaySample": 20,
            "aggregateCellsByFrequencyAndMetric": {f"{frequency}:{metric}": count for (frequency, metric), count in cells_by_frequency_metric.items()},
            "sparseCellsWithheldMedian": sparse_cells,
            "cellsMeetingMinimum": eligible_cells,
            "distinctCatalogueProjects": len(specs),
            "distinctRegisteredProjectNumbers": len({identity["projectNumber"] for identity in specs.values()}),
            "rawRowsAndTransactionIdsRedistributed": False,
            "sourceObservationCoverage": {"start": min(row["day"] for rows in eligible_rows.values() for row in rows), "end": max(row["day"] for rows in eligible_rows.values() for row in rows)},
            "sourcePublicationDate": "unknown; capture first retrieved at the recorded timestamp",
            "completenessClaim": False,
        },
        "methodology": (
            "The third-party candidate list supplies only discovery names. Each exact alias is matched to an official DLD project_name_en or building_name_en plus area_id, then validated against the unique DLD project_number/project_id, area register and developer register. "
            "The official project row is the registered parent project; where multiple named towers share its project number, building_name_en is the exact sub-project discriminator, and transaction IDs are checked across records to prevent fan-out. Existing direct DLD-backed subject series are excluded. "
            "Only Sales / Residential / Unit or Villa / Off-Plan Properties or Existing Properties with a unique transaction_id, positive actual_worth, procedure_area and meter_sale_price, and instance_date through 2026-10-06 are eligible. DLD instance_date is registration date, not contract execution or transfer date. "
            "AED/sqft is actual_worth / procedure_area / 10.763910416709722; meter_sale_price is checked within 0.1% or AED 0.03/sqm. Monthly and quarterly cohorts split by registration, property type and subtype. Median and inclusive P25/P75 are published only for n>=20; sparse counts remain with price statistics withheld. "
            "Monthly and quarterly data overlap. Only derived summaries are published; no raw rows, transaction IDs or individual prices are redistributed. This latest-vintage source is unavailable to earlier backtests and provides partial observed periods, not first-ever transactions or complete lifetime price history."
        ),
    }
    args.out_sidecar.write_text(json.dumps(sidecar, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n")
    print(json.dumps({
        "history": str(args.out_history), "historySha256": sha(history_gzip), "aggregateRows": sidecar["historyInputs"][0]["rowCount"],
        "sidecar": str(args.out_sidecar), "sidecarSha256": sha(args.out_sidecar.read_bytes()), "newIdentityRecords": len(specs),
        "uniqueTransactionRows": sidecar["collection"]["uniqueTransactionIdsSelected"], "seriesLinks": len(links),
        "cellsByFrequencyAndMetric": sidecar["collection"]["aggregateCellsByFrequencyAndMetric"],
        "sparseCells": sparse_cells, "cellsMeetingMinimum": eligible_cells, "formulaChecks": formula_checks,
        "duplicateRows": dict(duplicate_ids), "crossRecordIds": len(cross_record_ids),
        "quarantines": {"aliases": dict(alias_quarantines), "transactions": dict(transaction_quarantines)},
        "projects": [{"recordId": rid, "name": identity["record"]["name"], "projectNumber": identity["projectNumber"], "projectId": identity["projectId"], "firstObserved": min(row["day"] for row in eligible_rows[rid]), "lastObserved": max(row["day"] for row in eligible_rows[rid]), "transactions": len(eligible_rows[rid])} for rid, identity in sorted(specs.items())],
    }, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
