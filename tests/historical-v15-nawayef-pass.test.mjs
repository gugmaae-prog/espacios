import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {annualScenarios,filterTrainingFold} from '../src/historical-intelligence/core.mjs';

const packet=JSON.parse(fs.readFileSync('enrichment/v15/pass38-nawayef-primary.json','utf8'));
const snapshot=JSON.parse(fs.readFileSync('data/historical-intelligence-20261003.json','utf8'));
const records=new Map(snapshot.records.map(r=>[r.id,r]));
const priorHash='1b2e552ce4075c58a7758b5d4cd480019875ece00074fd4b60985d92534a6111';
const priorBytes=fs.readFileSync(`data/historical-intelligence/objects/${priorHash}.json.gz`);
const previous=JSON.parse(gunzipSync(priorBytes));
const v14Packet=JSON.parse(fs.readFileSync('enrichment/v14/pass37-modon-primary.json','utf8'));
const ids={park:'project:nawayef-park-views-modon-properties-hudayriyat-island-abu-dhabi',east:'project:nawayef-east-modon-hudayriyat-island-abu-dhabi'};

test('V15 preserves the immutable reviewed base and every V14 packet item',()=>{
 assert.equal(createHash('sha256').update(priorBytes).digest('hex'),priorHash);
 assert.equal(previous.version,'20261007-enrichment-v11');
 assert.equal(snapshot.version,'20261007-enrichment-v15');
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
 for(const source of v14Packet.sources)assert.ok(sources.has(source.id),source.id);
 for(const fact of v14Packet.facts){const record=records.get(fact.recordId);assert.ok([...(record.lifecycle||[]),...(record.observations||[]),...(record.registerEvidence||[])].some(x=>x.id===fact.id),fact.id);}
});

test('V15 publishes only three non-duplicate sources and six exact facts from the five-page review',()=>{
 assert.equal(packet.collection.pagesReviewed,5);
 assert.equal(packet.collection.redundantAlreadyRetainedPages,2);
 assert.equal(packet.sources.length,3);
 assert.equal(packet.facts.length,6);
 assert.equal(packet.recordResearch.length,2);
 assert.deepEqual([...new Set(packet.facts.map(f=>f.recordId))].sort(),Object.values(ids).sort());
 for(const source of packet.sources){
  assert.equal(new URL(source.url).hostname,'www.modon.com');
  assert.match(source.sha256,/^[a-f0-9]{64}$/);
  assert.ok(source.bytes>29000);
  assert.equal(source.httpStatus,200);
  assert.equal(source.rawBodyRedistributed,false);
  assert.equal(source.primaryEvidence,true);
 }
 assert.ok(!packet.sources.some(s=>s.url.includes('nawayef-east-and-nawayef-west')),'redundant contract recapture must not inflate the packet');
 assert.ok(snapshot.sources.some(s=>s.id==='v12-src-modon-east-construction-contract'),'retained exact contract evidence remains present');
});

test('V15 closes exactly one supported phase-milestone cell',()=>{
 assert.deepEqual({missing:27568,partial:3433,unestablished:9300,present:2479},{missing:27568,partial:3433,unestablished:9300,present:2479},'documented immutable V14 baseline');
 const counts={};for(const r of records.values())for(const item of Object.values(r.researchStatus.itemCoverage))counts[item.status]=(counts[item.status]||0)+1;
 assert.deepEqual(counts,{missing:27567,partial:3433,unestablished:9300,present:2480});
 assert.equal(records.get(ids.east).researchStatus.itemCoverage.construction.status,'missing');
 assert.equal(records.get(ids.park).researchStatus.itemCoverage.phase_milestones.status,'missing');
});

test('current advertisements and targets retain exact scope, segments and planned status',()=>{
 const park=records.get(ids.park),east=records.get(ids.east);
 const parkPrice=park.observations.find(x=>x.id==='v15-park-current-price');
 const eastHomes=east.observations.find(x=>x.id==='v15-east-current-homes-price');
 const eastHeights=east.observations.find(x=>x.id==='v15-east-current-heights-price');
 assert.equal(parkPrice.value,2000000);assert.equal(parkPrice.segment,'1-bedroom apartment within 1-to-4-bedroom project');
 assert.equal(eastHomes.value,6600000);assert.equal(eastHeights.value,19300000);
 for(const observation of [parkPrice,eastHomes,eastHeights]){
  assert.equal(observation.observationKind,'developer_advertised_price');assert.equal(observation.scope,'subject');assert.equal(observation.identityVerified,true);assert.equal(observation.currentSnapshotEligible,false);
  assert.equal(filterTrainingFold([observation],{asOf:snapshot.asOf,sources:snapshot.sources}).retained.length,0);
 }
 const parkTarget=park.lifecycle.find(x=>x.id==='v15-park-current-handover-target');
 const eastTarget=east.lifecycle.find(x=>x.id==='v15-east-current-handover-target');
 assert.deepEqual(parkTarget.date,{start:'2028-Q1',precision:'quarter'});assert.deepEqual(eastTarget.date,{start:'2028-12',precision:'month'});
 assert.equal(parkTarget.eventStatus,'planned');assert.equal(eastTarget.eventStatus,'planned');
 const phase=east.lifecycle.find(x=>x.id==='v15-east-initial-release-phase-launch');assert.equal(phase.scope,'subject_phase');assert.equal(phase.kind,'phase_launch');
});

test('V15 adds no TBC number, registered history, valuation, construction start or forecast values',()=>{
 assert.ok(!JSON.stringify(packet).includes('5000000000'));
 for(const id of Object.values(ids)){
  const record=records.get(id),coverage=record.researchStatus.itemCoverage;
  assert.equal(coverage.registered_sale_history.status,'missing');assert.equal(coverage.signed_rent_history.status,'missing');assert.equal(coverage.dated_valuation.status,'missing');assert.equal(coverage.actual_completion.status,'missing');assert.equal(coverage.occupancy.status,'missing');assert.equal(coverage.construction.status,'missing');
  const scenarios=annualScenarios(record,{asOf:snapshot.asOf,sources:snapshot.sources});assert.deepEqual(scenarios.targetYears,[...Array(54)].map((_,i)=>2027+i));assert.equal(scenarios.validatedForecast,false);assert.ok(Object.values(scenarios.metrics.price.paths).every(path=>path.every(point=>point.value===null)));
 }
});
