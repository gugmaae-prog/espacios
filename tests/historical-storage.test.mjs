import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync,gunzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import {digest,publishImmutableSnapshot,publishIndexBatches,validateCandidateTarget,parseJSONC,parseGeneratedInsert} from '../scripts/publish-historical-snapshot.mjs';
import {connectCandidate} from '../scripts/adapters/local-history-candidate.mjs';

const config={name:'espacios-history-candidate',r2_buckets:[{binding:'MARKET_R2',bucket_name:'history-candidate'}],d1_databases:[{binding:'DB',database_name:'history-candidate',database_id:'candidate-db-id'}]};
const target={environment:'candidate',workerName:config.name,r2:{binding:'MARKET_R2',bucketName:'history-candidate'},d1:{binding:'DB',databaseName:'history-candidate',databaseId:'candidate-db-id'}};
function setup(){
 const incoming=new Map(),stored=new Map(),puts=[],indexBatches=[],rows=new Map();let prior=null,failBatch=false,racePrior=null,failCompletion=false,dropTable=null;
 const object=body=>{const bytes=Buffer.from(body),hash=digest(bytes),key='research/published/2026-10-03/historical-intelligence/objects/'+hash+'.json';incoming.set(key,bytes);return {key,path:key,sha256:hash,bytes:bytes.length};};
 const a=object('first'),b=object('second'),sql=gzipSync(`INSERT OR IGNORE INTO hi_snapshots(snapshot_version,as_of,record_count,manifest_json,root_sha256) VALUES('v1','2026-10-03',1,'{}','${a.sha256}');\nINSERT OR IGNORE INTO hi_records(snapshot_version,record_id,record_type,name,emirate,record_json) VALUES('v1','record','project','Record','Dubai','{}');\n`);
 const index={key:'sql',sha256:digest(sql),bytes:sql.length};incoming.set('sql',sql);
 const manifest={version:'v1',rootIndex:a,objects:[a,b],d1Index:index};
 const r2={async get(key){const bytes=stored.get(key);return bytes?{async arrayBuffer(){return bytes;}}:null;},async put(key,bytes,options){puts.push({key,options});if(stored.has(key))return null;stored.set(key,Buffer.from(bytes));return {etag:'new'};}};
 const indexRow=statement=>{
  const table=statement.sql.match(/^INSERT OR IGNORE INTO (hi_[a-z_]+)/)?.[1];
  if(!table)throw new Error('Unexpected fake D1 insert');
  if(table===dropTable)return;
  if(!rows.has(table))rows.set(table,new Map());
  const key=JSON.stringify(statement.values.slice(0,table==='hi_record_series'?3:2));
  if(!rows.get(table).has(key))rows.get(table).set(key,[...statement.values]);
 };
 const d1={prepare(sql){return {bind(...values){this.values=values;return this;},async first(){
  const count=sql.match(/^SELECT count\(\*\) AS count FROM (hi_[a-z_]+) WHERE snapshot_version = \?$/);
  if(count)return {count:count[1]==='hi_snapshots'?(prior?1:0):[...(rows.get(count[1])?.values()||[])].filter(row=>row[0]===this.values[0]).length};
  if(sql.startsWith('SELECT root_sha256, publication_state FROM hi_snapshots'))return prior;
  throw new Error('Unexpected fake D1 read');
 },async run(){
  if(sql.startsWith('INSERT ')){if(racePrior){prior=racePrior;racePrior=null;}if(!prior)prior={root_sha256:manifest.rootIndex.sha256,publication_state:'staged'};return {meta:{changes:1}};}
  if(sql.startsWith('UPDATE ')){if(failCompletion||prior?.root_sha256!==this.values[1])return {meta:{changes:0}};prior={...prior,publication_state:'complete'};return {meta:{changes:1}};}
  throw new Error('Unexpected D1 mutation');
 },sql};},async batch(statements){indexBatches.push(statements.map(s=>s.sql));if(failBatch)throw new Error('D1 unavailable');for(const statement of statements)indexRow(statement);return [];}};
 return {a,b,manifest,r2,d1,puts,indexBatches,stored,incoming,readObject:x=>incoming.get(x.key),completed:()=>prior?.publication_state==='complete',staged:()=>prior?.publication_state==='staged',setPrior:x=>{prior=x;},claimRace:x=>{racePrior=x;},failBatch:()=>{failBatch=true;},failCompletion:()=>{failCompletion=true;},silentlyDrop:table=>{dropTable=table;},addIndexedRow:(table,values)=>indexRow({sql:'INSERT OR IGNORE INTO '+table,values})};
}
const publish=s=>publishImmutableSnapshot({...s,config,target});
test('parallel indexing bounds requests, completes parents first, and drains failures before advancing',async()=>{
 let active=0,peak=0,finishedRecords=0;const seen=[];
 const indexes=[{table:'hi_record_series'},...Array.from({length:450},()=>({table:'hi_records'})),{table:'hi_series'},{table:'hi_sources'}];
 const d1={async batch(rows){assert.ok(rows.length<=50);assert.ok(rows.every(r=>r.table===rows[0].table));active++;peak=Math.max(peak,active);const table=rows[0].table;seen.push(table);if(table!=='hi_records')assert.equal(finishedRecords,450);await new Promise(r=>setTimeout(r,1));if(table==='hi_records')finishedRecords+=rows.length;active--;}};
 await publishIndexBatches({indexes,prepare:x=>x,d1,concurrency:8});assert.equal(peak,8);assert.deepEqual(seen.slice(-3),['hi_sources','hi_series','hi_record_series']);
 active=0;seen.length=0;let calls=0;
 await assert.rejects(publishIndexBatches({indexes,prepare:x=>x,concurrency:8,d1:{async batch(rows){seen.push(rows[0].table);const fail=calls++===0;active++;await new Promise(r=>setTimeout(r,fail?1:5));active--;if(fail)throw Error('index offline');}}}),/index offline/);
 assert.equal(active,0);assert.equal(calls,8);assert.ok(seen.every(t=>t==='hi_records'));
});
function appendIndex(s,statement){
 const sql=gzipSync(gunzipSync(s.incoming.get('sql')).toString()+statement+'\n');
 s.incoming.set('sql',sql);s.manifest.d1Index={key:'sql',sha256:digest(sql),bytes:sql.length};
}
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
test('remote byte checksums support reuse and refuse corrupt or missing readback before activation',async()=>{
 const s=setup();s.r2.get=async()=>{throw Error('large download should not be used');};
 s.r2.checksum=async key=>{const bytes=s.stored.get(key);return bytes?{sha256:digest(bytes),bytes:bytes.length}:null;};
 assert.equal((await publish(s)).written,2);assert.equal((await publish(s)).reused,2);
 for(const bad of [null,{sha256:s.a.sha256,bytes:999},{sha256:'incorrect',bytes:5}]){
  const broken=setup();broken.r2.checksum=async key=>broken.stored.has(key)?bad:null;
  await assert.rejects(publish(broken),/write did not verify/);assert.equal(broken.completed(),false);assert.equal(broken.indexBatches.length,0);
 }
 const collision=setup();collision.r2.checksum=async()=>({sha256:'wrong',bytes:5});
 await assert.rejects(publish(collision),/Existing immutable object collision/);assert.equal(collision.puts.length,0);
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
test('a silently CHECK-rejected relation leaves the snapshot staged instead of declaring completion',async()=>{
 const s=setup();
 appendIndex(s,"INSERT OR IGNORE INTO hi_sources(snapshot_version,source_id,url,source_json) VALUES('v1','sales','https://example.test/sales','{}');");
 appendIndex(s,"INSERT OR IGNORE INTO hi_series(snapshot_version,series_id,source_id,series_json) VALUES('v1','series','sales','{}');");
 appendIndex(s,"INSERT OR IGNORE INTO hi_record_series(snapshot_version,record_id,series_id,scope,identity_verified) VALUES('v1','record','series','community_context',0);");
 s.silentlyDrop('hi_record_series');
 await assert.rejects(publish(s),/index count mismatch for hi_record_series: expected 1, found 0/);
 assert.equal(s.staged(),true);assert.equal(s.completed(),false);assert.equal(s.stored.size,2);
});
test('count validation uses unique keys and allows identical repeated INSERTs',async()=>{
 const s=setup();appendIndex(s,"INSERT OR IGNORE INTO hi_records(snapshot_version,record_id,record_type,name,emirate,record_json) VALUES('v1','record','project','Record','Dubai','{}');");
 const result=await publish(s);assert.equal(result.indexStatements,3);assert.equal(result.indexedTableCounts.hi_records,1);assert.equal(result.indexCountsVerified,true);assert.equal(s.completed(),true);
});
test('unexpected extra version-scoped rows and conflicting duplicate keys refuse completion',async()=>{
 const extra=setup();extra.setPrior({root_sha256:extra.manifest.rootIndex.sha256,publication_state:'staged'});extra.addIndexedRow('hi_records',['v1','unexpected','project','Extra','Dubai','{}']);
 await assert.rejects(publish(extra),/index count mismatch for hi_records: expected 1, found 2/);assert.equal(extra.staged(),true);
 const conflict=setup();appendIndex(conflict,"INSERT OR IGNORE INTO hi_records(snapshot_version,record_id,record_type,name,emirate,record_json) VALUES('v1','record','project','Different','Dubai','{}');");
 await assert.rejects(publish(conflict),/Conflicting duplicate generated index key/);assert.equal(conflict.puts.length,0);
});
test('missing immutable snapshot header is rejected before any object write',async()=>{
 const s=setup(),sql=gzipSync("INSERT OR IGNORE INTO hi_records(snapshot_version,record_id,record_type,name,emirate,record_json) VALUES('v1','record','project','Record','Dubai','{}');\n");
 s.incoming.set('sql',sql);s.manifest.d1Index={key:'sql',sha256:digest(sql),bytes:sql.length};
 await assert.rejects(publish(s),/exactly one immutable snapshot header/);assert.equal(s.puts.length,0);assert.equal(s.indexBatches.length,0);
});
test('generated INSERT parser binds quoted data without interpreting punctuation or doubled apostrophes',()=>{
 const parsed=parseGeneratedInsert("INSERT OR IGNORE INTO hi_records(snapshot_version,record_id,record_type,name,emirate,record_json) VALUES('v1','record','project','O''Brien, (Tower);','Dubai','{\"text\":\"quote '' and \\n and ; DROP TABLE hi_records;\"}');");
 assert.equal(parsed.values[3],"O'Brien, (Tower);");
 assert.equal(parsed.values[5],'{"text":"quote \' and \\n and ; DROP TABLE hi_records;"}');
 assert.equal(parsed.values.length,6);assert.equal(parsed.sql.includes('DROP'),false);assert.equal((parsed.sql.match(/\?/g)||[]).length,6);
 const number=parseGeneratedInsert("INSERT OR IGNORE INTO hi_record_series(snapshot_version,record_id,series_id,scope,identity_verified) VALUES('v1','record','series','subject',1);");assert.equal(number.values.at(-1),1);
});
test('unsupported generated SQL fails before immutable writes or record indexing',async()=>{
 const invalid=[
  "DELETE FROM hi_records;",
  "INSERT INTO hi_records(snapshot_version,record_id,record_type,name,emirate,record_json) VALUES('v1','r','project','A','Dubai','{}');",
  "INSERT OR IGNORE INTO secrets(snapshot_version) VALUES('v1');",
  "INSERT OR IGNORE INTO hi_records(record_id,snapshot_version,record_type,name,emirate,record_json) VALUES('r','v1','project','A','Dubai','{}');",
  "INSERT OR IGNORE INTO hi_record_series(snapshot_version,record_id,series_id,scope,identity_verified) VALUES('v1','r','s','subject',1.5);",
  "INSERT OR IGNORE INTO hi_record_series(snapshot_version,record_id,series_id,scope,identity_verified) VALUES('v1','r','s','subject',NULL);",
  "INSERT OR IGNORE INTO hi_record_series(snapshot_version,record_id,series_id,scope,identity_verified) VALUES('v1','r','s','subject',9007199254740993);",
  "INSERT OR IGNORE INTO hi_records(snapshot_version,record_id,record_type,name,emirate,record_json) VALUES('v1','r','project','A','Dubai','{}'); DROP TABLE hi_records;",
  "INSERT OR IGNORE INTO hi_records(snapshot_version,record_id,record_type,name,emirate,record_json) VALUES('v1','r','project','A','Dubai','unterminated);"
 ];
 for(const text of invalid){const s=setup(),sql=gzipSync(text+'\n');s.incoming.set('sql',sql);s.manifest.d1Index={key:'sql',sha256:digest(sql),bytes:sql.length};await assert.rejects(publish(s),/Unsupported generated|Unterminated generated|safe range/);assert.equal(s.puts.length,0);assert.equal(s.indexBatches.length,0);}
});
test('snapshot SQL cannot claim a different manifest version or root',async()=>{
 for(const [version,root] of [['other','same'],['v1','different']]){const s=setup(),sql=gzipSync(`INSERT OR IGNORE INTO hi_snapshots(snapshot_version,as_of,record_count,manifest_json,root_sha256) VALUES('${version}','2026-10-03',1,'{}','${root==='same'?s.a.sha256:root}');\n`);s.incoming.set('sql',sql);s.manifest.d1Index={key:'sql',sha256:digest(sql),bytes:sql.length};await assert.rejects(publish(s),/version differs|header root differs/);assert.equal(s.puts.length,0);}
});
test('local D1 publishes and round-trips >100KiB header/record JSON using bound values',async()=>{
 const localConfig=parseJSONC(await fs.readFile(new URL('../wrangler.history-local.jsonc',import.meta.url),'utf8'));
 const localTarget=JSON.parse(await fs.readFile(new URL('../data/historical-intelligence/local-candidate-target.json',import.meta.url),'utf8'));
 const s=setup(),literal=value=>"'"+value.replaceAll("'","''")+"'";
 const header=JSON.stringify({note:"O'Brien, (header); "+'h'.repeat(130*1024)}),record=JSON.stringify({name:'قيمة',note:"O'Brien; "+'r'.repeat(140*1024)});
 const text=`INSERT OR IGNORE INTO hi_snapshots(snapshot_version,as_of,record_count,manifest_json,root_sha256) VALUES('v1','2026-10-03',1,${literal(header)},'${s.a.sha256}');\nINSERT OR IGNORE INTO hi_records(snapshot_version,record_id,record_type,name,emirate,record_json) VALUES('v1','record','project','O''Brien','Dubai',${literal(record)});\n`;
 assert.ok(text.split('\n').slice(0,2).every(line=>Buffer.byteLength(line)>100*1024));
 const sql=gzipSync(text);s.incoming.set('sql',sql);s.manifest.d1Index={key:'sql',sha256:digest(sql),bytes:sql.length};
 const local=await connectCandidate({config:localConfig,target:localTarget,ephemeral:true});
 try{
  const first=await publishImmutableSnapshot({...s,...local,config:localConfig,target:localTarget});assert.equal(first.publicationState,'complete');
  const savedHeader=await local.d1.prepare('SELECT manifest_json, publication_state FROM hi_snapshots WHERE snapshot_version = ?').bind('v1').first();
  const savedRecord=await local.d1.prepare('SELECT name, record_json FROM hi_records WHERE snapshot_version = ? AND record_id = ?').bind('v1','record').first();
  assert.equal(savedHeader.manifest_json,header);assert.equal(savedHeader.publication_state,'complete');assert.equal(savedRecord.name,"O'Brien");assert.equal(savedRecord.record_json,record);
  const repeated=await publishImmutableSnapshot({...s,...local,config:localConfig,target:localTarget});assert.equal(repeated.written,0);assert.equal(repeated.reused,2);
 }finally{await local.dispose();}
});
test('revision options reject path-like versions and impossible as-of dates before building',()=>{
 for(const args of [['--version','../overwrite'],['--as-of','2026-02-30'],['--as-of','2026-2-03']]){
  const result=spawnSync(process.execPath,['scripts/build-historical-data.mjs',...args],{encoding:'utf8'});
  assert.equal(result.status,2);assert.equal(result.stdout,'');assert.match(result.stderr,/version must|as-of must/);
 }
});
