import fs from 'node:fs/promises';
import {validateProductionTarget} from '../publish-historical-snapshot.mjs';

const APPROVED_PUBLISHER_URLS=new Set([
 'https://espacios-history-publisher-20261005.thekeifferjapeth.workers.dev',
 'https://espacios-history-publisher-20261007-v18.thekeifferjapeth.workers.dev',
 'https://espacios-history-publisher-20261008-v22.thekeifferjapeth.workers.dev',
 'https://espacios-history-publisher-20261008-v24.thekeifferjapeth.workers.dev',
 'https://espacios-history-publisher-20261008-v25.thekeifferjapeth.workers.dev'
]);
export const isApprovedPublisherURL=url=>APPROVED_PUBLISHER_URLS.has(url);

export async function retryReleaseTransport(send,wait=ms=>new Promise(r=>setTimeout(r,ms))){
 for(let attempt=0;attempt<3;attempt++){
  try{
   const bytes=await send(),status=Number(bytes.subarray(-3).toString());
   if((status===429||status>=500)&&attempt<2){await wait(1000*2**attempt);continue;}
   return bytes;
  }catch(error){if(attempt===2)throw error;await wait(1000*2**attempt);}
 }
}

export async function sendReleaseRequest(url,options,send=fetch){
 // Node's HTTPS pool reuses verified connections across bounded publication
 // waves. Never follow redirects with the private bridge authorization.
 const response=await send(url,{...options,redirect:'error',signal:AbortSignal.timeout(120000)});
 const body=Buffer.from(await response.arrayBuffer());
 return Buffer.concat([body,Buffer.from('\n'+response.status)]);
}

export async function connectProduction({target,config,manifest}){
 validateProductionTarget(config,target,manifest);
 const url=target.publisherURL,headers=process.env.ESPACIOS_PUBLISH_HEADER_FILE;
 if(!isApprovedPublisherURL(url)||!headers)throw new Error('Explicit scoped release bridge and private header file required');
 const mode=(await fs.stat(headers)).mode;if((mode&0o077)!==0)throw new Error('Publisher header file must be private');
 const match=/^Authorization: (Bearer [^\s]+)$/.exec((await fs.readFile(headers,'utf8')).trim());
 if(!match)throw new Error('Private bridge authorization header has an invalid format');
 async function request(method,route,body,extra={}){
  // These bridge operations are immutable creation or version-scoped idempotent
  // indexing. Re-send the original bytes after a transient transport failure;
  // never reuse a partial response or weaken checksum/count validation.
  const bytes=await retryReleaseTransport(()=>sendReleaseRequest(url+route,{method,headers:{...extra,Authorization:match[1]},body}));
  const status=Number(bytes.subarray(-3).toString()),payload=bytes.subarray(0,-4);
  if(status===404&&method==='GET')return null;
  if(status<200||status>=300)throw new Error(`Release bridge ${method} ${route.split('?')[0]} failed (${status}): ${payload.toString().slice(0,300)}`);
  return payload;
 }
 const health=JSON.parse(await request('GET','/health'));if(health.version!==manifest.version||health.rootSHA256!==manifest.rootIndex.sha256)throw new Error('Release bridge authorized snapshot differs');
 const execute=async(mode,statements)=>JSON.parse(await request('POST','/d1',Buffer.from(JSON.stringify({mode,statements})),{'Content-Type':'application/json'})).result;
 class Statement{constructor(sql){this.sql=sql;this.params=[];}bind(...params){this.params=params;return this;}first(){return execute('first',[this]);}run(){return execute('run',[this]);}}
 return{r2:{async checksum(key){const bytes=await request('GET','/r2-check?key='+encodeURIComponent(key));return bytes===null?null:JSON.parse(bytes);},async get(key){const bytes=await request('GET','/r2?key='+encodeURIComponent(key));return bytes===null?null:{arrayBuffer:async()=>bytes};},async put(key,bytes,options){if(options?.onlyIf?.etagDoesNotMatch!=='*')throw new Error('Conditional immutable write required');const result=JSON.parse(await request('PUT','/r2?key='+encodeURIComponent(key),bytes,{'X-Snapshot-Version':manifest.version,'X-Content-SHA256':options.customMetadata.sha256}));return result.created?result:null;}},d1:{prepare:sql=>new Statement(sql),batch:statements=>execute('batch',statements)}};
}
