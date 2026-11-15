import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';

const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const PLAN=path.join(ROOT,'data/uae-evidence/dubai/idrive-e2-replica-plan-20261114.json');
const STATE=path.join(ROOT,'work/idrive-replica/dubai-20261026');
const ACCOUNT='b1b843ec85bc39a3a4d370ba4f84f17a';
const WORKER='espacios-ai-router';
const PRODUCTION_VERSION='ba0e47e8-5153-4ca5-8d13-46677e68861c';
const PREFIX='espacios-map/uae-evidence/dubai/20261026/';
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');

async function credential(){
 for(const file of [path.join(process.env.HOME||'','/.wrangler/config/default.toml'),path.join(process.env.HOME||'','/Library/Preferences/.wrangler/config/default.toml')]){
  try{const found=(await fs.readFile(file,'utf8')).match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];if(found)return found;}catch{}
 }
 throw Error('Existing Cloudflare local authorization unavailable');
}
async function api(token,route,options={}){
 const result=await fetch('https://api.cloudflare.com/client/v4'+route,{...options,headers:{authorization:'Bearer '+token,...options.headers},signal:AbortSignal.timeout(120000)});
 const body=await result.json();
 if(!result.ok||!body.success)throw Error(`Cloudflare API ${result.status}: ${JSON.stringify(body.errors||[]).slice(0,500)}`);
 return body.result;
}
function pinned(deployments){
 const current=deployments?.deployments?.[0]?.versions;
 if(current?.length!==1||current[0]?.version_id!==PRODUCTION_VERSION||current[0]?.percentage!==100)throw Error('Production version drift; review before staging');
 return current;
}
async function writePrivate(file,value){
 const temp=file+'.tmp-'+process.pid;
 await fs.writeFile(temp,JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});
 await fs.rename(temp,file);
 await fs.chmod(file,0o600);
}
export async function stage(execute=false){
 const plan=JSON.parse(await fs.readFile(PLAN,'utf8'));
 if(plan.status!=='prepared_not_uploaded'||plan.accountId!==ACCOUNT||plan.bucket!=='espacios-store-a'||plan.prefix!==PREFIX||plan.objectCount!==155||plan.objects.length!==155)throw Error('Dubai replica scope changed');
 const expected={};
 for(const item of plan.objects){
  if(!item.idriveKey.startsWith(PREFIX)||!Number.isSafeInteger(item.bytes)||item.bytes<1||item.bytes>8*1024*1024||!(/^[a-f0-9]{64}$/).test(item.sha256)||Object.hasOwn(expected,item.idriveKey))throw Error('Invalid planned object');
  expected[item.idriveKey]={bytes:item.bytes,sha256:item.sha256};
 }
 const source=await fs.readFile(new URL('./bridge.mjs',import.meta.url));
 const manifest=Buffer.from('export default '+JSON.stringify(expected)+';\n');
 const offline={worker:WORKER,productionVersion:PRODUCTION_VERSION,trafficChange:false,bindings:['E2A_KEY','E2A_SECRET','PUBLISH_TOKEN','EXPIRES_AT'],routes:['GET /verify','POST /upload'],objects:plan.objectCount,totalBytes:plan.totalBytes,sourceSha256:hash(source),manifestSha256:hash(manifest)};
 if(!execute)return {...offline,dryRun:true};
 const previous=path.join(STATE,'map-upload-access.json');
 try{const old=JSON.parse(await fs.readFile(previous,'utf8'));if(Date.parse(old.expiresAt)>Date.now())throw Error('An active map upload preview exists; finish or retire it first');}catch(error){if(error.code!=='ENOENT'&&!/Unexpected token|JSON/.test(error.message))throw error;}
 const token=await credential();
 const deploymentPath=`/accounts/${ACCOUNT}/workers/scripts/${WORKER}/deployments`;
 const before=pinned(await api(token,deploymentPath));
 const current=await api(token,`/accounts/${ACCOUNT}/workers/scripts/${WORKER}/versions/${PRODUCTION_VERSION}`);
 for(const name of ['E2A_KEY','E2A_SECRET'])if(current?.resources?.bindings?.filter(b=>b.name===name&&b.type==='secret_text').length!==1)throw Error(`Missing production secret binding ${name}`);
 const capability=crypto.randomBytes(32).toString('hex');
 const expires=Date.now()+4*60*60*1000;
 const payload={main_module:'bridge.mjs',compatibility_date:'2026-11-03',bindings:[
  ...['E2A_KEY','E2A_SECRET'].map(name=>({name,type:'inherit',version_id:PRODUCTION_VERSION})),
  {name:'PUBLISH_TOKEN',type:'secret_text',text:capability},
  {name:'EXPIRES_AT',type:'plain_text',text:String(expires)},
 ],modules:[
  {name:'bridge.mjs',content_type:'application/javascript+module',content_base64:source.toString('base64')},
  {name:'manifest.mjs',content_type:'application/javascript+module',content_base64:manifest.toString('base64')},
 ],annotations:{'workers/message':'Temporary scoped Dubai IDrive E2 upload preview; no production traffic or source bindings'}};
 await fs.mkdir(STATE,{recursive:true,mode:0o700});
 const attempt=path.join(STATE,'map-upload-attempt.json');
 await writePrivate(attempt,{status:'creation_requested',startedAt:new Date().toISOString(),worker:WORKER,productionVersion:PRODUCTION_VERSION,sourceSha256:offline.sourceSha256,manifestSha256:offline.manifestSha256});
 const created=await api(token,`/accounts/${ACCOUNT}/workers/workers/${WORKER}/versions?deploy=false`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
 if(!/^[a-f0-9-]{36}$/.test(created?.id||''))throw Error('Preview creation returned no version ID; inspect Cloudflare before retrying');
 await writePrivate(attempt,{status:'created',version:created.id,startedAt:new Date().toISOString(),worker:WORKER,productionVersion:PRODUCTION_VERSION});
 const url=new URL(created.urls?.[0]||'');
 if(url.protocol!=='https:'||!url.hostname.endsWith('.workers.dev')||url.username||url.password||url.search||url.hash||!['','/'].includes(url.pathname))throw Error('Preview origin invalid; exact version is in map-upload-attempt.json');
 const after=pinned(await api(token,deploymentPath));
 if(JSON.stringify(after)!==JSON.stringify(before))throw Error('Production deployment changed during staging');
 const access={base:url.origin,version:created.id,token:capability,expiresAt:new Date(expires).toISOString(),prefix:PREFIX,planSha256:hash(await fs.readFile(PLAN))};
 await writePrivate(previous,access);
 const result={...offline,version:created.id,previewOrigin:url.origin,expiresAt:access.expiresAt,productionUnchanged:true,status:'ready'};
 await writePrivate(path.join(STATE,'map-upload-stage.json'),result);
 return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 if(args.some(x=>x!=='--stage')||args.length>1)throw Error('Use no argument for dry run or --stage to create an inactive preview');
 stage(args.includes('--stage')).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(JSON.stringify({status:'failed',error:String(error.message)}));process.exitCode=1;});
}
