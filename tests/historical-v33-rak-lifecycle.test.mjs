import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {parseGeneratedInsert} from '../scripts/publish-historical-snapshot.mjs';
const read=p=>JSON.parse(fs.readFileSync(p));
const unpack=p=>JSON.parse(gunzipSync(fs.readFileSync(p)));
const snapshot=read('data/historical-intelligence-20261003.json');
const packet=read('data/historical-intelligence/rak-properties-lifecycle-pass33-20261008.json');
const publication=read('data/historical-intelligence/publication-manifest.json');
const before=unpack('data/historical-intelligence/objects/de0215ebbee2786d83b74ccc156a82c344d93070fcbb1ef012928a15918003ea.json.gz');
// V33 transition stays frozen; V34 independently verifies its additions.
const after=unpack('data/historical-intelligence/objects/a58abd05d631031630296caf1e4f2586e9a7024276f49699bb3f0465e6247796.json.gz');
const changed=new Set(packet.facts.map(f=>f.recordId));
const records=new Map(snapshot.records.map(r=>[r.id,r]));
const sources=new Map(snapshot.sources.map(s=>[s.id,s]));
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');

test('V33 preserves all 1860 identities, prior facts, current values and every native financial series',()=>{
 assert.ok(['20261008-enrichment-v33','20261008-enrichment-v34'].includes(snapshot.version));assert.equal(publication.version,snapshot.version);
 assert.equal(records.size,1860);assert.equal(snapshot.records.filter(r=>r.type==='project').length,1645);
 assert.equal(publication.counts.sources,snapshot.version==='20261008-enrichment-v34'?3333:3320);assert.equal(publication.counts.series,16872);assert.equal(publication.counts.historicalRows,633891);
 assert.deepEqual(snapshot.sources.slice(0,before.sources.length),before.sources);
 assert.deepEqual(snapshot.events,before.events);assert.deepEqual(snapshot.exposures,before.exposures);
 const oldRecords=new Map(before.records.map(r=>[r.id,r]));
 for(const r of after.records){const old=oldRecords.get(r.id);assert.ok(old,r.id);
  if(!changed.has(r.id)){assert.deepEqual(r,old,r.id);continue;}
  for(const k of ['currentSnapshot','priorCurrentSnapshots','scenarioInputs','scenarioCoverage','historySeriesIds','communityId'])assert.deepEqual(r[k],old[k],r.id+' '+k);
  for(const k of ['lifecycle','observations'])assert.deepEqual(r[k].slice(0,old[k].length),old[k],r.id+' '+k);
  for(const k of ['registered_sale_history','signed_rent_history','actual_completion','occupancy','dated_current_valuation','annual_scenario_inputs','dated_event_context','shared_financial_context'])assert.deepEqual(r.researchStatus.itemCoverage[k],old.researchStatus.itemCoverage[k],r.id+' '+k);
 }
 const nativeHashes=root=>{const result=new Map();for(const key of new Set(root.series.map(s=>s.partition.key))){const p=unpack('data/historical-intelligence/objects/'+key.split('/').at(-1));for(const s of p.series)result.set(s.id,hash(s));}return result;};
 assert.deepEqual(nativeHashes(after),nativeHashes(before));
});

test('Sources, precision, phases and availability distinguish reports from actual delivery',()=>{
 assert.equal(changed.size,11);assert.equal(packet.facts.length,44);assert.equal(packet.sources.length,14);
 assert.equal(packet.facts.filter(f=>f.kind==='lifecycle').length,40);
 for(const f of packet.facts){const r=records.get(f.recordId);assert.equal(r.emirate,'Ras Al Khaimah');assert.equal(f.identityVerified,true);
  for(const sid of [...f.sourceIds,...f.identitySourceIds]){assert.ok(sources.has(sid));assert.ok(f.firstAvailableAt>=sources.get(sid).firstAvailableAt,f.id+' availability');}
  const actual=(f.kind==='lifecycle'?r.lifecycle:r.observations).find(x=>x.id===f.id);assert.ok(actual,f.id);
  if(f.kind==='lifecycle')assert.deepEqual(actual.date,f.date);
 }
 const fact=id=>packet.facts.find(f=>f.id==='rak33-'+id);
 assert.deepEqual(fact('mirasol-target').date,{start:'2028-01-01',precision:'range',end:'2028-06-30'});
 assert.deepEqual(fact('skai-main-contract').date,{start:'2026-Q1',precision:'quarter'});
 assert.equal(fact('solera-construction-target').eventStatus,'planned');assert.equal(fact('solera-construction-target').milestone,'target_construction_start');
 assert.equal(fact('edge-progress-202606').progressPercent,25.8);assert.equal(fact('skai-progress-202606').progressPercent,8.3);
 assert.equal(fact('anantara-villas-202606').scope,'subject_phase');assert.equal(fact('anantara-apartments-202606').scope,'subject_phase');
 assert.equal(fact('anantara-sales-report-april').date.precision,'month');assert.equal(fact('anantara-sales-announcement').date.start,'2025-05-06');
 assert.equal(packet.conflicts.length,3);
 const mirasolIds=packet.excludedCandidates[0].recordIds;
 assert.ok(!packet.facts.some(f=>mirasolIds.includes(f.recordId)&&f.sourceIds.includes('rak32-h1-2026')));
 for(const r of snapshot.records){assert.equal(r.researchStatus.itemCoverage.complete_registered_sale_history.completeLifetimeHistory,false);assert.equal(r.researchStatus.itemCoverage.complete_signed_rent_history.completeLifetimeHistory,false);}
});

test('Four dated historical advertisements are separate from current valuations and transactions',()=>{
 const facts=packet.facts.filter(f=>f.kind==='financial');assert.deepEqual(facts.map(f=>f.observation.value),[762000,861000,800000,768000]);
 assert.deepEqual(facts.map(f=>f.observation.period),['2025-02-26','2025-09-25','2025-12-08','2025-06-17']);
 for(const f of facts){const o=records.get(f.recordId).observations.find(x=>x.id===f.id);assert.equal(o.observationKind,'developer_advertised_price');assert.equal(o.currentSnapshotEligible,false);assert.equal(o.includeInCurrentSnapshot,false);assert.equal(o.period,o.publishedAt);assert.ok(o.firstAvailableAt.startsWith('2026-10-08'));}
 assert.equal(snapshot.manifest.approved2080ForecastRecords,0);
 for(const id of changed){const c=records.get(id).researchStatus.itemCoverage;assert.equal(c.dated_current_valuation.status,'missing');assert.equal(c.annual_scenario_inputs.lastYear,2080);}
});

test('V33 D1 generated counts and identity flags retain numeric types',()=>{
 const sql=gunzipSync(fs.readFileSync(publication.d1Index.path)).toString().split('\n');
 assert.equal(parseGeneratedInsert(sql.find(x=>x.startsWith('INSERT OR IGNORE INTO hi_snapshots('))).values[2],1860);
 for(const [t,i] of [['hi_exposures',5],['hi_record_series',4]])assert.equal(typeof parseGeneratedInsert(sql.find(x=>x.startsWith('INSERT OR IGNORE INTO '+t+'('))).values[i],'number');
});
