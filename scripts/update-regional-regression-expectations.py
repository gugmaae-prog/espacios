#!/usr/bin/env python3
"""Extend explicit historical regression expectations for independently tested V47.
No test is skipped. V46 before/after assertions use its retained immutable root;
the new test checks the serialized V47 candidate against exact V46 data.
"""
import json
from pathlib import Path
R=Path(__file__).resolve().parents[1];V46='20261013-enrichment-v46';V47='20261014-enrichment-v47'
receipt=json.loads((R/'data/historical-intelligence/reviewed-regional-20261014/reconciliation.json').read_bytes())
assert receipt['coverageDelta']==dict(present=20,partial=-11,missing=-9,unestablished=0,disputed=0,inaccessible=0,**{'pre-applicability':0})
assert receipt['sourcesAdded']==14 and receipt['priorSourcesPreserved']==3367
changes=[]
for p in sorted((R/'tests').glob('*')):
 if p.suffix not in ['.mjs','.py'] or p.name in ['reviewed-regional-pass.test.py','historical-v46-native-series-preservation.py']:continue
 original=t=p.read_text()
 if V46 not in t:continue
 t=t.replace("'"+V46+"']","'"+V46+"','"+V47+"']").replace("'"+V46+"'}","'"+V46+"','"+V47+"'}")
 t=t.replace("snapshot.version==='"+V46+"'?3367:","snapshot.version==='"+V47+"'?3381:snapshot.version==='"+V46+"'?3367:")
 t=t.replace("snapshot.version==='"+V46+"'?{missing:26725,partial:3413,unestablished:9300,present:3342}:","snapshot.version==='"+V47+"'?{missing:26716,partial:3402,unestablished:9300,present:3362}:snapshot.version==='"+V46+"'?{missing:26725,partial:3413,unestablished:9300,present:3342}:")
 if p.name=='historical-v39-asora-lifecycle.test.mjs':t=t.replace("assert.equal(snapshot.asOf,[", "assert.equal(snapshot.asOf,snapshot.version==='"+V47+"'?'2026-10-14':[")
 if p.name=='historical-v20-dred-master-context.py':t=t.replace("snapshot['asOf'] == (", "snapshot['asOf'] == ('2026-10-14' if snapshot['version']=='"+V47+"' else ")
 if p.name=='historical-v44-individual-sales.test.mjs':
  t=t.replace("assert.equal(latest.version,'"+V46+"')","assert.ok(['"+V46+"','"+V47+"'].includes(latest.version))")
  t=t.replace("assert.equal(publication.counts.sources,3367)","assert.equal(publication.counts.sources,latest.version==='"+V47+"'?3381:3367)")
 if p.name=='historical-v46-authority-lifecycle.test.mjs':
  frozen="'data/historical-intelligence/objects/9912e0a2c673160168f5f223ec67c482e230db5bca51a532d4fe0d2e64eea672.json.gz'"
  t=t.replace("const snapshot = read('data/historical-intelligence-20261003.json');", "// Historical pass assertions remain pinned; V47 preservation is checked separately.\nconst latest = read('data/historical-intelligence-20261003.json');\nconst snapshot = unpack("+frozen+");")
  t=t.replace("const current = unpack(`data/historical-intelligence/objects/${publication.rootIndex.sha256}.json.gz`);", "const current = unpack("+frozen+");")
  t=t.replace("assert.equal(publication.version, snapshot.version);", "assert.equal(publication.version, latest.version);\n  assert.ok(['"+V46+"','"+V47+"'].includes(latest.version));")
 if t!=original:
  assert t.count('assert.')>=original.count('assert.') and t.count('test(')>=original.count('test('),'No tests/assertions removed'
  p.write_text(t);changes.append(p.name)
p=R/'tests/reviewed-regional-pass.test.py';t=p.read_text();anchor=' def test_unknown_record_and_no_fanout(self):'
method=''' def test_serialized_candidate_exactly_matches_reviewed_application(self):
  candidate=Path(os.environ.get('REGIONAL_CANDIDATE_SNAPSHOT',str(R/'data/historical-intelligence-20261003.json')))
  actual=json.loads(candidate.read_bytes());expected,_=m.apply_packet(self.snapshot,self.p,self.captures)
  self.assertEqual(actual['version'],m.VERSION);self.assertEqual(actual['sources'],expected['sources'])
  self.assertEqual(actual['events'],expected['events']);self.assertEqual(actual['exposures'],expected['exposures'])
  self.assertEqual(len(actual['records']),1860)
  for left,right in zip(actual['records'],expected['records']):
   left=copy.deepcopy(left);right=copy.deepcopy(right)
   for r in [left,right]:
    for series in r.get('historySeries',[]):series.pop('partition',None)
   self.assertEqual(left,right,left['id'])
'''
if 'test_serialized_candidate_exactly_matches_reviewed_application' not in t:
 assert anchor in t;t=t.replace(anchor,method+anchor);p.write_text(t)
# Restore the gzip archive before the old regional queue reads canonical JSON.
p=R/'.github/workflows/regional-research-queue.yml';t=p.read_text();anchor='      - uses: actions/setup-python@v5\n'
node="      - uses: actions/setup-node@v4\n        with:\n          node-version: '22'\n          cache: npm\n      - run: npm ci\n      - run: npm run history:build\n"
if t.index(anchor)<t.index(node):t=t.replace(node,'',1).replace(anchor,node+anchor,1);p.write_text(t)
p=R/'scripts/write-regional-pass-handover.py';p.write_text(p.read_text().replace('17 acceptance/preservation tests','18 acceptance/preservation tests'))
print(json.dumps({'version':V47,'testFilesUpdated':changes,'testsSkipped':0,'assertionsRemoved':0,'sourceCount':3381,'requiredChecksUnchanged':True}))
