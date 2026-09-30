import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import worker from '../src/worker.js';
const release='20260930-smart-estimates-v1';
const key='research/published/2026-09-30/smart-estimates-v1/scenarios.json';
const baseline=fs.readFileSync(new URL('../src/baseline/worker-20260930.js',import.meta.url),'utf8');
const source=fs.readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
assert.equal(createHash('sha256').update(baseline).digest('hex'),'b9aab494d2297e7208f5257c069a54c2a6f9eb3762ff79224350ae4006357e06');
const preserved=baseline.replace(/export \{\s*worker_default as default\s*\};/,'').replace(/\/\/# sourceMappingURL=.*\n?/g,'').replaceAll('20260929-collapse-repair-v3',release);
assert.ok(source.startsWith(preserved),'Preserve the entire acquired baseline after documented cache-token/source-map normalization');
const extension=fs.readFileSync(new URL('../src/smart-estimates/worker-extension.js',import.meta.url),'utf8');
assert.doesNotMatch(extension,/SUPABASE|service_role|\.supabase\.co|\/crm\b|\/contacts\b/i);
const forbidden=()=>{throw new Error('Private binding accessed by public scenario endpoint');};
const privateBinding=new Proxy({}, {get:forbidden});
const snapshot={version:release,classification:'conditional_scenarios_not_validated_forecasts',rows:[{id:'synthetic-test-record',price:100}]};
const body=JSON.stringify(snapshot),etag='"synthetic-test-etag"';let reads=0;
const env={DB:privateBinding,PSR_PROPERTY:privateBinding,AI:privateBinding,MARKET_R2:{
 async get(requestedKey){assert.equal(requestedKey,key);reads++;return{body,httpEtag:etag};},
 put:forbidden,delete:forbidden,list:forbidden
}};
const request=(pathname='/map/api/smart-estimates',init={},bindings=env)=>worker.fetch(new Request('https://espacios.me'+pathname,init),bindings,{waitUntil(){}});
for(const pathname of ['/map/api/smart-estimates','/map/api/smart-estimates/','/map/api/smart-estimates?unit=villa']){
 const response=await request(pathname);assert.equal(response.status,200);assert.deepEqual(await response.json(),snapshot);
 assert.equal(response.headers.get('x-espacios-estimates'),release);assert.equal(response.headers.get('etag'),etag);
 assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.match(response.headers.get('cache-control'),/public/);
}
const head=await request(undefined,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(head.headers.get('etag'),etag);
const conditional=await request(undefined,{headers:{'if-none-match':etag}});assert.equal(conditional.status,304);assert.equal(await conditional.text(),'');
const priorReads=reads;
for(const method of ['POST','PUT','PATCH','DELETE']){const r=await request(undefined,{method,body:'not-persisted'});assert.equal(r.status,405);assert.equal(r.headers.get('allow'),'GET, HEAD');assert.match(r.headers.get('cache-control'),/no-store/);}
assert.equal(reads,priorReads);
for(const bindings of [{},{MARKET_R2:{get:async()=>null}},{MARKET_R2:{get:async()=>{throw new Error('synthetic-private-storage-detail');}}}]){
 const r=await request(undefined,{},bindings);assert.equal(r.status,503);assert.match(r.headers.get('cache-control'),/no-store/);assert.doesNotMatch(await r.text(),/synthetic-private-storage-detail/);
}
const system=await(await request('/map/api/system',{},{})).json();assert.equal(system.dataRoom.access,'restricted');
assert.equal(system.smartEstimates.classification,'conditional_scenarios_not_validated_forecasts');
assert.deepEqual(system.smartEstimates.horizonsYears,[1,3,5,10]);assert.equal(system.smartEstimates.originalHistoryPreserved,true);assert.equal(system.smartEstimates.key,key);
console.log('Smart API checks passed: baseline preservation, exact public snapshot key, GET/HEAD/304, write rejection, sanitized failures and no private binding access.');
