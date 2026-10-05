import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto,createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import * as core from '../src/historical-intelligence/core.mjs';
const wrapper=await fs.readFile(new URL('../src/historical-intelligence/worker-extension.js',import.meta.url),'utf8');
const event={id:'pandemic',title:'Dated public event',category:'market_shock',eventDate:{start:'2020-03-11',precision:'day'},publishedAt:'2020-03-11',firstAvailableAt:'2020-03-11',sourceIds:['news'],priceUpliftPct:null};
const data={version:'test-history-v1',asOf:'2026-10-03',records:[{id:'project:a',type:'project',name:'A',emirate:'Dubai',communityId:'community:a',lifecycle:[],observations:[],historySeries:[],researchStatus:{subjectHistory:'not_verified'}},{id:'community:a',type:'community',name:'A Community',emirate:'Dubai',lifecycle:[],observations:[],historySeries:[]}],events:[event],sources:[{id:'news',url:'https://example.com/news',publishedAt:'2020-03-11'},{id:'sales',url:'https://example.com/sales',publishedAt:'2026-09-01'},{id:'unused',url:'https://example.com/unused',publishedAt:'2026-01-01'}],exposures:[{eventId:event.id,recordId:'community:a',scope:'community',verified:false}],exposureRules:[{eventId:event.id,scope:'national',appliesTo:'project',emirates:['Dubai'],sourceIds:['news'],verified:false}],manifest:{recordCount:2}};
function fixture(snapshot=data,loader=null){
 const worker={fetch:async()=>new Response('existing-route',{status:202})},context={worker_default:worker,HI_DATA:structuredClone(snapshot),HI_CORE:core,crypto:webcrypto,Response,Request,URL,TextEncoder,TextDecoder,DecompressionStream,TypeError,RangeError,Map,Set,Date,JSON,Uint8Array,ReadableStream};
 if(loader)context.HI_GET_DATA=async()=>{context.HI_DATA=await loader();};
 vm.runInNewContext(wrapper,context);return worker;
}
const req=(path,options)=>new Request('https://espacios.me'+path,options),none=new Proxy({},{get(){throw Error('No binding should be accessed');}});
test('read-only APIs retain all records, exact IDs, compact rule events and prior route behavior',async()=>{
 const worker=fixture();const index=await worker.fetch(req('/map/api/record-history'),none,{});assert.equal(index.status,200);assert.equal((await index.json()).records.length,2);
 const events=await worker.fetch(req('/map/api/events?recordId=project%3Aa'),none,{}),payload=await events.json();assert.equal(payload.events.length,1);assert.equal(payload.exposures[0].derivedFromRule,true);assert.equal(payload.classification,'event_evidence_not_causal_price_effects');
 const original=await worker.fetch(req('/map/api/history-library'),none,{});assert.equal(original.status,202);assert.equal(await original.text(),'existing-route');
 const unknown=await worker.fetch(req('/map/api/record-history?recordId=A'),none,{});assert.equal(unknown.status,404);
 const post=await worker.fetch(req('/map/api/events'),none,{});assert.equal(post.status,200);
 const write=await worker.fetch(req('/map/api/events',{method:'POST'}),none,{});assert.equal(write.status,405);assert.equal(write.headers.get('allow'),'GET, HEAD');
 const tenant=await worker.fetch(new Request('https://psrhomes.ae/map/api/events'),none,{});assert.equal(tenant.status,404);
});
test('responses provide stable representation ETags, HEAD and conditional304',async()=>{
 const worker=fixture(),response=await worker.fetch(req('/map/api/record-history?recordId=project%3Aa'),none,{}),etag=response.headers.get('etag'),payload=await response.json();
 assert.equal(payload.scenarios.targetYears.at(-1),2080);assert.equal(payload.scenarios.metrics.price.paths.base[0].value,null);assert.equal(payload.sources.some(s=>s.id==='unused'),false);
 const head=await worker.fetch(req('/map/api/record-history?recordId=project%3Aa',{method:'HEAD'}),none,{});assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(head.headers.get('etag'),etag);
 const cached=await worker.fetch(req('/map/api/record-history?recordId=project%3Aa',{headers:{'if-none-match':etag}}),none,{});assert.equal(cached.status,304);
});
test('compact user scenarios do not change coverage and invalid/full GET schedules are rejected',async()=>{
 const worker=fixture(),assumptions={priceAED:1000000,annualRentAED:60000,occupancyYear:2028,annualPriceGrowthPct:{downside:-2,base:0,upside:2},annualRentGrowthPct:{downside:-2,base:0,upside:2},vacancyPct:5,annualOperatingCostsAED:10000,acquisitionCostsPct:4,disposalCostsPct:2};
 const path='/map/api/record-history?recordId=project%3Aa&assumptions='+encodeURIComponent(JSON.stringify(assumptions)),response=await worker.fetch(req(path),none,{}),payload=await response.json();
 assert.equal(response.status,200);assert.equal(payload.scenarios.classification,'user_assumption_scenario');assert.equal(payload.scenarios.metrics.price.paths.base.length,54);assert.equal(payload.scenarios.metrics.rent.paths.base[0].value,0);assert.equal(payload.coverage.summary.directObservedMonths,0);
 assert.equal((await worker.fetch(req('/map/api/record-history?recordId=project%3Aa&assumptions=%7Bbad'),none,{})).status,400);
 assert.equal((await worker.fetch(req('/map/api/record-history?recordId=project%3Aa&assumptions='+encodeURIComponent(JSON.stringify({unknown:1}))),none,{})).status,400);
 assert.equal((await worker.fetch(req('/map/api/record-history?recordId=project%3Aa&assumptions='+encodeURIComponent(' '.repeat(8001))),none,{})).status,400);
});
test('missing subject windows return evidence gaps; unsupported event filters fail safely',async()=>{
 const worker=fixture(),response=await worker.fetch(req('/map/api/event-studies?recordId=project%3Aa&eventId=pandemic&metric=price'),none,{}),payload=await response.json();
 assert.equal(response.status,200);assert.equal(payload.study.status,'insufficient_evidence');assert.equal(payload.study.observedChangePct,null);assert.equal(payload.study.causalAttribution,false);assert.equal(payload.study.preWindow.expectedPeriods,12);
 assert.equal((await worker.fetch(req('/map/api/event-studies?recordId=project%3Aa&eventId=pandemic&metric=roi'),none,{})).status,400);
 assert.equal((await worker.fetch(req('/map/api/events?from=2026-02-30'),none,{})).status,400);
 assert.equal((await worker.fetch(req('/map/api/events?from=2026-01&to=2025-01'),none,{})).status,400);
});
test('immutable gzip partitions hydrate only with matching checksum, identity and native count',async()=>{
 const series={id:'history:a',sourceSeriesId:'area:a',sourceId:'sales',scope:'area_context',identityVerified:false,metric:'price',frequency:'monthly',unit:'AED/sqft',columns:['period','value','sampleCount','publishedAt'],points:[['2026-08',100,1,'2026-09-01']]};
 const bytes=gzipSync(JSON.stringify({version:data.version,series:[series]})),sha=createHash('sha256').update(bytes).digest('hex'),snapshot=structuredClone(data),key='research/published/2026-10-03/historical-intelligence/objects/'+sha+'.json.gz';
 snapshot.records[0].historySeries=[{...series,points:[],pointCount:1,partition:{key,sha256:sha,compression:'gzip'}}];
 const env={MARKET_R2:{get:async name=>name===key?{arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}:null}};
 const worker=fixture(snapshot),response=await worker.fetch(req('/map/api/record-history?recordId=project%3Aa'),env,{}),payload=await response.json();
 assert.equal(response.status,200);assert.equal(payload.historySeries[0].partitionLoaded,true);assert.equal(payload.historySeries[0].points[0][1],100);assert.equal(payload.validatedObservations.find(o=>o.metric==='price').displayEligible,false);assert.equal(payload.coverage.summary.directObservedMonths,0);
 const corrupt=structuredClone(snapshot);corrupt.records[0].historySeries[0].partition.sha256='0'.repeat(64);
 const bad=await fixture(corrupt).fetch(req('/map/api/record-history?recordId=project%3Aa'),env,{}),badPayload=await bad.json();assert.equal(bad.status,200);assert.equal(badPayload.historySeries[0].partitionLoaded,false);assert.equal(badPayload.historySeries[0].availability,'partition_unavailable');
});
test('checksum-verified gzip archive expands compact series relations and hydrates native partitions',async()=>{
 const series={id:'history:a',sourceSeriesId:'area:a',sourceId:'sales',scope:'area_context',identityVerified:false,metric:'price',frequency:'monthly',unit:'AED/sqft',columns:['period','value','sampleCount','publishedAt'],points:[['2026-08',100,25,'2026-09-01']]};
 const pin=(value)=>{const bytes=gzipSync(JSON.stringify(value)),sha=createHash('sha256').update(bytes).digest('hex');return {bytes,spec:{key:'research/published/2026-10-03/historical-intelligence/objects/'+sha+'.json.gz',sha256:sha,compression:'gzip'}};};
 const partition=pin({version:data.version,series:[series]}),descriptor={...series,points:[],pointCount:1,partition:partition.spec},snapshot=structuredClone(data);
 snapshot.records[0].historySeries=[descriptor];
 const archive={...structuredClone(snapshot),records:snapshot.records.map(({historySeries,...r})=>({...r,historySeriesIds:historySeries.map(s=>s.id)})),series:[descriptor],manifest:{recordCount:2,archiveLoaded:true}};
 const read=async(candidate)=>{
  const root=pin(candidate),embedded=structuredClone(snapshot);embedded.manifest.r2={...root.spec,binding:'MARKET_R2'};
  const objects=new Map([[root.spec.key,root.bytes],[partition.spec.key,partition.bytes]]),env={MARKET_R2:{get:async key=>objects.has(key)?{arrayBuffer:async()=>objects.get(key)}:null}};
  const response=await fixture(embedded).fetch(req('/map/api/record-history?recordId=project%3Aa'),env,{});assert.equal(response.status,200);return response.json();
 };
 const loaded=await read(archive);assert.equal(loaded.manifest.archiveLoaded,true);assert.equal(loaded.historySeries[0].partitionLoaded,true);assert.equal(loaded.historySeries[0].points[0][1],100);assert.equal(loaded.coverage.summary.directObservedMonths,0);
 const wrongIdentity=structuredClone(archive);wrongIdentity.records[0].communityId='community:other';assert.equal((await read(wrongIdentity)).manifest.archiveLoaded,undefined);
 const missingSeries=structuredClone(archive);missingSeries.series=[];assert.equal((await read(missingSeries)).manifest.archiveLoaded,undefined);
 const promoted=structuredClone(archive);promoted.series[0].scope='subject';promoted.series[0].identityVerified=true;assert.equal((await read(promoted)).manifest.archiveLoaded,undefined);
 const missingSupport=structuredClone(archive);missingSupport.sources=missingSupport.sources.filter(s=>s.id!=='news');assert.equal((await read(missingSupport)).manifest.archiveLoaded,undefined);
 const futureCutoff=structuredClone(archive);futureCutoff.asOf='2027-10-03';assert.equal((await read(futureCutoff)).manifest.archiveLoaded,undefined);
 for(const [field,value] of [['unit','USD'],['metric','rent'],['segment','Commercial | Land'],['registration','Off-Plan'],['geography','Different Area'],['subjectRecordId','project:other'],['columns',['value','period']]]){
  const changed=structuredClone(archive);changed.series[0][field]=value;assert.equal((await read(changed)).manifest.archiveLoaded,undefined,'Archive must not change '+field);
 }
 const changedAvailability=structuredClone(archive);changedAvailability.sources[0].firstAvailableAt='2022-01-01';assert.equal((await read(changedAvailability)).manifest.archiveLoaded,undefined);
 const changedSharedRelation=structuredClone(archive);changedSharedRelation.records[0].sharedCommunityHistoryId='community:a';assert.equal((await read(changedSharedRelation)).manifest.archiveLoaded,undefined);
});

