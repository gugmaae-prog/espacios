import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('queue', Path(__file__).resolve().parents[1] / 'scripts/review-pending-dld-identities.py')
queue = importlib.util.module_from_spec(spec)
spec.loader.exec_module(queue)


class QueueTests(unittest.TestCase):
    def test_discovery_preserves_ambiguous_owners_and_distinct_phases(self):
        records = [{'id': 'one', 'name': 'Bay Tower', 'type': 'project'}, {'id': 'two', 'name': 'BAY TOWER', 'type': 'project'}, {'id': 'phase', 'name': 'Bay Tower 2', 'type': 'project'}, {'id': 'area', 'name': 'Bay Tower', 'type': 'community'}]
        owners = queue.name_owners(records)
        self.assertEqual(queue.matched_records({'project_name_en': 'Bay Tower'}, owners), {'one', 'two'})
        self.assertEqual(queue.matched_records({'building_name_en': 'Bay Tower 2'}, owners), {'phase'})
        self.assertEqual(queue.matched_records({'project_name_en': 'Bay Towers'}, owners), set())

    def test_revision_that_moves_outside_names_quarantines_original(self):
        row = {'transaction_id': 'example', 'project_name_en': 'Bay Tower', 'building_name_en': 'Bay Tower'}
        item = {'fingerprint': hashlib.sha256(json.dumps(row, sort_keys=True).encode()).hexdigest(), 'allCopies': 0, 'conflict': False}
        queue.reconcile_copy(item, row)
        self.assertFalse(item['conflict'])
        queue.reconcile_copy(item, {**row, 'project_name_en': 'Other', 'building_name_en': 'Other'})
        self.assertTrue(item['conflict'])
        self.assertEqual(item['allCopies'], 2)

    def test_financial_filter_is_not_identity_or_aggregate_approval(self):
        row = {'transaction_id': 'example', 'project_number': '123.00', 'area_id': '432', 'project_name_en': 'Parent', 'building_name_en': 'Tower A', 'trans_group_en': 'Sales', 'property_usage_en': 'Residential', 'property_type_en': 'Unit', 'property_sub_type_en': 'Flat', 'reg_type_en': 'Off-Plan Properties', 'instance_date': '2026-10-07', 'actual_worth': '1000000', 'procedure_area': '100', 'meter_sale_price': '10000'}
        self.assertIsNone(queue.financial_reason(row))
        for patch, expected in [({'building_name_en': ''}, 'missing_project_or_building_name'), ({'project_number': '123.4'}, 'invalid_source_key'), ({'trans_group_en': 'Gifts'}, 'not_sale'), ({'instance_date': '2026-10-08'}, 'date_outside_capture_cutoff'), ({'property_type_en': 'Villa'}, 'not_residential_flat'), ({'actual_worth': 'NaN'}, 'invalid_amount_or_area')]:
            self.assertEqual(queue.financial_reason({**row, **patch}), expected)


if __name__ == '__main__':
    unittest.main()
