import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const packetPath='enrichment/v10/pass21-primary-source.json';
const packet=JSON.parse(await fs.readFile(packetPath,'utf8'));

test('v10 primary pass is attributable and preserves quote/forecast boundaries',()=>{
  assert.equal(packet.schemaVersion,1);
  assert.equal(packet.asOf,'2026-10-06');
  assert.equal(packet.sources.length,7);
  assert.equal(packet.facts.length,17);
  assert.ok(packet.sources.every(s=>String(s.url).startsWith('https://')));
  assert.ok(packet.sources.every(s=>s.retrievedAt==='2026-10-06'));
  const quote=packet.facts.find(f=>f.id==='v10-trussardi-2br-asking');
  assert.equal(quote.observation.bedrooms,'2');
  assert.equal(quote.observation.currentSnapshotEligible,false);
  assert.equal(packet.facts.some(f=>f.kind==='financial'&&f.scope==='subject'),false);
  assert.equal(packet.facts.some(f=>/forecast/i.test(JSON.stringify(f))),false);
});

test('v10 primary pass clears only source-supported coverage in a synthetic integration',()=>{
  const code=String.raw`
import json,sys
sys.path.insert(0,'scripts')
from historical_enrichment import apply_enrichment
packet=json.load(open('enrichment/v10/pass21-primary-source.json'))
ids=sorted({x['recordId'] for x in packet.get('recordResearch',[])})
def rec(i):
 return {'id':i,'emirate':'Dubai','type':'project','name':i,'lifecycle':[],'observations':[],'historySeries':[],'researchStatus':{'gaps':['verified_launch_date','actual_completion_date','direct_registered_sale_history','direct_signed_rent_history','dated_current_valuation']},'currentSnapshot':{'askingPriceAED':1400000},'coverageSummary':{}}
records=[rec(i) for i in ids];sources={}
def source(x):sources[x['id']]=dict(x)
apply_enrichment(packet,records,{},sources,source,{},'2026-10-06')
by={x['id']:x for x in records}
expected_launch=[
 'project:apartments-and-duplexes-avenue-park-towers-wasl-1-dubai',
 'project:woodland-crest-amis-meydan-dubai',
 'project:regent-residences-dubai-sankari-place',
 'project:trussardi-residences-by-luxury-living-group-and-mira-developments',
 'project:derby-heights-amis-meydan-dubai'
]
for rid in expected_launch:
 assert by[rid]['researchStatus']['itemCoverage']['original_launch']['status']=='present'
 assert by[rid]['researchStatus']['itemCoverage']['announcement_registration']['status']=='present'
tr=by['project:trussardi-residences-by-luxury-living-group-and-mira-developments']
assert tr['researchStatus']['itemCoverage']['construction']['status']=='present'
assert tr['currentSnapshot']['askingPriceAED']==1400000
assert any(x.get('id')=='v10-trussardi-2br-asking' and x.get('value')==3500000 for x in tr['observations'])
el=by['project:apartments-elemental-22-jumeirah-garden-city-dubai']
assert el['researchStatus']['itemCoverage']['original_launch']['status']=='missing'
assert el['researchStatus']['itemCoverage']['construction']['status']=='missing'
for r in records:
 assert r['researchStatus']['itemCoverage']['validated_price_forecast']['status']=='unestablished'
 assert r['researchStatus']['itemCoverage']['actual_completion']['status']=='missing'
`;
  const out=spawnSync('python3',['-c',code],{encoding:'utf8'});
  assert.equal(out.status,0,out.stderr||out.stdout);
});
