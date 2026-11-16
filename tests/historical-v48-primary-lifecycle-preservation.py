#!/usr/bin/env python3
"""Prove V48 preserves V47 native history while adding only Emaar lifecycle evidence."""
import copy
import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OBJECTS = ROOT / "data" / "historical-intelligence" / "objects"
V47_ROOT = "66755b6af985b16b56ea331353769914dfd9cff92678c0fd8e9f0f1e6ddb1240"
V48_ROOT = "ca1133d5169abc0bc2aec24eb193719018e47a3e9d06c773a951b9cc9a7424a0"
V47 = "20261013-enrichment-v47"
V48 = "20261014-enrichment-v48"
PACKET = ROOT / "data" / "historical-intelligence" / "emaar-primary-lifecycle-pass48-20261014.json"
SNAPSHOT = ROOT / "data" / "historical-intelligence-20261003.json"
PUBLICATION = ROOT / "data" / "historical-intelligence" / "publication-manifest.json"

TERRA = "project:apartments-in-terra-heights-in-emaar-expo-living-expo-city-dubai"
PALACE = "project:palace-residences-dubai-hills-estate-emaar-properties"
ZABEEL = "project:address-residences-zabeel-by-emaar-properties-in-zaabeel-dubai"
CHANGED = {TERRA, PALACE, ZABEEL}


def unpack(sha):
    return json.loads(gzip.decompress((OBJECTS / f"{sha}.json.gz").read_bytes()))


