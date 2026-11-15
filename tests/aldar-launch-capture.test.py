"""Offline matching tests; fixture prose is synthetic and never accepted evidence."""
import copy,importlib.util,json,unittest
from pathlib import Path
R=Path(__file__).resolve().parents[1];s=importlib.util.spec_from_file_location('capture',R/'scripts/capture-aldar-launches-pass48.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
P=json.loads((R/'data/historical-intelligence/aldar-launches-20261014/source-plan.json').read_bytes())
class Capture(unittest.TestCase):
 def setUp(self):
  self.source=copy.deepcopy(P['sources'][0])
  self.source['claims']=[{'id':'synthetic','kind':'financial','pattern':r'example\s+AED\s*(?P<amount>[\d,.]+)\s*(?P<scale>million)?','amountAED':1740000}]
  self.prefix='Yas Park Gate Aldar Yas Island August 24, 2022 508 homes '
 def parse(self,text):return m.normalize(('<p>'+self.prefix+text+'</p>').encode(),self.source)
 def test_amount_and_publication(self):
  out=self.parse('example AED 1.74 million');self.assertTrue(out['identityContentConfirmed']);self.assertTrue(out['claimChecks'][0]['matched']);self.assertEqual(out['claimChecks'][0]['observedAmountsAED'],[1740000]);self.assertEqual(len(out['claimChecks'][0]['matchSHA256'][0]),64)
 def test_full_amount_commas(self):self.assertTrue(self.parse('example AED 1,740,000')['claimChecks'][0]['matched'])
 def test_wrong_amount_fails(self):self.assertFalse(self.parse('example AED 1.75 million')['claimChecks'][0]['matched'])
 def test_conflicting_pair_fails(self):self.assertFalse(self.parse('example AED 1.74 million example AED 1.75 million')['claimChecks'][0]['matched'])
 def test_wrong_currency(self):self.assertFalse(self.parse('example USD 1.74 million')['claimChecks'][0]['matched'])
 def test_script_is_not_evidence(self):self.assertFalse(self.parse('<script>example AED 1.74 million</script>')['claimChecks'][0]['matched'])
 def test_no_raw_text_export(self):
  out=self.parse('example AED 1.74 million RAW_PRIVATE_UNRELATED_TEXT');self.assertNotIn('RAW_PRIVATE_UNRELATED_TEXT',json.dumps(out));self.assertFalse(out['rawTextRetained'])
 def test_wrong_units_count(self):
  self.prefix=self.prefix.replace('508','509');self.assertFalse(self.parse('example AED 1.74 million')['identityContentConfirmed'])
 def test_wrong_publication_year(self):
  self.prefix=self.prefix.replace('2022','2023');self.assertFalse(self.parse('example AED 1.74 million')['identityContentConfirmed'])
 def test_unknown_project(self):
  self.prefix=self.prefix.replace('Yas Park Gate','Different Project');self.assertFalse(self.parse('example AED 1.74 million')['identityContentConfirmed'])
 def test_no_amount_is_not_zero(self):self.assertEqual(self.parse('no amount')['claimChecks'][0]['observedAmountsAED'],[])
 def test_all_five_single_targets(self):
  self.assertEqual({s['reviewAgainstIds'][0] for s in P['sources']},m.EXPECTED_IDS);self.assertTrue(all(len(s['reviewAgainstIds'])==1 for s in P['sources']));self.assertEqual(sum(len(s['claims']) for s in P['sources']),24)
 def test_targets_are_planned(self):
  for s in P['sources']:
   for c in s['claims']:
    if c['kind']=='lifecycle' and c['milestone']!='launch':self.assertEqual(c['eventStatus'],'planned')
 def test_conflicting_completion_target_withheld(self):
  dunes=next(s for s in P['sources'] if s['reviewAgainstIds']==['adrec:65']);self.assertTrue(dunes['withheldClaims']);self.assertFalse(any(c.get('milestone')=='target_completion' for c in dunes['claims']))
if __name__=='__main__':unittest.main(verbosity=2)
