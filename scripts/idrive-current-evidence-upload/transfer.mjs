import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {gunzipSync, gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';

const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const DATA=path.join(ROOT,'data/uae-evidence');
const STATE=path.join(ROOT,'work/idrive-replica/current-evidence-20261114');
const PLAN=path.join(DATA,'idrive-e2-current-replica-plan-20261114.json');
const ATTESTATION=path.join(DATA,'idrive-e2-current-replica-readback-20261114.json');
const BRIDGE=new URL('../idrive-dubai-upload/bridge.mjs',import.meta.url);
const ACCOUNT='b1b843ec85bc39a3a4d370ba4f84f17a';
const WORKER='espacios-ai-router';
const PRODUCTION='ba0e47e8-5153-4ca5-8d13-46677e68861c';
const BUCKET='espacios-store-a';
const PREFIX='espacios-map/uae-evidence/';
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

const SPECS=[
 {sourceId:'continental-dld-mashrooi-project-status-20261114',report:'dubai/dld-project-status-validation.json',file:'dubai/dld-project-status-20261114.csv.gz',role:'source_csv',keyPrefix:'dubai/project-status/20261114/',packedBytes:'compressedBytes',packedSha:'compressedSha256',rawBytes:'rawBytes',rawSha:'rawSha256'},
 {sourceId:'continental-dld-mashrooi-project-status-20261114',report:'dubai/dld-project-status-validation.json',file:'dubai/dld-project-status-20261114.normalized.json.gz',role:'normalized_snapshot',keyPrefix:'dubai/project-status/20261114/',packedBytes:'normalizedCompressedBytes',packedSha:'normalizedCompressedSha256',rawBytes:'normalizedBytes',rawSha:'normalizedSha256'},
 {sourceId:'rgestate-full-index-20261111',report:'rgestate/full-index-validation-20261111.json',file:'rgestate/full-index-20261111.json.gz',role:'publisher_listing_index',keyPrefix:'rgestate/listings/20261111/',packedBytes:'compressedBytes',packedSha:'compressedSha256',rawBytes:'rawBytes',rawSha:'rawSha256'},
 {sourceId:'rgestate-commercial-category-20261111',report:'rgestate/commercial-listings-validation-20261111.json',file:'rgestate/commercial-listings-20261111.json.gz',role:'publisher_commercial_category',keyPrefix:'rgestate/listings/20261111/',packedBytes:'compressedBytes',packedSha:'compressedSha256',rawBytes:'rawBytes',rawSha:'rawSha256'},
 {sourceId:'rgestate-commercial-title-candidates-20261111',report:'rgestate/commercial-title-candidates-validation-20261111.json',file:'rgestate/commercial-title-candidates-20261111.json.gz',role:'publisher_commercial_title_candidates',keyPrefix:'rgestate/listings/20261111/',packedBytes:'compressedBytes',packedSha:'compressedSha256',rawBytes:'rawBytes',rawSha:'rawSha256'},
 {sourceId:'sharjah-rerd-reported-monthly-market-20261114',report:'sharjah/monthly-market-validation.json',file:'sharjah/monthly-market-20261114.json.gz',rawFile:'sharjah/monthly-market-20261114.json',role:'selected_monthly_numerical_facts',keyPrefix:'sharjah/monthly-market/20261114/',rawBytes:'dataBytes',rawSha:'dataSha256'},
];

async function objectFor(spec,createSharjah=false){
 const reportBytes=await fs.readFile(path.join(DATA,spec.report));
 const report=JSON.parse(reportBytes);
 if(report.sourceId!==spec.sourceId)throw Error('Validation source changed: '+spec.report);
 const localPath='data/uae-evidence/'+spec.file;
 const file=path.join(ROOT,localPath);
 if(spec.rawFile){
  const raw=await fs.readFile(path.join(DATA,spec.rawFile));
  if(raw.length!==report[spec.rawBytes]||sha(raw)!==report[spec.rawSha])throw Error('Sharjah source changed');
  try{await fs.access(file);}
  catch(error){if(error.code!=='ENOENT')throw error;if(!createSharjah)throw Error('Prepare the Sharjah gzip first');await fs.writeFile(file,gzipSync(raw,{mtime:0}),{flag:'wx'});}
 }
 const packed=await fs.readFile(file);
 const raw=gunzipSync(packed);
 if(spec.packedBytes&&packed.length!==report[spec.packedBytes])throw Error('Packed length changed: '+spec.file);
 if(spec.packedSha&&sha(packed)!==report[spec.packedSha])throw Error('Packed checksum changed: '+spec.file);
 if(raw.length!==report[spec.rawBytes]||sha(raw)!==report[spec.rawSha])throw Error('Raw checksum changed: '+spec.file);
 if(spec.file.startsWith('rgestate/')){
  const rows=JSON.parse(raw);
  if(!Array.isArray(rows)||rows.some(row=>Object.keys(row).some(key=>/photo|image/i.test(key))))throw Error('RGEstate snapshot is not facts-and-links only');
 }
 const digest=sha(packed);
 return {sourceId:spec.sourceId,role:spec.role,localPath,idriveKey:PREFIX+spec.keyPrefix+digest+'/'+path.basename(spec.file),bytes:packed.length,sha256:digest,rawBytes:raw.length,rawSha256:sha(raw),validationSha256:sha(reportBytes),contentType:'application/gzip'};
}
async function expectedPlan(createSharjah=false){
 const objects=[];
 for(const spec of SPECS)objects.push(await objectFor(spec,createSharjah));
 return {planId:'uae-current-evidence-idrive-e2-replica-20261114',status:'prepared_not_uploaded',accountId:ACCOUNT,host:'s3.us-west-2.idrivee2.com',signingRegion:'us-east-1',bucket:BUCKET,prefix:PREFIX,sourceScope:'Five versioned Dubai and RGEstate gzip snapshots plus one selected Sharjah numerical-facts gzip; no listing photos or article bodies',separateFromExistingCloudflareBackupRun:true,objects,objectCount:objects.length,totalBytes:objects.reduce((n,o)=>n+o.bytes,0)};
}
async function plan(){
 const bytes=await fs.readFile(PLAN);
 const found=JSON.parse(bytes);
 const expected=await expectedPlan();
 if(JSON.stringify(found)!==JSON.stringify(expected)||found.objectCount!==6||new Set(found.objects.map(o=>o.idriveKey)).size!==6)throw Error('Copy plan or local evidence changed');
 for(const item of found.objects)if(!item.idriveKey.startsWith(PREFIX)||item.bytes<1||item.bytes>8*1024*1024||!/^[a-f0-9]{64}$/.test(item.sha256))throw Error('Invalid copy object');
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
async function prepare(){
 const proposed=await expectedPlan(true);
 const content=JSON.stringify(proposed,null,2)+'\n';
 try{const old=await fs.readFile(PLAN,'utf8');if(old!==content)throw Error('Immutable plan already exists with different content');}
 catch(error){if(error.code!=='ENOENT')throw error;await fs.writeFile(PLAN,content,{flag:'wx'});}
 return {status:'prepared',objectCount:proposed.objectCount,totalBytes:proposed.totalBytes,planSha256:sha(Buffer.from(content))};
}
async function stage(){
 const {found,bytes}=await plan();
 const token=await credential();
 const deploymentPath=`/accounts/${ACCOUNT}/workers/scripts/${WORKER}/deployments`;
 const before=pinned(await api(token,deploymentPath));
 const current=await api(token,`/accounts/${ACCOUNT}/workers/scripts/${WORKER}/versions/${PRODUCTION}`);
 for(const name of ['E2A_KEY','E2A_SECRET'])if(current?.resources?.bindings?.filter(b=>b.name===name&&b.type==='secret_text').length!==1)throw Error(`Missing E2 secret binding ${name}`);
 const accessFile=path.join(STATE,'upload-access.json');
 try{const old=JSON.parse(await fs.readFile(accessFile));if(Date.parse(old.expiresAt)>Date.now())throw Error('An active copy preview already exists');}
 catch(error){if(error.code!=='ENOENT'&&!/JSON|Unexpected token/.test(error.message))throw error;}
 const source=await fs.readFile(BRIDGE);
 const manifest=Buffer.from('export default '+JSON.stringify(Object.fromEntries(found.objects.map(o=>[o.idriveKey,{bytes:o.bytes,sha256:o.sha256}])))+';\n');
 const capability=crypto.randomBytes(32).toString('hex');
 const expiry=Date.now()+4*60*60*1000;
 const payload={main_module:'bridge.mjs',compatibility_date:'2026-11-03',bindings:[
  ...['E2A_KEY','E2A_SECRET'].map(name=>({name,type:'inherit',version_id:PRODUCTION})),
  {name:'PUBLISH_TOKEN',type:'secret_text',text:capability},
  {name:'EXPIRES_AT',type:'plain_text',text:String(expiry)},
 ],modules:[
  {name:'bridge.mjs',content_type:'application/javascript+module',content_base64:source.toString('base64')},
  {name:'manifest.mjs',content_type:'application/javascript+module',content_base64:manifest.toString('base64')},
 ],annotations:{'workers/message':'Temporary allowlisted IDrive E2 evidence copy; no production traffic'}};
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
async function previewRequest(access,route,method,body){
 let last;
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetch(access.base+route,{method,headers:{authorization:'Bearer '+access.token,...(body?{'content-type':'application/gzip'}:{})},body,signal:AbortSignal.timeout(120000)});
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
 for(const item of found.objects){
  const local=await fs.readFile(path.join(ROOT,item.localPath));
  if(local.length!==item.bytes||sha(local)!==item.sha256)throw Error('Local object changed: '+item.localPath);
  const route='?key='+encodeURIComponent(item.idriveKey);
  if(mode==='upload'&&!journal.uploads[item.idriveKey]){
   const receipt=await previewRequest(access,'/upload'+route,'POST',local);
   if(receipt?.ok!==true||receipt.verified!==true||receipt.key!==item.idriveKey||receipt.bytes!==item.bytes||receipt.sha256!==item.sha256)throw Error('Upload/readback mismatch: '+item.idriveKey);
   journal.uploads[item.idriveKey]={bytes:item.bytes,sha256:item.sha256,verifiedAt:new Date().toISOString(),alreadyExists:receipt.alreadyExists===true};
   await privateJson(journalFile,journal);
  }
  if(mode==='verify'){
   const receipt=await previewRequest(access,'/verify'+route,'GET');
   if(receipt?.ok!==true||receipt.verified!==true||receipt.key!==item.idriveKey||receipt.bytes!==item.bytes||receipt.sha256!==item.sha256)throw Error('Independent readback mismatch: '+item.idriveKey);
   journal.readbacks[item.idriveKey]={bytes:item.bytes,sha256:item.sha256,verifiedAt:new Date().toISOString()};
   await privateJson(journalFile,journal);
  }
  console.log(JSON.stringify({mode,done:found.objects.indexOf(item)+1,total:found.objectCount,role:item.role}));
 }
 if(mode==='verify'&&(Object.keys(journal.uploads).length!==6||Object.keys(journal.readbacks).length!==6))throw Error('Incomplete copy receipts');
}
async function attest(){
 const {found,bytes}=await plan();
 const stage=JSON.parse(await fs.readFile(path.join(STATE,'upload-stage.json'),'utf8'));
 const journalBytes=await fs.readFile(path.join(STATE,'upload-journal.json'));
 const journal=JSON.parse(journalBytes);
 const keys=new Set(found.objects.map(o=>o.idriveKey));
 if(stage.planSha256!==sha(bytes)||journal.planSha256!==sha(bytes)||journal.version!==stage.version||stage.productionUnchanged!==true||keys.size!==6||Object.keys(journal.uploads).length!==6||Object.keys(journal.readbacks).length!==6)throw Error('Copy receipt set incomplete or stale');
 for(const item of found.objects)for(const phase of ['uploads','readbacks']){
  const receipt=journal[phase][item.idriveKey];
  if(receipt?.bytes!==item.bytes||receipt.sha256!==item.sha256||!receipt.verifiedAt)throw Error('Receipt mismatch: '+item.idriveKey);
 }
 const token=await credential();
 pinned(await api(token,`/accounts/${ACCOUNT}/workers/scripts/${WORKER}/deployments`));
 const report={attestationId:'uae-current-evidence-idrive-e2-readback-20261114',planId:found.planId,planSha256:sha(bytes),privateJournalSha256:sha(journalBytes),previewVersion:stage.version,bridgeSha256:stage.sourceSha256,verifiedAt:journal.readbacks[found.objects.at(-1).idriveKey].verifiedAt,bucket:BUCKET,prefix:PREFIX,objectCount:6,totalBytes:found.totalBytes,sourceIds:[...new Set(found.objects.map(o=>o.sourceId))],verification:'Each allowlisted gzip object passed conditional upload with immediate checksum readback, then a separate signed IDrive E2 GET with exact length and SHA-256.',allObjectsVerified:true,runtimePrimaryChanged:false,productionTrafficChangedByCopy:false};
 const content=JSON.stringify(report,null,2)+'\n';
 try{const old=await fs.readFile(ATTESTATION,'utf8');if(old!==content)throw Error('Attestation already exists with different content');}
 catch(error){if(error.code!=='ENOENT')throw error;await fs.writeFile(ATTESTATION,content,{flag:'wx'});}
 return {status:'verified',objectCount:6,totalBytes:found.totalBytes,verifiedAt:report.verifiedAt};
}
async function verifyAttestation(){
 const {found,bytes}=await plan();
 const report=JSON.parse(await fs.readFile(ATTESTATION,'utf8'));
 if(report.attestationId!=='uae-current-evidence-idrive-e2-readback-20261114'||report.planSha256!==sha(bytes)||report.objectCount!==6||report.totalBytes!==found.totalBytes||report.allObjectsVerified!==true||report.runtimePrimaryChanged!==false||report.productionTrafficChangedByCopy!==false||JSON.stringify(report.sourceIds)!==JSON.stringify([...new Set(found.objects.map(o=>o.sourceId))])||report.bridgeSha256!==sha(await fs.readFile(BRIDGE))||!report.verifiedAt)throw Error('Current-evidence IDrive attestation invalid');
 return {attestationId:report.attestationId,objectCount:6,totalBytes:report.totalBytes,verifiedAt:report.verifiedAt,sourceIds:report.sourceIds,storageRole:'verified_private_replica_not_runtime_primary'};
}
export {verifyAttestation};
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const action=process.argv[2];
 if(!['prepare','stage','upload','verify','attest','verify-attestation'].includes(action)||process.argv.length!==3)throw Error('Use prepare, stage, upload, verify, attest, or verify-attestation');
 const run={prepare,stage,upload:()=>copy('upload'),verify:()=>copy('verify'),attest,'verify-attestation':verifyAttestation}[action];
 run().then(result=>{if(result)console.log(JSON.stringify(result));}).catch(error=>{console.error(JSON.stringify({status:'failed',error:String(error.message)}));process.exitCode=1;});
}
