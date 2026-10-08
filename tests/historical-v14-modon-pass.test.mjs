import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {annualScenarios,filterTrainingFold,isAvailableAsOf} from '../src/historical-intelligence/core.mjs';

const packet=JSON.parse(fs.readFileSync('enrichment/v14/pass37-modon-primary.json','utf8'));
const v14Receipt=JSON.parse(fs.readFileSync('docs/verification/history-v14-2026-10-07/live-verification.json','utf8'));
const snapshot=JSON.parse(fs.readFileSync('data/historical-intelligence-20261003.json','utf8'));
const records=new Map(snapshot.records.map(r=>[r.id,r]));
const priorHash='1b2e552ce4075c58a7758b5d4cd480019875ece00074fd4b60985d92534a6111';
const priorBytes=fs.readFileSync(`data/historical-intelligence/objects/${priorHash}.json.gz`);
const previous=JSON.parse(gunzipSync(priorBytes));

const ids={
 tara:'project:tara-park-modon-reem-island-abu-dhabi',
 maysan:'community:Abu Dhabi:maysan-al-reem-island',
 muheira:'project:apartments-muheira-maysan-abu-dhabi',
 village:'project:nawayef-village-modon-hudayriyat-island-abu-dhabi'
};

test('V14 preserves the immutable reviewed base and all previously tested releases',()=>{
 assert.equal(createHash('sha256').update(priorBytes).digest('hex'),priorHash);
 assert.equal(previous.version,'20261007-enrichment-v11');
 assert.ok(['20261007-enrichment-v14','20261007-enrichment-v15','20261007-enrichment-v16','20261007-enrichment-v17','20261007-enrichment-v18','20261007-enrichment-v19','20261008-enrichment-v20','20261008-enrichment-v21'].includes(snapshot.version));
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
 for(const source of previous.sources)assert.deepEqual(sources.get(source.id),source,source.id);
 for(const source of packet.sources)assert.ok(sources.has(source.id),source.id);
 for(const fact of packet.facts){
  const record=records.get(fact.recordId);
  assert.ok([...(record.lifecycle||[]),...(record.observations||[]),...(record.registerEvidence||[])].some(x=>x.id===fact.id),fact.id);
 }
});

test('V14 adds eight checksum-recorded Modon sources and fifteen exact bounded facts',()=>{
 assert.equal(packet.sources.length,8);
 assert.equal(packet.facts.length,15);
 assert.equal(packet.recordResearch.length,4);
 assert.deepEqual([...new Set(packet.facts.map(f=>f.recordId))].sort(),Object.values(ids).sort());
 for(const source of packet.sources){
  assert.equal(new URL(source.url).hostname,'www.modon.com');
  assert.match(source.sha256,/^[a-f0-9]{64}$/);
  assert.ok(source.bytes>20000);
  assert.equal(source.httpStatus,200);
  assert.equal(source.rawBodyRedistributed,false);
  assert.equal(source.primaryEvidence,true);
 }
 const contract=packet.sources.find(s=>s.id==='v14-src-modon-maysan-contract');
 const village=packet.sources.find(s=>s.id==='v14-src-modon-village-sellout');
 assert.match(contract.dateCaveat,/11 December.*12 December/);
 assert.match(village.dateCaveat,/9 May.*8 May/);
});

test('V14 closes exactly seven supported checklist cells in the fixed ledger',()=>{
 assert.deepEqual(v14Receipt.ledger.statuses,{missing:27568,partial:3433,unestablished:9300,present:2479});
 for(const [recordId,key] of [
  [ids.maysan,'announcement_registration'],[ids.maysan,'phase_milestones'],
  [ids.tara,'advertised_prices'],[ids.tara,'original_launch'],[ids.tara,'phase_milestones'],
  [ids.village,'advertised_prices'],[ids.village,'phase_milestones']
 ])assert.equal(records.get(recordId).researchStatus.itemCoverage[key].status,'present',recordId+' '+key);
 assert.equal(records.get(ids.maysan).researchStatus.itemCoverage.construction.status,'missing');
 assert.equal(records.get(ids.muheira).researchStatus.itemCoverage.registered_sale_history.status,'missing');
});

test('historical availability, month precision and source identity remain explicit',()=>{
 const tara=records.get(ids.tara);
 const launch=tara.lifecycle.find(x=>x.id==='v14-tara-first-phase-launch');
 const phase1=tara.lifecycle.find(x=>x.id==='v14-tara-phase-one-launch');
 const phase2=tara.lifecycle.find(x=>x.id==='v14-tara-phase-two-launch');
 assert.deepEqual(launch.date,{start:'2026-03',precision:'month'});
 assert.deepEqual(phase1.date,{start:'2026-03',precision:'month'});
 assert.deepEqual(phase2.date,{start:'2026-04',precision:'month'});
 assert.equal(launch.firstAvailableAt,'2026-10-07T09:51:52.021893+00:00');
 assert.equal(isAvailableAsOf(launch,'2026-03-31',new Map(snapshot.sources.map(s=>[s.id,s]))),false);
 assert.equal(isAvailableAsOf(launch,'2026-10-07',new Map(snapshot.sources.map(s=>[s.id,s]))),true);
 assert.equal(launch.scope,'subject');
 assert.equal(phase1.scope,'subject_phase');
});

test('advertisements and aggregate totals stay outside transactions, valuations and forecasts',()=>{
 const financial=packet.facts.filter(f=>f.kind==='financial');
 assert.equal(financial.length,6);
 const advertisements=financial.filter(f=>f.observation.observationKind==='developer_advertised_price');
 const aggregates=financial.filter(f=>f.observation.observationKind==='developer_reported_aggregate_sales');
 assert.equal(advertisements.length,4);
 assert.equal(aggregates.length,2);
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
 assert.deepEqual(records.get(ids.tara).currentSnapshot,previous.records.find(r=>r.id===ids.tara).currentSnapshot);
 assert.notEqual(records.get(ids.village).currentSnapshot.observationId,'v14-village-current-price');
});
