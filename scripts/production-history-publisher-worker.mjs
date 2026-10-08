// Ephemeral, authenticated release bridge. It has no public routes and expires.
const columns={hi_snapshots:['snapshot_version','as_of','record_count','manifest_json','root_sha256'],hi_records:['snapshot_version','record_id','record_type','name','emirate','record_json'],hi_sources:['snapshot_version','source_id','url','source_json'],hi_events:['snapshot_version','event_id','event_json'],hi_exposures:['snapshot_version','exposure_id','event_id','record_id','scope','verified','exposure_json'],hi_series:['snapshot_version','series_id','source_id','series_json'],hi_record_series:['snapshot_version','record_id','series_id','scope','identity_verified']};
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export function validateStatement(item,env){
 if(!item||typeof item.sql!=='string'||!Array.isArray(item.params)||item.params[0]!==env.PUBLISH_VERSION)throw new Error('Snapshot scope mismatch');
 const header='SELECT root_sha256, publication_state FROM hi_snapshots WHERE snapshot_version = ?';
 if(item.sql===header&&item.params.length===1)return item;
 if(item.sql==="UPDATE hi_snapshots SET publication_state = 'complete' WHERE snapshot_version = ? AND root_sha256 = ?"&&item.params.length===2&&item.params[1]===env.PUBLISH_ROOT)return item;
 for(const [table,list] of Object.entries(columns)){
  if(item.sql===`SELECT count(*) AS count FROM ${table} WHERE snapshot_version = ?`&&item.params.length===1)return item;
  if(item.sql===`INSERT OR IGNORE INTO ${table}(${list.join(',')}) VALUES(${list.map(()=>'?').join(',')});`&&item.params.length===list.length){
   if(table==='hi_snapshots'&&item.params[4]!==env.PUBLISH_ROOT)throw new Error('Root mismatch');
   if(item.params.some(x=>typeof x!=='string'&&(!Number.isSafeInteger(x))))throw new Error('Unsupported parameter type');
   return item;
  }
 }
 throw new Error('Statement not allowed');
}
export default{async fetch(request,env){
 if(!env.PUBLISH_TOKEN||!Number.isFinite(Date.parse(env.PUBLISH_EXPIRES))||Date.now()>=Date.parse(env.PUBLISH_EXPIRES)||request.headers.get('Authorization')!==`Bearer ${env.PUBLISH_TOKEN}`)return json({error:'Unauthorized or expired'},401);
 const url=new URL(request.url);
 try{
  if(url.pathname==='/health'&&request.method==='GET')return json({version:env.PUBLISH_VERSION,rootSHA256:env.PUBLISH_ROOT});
  if(url.pathname==='/r2'||url.pathname==='/r2-check'){
   const key=url.searchParams.get('key'),match=/^research\/published\/\d{4}-\d{2}-\d{2}\/historical-intelligence\/objects\/([a-f0-9]{64})\.(?:json(?:\.gz)?|csv\.gz|sql\.gz|parquet)$/.exec(key||'');
   if(!match)return json({error:'Content addressed key required'},400);
   if(request.method==='GET'){
    const object=await env.MARKET_R2.get(key);if(!object)return new Response(null,{status:404});
    if(object.size>32*1024*1024)return json({error:'Object too large'},413);
    const bytes=await object.arrayBuffer();
    if(url.pathname==='/r2-check')return json({bytes:bytes.byteLength,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('')});
    return new Response(bytes,{headers:{'Content-Type':'application/octet-stream','Content-Length':String(bytes.byteLength),'Cache-Control':'no-store'}});
   }
   if(request.method==='PUT'&&url.pathname==='/r2'){
    if(request.headers.get('X-Snapshot-Version')!==env.PUBLISH_VERSION||request.headers.get('X-Content-SHA256')!==match[1])return json({error:'Snapshot/hash mismatch'},400);
    const bytes=await request.arrayBuffer();if(bytes.byteLength>32*1024*1024)return json({error:'Object too large'},413);
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
    if(digest!==match[1])return json({error:'Hash mismatch'},400);
    const result=await env.MARKET_R2.put(key,bytes,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/octet-stream'},customMetadata:{sha256:digest,snapshotVersion:env.PUBLISH_VERSION}});
    return json({created:!!result,sha256:digest});
   }
  }
  if(url.pathname==='/d1'&&request.method==='POST'){
   const body=await request.json();if(!Array.isArray(body.statements)||body.statements.length<1||body.statements.length>50)return json({error:'Bounded batch required'},400);
   const statements=body.statements.map(item=>validateStatement(item,env)).map(item=>env.DB.prepare(item.sql).bind(...item.params));
   if(body.mode==='first'&&statements.length===1)return json({result:await statements[0].first()});
   if(body.mode==='run'&&statements.length===1)return json({result:await statements[0].run()});
   if(body.mode==='batch')return json({result:await env.DB.batch(statements)});
  }
  return json({error:'Not found'},404);
 }catch(error){
  const message=String(error?.message||error);
  const transient=/internal error|please try again|temporarily unavailable|timed? out|overloaded/i.test(message);
  return json({error:message},transient?503:400);
 }
}};
