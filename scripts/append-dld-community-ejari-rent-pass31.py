#!/usr/bin/env python3
"""Append exact DLD Ejari community-master rent cohorts as immutable V31."""
from __future__ import annotations

import gzip
import hashlib
import importlib.util
import json
import re
import sys
import unicodedata
from collections import defaultdict
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "data/historical-intelligence"
SNAPSHOT_PATH = ROOT / "data/historical-intelligence-20261003.json"
PUBLICATION_PATH = BASE / "publication-manifest.json"
SIDECAR_PATH = BASE / "dld-community-ejari-rent-pass31-20261007.json.gz"
VERSION = "20261008-enrichment-v31"
PRIOR_VERSION = "20261008-enrichment-v30"
SOURCE_ID = "dld-official-community-master-ejari-rents-20261007"
MIN_SAMPLE = 20
AS_OF = "2026-10-08"


def canonical(value) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode()


def digest(blob: bytes) -> str:
    return hashlib.sha256(blob).hexdigest()


def immutable(blob: bytes, suffix: str, kind: str) -> dict:
    sha = digest(blob)
    rel = f"objects/{sha}{suffix}"
    path = BASE / rel
    if path.exists() and path.read_bytes() != blob:
        raise ValueError(f"Immutable object collision: {rel}")
    if not path.exists():
        path.write_bytes(blob)
    return {"key": f"research/published/2026-10-08/historical-intelligence/{rel}",
            "path": str(path.relative_to(ROOT)), "sha256": sha, "bytes": len(blob),
            "kind": kind, "compression": "gzip" if suffix.endswith(".gz") else None}


def sql_literal(value) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def period_start(period: str, frequency: str) -> str:
    if frequency == "monthly":
        year, month = map(int, period.split("-"))
    else:
        year, quarter = int(period[:4]), int(period[-1])
        month = (quarter - 1) * 3 + 1
    return f"{year:04d}-{month:02d}-01"


def period_end(period: str, frequency: str) -> str:
    import calendar
    if frequency == "monthly":
        year, month = map(int, period.split("-"))
    else:
        year, quarter = int(period[:4]), int(period[-1])
        month = quarter * 3
    return f"{year:04d}-{month:02d}-{calendar.monthrange(year, month)[1]:02d}"


def normalized(value: object) -> str:
    value = unicodedata.normalize("NFKC", str(value or "")).casefold()
    return " ".join(re.sub(r"[^\w]+", " ", value).split())


def source_observation_id(series_id: str, point: list) -> str:
    return f"{SOURCE_ID}:{series_id}:{point[0]}:{digest(canonical(point))[:16]}"


