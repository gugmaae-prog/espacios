/** Read-only compatibility adapter. Only the private evidence Worker decides
 * which already approved logical keys exist; callers never choose a bucket. */
export function mapEvidenceStore(service){
 async function read(key,method){
  if(typeof key!=='string'||!key||key.length>700||key.includes('..')||key.startsWith('/')||/[\x00-\x1f\\]/.test(key))throw new Error('Invalid evidence key.');
  const url=new URL('https://map-evidence.internal/object');url.searchParams.set('key',key);
  const response=await service.fetch(new Request(url,{method,headers:{accept:'application/octet-stream'}}));
  if(response.status===404)return null;
  if(!response.ok||response.status!==200)throw new Error('Evidence storage is temporarily unavailable.');
  const etag=response.headers.get('etag')||'',sha=response.headers.get('x-evidence-sha256')||etag.replace(/^W\//,'').replaceAll('"','');
  const meta={etag:etag.replaceAll('"',''),httpEtag:etag,sha256:sha,size:Number(response.headers.get('content-length'))||undefined,httpMetadata:{contentType:response.headers.get('content-type')||'application/octet-stream'},customMetadata:{source_etag:sha}};
  if(method==='HEAD')return meta;
  return{...meta,body:response.body,arrayBuffer:()=>response.arrayBuffer(),text:()=>response.text(),json:()=>response.json()};
 }
 return{get:key=>read(key,'GET'),head:key=>read(key,'HEAD'),
  // Legacy handlers may attempt to cache derived responses. The evidence
  // publication is immutable: cache writes do not reach the storage service.
  put:async()=>undefined};
}
/** Only allowlisted approved objects can reach the worker-only asset binding. */
export function mapArchiveFallback(primary,assets,manifest){
 async function read(key,method){
  if(primary){try{const found=await(method==='HEAD'?primary.head(key):primary.get(key));if(found)return found;}catch{/* Immutable recovery remains available during an IDrive outage. */}}
  if(!Object.hasOwn(manifest.entries,key))return null;const entry=manifest.entries[key];
  if(!assets?.fetch)return null;
  const response=await assets.fetch(new Request('https://map-archive.internal'+entry.path,{method,headers:{accept:'application/octet-stream'}}));
  if(response.status===404)return null;if(response.status!==200)throw new Error('Recovery archive is temporarily unavailable.');
  const meta={etag:entry.sha256,httpEtag:'"'+entry.sha256+'"',sha256:entry.sha256,size:entry.bytes,httpMetadata:{contentType:entry.contentType},customMetadata:{source_etag:entry.sha256},storageSource:'immutable_static_recovery'};
  if(method==='HEAD')return meta;
  return{...meta,body:response.body,arrayBuffer:()=>response.arrayBuffer(),text:()=>response.text(),json:()=>response.json()};
 }
 return{get:key=>read(key,'GET'),head:key=>read(key,'HEAD'),put:async()=>undefined};
}
