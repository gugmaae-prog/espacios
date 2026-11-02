// BEGIN SCOPED IDRIVE CUTOVER: existing application and quota export remain intact.
const MAP_IDRIVE_CUTOVER_BASE = {version:"0f9c228d-a463-40bb-8263-85a995580d96", moduleSHA256:"7b62e8d614bb9a552bf17e1e7d2ddfaa6565950a451ab7f0c7cfd9075c1ae493"};
const MAP_IDRIVE_EXPECTED_MANIFEST = '7b3d9aa40cc8df795f6036f98f5a8c97d99e1d3ec26def3b9fa75b477c6fc642';
const MAP_IDRIVE_PROOF_OBJECT = {"key":"research/published/2026-10-14/historical-intelligence/objects/1847fa61272c2ce5debe330ff3e605b0edd151fe09ff507ebb889d39221cf291.json.gz","path":"/__map_archive/1847fa61272c2ce5debe330ff3e605b0edd151fe09ff507ebb889d39221cf291.bin","bytes":8725,"sha256":"1847fa61272c2ce5debe330ff3e605b0edd151fe09ff507ebb889d39221cf291"};
function mapIdriveReadbackAttestation(env) {
  const digest=String(env.MAP_IDRIVE_VERIFIED_MANIFEST_SHA256||''),stamp=String(env.MAP_IDRIVE_VERIFIED_AT||''),time=Date.parse(stamp);
  const timestampValid=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(stamp)&&Number.isFinite(time)&&time<=Date.now();
  return {valid:digest===MAP_IDRIVE_EXPECTED_MANIFEST&&timestampValid,manifestSHA256:/^[a-f0-9]{64}$/.test(digest)?digest:null,verifiedAt:timestampValid?stamp:null,expectedManifestSHA256:MAP_IDRIVE_EXPECTED_MANIFEST,logicalKeys:2717,sourceBytes:83710083,scope:'Attested publication readback; not a current availability assertion'};
}
function mapIdriveTraceRead(trace,method,origin) {if(trace)(method==='HEAD'?trace.heads:trace.reads)[origin]++;}
const MAP_IDRIVE_PREVIOUS_STORE=mapEvidenceStore;
mapEvidenceStore=function(service,trace){
  const original=MAP_IDRIVE_PREVIOUS_STORE(service);
  async function read(method,key){try{const found=await original[method==='HEAD'?'head':'get'](key);if(!found){if(trace)trace.primaryMisses++;return null;}mapIdriveTraceRead(trace,method,'idrive_e2');return {...found,storageSource:'idrive_e2'};}catch(error){if(trace)trace.primaryFailures++;throw error;}}
  return {get:key=>read('GET',key),head:key=>read('HEAD',key),put:(...args)=>original.put(...args)};
};
const MAP_IDRIVE_PREVIOUS_FALLBACK=mapArchiveFallback;
mapArchiveFallback=function(primary,assets,manifest,trace){
  const original=MAP_IDRIVE_PREVIOUS_FALLBACK(primary,assets,manifest);
  async function read(method,key){const found=await original[method==='HEAD'?'head':'get'](key);if(found?.storageSource==='immutable_static_recovery')mapIdriveTraceRead(trace,method,'immutable_static_recovery');return found;}
  return {get:key=>read('GET',key),head:key=>read('HEAD',key),put:(...args)=>original.put(...args)};
};
const MAP_IDRIVE_PREVIOUS_RELEASE=mapStackRelease;
mapStackRelease=function(env){
  const result=MAP_IDRIVE_PREVIOUS_RELEASE(env),attestation=mapIdriveReadbackAttestation(env),requested=(env.MAP_IDRIVE_REQUESTED_READY??env.MAP_IDRIVE_READY)==='true',enabled=env.MAP_IDRIVE_READY==='true'&&Boolean(env.MAP_EVIDENCE)&&attestation.valid;
  result.storage=enabled?'idrive_e2_primary_with_immutable_recovery_fallback':env.MAP_ARCHIVE?'immutable_static_recovery':result.storage;
  result.storagePolicy={primary:enabled?'idrive_e2':'immutable_static_recovery',fallback:env.MAP_ARCHIVE?'immutable_static_recovery':null};
  result.storageHealth='Configured policy and attested readback; current primary proof is separate';
  result.idrive={bindingPresent:Boolean(env.MAP_EVIDENCE),requestedForReads:requested,enabledForReads:enabled,endpointReady:enabled?null:false,readVerified:enabled?null:false,status:enabled?'primary_enabled_with_attested_readback':requested?'attestation_or_binding_invalid; immutable recovery retained':'primary_disabled',readbackAttestation:attestation,primaryReadProof:'/map/api/health?storage=idrive',immutableRecoveryProof:'/map/api/health?storage=immutable_recovery'};
  result.storageCutoverBase=MAP_IDRIVE_CUTOVER_BASE;return result;
};
const MAP_IDRIVE_PREVIOUS_SYSTEM=esmSystemPayload;
esmSystemPayload=function(env){
  const payload=MAP_IDRIVE_PREVIOUS_SYSTEM(env),release=mapStackRelease(env),enabled=release.idrive.enabledForReads;
  payload.currentRelease=release;payload.topology=payload.topology.map(row=>['MARKET_R2','MAP_ARCHIVE','MAP_EVIDENCE'].includes(row.to)?{...row,to:enabled?'MAP_EVIDENCE':env.MAP_ARCHIVE?'MAP_ARCHIVE':row.to,via:enabled?'Configured private IDrive E2 primary; immutable recovery fallback retained':env.MAP_ARCHIVE?'Immutable recovery binding; primary not enabled':env.MARKET_R2?'R2 binding; verify read health':'Storage unavailable; reviewed embedded snapshot active'}:row);
  payload.storage={...payload.storage,provider:release.storage,policy:release.storagePolicy,readbackAttestation:release.idrive.readbackAttestation,primaryReadProof:release.idrive.primaryReadProof};payload.publicSurfaces.idriveHealth=release.idrive.primaryReadProof;payload.publicSurfaces.immutableRecoveryHealth=release.idrive.immutableRecoveryProof;return payload;
};
function mapIdriveObservedOrigin(counts){return counts.idrive_e2&&counts.immutable_static_recovery?'mixed':counts.idrive_e2?'idrive_e2':counts.immutable_static_recovery?'immutable_static_recovery':'none_observed';}
function mapIdriveApplyEvidenceHeaders(response,trace,enabled){
  // Mutate headers without rebuilding the response: preserves manual gzip streams.
  try{response.headers.set('x-espacios-evidence-read-origin',mapIdriveObservedOrigin(trace.reads));response.headers.set('x-espacios-evidence-head-origin',mapIdriveObservedOrigin(trace.heads));response.headers.set('x-espacios-idrive-reads',String(trace.reads.idrive_e2));response.headers.set('x-espacios-static-recovery-reads',String(trace.reads.immutable_static_recovery));response.headers.set('x-espacios-idrive-read-failures',String(trace.primaryFailures));response.headers.set('x-espacios-evidence-primary-policy',enabled?'idrive_e2':'immutable_static_recovery');}catch{/* Never alter immutable response/body semantics only to add diagnostics. */}
  return response;
}
async function mapIdriveProofBytes(body,maximum){
  if(!body?.getReader)throw Error('Primary body unavailable');const reader=body.getReader(),chunks=[];let length=0;
  try{for(;;){const value=await reader.read();if(value.done)break;length+=value.value.byteLength;if(length>maximum){await reader.cancel();throw Error('Proof object exceeded bound');}chunks.push(value.value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
}
async function mapIdriveOnlyHealth(request,env,trace){
  const proof=MAP_IDRIVE_PROOF_OBJECT,attestation=mapIdriveReadbackAttestation(env),base={workerVersion:env.MAP_VERSION?.id||null,source:'idrive_e2',fallbackUsed:false,scope:'One bounded immutable proof object; not complete-store health',readbackAttestation:attestation,proof:{key:proof.key,bytes:proof.bytes,sha256:proof.sha256}};
  if(!['GET','HEAD'].includes(request.method))return mapStackJSON(request,{...base,ok:false,readVerified:false,error:'Read-only primary proof endpoint'},405);
  if(request.method==='HEAD')return mapStackJSON(request,{...base,ok:null,readVerified:null,note:'GET is required for a checksum-verified primary read'});
  if(!env.MAP_EVIDENCE)return mapStackJSON(request,{...base,ok:false,readVerified:false,error:'Primary binding unavailable'},503);
  try{
    // Deliberately bypass mapArchiveFallback: a static read cannot pass this test.
    const object=await mapEvidenceStore(env.MAP_EVIDENCE,trace).get(proof.key);if(!object||object.sha256!==proof.sha256){await object?.body?.cancel().catch(()=>{});throw Error('Primary object metadata mismatch');}
    const bytes=await mapIdriveProofBytes(object.body,proof.bytes);if(bytes.byteLength!==proof.bytes||await hiDigest(bytes)!==proof.sha256)throw Error('Primary object checksum mismatch');
    return mapStackJSON(request,{...base,ok:true,readVerified:true,verifiedAt:new Date().toISOString(),observedOrigin:'idrive_e2'});
  }catch{return mapStackJSON(request,{...base,ok:false,readVerified:false,error:'IDrive-only checksum read could not be verified'},503);}
}
async function mapImmutableRecoveryOnlyHealth(request,env,trace){
  const proof=MAP_IDRIVE_PROOF_OBJECT,base={workerVersion:env.MAP_VERSION?.id||null,source:'immutable_static_recovery',primaryBypassed:true,scope:'One bounded immutable proof object; not complete-store health',proof:{key:proof.key,bytes:proof.bytes,sha256:proof.sha256}};
  if(!['GET','HEAD'].includes(request.method))return mapStackJSON(request,{...base,ok:false,readVerified:false,error:'Read-only recovery proof endpoint'},405);
  if(request.method==='HEAD')return mapStackJSON(request,{...base,ok:null,readVerified:null,note:'GET is required for a checksum-verified recovery read'});
  if(!env.MAP_ARCHIVE)return mapStackJSON(request,{...base,ok:false,readVerified:false,error:'Recovery binding unavailable'},503);
  try{const response=await env.MAP_ARCHIVE.fetch(new Request('https://map-archive.internal'+proof.path,{headers:{accept:'application/octet-stream'}}));if(response.status!==200){await response.body?.cancel().catch(()=>{});throw Error('Recovery object unavailable');}mapIdriveTraceRead(trace,'GET','immutable_static_recovery');const bytes=await mapIdriveProofBytes(response.body,proof.bytes);if(bytes.byteLength!==proof.bytes||await hiDigest(bytes)!==proof.sha256)throw Error('Recovery object checksum mismatch');return mapStackJSON(request,{...base,ok:true,readVerified:true,verifiedAt:new Date().toISOString(),observedOrigin:'immutable_static_recovery'});}catch{return mapStackJSON(request,{...base,ok:false,readVerified:false,error:'Immutable-recovery-only checksum read could not be verified'},503);}
}
const MAP_IDRIVE_PREVIOUS_FETCH=worker_default.fetch;
worker_default.fetch=async function(request,env,ctx){
  const url=new URL(request.url);if(url.hostname!=='espacios.me'&&!url.hostname.endsWith('.workers.dev'))return MAP_IDRIVE_PREVIOUS_FETCH.call(this,request,env,ctx);
  // The public value-driver snapshot is binding-free. Keep that contract even
  // when callers deliberately supply an unreadable bindings proxy.
  if(url.pathname.replace(/\/+$/,'')==='/map/api/value-drivers')return MAP_IDRIVE_PREVIOUS_FETCH.call(this,request,env,ctx);
  const trace={reads:{idrive_e2:0,immutable_static_recovery:0},heads:{idrive_e2:0,immutable_static_recovery:0},primaryFailures:0,primaryMisses:0},attestation=mapIdriveReadbackAttestation(env),requested=env.MAP_IDRIVE_READY==='true',enabled=requested&&Boolean(env.MAP_EVIDENCE)&&attestation.valid;
  const bindings={...env,MAP_IDRIVE_REQUESTED_READY:requested?'true':'false',MAP_IDRIVE_READY:enabled?'true':'false',MAP_IDRIVE_TRACE:trace};
  const proofRequest=url.pathname.replace(/\/+$/,'')==='/map/api/health',storage=url.searchParams.get('storage');const response=proofRequest&&storage==='idrive'?await mapIdriveOnlyHealth(request,bindings,trace):proofRequest&&storage==='immutable_recovery'?await mapImmutableRecoveryOnlyHealth(request,bindings,trace):await MAP_IDRIVE_PREVIOUS_FETCH.call(this,request,bindings,ctx);
  try{response.headers.set('x-espacios-worker-version',env.MAP_VERSION?.id||'unknown');}catch{}return mapIdriveApplyEvidenceHeaders(response,trace,enabled);
};
// END SCOPED IDRIVE CUTOVER.
