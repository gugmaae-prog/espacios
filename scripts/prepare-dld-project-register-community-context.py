#!/usr/bin/env python3
"""Build community-scoped summaries from the public DLD project-register CSV.

The source CSV is not copied into the repository. Only exact, unique
master_project_en matches to catalogue community names are summarized. These
summaries describe the DLD master-project cohort, not community boundaries or
financial history.
"""
import argparse
import csv
import gzip
import hashlib
import json
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "data/historical-intelligence"
SOURCE_ID = "dld-official-projects-20260706-recapture-20261008"
SOURCE_URL = "https://data.dubai/en/l/467654"
SOURCE_FILE = "projects_2026-07-06_16-25-21_0001.csv"
SOURCE_SHA256 = "ffee59d637b1383e62ea24dab5be77e957090abf3860ce26b00b873fbdda6078"
SOURCE_ROW_COUNT = 3039
SOURCE_FIRST_AVAILABLE = "2026-10-04T20:44:21.855572+00:00"
LICENSE = (
    "Dubai Open Data Licence; attribution required, commercial derivatives allowed, "
    "original data resale prohibited"
)


def norm(value):
    value = unicodedata.normalize("NFKC", str(value or "")).casefold()
    return " ".join(re.sub(r"[^\w]+", " ", value).split())


def load_snapshot():
    manifest = json.loads((BASE / "publication-manifest.json").read_text())
    root = ROOT / manifest["rootIndex"]["path"]
    blob = root.read_bytes()
    if hashlib.sha256(blob).hexdigest() != manifest["rootIndex"]["sha256"]:
        raise ValueError("Published catalogue root checksum mismatch")
    snapshot = json.loads(gzip.decompress(blob))
    if snapshot.get("version") != "20261008-enrichment-v24":
        raise ValueError(f"Expected V24 source catalogue; found {snapshot.get('version')!r}")
    if len(snapshot.get("records", [])) != 1860:
        raise ValueError("The fixed 1,860-record catalogue changed")
    return snapshot


def read_rows(path):
    raw = path.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if path.name != SOURCE_FILE or digest != SOURCE_SHA256:
        raise ValueError("Input must be the reviewed official DLD CSV snapshot with its pinned name and checksum")
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        rows = list(csv.DictReader(stream))
    if len(rows) != SOURCE_ROW_COUNT:
        raise ValueError(f"Expected {SOURCE_ROW_COUNT} rows, found {len(rows)}")
    ids = [row.get("project_id", "").strip() for row in rows]
    if any(not value for value in ids) or len(set(ids)) != SOURCE_ROW_COUNT:
        raise ValueError("DLD project IDs are missing or duplicated")
    load_timestamps = {row.get("load_timestamp", "").strip() for row in rows}
    if len(load_timestamps) != 1 or not next(iter(load_timestamps)):
        raise ValueError("The source-native load timestamp is inconsistent")
    return rows, digest, next(iter(load_timestamps))


