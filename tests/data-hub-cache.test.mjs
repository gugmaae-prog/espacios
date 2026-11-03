import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import hub from '../src/data-hub/worker.js';
import {PSR_PUBLIC_FILTERS} from '../src/data-hub/psr-public-filters.mjs';

const request=query=>new Request('https://espacios.me/data/api/v1/projects?tenant=psr&limit=1'+query);
const rows=[
 {canonical_slug:'alpha',name:'Alpha',developer:'Developer A',emirate:'Dubai',area:'Area A',payload_json:'{"propertyTypes":["Apartment"]}',public_slug:'alpha',href:'/projects/alpha',indexable:1,overrides_json:'{}',sort_rank:1},
 {canonical_slug:'beta',name:'Beta',developer:'Developer B',emirate:'Ajman',area:'Area B',payload_json:'{"propertyTypes":["Villa"]}',public_slug:'beta',href:'/projects/beta',indexable:0,overrides_json:'{}',sort_rank:2}
];
const makeEnv=(state={tenant_key:'psr',revision:3,project_count:2,content_hash:'hash',updated_at:'today'})=>{
 const calls={state:0,count:0,page:0,filters:0};
 const REGISTRY={prepare(sql){let kind=sql.includes('FROM project_registry_state')?'state':sql.includes('COUNT(*) AS total')?'count':sql.includes('SELECT p.developer, p.emirate, p.payload_json')?'filters':'page';calls[kind]++;return {bind(...args){return {first:async()=>kind==='state'?state:{total:2},all:async()=>kind==='filters'?{results:rows.map(({developer,emirate,payload_json})=>({developer,emirate,payload_json}))}:{results:rows.slice((Number(args.at(-1))||0),(Number(args.at(-1))||0)+Number(args.at(-2))||1)}};}};}};
 return {env:{REGISTRY,DATA_RELEASE:'espacios-data-hub-v12-hash-repair-ready'},calls};
};
const makeCache=()=>{const values=new Map();return {match:async key=>values.get(key.url)?.clone()||null,put:async(key,response)=>{values.set(key.url,response.clone());}};};

test('a prior release cache entry cannot hide the current source state',async()=>{
 const cache=makeCache(),{env,calls}=makeEnv();
 await cache.put(request('&page=1'),Response.json({ok:true,projects:[],total:0}));
 globalThis.caches={default:cache};
 try{
  const response=await hub.fetch(request('&page=1'),env),body=await response.json();
  assert.equal(response.status,200);assert.equal(body.total,2);assert.equal(body.projects[0].slug,'alpha');
  assert.deepEqual(calls,{state:1,count:0,page:1,filters:1});
 }finally{delete globalThis.caches;}
});

test('public project pages reuse exact cached responses and revision-keyed filters',async()=>{
 const {env,calls}=makeEnv();globalThis.caches={default:makeCache()};
 try{
  const first=await hub.fetch(request('&page=1'),env),body=await first.json();
  assert.equal(first.status,200);assert.equal(body.total,2);assert.equal(body.projects[0].slug,'alpha');assert.deepEqual(body.filters.emirates,{Dubai:1,Ajman:1});
  assert.deepEqual(calls,{state:1,count:0,page:1,filters:1});
  const again=await hub.fetch(request('&page=1'),env),cached=await again.json();assert.equal(again.status,200);assert.equal(cached.source.service,'cached-verified-d1-page');assert.equal(cached.source.degraded,true);assert.equal(cached.source.completeForCurrentDataHub,false);assert.equal(again.headers.get('x-espacios-data-degraded'),'true');assert.equal(again.headers.get('etag'),null);assert.deepEqual(calls,{state:1,count:0,page:1,filters:1});
  const second=await hub.fetch(request('&page=2'),env),secondBody=await second.json();assert.equal(secondBody.projects[0].slug,'beta');
  assert.deepEqual(calls,{state:2,count:0,page:2,filters:1});
  const conditional=await hub.fetch(new Request(request('&page=1'),{headers:{'if-none-match':first.headers.get('etag')}}),env);
  assert.equal(conditional.status,200);assert.equal((await conditional.json()).source.degraded,true);assert.deepEqual(calls,{state:2,count:0,page:2,filters:1});
 }finally{delete globalThis.caches;}
});

