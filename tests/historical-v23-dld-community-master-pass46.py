import csv
import gzip
import hashlib
import io
import json
from pathlib import Path

BASE = Path("data/historical-intelligence")
sidecar_path = BASE / "dld-20261007-community-master-history-enrichment.json"
sidecar_bytes = sidecar_path.read_bytes()
sidecar = json.loads(sidecar_bytes)

assert sidecar["passId"] == "pass46-dld-community-master-sales-20261007"
assert sidecar["asOf"] == "2026-10-08"
assert hashlib.sha256(sidecar_bytes).hexdigest()
assert sidecar["collection"]["matchedExactDubaiCommunities"] == 44
assert sidecar["collection"]["uniqueSourceTransactionRowsSelected"] == 556639
assert sidecar["collection"]["uniqueTransactionIdsSelected"] == 556639
assert sidecar["collection"]["duplicateTransactionIdsDeduplicated"] == 0
assert sidecar["collection"]["priceFormulaChecks"] == 556640
assert sidecar["collection"]["priceFormulaDiscrepancies"] == 1
assert sidecar["collection"]["rawRowsAndTransactionIdsRedistributed"] is False
assert sidecar["collection"]["sourceObservationCoverage"] == {"start": "2004-08-12", "end": "2026-10-06"}

history_meta = sidecar["historyInputs"][0]
history_path = BASE / history_meta["path"]
compressed = history_path.read_bytes()
assert hashlib.sha256(compressed).hexdigest() == history_meta["sha256"]
raw = gzip.decompress(compressed)
assert hashlib.sha256(raw).hexdigest() == history_meta["uncompressedSHA256"]
rows = list(csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))))
assert len(rows) == history_meta["rowCount"] == 15196
assert len({(row["Series ID"], row["Period"]) for row in rows}) == len(rows)

links = {link["seriesId"]: link for link in sidecar["seriesLinks"]}
assert len(links) == 274
assert len({link["recordId"] for link in links.values()}) == 44
assert all(link["scope"] == "subject" and link["identityVerified"] is True for link in links.values())
assert all(link["identitySourceIds"] == ["dld-official-community-master-transactions-20261007"] for link in links.values())
assert all("does not assert a legal or wider geographic boundary" in link["identityBasis"] for link in links.values())
assert {row["Series ID"] for row in rows} == set(links)

for row in rows:
    sample = int(row["Sample rows"])
    assert sample > 0
    detail = json.loads(row["Native row JSON"])
    assert detail["minimumDisplaySample"] == 20
    assert detail["areaId"] == int(row["Source area ID"])
    assert detail["registrationDateBasis"] == "DLD instance_date"
    assert "transaction_id" not in detail
    if sample < 20:
        assert row["Value"] == row["P25"] == row["P75"] == ""
        assert detail["statisticPublished"] is False
    else:
        assert float(row["Value"]) > 0
        assert float(row["P25"]) > 0
        assert float(row["P75"]) > 0
        assert detail["statisticPublished"] is True

serialized = json.dumps(sidecar, ensure_ascii=False)
assert '"transaction_id"' not in serialized
assert '"transactionId"' not in serialized

manifest = json.loads((BASE / "publication-manifest.json").read_text())
assert manifest["version"] in {"20261008-enrichment-v23", "20261008-enrichment-v24", "20261008-enrichment-v25", "20261008-enrichment-v26", "20261008-enrichment-v27", "20261008-enrichment-v28", "20261008-enrichment-v29", "20261008-enrichment-v30"}
snapshot_path = Path(manifest["rootIndex"]["path"])
snapshot = json.loads(gzip.decompress(snapshot_path.read_bytes()))
assert snapshot["version"] in {"20261008-enrichment-v23", "20261008-enrichment-v24", "20261008-enrichment-v25", "20261008-enrichment-v26", "20261008-enrichment-v27", "20261008-enrichment-v28", "20261008-enrichment-v29", "20261008-enrichment-v30"}
assert len(snapshot["records"]) == 1860
assert sum(record["type"] == "project" for record in snapshot["records"]) == 1645
assert sum(record["type"] == "community" for record in snapshot["records"]) == 215
assert len(snapshot["events"]) == 105
assert len(snapshot["exposures"]) == 7382

linked_record_ids = {link["recordId"] for link in links.values()}
snapshot_records = {record["id"]: record for record in snapshot["records"]}
for record_id in linked_record_ids:
    record = snapshot_records[record_id]
    assert record["type"] == "community"
    sale_coverage = record["researchStatus"]["itemCoverage"]["registered_sale_history"]
    assert sale_coverage["status"] in {"present", "partial"}
    assert "dld-official-community-master-transactions-20261007" in sale_coverage["sourceIds"]
    assert record["researchStatus"]["itemCoverage"]["complete_registered_sale_history"]["status"] == "unestablished"

partial_sparse = {
    "community:Dubai:liwan",
    "community:Dubai:jumeirah-park",
}
assert partial_sparse.issubset(linked_record_ids)
for record_id in partial_sparse:
    coverage = snapshot_records[record_id]["researchStatus"]["itemCoverage"]["registered_sale_history"]
    assert coverage["status"] == "partial"
    assert coverage["nativePointCount"] == 0
    assert coverage["sparseNativePointCount"] > 0
    assert "no comparable price statistic is publishable" in coverage["reason"]

assert len(linked_record_ids) == 44
assert sum(snapshot_records[record_id]["researchStatus"]["itemCoverage"]["registered_sale_history"]["status"] == "present" for record_id in linked_record_ids) == 42

assert all(record["scenarioCoverage"].get("approvedAnnualPoints", 0) == 0 for record in snapshot["records"])
print("V23 community-master history pass46 checks passed")
