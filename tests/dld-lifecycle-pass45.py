import hashlib,json,unittest
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
p=json.loads((ROOT/'data/historical-intelligence/dld-lifecycle-pass45-20261013.json').read_text())
class LifecyclePacket(unittest.TestCase):
 def test_scope_and_financial_separation(self):
  self.assertEqual(len(p['recordIdentityChecks']),8);self.assertEqual(len({f['recordId'] for f in p['facts']}),8)
  self.assertEqual(Counter(f['milestone'] for f in p['facts']),{'registration':8,'filed_project_start':8,'target_completion':8,'construction_progress':7})
  self.assertEqual(p['financialObservationsAdded'],0);self.assertEqual(p['sources'],[])
  self.assertTrue(all(f['kind']=='lifecycle' and 'observation' not in f for f in p['facts']))
 def test_identity_and_input_integrity(self):
  for x in p['inputPackets']:self.assertEqual(hashlib.sha256((ROOT/x['path']).read_bytes()).hexdigest(),x['sha256'])
  checks={c['recordId']:c for c in p['recordIdentityChecks']}
  for f in p['facts']:
   c=checks[f['recordId']];self.assertEqual(f['identitySourceIds'],c['sourceIds']);self.assertTrue(f['identityVerified']);self.assertEqual(f['scope'],'subject')
   self.assertIn('-'+str(c['authorityProjectNumber'])+'-',f['id'])
  self.assertNotIn(4337,[c['authorityProjectNumber'] for c in p['recordIdentityChecks']])
 def test_dates_and_availability(self):
  self.assertEqual(len({f['id'] for f in p['facts']}),31)
  for f in p['facts']:
   self.assertEqual(f['date']['precision'],'day');self.assertIsNone(f['publishedAt'])
   self.assertTrue(f['firstAvailableAt']);self.assertLessEqual(f['firstAvailableAt'][:10],p['asOf'])
   if f['milestone']=='target_completion' or (f['milestone']=='filed_project_start' and f['date']['start']>p['asOf']):self.assertEqual(f['eventStatus'],'planned')
   else:self.assertEqual(f['eventStatus'],'reported');self.assertLessEqual(f['date']['start'],p['asOf'])
 def test_inspections_and_future_quarantine(self):
  rows=[f for f in p['facts'] if f['milestone']=='construction_progress']
  self.assertEqual(sorted(f['progressPercent'] for f in rows),[0,0,0,0,0.04,1.32,6.81])
  self.assertEqual(p['excluded'][0]['date'],'2027-07-20')
  self.assertFalse(any('cresswell' in f['recordId'] for f in rows))
  self.assertTrue(all('not present progress' in f['note'] for f in rows))
 def test_captures_not_relabelled_as_new(self):
  self.assertEqual(len(p['sourceCaptures']),24)
  self.assertTrue(all(x['retrievedAt'].startswith('2026-10-11') for x in p['sourceCaptures']))
  self.assertTrue(all(len(x['sha256'])==64 and x['bytes']>0 for x in p['sourceCaptures']))
  self.assertEqual(p['publicationStatus'],'prepared_not_integrated')
if __name__=='__main__':unittest.main()
