"""V48 independent exact-subject and preservation tests, including refusal cases."""
import copy,gzip,hashlib,importlib.util,json,os,sys,unittest
from pathlib import Path
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'scripts'))
spec=importlib.util.spec_from_file_location('pass48',R/'scripts/append-aldar-launches-pass48.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Aldar(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  p=Path(os.environ.get('ALDAR_BASELINE_SNAPSHOT',str(R/'data/historical-intelligence/retained-snapshots/20261014-enrichment-v47.json.gz')))
  raw=m.read(p)
  if hashlib.sha256(raw).hexdigest()!=m.PRIOR_SHA:raise ValueError('Exact retained V47 required')
  cls.before=json.loads(raw);cls.plan,cls.capture=m.inputs();cls.packet=m.materialize(cls.before,cls.plan,cls.capture)
 def setUp(self):self.p=copy.deepcopy(self.packet)
 def check(self):return m.validate(self.before,self.p,self.plan,self.capture)
 def financial(self):return next(f for f in self.p['facts'] if f['kind']=='financial')
 def test_five_subjects_twenty_three_facts(self):
  self.assertTrue(self.check());self.assertEqual(len(self.p['facts']),23);self.assertEqual(len(self.p['sources']),5)
  self.assertEqual(sum(f['kind']=='financial' for f in self.p['facts']),10)
  self.assertEqual(sum(f.get('milestone')=='launch' for f in self.p['facts']),5)
  self.assertEqual(sum(f.get('milestone')=='target_handover' for f in self.p['facts']),4)
  self.assertEqual(sum(f.get('milestone')=='target_construction_start' for f in self.p['facts']),4)
 def test_independent_actual_candidate_preservation(self):
  path=Path(os.environ.get('ALDAR_CANDIDATE_SNAPSHOT',str(R/'data/historical-intelligence-20261003.json')))
  actual=json.loads(m.read(path));before={r['id']:r for r in self.before['records']};after={r['id']:r for r in actual['records']}
  self.assertEqual(actual['version'],m.VERSION);self.assertEqual(list(before),list(after));self.assertEqual(len(after),1860)
  self.assertEqual(actual['sources'][:3381],self.before['sources']);self.assertEqual(len(actual['sources']),3386)
  self.assertEqual(actual['events'],self.before['events']);self.assertEqual(actual['exposures'],self.before['exposures'])
  changed=[];transition=[];obs=0;life=0;facts={f['id']:f for f in self.packet['facts']}
  for rid,prior in before.items():
   old,new=copy.deepcopy(prior),copy.deepcopy(after[rid])
   for r in [old,new]:
    for s in r['historySeries']:s.pop('partition',None)
   if old!=new:changed.append(rid)
   if rid not in m.APPROVED:self.assertEqual(new,old,rid);continue
   for k in set(old)-{'observations','lifecycle','researchStatus','coverageSummary'}:self.assertEqual(new[k],old[k],rid+':'+k)
   for k in ['observations','lifecycle']:
    self.assertEqual(new[k][:len(old[k])],old[k]);added=new[k][len(old[k]):]
    if k=='observations':obs+=len(added)
    else:life+=len(added)
    self.assertTrue(all(x['id'] in facts and facts[x['id']]['recordId']==rid for x in added))
   allowed={'original_launch','advertised_prices'}|({'construction_targets','handover_targets'} if rid!='adrec:65' else set())
   for k,item in old['researchStatus']['itemCoverage'].items():
    newitem=new['researchStatus']['itemCoverage'][k]
    if k in allowed:
     self.assertEqual((item['status'],newitem['status']),('missing','present'));transition.append((rid,k))
     self.assertTrue(set(newitem['evidenceIds'])&facts.keys())
    else:self.assertEqual(newitem,item,rid+':'+k)
  self.assertEqual(set(changed),set(m.APPROVED));self.assertEqual((obs,life,len(transition)),(10,13,18))
  self.assertEqual(m.ledger(actual),dict(missing=26698,unestablished=9300,partial=3402,present=3380))
 def test_apply_is_pure_and_exact(self):
  digest=hashlib.sha256(m.canonical(self.before)).hexdigest();out,r=m.apply(self.before,self.p,self.plan,self.capture)
  self.assertEqual(hashlib.sha256(m.canonical(self.before)).hexdigest(),digest)
  self.assertEqual(r['coverageDelta'],dict(present=18,partial=0,missing=-18,unestablished=0,disputed=0,inaccessible=0,**{'pre-applicability':0}))
  self.assertEqual(r['unaffectedRecordsPreserved'],1855);self.assertEqual(r['remoteWrites'],0)
 def test_wrong_authority_number(self):
  self.p['recordIdentityChecks'][0]['projectNumber']='wrong'
  with self.assertRaises(ValueError):self.check()
 def test_wrong_legal_developer(self):
  self.p['recordIdentityChecks'][0]['authorityDeveloper']='marketing name'
  with self.assertRaises(ValueError):self.check()
 def test_wrong_geography(self):
  self.p['recordIdentityChecks'][0]['authorityArea']='Dubai'
  with self.assertRaises(ValueError):self.check()
 def test_wrong_unit_count(self):
  self.p['recordIdentityChecks'][0]['authorityUnitCount']+=1
  with self.assertRaises(ValueError):self.check()
 def test_unknown_record(self):
  self.p['facts'][0]['recordId']='missing-id'
  with self.assertRaises(ValueError):self.check()
 def test_duplicate_fact(self):
  self.p['facts'].append(copy.deepcopy(self.p['facts'][0]))
  with self.assertRaises(ValueError):self.check()
 def test_source_overwrite(self):
  self.p['sources'][0]['id']=self.before['sources'][0]['id']
  with self.assertRaises(ValueError):self.check()
 def test_wrong_checksum(self):
  self.p['sources'][0]['sha256']='f'*64
  with self.assertRaises(ValueError):self.check()
 def test_wrong_download_url(self):
  self.p['sources'][0]['url']='https://unapproved.example/doc.pdf'
  with self.assertRaises(ValueError):self.check()
 def test_raw_retention(self):
  self.p['sources'][0]['rawBodyRetained']=True
  with self.assertRaises(ValueError):self.check()
 def test_backdated_source_availability(self):
  self.p['sources'][0]['firstAvailableAt']='2021-01-01T00:00:00Z'
  with self.assertRaises(ValueError):self.check()
 def test_wrong_publication(self):
  self.p['sources'][0]['publishedAt']='2020-01-01'
  with self.assertRaises(ValueError):self.check()
 def test_future_publication(self):
  self.p['sources'][0]['publishedAt']='2027-01-01'
  with self.assertRaises(ValueError):self.check()
 def test_prelaunch_advertisement(self):
  self.financial()['observation']['period']='2000-01-01'
  with self.assertRaises(ValueError):self.check()
 def test_quote_not_transaction(self):
  self.financial()['observation'].update(observationKind='transaction',transactionId='fake')
  with self.assertRaises(ValueError):self.check()
 def test_no_rent(self):
  self.financial()['observation']['metric']='rent'
  with self.assertRaises(ValueError):self.check()
 def test_wrong_price(self):
  self.financial()['observation']['value']+=1
  with self.assertRaises(ValueError):self.check()
 def test_wrong_area_basis(self):
  self.financial()['observation']['unit']='AED/sqft'
  with self.assertRaises(ValueError):self.check()
 def test_wrong_bedrooms(self):
  self.financial()['observation']['bedrooms']=[10]
  with self.assertRaises(ValueError):self.check()
 def test_no_headline_replacement(self):
  self.financial()['observation']['currentSnapshotEligible']=True
  with self.assertRaises(ValueError):self.check()
 def test_target_is_not_actual(self):
  next(f for f in self.p['facts'] if f.get('milestone')=='target_handover')['eventStatus']='actual'
  with self.assertRaises(ValueError):self.check()
 def test_date_precision_preserved(self):
  next(f for f in self.p['facts'] if f.get('milestone')=='target_handover')['date']['precision']='day'
  with self.assertRaises(ValueError):self.check()
 def test_no_forecasts(self):
  self.p['numericForecasts']=[{'year':2080,'value':1}]
  with self.assertRaises(ValueError):self.check()
 def test_unconfirmed_claim_stays_withheld(self):
  self.assertFalse(any(f['recordId']=='adrec:64' and f['captureClaimId']=='villas-3br' for f in self.p['facts']))
  self.assertFalse(any(f['recordId']=='adrec:65' and f.get('milestone') in ['completion','target_completion','occupancy'] for f in self.p['facts']))
if __name__=='__main__':unittest.main(verbosity=2)
