#!/usr/bin/env python3
"""Normalize a bounded exact-ID DLD Project Status research batch for V47.

The public DLD status application is dynamically rendered.  The raw visual
capture stays outside Git; this script admits only normalized facts after the
visible project number, legal developer and cadastral area agree with the
existing identity-verified DLD project-register evidence.
"""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "data" / "historical-intelligence"
SNAPSHOT = ROOT / "data" / "historical-intelligence-20261003.json"
OUTPUT = BASE / "dld-authority-pass47-20261013.json"
CAPTURE = ROOT / ".local-data" / "dld-status-v47-research-20261013" / "dld-project-status-visible-capture.json"
AS_OF = "2026-10-13"
EXPECTED_CAPTURE_SHA256 = "47653de5aba54b9d391b24ab104449996005a8964b3eeabc64236ba5cd097f7d"


def canonical(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode()


def sha(value):
    return hashlib.sha256(value).hexdigest()


def normalized(value):
    return re.sub(r"[^a-z0-9]+", "", str(value).casefold())


def valid_iso_date(value):
    if value is None or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return None
    return value


def exact_register(record, row):
    matches = [
        item for item in record.get("registerEvidence", [])
        if item.get("identityVerified")
        and str(item.get("fields", {}).get("projectNumber")) == str(row["projectNumber"])
    ]
    assert len(matches) == 1, (record["id"], row["projectNumber"], len(matches))
    register = matches[0]
    fields = register["fields"]
    assert str(fields["projectId"]) == str(row["dldProjectId"])
    assert str(fields["developerNumber"]) == str(row["developerNumber"])
    assert str(fields["areaId"]) == str(row["areaId"])
    aliases = fields.get("officialEnglishAliases") or []
    assert any(normalized(alias) == normalized(row["title"]) for alias in aliases)
    assert normalized(record["name"]) == normalized(row["title"])
    assert normalized(fields["registeredDeveloperName"]) == normalized(row["developerName"])
    assert register.get("sourceIds")
    return register


def main():
    snapshot = json.loads(SNAPSHOT.read_text())
    assert snapshot["version"] == "20261013-enrichment-v46"
    records = {record["id"]: record for record in snapshot["records"]}

    raw = CAPTURE.read_bytes()
    assert sha(raw) == EXPECTED_CAPTURE_SHA256
    capture = json.loads(raw)
    assert capture["packetId"] == "dld-status-v47-research-20261013"
    assert capture["retrieval"]["retrievedAt"].startswith(AS_OF)
    rows = capture["normalizedPayload"]["rows"]
    assert sha(canonical(rows)) == capture["normalizedPayload"]["sha256"] == "e1474113fdc56c1e7f5484a144b73accc9c731134ce902cc64d435a6fc3b47e0"
    assert len(rows) == len({row["recordId"] for row in rows}) == 5

    source_id = "dld47-public-project-status-20261013"
    source = {
        "id": source_id,
        "classification": "authority_project_status_browser_snapshot",
        "title": "DLD public Project Status Enquiry: bounded five-project exact-ID lifecycle review",
        "publisher": capture["source"]["publisher"],
        "url": capture["source"]["url"],
        "publishedAt": None,
        "firstAvailableAt": capture["retrieval"]["firstKnownAvailability"],
        "retrievedAt": capture["retrieval"]["retrievedAt"],
        "primaryEvidence": True,
        "preserveRevision": True,
        "revisionOfSourceId": "dld46-public-project-status-20261013",
        "licence": "Minimal attributed authority facts; raw browser capture, media and contacts are not redistributed",
        "rawCaptureRedistributed": False,
        "normalizedPacketPath": str(OUTPUT.relative_to(ROOT)),
        "captureProvenance": {
            "method": capture["source"]["captureMethod"],
            "sourcePageLastUpdatedRaw": capture["source"]["sourcePageLastUpdatedRaw"],
            "capturedPacketSHA256": sha(raw),
            "capturedPacketBytes": len(raw),
            "normalizedPayloadSHA256": capture["normalizedPayload"]["sha256"],
            "timestampQualification": capture["retrieval"]["timestampPrecision"],
        },
    }

    output_rows, checks = [], []
    for row in rows:
        record = records[row["recordId"]]
        register = exact_register(record, row)
        checks.append({
            "recordId": record["id"],
            "catalogueName": record["name"],
            "authorityProjectNumber": row["projectNumber"],
            "authorityProjectId": str(row["dldProjectId"]),
            "authorityDeveloperNumber": row["developerNumber"],
            "authorityDeveloperName": row["developerName"],
            "authorityAreaId": row["areaId"],
            "sourceIds": register["sourceIds"],
            "basis": register["identityBasis"],
            "statusSourceId": source_id,
        })
        output_rows.append({
            **row,
            "identitySourceIds": register["sourceIds"],
            "identityBasis": register["identityBasis"],
            "registerEvidenceId": register["id"],
            "validScheduledCompletion": valid_iso_date(row["scheduledCompletion"]["iso"]),
        })

    quarantined = [
        {
            "recordId": row["recordId"],
            "field": "scheduledCompletion",
            "raw": row["scheduledCompletion"]["raw"],
            "reason": "DLD UI literal is not a valid ISO calendar date; quarantined rather than repaired.",
        }
        for row in output_rows if row["validScheduledCompletion"] is None
    ]
    assert {item["recordId"] for item in quarantined} == {
        "project:parkside-views-by-emaar-properties",
        "project:arlo-emaar-properties-dubai-creek-harbour-dubai",
    }

    packet = {
        "schemaVersion": 1,
        "passId": "dld-authority-pass47-20261013",
        "asOf": AS_OF,
        "publicationStatus": "prepared_not_integrated",
        "sources": [source],
        "records": output_rows,
        "recordIdentityChecks": checks,
        "sourceCaptures": [{
            "id": "dld-status-five-project-visible-capture-20261013",
            "sourceId": source_id,
            "publisher": capture["source"]["publisher"],
            "url": capture["source"]["url"],
            "retrievedAt": capture["retrieval"]["retrievedAt"],
            "captureSHA256": sha(raw),
            "canonicalPayloadSHA256": capture["normalizedPayload"]["sha256"],
            "bytes": len(raw),
            "captureMethod": capture["source"]["captureMethod"],
            "rawCaptureRedistributed": False,
            "timestampQualification": capture["retrieval"]["timestampPrecision"],
        }],
        "quarantinedFields": quarantined,
        "limitations": [
            "The public DLD portal is a source retrieval snapshot; it does not establish original publication time.",
            "DLD Started remains a filed field, not verified physical construction commencement.",
            "DLD Completion remains a schedule/register field unless separately evidenced as actual completion.",
            "Inspection progress is dated evidence, not present progress at retrieval.",
            "Status and progress do not establish handover, occupancy, rent commencement, price, valuation or forecast.",
            "Displayed inventory is not promoted to a catalogue inventory fact in this pass.",
            "Raw browser captures remain outside the repository and are not redistributed.",
        ],
    }
    OUTPUT.write_bytes(canonical(packet) + b"\n")
    print(json.dumps({"records": len(output_rows), "sources": 1, "quarantined": len(quarantined), "sha256": sha(OUTPUT.read_bytes())}))


if __name__ == "__main__":
    main()