def main() -> dict:
    snapshot = json.loads(SNAPSHOT_PATH.read_text())
    publication = json.loads(PUBLICATION_PATH.read_text())
    packet = json.loads(gzip.decompress(SIDECAR_PATH.read_bytes()))
    if snapshot.get("version") != PRIOR_VERSION or publication.get("version") != PRIOR_VERSION:
        raise ValueError(f"Expected published {PRIOR_VERSION} baseline")
    if len(snapshot["records"]) != 1860 or publication["counts"]["series"] != 15182:
        raise ValueError("Published catalogue/series inventory changed")
    if packet.get("passId") != "dld-ejari-exact-community-master-rent-pass31-20261007":
        raise ValueError("Unexpected V31 source packet")
    old_snapshot = deepcopy(snapshot)
    old_root = json.loads(gzip.decompress((ROOT / publication["rootIndex"]["path"]).read_bytes()))
    prior_sources = {source["id"] for source in snapshot["sources"]}
    if SOURCE_ID in prior_sources:
        raise ValueError("V31 DLD community rent source already exists")
    source = packet["sources"][0]
    if source.get("id") != SOURCE_ID or source.get("sourceRows") != 10573532:
        raise ValueError("V31 DLD source totals do not match the pinned official capture")
    if source.get("matchedExactDubaiCommunities") != 45 or source.get("nativeAreaIds") != 37:
        raise ValueError("V31 exact identity cohort differs from the audited source capture")
    if source.get("rawRowsRedistributed") is not False or source.get("rawContractsRedistributed") is not False:
        raise ValueError("Raw Ejari material is not eligible for redistribution")
    snapshot["sources"].append(source)
    sources = {item["id"]: item for item in snapshot["sources"]}
    record_by_id = {record["id"]: record for record in snapshot["records"]}
    old_full: dict[str, dict] = {}
    for obj in publication["objects"]:
        if obj["kind"] != "history_partition":
            continue
        archive = json.loads(gzip.decompress((ROOT / obj["path"]).read_bytes()))
        if archive.get("version") != PRIOR_VERSION or archive.get("asOf") != snapshot["asOf"]:
            raise ValueError("V30 history partition differs from the published baseline")
        for item in archive["series"]:
            if item["id"] in old_full:
                raise ValueError(f"Prior series duplicated across partitions: {item['id']}")
            old_full[item["id"]] = item
    if len(old_full) != publication["counts"]["series"]:
        raise ValueError("Prior history partition inventory does not match V30")
    existing_community_rent_keys = {
        (item.get("subjectRecordId"), str(item.get("sourceAreaId")), item.get("segment"),
         item.get("registration"), item.get("frequency"))
        for item in old_full.values()
        if item.get("scope") == "subject" and item.get("identityVerified") is True and item.get("metric") == "rent"
    }

    columns = ["period", "value", "sampleCount", "qualityStatus", "publishedAt", "firstAvailableAt",
               "sourceObservationId", "p25", "p75", "eligibleValueAED", "grossYieldPct", "blockedRows",
               "rawSourceEmirate", "observationBasis", "nativeRow"]
    basis = packet["methodology"]
    identity_basis = packet["exactIdentityRule"]
    new_ids: set[str] = set()
    linked_records: set[str] = set()
    linked_cells = 0
    for item in packet["series"]:
        record = record_by_id.get(item.get("recordId"))
        if not record or record.get("type") != "community" or record.get("emirate") != "Dubai":
            raise ValueError("V31 rent aggregate references a missing/non-Dubai community")
        labels = item.get("masterProjectLabel")
        if not labels or any(normalized(label) != normalized(record["name"]) for label in labels):
            raise ValueError("Community identity is not an exact DLD master-label match")
        if not item.get("areaId") or not item.get("areaName") or item.get("unit") != "AED/year":
            raise ValueError("Native DLD area or rent unit is missing")
        if item.get("metric") != "median_rent_aed_year" or item.get("frequency") not in {"monthly", "quarterly"}:
            raise ValueError("Unexpected V31 rent metric or frequency")
        signature = (record["id"], str(item["areaId"]), item["segment"], item["registration"], item["frequency"])
        if signature in existing_community_rent_keys:
            raise ValueError("V31 would overwrite an existing community subject-rent cohort")
        series_id = item["id"]
        if series_id in old_full or series_id in new_ids:
            raise ValueError("V31 series ID collision")
        periods = [row.get("period") for row in item.get("points", [])]
        if not periods or len(periods) != len(set(periods)):
            raise ValueError("V31 series has no points or repeats a native period")
        points = []
        for row in item["points"]:
            count = int(row["sampleCount"])
            value = row["medianAEDYear"] if count >= MIN_SAMPLE else None
            p25 = row["p25AEDYear"] if count >= MIN_SAMPLE else None
            p75 = row["p75AEDYear"] if count >= MIN_SAMPLE else None
            if count <= 0 or (count < MIN_SAMPLE and any(x is not None for x in (value, p25, p75))):
                raise ValueError("V31 sparse point includes a publishable statistic or invalid count")
            if count >= MIN_SAMPLE and (value is None or value <= 0 or p25 is None or p75 is None or not p25 <= value <= p75):
                raise ValueError("V31 sufficiently sampled rent statistic failed validation")
            quality = ("sample >=20; current period partial through 2026-10-07" if row["period"] in {"2026-10", "2026Q4"}
                       else "sample >=20") if count >= MIN_SAMPLE else (
                       "sparse; current period partial through 2026-10-07; median withheld" if row["period"] in {"2026-10", "2026Q4"}
                       else "sparse; median withheld")
            point = [row["period"], value, float(count), quality, None, source["retrievedAt"], None,
                     p25, p75, None, None, 0.0, "Dubai", basis, None]
            point[6] = source_observation_id(series_id, point)
            points.append(point)
        points.sort(key=lambda point: point[0])
        freq = item["frequency"]
        label_basis = identity_basis + f" Exact observed source label(s): {labels!r}. Native area: {item['areaId']} / {item['areaName']}."
        full = {
            "availability": "partition_available", "classification": "official DLD derived primary community-master rent cohort snapshot",
            "columns": columns, "emirate": "Dubai", "frequency": freq, "geography": record["name"],
            "id": series_id, "identityBasis": label_basis, "identitySourceIds": [SOURCE_ID], "identityVerified": True,
            "label": None, "linkBasis": label_basis, "metric": "rent", "nativeEndpoint": source["url"],
            "observationDateBasis": basis, "observationKind": "aggregate", "partition": None,
            "periodCoverage": {"start": points[0][0], "end": points[-1][0],
                               "startDate": period_start(points[0][0], freq), "endDate": period_end(points[-1][0], freq),
                               "nativeFrequency": freq, "observedPeriodCount": len(points), "rowCount": len(points),
                               "completeness": "not_claimed"},
            "pointCount": len(points), "procedureId": None, "procedureName": None,
            "qualityStatus": "source-native quality flags retained; medians and quartiles withheld below minimum sample",
            "registration": item["registration"], "scope": "subject", "segment": item["segment"],
            "sourceAreaId": int(item["areaId"]), "sourceAreaName": item["areaName"],
            "sourceId": SOURCE_ID, "sourceIds": [SOURCE_ID], "sourceMetric": "median_rent_aed_year",
            "sourceSeriesId": series_id, "subjectRecordId": record["id"], "transactionKind": None,
            "unit": "AED/year", "points": points,
        }
        old_full[series_id] = full
        new_ids.add(series_id)
        linked_records.add(record["id"])
        linked_cells += len(points)

    if len(linked_records) != 45:
        raise ValueError(f"Expected 45 exact community rent records, got {len(linked_records)}")
    if not new_ids or linked_cells != packet["observationCount"]:
        raise ValueError("V31 aggregate point inventory mismatch")
    if len(snapshot["records"]) != len(old_snapshot["records"]):
        raise ValueError("V31 changed the catalogue record inventory")
    if snapshot["events"] != old_snapshot["events"] or snapshot["exposures"] != old_snapshot["exposures"]:
        raise ValueError("V31 changed existing event or exposure evidence")

    # Keep only verified full partition points in the canonical history links.
    for record_id in sorted(linked_records):
        record = record_by_id[record_id]
        existing_ids = {link["id"] for link in record.get("historySeries", [])}
        for series_id in sorted(new_ids):
            full = old_full[series_id]
            if full["subjectRecordId"] != record_id:
                continue
            if series_id in existing_ids:
                raise ValueError("V31 duplicate compact record-series link")
            link = {key: deepcopy(value) for key, value in full.items() if key != "points"}
            link["partition"] = None
            link["embeddedPointCount"] = min(12, len(full["points"]))
            link["points"] = deepcopy(full["points"][-12:])
            record.setdefault("historySeries", []).append(link)
        # Use the shared evidence ledger; evidence presence never certifies full history.
        sys.path.insert(0, str(ROOT / "scripts"))
        from historical_gap_ledger import refresh_research_coverage
        exposures = [item for item in snapshot.get("exposures", []) if item.get("recordId") == record_id]
        refresh_research_coverage(record, old_full, sources, snapshot["asOf"], None, exposures)
        record["researchStatus"]["status"] = "partially_sourced; complete financial coverage not established"
        record.setdefault("coverageSummary", {})
        summary = record["coverageSummary"]
        summary.setdefault("originalAuditDirectRentPeriods", summary.get("directRentPeriods", 0))
        summary.setdefault("originalAuditDirectRentTransactionCount", summary.get("directRentTransactionCount", 0))
        rent_series = [item for item in old_full.values() if item.get("subjectRecordId") == record_id
                       and item.get("scope") == "subject" and item.get("identityVerified") is True and item.get("metric") == "rent"]
        positive_periods = {str(point[0]) for item in rent_series for point in item.get("points", [])
                            if len(point) > 1 and isinstance(point[1], (int, float)) and point[1] > 0}
        summary["directRentPeriods"] = len(positive_periods)
        summary["directRentTransactionCount"] = sum(item.get("pointCount", 0) for item in rent_series)
        summary["directRentSeriesCount"] = len(rent_series)
        summary["directPeriodCountBasis"] = (
            "Distinct retained native period labels with a publishable positive subject rent statistic; monthly and quarterly overlap and sparse counts do not certify full-period coverage.")

    if len(old_full) != publication["counts"]["series"] + len(new_ids):
        raise ValueError("V31 did not retain the full V30 series inventory")
    if {item["id"] for item in old_snapshot["sources"]} - {item["id"] for item in snapshot["sources"]}:
        raise ValueError("V31 removed a prior source")

    groups: dict[tuple, list[dict]] = defaultdict(list)
    for series in old_full.values():
        groups[(series.get("classification"), series.get("emirate"), series.get("frequency"),
                series.get("segment"), series.get("registration"))].append(series)
    history_objects, partition_pointers = [], {}
    for _, items in sorted(groups.items(), key=lambda entry: str(entry[0])):
        ordered = sorted(items, key=lambda item: item["id"])
        archive = {"version": VERSION, "asOf": snapshot["asOf"],
                   "classification": "context_history_partition", "series": ordered}
        obj = immutable(gzip.compress(canonical(archive), compresslevel=9, mtime=0), ".json.gz", "history_partition")
        history_objects.append(obj)
        pointer = {key: obj[key] for key in ["key", "sha256", "bytes", "compression"]}
        for series in ordered:
            if series["id"] in partition_pointers:
                raise ValueError("A V31 series appears in multiple partitions")
            partition_pointers[series["id"]] = pointer
    if len(partition_pointers) != len(old_full):
        raise ValueError("V31 partition inventory is incomplete")
    for record in snapshot["records"]:
        for link in record.get("historySeries", []):
            if link.get("partition") is not None or link["id"] in partition_pointers:
                link["partition"] = partition_pointers[link["id"]]

    snapshot["version"] = VERSION
    manifest = snapshot["manifest"]
    manifest["version"] = VERSION
    manifest["historicalSeriesCount"] = len(old_full)
    manifest["historicalObservationRows"] = sum(item["pointCount"] for item in old_full.values())
    manifest["collectedHistoricalObservationRows"] = manifest["historicalObservationRows"] + manifest.get("rightsPendingObservationRows", 0)
    manifest["extendedTotalObservationRows"] = manifest["collectedHistoricalObservationRows"]
    manifest["directSubjectRentHistoryRecords"] = sum(
        record.get("researchStatus", {}).get("itemCoverage", {}).get("signed_rent_history", {}).get("status") == "present"
        for record in snapshot["records"])
    manifest["dldCommunityEjariRentPass31"] = {
        "sourceId": SOURCE_ID, "sourceRows": source["sourceRows"],
        "eligibleUniqueContracts": source["eligibleUniqueContracts"],
        "matchedExactDubaiCommunities": len(linked_records), "nativeAreaIds": source["nativeAreaIds"],
        "newSeries": len(new_ids), "aggregateObservationRows": linked_cells,
        "publishableMedianCells": source["publishableMedianCells"],
        "sparseCellsWithMedianWithheld": source["sparseCellsWithMedianWithheld"],
        "observationStart": source["observationStart"], "observationEnd": source["observationEnd"],
        "sourcePublicationDate": "unknown", "rawContractIdsRedistributed": False,
        "rawContractRowsRedistributed": False, "populationOverlap": "not additive to project cohorts",
        "approved2080ForecastRecords": manifest.get("approved2080ForecastRecords", 0),
    }

    descriptors = []
    for series in old_full.values():
        descriptor = {key: deepcopy(value) for key, value in series.items() if key != "points"}
        descriptor["partition"] = partition_pointers[series["id"]]
        descriptors.append(descriptor)
    descriptors.sort(key=lambda item: item["id"])
    old_compact = {item["id"]: item for item in old_root["records"]}
    compact_records = []
    for record in snapshot["records"]:
        compact = dict(old_compact[record["id"]])
        compact["historySeriesIds"] = [item["id"] for item in record.get("historySeries", [])]
        compact["researchStatus"] = deepcopy(record.get("researchStatus", {}))
        compact["coverageSummary"] = deepcopy(record.get("coverageSummary", {}))
        compact_records.append(compact)
    root = dict(old_root)
    root.update({"version": VERSION, "asOf": snapshot["asOf"], "manifest": manifest,
                 "sources": snapshot["sources"], "series": descriptors, "records": compact_records})
    root_obj = immutable(gzip.compress(canonical(root), compresslevel=9, mtime=0), ".json.gz", "full_snapshot_index")

    objects = [obj for obj in publication["objects"] if obj["kind"] not in [
        "runtime_history_partition", "runtime_record_shard", "runtime_index", "history_partition", "full_snapshot_index"]]
    objects.extend(history_objects)
    objects.append(root_obj)
    counts = dict(publication["counts"])
    counts.update({"sources": len(snapshot["sources"]), "series": len(old_full),
                   "historicalRows": manifest["historicalObservationRows"],
                   "collectedHistoricalRows": manifest["collectedHistoricalObservationRows"]})
    new_publication = {"version": VERSION, "asOf": snapshot["asOf"], "rootIndex": root_obj,
                       "objects": objects, "counts": counts}
    sql = ["PRAGMA foreign_keys = ON;"]
    sql.append(f"INSERT OR IGNORE INTO hi_snapshots(snapshot_version,as_of,record_count,manifest_json,root_sha256) VALUES({sql_literal(VERSION)},{sql_literal(snapshot['asOf'])},1860,{sql_literal(canonical(manifest).decode())},{sql_literal(root_obj['sha256'])});")
    for record in compact_records:
        row = {key: value for key, value in record.items() if key != "historySeriesIds"}
        sql.append(f"INSERT OR IGNORE INTO hi_records(snapshot_version,record_id,record_type,name,emirate,record_json) VALUES({sql_literal(VERSION)},{sql_literal(record['id'])},{sql_literal(record['type'])},{sql_literal(record['name'])},{sql_literal(record['emirate'])},{sql_literal(canonical(row).decode())});")
    for item in snapshot["sources"]:
        sql.append(f"INSERT OR IGNORE INTO hi_sources(snapshot_version,source_id,url,source_json) VALUES({sql_literal(VERSION)},{sql_literal(item['id'])},{sql_literal(item['url'])},{sql_literal(canonical(item).decode())});")
    for event in snapshot["events"]:
        sql.append(f"INSERT OR IGNORE INTO hi_events(snapshot_version,event_id,event_json) VALUES({sql_literal(VERSION)},{sql_literal(event['id'])},{sql_literal(canonical(event).decode())});")
    for exposure in snapshot["exposures"]:
        sql.append(f"INSERT OR IGNORE INTO hi_exposures(snapshot_version,exposure_id,event_id,record_id,scope,verified,exposure_json) VALUES({sql_literal(VERSION)},{sql_literal(exposure['id'])},{sql_literal(exposure['eventId'])},{sql_literal(exposure['recordId'])},{sql_literal(exposure['scope'])},{int(exposure['verified'])},{sql_literal(canonical(exposure).decode())});")
    descriptor_by_id = {item["id"]: item for item in descriptors}
    for item in descriptors:
        sql.append(f"INSERT OR IGNORE INTO hi_series(snapshot_version,series_id,source_id,series_json) VALUES({sql_literal(VERSION)},{sql_literal(item['id'])},{sql_literal(item['sourceId'])},{sql_literal(canonical(item).decode())});")
    for record in compact_records:
        for series_id in record.get("historySeriesIds", []):
            descriptor = descriptor_by_id[series_id]
            sql.append(f"INSERT OR IGNORE INTO hi_record_series(snapshot_version,record_id,series_id,scope,identity_verified) VALUES({sql_literal(VERSION)},{sql_literal(record['id'])},{sql_literal(series_id)},{sql_literal(descriptor.get('scope', 'area_context'))},{int(descriptor.get('identityVerified', False))});")
    d1_obj = immutable(gzip.compress(("\n".join(sql) + "\n").encode(), compresslevel=9, mtime=0), ".sql.gz", "d1_append_only_index")
    new_publication["d1Index"] = d1_obj
    SNAPSHOT_PATH.write_bytes(canonical(snapshot) + b"\n")
    PUBLICATION_PATH.write_bytes(canonical(new_publication) + b"\n")
    sys.path.insert(0, str(ROOT / "scripts"))
    spec = importlib.util.spec_from_file_location("build_historical_data", ROOT / "scripts/build-historical-data.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.build_runtime_index(snapshot, new_publication)
    return {"version": VERSION, "records": counts["records"], "projects": counts["projects"],
            "communities": counts["communities"], "series": counts["series"],
            "sources": counts["sources"], "historicalRows": counts["historicalRows"],
            "newSeries": len(new_ids), "newCommunityRecords": len(linked_records),
            "newPointRows": linked_cells, "approved2080ForecastRecords": manifest.get("approved2080ForecastRecords", 0)}


if __name__ == "__main__":
    print(json.dumps(main(), sort_keys=True))
