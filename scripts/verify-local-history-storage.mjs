import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import assert from 'node:assert/strict';
import {publishImmutableSnapshot,parseJSONC} from './publish-historical-snapshot.mjs';
import {connectCandidate} from './adapters/local-history-candidate.mjs';
import * as core from '../src/historical-intelligence/core.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=async p=>fs.readFile(path.join(root,p));
const config=parseJSONC((await read('wrangler.history-local.jsonc')).toString());
const target=JSON.parse(await read('data/historical-intelligence/local-candidate-target.json'));
const manifest=JSON.parse(await read('data/historical-intelligence/publication-manifest.json'));
const canonical=JSON.parse(await read('data/historical-intelligence-20261003.json'));
const data=JSON.parse(await read('data/historical-intelligence/runtime-index.json'));
const bindings=await connectCandidate({target,config,ephemeral:true});
try {
  const progress=pass=>p=>{if(p.completed===p.total||p.completed%500===0)console.error(JSON.stringify({pass,...p}));};
  const publication=await publishImmutableSnapshot({...bindings,target,config,manifest,readObject:o=>read(o.path),onProgress:progress('initial')});
  const repeated=await publishImmutableSnapshot({...bindings,target,config,manifest,readObject:o=>read(o.path),onProgress:progress('repeat')});
  if(repeated.written!==0||repeated.reused!==manifest.objects.length)throw new Error('Repeated publication changed immutable objects');
  assert.equal(publication.indexCountsVerified,true,'Initial publication skipped fail-closed table count verification');
  assert.equal(repeated.indexCountsVerified,true,'Repeated publication skipped fail-closed table count verification');
  assert.deepEqual(repeated.indexedTableCounts,publication.indexedTableCounts,'Repeated publication changed indexed table counts');
  assert.equal(data.version,manifest.version,'Embedded data differs from publication version');
  const count=await bindings.d1.prepare('SELECT count(*) AS count FROM hi_records WHERE snapshot_version = ?').bind(data.version).first();
  if(count.count!==1860)throw new Error('Local D1 lost catalogue records');
  const relations=await bindings.d1.prepare('SELECT count(*) AS count FROM hi_record_series WHERE snapshot_version = ?').bind(data.version).first();
  const expectedRelations=canonical.records.reduce((n,r)=>n+(r.historySeries?.length||0),0);
  assert.equal(relations.count,expectedRelations,'Local D1 silently lost declared record-series links');
  assert.equal(publication.indexedTableCounts.hi_record_series,expectedRelations,'Publisher accepted incomplete record-series links');
  const worker={fetch:async()=>new Response('existing')};
  // The emulator publication above validates every stored R2 object's bytes
  // and the repeat pass confirms they can be read back. Serve those exact
  // content-addressed bytes from disk to the in-process Worker so the large
  // paged-history check does not depend on a long-lived local proxy socket.
  const publishedR2={get:async key=>{
    const object=manifest.objects.find(item=>item.key===key);if(!object)return null;
    const bytes=await read(object.path);
    return{arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
  }};
  vm.runInNewContext((await read('src/historical-intelligence/worker-extension.js')).toString(),{worker_default:worker,HI_DATA:data,HI_CORE:core,crypto:webcrypto,Response,Request,URL,TextEncoder,TextDecoder,DecompressionStream,ReadableStream,TypeError,RangeError,Map,Set,Date,JSON,Uint8Array});
  const declaredPoints=record=>(record.historySeries||[]).reduce((n,s)=>n+(s.pointCount||0),0);
  const record=canonical.records.filter(r=>r.historySeries?.length).sort((a,b)=>declaredPoints(b)-declaredPoints(a))[0];
  assert.ok(record,'Snapshot has no historical record to verify');
  async function hydrated(record,seriesId=null){
    const query=new URLSearchParams({recordId:record.id});if(seriesId)query.set('seriesId',seriesId);
    const response=await worker.fetch(new Request('https://espacios.me/map/api/record-history?'+query.toString()),{DB:bindings.d1,MARKET_R2:publishedR2},{});
    assert.equal(response.status,200,'Local record-history API failed for '+record.id);
    const payload=await response.json();
    assert.equal(payload.record.id,record.id);
    for(const series of payload.historySeries){
      if(!series.partition)continue;
      if(series.partitionLoaded){
        assert.equal(series.points.length,series.loadedPointCount,'Native page count changed for '+series.id);
        assert.ok(series.points.length<=series.pointCount,'Native page exceeds its full series count for '+series.id);
      }else assert.equal(series.availability,'partition_not_requested','Requested local immutable partition was unavailable for '+series.id);
    }
    if(seriesId)assert.equal(payload.historySeries.find(series=>series.id===seriesId)?.partitionLoaded,true,'Exact requested history series was not hydrated');
    assert.equal(payload.scenarios.targetYears.at(-1),2080,'Annual endpoint changed');
    return payload;
  }
  const payload=await hydrated(record);

  // Verify a primary Unit/Villa sale cohort, including the project owner and
  // independent register/developer/geography source proofs after R2 hydration.
  const hasCompleteSourceSample=series=>(series.points||[]).some(native=>{
    const point=Array.isArray(native)?Object.fromEntries((series.columns||[]).map((column,i)=>[column,native[i]])):native;
    if(!Number.isInteger(point.sampleCount)||point.sampleCount<20)return false;
    try{return core.parseEvidenceDate(point.period).end<=core.parseEvidenceDate(data.asOf).end;}catch{return false;}
  });
  const directCandidates=canonical.records.flatMap(r=>(r.historySeries||[]).filter(s=>r.type==='project'&&s.metric==='price'&&s.scope==='subject'&&s.identityVerified===true&&/(?:^|\|)\s*(?:Unit|Villa)\s*(?:\||$)/i.test(s.segment||'')&&s.partition&&s.pointCount>0&&hasCompleteSourceSample(s)).map(s=>({record:r,series:s}))).sort((a,b)=>b.series.pointCount-a.series.pointCount);
  assert.ok(directCandidates.length,'Snapshot has no direct Unit/Villa sale cohort');
  const direct=directCandidates[0],directPayload=await hydrated(direct.record,direct.series.id),sale=directPayload.historySeries.find(s=>s.id===direct.series.id);
  assert.ok(sale,'Direct sale cohort disappeared');
  assert.equal(sale.scope,'subject');
  assert.equal(sale.identityVerified,true);
  assert.equal(sale.subjectRecordId,direct.record.id,'Hydrated sale owner differs from the approved project');
  assert.ok(sale.identityBasis,'Direct sale identity basis absent');
  assert.ok(Array.isArray(sale.identitySourceIds)&&sale.identitySourceIds.length>=3,'Direct sale register/developer/geography proofs absent');
  assert.ok(Array.isArray(direct.series.identitySourceIds),'Bundled direct identity proof IDs absent');
  assert.deepEqual([...sale.identitySourceIds].sort(),[...direct.series.identitySourceIds].sort(),'R2 changed approved identity proof IDs');
  const directSources=new Set(directPayload.sources.map(s=>s.id));
  assert.ok(directSources.has(sale.sourceId),'Direct sale observation source omitted');
  assert.ok(sale.identitySourceIds.every(id=>directSources.has(id)),'Direct sale identity proof sources omitted');
  const owners=canonical.records.filter(r=>(r.historySeries||[]).some(s=>s.id===sale.id&&s.scope==='subject'&&s.identityVerified===true)).map(r=>r.id);
  assert.deepEqual(owners,[direct.record.id],'Direct subject series was assigned to another project');
  const salePoints=directPayload.validatedObservations.filter(o=>o.seriesId===sale.id&&o.metric==='price');
  assert.equal(salePoints.length,sale.loadedPointCount,'Direct native sale page was lost');
  assert.ok(salePoints.every(o=>o.direct===true&&o.scope==='subject'&&o.identityVerified===true&&o.recordId===direct.record.id),'Direct sale observations lost subject identity');
  assert.ok(salePoints.some(o=>o.valid&&o.displayEligible),'Hydrated primary sale evidence failed all validation/sample gates');

  // Inherited community context must hydrate from the community's canonical
  // partition while preserving contextual scope and the exact community ID.
  const byId=new Map(canonical.records.map(r=>[r.id,r]));
  const sharedCandidates=canonical.records.filter(r=>r.type==='project'&&r.sharedCommunityHistoryId&&r.sharedCommunityHistoryId===r.communityId).map(r=>({record:r,community:byId.get(r.sharedCommunityHistoryId)})).filter(({record:r,community:c})=>c?.type==='community'&&c.emirate===r.emirate&&(c.historySeries||[]).some(s=>s.scope==='community_context'&&s.identityVerified===false&&s.partition&&s.pointCount>0&&!(r.historySeries||[]).some(own=>own.id===s.id))).sort((a,b)=>declaredPoints(a.record)-declaredPoints(b.record));
  assert.ok(sharedCandidates.length,'Snapshot has no inherited native community history to verify');
  const shared=sharedCandidates[0],ownIds=new Set((shared.record.historySeries||[]).map(s=>s.id));
  const expected=(shared.community.historySeries||[]).filter(s=>s.scope==='community_context'&&s.identityVerified===false&&!ownIds.has(s.id));
  assert.ok(expected.length,'Selected project has no inherited series to verify');
  const requestedContextSeries=expected[0],sharedPayload=await hydrated(shared.record,requestedContextSeries.id);
  const inherited=sharedPayload.historySeries.filter(s=>expected.some(e=>e.id===s.id));
  assert.equal(inherited.length,expected.length,'Inherited community series were lost');
  assert.equal(sharedPayload.record.communityId,shared.community.id);
  assert.equal(sharedPayload.record.sharedCommunityHistoryId,shared.community.id);
  for(const series of inherited){
    const canonical=expected.find(s=>s.id===series.id);
    assert.equal(series.scope,'community_context');
    assert.equal(series.identityVerified,false,'Community context was promoted to subject identity');
    assert.equal(series.contextCommunityId,shared.community.id,'Inherited context community changed');
    assert.equal(series.sourceId,canonical.sourceId);
    assert.ok(!series.subjectRecordId,'Inherited community series acquired a subject owner');
    if(canonical.partition){
      if(canonical.id===requestedContextSeries.id){assert.equal(series.partitionLoaded,true);assert.equal(series.points.length,series.loadedPointCount);}
      else assert.equal(series.availability,'partition_not_requested');
    }
  }
  const inheritedIds=new Set([requestedContextSeries.id]),contextPoints=sharedPayload.validatedObservations.filter(o=>inheritedIds.has(o.seriesId));
  assert.ok(contextPoints.length,'Inherited native observations were absent');
  assert.ok(contextPoints.every(o=>o.direct===false&&o.scope==='community_context'&&o.identityVerified===false),'Inherited observations were promoted to direct project coverage');
  console.log(JSON.stringify({mode:'local_emulator',remoteWrites:0,publication,repeated,records:count.count,recordSeriesLinks:relations.count,expectedRecordSeriesLinks:expectedRelations,hydratedRecordId:record.id,collection:payload.coverage.collection,directSubject:{recordId:direct.record.id,seriesId:sale.id,subjectRecordId:sale.subjectRecordId,sourceId:sale.sourceId,identitySourceIds:sale.identitySourceIds,loadedPoints:sale.points.length},inheritedContext:{recordId:shared.record.id,communityId:shared.community.id,series:inherited.length,loadedPoints:contextPoints.length,scope:'community_context',identityVerified:false},verifiedEndpoint:2080}));
} finally {await bindings.dispose();}
