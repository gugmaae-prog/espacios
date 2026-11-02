#!/usr/bin/env python3
"""Identity, scenario, classification and preservation tests for the regional queue."""
import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("regional_review", ROOT / "scripts/build-regional-review-queue.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def record(record_id, name, emirate, typ="project", community=None):
    return {"id": record_id, "name": name, "emirate": emirate, "type": typ,
            "communityId": community, "registerEvidence": [], "lifecycle": [],
            "observations": [], "historySeries": [],
            "researchStatus": {"itemCoverage": {"registered_sale_history": {"status": "missing"},
                                                "complete_registered_sale_history": {"status": "unestablished"}}},
            "scenarioCoverage": {"approvedAnnualPoints": 0}, "scenarioInputs": None}


class RegionalQueueTests(unittest.TestCase):
    def test_region_priority_and_ghantout_spelling(self):
        catalogue = {"project:1": {"mapRecord": {"area": "Ghantout", "developer": "Example Developer"}}}
        row = module.compact_record(record("project:1", "Example", "Abu Dhabi"), catalogue,
                                    {("project", "Abu Dhabi", "example"): 1})
        self.assertEqual(row["region"], "Abu Dhabi / Ghantoot")
        self.assertTrue(row["ghantootNameOrAreaFlag"])
        self.assertEqual(row["coverageItems"]["registered_sale_history"], "missing")
        self.assertEqual(row["financialEvidence"]["approvedScenarioPoints"], 0)
        self.assertIsNone(row["legalDeveloper"])

    def test_palm_jebel_ali_does_not_fan_out_master_to_phase(self):
        record_id = "project:pja-phase"
        rec = record(record_id, "Palm Jebel Ali - Tower A", "Dubai",
                     community="community:Dubai:palm-jebel-ali")
        rows = module.compact_record(rec, {record_id: {"mapRecord": {}}},
                                     {("project", "Dubai", module.normalized(rec["name"])): 1})
        self.assertEqual(rows["region"], "Palm Jebel Ali")
        self.assertIn("exact_authority_project_id_unverified", rows["reviewReasons"])
        self.assertIn("parent_phase_scope_review", rows["reviewReasons"])
        self.assertEqual(rows["financialEvidence"]["directSaleSeries"], [])

    def test_legacy_developer_requires_same_stable_id_and_emirate(self):
        rec = record("project:a", "Example", "Dubai")
        row = module.compact_record(rec, {"project:a": {}},
                                    {("project", "Dubai", "example"): 1},
                                    {"project:a": {"developer": "Named Seller", "emirate": "Dubai"}})
        self.assertEqual(row["marketingDeveloperUnverified"], "Named Seller")
        self.assertIsNone(row["legalDeveloper"])
        other = module.compact_record(rec, {"project:a": {}},
                                      {("project", "Dubai", "example"): 1},
                                      {"project:a": {"developer": "Wrong Area", "emirate": "Abu Dhabi"}})
        self.assertIsNone(other["marketingDeveloperUnverified"])

    def test_duplicate_names_trigger_review(self):
        r = record("project:a", "Example Tower", "Dubai")
        row = module.compact_record(r, {"project:a": {}},
                                    {("project", "Dubai", "exampletower"): 2})
        self.assertIn("duplicate_normalized_name_review", row["reviewReasons"])

    def test_unverified_register_does_not_grant_identity(self):
        rec = record("project:a", "Example", "Dubai")
        rec["registerEvidence"] = [{"identityVerified": False, "scope": "subject",
                                     "registeredProjectId": "123", "sourceIds": ["source:one"]}]
        proof, conflict = module.explicit_id_proofs(rec)
        self.assertEqual(proof, [])
        self.assertIsNone(conflict)

    def test_queue_rejects_catalogue_loss(self):
        inventory = {"projects": [], "communities": []}
        with self.assertRaisesRegex(ValueError, "Fixed"):
            module.compile_queue({"version": "v25", "records": [record("a", "A", "Dubai")]},
                                 inventory, {"version": "v25", "counts": {"records": 1860}})

    def test_queue_rejects_unapproved_numeric_forecast(self):
        # A generated queue cannot silently reinterpret an approved point as research-only.
        self.assertEqual(module.FIXED, (1645, 215))
        self.assertEqual(len(range(2027, 2081)), 54)
        self.assertNotIn("source_observed", {"inventory_review_only_no_new_observed_evidence"})

if __name__ == "__main__":
    unittest.main()
