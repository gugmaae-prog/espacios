#!/usr/bin/env python3
"""Append verified September 2026 DLD-derived project-register snapshots.

The publisher's public CSV is licensed CC BY 4.0. It is a secondary DLD-derived
snapshot, so its values remain separate from the earlier DLD authority capture.
Only exact catalogue-name rows whose developer, area, and stable DLD project ID
agree with existing verified DLD register evidence are accepted.
"""
from __future__ import annotations

import csv
import gzip
import hashlib
import importlib.util
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "data/historical-intelligence"
SNAPSHOT_PATH = ROOT / "data/historical-intelligence-20261003.json"
PUBLICATION_PATH = BASE / "publication-manifest.json"
INPUT_PATH = BASE / "cp-dubai-project-register-2026.csv.gz"
OUT_PATH = BASE / "dld-derived-project-register-enrichment-20261008.json"
VERSION = "20261008-enrichment-v26"
SOURCE_ID = "cp-dubai-project-register-2026"
SOURCE_URL = "https://certifiedpoor.com/open-data/dubai-project-register-2026.csv"
SOURCE_SHA256 = "4f5365e88b5016edd9e157dac10b99d06fb8d4ca4579c9b4e1012e3fd84c92d7"
SOURCE_BYTES = 46867
SOURCE_ROW_COUNT = 373
SOURCE_SNAPSHOT = "2026-09-01"
SOURCE_PUBLISHED = "2026-09-01T08:35:09+00:00"
SOURCE_RETRIEVED = "2026-10-04T20:41:06.249172+00:00"
LICENCE = "CC BY 4.0; explicit publisher declaration at https://certifiedpoor.com/open-data/"
DLD_PROJECT_SOURCE = "dld-official-projects-20260706"

# Locked after exact catalogue title + DLD project ID + developer + area review.
EXPECTED = {
    "Akala Hotels and Residences": ("project:akala-hotels-and-residences-by-arada", "755968043"),
    "Eltiera Views": ("project:eltiera-views-jumeirah-islands-dubai", "818262481"),
    "Aurea": ("project:aurea-emaar-rashid-yachts-marina-dubai", "818123439"),
    "TALEA": ("project:talea-by-beyond-dubai-maritime-city", "785577291"),
    "Damac District": ("project:damac-district-damac-hills-dubai", "808469661"),
    "Derby Heights": ("project:derby-heights-amis-meydan-dubai", "821905039"),
    "Olbia": ("project:olbia-nshama-town-square-dubai", "757227732"),
    "Helvetia Verde": ("project:helvetia-verde-dhg-properties-meydan-horizon-dubai", "806003262"),
}


