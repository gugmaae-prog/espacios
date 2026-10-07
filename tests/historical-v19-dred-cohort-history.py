#!/usr/bin/env python3
"""Verify the retained V19 DRED cohort extract against its catalogue snapshot."""

import csv
import gzip
import hashlib
import json
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/historical-intelligence"
SOURCE_ID = "v19-dred-sales-20261005"
DATE_BASIS = (
    "DLD instance_date: registration date; not asserted to be contract execution, "
    "transfer, or first-sale date."
)


def fail(condition, message):
    if not condition:
        raise AssertionError(message)


def main():
    packet = json.loads((ROOT / "enrichment/v19/pass43-dred-cohort-history.json").read_text())
    source = packet["collection"]["seriesInput"]
    source_path = DATA / source["path"]
    payload = source_path.read_bytes()
    fail(hashlib.sha256(payload).hexdigest() == source["compressedSHA256"], "filtered source checksum mismatch")

    row_kinds = Counter()
    transaction_record_types = Counter()
    transaction_ids = Counter()
    record_transaction_pairs = set()
    monthly_values = Counter()
    monthly_samples = Counter()
    dates = []
    project_records = set()
    community_records = set()
    with gzip.open(source_path, "rt", newline="", encoding="utf-8") as stream:
        for row in csv.DictReader(stream):
            kind = row["Observation kind"]
            row_kinds[kind] += 1
            record_id = row["Record ID"]
            record_type = record_id.split(":", 1)[0]
            if kind == "transaction":
                transaction_record_types[record_type] += 1
                native = json.loads(row["Native row JSON"])
                transaction_id = row["Source observation ID"]
                fail(bool(transaction_id), "native transaction row is missing its source transaction ID")
                fail(transaction_id == native["transactionId"], "native transaction ID does not match its source ID")
                fail(native["recordId"] == record_id, "transaction row does not match its catalogue record")
                fail(native["recordScope"] == "subject", "transaction row is not linked to a subject record")
                fail(native["qualityFlags"] == 0, "transaction row has a nonzero quality flag")
                fail(native["usage"] == "Residential", "transaction row is not residential")
                fail(native["instanceDate"] == row["Period"], "transaction period is not the native registration date")
                fail(native["observationDateBasis"] == DATE_BASIS, "transaction date precision/basis was not preserved")
                fail(int(native["procedureId"]) in (11, 41, 102), "unexpected sale procedure")
                fail(row["Transaction kind"] == "sale", "transaction is not classified as a sale")
                pair = (record_id, transaction_id)
                fail(pair not in record_transaction_pairs, "duplicate transaction link within one catalogue record")
                record_transaction_pairs.add(pair)
                transaction_ids[transaction_id] += 1
                dates.append(row["Period"])
                if record_type == "project":
                    project_records.add(record_id)
                    fail(native["sourceProjectName"] and native["sourceAreaId"], "project row lacks exact-name/area identity evidence")
                    fail(native["propertyType"] == "Unit" and native["propertySubtype"] == "Flat", "project row falls outside the strict Flat cohort")
                    fail(row["Segment"] == "Residential | Unit | native subtype: Flat", "project row falls outside the strict Flat cohort")
                elif record_type == "community":
                    community_records.add(record_id)
                    fail(native["sourceAreaName"] and native["sourceAreaId"], "community row lacks area identity evidence")
                    fail(
                        (native["propertyType"] == "Unit" and native["propertySubtype"] == "Flat")
                        or (native["propertyType"] == "Villa" and native["propertySubtype"] in (None, "Villa")),
                        "community row falls outside the accepted Unit/Flat or Villa cohort",
                    )
                else:
                    fail(False, f"unexpected catalogue record type: {record_type}")
            elif kind == "aggregate":
                sample = int(row["Sample rows"])
                monthly_samples["eligible" if sample >= 20 else "sparse"] += 1
                monthly_values["published" if row["Value"] else "withheld"] += 1
                fail(row["Frequency"] == "monthly", "aggregate row is not a monthly cohort summary")
            else:
                fail(False, f"unexpected observation kind: {kind}")

    fail(row_kinds == {"transaction": 209291, "aggregate": 6803}, f"source row counts changed: {row_kinds}")
    fail(transaction_record_types == {"project": 74578, "community": 134713}, f"record-linked row counts changed: {transaction_record_types}")
    fail(len(project_records) == 158 and len(community_records) == 6, "wrong catalogue identity coverage")
    fail(len(transaction_ids) == 198197, "unique transaction-ID count changed")
    fail(sum(count - 1 for count in transaction_ids.values()) == 11094, "new cross-level transaction overlap count changed")
    fail(monthly_samples == {"eligible": 1802, "sparse": 5001}, f"monthly sample gates changed: {monthly_samples}")
    fail(monthly_values == {"published": 1802, "withheld": 5001}, f"monthly median withholding changed: {monthly_values}")
    fail(min(dates) == "1997-12-15" and max(dates) <= "2026-10-05", "native transaction date bounds changed")

    snapshot = json.loads((ROOT / "data/historical-intelligence-20261003.json").read_text())
    manifest = json.loads((DATA / "publication-manifest.json").read_text())
    fail(len(snapshot["records"]) == 1860, "catalogue record count changed")
    fail(snapshot["manifest"]["approved2080ForecastRecords"] == 0, "unverified 2080 forecasts were added")
    transaction_series = []
    monthly_series = []
    for record in snapshot["records"]:
        for series in record.get("historySeries", []):
            if series.get("sourceId") != SOURCE_ID:
                continue
            if series.get("observationKind") == "transaction":
                transaction_series.append(series)
            elif series.get("observationKind") == "aggregate" and series.get("frequency") == "monthly":
                monthly_series.append(series)
    fail(sum(series.get("pointCount", 0) for series in transaction_series) == 209291, "runtime transaction series do not cover all source rows")
    fail(sum(series.get("pointCount", 0) for series in monthly_series) == 6803, "runtime monthly series do not cover all source summaries")
    fail(manifest["runtime"]["nativePartitionMaximumDecodedBytes"] < 32 * 1024 * 1024, "runtime history partition exceeds the Worker decode limit")
    print(
        "V19 DRED verified: 209,291 transaction links / 198,197 new IDs; "
        "6,803 monthly summaries (1,802 published, 5,001 sparse); "
        "158 projects + 6 communities; runtime partitions within 32 MiB."
    )


if __name__ == "__main__":
    main()
