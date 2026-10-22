// Read-only canonical acceptance against the exact local immutable candidate.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),args=process.argv.slice(2);
const option=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const origin=option('--origin','https://espacios.me');
const output=option('--output','history-release-verification.json');
const read=async p=>JSON.parse(await fs.readFile(new URL(p,root),'utf8'));
const snapshot=await read('data/historical-intelligence-20261003.json');
const manifest=await read('data/historical-intelligence/publication-manifest.json');
const packet=await read(option('--packet','enrichment/v11/pass23-34-reviewed.json'));
const receipt={origin,version:manifest.version,checkedAt:new Date().toISOString(),readOnly:true};
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
async function get(path){
 const response=await fetch(origin+path,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(120000)});
 assert.equal(response.status,200,path);const body=await response.json();assert.equal(body.version,manifest.version,path+' version');return body;
}
try{
 const ledger=await get('/map/api/record-history?includeItemCoverage=1');
 const records=new Map(snapshot.records.map(r=>[r.id,r]));
 assert.equal(ledger.records.length,1860);assert.equal(new Set(ledger.records.map(r=>r.id)).size,1860);
 const statuses={};let items=0;
 for(const r of ledger.records){
  const expected=records.get(r.id);assert.ok(expected,r.id);
  for(const k of ['type','name','emirate','communityId'])assert.equal(r[k]??null,expected[k]??null,r.id+' '+k);
  assert.equal(hash(r.researchStatus),hash(expected.researchStatus),r.id+' exact ledger');
  const coverage=r.researchStatus.itemCoverage;assert.equal(Object.keys(coverage).length,23);
  for(const item of Object.values(coverage)){statuses[item.status]=(statuses[item.status]||0)+1;items++;}
  assert.equal(coverage.annual_scenario_inputs.firstYear,2027);assert.equal(coverage.annual_scenario_inputs.lastYear,2080);
  assert.notEqual(coverage.complete_registered_sale_history.completeLifetimeHistory,true);
  assert.notEqual(coverage.complete_signed_rent_history.completeLifetimeHistory,true);
 }
 receipt.ledger={records:records.size,items,statuses,annualEndpoint:2080};
 const events=await get('/map/api/events');
 assert.equal(events.events.length,snapshot.events.length);assert.equal(events.sources.length,snapshot.sources.length);assert.equal(events.exposures.length,snapshot.exposures.length);
 assert.equal(events.classification,'event_evidence_not_causal_price_effects');
 receipt.events={events:events.events.length,sources:events.sources.length,exposures:events.exposures.length};
 const wanted=new Set((packet.seriesLinks||[]).map(s=>s.seriesId)),series=new Map();
 for(const o of manifest.objects.filter(o=>o.kind==='history_partition')){
  const p=JSON.parse(gunzipSync(await fs.readFile(new URL(o.path,root))));
  for(const s of p.series)if(wanted.has(s.id))series.set(s.id,s);
 }
 assert.equal(series.size,wanted.size);let points=0,checked=0;
 // Bound requests so canonical read verification does not overwhelm the Worker.
 for(let i=0;i<(packet.seriesLinks||[]).length;i+=4){
  await Promise.all((packet.seriesLinks||[]).slice(i,i+4).map(async link=>{
   const body=await get('/map/api/record-history?'+new URLSearchParams({recordId:link.recordId,seriesId:link.seriesId}));
   const actual=body.historySeries.find(s=>s.id===link.seriesId),expected=series.get(link.seriesId);
   assert.ok(actual,link.seriesId);assert.deepEqual(actual.columns,expected.columns);assert.deepEqual(actual.points,expected.points);
   assert.equal(actual.scope,link.scope);assert.equal(actual.identityVerified,link.identityVerified);
   const record=records.get(link.recordId);
   for(const key of ['lifecycle','observations','registerEvidence','currentSnapshot','priorCurrentSnapshots'])assert.deepEqual(body.record[key],record[key],link.recordId+' '+key);
   points+=actual.points.length;checked++;
  }));
 }
 receipt.increment={series:checked,nativePoints:points};receipt.passed=true;
 const factRecords=[...new Set((packet.facts||[]).filter(f=>f.status==='accepted').map(f=>f.recordId))];
 for(let i=0;i<factRecords.length;i+=4){
  await Promise.all(factRecords.slice(i,i+4).map(async id=>{
   const body=await get('/map/api/record-history?'+new URLSearchParams({recordId:id})),expected=records.get(id);
   assert.ok(expected,id);
   for(const key of ['lifecycle','observations','registerEvidence','currentSnapshot','priorCurrentSnapshots','researchStatus'])assert.deepEqual(body.record[key],expected[key],id+' '+key);
   assert.equal(body.scenarios.targetYears.length,54,id+' annual slots');
   assert.equal(body.scenarios.targetYears.at(-1),2080,id+' annual endpoint');
  }));
 }
 receipt.increment.factRecords=factRecords.length;
}catch(error){receipt.passed=false;receipt.error=error.stack||String(error);process.exitCode=1;}
await fs.writeFile(output,JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