def canonical(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode()


def digest(value):
    return hashlib.sha256(value).hexdigest()


def without_partition(series):
    value = copy.deepcopy(series)
    value.pop("partition", None)
    return value


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def main():
    before, current = unpack(V47_ROOT), unpack(V48_ROOT)
    snapshot = json.loads(SNAPSHOT.read_text())
    publication = json.loads(PUBLICATION.read_text())
    packet = json.loads(PACKET.read_text())
    check(before["version"] == V47 and current["version"] == snapshot["version"] == publication["version"] == V48, "Unexpected immutable roots or live candidate version.")
    check(before["asOf"] == "2026-10-13" and current["asOf"] == snapshot["asOf"] == publication["asOf"] == "2026-10-14", "Unexpected snapshot cutoff.")
    check(publication["rootIndex"]["sha256"] == V48_ROOT, "Manifest does not point at the V48 root.")
    check(digest(SNAPSHOT.read_bytes()) == publication["runtime"]["canonicalSnapshotSHA256"], "Runtime canonical snapshot checksum differs.")
    check(packet["priorVersion"] == V47 and packet["candidateVersion"] == V48 and packet["priorSHA256"] == "f188684e8f54d9c90a3f378f0cf1bc25d3efeaf51eea1983b5f0d6ae6422108f", "Packet lineage differs.")
    check({fact["recordId"] for fact in packet["facts"]} == CHANGED and len(packet["facts"]) == 5 and len(packet["sources"]) == 3, "Unexpected V48 evidence scope.")
    check(packet["collection"]["newFinancialObservations"] == 0, "V48 packet claims financial observations.")

    old_sources, new_sources = before["sources"], current["sources"]
    check(len(old_sources) == 3368 and len(new_sources) == 3371, "Unexpected source counts.")
    check(new_sources[:len(old_sources)] == old_sources, "Prior source metadata changed.")
    check({source["id"] for source in new_sources[len(old_sources):]} == {source["id"] for source in packet["sources"]}, "V48 source identities differ.")
    check(before["events"] == current["events"] and before["exposures"] == current["exposures"], "V48 must not change event evidence or exposure links.")

    old_records = {record["id"]: record for record in before["records"]}
    new_records = {record["id"]: record for record in current["records"]}
    check(set(old_records) == set(new_records) and len(new_records) == 1860, "Record identity/count changed.")
    check(sum(record["type"] == "project" for record in new_records.values()) == 1645, "Project count changed.")
    check(sum(record["type"] == "community" for record in new_records.values()) == 215, "Community count changed.")
    for record_id, old in old_records.items():
        new = new_records[record_id]
        if record_id not in CHANGED:
            check(old == new, f"Unrelated record changed: {record_id}")
            continue
        for key in ["observations", "currentSnapshot", "scenarioInputs", "scenarioCoverage", "historySeriesIds", "registerEvidence", "priorCurrentSnapshots"]:
            check(new.get(key) == old.get(key), f"V48 changed financial/runtime evidence for {record_id}: {key}")
        check(new["lifecycle"][:len(old["lifecycle"])] == old["lifecycle"], f"V48 rewrote prior lifecycle evidence for {record_id}")
        additions = new["lifecycle"][len(old["lifecycle"]):]
        expected_ids = {fact["id"] for fact in packet["facts"] if fact["recordId"] == record_id}
        check({item["id"] for item in additions} == expected_ids, f"Unexpected lifecycle additions for {record_id}")
        check(all(item["primaryEvidence"] and item["scope"] == "subject" for item in additions), f"Lifecycle identity/scoping weakened for {record_id}")
        check(all("transaction" in item["note"].lower() for item in additions if item["kind"] == "developer_sales_status_report"), f"Sales status report is not explicitly non-transactional for {record_id}")
    check(new_records[TERRA]["researchStatus"]["itemCoverage"]["original_launch"]["status"] == "present", "Terra launch is not verified.")
    check("verified_launch_date" not in new_records[TERRA]["researchStatus"]["gaps"], "Terra launch gap remains after verified primary evidence.")
    check(new_records[PALACE]["researchStatus"]["itemCoverage"]["original_launch"]["status"] == "partial", "Palace bounded launch window was overstated.")
    check("verified_launch_date" in new_records[PALACE]["researchStatus"]["gaps"], "Palace launch window was overstated as exact.")
    check(new_records[ZABEEL]["researchStatus"]["itemCoverage"]["original_launch"]["status"] == "missing", "Zabeel sales report must not be a launch fact.")
    for record in new_records.values():
        check(record["researchStatus"]["itemCoverage"]["complete_registered_sale_history"]["status"] == "unestablished", f"Complete sale history falsely claimed for {record['id']}")
        check(record["researchStatus"]["itemCoverage"]["complete_signed_rent_history"]["status"] == "unestablished", f"Complete rent history falsely claimed for {record['id']}")
        check(record["scenarioCoverage"]["firstYear"] == 2027 and record["scenarioCoverage"]["lastYear"] == 2080 and record["scenarioCoverage"]["approvedAnnualPoints"] == 0, f"Scenario coverage changed for {record['id']}")

    old_series = {series["id"]: series for series in before["series"]}
    new_series = {series["id"]: series for series in current["series"]}
    check(set(old_series) == set(new_series) and len(old_series) == 16872, "Native series identity changed.")
    check(all(canonical(without_partition(old_series[key])) == canonical(without_partition(new_series[key])) for key in old_series), "Native series metadata changed.")
    partition_pairs = {(old_series[key]["partition"]["sha256"], new_series[key]["partition"]["sha256"]) for key in old_series}
    check(len(partition_pairs) == 1091, "Unexpected history-partition mapping.")
    decoded = 0
    for old_sha, new_sha in partition_pairs:
        old_payload = gzip.decompress((OBJECTS / f"{old_sha}.json.gz").read_bytes())
        new_payload = gzip.decompress((OBJECTS / f"{new_sha}.json.gz").read_bytes())
        decoded += len(old_payload) + len(new_payload)
        old_archive = json.loads(old_payload)
        new_archive = json.loads(new_payload)
        check(old_archive.get("version") == V47 and old_archive.get("asOf") == "2026-10-13", f"Unexpected V47 envelope: {old_sha}")
        check(new_archive.get("version") == V48 and new_archive.get("asOf") == "2026-10-14", f"Unexpected V48 envelope: {new_sha}")
        old_archive["version"] = V48
        old_archive["asOf"] = "2026-10-14"
        check(canonical(old_archive) == canonical(new_archive), f"Native payload changed: {old_sha}")

    check(before["manifest"]["historicalObservationRows"] == current["manifest"]["historicalObservationRows"] == 633891, "Historical row count changed.")
    check(before["manifest"]["historicalSeriesCount"] == current["manifest"]["historicalSeriesCount"] == 16872, "Historical series count changed.")
    check(publication["counts"] == {"records": 1860, "projects": 1645, "communities": 215, "historicalRows": 633891, "collectedHistoricalRows": 634107, "originalCollectionRows": 122268, "supplementHistoricalRows": 18539, "rightsPendingRows": 216, "series": 16872, "events": 105, "exposures": 7382, "sources": 3371}, "V48 publication counts differ.")
    runtime = json.loads(gzip.decompress((ROOT / publication["runtimeIndex"]["path"]).read_bytes()))
    check(runtime["version"] == V48 and runtime["asOf"] == "2026-10-14", "Runtime index envelope differs.")
    check(runtime["manifest"]["runtime"]["canonicalArchiveSHA256"] == V48_ROOT, "Runtime index points to wrong archive.")
    check(len(runtime["records"]) == 1860, "Runtime index record count differs.")
    runtime_objects = [obj for obj in publication["objects"] if obj["kind"].startswith("runtime_")]
    check(runtime_objects and all(obj["key"].startswith("research/published/2026-10-14/") for obj in runtime_objects), "Runtime objects use a stale publication namespace.")
    shards = [obj for obj in runtime_objects if obj["kind"] == "runtime_record_shard"]
    check(len(shards) == 120, "Unexpected runtime record-shard count.")
    runtime_records = {}
    for shard in shards:
        payload = json.loads(gzip.decompress((ROOT / shard["path"]).read_bytes()))
        check(payload.get("version") == V48 and payload.get("asOf") == "2026-10-14", f"Runtime shard has a stale envelope: {shard['sha256']}")
        for record in payload["records"]:
            check(record["id"] not in runtime_records, f"Duplicate runtime record: {record['id']}")
            runtime_records[record["id"]] = record
    check(set(runtime_records) == set(new_records), "Runtime shards omit or add record identities.")
    for record_id in CHANGED:
        actual = {item["id"] for item in runtime_records[record_id]["lifecycle"] if item["id"].startswith("emaar48-")}
        expected = {fact["id"] for fact in packet["facts"] if fact["recordId"] == record_id}
        check(actual == expected, f"Runtime shard does not hydrate V48 lifecycle facts for {record_id}")
    check(all(digest((ROOT / obj["path"]).read_bytes()) == obj["sha256"] and (ROOT / obj["path"]).stat().st_size == obj["bytes"] for obj in [*publication["objects"], publication["d1Index"]]), "Immutable object checksum/size mismatch.")
    index_sql = gzip.decompress((ROOT / publication["d1Index"]["path"]).read_bytes()).decode()
    check(f"INSERT OR IGNORE INTO hi_snapshots(snapshot_version,as_of,record_count,manifest_json,root_sha256) VALUES('{V48}'" in index_sql, "D1 snapshot header is not V48.")
    check(V48_ROOT in index_sql, "D1 index does not reference V48 immutable root.")

    print(json.dumps({
        "passed": True,
        "version": V48,
        "rootSHA256": V48_ROOT,
        "records": len(new_records),
        "sources": len(new_sources),
        "newLifecycleFacts": 5,
        "financialObservationsAdded": 0,
        "series": len(new_series),
        "partitionPairs": len(partition_pairs),
        "decodedBytes": decoded,
        "payloadVersionOnly": True,
        "runtimeRecordShards": len(shards),
        "ledger": {status: sum(item["status"] == status for record in new_records.values() for item in record["researchStatus"]["itemCoverage"].values()) for status in ["present", "partial", "missing", "unestablished"]},
    }))


if __name__ == "__main__":
    main()
