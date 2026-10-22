"""Identity-review gates must not turn plausible candidates into coverage."""
import importlib.util
import unittest
from datetime import date
from pathlib import Path

module = importlib.util.spec_from_file_location('review', Path(__file__).resolve().parents[1] / 'scripts/review-dld-identity-pass38.py')
review = importlib.util.module_from_spec(module)
module.loader.exec_module(review)


class IdentityReviewTests(unittest.TestCase):
    def setUp(self):
        self.spec = review.SPECS[0]
        self.row = {'transaction_id': 'test-1', 'project_number': '3445.00', 'area_id': '317',
                    'project_name_en': 'Jumeirah Asora Bay', 'building_name_en': 'Jumeirah Residences Asora Bay',
                    'trans_group_en': 'Sales', 'property_usage_en': 'Residential', 'property_type_en': 'Unit',
                    'property_sub_type_en': 'Flat', 'reg_type_en': 'Off-Plan Properties',
                    'instance_date': '2025-05-07', 'actual_worth': '1000000',
                    'procedure_area': '100', 'meter_sale_price': '10000'}
        self.cutoff = date(2026, 10, 6)

    def test_decimal_ids_do_not_truncate_or_lose_precision(self):
        self.assertEqual(review.integer('3445.00'), 3445)
        self.assertEqual(review.integer('9007199254740993'), 9007199254740993)
        for value in ['3445.9', 'NaN', 'Infinity', '', '0', '-1', True]:
            with self.assertRaises(ValueError):
                review.integer(value)

    def test_one_sparse_sale_is_retained_as_candidate_with_zero_coverage_credit(self):
        out = review.review_rows([self.row], self.spec, self.cutoff)
        self.assertEqual(out['financiallyEligibleUniqueCandidates'], 1)
        self.assertEqual(out['firstCandidateRegistrationDate'], '2025-05-07')
        self.assertEqual(out['acceptedFacts'], 0)
        self.assertEqual(out['coverageCredit'], 0)
        self.assertEqual(out['identityStatus'], 'review_pending')
        self.assertNotIn('price', out)

    def test_exact_duplicates_count_once_and_conflicts_quarantine_the_whole_id(self):
        out = review.review_rows([self.row, dict(self.row)], self.spec, self.cutoff)
        self.assertEqual(out['financiallyEligibleUniqueCandidates'], 1)
        self.assertEqual(out['duplicateRows'], 1)
        conflict = {**self.row, 'area_id': '432'}
        out = review.review_rows([self.row, conflict], self.spec, self.cutoff)
        self.assertEqual(out['financiallyEligibleUniqueCandidates'], 0)
        self.assertEqual(out['excludedOrQuarantined'], {'conflicting_duplicate_transaction_id': 1})

    def test_wrong_phase_land_gifts_and_future_dates_are_not_residential_sales(self):
        cases = [({'building_name_en': 'Jumeirah Asora Bay Hotel'}, 'project_or_building_name_conflict'),
                 ({'project_number': '3445.7'}, 'invalid_source_key'),
                 ({'project_number': '3446'}, 'register_key_conflict'),
                 ({'property_type_en': 'Land', 'property_usage_en': 'Commercial'}, 'not_residential_flat'),
                 ({'trans_group_en': 'Gifts'}, 'not_sale'),
                 ({'instance_date': '2026-10-07'}, 'date_outside_capture_cutoff'),
                 ({'actual_worth': 'NaN'}, 'invalid_amount_or_area'),
                 ({'procedure_area': '0'}, 'invalid_amount_or_area'),
                 ({'meter_sale_price': '5000'}, 'price_formula_conflict')]
        for patch, expected in cases:
            with self.subTest(patch=patch):
                self.assertEqual(review.candidate_reason({**self.row, **patch}, self.spec, self.cutoff), expected)


if __name__ == '__main__':
    unittest.main()