test('native subject hydration requires the matching owner and preserves shared community attribution',async()=>{
 const pin=value=>{const bytes=gzipSync(JSON.stringify(value)),sha=createHash('sha256').update(bytes).digest('hex');return{bytes,spec:{key:'research/published/'+sha+'.json.gz',sha256:sha,compression:'gzip'}};};
 const base={id:'owned',sourceSeriesId:'native-owned',sourceId:'sales',scope:'subject',identityVerified:true,subjectRecordId:'project:a',identitySourceIds:['sales','news'],metric:'price',frequency:'monthly',unit:'AED/sqft',segment:'Residential | Unit',registration:'Existing Properties',geography:'Community A',columns:['period','value','sampleCount','firstAvailableAt'],pointCount:1,points:[['2026-08',100,25,'2026-09-01']]};
 const read=async(native,pointer=base,shared=false)=>{
  const partition=pin({version:data.version,asOf:data.asOf,series:[native]}),snapshot=structuredClone(data),descriptor={...pointer,points:[],partition:partition.spec};
  if(shared){snapshot.records[0].sharedCommunityHistoryId='community:a';snapshot.records[1].historySeries=[descriptor];}else snapshot.records[0].historySeries=[descriptor];
  const response=await fixture(snapshot).fetch(req('/map/api/record-history?recordId=project%3Aa'),{MARKET_R2:{get:async()=>({arrayBuffer:async()=>partition.bytes})}},{});assert.equal(response.status,200);return response.json();
 };
 const owned=await read(base);assert.equal(owned.historySeries[0].partitionLoaded,true);assert.equal(owned.validatedObservations.find(o=>o.metric==='price').displayEligible,true);assert.equal(owned.coverage.summary.directObservedMonths,1);
 const wrong=await read({...base,subjectRecordId:'project:other'});assert.equal(wrong.historySeries[0].availability,'partition_identity_conflict');assert.equal(wrong.coverage.summary.directObservedMonths,0);
 const changedUnit=await read({...base,unit:'USD'});assert.equal(changedUnit.historySeries[0].availability,'partition_identity_conflict');
 const context={...base,id:'master-context',scope:'community_context',identityVerified:false,subjectRecordId:null,linkBasis:'Official master label match'};
 const inherited=await read(context,context,true);assert.equal(inherited.historySeries[0].partitionLoaded,true);assert.equal(inherited.historySeries[0].contextCommunityId,'community:a');assert.match(inherited.historySeries[0].linkBasis,/existence.*unverified/);assert.equal(inherited.validatedObservations.find(o=>o.metric==='price').contextCommunityId,'community:a');assert.equal(inherited.coverage.summary.directObservedMonths,0);
});
test('lazy bundled data loads only on new GET routes and R2 snapshot failure falls back explicitly',async()=>{
 let loads=0;const worker=fixture({version:data.version,asOf:data.asOf},async()=>{loads++;return structuredClone(data);});
 const write=await worker.fetch(req('/map/api/events',{method:'POST'}),none,{});assert.equal(write.status,405);assert.equal(loads,0);
 const existing=await worker.fetch(req('/map/api/other'),none,{});assert.equal(existing.status,202);assert.equal(loads,0);
 const index=await worker.fetch(req('/map/api/record-history'),none,{});assert.equal(index.status,200);assert.equal((await index.json()).records.length,2);assert.equal(loads,1);
 const fallback=structuredClone(data);fallback.manifest.r2={binding:'MARKET_R2',key:'research/published/missing.json',sha256:'0'.repeat(64)};
 const missing=await fixture(fallback).fetch(req('/map/api/record-history'),none,{});assert.equal(missing.status,200);assert.equal((await missing.json()).records.length,2);
});

