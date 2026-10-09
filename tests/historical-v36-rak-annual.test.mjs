import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {validateObservation,filterTrainingFold,isAvailableAsOf} from '../src/historical-intelligence/core.mjs';
const read=p=>JSON.parse(fs.readFileSync(p)),unpack=p=>JSON.parse(gunzipSync(fs.readFileSync(p)));
const snapshot=read('data/historical-intelligence-20261003.json'),publication=read('data/historical-intelligence/publication-manifest.json'),packet=read('data/historical-intelligence/rak-properties-annual-pass36-20261008.json');
const before=unpack('data/historical-intelligence/objects/9ddb117034ebb4012b4c1669fa75e7774967aef17e600d3e1d680388b780372d.json.gz'),after=unpack('data/historical-intelligence/objects/3995529ceb9737e72ad485deb445ad538446e0c26edbb009b67da4a643034b57.json.gz'),changed=new Set(packet.facts.map(f=>f.recordId)),records=new Map(snapshot.records.map(r=>[r.id,r]));
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const mina='community:Ras Al Khaimah:mina-al-arab',flamingo='project:rak-properties-flamingo-villas-in-mina-for-sale-ras-al-khaimah-uae';
test('V36 preserves every record and native financial series; only two reviewed identities receive facts',()=>{
 assert.ok(['20261008-enrichment-v36','20261008-enrichment-v37','20261008-enrichment-v38'].includes(snapshot.version));assert.equal(publication.version,snapshot.version);assert.equal(records.size,1860);assert.deepEqual([...changed].sort(),[mina,flamingo].sort());
 assert.equal(packet.facts.length,29);assert.equal(packet.sources.length,6);assert.equal(publication.counts.sources,snapshot.version==='20261008-enrichment-v38'?3345:snapshot.version==='20261008-enrichment-v37'?3343:3340);assert.equal(publication.counts.historicalRows,633891);assert.equal(publication.counts.series,16872);
 assert.deepEqual(snapshot.sources.slice(0,before.sources.length),before.sources);assert.deepEqual(snapshot.events,before.events);assert.deepEqual(snapshot.exposures,before.exposures);
 const oldRecords=new Map(before.records.map(r=>[r.id,r]));
 for(const r of after.records){const old=oldRecords.get(r.id);assert.ok(old);
  if(!changed.has(r.id)){assert.deepEqual(r,old,r.id);continue;}
  for(const key of ['currentSnapshot','priorCurrentSnapshots','scenarioInputs','scenarioCoverage','historySeriesIds','communityId'])assert.deepEqual(r[key],old[key],r.id+' '+key);
  assert.deepEqual(r.lifecycle.slice(0,old.lifecycle.length),old.lifecycle);assert.deepEqual(r.observations.slice(0,old.observations.length),old.observations);
  for(const key of ['registered_sale_history','signed_rent_history','occupancy','dated_current_valuation','annual_scenario_inputs','dated_event_context','shared_financial_context'])assert.deepEqual(r.researchStatus.itemCoverage[key],old.researchStatus.itemCoverage[key],r.id+' '+key);
 }
 const native=root=>{const hashes=new Map();for(const k of new Set(root.series.map(s=>s.partition.key))){for(const s of unpack('data/historical-intelligence/objects/'+k.split('/').at(-1)).series)hashes.set(s.id,hash(s));}return hashes;};assert.deepEqual(native(after),native(before));
});
test('revised schedules and phased deliveries preserve precision, source pages and same-record reconciliation',()=>{
 for(const f of packet.facts.filter(f=>f.kind==='lifecycle')){
  const r=records.get(f.recordId),actual=r.lifecycle.find(x=>x.id===f.id);assert.ok(actual);assert.deepEqual(actual.date,f.date);assert.equal(actual.scope,f.scope);assert.equal(actual.status,'reported');
  for(const k of ['phaseLabel','sourcePage','dateReconciliation','relatedMilestoneIds'])assert.deepEqual(actual[k],f[k]);
  for(const id of actual.relatedMilestoneIds??[])assert.ok(r.lifecycle.some(x=>x.id===id),id);
  if(f.milestone.startsWith('target_'))assert.equal(actual.eventStatus,'planned');
  assert.equal(isAvailableAsOf(actual,'2020-12-31'),false);
 }
 const r=records.get(flamingo),fact=id=>r.lifecycle.find(x=>x.id===id);
 assert.equal(fact('rak36-flamingo-phase1-handover').date.start,'2015');assert.equal(fact('rak36-flamingo-phase2-handover').date.start,'2016-10');assert.equal(fact('rak35-flamingo-delivery').date.start,'2017');
 assert.equal(r.researchStatus.itemCoverage.actual_completion.status,'missing');assert.equal(r.researchStatus.itemCoverage.occupancy.status,'missing');
 const m=records.get(mina);assert.equal(m.researchStatus.earliestHistoryEvidence.date.start,'2006');assert.equal(m.lifecycle.find(x=>x.id==='rak36-mina-reported-launch').date.start,'2005');
 const target=m.lifecycle.find(x=>x.id==='rak36-mina-bermuda-target-2017');assert.deepEqual(target.date,{start:'2017-01-01',end:'2017-06-30',precision:'range'});
 assert.equal(packet.sources.filter(s=>s.primaryEvidence).length,5);for(const s of packet.sources.filter(s=>s.primaryEvidence)){assert.equal(s.publishedAt,null);assert.ok(s.firstAvailableAt.startsWith('2026-10-08'));assert.equal(s.rawBodyRedistributed,false);}
 assert.equal(snapshot.manifest.approved2080ForecastRecords,0);
});
test('two published asking ranges stay outside direct prices, current snapshots and training',()=>{
 const context=vm.createContext({window:{},document:{querySelector:()=>null},URL,setInterval:()=>1,clearInterval(){}});vm.runInContext(fs.readFileSync('src/historical-intelligence/app.js','utf8'),context);
 for(const f of packet.facts.filter(f=>f.kind==='financial')){
  const r=records.get(f.recordId),o=r.observations.find(x=>x.id===f.id),range=o.quotedPriceRange;assert.equal(o.value,range.low);assert.ok(range.high>range.low);assert.equal(o.observationKind,'asking_quote');assert.equal(o.scope,'published_reference');assert.equal(o.period,'2013-10-09');assert.equal(o.currentSnapshotEligible,false);
  const v=validateObservation(o,r,{asOf:snapshot.asOf,sources:snapshot.sources});assert.equal(v.valid,true);assert.equal(v.direct,false);assert.equal(filterTrainingFold([o],{asOf:snapshot.asOf,sources:snapshot.sources}).retained.length,0);assert.equal(isAvailableAsOf(o,'2014-01-01'),false);
  const html=context.window.EspaciosHistoricalUIHelpers.askingRangeHTML(o,{sources:snapshot.sources});for(const text of ['Historical advertised range','No average or midpoint','2013-10-09','2026-10-08',o.segment])assert.ok(html.includes(text),text);
  assert.ok(html.includes(range.low.toLocaleString('en-US')));assert.ok(html.includes(range.high.toLocaleString('en-US')));assert.equal(context.window.EspaciosHistoricalUIHelpers.seriesRows({observations:[o]},'price').length,0);
  assert.equal(r.coverageSummary.directSalePeriods,0);
 }
});
test('ingestion rejects reversed, non-finite, unlabelled and current-single-price ranges',()=>{
 const code=String.raw`
import sys,copy,json
sys.path.insert(0,'scripts')
from historical_enrichment import apply_enrichment
packet=json.load(open('data/historical-intelligence/rak-properties-annual-pass36-20261008.json'))
f=next(f for f in packet['facts'] if f['kind']=='financial');sources={s['id']:s for s in packet['sources']}
def run(f):
 r={'id':f['recordId'],'emirate':'Ras Al Khaimah','type':'project','name':'Flamingo','lifecycle':[],'observations':[],'historySeries':[],'researchStatus':{'gaps':[]},'coverageSummary':{},'currentSnapshot':{}}
 apply_enrichment({'asOf':'2026-10-08','facts':[f]},[r],{},sources,lambda x:None,{},'2026-10-08')
run(copy.deepcopy(f))
for patch in [{'low':True},{'low':float('nan')},{'high':float('inf')},{'high':1},{'unit':'USD'},{'basis':''}]:
 bad=copy.deepcopy(f);bad['observation']['quotedPriceRange'].update(patch)
 try:run(bad);raise AssertionError('Invalid range accepted')
 except ValueError:pass
for patch in [{'value':1},{'observationKind':'transaction'},{'segment':''},{'currentSnapshotEligible':True},{'includeInCurrentSnapshot':True}]:
 bad=copy.deepcopy(f);bad['observation'].update(patch)
 try:run(bad);raise AssertionError('Invalid range role accepted')
 except ValueError:pass
`;
 const result=spawnSync('python3',['-c',code],{encoding:'utf8'});assert.equal(result.status,0,result.stderr||result.stdout);
});
