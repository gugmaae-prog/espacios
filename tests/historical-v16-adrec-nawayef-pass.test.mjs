import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {annualScenarios,expandRecordObservations,filterTrainingFold} from '../src/historical-intelligence/core.mjs';

const packet=JSON.parse(fs.readFileSync('enrichment/v16/pass39-adrec-nawayef-primary.json','utf8'));
const snapshot=JSON.parse(fs.readFileSync('data/historical-intelligence-20261003.json','utf8'));
const records=new Map(snapshot.records.map(r=>[r.id,r]));
const v15Packet=JSON.parse(fs.readFileSync('enrichment/v15/pass38-nawayef-primary.json','utf8'));
const v15Receipt=JSON.parse(fs.readFileSync('docs/verification/history-v15-2026-10-07/live-verification.json','utf8'));
const input=packet.historyInputs[0],compressed=fs.readFileSync('data/historical-intelligence/'+input.path),raw=gunzipSync(compressed);
const lines=raw.toString('utf8').replace(/^\ufeff/,'').trim().split('\n');
const header=lines[0].split(','),rows=lines.slice(1).map(line=>{
  // Native JSON is the only quoted comma-rich field; reuse the built snapshot for
  // semantic assertions and parse just the RFC4180 source with a tiny state machine.
  const cells=[];let value='',quoted=false;
  for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){cells.push(value);value='';}else value+=c;}cells.push(value);
  return Object.fromEntries(header.map((key,i)=>[key,cells[i]]));
});
const ids={park:'project:nawayef-park-views-modon-properties-hudayriyat-island-abu-dhabi',east:'project:nawayef-east-modon-hudayriyat-island-abu-dhabi'};

function facts(record){return [...(record.lifecycle||[]),...(record.observations||[]),...(record.registerEvidence||[])];}

test('V16 preserves V15 facts, sources, record universe and current quotes',()=>{
 assert.equal(snapshot.version,'20261007-enrichment-v16');
 assert.equal(snapshot.records.length,1860);
 assert.equal(snapshot.records.filter(r=>r.type==='project').length,1645);
 assert.equal(snapshot.records.filter(r=>r.type==='community').length,215);
 const sources=new Map(snapshot.sources.map(s=>[s.id,s]));
 for(const source of v15Packet.sources)assert.ok(sources.has(source.id),source.id);
 for(const fact of v15Packet.facts)assert.ok(facts(records.get(fact.recordId)).some(x=>x.id===fact.id),fact.id);
 assert.equal(records.get(ids.park).currentSnapshot.observationId,JSON.parse(gunzipSync(fs.readFileSync('data/historical-intelligence/objects/1b2e552ce4075c58a7758b5d4cd480019875ece00074fd4b60985d92534a6111.json.gz'))).records.find(r=>r.id===ids.park).currentSnapshot.observationId);
});

test('seven authority captures and the 684-row derived input verify without raw envelopes or sensitive register fields',()=>{
 assert.equal(packet.sources.length,7);assert.equal(packet.facts.length,9);assert.equal(packet.seriesLinks.length,5);
 for(const source of packet.sources){assert.equal(new URL(source.url).hostname,'adrec.gov.ae');assert.equal(source.httpStatus,200);assert.match(source.sha256,/^[a-f0-9]{64}$/);assert.equal(source.rawBodyRedistributed,false);assert.equal(source.primaryEvidence,true);}
 assert.equal(createHash('sha256').update(compressed).digest('hex'),input.sha256);
 assert.equal(createHash('sha256').update(raw).digest('hex'),input.uncompressedSHA256);
 assert.equal(rows.length,684);assert.equal(input.uncompressedBytes,raw.length);
 assert.ok(!raw.toString('utf8').match(/EscrowIban|DeveloperEmail|DeveloperPhoneNumber/i));
 const native=rows.map(row=>JSON.parse(row['Native row JSON']));
 assert.equal(new Set(native.map(x=>x.adrecDirectoryId+':'+x.sourceRowIndex)).size,684);
 assert.deepEqual(Object.fromEntries([594,595,597].map(id=>[id,native.filter(x=>x.adrecDirectoryId===id).length])),{'594':181,'595':17,'597':486});
 assert.equal(native.filter(x=>x.sale_sequence==='primary').length,667);
 assert.equal(native.filter(x=>x.sale_sequence==='secondary').length,17);
 assert.equal(native.filter(x=>x.identicalAttributeCount>1).length,27);
 assert.ok(native.every(x=>x.transactionIdExposed===false&&x.unitIdentityExposed===false));
});