def canonical(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode()


def sha(blob):
    return hashlib.sha256(blob).hexdigest()


def norm(value):
    value = unicodedata.normalize("NFKC", str(value or "")).casefold()
    return " ".join(re.sub(r"[^\w]+", " ", value).split())


def immutable(blob, suffix, kind):
    digest = sha(blob)
    rel = f"objects/{digest}{suffix}"
    path = BASE / rel
    if path.exists() and path.read_bytes() != blob:
        raise ValueError(f"Immutable object collision: {rel}")
    if not path.exists():
        path.write_bytes(blob)
    return {"key": f"research/published/2026-10-08/historical-intelligence/{rel}",
            "path": str(path.relative_to(ROOT)), "sha256": digest, "bytes": len(blob),
            "kind": kind, "compression": "gzip" if suffix.endswith(".gz") else None}


def int_or_none(value):
    value = str(value or "").strip()
    return int(value) if value else None


def float_or_none(value):
    value = str(value or "").strip()
    return float(value) if value else None


def load_input():
    raw = gzip.decompress(INPUT_PATH.read_bytes())
    if sha(raw) != SOURCE_SHA256 or len(raw) != SOURCE_BYTES:
        raise ValueError("Certified Poor CSV does not match the source-register checksum")
    rows = list(csv.DictReader(raw.decode("utf-8-sig").splitlines()))
    if len(rows) != SOURCE_ROW_COUNT:
        raise ValueError(f"Expected {SOURCE_ROW_COUNT} source rows, found {len(rows)}")
    return rows


def verified_register(record):
    candidates = []
    for evidence in record.get("registerEvidence", []):
        fields = evidence.get("fields") or {}
        if (evidence.get("identityVerified") is True and evidence.get("scope") == "subject"
                and DLD_PROJECT_SOURCE in evidence.get("sourceIds", [])
                and evidence.get("registeredProjectId")
                and fields.get("registeredDeveloperName") and fields.get("areaName")):
            candidates.append(evidence)
    if len(candidates) != 1:
        raise ValueError(f"Expected one identity-verified DLD project register fact for {record['id']}; found {len(candidates)}")
    return candidates[0]


def make_packet(snapshot, rows):
    source_by_id = {source["id"]: source for source in snapshot["sources"]}
    source = source_by_id.get(SOURCE_ID)
    if not source or source.get("sha256") != SOURCE_SHA256 or source.get("publishedAt") != SOURCE_PUBLISHED:
        raise ValueError("Pinned DLD-derived published source metadata is missing or changed")
    if source.get("licence") != LICENCE or source.get("publisher") != "Certified Poor; independent DLD-derived data publisher":
        raise ValueError("Source publisher or reuse licence changed")

    records = {record["id"]: record for record in snapshot["records"]}
    by_name = defaultdict(list)
    for record in snapshot["records"]:
        if record.get("type") == "project":
            by_name[norm(record.get("name"))].append(record)
    source_name_rows = defaultdict(list)
    for row in rows:
        source_name_rows[norm(row.get("project_name"))].append(row)

    selected = {}
    quarantines = []
    for display_name, (record_id, expected_project_id) in EXPECTED.items():
        name_rows = source_name_rows.get(norm(display_name), [])
        name_records = by_name.get(norm(display_name), [])
        if len(name_rows) != 1 or len(name_records) != 1:
            raise ValueError(f"Exact-name source/catalogue mapping is not unique for {display_name}")
        row, record = name_rows[0], name_records[0]
        if record["id"] != record_id:
            raise ValueError(f"Catalogue record ID changed for {display_name}")
        dld = verified_register(record)
        fields = dld["fields"]
        if str(dld["registeredProjectId"]) != expected_project_id:
            raise ValueError(f"DLD registered project ID changed for {display_name}")
        if norm(row.get("developer")) != norm(fields.get("registeredDeveloperName")):
            raise ValueError(f"DLD-derived developer conflicts with DLD registered developer for {display_name}")
        if norm(row.get("area")) != norm(fields.get("areaName")):
            raise ValueError(f"DLD-derived area conflicts with DLD registered area for {display_name}")
        if not row.get("start_date") or not row.get("filed_completion_date"):
            raise ValueError(f"Expected dates are missing for {display_name}")
        if row.get("construction_percent", "").strip():
            percent = float_or_none(row["construction_percent"])
            if percent is None or not 0 <= percent <= 100:
                raise ValueError(f"Invalid construction percentage for {display_name}")
        if row.get("status", "").strip().upper() not in {"ACTIVE", "PENDING", "NOT_STARTED", "FINISHED", "CANCELLED", "CANCELED"}:
            raise ValueError(f"Unrecognized source project status for {display_name}")
        selected[record_id] = (record, row, dld)

    # Any additional exact English title match is deliberately withheld unless
    # the independent DLD project ID, area, and registered developer all agree.
    for row in rows:
        candidates = by_name.get(norm(row.get("project_name")), [])
        if len(candidates) == 1 and candidates[0]["id"] not in selected:
            record = candidates[0]
            try:
                dld = verified_register(record)
                f = dld["fields"]
                if norm(row.get("developer")) != norm(f.get("registeredDeveloperName")):
                    reason = "DLD-derived developer does not match the record's identity-verified DLD registered developer."
                elif norm(row.get("area")) != norm(f.get("areaName")):
                    reason = "DLD-derived area does not match the record's identity-verified DLD registered area."
                else:
                    reason = "Exact identity combination requires an explicit reviewed mapping before promotion."
            except ValueError:
                reason = "No single identity-verified DLD subject register record with a stable project ID, developer, and area is attached to the catalogue project."
            quarantines.append({"recordId": record["id"], "name": record["name"],
                                "sourceProjectName": row.get("project_name"),
                                "sourceDeveloper": row.get("developer"), "sourceArea": row.get("area"),
                                "reason": reason})

    if len(selected) != len(EXPECTED):
        raise ValueError("Accepted source-to-record identity count changed")
    facts = []
    milestones = []
    comparisons = {}
    for record_id, (record, row, dld) in selected.items():
        old = dld["fields"]
        project_id = str(dld["registeredProjectId"])
        project_number = str(old.get("projectNumber") or "")
        if not project_number:
            raise ValueError(f"Official project number missing for {record['name']}")
        comparison = {
            "priorOfficialSnapshotDate": old.get("snapshotDate"),
            "priorOfficialSourceLoadTimestamp": old.get("load_timestamp"),
            "priorOfficialStatus": old.get("project_status"),
            "priorOfficialProgressPercent": float_or_none(old.get("percent_completed")),
            "priorOfficialExpectedStartDate": old.get("project_start_date"),
            "priorOfficialExpectedEndDate": old.get("project_end_date"),
            "priorOfficialRegisteredUnits": int_or_none(old.get("no_of_units")),
            "statusDiffers": (row.get("status", "").strip().upper() != str(old.get("project_status", "")).strip().upper()),
            "progressDiffers": (float_or_none(row.get("construction_percent")) != float_or_none(old.get("percent_completed"))),
            "expectedStartDiffers": (row.get("start_date") != old.get("project_start_date")),
            "expectedEndDiffers": (row.get("filed_completion_date") != old.get("project_end_date")),
            "registeredUnitsDiffer": (int_or_none(row.get("registered_units")) != int_or_none(old.get("no_of_units"))),
        }
        comparisons[record_id] = comparison
        if any(comparison[key] for key in ["statusDiffers", "progressDiffers", "expectedStartDiffers", "expectedEndDiffers", "registeredUnitsDiffer"]):
            comparisons[record_id]["comparisonMeaning"] = "Different dated source snapshots are preserved side by side; no previous DLD value was overwritten and no later source value is assumed to be a correction."
        ident = f"cp-dld-project-register-{project_number}-20260901"
        if any(existing.get("id") == ident for existing in record.get("registerEvidence", [])):
            raise ValueError(f"Register evidence already exists for {record['name']}")
        ids = list(dict.fromkeys([SOURCE_ID, *dld.get("sourceIds", []), *dld.get("identitySourceIds", [])]))
        identity_ids = list(dict.fromkeys([DLD_PROJECT_SOURCE, *dld.get("identitySourceIds", [])]))
        identity = (
            "Exact normalized project name matches one unique catalogue project and one source row. "
            "The DLD-derived row's developer and area exactly match the record's identity-verified DLD register fact, "
            f"which supplies stable registered project ID {project_id} and project number {project_number}. "
            "The source is an independent DLD-derived publisher snapshot, not a direct DLD API response."
        )
        register_fields = {
            "projectName": row["project_name"],
            "projectNumber": project_number,
            "registeredProjectId": project_id,
            "developerName": row["developer"],
            "areaName": row["area"],
            "sourceSnapshotDate": SOURCE_SNAPSHOT,
            "projectStatus": row.get("status") or None,
            "constructionPercent": float_or_none(row.get("construction_percent")),
            "registeredUnits": int_or_none(row.get("registered_units")),
            "declaredProjectValueAED": int_or_none(row.get("declared_value_aed")),
            "escrowStatus": row.get("escrow_status") or None,
            "expectedProjectStartDate": row.get("start_date") or None,
            "expectedProjectEndDate": row.get("filed_completion_date") or None,
            "fieldSemantics": {
                "projectStatus": "Source-reported DLD-derived project register status at this published snapshot; not proof of handover or occupancy.",
                "constructionPercent": "DLD-derived project completion percentage; the source does not provide the underlying inspection date for this row.",
                "expectedProjectStartDate": "Expected project start date; actual construction commencement is not established.",
                "expectedProjectEndDate": "Expected date of project termination; not an actual completion certificate or handover date.",
                "declaredProjectValueAED": "Register-declared project value; not a market valuation, sale price, or current property value.",
                "registeredUnits": "Source-reported registered unit count; counts may differ between dated snapshots and are retained as reported.",
            },
            "comparisonWithEarlierOfficialDldSnapshot": comparison,
            "scopeLimit": "This is one DLD-derived register snapshot for the matched project; it does not establish complete financial history, actual completion, occupancy, valuation, or total units delivered.",
        }
        facts.append({
            "recordId": record_id,
            "id": ident,
            "registeredProjectId": project_id,
            "scope": "subject",
            "identityVerified": True,
            "classification": "independent_dld_derived_project_register_snapshot",
            "sourceIds": ids,
            "identitySourceIds": identity_ids,
            "identityBasis": identity,
            "publishedAt": SOURCE_PUBLISHED,
            "firstAvailableAt": SOURCE_PUBLISHED,
            "retrievedAt": SOURCE_RETRIEVED,
            "fields": register_fields,
        })
        percent = float_or_none(row.get("construction_percent"))
        if percent is not None:
            milestone_id = f"cp-dld-register-progress-{project_number}-20260901"
            if any(existing.get("id") == milestone_id for existing in record.get("lifecycle", [])):
                raise ValueError(f"Progress milestone already exists for {record['name']}")
            milestones.append({
                "recordId": record_id,
                "milestone": {
                    "id": milestone_id,
                    "kind": "construction_progress",
                    "date": {"start": SOURCE_SNAPSHOT, "precision": "day"},
                    "dateBasis": "source_publication_snapshot; underlying inspection date not reported",
                    "eventStatus": "reported",
                    "status": "reported",
                    "scope": "subject",
                    "primaryEvidence": False,
                    "identityVerified": True,
                    "sourceIds": [SOURCE_ID],
                    "identitySourceIds": identity_ids,
                    "identityBasis": identity,
                    "evidenceClass": "third_party_dld_derived_project_register_progress_snapshot",
                    "label": "DLD-derived construction progress reported in the 1 September 2026 register snapshot",
                    "progressPercent": percent,
                    "note": "The date is the dataset publication snapshot, not the underlying site-inspection date. DLD defines completion percentage as inspection-request based. A percentage snapshot does not establish actual completion, handover, or occupancy.",
                    "publishedAt": SOURCE_PUBLISHED,
                    "firstAvailableAt": SOURCE_PUBLISHED,
                    "retrievedAt": SOURCE_RETRIEVED,
                },
            })
        # The source schema documents start_date as the expected, not actual,
        # project start. Retain the latest dated expectation as its own report.
        target_id = f"cp-dld-register-target-start-{project_number}-20260901"
        if not any(existing.get("id") == target_id for existing in record.get("lifecycle", [])):
            milestones.append({
                "recordId": record_id,
                "milestone": {
                    "id": target_id,
                    "kind": "target_construction_start",
                    "date": {"start": row["start_date"], "precision": "day"},
                    "eventStatus": "reported",
                    "status": "reported",
                    "scope": "subject",
                    "primaryEvidence": False,
                    "identityVerified": True,
                    "sourceIds": [SOURCE_ID],
                    "identitySourceIds": identity_ids,
                    "identityBasis": identity,
                    "evidenceClass": "third_party_dld_derived_project_register_target",
                    "label": "DLD-derived expected project start date; actual construction commencement not established",
                    "note": "The DLD project-register field is defined as the expected date for project start. Preserve this source-specific target even if an earlier source reports another schedule; no actual construction date is inferred.",
                    "publishedAt": SOURCE_PUBLISHED,
                    "firstAvailableAt": SOURCE_PUBLISHED,
                    "retrievedAt": SOURCE_RETRIEVED,
                },
            })

    return facts, milestones, comparisons, quarantines


def main():
    snapshot = json.loads(SNAPSHOT_PATH.read_text())
    publication = json.loads(PUBLICATION_PATH.read_text())
    if snapshot.get("version") != "20261008-enrichment-v25" or publication.get("version") != snapshot["version"]:
        raise ValueError("Expected the verified V25 source catalogue")
    if publication.get("counts", {}).get("records") != 1860:
        raise ValueError("Catalogue record count changed")
    root_obj = publication.get("rootIndex") or {}
    root_path = ROOT / root_obj.get("path", "")
    root_blob = root_path.read_bytes()
    if sha(root_blob) != root_obj.get("sha256"):
        raise ValueError("Published V25 root checksum mismatch")
    prior_root = json.loads(gzip.decompress(root_blob))
    rows = load_input()
    facts, milestones, comparisons, quarantines = make_packet(snapshot, rows)
    exact_name_candidate_rows = sum(
        1 for row in rows
        if sum(1 for record in snapshot["records"]
               if record.get("type") == "project" and norm(record.get("name")) == norm(row.get("project_name"))) == 1
    )
    if exact_name_candidate_rows != 55 or len(quarantines) != exact_name_candidate_rows - len(facts):
        raise ValueError("Exact-name review and quarantine counts changed; update the locked identity review")
    if len(facts) != 8 or len(milestones) != 16:
        raise ValueError(f"Expected 8 register snapshots and 16 lifecycle additions; found {len(facts)} and {len(milestones)}")

    old_snapshot = deepcopy(snapshot)
    records = {record["id"]: record for record in snapshot["records"]}
    source_map = {source["id"]: source for source in snapshot["sources"]}
    for fact in facts:
        record = records[fact["recordId"]]
        if any(item.get("id") == fact["id"] for item in record.get("registerEvidence", [])):
            raise ValueError("Duplicate register evidence ID")
        record.setdefault("registerEvidence", []).append({k: v for k, v in fact.items() if k != "recordId"})
    for row in milestones:
        record = records[row["recordId"]]
        record.setdefault("lifecycle", []).append(row["milestone"])

    # Refresh the per-record evidence ledger only for the eight changed projects.
    sys.path.insert(0, str(ROOT / "scripts"))
    from historical_gap_ledger import refresh_research_coverage
    # The canonical source stores point arrays on record historySeries; the
    # compact publication root is the authoritative full-series index.
    series_by_id = {series["id"]: series for series in prior_root["series"]}
    sources_by_id = {source["id"]: source for source in snapshot["sources"]}
    record_by_id = {record["id"]: record for record in snapshot["records"]}
    exposures_by_record = defaultdict(list)
    for exposure in snapshot.get("exposures", []):
        exposures_by_record[exposure["recordId"]].append(exposure)
    for record_id in EXPECTED.values():
        record_id = record_id[0]
        record = records[record_id]
        prior_research_status = deepcopy(record["researchStatus"])
        community = record_by_id.get(record.get("sharedCommunityHistoryId"))
        refresh_research_coverage(
            record, series_by_id, sources_by_id, snapshot["asOf"],
            community.get("historySeries", []) if community else None,
            exposures_by_record[record_id],
        )
        refreshed = record["researchStatus"]["itemCoverage"]
        # This pass adds construction evidence only. A partial series index or
        # context argument must never erase previously accepted coverage for
        # sales, events, valuation, rentals, or forecasts.
        record["researchStatus"] = prior_research_status
        record["researchStatus"].setdefault("itemCoverage", {})["construction"] = refreshed["construction"]
        record["researchStatus"]["itemCoverage"]["construction_targets"] = refreshed["construction_targets"]

    # Assert append-only behavior and immutable non-project populations.
    unchanged_keys = ["id", "observations", "historySeries", "historySeriesIds", "currentSnapshot", "scenarioInputs", "scenarioCoverage"]
    changed_ids = set(EXPECTED[x][0] for x in EXPECTED)
    for before, after in zip(old_snapshot["records"], snapshot["records"]):
        if before["id"] not in changed_ids:
            if before != after:
                raise ValueError(f"Unexpected change outside the eight exact records: {before['id']}")
            continue
        for key in unchanged_keys:
            if before.get(key) != after.get(key):
                raise ValueError(f"Existing financial, market, or scenario field changed for {before['id']}: {key}")
        for collection in ["observations", "historySeries"]:
            if before.get(collection, []) != after.get(collection, []):
                raise ValueError(f"Financial history changed for {before['id']}")
    if len(snapshot["records"]) != 1860 or sum(r["type"] == "project" for r in snapshot["records"]) != 1645 or sum(r["type"] == "community" for r in snapshot["records"]) != 215:
        raise ValueError("Catalogue/project/community inventory changed")
    if snapshot.get("series") != old_snapshot.get("series") or snapshot.get("events") != old_snapshot.get("events") or snapshot.get("exposures") != old_snapshot.get("exposures"):
        raise ValueError("History series, events, or event exposure links changed")

    snapshot["version"] = VERSION
    manifest = snapshot["manifest"]
    manifest["version"] = VERSION
    manifest["dldDerivedProjectRegisterSeptember2026"] = {
        "sourceId": SOURCE_ID, "sourceSha256": SOURCE_SHA256, "sourceRows": SOURCE_ROW_COUNT,
        "sourceSnapshotDate": SOURCE_SNAPSHOT, "exactProjectRecordsAdded": len(facts),
        "uniqueExactCatalogueNameRowsReviewed": exact_name_candidate_rows,
        "exactTitleRowsQuarantined": len(quarantines),
        "progressSnapshotMilestonesAdded": sum(x["milestone"]["kind"] == "construction_progress" for x in milestones),
        "expectedStartMilestonesAdded": sum(x["milestone"]["kind"] == "target_construction_start" for x in milestones),
        "identityRule": "Unique exact catalogue project name + verified DLD registered project ID + exact developer and area agreement with existing official DLD register evidence.",
        "conflictingSnapshotsPreserved": True,
        "financialObservationsAdded": 0,
        "valuationObservationsAdded": 0,
        "actualCompletionsAdded": 0,
        "occupancyClaimsAdded": 0,
        "approved2080ForecastRecords": manifest.get("approved2080ForecastRecords", 0),
        "unmatchedRowsExcluded": SOURCE_ROW_COUNT - exact_name_candidate_rows,
        "allExcludedRows": SOURCE_ROW_COUNT - len(facts),
    }
    manifest["completionDefinition"] = "Every record evaluated; observed financial coverage remains incomplete; DLD-derived register snapshots do not constitute complete price history or forecasts."
    snapshot["manifest"] = manifest
    snapshot["asOf"] = old_snapshot["asOf"]

    packet = {
        "schemaVersion": 1, "passId": "dld-derived-project-register-20260901",
        "asOf": snapshot["asOf"], "sources": [], "facts": facts,
        "lifecycleMilestones": milestones,
        "reconciliation": comparisons,
        "quarantines": quarantines,
        "sourceRowsWithoutUniqueExactCatalogueName": SOURCE_ROW_COUNT - exact_name_candidate_rows,
        "methodology": "Reconciled the CC BY 4.0 public DLD-derived register (373 rows, source SHA-256 verified) to catalogue projects by a unique exact normalized project name, then required the source developer and area to exactly match an existing identity-verified DLD project-register record with the same stable DLD project ID. Eight rows passed. The status/progress/units/date values are stored as a dated secondary snapshot beside the earlier authority capture; differences are not overwritten or silently treated as corrections. Expected dates remain expected. The completion percentage snapshot's underlying inspection date is unavailable. Declared project value is not a property valuation. No prices, rents, actual completion, occupancy, or 2080 forecasts were added.",
    }

    # Re-version the canonical immutable history partitions while preserving all
    # native points and every non-history object.
    def immutable_local(blob, suffix, kind):
        obj = immutable(blob, suffix, kind)
        return obj

    new_history = []
    partition_pointers = {}
    for prior in publication["objects"]:
        if prior["kind"] != "history_partition":
            continue
        archived = json.loads(gzip.decompress((ROOT / prior["path"]).read_bytes()))
        if archived.get("version") != old_snapshot["version"] or archived.get("asOf") != snapshot["asOf"]:
            raise ValueError("Native history partition does not match the V25 baseline")
        archived["version"] = VERSION
        obj = immutable_local(gzip.compress(canonical(archived), mtime=0), ".json.gz", "history_partition")
        new_history.append(obj)
        pointer = {k: obj[k] for k in ["key", "sha256", "bytes", "compression"]}
        for series in archived["series"]:
            if series["id"] in partition_pointers:
                raise ValueError("Native series occurs in multiple history partitions")
            partition_pointers[series["id"]] = pointer
    if len(partition_pointers) != len(prior_root["series"]):
        raise ValueError("Native history series inventory changed")
    for record in snapshot["records"]:
        for link in record.get("historySeries", []):
            if link.get("partition"):
                link["partition"] = partition_pointers[link["id"]]
    for series in prior_root["series"]:
        series["partition"] = partition_pointers[series["id"]]

    compact_records = []
    prior_compact = {record["id"]: record for record in prior_root["records"]}
    for full in snapshot["records"]:
        compact = deepcopy(prior_compact[full["id"]])
        if full["id"] in changed_ids:
            for key in ["lifecycle", "registerEvidence", "researchStatus"]:
                if key in full:
                    compact[key] = deepcopy(full[key])
        compact_records.append(compact)
    old_version_keys = {"runtime_history_partition", "runtime_record_shard", "runtime_index", "history_partition", "full_snapshot_index"}
    objects = [o for o in publication["objects"] if o["kind"] not in old_version_keys]
    objects.extend(new_history)
    prior_root.update({"version": VERSION, "asOf": snapshot["asOf"], "manifest": manifest,
                       "sources": snapshot["sources"], "records": compact_records})
    root_object = immutable_local(gzip.compress(canonical(prior_root), mtime=0), ".json.gz", "full_snapshot_index")
    objects.append(root_object)
    counts = dict(publication["counts"])
    new_publication = {"version": VERSION, "asOf": snapshot["asOf"], "rootIndex": root_object,
                       "objects": objects, "counts": counts}

    # Rebuild the append-only D1 index to index the new evidence snapshots.
    sql_literal = lambda value: "'" + str(value).replace("'", "''") + "'"
    sql = ["PRAGMA foreign_keys = ON;"]
    sql.append(f"INSERT OR IGNORE INTO hi_snapshots(snapshot_version,as_of,record_count,manifest_json,root_sha256) VALUES({sql_literal(VERSION)},{sql_literal(snapshot['asOf'])},1860,{sql_literal(canonical(manifest).decode())},{sql_literal(root_object['sha256'])});")
    for record in compact_records:
        row = {k: v for k, v in record.items() if k != "historySeriesIds"}
        sql.append(f"INSERT OR IGNORE INTO hi_records(snapshot_version,record_id,record_type,name,emirate,record_json) VALUES({sql_literal(VERSION)},{sql_literal(record['id'])},{sql_literal(record['type'])},{sql_literal(record['name'])},{sql_literal(record['emirate'])},{sql_literal(canonical(row).decode())});")
    for source in snapshot["sources"]:
        sql.append(f"INSERT OR IGNORE INTO hi_sources(snapshot_version,source_id,url,source_json) VALUES({sql_literal(VERSION)},{sql_literal(source['id'])},{sql_literal(source.get('url',''))},{sql_literal(canonical(source).decode())});")
    for event in snapshot["events"]:
        sql.append(f"INSERT OR IGNORE INTO hi_events(snapshot_version,event_id,event_json) VALUES({sql_literal(VERSION)},{sql_literal(event['id'])},{sql_literal(canonical(event).decode())});")
    for exposure in snapshot["exposures"]:
        sql.append(f"INSERT OR IGNORE INTO hi_exposures(snapshot_version,exposure_id,event_id,record_id,scope,verified,exposure_json) VALUES({sql_literal(VERSION)},{sql_literal(exposure['id'])},{sql_literal(exposure['eventId'])},{sql_literal(exposure['recordId'])},{sql_literal(exposure['scope'])},{int(exposure['verified'])},{sql_literal(canonical(exposure).decode())});")
    for series in prior_root["series"]:
        sql.append(f"INSERT OR IGNORE INTO hi_series(snapshot_version,series_id,source_id,series_json) VALUES({sql_literal(VERSION)},{sql_literal(series['id'])},{sql_literal(series['sourceId'])},{sql_literal(canonical(series).decode())});")
    for record in compact_records:
        for series_id in record.get("historySeriesIds", []):
            descriptor = next(item for item in prior_root["series"] if item["id"] == series_id)
            sql.append(f"INSERT OR IGNORE INTO hi_record_series(snapshot_version,record_id,series_id,scope,identity_verified) VALUES({sql_literal(VERSION)},{sql_literal(record['id'])},{sql_literal(series_id)},{sql_literal(descriptor.get('scope','area_context'))},{int(descriptor.get('identityVerified',False))});")
    d1_obj = immutable_local(gzip.compress(("\n".join(sql) + "\n").encode(), mtime=0), ".sql.gz", "d1_append_only_index")
    new_publication["d1Index"] = d1_obj

    # Preserve exact before/after identities and counts in the compact pass packet.
    packet["reconciliation"] = comparisons
    OUT_PATH.write_bytes(canonical(packet) + b"\n")
    SNAPSHOT_PATH.write_bytes(canonical(snapshot) + b"\n")
    PUBLICATION_PATH.write_bytes(canonical(new_publication) + b"\n")
    module_spec = importlib.util.spec_from_file_location("build_historical_data", ROOT / "scripts/build-historical-data.py")
    module = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(module)
    module.build_runtime_index(snapshot, new_publication)

    print(json.dumps({
        "version": VERSION, "records": len(snapshot["records"]), "projects": 1645, "communities": 215,
        "matchedProjects": len(facts), "registerSnapshotsAdded": len(facts),
        "constructionProgressSnapshotsAdded": sum(x["milestone"]["kind"] == "construction_progress" for x in milestones),
        "targetConstructionStartReportsAdded": sum(x["milestone"]["kind"] == "target_construction_start" for x in milestones),
        "seriesPreserved": len(prior_root["series"]), "historicalRowsPreserved": counts["historicalRows"],
        "financialObservationsAdded": 0, "approved2080ForecastRecords": manifest.get("approved2080ForecastRecords", 0),
        "sourceConflictsRetained": sum(bool(c.get("comparisonMeaning")) for c in comparisons.values()),
    }, sort_keys=True))


if __name__ == "__main__":
    main()
