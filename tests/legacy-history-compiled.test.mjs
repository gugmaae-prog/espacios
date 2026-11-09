import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import worker from '../src/worker.js';

// Exercise the generated release artifact and its real mapArchiveFallback,
// mapLegacyHistoryRoute, hiPartition, byte hashes and decoded-size bound.
// Only the platform's private Assets binding is represented by local files.
const root=new URL('../',import.meta.url),read=p=>fs.readFile(new URL(p,root));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const archive=JSON.parse(await read('data/recovery/static-archive-manifest.json'));
const native=JSON.parse(gunzipSync(await read('data/recovery/v48-native-history-index.json.gz')));
const shards=JSON.parse(await read('data/recovery/recovery-native-shards.manifest.json'));
const shardByKey=new Map(shards.objects.map(object=>[object.key,object]));
const assetByPath=new Map(Object.values(archive.entries).map(entry=>[entry.path,entry]));
const columns=native.columns,entryById=new Map(native.rows.map(row=>[row[0],Object.fromEntries(columns.map((k,n)=>[k,row[n]]))]));
let assetReads=0;
const assetBinding={async fetch(request){
 const entry=assetByPath.get(new URL(request.url).pathname);
 if(!entry)return new Response('Not found',{status:404});
 const bytes=await read('work/archive-assets'+entry.path);
 assert.equal(bytes.length,entry.bytes,'Real private asset byte length');
 assert.equal(sha(bytes),entry.sha256,'Real private asset SHA256');assetReads++;
 return new Response(request.method==='HEAD'?null:bytes,{headers:{'content-type':entry.contentType||'application/octet-stream',etag:'"'+entry.sha256+'"'}});
}};
const env={MAP_IDRIVE_READY:'false',DATA_ROOM_PUBLIC:'false',MAP_ARCHIVE:assetBinding,MAP_VERSION:{id:'compiled-native-recovery-test'}};
globalThis.caches={default:{async match(){return null},async put(){}}};
async function get(id,offset=0){
 const url='https://espacios.me/map/api/history-series?'+new URLSearchParams({series:id,pointOffset:String(offset),pointLimit:'2'});
 const pending=[];
 const response=await worker.fetch(new Request(url),env,{waitUntil(p){pending.push(p)}});
 const payload=await response.json();await Promise.all(pending);
 return{response,payload};
}
async function expected(id,offset){
 const entry=entryById.get(id);assert.ok(entry,'Actual native index entry');
 const pointer=native.partitions[entry.partitionId],object=shardByKey.get(pointer.key);assert.ok(object,'Former oversized archive now points to a bounded recovery shard');
 assert.ok(object.decodedBytes<=32*1024*1024,'Shard fits the actual Worker decoder cap');
 const bytes=await read(object.path);assert.equal(sha(bytes),pointer.sha256);
 const part=JSON.parse(gunzipSync(bytes)),series=part.series.find(series=>series.id===id);assert.ok(series);
 assert.equal(series.points.length,entry.pointCount);
 return{entry,pointer,points:series.points.slice(offset,offset+2)};
}
const first='v19-dred-transactions-009f087b787eccc68f0e0695';
const largest='v19-dred-transactions-e4d5b803e4648127ed0c0f01';
test('generated Worker opens formerly oversized native archives through its private asset binding',async()=>{
 for(const id of [first,largest]){
  const e=await expected(id,0),{response,payload}=await get(id);
  assert.equal(response.status,200,JSON.stringify(payload));assert.equal(payload.series.id,id);
  assert.equal(payload.series.pointCount,e.entry.pointCount);assert.deepEqual(payload.series.retainedPoints,e.points);
  assert.equal(payload.series.sourcePartitionSHA256,e.pointer.originalSourceArchiveSHA256);
  assert.equal(payload.series.originalSourceArchiveKey,e.pointer.originalSourceArchiveKey);
  assert.equal(payload.series.recoveryEnvelopeSHA256,e.pointer.sha256);
  assert.notEqual(payload.series.sourcePartitionSHA256,payload.series.recoveryEnvelopeSHA256);
  assert.equal(payload.series.pagination.nextPointOffset,2);
  assert.equal(response.headers.get('x-espacios-map-release'),'20261110-map-stack-v41');
 }
 assert.ok(assetReads>=3,'Actual generated decoder read native metadata plus bounded point assets');
});
test('generated Worker returns the actual final two points of the 8570-point series',async()=>{
 const e=await expected(largest,8568),{response,payload}=await get(largest,8568);
 assert.equal(response.status,200,JSON.stringify(payload));assert.equal(payload.series.pointCount,8570);
 assert.deepEqual(payload.series.retainedPoints,e.points);assert.equal(payload.series.retainedPoints.length,2);
 assert.equal(payload.series.pagination.pointOffset,8568);assert.equal(payload.series.pagination.totalPoints,8570);
 assert.equal(payload.series.pagination.nextPointOffset,null);
});
test('generated Worker also reads the other formerly oversized source archive',async()=>{
 const originalKey=native.partitions[entryById.get(first).partitionId].originalSourceArchiveKey;
 const entry=[...entryById.values()].find(e=>{const p=native.partitions[e.partitionId];return p.originalSourceArchiveKey&&p.originalSourceArchiveKey!==originalKey&&e.pointCount>=2;});
 assert.ok(entry,'A retained series from the second oversized archive exists');
 const e=await expected(entry.id,0),{response,payload}=await get(entry.id);
 assert.equal(response.status,200,JSON.stringify(payload));assert.deepEqual(payload.series.retainedPoints,e.points);
 assert.equal(payload.series.sourcePartitionSHA256,e.pointer.originalSourceArchiveSHA256);
 assert.equal(payload.series.recoveryEnvelopeSHA256,e.pointer.sha256);
});
test('private source asset paths remain denied by the generated public Worker',async()=>{
 const pointer=native.partitions[entryById.get(largest).partitionId],path=archive.entries[pointer.key]?.path;assert.ok(path);
 const response=await worker.fetch(new Request('https://espacios.me'+path),env,{});assert.equal(response.status,404);
});
