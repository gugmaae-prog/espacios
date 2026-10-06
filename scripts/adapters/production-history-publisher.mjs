import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {validateProductionTarget} from '../publish-historical-snapshot.mjs';

export async function connectProduction({target,config,manifest}){
 validateProductionTarget(config,target,manifest);
 const url=target.publisherURL,headers=process.env.ESPACIOS_PUBLISH_HEADER_FILE;
 const expected=process.env.ESPACIOS_PUBLISH_EXPECTED_URL;\n if(!expected||url!==expected||!/^https:\\/\\/espacios-history-publisher-[0-9]{8}\\.thekeifferjapeth\\.workers\\.dev$/.test(url)||!headers)throw new Error('Explicit scoped release bridge and private header file required');
 const mode=(await fs.stat(headers)).mode;if((mode&0o077)!==0)throw new Error('Publisher header file must be private');
 async function request(method,route,body,extra=[]){
  const args=['--silent','--show-error','--max-time','120','--request',method,'--header','@'+headers,'--write-out','\n%{http_code}',...extra];
  if(body!==undefined)args.push('--data-binary','@-');args.push(url+route);
  const bytes=await new Promise((resolve,reject)=>{const proc=spawn('curl',args,{stdio:['pipe','pipe','pipe']});const out=[],err=[];proc.stdout.on('data',x=>out.push(x));proc.stderr.on('data',x=>err.push(x));proc.on('error',reject);proc.on('close',code=>code?reject(new Error('Release transport failed: '+Buffer.concat(err).toString())):resolve(Buffer.concat(out)));proc.stdin.on('error',reject);proc.stdin.end(body);});
  const status=Number(bytes.subarray(-3).toString()),payload=bytes.subarray(0,-4);
  if(status===404&&method==='GET')return null;
  if(status<200||status>=300)throw new Error(`Release bridge ${method} ${route.split('?')[0]} failed (${status}): ${payload.toString().slice(0,300)}`);
  return payload;
 }
 const health=JSON.parse(await request('GET','/health'));if(health.version!==manifest.version||health.rootSHA256!==manifest.rootIndex.sha256)throw new Error('Release bridge authorized snapshot differs');
 const execute=async(mode,statements)=>JSON.parse(await request('POST','/d1',Buffer.from(JSON.stringify({mode,statements})),['--header','Content-Type: application/json'])).result;
 class Statement{constructor(sql){this.sql=sql;this.params=[];}bind(...params){this.params=params;return this;}first(){return execute('first',[this]);}run(){return execute('run',[this]);}}
 return{r2:{async get(key){const bytes=await request('GET','/r2?key='+encodeURIComponent(key));return bytes===null?null:{arrayBuffer:async()=>bytes};},async put(key,bytes,options){if(options?.onlyIf?.etagDoesNotMatch!=='*')throw new Error('Conditional immutable write required');const result=JSON.parse(await request('PUT','/r2?key='+encodeURIComponent(key),bytes,['--header','X-Snapshot-Version: '+manifest.version,'--header','X-Content-SHA256: '+options.customMetadata.sha256]));return result.created?result:null;}},d1:{prepare:sql=>new Statement(sql),batch:statements=>execute('batch',statements)}};
}