test('inventory loads per-item evidence on request while each selected record retains the complete ledger',async()=>{
 const snapshot=structuredClone(data),items={registered_sale_history:{status:'missing',reason:'No approved native subject observations'}};
 snapshot.records[0].researchStatus.itemCoverage=items;
 const worker=fixture(snapshot),inventory=await(await worker.fetch(req('/map/api/record-history'),none,{})).json();
 assert.equal(inventory.records[0].researchStatus.itemCoverageAvailable,true);
 assert.equal(inventory.records[0].researchStatus.itemCoverage,undefined);
 assert.equal(inventory.records[0].researchStatus.subjectHistory,'not_verified');
 const full=await(await worker.fetch(req('/map/api/record-history?includeItemCoverage=1'),none,{})).json();
 assert.deepEqual(full.records[0].researchStatus.itemCoverage,items);
 const selected=await(await worker.fetch(req('/map/api/record-history?recordId=project%3Aa'),none,{})).json();
 assert.deepEqual(selected.record.researchStatus.itemCoverage,items);
});

function boundedFixture({series=[],shardPatch=null,shardVersion=data.version}={}){
 const pin=value=>{const bytes=gzipSync(JSON.stringify(value)),sha=createHash('sha256').update(bytes).digest('hex');return{bytes,spec:{key:'research/published/2026-10-05/historical-intelligence/objects/'+sha+'.json.gz',sha256:sha,bytes:bytes.length,compression:'gzip',decodedBytes:Buffer.byteLength(JSON.stringify(value))}};};
 const snapshot=structuredClone(data),objects=new Map(),native=pin({version:data.version,asOf:data.asOf,series});objects.set(native.spec.key,native.bytes);
 const record={...snapshot.records[0],historySeries:series.map(s=>({...s,points:[],pointCount:s.points.length,partition:native.spec})),researchStatus:{subjectHistory:'not_verified',itemCoverage:{registered_sale_history:{status:'missing'}}}},community=snapshot.records[1];
 const shard=pin({version:shardVersion,asOf:data.asOf,classification:'runtime_record_evidence_shard',records:shardPatch?shardPatch([record,community]):[record,community]});objects.set(shard.spec.key,shard.bytes);
 snapshot.records=[record,community].map(({historySeries,lifecycle,observations,...r})=>({...r,researchStatus:{subjectHistory:'not_verified',itemCoverageAvailable:true},recordPartition:shard.spec}));
 snapshot.manifest={recordCount:2,partitionBinding:'MARKET_R2',r2:{key:'research/published/full-archive-never-read.json.gz',sha256:'0'.repeat(64)},runtime:{classification:'bounded_manifest_backed_runtime',canonicalArchiveSHA256:'f'.repeat(64)}};
 const calls=[],env={MARKET_R2:{get:async key=>{calls.push(key);return objects.has(key)?{arrayBuffer:async()=>objects.get(key)}:null;}}};
 return{worker:fixture(snapshot),env,calls,snapshot,record,objects};
}

