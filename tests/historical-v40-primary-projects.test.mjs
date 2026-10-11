import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const read=p=>JSON.parse(fs.readFileSync(p)),unpack=p=>JSON.parse(gunzipSync(fs.readFileSync(p)));
const snapshot=read('data/historical-intelligence-20261003.json'),publication=read('data/historical-intelligence/publication-manifest.json');
const packet=read('data/historical-intelligence/primary-project-pass40-20261009.json');
const before=unpack('data/historical-intelligence/objects/b1e9735a5a602a8dd214955271f7d9b95feb5671281232bb304e63194c31f760.json.gz'),after=unpack(publication.rootIndex.path);
test('V40 retains the entire archive and appends only the reviewed two-project evidence',()=>{
 assert.equal(snapshot.version,'20261009-enrichment-v40');assert.equal(publication.version,snapshot.version);assert.equal(snapshot.asOf,'2026-10-09');
 assert.equal(snapshot.records.length,1860);assert.equal(publication.counts.sources,3351);assert.equal(publication.counts.historicalRows,633891);assert.equal(publication.counts.series,16872);
 assert.deepEqual(snapshot.sources.slice(0,before.sources.length),before.sources);assert.deepEqual(snapshot.events,before.events);assert.deepEqual(snapshot.exposures,before.exposures);
 const changed=new Set(packet.facts.map(f=>f.recordId)),previous=new Map(before.records.map(r=>[r.id,r]));assert.equal(changed.size,2);
 for(const r of after.records){const old=previous.get(r.id);assert.ok(old);
  if(!changed.has(r.id)){assert.deepEqual(r,old,r.id);continue;}
  for(const key of ['currentSnapshot','priorCurrentSnapshots','scenarioInputs','scenarioCoverage','historySeriesIds','communityId'])assert.deepEqual(r[key],old[key],key);
  assert.deepEqual(r.observations.slice(0,old.observations.length),old.observations);assert.deepEqual(r.lifecycle.slice(0,old.lifecycle.length),old.lifecycle);
  const allowed=r.name==='Binghatti Wraith'?['advertised_prices']:['announcement_registration','construction','handover_targets'];
  for(const key of Object.keys(old.researchStatus.itemCoverage))if(!allowed.includes(key))assert.deepEqual(r.researchStatus.itemCoverage[key],old.researchStatus.itemCoverage[key],key);
 }
 const native=root=>{const hashes=new Map();for(const k of new Set(root.series.map(s=>s.partition.key))){for(const s of unpack('data/historical-intelligence/objects/'+k.split('/').at(-1)).series)hashes.set(s.id,createHash('sha256').update(JSON.stringify(s)).digest('hex'));}return hashes;};assert.deepEqual(native(after),native(before));
});
test('V40 exact checklist and financial boundaries remain explicit through 2080',()=>{
 const counts={};for(const r of snapshot.records){for(const i of Object.values(r.researchStatus.itemCoverage))counts[i.status]=(counts[i.status]||0)+1;assert.equal(r.scenarioCoverage.lastYear,2080);}
 assert.deepEqual(counts,{missing:26738,unestablished:9300,partial:3438,present:3304});
 assert.equal(packet.facts.filter(f=>f.kind==='financial').length,3);assert.equal(packet.facts.filter(f=>f.kind==='lifecycle').length,4);
 for(const id of packet.recordIdentityChecks.map(c=>c.recordId)){const r=snapshot.records.find(x=>x.id===id);assert.equal(r.researchStatus.itemCoverage.registered_sale_history.status,'missing');assert.equal(r.researchStatus.itemCoverage.dated_current_valuation.status,'missing');}
 assert.equal(snapshot.manifest.approved2080ForecastRecords,0);
});
