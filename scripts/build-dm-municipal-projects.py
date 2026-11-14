#!/usr/bin/env python3
"""Build a public-safe municipal project projection and exact building links.

The two official source CSVs remain local. Contractor, consultant, applicant,
licence and related-entity values are deliberately excluded from the public
projection, including the committed shards. Municipal project numbers are not
treated as DLD development IDs or accepted V48 catalogue identities.
"""

import argparse
import collections
import csv
import gzip
import hashlib
import json
import pathlib
import re
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data/uae-evidence/dubai/dm-municipal-projects-20261026"
CARD_DATA = ROOT / "data/uae-evidence/dubai/dm-building-cards-20261026"
PROJECT_SHA = "1ad25211a9f92c280837530da7526e8847532196f3b20eac29e7bd8e3222750e"
LINK_SHA = "e62dbdf728fcaf7195e87ff03c038347e90a89f3ba44299cd9ec17d4544831d2"
BUCKET_SIZE = 10000
PROJECT_FIELDS = (
    "project_no", "parcel_id", "project_creation_date", "permit_date",
    "work_start_date", "expected_completion_date", "project_completion_date",
    "project_status_arabic", "project_status_english", "load_timestamp",
)
LINK_FIELDS = (
    "project_no", "building_id", "building_construction_stage_a",
    "building_construction_stage_e", "building_cost", "load_timestamp",
)
WITHHELD_PROJECT_FIELDS = (
    "applicanttype", "consultant_arabic", "consultant_english",
    "consultant_license_no", "contractor_arabic", "contractor_english",
    "contractor_license_no", "related_entity_name_ar", "related_entity_name_en",
)


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def identifier(value):
    match = re.fullmatch(r"(\d+)(?:\.0+)?", value.strip())
    if not match:
        raise ValueError(f"Invalid source identifier: {value[:32]!r}")
    return str(int(match.group(1)))


def source_rows(path, expected_sha, required_fields):
    if sha256_file(path) != expected_sha:
        raise ValueError(f"Source checksum changed: {path.name}")
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        if not reader.fieldnames or set(reader.fieldnames) != set(required_fields):
            raise ValueError(f"Source schema changed: {path.name}")
        for number, row in enumerate(reader, 1):
            if None in row or len(row) != len(reader.fieldnames):
                raise ValueError(f"Malformed source row {number}: {path.name}")
            yield row


def card_project_numbers():
    manifest = json.loads((CARD_DATA / "manifest.json").read_text())
    building_index = manifest["sourceFields"].index("building_id")
    project_index = manifest["sourceFields"].index("project_no")
    result = {}
    for shard in manifest["shards"]:
        path = CARD_DATA / shard["file"]
        if path.stat().st_size != shard["bytes"] or sha256_file(path) != shard["sha256"]:
            raise ValueError("Building-card input checksum changed")
        with gzip.open(path, "rt", encoding="utf-8") as stream:
            for row in json.load(stream)["rows"]:
                key = identifier(row[building_index])
                if key in result:
                    raise ValueError("Duplicate building-card ID")
                project = row[project_index]
                result[key] = identifier(project) if project.strip() else None
    if len(result) != manifest["uniqueBuildingIds"]:
        raise ValueError("Building-card input count changed")
    return result, manifest


def write_jsonl(handle, values):
    handle.write(json.dumps(values, ensure_ascii=False, separators=(",", ":")) + "\n")