test('filtered projects still use a measured count and cache failures fall back to D1',async()=>{
 const {env,calls}=makeEnv();globalThis.caches={default:{match:async()=>{throw Error('cache unavailable');},put:async()=>{throw Error('cache unavailable');}}};
 try{
  const response=await hub.fetch(request('&emirate=Dubai'),env),body=await response.json();
  assert.equal(response.status,200);assert.equal(body.total,2);assert.deepEqual(calls,{state:1,count:1,page:1,filters:1});
 }finally{delete globalThis.caches;}
});

test('exact reviewed registry revision uses checksum-derived filters without a full D1 filter scan',async()=>{
 execFileSync(process.execPath,[new URL('../scripts/build-data-hub-filters.mjs',import.meta.url).pathname,'--check']);
 const r=PSR_PUBLIC_FILTERS.registry;
 const {env,calls}=makeEnv({tenant_key:'psr',revision:r.revision,project_count:r.total,content_hash:r.contentHash,updated_at:r.updatedAt});
 const response=await hub.fetch(request('&page=1'),env),body=await response.json();
 assert.equal(response.status,200);
 assert.deepEqual(body.filters,PSR_PUBLIC_FILTERS.filters);
 assert.equal(body.filters.emirates.Dubai,893);
 assert.deepEqual(calls,{state:1,count:0,page:1,filters:0});
});

test('reconciled registry hash preserves the same verified filters without a D1 filter scan',async()=>{
 const r=PSR_PUBLIC_FILTERS.registry;
 const {env,calls}=makeEnv({tenant_key:'psr',revision:r.revision,project_count:r.total,content_hash:PSR_PUBLIC_FILTERS.verifiedProjectionHash,updated_at:r.updatedAt});
 const response=await hub.fetch(request('&page=1'),env),body=await response.json();
 assert.equal(response.status,200);
 assert.deepEqual(body.filters,PSR_PUBLIC_FILTERS.filters);
 assert.equal(body.registry.contentHash,PSR_PUBLIC_FILTERS.verifiedProjectionHash);
 assert.deepEqual(calls,{state:1,count:0,page:1,filters:0});
});

test('registry hash correction invalidates the public page ETag',async()=>{
 const r=PSR_PUBLIC_FILTERS.registry,oldState={tenant_key:'psr',revision:r.revision,project_count:r.total,content_hash:r.contentHash,updated_at:r.updatedAt};
 const first=await hub.fetch(request('&page=1&audit=etag'),makeEnv(oldState).env),etag=first.headers.get('etag');
 const correctedState={...oldState,content_hash:PSR_PUBLIC_FILTERS.verifiedProjectionHash};
 const second=await hub.fetch(new Request(request('&page=1&audit=etag'),{headers:{'if-none-match':etag}}),makeEnv(correctedState).env);
 assert.equal(first.status,200);
 assert.equal(second.status,200);
 assert.notEqual(second.headers.get('etag'),etag);
});

test('changed content hash at the same revision returns to live D1 filters',async()=>{
 const r=PSR_PUBLIC_FILTERS.registry;
 const {env,calls}=makeEnv({tenant_key:'psr',revision:r.revision,project_count:r.total,content_hash:'changed',updated_at:r.updatedAt});
 const response=await hub.fetch(request('&page=1'),env),body=await response.json();
 assert.equal(response.status,200);
 assert.deepEqual(body.filters.emirates,{Dubai:1,Ajman:1});
 assert.deepEqual(calls,{state:1,count:0,page:1,filters:1});
});
