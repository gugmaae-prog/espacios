#!/usr/bin/env python3
"""Build privacy-preserving monthly and quarterly DLD project price cohorts.

The local raw source files are intentionally not committed. Only sample counts,
and distribution summaries with n >= 20, are emitted to the public history input.
"""
import argparse
import csv
import gzip
import hashlib
import io
import json
import math
import statistics
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "data/historical-intelligence"
AS_OF = "2026-10-08"
OBSERVATION_CUTOFF = date(2026, 10, 6)
TRANSACTION_FILES = {
    "dld-transactions-2026-10-07-0001.csv.gz": {"sourceFileName": "transactions_2026-10-07_17-55-58_0001.csv.gz", "sha256": "6625f13f9896c725cf6599e30051d0fef9be208bd8757141d2eac93e148d57de"},
    "dld-transactions-2026-10-07-0002.csv.gz": {"sourceFileName": "transactions_2026-10-07_17-55-58_0002.csv.gz", "sha256": "cf479f282632cea3525648db3f42d8f9a956a949dff92ca400e2b68f88fee1e5"},
}
PROJECTS_SHA256 = "1245172526b2420efaed358adeaddd13d312281bb26ceb7cca2495a9802f2f42"
DEVELOPERS_SHA256 = "bfaef39caa7d68924ee5c1e2841de5c59bc503ca77180516a89cea281f76dcca"
DATASET_URL = "https://data.dubai/en/l/470061"
PROJECT_REGISTER_URL = "https://data.dubai/en/l/467654"
DEVELOPER_REGISTER_URL = "https://data.dubai/en/l/462802"
AREA_REGISTER_URL = "https://data.dubai/en/l/465592"
LICENCE = "Dubai Open Data Licence; attribution required, commercial derivatives allowed, original data resale prohibited"

SPECS = [
    {
        "recordId": "project:apartments-in-lacina-in-ghaf-woods-dubai", "name": "Lacina",
        "projectNumber": 3336, "areaId": 466, "areaName": "Wadi Al Safa 4", "developerToken": "MAJID AL FUTTAIM",
        "brandSourceId": "pass45-official-lacina-developer", "brandSourceURL": "https://www.ghafwoods.com/en",
        "brandPublisher": "Majid Al Futtaim / Ghaf Woods official project website",
    },
    {
        "recordId": "project:south-living-by-dubai-south-in-dubai-south-dubai", "name": "South Living",
        "projectNumber": 1946, "areaId": 462, "areaName": "Madinat Al Mataar", "developerToken": "DUBAI SOUTH",
        "brandSourceId": "pass45-official-south-living-developer", "brandSourceURL": "https://www.dubaisouth.ae/en/newsroom/dubai-south-properties-unveils-south-living-an-exclusive-luxury-apartment-project-in-the-residential-district",
        "brandPublisher": "Dubai South Properties official newsroom",
    },
    {
        "recordId": "project:south-square-by-dubai-south-properties", "name": "South Square",
        "projectNumber": 3711, "areaId": 462, "areaName": "Madinat Al Mataar", "developerToken": "DUBAI SOUTH",
        "brandSourceId": "pass45-official-south-square-developer", "brandSourceURL": "https://www.dubaisouth.ae/en/newsroom/dubai-south-launches-south-square-sells-out-first-tower-within-three-hours",
        "brandPublisher": "Dubai South Properties official newsroom",
    },
    {
        "recordId": "project:amaal-8-meydan-horizon-mbr-city-dubai", "name": "Amaal 8",
        "projectNumber": 3004, "areaId": 376, "areaName": "Ras Al Khor Industrial First", "developerToken": "AMAAL",
        "brandSourceId": "pass45-official-amaal-8-developer", "brandSourceURL": "https://www.amaal.ae/amaal8",
        "brandPublisher": "Amaal Emirates official project website",
    },
    {
        "recordId": "project:elle-residences-anax-developments-dubai-islands", "name": "Elle Residences",
        "projectNumber": 4065, "areaId": 432, "areaName": "Palm Deira", "developerToken": "ANAX",
        "brandSourceId": "pass45-official-elle-residences-developer", "brandSourceURL": "https://anaxdevelopments.com/dubai-islands/elle-residences",
        "brandPublisher": "ANAX Developments official project website",
    },
    {
        "recordId": "project:one-river-point-by-ellington-properties-dutco-in-business-bay", "name": "One River Point",
        "projectNumber": 2929, "areaId": 526, "areaName": "Business Bay", "developerToken": "DUTCO ELLINGTON",
        "brandSourceId": "primary3-1b9152f1d42b2881be4f3668", "brandSourceURL": "https://ellingtonproperties.ae/en/media-center/news/dutco-and-ellington-properties-unveil-a-new-residential-development-one-river-point-under-the-dutco-ellington-brand",
        "brandPublisher": "Dutco and Ellington Properties official announcement",
    },
    {
        "recordId": "project:azizi-riviera-beachfront-meydan-apartments-for-sale-in-mbr-city-dubai", "name": "Azizi Riviera Beachfront",
        "projectNumber": 2297, "areaId": 412, "areaName": "Al Merkadh", "developerToken": "AZIZI",
        "brandSourceId": "dld-official-developers-20261001", "brandSourceURL": None,
        "brandPublisher": "Dubai Land Department official developer register",
        "brandEvidenceNote": "the official DLD developer register names AZIZI DEVELOPMENTS L.L.C; that legal developer name contains the catalogue brand token, and no third-party project page is used as proof",
    },
    {
        "recordId": "project:signature-mansions-villas-for-sale-in-jumeirah-golf-estates", "name": "Signature Mansions",
        "projectNumber": 2542, "areaId": 485, "areaName": "Me'Aisem First", "developerToken": "SIGNATURE",
        "brandSourceId": "pass45-official-signature-mansions-developer", "brandSourceURL": "https://signaturedevelopers.ae/projects/",
        "brandPublisher": "Signature Developers official project website",
    },
]

