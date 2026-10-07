import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {annualScenarios,TARGET_YEARS} from '../src/historical-intelligence/core.mjs';
const root=new URL('../',import.meta.url),read=p=>fs.readFile(new URL(p,root)),sha=x=>createHash('sha256').update(x).digest('hex');
const data=JSON.parse(await read('data/historical-intelligence-20261003.json'));
const publication=JSON.parse(await read('data/historical-intelligence/publication-manifest.json'));
const inputs=JSON.parse(await read('data/historical-intelligence/inputs/manifest.json'));

test('full reviewed inventory and exact identities survive normalization',async()=>{
 const bytes=await read(inputs.inventory.path),inventory=JSON.parse(gunzipSync(bytes));
 const original=[...inventory.projects,...inventory.communities].map(r=>r.id).sort();
 assert.equal(data.records.length,1860);assert.equal(data.records.filter(r=>r.type==='project').length,1645);assert.equal(data.records.filter(r=>r.type==='community').length,215);
 assert.equal(new Set(data.records.map(r=>r.id)).size,1860);assert.deepEqual(data.records.map(r=>r.id).sort(),original);
 assert.equal(data.records.filter(r=>r.emirate==='Dubai').length,1266);
 for(const record of data.records){assert.ok(record.researchStatus);assert.equal(record.scenarioCoverage.lastYear,2080);assert.equal(record.scenarioCoverage.annualSlotsPerMetric,54);if(record.communityId)assert.ok(data.records.some(r=>r.type==='community'&&r.id===record.communityId));}
});
test('immutable inputs and every publishable object match their content address',async()=>{
 for(const input of Object.values(inputs)){const bytes=await read(input.path);assert.equal(sha(bytes),input.compressedSha256,input.path);assert.equal(sha(gunzipSync(bytes)),input.sha256,input.path);}
 const pointers=[...publication.objects,publication.d1Index].filter(Boolean),keys=new Set();
 for(const object of pointers){assert.match(object.key,/^research\/published\/\d{4}-\d{2}-\d{2}\/historical-intelligence\/objects\/[a-f0-9]{64}\./);assert.equal(keys.has(object.key),false,'Manifest objects must be unique');keys.add(object.key);const bytes=await read(object.path);assert.equal(bytes.length,object.bytes);assert.equal(sha(bytes),object.sha256);assert.ok(object.key.includes(object.sha256));}
 assert.equal(publication.counts.records,1860);assert.equal(publication.counts.projects,1645);assert.equal(publication.counts.communities,215);
});
test('archival root retains present evidence and complete record-to-series relationships',async()=>{
 const archive=JSON.parse(gunzipSync(await read(publication.rootIndex.path)));
 const seriesIds=new Set(archive.series.map(s=>s.id));
 for(const record of data.records){
  const archived=archive.records.find(r=>r.id===record.id);
  assert.ok(archived);assert.deepEqual(archived.currentSnapshot,record.currentSnapshot);
  assert.deepEqual(archived.historySeriesIds,record.historySeries.map(s=>s.id));
  for(const id of archived.historySeriesIds)assert.ok(seriesIds.has(id));
 }
});
test('context, research candidates and incomplete subject coverage remain separate',()=>{
 assert.equal(data.manifest.identityCandidateProjects,263);
 for(const record of data.records){for(const s of record.historySeries){if(s.scope==='subject'){assert.equal(s.identityVerified,true);assert.ok(s.identitySourceIds?.length);assert.ok(s.linkBasis);}else assert.equal(s.identityVerified,false);assert.ok(s.partition);assert.ok(s.pointCount>=s.points.length);assert.ok(s.columns.includes('value'));}
  for(const milestone of record.lifecycle){assert.ok(milestone.sourceIds.length);if(['occupancy','completion'].includes(milestone.kind))assert.ok(milestone.date.start<=data.asOf);if(milestone.status==='verified')assert.ok(milestone.identityBasis);}
  if(record.currentSnapshot.scope==='source_observed_asking_quote'){assert.ok(record.currentSnapshot.firstAvailableAt);assert.ok(record.currentSnapshot.observationId);assert.ok(record.priorCurrentSnapshots.length);}else assert.equal(record.currentSnapshot.freshness,'unverified_source_date');
 }
 assert.equal(data.manifest.directSubjectSaleHistoryRecords,data.records.filter(r=>r.researchStatus.itemCoverage.registered_sale_history.status==='present').length);assert.equal(data.manifest.directSubjectRentHistoryRecords,data.records.filter(r=>r.researchStatus.itemCoverage.signed_rent_history.status==='present').length);assert.equal(data.manifest.approved2080ForecastRecords,0);
 assert.equal(data.manifest.historyWindow.start,null,'A common subject inception is not imposed');
 for(const record of data.records){
  const subject=record.historySeries.filter(s=>s.scope==='subject'&&s.identityVerified);
  if(subject.length)assert.match(record.researchStatus.sourceScope,/Verified registered subject/);
  for(const [metric,field] of [['price','directSalePeriods'],['rent','directRentPeriods']]){
   if(record.researchStatus.itemCoverage[metric==='price'?'registered_sale_history':'signed_rent_history'].status==='present')assert.ok(record.coverageSummary[field]>0,'Static coverage must reflect accepted '+metric+' observations, excluding disputed rows');
   else assert.equal(record.coverageSummary[field],0);
  }
  assert.match(record.coverageSummary.directPeriodCountBasis,/native period/);
 }
});
test('each retained record has exactly54 annual slots for every metric and scenario',()=>{
 assert.equal(TARGET_YEARS.length,54);assert.equal(TARGET_YEARS[0],2027);assert.equal(TARGET_YEARS.at(-1),2080);
 for(const record of data.records){const scenarios=annualScenarios(record,{asOf:data.asOf,sources:data.sources});assert.equal(scenarios.validatedForecast,false);
  for(const metric of ['price','rent','netROI'])for(const name of ['downside','base','upside']){const path=scenarios.metrics[metric].paths[name];assert.deepEqual(path.map(p=>p.year),TARGET_YEARS);assert.ok(path.every(p=>p.value===null&&p.reason),'Missing evidence must not become invented forecasts');}
 }
});
test('source references and dated event revisions have no orphan links or mechanical uplifts',()=>{
 const ids=new Set(data.sources.map(s=>s.id));assert.equal(ids.size,data.sources.length);
 for(const source of data.sources){const url=new URL(source.url);assert.equal(url.protocol,'https:');assert.equal(url.username,'');assert.equal(url.password,'');assert.ok(!/[?&](?:token|secret|api_key|access_token)=/i.test(source.url));}
 const eventIds=new Set(data.events.map(e=>e.id));assert.equal(eventIds.size,data.events.length);
 for(const event of data.events){assert.ok(event.eventDate);assert.equal(event.priceUpliftPct,null);assert.ok(event.sourceIds.length);for(const id of event.sourceIds)assert.ok(ids.has(id),'Missing event source: '+id);}
 for(const exposure of data.exposures){assert.ok(eventIds.has(exposure.eventId));assert.ok(data.records.some(r=>r.id===exposure.recordId));assert.equal(exposure.priceUpliftPct,null);}
 for(const term of ['mobilisation','rainfall','guggenheim','gold','wynn'])assert.ok(data.events.some(e=>(e.id+' '+e.title).toLowerCase().includes(term)),'Required event family: '+term);
});