def build_packet(input_path, retrieved_at, output_path):
    snapshot = load_snapshot()
    rows, digest, load_timestamp = read_rows(input_path)
    existing_sources = json.loads((BASE / "scrape-enrichment.json").read_text()).get("sources", [])
    prior = next((source for source in existing_sources if source.get("id") == "dld-official-projects-20260706"), None)
    if not prior or prior.get("url") != SOURCE_URL:
        raise ValueError("The prior official DLD source registration was not found")

    groups = defaultdict(list)
    communities = defaultdict(list)
    for record in snapshot["records"]:
        if record.get("type") == "community" and record.get("emirate") == "Dubai":
            communities[norm(record.get("name"))].append(record)

    for row in rows:
        key = norm(row.get("master_project_en"))
        targets = communities.get(key, [])
        if key and len(targets) == 1:
            groups[targets[0]["id"]].append(row)

    if len(groups) != 43 or sum(len(group) for group in groups.values()) != 1829:
        raise ValueError(
            f"Exact DLD master-label reconciliation changed: {len(groups)} communities, "
            f"{sum(map(len, groups.values()))} source rows"
        )

    # The same immutable dataset already informed project-level records. Keep a
    # distinct retrieval capture so its verified checksum does not overwrite the
    # earlier provenance entry.
    source = {
        "id": SOURCE_ID,
        "publisher": "Dubai Land Department via Dubai Data and Statistics Establishment",
        "url": SOURCE_URL,
        "datasetId": 467654,
        "fileName": SOURCE_FILE,
        "classification": "primary_authority_project_register_snapshot",
        "licence": LICENSE,
        "firstAvailableAt": SOURCE_FIRST_AVAILABLE,
        "retrievedAt": retrieved_at,
        "publishedAt": None,
        "publicationDateStatus": "Exact publication timestamp not exposed; source filename timestamp retained separately.",
        "datasetFileTimestamp": "2026-07-06 16:25:21",
        "sourceLoadTimestamp": load_timestamp,
        "sourceRecordCount": SOURCE_ROW_COUNT,
        "uniqueProjectIdCount": SOURCE_ROW_COUNT,
        "bytes": input_path.stat().st_size,
        "sha256": digest,
        "extractionVersion": "reviewed-dld-community-register-context-v1",
        "rawBodyRetained": False,
        "rawBodyRedistributed": False,
        "primaryEvidence": True,
        "availabilityBasis": "The CSV file was downloaded directly from the public DLD project-register dataset page; first prior retrieval is retained from the existing source register.",
    }

    records_by_id = {record["id"]: record for record in snapshot["records"]}
    facts = []
    for record_id, group in sorted(groups.items()):
        record = records_by_id[record_id]
        master_labels = {" ".join(row.get("master_project_en", "").split()) for row in group}
        if len(master_labels) != 1:
            raise ValueError(f"Conflicting master-project labels for {record_id}")
        status_counts = dict(sorted(Counter(row.get("project_status", "").strip() or "UNKNOWN" for row in group).items()))
        area_labels = sorted({" ".join(row.get("area_name_en", "").split()) for row in group if row.get("area_name_en", "").strip()})
        if sum(status_counts.values()) != len(group):
            raise ValueError(f"Status counts do not reconcile for {record_id}")
        if not area_labels:
            raise ValueError(f"No source area labels for {record_id}")
        ident = "dld-project-register-community-" + hashlib.sha256(record_id.encode()).hexdigest()[:20]
        if any(item.get("id") == ident for item in record.get("registerEvidence", [])):
            raise ValueError(f"Evidence already present for {record_id}")
        identity_basis = (
            "Exact normalized DLD master_project_en label matches one unique Dubai community catalogue record. "
            "This links the named DLD master-project cohort only; it does not establish a legal boundary, "
            "complete community inventory, or a financial history."
        )
        facts.append({
            "id": ident,
            "status": "accepted",
            "kind": "register",
            "recordId": record_id,
            "sourceId": SOURCE_ID,
            "sourceIds": [SOURCE_ID],
            "identitySourceIds": [SOURCE_ID],
            "identityBasis": identity_basis,
            "firstAvailableAt": SOURCE_FIRST_AVAILABLE,
            "publishedAt": None,
            "scope": "community_context",
            "identityVerified": True,
            "evidenceClass": "official_dld_master_project_register_community_context",
            "fields": {
                "nativeMasterProjectLabel": next(iter(master_labels)),
                "registeredProjectRecordsInSource": len(group),
                "sourceProjectStatusCounts": status_counts,
                "sourceAreaLabels": area_labels,
                "sourceLoadTimestamp": load_timestamp,
                "catalogueMatchMethod": "unique normalized exact-name match against DLD master_project_en",
                "scopeLimit": "Counts cover DLD project rows with this exact master-project label in this dated source snapshot. They are not total dwellings, completed inventory, legal boundaries, or price observations.",
            },
        })

    packet = {
        "schemaVersion": 1,
        "passId": "dld-project-register-community-context-20261008",
        "asOf": "2026-10-08",
        "sources": [source],
        "facts": facts,
        "seriesLinks": [],
        "historyInputs": [],
        "licensedArchives": [],
        "additionalDatasets": [{
            "sourceId": SOURCE_ID,
            "attribution": "Dubai Land Department via Dubai Data and Statistics Establishment",
            "datasetId": 467654,
            "sourceUrl": SOURCE_URL,
            "fileName": SOURCE_FILE,
            "sourceFileSha256": digest,
            "sourceRows": SOURCE_ROW_COUNT,
            "uniqueProjectIds": SOURCE_ROW_COUNT,
            "exactMasterLabelCommunityMatches": len(groups),
            "matchedProjectRows": sum(len(group) for group in groups.values()),
            "scope": "Exact unique master-project label context only; no legal boundary or financial-price inference.",
        }],
        "recordResearch": [],
        "sourceCandidates": [],
        "collection": {
            "passId": "dld-project-register-community-context-20261008",
            "sourceRecordCount": SOURCE_ROW_COUNT,
            "uniqueProjectIdCount": SOURCE_ROW_COUNT,
            "exactUniqueCommunityMatches": len(groups),
            "matchedProjectRows": sum(len(group) for group in groups.values()),
            "ambiguousOrUnmatchedRowsExcluded": SOURCE_ROW_COUNT - sum(len(group) for group in groups.values()),
            "derivedCommunityRegisterFacts": len(facts),
            "newProjectOrCommunityRecords": 0,
            "newPriceOrRentObservations": 0,
            "completeCommunityInventoryClaimed": False,
            "rawSourceRetainedInRepository": False,
            "rawSourceRedistributed": False,
            "facts": [{"kind": "register", "count": len(facts), "scope": "community_context"}],
        },
        "methodology": (
            "Download the public DLD Real Estate Projects CSV from the source URL, verify the pinned file name, SHA-256, "
            "3,039 rows and unique project IDs, then normalize Unicode/case/punctuation in master_project_en and catalogue "
            "community names. Retain only labels that resolve to exactly one Dubai community. Aggregate source-native "
            "project_status counts per exact master-project label. Exclude all ambiguous and unmatched labels. The register "
            "is a dated project snapshot; counts are not community boundaries, complete inventory, prices, sales, rents, "
            "completion certificates or occupancy."
        ),
    }
    output_path.write_text(json.dumps(packet, ensure_ascii=False, indent=2) + "\n")
    return packet


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True, help="Downloaded DLD CSV; it is not copied into the repository")
    parser.add_argument("--output", type=Path, default=BASE / "dld-project-register-community-context-20261008.json")
    parser.add_argument("--retrieved-at", required=True, help="UTC ISO-8601 retrieval time for this exact download")
    args = parser.parse_args()
    if not args.retrieved_at.endswith("Z") or not datetime.fromisoformat(args.retrieved_at.replace("Z", "+00:00")):
        raise ValueError("--retrieved-at must be a UTC ISO-8601 timestamp ending in Z")
    packet = build_packet(args.input, args.retrieved_at, args.output)
    print(json.dumps(packet["collection"], ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
