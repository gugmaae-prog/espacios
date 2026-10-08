import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const read=p=>JSON.parse(fs.readFileSync(p));
const unpack=p=>JSON.parse(gunzipSync(fs.readFileSync(p)));
const snapshot=read('data/historical-intelligence-20261003.json');
const packet=read('data/historical-intelligence/rak-properties-profiles-pass34-20261008.json');
const publication=read('data/historical-intelligence/publication-manifest.json');
const before=unpack('data/historical-intelligence/objects/a58abd05d631031630296caf1e4f2586e9a7024276f49699bb3f0465e6247796.json.gz');
const after=unpack(publication.rootIndex.path);
const changed=new Set(packet.facts.map(f=>f.recordId));
const records=new Map(snapshot.records.map(r=>[r.id,r]));
const sources=new Map(snapshot.sources.map(s=>[s.id,s]));
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
test('V34 preserves all identities, every native financial series, prior observations and unaffected records',()=>{
 assert.equal(snapshot.version,'20261008-enrichment-v34');assert.equal(publication.version,snapshot.version);
 assert.equal(records.size,1860);assert.equal(snapshot.records.filter(r=>r.type==='project').length,1645);
 assert.equal(publication.counts.sources,3333);assert.equal(publication.counts.series,16872);assert.equal(publication.counts.historicalRows,633891);
 assert.deepEqual(snapshot.sources.slice(0,before.sources.length),before.sources);
 assert.deepEqual(snapshot.events,before.events);assert.deepEqual(snapshot.exposures,before.exposures);
 const oldRecords=new Map(before.records.map(r=>[r.id,r]));
 for(const r of after.records){const old=oldRecords.get(r.id);assert.ok(old,r.id);
  if(!changed.has(r.id)){assert.deepEqual(r,old,r.id);continue;}
  for(const k of ['currentSnapshot','priorCurrentSnapshots','scenarioInputs','scenarioCoverage','historySeriesIds','communityId','observations'])assert.deepEqual(r[k],old[k],r.id+' '+k);
  assert.deepEqual(r.lifecycle.slice(0,old.lifecycle.length),old.lifecycle,r.id);
  for(const k of ['registered_sale_history','signed_rent_history','occupancy','dated_current_valuation','annual_scenario_inputs','dated_event_context','shared_financial_context'])assert.deepEqual(r.researchStatus.itemCoverage[k],old.researchStatus.itemCoverage[k],r.id+' '+k);
 }
 const nativeHashes=root=>{const result=new Map();for(const key of new Set(root.series.map(s=>s.partition.key))){const p=unpack('data/historical-intelligence/objects/'+key.split('/').at(-1));for(const s of p.series)result.set(s.id,hash(s));}return result;};
 assert.deepEqual(nativeHashes(after),nativeHashes(before));
});
test('Monthly developer progress retains native precision, component values, phases and capture-time availability',()=>{
 assert.equal(changed.size,13);assert.equal(packet.facts.length,115);assert.equal(packet.sources.length,13);assert.equal(packet.constructionPanels.length,102);
 for(const f of packet.facts){const actual=records.get(f.recordId).lifecycle.find(x=>x.id===f.id);assert.ok(actual,f.id);assert.deepEqual(actual.date,f.date);assert.equal(actual.status,'reported');
  for(const id of [...f.sourceIds,...f.identitySourceIds]){assert.ok(sources.has(id));assert.ok(f.firstAvailableAt>=sources.get(id).firstAvailableAt);}
  assert.equal(actual.publishedAt,null);assert.equal(actual.identityVerified,true);
 }
 for(const panel of packet.constructionPanels){
  const f=packet.facts.find(f=>f.recordId===panel.recordId&&f.date.start===panel.period&&f.dateBasis?.endsWith(panel.panelId));
  assert.ok(f,panel.sourceTabLabel);assert.equal(f.progressPercent,panel.overallPercent);assert.equal(f.date.precision,'month');
  for(const [name,value] of Object.entries(panel.components))assert.ok(f.note.includes(`${name}: ${value}%`));
  if(panel.phaseLabel){assert.equal(f.scope,'subject_phase');assert.equal(f.milestone,'phase_construction_progress');}
 }
 assert.equal(packet.constructionPanels.filter(p=>p.phaseLabel).length,10);
 for(const c of packet.excludedCandidates.filter(c=>c.recordId))assert.ok(!changed.has(c.recordId));
 const edge=sources.get('rak34-profile-edge');assert.equal(edge.revisionOfSourceId,'scrape-bb6f1fae7122cba6b8f0fd17');assert.equal(edge.preserveRevision,true);
});
test('Zero and declining reports survive; 100 percent does not certify delivery, occupancy or future returns',()=>{
 const fact=id=>packet.facts.find(f=>f.id===id);
 assert.equal(fact('rak34-solera-progress-2026-06').progressPercent,0.1);assert.equal(fact('rak34-solera-progress-2026-08').progressPercent,0);
 assert.equal(fact('rak34-bayviews-progress-2026-08').progressPercent,100);
 const marbella=records.get('project:rak-properties-marbella-villas-2-on-hayat-island-mina-ras-al-khaimah');assert.equal(marbella.researchStatus.itemCoverage.actual_completion.status,'partial');
 const completion=fact('rak34-marbella-ii-villas-completion-label');assert.equal(completion.verification,'reported');assert.equal(completion.date.start,'2024-Q4');
 assert.equal(packet.facts.filter(f=>f.milestone==='target_completion'&&f.eventStatus==='planned').length,12);
 assert.equal(snapshot.manifest.approved2080ForecastRecords,0);
 for(const r of snapshot.records){assert.equal(r.researchStatus.itemCoverage.complete_registered_sale_history.completeLifetimeHistory,false);assert.equal(r.researchStatus.itemCoverage.complete_signed_rent_history.completeLifetimeHistory,false);}
});
