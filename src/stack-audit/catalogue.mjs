/** Fetch all declared pages and fail closed on a missing/malformed page.
 * Upstream reported totals can include duplicates; registry total defines the
 * population only when it matches the retrieved IDs. A stale registry mismatch
 * is reported separately from complete retrieval of all declared pages. */
export async function mapCompleteProjects(request,env,ctx){
 const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public,max-age=60,s-maxage=300':'no-store','x-content-type-options':'nosniff','x-espacios-catalogue':'complete-pages-v2'}});
 // The Espacios Data Hub is the newer source. An exact older public snapshot
 // remains labelled and available when the newer hub is temporarily unavailable.
 const upstreamFetch=env.MAP_CATALOGUE_FETCH?.fetch?.bind(env.MAP_CATALOGUE_FETCH)||fetch;
 const cache=globalThis.caches?.default,key=new Request(new URL('/map/api/projects-all?catalogue=20261103-data-hub-v12-reconciled-v8',request.url),{method:'GET'});
 const cached=cache&&await cache.match(key);
 if(cached){
  try{
   const saved=await cached.clone().json();
   if(saved?.degraded===true)return cached;
   if(saved?.degraded===false&&saved?.complete===true&&saved?.coverage?.allDeclaredPagesRetrieved===true){
    return new Response(JSON.stringify({...saved,degraded:true,completeForCurrentDataHub:false,source:{...saved.source,service:'cached-verified-psr-data-hub-response',degraded:true,degradedReason:'Previously verified Data Hub pages were served from map cache; current live D1 availability was not checked.'},completenessBasis:'Previously verified Data Hub pages served from map cache. Current live D1 availability is not confirmed by this response.',coverage:{...saved.coverage,warning:'Previously verified Data Hub pages served from map cache; current live D1 availability is unconfirmed.'}}),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-espacios-catalogue':'verified-live-cache-degraded-v1'}});
   }
  }catch{ /* A malformed cache entry must not hide the source. */ }
 }
 const maximumFetchCalls=30;
 let failedPage=null,retriesRemaining=4,fetchCalls=0;const retriedPages=[];
 const call=async page=>{
  if(fetchCalls>=maximumFetchCalls)throw new Error('Catalogue read budget exceeded.');fetchCalls++;
  const response=await upstreamFetch('https://espacios.me/data/api/v1/projects?tenant=psr&limit=100'+(page>1?'&page='+page:''),{headers:{accept:'application/json'}});
  if(!response.ok){failedPage=page;await response.body?.cancel().catch(()=>{});throw Object.assign(new Error('Upstream page unavailable.'),{retryable:response.status===429||response.status>=500});}
  const value=await response.json();if(!Array.isArray(value.projects)||value.projects.some(p=>!p||typeof p.slug!=='string'||!p.slug)||(value.pageSize!==undefined&&value.pageSize!==100)||(value.page!==undefined&&value.page!==page)||value.projects.length>100){failedPage=page;throw new Error('Malformed project page.');}
  return {...value,dataHubRelease:response.headers.get('x-espacios-data-release'),publisherRelease:response.headers.get('x-espacios-publisher-release')};
 };
 async function d1ExportFallback(){
  const snapshot=env.MAP_CATALOGUE_D1_SNAPSHOT||(typeof MAP_PSR_D1_EXPORT_SNAPSHOT!=='undefined'?MAP_PSR_D1_EXPORT_SNAPSHOT:null);
  if(!snapshot?.base64||snapshot.classified!=='exported_public_registry_snapshot_not_live_api_response')throw Error('Reviewed D1 public export unavailable');
  const packed=atob(snapshot.base64),compressed=new Uint8Array(packed.length);
  for(let i=0;i<packed.length;i++)compressed[i]=packed.charCodeAt(i);
  const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
  if(compressed.byteLength!==snapshot.compressedBytes||await sha(compressed)!==snapshot.compressedSha256)throw Error('PSR D1 export checksum mismatch');
  const raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if(raw.byteLength!==snapshot.rawBytes||await sha(raw)!==snapshot.rawSha256)throw Error('PSR D1 decoded checksum mismatch');
  const saved=JSON.parse(new TextDecoder().decode(raw)),projects=saved.projects,registry=saved.registry;
  if(!Array.isArray(projects)||projects.length!==snapshot.rows||new Set(projects.map(p=>p?.slug)).size!==snapshot.uniqueSlugs||projects.some(p=>typeof p.slug!=='string'||!p.slug||!p.href?.startsWith('/projects/')||p.revision!==snapshot.registry.revision)||registry?.total!==snapshot.registry.total||registry?.revision!==snapshot.registry.revision||registry?.updatedAt!==snapshot.registry.updatedAt||registry?.contentHash!==snapshot.registry.contentHash)throw Error('PSR D1 export population mismatch');
  const body={projects,total:projects.length,pages:Math.ceil(projects.length/100),registry,source:{service:'reviewed-psr-d1-public-export',population:'PSR public project registry',databaseBookmark:snapshot.bookmark,registryUpdatedAt:registry.updatedAt,registryContentHash:registry.contentHash,snapshotExportedAt:snapshot.exportedAt,snapshotSHA256:snapshot.rawSha256,dataHubRelease:'espacios-data-hub-v6-developer-registry',degraded:true,degradedReason:'The live Data Hub could not read D1. This is a reviewed export of its published PSR rows, not a live API response.'},complete:true,completeForCurrentDataHub:false,degraded:true,completenessBasis:'The reviewed D1 export has all 1,091 published PSR rows and unique slugs, matching the registry count at the same database bookmark. Its registry content hash was not reproduced from the exported rows; live API completeness remains unverified.',coverage:{allDeclaredPagesRetrieved:false,retriedPages,fetchCalls,maximumFetchCalls,registryReconciled:true,registryHashReconciled:false,populationReconciled:true,upstreamTotalMatchesFetchedRows:null,warning:'Snapshot of D1 published rows updated 27 September 2026 and exported 2 November 2026. The recorded registry content hash was not independently reproduced. This is not a current live-feed or complete UAE census.'},totals:{returned:projects.length,unique:projects.length,rowsFetched:projects.length,duplicateRows:0,upstreamReported:null,registryReported:registry.total},population:'Reviewed PSR D1 export; separate from accepted V48 map identities and not a full UAE project census.'};
  const response=new Response(JSON.stringify(body),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'public,max-age=60,s-maxage=60','x-content-type-options':'nosniff','x-espacios-catalogue':'reviewed-d1-export-degraded-v1'}});
  if(cache){const put=cache.put(key,response.clone());if(ctx?.waitUntil)ctx.waitUntil(put.catch(()=>{}));else await put.catch(()=>{});}return response;
 }
 async function legacyFallback(){
  const snapshot=env.MAP_CATALOGUE_SNAPSHOT||(typeof MAP_PSR_LEGACY_SNAPSHOT!=='undefined'?MAP_PSR_LEGACY_SNAPSHOT:null);
  if(!snapshot?.base64)throw Error('Reviewed PSR snapshot unavailable');
  const packed=atob(snapshot.base64),compressed=new Uint8Array(packed.length);
  for(let i=0;i<packed.length;i++)compressed[i]=packed.charCodeAt(i);
  const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
  if(compressed.byteLength!==snapshot.compressedBytes||await sha(compressed)!==snapshot.compressedSha256)throw Error('PSR snapshot checksum mismatch');
  const raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if(raw.byteLength!==snapshot.rawBytes||await sha(raw)!==snapshot.rawSha256)throw Error('PSR decoded checksum mismatch');
  const saved=JSON.parse(new TextDecoder().decode(raw)),projects=saved.projects;
  if(!Array.isArray(projects)||projects.length!==snapshot.uniqueProjectSlugs||new Set(projects.map(p=>p?.slug)).size!==projects.length||projects.some(p=>typeof p.slug!=='string'||!p.slug)||saved.registry?.total!==snapshot.registryReportedTotal||saved.registry?.updatedAt!==snapshot.registryUpdatedAt||saved.total!==snapshot.upstreamReportedTotalAtCapture)throw Error('PSR snapshot population mismatch');
  const body={projects,total:projects.length,pages:saved.pages,registry:saved.registry,source:{service:'reviewed-older-psr-public-snapshot',url:snapshot.source,population:'PSR public project registry snapshot',registryUpdatedAt:snapshot.registryUpdatedAt,registryContentHash:null,snapshotSHA256:snapshot.rawSha256,capturedFileModifiedAt:snapshot.capturedFileModifiedAt,degraded:true,degradedReason:'Espacios Data Hub first page could not be verified; exact older archived public response used.'},complete:true,completeForCurrentDataHub:false,degraded:true,completenessBasis:'The exact reviewed response contains 1,073 unique slugs matching its recorded registry total. It does not prove the current Data Hub population.',coverage:{allDeclaredPagesRetrieved:false,retriedPages,fetchCalls,maximumFetchCalls,registryReconciled:true,populationReconciled:true,upstreamTotalMatchesFetchedRows:false,warning:snapshot.limits},totals:{returned:projects.length,unique:projects.length,rowsFetched:projects.length,duplicateRows:0,upstreamReported:snapshot.upstreamReportedTotalAtCapture,registryReported:snapshot.registryReportedTotal},population:'Older reviewed PSR snapshot; distinct from the accepted V48 map identity universe and not a current UAE census.'};
  const response=new Response(JSON.stringify(body),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'public,max-age=60,s-maxage=60','x-content-type-options':'nosniff','x-espacios-catalogue':'reviewed-snapshot-degraded-v1'}});
  if(cache){const put=cache.put(key,response.clone());if(ctx?.waitUntil)ctx.waitUntil(put.catch(()=>{}));else await put.catch(()=>{});}return response;
 }
 const readPage=async page=>{try{return await call(page);}catch(error){failedPage=page;if(!error.retryable||retriesRemaining===0||fetchCalls>=maximumFetchCalls)throw error;retriesRemaining--;retriedPages.push(page);await new Promise(resolve=>setTimeout(resolve,100));return call(page);}};
 try{
  const first=await readPage(1),pages=first.pages===undefined?1:Number(first.pages);
  const snapshotPage=page=>page.source?.service==='reviewed-psr-d1-public-export'||page.source?.service==='reviewed-older-psr-public-snapshot';
  const firstSnapshot=snapshotPage(first);
  let upstreamDegraded=first.source?.degraded===true||first.source?.completeForCurrentDataHub===false;
  if(!Number.isInteger(pages)||pages<1||pages>maximumFetchCalls-retriesRemaining)throw new Error('Unsupported catalogue page count.');
  const all=[...first.projects];
  for(let page=2;page<=pages;page++){
   const row=await readPage(page);
   if(row.pages!==pages||row.total!==first.total||first.registry?.updatedAt!==row.registry?.updatedAt||first.registry?.contentHash!==row.registry?.contentHash||first.registry?.total!==row.registry?.total||(first.dataHubRelease&&row.dataHubRelease&&first.dataHubRelease!==row.dataHubRelease)||(first.publisherRelease&&row.publisherRelease&&first.publisherRelease!==row.publisherRelease)||snapshotPage(row)!==firstSnapshot||(firstSnapshot&&(row.source?.service!==first.source?.service||row.source?.sha256!==first.source?.sha256)))throw new Error('Catalogue changed while paging.');
   upstreamDegraded ||= row.source?.degraded===true||row.source?.completeForCurrentDataHub===false;
   all.push(...row.projects);
  }
  const projects=[...new Map(all.map(p=>[p.slug,p])).values()],reported=Number(first.total),registry=Number(first.registry?.total);
  const registryReconciled=Number.isFinite(registry)&&registry>=0?registry===projects.length:null;
  const degradedKind=firstSnapshot?'reviewed snapshot':'cached or degraded page';
  const response=json({projects,total:projects.length,pages,registry:first.registry||null,source:{service:upstreamDegraded?firstSnapshot?first.source?.service:'espacios-data-hub-degraded-pages':'espacios-data-hub-public-route',url:'https://espacios.me/data/api/v1/projects?tenant=psr',population:'PSR public project registry',registryUpdatedAt:first.registry?.updatedAt||null,registryContentHash:first.registry?.contentHash||null,dataRelease:first.dataHubRelease||null,publisherRelease:first.publisherRelease||null,...(upstreamDegraded?{upstreamSource:firstSnapshot?first.source:{service:'cached-or-degraded-data-hub-page'},degraded:true}:{})},complete:true,completeForCurrentDataHub:!upstreamDegraded,degraded:upstreamDegraded,completenessBasis:upstreamDegraded?`Every declared page was retrieved, but at least one was a ${degradedKind}. Current live D1 completeness remains unverified.`:'Every declared page from the Espacios data hub was retrieved; this PSR registry is a separate population from the accepted V48 map archive.',coverage:{allDeclaredPagesRetrieved:true,retriedPages,fetchCalls,maximumFetchCalls,registryReconciled,registryHashReconciled:upstreamDegraded?firstSnapshot?first.source?.registryHashReconciled??null:null:null,populationReconciled:registryReconciled===true,upstreamTotalMatchesFetchedRows:Number.isFinite(reported)?reported===all.length:null,warning:upstreamDegraded?`At least one Data Hub page was a ${degradedKind}; current live D1 completeness remains unverified.`:registryReconciled===false?'The upstream registry total differs from retrieved unique slugs. The cause and true source population remain unestablished.':null},totals:{returned:projects.length,unique:projects.length,rowsFetched:all.length,duplicateRows:all.length-projects.length,upstreamReported:Number.isFinite(reported)?reported:null,registryReported:Number.isFinite(registry)?registry:null},population:'Unique PSR project slugs retrieved from every declared data-hub page; this is not the V48 map identity universe or a complete current UAE project census.'});
  if(cache){const put=cache.put(key,response.clone());if(ctx?.waitUntil)ctx.waitUntil(put.catch(()=>{}));else await put.catch(()=>{});}return response;
 }catch{try{return await d1ExportFallback();}catch(error){console.error('PSR D1 export fallback unavailable',error);}try{return await legacyFallback();}catch(error){console.error('PSR reviewed snapshot fallback unavailable',error);}return json({error:'The complete project catalogue could not be verified. Please retry.',projects:[],complete:false,...(failedPage?{failedPage}:{})},503);}
}
