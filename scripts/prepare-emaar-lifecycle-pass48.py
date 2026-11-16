#!/usr/bin/env python3
"""Prepare a bounded primary-source Emaar lifecycle packet for V48.

The script only creates a reviewed packet. It does not modify the published
snapshot, inject financial observations, or infer an exact transaction, rent,
completion, or forecast.
"""
import hashlib
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "data" / "historical-intelligence"
SNAPSHOT_PATH = ROOT / "data" / "historical-intelligence-20261003.json"
CAPTURE_DIR = ROOT / ".local-data" / "primary-project-pass48"
AS_OF = "2026-10-14"
VERSION = "20261014-enrichment-v48"
TERRA = "project:apartments-in-terra-heights-in-emaar-expo-living-expo-city-dubai"
PALACE = "project:palace-residences-dubai-hills-estate-emaar-properties"
ZABEEL = "project:address-residences-zabeel-by-emaar-properties-in-zaabeel-dubai"
CAPTURES = {
    "terra": "expo-living-terra-heights",
    "palace": "palace-sales-two-days",
    "h1": "emaar-h1-2024-rally",
}
PINS = {
    "terra": "aa52b9c15efe9b3f1cb762cc58fa493c46b3f1d07b27c00cccb5458d725b2499",
    "palace": "3d91895569fd3a9a46d6afff27410b2c9c37254c2601b11aa6031b10b38f0d3c",
    "h1": "767b8bf51a312c3f53c03d837874bd14e510d5d528034ef49e6817a79cfcab8a",
}


def canonical(value):
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


def visible_text(raw):
    body = re.sub(r"<(script|style)\\b[^>]*>.*?</\\1>", " ", raw, flags=re.S | re.I)
    return re.sub(r"\\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", body)))


def load_capture(key):
    stem = CAPTURES[key]
    meta = json.loads((CAPTURE_DIR / f"{stem}-capture.json").read_text())
    raw = (CAPTURE_DIR / f"{stem}.html").read_bytes()
    assert meta["status"] == 200
    assert len(raw) == meta["bytes"]
    assert hashlib.sha256(raw).hexdigest() == meta["sha256"] == PINS[key]
    assert meta["url"].startswith("https://www.emaar.com/")
    return meta, visible_text(raw.decode("utf-8", errors="replace"))


def source(source_id, meta, *, title, published_at, date_basis, classification):
    return {
        **meta,
        "id": source_id,
        "publisher": "Emaar Properties PJSC",
        "title": title,
        "publishedAt": published_at,
        "publicationDatePrecision": "day",
        "publicationDateBasis": date_basis,
        "firstAvailableAt": meta["retrievedAt"],
        "availabilityBasis": "First locally retained lawful capture; the displayed historical date is retained separately and is not treated as an archived contemporaneous capture.",
        "primaryEvidence": True,
        "classification": classification,
        "licence": "Minimal attributed factual extraction from a public primary source; raw HTML, imagery, and article text are not redistributed.",
        "rawBodyRedistributed": False,
    }


