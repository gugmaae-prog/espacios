#!/usr/bin/env python3
"""Append the verified 7 October DLD rent vintage as V30.

Prior snapshots and all series remain immutable. Current DLD points replace only
their prior-vintage counterpart in V30; periods missing from the current export
retain their earlier point with its original source observation ID.
"""
from __future__ import annotations

import gzip
import hashlib
import importlib.util
import json
import sys
from collections import defaultdict
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "data/historical-intelligence"
SNAPSHOT_PATH = ROOT / "data/historical-intelligence-20261003.json"
PUBLICATION_PATH = BASE / "publication-manifest.json"
SIDECAR_PATH = BASE / "dld-rent-recapture-20261008.json.gz"
VERSION = "20261008-enrichment-v30"
PRIOR_VERSION = "20261008-enrichment-v29"
OLD_RENT_SOURCE = "dld-official-rents-20261003"
NEW_RENT_SOURCE = "dld-official-rents-recapture-20261008"
NEW_BUILDINGS_SOURCE = "dld-official-buildings-20261007"
MIN_SAMPLE = 20


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


def period_end(period: str, frequency: str) -> str:
    if frequency == "monthly":
        year, month = map(int, period.split("-"))
        if month == 12:
            return f"{year:04d}-12-31"
        import calendar
        return f"{year:04d}-{month:02d}-{calendar.monthrange(year, month)[1]:02d}"
    year, quarter = int(period[:4]), int(period[-1])
    month = quarter * 3
    import calendar
    return f"{year:04d}-{month:02d}-{calendar.monthrange(year, month)[1]:02d}"


def period_start(period: str, frequency: str) -> str:
    if frequency == "monthly":
        year, month = map(int, period.split("-"))
    else:
        year, quarter = int(period[:4]), int(period[-1])
        month = (quarter - 1) * 3 + 1
    return f"{year:04d}-{month:02d}-01"


def source_observation_id(series_id: str, period: str, point: list) -> str:
    return f"{NEW_RENT_SOURCE}:{series_id}:{period}:{digest(canonical(point))[:16]}"


def current_point(series_id: str, row: dict, observation_basis: str, retrieved_at: str) -> list:
    n = int(row["sampleCount"])
    value = row["medianAEDYear"] if n >= MIN_SAMPLE else None
    p25 = row["p25AEDYear"] if n >= MIN_SAMPLE else None
    p75 = row["p75AEDYear"] if n >= MIN_SAMPLE else None
    quality = "sample >=20 and positive median" if n >= MIN_SAMPLE and value and value > 0 else "withheld median: sparse/invalid"
    point = [row["period"], value, float(n), quality, None, retrieved_at, None,
             p25, p75, None, None, 0.0, "Dubai", observation_basis, None]
    point[6] = source_observation_id(series_id, row["period"], point)
    return point


