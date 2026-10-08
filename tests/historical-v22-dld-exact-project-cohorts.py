#!/usr/bin/env python3
"""Verify the reviewed DLD eight-project history supplement and its limits."""
import csv
import gzip
import hashlib
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "data/historical-intelligence"
SIDECAR = json.loads((BASE / "dld-20261007-eight-project-sales-enrichment.json").read_text())
INPUT = SIDECAR["historyInputs"][0]
compressed = (BASE / INPUT["path"]).read_bytes()
raw = gzip.decompress(compressed)
assert hashlib.sha256(compressed).hexdigest() == INPUT["sha256"]
assert hashlib.sha256(raw).hexdigest() == INPUT["uncompressedSHA256"]
rows = list(csv.DictReader(raw.decode("utf-8").splitlines()))
assert len(rows) == INPUT["rowCount"] == 237
assert len(SIDECAR["recordResearch"]) == 8
assert len(SIDECAR["seriesLinks"]) == 18
assert len({x["seriesId"] for x in SIDECAR["seriesLinks"]}) == 18
assert len({x["recordId"] for x in SIDECAR["seriesLinks"]}) == 8
assert SIDECAR["collection"]["sourceRowsSelected"] == 2067
assert SIDECAR["collection"]["uniqueTransactionIdsSelected"] == 2067
assert SIDECAR["collection"]["duplicateTransactionIds"] == 0
assert SIDECAR["collection"]["priceFormulaChecks"] == 2067
assert SIDECAR["collection"]["priceFormulaDiscrepancies"] == 0
assert SIDECAR["collection"]["aggregateCellsByFrequency"] == {"month": 164, "quarter": 73}
assert SIDECAR["collection"]["sparseCellsWithheldMedian"] == 183
assert SIDECAR["collection"]["cellsMeetingMinimum"] == 54
assert SIDECAR["collection"]["rawRowsAndTransactionIdsRedistributed"] is False

by_frequency = defaultdict(list)
by_project_frequency = defaultdict(int)
for row in rows:
    by_frequency[row["Frequency"]].append(row)
    project_number = json.loads(row["Native row JSON"])["projectNumber"]
    by_project_frequency[(project_number, row["Frequency"])] += int(row["Sample rows"])
    assert row["Metric"] == "median_sale_aed_sqft"
    assert row["Unit"] == "AED/sqft"
    assert row["Source ID"] == "dld-official-transactions-20261007"
    assert row["Scope"] == "subject"
    assert "instance_date is registration date" in row["Observation basis"]
    assert row["Period"] <= "2026-10" if row["Frequency"] == "month" else row["Period"] <= "2026-Q4"
    native = json.loads(row["Native row JSON"])
    assert "transaction_id" not in native and "unit_number" not in native
    count = int(row["Sample rows"])
    if count >= 20:
        assert float(row["Value"]) > 0
        assert float(row["P25"]) > 0 and float(row["P75"]) > 0
        assert float(row["P25"]) <= float(row["Value"]) <= float(row["P75"])
    else:
        assert row["Value"] == row["P25"] == row["P75"] == ""
        assert "median withheld" in row["Quality"]
for frequency, expected_rows in [("month", 164), ("quarter", 73)]:
    assert len(by_frequency[frequency]) == expected_rows
    assert sum(int(row["Sample rows"]) for row in by_frequency[frequency]) == 2067
assert set(by_frequency) == {"month", "quarter"}
for project in {json.loads(x["Native row JSON"])["projectNumber"] for x in rows}:
    assert by_project_frequency[(project, "month")] == by_project_frequency[(project, "quarter")]

current = json.loads((BASE / "../historical-intelligence-20261003.json").read_text())
records = {row["id"]: row for row in current["records"]}
assert current["manifest"]["directSubjectSaleHistoryRecords"] == sum(
    row["researchStatus"]["itemCoverage"]["registered_sale_history"]["status"] == "present"
    for row in current["records"]
)
assert current["manifest"]["directSubjectRentHistoryRecords"] == sum(
    row["researchStatus"]["itemCoverage"]["signed_rent_history"]["status"] == "present"
    for row in current["records"]
)
source_ids = {x["id"] for x in SIDECAR["sources"]}
assert "dld-official-transactions-20261007" in source_ids
assert SIDECAR["sources"][0]["revisionOfSourceId"] == "dld-official-transactions-20261003"
assert SIDECAR["sources"][0]["publishedAt"] is None
assert SIDECAR["sources"][0]["firstAvailableAt"] == "2026-10-08T02:17:55Z"
assert "publication time not independently established" in SIDECAR["sources"][0]["publicationDateStatus"]
for review in SIDECAR["recordResearch"]:
    original = review["collectionPasses"][0]["initialIdentityCandidateCount"]
    identity_review = review["identityReview"]
    assert identity_review["resolvedCandidateCount"] == 1
    assert identity_review["remainingCandidateCount"] == original - 1
    assert identity_review["resolvedCandidateCount"] + identity_review["remainingCandidateCount"] == original
    assert identity_review["status"] == "verified_exact_name_developer_and_area"
    assert records[review["recordId"]]["researchStatus"]["identityCandidateCount"] == identity_review["remainingCandidateCount"]
    assert {"dld-official-projects-20260706", "dld-official-developers-20261001", "dld-official-areas-20261002"}.issubset(identity_review["identitySourceIds"])
    research = review["collectionPasses"][0]
    assert research["eligibleTransactionRows"] == by_project_frequency[(research["registeredProjectNumber"], "month")]
    assert research["fullHistoryClaim"] is False
    assert research["sourcePublicationDate"] == "unknown"

text = raw.decode("utf-8")
assert "transaction_id" not in text
assert "unit_number" not in text
assert "transaction IDs" in SIDECAR["methodology"]
assert "complete or earliest-ever price history" in SIDECAR["methodology"]
print(json.dumps({"passed": True, "projects": 8, "uniqueTransactions": 2067, "monthlyCells": 164, "quarterlyCells": 73, "priceStatisticCells": 54, "sparseCells": 183}, sort_keys=True))
