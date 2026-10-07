import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export function parseJSONC(text) {
 let out='',quoted=false,escape=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){out+=c;if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quoted=false;continue;}
  if(c==='"'){quoted=true;out+=c;continue;}
  if(c==='/'&&text[i+1]==='/'){while(i<text.length&&text[i]!=='\n')i++;out+='\n';continue;}
  if(c==='/'&&text[i+1]==='*'){i+=2;while(i<text.length&&!(text[i]==='*'&&text[i+1]==='/'))i++;i++;continue;}
  out+=c;
 }
 return JSON.parse(out.replace(/,\s*([}\]])/g,'$1'));
}
export function validateCandidateTarget(config,target) {
 if(!target||target.environment!=='candidate')throw new Error('Explicit candidate target manifest required');
 if(config.name!==target.workerName||!/candidate/i.test(config.name))throw new Error('Worker target must match isolated candidate config');
 const r2=(config.r2_buckets||[]).find(x=>x.binding===target.r2?.binding);
 const d1=(config.d1_databases||[]).find(x=>x.binding===target.d1?.binding);
 if(!r2||!d1||r2.bucket_name!==target.r2.bucketName||d1.database_name!==target.d1.databaseName||d1.database_id!==target.d1.databaseId)throw new Error('Configured bindings do not match explicit candidate target');
 if(!/candidate/i.test(r2.bucket_name)||!/candidate/i.test(d1.database_name))throw new Error('Isolated candidate bucket and database names required');
 if(r2.bucket_name==='psr-market-intelligence'||d1.database_id==='a5165cff-70a5-4685-af87-5ffdcf08652a'||d1.database_name==='cba-property-db')throw new Error('Production bindings are forbidden');
 if((config.routes||[]).length)throw new Error('Candidate publication config must not contain production routes');
 return true;
}
export function validateProductionTarget(config,target,manifest) {
 if(target?.environment!=='production'||target.authorization?.kind!=='explicit_user_request'||target.authorization?.scope!=='publish_historical_snapshot_and_deploy_map')throw new Error('Explicit production publication authorization required');
 if(config.name!=='psr-portfolio-map-v2'||target.workerName!==config.name||config.account_id!=='b1b843ec85bc39a3a4d370ba4f84f17a'||target.accountId!==config.account_id)throw new Error('Production account and map Worker must match the verified target');
 const r2=config.r2_buckets?.find(x=>x.binding==='MARKET_R2'),d1=config.d1_databases?.find(x=>x.binding==='DB');
 if(r2?.bucket_name!=='psr-market-intelligence'||target.r2?.bucketName!==r2.bucket_name||target.r2?.binding!=='MARKET_R2'||d1?.database_id!=='a5165cff-70a5-4685-af87-5ffdcf08652a'||d1?.database_name!=='cba-property-db'||target.d1?.databaseId!==d1.database_id||target.d1?.databaseName!==d1.database_name||target.d1?.binding!=='DB')throw new Error('Production historical bindings differ from the verified map resources');
 if(config.vars?.DATA_ROOM_PUBLIC!=='false'||(config.routes||[]).length)throw new Error('Production publication must preserve the restricted Data Room and separately managed routes');
 if(!manifest||target.snapshotVersion!==manifest.version||target.rootSHA256!==manifest.rootIndex?.sha256)throw new Error('Authorized immutable snapshot version/root differs from publication');
 return true;
}
async function existingBytes(r2,key){const obj=await r2.get(key);return obj?Buffer.from(await obj.arrayBuffer()):null;}
async function existingDigest(r2,key){
 // A remote adapter can hash the actual stored bytes in its authenticated
 // Worker, avoiding large downloads. Never use key names or stored metadata.
 if(r2.checksum)return r2.checksum(key);
 const bytes=await existingBytes(r2,key);return bytes===null?null:{sha256:digest(bytes),bytes:bytes.length};
}
const INSERT_COLUMNS={
 hi_snapshots:['snapshot_version','as_of','record_count','manifest_json','root_sha256'],
 hi_records:['snapshot_version','record_id','record_type','name','emirate','record_json'],
 hi_sources:['snapshot_version','source_id','url','source_json'],
 hi_events:['snapshot_version','event_id','event_json'],
 hi_exposures:['snapshot_version','exposure_id','event_id','record_id','scope','verified','exposure_json'],
 hi_series:['snapshot_version','series_id','source_id','series_json'],
 hi_record_series:['snapshot_version','record_id','series_id','scope','identity_verified']
};
const INSERT_KEYS={
 hi_snapshots:['snapshot_version'],hi_records:['snapshot_version','record_id'],
 hi_sources:['snapshot_version','source_id'],hi_events:['snapshot_version','event_id'],
 hi_exposures:['snapshot_version','exposure_id'],hi_series:['snapshot_version','series_id'],
 hi_record_series:['snapshot_version','record_id','series_id']
};
/** Accept only the builder's append-only single-row INSERT grammar.
 * Values are decoded as data and bound, so large JSON never becomes SQL text.
 */
