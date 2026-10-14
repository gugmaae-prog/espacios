#!/usr/bin/env python3
"""Prepare V46 authority lifecycle/status facts without creating financial evidence."""
import gzip
import hashlib
import json
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "data" / "historical-intelligence"
SNAPSHOT = ROOT / "data" / "historical-intelligence-20261003.json"
AUTHORITY = BASE / "dld-authority-pass46-20261013.json"
OUTPUT = BASE / "dld-lifecycle-pass46-20261013.json"
PRIOR_VERSION = "20261013-enrichment-v45"
PRIOR_ROOT = "1c17824d39f4399e1fb1088bb52c2a0e761cb2e935286c617e25c883b4afa2c0"
AS_OF = "2026-10-13"


def sha(value):
    return hashlib.sha256(value).hexdigest()


def main():
    snapshot = json.loads(SNAPSHOT.read_text())
    assert snapshot["version"] == PRIOR_VERSION
    root_path = BASE / "objects" / f"{PRIOR_ROOT}.json.gz"
    assert sha(root_path.read_bytes()) == PRIOR_ROOT
    prior = json.loads(gzip.decompress(root_path.read_bytes()))
    assert prior["version"] == PRIOR_VERSION

    authority_raw = AUTHORITY.read_bytes()
    authority = json.loads(authority_raw)
    assert authority["passId"] == "dld-authority-pass46-20261013"
    assert authority["asOf"] == AS_OF and authority["publicationStatus"] == "prepared_not_integrated"
    assert len(authority["records"]) == len(authority["recordIdentityChecks"]) == 9
    assert len(authority["sources"]) == 2
    records = {record["id"]: record for record in snapshot["records"]}
    sources = {source["id"]: source for source in snapshot["sources"]}
    checks = {check["recordId"]: check for check in authority["recordIdentityChecks"]}
    assert len(checks) == 9

    new_sources = deepcopy(authority["sources"])
    for source in new_sources:
        assert source["id"] not in sources
        assert source["revisionOfSourceId"] in sources
        assert source["firstAvailableAt"][:10] == AS_OF
        source["normalizedPacketSHA256"] = sha(authority_raw)

    facts = []
    quarantined = list(authority["quarantinedFields"])

    def add(row, check, milestone, date, event_status, label, note, progress=None):
        source_id = check["statusSourceId"]
        source = next(item for item in new_sources if item["id"] == source_id)
        suffix = date["start"] if milestone in {"construction_progress", "authority_status_snapshot"} else milestone
        fact = {
            "id": f"dld46-{row['projectNumber']}-{suffix}",
            "recordId": row["recordId"],
            "status": "accepted",
            "kind": "lifecycle",
            "milestone": milestone,
            "date": date,
            "sourceId": source_id,
            "identityBasis": check["basis"],
            "identitySourceIds": check["sourceIds"],
            "firstAvailableAt": source["firstAvailableAt"],
            "publishedAt": None,
            "primaryEvidence": True,
            "verification": "reported",
            "scope": "subject",
            "identityVerified": True,
            "eventStatus": event_status,
            "label": label,
            "note": note,
            "evidenceClass": "primary_authority_dated_project_report",
            "preserveAdditionalLifecycleFields": True,
            "dateBasis": "Public DLD Project Status Enquiry capture retained with checksum; source publication time is unknown.",
        }
        if progress is not None:
            fact["progressPercent"] = progress
        facts.append(fact)

    for row in authority["records"]:
        check = checks[row["recordId"]]
        record = records[row["recordId"]]
        assert record["type"] == "project" and record["emirate"] == "Dubai"
        assert check["authorityProjectNumber"] == row["projectNumber"]
        assert check["authorityProjectId"] == str(row["dldProjectId"])
        assert check["authorityDeveloperNumber"] == row["developerNumber"]
        assert check["authorityAreaId"] == row["areaId"]
        if row.get("admission") != "inspection_and_current_status_only":
            add(
                row, check, "registration", {"start": row["registered"]["iso"], "precision": "day"}, "reported",
                "Authority-reported project registration",
                "Registration is not first announcement, marketing, sale or construction commencement.",
            )
            add(
                row, check, "filed_project_start", {"start": row["filedStarted"]["iso"], "precision": "day"}, "reported",
                "Authority-reported filed project start; physical commencement not established",
                "The DLD Started field is retained as filed. It is not promoted to physical construction commencement or used to create pre-launch prices.",
            )
            if row["validScheduledCompletion"]:
                add(
                    row, check, "target_completion", {"start": row["validScheduledCompletion"], "precision": "day"}, "planned",
                    "Authority scheduled completion; actual completion not established",
                    "The DLD Completion field is a source schedule/register field. It does not establish actual completion, handover or occupancy.",
                )
        inspection = row["inspection"]
        add(
            row, check, "construction_progress", {"start": inspection["date"], "precision": "day"}, "reported",
            f"Authority inspection reports {inspection['progressPercent']:g}% on its dated report",
            "This is a dated authority inspection, not present progress at retrieval. It does not establish construction commencement, actual completion, handover or occupancy.",
            inspection["progressPercent"],
        )
        add(
            row, check, "authority_status_snapshot", {"start": AS_OF, "precision": "day"}, "reported",
            f"Authority status snapshot at retrieval: {row['status']} ({row['currentProgressPercent']:g}% displayed)",
            "Current DLD status/progress is retained as a retrieval-date snapshot. It does not establish a historical completion, handover, occupancy, rent, price, valuation or forecast.",
            row["currentProgressPercent"],
        )

    assert len(facts) == 39
    assert len({fact["id"] for fact in facts}) == len(facts)
    assert len({fact["recordId"] for fact in facts}) == 9
    assert sum(fact["milestone"] == "registration" for fact in facts) == 8
    assert sum(fact["milestone"] == "filed_project_start" for fact in facts) == 8
    assert sum(fact["milestone"] == "target_completion" for fact in facts) == 5
    assert sum(fact["milestone"] == "construction_progress" for fact in facts) == 9
    assert sum(fact["milestone"] == "authority_status_snapshot" for fact in facts) == 9
    assert all(fact["date"]["start"] <= AS_OF for fact in facts if fact["milestone"] != "target_completion")

    packet = {
        "schemaVersion": 1,
        "passId": "dld-lifecycle-pass46-20261013",
        "priorVersion": PRIOR_VERSION,
        "priorRootSHA256": PRIOR_ROOT,
        "asOf": AS_OF,
        "publicationStatus": "prepared_not_integrated",
        "sources": new_sources,
        "facts": facts,
        "recordIdentityChecks": authority["recordIdentityChecks"],
        "sourceCaptures": authority["sourceCaptures"],
        "inputPackets": [{
            "path": str(AUTHORITY.relative_to(ROOT)),
            "sha256": sha(authority_raw),
            "bytes": len(authority_raw),
        }],
        "quarantinedFields": quarantined,
        "financialObservationsAdded": 0,
        "limitations": [
            "No actual completion, handover or occupancy is inferred.",
            "DLD status/progress snapshots do not create price, rent, valuation or forecast evidence.",
            "Filed start remains distinct from physical construction commencement.",
            "Invalid DLD UI completion literals remain quarantined rather than repaired.",
            "Fresh public captures are source revisions; V45 facts and schedules remain preserved.",
            "No financial observations or conditional scenario values are created.",
        ],
    }
    OUTPUT.write_text(json.dumps(packet, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"facts": len(facts), "records": len(checks), "sources": len(new_sources), "quarantined": len(quarantined), "sha256": sha(OUTPUT.read_bytes())}))


if __name__ == "__main__":
    main()
