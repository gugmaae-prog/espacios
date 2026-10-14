#!/usr/bin/env python3
"""Deterministic, evidence-neutral regional review queue. No HTTP or publication."""
import argparse
import collections
import csv
import gzip
import hashlib
import io
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
HISTORY = ROOT / "data/historical-intelligence"
FIXED = (1645, 215)
ACCEPTED_STATES = {"present", "partial", "missing", "unestablished", "disputed",
                   "inaccessible", "pre-applicability"}
QUEUED_REGIONS = ("Abu Dhabi / Ghantoot", "Palm Jebel Ali", "Umm Al Quwain",
                  "Fujairah", "All-emirates remainder")


def canonical_json(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def normalized(value):
    return re.sub(r"[^a-z0-9]+", "", str(value or "").casefold())


def selected_region(rec, catalogue):
    emirate = rec.get("emirate")
    name = rec.get("name", "")
    base = catalogue.get(rec["id"], {})
    map_row = base.get("mapRecord", {})
    area = str(map_row.get("area") or "")
    community = str(rec.get("communityId") or "")
    text = normalized(" ".join((name, area, community)))
    if emirate == "Abu Dhabi" and rec.get("type") == "project":
        return "Abu Dhabi / Ghantoot", 0
    if emirate == "Dubai" and ("palmjebelali" in text or "palmjabalali" in text):
        return "Palm Jebel Ali", 1
    if emirate == "Umm Al Quwain":
        return "Umm Al Quwain", 2
    if emirate == "Fujairah":
        return "Fujairah", 3
    return "All-emirates remainder", 4


def explicit_id_proofs(rec):
    proofs = []
    for fact in rec.get("registerEvidence") or []:
        if fact.get("identityVerified") is not True or fact.get("scope") != "subject":
            continue
        identity = fact.get("registeredProjectId")
        if identity is not None and str(identity).strip():
            proofs.append({
                "authorityProjectId": str(identity),
                "sourceIds": fact.get("sourceIds") or ([fact["sourceId"]] if fact.get("sourceId") else []),
                "identityBasis": fact.get("identityBasis"),
                "factId": fact.get("id"),
            })
    ids = {x["authorityProjectId"] for x in proofs}
    if len(ids) > 1:
        return proofs, "conflicting_authority_ids"
    return proofs, None


def compact_record(rec, catalogue, duplicate_names):
    base = catalogue.get(rec["id"], {})
    m = base.get("mapRecord") or {}
    status = rec.get("researchStatus") or {}
    item_statuses = {k: (v or {}).get("status", "unestablished")
                     for k, v in (status.get("itemCoverage") or {}).items()}
    if not set(item_statuses.values()).issubset(ACCEPTED_STATES):
        raise ValueError("Unknown coverage state on " + rec["id"])
    proofs, conflict = explicit_id_proofs(rec)
    source_ids = sorted({str(s) for obj in (rec.get("lifecycle") or [])
                         + (rec.get("observations") or [])
                         + (rec.get("registerEvidence") or [])
                         for s in (obj.get("sourceIds") or ([obj.get("sourceId")] if obj.get("sourceId") else []))
                         if s})
    history = rec.get("historySeries") or []
    direct_sales = [s for s in history if s.get("scope") == "subject"
                    and s.get("identityVerified") is True and s.get("metric") == "price"]
    direct_rents = [s for s in history if s.get("scope") == "subject"
                    and s.get("identityVerified") is True and s.get("metric") == "rent"]
    unique = normalized(rec.get("name"))
    dup = duplicate_names[(rec["type"], rec["emirate"], unique)] > 1
    phase = bool(re.search(r"\b(?:phase|tower|building|block|frond|cluster)\b",
                           str(rec.get("name") or ""), re.I))
    reasons = []
    if not proofs and rec["type"] == "project":
        reasons.append("exact_authority_project_id_unverified")
    if dup:
        reasons.append("duplicate_normalized_name_review")
    if phase:
        reasons.append("parent_phase_scope_review")
    if not rec.get("communityId") and rec["type"] == "project":
        reasons.append("community_crosswalk_unresolved")
    if conflict:
        reasons.append(conflict)
    if status.get("identityCandidates") == "quarantined":
        reasons.append("quarantined_identity_candidates_no_coverage_credit")
    region, priority = selected_region(rec, catalogue)
    near_ghantoot = rec["emirate"] == "Abu Dhabi" and any(
        token in normalized(" ".join((str(rec.get("name") or ""), str(m.get("area") or ""),
                                     str(rec.get("communityId") or ""))))
        for token in ("ghantoot", "ghantout", "ghantut"))
    return {
        "id": rec["id"], "type": rec["type"], "emirate": rec["emirate"],
        "name": rec["name"], "region": region, "priority": priority,
        "ghantootNameOrAreaFlag": near_ghantoot,
        "catalogueArea": m.get("area"), "communityId": rec.get("communityId"),
        "marketingDeveloperUnverified": m.get("developer") or base.get("facts", {}).get("Developer"),
        "legalDeveloper": None,
        "aliasesExplicit": rec.get("aliases") or [],
        "authorityProofs": proofs,
        "identityCandidates": status.get("identityCandidates"),
        "identityCandidateCount": status.get("identityCandidateCount", 0),
        "reviewReasons": reasons,
        "lifecycle": [
            {"id": x.get("id"), "kind": x.get("kind"), "date": x.get("date"),
             "eventStatus": x.get("eventStatus"), "status": x.get("status"),
             "scope": x.get("scope"), "sourceIds": x.get("sourceIds") or []}
            for x in rec.get("lifecycle") or []
        ],
        "financialEvidence": {
            "directSaleSeries": [x.get("id") for x in direct_sales],
            "directRentSeries": [x.get("id") for x in direct_rents],
            "nativeObservationCount": len(rec.get("observations") or []),
            "currentSnapshot": rec.get("currentSnapshot") or {},
            "scenarioInputsPresent": bool(rec.get("scenarioInputs")),
            "approvedScenarioPoints": (rec.get("scenarioCoverage") or {}).get("approvedAnnualPoints", 0),
        },
        "evidenceSourceIds": source_ids,
        "coverageItems": item_statuses,
        "gaps": status.get("gaps") or [],
        "classification": "inventory_review_only_no_new_observed_evidence",
    }


def compile_queue(snapshot, inventory, publication):
    if snapshot.get("version") != publication.get("version"):
        raise ValueError("Snapshot and publication manifest versions disagree")
    records = snapshot.get("records") or []
    projects = sum(x.get("type") == "project" for x in records)
    communities = sum(x.get("type") == "community" for x in records)
    if (projects, communities) != FIXED or publication.get("counts", {}).get("records") != 1860:
        raise ValueError("Fixed 1,645 project / 215 community catalogue was altered")
    ids = [x.get("id") for x in records]
    if not all(isinstance(x, str) and x for x in ids) or len(set(ids)) != 1860:
        raise ValueError("Null or duplicate catalogue record IDs")
    catalogue = {x["id"]: x for k in ("projects", "communities") for x in inventory[k]}
    if set(catalogue) != set(ids):
        raise ValueError("Source catalogue IDs differ from reviewed snapshot")
    names = collections.Counter((x.get("type"), x.get("emirate"), normalized(x.get("name"))) for x in records)
    output = [compact_record(x, catalogue, names) for x in records]
    output.sort(key=lambda x: (x["priority"], not x["ghantootNameOrAreaFlag"],
                               x["emirate"], x["name"].casefold(), x["id"]))
    if len(output) != 1860 or set(x["id"] for x in output) != set(ids):
        raise ValueError("Regional queue lost an existing record")
    if any(x["financialEvidence"]["approvedScenarioPoints"] for x in output):
        raise ValueError("Candidate queue must not silently approve scenario points")
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out-dir", default="data/historical-intelligence/review-queues/2026-10-14")
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()
    publication_path = HISTORY / "publication-manifest.json"
    index_path = ROOT / "data/historical-intelligence-20261003.json"
    source_manifest = read_json(HISTORY / "inputs/manifest.json")
    input_path = ROOT / source_manifest["inventory"]["path"]
    if digest(input_path) != source_manifest["inventory"]["compressedSha256"]:
        raise ValueError("Pinned catalogue gzip integrity failed")
    with gzip.open(input_path, "rt", encoding="utf-8") as source:
        inventory = json.load(source)
    publication = read_json(publication_path)
    snapshot = read_json(index_path)
    output = compile_queue(snapshot, inventory, publication)
    counts = collections.Counter(x["region"] for x in output)
    priority_counts = {name: counts.get(name, 0) for name in QUEUED_REGIONS}
    inventory_bytes = "".join(canonical_json(x) + "\n" for x in output).encode("utf-8")
    receipt = {
        "reviewAsOf": "2026-10-14",
        "snapshotVersion": snapshot["version"],
        "snapshotAsOf": snapshot.get("asOf"),
        "snapshotSha256": digest(index_path),
        "manifestSha256": digest(publication_path),
        "inventoryGzipSha256": digest(input_path),
        "fixedRecords": {"projects": FIXED[0], "communities": FIXED[1], "total": 1860},
        "queueCounts": priority_counts,
        "ghantootFlagged": sum(x["ghantootNameOrAreaFlag"] for x in output),
        "duplicateNameReviewRecords": sum("duplicate_normalized_name_review" in x["reviewReasons"] for x in output),
        "authorityIdReviewRecords": sum("exact_authority_project_id_unverified" in x["reviewReasons"] for x in output),
        "queueSha256": hashlib.sha256(inventory_bytes).hexdigest(),
        "newAcceptedSources": 0, "newLifecycleFacts": 0, "newRegisteredSales": 0,
        "newSignedRents": 0, "newAskingPrices": 0, "newValuations": 0,
        "newEventLinks": 0, "newNumericForecasts": 0,
        "coverageLedgerChange": {"present": 0, "partial": 0, "missing": 0,
                                 "unestablished": 0},
        "remoteWrites": 0,
        "interpretation": "Queue/reconciliation only. A source lead, context or request is not financial evidence.",
    }
    if not args.verify_only:
        folder = (ROOT / args.out_dir).resolve()
        if not folder.is_relative_to(ROOT):
            raise ValueError("Output folder must remain inside repository")
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "all-records.jsonl").write_bytes(inventory_bytes)
        with (folder / "regional-queue.csv").open("w", newline="", encoding="utf-8") as fp:
            writer = csv.writer(fp)
            writer.writerow(["priority", "region", "record_id", "record_type",
                             "emirate", "name", "catalogue_area", "marketing_developer_unverified",
                             "community_id", "identity_review_reasons", "coverage_statuses_json"])
            for row in output:
                writer.writerow([row["priority"], row["region"], row["id"], row["type"],
                                 row["emirate"], row["name"], row["catalogueArea"],
                                 row["marketingDeveloperUnverified"], row["communityId"],
                                 ";".join(row["reviewReasons"]), canonical_json(row["coverageItems"])])
        (folder / "preservation-receipt.json").write_text(
            json.dumps(receipt, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(receipt, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
