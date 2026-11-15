import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {verifyScadSelected} from '../prepare-scad-stock-selected.mjs';

const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const DATA=path.join(ROOT,'data/uae-evidence');
const STATE=path.join(ROOT,'work/idrive-replica/published-20261114');
const PLAN=path.join(DATA,'idrive-e2-published-replica-plan-20261114.json');
const ATTESTATION=path.join(DATA,'idrive-e2-published-replica-readback-20261114.json');
const BRIDGE=new URL('./bridge.mjs',import.meta.url);
const ACCOUNT='b1b843ec85bc39a3a4d370ba4f84f17a';
const WORKER='espacios-ai-router';
const PRODUCTION='ba0e47e8-5153-4ca5-8d13-46677e68861c';
const BUCKET='espacios-store-a';
const PREFIX='espacios-map/uae-evidence/published/20261114/';
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function reportHashes(value,result=new Set()){
 if(Array.isArray(value))for(const item of value)reportHashes(item,result);
 else if(value&&typeof value==='object')for(const [key,item] of Object.entries(value)){
  if(key.toLowerCase().endsWith('sha256')&&typeof item==='string'&&/^[a-f0-9]{64}$/.test(item))result.add(item);
  else reportHashes(item,result);
 }
 return result;
}
async function plan(){
 const bytes=await fs.readFile(PLAN),found=JSON.parse(bytes);
 if(found.planId!=='uae-published-evidence-idrive-e2-replica-20261114'||found.status!=='prepared_not_uploaded'||found.accountId!==ACCOUNT||found.bucket!==BUCKET||found.prefix!==PREFIX||found.objectCount!==37||found.objects?.length!==37||found.publishedSourceCount!==34||found.totalBytes!==found.objects.reduce((sum,item)=>sum+item.bytes,0))throw Error('Published evidence copy plan changed');
 const keys=new Set();
 for(const item of found.objects){
  if(!item.idriveKey.startsWith(PREFIX)||!item.idriveKey.includes('/'+item.sha256+'/')||!item.idriveKey.endsWith('/'+path.basename(item.localPath))||keys.has(item.idriveKey)||!Number.isSafeInteger(item.bytes)||item.bytes<1||item.bytes>8*1024*1024||!['application/json','application/gzip'].includes(item.contentType))throw Error('Invalid planned object');
  keys.add(item.idriveKey);
  const local=path.resolve(ROOT,item.localPath),validation=path.resolve(ROOT,item.validationPath);
  if(!local.startsWith(DATA+path.sep)||!validation.startsWith(DATA+path.sep)||!item.validationPath.endsWith('validation.json')||item.contentType!==(local.endsWith('.gz')?'application/gzip':'application/json'))throw Error('Planned path or content type invalid');
  const relative=path.relative(DATA,local),expectedKey=PREFIX+path.dirname(relative).split(path.sep).join('/')+'/'+item.sourceId+'/'+item.sha256+'/'+path.basename(local);
  if(item.idriveKey!==expectedKey)throw Error('Published evidence key changed');
  const source=await fs.readFile(local),reportBytes=await fs.readFile(validation),report=JSON.parse(reportBytes);
  if(source.length!==item.bytes||sha(source)!==item.sha256||sha(reportBytes)!==item.validationSha256)throw Error('Local source or validation changed: '+item.localPath);
  const raw=item.contentType==='application/gzip'?gunzipSync(source):source;
  if(raw.length!==item.rawBytes||sha(raw)!==item.rawSha256)throw Error('Decoded source changed: '+item.localPath);
  const hashes=reportHashes(report);
  if(!hashes.has(item.sha256)||!hashes.has(item.rawSha256)&&item.localPath!=='data/uae-evidence/abu-dhabi/sdi-developer-projects-geometry-chunks-20261103.json.gz')throw Error('Source checksum not pinned by validation: '+item.localPath);
  if(report.sourceId!==item.sourceId){
   const city=path.basename(item.localPath).match(/^certified-rent-(ajman|manama|masfoot)\.json\.gz$/)?.[1];
   if(!city||!report.sources?.some(entry=>entry.city===city&&entry.compressedSha256===item.sha256))throw Error('Source ID or rent report mismatch: '+item.localPath);
  }
 }
 const sourceIds=[...new Set(found.objects.map(item=>item.publishedSourceId))].sort();
 if(JSON.stringify(sourceIds)!==JSON.stringify(found.publishedSourceIds)||sourceIds.length!==34||found.objects.filter(item=>item.role==='geometry_projection').length!==2)throw Error('Published source coverage in plan changed');
 await verifyScadSelected();
 return {found,bytes};
}
async function privateJson(file,value){
 await fs.mkdir(STATE,{recursive:true,mode:0o700});
 const temp=file+'.tmp-'+process.pid;
 await fs.writeFile(temp,JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});
 await fs.rename(temp,file);
 await fs.chmod(file,0o600);
}
async function credential(){
 const home=process.env.HOME||'';
 for(const file of [path.join(home,'.wrangler/config/default.toml'),path.join(home,'Library/Preferences/.wrangler/config/default.toml')]){
  try{const found=(await fs.readFile(file,'utf8')).match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];if(found)return found;}catch{}
 }
 throw Error('Existing Cloudflare local authorization unavailable');
}
async function api(token,route,options={}){
 const response=await fetch('https://api.cloudflare.com/client/v4'+route,{...options,headers:{authorization:'Bearer '+token,...options.headers},signal:AbortSignal.timeout(120000)});
 const body=await response.json();
 if(!response.ok||!body.success)throw Error(`Cloudflare API ${response.status}: ${JSON.stringify(body.errors||[]).slice(0,400)}`);
 return body.result;
}
function pinned(value){
 const versions=value?.deployments?.[0]?.versions;
 if(versions?.length!==1||versions[0]?.version_id!==PRODUCTION||versions[0]?.percentage!==100)throw Error('Upload Worker production version drift');
 return versions;
}
async function stage(){
 const {found,bytes}=await plan();
 const token=await credential();
 const deploymentPath=`/accounts/${ACCOUNT}/workers/scripts/${WORKER}/deployments`;
 const before=pinned(await api(token,deploymentPath));
 const current=await api(token,`/accounts/${ACCOUNT}/workers/scripts/${WORKER}/versions/${PRODUCTION}`);
 for(const name of ['E2A_KEY','E2A_SECRET'])if(current?.resources?.bindings?.filter(binding=>binding.name===name&&binding.type==='secret_text').length!==1)throw Error(`Missing E2 secret binding ${name}`);
 const accessFile=path.join(STATE,'upload-access.json');
 try{const old=JSON.parse(await fs.readFile(accessFile,'utf8'));if(Date.parse(old.expiresAt)>Date.now())throw Error('An active published-evidence preview already exists');}
 catch(error){if(error.code!=='ENOENT'&&!/JSON|Unexpected token/.test(error.message))throw error;}
 const source=await fs.readFile(BRIDGE);
 const manifest=Buffer.from('export default '+JSON.stringify(Object.fromEntries(found.objects.map(item=>[item.idriveKey,{bytes:item.bytes,sha256:item.sha256,contentType:item.contentType}])))+';\n');
 const capability=crypto.randomBytes(32).toString('hex'),expiry=Date.now()+4*60*60*1000;
 const payload={main_module:'bridge.mjs',compatibility_date:'2026-11-03',bindings:[
  ...['E2A_KEY','E2A_SECRET'].map(name=>({name,type:'inherit',version_id:PRODUCTION})),
  {name:'PUBLISH_TOKEN',type:'secret_text',text:capability},
  {name:'EXPIRES_AT',type:'plain_text',text:String(expiry)},
 ],modules:[
  {name:'bridge.mjs',content_type:'application/javascript+module',content_base64:source.toString('base64')},
  {name:'manifest.mjs',content_type:'application/javascript+module',content_base64:manifest.toString('base64')},
 ],annotations:{'workers/message':'Temporary allowlisted published UAE evidence copy to IDrive E2; no production traffic'}};
 await privateJson(path.join(STATE,'upload-attempt.json'),{status:'creation_requested',startedAt:new Date().toISOString(),planSha256:sha(bytes),sourceSha256:sha(source),manifestSha256:sha(manifest)});
 const created=await api(token,`/accounts/${ACCOUNT}/workers/workers/${WORKER}/versions?deploy=false`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
 if(!/^[a-f0-9-]{36}$/.test(created?.id||''))throw Error('Preview creation returned no version ID; inspect Cloudflare before retrying');
 await privateJson(path.join(STATE,'upload-attempt.json'),{status:'created',version:created.id,startedAt:new Date().toISOString(),planSha256:sha(bytes)});
 const url=new URL(created.urls?.[0]||'');
 if(url.protocol!=='https:'||!url.hostname.endsWith('.workers.dev')||url.username||url.password||url.search||url.hash||!['','/'].includes(url.pathname))throw Error('Preview URL invalid; inspect upload-attempt.json');
 const after=pinned(await api(token,deploymentPath));
 if(JSON.stringify(after)!==JSON.stringify(before))throw Error('Production deployment changed during staging');
 await privateJson(accessFile,{base:url.origin,version:created.id,token:capability,expiresAt:new Date(expiry).toISOString(),planSha256:sha(bytes)});
 await privateJson(path.join(STATE,'upload-stage.json'),{status:'ready',version:created.id,productionVersion:PRODUCTION,sourceSha256:sha(source),manifestSha256:sha(manifest),planSha256:sha(bytes),expiresAt:new Date(expiry).toISOString(),productionUnchanged:true});
 return {status:'ready',version:created.id,expiresAt:new Date(expiry).toISOString(),productionUnchanged:true};
}
async function previewRequest(access,route,method,body,contentType){
 let last;
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetch(access.base+route,{method,headers:{authorization:'Bearer '+access.token,...(body?{'content-type':contentType}:{})},body,signal:AbortSignal.timeout(120000)});
   const result=await response.json();
   if(response.ok)return result;
   if(response.status<500)throw Error(`Preview rejected ${method} ${response.status} ${result?.error||''}`);
   last=Error(`Preview unavailable ${method} ${response.status} ${result?.error||''}`);
  }catch(error){last=error;if(/Preview rejected/.test(error.message))throw error;}
  if(attempt<2)await pause(1000*(attempt+1));
 }
 throw last;
}
async function copy(mode){
 if(!['upload','verify'].includes(mode))throw Error('Use upload or verify');
 const {found,bytes}=await plan();
 const access=JSON.parse(await fs.readFile(path.join(STATE,'upload-access.json'),'utf8'));
 if(access.planSha256!==sha(bytes)||Date.parse(access.expiresAt)<=Date.now())throw Error('Copy preview invalid or expired');
 const journalFile=path.join(STATE,'upload-journal.json');
 let journal;
 try{journal=JSON.parse(await fs.readFile(journalFile,'utf8'));}
 catch(error){if(error.code!=='ENOENT')throw error;journal={planSha256:sha(bytes),version:access.version,uploads:{},readbacks:{}};}
 if(journal.planSha256!==sha(bytes)||journal.version!==access.version)throw Error('Journal belongs to another plan or preview');
 for(const [index,item] of found.objects.entries()){
  const local=await fs.readFile(path.join(ROOT,item.localPath)),route='?key='+encodeURIComponent(item.idriveKey);
  if(mode==='upload'&&!journal.uploads[item.idriveKey]){
   const receipt=await previewRequest(access,'/upload'+route,'POST',local,item.contentType);
   if(receipt?.ok!==true||receipt.verified!==true||receipt.key!==item.idriveKey||receipt.bytes!==item.bytes||receipt.sha256!==item.sha256||receipt.contentType!==item.contentType)throw Error('Upload/readback mismatch: '+item.idriveKey);
   journal.uploads[item.idriveKey]={bytes:item.bytes,sha256:item.sha256,contentType:item.contentType,verifiedAt:new Date().toISOString(),alreadyExists:receipt.alreadyExists===true};
   await privateJson(journalFile,journal);
  }
  if(mode==='verify'){
   const receipt=await previewRequest(access,'/verify'+route,'GET');
   if(receipt?.ok!==true||receipt.verified!==true||receipt.key!==item.idriveKey||receipt.bytes!==item.bytes||receipt.sha256!==item.sha256||receipt.contentType!==item.contentType)throw Error('Independent readback mismatch: '+item.idriveKey);
   journal.readbacks[item.idriveKey]={bytes:item.bytes,sha256:item.sha256,contentType:item.contentType,verifiedAt:new Date().toISOString()};
   await privateJson(journalFile,journal);
  }
  if((index+1)%5===0||index+1===found.objectCount)console.log(JSON.stringify({mode,done:index+1,total:found.objectCount}));
 }
 if(mode==='verify'&&(Object.keys(journal.uploads).length!==found.objectCount||Object.keys(journal.readbacks).length!==found.objectCount))throw Error('Incomplete copy receipts');
}
async function attest(){
 const {found,bytes}=await plan();
 const stage=JSON.parse(await fs.readFile(path.join(STATE,'upload-stage.json'),'utf8'));
 const journalBytes=await fs.readFile(path.join(STATE,'upload-journal.json'));
 const journal=JSON.parse(journalBytes);
 const keys=new Set(found.objects.map(item=>item.idriveKey));
 if(stage.planSha256!==sha(bytes)||journal.planSha256!==sha(bytes)||journal.version!==stage.version||stage.productionUnchanged!==true||keys.size!==found.objectCount||Object.keys(journal.uploads).length!==found.objectCount||Object.keys(journal.readbacks).length!==found.objectCount)throw Error('Copy receipt set incomplete or stale');
 for(const item of found.objects)for(const phase of ['uploads','readbacks']){
  const receipt=journal[phase][item.idriveKey];
  if(receipt?.bytes!==item.bytes||receipt.sha256!==item.sha256||receipt.contentType!==item.contentType||!receipt.verifiedAt)throw Error('Receipt mismatch: '+item.idriveKey);
 }
 const token=await credential();
 pinned(await api(token,`/accounts/${ACCOUNT}/workers/scripts/${WORKER}/deployments`));
 const report={attestationId:'uae-published-evidence-idrive-e2-readback-20261114',planId:found.planId,planSha256:sha(bytes),privateJournalSha256:sha(journalBytes),previewVersion:stage.version,bridgeSha256:stage.sourceSha256,verifiedAt:journal.readbacks[found.objects.at(-1).idriveKey].verifiedAt,bucket:BUCKET,prefix:PREFIX,objectCount:found.objectCount,totalBytes:found.totalBytes,publishedSourceIds:found.publishedSourceIds,publishedSourceCount:found.publishedSourceCount,coverageInventoryVersion:found.sourceInventoryVersion,previousReplicaAttestationId:found.previousReplicaAttestationId,verification:'All 37 allowlisted objects passed conditional upload with immediate checksum readback, then a separate signed IDrive E2 GET with exact content type, byte length and SHA-256.',allObjectsVerified:true,runtimePrimaryChanged:false,productionTrafficChangedByCopy:false};
 const content=JSON.stringify(report,null,2)+'\n';
 try{const old=await fs.readFile(ATTESTATION,'utf8');if(old!==content)throw Error('Attestation already exists with different content');}
 catch(error){if(error.code!=='ENOENT')throw error;await fs.writeFile(ATTESTATION,content,{flag:'wx'});}
 return {status:'verified',objectCount:report.objectCount,totalBytes:report.totalBytes,verifiedAt:report.verifiedAt};
}
export async function verifyAttestation(){
 const {found,bytes}=await plan();
 const report=JSON.parse(await fs.readFile(ATTESTATION,'utf8'));
 if(report.attestationId!=='uae-published-evidence-idrive-e2-readback-20261114'||report.planSha256!==sha(bytes)||report.objectCount!==found.objectCount||report.totalBytes!==found.totalBytes||report.publishedSourceCount!==found.publishedSourceCount||JSON.stringify(report.publishedSourceIds)!==JSON.stringify(found.publishedSourceIds)||report.coverageInventoryVersion!==found.sourceInventoryVersion||report.bridgeSha256!==sha(await fs.readFile(BRIDGE))||report.allObjectsVerified!==true||report.runtimePrimaryChanged!==false||report.productionTrafficChangedByCopy!==false||!report.verifiedAt)throw Error('Published evidence IDrive attestation invalid');
 return {attestationId:report.attestationId,objectCount:report.objectCount,totalBytes:report.totalBytes,verifiedAt:report.verifiedAt,sourceIds:report.publishedSourceIds,sourceInventoryVersion:report.coverageInventoryVersion,storageRole:'verified_private_replica_not_runtime_primary'};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const action=process.argv[2];
 if(!['prepare','stage','upload','verify','attest','verify-attestation'].includes(action)||process.argv.length!==3)throw Error('Use prepare, stage, upload, verify, attest, or verify-attestation');
 const run={prepare:plan,stage,upload:()=>copy('upload'),verify:()=>copy('verify'),attest,'verify-attestation':verifyAttestation}[action];
 run().then(result=>{if(result)console.log(JSON.stringify(action==='prepare'?{status:'prepared',objectCount:result.found.objectCount,totalBytes:result.found.totalBytes,planSha256:sha(result.bytes)}:result));}).catch(error=>{console.error(JSON.stringify({status:'failed',error:String(error.message)}));process.exitCode=1;});
}
