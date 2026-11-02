import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {mapCompleteProjects} from '../src/stack-audit/catalogue.mjs';import {mapEvidenceStore} from '../src/stack-audit/storage.mjs';
const req=()=>new Request('https://espacios.me/map/api/projects-all');
test('complete pages reconcile duplicate-aware returned and registry totals',async()=>{const service={fetch:async url=>{const page=new URL(url).searchParams.get('page')||'1';return Response.json({projects:page==='1'?[{slug:'one'},{slug:'two'}]:[{slug:'two'},{slug:'three'}],total:4,pages:2,registry:{total:3,updatedAt:'v1'}});}};const response=await mapCompleteProjects(req(),{MAP_CATALOGUE_FETCH:service});assert.equal(response.status,200);const data=await response.json();assert.equal(data.total,3);assert.equal(data.complete,true);assert.deepEqual(data.totals,{returned:3,unique:3,rowsFetched:4,duplicateRows:1,upstreamReported:4,registryReported:3});});
test('a failed, malformed or changing page never returns or caches a partial catalogue',async()=>{for(const mode of ['failed','malformed','changed']){let put=0;globalThis.caches={default:{match:async()=>null,put:async()=>put++}};const service={fetch:async url=>{const page=new URL(url).searchParams.get('page')||'1';return page==='1'?Response.json({projects:[{slug:'one'}],total:2,pages:2,registry:{total:2,updatedAt:'v1'}}):mode==='failed'?new Response('unavailable',{status:503}):Response.json({projects:mode==='malformed'?null:[{slug:'two'}],registry:{updatedAt:'v2'}});}};const response=await mapCompleteProjects(req(),{MAP_CATALOGUE_FETCH:service});assert.equal(response.status,503);assert.equal((await response.json()).complete,false);assert.equal(put,0);}delete globalThis.caches;});
test('evidence adapter encodes the exact logical key, streams bytes and never publishes cache writes',async()=>{const calls=[];const store=mapEvidenceStore({fetch:async r=>{calls.push(r);return new Response(r.method==='HEAD'?null:'native bytes',{headers:{etag:'"abc"','x-evidence-sha256':'abc','content-type':'application/octet-stream'}});}});const key='research/published/2026-10-14/history.json.gz';const object=await store.get(key);assert.equal(await object.text(),'native bytes');assert.equal(new URL(calls[0].url).searchParams.get('key'),key);assert.equal((await store.head(key)).sha256,'abc');await store.put('any','never published');assert.equal(calls.length,2);await assert.rejects(()=>store.get('../private'));});
test('archive fallback rejects inherited object names and permits primary-only approved keys',async()=>{let assets=0;const{mapArchiveFallback}=await import('../src/stack-audit/storage.mjs');const store=mapArchiveFallback({get:async key=>key==='primary-only'?{text:async()=> 'approved'}:null,head:async()=>null},{fetch:async()=>{assets++;throw Error('must not read unapproved asset');}},{entries:{}});assert.equal(await(await store.get('primary-only')).text(),'approved');assert.equal(await store.get('__proto__'),null);assert.equal(await store.get('constructor'),null);assert.equal(assets,0);});

test('all declared pages remain available while registry drift is explicit and returned totals stay consistent',async()=>{const service={fetch:async()=>Response.json({projects:[{slug:'one'}],pages:1,total:3,registry:{total:2}})};const response=await mapCompleteProjects(req(),{MAP_CATALOGUE_FETCH:service}),data=await response.json();assert.equal(response.status,200);assert.equal(data.total,data.projects.length);assert.equal(data.complete,true);assert.equal(data.coverage.allDeclaredPagesRetrieved,true);assert.equal(data.coverage.populationReconciled,false);assert.equal(data.coverage.registryReconciled,false);assert.equal(data.totals.registryReported,2);assert.equal(data.totals.upstreamReported,3);});

