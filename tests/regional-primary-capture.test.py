import importlib.util,json,unittest
from pathlib import Path
R=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('capture',R/'scripts/capture-regional-primary-pass.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class Capture(unittest.TestCase):
 def source(self):return dict(id='test',extractMode='html',identityNeedles=['Exact Project'],reviewedPhrases=[])
 def test_raw_excluded(self):
  raw=b'<title>Exact Project</title><h1>Exact Project</h1><script>PRIVATE_RAW</script>Starting Prices: AED 2.33 M';a=m.normalize(raw,self.source());self.assertNotIn('PRIVATE_RAW',json.dumps(a));self.assertEqual(a['numericMentions'][0]['amount'],'2.33');self.assertEqual(a['numericMentions'][0]['scale'],'M')
 def test_no_invented_prices(self):self.assertEqual(m.normalize(b'<p>No price stated</p>',self.source())['numericMentions'],[])
 def test_directory_adjacency(self):
  src=dict(self.source(),id='reportage-directory');a=m.normalize(b'Oceana Fujairah Studio From AED530k Marlin 2 Abu Dhabi From AED1.6M',src);self.assertEqual(a['cards'],[dict(sourceName='Oceana',amount='530',scale='k',currency='AED'),dict(sourceName='Marlin 2',amount='1.6',scale='M',currency='AED')])
 def test_private_adrec_fields_excluded(self):
  a=m.normalize(json.dumps({'Success':True,'Data':{'Result':{'Id':624,'ProjectNumber':'exact','IBAN':'PRIVATE_ACCOUNT','LatestReport':{'InspectionDate':'2026-10-01','CompletionPercentage':3}}}}).encode(),{'extractMode':'adrec'});self.assertNotIn('PRIVATE_ACCOUNT',json.dumps(a));self.assertEqual(a['authorityId'],624)
 def test_source_plans_bounded(self):
  plans=json.loads((R/'data/historical-intelligence/reviewed-regional-20261014/source-targets.json').read_text());self.assertEqual(sum(len(v) for v in plans.values()),33)
  for rows in plans.values():
   self.assertLessEqual(len(rows),20);self.assertEqual(len({r[1] for r in rows}),len(rows))
   for row in rows:self.assertLessEqual(len(' '.join(row[6]).split()),25)
if __name__=='__main__':unittest.main(verbosity=2)