test('bounded runtime keeps inventory read-only and loads exact record evidence without inflating archival root',async()=>{
 const native={id:'small',sourceId:'sales',scope:'area_context',identityVerified:false,metric:'price',frequency:'monthly',unit:'AED/sqft',columns:['period','value','sampleCount'],points:[['2025-01',100,25]]};
 const f=boundedFixture({series:[native]});
 const inventory=await(await f.worker.fetch(req('/map/api/record-history'),none,{})).json();assert.equal(inventory.records.length,2);assert.equal(inventory.records[0].researchStatus.itemCoverageAvailable,true);assert.equal(f.calls.length,0);
 const response=await f.worker.fetch(req('/map/api/record-history?recordId=project%3Aa'),f.env,{}),etag=response.headers.get('etag'),selected=await response.json();assert.equal(selected.historySeries[0].points[0][1],100);assert.equal(selected.historyPagination.complete,true);assert.equal(selected.record.researchStatus.itemCoverage.registered_sale_history.status,'missing');
 const head=await f.worker.fetch(req('/map/api/record-history?recordId=project%3Aa',{method:'HEAD'}),f.env,{});assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(head.headers.get('etag'),etag);
 assert.equal((await f.worker.fetch(req('/map/api/record-history?recordId=project%3Aa',{headers:{'if-none-match':etag}}),f.env,{})).status,304);
 assert.ok(f.calls.every(key=>key!==f.snapshot.manifest.r2.key));
});

