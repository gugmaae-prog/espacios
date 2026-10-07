import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {annualScenarios,filterTrainingFold} from '../src/historical-intelligence/core.mjs';

const packet=JSON.parse(fs.readFileSync('enrichment/v13/pass36-modon-primary.json','utf8'));
const v12Packet=JSON.parse(fs.readFileSync('enrichment/v12/pass35-modon-primary.json','utf8'));
const snapshot=JSON.parse(fs.readFileSync('data/historical-intelligence-20261003.json','utf8'));
const records=new Map(snapshot.records.map(r=>[r.id,r]));
const priorHash='1b2e552ce4075c58a7758b5d4cd480019875ece00074fd4b60985d92534a6111';
const priorBytes=fs.readFileSync(`data/historical-intelligence/objects/${priorHash}.json.gz`);
const previous=JSON.parse(gunzipSync(priorBytes));

test('V13 preserves the immutable V11 base and every retained V12 packet item',()=>{
 assert.equal(createHash('sha256').update(priorBytes).digest('hex'),priorHash);
 assert.equal(snapshot.version,'20261007-enrichment-v13');
 assert.equal(snapshot.records.length,1860);
 assert.deepEqual([...records.keys()].sort(),previous.records.map(r=>r.id).sort());
 for(const old of previous.records){
  const now=records.get(old.id);
  for(const key of ['lifecycle','observations','registerEvidence']){
   const byId=new Map((now[key]||[]).map(v=>[v.id,v]));
   for(const value of old[key]||[])assert.deepEqual(byId.get(value.id),value,old.id+' '+key);
  }
  assert.deepEqual(now.currentSnapshot,old.currentSnapshot,old.id+' current quote');
  for(const id of old.historySeriesIds)assert.ok(now.historySeries.some(s=>s.id===id),old.id+' history link');
 }
 const sources=new Map(snapshot.sources.map(s=>[s.id,s]));
 for(const s of previous.sources)assert.deepEqual(sources.get(s.id),s,s.id);
 for(const s of v12Packet.sources)assert.ok(sources.has(s.id),s.id);
 for(const f of v12Packet.facts){
  const record=records.get(f.recordId);
  assert.ok([...(record.lifecycle||[]),...(record.observations||[]),...(record.registerEvidence||[])].some(x=>x.id===f.id),f.id);
 }
});

test('V13 adds five exact Modon sources and eighteen bounded facts without identity fan-out',()=>{
 assert.equal(packet.sources.length,5);
 assert.equal(packet.facts.length,18);
 assert.equal(packet.recordResearch.length,3);
 assert.ok(packet.facts.every(f=>!f.recordId.startsWith('adrec:')));
 assert.deepEqual([...new Set(packet.facts.map(f=>f.recordId))].sort(),[
  'project:bashayer-final-phase-modon-hudayriyat-island-abu-dhabi',
  'project:hudayriyat-golf-estates-modon-abu-dhabi',
  'project:tara-park-modon-reem-island-abu-dhabi'
 ]);
 for(const source of packet.sources){
  assert.equal(new URL(source.url).hostname,'www.modon.com');
  assert.match(source.sha256,/^[a-f0-9]{64}$/);
  assert.equal(source.rawBodyRedistributed,false);
  assert.match(source.classification,/^primary_developer_/);
 }
});

test('V13 closes only three supported requirements and demotes mirror-only quote coverage',()=>{
 const before=new Map(previous.records.map(r=>[r.id,r]));
 const transitions=[];
 for(const [id,r] of records)for(const [key,item] of Object.entries(r.researchStatus.itemCoverage)){
  const old=before.get(id).researchStatus.itemCoverage[key];
  if(item.status!==old.status)transitions.push([id,key,old.status,item.status]);
 }
 const v13Closures=transitions.filter(([id,key,from,to])=>packet.facts.some(f=>f.recordId===id)&&from==='missing'&&to==='present');
 assert.deepEqual(v13Closures.sort(),[
  ['project:bashayer-final-phase-modon-hudayriyat-island-abu-dhabi','phase_milestones','missing','present'],
  ['project:hudayriyat-golf-estates-modon-abu-dhabi','announcement_registration','missing','present'],
  ['project:hudayriyat-golf-estates-modon-abu-dhabi','original_launch','missing','present']
 ]);
 const corrections=transitions.filter(([,key,from,to])=>from==='present'&&to==='partial');
 assert.equal(corrections.length,1253);
 assert.ok(corrections.every(([,key])=>key==='advertised_prices'));
 assert.ok(corrections.every(([id])=>records.get(id).researchStatus.itemCoverage.advertised_prices.contextualQuoteCount>0));
 assert.equal(transitions.length,1267);
});

test('segmented prices and aggregate sales remain outside transactions, current quotes and forecast anchors',()=>{
 const financial=packet.facts.filter(f=>f.kind==='financial');
 assert.equal(financial.length,11);
 const aggregate=financial.filter(f=>f.observation.observationKind==='developer_reported_aggregate_sales');
 const advertisements=financial.filter(f=>f.observation.observationKind==='developer_advertised_price');
 assert.equal(aggregate.length,3);assert.equal(advertisements.length,8);
 for(const fact of financial){
  const record=records.get(fact.recordId);
  const observation=record.observations.find(o=>o.id===fact.id);
  assert.ok(observation);
  assert.equal(observation.currentSnapshotEligible,false);
  assert.equal(observation.scope,'subject');
  assert.equal(observation.identityVerified,true);
  assert.equal(filterTrainingFold([observation],{asOf:snapshot.asOf,sources:snapshot.sources}).retained.length,0);
  assert.notEqual(record.researchStatus.itemCoverage.registered_sale_history.status,'present');
  assert.notEqual(record.researchStatus.itemCoverage.dated_valuation.status,'present');
  const scenarios=annualScenarios(record,{asOf:snapshot.asOf,sources:snapshot.sources});
  assert.deepEqual(scenarios.targetYears,[...Array(54)].map((_,i)=>2027+i));
  assert.equal(scenarios.validatedForecast,false);
 assert.ok(Object.values(scenarios.metrics.price.paths).every(path=>path.every(p=>p.value===null)));
 }
 const aggregateAnchor=records.get(aggregate[0].recordId).observations.find(o=>o.id===aggregate[0].id);
 const synthetic={...records.get(aggregate[0].recordId),scenarioInputs:{priceAnchor:aggregateAnchor,assumptions:{annualPriceGrowthPct:{downside:0,base:0,upside:0}}}};
 const rejected=annualScenarios(synthetic,{asOf:snapshot.asOf,sources:snapshot.sources});
 assert.ok(Object.values(rejected.metrics.price.paths).every(path=>path.every(p=>p.value===null)));
 assert.ok(!packet.facts.some(f=>f.id===records.get('project:hudayriyat-golf-estates-modon-abu-dhabi').currentSnapshot.observationId));
});
