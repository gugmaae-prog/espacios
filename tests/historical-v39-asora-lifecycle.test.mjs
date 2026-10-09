import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {isAvailableAsOf} from '../src/historical-intelligence/core.mjs';
const read=p=>JSON.parse(fs.readFileSync(p)),unpack=p=>JSON.parse(gunzipSync(fs.readFileSync(p)));
const snapshot=read('data/historical-intelligence-20261003.json'),publication=read('data/historical-intelligence/publication-manifest.json'),packet=read('data/historical-intelligence/asora-lifecycle-pass39-20261009.json');
const before=unpack('data/historical-intelligence/objects/01b716e001347142944eda86c5c649f4a2e05b47be05df70f8302db4450d09fd.json.gz'),after=unpack(publication.rootIndex.path),rid=packet.recordIdentityChecks[0].recordId,record=snapshot.records.find(r=>r.id===rid);
test('V39 preserves all identities, financial data and native series while adding seven scoped lifecycle facts',()=>{
 assert.equal(snapshot.version,'20261009-enrichment-v39');assert.equal(snapshot.asOf,'2026-10-09');assert.equal(publication.version,snapshot.version);
 assert.equal(snapshot.records.length,1860);assert.equal(publication.counts.sources,3348);assert.equal(publication.counts.historicalRows,633891);assert.equal(publication.counts.series,16872);
 assert.deepEqual(snapshot.sources.slice(0,before.sources.length),before.sources);assert.deepEqual(snapshot.events,before.events);assert.deepEqual(snapshot.exposures,before.exposures);
 const previous=new Map(before.records.map(r=>[r.id,r]));
 for(const r of after.records){const old=previous.get(r.id);assert.ok(old);
  if(r.id!==rid){assert.deepEqual(r,old,r.id);continue;}
  for(const k of ['observations','currentSnapshot','priorCurrentSnapshots','scenarioInputs','scenarioCoverage','historySeriesIds','communityId'])assert.deepEqual(r[k],old[k],k);
  assert.equal(r.lifecycle.length-old.lifecycle.length,7);assert.deepEqual(r.lifecycle.slice(0,old.lifecycle.length),old.lifecycle);
  for(const key of Object.keys(old.researchStatus.itemCoverage))if(!['announcement_registration','handover_targets'].includes(key))assert.deepEqual(r.researchStatus.itemCoverage[key],old.researchStatus.itemCoverage[key],key);
 }
 const native=root=>{const hashes=new Map();for(const k of new Set(root.series.map(s=>s.partition.key))){for(const s of unpack('data/historical-intelligence/objects/'+k.split('/').at(-1)).series)hashes.set(s.id,createHash('sha256').update(JSON.stringify(s)).digest('hex'));}return hashes;};assert.deepEqual(native(after),native(before));
});
test('earlier announcement is retained without inventing a first launch, price or retrospective source availability',()=>{
 assert.equal(record.researchStatus.earliestHistoryEvidence.date.start,'2025-04-28');assert.equal(record.researchStatus.itemCoverage.announcement_registration.status,'present');
 for(const key of ['original_launch','construction','occupancy','actual_completion','dated_current_valuation','annual_scenario_inputs'])assert.equal(record.researchStatus.itemCoverage[key].status,'missing',key);
 assert.equal(record.researchStatus.itemCoverage.complete_registered_sale_history.status,'unestablished');assert.equal(snapshot.manifest.approved2080ForecastRecords,0);
 for(const f of record.lifecycle.filter(x=>x.id.startsWith('asora39-'))){assert.equal(isAvailableAsOf(f,'2025-12-31'),false);assert.ok(f.identitySourceIds.length);}
 const announced=record.lifecycle.find(x=>x.id==='asora39-announcement');assert.equal(isAvailableAsOf(announced,'2026-10-08'),false);assert.equal(isAvailableAsOf(announced,'2026-10-09'),true);
 assert.equal(packet.facts.some(x=>x.kind==='financial'||x.milestone==='launch'),false);
});
test('imprecise residential targets, hotel component and disputed parent status do not become actual construction',()=>{
 const target=record.lifecycle.find(x=>x.id==='asora39-residential-target');assert.deepEqual(target.date,{start:'2029',precision:'year',rawLabel:'early 2029',qualifier:'early; intra-year bounds unspecified'});assert.equal(target.eventStatus,'planned');
 assert.equal(record.lifecycle.find(x=>x.id==='asora39-hotel-target').scope,'hotel_component');
 const conflict=record.lifecycle.find(x=>x.id==='asora39-register-conflict');assert.equal(conflict.status,'disputed');assert.equal(conflict.scope,'parent_project');assert.match(conflict.note,/NOT_STARTED/);assert.match(conflict.note,/تحت الانشاء/);assert.match(conflict.note,/0\.00000/);assert.equal(conflict.progressPercent,undefined);
 assert.equal(packet.conflicts.length,2);assert.equal(record.coverageSummary.directSaleTransactionCount,30);
});
test('future source availability and planned-completion relabelling are rejected during ingestion',()=>{
 const py=String.raw`import sys,json,copy
sys.path.insert(0,'scripts')
from historical_enrichment import apply_enrichment
s=json.load(open('data/historical-intelligence-20261003.json'));p=json.load(open('data/historical-intelligence/asora-lifecycle-pass39-20261009.json'));r=copy.deepcopy(next(x for x in s['records'] if x['id']==p['facts'][0]['recordId']));r['lifecycle']=[x for x in r['lifecycle'] if not x['id'].startswith('asora39-')];sources={x['id']:x for x in s['sources']}
for fact,asof in [(p['facts'][0],'2026-10-08'),({**p['facts'][2],'milestone':'completion','eventStatus':'actual','verification':'verified'},'2026-10-09')]:
 try:apply_enrichment({'asOf':asof,'facts':[fact]},[copy.deepcopy(r)],{},sources,lambda x:x['id'],{},asof)
 except ValueError:pass
 else:raise AssertionError('Invalid lifecycle promotion accepted')
`;
 const result=spawnSync('python3',['-c',py],{encoding:'utf8'});assert.equal(result.status,0,result.stderr||result.stdout);
});

test('every native/runtime partition envelope matches the release cutoff while observations retain native dates',()=>{
 for(const object of publication.objects.filter(x=>['history_partition','runtime_history_partition'].includes(x.kind))){
  const partition=unpack(object.path);assert.equal(partition.version,snapshot.version,object.path);assert.equal(partition.asOf,snapshot.asOf,object.path);
 }
});
