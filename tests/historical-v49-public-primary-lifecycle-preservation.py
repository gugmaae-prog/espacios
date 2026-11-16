#!/usr/bin/env python3
"""Prove immutable V49 adds only reviewed PJA/AYA lifecycle evidence to V48."""
import copy
import gzip
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OBJECTS = ROOT / "data" / "historical-intelligence" / "objects"
V48_ROOT = "ca1133d5169abc0bc2aec24eb193719018e47a3e9d06c773a951b9cc9a7424a0"
V49_ROOT = "ad181fc0413731a3d3d8b720e442ab92934ce43bdf97551131b2e4a916ed8aae"
V48 = "20261014-enrichment-v48"
V49 = "20261116-enrichment-v49"
PACKET = ROOT / "data" / "historical-intelligence" / "public-primary-lifecycle-pass49-20261116.json"

PJA = "project:the-beach-collection-by-nakheel-properties-on-palm-jebel-ali"
AYA = "project:apartments-aya-deyaar-umm-al-quwain"
CHANGED = {PJA, AYA}


def unpack(checksum):
    return json.loads(gzip.decompress((OBJECTS / f"{checksum}.json.gz").read_bytes()))


def canonical(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode()


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def without_partition(series):
    value = copy.deepcopy(series)
    value.pop("partition", None)
    return value


def main():
    before, current = unpack(V48_ROOT), unpack(V49_ROOT)
    packet = json.loads(PACKET.read_text())
    check(before["version"] == V48 and current["version"] == V49, "Immutable release versions differ.")
    check(before["asOf"] == "2026-10-14" and current["asOf"] == "2026-11-16", "V49 cutoff differs.")
    check(packet["priorVersion"] == V48 and packet["candidateVersion"] == V49, "Packet lineage differs.")
    check(packet["priorSHA256"] == "bbb7c8037a11221e94843d6be0882d073a9fea7550aa0748435c9a806e89ecc7", "Packet prior snapshot checksum differs.")
    check(packet["preserveExistingFinancialCoverage"] is True, "V49 does not preserve financial coverage.")
    check(packet["collection"]["newFinancialObservations"] == 0, "V49 claims financial observations.")
    check(len(packet["sources"]) == 3 and len(packet["facts"]) == 5, "Unexpected V49 packet scope.")
    check({fact["recordId"] for fact in packet["facts"]} == CHANGED, "Unexpected V49 target records.")
    check(all(fact["kind"] == "lifecycle" and fact["status"] == "accepted" for fact in packet["facts"]), "V49 contains a non-lifecycle fact.")

    old_sources, new_sources = before["sources"], current["sources"]
    check(len(old_sources) == 3371 and len(new_sources) == 3374, "Unexpected V49 source count.")
    check(new_sources[:len(old_sources)] == old_sources, "V49 changed retained source metadata.")
    new_ids = {source["id"] for source in new_sources[len(old_sources):]}
    expected_sources = {source["id"] for source in packet["sources"]}
    check(new_ids == expected_sources, "V49 source identities differ from packet.")
    for source in new_sources[len(old_sources):]:
        check(source["url"].startswith("https://"), f"V49 source is not HTTPS: {source['id']}")
        check(source["rawBodyRedistributed"] is False, f"V49 source redistributes raw content: {source['id']}")
        check(source["retrievedAt"][:10] <= current["asOf"], f"V49 source is retrieved after cutoff: {source['id']}")
    check(before["events"] == current["events"] and before["exposures"] == current["exposures"], "V49 changed event or exposure evidence.")

    old_records = {record["id"]: record for record in before["records"]}
    new_records = {record["id"]: record for record in current["records"]}
    check(set(old_records) == set(new_records) and len(new_records) == 1860, "Record identity/count changed.")
    check(sum(record["type"] == "project" for record in new_records.values()) == 1645, "Project count changed.")
    check(sum(record["type"] == "community" for record in new_records.values()) == 215, "Community count changed.")
    for record_id, old in old_records.items():
        new = new_records[record_id]
        if record_id not in CHANGED:
            check(old == new, f"Unrelated record changed: {record_id}")
            continue
        for key in ["observations", "currentSnapshot", "scenarioInputs", "scenarioCoverage", "historySeriesIds", "registerEvidence", "priorCurrentSnapshots"]:
            check(new.get(key) == old.get(key), f"V49 changed non-lifecycle data for {record_id}: {key}")
        check(new["lifecycle"][:len(old["lifecycle"])] == old["lifecycle"], f"V49 rewrote prior lifecycle evidence for {record_id}")
        additions = new["lifecycle"][len(old["lifecycle"]):]
        expected = {fact["id"] for fact in packet["facts"] if fact["recordId"] == record_id}
        check({item["id"] for item in additions} == expected, f"Unexpected V49 lifecycle additions for {record_id}")
        check(all(item["primaryEvidence"] and item["scope"] == "subject" for item in additions), f"V49 weakened primary subject scope for {record_id}")

    pja = new_records[PJA]
    pja_by_id = {item["id"]: item for item in pja["lifecycle"]}
    check(pja_by_id["pja49-beach-collection-release-20241111"]["kind"] == "phase_announcement", "PJA release uses the wrong lifecycle class.")
    check(pja_by_id["pja49-beach-collection-release-20241111"]["date"] == {"start": "2024-11-11", "precision": "day"}, "PJA release date differs.")
    pja_target = pja_by_id["pja49-beach-first-residences-target-20241111"]
    check(pja_target["kind"] == "target_completion" and pja_target["eventStatus"] == "planned", "PJA target was relabelled as actual.")
    check(pja_target["date"] == {"start": "2027-07-01", "end": "2027-12-31", "precision": "range"}, "PJA planned target interval differs.")
    check(any(item["id"] == "fact-829e8112b8151729864b6298" and item["date"]["start"] == "2029-Q4" for item in pja["lifecycle"]), "V49 removed the competing Q4 2029 catalogue target.")
    check(all(item["kind"] != "completion" or item["eventStatus"] != "actual" for item in pja["lifecycle"] if item["id"].startswith("pja49-")), "V49 invented actual PJA completion.")

    aya = new_records[AYA]
    aya_by_id = {item["id"]: item for item in aya["lifecycle"]}
    construction = aya_by_id["aya49-fy2025-construction-status"]
    target = aya_by_id["aya49-fy2025-target-completion"]
    sales = aya_by_id["aya49-fy2025-sales-status"]
    check(construction["kind"] == "construction_confirmation" and construction["status"] == "reported", "AYA construction status was overstated.")
    check(target["kind"] == "target_completion" and target["eventStatus"] == "planned", "AYA target was relabelled as actual.")
    check(target["date"] == {"start": "2027-07-01", "end": "2027-12-31", "precision": "range"}, "AYA H2 target interval differs.")
    check(sales["kind"] == "developer_sales_status_report", "AYA aggregate table has wrong lifecycle class.")
    check("not individual registered transactions" in sales["note"], "AYA aggregate sales disclosure lacks non-transaction limitation.")
    check(aya["researchStatus"]["itemCoverage"]["construction"]["status"] == "present", "AYA construction evidence did not become visible.")
    check(aya["researchStatus"]["itemCoverage"]["registered_sale_history"]["status"] == "missing", "AYA developer sales status became registered sales evidence.")
    check(aya["researchStatus"]["itemCoverage"]["signed_rent_history"]["status"] == "missing", "AYA lifecycle facts became rent evidence.")

    for record in new_records.values():
        coverage = record["researchStatus"]["itemCoverage"]
        check(coverage["complete_registered_sale_history"]["status"] == "unestablished", f"Complete sale history falsely claimed for {record['id']}")
        check(coverage["complete_signed_rent_history"]["status"] == "unestablished", f"Complete rent history falsely claimed for {record['id']}")
        scenario = record["scenarioCoverage"]
        check(scenario["firstYear"] == 2027 and scenario["lastYear"] == 2080 and scenario["approvedAnnualPoints"] == 0, f"Scenario evidence changed for {record['id']}")

    old_series = {series["id"]: series for series in before["series"]}
    new_series = {series["id"]: series for series in current["series"]}
    check(set(old_series) == set(new_series) and len(new_series) == 16872, "Native series identity changed.")
    check(all(canonical(without_partition(old_series[key])) == canonical(without_partition(new_series[key])) for key in old_series), "Native series metadata changed.")
    pairs = {(old_series[key]["partition"]["sha256"], new_series[key]["partition"]["sha256"]) for key in old_series}
    check(len(pairs) == 1091, "Unexpected native partition mapping.")
    decoded = 0
    for old_sha, new_sha in pairs:
        old_payload = gzip.decompress((OBJECTS / f"{old_sha}.json.gz").read_bytes())
        new_payload = gzip.decompress((OBJECTS / f"{new_sha}.json.gz").read_bytes())
        decoded += len(old_payload) + len(new_payload)
        old_archive = json.loads(old_payload)
        new_archive = json.loads(new_payload)
        check(old_archive["version"] == V48 and old_archive["asOf"] == "2026-10-14", f"V48 archive envelope differs: {old_sha}")
        check(new_archive["version"] == V49 and new_archive["asOf"] == "2026-11-16", f"V49 archive envelope differs: {new_sha}")
        old_archive["version"] = V49
        old_archive["asOf"] = "2026-11-16"
        check(canonical(old_archive) == canonical(new_archive), f"Native payload changed: {old_sha}")

    check(before["manifest"]["historicalObservationRows"] == current["manifest"]["historicalObservationRows"] == 633891, "Historical row count changed.")
    check(before["manifest"]["historicalSeriesCount"] == current["manifest"]["historicalSeriesCount"] == 16872, "Historical series count changed.")
    print(json.dumps({
        "passed": True,
        "version": V49,
        "rootSHA256": V49_ROOT,
        "records": len(new_records),
        "sources": len(new_sources),
        "newLifecycleFacts": len(packet["facts"]),
        "financialObservationsAdded": 0,
        "series": len(new_series),
        "partitionPairs": len(pairs),
        "decodedBytes": decoded,
        "payloadVersionOnly": True,
        "ledger": {status: sum(item["status"] == status for record in new_records.values() for item in record["researchStatus"]["itemCoverage"].values()) for status in ["present", "partial", "missing", "unestablished"]},
    }))


if __name__ == "__main__":
    main()
