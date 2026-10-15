#!/usr/bin/env python3
"""Prove V46 preserves every V45 native series payload before publication."""
import copy
import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OBJECTS = ROOT / "data" / "historical-intelligence" / "objects"
V45_ROOT = "1c17824d39f4399e1fb1088bb52c2a0e761cb2e935286c617e25c883b4afa2c0"
V46_ROOT = "9912e0a2c673160168f5f223ec67c482e230db5bca51a532d4fe0d2e64eea672"
V45 = "20261013-enrichment-v45"
V46 = "20261013-enrichment-v46"


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
    before, current = unpack(V45_ROOT), unpack(V46_ROOT)
    check(before["version"] == V45 and current["version"] == V46, "Unexpected immutable roots.")
    check(before["asOf"] == current["asOf"] == "2026-10-13", "V46 cutoff changed.")
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
        check(old_payload.count(V45.encode()) == 1, f"Unexpected V45 tag multiplicity: {old_sha}")
        check(new_payload.count(V46.encode()) == 1, f"Unexpected V46 tag multiplicity: {new_sha}")
        check(old_payload.replace(V45.encode(), V46.encode()) == new_payload, f"Native payload changed: {old_sha}")

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
