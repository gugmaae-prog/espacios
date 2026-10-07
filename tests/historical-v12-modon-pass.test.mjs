import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {filterTrainingFold,annualScenarios} from '../src/historical-intelligence/core.mjs';

const packet=JSON.parse(fs.readFileSync('enrichment/v12/pass35-modon-primary.json','utf8'));
const snapshot=JSON.parse(fs.readFileSync('data/historical-intelligence-20261003.json','utf8'));
const records=new Map(snapshot.records.map(r=>[r.id,r]));
const priorHash='1b2e552ce4075c58a7758b5d4cd480019875ece00074fd4b60985d92534a6111';
const priorBytes=fs.readFileSync(`data/historical-intelligence/objects/${priorHash}.json.gz`);
const previous=JSON.parse(gunzipSync(priorBytes));

test('V12 preserves every V11 record, observation, milestone, source and selected quote',()=>{
 assert.equal(createHash('sha256').update(priorBytes).digest('hex'),priorHash);
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
});

test('Modon pass closes only specific launch, announcement and advertised-price requirements',()=>{
 assert.equal(packet.facts.length,13);assert.equal(packet.sources.length,7);
 const before=new Map(previous.records.map(r=>[r.id,r]));
 const transitions=[];
 for(const [id,r] of records){
  for(const [key,item] of Object.entries(r.researchStatus.itemCoverage)){
   const old=before.get(id).researchStatus.itemCoverage[key];
   if(item.status!==old.status)transitions.push([id,key,old.status,item.status]);
  }
 }
 assert.equal(transitions.length,11);
 assert.ok(transitions.every(([,key,from,to])=>['original_launch','announcement_registration','advertised_prices'].includes(key)&&from==='missing'&&to==='present'));
 for(const f of packet.facts.filter(f=>f.milestone==='launch')){
  const r=records.get(f.recordId);
  assert.equal(r.researchStatus.itemCoverage.original_launch.status,'present');
  for(const key of ['construction','actual_completion','occupancy','registered_sale_history','signed_rent_history','dated_current_valuation'])assert.equal(r.researchStatus.itemCoverage[key].status,'missing');
 }
 assert.equal(records.get('community:Abu Dhabi:hudayriyat-island').researchStatus.itemCoverage.original_launch.status,'missing');
 assert.ok(packet.facts.every(f=>!f.recordId.startsWith('adrec:')),'No unreviewed registration/phase fan-out');
});

test('Historical launch asking quotes cannot become current prices, transactions or old backtest inputs',()=>{
 const quotes=packet.facts.filter(f=>f.kind==='financial');
 assert.deepEqual(quotes.map(f=>f.observation.value),[1200000,2000000,6600000]);
 for(const f of quotes){
  const r=records.get(f.recordId),o=r.observations.find(x=>x.id===f.id);
  assert.equal(o.observationKind,'developer_advertised_price');
  assert.equal(o.currentSnapshotEligible,false);
  assert.equal(o.firstAvailableAt,'2026-10-07');
  assert.equal(filterTrainingFold([o],{asOf:'2026-10-06',sources:snapshot.sources}).retained.length,0);
  assert.equal(filterTrainingFold([o],{asOf:snapshot.asOf,sources:snapshot.sources}).retained.length,0);
  const scenarios=annualScenarios(r,{asOf:snapshot.asOf,sources:snapshot.sources});
  assert.equal(scenarios.targetYears.length,54);assert.equal(scenarios.targetYears.at(-1),2080);
  assert.equal(scenarios.validatedForecast,false);
  assert.ok(Object.values(scenarios.metrics.price.paths).every(path=>path.every(p=>p.value===null)));
 }
 for(const source of packet.sources){
  assert.equal(new URL(source.url).hostname,'www.modon.com');
  assert.match(source.sha256,/^[a-f0-9]{64}$/);assert.equal(source.rawBodyRedistributed,false);
  assert.equal(source.firstAvailableAt,'2026-10-07');
 }
});