HISTORY_FIELDS = [
    "Series ID", "Emirate", "Geography", "Scope", "Segment", "Registration", "Period",
    "Frequency", "Metric", "Value", "Unit", "Sample rows", "P25", "P75",
    "Eligible value AED", "Quality", "Class", "Source ID", "Source URL", "Raw source emirate",
    "Gross yield pct", "Blocked rows", "Published date", "Observation basis", "Source area ID",
    "Native row JSON", "Endpoint",
]


def sha(blob):
    return hashlib.sha256(blob).hexdigest()


def read_json_gzip(path, expected_sha):
    blob = path.read_bytes()
    if sha(blob) != expected_sha:
        raise ValueError(f"Official register checksum mismatch: {path.name}")
    return json.loads(gzip.decompress(blob))


def number(raw):
    value = float(raw)
    if not math.isfinite(value):
        raise ValueError("non-finite value")
    return value


def quarter(period_date):
    return f"{period_date.year}-Q{(period_date.month - 1) // 3 + 1}"


def period_for(day, frequency):
    return day.strftime("%Y-%m") if frequency == "month" else quarter(day)


def quantile_inclusive(values, probability):
    values = sorted(values)
    if len(values) == 1:
        return values[0]
    position = (len(values) - 1) * probability
    low = math.floor(position)
    high = math.ceil(position)
    return values[low] + (values[high] - values[low]) * (position - low)


def clean_number(value):
    return "" if value is None else f"{value:.4f}"


