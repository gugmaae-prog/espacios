import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const packet=JSON.parse(await fs.readFile('enrichment/v11/pass22-arada-primary.json','utf8'));

test('Arada pass 22 uses only first-party sources and no invented financial history',()=>{
  assert.equal(packet.sources.length,6);
  assert.equal(packet.facts.length,11);
  assert.ok(packet.sources.every(s=>new URL(s.url).hostname.endsWith('arada.com')));
  assert.ok(packet.facts.every(f=>f.kind==='lifecycle'));
  assert.ok(packet.facts.every(f=>f.primaryEvidence===true));
});

test('Arada pass 22 clears only milestone coverage in synthetic records',()=>{
 const code=String.raw`
import json,sys
sys.path.insert(0,'scripts')
from historical_enrichment import apply_enrichment
packet=json.load(open('enrichment/v11/pass22-arada-primary.json'))
ids=sorted({x['recordId'] for x in packet['recordResearch']})
def rec(i):
 return {'id':i,'emirate':'Sharjah','type':'project','name':i,'lifecycle':[],'observations':[],'historySeries':[],'researchStatus':{'gaps':['verified_launch_date','actual_completion_date','direct_registered_sale_history','direct_signed_rent_history','dated_current_valuation']},'currentSnapshot':{'askingPriceAED':1},'coverageSummary':{}}
records=[rec(i) for i in ids];sources={}
def source(x):sources[x['id']]=dict(x)
apply_enrichment(packet,records,{},sources,source,{},'2026-10-06')
by={x['id']:x for x in records}
for rid in ids:
 assert by[rid]['researchStatus']['itemCoverage']['original_launch']['status']=='present'
 assert by[rid]['researchStatus']['itemCoverage']['announcement_registration']['status']=='present'
 assert by[rid]['researchStatus']['itemCoverage']['registered_sale_history']['status']=='missing'
 assert by[rid]['researchStatus']['itemCoverage']['signed_rent_history']['status']=='missing'
 assert by[rid]['researchStatus']['itemCoverage']['validated_price_forecast']['status']=='unestablished'
for rid in [
 'project:arada-masaar-kaya-villas-and-townhouses-for-sale-in-sharjah',
 'project:arada-masaar-robinia-villas-and-townhouses-in-sharjah-for-sale-uae'
]:
 assert by[rid]['researchStatus']['itemCoverage']['construction']['status']=='present'
 assert by[rid]['researchStatus']['itemCoverage']['phase_milestones']['status']=='present'
vida=by['project:arada-vida-residences-aljada-sharjah-for-sale-in-uae']
assert vida['researchStatus']['itemCoverage']['delivery_reports']['status']=='present'
`;
 const out=spawnSync('python3',['-c',code],{encoding:'utf8'});
 assert.equal(out.status,0,out.stderr||out.stdout);
});