export function parseGeneratedInsert(statement){
 const prefix=/^INSERT OR IGNORE INTO (hi_[a-z_]+)\(([^()]*)\) VALUES\(/.exec(statement);
 if(!prefix||!INSERT_COLUMNS[prefix[1]])throw new Error('Unsupported generated INSERT syntax/table');
 const table=prefix[1],columns=prefix[2].split(',').map(x=>x.trim()),expected=INSERT_COLUMNS[table];
 if(columns.length!==expected.length||columns.some((x,i)=>x!==expected[i]))throw new Error('Unsupported generated INSERT columns');
 let cursor=prefix[0].length;const values=[];
 const whitespace=()=>{while(/\s/.test(statement[cursor]||'')&&cursor<statement.length)cursor++;};
 while(true){
  whitespace();let value;
  if(statement[cursor]==="'"){
   cursor++;let start=cursor;const chunks=[];let closed=false;
   while(cursor<statement.length){
    if(statement[cursor]!=="'"){cursor++;continue;}
    chunks.push(statement.slice(start,cursor));
    if(statement[cursor+1]==="'"){chunks.push("'");cursor+=2;start=cursor;continue;}
    cursor++;closed=true;break;
   }
   if(!closed)throw new Error('Unterminated generated INSERT string');
   value=chunks.join('');
  }else{
   const integer=/^-?(?:0|[1-9]\d*)/.exec(statement.slice(cursor));
   if(!integer)throw new Error('Unsupported generated INSERT value; strings/integers only');
   value=Number(integer[0]);cursor+=integer[0].length;
   if(!Number.isSafeInteger(value))throw new Error('Generated INSERT integer exceeds safe range');
  }
  values.push(value);whitespace();
  if(statement[cursor]===','){cursor++;continue;}
  if(statement[cursor]!==')')throw new Error('Unsupported generated INSERT value separator');
  cursor++;break;
 }
 if(statement.slice(cursor)!==';'||values.length!==columns.length)throw new Error('Unsupported generated INSERT suffix/arity');
 return{table,columns,values,sql:`INSERT OR IGNORE INTO ${table}(${columns.join(',')}) VALUES(${values.map(()=>'?').join(',')});`};
}
export async function publishImmutableSnapshot({r2,d1,target,config,manifest,readObject,publicationMode='candidate',onProgress}) {
 if(publicationMode==='production')validateProductionTarget(config,target,manifest);
 else if(publicationMode==='candidate')validateCandidateTarget(config,target);
 else throw new Error('Unsupported publication mode');
 if(!r2?.get||!r2?.put||!d1?.prepare||!d1?.batch)throw new Error('Adapter must expose candidate R2 and D1 Worker APIs');
 const prior=await d1.prepare('SELECT root_sha256, publication_state FROM hi_snapshots WHERE snapshot_version = ?').bind(manifest.version).first();
 if(prior&&prior.root_sha256!==manifest.rootIndex.sha256)throw new Error('Snapshot version collision: assign a new version before publishing revised evidence');
 const loaded=[];
 // Validate every incoming and existing object before any write, including later collisions.
 async function validateObject(object){
  if(!new RegExp('^research/published/\\d{4}-\\d{2}-\\d{2}/historical-intelligence/objects/'+object.sha256+'\\.(json(?:\\.gz)?|csv\\.gz|sql\\.gz|parquet)$').test(object.key))throw new Error('Object key must be content addressed');
  const bytes=Buffer.from(await readObject(object));
  if(bytes.length!==object.bytes||digest(bytes)!==object.sha256)throw new Error('Incoming object checksum mismatch: '+object.key);
  const priorDigest=await existingDigest(r2,object.key);
  if(priorDigest&&(priorDigest.sha256!==object.sha256||priorDigest.bytes!==object.bytes))throw new Error('Existing immutable object collision: '+object.key);
  return {object,bytes,exists:!!priorDigest};
 }
 const concurrency=publicationMode==='production'?8:1;
 for(let i=0;i<manifest.objects.length;i+=concurrency){
  loaded.push(...await Promise.all(manifest.objects.slice(i,i+concurrency).map(validateObject)));
  onProgress?.({phase:'validated_objects',completed:loaded.length,total:manifest.objects.length});
 }
 const sqlBytes=Buffer.from(await readObject(manifest.d1Index));
 if(sqlBytes.length!==manifest.d1Index.bytes||digest(sqlBytes)!==manifest.d1Index.sha256)throw new Error('D1 index checksum mismatch');
 const sql=gunzipSync(sqlBytes).toString('utf8');
 // The immutable snapshot header is claimed separately. A later publisher may
 // have claimed this version after our initial read but before indexing starts.
 const statements=sql.split(/\r?\n/).map(line=>line.trim()).filter(line=>line&&line!=='PRAGMA foreign_keys = ON;').map(parseGeneratedInsert);
 if(statements.some(statement=>statement.values[0]!==manifest.version))throw new Error('Generated INSERT snapshot version differs from manifest');
 const headers=statements.filter(statement=>statement.table==='hi_snapshots');
 if(headers.length!==1)throw new Error('D1 index must contain exactly one immutable snapshot header');
 if(headers[0].values[4]!==manifest.rootIndex.sha256)throw new Error('Generated snapshot header root differs from manifest');
 const expectedRows=Object.fromEntries(Object.keys(INSERT_COLUMNS).map(table=>[table,new Map()]));
 for(const statement of statements){
  const key=JSON.stringify(INSERT_KEYS[statement.table].map(column=>statement.values[statement.columns.indexOf(column)]));
  const encoded=JSON.stringify(statement.values),previous=expectedRows[statement.table].get(key);
  if(previous!==undefined&&previous!==encoded)throw new Error('Conflicting duplicate generated index key in '+statement.table);
  expectedRows[statement.table].set(key,encoded);
 }
 if(headers[0].values[2]!==expectedRows.hi_records.size)throw new Error('Generated snapshot record_count differs from unique record keys');
 const indexes=statements.filter(line=>line!==headers[0]);
 const prepare=statement=>d1.prepare(statement.sql).bind(...statement.values);
 let written=0,reused=0;
 async function putObject({object,bytes,exists}){
  if(exists){reused++;return;}
  const result=await r2.put(object.key,bytes,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:object.contentType||(object.compression==='gzip'?'application/gzip':'application/json')},customMetadata:{sha256:object.sha256,snapshotVersion:manifest.version}});
  const verified=await existingDigest(r2,object.key);
  if(!verified||verified.sha256!==object.sha256||verified.bytes!==object.bytes)throw new Error('Conditional immutable write did not verify: '+object.key);
  if(result)written++;else reused++;
 }
 for(let i=0;i<loaded.length;i+=concurrency){
  await Promise.all(loaded.slice(i,i+concurrency).map(putObject));
  onProgress?.({phase:'published_objects',completed:Math.min(i+concurrency,loaded.length),total:loaded.length,written,reused});
 }
 // Each SQL statement occupies one physical line; JSON newlines are escaped by the builder.
 await prepare(headers[0]).run();
 const claimed=await d1.prepare('SELECT root_sha256, publication_state FROM hi_snapshots WHERE snapshot_version = ?').bind(manifest.version).first();
 if(!claimed||claimed.root_sha256!==manifest.rootIndex.sha256)throw new Error('Snapshot version collision during claim: no record indexes were written');
 if(!['staged','complete'].includes(claimed.publication_state))throw new Error('Claimed snapshot publication state is invalid');
 for(let i=0;i<indexes.length;i+=50){await d1.batch(indexes.slice(i,i+50).map(prepare));onProgress?.({phase:'indexed_statements',completed:Math.min(i+50,indexes.length),total:indexes.length});}
 // OR IGNORE can suppress CHECK failures as well as harmless repeated keys.
 // Every version-scoped table must contain the complete unique-key index
 // before the staged snapshot can be marked complete.
 const indexedTableCounts={};
 for(const [table,rows] of Object.entries(expectedRows)){
  const result=await d1.prepare(`SELECT count(*) AS count FROM ${table} WHERE snapshot_version = ?`).bind(manifest.version).first();
  if(!Number.isSafeInteger(result?.count)||result.count!==rows.size)throw new Error(`Snapshot index count mismatch for ${table}: expected ${rows.size}, found ${result?.count??'unknown'}; publication completion refused`);
  indexedTableCounts[table]=result.count;
 }
 const completion=await d1.prepare("UPDATE hi_snapshots SET publication_state = 'complete' WHERE snapshot_version = ? AND root_sha256 = ?").bind(manifest.version,manifest.rootIndex.sha256).run();
 const completed=await d1.prepare('SELECT root_sha256, publication_state FROM hi_snapshots WHERE snapshot_version = ?').bind(manifest.version).first();
 if(!completed||completed.root_sha256!==manifest.rootIndex.sha256||completed.publication_state!=='complete'||(Number.isFinite(completion?.meta?.changes)&&completion.meta.changes!==1))throw new Error('Snapshot completion did not verify its immutable root and complete state');
 return {version:manifest.version,written,reused,indexStatements:statements.length,indexedTableCounts,indexCountsVerified:true,publicationState:'complete',rollbackPolicy:'Failure leaves verified immutable orphan objects or staged indexes; never activates a mutable latest pointer and never deletes evidence'};
}
async function main(){
 const args=process.argv.slice(2);const option=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
 const manifestPath=path.resolve(option('--manifest')||path.join(ROOT,'data/historical-intelligence/publication-manifest.json'));
 const configPath=path.resolve(option('--config')||path.join(ROOT,'wrangler.jsonc'));
 const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
 const config=parseJSONC(await fs.readFile(configPath,'utf8'));
 const target=option('--target')?JSON.parse(await fs.readFile(path.resolve(option('--target')),'utf8')):null;
 const publicationMode=args.includes('--production')?'production':'candidate';
 let targetStatus='blocked: explicit isolated candidate target required';
 const validateTarget=()=>publicationMode==='production'?validateProductionTarget(config,target,manifest):validateCandidateTarget(config,target);
 try{validateTarget();targetStatus='verified '+publicationMode+' bindings';}catch(error){targetStatus='blocked: '+error.message;}
 const readObject=object=>fs.readFile(path.resolve(ROOT,object.path));
 for(const object of [...manifest.objects,manifest.d1Index]){
  const bytes=await readObject(object);if(digest(bytes)!==object.sha256||bytes.length!==object.bytes)throw new Error('Local publication object does not verify '+object.path);
 }
 if(!args.includes('--apply')){
  console.log(JSON.stringify({mode:'dry_run',remoteWrites:0,version:manifest.version,counts:manifest.counts,objects:manifest.objects.length,totalBytes:manifest.objects.reduce((n,x)=>n+x.bytes,0),targetStatus,requiresForApply:publicationMode==='production'?['--production','--config wrangler.production.jsonc','--target exact-authorized-production-resources.json','--adapter scripts/adapters/production-history-publisher.mjs']:['--config isolated-candidate.jsonc','--target candidate-resources.json','--adapter explicit-candidate-worker-api-adapter.mjs'],conditionalWrite:{onlyIf:{etagDoesNotMatch:'*'}},d1Index:manifest.d1Index},null,2));return;
 }
 validateTarget();
 if(!option('--config')||!option('--target')||!option('--adapter'))throw new Error('--apply requires explicit --config, --target and --adapter; no environment or production fallback');
 const adapter=await import(pathToFileURL(path.resolve(option('--adapter'))).href);
 const connect=publicationMode==='production'?adapter.connectProduction:adapter.connectCandidate;
 if(typeof connect!=='function')throw new Error('Adapter must export '+(publicationMode==='production'?'connectProduction':'connectCandidate')+'({target,config})');
 const bindings=await connect({target,config,manifest});
 let lastPhase='',lastProgress=0;
 const onProgress=publicationMode==='production'?progress=>{if(progress.phase!==lastPhase||progress.completed-lastProgress>=100||progress.completed===progress.total){console.error(JSON.stringify(progress));lastPhase=progress.phase;lastProgress=progress.completed;}}:undefined;
 try{console.log(JSON.stringify(await publishImmutableSnapshot({...bindings,target,config,manifest,readObject,publicationMode,onProgress}),null,2));}
 finally{if(typeof bindings.dispose==='function')await bindings.dispose();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
