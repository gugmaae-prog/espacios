"""Acceptance, evidence-class and full-catalogue preservation tests. Offline."""
import copy,gzip,hashlib,importlib.util,json,os,sys,unittest
from pathlib import Path
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'scripts'))
spec=importlib.util.spec_from_file_location('append_review',R/'scripts/append-reviewed-regional-pass.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
D=R/'data/historical-intelligence/reviewed-regional-20261014'
class Reviewed(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  file=Path(os.environ.get('REGIONAL_BASELINE_SNAPSHOT',str(R/'data/historical-intelligence-20261003.json')));raw=file.read_bytes();raw=gzip.decompress(raw) if file.suffix=='.gz' else raw
  if hashlib.sha256(raw).hexdigest()!=m.PRIOR_SHA:raise ValueError('Tests require exact retained V46 baseline')
  cls.snapshot=json.loads(raw);cls.packet=json.loads((D/'accepted-packet.json').read_bytes());cls.captures=m.load_captures(D/'captures')
 def setUp(self):self.p=copy.deepcopy(self.packet)
 def test_accepted_counts_and_scope(self):
  self.assertTrue(m.validate(self.p,self.snapshot,self.captures));self.assertEqual(len(self.p['facts']),20);self.assertEqual(len(self.p['sources']),14);self.assertEqual(len(self.p['recordIdentityChecks']),16)
 def test_full_catalogue_preservation_and_exact_delta(self):
  before=hashlib.sha256(m.canonical(self.snapshot)).hexdigest();after,receipt=m.apply_packet(self.snapshot,self.p,self.captures)
  self.assertEqual(hashlib.sha256(m.canonical(self.snapshot)).hexdigest(),before)
  self.assertEqual(receipt['coverageDelta'],dict(present=20,partial=-11,missing=-9,unestablished=0,disputed=0,inaccessible=0,**{'pre-applicability':0}))
  self.assertEqual(receipt['changedRecordsByEmirate'],{'Abu Dhabi':6,'Umm Al Quwain':9,'Fujairah':1});self.assertEqual(receipt['unaffectedRecordsPreserved'],1844)
  self.assertEqual(after['sources'][:3367],self.snapshot['sources'])
  self.assertEqual([r['id'] for r in after['records']],[r['id'] for r in self.snapshot['records']])
  for old,new in zip(self.snapshot['records'],after['records']):
   for key in ['historySeries','currentSnapshot','scenarioInputs','scenarioCoverage','registerEvidence']:self.assertEqual(new.get(key),old.get(key))
 def test_unknown_record_and_no_fanout(self):
  self.p['facts'][0]['recordId']='not-a-catalogue-record'
  with self.assertRaises(ValueError):m.validate(self.p,self.snapshot,self.captures)
 def test_exact_authority_number(self):
  self.p['recordIdentityChecks'][0]['authorityProjectNumber']='wrong'
  with self.assertRaises(ValueError):m.validate(self.p,self.snapshot,self.captures)
 def test_source_checksum(self):
  self.p['sources'][0]['sha256']='a'*64
  with self.assertRaises(ValueError):m.validate(self.p,self.snapshot,self.captures)
 def test_source_rights_no_raw(self):
  self.p['sources'][0]['rawBodyRetained']=True
  with self.assertRaises(ValueError):m.validate(self.p,self.snapshot,self.captures)
 def test_publication_not_future(self):
  self.p['sources'][0]['publishedAt']='2027-01-01'
  with self.assertRaises(ValueError):m.validate(self.p,self.snapshot,self.captures)
 def test_no_retroactive_availability(self):
  self.p['sources'][0]['firstAvailableAt']='2020-01-01T00:00:00Z'
  with self.assertRaises(ValueError):m.validate(self.p,self.snapshot,self.captures)
 def test_no_duplicate_source_or_fact(self):
  self.p['facts'].append(copy.deepcopy(self.p['facts'][0]))
  with self.assertRaises(ValueError):m.validate(self.p,self.snapshot,self.captures)
  self.p=copy.deepcopy(self.packet);self.p['sources'].append(copy.deepcopy(self.p['sources'][0]))
  with self.assertRaises(ValueError):m.validate(self.p,self.snapshot,self.captures)
 def test_asking_not_registered_sale_rent_or_valuation(self):
  o=next(f for f in self.p['facts'] if f['kind']=='financial')['observation'];o['observationKind']='transaction';o['transactionId']='invented'
  with self.assertRaises(ValueError):m.validate(self.p,self.snapshot,self.captures)
 def test_arithmetic_and_native_units(self):
  o=next(f for f in self.p['facts'] if f['kind']=='financial')['observation'];o['value']+=1
  with self.assertRaises(ValueError):m.validate(self.p,self.snapshot,self.captures)
  self.p=copy.deepcopy(self.packet);o=next(f for f in self.p['facts'] if f['kind']=='financial')['observation'];o['unit']='AED/sqft'
  with self.assertRaises(ValueError):m.validate(self.p,self.snapshot,self.captures)
 def test_capture_date_not_invented_launch_price(self):
  next(f for f in self.p['facts'] if f['kind']=='financial')['observation']['period']='2020-01-01'
  with self.assertRaises(ValueError):m.validate(self.p,self.snapshot,self.captures)
 def test_planned_completion_is_not_actual(self):
  next(f for f in self.p['facts'] if f.get('milestone')=='target_completion')['eventStatus']='actual'
  with self.assertRaises(ValueError):m.validate(self.p,self.snapshot,self.captures)
 def test_phase_card_no_cross_record(self):
  f=next(f for f in self.p['facts'] if f.get('targetProof'));f['targetProof']['index']=1
  with self.assertRaises(ValueError):m.validate(self.p,self.snapshot,self.captures)
 def test_conflicting_quote_candidates_not_promoted(self):
  excluded={d['captureId'] for d in self.p['sourceReconciliation'] if d['status']=='disputed_quote_withheld'}
  self.assertEqual(len(excluded),5);self.assertFalse(excluded&{s['captureId'] for s in self.p['sources']})
 def test_no_forecasts_and_2080_preserved(self):
  self.p['numericForecasts']=[{'year':2080,'value':1}]
  with self.assertRaises(ValueError):m.validate(self.p,self.snapshot,self.captures)
  source=(R/'src/historical-intelligence/core.mjs').read_text()
  self.assertIn('length:54',source);self.assertIn('2027+i',source)
 def test_unchanged_ghantoot_and_pja_not_new_evidence(self):
  targets={f['recordId'] for f in self.p['facts']};self.assertFalse(targets&{'adrec:624','adrec:628','adrec:650','adrec:646','adrec:623','adrec:439','community:Dubai:palm-jebel-ali','project:palm-central-private-residences-palm-jebel-ali-dubai'})
if __name__=='__main__':unittest.main(verbosity=2)