def source_web(spec, day=AS_OF):
    if spec["brandSourceId"] == "primary3-1b9152f1d42b2881be4f3668":
        return None
    return {
        "id": spec["brandSourceId"],
        "url": spec["brandSourceURL"],
        "publisher": spec["brandPublisher"],
        "retrievedAt": day,
        "firstAvailableAt": day,
        "publishedAt": None,
        "datePrecision": "day",
        "publicationDateStatus": "source publication date unknown; first reviewed by this pass",
        "classification": "primary_public_developer_or_project_page",
        "captureStatus": "official public page reviewed; raw page body not retained",
        "rawBodyRetained": False,
        "licence": "rights_pending: factual identity corroboration and citation metadata only; no page-content redistribution",
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--transactions", nargs=2, type=Path, required=True)
    parser.add_argument("--projects", type=Path, required=True)
    parser.add_argument("--developers", type=Path, required=True)
    parser.add_argument("--records", type=Path, default=BASE / "../historical-intelligence-20261003.json")
    parser.add_argument("--out-history", type=Path, default=BASE / "dld-20261007-eight-project-monthly-quarterly-sales.csv.gz")
    parser.add_argument("--out-sidecar", type=Path, default=BASE / "dld-20261007-eight-project-sales-enrichment.json")
    args = parser.parse_args()

    transaction_files = sorted(args.transactions, key=lambda p: p.name)
    if {p.name for p in transaction_files} != set(TRANSACTION_FILES):
        raise ValueError("Expected the two named 2026-10-07 DLD transaction snapshot files")
    tx_hashes = {}
    for path in transaction_files:
        actual = sha(path.read_bytes())
        if actual != TRANSACTION_FILES[path.name]["sha256"]:
            raise ValueError(f"Official transaction snapshot checksum mismatch: {path.name}")
        tx_hashes[path.name] = actual

    projects = read_json_gzip(args.projects, PROJECTS_SHA256)
    developers = read_json_gzip(args.developers, DEVELOPERS_SHA256)
    project_rows = defaultdict(list)
    for row in projects:
        project_rows[int(row["project_number"])].append(row)
    developer_rows = defaultdict(list)
    for row in developers:
        developer_rows[int(row["developer_id"])].append(row)
    by_record = {row["id"]: row for row in json.loads(args.records.read_text())["records"]}
    spec_by_number = {spec["projectNumber"]: spec for spec in SPECS}
    canonical_by_record = {}
    for spec in SPECS:
        matches = project_rows[spec["projectNumber"]]
        if len(matches) != 1:
            raise ValueError(f"DLD project number is not unique: {spec['projectNumber']}")
        project = matches[0]
        if int(project["area_id"]) != spec["areaId"] or project.get("area_name_en") != spec["areaName"]:
            raise ValueError(f"DLD project area disagrees for {spec['name']}")
        dev_matches = developer_rows[int(project["developer_id"])]
        if len(dev_matches) != 1:
            raise ValueError(f"DLD developer id is not unique: {project['developer_id']}")
        developer = dev_matches[0]
        english_developer = (developer.get("developer_name_en") or "").upper()
        if spec["developerToken"] not in english_developer:
            raise ValueError(f"DLD developer does not corroborate the marketed developer for {spec['name']}: {english_developer}")
        if spec["recordId"] not in by_record:
            raise ValueError(f"Catalogue record is missing: {spec['recordId']}")
        if int(by_record[spec["recordId"]]["researchStatus"].get("identityCandidateCount", 0)) < 1:
            raise ValueError(f"No quarantined identity candidate remains for {spec['recordId']}")
        canonical_by_record[spec["recordId"]] = {"project": project, "developer": developer}

    seen_transaction_ids = set()
    bad_dates = Counter()
    identity_quarantine = Counter()
    formula_checks = 0
    formula_discrepancies = 0
    eligible = defaultdict(list)
    selected_transactions = 0
    for path in transaction_files:
        with gzip.open(path, "rt", encoding="utf-8-sig", newline="") as stream:
            reader = csv.DictReader(stream)
            for row in reader:
                try:
                    project_number = int(float(row.get("project_number") or ""))
                except (ValueError, TypeError):
                    continue
                spec = spec_by_number.get(project_number)
                if not spec:
                    continue
                if row.get("trans_group_en") != "Sales" or row.get("property_usage_en") != "Residential" or row.get("property_type_en") not in {"Unit", "Villa"}:
                    continue
                if row.get("reg_type_en") not in {"Off-Plan Properties", "Existing Properties"}:
                    identity_quarantine["unsupported_registration"] += 1
                    continue
                try:
                    observed_day = date.fromisoformat((row.get("instance_date") or "")[:10])
                except ValueError:
                    bad_dates["unparseable"] += 1
                    continue
                if observed_day.year < 1900 or observed_day > OBSERVATION_CUTOFF:
                    bad_dates["out_of_snapshot_range"] += 1
                    continue
                area_id = int(float(row.get("area_id") or ""))
                project_name = " ".join((row.get("project_name_en") or "").split()).casefold()
                if area_id != spec["areaId"] or project_name != spec["name"].casefold():
                    identity_quarantine["project_area_or_name_mismatch"] += 1
                    continue
                transaction_id = row.get("transaction_id")
                if not transaction_id:
                    identity_quarantine["missing_transaction_id"] += 1
                    continue
                if transaction_id in seen_transaction_ids:
                    identity_quarantine["duplicate_transaction_id"] += 1
                    continue
                seen_transaction_ids.add(transaction_id)
                try:
                    actual_worth = number(row["actual_worth"])
                    procedure_area = number(row["procedure_area"])
                    meter_sale_price = number(row["meter_sale_price"])
                except (ValueError, TypeError, KeyError):
                    identity_quarantine["invalid_price_or_area"] += 1
                    continue
                if actual_worth <= 0 or procedure_area <= 0 or meter_sale_price <= 0:
                    identity_quarantine["nonpositive_price_or_area"] += 1
                    continue
                formula_checks += 1
                if abs(actual_worth / procedure_area - meter_sale_price) > max(0.03, meter_sale_price * 0.001):
                    formula_discrepancies += 1
                    identity_quarantine["price_formula_discrepancy"] += 1
                    continue
                sqft_price = (actual_worth / procedure_area) / 10.763910416709722
                subtype = " ".join((row.get("property_sub_type_en") or "Unknown").split()) or "Unknown"
                properties = {
                    "projectNumber": project_number,
                    "recordId": spec["recordId"],
                    "registration": row["reg_type_en"],
                    "propertyType": row["property_type_en"],
                    "propertySubtype": subtype,
                    "day": observed_day.isoformat(),
                    "aedSqft": sqft_price,
                    "actualWorthAED": actual_worth,
                }
                eligible[("month", project_number, row["reg_type_en"], row["property_type_en"], subtype, period_for(observed_day, "month"))].append(properties)
                eligible[("quarter", project_number, row["reg_type_en"], row["property_type_en"], subtype, period_for(observed_day, "quarter"))].append(properties)
                selected_transactions += 1

    if formula_discrepancies:
        raise ValueError(f"Price-per-area validation failed for {formula_discrepancies} selected rows")
    if identity_quarantine or bad_dates:
        raise ValueError(f"Unexpected quarantined source rows: identity={dict(identity_quarantine)}, dates={dict(bad_dates)}")
    if selected_transactions != 2067 or len(seen_transaction_ids) != 2067:
        raise ValueError(f"Selected transaction row count changed: {selected_transactions}")

    availability = "2026-10-08T02:17:55Z"
    retrieved = "2026-10-08T02:19:43Z"
    source_id = "dld-official-transactions-20261007"
    source_url = DATASET_URL
    observation_basis = "DLD instance_date is registration date, not contract execution or transfer date. Latest-vintage descriptive snapshot only; source publication date is unknown. Not available for backtests dated before first retrieval."
    out = io.StringIO(newline="")
    writer = csv.DictWriter(out, fieldnames=HISTORY_FIELDS, lineterminator="\n")
    writer.writeheader()
    period_counts = Counter()
    sparse_cells = 0
    model_eligible_cells = 0
    for key in sorted(eligible):
        frequency, project_number, registration, property_type, subtype, period = key
        observations = eligible[key]
        count = len(observations)
        values = [x["aedSqft"] for x in observations]
        # Do not publish a price statistic below the established minimum.
        median = statistics.median(values) if count >= 20 else None
        p25 = quantile_inclusive(values, 0.25) if count >= 20 else None
        p75 = quantile_inclusive(values, 0.75) if count >= 20 else None
        project_spec = spec_by_number[project_number]
        reg_slug = "offplan" if registration == "Off-Plan Properties" else "existing"
        segment_slug = property_type.casefold().replace(" ", "-") + "-" + subtype.casefold().replace(" ", "-")
        series_id = f"dld-20261007-project-{project_number}-{frequency}-{reg_slug}-{segment_slug}"
        first_day = min(x["day"] for x in observations)
        last_day = max(x["day"] for x in observations)
        detail = {
            "aggregation": "median and inclusive linear-interpolation quartiles of actual_worth / procedure_area / 10.763910416709722",
            "sampleCount": count,
            "minimumDisplaySample": 20,
            "statisticPublished": count >= 20,
            "sparseMedianPolicy": "withheld; eligible row count retained",
            "firstRegistrationDate": first_day,
            "lastRegistrationDate": last_day,
            "registrationDateBasis": "DLD instance_date",
            "propertyType": property_type,
            "propertySubtype": subtype,
            "registration": registration,
            "projectNumber": project_number,
            "registeredProjectId": canonical_by_record[project_spec["recordId"]]["project"]["project_id"],
            "registeredDeveloperId": canonical_by_record[project_spec["recordId"]]["project"]["developer_id"],
            "registeredDeveloperNameEn": canonical_by_record[project_spec["recordId"]]["developer"].get("developer_name_en"),
            "areaId": project_spec["areaId"],
            "snapshotDate": "2026-10-07",
            "observationCutoff": OBSERVATION_CUTOFF.isoformat(),
            "sourceFirstObservedAt": availability,
            "backtestUse": "not admissible before first source retrieval",
        }
        writer.writerow({
            "Series ID": series_id,
            "Emirate": "Dubai",
            "Geography": project_spec["name"],
            "Scope": "subject",
            "Segment": f"{property_type} / {subtype}",
            "Registration": registration,
            "Period": period,
            "Frequency": frequency,
            "Metric": "median_sale_aed_sqft",
            "Value": clean_number(median),
            "Unit": "AED/sqft",
            "Sample rows": count,
            "P25": clean_number(p25),
            "P75": clean_number(p75),
            "Eligible value AED": clean_number(sum(x["actualWorthAED"] for x in observations)),
            "Quality": "eligible registered residential sales; n>=20" if count >= 20 else f"sparse registered sales; n={count}; median withheld below 20",
            "Class": "official DLD derived primary project cohort snapshot",
            "Source ID": source_id,
            "Source URL": source_url,
            "Raw source emirate": "Dubai",
            "Published date": "",
            "Observation basis": observation_basis,
            "Source area ID": project_spec["areaId"],
            "Native row JSON": json.dumps(detail, ensure_ascii=False, separators=(",", ":"), sort_keys=True),
            "Endpoint": DATASET_URL,
        })
        period_counts[frequency] += 1
        if median is None:
            sparse_cells += 1
        else:
            model_eligible_cells += 1

    csv_bytes = out.getvalue().encode("utf-8")
    csv_gzip = gzip.compress(csv_bytes, mtime=0)
    args.out_history.parent.mkdir(parents=True, exist_ok=True)
    args.out_history.write_bytes(csv_gzip)

    baseline = json.loads((BASE / "scrape-enrichment.json").read_text())
    baseline_sources = {x["id"]: x for x in baseline["sources"]}
    if "dld-official-transactions-20261003" not in baseline_sources:
        raise ValueError("Cannot revision the retained DLD transaction snapshot")
    projects_source = "dld-official-projects-20260706"
    developers_source = "dld-official-developers-20261001"
    areas_source = "dld-official-areas-20261002"
    for identifier in [projects_source, developers_source, areas_source, "primary3-1b9152f1d42b2881be4f3668"]:
        if identifier not in baseline_sources:
            raise ValueError(f"Expected retained primary source is missing: {identifier}")

    new_source = {
        "id": source_id,
        "revisionOfSourceId": "dld-official-transactions-20261003",
        "preserveRevision": True,
        "url": source_url,
        "publisher": "Dubai Land Department via Dubai Data and Statistics Establishment",
        "title": "DLD transactions, official Data Dubai open-data snapshot",
        "classification": "official_latest_vintage_open_data_snapshot",
        "sourceSnapshotDate": "2026-10-07",
        "publicationDateStatus": "unknown; portal publication time not independently established",
        "publishedAt": None,
        "firstAvailableAt": availability,
        "retrievedAt": retrieved,
        "datePrecision": "minute",
        "availabilityBasis": "earliest local retrieval mtime of the two snapshot parts; conservative point-in-time cutoff",
        "licence": LICENCE,
        "licenceURL": "https://data.dubai/en/terms-conditions",
        "snapshotFiles": [
            {"fileName": TRANSACTION_FILES[name]["sourceFileName"], "bytes": path.stat().st_size, "sha256": tx_hashes[name]}
            for name, path in ((p.name, p) for p in transaction_files)
        ],
        "observationCoverage": {"start": "2022-01-01", "end": OBSERVATION_CUTOFF.isoformat(), "basis": "selected-project source rows; exact transaction dates retained in internal derivation only"},
        "rawTransactionRowsRedistributed": False,
        "rawTransactionIdsRedistributed": False,
        "note": "Derived monthly and quarterly project cohort summaries only; sample sizes below 20 are retained with medians withheld. Raw originals and transaction IDs remain private.",
    }
    sources = [new_source]
    for spec in SPECS:
        if spec["brandSourceId"] not in baseline_sources:
            sources.append(source_web(spec))

    links = []
    reviews = []
    series_keys = sorted(eligible)
    series_ids = sorted({
        f"dld-20261007-project-{key[1]}-{key[0]}-{'offplan' if key[2] == 'Off-Plan Properties' else 'existing'}-{key[3].casefold().replace(' ', '-')}-{key[4].casefold().replace(' ', '-')}"
        for key in series_keys
    })
    ids_by_project = defaultdict(list)
    for series_id in series_ids:
        project_number = int(series_id.split("-project-", 1)[1].split("-", 1)[0])
        ids_by_project[project_number].append(series_id)
    input_files = {
        "transactionFiles": [{"localFileName": name, "sourceFileName": TRANSACTION_FILES[name]["sourceFileName"], "sha256": tx_hashes[name]} for name in sorted(tx_hashes)],
        "projectRegisterFile": {"fileName": args.projects.name, "bytes": args.projects.stat().st_size, "sha256": PROJECTS_SHA256, "snapshotDate": "2026-07-06"},
        "developerRegisterFile": {"fileName": args.developers.name, "bytes": args.developers.stat().st_size, "sha256": DEVELOPERS_SHA256, "snapshotDate": "2026-10-01"},
    }
    for spec in SPECS:
        project = canonical_by_record[spec["recordId"]]["project"]
        developer = canonical_by_record[spec["recordId"]]["developer"]
        initial_count = int(by_record[spec["recordId"]]["researchStatus"]["identityCandidateCount"])
        identity_sources = list(dict.fromkeys([
            source_id, "dld-official-projects-20260706", "dld-official-developers-20261001", "dld-official-areas-20261002", spec["brandSourceId"],
        ]))
        basis = (
            f"Unique DLD project_number {spec['projectNumber']} maps to registered project_id {project['project_id']}; "
            f"its area_id {spec['areaId']} / {spec['areaName']} and developer_id {project['developer_id']} match the official DLD area and developer registers, "
            f"whose English developer name is {developer.get('developer_name_en')!r}. Every linked sale row repeats that project number and area, "
            f"and its English project name exactly matches the catalogue name {spec['name']!r}; {spec.get('brandEvidenceNote', 'the official developer page corroborates the marketed brand')}. "
            "Only one exact registered cohort is resolved; other duplicate or alternate-field candidate rows remain quarantined."
        )
        for series_id in ids_by_project[spec["projectNumber"]]:
            links.append({
                "seriesId": series_id,
                "recordId": spec["recordId"],
                "scope": "subject",
                "identityVerified": True,
                "identityBasis": basis,
                "identitySourceIds": identity_sources,
            })
        period_rows = [
            len(values) for key, values in eligible.items() if key[1] == spec["projectNumber"]
        ]
        reviews.append({
            "recordId": spec["recordId"],
            "asOf": AS_OF,
            "status": "Exact DLD-registered residential sale cohorts appended; this does not establish complete or lifetime project price history.",
            "sourceIds": identity_sources,
            "collectionPasses": [{
                "passId": "pass45-dld-exact-project-transactions-20261007",
                "reviewedAt": AS_OF,
                "registeredProjectNumber": spec["projectNumber"],
                "registeredProjectId": project["project_id"],
                "registeredDeveloperId": project["developer_id"],
                "registeredDeveloperNameEn": developer.get("developer_name_en"),
                "areaId": spec["areaId"],
                "initialIdentityCandidateCount": initial_count,
                "eligibleTransactionRows": sum(period_rows) // 2,
                "monthlyQuarterlySeriesCount": len(ids_by_project[spec["projectNumber"]]),
                "monthlyQuarterlyAggregateCells": sum(1 for key in eligible if key[1] == spec["projectNumber"]),
                "smallSampleCellsRetainedWithoutPriceStatistic": sum(
                    1 for key, values in eligible.items() if key[1] == spec["projectNumber"] and len(values) < 20
                ),
                "priceStatisticCellsAtOrAboveMinimum": sum(
                    1 for key, values in eligible.items() if key[1] == spec["projectNumber"] and len(values) >= 20
                ),
                "earliestSourceRegistrationDate": min(x["day"] for key, values in eligible.items() if key[1] == spec["projectNumber"] for x in values),
                "latestSourceRegistrationDate": max(x["day"] for key, values in eligible.items() if key[1] == spec["projectNumber"] for x in values),
                "sourcePublicationDate": "unknown",
                "rawRowsOrTransactionIdsRedistributed": False,
                "fullHistoryClaim": False,
            }],
            "identityReview": {
                "status": "verified_exact_name_developer_and_area",
                "identityBasis": basis,
                "identitySourceIds": identity_sources,
                "registeredProjectId": project["project_id"],
                "resolvedCandidateCount": 1,
                "remainingCandidateCount": initial_count - 1,
            },
        })

    sidecar = {
        "schemaVersion": 1,
        "passId": "pass45-dld-exact-project-transactions-20261007",
        "asOf": AS_OF,
        "sources": sources,
        "facts": [],
        "seriesLinks": links,
        "historyInputs": [{
            "id": "pass45-dld-exact-project-cohort-history",
            "path": args.out_history.name,
            "sha256": sha(csv_gzip),
            "uncompressedSHA256": sha(csv_bytes),
            "compression": "gzip",
            "rowCount": len(eligible),
            "sourceId": source_id,
            "firstAvailableAt": availability,
            "note": "Monthly and quarterly medians by exact project, property segment, subtype and registration. Sparse cells and counts are retained; no transaction IDs or individual prices are emitted.",
        }],
        "recordResearch": reviews,
        "licensedArchives": [],
        "additionalDatasets": [],
        "sourceCandidates": [],
        "collection": {
            "inputFiles": input_files,
            "sourceRowsSelected": selected_transactions,
            "uniqueTransactionIdsSelected": len(seen_transaction_ids),
            "duplicateTransactionIds": 0,
            "dateQuarantines": dict(bad_dates),
            "identityQuarantines": dict(identity_quarantine),
            "priceFormulaChecks": formula_checks,
            "priceFormulaDiscrepancies": formula_discrepancies,
            "minimumDisplaySample": 20,
            "aggregateCellsByFrequency": dict(period_counts),
            "sparseCellsWithheldMedian": sparse_cells,
            "cellsMeetingMinimum": model_eligible_cells,
            "distinctProjects": len(SPECS),
            "rawRowsAndTransactionIdsRedistributed": False,
            "scope": "verified registered project cohorts only; exact project number + area + name + developer-register linkage",
            "sourceObservationCoverage": {"start": min(x["day"] for values in eligible.values() for x in values), "end": max(x["day"] for values in eligible.values() for x in values)},
            "sourcePublicationDate": "unknown; backtest eligibility starts at first retrieval",
        },
        "methodology": (
            "The source is the official Dubai Land Department transactions dataset. Rows were joined by the exact DLD project number and area ID in the official DLD project register, then checked against the official developer register and one exact catalogue project name. "
            "Only Sales / Residential / Unit or Villa rows with a valid positive amount and procedure area, known registration class, and instance_date through 2026-10-06 were included. DLD instance_date is a registration date, not a contract execution or transfer date. "
            "AED/sqft is calculated from actual_worth / procedure_area / 10.763910416709722 after checking the DLD meter_sale_price field within 0.1% or AED 0.03/sqm. Results are monthly and quarterly cohorts split by registration, property type, and subtype. "
            "Median and inclusive P25/P75 are published only when n >= 20; sparse rows retain the eligible count and dates but no price statistic. Monthly and quarterly samples overlap and must not be added. "
            "Only derived aggregates are published; transaction IDs and raw transaction rows remain local. The latest-vintage file was first retrieved on 2026-10-08, so these values are not admissible as inputs to earlier historical backtests. These cohorts add observed periods, not a complete or earliest-ever price history; rental history, valuation, and forecast validation remain separate gaps."
        ),
    }
    args.out_sidecar.write_text(json.dumps(sidecar, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n")
    print(json.dumps({
        "history": str(args.out_history), "historySHA256": sha(csv_gzip), "historyRows": len(eligible),
        "sidecar": str(args.out_sidecar), "sidecarSHA256": sha(args.out_sidecar.read_bytes()),
        "uniqueTransactions": selected_transactions, "seriesLinks": len(links), "records": len(reviews),
        "aggregateCellsByFrequency": dict(period_counts), "sparseCells": sparse_cells,
        "cellsMeetingMinimum": model_eligible_cells, "priceFormulaDiscrepancies": formula_discrepancies,
    }, sort_keys=True))


if __name__ == "__main__":
    main()
