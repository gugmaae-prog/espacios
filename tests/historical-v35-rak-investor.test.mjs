import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {validateObservation,filterTrainingFold,isAvailableAsOf} from '../src/historical-intelligence/core.mjs';
const read=p=>JSON.parse(fs.readFileSync(p)),unpack=p=>JSON.parse(gunzipSync(fs.readFileSync(p)));
const snapshot=read('data/historical-intelligence-20261003.json'),publication=read('data/historical-intelligence/publication-manifest.json'),packet=read('data/historical-intelligence/rak-properties-investor-pass35-20261008.json');
const before=unpack('data/historical-intelligence/objects/d0fec5b56923a727846875e2daecdc6aa324d20377375319d347951a645668be.json.gz'),after=unpack('data/historical-intelligence/objects/9ddb117034ebb4012b4c1669fa75e7774967aef17e600d3e1d680388b780372d.json.gz'),changed=new Set(packet.facts.map(f=>f.recordId)),records=new Map(snapshot.records.map(r=>[r.id,r]));
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
test('V35 adds exact developer reports while preserving every native financial series, prior observation and unaffected record',()=>{
 assert.ok(['20261008-enrichment-v35','20261008-enrichment-v36'].includes(snapshot.version));assert.equal(publication.version,snapshot.version);assert.equal(records.size,1860);assert.equal(changed.size,8);assert.equal(packet.facts.length,20);
 assert.equal(publication.counts.sources,snapshot.version==='20261008-enrichment-v36'?3340:3334);assert.equal(publication.counts.historicalRows,633891);assert.equal(publication.counts.series,16872);
 assert.deepEqual(snapshot.sources.slice(0,before.sources.length),before.sources);assert.deepEqual(snapshot.events,before.events);assert.deepEqual(snapshot.exposures,before.exposures);
 const prior=new Map(before.records.map(r=>[r.id,r]));
 for(const r of after.records){const old=prior.get(r.id);assert.ok(old);
  if(!changed.has(r.id)){assert.deepEqual(r,old,r.id);continue;}
  for(const key of ['currentSnapshot','priorCurrentSnapshots','scenarioInputs','scenarioCoverage','historySeriesIds','communityId'])assert.deepEqual(r[key],old[key],r.id+' '+key);
  assert.deepEqual(r.lifecycle.slice(0,old.lifecycle.length),old.lifecycle);assert.deepEqual(r.observations.slice(0,old.observations.length),old.observations);
  for(const key of ['registered_sale_history','signed_rent_history','occupancy','dated_current_valuation','annual_scenario_inputs','dated_event_context','shared_financial_context'])assert.deepEqual(r.researchStatus.itemCoverage[key],old.researchStatus.itemCoverage[key],r.id+' '+key);
 }
 const native=root=>{const hashes=new Map();for(const k of new Set(root.series.map(s=>s.partition.key))){for(const s of unpack('data/historical-intelligence/objects/'+k.split('/').at(-1)).series)hashes.set(s.id,hash(s));}return hashes;};assert.deepEqual(native(after),native(before));
});
test('developer sold units and money remain cumulative native accounting data, not unit prices, registered sales or forecast inputs',()=>{
 for(const f of packet.facts.filter(f=>f.kind==='financial')){
  const r=records.get(f.recordId),o=r.observations.find(o=>o.id===f.id),s=o.developerSalesSnapshot;assert.ok(o);assert.equal(o.metric,'volume');assert.equal(o.period,'2024-06-30');assert.equal(s.asOf,o.period);assert.equal(s.unitsSold,o.value);assert.equal(s.nativeMonetaryScale,1000000);assert.equal(s.pricePerUnitDerived,false);assert.equal(s.registeredTransactionsEstablished,false);assert.equal(o.currentSnapshotEligible,false);
  const validation=validateObservation(o,r,{asOf:snapshot.asOf,sources:snapshot.sources});assert.equal(validation.valid,true);assert.equal(validation.direct,false);assert.equal(validation.coverageStatus,'context_only');
  assert.equal(filterTrainingFold([o],{asOf:snapshot.asOf,sources:snapshot.sources}).retained.length,0);assert.equal(isAvailableAsOf(o,'2024-12-31'),false);
  assert.equal(o.publishedAt,null);assert.ok(o.firstAvailableAt.startsWith('2026-10-08'));
 }
 const porto=packet.nativeSalesSnapshots.find(s=>s.sourceProjectLabel==='Porto Playa');assert.equal(porto.unitsLaunched,141);assert.equal(porto.unitsSold,138);assert.equal(porto.netSalesAEDMillion,357);assert.match(porto.populationBasis,/50%/);
 const nil=packet.facts.filter(f=>f.kind==='lifecycle'&&f.label.includes('NIL'));assert.equal(nil.length,3);for(const f of nil)assert.equal(f.progressPercent,undefined);
 for(const e of packet.excludedCandidates)assert.equal(changed.has(e.recordId),false);
});
test('retrospective Mina development and delivery retain year precision without inventing occupancy or duplicate alias facts',()=>{
 const mina=records.get('community:Ras Al Khaimah:mina-al-arab');assert.equal(mina.researchStatus.earliestHistoryEvidence.date.start,'2006');assert.equal(mina.researchStatus.earliestHistoryEvidence.date.precision,'year');
 assert.equal(packet.facts.filter(f=>f.recordId===mina.id).length,7);assert.equal(packet.facts.filter(f=>f.scope==='subject_phase').length,6);
 const flamingo=records.get('project:rak-properties-flamingo-villas-in-mina-for-sale-ras-al-khaimah-uae');assert.equal(flamingo.researchStatus.itemCoverage.delivery_reports.status,'present');assert.equal(flamingo.researchStatus.itemCoverage.occupancy.status,'missing');assert.equal(flamingo.researchStatus.itemCoverage.actual_completion.status,'missing');
 assert.equal(snapshot.manifest.approved2080ForecastRecords,0);
});
test('UI labels developer totals, money units, JV share and first availability without offering an average price',()=>{
 const context=vm.createContext({window:{},document:{querySelector:()=>null},URL,setInterval:()=>1,clearInterval(){}});vm.runInContext(fs.readFileSync('src/historical-intelligence/app.js','utf8'),context);
 const o=records.get('project:porto-playa-by-ellington-properties-and-rak-properties-on-hayat-island').observations.find(o=>o.id==='rak35-porto-reported-sales');
 const html=context.window.EspaciosHistoricalUIHelpers.developerSalesHTML(o,{sources:snapshot.sources});
 for(const text of ['Developer-reported project sales snapshot','Net sales · AED million','Revenue backlog · AED million','50% share','Cumulative project snapshot','No average price is derived','2026-10-08'])assert.ok(html.includes(text),text);
 assert.equal(context.window.EspaciosHistoricalUIHelpers.seriesRows({observations:[o]},'volume').length,0);
});
