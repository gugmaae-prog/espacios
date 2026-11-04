import copy,gzip,hashlib,importlib.util,json,sys,unittest
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from historical_enrichment import apply_enrichment
PACKET=ROOT/'data/historical-intelligence/dld-sales-pass44-20261012.json'
class SaleEvidence(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.packet=json.loads(PACKET.read_text());cls.priorBlob=(ROOT/'data/historical-intelligence/objects/999760c4e7fade1d3f6f5398f19f0521a96dd403cbcc51ac1d2e242188061998.json.gz').read_bytes();cls.snapshot=json.loads(gzip.decompress(cls.priorBlob))
  by_id={x['id']:x for x in cls.snapshot['series']}
  for r in cls.snapshot['records']:
   if r['id'] in {f['recordId'] for f in cls.packet['facts']}:
    r['historySeries']=[by_id[x] for x in r['historySeriesIds']]
 def test_exact_scope_and_financial_consistency(self):
  p=self.packet;self.assertEqual(len(p['facts']),40)
  self.assertEqual(Counter(f['observation']['sourceProjectNumber'] for f in p['facts']),{4066:40})
  self.assertEqual(len({f['observation']['transactionId'] for f in p['facts']}),40)
  for f in p['facts']:
   o=f['observation'];self.assertEqual(o['propertySubtype'],'Flat');self.assertEqual(o['transactionKind'],'sale')
   self.assertAlmostEqual(o['value']*o['areaSqm']*10.763910416709722,o['priceAED'],places=5)
   self.assertRegex(o['transactionId'],r'^dld-sha256:[0-9a-f]{64}$');self.assertFalse(o['currentSnapshotEligible']);self.assertFalse(o['includeInCurrentSnapshot'])
   self.assertGreaterEqual(f['firstAvailableAt'],'2026-10-11');self.assertLessEqual(o['period'],'2026-10-10')
 def test_source_vintage_is_not_old_or_backdated(self):
  source=self.packet['sources'][-1];self.assertEqual(source['sourceSnapshotDate'],'2026-10-10')
  self.assertEqual(len(source['snapshotFiles']),2)
  self.assertTrue(all('2026-10-10' in f['fileName'] for f in source['snapshotFiles']))
  self.assertIsNone(source['publishedAt']);self.assertFalse(source['rawTransactionIdsRedistributed'])
  self.assertNotIn('file_url',json.dumps(self.packet));self.assertNotIn('Email:',json.dumps(self.packet))
 def test_in_memory_append_preserves_existing_evidence_and_no_valuation(self):
  p=self.packet;s=self.snapshot
  self.assertEqual(hashlib.sha256(self.priorBlob).hexdigest(),self.packet['priorArchiveSHA256']);self.assertEqual(s['version'],p['priorVersion'])
  ids={x['recordId'] for x in p['facts']};records=copy.deepcopy([r for r in s['records'] if r['id'] in ids]);before=copy.deepcopy(records)
  sources={x['id']:copy.deepcopy(x) for x in s['sources']}
  def add(source):
   self.assertNotIn(source['id'],sources);sources[source['id']]=copy.deepcopy(source);return source['id']
  result=apply_enrichment(p,records,{},sources,add,{},p['asOf'])
  self.assertEqual(result['counts']['acceptedFacts'],40)
  for b,a in zip(before,records):
   self.assertEqual(a['currentSnapshot'],b['currentSnapshot']);self.assertEqual(a['scenarioInputs'],b['scenarioInputs']);self.assertEqual(a['scenarioCoverage'],b['scenarioCoverage'])
   self.assertEqual(a['lifecycle'],b['lifecycle']);self.assertEqual(a['historySeries'],b['historySeries'])
   self.assertEqual(a['observations'][:len(b['observations'])],b['observations'])
   self.assertEqual(a['researchStatus']['identityCandidateCount'],b['researchStatus']['identityCandidateCount'])
   self.assertIn('complete_registered_sale_history',a['researchStatus']['gaps'])
   self.assertIn('direct_signed_rent_history',a['researchStatus']['gaps'])
   self.assertNotIn('direct_registered_sale_history',a['researchStatus']['gaps'])
 def test_primary_identity_and_component_boundaries(self):
  sources={s['id']:s for s in self.snapshot['sources']+self.packet['sources']}
  self.assertEqual(len(self.packet['sources']),3)
  for f in self.packet['facts']:
   self.assertTrue(all(i in sources for i in f['identitySourceIds']))
   self.assertTrue(all(sources[i].get('firstAvailableAt',sources[i].get('retrievedAt',''))<=f['firstAvailableAt'] for i in f['identitySourceIds']))
   self.assertEqual(f['observation']['usage'],'Residential')
  identity=sources['primary44-iquna-avida']['normalizedFacts']
  self.assertEqual(identity['registeredDeveloper'],'Serene Marina Real Estate Development L.L.C')
  self.assertEqual(identity['developerBrand'],'IQUNA Properties')
  self.assertEqual(identity['publicAuthorityContactDomain'],'iqunaproperties.com')
  self.assertFalse(identity['corporateEquivalenceInferred'])
  authority=sources['dld44-public-avida-status-20261012']['normalizedFacts']
  self.assertEqual(authority['registeredUnits'],50)
  self.assertEqual(authority['registeredDeveloperNumber'],2139)
  self.assertEqual(authority['inspection']['date'],'2026-08-25')
  self.assertFalse(authority['inspection']['currentProgressEligible'])
  self.assertFalse(authority['mapCoordinatesEligible'])
  self.assertFalse(any(f.get('kind')=='lifecycle' for f in self.packet['facts']))
  self.assertNotIn('jassim@',json.dumps(self.packet))
  self.assertFalse(self.packet['collection']['completeLifetimeHistory'])
  self.assertEqual(self.packet['collection']['sourceRowsScanned'],1800588)
  self.assertEqual(self.packet['collection']['duplicateReconciliationRowsScanned'],1800588)
 def test_exact_source_keys_and_building_identity_are_required(self):
  spec=importlib.util.spec_from_file_location('pass44',ROOT/'scripts/prepare-dld-sales-pass44.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
  project=module.SPECS[0]
  self.assertFalse(module.descriptor_mentions_project({'label':'Avida wellness services'},project))
  self.assertTrue(module.descriptor_mentions_project({'sourceProjectNumber':4066},project))
  from datetime import date
  base={'project_number':'4066','area_id':'432','trans_group_en':'Sales','property_usage_en':'Residential','property_type_en':'Unit','property_sub_type_en':'Flat','project_name_en':'Avida Residences','building_name_en':'Other building'}
  self.assertEqual(module.review.candidate_reason(base,project,date(2026,10,10)),'project_or_building_name_conflict')
  base['area_id']='390'
  self.assertEqual(module.review.candidate_reason(base,project,date(2026,10,10)),'register_key_conflict')
if __name__=='__main__':unittest.main()
