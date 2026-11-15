#!/usr/bin/env python3
"""Partition a pinned Dubai Municipality export without discarding any fields."""
import argparse
import collections
import csv
import gzip
import hashlib
import json
import pathlib
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data/uae-evidence/dubai/dm-building-cards-20261026"
EXPECTED_SHA256 = "69a7d6a7b86c76afa45cd88d084e904941a50112d30595090b10ec696be10798"
SOURCE_ID = "dm-building-summary-information-20261026"
SOURCE_URL = "https://data.dubai/en/l/459523"


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=pathlib.Path, required=True)
    args = parser.parse_args()
    source = args.source.resolve()
    source_bytes = source.stat().st_size
    source_hash = sha256_file(source)
    if source_hash != EXPECTED_SHA256:
        raise SystemExit(f"Unexpected source SHA-256: {source_hash}")

    OUTPUT.mkdir(parents=True, exist_ok=True)
    ids = set()
    buckets = collections.Counter()
    statuses = collections.Counter()
    communities = collections.Counter()
    quality = collections.Counter()
    field_names = None
    with tempfile.TemporaryDirectory(prefix="dm-building-cards-") as temp_name:
        temp = pathlib.Path(temp_name)
        handles = {}
        try:
            with source.open("r", encoding="utf-8-sig", newline="") as stream:
                reader = csv.DictReader(stream)
                field_names = reader.fieldnames
                if not field_names or len(field_names) != 38 or "building_id" not in field_names:
                    raise ValueError("Unexpected Dubai Municipality schema")
                for number, row in enumerate(reader, 1):
                    if None in row or len(row) != len(field_names):
                        raise ValueError(f"Malformed CSV row {number}")
                    raw_id = row["building_id"]
                    if not raw_id.isdecimal() or raw_id in ids:
                        raise ValueError(f"Missing, duplicate, or invalid building ID at row {number}")
                    ids.add(raw_id)
                    bucket = int(raw_id) // 10000
                    if bucket > 9999:
                        raise ValueError(f"Building ID exceeds partition range at row {number}")
                    if bucket not in handles:
                        handles[bucket] = (temp / f"bucket-{bucket:04d}.jsonl").open("w", encoding="utf-8")
                    handles[bucket].write(json.dumps([row[name] for name in field_names], ensure_ascii=False, separators=(",", ":")) + "\n")
                    buckets[bucket] += 1
                    statuses[row["building_status_english"].strip() or "(missing)"] += 1
                    communities[row["community_name_english"].strip() or "(missing)"] += 1
                    for name in ("building_completion_date", "building_usages_english", "community_name_english", "building_total_area"):
                        if not row[name].strip():
                            quality[f"missing_{name}"] += 1
                    if row["building_demolition_date"].strip():
                        quality["with_demolition_date"] += 1
                    if row["building_cancellation_date"].strip():
                        quality["with_cancellation_date"] += 1
        finally:
            for handle in handles.values():
                handle.close()

        shards = []
        for bucket in sorted(buckets):
            name = f"bucket-{bucket:04d}.json.gz"
            target = OUTPUT / name
            with target.open("wb") as raw_output:
                with gzip.GzipFile(filename="", mode="wb", fileobj=raw_output, compresslevel=6, mtime=0) as packed:
                    packed.write(b'{"rows":[')
                    with (temp / f"bucket-{bucket:04d}.jsonl").open("rb") as rows:
                        for position, line in enumerate(rows):
                            if position:
                                packed.write(b",")
                            packed.write(line.rstrip(b"\n"))
                    packed.write(b"]}")
            with gzip.open(target, "rb") as unpacked:
                raw = unpacked.read()
            shard = {
                "bucket": bucket,
                "file": name,
                "rows": buckets[bucket],
                "bytes": target.stat().st_size,
                "sha256": sha256_file(target),
                "decodedBytes": len(raw),
                "decodedSha256": hashlib.sha256(raw).hexdigest(),
            }
            if len(json.loads(raw)["rows"]) != buckets[bucket]:
                raise ValueError(f"Shard count mismatch: {name}")
            shards.append(shard)

    manifest = {
        "sourceId": SOURCE_ID,
        "publisher": "Dubai Municipality",
        "sourceUrl": SOURCE_URL,
        "publisherOpenDataUrl": "https://www.dm.gov.ae/open-data2/",
        "captureDate": "2026-11-11",
        "sourceUpdatedLabel": "26 October 2026, 3:51 PM (portal display; timezone unstated)",
        "sourceFile": source.name,
        "sourceBytes": source_bytes,
        "sourceSha256": source_hash,
        "sourceFields": field_names,
        "sourceRows": sum(buckets.values()),
        "uniqueBuildingIds": len(ids),
        "evidenceClass": "official_permit_system_building_card_snapshot",
        "grain": "one Dubai Municipality building_id",
        "license": "Data.Dubai Open Data License shown on dataset page; dataset metadata says License Not Specified",
        "rightsNotes": "Publisher attribution and source link required. Excludes third-party rights, images, personal/private entity data. Original information cannot be sold or resold. Adapted material is offered under the same open-data license.",
        "storage": "checksum_verified_immutable_worker_assets",
        "idriveReplicaVerified": False,
        "limits": "Permit-system building cards are not a census of standing completed buildings, live commercial spaces, available units, registered sales or rents. No building coordinates are present. Status and completion-date fields must be interpreted separately; missing values remain missing.",
        "quality": {
            "missing": {key: value for key, value in sorted(quality.items()) if key.startswith("missing_")},
            "datedRemovalFields": {key: value for key, value in sorted(quality.items()) if key.startswith("with_")},
            "statusCounts": dict(sorted(statuses.items())),
            "communityCount": len(communities) - int("(missing)" in communities),
            "missingCommunityRows": communities.get("(missing)", 0),
        },
        "bucketSize": 10000,
        "shards": shards,
    }
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({"sourceRows": manifest["sourceRows"], "uniqueBuildingIds": len(ids), "shards": len(shards), "sourceSha256": source_hash, "packedBytes": sum(item["bytes"] for item in shards)}, indent=2))


if __name__ == "__main__":
    main()
