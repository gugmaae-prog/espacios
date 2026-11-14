#!/usr/bin/env python3
"""Prepare a byte-pinned, private IDrive E2 copy set for the Dubai snapshots."""

import argparse
import gzip
import hashlib
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/uae-evidence/dubai"
RAW = ROOT / "work/raw/dubai-municipality-20261026"
PACKED = ROOT / "work/idrive-replica/dubai-20261026"
OUTPUT = ROOT / "data/uae-evidence/dubai/idrive-e2-replica-plan-20261114.json"
PREFIX = "espacios-map/uae-evidence/dubai/20261026/"
PART_BYTES = 8 * 1024 * 1024


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def checked(path, expected_bytes, expected_hash):
    if not path.is_file() or path.stat().st_size != expected_bytes:
        raise ValueError(f"Missing or wrong-sized source: {path}")
    if sha256_file(path) != expected_hash:
        raise ValueError(f"Source checksum mismatch: {path}")


def compressed_source(source, expected_bytes, expected_hash):
    original = RAW / source
    checked(original, expected_bytes, expected_hash)
    PACKED.mkdir(parents=True, exist_ok=True)
    packed = PACKED / (source + ".gz")
    if not packed.exists():
        temporary = packed.with_suffix(packed.suffix + ".tmp")
        with original.open("rb") as reader, temporary.open("wb") as writer:
            with gzip.GzipFile(filename="", mode="wb", fileobj=writer, compresslevel=9, mtime=0) as zipped:
                shutil.copyfileobj(reader, zipped, length=1024 * 1024)
        temporary.replace(packed)
    with gzip.open(packed, "rb") as reader:
        digest = hashlib.sha256()
        size = 0
        for chunk in iter(lambda: reader.read(1024 * 1024), b""):
            size += len(chunk)
            digest.update(chunk)
    if size != expected_bytes or digest.hexdigest() != expected_hash:
        raise ValueError(f"Compressed source does not reconstruct: {source}")
    return packed


def object_entry(path, key, kind, source_id, **extra):
    return {
        "kind": kind,
        "sourceId": source_id,
        "localPath": str(path.relative_to(ROOT)),
        "idriveKey": key,
        "bytes": path.stat().st_size,
        "sha256": sha256_file(path),
        "contentType": "application/gzip",
        **extra,
    }


def split_packed_source(path):
    parts = []
    digest = hashlib.sha256()
    with path.open("rb") as reader:
        for index, chunk in enumerate(iter(lambda: reader.read(PART_BYTES), b"")):
            part = PACKED / (path.name + f".part-{index:04d}.bin")
            if not part.exists() or part.read_bytes() != chunk:
                part.write_bytes(chunk)
            digest.update(chunk)
            parts.append(part)
    if digest.hexdigest() != sha256_file(path):
        raise ValueError(f"Packed source split did not reconcile: {path.name}")
    return parts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Reconcile against the committed plan")
    args = parser.parse_args()
    cards_dir = DATA / "dm-building-cards-20261026"
    projects_dir = DATA / "dm-municipal-projects-20261026"
    cards_bytes = (cards_dir / "manifest.json").read_bytes()
    projects_bytes = (projects_dir / "manifest.json").read_bytes()
    cards = json.loads(cards_bytes)
    projects = json.loads(projects_bytes)
    if cards["idriveReplicaVerified"] is not False or projects["idriveReplicaVerified"] is not False:
        raise ValueError("Published storage claim changed; review this transfer plan")
    if len(cards["shards"]) != 96 or len(projects["shards"]) != 49:
        raise ValueError("Published shard count changed")
    objects = []
    for name, folder, manifest in [
        ("building-cards", cards_dir, cards),
        ("municipal-projects", projects_dir, projects),
    ]:
        for shard in manifest["shards"]:
            path = folder / shard["file"]
            checked(path, shard["bytes"], shard["sha256"])
            objects.append(object_entry(
                path, PREFIX + name + "/published/" + shard["sha256"] + ".json.gz",
                "published_projection", manifest["sourceId"],
                shardFile=shard["file"],
            ))
    sources = [(cards["sourceFile"], cards["sourceBytes"], cards["sourceSha256"], cards["sourceId"])]
    sources.extend((item["file"], item["bytes"], item["sha256"], item["id"]) for item in projects["sources"])
    assemblies = []
    for name, length, digest, source_id in sources:
        packed = compressed_source(name, length, digest)
        packed_hash = sha256_file(packed)
        parts = split_packed_source(packed)
        part_keys = []
        for index, part in enumerate(parts):
            key = PREFIX + "originals/" + digest + "/" + packed_hash + f"/part-{index:04d}.bin"
            objects.append(object_entry(
                part, key, "private_original_part", source_id,
                partIndex=index, packedSha256=packed_hash, originalSha256=digest,
            ))
            part_keys.append(key)
        assemblies.append({
            "sourceId": source_id,
            "originalBytes": length,
            "originalSha256": digest,
            "packedBytes": packed.stat().st_size,
            "packedSha256": packed_hash,
            "partKeysInOrder": part_keys,
        })
    keys = [item["idriveKey"] for item in objects]
    if len(set(keys)) != len(keys):
        raise ValueError("Duplicate target key")
    report = {
        "planId": "dubai-municipality-idrive-e2-replica-20261114",
        "status": "prepared_not_uploaded",
        "accountId": "b1b843ec85bc39a3a4d370ba4f84f17a",
        "host": "s3.us-west-2.idrivee2.com",
        "signingRegion": "us-east-1",
        "bucket": "espacios-store-a",
        "prefix": PREFIX,
        "separateFromExistingCloudflareBackupRun": True,
        "sourceManifests": {
            "buildingCardsSha256": hashlib.sha256(cards_bytes).hexdigest(),
            "municipalProjectsSha256": hashlib.sha256(projects_bytes).hexdigest(),
        },
        "objects": objects,
        "objectCount": len(objects),
        "totalBytes": sum(item["bytes"] for item in objects),
        "publishedProjectionObjects": 145,
        "privateOriginalPartObjects": sum(item["kind"] == "private_original_part" for item in objects),
        "originalAssemblies": assemblies,
        "verificationRequired": "For every object: private signed GET, exact byte length and SHA-256; concatenate original parts in order, match packed SHA-256, then decompress and match the pinned original byte length and SHA-256. No IDrive claim or runtime cutover before all readbacks pass.",
    }
    if len(objects) != 145 + sum(len(item["partKeysInOrder"]) for item in assemblies):
        raise ValueError("Transfer set changed")
    if args.check:
        if json.loads(OUTPUT.read_text()) != report:
            raise ValueError("Committed replica plan differs from checked local files")
    else:
        OUTPUT.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"status": report["status"], "objectCount": len(objects), "totalBytes": report["totalBytes"]}))


if __name__ == "__main__":
    main()
