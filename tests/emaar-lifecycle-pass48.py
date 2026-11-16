#!/usr/bin/env python3
"""Validate released V48 Emaar primary lifecycle evidence without replaying a mutable snapshot."""
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKET_PATH = ROOT / "data/historical-intelligence/emaar-primary-lifecycle-pass48-20261014.json"
SNAPSHOT_PATH = ROOT / "data/historical-intelligence-20261003.json"
PUBLICATION_PATH = ROOT / "data/historical-intelligence/publication-manifest.json"
TERRA = "project:apartments-in-terra-heights-in-emaar-expo-living-expo-city-dubai"
PALACE = "project:palace-residences-dubai-hills-estate-emaar-properties"
ZABEEL = "project:address-residences-zabeel-by-emaar-properties-in-zaabeel-dubai"
V48_SOURCE_IDS = {
    "emaar48-expo-living-terra-heights",
    "emaar48-palace-residences-sales-report",
    "emaar48-h1-2024-rally",
}


def identifiers(value):
    found = set()
    if isinstance(value, list):
        for item in value:
            found.update(identifiers(item))
    elif isinstance(value, dict):
        source_id = value.get("sourceId")
        if isinstance(source_id, str):
            found.add(source_id)
        source_ids = value.get("sourceIds")
        if isinstance(source_ids, list):
            found.update(item for item in source_ids if isinstance(item, str))
        for item in value.values():
            found.update(identifiers(item))
    return found


class EmaarLifecyclePass48Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.snapshot = json.loads(SNAPSHOT_PATH.read_text())
        cls.publication = json.loads(PUBLICATION_PATH.read_text())
        cls.packet = json.loads(PACKET_PATH.read_text())
        assert cls.snapshot["version"] == cls.publication["version"] == cls.packet["candidateVersion"] == "20261014-enrichment-v48"
        cls.records = {record["id"]: record for record in cls.snapshot["records"]}
        cls.sources = {source["id"]: source for source in cls.snapshot["sources"]}
        cls.packet_facts = {fact["id"]: fact for fact in cls.packet["facts"]}

    def test_primary_sources_are_pinned_and_availability_is_separate(self):
        packet = self.packet
        self.assertEqual(len(packet["sources"]), 3)
        self.assertEqual(len(packet["facts"]), 5)
        self.assertEqual(packet["collection"], {
            "asOf": "2026-10-14",
            "acceptedLifecycleFacts": 5,
            "verifiedLaunchFacts": 1,
            "reportedLaunchWindows": 1,
            "developerSalesStatusReports": 3,
            "newFinancialObservations": 0,
            "newSources": 3,
            "rawBodiesRedistributed": False,
        })
        self.assertTrue(packet["preserveExistingFinancialCoverage"])
        self.assertEqual({source["id"] for source in packet["sources"]}, V48_SOURCE_IDS)
        for source in packet["sources"]:
            self.assertEqual(self.sources[source["id"]], source)
            self.assertTrue(source["url"].startswith("https://www.emaar.com/"))
            self.assertEqual(len(source["sha256"]), 64)
            self.assertTrue(source["publishedAt"] < source["firstAvailableAt"][:10])
            self.assertFalse(source["rawBodyRedistributed"])
            self.assertIn("First locally retained", source["availabilityBasis"])

    def test_exact_identity_gates_and_record_scope(self):
        checks = {check["recordId"]: check for check in self.packet["recordIdentityChecks"]}
        self.assertEqual(set(checks), {TERRA, PALACE, ZABEEL})
        for fact in self.packet["facts"]:
            self.assertIn(fact["recordId"], checks)
            self.assertTrue(fact["identityVerified"])
            self.assertEqual(fact["scope"], "subject")
            self.assertTrue(fact["primaryEvidence"])
            self.assertTrue(fact["identitySourceIds"])
        self.assertEqual(self.packet["facts"][0]["date"], {"start": "2024-11-14", "precision": "day"})
        self.assertEqual(self.packet["facts"][1]["date"], {"start": "2024-05-15", "end": "2024-05-17", "precision": "range"})
        self.assertEqual(self.packet["facts"][1]["verification"], "reported")

    def test_exact_lifecycle_facts_are_present_only_on_the_three_targets(self):
        found = {}
        for record in self.snapshot["records"]:
            facts = [fact for fact in record.get("lifecycle", []) if str(fact.get("id", "")).startswith("emaar48-")]
            if facts:
                found[record["id"]] = facts
        self.assertEqual(set(found), {TERRA, PALACE, ZABEEL})
        self.assertEqual({fact["id"] for facts in found.values() for fact in facts}, set(self.packet_facts))
        for record_id, facts in found.items():
            expected = {fact["id"] for fact in self.packet["facts"] if fact["recordId"] == record_id}
            self.assertEqual({fact["id"] for fact in facts}, expected)
            self.assertTrue(all(fact.get("eventStatus") != "actual" for fact in facts))
            self.assertTrue(all(fact.get("kind") not in {"completion", "actual_completion", "handover", "occupancy", "delivery"} for fact in facts))
        self.assertEqual(sum(1 for record in self.snapshot["records"] for fact in record.get("lifecycle", []) if str(fact.get("id", "")).startswith("dld47-")), 15)

    def test_lifecycle_sources_are_not_promoted_to_financial_evidence(self):
        for record_id in (TERRA, PALACE, ZABEEL):
            record = self.records[record_id]
            financial = [
                record.get("observations", []), record.get("historySeries", []), record.get("currentSnapshot"),
                record.get("priorCurrentSnapshots", []), record.get("scenarioInputs", []), record.get("scenarioCoverage", {}),
            ]
            self.assertFalse(identifiers(financial) & V48_SOURCE_IDS, record_id)

    def test_ledger_and_scenarios_remain_explicitly_incomplete(self):
        statuses = {}
        for record in self.snapshot["records"]:
            coverage = record["researchStatus"]["itemCoverage"]
            self.assertEqual(len(coverage), 23)
            self.assertEqual(coverage["complete_registered_sale_history"]["status"], "unestablished")
            self.assertEqual(coverage["complete_signed_rent_history"]["status"], "unestablished")
            self.assertEqual(record["scenarioCoverage"]["lastYear"], 2080)
            for value in coverage.values():
                statuses[value["status"]] = statuses.get(value["status"], 0) + 1
        self.assertEqual(statuses, {"present": 3352, "partial": 3404, "missing": 26724, "unestablished": 9300})
        self.assertEqual(self.snapshot["manifest"]["approved2080ForecastRecords"], 0)


if __name__ == "__main__":
    unittest.main()
