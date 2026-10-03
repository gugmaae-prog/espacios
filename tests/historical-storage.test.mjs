import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
import {digest,publishImmutableSnapshot,validateCandidateTarget,parseJSONC} from '../scripts/publish-historical-snapshot.mjs';

const config={name:'espacios-history-candidate',r2_buckets:[{binding:'MARKET_R2',bucket_name:'history-candidate'}],d1_databases:[{binding:'DB',database_name:'history-candidate',database_id:'candidate-db-id'}]};
const target={environment:'candidate',workerName:config.name,r2:{binding:'MARKET_R2',bucketName:'history-candidate'},d1:{binding:'DB',databaseName:'history-candidate',databaseId:'candidate-db-id'}};
function setup(){
 const incoming=new Map(),stored=new Map(),puts=[],indexBatches=[];let prior=null,failBatch=false,racePrior=null,failCompletion=false;
 const object=body=>{const bytes=Buffer.from(body),hash=digest(bytes),key='research/published/2026-10-03/historical-intelligence/objects/'+hash+'.json';incoming.set(key,bytes);return {key,path:key,sha256:hash,bytes:bytes.length};};
 const a=object('first'),b=object('second'),sql=gzipSync("INSERT OR IGNORE INTO hi_snapshots VALUES ('v1');\nINSERT OR IGNORE INTO hi_records VALUES ('v1','record');\n");
 const index={key:'sql',sha256:digest(sql),bytes:sql.length};incoming.set('sql',sql);
 const manifest={version:'v1',rootIndex:a,objects:[a,b],d1Index:index};
 const r2={async get(key){const bytes=stored.get(key);return bytes?{async arrayBuffer(){return bytes;}}:null;},async put(key,bytes,options){puts.push({key,options});if(stored.has(key))return null;stored.set(key,Buffer.from(bytes));return {etag:'new'};}};
 const d1={prepare(sql){return {bind(...values){this.values=values;return this;},async first(){return prior;},async run(){
  if(sql.startsWith('INSERT ')){if(racePrior){prior=racePrior;racePrior=null;}if(!prior)prior={root_sha256:manifest.rootIndex.sha256,publication_state:'staged'};return {meta:{changes:1}};}
  if(sql.startsWith('UPDATE ')){if(failCompletion||prior?.root_sha256!==this.values[1])return {meta:{changes:0}};prior={...prior,publication_state:'complete'};return {meta:{changes:1}};}
  throw new Error('Unexpected D1 mutation');
 },sql};},async batch(statements){indexBatches.push(statements.map(s=>s.sql));if(failBatch)throw new Error('D1 unavailable');return [];}};
 return {a,b,manifest,r2,d1,puts,indexBatches,stored,incoming,readObject:x=>incoming.get(x.key),completed:()=>prior?.publication_state==='complete',setPrior:x=>{prior=x;},claimRace:x=>{racePrior=x;},failBatch:()=>{failBatch=true;},failCompletion:()=>{failCompletion=true;}};
}
const publish=s=>publishImmutableSnapshot({...s,config,target});
test('production bindings rejected before mutation',()=>{
 assert.throws(()=>validateCandidateTarget({...config,r2_buckets:[{binding:'MARKET_R2',bucket_name:'psr-market-intelligence'}]},target),/match|candidate|Production/);
 assert.throws(()=>validateCandidateTarget(config,{...target,environment:'production'}),/candidate/);
});
test('JSONC preserves HTTPS URLs and removes comments',()=>assert.equal(parseJSONC('{"url":"https://example.test/a", // comment\n "x":1,}').url,'https://example.test/a'));
test('checks all objects before writing; late existing collision prevents partial writes',async()=>{
 const s=setup();s.stored.set(s.b.key,Buffer.from('corrupt'));
 await assert.rejects(publish(s),/Existing immutable object collision/);assert.equal(s.puts.length,0);assert.equal(s.completed(),false);
});
test('incoming checksum failure prevents writes and indexing',async()=>{
 const s=setup();s.incoming.set(s.b.key,Buffer.from('tampered'));
 await assert.rejects(publish(s),/Incoming object checksum mismatch/);assert.equal(s.puts.length,0);assert.equal(s.completed(),false);
});
test('immutable publication uses conditional create; second run reuses verified bytes',async()=>{
 const s=setup();const first=await publish(s);assert.equal(first.written,2);assert.ok(s.puts.every(x=>x.options.onlyIf.etagDoesNotMatch==='*'));assert.equal(s.completed(),true);
 s.setPrior({root_sha256:s.manifest.rootIndex.sha256,publication_state:'complete'});const second=await publish(s);assert.equal(second.written,0);assert.equal(second.reused,2);assert.equal(s.puts.length,2);
});
test('snapshot version collision never modifies object store',async()=>{
 const s=setup();s.setPrior({root_sha256:'different'});await assert.rejects(publish(s),/Snapshot version collision/);assert.equal(s.puts.length,0);
});
test('index failure leaves immutable objects but never marks snapshot complete',async()=>{
 const s=setup();s.failBatch();await assert.rejects(publish(s),/D1 unavailable/);assert.equal(s.stored.size,2);assert.equal(s.completed(),false);
});
test('a competing immutable root claimed after the initial read aborts before record indexes',async()=>{
 const s=setup();s.claimRace({root_sha256:'different-root',publication_state:'staged'});
 await assert.rejects(publish(s),/Snapshot version collision during claim/);assert.equal(s.indexBatches.length,0);assert.equal(s.completed(),false);
});
test('completion must verify both its D1 mutation and the persisted complete state',async()=>{
 const s=setup();s.failCompletion();await assert.rejects(publish(s),/completion did not verify/);assert.equal(s.completed(),false);assert.equal(s.indexBatches.length,1);
});
test('missing immutable snapshot header is rejected before any object write',async()=>{
 const s=setup(),sql=gzipSync("INSERT OR IGNORE INTO hi_records VALUES ('v1','record');\n");
 s.incoming.set('sql',sql);s.manifest.d1Index={key:'sql',sha256:digest(sql),bytes:sql.length};
 await assert.rejects(publish(s),/exactly one immutable snapshot header/);assert.equal(s.puts.length,0);assert.equal(s.indexBatches.length,0);
});
test('revision options reject path-like versions and impossible as-of dates before building',()=>{
 for(const args of [['--version','../overwrite'],['--as-of','2026-02-30'],['--as-of','2026-2-03']]){
  const result=spawnSync(process.execPath,['scripts/build-historical-data.mjs',...args],{encoding:'utf8'});
  assert.equal(result.status,2);assert.equal(result.stdout,'');assert.match(result.stderr,/version must|as-of must/);
 }
});
