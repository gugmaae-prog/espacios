import importlib.util,json,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('authority',ROOT/'scripts/prepare-dld-authority-pass41.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class AuthorityEvidence(unittest.TestCase):
 def test_exact_integer_keys(self):
  self.assertEqual(m.integer('1051.00'),1051)
  for v in ['1051.2','NaN','Infinity','0','-1']:
   with self.assertRaises((AssertionError,ValueError)):m.integer(v)
 def test_invalid_calendar_is_not_coerced(self):
  self.assertEqual(m.native_date('20/07/2027'),'2027-07-20')
  with self.assertRaises(ValueError):m.native_date('31/02/2026')
 def test_retained_packet_quarantines_future_inspection_and_ambiguous_geometry(self):
  p=json.loads((ROOT/'data/historical-intelligence/dld-authority-pass41-20261012.json').read_text())
  self.assertEqual({r['projectNumber'] for r in p['records']},{4482,4157,4142,4337,4226,4437,4359,4453})
  self.assertEqual(len(p['sourceCaptures']),24)
  future=[r for r in p['records'] if r['inspection']['status']=='quarantined_future_dated']
  self.assertEqual([r['projectNumber'] for r in future],[4359])
  self.assertEqual(future[0]['inspection']['date'],'2027-07-20')
  for r in p['records']:
   self.assertFalse(r['mapCoordinatesEligible']);self.assertFalse(r['inspection']['currentProgressEligible']);self.assertFalse(r['priceObservationCreated'])
   self.assertEqual(r['developerRegisterCrosscheck'],'exact_number_and_normalized_name')
   self.assertGreaterEqual(r['firstAvailableAt'],'2026-10-11')
  self.assertEqual(p['financialObservationsAdded'],0);self.assertEqual(p['coverageCredit'],0)
 def test_review_retains_native_dates_without_promoting_candidates(self):
  p=json.loads((ROOT/'docs/verification/dld-authority-review-2026-10-12/transaction-review.json').read_text())
  self.assertEqual(p['sourceRowsScanned'],p['duplicateReconciliationRowsScanned'])
  self.assertEqual(p['sourceRowsScanned'],1800588)
  self.assertEqual(len(p['records']),10)
  self.assertEqual(sum(r['financiallyEligibleCandidates'] for r in p['records']),296)
  for r in p['records']:
   self.assertEqual(r['acceptedObservations'],0);self.assertEqual(r['coverageCredit'],0)
   self.assertEqual(sum(r['nativeMonthlyCandidateCounts'].values()),r['financiallyEligibleCandidates'])
  w=next(r for r in p['records'] if r['projectNumber']==4482)
  self.assertEqual(w['firstCandidateRegistration'],'2026-08-12')
  self.assertEqual(w['lastCandidateRegistration'],'2026-10-09')
if __name__=='__main__':unittest.main()
