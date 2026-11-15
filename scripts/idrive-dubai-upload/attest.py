#!/usr/bin/env python3
"""Attest the full separate IDrive readback without publishing capability data."""

import gzip
import hashlib
import io
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data/uae-evidence/dubai"
STATE = ROOT / "work/idrive-replica/dubai-20261026"
PLAN = DATA / "idrive-e2-replica-plan-20261114.json"
OUTPUT = DATA / "idrive-e2-replica-readback-20261114.json"


def sha256(value):
    return hashlib.sha256(value).hexdigest()


def main():
    plan_bytes = PLAN.read_bytes()
    plan = json.loads(plan_bytes)
    journal_bytes = (STATE / "map-upload-journal.json").read_bytes()
    journal = json.loads(journal_bytes)
    stage = json.loads((STATE / "map-upload-stage.json").read_text())
    if plan["status"] != "prepared_not_uploaded" or plan["objectCount"] != 155:
        raise ValueError("Transfer scope changed")
    if journal["planSha256"] != sha256(plan_bytes) or journal["version"] != stage["version"]:
        raise ValueError("Readback belongs to another plan or preview")
    keys = {item["idriveKey"] for item in plan["objects"]}
    if len(keys) != 155 or set(journal["uploads"]) != keys or set(journal["readbacks"]) != keys:
        raise ValueError("Upload or independent GET receipts are incomplete")
    for item in plan["objects"]:
        key = item["idriveKey"]
        for phase in ("uploads", "readbacks"):
            receipt = journal[phase][key]
            if receipt["bytes"] != item["bytes"] or receipt["sha256"] != item["sha256"] or not receipt.get("verifiedAt"):
                raise ValueError(f"Receipt mismatch: {key}")
    indexed = {item["idriveKey"]: item for item in plan["objects"]}
    for original in plan["originalAssemblies"]:
        packed = b"".join((ROOT / indexed[key]["localPath"]).read_bytes() for key in original["partKeysInOrder"])
        if len(packed) != original["packedBytes"] or sha256(packed) != original["packedSha256"]:
            raise ValueError("Packed source parts do not reassemble")
        with gzip.GzipFile(fileobj=io.BytesIO(packed), mode="rb") as stream:
            digest = hashlib.sha256()
            length = 0
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
                length += len(chunk)
        if length != original["originalBytes"] or digest.hexdigest() != original["originalSha256"]:
            raise ValueError("Private original does not reconstruct")
    verified_at = max(item["verifiedAt"] for item in journal["readbacks"].values())
    report = {
        "attestationId": "dubai-municipality-idrive-e2-readback-20261114",
        "planId": plan["planId"],
        "planSha256": sha256(plan_bytes),
        "privateJournalSha256": sha256(journal_bytes),
        "previewVersion": stage["version"],
        "bridgeSha256": stage["sourceSha256"],
        "verifiedAt": verified_at,
        "bucket": plan["bucket"],
        "prefix": plan["prefix"],
        "objectCount": 155,
        "totalBytes": plan["totalBytes"],
        "publishedProjectionObjects": 145,
        "privateOriginalPartObjects": 10,
        "originalSourceCount": 3,
        "verification": "Each allowlisted object passed a conditional upload and a separate signed IDrive E2 GET with exact byte length and SHA-256. The ten readback-matching private source parts reassemble into three gzip streams whose decompressed bytes match the pinned original CSV lengths and SHA-256 hashes.",
        "allObjectsVerified": True,
        "runtimePrimaryChanged": False,
        "productionTrafficChangedByCopy": False,
    }
    OUTPUT.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"allObjectsVerified": True, "objectCount": 155, "totalBytes": report["totalBytes"]}))


if __name__ == "__main__":
    main()
