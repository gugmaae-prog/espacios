import copy,gzip,hashlib,importlib.util,json,sys,unittest
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from historical_enrichment import apply_enrichment
PACKET=ROOT/'data/historical-intelligence/dld-sales-pass41-20261012.json'
class SaleEvidence(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.packet=json.loads(PACKET.read_text());cls.priorBlob=(ROOT/'data/historical-intelligence/objects/498a797f39e12ce9d702ec6ed364f1f874c730e376cb98f2fdd096e75cc1cae9.json.gz').read_bytes();cls.snapshot=json.loads(gzip.decompress(cls.priorBlob))
  for r in cls.snapshot['records']:
   if r['id'] in {f['recordId'] for f in cls.packet['facts']}:
    assert not r['historySeriesIds'];r['historySeries']=[]
 def test_exact_scope_and_financial_consistency(self):
  p=self.packet;self.assertEqual(len(p['facts']),64)
  self.assertEqual(Counter(f['observation']['sourceProjectNumber'] for f in p['facts']),{4482:54,4157:10})
  self.assertEqual(len({f['observation']['transactionId'] for f in p['facts']}),64)
  for f in p['facts']:
   o=f['observation'];self.assertEqual(o['propertySubtype'],'Flat');self.assertEqual(o['transactionKind'],'sale')
   self.assertAlmostEqual(o['value']*o['areaSqm']*10.763910416709722,o['priceAED'],places=5)
   self.assertRegex(o['transactionId'],r'^dld-sha256:[0-9a-f]{64}$');self.assertFalse(o['currentSnapshotEligible']);self.assertFalse(o['includeInCurrentSnapshot'])
   self.assertGreaterEqual(f['firstAvailableAt'],'2026-10-11');self.assertLessEqual(o['period'],'2026-10-10')
 def test_source_vintage_is_not_old_or_backdated(self):
  source=self.packet['sources'][1];self.assertEqual(source['sourceSnapshotDate'],'2026-10-10')
  self.assertEqual(len(source['snapshotFiles']),2)
  self.assertTrue(all('2026-10-10' in f['fileName'] for f in source['snapshotFiles']))
  self.assertIsNone(source['publishedAt']);self.assertFalse(source['rawTransactionIdsRedistributed'])
  self.assertNotIn('file_url',json.dumps(self.packet));self.assertNotIn('Email:',json.dumps(self.packet))
 def test_in_memory_append_preserves_existing_evidence_and_no_valuation(self):
  p=self.packet;s=self.snapshot
  self.assertEqual(hashlib.sha256(self.priorBlob).hexdigest(),'498a797f39e12ce9d702ec6ed364f1f874c730e376cb98f2fdd096e75cc1cae9');self.assertEqual(s['version'],p['priorVersion'])
  ids={x['recordId'] for x in p['facts']};records=copy.deepcopy([r for r in s['records'] if r['id'] in ids]);before=copy.deepcopy(records)
  sources={x['id']:copy.deepcopy(x) for x in s['sources']}
  def add(source):
   self.assertNotIn(source['id'],sources);sources[source['id']]=copy.deepcopy(source);return source['id']
  result=apply_enrichment(p,records,{},sources,add,{},p['asOf'])
  self.assertEqual(result['counts']['acceptedFacts'],64)
  for b,a in zip(before,records):
   self.assertEqual(a['currentSnapshot'],b['currentSnapshot']);self.assertEqual(a['scenarioInputs'],b['scenarioInputs']);self.assertEqual(a['scenarioCoverage'],b['scenarioCoverage'])
   self.assertEqual(a['lifecycle'],b['lifecycle']);self.assertEqual(a['historySeries'],b['historySeries'])
   self.assertEqual(a['observations'][:len(b['observations'])],b['observations'])
   self.assertEqual(a['researchStatus']['identityCandidateCount'],b['researchStatus']['identityCandidateCount'])
   self.assertIn('complete_registered_sale_history',a['researchStatus']['gaps'])
   self.assertIn('direct_signed_rent_history',a['researchStatus']['gaps'])
   self.assertNotIn('direct_registered_sale_history',a['researchStatus']['gaps'])
if __name__=='__main__':unittest.main()
