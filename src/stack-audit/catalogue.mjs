/** Fetch all declared pages and fail closed on a missing/malformed page.
 * Upstream reported totals can include duplicates; registry total defines the
 * population only when it matches the retrieved IDs. A stale registry mismatch
 * is reported separately from complete retrieval of all declared pages. */
export async function mapCompleteProjects(request,env,ctx){
 const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public,max-age=60,s-maxage=300':'no-store','x-content-type-options':'nosniff','x-espacios-catalogue':'complete-pages-v2'}});
 if(!env.PSR_PROPERTY?.fetch)return json({error:'Project catalogue is temporarily unavailable.',projects:[],complete:false},503);
 const cache=globalThis.caches?.default,key=new Request(new URL('/map/api/projects-all?catalogue=20261102-complete-pages-v5',request.url),{method:'GET'});
 const cached=cache&&await cache.match(key);if(cached)return cached;
 const maximumFetchCalls=30;
 let failedPage=null,retriesRemaining=4,fetchCalls=0;const retriedPages=[];
 const call=async page=>{
  if(fetchCalls>=maximumFetchCalls)throw new Error('Catalogue read budget exceeded.');fetchCalls++;
  const response=await env.PSR_PROPERTY.fetch('https://psrhomes.ae/api/projects?limit=100'+(page>1?'&page='+page:''),{headers:{accept:'application/json','x-espacios-map-page-size':'100'}});
  if(!response.ok){failedPage=page;await response.body?.cancel().catch(()=>{});throw Object.assign(new Error('Upstream page unavailable.'),{retryable:response.status===429||response.status>=500});}
  const value=await response.json();if(!Array.isArray(value.projects)||value.projects.some(p=>!p||typeof p.slug!=='string'||!p.slug)){failedPage=page;throw new Error('Malformed project page.');}return value;
 };
 const readPage=async page=>{try{return await call(page);}catch(error){if(!error.retryable||retriesRemaining===0||fetchCalls>=maximumFetchCalls)throw error;retriesRemaining--;retriedPages.push(page);await new Promise(resolve=>setTimeout(resolve,100));return call(page);}};
 try{
  const first=await readPage(1),pages=first.pages===undefined?1:Number(first.pages);
  if(!Number.isInteger(pages)||pages<1||pages>maximumFetchCalls-retriesRemaining)throw new Error('Unsupported catalogue page count.');
  const all=[...first.projects];
  for(let page=2;page<=pages;page++){
   const row=await readPage(page);
   if(first.registry?.updatedAt&&row.registry?.updatedAt&&first.registry.updatedAt!==row.registry.updatedAt)throw new Error('Catalogue changed while paging.');
   all.push(...row.projects);
  }
  const projects=[...new Map(all.map(p=>[p.slug,p])).values()],reported=Number(first.total),registry=Number(first.registry?.total);
  const registryReconciled=Number.isFinite(registry)&&registry>=0?registry===projects.length:null;
  const response=json({projects,total:projects.length,pages,registry:first.registry||null,complete:true,completenessBasis:'Every declared page successfully retrieved; unique source-population completeness is separately reported.',coverage:{allDeclaredPagesRetrieved:true,retriedPages,fetchCalls,maximumFetchCalls,registryReconciled,populationReconciled:registryReconciled===true,upstreamTotalMatchesFetchedRows:Number.isFinite(reported)?reported===all.length:null,warning:registryReconciled===false?'The upstream registry total differs from retrieved unique slugs. The cause and true source population remain unestablished.':null},totals:{returned:projects.length,unique:projects.length,rowsFetched:all.length,duplicateRows:all.length-projects.length,upstreamReported:Number.isFinite(reported)?reported:null,registryReported:Number.isFinite(registry)?registry:null},population:'Unique project slugs retrieved from every declared upstream page; reported totals are retained separately and do not establish omitted identities.'});
  if(cache){const put=cache.put(key,response.clone());if(ctx?.waitUntil)ctx.waitUntil(put.catch(()=>{}));else await put.catch(()=>{});}return response;
 }catch{return json({error:'The complete project catalogue could not be verified. Please retry.',projects:[],complete:false,...(failedPage?{failedPage}:{})},503);}
}
