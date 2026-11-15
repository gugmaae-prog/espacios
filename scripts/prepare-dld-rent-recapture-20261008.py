#!/usr/bin/env python3
"""Build privacy-safe exact-project rent aggregates from the public DLD export.

Raw Ejari files remain in ignored .local-data. This builder exports only
project-period aggregates and never writes contract IDs or tenant data.
"""
from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
import re
import sqlite3
import statistics
import unicodedata
from collections import defaultdict
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / "data/historical-intelligence-20261003.json"
OUTPUT = ROOT / "data/historical-intelligence/dld-rent-recapture-20261008.json.gz"
SOURCE_URL = "https://data.dubai/en/l/468586"
TERMS_URL = "https://data.dubai/en/terms-conditions"
BUILDINGS_SOURCE_ID = "dld-official-buildings-20261007"
RENTS_SOURCE_ID = "dld-official-rents-recapture-20261008"
SOURCE_DATE = "2026-10-07"
RETRIEVED_AT = "2026-10-08T15:53:50Z"
MIN_SAMPLE = 20


def sha256(blob: bytes) -> str:
    return hashlib.sha256(blob).hexdigest()


def norm(value: object) -> str:
    value = unicodedata.normalize("NFKC", str(value or "")).casefold()
    return " ".join(re.sub(r"[^\w]+", " ", value).split())


def percentile(values: list[float], p: float) -> float:
    ordered = sorted(values)
    index = (len(ordered) - 1) * p
    lower, upper = int(index), min(int(index) + 1, len(ordered) - 1)
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (index - lower)


def period_start(value: str, frequency: str) -> str:
    if frequency == "monthly":
        return value[:7]
    year, month = int(value[:4]), int(value[5:7])
    return f"{year}Q{(month - 1) // 3 + 1}"


def verified_projects(snapshot: dict) -> dict[str, str]:
    by_project_id: dict[str, set[str]] = defaultdict(set)
    for record in snapshot["records"]:
        if record.get("type") != "project":
            continue
        for evidence in record.get("registerEvidence", []):
            if (evidence.get("identityVerified") is True
                    and evidence.get("scope") == "subject"
                    and "dld-official-projects-20260706" in evidence.get("sourceIds", [])):
                project_id = str((evidence.get("fields") or {}).get("projectId") or "")
                if project_id:
                    by_project_id[project_id].add(record["id"])
    # A shared parent project is not fanned out to multiple catalogue records.
    return {project_id: next(iter(record_ids))
            for project_id, record_ids in by_project_id.items() if len(record_ids) == 1}


