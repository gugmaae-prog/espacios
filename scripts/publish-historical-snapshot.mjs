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
async function existingBytes(r2,key){const obj=await r2.get(key);return obj?Buffer.from(await obj.arrayBuffer()):null;}
export async function publishImmutableSnapshot({r2,d1,target,config,manifest,readObject}) {
 validateCandidateTarget(config,target);
 if(!r2?.get||!r2?.put||!d1?.prepare||!d1?.batch)throw new Error('Adapter must expose candidate R2 and D1 Worker APIs');
 const prior=await d1.prepare('SELECT root_sha256, publication_state FROM hi_snapshots WHERE snapshot_version = ?').bind(manifest.version).first();
 if(prior&&prior.root_sha256!==manifest.rootIndex.sha256)throw new Error('Snapshot version collision: assign a new version before publishing revised evidence');
 const loaded=[];
 // Validate every incoming and existing object before any write, including later collisions.
 for(const object of manifest.objects){
  if(!new RegExp('^research/published/\\d{4}-\\d{2}-\\d{2}/historical-intelligence/objects/'+object.sha256+'\\.(json(?:\\.gz)?|csv\\.gz|sql\\.gz|parquet)$').test(object.key))throw new Error('Object key must be content addressed');
  const bytes=Buffer.from(await readObject(object));
  if(bytes.length!==object.bytes||digest(bytes)!==object.sha256)throw new Error('Incoming object checksum mismatch: '+object.key);
  const priorBytes=await existingBytes(r2,object.key);
  if(priorBytes&&digest(priorBytes)!==object.sha256)throw new Error('Existing immutable object collision: '+object.key);
  loaded.push({object,bytes,exists:!!priorBytes});
 }
 const sqlBytes=Buffer.from(await readObject(manifest.d1Index));
 if(sqlBytes.length!==manifest.d1Index.bytes||digest(sqlBytes)!==manifest.d1Index.sha256)throw new Error('D1 index checksum mismatch');
 const sql=gunzipSync(sqlBytes).toString('utf8');
 // The immutable snapshot header is claimed separately. A later publisher may
 // have claimed this version after our initial read but before indexing starts.
 const statements=sql.split('\n').filter(line=>line.startsWith('INSERT '));
 const headers=statements.filter(line=>/^INSERT (?:OR IGNORE )?INTO hi_snapshots\b/i.test(line));
 if(headers.length!==1)throw new Error('D1 index must contain exactly one immutable snapshot header');
 const indexes=statements.filter(line=>line!==headers[0]);
 let written=0,reused=0;
 for(const {object,bytes,exists} of loaded){
  if(exists){reused++;continue;}
  const result=await r2.put(object.key,bytes,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:object.contentType||(object.compression==='gzip'?'application/gzip':'application/json')},customMetadata:{sha256:object.sha256,snapshotVersion:manifest.version}});
  const verified=await existingBytes(r2,object.key);
  if(!verified||digest(verified)!==object.sha256)throw new Error('Conditional immutable write did not verify: '+object.key);
  if(result)written++;else reused++;
 }
 // Each SQL statement occupies one physical line; JSON newlines are escaped by the builder.
 await d1.prepare(headers[0]).run();
 const claimed=await d1.prepare('SELECT root_sha256, publication_state FROM hi_snapshots WHERE snapshot_version = ?').bind(manifest.version).first();
 if(!claimed||claimed.root_sha256!==manifest.rootIndex.sha256)throw new Error('Snapshot version collision during claim: no record indexes were written');
 if(!['staged','complete'].includes(claimed.publication_state))throw new Error('Claimed snapshot publication state is invalid');
 for(let i=0;i<indexes.length;i+=50)await d1.batch(indexes.slice(i,i+50).map(s=>d1.prepare(s)));
 const completion=await d1.prepare("UPDATE hi_snapshots SET publication_state = 'complete' WHERE snapshot_version = ? AND root_sha256 = ?").bind(manifest.version,manifest.rootIndex.sha256).run();
 const completed=await d1.prepare('SELECT root_sha256, publication_state FROM hi_snapshots WHERE snapshot_version = ?').bind(manifest.version).first();
 if(!completed||completed.root_sha256!==manifest.rootIndex.sha256||completed.publication_state!=='complete'||(Number.isFinite(completion?.meta?.changes)&&completion.meta.changes!==1))throw new Error('Snapshot completion did not verify its immutable root and complete state');
 return {version:manifest.version,written,reused,indexStatements:statements.length,publicationState:'complete',rollbackPolicy:'Failure leaves verified immutable orphan objects or staged indexes; never activates a mutable latest pointer and never deletes evidence'};
}
async function main(){
 const args=process.argv.slice(2);const option=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
 const manifestPath=path.resolve(option('--manifest')||path.join(ROOT,'data/historical-intelligence/publication-manifest.json'));
 const configPath=path.resolve(option('--config')||path.join(ROOT,'wrangler.jsonc'));
 const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
 const config=parseJSONC(await fs.readFile(configPath,'utf8'));
 const target=option('--target')?JSON.parse(await fs.readFile(path.resolve(option('--target')),'utf8')):null;
 let targetStatus='blocked: explicit isolated candidate target required';
 try{validateCandidateTarget(config,target);targetStatus='verified candidate bindings';}catch(error){targetStatus='blocked: '+error.message;}
 const readObject=object=>fs.readFile(path.resolve(ROOT,object.path));
 for(const object of [...manifest.objects,manifest.d1Index]){
  const bytes=await readObject(object);if(digest(bytes)!==object.sha256||bytes.length!==object.bytes)throw new Error('Local publication object does not verify '+object.path);
 }
 if(!args.includes('--apply')){
  console.log(JSON.stringify({mode:'dry_run',remoteWrites:0,version:manifest.version,counts:manifest.counts,objects:manifest.objects.length,totalBytes:manifest.objects.reduce((n,x)=>n+x.bytes,0),targetStatus,requiresForApply:['--config isolated-candidate.jsonc','--target candidate-resources.json','--adapter explicit-candidate-worker-api-adapter.mjs'],conditionalWrite:{onlyIf:{etagDoesNotMatch:'*'}},d1Index:manifest.d1Index},null,2));return;
 }
 validateCandidateTarget(config,target);
 if(!option('--config')||!option('--target')||!option('--adapter'))throw new Error('--apply requires explicit --config, --target and --adapter; no environment or production fallback');
 const adapter=await import(pathToFileURL(path.resolve(option('--adapter'))).href);
 if(typeof adapter.connectCandidate!=='function')throw new Error('Adapter must export connectCandidate({target,config})');
 const bindings=await adapter.connectCandidate({target,config});
 try{console.log(JSON.stringify(await publishImmutableSnapshot({...bindings,target,config,manifest,readObject}),null,2));}
 finally{if(typeof bindings.dispose==='function')await bindings.dispose();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