test('bounded upstream retries recover transient pages while every declared page is still validated',async()=>{const calls=new Map(),service={fetch:async url=>{const page=new URL(url).searchParams.get('page')||'1',n=(calls.get(page)||0)+1;calls.set(page,n);if(page==='2'&&n===1)return new Response('temporary',{status:503});return Response.json({projects:[{slug:page}],pages:2,total:2,registry:{total:2}});}};const response=await mapCompleteProjects(req(),{MAP_CATALOGUE_FETCH:service}),data=await response.json();assert.equal(response.status,200);assert.equal(data.total,2);assert.deepEqual(data.coverage.retriedPages,[2]);assert.equal(calls.get('2'),2);});

test('Map data-hub paging retrieves 1091 registered source rows within the Worker invocation budget',async()=>{const source=Array.from({length:1091},(_,i)=>({slug:'project-'+i}));let calls=0;const service={fetch:async(url,init)=>{calls++;assert.equal(init.headers.accept,'application/json');assert.match(url,/limit=100/);const page=Number(new URL(url).searchParams.get('page')||'1');return Response.json({projects:source.slice((page-1)*100,page*100),pages:11,total:source.length,pageSize:100,page,registry:{total:source.length,updatedAt:'v1'}});}};const response=await mapCompleteProjects(req(),{MAP_CATALOGUE_FETCH:service}),data=await response.json();assert.equal(response.status,200);assert.equal(calls,11);assert.equal(data.projects.length,1091);assert.deepEqual(data.projects,source);assert.equal(data.coverage.maximumFetchCalls,30);assert.equal(data.coverage.populationReconciled,true);});

test('data-hub provenance is retained and the older PSR binding is never used for complete pages',async()=>{let hubCalls=0,psrCalls=0;const service={fetch:async()=>{hubCalls++;return Response.json({projects:[{slug:'one'}],total:1,pages:1,page:1,pageSize:100,registry:{total:1,updatedAt:'2026-09-27',contentHash:'abc'}},{headers:{'x-espacios-data-release':'espacios-data-hub-v6','x-espacios-publisher-release':'publisher-v3'}});}};const response=await mapCompleteProjects(req(),{MAP_CATALOGUE_FETCH:service,PSR_PROPERTY:{fetch:async()=>{psrCalls++;throw Error('Do not use 24-row PSR pages.');}}});const data=await response.json();assert.equal(response.status,200);assert.equal(hubCalls,1);assert.equal(psrCalls,0);assert.equal(data.source.service,'espacios-data-hub-public-route');assert.equal(data.source.registryUpdatedAt,'2026-09-27');assert.equal(data.source.registryContentHash,'abc');assert.equal(data.source.dataRelease,'espacios-data-hub-v6');assert.equal(data.source.publisherRelease,'publisher-v3');});

test('24-row service pages fail closed instead of claiming a complete catalogue',async()=>{const service={fetch:async()=>Response.json({projects:[{slug:'one'}],total:46,pages:2,page:1,pageSize:24})};const response=await mapCompleteProjects(req(),{MAP_CATALOGUE_FETCH:service});assert.equal(response.status,503);assert.equal((await response.json()).complete,false);});

test('a page count beyond the hard request budget fails before extra I/O',async()=>{let calls=0;const service={fetch:async()=>{calls++;return Response.json({projects:[{slug:'one'}],pages:51,total:51});}};const r=await mapCompleteProjects(req(),{MAP_CATALOGUE_FETCH:service});assert.equal(r.status,503);assert.equal(calls,1);});

test('explicit malformed pagination never becomes a cached single-page catalogue',async()=>{for(const pages of [0,'broken',null,-1,1.5]){let calls=0;const service={fetch:async()=>{calls++;return Response.json({projects:[{slug:'one'}],pages,total:2});}};const r=await mapCompleteProjects(req(),{MAP_CATALOGUE_FETCH:service});assert.equal(r.status,503);assert.equal(calls,1);}});

