#!/usr/bin/env python3
"""Prepare a pinned, source-labelled project sales-summary pass.

The input is the public Dubai Data project page JSON plus the retained Espacios
catalogue. Only unique exact project-name matches with a unique DLD project
number and a qualifying source sample are admitted. The published statistic is
a trailing-12-complete-month aggregate, never a monthly or lifetime series.
"""
import argparse
import collections
import csv
import datetime as dt
import gzip
import hashlib
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = ROOT / "data/historical-intelligence"
CAPTURE = ROOT / ".local-data/datadubai-projects-20261008"
PASS_ID = "datadubai-project-sales-20261008"
SOURCE_DATASET_COMMIT = "56d6613fe0ebefa18eac21b727a8f22657f9d9ff"
PROJECTS_CSV_SHA256 = "e2f8da656f3b0e164daf6009eb0c4e2c402cab2df5e34d8eefb6a5f3b200baca"
EXPECTED_WINDOW = "Oct 2025 – Sep 2026"
EXPECTED_THROUGH = "2026-10-06"
FIELDS = [
    "Series ID", "Record ID", "Metric", "Frequency", "Unit", "Class", "Source ID", "Source URL",
    "Published date", "Geography", "Emirate", "Segment", "Label", "Registration", "Source area ID",
    "Endpoint", "Period", "Value", "Sample rows", "Quality", "P25", "P75", "Eligible value AED",
    "Gross yield pct", "Blocked rows", "Raw source emirate", "Observation basis", "Native row JSON",
    "Source observation ID", "Observation kind", "Transaction kind", "Procedure ID", "Procedure name",
]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def norm(text):
    return " ".join(str(text or "").strip().casefold().split())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--projects-csv", type=pathlib.Path, default=CAPTURE / "projects-pinned.csv")
    parser.add_argument("--captures", type=pathlib.Path, default=CAPTURE)
    parser.add_argument("--snapshot", type=pathlib.Path, default=ROOT / "data/historical-intelligence-20261003.json")
    parser.add_argument("--out-history", type=pathlib.Path, default=BASE / "datadubai-project-sales-20261008.csv.gz")
    parser.add_argument("--out-sidecar", type=pathlib.Path, default=BASE / "datadubai-project-sales-20261008.json")
    parser.add_argument("--manifest", type=pathlib.Path, default=CAPTURE / "capture-manifest.json")
    args = parser.parse_args()

    project_csv_bytes = args.projects_csv.read_bytes()
    if sha(project_csv_bytes) != PROJECTS_CSV_SHA256:
        raise SystemExit("Pinned Dubai Data project CSV checksum differs from the reviewed source revision.")
    if SOURCE_DATASET_COMMIT not in args.projects_csv.name and args.projects_csv.name != "projects-pinned.csv":
        raise SystemExit("Project registry must come from the pinned public repository revision.")

    snapshot = json.loads(args.snapshot.read_text())
    if snapshot.get("version") != "20261008-enrichment-v27" or len(snapshot.get("records", [])) != 1860:
        raise SystemExit("Identity baseline must be the reviewed V27 production catalogue.")
    records = {row["id"]: row for row in snapshot["records"]}
    projects_by_name = collections.defaultdict(list)
    source_rows = list(csv.DictReader(project_csv_bytes.decode("utf-8-sig").splitlines()))
    project_number_rows = collections.defaultdict(list)
    for row in source_rows:
        project_number_rows[str(row.get("pn", "")).strip()].append(row)
    for record in snapshot["records"]:
        if record.get("type") == "project":
            projects_by_name[norm(record["name"])].append(record)

    manifest = json.loads(args.manifest.read_text())
    if manifest.get("windowExpected") != EXPECTED_WINDOW or manifest.get("throughExpected") != EXPECTED_THROUGH:
        raise SystemExit("Capture manifest window/cutoff differs from the reviewed source vintage.")
    if not manifest.get("retrievedAt", "").startswith("2026-10-08T"):
        raise SystemExit("All project-page captures must have been retrieved on the reviewed date.")

    sources, links, rows, seen_records = [], [], [], set()
    eligible = []
    quarantines = []
    for captured in manifest.get("pages", []):
        page_path = args.captures / (captured["slug"] + ".json")
        body = page_path.read_bytes()
        if sha(body) != captured.get("sha256"):
            raise SystemExit("Captured project page checksum mismatch: " + captured["slug"])
        page = json.loads(body)
        entity = page.get("entity", "")
        number = str((page.get("registry") or {}).get("pn", ""))
        summary = page.get("summary") or {}
        candidates = projects_by_name.get(norm(entity), [])
        source_number_matches = project_number_rows.get(number, [])
        valid_page = (
            page.get("through") == EXPECTED_THROUGH
            and page.get("window") == EXPECTED_WINDOW
            and page.get("source") == "Dubai Land Department open data"
            and page.get("url") == f"https://datadubai.ae/projects/{captured['slug']}/"
            and len(source_number_matches) == 1
            and norm(source_number_matches[0].get("name")) == norm(entity)
            and source_number_matches[0].get("slug") == captured.get("slug")
            and len(candidates) == 1
            and candidates[0]["id"] == captured.get("recordId")
            and candidates[0]["name"] == captured.get("catalogueName")
            and int(number) == int(captured.get("dldProjectNumber", -1))
            and int(summary.get("n_price") or 0) >= 50
            and str(summary.get("quality", "")).lower() == "ok"
            and isinstance(summary.get("price_median"), (float, int))
            and summary["price_median"] > 0
        )
        if not valid_page:
            quarantines.append({"slug": captured.get("slug"), "reason": "project identity, period, provenance or sample gate failed"})
            continue
        record = candidates[0]
        if record["id"] in seen_records:
            quarantines.append({"slug": captured["slug"], "reason": "duplicate project record match"})
            continue
        seen_records.add(record["id"])
        available = manifest["retrievedAt"]
        project_source_id = f"datadubai-project-{number}-20261008"
        source = {
            "id": project_source_id,
            "url": page["url"],
            "machineReadableCaptureURL": captured["url"],
            "publisher": "Continental Club Property (Dubai Data)",
            "underlyingPublisher": "Dubai Land Department open data",
            "title": f"DLD-derived sales summary for {entity}",
            "classification": "independent_dld_derived_project_transaction_aggregate",
            "datasetVersion": SOURCE_DATASET_COMMIT,
            "datasetFile": "data/projects.csv",
            "datasetFileSha256": PROJECTS_CSV_SHA256,
            "registeredProjectNumber": int(number),
            "licence": "CC BY 4.0; attribute Dubai Data / Continental Club Property and Dubai Land Department; derived aggregates only",
            "licenceURL": "https://creativecommons.org/licenses/by/4.0/",
            "publishedAt": "2026-10-07",
            "publicationDateStatus": "Dubai Data states the site was rebuilt on 7 Oct 2026; this project page does not expose an individual publication timestamp.",
            "firstAvailableAt": available,
            "retrievedAt": available,
            "sourceDataThrough": page["through"],
            "sourceWindow": page["window"],
            "captureSha256": captured["sha256"],
            "captureBytes": captured["bytes"],
            "identityBasis": "The source entity exactly matches one unique Espacios project name. The source page and pinned DLD project-register export resolve the same unique DLD project number; the publisher states transactions are matched by DLD project number, never by name. This is a project-level sales cohort, not individual-unit identity.",
            "primaryEvidence": False,
            "rawTransactionRowsRedistributed": False,
        }
        sources.append(source)
        identity_ids = [project_source_id, "catalogue-core"]
        identity_basis = source["identityBasis"]
        summary_rows = [
            ("price", "AED", summary.get("price_median"), summary.get("n_price"), summary.get("price_q1"), summary.get("price_q3"),
             "All project sales in the publisher's trailing-12-month summary; transaction types, property mix and registration classes remain pooled."),
            ("price_per_sqft", "AED/sqft", summary.get("psf_median"), summary.get("n_psf"), summary.get("psf_q1"), summary.get("psf_q3"),
             "Built-home sale categories only under the publisher's methodology; property subtype and registration classes remain pooled."),
        ]
        for metric, unit, value, sample, q1, q3, metric_basis in summary_rows:
            if value is None:
                continue
            if not isinstance(value, (float, int)) or value <= 0 or not isinstance(sample, int) or sample < 50:
                quarantines.append({"slug": captured["slug"], "metric": metric, "reason": "metric value or source sample does not meet the project page threshold"})
                continue
            series_id = f"datadubai-project-{number}-20261008-{metric.replace('_', '-')}"
            native = {
                "publisherEntity": entity,
                "dldProjectNumber": int(number),
                "periodEnd": "2026-09",
                "windowStart": "2025-10",
                "windowEnd": "2026-09",
                "publishedDataThrough": page["through"],
                "publishedWindow": page["window"],
                "nAllRegisteredSales": summary.get("n"),
                "nPrice": summary.get("n_price"),
                "nPricePerSqft": summary.get("n_psf"),
                "offplanSharePct": summary.get("offplan_share"),
                "quality": summary.get("quality"),
                "captureSha256": captured["sha256"],
                "methodologyURL": page.get("methodology"),
                "metricBasis": metric_basis,
            }
            rows.append({
                "Series ID": series_id,
                "Record ID": record["id"],
                "Metric": metric,
                "Frequency": "rolling_12_months",
                "Unit": unit,
                "Class": "independent DLD-derived registered-sales aggregate",
                "Source ID": project_source_id,
                "Source URL": page["url"],
                "Published date": "2026-10-07",
                "Geography": entity,
                "Emirate": "Dubai",
                "Segment": "Project-level pooled aggregate; see observation basis for population limits.",
                "Label": f"Trailing 12 complete months · {EXPECTED_WINDOW}",
                "Registration": "All registered sale classes pooled",
                "Source area ID": "",
                "Endpoint": page["url"],
                "Period": "2026-09",
                "Value": value,
                "Sample rows": sample,
                "Quality": "publisher quality=ok; project page minimum sample=50; rolling 12-month aggregate, not a monthly observation",
                "P25": q1 or "",
                "P75": q3 or "",
                "Eligible value AED": "",
                "Gross yield pct": "",
                "Blocked rows": 0,
                "Raw source emirate": "Dubai",
                "Observation basis": metric_basis + " Window: 2025-10 through 2026-09. Period label marks the window end, not a single-month sample. Latest-vintage source first captured on 2026-10-08; unavailable to earlier backtests.",
                "Native row JSON": json.dumps(native, ensure_ascii=False, separators=(",", ":"), sort_keys=True),
                "Source observation ID": f"datadubai:{number}:{metric}:2025-10:2026-09",
                "Observation kind": "registered_sale_aggregate",
                "Transaction kind": "sale",
                "Procedure ID": "",
                "Procedure name": "",
            })
            links.append({"recordId": record["id"], "seriesId": series_id, "scope": "subject", "identityVerified": True,
                          "identityBasis": identity_basis, "identitySourceIds": identity_ids})
            eligible.append({"recordId": record["id"], "projectName": entity, "projectNumber": int(number), "metric": metric,
                             "sampleCount": sample, "value": value, "window": page["window"]})

    if len(seen_records) != len(manifest.get("pages", [])):
        raise SystemExit("One or more captured pages failed identity or period review; inspect quarantine before continuing.")
    args.out_history.parent.mkdir(parents=True, exist_ok=True)
    with args.out_history.open("wb") as out:
        with gzip.GzipFile(fileobj=out, mode="wb", mtime=0) as zipped:
            import io
            text = io.StringIO(newline="")
            writer = csv.DictWriter(text, fieldnames=FIELDS, lineterminator="\n")
            writer.writeheader()
            writer.writerows(rows)
            zipped.write(text.getvalue().encode("utf-8"))
    compressed = args.out_history.read_bytes()
    packet = {
        "schemaVersion": 1,
        "passId": PASS_ID,
        "asOf": "2026-10-08",
        "sources": sources,
        "historyInputs": [{
            "id": "datadubai-project-sales-summary-history",
            "path": args.out_history.name,
            "compression": "gzip",
            "sha256": sha(compressed),
            "uncompressedSHA256": sha(gzip.decompress(compressed)),
            "rowCount": len(rows),
            "sourceId": sources[0]["id"] if sources else None,
            "firstAvailableAt": manifest["retrievedAt"],
            "note": "One trailing-12-complete-month project aggregate per metric where available; window Oct 2025–Sep 2026. The month-end label is not a monthly observation; no earlier price path or lifetime history is implied.",
        }],
        "seriesLinks": links,
        "recordResearch": [],
        "additionalDatasets": [],
        "licensedArchives": [],
        "sourceCandidates": [],
        "collection": {
            "passId": PASS_ID,
            "publisher": "Dubai Data / Continental Club Property; underlying Dubai Land Department open data",
            "datasetVersion": SOURCE_DATASET_COMMIT,
            "sourceCsvSha256": PROJECTS_CSV_SHA256,
            "dataThrough": EXPECTED_THROUGH,
            "window": EXPECTED_WINDOW,
            "capturedAt": manifest["retrievedAt"],
            "catalogueRecordsAdded": len(seen_records),
            "priceSeriesAdded": sum(x["metric"] == "price" for x in eligible),
            "pricePerSqftSeriesAdded": sum(x["metric"] == "price_per_sqft" for x in eligible),
            "aggregatePointsAdded": len(rows),
            "rawTransactionsRedistributed": False,
            "quarantines": quarantines,
            "identityBasis": "Unique exact source project title to unique Espacios project title; DLD project number is unique in the pinned project register and retained in every point.",
            "completenessClaim": False,
        },
        "methodology": (
            "Dubai Data is an independent publisher, not a DLD product. It publishes aggregates derived from DLD open data under CC BY 4.0. "
            "The source's versioned methodology states that project transactions are joined by DLD project number, not name; project pages expose "
            "the project number, the full trailing-12-complete-month window, sample counts, and pooled medians. Espacios admitted only unique exact "
            "project-name matches with a unique pinned DLD project number and matching source page. Each value is labelled as a rolling 12-month "
            "aggregate ending 2026-09. It is not a monthly point, a same-unit repeat sale, a valuation, or evidence of appreciation. The source "
            "first became available to this research pass at retrieval on 2026-10-08, so no earlier backtest may use it. Off-plan share is retained as "
            "context only and is not used to adjust price. Individual transaction rows and identifiers are not republished."
        ),
        "review": {
            "sourcePageHashManifest": args.manifest.name,
            "sourcePageHashes": [{"recordId": x["recordId"], "url": x["url"], "sha256": x["sha256"], "bytes": x["bytes"]} for x in manifest["pages"]],
            "acceptedProjectMetrics": eligible,
        },
    }
    args.out_sidecar.write_text(json.dumps(packet, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n")
    print(json.dumps({"passId": PASS_ID, "projectRecords": len(seen_records), "priceSeries": packet["collection"]["priceSeriesAdded"],
                      "pricePerSqftSeries": packet["collection"]["pricePerSqftSeriesAdded"], "points": len(rows),
                      "quarantines": quarantines, "csvSha256": sha(compressed), "sidecar": str(args.out_sidecar)}))


if __name__ == "__main__":
    main()
