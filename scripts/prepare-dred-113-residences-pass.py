#!/usr/bin/env python3
"""Prepare an exact-identity DLD-derived sale pass for 113 Residences.

Raw Parquet and captured webpages stay in ignored local research storage. The
output contains only attributable facts, source metadata, and filtered rows.
"""
import argparse
import datetime as dt
import hashlib
import json
import pathlib
import re

try:
    import pyarrow.parquet as pq
except ImportError as exc:
    raise SystemExit("Install pyarrow in the research environment to read the pinned Parquet snapshot.") from exc

ROOT = pathlib.Path(__file__).resolve().parents[1]
RECORD_ID = "project:113-residences-iman-developers-al-sufouh-dubai"
SALES_SOURCE_ID = "v19-dred-sales-20261005"
PROJECT_SOURCE_ID = "v21-dred-project-113-residences-20261005"
LIST_SOURCE_ID = "v21-dred-project-list-20261005"
DEVELOPER_SOURCE_ID = "v21-iman-113-residences-page-20261007"
FACTSHEET_SOURCE_ID = "v21-iman-113-residences-factsheet-20261007"
EXPECTED_PARQUET_SHA256 = "73be9631af185f4ba599ea299752deecdb137cbbe36c0afb95abc5e186d8b5e1"


def sha256(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def source_file(identifier, path, url, publisher, classification, licence,
                attribution, primary, title, published_at=None,
                publication_status="unknown"):
    stamp = dt.datetime.fromtimestamp(path.stat().st_mtime, dt.timezone.utc)
    retrieved = stamp.replace(microsecond=0).isoformat().replace("+00:00", "Z")
    row = {
        "id": identifier,
        "url": url,
        "resolvedURL": url,
        "publisher": publisher,
        "title": title,
        "classification": classification,
        "retrievedAt": retrieved,
        "firstAvailableAt": retrieved,
        "publishedAt": published_at,
        "publicationDateStatus": publication_status,
        "datePrecision": "unknown",
        "captureStatus": "captured_source_file",
        "sha256": sha256(path),
        "bytes": path.stat().st_size,
        "primaryEvidence": primary,
        "licence": licence,
        "attribution": attribution,
        "rawBodyRedistributed": False,
        "rawBodyCaptured": True,
    }
    return row


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--transactions", type=pathlib.Path, required=True)
    parser.add_argument("--dred-project-page", type=pathlib.Path, required=True)
    parser.add_argument("--dred-project-list", type=pathlib.Path, required=True)
    parser.add_argument("--iman-project-page", type=pathlib.Path, required=True)
    parser.add_argument("--iman-factsheet", type=pathlib.Path, required=True)
    parser.add_argument("--output", type=pathlib.Path,
                        default=ROOT / "enrichment/v21/pass44-dred-113-residences.json")
    args = parser.parse_args()

    parquet_sha = sha256(args.transactions)
    if parquet_sha != EXPECTED_PARQUET_SHA256:
        raise SystemExit(f"Unexpected DLD-derived snapshot checksum: {parquet_sha}")

    page = args.dred_project_page.read_text(errors="replace")
    listing = args.dred_project_list.read_text(errors="replace")
    developer = args.iman_project_page.read_text(errors="replace")
    for phrase, body in [
        ("113 RESIDENCES", page), ("IMAN DEVELOPERS L.L.C", page),
        ("Al Sufouh First", page), ("Registered units", page),
        ("113 RESIDENCES", listing), ("28 Feb 2029", listing),
        ("113 Residences", developer), ("Al Sufouh", developer),
    ]:
        if phrase.casefold() not in body.casefold():
            raise SystemExit(f"Captured source does not contain required evidence: {phrase}")

    rows = []
    exact_name_area_variants = set()
    columns = [
        "transaction_id", "instance_date", "reg_type_label", "area_id",
        "area_name_en", "project_name", "property_type_label",
        "property_sub_type", "usage_label", "rooms_bucket", "area_sqm",
        "price_aed", "price_psf", "procedure_id", "procedure_name_en",
        "is_pre_registration", "quality_flags",
    ]
    parquet = pq.ParquetFile(args.transactions)
    for batch in parquet.iter_batches(batch_size=200_000, columns=columns):
        data = batch.to_pydict()
        for index, name in enumerate(data["project_name"]):
            if not name or name.strip().casefold() != "113 residences":
                continue
            row = {key: data[key][index] for key in columns}
            exact_name_area_variants.add((row["area_id"], row["area_name_en"]))
            if (row["area_id"], row["area_name_en"]) != (307, "Al Safouh First"):
                raise SystemExit("Exact project name fans out to another DLD area; keep it quarantined.")
            if (row["reg_type_label"], row["property_type_label"],
                row["property_sub_type"], row["usage_label"],
                row["procedure_id"], row["quality_flags"]) != (
                    "Off-Plan", "Unit", "Flat", "Residential", 102, 0):
                raise SystemExit("A same-name row falls outside the reviewed residential sale cohort.")
            if not row["transaction_id"] or not row["instance_date"]:
                raise SystemExit("Transaction identifier or native registration date is missing.")
            if not row["price_aed"] or not row["area_sqm"] or not row["price_psf"]:
                raise SystemExit("A transaction lacks a positive native price or area measure.")
            rows.append(row)

    ids = [row["transaction_id"] for row in rows]
    if len(rows) != 46 or len(set(ids)) != len(ids):
        raise SystemExit(f"Expected 46 unique exact rows; found {len(rows)} rows / {len(set(ids))} IDs.")
    if exact_name_area_variants != {(307, "Al Safouh First")}:
        raise SystemExit(f"Unexpected exact-name area fan-out: {sorted(exact_name_area_variants)}")
    rows.sort(key=lambda row: (str(row["instance_date"]), row["transaction_id"]))

    project_source = source_file(
        PROJECT_SOURCE_ID, args.dred_project_page,
        "https://www.dubairealestatedata.com/projects/113-residences",
        "Dubai Real Estate Data", "independent_dld_derived_project_register",
        "CC BY 4.0", "Dubai Real Estate Data, based on Dubai Land Department open data",
        False, "113 Residences DLD project-register detail",
        publication_status="DLD register snapshot updated 2026-10-05; first publication time unknown")
    project_source["sourceSnapshotDate"] = "2026-10-05"
    project_source["datasetVersion"] = "DLD project register snapshot as displayed by publisher on 2026-10-05"
    project_source["note"] = "The page says the DLD register tracks status, units and dates, not prices; project number is not exposed on this captured page."

    listing_source = source_file(
        LIST_SOURCE_ID, args.dred_project_list,
        "https://www.dubairealestatedata.com/projects",
        "Dubai Real Estate Data", "independent_dld_derived_project_register",
        "CC BY 4.0", "Dubai Real Estate Data, based on Dubai Land Department open data",
        False, "DLD registered project listing",
        publication_status="DLD register snapshot updated 2026-10-05; first publication time unknown")
    listing_source["sourceSnapshotDate"] = "2026-10-05"
    listing_source["datasetVersion"] = "DLD project register snapshot as displayed by publisher on 2026-10-05"

    developer_source = source_file(
        DEVELOPER_SOURCE_ID, args.iman_project_page,
        "https://www.imandevelopers.com/iman-properties/113-residences",
        "Iman Developers", "official_developer_project_page",
        "Attributed factual identity only; no page body or imagery redistributed",
        None, True, "113 Residences official project page",
        publication_status="publication date unknown; first verified capture retained")
    developer_source["preserveRevision"] = True
    developer_source["revisionOfSourceId"] = "scrape-b372fd59075d949088862790"

    factsheet_source = source_file(
        FACTSHEET_SOURCE_ID, args.iman_factsheet,
        "https://api.imandevelopers.com/wp-content/uploads/2026/07/113-RESIDENCES-FACTSHEET_compressed.pdf",
        "Iman Developers", "official_developer_project_factsheet",
        "Attributed factual prices and milestones only; no document body or imagery redistributed",
        None, True, "113 Residences factsheet")
    factsheet_source["publicationDateStatus"] = "PDF creation and modification metadata only; public issue date and offer validity unknown"
    factsheet_source["documentCreatedAt"] = "2026-06-04T15:31:46Z"
    factsheet_source["documentModifiedAt"] = "2026-07-22T09:46:28Z"

    identity_basis = (
        "The official Iman Developers project page names 113 Residences and places it in Al Sufouh. "
        "The DLD-derived project-register detail lists the exact registered name 113 RESIDENCES, "
        "developer IMAN DEVELOPERS L.L.C., Al Sufouh First, and 113 units. In the pinned transaction "
        "snapshot every exact-name row is in the single native key area_id=307 / Al Safouh First; "
        "all 46 rows are unique Residential | Unit | Flat | Off-Plan | procedure 102 records with "
        "quality_flags=0. No fuzzy match, other-area fan-out, or phase merge is used. The DLD project "
        "number is not exposed by the captured project-register page and is left null."
    )
    identity_sources = [PROJECT_SOURCE_ID, DEVELOPER_SOURCE_ID, FACTSHEET_SOURCE_ID]

    facts = []
    for row in rows:
        txn = row["transaction_id"]
        facts.append({
            "id": "v21-dred-113-residences-" + re.sub(r"[^A-Za-z0-9-]", "-", txn),
            "recordId": RECORD_ID,
            "kind": "financial",
            "status": "accepted",
            "scope": "subject",
            "identityVerified": True,
            "identityBasis": identity_basis,
            "identitySourceIds": identity_sources,
            "sourceIds": [SALES_SOURCE_ID],
            "firstAvailableAt": "2026-10-05T09:28:01Z",
            "publishedAt": "2026-10-05T09:28:01Z",
            "primaryEvidence": False,
            "evidenceClass": "registered_sale_transaction_secondary_distribution",
            "observation": {
                "period": row["instance_date"].isoformat(),
                "value": float(row["price_psf"]),
                "unit": "AED/sqft",
                "metric": "price",
                "frequency": "daily",
                "observationKind": "transaction",
                "transactionKind": "sale",
                "observationDateBasis": "DLD instance_date registration date; not asserted to be contract execution or transfer date.",
                "transactionId": txn,
                "sourceObservationId": txn,
                "priceAED": int(row["price_aed"]),
                "areaSqm": float(row["area_sqm"]),
                "propertyType": row["property_type_label"],
                "propertySubtype": row["property_sub_type"],
                "usage": row["usage_label"],
                "registration": row["reg_type_label"],
                "procedureId": int(row["procedure_id"]),
                "procedureName": row["procedure_name_en"],
                "qualityFlags": int(row["quality_flags"]),
                "sourceAreaId": int(row["area_id"]),
                "sourceAreaName": row["area_name_en"],
                "sourceProjectName": row["project_name"],
                "roomsBucket": row["rooms_bucket"],
                "bedroomsLabel": f"{row['rooms_bucket']}BR" if row["rooms_bucket"] else None,
                "isPreRegistration": bool(row["is_pre_registration"]),
            },
        })

    register_fact = {
        "id": "v21-113-residences-dld-register-snapshot",
        "recordId": RECORD_ID,
        "kind": "register",
        "status": "accepted",
        "scope": "subject",
        "identityVerified": True,
        "identityBasis": identity_basis,
        "identitySourceIds": identity_sources,
        "sourceIds": [PROJECT_SOURCE_ID, LIST_SOURCE_ID],
        "firstAvailableAt": listing_source["firstAvailableAt"],
        "primaryEvidence": False,
        "evidenceClass": "independent_dld_derived_project_register",
        "registeredProjectId": None,
        "fields": {
            "registeredName": "113 RESIDENCES",
            "developer": "IMAN DEVELOPERS L.L.C",
            "registerAreaName": "Al Sufouh First",
            "transactionSourceAreaName": "Al Safouh First",
            "transactionSourceAreaId": 307,
            "status": "Active",
            "registeredUnits": 113,
            "registeredStartDate": "2026-08-25",
            "expectedEndDate": "2029-02-28",
            "completionPercent": 0,
            "registerSnapshotAsOf": "2026-10-05",
            "registeredProjectNumberStatus": "not exposed by captured project-register page; not asserted",
        },
    }
    facts.append(register_fact)

    facts.extend([
        {
            "id": "v21-113-residences-registered-start-target",
            "recordId": RECORD_ID,
            "kind": "lifecycle",
            "status": "accepted",
            "milestone": "target_construction_start",
            "date": {"start": "2026-08-25", "precision": "day"},
            "label": "DLD-derived register start date; physical commencement not verified",
            "note": "The register displays a start date. It does not prove the date physical construction began.",
            "verification": "reported",
            "eventStatus": "reported",
            "scope": "subject",
            "identityBasis": identity_basis,
            "identitySourceIds": identity_sources,
            "sourceIds": [PROJECT_SOURCE_ID],
            "firstAvailableAt": project_source["firstAvailableAt"],
            "primaryEvidence": False,
        },
        {
            "id": "v21-113-residences-dld-target-completion",
            "recordId": RECORD_ID,
            "kind": "lifecycle",
            "status": "accepted",
            "milestone": "target_handover",
            "date": {"start": "2029-02-28", "precision": "day"},
            "label": "DLD-derived register expected end date; target only",
            "note": "The register listing gives 28 February 2029. The official developer factsheet states Q2 2029; both source claims are retained until an executed contract or newer primary schedule resolves the conflict. This is not an actual completion date.",
            "verification": "reported",
            "eventStatus": "planned",
            "scope": "subject",
            "identityBasis": identity_basis,
            "identitySourceIds": identity_sources,
            "sourceIds": [LIST_SOURCE_ID, PROJECT_SOURCE_ID, FACTSHEET_SOURCE_ID],
            "firstAvailableAt": listing_source["firstAvailableAt"],
            "primaryEvidence": False,
        },
        {
            "id": "v21-113-residences-official-target-completion-q2-2029",
            "recordId": RECORD_ID,
            "kind": "lifecycle",
            "status": "accepted",
            "milestone": "target_handover",
            "date": {"start": "2029-Q2", "precision": "quarter"},
            "label": "Official developer factsheet completion target; not an actual handover",
            "note": "The 4-page factsheet metadata gives creation 4 June 2026 and modification 22 July 2026, but neither is a verified publication or validity date. The target conflicts with the DLD-derived register expected end date of 28 February 2029.",
            "verification": "reported",
            "eventStatus": "planned",
            "scope": "subject",
            "identityBasis": identity_basis,
            "identitySourceIds": [DEVELOPER_SOURCE_ID, FACTSHEET_SOURCE_ID],
            "sourceIds": [FACTSHEET_SOURCE_ID],
            "firstAvailableAt": factsheet_source["firstAvailableAt"],
            "primaryEvidence": True,
        },
    ])

    advertised_prices = [
        ("1-bedroom", 1, 1_800_000),
        ("2-bedroom", 2, 2_560_000),
        ("3-bedroom", 3, 3_650_000),
        ("4-bedroom duplex with pool", 4, 5_440_000),
    ]
    captured_date = factsheet_source["retrievedAt"][:10]
    for label, bedrooms, price in advertised_prices:
        facts.append({
            "id": f"v21-113-residences-developer-starting-price-{bedrooms}br",
            "recordId": RECORD_ID,
            "kind": "financial",
            "status": "accepted",
            "scope": "subject",
            "identityVerified": True,
            "identityBasis": "The linked official Iman factsheet is expressly titled for 113 Residences and is linked from Iman's exact project page.",
            "identitySourceIds": [DEVELOPER_SOURCE_ID, FACTSHEET_SOURCE_ID],
            "sourceIds": [FACTSHEET_SOURCE_ID],
            "firstAvailableAt": factsheet_source["firstAvailableAt"],
            "publishedAt": None,
            "primaryEvidence": True,
            "evidenceClass": "developer_advertised_starting_price",
            "observation": {
                "period": captured_date,
                "value": price,
                "unit": "AED",
                "metric": "price",
                "frequency": "daily",
                "observationKind": "asking_quote",
                "transactionKind": None,
                "observationDateBasis": "Date the undated developer factsheet was first captured for this pass; the offer's effective date and availability period are unknown.",
                "quoteQualifier": f"Developer starting price, {label}; fact sheet issue date and offer validity unknown.",
                "sourceQuoteBasis": "official developer factsheet page 3",
                "currentSnapshotEligible": False,
                "bedrooms": f"{bedrooms}BR",
                "bedroomsLabel": f"{bedrooms}BR",
                "floorplanLabel": label,
            },
        })

    pass_data = {
        "schemaVersion": 1,
        "passId": "pass44-dred-113-residences-v21",
        "asOf": "2026-10-08",
        "sources": [project_source, listing_source, developer_source, factsheet_source],
        "facts": facts,
        "seriesLinks": [],
        "historyInputs": [],
        "licensedArchives": [],
        "additionalDatasets": [],
        "sourceCandidates": [],
        "recordResearch": [{
            "recordId": RECORD_ID,
            "asOf": "2026-10-08",
            "collectionPass": "pass44-dred-113-residences-v21",
            "collectionStatus": "exact_DLD_project_register_and_transaction_key_reviewed",
            "acceptedFactCount": len(facts),
            "directRegisteredSaleObservationsAdded": len(rows),
            "identityReview": {
                "status": "verified_exact_name_developer_and_area",
                "resolvedCandidateCount": 1,
                "remainingCandidateCount": 0,
                "registeredProjectId": None,
                "identityBasis": identity_basis,
                "identitySourceIds": identity_sources,
            },
            "sourceIds": [SALES_SOURCE_ID, PROJECT_SOURCE_ID, LIST_SOURCE_ID,
                          DEVELOPER_SOURCE_ID, FACTSHEET_SOURCE_ID],
            "captureSourceIds": [PROJECT_SOURCE_ID, LIST_SOURCE_ID,
                                 DEVELOPER_SOURCE_ID, FACTSHEET_SOURCE_ID],
            "status": "verified subject sales added; complete lifetime sale/rent history and actual completion remain unestablished",
        }],
        "collection": {
            "passId": "pass44-dred-113-residences-v21",
            "sourceDatasetVersion": "a2c9d1c447e4db0416c2badcda8c1b4011f6e677",
            "sourceSnapshotDate": "2026-10-05",
            "sourceFileSHA256": parquet_sha,
            "sourceRows": parquet.metadata.num_rows,
            "candidateProject": RECORD_ID,
            "exactSourceProjectName": "113 RESIDENCES",
            "exactSourceAreaId": 307,
            "exactSourceAreaName": "Al Safouh First",
            "candidateRows": len(rows),
            "acceptedTransactionRows": len(rows),
            "uniqueTransactionIds": len(set(ids)),
            "firstRegistrationDate": rows[0]["instance_date"].isoformat(),
            "lastRegistrationDate": rows[-1]["instance_date"].isoformat(),
            "quality": "Every accepted row is Residential | Unit | Flat | Off-Plan | procedure 102 | quality_flags=0.",
            "noAggregateMedian": "Individual transactions are preserved. No project monthly median is added; native month samples are below the aggregate publication threshold or not validated for a comparable composition.",
            "rawDatasetRedistributed": False,
            "rawWebBodiesRedistributed": False,
        },
        "methodology": (
            "Append exact registered transaction facts without modifying prior observations. The transaction file is a pinned CC BY 4.0 DLD-derived distribution, not a direct DLD response. "
            "The DLD project-register page confirms the exact registered name, developer, location and 113 units; the official developer page confirms the project identity and Al Sufouh location. "
            "The numeric DLD project identifier is not exposed by the captured project-register page and is not asserted. Every exact-name row in the pinned transaction source is in one source-native area key and the same residential off-plan flat cohort; no fuzzy name, project phase, or other-area fan-out is used. "
            "All 46 native transactions are retained individually with DLD registration dates. Advertised factsheet starting prices are separate from registered sales and have unknown quote-validity dates. The two different future completion targets are both retained as planned source claims; actual completion is not inferred."
        ),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(pass_data, ensure_ascii=False, sort_keys=True, indent=2) + "\n")
    print(json.dumps({"passId": pass_data["passId"], "sources": len(pass_data["sources"]),
                      "acceptedTransactions": len(rows), "facts": len(facts),
                      "firstRegistrationDate": rows[0]["instance_date"].isoformat(),
                      "lastRegistrationDate": rows[-1]["instance_date"].isoformat(),
                      "output": str(args.output)}, indent=2))


if __name__ == "__main__":
    main()
