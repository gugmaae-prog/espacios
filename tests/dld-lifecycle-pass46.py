import hashlib
import json
import unittest
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKET = ROOT / "data/historical-intelligence/dld-lifecycle-pass46-20261013.json"


class LifecyclePacket(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.packet = json.loads(PACKET.read_text())

    def test_scope_and_financial_separation(self):
        packet = self.packet
        self.assertEqual(packet["priorVersion"], "20261013-enrichment-v45")
        self.assertEqual(packet["priorRootSHA256"], "1c17824d39f4399e1fb1088bb52c2a0e761cb2e935286c617e25c883b4afa2c0")
        self.assertEqual(len(packet["recordIdentityChecks"]), 9)
        self.assertEqual(len({fact["recordId"] for fact in packet["facts"]}), 9)
        self.assertEqual(Counter(fact["milestone"] for fact in packet["facts"]), {
            "registration": 8,
            "filed_project_start": 8,
            "target_completion": 5,
            "construction_progress": 9,
            "authority_status_snapshot": 9,
        })
        self.assertEqual(packet["financialObservationsAdded"], 0)
        self.assertEqual(len(packet["sources"]), 2)
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
            self.assertIn(f"dld46-{check['authorityProjectNumber']}-", fact["id"])
        self.assertTrue(all(fact["eventStatus"] == "planned" for fact in packet["facts"] if fact["milestone"] == "target_completion"))
        self.assertTrue(all(fact["date"]["start"] <= packet["asOf"] for fact in packet["facts"] if fact["milestone"] != "target_completion"))

    def test_status_is_not_completion_or_occupancy(self):
        facts = self.packet["facts"]
        avenue = [fact for fact in facts if fact["recordId"] == "project:binghatti-avenue-apartments-for-sale-in-al-jaddaf-dubai"]
        self.assertEqual({fact["milestone"] for fact in avenue}, {"construction_progress", "authority_status_snapshot"})
        self.assertEqual(next(fact["progressPercent"] for fact in avenue if fact["milestone"] == "construction_progress"), 100.0)
        prohibited = {"completion", "actual_completion", "handover", "occupancy", "delivery"}
        self.assertFalse(any(fact["milestone"] in prohibited for fact in facts))
        self.assertTrue(all("does not establish" in fact["note"].lower() for fact in facts if fact["milestone"] in {"construction_progress", "authority_status_snapshot"}))


if __name__ == "__main__":
    unittest.main()
