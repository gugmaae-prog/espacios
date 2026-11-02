import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const read=p=>JSON.parse(fs.readFileSync(p)),unpack=p=>JSON.parse(gunzipSync(fs.readFileSync(p)));
const latest=read('data/historical-intelligence-20261003.json'),publication=read('data/historical-intelligence/publication-manifest.json');
const packet=read('data/historical-intelligence/dld-sales-pass44-20261012.json');
const before=unpack('data/historical-intelligence/objects/999760c4e7fade1d3f6f5398f19f0521a96dd403cbcc51ac1d2e242188061998.json.gz');
const snapshot=unpack('data/historical-intelligence/objects/b87232342eabc47776b97277cc7cc8a63dc59846264eb406e816ff2c97bcab4d.json.gz'),after=snapshot;
test('V44 retains the entire archive and appends only the reviewed Avida Residences evidence',()=>{
 assert.equal(snapshot.version,'20261012-enrichment-v44');assert.ok(['20261013-enrichment-v46','20261014-enrichment-v47','20261014-enrichment-v48'].includes(latest.version));assert.equal(snapshot.asOf,'2026-10-12');
 assert.equal(snapshot.records.length,1860);assert.equal(publication.counts.sources,latest.version==='20261014-enrichment-v48'?3386:latest.version==='20261014-enrichment-v47'?3381:3367);assert.equal(publication.counts.historicalRows,633891);assert.equal(publication.counts.series,16872);
 assert.deepEqual(snapshot.sources.slice(0,before.sources.length),before.sources);assert.deepEqual(snapshot.events,before.events);assert.deepEqual(snapshot.exposures,before.exposures);
 const changed=new Set(packet.facts.map(f=>f.recordId)),previous=new Map(before.records.map(r=>[r.id,r]));assert.equal(changed.size,1);
 for(const r of after.records){const old=previous.get(r.id);assert.ok(old);
  if(!changed.has(r.id)){assert.deepEqual(r,old,r.id);continue;}
  for(const key of ['currentSnapshot','priorCurrentSnapshots','scenarioInputs','scenarioCoverage','historySeriesIds','communityId'])assert.deepEqual(r[key],old[key],key);
  assert.deepEqual(r.observations.slice(0,old.observations.length),old.observations);assert.deepEqual(r.lifecycle.slice(0,old.lifecycle.length),old.lifecycle);
  const allowed=['registered_sale_history'];
  for(const key of Object.keys(old.researchStatus.itemCoverage))if(!allowed.includes(key))assert.deepEqual(r.researchStatus.itemCoverage[key],old.researchStatus.itemCoverage[key],key);
 }
 const native=root=>{const hashes=new Map();for(const k of new Set(root.series.map(s=>s.partition.key))){for(const s of unpack('data/historical-intelligence/objects/'+k.split('/').at(-1)).series)hashes.set(s.id,createHash('sha256').update(JSON.stringify(s)).digest('hex'));}return hashes;};assert.deepEqual(native(after),native(before));
});
test('V44 exact checklist and financial boundaries remain explicit through 2080',()=>{
 const counts={};for(const r of snapshot.records){for(const i of Object.values(r.researchStatus.itemCoverage))counts[i.status]=(counts[i.status]||0)+1;assert.equal(r.scenarioCoverage.lastYear,2080);}
 assert.deepEqual(counts,{missing:26730,unestablished:9300,partial:3438,present:3312});
 assert.equal(packet.facts.filter(f=>f.kind==='financial').length,40);assert.equal(packet.facts.filter(f=>f.kind==='lifecycle').length,0);
 for(const id of packet.recordIdentityChecks.map(c=>c.recordId)){const r=snapshot.records.find(x=>x.id===id);assert.equal(r.researchStatus.itemCoverage.registered_sale_history.status,'present');assert.equal(r.researchStatus.itemCoverage.dated_current_valuation.status,'missing');}
 assert.equal(snapshot.manifest.approved2080ForecastRecords,0);
});
