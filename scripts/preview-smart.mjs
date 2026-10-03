import http from 'node:http';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const {default:worker}=await import('../src/worker.js?preview='+Date.now());
const root=new URL('../',import.meta.url), snapshot=await fs.readFile(new URL('data/smart-estimates-20260930.json',root));
const etag='"'+createHash('sha256').update(snapshot).digest('hex')+'"',cache=new Map(),objects=new Map();
try{
 const manifest=JSON.parse(await fs.readFile(new URL('data/historical-intelligence/publication-manifest.json',root),'utf8'));
 for(const object of manifest.objects||[])if(/^data\/historical-intelligence\/objects\/[a-f0-9]{64}\.(?:json|csv)\.gz$/.test(object.path))objects.set(object.key,object);
}catch(error){console.warn('Historical snapshot objects unavailable:',error.code||error.message);}
const paths=new Set(['/map','/map/app-v2.js','/map/app-v2.css','/map/api/value-drivers','/map/api/events','/map/api/record-history','/map/api/event-studies','/map/api/smart-estimates','/map/api/system','/map/system','/map/api/smart-estimates/sources']);
const environment={DATA_ROOM_PUBLIC:'false',MARKET_R2:{get:async key=>{
 if(key==='research/published/2026-09-30/smart-estimates-v1/scenarios.json')return{body:snapshot,httpEtag:etag};
 const object=objects.get(key);if(!object)return null;
 const bytes=await fs.readFile(new URL(object.path,root));
 if(createHash('sha256').update(bytes).digest('hex')!==object.sha256)throw Error('Local snapshot checksum mismatch');
 return{body:bytes,httpEtag:'"'+object.sha256+'"',arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
}}};
http.createServer(async(req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{allow:'GET, HEAD'});res.end();return;}
  const url=new URL(req.url,'https://espacios.me'),path=url.pathname.replace(/\/+$/,'')||'/';let response;
  if(paths.has(path))response=await worker.fetch(new Request(url,{method:req.method,headers:req.headers}),environment,{waitUntil:p=>p.catch(()=>{})});
  else{
   if(!cache.has(url.href))cache.set(url.href,fetch(url,{redirect:'error'}).then(async r=>({bytes:Buffer.from(await r.arrayBuffer()),status:r.status,headers:Object.fromEntries(r.headers)})));
   const c=await cache.get(url.href);response=new Response(c.bytes,{status:c.status,headers:c.headers});
  }
  const headers=Object.fromEntries(response.headers);delete headers['content-encoding'];delete headers['content-length'];headers['cache-control']='no-store';
  res.writeHead(response.status,headers);res.end(req.method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer()));
 }catch(error){console.error(error.message);res.writeHead(502);res.end('Local preview resource unavailable');}
}).listen(8798,'127.0.0.1',()=>console.log('Read-only preview http://localhost:8798/map; '+objects.size+' local immutable historical objects'));
