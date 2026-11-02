/* Full-stack audit fixes. Evidence stays on its approved V48 vintage. */
var MAP_STACK_RELEASE='20261102-map-stack-v7';
var MAP_STACK_ACCEPTED={version:'20261014-enrichment-v48',asOf:'2026-10-14',projects:1645,communities:215,records:1860,series:16872,historicalRows:633891};
var MAP_STACK_PREVIOUS_FETCH=worker_default.fetch;
psrAllProjectsService=mapCompleteProjects;
function mapStackJSON(request,payload,status=200){return new Response(request.method==='HEAD'?null:JSON.stringify(payload),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-espacios-map-release':MAP_STACK_RELEASE,'referrer-policy':'strict-origin-when-cross-origin','x-frame-options':'SAMEORIGIN','strict-transport-security':'max-age=86400',...(status===405?{allow:'GET, HEAD'}:{})}});}
function mapStackRelease(env){return{release:MAP_STACK_RELEASE,workerVersion:env.MAP_VERSION?.id||null,createdAt:env.MAP_VERSION?.timestamp||null,baseSourceCommit:typeof MAP_STACK_SOURCE_COMMIT==='string'?MAP_STACK_SOURCE_COMMIT:null,sourceState:'draft_github_pr_branch; generated artifact identified by Worker version',incorporatedVisualCommit:'03fecf08c',source:'deployed_artifact',data:MAP_STACK_ACCEPTED,storage:env.MAP_IDRIVE_READY==='true'&&env.MAP_EVIDENCE?'private_idrive_e2_with_immutable_recovery_fallback':env.MAP_ARCHIVE?'immutable_static_recovery; idrive_pending_verified_endpoint':env.MAP_EVIDENCE?'private_idrive_e2_not_yet_verified':env.MARKET_R2?'cloudflare_r2':'embedded_catalogue_fallback',storageHealth:'not_asserted_by_binding_presence',commercialForecastReady:false,recoveryState:'accepted_v48_recovered_with_documented_legacy_gaps',idrive:{bindingPresent:Boolean(env.MAP_EVIDENCE),endpointReady:env.MAP_IDRIVE_READY==='true',readVerified:env.MAP_IDRIVE_READY==='true'?null:false,status:env.MAP_IDRIVE_READY==='true'?'configured; verify actual reads':'pending_actual_s3_endpoint'},legacyGaps:['Original official-history bundle not restored; retained V48 native series are separate','Saved model capture is partial; no missing projections are reconstructed']};}
async function mapStackHealth(request,env){
 const storage=env.MARKET_R2,checks={};
 const keys={catalogue:MAP_RECOVERED_KEY,nativeHistoryIndex:MAP_NATIVE_INDEX_MANIFEST.key,conditionalScenarios:SE_R2_KEY,fullItemInventory:MAP_FULL_INVENTORY_MANIFEST.key};
 await Promise.all(Object.entries(keys).map(async([name,key])=>{try{checks[name]=Boolean(await storage?.head(key));}catch{checks[name]=false;}}));
 if(typeof HI_GET_DATA==='function')await HI_GET_DATA();
 const record=HI_DATA.records?.find(r=>r.id==='project:address-residences-zabeel-by-emaar-properties-in-zaabeel-dubai');
 try{checks.recordShard=Boolean(record?.recordPartition?.key&&await storage?.head(record.recordPartition.key));}catch{checks.recordShard=false;}
 const ok=Object.values(checks).every(Boolean);
 return mapStackJSON(request,{ok,mode:ok?'available_with_documented_legacy_gaps':'degraded',release:mapStackRelease(env),checks,legacyArchives:{originalOfficialArchive:'not_restored; V48 native library available',savedPredictionModels:'partial_public_page_only; 50_of_185_query_matches; no missing forecasts reconstructed'},note:'Storage presence probe only. Record and dataset acceptance is verified separately; no numerical forecast approval is implied.'},ok?200:503);
}
function mapStackHeaders(response){
 const headers=new Headers(response.headers);headers.set('x-espacios-map-release',MAP_STACK_RELEASE);headers.set('x-content-type-options','nosniff');headers.set('referrer-policy','strict-origin-when-cross-origin');headers.set('x-frame-options','SAMEORIGIN');headers.set('strict-transport-security','max-age=86400');
 if((headers.get('content-type')||'').includes('text/html'))headers.set('content-security-policy',"object-src 'none'; base-uri 'self'; frame-ancestors 'self'");
 return headers;
}
function mapStackHtml(html){
 for(const [id,label]of [['ai-question','Ask about the current map or selected place'],['compare-inventory-search','Find a project or published unit to compare']]){
  const pattern=new RegExp('<(?:input|textarea)\\b[^>]*\\bid=[\"\']'+id+'[\"\'][^>]*>','g');
  html=html.replace(pattern,tag=>/\baria-label(?:ledby)?=/.test(tag)?tag:tag.replace(/>$/,' aria-label="'+label+'">'));
 }
 return html;
}

var MAP_STACK_SYSTEM_PAYLOAD=esmSystemPayload;
esmSystemPayload=function(env){
 const payload=MAP_STACK_SYSTEM_PAYLOAD(env),release=mapStackRelease(env);
 payload.release=MAP_STACK_RELEASE;payload.currentRelease=release;
 payload.topology=payload.topology.map(row=>row.to==='MARKET_R2'?{...row,to:env.MAP_ARCHIVE?'MAP_ARCHIVE':env.MAP_IDRIVE_READY==='true'?'MAP_EVIDENCE':'MARKET_R2',via:env.MAP_ARCHIVE?'Private immutable recovery asset binding; raw paths denied':env.MAP_IDRIVE_READY==='true'?'Verified private IDrive E2 service':env.MARKET_R2?'R2 binding; verify read health':'Storage unavailable; reviewed embedded snapshot active'}:row);
 payload.source={repository:'https://github.com/gugmaae-prog/espacios',branch:'codex/map-full-stack-fixes-20261102',deploymentManifest:'wrangler.production.jsonc',baseSourceCommit:release.baseSourceCommit,sourceState:release.sourceState,deploymentSafety:'Current code identity comes from deployed version metadata. Historical external attestations are not a live health receipt.'};
 payload.storage={r2BindingAvailable:Boolean(env.MARKET_R2&&!env.MAP_ARCHIVE&&!env.MAP_EVIDENCE),mapFallbackActive:!env.MARKET_R2&&!env.MAP_ARCHIVE&&!env.MAP_EVIDENCE,provider:release.storage,healthEndpoint:'/map/api/health',availability:'Check data endpoints; binding presence does not establish healthy storage.'};
 payload.publicSurfaces.health='/map/api/health';return payload;
};
async function mapStackPreparedResponse(request,response){const headers=mapStackHeaders(response);if((headers.get('content-type')||'').includes('text/html')&&request.method!=='HEAD'){headers.delete('content-length');headers.delete('etag');return new Response(mapStackHtml(await response.text()),{status:response.status,headers});}return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});}
async function mapStackFullInventory(request,env){
 const spec=MAP_FULL_INVENTORY_MANIFEST,etag='"recovery-full-ledgers-'+spec.sha256+'"',headers=mapStackHeaders(new Response(null,{headers:{'content-type':'application/json; charset=utf-8','content-encoding':'gzip','cache-control':'public,max-age=60,s-maxage=300','etag':etag,'x-espacios-historical':MAP_STACK_ACCEPTED.version,'x-espacios-item-inventory-records':'1860','x-espacios-recovery-envelope-sha256':spec.sha256,'x-espacios-decoded-sha256':spec.decodedSHA256}}));
 if((request.headers.get('if-none-match')||'').split(',').map(v=>v.trim().replace(/^W\//,'')).includes(etag))return new Response(null,{status:304,headers});
 try{const meta=await env.MARKET_R2?.head(spec.key);if(!meta||meta.sha256!==spec.sha256||meta.size!==spec.bytes)throw Error('Unavailable');if(request.method==='HEAD')return new Response(null,{headers});const object=await env.MARKET_R2.get(spec.key);if(!object||object.sha256!==spec.sha256||!object.body)throw Error('Unavailable');return new Response(object.body,{headers,encodeBody:'manual'});}catch{return mapStackJSON(request,{error:'The complete retained item inventory is temporarily unavailable.',complete:false},503);}
}
worker_default.fetch=async function(request,env,ctx){
 const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'')||'/';
 // Preserve tenant exclusions before applying canonical or private preview fixes.
 if(path.startsWith('/__map_archive/'))return new Response('Not found',{status:404,headers:{'cache-control':'no-store','x-robots-tag':'noindex, nofollow'}});
 if(path==='/map/api/ai'&&url.hostname!=='espacios.me'&&!url.hostname.endsWith('.workers.dev'))return new Response('Not found',{status:404,headers:{'cache-control':'no-store','x-robots-tag':'noindex, nofollow'}});
 if(path==='/map/api/ai'){const response=await mapBoundedAI(request,env,ctx);return new Response(response.body,{status:response.status,headers:mapStackHeaders(response)});}
 if(url.hostname!=='espacios.me'&&!url.hostname.endsWith('.workers.dev'))return MAP_STACK_PREVIOUS_FETCH.call(this,request,env,ctx);
 if(path==='/map/api/value-drivers')return MAP_STACK_PREVIOUS_FETCH.call(this,request,env,ctx);
 const primary=env.MAP_EVIDENCE&&env.MAP_IDRIVE_READY==='true'?mapEvidenceStore(env.MAP_EVIDENCE):null;
 const store=env.MAP_ARCHIVE?mapArchiveFallback(primary,env.MAP_ARCHIVE,MAP_ARCHIVE_MANIFEST):primary;
 const bindings=store?{...env,MARKET_R2:store}:env;
 const delegatedRequest=url.hostname.endsWith('.workers.dev')?new Request(new URL(url.pathname+url.search,'https://espacios.me'),request):request;
 if(store&&path==='/map/api/record-history'&&url.searchParams.get('includeItemCoverage')==='1'&&!url.searchParams.get('recordId')&&['GET','HEAD'].includes(request.method))return mapStackFullInventory(request,bindings);
 const retainedHistory=await mapLegacyHistoryRoute(request,bindings,ctx);if(retainedHistory)return mapStackPreparedResponse(request,retainedHistory);
 const recoveredContext=await mapRecoveredContextRoute(request,bindings,ctx);if(recoveredContext)return mapStackPreparedResponse(request,recoveredContext);
 if(['GET','HEAD'].includes(request.method)&&['/map/map-core.json','/map/map-data.json','/map/api/uae-heatmap','/map/api/research'].includes(path)&&(env.MAP_EVIDENCE||env.MAP_ARCHIVE)){
  try{
   if(typeof HI_GET_DATA==='function')await HI_GET_DATA();
   const snapshot=await mapRecoveredSnapshot(bindings.MARKET_R2,HI_DATA);
   if(snapshot){
    const reviewed=HI_CORE.applyCatalogueRevisions(HI_CORE.applyCommunityCorrections(snapshot,typeof HI_MAP_CORRECTIONS==='undefined'?[]:HI_MAP_CORRECTIONS),typeof HI_CATALOGUE_REVISIONS==='undefined'?[]:HI_CATALOGUE_REVISIONS);
    if(path==='/map/map-core.json'||path==='/map/map-data.json'){
     const response=mapStackJSON(request,reviewed),headers=mapStackHeaders(response);headers.set('cache-control','public,max-age=60,s-maxage=300');headers.set('x-ae-data-source','recovered-accepted-public-response');headers.set('x-espacios-evidence-date',snapshot.meta?.exportedAt||'unknown');return new Response(response.body,{headers});
    }
    const catalogue=AR.build(reviewed,{projects:[]});catalogue.asOf=reviewed.meta?.exportedAt||null;catalogue.upstream={completeForAcceptedSnapshot:true,liveFeedIncluded:false,reason:'restored_accepted_public_snapshot',snapshotSHA256:MAP_RECOVERED_SHA256};catalogue.counts.snapshotProjects=reviewed.projects.length;catalogue.counts.liveProjects=0;
    if(path==='/map/api/research'){const response=mapStackJSON(request,catalogue),headers=mapStackHeaders(response);headers.set('cache-control','public,max-age=60,s-maxage=300');return new Response(response.body,{headers});}
    const fullKey='snapshots/current/map-data.json',text=JSON.stringify(reviewed),localStore={head:async key=>key===fullKey?{etag:MAP_RECOVERED_SHA256}:null,get:async key=>key===fullKey?{body:text,customMetadata:{source_etag:MAP_RECOVERED_SHA256},text:async()=>text}:null,put:async()=>undefined};
    const response=await aeUaeHeatmap(request,{...bindings,MARKET_R2:localStore,AE_EMERGENCY_CATALOGUE:catalogue},ctx);
    if(response.ok){const payload=await response.json();payload.sourceSnapshot={...payload.sourceSnapshot,basis:'Recovered accepted public catalogue response captured13October2026, SHA256 '+MAP_RECOVERED_SHA256+'. All1645 accepted project identities retained; coordinates are retained only where published. Live feed is not included. Authority phases may overlap marketing records; density counts records, not unique developments, transactions or prices.',recovery:reviewed.meta.recovery};payload.completeness={...payload.completeness,mode:'accepted_snapshot',acceptedProjectRecords:1645,availableProjectRecords:1645,liveFeedIncluded:false};const headers=mapStackHeaders(response);headers.set('cache-control','public,max-age=60,s-maxage=300');headers.set('x-ae-data-source','recovered-accepted-public-response');headers.delete('content-length');headers.delete('etag');return new Response(request.method==='HEAD'?null:JSON.stringify(payload),{headers});}
   }
  }catch(error){console.warn(JSON.stringify({event:'map_recovery_unavailable',reason:'accepted_snapshot_could_not_be_verified'}));}
 }

 if(['/map/api/control-plane','/map/api/system','/map/api/health'].includes(path)){
  if(!['GET','HEAD'].includes(request.method))return mapStackJSON(request,{error:'Read-only endpoint'},405);
  if(path==='/map/api/health')return mapStackHealth(request,bindings);
  const release=mapStackRelease(env);
  if(path==='/map/api/control-plane')return mapStackJSON(request,{connected:Boolean(env.MAP_VERSION?.id),release:MAP_STACK_RELEASE,authority:'Cloudflare deployed artifact',currentRelease:release,legacyControlPlane:{role:'historical_attestation_only',currentHealthAuthority:false},dataRoom:{public:String(env.DATA_ROOM_PUBLIC)==='true',route:'/map/data-room'}});
  const payload=esmSystemPayload(bindings);payload.source={repository:'https://github.com/gugmaae-prog/espacios',branch:'codex/map-full-stack-fixes-20261102',deploymentManifest:'wrangler.production.jsonc',baseSourceCommit:release.baseSourceCommit,sourceState:release.sourceState,reconciliation:'Version identified from deployed artifact; historical external attestations are not current runtime state.'};
  payload.currentRelease=release;delete payload.controlPlane;
  payload.publicSurfaces.health='/map/api/health';payload.smartEstimates={release:SE_RELEASE,route:'/map/api/smart-estimates',key:SE_R2_KEY,horizonsYears:[1,3,5,10],storage:release.storage,classification:'conditional_scenarios_not_validated_forecasts',originalHistoryPreserved:true};return mapStackJSON(request,payload);
 }
 let response;
 try{
  if(path==='/map/api/projects-all'&&['GET','HEAD'].includes(request.method))response=await mapCompleteProjects(request,bindings,ctx);
  else response=await MAP_STACK_PREVIOUS_FETCH.call(this,delegatedRequest,bindings,ctx);
  // A storage outage must preserve the reviewed map with its degraded labels.
  if(!response.ok&&['/map/map-core.json','/map/map-data.json','/map/api/uae-heatmap'].includes(path)&&env.MAP_EVIDENCE)response=await MAP_STACK_PREVIOUS_FETCH.call(this,delegatedRequest,{...env,MARKET_R2:undefined,MAP_EVIDENCE:undefined},ctx);
 }catch{
  response=mapStackJSON(request,{error:'This map resource is temporarily unavailable. Please retry.',release:MAP_STACK_RELEASE},503);
 }
 const headers=mapStackHeaders(response),type=headers.get('content-type')||'';
 if(path==='/map/api/uae-heatmap'&&response.ok&&headers.has('x-ae-data-degraded')){
  const payload=await response.json();payload.sourceSnapshot={...payload.sourceSnapshot,basis:'Degraded mode: reviewed 1,337-project catalogue snapshot only. Live additions and the accepted Abu Dhabi authority additions are unavailable. Counts describe source records, not unique developments or transactions.'};
  payload.completeness={...payload.completeness,mode:'degraded_snapshot',acceptedProjectRecords:1645,availableProjectRecords:1337,missingAuthorityRecordIdentities:308,missingIdentityEmirate:'Abu Dhabi',limitation:'The 308 absent authority identities are catalogue records; this does not claim all had verified map coordinates.'};
  headers.delete('content-length');headers.delete('etag');headers.set('cache-control','public,max-age=60,s-maxage=300');return new Response(request.method==='HEAD'?null:JSON.stringify(payload),{status:response.status,headers});
 }

 if(path.startsWith('/map/api/')&&response.status>=400&&type.includes('application/json')){
  // Keep public availability errors useful without exposing internal exceptions.
  const status=response.status;let body;try{body=await response.json();}catch{body={error:'Map data is temporarily unavailable.'};}delete body.message;delete body.detail;
  headers.set('cache-control','no-store');headers.delete('content-length');return new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers});
 }
 if(type.includes('text/html')&&request.method!=='HEAD'){
  const html=mapStackHtml(await response.text());headers.delete('content-length');headers.delete('etag');return new Response(html,{status:response.status,headers});
 }
 return new Response(request.method==='HEAD'||[204,205,304].includes(response.status)?null:response.body,{status:response.status,headers});
};
