#!/usr/bin/env python3
"""Capture two licensed Ajman new-building permission measures twice."""

import datetime
import gzip
import hashlib
import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "data/uae-evidence/ajman"
API = "https://data.ajman.ae/api/explore/v2.1/catalog/datasets"
SOURCES = (
    ("licenses-issued-for-new-buildings-by-number-of-licenses", "new-building-licences-20260901", 268, "2026-09-01T09:56:43.758000+00:00"),
    ("new-licenses-issued-by-built-up-area", "new-building-area-20240709", 198, "2024-07-09T20:38:37.413000+00:00"),
)


def get(url):
    return subprocess.run(
        ["curl", "--fail", "--silent", "--show-error", "--http1.1", "--max-time", "45", url],
        check=True,
        capture_output=True,
    ).stdout


def sha(data):
    return hashlib.sha256(data).hexdigest()


for dataset_id, stem, expected_rows, expected_modified in SOURCES:
    dataset_url = f"{API}/{dataset_id}"
    records_url = f"{dataset_url}/exports/json"
    metadata_bytes = get(dataset_url)
    metadata = json.loads(metadata_bytes)
    meta = metadata.get("metas", {}).get("default", {})
    if (
        metadata.get("dataset_id") != dataset_id
        or meta.get("license") != "CC BY 4.0"
        or meta.get("license_url") != "https://creativecommons.org/licenses/by/4.0/"
        or meta.get("publisher") != "Municipality & Planning Department"
        or meta.get("modified") != expected_modified
        or meta.get("records_count") != expected_rows
    ):
        raise ValueError(f"Review changed publisher metadata for {dataset_id}")
    first, second = get(records_url), get(records_url)
    if first != second or len(json.loads(first)) != expected_rows:
        raise ValueError(f"Independent source read mismatch for {dataset_id}")
    packed = gzip.compress(first, compresslevel=9, mtime=0)
    captured_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    capture = {
        "datasetUrl": f"https://data.ajman.ae/explore/dataset/{dataset_id}/",
        "recordsUrl": records_url,
        "retrievedAt": captured_at,
        "totalCount": expected_rows,
        "independentReadbackCount": len(json.loads(second)),
        "sourceResponseSha256": sha(first),
        "independentReadbackSha256": sha(second),
        "rawBytes": len(first),
        "compressedSha256": sha(packed),
        "compressedBytes": len(packed),
        "metadataSha256": sha(metadata_bytes),
    }
    (OUT / f"{stem}.json.gz").write_bytes(packed)
    (OUT / f"{stem}-source-metadata.json").write_bytes(metadata_bytes)
    (OUT / f"{stem}-capture.json").write_text(json.dumps(capture, indent=2) + "\n")
    print(json.dumps({"dataset": dataset_id, "rows": expected_rows, "sha256": sha(first)}))
