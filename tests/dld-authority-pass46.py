import hashlib
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUTHORITY = ROOT / "data/historical-intelligence/dld-authority-pass46-20261013.json"
SNAPSHOT = ROOT / "data/historical-intelligence-20261003.json"


class AuthorityPacket(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.packet = json.loads(AUTHORITY.read_text())
        cls.snapshot = json.loads(SNAPSHOT.read_text())

    def test_bounded_exact_crosswalk(self):
        packet = self.packet
        self.assertEqual(packet["passId"], "dld-authority-pass46-20261013")
        self.assertEqual(packet["asOf"], "2026-10-13")
        self.assertEqual(len(packet["records"]), 9)
        self.assertEqual(len(packet["recordIdentityChecks"]), 9)
        self.assertEqual(len({row["recordId"] for row in packet["records"]}), 9)
        source_ids = {source["id"] for source in packet["sources"]}
        self.assertEqual(source_ids, {"dld46-public-project-status-20261013", "dld46-public-project-status-binghatti-avenue-20261013"})
        records = {record["id"]: record for record in self.snapshot["records"]}
        for row, check in zip(packet["records"], packet["recordIdentityChecks"]):
            self.assertEqual(row["recordId"], check["recordId"])
            self.assertIn(row["recordId"], records)
            self.assertEqual(records[row["recordId"]]["name"], check["catalogueName"])
            self.assertEqual(row["projectNumber"], check["authorityProjectNumber"])
            self.assertEqual(str(row["dldProjectId"]), check["authorityProjectId"])
            self.assertEqual(row["developerNumber"], check["authorityDeveloperNumber"])
            self.assertEqual(row["areaId"], check["authorityAreaId"])
            self.assertTrue(check["sourceIds"])

    def test_invalid_completion_literals_stay_quarantined(self):
        quarantined = self.packet["quarantinedFields"]
        self.assertEqual(len(quarantined), 3)
        self.assertTrue(all(item["raw"] == "01/01/1" for item in quarantined))
        invalid = {item["recordId"] for item in quarantined}
        self.assertEqual(invalid, {
            "project:sobha-one-apartments-for-sale-in-dubai",
            "project:address-residences-zabeel-by-emaar-properties-in-zaabeel-dubai",
            "project:binghatti-hills-by-binghatti-properties-in-dubai-science-park",
        })
        for row in self.packet["records"]:
            if row["recordId"] in invalid:
                self.assertIsNone(row["validScheduledCompletion"])

    def test_capture_provenance_is_limited_and_checksummed(self):
        captures = self.packet["sourceCaptures"]
        self.assertEqual(len(captures), 2)
        for capture in captures:
            self.assertFalse(capture["rawCaptureRedistributed"])
            self.assertEqual(len(capture["captureSHA256"]), 64)
            self.assertEqual(len(capture["canonicalPayloadSHA256"]), 64)
            self.assertGreater(capture["bytes"], 0)
        for source in self.packet["sources"]:
            self.assertTrue(source["primaryEvidence"])
            self.assertTrue(source["preserveRevision"])
            self.assertEqual(source["revisionOfSourceId"], "dld41-public-project-status-20261012")
            self.assertFalse(source["rawCaptureRedistributed"])
            self.assertTrue(source["retrievedAt"].startswith("2026-10-13"))


if __name__ == "__main__":
    unittest.main()
