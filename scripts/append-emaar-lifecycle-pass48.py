#!/usr/bin/env python3
"""Append V48 primary Emaar lifecycle evidence while preserving V47."""
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
PACKET_PATH = BASE / "emaar-primary-lifecycle-pass48-20261014.json"
VERSION = "20261014-enrichment-v48"
PRIOR = "20261013-enrichment-v47"
CHANGED_RECORDS = {
    "project:apartments-in-terra-heights-in-emaar-expo-living-expo-city-dubai",
    "project:palace-residences-dubai-hills-estate-emaar-properties",
    "project:address-residences-zabeel-by-emaar-properties-in-zaabeel-dubai",
}


def canonical(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode()


def digest(value):
    return hashlib.sha256(value).hexdigest()


def sql_literal(value):
    return "'" + str(value).replace("'", "''") + "'"


def immutable(blob, suffix, kind):
    checksum = digest(blob)
    path = BASE / "objects" / f"{checksum}{suffix}"
    if path.exists() and path.read_bytes() != blob:
        raise ValueError("Immutable collision")
    if not path.exists():
        path.write_bytes(blob)
    return {
        "key": f"research/published/2026-10-14/historical-intelligence/objects/{path.name}",
        "path": str(path.relative_to(ROOT)),
        "sha256": checksum,
        "bytes": len(blob),
        "kind": kind,
        "compression": "gzip",
    }


def load_subject_series(root_index, publication, affected):
    descriptor_by_id = {item["id"]: item for item in root_index["series"]}
    needed = {
        item["id"]
        for record in affected
        for item in record.get("historySeries", [])
        if item.get("scope") == "subject" and item.get("identityVerified") is True
    }
    objects = {item["sha256"]: item for item in publication["objects"]}
    grouped = collections.defaultdict(set)
    for series_id in needed:
        pointer = descriptor_by_id[series_id]["partition"]
        grouped[pointer["sha256"]].add(series_id)
    result = {}
    for checksum, series_ids in grouped.items():
        item = objects[checksum]
        raw = (ROOT / item["path"]).read_bytes()
        assert digest(raw) == checksum
        partition = json.loads(gzip.decompress(raw))
        for series in partition["series"]:
            if series["id"] in series_ids:
                result[series["id"]] = series
    assert set(result) == needed
    return result


def main():
    snapshot = json.loads(SNAPSHOT_PATH.read_bytes())
    publication = json.loads(PUBLICATION_PATH.read_bytes())
    packet = json.loads(PACKET_PATH.read_bytes())
    assert snapshot["version"] == publication["version"] == packet["priorVersion"] == PRIOR
    assert packet["passId"] == "emaar-primary-lifecycle-pass48-20261014"
    assert packet["candidateVersion"] == VERSION
    assert digest(SNAPSHOT_PATH.read_bytes()) == packet["priorSHA256"]
    prior_root_path = ROOT / publication["rootIndex"]["path"]
    assert digest(prior_root_path.read_bytes()) == publication["rootIndex"]["sha256"]

    original = deepcopy(snapshot)
    prior_root = json.loads(gzip.decompress(prior_root_path.read_bytes()))
    assert prior_root["version"] == PRIOR
    backup = ROOT / ".local-data" / "emaar-primary-pass48" / "baseline"
    backup.mkdir(parents=True, exist_ok=True)
    for source in [SNAPSHOT_PATH, PUBLICATION_PATH]:
        target = backup / source.name
        if not target.exists():
            target.write_bytes(source.read_bytes())

    records = {record["id"]: record for record in snapshot["records"]}
    changed = {fact["recordId"] for fact in packet["facts"]}
    assert changed == CHANGED_RECORDS
    assert len(packet["facts"]) == 5 and len(packet["sources"]) == 3
    assert packet["collection"]["newFinancialObservations"] == 0
    assert all(fact["kind"] == "lifecycle" for fact in packet["facts"])
    for check in packet["recordIdentityChecks"]:
        record = records[check["recordId"]]
        assert (record["name"], record["type"], record["emirate"], record["communityId"]) == (
            check["catalogueName"], check["type"], check["emirate"], check["communityId"]
        )
        assert check["identitySourceIds"] and check["identityBasis"]

    sources = {source["id"]: source for source in snapshot["sources"]}
    original_source_count = len(snapshot["sources"])

    def add_source(source):
        assert source["id"] not in sources
        assert source["url"].startswith("https://www.emaar.com/")
        assert source["retrievedAt"][:10] <= packet["asOf"]
        assert source["publishedAt"] <= packet["asOf"]
        assert source["publishedAt"] < source["firstAvailableAt"][:10]
        assert source["rawBodyRedistributed"] is False
        assert not any(item.get("url", "").rstrip("/") == source["url"].rstrip("/") for item in sources.values())
        row = deepcopy(source)
        snapshot["sources"].append(row)
        sources[row["id"]] = row

    affected = [record for record in snapshot["records"] if record["id"] in changed]
    subject_series = load_subject_series(prior_root, publication, affected)
    communities = {record["id"]: record for record in snapshot["records"] if record["type"] == "community"}
    exposure_by_record = collections.defaultdict(list)
    for exposure in snapshot["exposures"]:
        exposure_by_record[exposure["recordId"]].append(exposure)
    coverage_context = {}
    for record in affected:
        community = communities.get(record.get("sharedCommunityHistoryId"))
        event_links = exposure_by_record[record["id"]] + [
            rule for rule in snapshot.get("exposureRules", [])
            if record["type"] == rule.get("appliesTo") and record["emirate"] in rule.get("emirates", [])
        ]
        coverage_context[record["id"]] = {
            "sharedContext": community.get("historySeries", []) if community else [],
            "eventLinks": event_links,
        }
    snapshot["asOf"] = packet["asOf"]
    snapshot["manifest"]["asOf"] = packet["asOf"]
    result = apply_enrichment(packet, affected, subject_series, sources, add_source, {}, snapshot["asOf"], coverage_context)
    assert len(snapshot["sources"]) == original_source_count + 3
    assert snapshot["sources"][:original_source_count] == original["sources"]

    previous = {record["id"]: record for record in original["records"]}
    added_ids = {fact["id"] for fact in packet["facts"]}
    for record in affected:
        before = previous[record["id"]]
        assert record["currentSnapshot"] == before["currentSnapshot"]
        assert record["scenarioInputs"] == before["scenarioInputs"]
        assert record["scenarioCoverage"] == before["scenarioCoverage"]
        assert record["observations"] == before["observations"]
        assert record["historySeries"] == before["historySeries"]
        assert record["lifecycle"][:len(before["lifecycle"])] == before["lifecycle"]
        additions = record["lifecycle"][len(before["lifecycle"]):]
        assert additions and {item["id"] for item in additions}.issubset(added_ids)
        assert all(item["primaryEvidence"] is True for item in additions)
        expected_summary = deepcopy(before["coverageSummary"])
        expected_summary["lifecycleEvidencePoints"] = len(record["lifecycle"])
        assert record["coverageSummary"] == expected_summary
        for key, old_coverage in before["researchStatus"]["itemCoverage"].items():
            if key != "original_launch":
                assert record["researchStatus"]["itemCoverage"][key] == old_coverage
    for before, after in zip(original["records"], snapshot["records"]):
        if before["id"] not in changed:
            assert before == after
    terra = records["project:apartments-in-terra-heights-in-emaar-expo-living-expo-city-dubai"]
    palace = records["project:palace-residences-dubai-hills-estate-emaar-properties"]
    assert terra["researchStatus"]["itemCoverage"]["original_launch"]["status"] == "present"
    assert "verified_launch_date" not in terra["researchStatus"]["gaps"]
    assert palace["researchStatus"]["itemCoverage"]["original_launch"]["status"] == "partial"
    assert "verified_launch_date" in palace["researchStatus"]["gaps"]
    assert snapshot["events"] == original["events"] and snapshot["exposures"] == original["exposures"]
    assert len(snapshot["records"]) == 1860 and sum(record["type"] == "project" for record in snapshot["records"]) == 1645

    snapshot["version"] = VERSION
    snapshot["manifest"]["version"] = VERSION
    snapshot["manifest"]["emaarPrimaryLifecyclePass48"] = {
        "factsAdded": len(packet["facts"]),
        "recordsChanged": len(changed),
        "sourcesAdded": len(packet["sources"]),
        "financialObservationsAdded": 0,
        "packetSHA256": digest(PACKET_PATH.read_bytes()),
        "packetPath": str(PACKET_PATH.relative_to(ROOT)),
        "rawBodiesRedistributed": False,
    }
    snapshot["manifest"]["sourceEnrichment"].setdefault("supplementalPasses", []).append({
        "passId": packet["passId"], **result,
    })

    new_history, pointers = [], {}
    for prior in publication["objects"]:
        if prior["kind"] != "history_partition":
            continue
        blob = (ROOT / prior["path"]).read_bytes()
        assert digest(blob) == prior["sha256"]
        archive = json.loads(gzip.decompress(blob))
        assert archive["version"] == PRIOR
        archive["version"] = VERSION
        archive["asOf"] = snapshot["asOf"]
        object_row = immutable(gzip.compress(canonical(archive), mtime=0), ".json.gz", "history_partition")
        new_history.append(object_row)
        pointer = {key: object_row[key] for key in ["key", "sha256", "bytes", "compression"]}
        for series in archive["series"]:
            assert series["id"] not in pointers
            pointers[series["id"]] = pointer
    assert len(pointers) == len(prior_root["series"])
    for record in snapshot["records"]:
        for series in record.get("historySeries", []):
            if series.get("partition"):
                series["partition"] = pointers[series["id"]]
    for series in prior_root["series"]:
        series["partition"] = pointers[series["id"]]

    compact = []
    for record in prior_root["records"]:
        if record["id"] in changed:
            full = records[record["id"]]
            for key in ["lifecycle", "researchStatus", "coverageSummary"]:
                record[key] = deepcopy(full[key])
        compact.append(record)
    prior_root.update(
        version=VERSION,
        asOf=snapshot["asOf"],
        manifest=snapshot["manifest"],
        sources=snapshot["sources"],
        records=compact,
    )
    root = immutable(gzip.compress(canonical(prior_root), mtime=0), ".json.gz", "full_snapshot_index")
    replaced = {"runtime_history_partition", "runtime_record_shard", "runtime_index", "history_partition", "full_snapshot_index"}
    objects = [item for item in publication["objects"] if item["kind"] not in replaced] + new_history + [root]
    counts = dict(publication["counts"])
    counts["sources"] = len(snapshot["sources"])
    publication_next = {"version": VERSION, "asOf": snapshot["asOf"], "rootIndex": root, "objects": objects, "counts": counts}

    sql = ["PRAGMA foreign_keys = ON;"]

    def insert(table, columns, values):
        rendered = ",".join(str(value) if isinstance(value, int) else sql_literal(value) for value in values)
        sql.append(f"INSERT OR IGNORE INTO {table}({','.join(columns)}) VALUES({rendered});")

    manifest = snapshot["manifest"]
    insert("hi_snapshots", ["snapshot_version", "as_of", "record_count", "manifest_json", "root_sha256"], [VERSION, snapshot["asOf"], 1860, canonical(manifest).decode(), root["sha256"]])
    for record in compact:
        insert("hi_records", ["snapshot_version", "record_id", "record_type", "name", "emirate", "record_json"], [VERSION, record["id"], record["type"], record["name"], record["emirate"], canonical({key: value for key, value in record.items() if key != "historySeriesIds"}).decode()])
    for source in snapshot["sources"]:
        insert("hi_sources", ["snapshot_version", "source_id", "url", "source_json"], [VERSION, source["id"], source.get("url", ""), canonical(source).decode()])
    for event in snapshot["events"]:
        insert("hi_events", ["snapshot_version", "event_id", "event_json"], [VERSION, event["id"], canonical(event).decode()])
    for exposure in snapshot["exposures"]:
        insert("hi_exposures", ["snapshot_version", "exposure_id", "event_id", "record_id", "scope", "verified", "exposure_json"], [VERSION, exposure["id"], exposure["eventId"], exposure["recordId"], exposure["scope"], int(exposure["verified"]), canonical(exposure).decode()])
    descriptors = {series["id"]: series for series in prior_root["series"]}
    for series in prior_root["series"]:
        insert("hi_series", ["snapshot_version", "series_id", "source_id", "series_json"], [VERSION, series["id"], series["sourceId"], canonical(series).decode()])
    for record in compact:
        for series_id in record.get("historySeriesIds", []):
            series = descriptors[series_id]
            insert("hi_record_series", ["snapshot_version", "record_id", "series_id", "scope", "identity_verified"], [VERSION, record["id"], series_id, series.get("scope", "area_context"), int(series.get("identityVerified", False))])
    publication_next["d1Index"] = immutable(gzip.compress(("\n".join(sql) + "\n").encode(), mtime=0), ".sql.gz", "d1_append_only_index")

    SNAPSHOT_PATH.write_bytes(canonical(snapshot) + b"\n")
    SNAPSHOT_PATH.with_suffix(".json.gz").write_bytes(gzip.compress(SNAPSHOT_PATH.read_bytes(), compresslevel=9, mtime=0))
    PUBLICATION_PATH.write_bytes(canonical(publication_next) + b"\n")
    spec = importlib.util.spec_from_file_location("build_historical_data", ROOT / "scripts" / "build-historical-data.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.build_runtime_index(snapshot, publication_next)
    ledger = collections.Counter(item["status"] for record in snapshot["records"] for item in record["researchStatus"]["itemCoverage"].values())
    receipt = {
        "version": VERSION,
        "changedRecords": sorted(changed),
        "newLifecycleFacts": len(packet["facts"]),
        "verifiedLaunchFacts": packet["collection"]["verifiedLaunchFacts"],
        "reportedLaunchWindows": packet["collection"]["reportedLaunchWindows"],
        "developerSalesStatusReports": packet["collection"]["developerSalesStatusReports"],
        "newFinancialObservations": 0,
        "newSources": len(packet["sources"]),
        "historicalRowsPreserved": publication_next["counts"]["historicalRows"],
        "seriesPreserved": publication_next["counts"]["series"],
        "ledger": dict(ledger),
        "rootSHA256": root["sha256"],
    }
    (BASE / "emaar-primary-pass48-reconciliation.json").write_bytes(canonical(receipt) + b"\n")
    print(json.dumps(receipt))


if __name__ == "__main__":
    main()
