#!/usr/bin/env python3
"""Append a reviewed non-financial lifecycle pass as an immutable snapshot.

This intentionally narrow release tool is for primary-source lifecycle and
developer-status evidence.  It never accepts financial facts or forecasts,
never rewrites existing facts, and rewrites immutable archive envelopes only
to point at the next snapshot version/as-of cutoff.
"""
import argparse
import collections
import gzip
import hashlib
import importlib.util
import json
from copy import deepcopy
from pathlib import Path

from historical_enrichment import apply_enrichment


ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "data" / "historical-intelligence"
SNAPSHOT_PATH = ROOT / "data" / "historical-intelligence-20261003.json"
PUBLICATION_PATH = BASE / "publication-manifest.json"


def canonical(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode()


def digest(value):
    return hashlib.sha256(value).hexdigest()


def sql_literal(value):
    return "'" + str(value).replace("'", "''") + "'"


def immutable(blob, suffix, kind, as_of):
    checksum = digest(blob)
    path = BASE / "objects" / f"{checksum}{suffix}"
    if path.exists() and path.read_bytes() != blob:
        raise ValueError(f"Immutable object collision: {path}")
    if not path.exists():
        path.write_bytes(blob)
    return {
        "key": f"research/published/{as_of}/historical-intelligence/objects/{path.name}",
        "path": str(path.relative_to(ROOT)),
        "sha256": checksum,
        "bytes": len(blob),
        "kind": kind,
        "compression": "gzip",
    }


def load_subject_series(root_index, publication, affected):
    descriptors = {item["id"]: item for item in root_index["series"]}
    required = {
        item["id"]
        for record in affected
        for item in record.get("historySeries", [])
        if item.get("scope") == "subject" and item.get("identityVerified") is True
    }
    if not required:
        return {}
    objects = {item["sha256"]: item for item in publication["objects"]}
    grouped = collections.defaultdict(set)
    for series_id in required:
        pointer = descriptors[series_id]["partition"]
        grouped[pointer["sha256"]].add(series_id)
    loaded = {}
    for checksum, identifiers in grouped.items():
        item = objects[checksum]
        raw = (ROOT / item["path"]).read_bytes()
        if digest(raw) != checksum:
            raise ValueError(f"Historical partition checksum mismatch: {checksum}")
        partition = json.loads(gzip.decompress(raw))
        for series in partition["series"]:
            if series["id"] in identifiers:
                loaded[series["id"]] = series
    if set(loaded) != required:
        raise ValueError("Unable to recover every affected subject series")
    return loaded


def assert_identity_checks(snapshot, packet):
    records = {record["id"]: record for record in snapshot["records"]}
    for check in packet.get("recordIdentityChecks", []):
        record = records.get(check.get("recordId"))
        if not record:
            raise ValueError(f"Identity check references absent record: {check.get('recordId')}")
        for field in ["catalogueName", "type", "emirate", "communityId"]:
            if field in check:
                target = "name" if field == "catalogueName" else field
                if record.get(target) != check[field]:
                    raise ValueError(f"Identity check mismatch for {record['id']}: {field}")
        if not check.get("identitySourceIds") or not check.get("identityBasis"):
            raise ValueError(f"Identity check lacks source proof: {record['id']}")
        same_name = [
            row for row in snapshot["records"]
            if row.get("type") == record.get("type")
            and row.get("emirate") == record.get("emirate")
            and row.get("name", "").casefold() == record.get("name", "").casefold()
        ]
        if len(same_name) != 1:
            raise ValueError(f"Name/emirate identity is not unique for {record['id']}")


def append_d1_index(snapshot, root, root_pointer, version, as_of):
    sql = ["PRAGMA foreign_keys = ON;"]

    def insert(table, columns, values):
        rendered = ",".join(str(value) if isinstance(value, int) else sql_literal(value) for value in values)
        sql.append(f"INSERT OR IGNORE INTO {table}({','.join(columns)}) VALUES({rendered});")

    manifest = snapshot["manifest"]
    insert("hi_snapshots", ["snapshot_version", "as_of", "record_count", "manifest_json", "root_sha256"], [version, as_of, len(snapshot["records"]), canonical(manifest).decode(), root_pointer["sha256"]])
    # The root carries compact records; full record/shard payloads are retained
    # separately in immutable R2 objects.  Do not inflate D1 with the full
    # embedded history-series descriptors on every release.
    for record in root["records"]:
        compact = {key: value for key, value in record.items() if key != "historySeriesIds"}
        insert("hi_records", ["snapshot_version", "record_id", "record_type", "name", "emirate", "record_json"], [version, record["id"], record["type"], record["name"], record["emirate"], canonical(compact).decode()])
    for source in snapshot["sources"]:
        insert("hi_sources", ["snapshot_version", "source_id", "url", "source_json"], [version, source["id"], source.get("url", ""), canonical(source).decode()])
    for event in snapshot["events"]:
        insert("hi_events", ["snapshot_version", "event_id", "event_json"], [version, event["id"], canonical(event).decode()])
    for exposure in snapshot["exposures"]:
        insert("hi_exposures", ["snapshot_version", "exposure_id", "event_id", "record_id", "scope", "verified", "exposure_json"], [version, exposure["id"], exposure["eventId"], exposure["recordId"], exposure["scope"], int(exposure["verified"]), canonical(exposure).decode()])
    descriptors = {series["id"]: series for series in root["series"]}
    for series in root["series"]:
        insert("hi_series", ["snapshot_version", "series_id", "source_id", "series_json"], [version, series["id"], series["sourceId"], canonical(series).decode()])
    for record in root["records"]:
        for series_id in record.get("historySeriesIds", []):
            series = descriptors[series_id]
            insert("hi_record_series", ["snapshot_version", "record_id", "series_id", "scope", "identity_verified"], [version, record["id"], series_id, series.get("scope", "area_context"), int(series.get("identityVerified", False))])
    return immutable(gzip.compress(("\n".join(sql) + "\n").encode(), mtime=0), ".sql.gz", "d1_append_only_index", as_of)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--packet", required=True, type=Path, help="Reviewed supplemental lifecycle packet relative to the repository root or absolute.")
    parser.add_argument("--receipt", required=True, type=Path, help="Public-safe reconciliation receipt relative to the repository root or absolute.")
    args = parser.parse_args()
    packet_path = args.packet if args.packet.is_absolute() else ROOT / args.packet
    receipt_path = args.receipt if args.receipt.is_absolute() else ROOT / args.receipt

    snapshot = json.loads(SNAPSHOT_PATH.read_bytes())
    publication = json.loads(PUBLICATION_PATH.read_bytes())
    packet = json.loads(packet_path.read_bytes())
    prior_version = snapshot["version"]
    version = packet.get("candidateVersion")
    as_of = packet.get("asOf")
    if not version or not as_of or packet.get("priorVersion") != prior_version or publication["version"] != prior_version:
        raise ValueError("Packet lineage or target version does not match the current immutable snapshot")
    if packet.get("priorSHA256") != digest(SNAPSHOT_PATH.read_bytes()):
        raise ValueError("Packet prior snapshot checksum does not match")
    if as_of < snapshot["asOf"]:
        raise ValueError("Target cutoff cannot precede the current snapshot")
    if packet.get("preserveExistingFinancialCoverage") is not True:
        raise ValueError("Lifecycle supplemental releases must preserve financial coverage")
    if packet.get("collection", {}).get("newFinancialObservations") != 0:
        raise ValueError("Lifecycle supplemental releases cannot introduce financial observations")
    accepted = [fact for fact in packet.get("facts", []) if fact.get("status") == "accepted"]
    if not accepted or any(fact.get("kind") != "lifecycle" for fact in accepted):
        raise ValueError("A lifecycle supplemental release requires accepted lifecycle facts only")
    if len({fact.get("id") for fact in accepted}) != len(accepted):
        raise ValueError("Duplicate lifecycle fact identifiers")
    if len({source.get("id") for source in packet.get("sources", [])}) != len(packet.get("sources", [])):
        raise ValueError("Duplicate source identifiers in packet")
    assert_identity_checks(snapshot, packet)

    original = deepcopy(snapshot)
    prior_root_path = ROOT / publication["rootIndex"]["path"]
    prior_root_raw = prior_root_path.read_bytes()
    if digest(prior_root_raw) != publication["rootIndex"]["sha256"]:
        raise ValueError("Prior root checksum does not match publication manifest")
    prior_root = json.loads(gzip.decompress(prior_root_raw))
    if prior_root["version"] != prior_version or prior_root["asOf"] != snapshot["asOf"]:
        raise ValueError("Prior immutable root envelope differs from snapshot")

    records = {record["id"]: record for record in snapshot["records"]}
    changed = {fact["recordId"] for fact in accepted}
    if any(record_id not in records for record_id in changed):
        raise ValueError("Packet contains an unknown record")
    affected = [record for record in snapshot["records"] if record["id"] in changed]
    series = load_subject_series(prior_root, publication, affected)
    sources = {source["id"]: source for source in snapshot["sources"]}
    original_source_count = len(snapshot["sources"])
    existing_urls = {source.get("url", "").rstrip("/") for source in snapshot["sources"] if source.get("url")}

    def add_source(source):
        source_id = source.get("id")
        if not source_id or source_id in sources:
            raise ValueError(f"Source identifier is absent or already exists: {source_id}")
        if not source.get("url", "").startswith("https://"):
            raise ValueError(f"Supplemental source must use HTTPS: {source_id}")
        if source["url"].rstrip("/") in existing_urls:
            raise ValueError(f"Supplemental source URL is already represented: {source_id}")
        if not source.get("retrievedAt") or source["retrievedAt"][:10] > as_of:
            raise ValueError(f"Supplemental source retrieval is invalid: {source_id}")
        if source.get("publishedAt") and source["publishedAt"][:10] > as_of:
            raise ValueError(f"Supplemental source publication is invalid: {source_id}")
        if source.get("rawBodyRedistributed") is not False:
            raise ValueError(f"Supplemental source must not redistribute a raw body: {source_id}")
        snapshot["sources"].append(deepcopy(source))
        sources[source_id] = snapshot["sources"][-1]
        existing_urls.add(source["url"].rstrip("/"))

    communities = {record["id"]: record for record in snapshot["records"] if record["type"] == "community"}
    exposures_by_record = collections.defaultdict(list)
    for exposure in snapshot["exposures"]:
        exposures_by_record[exposure["recordId"]].append(exposure)
    coverage_context = {}
    for record in affected:
        community = communities.get(record.get("sharedCommunityHistoryId"))
        coverage_context[record["id"]] = {
            "sharedContext": community.get("historySeries", []) if community else [],
            "eventLinks": exposures_by_record[record["id"]] + [
                rule for rule in snapshot.get("exposureRules", [])
                if record["type"] == rule.get("appliesTo") and record["emirate"] in rule.get("emirates", [])
            ],
        }

    snapshot["asOf"] = as_of
    snapshot["manifest"]["asOf"] = as_of
    result = apply_enrichment(packet, affected, series, sources, add_source, {}, as_of, coverage_context)
    if len(snapshot["sources"]) != original_source_count + len(packet["sources"]):
        raise ValueError("Supplemental source count is inconsistent")
    if snapshot["sources"][:original_source_count] != original["sources"]:
        raise ValueError("Existing source evidence was rewritten")
    if snapshot["events"] != original["events"] or snapshot["exposures"] != original["exposures"]:
        raise ValueError("Lifecycle supplemental release must not rewrite events or exposures")
    before_by_id = {record["id"]: record for record in original["records"]}
    added_ids = {fact["id"] for fact in accepted}
    for record in snapshot["records"]:
        before = before_by_id[record["id"]]
        if record["id"] not in changed:
            if record != before:
                raise ValueError(f"Unrelated record changed: {record['id']}")
            continue
        for field in ["currentSnapshot", "scenarioInputs", "scenarioCoverage", "observations", "historySeries", "registerEvidence", "priorCurrentSnapshots"]:
            if record.get(field) != before.get(field):
                raise ValueError(f"Lifecycle pass changed non-lifecycle data on {record['id']}: {field}")
        if record["lifecycle"][:len(before["lifecycle"])] != before["lifecycle"]:
            raise ValueError(f"Lifecycle pass rewrote prior lifecycle evidence on {record['id']}")
        additions = record["lifecycle"][len(before["lifecycle"]):]
        if not additions or {row["id"] for row in additions} - added_ids:
            raise ValueError(f"Unexpected lifecycle additions on {record['id']}")
    if len(snapshot["records"]) != len(original["records"]):
        raise ValueError("Lifecycle pass changed record inventory")

    snapshot["version"] = version
    snapshot["manifest"]["version"] = version
    entry = {
        "passId": packet["passId"],
        "factsAdded": len(accepted),
        "recordsChanged": len(changed),
        "sourcesAdded": len(packet["sources"]),
        "financialObservationsAdded": 0,
        "packetSHA256": digest(packet_path.read_bytes()),
        "packetPath": str(packet_path.relative_to(ROOT)),
        "rawBodiesRedistributed": False,
    }
    snapshot["manifest"].setdefault("lifecycleSupplementalPasses", []).append(entry)
    snapshot["manifest"].setdefault("sourceEnrichment", {}).setdefault("supplementalPasses", []).append({"passId": packet["passId"], **result})

    new_history = []
    pointers = {}
    for item in publication["objects"]:
        if item["kind"] != "history_partition":
            continue
        blob = (ROOT / item["path"]).read_bytes()
        if digest(blob) != item["sha256"]:
            raise ValueError(f"Historical partition checksum mismatch: {item['sha256']}")
        archive = json.loads(gzip.decompress(blob))
        if archive["version"] != prior_version:
            raise ValueError("Historical partition has an unexpected version")
        archive["version"] = version
        archive["asOf"] = as_of
        next_item = immutable(gzip.compress(canonical(archive), mtime=0), ".json.gz", "history_partition", as_of)
        new_history.append(next_item)
        pointer = {key: next_item[key] for key in ["key", "sha256", "bytes", "compression"]}
        for item_series in archive["series"]:
            if item_series["id"] in pointers:
                raise ValueError(f"Duplicate native series in partition history: {item_series['id']}")
            pointers[item_series["id"]] = pointer
    if len(pointers) != len(prior_root["series"]):
        raise ValueError("Native series pointer count changed")
    for record in snapshot["records"]:
        for item_series in record.get("historySeries", []):
            if item_series.get("partition"):
                item_series["partition"] = pointers[item_series["id"]]
    for item_series in prior_root["series"]:
        item_series["partition"] = pointers[item_series["id"]]

    compact_by_id = {record["id"]: record for record in prior_root["records"]}
    for record_id in changed:
        compact = compact_by_id[record_id]
        full = records[record_id]
        for field in ["lifecycle", "researchStatus", "coverageSummary"]:
            compact[field] = deepcopy(full[field])
    prior_root.update(version=version, asOf=as_of, manifest=snapshot["manifest"], sources=snapshot["sources"])
    root = immutable(gzip.compress(canonical(prior_root), mtime=0), ".json.gz", "full_snapshot_index", as_of)
    replaced = {"runtime_history_partition", "runtime_record_shard", "runtime_index", "history_partition", "full_snapshot_index"}
    objects = [item for item in publication["objects"] if item["kind"] not in replaced] + new_history + [root]
    counts = dict(publication["counts"])
    counts["sources"] = len(snapshot["sources"])
    publication_next = {"version": version, "asOf": as_of, "rootIndex": root, "objects": objects, "counts": counts}
    publication_next["d1Index"] = append_d1_index(snapshot, prior_root, root, version, as_of)

    SNAPSHOT_PATH.write_bytes(canonical(snapshot) + b"\n")
    SNAPSHOT_PATH.with_suffix(".json.gz").write_bytes(gzip.compress(SNAPSHOT_PATH.read_bytes(), compresslevel=9, mtime=0))
    PUBLICATION_PATH.write_bytes(canonical(publication_next) + b"\n")
    spec = importlib.util.spec_from_file_location("build_historical_data", ROOT / "scripts" / "build-historical-data.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.build_runtime_index(snapshot, publication_next)

    ledger = collections.Counter(item["status"] for record in snapshot["records"] for item in record["researchStatus"]["itemCoverage"].values())
    receipt = {
        "version": version,
        "asOf": as_of,
        "priorVersion": prior_version,
        "changedRecords": sorted(changed),
        "newLifecycleFacts": len(accepted),
        "newFinancialObservations": 0,
        "newSources": len(packet["sources"]),
        "historicalRowsPreserved": publication_next["counts"]["historicalRows"],
        "seriesPreserved": publication_next["counts"]["series"],
        "ledger": dict(ledger),
        "rootSHA256": root["sha256"],
        "packetSHA256": digest(packet_path.read_bytes()),
    }
    receipt_path.parent.mkdir(parents=True, exist_ok=True)
    receipt_path.write_bytes(canonical(receipt) + b"\n")
    print(json.dumps(receipt, ensure_ascii=False))


if __name__ == "__main__":
    main()
