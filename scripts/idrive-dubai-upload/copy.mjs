import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';

const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const STATE=path.join(ROOT,'work/idrive-replica/dubai-20261026');
const PLAN=path.join(ROOT,'data/uae-evidence/dubai/idrive-e2-replica-plan-20261114.json');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function save(file,value){
 const temp=file+'.tmp-'+process.pid;
 await fs.writeFile(temp,JSON.stringify(value,null,2)+'\n',{mode:0o600});
 await fs.rename(temp,file);
}
async function request(access,route,method,body){
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
function validReceipt(receipt,item){
 if(receipt?.ok!==true||receipt?.verified!==true||receipt.key!==item.idriveKey||receipt.bytes!==item.bytes||receipt.sha256!==item.sha256)throw Error('IDrive readback receipt mismatch: '+item.idriveKey);
}
export async function copy(mode,limit=Infinity){
 if(!['--upload','--verify'].includes(mode))throw Error('Use --upload or --verify');
 if(limit!==Infinity&&(!Number.isSafeInteger(limit)||limit<1||limit>155))throw Error('Invalid object limit');
 const planBytes=await fs.readFile(PLAN);
 const plan=JSON.parse(planBytes);
 const access=JSON.parse(await fs.readFile(path.join(STATE,'map-upload-access.json'),'utf8'));
 if(plan.status!=='prepared_not_uploaded'||plan.objects?.length!==155||access.prefix!==plan.prefix||access.planSha256!==hash(planBytes)||Date.parse(access.expiresAt)<=Date.now())throw Error('Scoped preview or plan is invalid or expired');
 const objects=[];
 for(const item of plan.objects){
  const local=path.resolve(ROOT,item.localPath);
  const base=path.resolve(ROOT);
  if(!local.startsWith(base+path.sep))throw Error('Object path escaped repository');
  const bytes=await fs.readFile(local);
  if(bytes.length!==item.bytes||hash(bytes)!==item.sha256)throw Error('Local object changed: '+item.localPath);
  objects.push({item,bytes});
 }
 const journalFile=path.join(STATE,'map-upload-journal.json');
 let journal;
 try{journal=JSON.parse(await fs.readFile(journalFile,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;journal={planSha256:hash(planBytes),version:access.version,uploads:{},readbacks:{}};}
 if(journal.planSha256!==hash(planBytes)||journal.version!==access.version)throw Error('Upload journal belongs to another plan or version');
 let done=0;
 for(const {item,bytes} of objects){
  const route='?key='+encodeURIComponent(item.idriveKey);
  if(mode==='--upload'&&!journal.uploads[item.idriveKey]){
   const receipt=await request(access,'/upload'+route,'POST',bytes);
   validReceipt(receipt,item);
   journal.uploads[item.idriveKey]={bytes:item.bytes,sha256:item.sha256,alreadyExists:receipt.alreadyExists===true,verifiedAt:new Date().toISOString()};
   await save(journalFile,journal);
  }
  if(mode==='--verify'){
   const receipt=await request(access,'/verify'+route,'GET');
   validReceipt(receipt,item);
   journal.readbacks[item.idriveKey]={bytes:item.bytes,sha256:item.sha256,verifiedAt:new Date().toISOString()};
   await save(journalFile,journal);
  }
  done++;
  if(done%10===0||done===objects.length||done===limit)console.log(JSON.stringify({mode,done,total:objects.length}));
  if(done>=limit)break;
 }
 if(mode==='--verify'&&limit===Infinity){
  if(Object.keys(journal.uploads).length!==objects.length||Object.keys(journal.readbacks).length!==objects.length)throw Error('Readback set incomplete');
  const report={planId:plan.planId,planSha256:hash(planBytes),bucket:plan.bucket,prefix:plan.prefix,previewVersion:access.version,verifiedAt:new Date().toISOString(),objectCount:objects.length,totalBytes:plan.totalBytes,verification:'Separate signed IDrive GET for each object after upload; exact length and SHA-256 matched',allObjectsVerified:true,privateOriginalAssemblies:plan.originalAssemblies.map(x=>({sourceId:x.sourceId,originalBytes:x.originalBytes,originalSha256:x.originalSha256,packedBytes:x.packedBytes,packedSha256:x.packedSha256,partCount:x.partKeysInOrder.length}))};
  await save(path.join(STATE,'map-upload-readback.json'),report);
  console.log(JSON.stringify({status:'verified',objectCount:objects.length,totalBytes:plan.totalBytes}));
 }
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const limitArg=process.argv[3];
 const limit=limitArg?.startsWith('--limit=')?Number(limitArg.slice(8)):Infinity;
 if(process.argv.length>4||limitArg&&!limitArg.startsWith('--limit='))throw Error('Use --upload or --verify, optionally followed by --limit=N');
 copy(process.argv[2],limit).catch(error=>{console.error(JSON.stringify({status:'failed',error:String(error.message)}));process.exitCode=1;});
}