def load_building_keys(path: Path, allowed_project_ids: set[str]) -> tuple[dict, int, str]:
    raw = path.read_bytes()
    digest = sha256(raw)
    candidates: dict[tuple[str, str], set[str]] = defaultdict(set)
    row_count = 0
    opener = gzip.open if raw[:2] == b"\x1f\x8b" else open
    with opener(path, "rt", encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            row_count += 1
            project_id = str(row.get("project_id") or "")
            if project_id in allowed_project_ids:
                key = (norm(row.get("project_name_en")), str(row.get("area_id") or ""))
                if key[0] and key[1]:
                    candidates[key].add(project_id)
    # Exact English building name + DLD area may resolve only one verified ID.
    return ({key: next(iter(ids)) for key, ids in candidates.items() if len(ids) == 1}, row_count, digest)


def capture_files(input_dir: Path) -> tuple[list[dict], str]:
    files = sorted(input_dir.glob("rent_contracts_2026-10-07_18-06-59_*.csv.gz"))
    if len(files) != 11:
        raise ValueError(f"Expected all 11 official DLD rent files, found {len(files)}")
    output = []
    total_bytes = 0
    for path in files:
        raw = path.read_bytes()
        total_bytes += len(raw)
        # Validate the gzip member before allowing it into the aggregation.
        with gzip.open(path, "rb") as stream:
            stream.read(1)
        output.append({"fileName": path.name, "bytes": len(raw), "sha256": sha256(raw)})
    return output, str(total_bytes)


def build(input_dir: Path, buildings_file: Path, output: Path = OUTPUT) -> dict:
    snapshot = json.loads(SNAPSHOT.read_text())
    project_to_record = verified_projects(snapshot)
    building_keys, building_rows, buildings_sha = load_building_keys(buildings_file, set(project_to_record))
    source_files, total_compressed_bytes = capture_files(input_dir)

    db_path = input_dir / "ejari-project-aggregate-scratch.sqlite"
    if db_path.exists():
        db_path.unlink()
    con = sqlite3.connect(db_path)
    con.execute("PRAGMA journal_mode=OFF")
    con.execute("PRAGMA synchronous=OFF")
    con.execute("CREATE TABLE c (contract_id TEXT PRIMARY KEY, record_id TEXT, project_id TEXT, "
                 "start TEXT, amount REAL, area REAL, usage TEXT, bus TEXT, ptype TEXT, subtype TEXT, "
                 "registration TEXT, duplicate INTEGER NOT NULL DEFAULT 0)")
    totals = {"sourceRows": 0, "exactBuildingRows": 0, "eligibleRowsBeforeDedup": 0,
              "qualityRejectedRows": 0, "unmatchedOrAmbiguousRows": 0}

    rent_files = sorted(input_dir.glob("rent_contracts_2026-10-07_18-06-59_*.csv.gz"))
    for path in rent_files:
        batch = []
        with gzip.open(path, "rt", encoding="utf-8-sig", newline="") as stream:
            for row in csv.DictReader(stream):
                totals["sourceRows"] += 1
                key = (norm(row.get("project_name_en")), str(row.get("area_id") or ""))
                project_id = building_keys.get(key)
                if not project_id:
                    totals["unmatchedOrAmbiguousRows"] += 1
                    continue
                record_id = project_to_record[project_id]
                totals["exactBuildingRows"] += 1
                contract_id = str(row.get("contract_id") or "").strip()
                start = str(row.get("contract_start_date") or "")[:10]
                try:
                    amount = float(row.get("annual_amount") or "")
                    area = float(row.get("actual_area") or "")
                    property_count = int(float(row.get("no_of_prop") or ""))
                except (ValueError, TypeError):
                    totals["qualityRejectedRows"] += 1
                    continue
                try:
                    parsed = datetime.strptime(start, "%Y-%m-%d")
                except ValueError:
                    totals["qualityRejectedRows"] += 1
                    continue
                if (not contract_id or parsed.strftime("%Y-%m-%d") != start
                        or start > SOURCE_DATE or amount <= 0 or area <= 0 or property_count != 1):
                    totals["qualityRejectedRows"] += 1
                    continue
                registration = str(row.get("contract_reg_type_en") or "").strip()
                usage = str(row.get("property_usage_en") or "").strip()
                business_type = str(row.get("ejari_bus_property_type_en") or "").strip()
                property_type = str(row.get("ejari_property_type_en") or "").strip()
                subtype = str(row.get("ejari_property_sub_type_en") or "").strip()
                if not (registration and usage and business_type and property_type):
                    totals["qualityRejectedRows"] += 1
                    continue
                batch.append((contract_id, record_id, project_id, start, amount, area,
                              usage, business_type, property_type, subtype, registration))
                totals["eligibleRowsBeforeDedup"] += 1
                if len(batch) >= 5000:
                    _insert_batch(con, batch)
                    batch.clear()
        if batch:
            _insert_batch(con, batch)
        con.commit()

    duplicate_contracts = con.execute("SELECT COUNT(*) FROM c WHERE duplicate=1").fetchone()[0]
    groups: dict[tuple, list[float]] = defaultdict(list)
    project_ids: dict[str, str] = {}
    eligible_contracts = 0
    records_with_contracts: set[str] = set()
    latest_window_rows = 0
    latest_window_records: set[str] = set()
    min_start, max_start = None, None
    for row in con.execute("SELECT record_id,project_id,start,amount,usage,bus,ptype,subtype,registration "
                           "FROM c WHERE duplicate=0 ORDER BY record_id,start"):
        record_id, project_id, start, amount, usage, business_type, property_type, subtype, registration = row
        eligible_contracts += 1
        records_with_contracts.add(record_id)
        project_ids[record_id] = project_id
        min_start = start if min_start is None else min(min_start, start)
        max_start = start if max_start is None else max(max_start, start)
        if start > "2026-10-03":
            latest_window_rows += 1
            latest_window_records.add(record_id)
        segment = f"{usage} | {business_type} / {property_type}"
        segments = [segment]
        if subtype:
            segments.append(f"{segment} | native subtype: {subtype}")
        for series_segment in segments:
            groups[(record_id, project_id, series_segment, registration, "monthly", start[:7])].append(amount)
            groups[(record_id, project_id, series_segment, registration, "quarterly", period_start(start, "quarterly"))].append(amount)

    observations = []
    grouped_series: dict[tuple, list[dict]] = defaultdict(list)
    for (record_id, project_id, segment, registration, frequency, period), amounts in sorted(groups.items()):
        amounts.sort()
        count = len(amounts)
        sufficiently_sampled = count >= MIN_SAMPLE
        row = {
            "recordId": record_id,
            "registeredProjectId": project_id,
            "segment": segment,
            "registration": registration,
            "frequency": frequency,
            "period": period,
            "sampleCount": count,
            "medianAEDYear": statistics.median(amounts) if sufficiently_sampled else None,
            "p25AEDYear": percentile(amounts, .25) if sufficiently_sampled else None,
            "p75AEDYear": percentile(amounts, .75) if sufficiently_sampled else None,
        }
        # Source period is the contract-start month/quarter; no individual contract
        # dates are emitted, including for sparse cohorts.
        observations.append(row)
        grouped_series[(record_id, project_id, segment, registration, frequency)].append(row)

    con.close()
    db_path.unlink(missing_ok=True)
    series = []
    for key, points in sorted(grouped_series.items()):
        record_id, project_id, segment, registration, frequency = key
        series_key = json.dumps(key, ensure_ascii=False, separators=(",", ":"))
        series_id = "dld-rent-v30-" + sha256(series_key.encode())[:20]
        periods = [point["period"] for point in points]
        series.append({
            "id": series_id,
            "recordId": record_id,
            "registeredProjectId": project_id,
            "segment": segment,
            "registration": registration,
            "frequency": frequency,
            "unit": "AED/year",
            "metric": "median_rent_aed_year",
            "pointCount": len(points),
            "periodCoverage": {"start": min(periods), "end": max(periods),
                               "observedPeriodCount": len(set(periods)), "completeness": "not_claimed"},
            "points": points,
        })

    result = {
        "schemaVersion": 1,
        "passId": "dld-ejari-exact-project-rent-recapture-20261007",
        "asOf": SOURCE_DATE,
        "sources": [
            {
                "id": BUILDINGS_SOURCE_ID,
                "url": "https://data.dubai/en/l/459613",
                "publisher": "Dubai Land Department via Dubai Data and Statistics Establishment",
                "title": "DLD buildings register, official public download",
                "sourceSnapshotDate": SOURCE_DATE,
                "publishedAt": None,
                "publicationDateStatus": "unknown",
                "firstAvailableAt": RETRIEVED_AT,
                "retrievedAt": RETRIEVED_AT,
                "availabilityBasis": "First verified public download in this capture; earlier availability is unknown.",
                "classification": "official_latest_vintage_open_data_snapshot",
                "licence": "Dubai Open Data Licence; attributed derivatives allowed; original data resale prohibited",
                "licenceURL": TERMS_URL,
                "rowCount": building_rows,
                "file": {"fileName": buildings_file.name, "bytes": buildings_file.stat().st_size,
                         "sha256": buildings_sha},
                "note": "Used only to map exact English building name and area ID to a unique DLD project ID already verified against an existing catalogue record."
            },
            {
                "id": RENTS_SOURCE_ID,
                "url": SOURCE_URL,
                "publisher": "Dubai Land Department via Dubai Data and Statistics Establishment",
                "title": "DLD Ejari rent contracts, official public download",
                "sourceSnapshotDate": SOURCE_DATE,
                "publishedAt": None,
                "publicationDateStatus": "unknown",
                "firstAvailableAt": RETRIEVED_AT,
                "retrievedAt": RETRIEVED_AT,
                "availabilityBasis": "First verified public download in this capture; dataset publication time is unknown.",
                "classification": "official_latest_vintage_open_data_snapshot",
                "licence": "Dubai Open Data Licence; attributed derivatives allowed; original data resale prohibited",
                "licenceURL": TERMS_URL,
                "rawRowsRedistributed": False,
                "rawContractsRedistributed": False,
                "nativeDateBasis": "contract_start_date",
                "observationBasis": "One-property Ejari contracts. Annual rent is summarized by exact verified DLD project, property usage/type and registration type. Native subtypes are pooled and also retained separately where available. Monthly and quarterly frequencies overlap.",
                "minimumMedianSample": MIN_SAMPLE,
                "sourceFiles": source_files,
                "sourceCompressedBytes": int(total_compressed_bytes),
                "sourceRows": totals["sourceRows"],
                "exactBuildingNameAreaRows": totals["exactBuildingRows"],
                "eligibleSinglePropertyRowsBeforeDuplicateCheck": totals["eligibleRowsBeforeDedup"],
                "duplicateContractIdsQuarantined": duplicate_contracts,
                "eligibleUniqueContracts": eligible_contracts,
                "unmatchedOrAmbiguousRowsExcluded": totals["unmatchedOrAmbiguousRows"],
                "qualityRejectedRows": totals["qualityRejectedRows"],
                "exactProjectRecords": len(records_with_contracts),
                "recordsWithContractStartsAfter2026_10_03": len(latest_window_records),
                "contractRowsAfter2026_10_03": latest_window_rows,
                "observationStart": min_start,
                "observationEnd": max_start,
                "sparseMedianValuesWithheld": sum(1 for row in observations if row["sampleCount"] < MIN_SAMPLE),
                "note": "Raw contract IDs, lease lines and individual amounts are excluded. Records before project delivery are not inferred; community or area context is not promoted to a project subject history."
            }
        ],
        "catalogueRecordCount": len(snapshot["records"]),
        "catalogueProjectCount": sum(r.get("type") == "project" for r in snapshot["records"]),
        "catalogueCommunityCount": sum(r.get("type") == "community" for r in snapshot["records"]),
        "verifiedProjectIdCount": len(project_to_record),
        "exactIdentityRule": "Unique current DLD building project_name_en + area_id maps to project_id; project_id must match exactly one existing identity-verified DLD project-register record. Shared/ambiguous mappings are excluded.",
        "methodology": "Recomputed project-level monthly and quarterly medians from the complete official latest-vintage Ejari download. Only single-property rows with finite positive annual_amount and actual_area and a contract_start_date no later than the source snapshot date are eligible. Duplicate contract IDs are quarantined. Medians and quartiles are withheld below n=20; counts and source-native periods remain. No individual contract IDs or raw rows are output.",
        "totals": totals,
        "recordsWithRentEvidence": len(records_with_contracts),
        "latestWindowRecords": len(latest_window_records),
        "latestWindowRows": latest_window_rows,
        "observationCount": len(observations),
        "series": series,
    }
    blob = json.dumps(result, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode() + b"\n"
    compressed = gzip.compress(blob, compresslevel=9, mtime=0)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(compressed)
    return {"output": str(output.relative_to(ROOT)), "bytes": len(compressed), "sha256": sha256(compressed),
            "records": len(records_with_contracts), "series": len(series), "observations": len(observations),
            "eligibleContracts": eligible_contracts, "newWindowRecords": len(latest_window_records),
            "newWindowContracts": latest_window_rows, "sourceRows": totals["sourceRows"]}


def _insert_batch(con: sqlite3.Connection, batch: list[tuple]) -> None:
    for row in batch:
        inserted = con.execute("INSERT OR IGNORE INTO c(contract_id,record_id,project_id,start,amount,area,usage,bus,ptype,subtype,registration) VALUES(?,?,?,?,?,?,?,?,?,?,?)", row)
        if not inserted.rowcount:
            con.execute("UPDATE c SET duplicate=1 WHERE contract_id=?", (row[0],))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", type=Path, required=True)
    parser.add_argument("--buildings-file", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    print(json.dumps(build(args.input_dir, args.buildings_file, args.output), sort_keys=True))
