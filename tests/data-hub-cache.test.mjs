import test from 'node:test';
import assert from 'node:assert/strict';
import hub from '../src/data-hub/worker.js';

const request=query=>new Request('https://espacios.me/data/api/v1/projects?tenant=psr&limit=1'+query);
const rows=[
 {canonical_slug:'alpha',name:'Alpha',developer:'Developer A',emirate:'Dubai',area:'Area A',payload_json:'{"propertyTypes":["Apartment"]}',public_slug:'alpha',href:'/projects/alpha',indexable:1,overrides_json:'{}',sort_rank:1},
 {canonical_slug:'beta',name:'Beta',developer:'Developer B',emirate:'Ajman',area:'Area B',payload_json:'{"propertyTypes":["Villa"]}',public_slug:'beta',href:'/projects/beta',indexable:0,overrides_json:'{}',sort_rank:2}
];
const makeEnv=()=>{
 const calls={state:0,count:0,page:0,filters:0};
 const REGISTRY={prepare(sql){let kind=sql.includes('FROM project_registry_state')?'state':sql.includes('COUNT(*) AS total')?'count':sql.includes('SELECT p.developer, p.emirate, p.payload_json')?'filters':'page';calls[kind]++;return {bind(...args){return {first:async()=>kind==='state'?{tenant_key:'psr',revision:3,project_count:2,content_hash:'hash',updated_at:'today'}:{total:2},all:async()=>kind==='filters'?{results:rows.map(({developer,emirate,payload_json})=>({developer,emirate,payload_json}))}:{results:rows.slice((Number(args.at(-1))||0),(Number(args.at(-1))||0)+Number(args.at(-2))||1)}};}};}};
 return {env:{REGISTRY,DATA_RELEASE:'espacios-data-hub-v7-public-read-cache'},calls};
};
const makeCache=()=>{const values=new Map();return {match:async key=>values.get(key.url)?.clone()||null,put:async(key,response)=>{values.set(key.url,response.clone());}};};

test('public project pages reuse exact cached responses and revision-keyed filters',async()=>{
 const {env,calls}=makeEnv();globalThis.caches={default:makeCache()};
 try{
  const first=await hub.fetch(request('&page=1'),env),body=await first.json();
  assert.equal(first.status,200);assert.equal(body.total,2);assert.equal(body.projects[0].slug,'alpha');assert.deepEqual(body.filters.emirates,{Dubai:1,Ajman:1});
  assert.deepEqual(calls,{state:1,count:0,page:1,filters:1});
  const again=await hub.fetch(request('&page=1'),env);assert.equal(again.status,200);assert.deepEqual(calls,{state:1,count:0,page:1,filters:1});
  const second=await hub.fetch(request('&page=2'),env),secondBody=await second.json();assert.equal(secondBody.projects[0].slug,'beta');
  assert.deepEqual(calls,{state:2,count:0,page:2,filters:1});
  const conditional=await hub.fetch(new Request(request('&page=1'),{headers:{'if-none-match':first.headers.get('etag')}}),env);
  assert.equal(conditional.status,304);assert.deepEqual(calls,{state:2,count:0,page:2,filters:1});
 }finally{delete globalThis.caches;}
});

test('filtered projects still use a measured count and cache failures fall back to D1',async()=>{
 const {env,calls}=makeEnv();globalThis.caches={default:{match:async()=>{throw Error('cache unavailable');},put:async()=>{throw Error('cache unavailable');}}};
 try{
  const response=await hub.fetch(request('&emirate=Dubai'),env),body=await response.json();
  assert.equal(response.status,200);assert.equal(body.total,2);assert.deepEqual(calls,{state:1,count:1,page:1,filters:1});
 }finally{delete globalThis.caches;}
});