def main() -> dict:
    snapshot = json.loads(SNAPSHOT_PATH.read_text())
    publication = json.loads(PUBLICATION_PATH.read_text())
    sidecar = json.loads(gzip.decompress(SIDECAR_PATH.read_bytes()))
    if snapshot.get("version") != PRIOR_VERSION or publication.get("version") != PRIOR_VERSION:
        raise ValueError(f"Expected published {PRIOR_VERSION} baseline")
    if len(snapshot["records"]) != 1860 or publication["counts"]["series"] != 15182:
        raise ValueError("The published catalogue/series inventory changed")
    if publication.get("d1Index") is None:
        raise ValueError("The prior versioned D1 index is required")
    old_snapshot = deepcopy(snapshot)
    old_root = json.loads(gzip.decompress((ROOT / publication["rootIndex"]["path"]).read_bytes()))
    prior_sources = {source["id"] for source in snapshot["sources"]}
    if NEW_RENT_SOURCE in prior_sources or NEW_BUILDINGS_SOURCE in prior_sources:
        raise ValueError("A V30 source ID already exists")
    for source in sidecar["sources"]:
        if source["id"] in prior_sources:
            raise ValueError(f"Source ID collision: {source['id']}")
        snapshot["sources"].append(source)
        prior_sources.add(source["id"])
    sources = {item["id"]: item for item in snapshot["sources"]}

    # Load each complete source partition. The V29 snapshot remains immutable.
    old_full: dict[str, dict] = {}
    old_partition_path_by_key = {}
    for obj in publication["objects"]:
        if obj["kind"] != "history_partition":
            continue
        archive = json.loads(gzip.decompress((ROOT / obj["path"]).read_bytes()))
        if archive.get("version") != PRIOR_VERSION or archive.get("asOf") != snapshot["asOf"]:
            raise ValueError("A prior history partition differs from the V29 baseline")
        old_partition_path_by_key[obj["key"]] = obj
        for series in archive["series"]:
            if series["id"] in old_full:
                raise ValueError(f"Prior series duplicated across partitions: {series['id']}")
            old_full[series["id"]] = series
    if len(old_full) != publication["counts"]["series"]:
        raise ValueError("History partition inventory does not match V29")

    record_by_id = {record["id"]: record for record in snapshot["records"]}
    packet_groups = {}
    for packet_series in sidecar["series"]:
        record = record_by_id.get(packet_series["recordId"])
        if not record or record.get("type") != "project":
            raise ValueError("DLD rent aggregate references a missing/non-project catalogue record")
        if packet_series["registeredProjectId"] not in {
                str((e.get("fields") or {}).get("projectId") or "")
                for e in record.get("registerEvidence", [])
                if e.get("identityVerified") is True and e.get("scope") == "subject"
                and "dld-official-projects-20260706" in e.get("sourceIds", [])}:
            raise ValueError("DLD rent aggregate project ID does not match the verified record register")
        key = (packet_series["recordId"], packet_series["segment"],
               packet_series["registration"], packet_series["frequency"])
        if key in packet_groups:
            raise ValueError(f"Duplicate new DLD rent series key: {key}")
        packet_groups[key] = packet_series

    old_direct_by_key = {}
    for full in old_full.values():
        if (full.get("sourceId") == OLD_RENT_SOURCE and full.get("metric") == "rent"
                and full.get("scope") == "subject" and full.get("identityVerified") is True):
            key = (full.get("subjectRecordId"), full.get("segment"),
                   full.get("registration"), full.get("frequency"))
            if key in old_direct_by_key:
                raise ValueError(f"Prior direct rent series key is not unique: {key}")
            old_direct_by_key[key] = full["id"]

    rent_source = next(item for item in sidecar["sources"] if item["id"] == NEW_RENT_SOURCE)
    buildings_source = next(item for item in sidecar["sources"] if item["id"] == NEW_BUILDINGS_SOURCE)
    if sidecar.get("schemaVersion") != 1 or sidecar.get("catalogueRecordCount") != 1860:
        raise ValueError("Unexpected DLD rent recapture schema or catalogue scope")
    if rent_source.get("sourceRows") != 10573532 or rent_source.get("eligibleUniqueContracts") != 71477:
        raise ValueError("DLD rent source row/eligibility totals do not match the verified capture")
    if rent_source.get("exactProjectRecords") != 90 or sidecar.get("recordsWithRentEvidence") != 90:
        raise ValueError("DLD rent identity cohort differs from the verified capture")
    if any("contract_id" in str(key).lower() or "contractid" in str(key).lower()
           for series in sidecar["series"] for row in series["points"] for key in row):
        raise ValueError("Private contract identifier appeared in aggregate sidecar")

    basis = ("Latest-vintage DLD Ejari aggregate by contract_start_date using annual_amount for one-property contracts; "
             "exact current DLD building name + area -> unique DLD project ID -> one verified catalogue project; "
             "usage, business-property type, property type, subtype and registration type remain separated; "
             "subtypes are pooled and also separately retained; no quality/mix adjustment; monthly and quarterly "
             "frequencies overlap; snapshot retrieved 2026-10-08; historical source publication time unknown.")
    old_point_cells = set()
    new_point_cells = set()
    changed_value_cells = 0
    preserved_prior_only_cells = 0
    updated_series_ids = set()
    added_series_ids = set()
    new_identity_basis = ("Exact current DLD building project_name_en + area_id resolves to a unique project_id; "
                          "that DLD project_id matches exactly one existing identity-verified catalogue project record. "
                          "No fuzzy title or community-level fan-out is used.")

    for key, packet_series in packet_groups.items():
        record_id, segment, registration, frequency = key
        prior_id = old_direct_by_key.get(key)
        if prior_id:
            full = deepcopy(old_full[prior_id])
            series_id = prior_id
            prior_points = {point[0]: point for point in full.get("points", [])}
            old_point_cells.update((series_id, period) for period in prior_points)
        else:
            template = next((x for x in old_full.values()
                             if x.get("subjectRecordId") == record_id and x.get("sourceId") == OLD_RENT_SOURCE
                             and x.get("metric") == "rent" and x.get("scope") == "subject"
                             and x.get("identityVerified") is True), None)
            if not template:
                raise ValueError("A new rent series has no prior identity-verified DLD subject-series template")
            full = deepcopy(template)
            series_id = packet_series["id"]
            if series_id in old_full or series_id in added_series_ids:
                raise ValueError(f"New DLD rent series ID collision: {series_id}")
            full.update({"id": series_id, "sourceSeriesId": series_id,
                         "subjectRecordId": record_id, "segment": segment,
                         "registration": registration, "frequency": frequency,
                         "points": [], "pointCount": 0})
            added_series_ids.add(series_id)
            prior_points = {}

        point_by_period = dict(prior_points)
        current_periods = {row["period"] for row in packet_series["points"]}
        for row in packet_series["points"]:
            point = current_point(series_id, row, basis, sources[NEW_RENT_SOURCE]["retrievedAt"])
            if row["period"] in point_by_period:
                prior = point_by_period[row["period"]]
                if any(prior[index] != point[index] for index in (1, 2, 7, 8)):
                    changed_value_cells += 1
            else:
                new_point_cells.add((series_id, row["period"]))
            point_by_period[row["period"]] = point
        prior_only = {period for period in prior_points if period not in current_periods}
        if any(point_by_period[period] != prior_points[period] for period in prior_only):
            raise ValueError("A V29 point absent from the current DLD export was changed instead of preserved")
        preserved_prior_only_cells += len(prior_only)
        full["points"] = sorted(point_by_period.values(), key=lambda point: (point[0], point[6]))
        full["identitySourceIds"] = list(dict.fromkeys(
            list(full.get("identitySourceIds", [])) + [NEW_BUILDINGS_SOURCE]))
        full["identityBasis"] = new_identity_basis
        full["linkBasis"] = new_identity_basis
        full["sourceId"] = NEW_RENT_SOURCE
        full["sourceIds"] = list(dict.fromkeys([OLD_RENT_SOURCE, NEW_RENT_SOURCE])) if prior_points else [NEW_RENT_SOURCE]
        full["observationDateBasis"] = basis
        full["qualityStatus"] = "source-native quality flags retained; aggregate medians withheld below minimum sample"
        full["classification"] = "official DLD derived primary snapshot"
        full["availability"] = "partition_available"
        full["pointCount"] = len(full["points"])
        valid_periods = [point[0] for point in full["points"]]
        full["periodCoverage"] = {"start": min(valid_periods), "end": max(valid_periods),
                                  "startDate": period_start(min(valid_periods), frequency),
                                  "endDate": period_end(max(valid_periods), frequency),
                                  "nativeFrequency": frequency, "observedPeriodCount": len(set(valid_periods)),
                                  "rowCount": len(full["points"]), "completeness": "not_claimed"}
        old_full[series_id] = full
        updated_series_ids.add(series_id)

    # The refreshed output includes 90 records already present in V29; verify no
    # previously retained series, record, event, or exposure was dropped.
    if len(old_full) != publication["counts"]["series"] + len(added_series_ids):
        raise ValueError("Prior series inventory was not preserved")
    if len(snapshot["records"]) != len(old_snapshot["records"]):
        raise ValueError("Catalogue inventory changed")
    if snapshot["events"] != old_snapshot["events"] or snapshot["exposures"] != old_snapshot["exposures"]:
        raise ValueError("Event or exposure evidence changed")
    if {source["id"] for source in old_snapshot["sources"]} - {source["id"] for source in snapshot["sources"]}:
        raise ValueError("A prior source was removed")

    # V30 includes all prior points absent from the latest export and overlays
    # current-vintage points by the same record/segment/registration/period key.
    for record in snapshot["records"]:
        links = record.get("historySeries", [])
        existing_ids = {item["id"] for item in links}
        for series_id in sorted(updated_series_ids):
            full = old_full[series_id]
            if full.get("subjectRecordId") != record["id"]:
                continue
            link = {key: deepcopy(value) for key, value in full.items() if key != "points"}
            link["partition"] = None
            link["embeddedPointCount"] = min(12, len(full["points"]))
            link["points"] = deepcopy(full["points"][-12:])
            link["availability"] = "partition_available"
            if series_id in existing_ids:
                links = [link if item["id"] == series_id else item for item in links]
            else:
                links.append(link)
                existing_ids.add(series_id)
        record["historySeries"] = links

    # Re-version every immutable native partition. Create fresh pointers for V30.
    groups: dict[tuple, list[dict]] = defaultdict(list)
    for series in old_full.values():
        groups[(series.get("classification"), series.get("emirate"), series.get("frequency"),
                series.get("segment"), series.get("registration"))].append(series)
    history_objects = []
    partition_pointers = {}
    for group_key, items in sorted(groups.items(), key=lambda item: str(item[0])):
        ordered = sorted(items, key=lambda item: item["id"])
        archive = {"version": VERSION, "asOf": snapshot["asOf"],
                   "classification": "context_history_partition", "series": ordered}
        obj = immutable(gzip.compress(canonical(archive), compresslevel=9, mtime=0), ".json.gz", "history_partition")
        history_objects.append(obj)
        pointer = {k: obj[k] for k in ["key", "sha256", "bytes", "compression"]}
        for series in ordered:
            if series["id"] in partition_pointers:
                raise ValueError(f"V30 series appears in multiple partitions: {series['id']}")
            partition_pointers[series["id"]] = pointer
    if len(partition_pointers) != len(old_full):
        raise ValueError("V30 partition inventory is incomplete")

    # Point links to the new immutable partition objects.
    for record in snapshot["records"]:
        for link in record.get("historySeries", []):
            if link.get("partition") is not None or link["id"] in partition_pointers:
                link["partition"] = partition_pointers[link["id"]]

    snapshot["version"] = VERSION
    manifest = snapshot["manifest"]
    manifest["version"] = VERSION
    manifest["historicalSeriesCount"] = len(old_full)
    manifest["historicalObservationRows"] = sum(series["pointCount"] for series in old_full.values())
    manifest["collectedHistoricalObservationRows"] = (
        manifest["historicalObservationRows"] + manifest.get("rightsPendingObservationRows", 0))
    manifest["extendedTotalObservationRows"] = manifest["collectedHistoricalObservationRows"]
    manifest["dldEjariRentRecapture"] = {
        "sourceId": NEW_RENT_SOURCE,
        "buildingsSourceId": NEW_BUILDINGS_SOURCE,
        "sourceRows": rent_source["sourceRows"],
        "eligibleUniqueContracts": rent_source["eligibleUniqueContracts"],
        "exactProjectRecords": rent_source["exactProjectRecords"],
        "recordsWithContractStartsAfter2026_10_03": rent_source["recordsWithContractStartsAfter2026_10_03"],
        "contractRowsAfter2026_10_03": rent_source["contractRowsAfter2026_10_03"],
        "minimumMedianSample": MIN_SAMPLE,
        "aggregateObservationRows": sidecar["observationCount"],
        "newPeriodCells": len(new_point_cells),
        "refreshedSeries": len(updated_series_ids) - len(added_series_ids),
        "newSeries": len(added_series_ids),
        "priorOnlyCellsPreserved": preserved_prior_only_cells,
        "changedPriorVintageValues": changed_value_cells,
        "rawContractIdsRedistributed": False,
        "rawContractRowsRedistributed": False,
        "communityRecordsChanged": 0,
        "approved2080ForecastRecords": manifest.get("approved2080ForecastRecords", 0),
    }

    # Regenerate lightweight root descriptors and compact record references.
    descriptors = []
    for series in old_full.values():
        descriptor = {key: deepcopy(value) for key, value in series.items() if key != "points"}
        descriptor["partition"] = partition_pointers[series["id"]]
        descriptors.append(descriptor)
    descriptors.sort(key=lambda item: item["id"])
    compact_records = []
    old_compact = {item["id"]: item for item in old_root["records"]}
    for record in snapshot["records"]:
        compact = dict(old_compact[record["id"]])
        compact["historySeriesIds"] = [link["id"] for link in record.get("historySeries", [])]
        if "registerEvidence" in record:
            compact["registerEvidence"] = record["registerEvidence"]
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

    # Append-only, snapshot-versioned D1 index.
    sql = ["PRAGMA foreign_keys = ON;"]
    sql.append(f"INSERT OR IGNORE INTO hi_snapshots(snapshot_version,as_of,record_count,manifest_json,root_sha256) VALUES({sql_literal(VERSION)},{sql_literal(snapshot['asOf'])},1860,{sql_literal(canonical(manifest).decode())},{sql_literal(root_obj['sha256'])});")
    for record in compact_records:
        row = {key: value for key, value in record.items() if key != "historySeriesIds"}
        sql.append(f"INSERT OR IGNORE INTO hi_records(snapshot_version,record_id,record_type,name,emirate,record_json) VALUES({sql_literal(VERSION)},{sql_literal(record['id'])},{sql_literal(record['type'])},{sql_literal(record['name'])},{sql_literal(record['emirate'])},{sql_literal(canonical(row).decode())});")
    for source in snapshot["sources"]:
        sql.append(f"INSERT OR IGNORE INTO hi_sources(snapshot_version,source_id,url,source_json) VALUES({sql_literal(VERSION)},{sql_literal(source['id'])},{sql_literal(source['url'])},{sql_literal(canonical(source).decode())});")
    for event in snapshot["events"]:
        sql.append(f"INSERT OR IGNORE INTO hi_events(snapshot_version,event_id,event_json) VALUES({sql_literal(VERSION)},{sql_literal(event['id'])},{sql_literal(canonical(event).decode())});")
    for exposure in snapshot["exposures"]:
        sql.append(f"INSERT OR IGNORE INTO hi_exposures(snapshot_version,exposure_id,event_id,record_id,scope,verified,exposure_json) VALUES({sql_literal(VERSION)},{sql_literal(exposure['id'])},{sql_literal(exposure['eventId'])},{sql_literal(exposure['recordId'])},{sql_literal(exposure['scope'])},{int(exposure['verified'])},{sql_literal(canonical(exposure).decode())});")
    for series in descriptors:
        sql.append(f"INSERT OR IGNORE INTO hi_series(snapshot_version,series_id,source_id,series_json) VALUES({sql_literal(VERSION)},{sql_literal(series['id'])},{sql_literal(series['sourceId'])},{sql_literal(canonical(series).decode())});")
    for record in compact_records:
        for series_id in record.get("historySeriesIds", []):
            descriptor = next(item for item in descriptors if item["id"] == series_id)
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
            "communities": counts["communities"], "historicalRows": counts["historicalRows"],
            "series": counts["series"], "sources": counts["sources"],
            "refreshedSeries": len(updated_series_ids) - len(added_series_ids),
            "newSeries": len(added_series_ids), "newPeriodCells": len(new_point_cells),
            "priorOnlyCellsPreserved": preserved_prior_only_cells,
            "changedPriorVintageValues": changed_value_cells,
            "approved2080ForecastRecords": manifest.get("approved2080ForecastRecords", 0)}


if __name__ == "__main__":
    print(json.dumps(main(), sort_keys=True))
