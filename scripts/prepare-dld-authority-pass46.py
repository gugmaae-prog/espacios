#!/usr/bin/env python3
"""Normalize and verify the bounded public DLD status captures for V46.

The public DLD status service is dynamically rendered and does not expose a
stable deep link for each search result.  The raw browser captures remain
outside Git.  This script admits only the limited factual extraction captured
from the public service after it agrees with an existing, verified DLD project
register crosswalk.
"""
import copy
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "data" / "historical-intelligence"
SNAPSHOT = ROOT / "data" / "historical-intelligence-20261003.json"
OUTPUT = BASE / "dld-authority-pass46-20261013.json"
CAPTURE_DIR = ROOT / ".local-data" / "dld-status-v46-research-20261013"
EIGHT_CAPTURE = CAPTURE_DIR / "dld-project-status-visible-capture.json"
AVENUE_CAPTURE = CAPTURE_DIR / "binghatti-avenue-visible-capture.json"
AS_OF = "2026-10-13"


def canonical(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode()


def sha(value):
    return hashlib.sha256(value).hexdigest()


def normalized(value):
    return re.sub(r"[^a-z0-9]+", "", str(value).casefold())


def date_or_none(value):
    if value is None:
        return None
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return None
    return value


def verify_capture(path, expected_sha):
    raw = path.read_bytes()
    assert sha(raw) == expected_sha, path
    return json.loads(raw)


def exact_register(record, row):
    matches = [
        item
        for item in record.get("registerEvidence", [])
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


def source_row(identifier, title, capture, normalized_sha, raw_sha, raw_bytes):
    return {
        "id": identifier,
        "classification": "authority_project_status_browser_snapshot",
        "title": title,
        "publisher": capture["source"]["publisher"],
        "url": capture["source"]["url"],
        "publishedAt": None,
        "firstAvailableAt": capture["retrieval"]["firstKnownAvailability"],
        "retrievedAt": capture["retrieval"].get("retrievedAt") or capture["retrieval"]["batchEvidenceCollatedAt"],
        "primaryEvidence": True,
        "preserveRevision": True,
        "revisionOfSourceId": "dld41-public-project-status-20261012",
        "licence": "Minimal attributed authority facts; raw browser capture, media and contacts are not redistributed",
        "rawCaptureRedistributed": False,
        "normalizedPacketPath": "data/historical-intelligence/dld-authority-pass46-20261013.json",
        "captureProvenance": {
            "method": capture["source"]["captureMethod"],
            "sourcePageLastUpdatedRaw": capture["source"].get("sourcePageLastUpdatedRaw"),
            "capturedPacketSHA256": raw_sha,
            "capturedPacketBytes": raw_bytes,
            "normalizedPayloadSHA256": normalized_sha,
            "timestampQualification": capture["retrieval"].get("timestampPrecision"),
        },
    }


def main():
    snapshot = json.loads(SNAPSHOT.read_text())
    assert snapshot["version"] == "20261013-enrichment-v45"
    records = {record["id"]: record for record in snapshot["records"]}

    eight_raw = EIGHT_CAPTURE.read_bytes()
    eight = verify_capture(EIGHT_CAPTURE, "4cb501e168106bba452e9291180277cee87dc63ca6465277301a84e859483808")
    assert eight["packetId"] == "dld-status-v46-research-20261013"
    eight_rows = eight["normalizedPayload"]["rows"]
    assert sha(canonical(eight_rows)) == eight["normalizedPayload"]["sha256"] == "8feae0b6c7e620ae54ef2159bc642e7be187e1aeb72325e46dcb19031c085dc5"
    assert len(eight_rows) == 8 and len({row["recordId"] for row in eight_rows}) == 8

    avenue_raw = AVENUE_CAPTURE.read_bytes()
    avenue = verify_capture(AVENUE_CAPTURE, "f4ea61a30fd30cd4151c9dc29d5e25e72892efc017b52642f7916c3e76fc2fdd")
    normalized_avenue = copy.deepcopy(avenue)
    normalized_avenue.pop("integrity")
    assert sha(canonical(normalized_avenue)) == avenue["integrity"]["canonicalPayloadSha256"] == "aad645f45a4bfad95ee6fecee3e5b881cba6f270abc113db57e1532b0692a6c8"
    crosswalk = avenue["identityCrosswalk"]
    avenue_row = {
        "recordId": crosswalk["localRecordId"],
        "projectNumber": int(crosswalk["dldProjectNumber"]),
        "title": crosswalk["dldOfficialEnglishAlias"],
        "developerName": crosswalk["dldRegisteredDeveloperName"],
        "developerNumber": int(crosswalk["dldDeveloperNumber"]),
        "areaId": int(crosswalk["dldAreaId"]),
        "dldProjectId": int(crosswalk["dldProjectId"]),
        "status": " ".join(avenue["visibleDldFields"]["resultCard"]["statusWords"]),
        "currentProgressPercent": avenue["normalizedResearchFacts"]["statusAtRetrieval"]["progressPercent"],
        "registered": {"raw": avenue["visibleDldFields"]["fullFactSheet"]["Registered"], "iso": "2019-09-25"},
        "filedStarted": {"raw": avenue["visibleDldFields"]["fullFactSheet"]["Started"], "iso": "2019-10-01"},
        "scheduledCompletion": {"raw": avenue["visibleDldFields"]["fullFactSheet"]["Completion"], "iso": "2022-04-26"},
        "inspection": {
            "rawDate": avenue["normalizedResearchFacts"]["inspection"]["dateRaw"],
            "date": avenue["normalizedResearchFacts"]["inspection"]["date"],
            "progressPercent": avenue["normalizedResearchFacts"]["inspection"]["progressPercent"],
        },
        "admission": "inspection_and_current_status_only",
    }
    assert avenue_row["recordId"] == "project:binghatti-avenue-apartments-for-sale-in-al-jaddaf-dubai"

    source_batch = "dld46-public-project-status-20261013"
    source_avenue = "dld46-public-project-status-binghatti-avenue-20261013"
    output_rows = []
    checks = []
    for row, source_id in [(row, source_batch) for row in eight_rows] + [(avenue_row, source_avenue)]:
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
            "validScheduledCompletion": date_or_none(row["scheduledCompletion"]["iso"]),
        })
    assert len(checks) == 9 and len({item["recordId"] for item in checks}) == 9
    invalid = [
        {"recordId": row["recordId"], "field": "scheduledCompletion", "raw": row["scheduledCompletion"]["raw"], "reason": "DLD UI literal is not a valid ISO calendar date; quarantined rather than repaired."}
        for row in output_rows
        if row["scheduledCompletion"]["iso"] is None
    ]
    assert len(invalid) == 3 and {item["recordId"] for item in invalid} == {
        "project:sobha-one-apartments-for-sale-in-dubai",
        "project:address-residences-zabeel-by-emaar-properties-in-zaabeel-dubai",
        "project:binghatti-hills-by-binghatti-properties-in-dubai-science-park",
    }
    sources = [
        source_row(source_batch, "DLD public Project Status Enquiry: bounded nine-project authority review", eight, eight["normalizedPayload"]["sha256"], sha(eight_raw), len(eight_raw)),
        source_row(source_avenue, "Binghatti Avenue — exact DLD authority status and dated inspection", avenue, avenue["integrity"]["canonicalPayloadSha256"], sha(avenue_raw), len(avenue_raw)),
    ]
    packet = {
        "schemaVersion": 1,
        "passId": "dld-authority-pass46-20261013",
        "asOf": AS_OF,
        "publicationStatus": "prepared_not_integrated",
        "sources": sources,
        "records": output_rows,
        "recordIdentityChecks": checks,
        "sourceCaptures": [
            {
                "id": "dld-status-eight-project-visible-capture-20261013",
                "sourceId": source_batch,
                "publisher": eight["source"]["publisher"],
                "url": eight["source"]["url"],
                "retrievedAt": eight["retrieval"]["batchEvidenceCollatedAt"],
                "captureSHA256": sha(eight_raw),
                "canonicalPayloadSHA256": eight["normalizedPayload"]["sha256"],
                "bytes": len(eight_raw),
                "captureMethod": eight["source"]["captureMethod"],
                "rawCaptureRedistributed": False,
                "timestampQualification": eight["retrieval"]["timestampPrecision"],
            },
            {
                "id": "dld-status-binghatti-avenue-visible-capture-20261013",
                "sourceId": source_avenue,
                "publisher": avenue["source"]["publisher"],
                "url": avenue["source"]["url"],
                "retrievedAt": avenue["retrieval"]["retrievedAt"],
                "captureSHA256": sha(avenue_raw),
                "canonicalPayloadSHA256": avenue["integrity"]["canonicalPayloadSha256"],
                "bytes": len(avenue_raw),
                "captureMethod": avenue["source"]["captureMethod"],
                "rawCaptureRedistributed": False,
                "timestampQualification": avenue["retrieval"]["timestampPrecision"],
            },
        ],
        "quarantinedFields": invalid,
        "limitations": [
            "The public DLD portal is a source retrieval snapshot; it does not establish original publication time.",
            "DLD Started remains a filed field, not verified physical construction commencement.",
            "DLD Completion remains a schedule/register field unless separately evidenced as actual completion.",
            "Inspection progress is dated evidence, not present progress at retrieval.",
            "Status and progress do not establish handover, occupancy, rent commencement, price, valuation or forecast.",
            "Raw browser captures remain outside the repository and are not redistributed.",
        ],
    }
    OUTPUT.write_bytes(canonical(packet) + b"\n")
    print(json.dumps({"records": len(output_rows), "sources": len(sources), "quarantined": len(invalid), "sha256": sha(OUTPUT.read_bytes())}))


if __name__ == "__main__":
    main()
