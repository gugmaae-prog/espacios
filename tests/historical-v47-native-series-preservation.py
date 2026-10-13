#!/usr/bin/env python3
"""Prove V47 preserves every V46 native series payload before publication."""
import copy
import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OBJECTS = ROOT / "data" / "historical-intelligence" / "objects"
V46_ROOT = "9912e0a2c673160168f5f223ec67c482e230db5bca51a532d4fe0d2e64eea672"
V47_ROOT = "66755b6af985b16b56ea331353769914dfd9cff92678c0fd8e9f0f1e6ddb1240"
V46 = "20261013-enrichment-v46"
V47 = "20261013-enrichment-v47"


def unpack(sha):
    return json.loads(gzip.decompress((OBJECTS / f"{sha}.json.gz").read_bytes()))


def canonical(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode()


def without_partition(series):
    value = copy.deepcopy(series)
    value.pop("partition", None)
    return value


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def main():
    before, current = unpack(V46_ROOT), unpack(V47_ROOT)
    check(before["version"] == V46 and current["version"] == V47, "Unexpected immutable roots.")
    check(before["asOf"] == current["asOf"] == "2026-10-13", "V47 cutoff changed.")
    old = {series["id"]: series for series in before["series"]}
    new = {series["id"]: series for series in current["series"]}
    check(set(old) == set(new) and len(old) == 16872, "Native series identity changed.")
    check(all(canonical(without_partition(old[key])) == canonical(without_partition(new[key])) for key in old), "Native series metadata changed.")

    partition_pairs = {(old[key]["partition"]["sha256"], new[key]["partition"]["sha256"]) for key in old}
    check(len(partition_pairs) == 1091, "Unexpected history-partition mapping.")
    decoded = 0
    for old_sha, new_sha in partition_pairs:
        old_payload = gzip.decompress((OBJECTS / f"{old_sha}.json.gz").read_bytes())
        new_payload = gzip.decompress((OBJECTS / f"{new_sha}.json.gz").read_bytes())
        decoded += len(old_payload) + len(new_payload)
        check(old_payload.count(V46.encode()) == 1, f"Unexpected V46 tag multiplicity: {old_sha}")
        check(new_payload.count(V47.encode()) == 1, f"Unexpected V47 tag multiplicity: {new_sha}")
        check(old_payload.replace(V46.encode(), V47.encode()) == new_payload, f"Native payload changed: {old_sha}")

    check(before["manifest"]["historicalObservationRows"] == current["manifest"]["historicalObservationRows"] == 633891, "Historical row count changed.")
    check(before["manifest"]["historicalSeriesCount"] == current["manifest"]["historicalSeriesCount"] == 16872, "Historical series count changed.")
    print(json.dumps({
        "passed": True,
        "series": len(old),
        "partitionPairs": len(partition_pairs),
        "decodedBytes": decoded,
        "payloadVersionOnly": True,
        "aggregateSeriesMetadataSHA256": hashlib.sha256(canonical({key: without_partition(old[key]) for key in sorted(old)})).hexdigest(),
    }))


if __name__ == "__main__":
    main()