test('bounded runtime shards preserve every canonical record and native tuple without inflating the archival root',async()=>{
 const runtime=JSON.parse(await read('data/historical-intelligence/runtime-index.json'));
 assert.equal(runtime.manifest.runtime.canonicalSnapshotSHA256,sha(await read('data/historical-intelligence-20261003.json')));
 assert.equal(runtime.manifest.runtime.canonicalArchiveSHA256,publication.rootIndex.sha256);
 assert.equal(runtime.records.length,1860);assert.deepEqual(runtime.records.map(r=>r.id),data.records.map(r=>r.id));
 assert.deepEqual(runtime.sources,data.sources);assert.deepEqual(runtime.events,data.events);assert.deepEqual(runtime.exposures,data.exposures);
 assert.ok(Buffer.byteLength(JSON.stringify(runtime))<9*1024*1024,'Runtime must retain a bounded inventory rather than full evidence');
 const records=new Map(),native=new Map(),objects=new Map(publication.objects.map(o=>[o.key,o]));
 const canonicalNative=new Map();
 for(const obj of publication.objects.filter(o=>o.kind==='history_partition'))for(const series of JSON.parse(gunzipSync(await read(obj.path))).series)canonicalNative.set(series.id,sha(JSON.stringify(series)));
 for(const obj of publication.objects.filter(o=>o.kind==='runtime_record_shard')){
  const decoded=gunzipSync(await read(obj.path));assert.ok(decoded.length<=2*1024*1024);const shard=JSON.parse(decoded);
  assert.equal(shard.version,data.version);assert.equal(shard.asOf,data.asOf);assert.ok(shard.records.length<=16);
  for(const r of shard.records){assert.equal(records.has(r.id),false);records.set(r.id,r);}
 }
 for(const thin of runtime.records){
  const original=data.records.find(r=>r.id===thin.id),record=records.get(thin.id);assert.ok(record);
  assert.ok(objects.has(thin.recordPartition.key));assert.equal(thin.researchStatus.itemCoverage,undefined);assert.equal(thin.researchStatus.itemCoverageAvailable,true);
  const {historySeries:oldSeries,...oldMetadata}=original,{historySeries:newSeries,...newMetadata}=record;assert.deepEqual(newMetadata,oldMetadata);
  assert.equal(newSeries.length,oldSeries.length);
  for(let i=0;i<newSeries.length;i++){
   const {partition:oldPartition,points:oldTail,...oldFields}=oldSeries[i],{partition,archivePartition,points,...newFields}=newSeries[i];
   assert.deepEqual(newFields,oldFields);assert.deepEqual(archivePartition,oldPartition);assert.deepEqual(points,[]);
   if(!native.has(partition.key)){const obj=objects.get(partition.key);assert.ok(obj);const decoded=gunzipSync(await read(obj.path));assert.ok(decoded.length<32*1024*1024);native.set(partition.key,JSON.parse(decoded));}
   const series=native.get(partition.key).series.find(s=>s.id===newSeries[i].id);assert.ok(series);assert.equal(series.points.length,newSeries[i].pointCount);assert.equal(sha(JSON.stringify(series)),canonicalNative.get(series.id),'Runtime changed a native tuple or identity field');
   // Runtime partitions change packaging only: original native cohorts, owners
   // and independently retained identity proofs remain exactly the same.
   assert.equal(series.subjectRecordId,newSeries[i].subjectRecordId);assert.deepEqual(series.identitySourceIds,newSeries[i].identitySourceIds);
  }
 }
 assert.equal(records.size,1860);
});
