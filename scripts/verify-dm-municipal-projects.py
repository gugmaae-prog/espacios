#!/usr/bin/env python3
"""Independently compare every published municipal field with both source CSVs."""

import argparse
import collections
import csv
import gzip
import hashlib
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / "data/uae-evidence/dubai/dm-municipal-projects-20261026"
CARDS = ROOT / "data/uae-evidence/dubai/dm-building-cards-20261026"
PROJECT_FIELDS = (
    "project_no", "parcel_id", "project_creation_date", "permit_date",
    "work_start_date", "expected_completion_date", "project_completion_date",
    "project_status_arabic", "project_status_english", "load_timestamp",
)
LINK_FIELDS = (
    "project_no", "building_id", "building_construction_stage_a",
    "building_construction_stage_e", "building_cost", "load_timestamp",
)
WITHHELD = {
    "applicanttype", "consultant_arabic", "consultant_english",
    "consultant_license_no", "contractor_arabic", "contractor_english",
    "contractor_license_no", "related_entity_name_ar", "related_entity_name_en",
}


def file_sha(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def number(raw):
    match = re.fullmatch(r"(\d+)(?:\.0+)?", raw.strip())
    if not match:
        raise ValueError("Invalid numeric source key")
    return str(int(match.group(1)))


def row_digest(digest, row):
    digest.update(json.dumps(row, ensure_ascii=False, separators=(",", ":")).encode("utf-8") + b"\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--projects", required=True, type=pathlib.Path)
    parser.add_argument("--links", required=True, type=pathlib.Path)
    args = parser.parse_args()
    manifest_bytes = (DATA / "manifest.json").read_bytes()
    manifest = json.loads(manifest_bytes)
    projects_path, links_path = args.projects.resolve(), args.links.resolve()
    assert list(PROJECT_FIELDS) == manifest["projectFields"]
    assert list(LINK_FIELDS) == manifest["linkFields"]
    assert not WITHHELD.intersection(manifest["projectFields"])
    assert file_sha(projects_path) == manifest["sources"][0]["sha256"]
    assert file_sha(links_path) == manifest["sources"][1]["sha256"]

    source_digests = collections.defaultdict(lambda: {"projects": hashlib.sha256(), "links": hashlib.sha256()})
    source_counts = collections.defaultdict(collections.Counter)
    project_ids = set()
    with projects_path.open("r", encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        assert set(reader.fieldnames) == set(PROJECT_FIELDS) | WITHHELD
        for row in reader:
            project_no = number(row["project_no"])
            assert project_no not in project_ids
            project_ids.add(project_no)
            bucket = int(project_no) // manifest["bucketSize"]
            projected = [project_no if field == "project_no" else row[field] for field in PROJECT_FIELDS]
            row_digest(source_digests[bucket]["projects"], projected)
            source_counts[bucket]["projects"] += 1

    card_manifest = json.loads((CARDS / "manifest.json").read_text())
    assert card_manifest["sourceSha256"] == manifest["buildingCardSourceSha256"]
    bi = card_manifest["sourceFields"].index("building_id")
    pi = card_manifest["sourceFields"].index("project_no")
    card_projects = {}
    for shard in card_manifest["shards"]:
        with gzip.open(CARDS / shard["file"], "rt", encoding="utf-8") as source:
            for row in json.load(source)["rows"]:
                card_projects[number(row[bi])] = number(row[pi]) if row[pi].strip() else None
    assert len(card_projects) == card_manifest["sourceRows"]

    link_pairs = set()
    linked_projects = set()
    linked_buildings = collections.Counter()
    disagreement = set()
    with links_path.open("r", encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        assert set(reader.fieldnames) == set(LINK_FIELDS)
        for row in reader:
            project_no, building_id = number(row["project_no"]), number(row["building_id"])
            assert project_no in project_ids and building_id in card_projects
            pair = (project_no, building_id)
            assert pair not in link_pairs
            link_pairs.add(pair)
            linked_projects.add(project_no)
            linked_buildings[building_id] += 1
            if card_projects[building_id] != project_no:
                disagreement.add(building_id)
            bucket = int(project_no) // manifest["bucketSize"]
            projected = [project_no, building_id] + [row[field] for field in LINK_FIELDS[2:]]
            row_digest(source_digests[bucket]["links"], projected)
            source_counts[bucket]["links"] += 1

    assert len(project_ids) == manifest["projectRows"] == 481358
    assert len(link_pairs) == manifest["linkRows"] == 208946
    assert len(linked_projects) == manifest["linkedProjectNos"] == 129113
    assert len(linked_buildings) == manifest["linkedBuildingIds"] == 208944
    assert sorted(disagreement, key=int) == manifest["ambiguousBuildingIds"]
    assert set(source_counts) == {shard["bucket"] for shard in manifest["shards"]}

    for shard in manifest["shards"]:
        path = DATA / shard["file"]
        assert path.stat().st_size == shard["bytes"] and file_sha(path) == shard["sha256"]
        with gzip.open(path, "rb") as source:
            decoded = source.read()
        assert len(decoded) == shard["decodedBytes"] and hashlib.sha256(decoded).hexdigest() == shard["decodedSha256"]
        payload = json.loads(decoded)
        for kind, expected_fields in (("projects", PROJECT_FIELDS), ("links", LINK_FIELDS)):
            rows = payload[kind]
            assert len(rows) == shard[kind] == source_counts[shard["bucket"]][kind]
            digest = hashlib.sha256()
            for row in rows:
                assert len(row) == len(expected_fields)
                row_digest(digest, row)
            assert digest.hexdigest() == source_digests[shard["bucket"]][kind].hexdigest()

    report = {
        "sourceId": manifest["sourceId"],
        "projectSourceSha256": manifest["sources"][0]["sha256"],
        "linkSourceSha256": manifest["sources"][1]["sha256"],
        "manifestSha256": hashlib.sha256(manifest_bytes).hexdigest(),
        "projectRows": manifest["projectRows"],
        "linkRows": manifest["linkRows"],
        "projectFieldsPublished": len(PROJECT_FIELDS),
        "projectFieldsWithheld": len(WITHHELD),
        "linkFieldsPublished": len(LINK_FIELDS),
        "linkedProjectNos": len(linked_projects),
        "linkedBuildingIds": len(linked_buildings),
        "ambiguousBuildingIds": sorted(disagreement, key=int),
        "shards": len(manifest["shards"]),
        "partitionBytes": sum(shard["bytes"] for shard in manifest["shards"]),
        "exactProjectionReconciliation": "all_481358_project_rows_and_208946_link_rows_match_the_approved_field_projection",
        "verifiedOn": "2026-11-14",
        "sourceAccess": "local downloads from official Data.Dubai pages; original CSVs are not committed",
    }
    (DATA.parent / "dm-municipal-projects-validation.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
