import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {validateObservation,filterTrainingFold,isAvailableAsOf} from '../src/historical-intelligence/core.mjs';
const read=p=>JSON.parse(fs.readFileSync(p)),unpack=p=>JSON.parse(gunzipSync(fs.readFileSync(p)));
const snapshot=read('data/historical-intelligence-20261003.json'),publication=read('data/historical-intelligence/publication-manifest.json'),packet=read('data/historical-intelligence/rak-properties-financial-pass37-20261008.json');
const before=unpack('data/historical-intelligence/objects/3995529ceb9737e72ad485deb445ad538446e0c26edbb009b67da4a643034b57.json.gz'),after=unpack('data/historical-intelligence/objects/be31d7f61e60b822c9fc005051f958613d2cd2db0c830b69fb1366e9a3dacf75.json.gz'),changed=new Set(packet.facts.map(f=>f.recordId)),records=new Map(snapshot.records.map(r=>[r.id,r]));
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const mina='community:Ras Al Khaimah:mina-al-arab',nb='project:nb-collection-by-rak-properties-on-hayat-island';
test('V37 preserves every catalogue record, previous observation, source and native series',()=>{
 assert.ok(['20261008-enrichment-v37','20261008-enrichment-v38','20261009-enrichment-v39'].includes(snapshot.version));assert.equal(publication.version,snapshot.version);assert.equal(records.size,1860);assert.equal(changed.size,8);assert.equal(packet.facts.length,17);assert.equal(packet.sources.length,3);
 assert.equal(publication.counts.sources,snapshot.version==='20261009-enrichment-v39'?3348:snapshot.version==='20261008-enrichment-v38'?3345:3343);assert.equal(publication.counts.historicalRows,633891);assert.equal(publication.counts.series,16872);
 assert.deepEqual(snapshot.sources.slice(0,before.sources.length),before.sources);assert.deepEqual(snapshot.events,before.events);assert.deepEqual(snapshot.exposures,before.exposures);
 const prior=new Map(before.records.map(r=>[r.id,r]));
 for(const r of after.records){const old=prior.get(r.id);assert.ok(old);
  if(!changed.has(r.id)){assert.deepEqual(r,old,r.id);continue;}
  for(const key of ['currentSnapshot','priorCurrentSnapshots','scenarioInputs','scenarioCoverage','historySeriesIds','communityId'])assert.deepEqual(r[key],old[key],r.id+' '+key);
  assert.deepEqual(r.lifecycle.slice(0,old.lifecycle.length),old.lifecycle);assert.deepEqual(r.observations.slice(0,old.observations.length),old.observations);
  for(const key of ['registered_sale_history','signed_rent_history','occupancy','actual_completion','dated_current_valuation','annual_scenario_inputs','dated_event_context','shared_financial_context'])assert.deepEqual(r.researchStatus.itemCoverage[key],old.researchStatus.itemCoverage[key],r.id+' '+key);
 }
 const native=root=>{const hashes=new Map();for(const k of new Set(root.series.map(s=>s.partition.key))){for(const s of unpack('data/historical-intelligence/objects/'+k.split('/').at(-1)).series)hashes.set(s.id,hash(s));}return hashes;};assert.deepEqual(native(after),native(before));
 for(const e of packet.excludedCandidates.filter(e=>e.recordId))assert.equal(changed.has(e.recordId),false);
});
test('FY sales vintages retain differing populations, zero backlog and NIL progress without creating prices',()=>{
 for(const f of packet.facts.filter(f=>f.kind==='financial')){
  const r=records.get(f.recordId),o=r.observations.find(x=>x.id===f.id),s=o.developerSalesSnapshot;
  assert.equal(o.period,'2024-12-31');assert.equal(s.asOf,o.period);assert.equal(o.value,s.unitsSold);assert.equal(s.nativeMonetaryScale,1000000);assert.equal(o.currentSnapshotEligible,false);assert.equal(o.includeInCurrentSnapshot,false);
  assert.equal(s.pricePerUnitDerived,false);assert.equal(s.registeredTransactionsEstablished,false);
  const validation=validateObservation(o,r,{asOf:snapshot.asOf,sources:snapshot.sources});assert.equal(validation.valid,true);assert.equal(validation.direct,false);assert.equal(validation.coverageStatus,'context_only');
  assert.equal(filterTrainingFold([o],{asOf:snapshot.asOf,sources:snapshot.sources}).retained.length,0);assert.equal(isAvailableAsOf(o,'2025-12-31'),false);
 }
 const q=records.get('project:quattro-del-mar-by-rak-properties-on-hayat-island').observations.filter(o=>o.developerSalesSnapshot);
 assert.deepEqual(q.map(o=>[o.period,o.developerSalesSnapshot.unitsLaunched]),[['2024-06-30',631],['2024-12-31',888]]);
 const s=label=>packet.nativeSalesSnapshots.find(x=>x.sourceProjectLabel===label);
 assert.equal(s('Marbella Extension').revenueBacklogAEDMillion,0);assert.equal(s('NB Collections').unitsSold,1);assert.equal(s('NB Collections').netSalesAEDMillion,24);assert.match(s('Porto Playa').populationBasis,/50%/);assert.equal(s('Porto Playa').unitsSold,139);
 for(const key of ['nb','edge']){assert.equal(s(key==='nb'?'NB Collections':'The Edge').reportedConstructionComplete,'NIL');assert.equal(packet.facts.find(f=>f.id===`rak37-${key}-progress`).progressPercent,undefined);}
 assert.equal(records.get(nb).researchStatus.itemCoverage.construction.status,'missing');assert.equal(records.get(nb).researchStatus.itemCoverage.registered_sale_history.status,'missing');assert.equal(records.get(nb).researchStatus.itemCoverage.dated_current_valuation.status,'missing');
});
test('hotel opening reports retain component scope and publication-date semantics alongside earlier targets',()=>{
 const r=records.get(mina),a=r.lifecycle.find(x=>x.id==='rak37-mina-anantara-opening'),ihg=r.lifecycle.find(x=>x.id==='rak37-mina-intercontinental-opening-report');
 assert.equal(a.scope,'subject_phase');assert.deepEqual(a.date,{start:'2024-01-02',precision:'day'});assert.equal(a.sourcePage,10);
 assert.equal(ihg.kind,'phase_opening_report');assert.equal(ihg.scope,'subject_phase');assert.equal(ihg.date.start,'2022-03-03');assert.match(ihg.dateBasis,/exact first operating day unestablished/);
 for(const f of [a,ihg]){for(const id of f.relatedMilestoneIds)assert.ok(r.lifecycle.some(x=>x.id===id&&x.eventStatus==='planned'));assert.equal(isAvailableAsOf(f,'2025-01-01'),false);}
 assert.equal(r.researchStatus.itemCoverage.occupancy.status,'missing');assert.equal(r.researchStatus.itemCoverage.actual_completion.status,'missing');
 const launch=records.get(nb).lifecycle.find(x=>x.id==='rak37-nb-announcement');assert.equal(launch.date.start,'2024-06-26');assert.equal(launch.status,'verified');assert.match(launch.note,/not proof of first-ever/);
 assert.equal(snapshot.manifest.approved2080ForecastRecords,0);
});
test('UI shows native cumulative figures and zero backlog without relabelling as financial history',()=>{
 const context=vm.createContext({window:{},document:{querySelector:()=>null},URL,setInterval:()=>1,clearInterval(){}});vm.runInContext(fs.readFileSync('src/historical-intelligence/app.js','utf8'),context);
 for(const f of packet.facts.filter(f=>f.kind==='financial')){
  const o=records.get(f.recordId).observations.find(x=>x.id===f.id),html=context.window.EspaciosHistoricalUIHelpers.developerSalesHTML(o,{sources:snapshot.sources});
  for(const text of ['Developer-reported project sales snapshot','2024-12-31','Net sales · AED million','Revenue backlog · AED million','No average price is derived','2026-10-08'])assert.ok(html.includes(text),text);
  assert.equal(context.window.EspaciosHistoricalUIHelpers.seriesRows({observations:[o]},'volume').length,0);
 }
});
test('ingestion rejects accounting relabelling and malformed populations while accepting native zero and NIL',()=>{
 const code=String.raw`
import sys,copy,json
sys.path.insert(0,'scripts')
from historical_enrichment import apply_enrichment
packet=json.load(open('data/historical-intelligence/rak-properties-financial-pass37-20261008.json'))
snapshot=json.load(open('data/historical-intelligence-20261003.json'));sources={s['id']:s for s in snapshot['sources']}
f=next(f for f in packet['facts'] if f['id']=='rak37-marbella2-reported-sales')
def run(f):
 r={'id':f['recordId'],'emirate':'Ras Al Khaimah','type':'project','name':'Review subject','lifecycle':[],'observations':[],'historySeries':[],'researchStatus':{'gaps':[]},'coverageSummary':{},'currentSnapshot':{}}
 apply_enrichment({'asOf':'2026-10-08','facts':[f]},[r],{},sources,lambda x:None,{},'2026-10-08')
run(copy.deepcopy(f))
good=copy.deepcopy(f);good['observation']['developerSalesSnapshot']['reportedConstructionComplete']='NIL';run(good)
for patch in [{'unitsLaunched':1},{'unitsSold':True},{'revenueBacklogAEDMillion':-1},{'netSalesAEDMillion':float('nan')},{'currency':'USD'},{'nativeMonetaryScale':1},{'asOf':'2024-06-30'},{'reportedConstructionComplete':None},{'reportedSoldPercent':101},{'pricePerUnitDerived':True},{'registeredTransactionsEstablished':True},{'populationBasis':''}]:
 bad=copy.deepcopy(f);bad['observation']['developerSalesSnapshot'].update(patch)
 try:run(bad);raise AssertionError('Invalid developer aggregate accepted')
 except ValueError:pass
for patch in [{'metric':'price'},{'observationKind':'transaction'},{'currentSnapshotEligible':True},{'includeInCurrentSnapshot':True}]:
 bad=copy.deepcopy(f);bad['observation'].update(patch)
 try:run(bad);raise AssertionError('Invalid aggregate role accepted')
 except ValueError:pass
`;
 const r=spawnSync('python3',['-c',code],{encoding:'utf8',maxBuffer:1024*1024});assert.equal(r.status,0,r.stderr||r.stdout);
});
