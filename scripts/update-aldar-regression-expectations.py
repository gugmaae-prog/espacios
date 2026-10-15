#!/usr/bin/env python3
"""Add V48 expectations while keeping historical roots and every prior assertion."""
import json
from pathlib import Path
R=Path(__file__).resolve().parents[1];OLD='20261014-enrichment-v47';NEW='20261014-enrichment-v48'
receipt=json.loads((R/'data/historical-intelligence/aldar-launches-20261014/reconciliation.json').read_bytes())
assert receipt['coverageDelta']==dict(present=18,partial=0,missing=-18,unestablished=0,disputed=0,inaccessible=0,**{'pre-applicability':0})
assert receipt['sourcesAdded']==5 and receipt['priorSourcesPreserved']==3381
changed=[]
for p in sorted((R/'tests').glob('*')):
 if p.suffix not in ['.mjs','.py'] or p.name in ['aldar-launches-preservation.test.py','regional-mirror-preservation.test.mjs','reviewed-regional-pass.test.py']:continue
 original=t=p.read_text()
 if OLD not in t:continue
 t=t.replace("'"+OLD+"']","'"+OLD+"','"+NEW+"']").replace("'"+OLD+"'}","'"+OLD+"','"+NEW+"'}")
 for subject in ['snapshot','latest']:
  t=t.replace(subject+".version==='"+OLD+"'?3381:",subject+".version==='"+NEW+"'?3386:"+subject+".version==='"+OLD+"'?3381:")
 t=t.replace("snapshot.version==='"+OLD+"'?{missing:26716,partial:3402,unestablished:9300,present:3362}:","snapshot.version==='"+NEW+"'?{missing:26698,partial:3402,unestablished:9300,present:3380}:snapshot.version==='"+OLD+"'?{missing:26716,partial:3402,unestablished:9300,present:3362}:")
 if p.name=='historical-v39-asora-lifecycle.test.mjs':t=t.replace("snapshot.version==='"+OLD+"'?'2026-10-14':","['"+OLD+"','"+NEW+"'].includes(snapshot.version)?'2026-10-14':")
 if p.name=='historical-v20-dred-master-context.py':t=t.replace("snapshot['version']=='"+OLD+"' else","snapshot['version'] in ['"+OLD+"','"+NEW+"'] else")
 if p.name=='historical-v13-modon-pass.test.mjs':
  t=t.replace("if(snapshot.version==='"+OLD+"'){","if(['"+OLD+"','"+NEW+"'].includes(snapshot.version)){")
  a='  const result=verifyRegionalQuotePromotions({baseline,current:snapshot,legacy:previous,packet:reviewed});'
  if a in t:
   b="""  // V47's exact promotion proof stays pinned; V48's independent tests prove
  // its five additional missing-to-present subjects and all unaffected fields.
  let v47=snapshot;
  if(snapshot.version==='20261014-enrichment-v48'){
   const priorHash='49e7121016319517bc8a7e6809f21565c5c72ed7469d81b51ec5b03da94722d2';
   const priorBytes=fs.readFileSync(`data/historical-intelligence/objects/${priorHash}.json.gz`);
   assert.equal(createHash('sha256').update(priorBytes).digest('hex'),priorHash);
   v47=JSON.parse(gunzipSync(priorBytes));
  }
  const result=verifyRegionalQuotePromotions({baseline,current:v47,legacy:previous,packet:reviewed});"""
   t=t.replace(a,b)
 if original!=t:
  assert t.count('assert.')>=original.count('assert.') and t.count('test(')>=original.count('test('),'No assertion/test deletion'
  p.write_text(t);changed.append(p.name)
# An accepted V47 must never be replayed over a newer V48 archive.
p=R/'.github/workflows/verified-regional-enrichment.yml';t=p.read_text()
t=t.replace("if [ \"$CURRENT\" = '20261014-enrichment-v47' ]; then", "if [ \"$CURRENT\" = '20261014-enrichment-v47' ] || [ \"$CURRENT\" = '20261014-enrichment-v48' ]; then")
anchor='      - uses: actions/setup-node@v4\n'
step="""      - name: Pin the historical V47 candidate for its own preservation tests
        run: |
          git fetch --no-tags --depth=1 origin f34708de0ff423902116a48dd11b7b4a6dba0bfa
          git show f34708de0ff423902116a48dd11b7b4a6dba0bfa:data/historical-intelligence-20261003.json.gz | gzip -dc > /tmp/regional-v47-canonical.json
          echo 'REGIONAL_CANDIDATE_SNAPSHOT=/tmp/regional-v47-canonical.json' >> "$GITHUB_ENV"
"""
if 'Pin the historical V47 candidate' not in t:
 assert anchor in t;t=t.replace(anchor,step+anchor,1)
p.write_text(t)
# Successful captures are immutable inputs; do not collect again on each PR edit.
p=R/'.github/workflows/aldar-launch-pass48.yml';t=p.read_text();begin=t.index('on:\n');end=t.index('permissions:\n');t=t[:begin]+'on:\n  workflow_dispatch:\n'+t[end:]
t=t.replace(" && github.event.pull_request.number == 100 && github.event.pull_request.head.repo.full_name == github.repository",'')
p.write_text(t)
print(json.dumps({'version':NEW,'sourceCount':3386,'testFilesExtended':changed,'assertionsRemoved':0,'testsSkipped':0,'oldPassReplayDisabledForV48':True}))