def read_jsonl(path):
    with path.open("r", encoding="utf-8") as stream:
        return [json.loads(line) for line in stream]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--projects", type=pathlib.Path, required=True)
    parser.add_argument("--links", type=pathlib.Path, required=True)
    args = parser.parse_args()
    projects_source, links_source = args.projects.resolve(), args.links.resolve()
    OUTPUT.mkdir(parents=True, exist_ok=True)

    card_projects, card_manifest = card_project_numbers()
    project_ids = set()
    project_status = collections.Counter()
    project_missing = collections.Counter()
    project_buckets = collections.Counter()
    link_buckets = collections.Counter()
    linked_buildings = collections.Counter()
    linked_projects = set()
    conflicting_buildings = set()
    pair_ids = set()

    with tempfile.TemporaryDirectory(prefix="dm-municipal-projects-") as temporary:
        temp = pathlib.Path(temporary)
        handles = {}

        def handle(kind, bucket):
            key = (kind, bucket)
            if key not in handles:
                handles[key] = (temp / f"{kind}-{bucket:04d}.jsonl").open("w", encoding="utf-8")
            return handles[key]

        try:
            for row in source_rows(projects_source, PROJECT_SHA, PROJECT_FIELDS + WITHHELD_PROJECT_FIELDS):
                project_no = identifier(row["project_no"])
                if project_no in project_ids:
                    raise ValueError("Duplicate municipal project number")
                project_ids.add(project_no)
                bucket = int(project_no) // BUCKET_SIZE
                values = [project_no if field == "project_no" else row[field] for field in PROJECT_FIELDS]
                write_jsonl(handle("projects", bucket), values)
                project_buckets[bucket] += 1
                project_status[row["project_status_english"].strip() or "(missing)"] += 1
                for field in PROJECT_FIELDS:
                    if field != "project_no" and not row[field].strip():
                        project_missing[field] += 1

            for row in source_rows(links_source, LINK_SHA, LINK_FIELDS):
                project_no = identifier(row["project_no"])
                building_id = identifier(row["building_id"])
                if project_no not in project_ids or building_id not in card_projects:
                    raise ValueError("Unresolved official project or building ID")
                pair = (project_no, building_id)
                if pair in pair_ids:
                    raise ValueError("Duplicate project-building pair")
                pair_ids.add(pair)
                linked_projects.add(project_no)
                linked_buildings[building_id] += 1
                if card_projects[building_id] != project_no:
                    conflicting_buildings.add(building_id)
                bucket = int(project_no) // BUCKET_SIZE
                values = [project_no, building_id] + [row[field] for field in LINK_FIELDS[2:]]
                write_jsonl(handle("links", bucket), values)
                link_buckets[bucket] += 1
        finally:
            for opened in handles.values():
                opened.close()

        if len(project_ids) != 481358 or sum(link_buckets.values()) != 208946:
            raise ValueError("Pinned source row count changed")
        if len(linked_projects) != 129113 or len(linked_buildings) != 208944:
            raise ValueError("Pinned project-building cardinality changed")
        if len(conflicting_buildings) != 2 or sum(n - 1 for n in linked_buildings.values()) != 2:
            raise ValueError("Pinned building-link conflicts changed")

        shards = []
        for bucket in sorted(project_buckets):
            projects = read_jsonl(temp / f"projects-{bucket:04d}.jsonl")
            links_path = temp / f"links-{bucket:04d}.jsonl"
            links = read_jsonl(links_path) if links_path.exists() else []
            decoded = json.dumps({"projects": projects, "links": links}, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            name = f"bucket-{bucket:04d}.json.gz"
            target = OUTPUT / name
            with target.open("wb") as raw:
                with gzip.GzipFile(filename="", mode="wb", fileobj=raw, compresslevel=6, mtime=0) as packed:
                    packed.write(decoded)
            shards.append({
                "bucket": bucket, "file": name, "projects": len(projects), "links": len(links),
                "bytes": target.stat().st_size, "sha256": sha256_file(target),
                "decodedBytes": len(decoded), "decodedSha256": hashlib.sha256(decoded).hexdigest(),
            })

    manifest = {
        "sourceId": "dm-municipal-projects-and-building-links-20261026",
        "publisher": "Dubai Municipality",
        "captureDate": "2026-11-14",
        "sourceUpdatedLabel": "26 October 2026 (portal display; timezone unstated)",
        "sources": [
            {"id": "dm-project-information-20261026", "url": "https://data.dubai/en/l/467616", "file": projects_source.name, "bytes": projects_source.stat().st_size, "sha256": PROJECT_SHA, "rows": len(project_ids), "sourceFields": list(PROJECT_FIELDS + WITHHELD_PROJECT_FIELDS), "publishedFields": list(PROJECT_FIELDS), "withheldFields": list(WITHHELD_PROJECT_FIELDS)},
            {"id": "dm-project-building-information-20261026", "url": "https://data.dubai/en/l/467604", "file": links_source.name, "bytes": links_source.stat().st_size, "sha256": LINK_SHA, "rows": sum(link_buckets.values()), "sourceFields": list(LINK_FIELDS), "publishedFields": list(LINK_FIELDS)},
        ],
        "publisherOpenDataUrl": "https://www.dm.gov.ae/open-data2/",
        "license": "Data.Dubai Open Data License displayed; publisher attribution required. Reuse of personal or private entity information is excluded from this public projection.",
        "evidenceClass": "official_municipal_project_application_snapshot",
        "grain": "one Dubai Municipality project_no; linked building rows retain their own source grain",
        "storage": "checksum_verified_immutable_worker_assets",
        "idriveReplicaVerified": False,
        "projectRows": len(project_ids), "linkRows": sum(link_buckets.values()),
        "linkedProjectNos": len(linked_projects), "linkedBuildingIds": len(linked_buildings),
        "buildingCardSourceId": card_manifest["sourceId"],
        "buildingCardSourceSha256": card_manifest["sourceSha256"],
        "buildingCardProjectNoAgreementRows": sum(link_buckets.values()) - len(conflicting_buildings),
        "ambiguousBuildingIds": sorted(conflicting_buildings, key=int),
        "projectFields": list(PROJECT_FIELDS), "linkFields": list(LINK_FIELDS),
        "quality": {"projectStatusCounts": dict(sorted(project_status.items())), "projectMissingFields": dict(sorted(project_missing.items())), "sourceBuildingIdDuplicateRows": sum(n - 1 for n in linked_buildings.values() if n > 1)},
        "limits": "Municipal permit/application project numbers are not verified DLD real-estate development IDs or V48 map identities. Open/Closed status and filed completion dates are not independent proof of physical completion. Building cost is publisher construction-cost data, not sale price or valuation. No project or building coordinates, current unit availability, registered sales, or rents are supplied.",
        "bucketSize": BUCKET_SIZE,
        "shards": shards,
    }
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({"projectRows": manifest["projectRows"], "linkRows": manifest["linkRows"], "shards": len(shards), "packedBytes": sum(s["bytes"] for s in shards), "ambiguousBuildingIds": manifest["ambiguousBuildingIds"]}, indent=2))


if __name__ == "__main__":
    main()