const legacyManifest=JSON.parse(await fs.readFile(new URL('../data/recovery/psr-public-legacy-20261102.manifest.json',import.meta.url),'utf8'));
const legacyBytes=await fs.readFile(new URL('../data/recovery/psr-public-legacy-20261102.json.gz',import.meta.url));
const snapshot={...legacyManifest,base64:legacyBytes.toString('base64')};
const d1Manifest=JSON.parse(await fs.readFile(new URL('../data/recovery/psr-public-d1-export-20261102.manifest.json',import.meta.url),'utf8'));
const d1Bytes=await fs.readFile(new URL('../data/recovery/psr-public-d1-export-20261102.json.gz',import.meta.url));
const d1Snapshot={...d1Manifest,base64:d1Bytes.toString('base64')};
test('D1 quota failure serves the exact current registry export with explicit degraded labels',async()=>{
 let calls=0;const service={fetch:async()=>{calls++;return new Response('D1 read quota',{status:503});}};
 const response=await mapCompleteProjects(req(),{MAP_CATALOGUE_FETCH:service,MAP_CATALOGUE_D1_SNAPSHOT:d1Snapshot,MAP_CATALOGUE_SNAPSHOT:snapshot}),body=await response.json();
 assert.equal(response.status,200);assert.equal(response.headers.get('x-espacios-catalogue'),'reviewed-d1-export-degraded-v1');
 assert.equal(body.total,1091);assert.equal(body.projects.length,1091);assert.equal(new Set(body.projects.map(p=>p.slug)).size,1091);
 assert.equal(body.source.service,'reviewed-psr-d1-public-export');assert.equal(body.source.snapshotSHA256,d1Manifest.rawSha256);
 assert.equal(body.registry.contentHash,d1Manifest.registry.contentHash);assert.equal(body.coverage.registryHashReconciled,false);
 assert.equal(body.completeForCurrentDataHub,false);assert.equal(body.degraded,true);assert.equal(calls,2);
});
test('a corrupt D1 export fails over to the separately verified older snapshot',async()=>{
 const service={fetch:async()=>new Response('D1 read quota',{status:503})};
 const response=await mapCompleteProjects(req(),{MAP_CATALOGUE_FETCH:service,MAP_CATALOGUE_D1_SNAPSHOT:{...d1Snapshot,compressedSha256:'0'.repeat(64)},MAP_CATALOGUE_SNAPSHOT:snapshot}),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.total,1073);assert.equal(body.source.service,'reviewed-older-psr-public-snapshot');
});
test('D1 quota failure serves only the exact older PSR snapshot with its degraded vintage',async()=>{
 let calls=0;const service={fetch:async url=>{calls++;assert.match(url,/\/data\/api\/v1\/projects/);return new Response('D1 quota',{status:503});}};
 const response=await mapCompleteProjects(req(),{MAP_CATALOGUE_FETCH:service,MAP_CATALOGUE_SNAPSHOT:snapshot}),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.total,1073);assert.equal(body.projects.length,1073);assert.equal(body.source.service,'reviewed-older-psr-public-snapshot');assert.equal(body.source.degraded,true);assert.equal(body.completeForCurrentDataHub,false);assert.equal(body.coverage.allDeclaredPagesRetrieved,false);assert.equal(body.source.registryUpdatedAt,'2026-07-22T11:20:58.155Z');assert.equal(calls,2);
});

test('missing or checksum-mismatched legacy snapshot cannot be published',async()=>{
 const service={fetch:async()=>new Response('D1 quota',{status:503})};
 for(const candidate of [null,{...snapshot,compressedSha256:'0'.repeat(64)}]){
  const response=await mapCompleteProjects(req(),{MAP_CATALOGUE_FETCH:service,MAP_CATALOGUE_SNAPSHOT:candidate});assert.equal(response.status,503);assert.equal((await response.json()).complete,false);
 }
});

test('unverifiable first Data Hub page uses the reviewed snapshot and remains degraded',async()=>{
 const service={fetch:async()=>Response.json({projects:[{slug:'one'}],pageSize:24,total:1,pages:1})};
 const response=await mapCompleteProjects(req(),{MAP_CATALOGUE_FETCH:service,MAP_CATALOGUE_SNAPSHOT:snapshot}),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.total,1073);assert.equal(body.degraded,true);assert.equal(body.completeForCurrentDataHub,false);
});

test('first page transport failure uses only the verified older snapshot',async()=>{
 const service={fetch:async()=>{throw new Error('transport unavailable')}};
 const response=await mapCompleteProjects(req(),{MAP_CATALOGUE_FETCH:service,MAP_CATALOGUE_SNAPSHOT:snapshot}),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.total,1073);assert.equal(body.completeForCurrentDataHub,false);
});
