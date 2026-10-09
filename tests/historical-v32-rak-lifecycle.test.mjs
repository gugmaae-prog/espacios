import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {parseGeneratedInsert} from '../scripts/publish-historical-snapshot.mjs';
const read=p=>JSON.parse(fs.readFileSync(p));
const unpack=p=>JSON.parse(gunzipSync(fs.readFileSync(p)));
const snapshot=read('data/historical-intelligence-20261003.json');
const packet=read('data/historical-intelligence/rak-properties-lifecycle-pass32-20261008.json');
const publication=read('data/historical-intelligence/publication-manifest.json');
const before=unpack('data/historical-intelligence/objects/0f40ed398d7f0ec1d940a0076930f217dc04ca6dfd116b67fec7326fbebdec8b.json.gz');
// Freeze this pass's preservation baseline; V33 separately checks every later addition.
const after=unpack('data/historical-intelligence/objects/de0215ebbee2786d83b74ccc156a82c344d93070fcbb1ef012928a15918003ea.json.gz');
const changed=new Set(packet.facts.map(f=>f.recordId));
const records=new Map(snapshot.records.map(r=>[r.id,r]));
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');

test('V32 preserves every V31 record, source, event, and native financial series',()=>{
 assert.ok(['20261008-enrichment-v32','20261008-enrichment-v33','20261008-enrichment-v34','20261008-enrichment-v35','20261008-enrichment-v36','20261008-enrichment-v37','20261008-enrichment-v38','20261009-enrichment-v39'].includes(snapshot.version));
 assert.equal(publication.version,snapshot.version);
 assert.equal(records.size,1860);assert.equal(snapshot.records.filter(r=>r.type==='project').length,1645);
 assert.equal(publication.counts.sources,snapshot.version==='20261009-enrichment-v39'?3348:snapshot.version==='20261008-enrichment-v38'?3345:snapshot.version==='20261008-enrichment-v37'?3343:snapshot.version==='20261008-enrichment-v36'?3340:snapshot.version==='20261008-enrichment-v35'?3334:snapshot.version==='20261008-enrichment-v34'?3333:snapshot.version==='20261008-enrichment-v33'?3320:3306);assert.equal(publication.counts.series,16872);assert.equal(publication.counts.historicalRows,633891);
 assert.deepEqual(snapshot.sources.slice(0,before.sources.length),before.sources);
 assert.deepEqual(snapshot.events,before.events);assert.deepEqual(snapshot.exposures,before.exposures);
 const priorRecords=new Map(before.records.map(r=>[r.id,r]));
 for(const r of after.records){const old=priorRecords.get(r.id);assert.ok(old,r.id);
  if(!changed.has(r.id)){assert.deepEqual(r,old,r.id);continue;}
  for(const key of ['currentSnapshot','priorCurrentSnapshots','scenarioInputs','scenarioCoverage','historySeriesIds','communityId'])assert.deepEqual(r[key],old[key],r.id+' '+key);
  for(const key of ['lifecycle','observations'])assert.deepEqual(r[key].slice(0,old[key].length),old[key],r.id+' '+key);
  for(const key of ['registered_sale_history','signed_rent_history','actual_completion','occupancy','dated_current_valuation','dated_event_context','shared_financial_context','annual_scenario_inputs'])assert.deepEqual(r.researchStatus.itemCoverage[key],old.researchStatus.itemCoverage[key],r.id+' '+key);
 }
 const nativeHashes=root=>{const result=new Map(),keys=new Set(root.series.map(s=>s.partition.key));for(const key of keys){const archive=unpack('data/historical-intelligence/objects/'+key.split('/').at(-1));for(const s of archive.series)result.set(s.id,hash(s));}return result;};
 assert.deepEqual(nativeHashes(after),nativeHashes(before));
});