test('exact register identities, progress reports and subject cohorts retain native scope',()=>{
 const park=records.get(ids.park),east=records.get(ids.east);
 const expected={
  'adrec-v16-594-primary-registered-sale-aed':177,
  'adrec-v16-594-secondary-registered-sale-aed':4,
  'adrec-v16-595-primary-registered-sale-aed':17,
  'adrec-v16-597-primary-registered-sale-aed':473,
  'adrec-v16-597-secondary-registered-sale-aed':13
 };
 for(const [id,count] of Object.entries(expected)){
  const owners=[...records.values()].filter(r=>r.historySeries.some(s=>s.id===id));assert.equal(owners.length,1,id);
  const series=owners[0].historySeries.find(s=>s.id===id);assert.equal(series.pointCount,count);assert.equal(series.scope,'subject');assert.equal(series.identityVerified,true);assert.equal(series.unit,'AED');assert.equal(series.sourceMetric,'registered_sale_price_aed');
 }
 const parkRegister=park.registerEvidence.find(x=>x.id==='v16-adrec-park-register');
 assert.equal(parkRegister.registeredProjectId,'ADREC:594');assert.equal(parkRegister.fields.projectNumber,'20240000383164');assert.equal(parkRegister.fields.progressPercentage,8.87);assert.equal(parkRegister.fields.directorySoldSnapshot.soldCount,177);
 assert.equal(east.registerEvidence.find(x=>x.id==='v16-adrec-east-a-register').fields.projectNumber,'20240000407514');
 assert.equal(east.registerEvidence.find(x=>x.id==='v16-adrec-east-b-register').fields.projectNumber,'20240000407520');
 assert.equal(park.lifecycle.find(x=>x.id==='v16-adrec-park-progress').date.start,'2026-05-07');
 assert.equal(east.lifecycle.find(x=>x.id==='v16-adrec-east-a-progress').scope,'subject_phase');
 assert.equal(east.lifecycle.find(x=>x.id==='v16-adrec-east-b-progress').scope,'subject_phase');
});

test('V16 closes exactly three unresolved cells and keeps East construction phase-only',()=>{
 assert.deepEqual(v15Receipt.ledger.statuses,{missing:27567,unestablished:9300,partial:3433,present:2480});
 const counts={};for(const r of records.values())for(const item of Object.values(r.researchStatus.itemCoverage))counts[item.status]=(counts[item.status]||0)+1;
 assert.deepEqual(counts,{missing:27563,partial:3434,unestablished:9300,present:2483});
 assert.deepEqual(Object.fromEntries(Object.keys(counts).map(key=>[key,counts[key]-v15Receipt.ledger.statuses[key]])),{missing:-4,unestablished:0,partial:1,present:3});
 assert.equal(records.get(ids.park).researchStatus.itemCoverage.registered_sale_history.nativePointCount,181);
 assert.equal(records.get(ids.east).researchStatus.itemCoverage.registered_sale_history.nativePointCount,503);
 assert.equal(records.get(ids.park).researchStatus.itemCoverage.construction.status,'present');
 assert.equal(records.get(ids.east).researchStatus.itemCoverage.construction.status,'partial');
});

test('transaction availability, unresolved rents and null 2080 scenarios stay explicit',()=>{
 for(const id of Object.values(ids)){
  const record=records.get(id),observations=expandRecordObservations(record).filter(x=>String(x.seriesId||'').startsWith('adrec-v16'));
  assert.ok(observations.length>0);assert.equal(filterTrainingFold(observations,{asOf:'2026-10-06',sources:snapshot.sources}).retained.length,0);
  assert.ok(filterTrainingFold(observations,{asOf:'2026-10-07',sources:snapshot.sources}).retained.length>0);
  const coverage=record.researchStatus.itemCoverage;
  assert.equal(coverage.complete_registered_sale_history.status,'unestablished');assert.equal(coverage.signed_rent_history.status,'missing');assert.equal(coverage.actual_completion.status,'missing');assert.equal(coverage.occupancy.status,'missing');assert.equal(coverage.dated_valuation.status,'missing');
  const scenarios=annualScenarios(record,{asOf:snapshot.asOf,sources:snapshot.sources});assert.deepEqual(scenarios.targetYears,[...Array(54)].map((_,i)=>2027+i));assert.equal(scenarios.validatedForecast,false);assert.ok(Object.values(scenarios.metrics.price.paths).every(path=>path.every(point=>point.value===null)));
 }
});
