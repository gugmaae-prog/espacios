import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const read=p=>JSON.parse(fs.readFileSync(p)),unpack=p=>JSON.parse(gunzipSync(fs.readFileSync(p)));
const snapshot=read('data/historical-intelligence-20261003.json'),publication=read('data/historical-intelligence/publication-manifest.json');
const packet=read('data/historical-intelligence/dld-sales-pass43-20261012.json');
const before=unpack('data/historical-intelligence/objects/472486d78f139da3a2e111fbaa110578698248c20e31359c96580b8200cce05a.json.gz'),after=unpack(publication.rootIndex.path);
test('V43 retains the entire archive and appends only the reviewed Cresswell Plaza evidence',()=>{
 assert.equal(snapshot.version,'20261012-enrichment-v43');assert.equal(publication.version,snapshot.version);assert.equal(snapshot.asOf,'2026-10-12');
 assert.equal(snapshot.records.length,1860);assert.equal(publication.counts.sources,3362);assert.equal(publication.counts.historicalRows,633891);assert.equal(publication.counts.series,16872);
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
test('V43 exact checklist and financial boundaries remain explicit through 2080',()=>{
 const counts={};for(const r of snapshot.records){for(const i of Object.values(r.researchStatus.itemCoverage))counts[i.status]=(counts[i.status]||0)+1;assert.equal(r.scenarioCoverage.lastYear,2080);}
 assert.deepEqual(counts,{missing:26731,unestablished:9300,partial:3438,present:3311});
 assert.equal(packet.facts.filter(f=>f.kind==='financial').length,24);assert.equal(packet.facts.filter(f=>f.kind==='lifecycle').length,0);
 for(const id of packet.recordIdentityChecks.map(c=>c.recordId)){const r=snapshot.records.find(x=>x.id===id);assert.equal(r.researchStatus.itemCoverage.registered_sale_history.status,'present');assert.equal(r.researchStatus.itemCoverage.dated_current_valuation.status,'missing');}
 assert.equal(snapshot.manifest.approved2080ForecastRecords,0);
});
