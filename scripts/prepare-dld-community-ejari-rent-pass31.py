#!/usr/bin/env python3
"""Prepare privacy-safe DLD Ejari community-master rent cohorts for V31.

The only geography join is an exact normalized DLD master_project_en label to
one unique Dubai community catalogue name. Native DLD area IDs stay separate.
Raw Ejari rows and contract identifiers remain in ignored .local-data.
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
import sys
import unicodedata
from collections import defaultdict
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / "data/historical-intelligence-20261003.json"
OUTPUT = ROOT / "data/historical-intelligence/dld-community-ejari-rent-pass31-20261007.json.gz"
SOURCE_URL = "https://data.dubai/en/l/468586"
TERMS_URL = "https://data.dubai/en/terms-conditions"
SOURCE_ID = "dld-official-community-master-ejari-rents-20261007"
SOURCE_DATE = "2026-10-07"
RETRIEVED_AT = "2026-10-08T15:53:50Z"
MIN_SAMPLE = 20


def sha(blob: bytes) -> str:
    return hashlib.sha256(blob).hexdigest()


def norm(value: object) -> str:
    value = unicodedata.normalize("NFKC", str(value or "")).casefold()
    return " ".join(re.sub(r"[^\w]+", " ", value).split())


def quantile(values: list[float], p: float) -> float:
    ordered = sorted(values)
    position = (len(ordered) - 1) * p
    lower, upper = int(position), min(int(position) + 1, len(ordered) - 1)
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def period(day: str, frequency: str) -> str:
    if frequency == "monthly":
        return day[:7]
    date = datetime.strptime(day, "%Y-%m-%d")
    return f"{date.year}Q{(date.month - 1) // 3 + 1}"


def insert_batch(con: sqlite3.Connection, batch: list[tuple]) -> int:
    duplicate_rows = 0
    for row in batch:
        inserted = con.execute(
            "INSERT OR IGNORE INTO contracts(contract_id,record_id,master_label,area_id,area_name,day,amount,"
            "usage,business_type,property_type,subtype,registration) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)", row)
        if not inserted.rowcount:
            con.execute("UPDATE contracts SET duplicate=1 WHERE contract_id=?", (row[0],))
            duplicate_rows += 1
    return duplicate_rows


def build(input_dir: Path, output: Path = OUTPUT) -> dict:
    snapshot = json.loads(SNAPSHOT.read_text())
    if snapshot.get("version") != "20261008-enrichment-v30":
        raise ValueError("Expected the verified V30 catalogue baseline")
    if len(snapshot.get("records", [])) != 1860:
        raise ValueError("Catalogue record count changed")
    name_groups: dict[str, list[dict]] = defaultdict(list)
    for record in snapshot["records"]:
        if record.get("type") == "community" and record.get("emirate") == "Dubai":
            name_groups[norm(record.get("name"))].append(record)
    targets = {key: group[0] for key, group in name_groups.items() if key and len(group) == 1}
    ambiguous = {key for key, group in name_groups.items() if key and len(group) != 1}
    existing_rent = {
        record["id"] for record in snapshot["records"] if record.get("type") == "community"
        and any(series.get("scope") == "subject" and series.get("identityVerified") is True
                and series.get("metric") == "rent" for series in record.get("historySeries", []))
    }
    targets = {key: record for key, record in targets.items() if record["id"] not in existing_rent}

    files = sorted(input_dir.glob("rent_contracts_2026-10-07_18-06-59_*.csv.gz"))
    if len(files) != 11:
        raise ValueError(f"Expected 11 official DLD rent shards, found {len(files)}")
    source_files, compressed_bytes = [], 0
    for path in files:
        raw = path.read_bytes()
        with gzip.open(path, "rb") as stream:
            stream.read(1)
        source_files.append({"fileName": path.name, "bytes": len(raw), "sha256": sha(raw)})
        compressed_bytes += len(raw)

    db_path = input_dir / "community-rent-pass31-scratch.sqlite"
    if db_path.exists():
        db_path.unlink()
    con = sqlite3.connect(db_path)
    con.execute("PRAGMA journal_mode=OFF")
    con.execute("PRAGMA synchronous=OFF")
    con.execute("CREATE TABLE contracts (contract_id TEXT PRIMARY KEY,record_id TEXT NOT NULL,master_label TEXT NOT NULL,"
                "area_id TEXT NOT NULL,area_name TEXT NOT NULL,day TEXT NOT NULL,amount REAL NOT NULL,usage TEXT NOT NULL,"
                "business_type TEXT NOT NULL,property_type TEXT NOT NULL,subtype TEXT NOT NULL,registration TEXT NOT NULL,"
                "duplicate INTEGER NOT NULL DEFAULT 0)")
    totals = {"sourceRows": 0, "exactMasterProjectRows": 0, "ambiguousMasterRows": 0,
              "eligibleResidentialRowsBeforeDuplicateCheck": 0, "qualityRejectedRows": 0}
    try:
        for path in files:
            batch = []
            with gzip.open(path, "rt", encoding="utf-8-sig", newline="") as stream:
                for row in csv.DictReader(stream):
                    totals["sourceRows"] += 1
                    key = norm(row.get("master_project_en"))
                    if key in ambiguous:
                        totals["ambiguousMasterRows"] += 1
                        continue
                    record = targets.get(key)
                    if not record:
                        continue
                    totals["exactMasterProjectRows"] += 1
                    usage = str(row.get("property_usage_en") or "").strip()
                    if norm(usage) not in {"residential", "residential property"}:
                        continue
                    try:
                        contract_id = str(row.get("contract_id") or "").strip()
                        day = str(row.get("contract_start_date") or "")[:10]
                        parsed = datetime.strptime(day, "%Y-%m-%d")
                        amount = float(row.get("annual_amount") or "")
                        area = float(row.get("actual_area") or "")
                        property_count = int(float(row.get("no_of_prop") or ""))
                        area_id = str(row.get("area_id") or "").strip()
                        area_name = str(row.get("area_name_en") or "").strip()
                        registration = str(row.get("contract_reg_type_en") or "").strip()
                        business_type = str(row.get("ejari_bus_property_type_en") or "").strip()
                        property_type = str(row.get("ejari_property_type_en") or "").strip()
                        subtype = str(row.get("ejari_property_sub_type_en") or "").strip()
                        if (not contract_id or parsed.strftime("%Y-%m-%d") != day or day > SOURCE_DATE
                                or amount <= 0 or area <= 0 or property_count != 1 or not area_id or not area_name
                                or not registration or not usage or not business_type or not property_type):
                            raise ValueError
                    except (ValueError, TypeError, OverflowError):
                        totals["qualityRejectedRows"] += 1
                        continue
                    batch.append((contract_id, record["id"], str(row.get("master_project_en") or ""),
                                  area_id, area_name, day, amount, usage, business_type,
                                  property_type, subtype, registration))
                    totals["eligibleResidentialRowsBeforeDuplicateCheck"] += 1
                    if len(batch) >= 3000:
                        insert_batch(con, batch)
                        batch.clear()
            if batch:
                insert_batch(con, batch)
            con.commit()

        unique_contract_ids = con.execute("SELECT COUNT(*) FROM contracts").fetchone()[0]
        # The primary key keeps one candidate row per identifier; insert_batch
        # marks that row when a duplicate appears in any other source shard.
        duplicate_groups = con.execute("SELECT COUNT(*) FROM contracts WHERE duplicate=1").fetchone()[0]
        totals["repeatedContractRowsDetected"] = totals["eligibleResidentialRowsBeforeDuplicateCheck"] - unique_contract_ids
        totals["duplicateContractIdsQuarantined"] = duplicate_groups
        totals["duplicateSourceRowsExcluded"] = duplicate_groups + totals["repeatedContractRowsDetected"]
        con.execute("CREATE INDEX contracts_usable ON contracts(duplicate,record_id,area_id,day)")
        grouped: dict[tuple, list[float]] = defaultdict(list)
        labels: dict[str, set[str]] = defaultdict(set)
        areas: dict[str, set[tuple[str, str]]] = defaultdict(set)
        earliest = latest = None
        retained_contracts = 0
        query = ("SELECT record_id,master_label,area_id,area_name,day,amount,usage,business_type,property_type,"
                 "subtype,registration FROM contracts WHERE duplicate=0 ORDER BY record_id,area_id,day")
        for record_id, label, area_id, area_name, day, amount, usage, business_type, property_type, subtype, registration in con.execute(query):
            retained_contracts += 1
            labels[record_id].add(label)
            areas[record_id].add((area_id, area_name))
            earliest = day if earliest is None else min(earliest, day)
            latest = day if latest is None else max(latest, day)
            segment = " | ".join([usage, business_type, property_type] + ([f"native subtype: {subtype}"] if subtype else []))
            for frequency in ("monthly", "quarterly"):
                grouped[(record_id, area_id, area_name, segment, registration, frequency, period(day, frequency))].append(amount)
    finally:
        con.close()
        db_path.unlink(missing_ok=True)

    record_by_id = {record["id"]: record for record in snapshot["records"]}
    series_groups: dict[tuple, list[dict]] = defaultdict(list)
    sparse_cells = publishable_cells = 0
    for key, amounts in sorted(grouped.items()):
        record_id, area_id, area_name, segment, registration, frequency, point_period = key
        amounts.sort()
        count = len(amounts)
        enough = count >= MIN_SAMPLE
        point = {"period": point_period, "sampleCount": count,
                 "medianAEDYear": statistics.median(amounts) if enough else None,
                 "p25AEDYear": quantile(amounts, .25) if enough else None,
                 "p75AEDYear": quantile(amounts, .75) if enough else None}
        series_groups[(record_id, area_id, area_name, segment, registration, frequency)].append(point)
        if enough:
            publishable_cells += 1
        else:
            sparse_cells += 1

    identity = (
        "Exact official DLD master_project_en label after Unicode/case/spacing/punctuation normalization matches one unique Dubai catalogue community; "
        "native DLD area_id and area_name_en remain separate; the label follows the DLD master-project grouping and is not asserted as a legal boundary. "
        "This is a community-master cohort, not a legal parcel polygon or a claim to all nearby property."
    )
    basis = (
        "Official DLD Ejari contract_start_date and annual_amount for one-property residential tenancy contracts, aggregated by exact DLD master_project_en, "
        "native area_id, residential usage, business/property type, subtype and registration type. Monthly and quarterly frequencies overlap. "
        "The latest-vintage source was retrieved 2026-10-08; source publication time is unknown, so this vintage is not admissible in earlier backtests. "
        "The source cohort is not complete lifetime history and does not establish first-ever rental activity or an applicable observation before its earliest retained date."
    )
    series = []
    monthly_point_rows = 0
    for key, points in sorted(series_groups.items()):
        record_id, area_id, area_name, segment, registration, frequency = key
        record = record_by_id[record_id]
        signature = json.dumps(key, ensure_ascii=False, separators=(",", ":"))
        series_id = "dld-community-rent-v31-" + sha(signature.encode())[:24]
        periods = [point["period"] for point in points]
        if frequency == "monthly":
            monthly_point_rows += len(points)
        series.append({
            "id": series_id, "recordId": record_id, "masterProjectLabel": sorted(labels[record_id]),
            "masterProjectScope": "exact DLD master_project_en label; not a legal or wider geographic boundary",
            "areaId": area_id, "areaName": area_name, "segment": segment, "registration": registration,
            "frequency": frequency, "unit": "AED/year", "metric": "median_rent_aed_year",
            "pointCount": len(points),
            "periodCoverage": {"start": min(periods), "end": max(periods),
                               "observedPeriodCount": len(set(periods)), "completeness": "not_claimed"},
            "points": points,
        })

    source = {
        "id": SOURCE_ID, "url": SOURCE_URL,
        "publisher": "Dubai Land Department via Dubai Data and Statistics Establishment",
        "title": "DLD Ejari residential rent contracts, exact community-master cohorts",
        "sourceSnapshotDate": SOURCE_DATE, "publishedAt": None, "publicationDateStatus": "unknown",
        "firstAvailableAt": RETRIEVED_AT, "retrievedAt": RETRIEVED_AT,
        "availabilityBasis": "First verified public download in the 2026-10-08 capture; earlier availability is unknown.",
        "classification": "official_latest_vintage_open_data_snapshot",
        "licence": "Dubai Open Data Licence; attributed derivatives allowed; original data resale prohibited",
        "licenceURL": TERMS_URL, "rawRowsRedistributed": False, "rawContractsRedistributed": False,
        "nativeDateBasis": "contract_start_date", "nativeGeographyFields": ["master_project_en", "area_id", "area_name_en"],
        "sourceFiles": source_files, "sourceCompressedBytes": compressed_bytes,
        "sourceRows": totals["sourceRows"], "exactMasterProjectRows": totals["exactMasterProjectRows"],
        "ambiguousMasterRowsExcluded": totals["ambiguousMasterRows"],
        "eligibleResidentialRowsBeforeDuplicateCheck": totals["eligibleResidentialRowsBeforeDuplicateCheck"],
        "duplicateContractIdsQuarantined": duplicate_groups,
        "repeatedContractRowsDetected": totals["repeatedContractRowsDetected"],
        "duplicateSourceRowsExcluded": totals["duplicateSourceRowsExcluded"],
        "eligibleUniqueContracts": retained_contracts,
        "qualityRejectedRows": totals["qualityRejectedRows"],
        "matchedExactDubaiCommunities": len({item["recordId"] for item in series}),
        "nativeAreaIds": len({item["areaId"] for item in series}),
        "observationStart": earliest, "observationEnd": latest,
        "minimumMedianSample": MIN_SAMPLE, "publishableMedianCells": publishable_cells,
        "sparseCellsWithMedianWithheld": sparse_cells,
        "monthlyAggregatePointRows": monthly_point_rows,
        "monthlyQuarterlyAggregatePointRows": sum(item["pointCount"] for item in series),
        "populationOverlap": "These master-project community cohorts may overlap the DLD building/project rent cohorts. They are community-level descriptions, not additive to project-level counts, values or yields.",
        "note": "Only derived cohorts are redistributed. Exact master labels and native area IDs remain separate; no legal boundary, first-ever history, or complete lifetime history is claimed.",
    }
    result = {
        "schemaVersion": 1, "passId": "dld-ejari-exact-community-master-rent-pass31-20261007",
        "asOf": SOURCE_DATE, "catalogueRecordCount": len(snapshot["records"]),
        "catalogueCommunityCount": sum(record.get("type") == "community" for record in snapshot["records"]),
        "matchedExactDubaiCommunities": source["matchedExactDubaiCommunities"],
        "existingDirectRentCommunitiesSkipped": sorted(existing_rent),
        "ambiguousCatalogueCommunityNames": sorted(ambiguous),
        "exactIdentityRule": identity,
        "methodology": basis + " Single-property contracts only; positive annual rent and property area; duplicate contract IDs are fully quarantined. Monthly and quarterly medians and inclusive P25/P75 are emitted only for n >= 20; smaller cells retain counts and periods with statistics withheld. No raw contract identifiers, tenant information, lease rows, or individual amounts are included. Master-project groups overlap project-level cohorts and are non-additive.",
        "sources": [source], "totals": totals, "recordsWithRentEvidence": source["matchedExactDubaiCommunities"],
        "seriesCount": len(series), "observationCount": sum(item["pointCount"] for item in series),
        "series": series,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    blob = json.dumps(result, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode() + b"\n"
    output.write_bytes(gzip.compress(blob, compresslevel=9, mtime=0))
    return {"output": str(output), "sha256": sha(output.read_bytes()), "bytes": output.stat().st_size,
            "sourceRows": totals["sourceRows"], "eligibleUniqueContracts": retained_contracts,
            "communities": source["matchedExactDubaiCommunities"], "series": len(series),
            "observationCount": result["observationCount"], "publishableMedianCells": publishable_cells,
            "sparseCellsWithMedianWithheld": sparse_cells, "observationStart": earliest,
            "observationEnd": latest, "rawRowsRedistributed": False}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    print(json.dumps(build(args.input_dir, args.output), sort_keys=True))