test('bounded runtime rejects missing shards, changed catalogue identities and wrong publication vintages',async()=>{
 const missing=boundedFixture();assert.equal((await missing.worker.fetch(req('/map/api/record-history?recordId=project%3Aa'),{MARKET_R2:{get:async()=>null}},{})).status,503);
 const revised=boundedFixture({shardVersion:'wrong-vintage'});assert.equal((await revised.worker.fetch(req('/map/api/record-history?recordId=project%3Aa'),revised.env,{})).status,503);
 const changed=boundedFixture({shardPatch:records=>records.map((r,i)=>i? r:{...r,communityId:'community:other'})});assert.equal((await changed.worker.fetch(req('/map/api/record-history?recordId=project%3Aa'),changed.env,{})).status,503);
 const fanout=boundedFixture({shardPatch:records=>records.map((r,i)=>i?r:{...r,historySeries:[{id:'bad-owner',scope:'subject',sourceId:'sales',identityVerified:true,subjectRecordId:'project:other',identitySourceIds:['sales']}]})});assert.equal((await fanout.worker.fetch(req('/map/api/record-history?recordId=project%3Aa'),fanout.env,{})).status,503);
});

test('bounded runtime exposes every descriptor and pages native history without implying full retrieval or dropping sparse points',async()=>{
 const series=Array.from({length:10},(_,i)=>({id:'series:'+i,sourceId:'sales',scope:'area_context',identityVerified:false,metric:'price',frequency:'monthly',unit:'AED/sqft',columns:['period','value','sampleCount','sourceObservationId'],points:Array.from({length:i?1:2501},(_,j)=>['2025-01',100,1,'row:'+i+':'+j])}));
 const f=boundedFixture({series});
 const first=await(await f.worker.fetch(req('/map/api/record-history?recordId=project%3Aa'),f.env,{})).json();assert.equal(first.historySeries.length,10);assert.equal(first.historyPagination.loadedPoints,2000);assert.equal(first.historyPagination.nextPointCursor,2000);assert.equal(first.coverage.retrievalLimited,true);assert.equal(first.historyPagination.complete,false);
 const tail=await(await f.worker.fetch(req('/map/api/record-history?recordId=project%3Aa&seriesId=series%3A0&pointCursor=2000'),f.env,{})).json();assert.equal(tail.historySeries[0].points.length,501);assert.equal(tail.historySeries[0].nativePointOffset,2000);assert.equal(tail.historySeries[0].pointCount,2501);assert.equal(tail.historyPagination.nextPointCursor,null);assert.equal(tail.validatedObservations.find(o=>o.metric==='price').sparse,true);
 const last=await(await f.worker.fetch(req('/map/api/record-history?recordId=project%3Aa&seriesCursor=8'),f.env,{})).json();assert.equal(last.historyPagination.loadedSeries,2);assert.equal(last.historyPagination.loadedPoints,2);assert.equal(last.historySeries[0].availability,'partition_not_requested');
 for(const extra of ['&seriesId=unknown','&seriesCursor=11','&seriesCursor=-1','&seriesId=series%3A0&pointCursor=2502'])assert.equal((await f.worker.fetch(req('/map/api/record-history?recordId=project%3Aa'+extra),f.env,{})).status,400);
});


test('full runtime item inventory streams every ledger with stable HEAD and conditional ETag',async()=>{
 const f=boundedFixture(),url='/map/api/record-history?includeItemCoverage=1';
 const response=await f.worker.fetch(req(url),f.env,{}),etag=response.headers.get('etag'),body=await response.json();
 assert.equal(body.records.length,2);assert.equal(body.records[0].researchStatus.itemCoverage.registered_sale_history.status,'missing');
 const head=await f.worker.fetch(req(url,{method:'HEAD'}),none,{});assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(head.headers.get('etag'),etag);
 assert.equal((await f.worker.fetch(req(url,{headers:{'if-none-match':etag}}),none,{})).status,304);
});