test('Primary RAK facts retain exact identities, date precision, schedules and contradictions',()=>{
 assert.equal(changed.size,5);assert.equal(packet.facts.length,27);assert.equal(packet.sources.length,11);
 for(const fact of packet.facts){assert.equal(fact.identityVerified,true);assert.ok(fact.identitySourceIds.length);assert.ok(fact.firstAvailableAt.startsWith('2026-10-08'));
  const r=records.get(fact.recordId);assert.equal(r.emirate,'Ras Al Khaimah');
  const actual=(fact.kind==='lifecycle'?r.lifecycle:r.observations).find(x=>x.id===fact.id);assert.ok(actual,fact.id);assert.equal(actual.firstAvailableAt,fact.firstAvailableAt);
  if(fact.kind==='lifecycle'){assert.deepEqual(actual.date,fact.date);assert.equal(actual.progressPercent,fact.progressPercent);}
 }
 const bay=records.get('project:bayviews-by-rak-properties-on-hayat-island-mina-ras-al-khaimah');
 assert.equal(bay.lifecycle.find(x=>x.id==='rak32-bayviews-launch').kind,'announcement');
 assert.equal(bay.researchStatus.itemCoverage.original_launch.status,'missing');
 assert.equal(bay.lifecycle.find(x=>x.id==='rak32-bayviews-progress-202606').progressPercent,98);
 assert.equal(bay.lifecycle.find(x=>x.id==='rak32-bayviews-progress-report-202608').progressPercent,99);
 assert.equal(bay.researchStatus.itemCoverage.actual_completion.status,'missing');
 assert.equal(bay.researchStatus.itemCoverage.occupancy.status,'missing');
 const porto=packet.sources.find(s=>s.id==='rak32-porto-groundbreaking');assert.equal(porto.publishedAt,'2024-11-05');assert.equal(porto.declaredReleaseDate,'2024-10-31');
 const revision=packet.sources.find(s=>s.id==='rak32-cape-final-phase');assert.equal(revision.canonicalSourceId,'community-source-0343d6726dc26c6e');
 const excluded=packet.excludedCandidates[0];assert.ok(!changed.has(excluded.recordId));assert.equal(excluded.status,'phase_identity_review_pending');
});

test('Undated segmented developer prices cannot become transactions, current values or forecast anchors',()=>{
 const facts=packet.facts.filter(f=>f.kind==='financial');assert.equal(facts.length,5);
 assert.deepEqual(facts.map(f=>f.observation.value),[875000,1230000,1550000,2220000,4000000]);
 for(const f of facts){const o=records.get(f.recordId).observations.find(o=>o.id===f.id);assert.equal(o.observationKind,'developer_advertised_price');assert.equal(o.publishedAt,null);assert.equal(o.sourcePage,8);assert.equal(o.includeInCurrentSnapshot,false);assert.equal(o.historicalLaunchPriceEstablished,false);assert.equal(o.currentMarketValidity,'unverified');assert.equal(o.period,'2026-10-08');}
 for(const r of snapshot.records){assert.equal(r.researchStatus.itemCoverage.complete_registered_sale_history.completeLifetimeHistory,false);assert.equal(r.researchStatus.itemCoverage.complete_signed_rent_history.completeLifetimeHistory,false);assert.equal(r.researchStatus.itemCoverage.annual_scenario_inputs.lastYear,2080);}
 assert.equal(snapshot.manifest.approved2080ForecastRecords,0);
});


test('V32 D1 count and identity flags retain their numeric types',()=>{
 const sql=gunzipSync(fs.readFileSync(publication.d1Index.path)).toString('utf8').split('\n');
 const snapshotRow=parseGeneratedInsert(sql.find(line=>line.startsWith('INSERT OR IGNORE INTO hi_snapshots(')));
 assert.equal(snapshotRow.values[2],1860);
 for(const [table,index] of [['hi_exposures',5],['hi_record_series',4]]){
  const row=parseGeneratedInsert(sql.find(line=>line.startsWith('INSERT OR IGNORE INTO '+table+'(')));
  assert.equal(typeof row.values[index],'number');assert.ok([0,1].includes(row.values[index]));
 }
});