def build_packet(snapshot):
    records = {record["id"]: record for record in snapshot["records"]}
    expected = {
        TERRA: ("Terra Heights", "community:Dubai:expo-city-dubai", "3381"),
        PALACE: ("Palace Residences Dubai Hills Estate", "community:Dubai:dubai-hills-estate", "2884"),
        ZABEEL: ("Address Residences Zabeel", "community:Dubai:zabeel", "2957"),
    }
    for record_id, (name, community, project_number) in expected.items():
        record = records[record_id]
        assert (record["name"], record["type"], record["emirate"], record["communityId"]) == (name, "project", "Dubai", community)
        assert sum(item["name"].casefold() == name.casefold() and item["type"] == "project" for item in snapshot["records"]) == 1
        register = next(item for item in record.get("registerEvidence", []) if item.get("id") == f"dld-register-{project_number}")
        assert register["identityVerified"] is True and register["scope"] == "subject"

    terra_meta, terra_text = load_capture("terra")
    palace_meta, palace_text = load_capture("palace")
    h1_meta, h1_text = load_capture("h1")
    required = {
        "terra": [
            "Dubai, UAE – 14 November 2024",
            "Terra Heights, the first residential phase, is now open for launch",
            "Emaar Properties and Dubai World Trade Centre (DWTC)",
        ],
        "palace": [
            "May 17, 2024",
            "AED 2.3 billion in sales within just two days of its launch",
            "newly launched, and sold-out, Palace Residences Dubai Hills Estate",
            "three elegantly designed mid-rise towers",
        ],
        "h1": [
            "Dubai, UAE, July 10, 2024",
            "Address Residences Zabeel and Palace Residences Dubai Hills Estate, sold 2,500 units each in just seven days",
        ],
    }
    for key, phrases in required.items():
        text = {"terra": terra_text, "palace": palace_text, "h1": h1_text}[key]
        for phrase in phrases:
            assert phrase in text, (key, phrase)

    sources = [
        source(
            "emaar48-expo-living-terra-heights",
            terra_meta,
            title="Emaar announces Expo Living and says Terra Heights is open for launch",
            published_at="2024-11-14",
            date_basis="Official source dateline: Dubai, UAE – 14 November 2024. The current page was first locally retained at the capture timestamp.",
            classification="primary_developer_press_release",
        ),
        source(
            "emaar48-palace-residences-sales-report",
            palace_meta,
            title="Emaar reports Palace Residences Dubai Hills Estate sales status",
            published_at="2024-05-17",
            date_basis="Displayed official page date: May 17, 2024. The current page was first locally retained at the capture timestamp.",
            classification="primary_developer_report",
        ),
        source(
            "emaar48-h1-2024-rally",
            h1_meta,
            title="Emaar H1 2024 report with project-specific sales-status statements",
            published_at="2024-07-10",
            date_basis="Official source dateline: Dubai, UAE, July 10, 2024. The current page was first locally retained at the capture timestamp.",
            classification="primary_developer_press_release",
        ),
    ]
    source_by_id = {item["id"]: item for item in sources}
    for item in sources:
        assert item["publishedAt"] < item["firstAvailableAt"][:10]
        assert item["firstAvailableAt"][:10] <= AS_OF

    base_identity = {
        TERRA: {
            "sourceIds": ["dld-official-projects-20260706", "dld-official-developers-20261001", "dld-official-areas-20261002", "dld-official-transactions-20261003", "dld-official-buildings-20261003", "primary3-1a59b6a1f1d8b2f715abfdb9"],
            "basis": "Unique Terra Heights catalogue record, exact Expo City location, exact named first residential phase in Emaar's press release, and existing identity-verified DLD project register number 3381. The release does not establish legal-developer equivalence beyond the retained authority register.",
        },
        PALACE: {
            "sourceIds": ["dld-official-projects-20260706", "dld-official-developers-20261001", "dld-official-areas-20261002", "dld-official-transactions-20261003", "dld-official-buildings-20261003", "primary3-b4fdbab739d2a2e78b404ad5"],
            "basis": "Unique Palace Residences Dubai Hills Estate catalogue record, exact named Dubai Hills project in Emaar's report, and existing identity-verified DLD project register number 2884. Other Palace-branded projects remain separate.",
        },
        ZABEEL: {
            "sourceIds": ["dld-official-projects-20260706", "dld-official-developers-20261001", "dld-official-areas-20261002", "dld-official-transactions-20261003", "dld-official-buildings-20261003", "primary3-2e09ab3682f322ca684ddbbc"],
            "basis": "Unique Address Residences Zabeel catalogue record, exact named project in Emaar's H1 report, and existing identity-verified DLD project register number 2957. The statement is not mapped to individual towers, units, or registered transactions.",
        },
    }

    def lifecycle(fact_id, record_id, source_id, milestone, date, label, note, *, verification="reported", event_status="reported"):
        identity = base_identity[record_id]
        src = source_by_id[source_id]
        return {
            "id": fact_id,
            "recordId": record_id,
            "kind": "lifecycle",
            "status": "accepted",
            "sourceIds": [source_id],
            "identitySourceIds": identity["sourceIds"] + [source_id],
            "identityVerified": True,
            "identityBasis": identity["basis"],
            "primaryEvidence": True,
            "publishedAt": src["publishedAt"],
            "firstAvailableAt": src["firstAvailableAt"],
            "scope": "subject",
            "milestone": milestone,
            "date": date,
            "label": label,
            "note": note,
            "eventStatus": event_status,
            "verification": verification,
            "evidenceClass": "primary_source_dated_lifecycle_report",
            "preserveAdditionalLifecycleFields": True,
            "dateBasis": src["publicationDateBasis"],
        }

    facts = [
        lifecycle(
            "emaar48-terra-heights-launch",
            TERRA,
            "emaar48-expo-living-terra-heights",
            "launch",
            {"start": "2024-11-14", "precision": "day"},
            "Emaar states that Terra Heights, Expo Living's first residential phase, is open for launch.",
            "The official release establishes a dated launch availability statement for this named phase. It does not establish a first sale, registered transaction price, construction start, completion, handover, occupancy, rent, valuation, or future value.",
            verification="verified",
        ),
        lifecycle(
            "emaar48-palace-launch-window",
            PALACE,
            "emaar48-palace-residences-sales-report",
            "launch",
            {"start": "2024-05-15", "end": "2024-05-17", "precision": "range"},
            "Emaar's 17 May report says Palace Residences Dubai Hills Estate achieved AED 2.3 billion in sales within two days of launch.",
            "The date is a conservative bounded interval derived from the dated report's 'within two days of its launch' wording, not an asserted exact launch day. It is a developer-reported sales statement, not registered-sale, unit-price, valuation, or completion evidence.",
        ),
        lifecycle(
            "emaar48-palace-sales-status",
            PALACE,
            "emaar48-palace-residences-sales-report",
            "developer_sales_status_report",
            {"start": "2024-05-17", "precision": "day"},
            "Emaar reports AED 2.3 billion in Palace Residences Dubai Hills Estate sales within two days of launch.",
            "Developer-reported aggregate marketing/sales status only. It does not establish individual transactions, unit prices, settled revenue, a price series, or a current valuation.",
        ),
        lifecycle(
            "emaar48-palace-h1-sales-status",
            PALACE,
            "emaar48-h1-2024-rally",
            "developer_sales_status_report",
            {"start": "2024-07-10", "precision": "day"},
            "Emaar reports Palace Residences Dubai Hills Estate sold 2,500 units in seven days.",
            "Developer-reported aggregate status in an H1 performance release. It is retained separately from the May report and does not establish registered transactions, individual unit prices, a complete sales history, or a valuation.",
        ),
        lifecycle(
            "emaar48-zabeel-h1-sales-status",
            ZABEEL,
            "emaar48-h1-2024-rally",
            "developer_sales_status_report",
            {"start": "2024-07-10", "precision": "day"},
            "Emaar reports Address Residences Zabeel sold 2,500 units in seven days.",
            "Developer-reported aggregate status in an H1 performance release. It does not identify individual towers or units and does not establish registered transactions, individual prices, a complete sales history, or a valuation.",
        ),
    ]
    return {
        "schemaVersion": 1,
        "passId": "emaar-primary-lifecycle-pass48-20261014",
        "priorVersion": snapshot["version"],
        "priorSHA256": hashlib.sha256(SNAPSHOT_PATH.read_bytes()).hexdigest(),
        "candidateVersion": VERSION,
        "asOf": AS_OF,
        "preserveExistingFinancialCoverage": True,
        "sources": sources,
        "facts": facts,
        "recordIdentityChecks": [
            {"recordId": record_id, "catalogueName": records[record_id]["name"], "type": "project", "emirate": "Dubai", "communityId": records[record_id]["communityId"], "identitySourceIds": base_identity[record_id]["sourceIds"], "identityBasis": base_identity[record_id]["basis"]}
            for record_id in [TERRA, PALACE, ZABEEL]
        ],
        "recordResearch": [],
        "collection": {
            "asOf": AS_OF,
            "acceptedLifecycleFacts": len(facts),
            "verifiedLaunchFacts": 1,
            "reportedLaunchWindows": 1,
            "developerSalesStatusReports": 3,
            "newFinancialObservations": 0,
            "newSources": len(sources),
            "rawBodiesRedistributed": False,
        },
        "methodology": "Three official Emaar pages were fetched directly by public HTTPS GET and checksum-pinned. Exact named project, location, and existing DLD register identity gates precede admission. The Terra Heights launch statement is primary and exact-day dated; the Palace launch interval remains a reported bounded interval. Aggregate sales-status reports remain lifecycle/context evidence, never registered individual sales, prices, rents, valuations, completion, occupancy, or forecasts. Displayed historical page dates are separate from first locally retained availability, so no source is treated as available in a backtest before this capture.",
        "excludedCandidates": [
            {"recordId": PALACE, "reason": "AED 2.3 billion and 2,500-unit source claims are retained as developer-reported aggregate status only; no individual transaction or price-series fan-out."},
            {"recordId": ZABEEL, "reason": "The 2,500-unit report is not mapped to individual towers, units, transactions, prices, or a complete sales history."},
        ],
    }


def main():
    snapshot = json.loads(SNAPSHOT_PATH.read_text())
    assert snapshot["version"] == "20261013-enrichment-v47"
    packet = build_packet(snapshot)
    output = BASE / "emaar-primary-lifecycle-pass48-20261014.json"
    output.write_text(canonical(packet))
    print(json.dumps({"packet": str(output.relative_to(ROOT)), "facts": len(packet["facts"]), "sources": len(packet["sources"]), "productionArchiveChanged": False}))


if __name__ == "__main__":
    main()
