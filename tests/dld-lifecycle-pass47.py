import hashlib
import json
import unittest
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKET = ROOT / "data/historical-intelligence/dld-lifecycle-pass47-20261013.json"


class LifecyclePacket(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.packet = json.loads(PACKET.read_text())

    def test_scope_and_financial_separation(self):
        packet = self.packet
        self.assertEqual(packet["priorVersion"], "20261013-enrichment-v46")
        self.assertEqual(packet["priorRootSHA256"], "9912e0a2c673160168f5f223ec67c482e230db5bca51a532d4fe0d2e64eea672")
        self.assertEqual(len(packet["recordIdentityChecks"]), 5)
        self.assertEqual(len({fact["recordId"] for fact in packet["facts"]}), 5)
        self.assertEqual(Counter(fact["milestone"] for fact in packet["facts"]), {
            "registration": 5,
            "construction_progress": 5,
            "authority_status_snapshot": 5,
        })
        self.assertEqual(packet["financialObservationsAdded"], 0)
        self.assertEqual(len(packet["sources"]), 1)
        self.assertTrue(all(fact["kind"] == "lifecycle" for fact in packet["facts"]))

    def test_identity_dates_and_source_availability(self):
        packet = self.packet
        input_packet = packet["inputPackets"][0]
        self.assertEqual(hashlib.sha256((ROOT / input_packet["path"]).read_bytes()).hexdigest(), input_packet["sha256"])
        checks = {check["recordId"]: check for check in packet["recordIdentityChecks"]}
        sources = {source["id"]: source for source in packet["sources"]}
        for fact in packet["facts"]:
            check = checks[fact["recordId"]]
            self.assertEqual(fact["identitySourceIds"], check["sourceIds"])
            self.assertTrue(fact["identityVerified"])
            self.assertEqual(fact["scope"], "subject")
            self.assertIn(fact["sourceId"], sources)
            self.assertLessEqual(fact["firstAvailableAt"][:10], packet["asOf"])
            self.assertEqual(fact["date"]["precision"], "day")
            self.assertIn(f"dld47-{check['authorityProjectNumber']}-", fact["id"])
            self.assertLessEqual(fact["date"]["start"], packet["asOf"])

    def test_existing_fields_are_reconciled_not_duplicated(self):
        packet = self.packet
        self.assertEqual(len(packet["reconciledExistingLifecycle"]), 5)
        self.assertTrue(all("no duplicate fact" in item["reconciliation"].lower() for item in packet["reconciledExistingLifecycle"]))
        self.assertEqual(len(packet["quarantinedFields"]), 2)

    def test_status_is_not_completion_or_occupancy(self):
        facts = self.packet["facts"]
        prohibited = {"completion", "actual_completion", "handover", "occupancy", "delivery"}
        self.assertFalse(any(fact["milestone"] in prohibited for fact in facts))
        self.assertTrue(all("does not establish" in fact["note"].lower() for fact in facts if fact["milestone"] in {"construction_progress", "authority_status_snapshot"}))


if __name__ == "__main__":
    unittest.main()
