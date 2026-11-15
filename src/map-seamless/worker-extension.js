/* Theme and outage continuity for the canonical Espacios Map pages. */
const MAP_SEAMLESS_RELEASE='20261102-map-seamless-v3';
const MAP_SEAMLESS_SOURCE_BRANCH='codex/map-seamless-v48-recovery-20261102';
const MAP_SEAMLESS_PAGES=new Map([
  ['/map/research','research'],['/map/history','history'],['/map/predictions','predictions'],
  ['/map/intelligence','intelligence'],['/map/abu-dhabi','abu-dhabi'],['/map/system','system']
]);
const mapSeamlessSystemPayload=esmSystemPayload;
esmSystemPayload=function(env){
  const result=mapSeamlessSystemPayload(env),available=Boolean(env.MARKET_R2);
  result.topology=result.topology.map(row=>row.to==='MARKET_R2'?{...row,via:available?'R2 binding':'R2 unavailable; reviewed map snapshot active'}:row);
  result.storage={r2BindingAvailable:available,mapFallbackActive:!available,source:available?'Cloudflare R2':'reviewed embedded snapshot',historyAvailability:available?'check-evidence-endpoints':'r2-unavailable'};
  result.source={...result.source,branch:MAP_SEAMLESS_SOURCE_BRANCH};
  return result;
};
const MAP_THEME_BOOT=`<script id="map-seamless-theme">(function(){var root=document.documentElement,key='espacios_theme_v1';function saved(){try{return localStorage.getItem(key)==='light'?'light':'dark'}catch{return 'dark'}}var initial=saved();root.dataset.espaciosTheme=initial;root.dataset.theme=initial;new MutationObserver(function(){var value=root.dataset.theme==='light'?'light':'dark';root.dataset.espaciosTheme=value;try{localStorage.setItem(key,value)}catch{}}).observe(root,{attributes:true,attributeFilter:['data-theme']});document.addEventListener('DOMContentLoaded',function(){var button=document.getElementById('map-theme-toggle');if(button)button.onclick=function(){root.dataset.theme=root.dataset.theme==='dark'?'light':'dark'}})})();<\/script>`;
function mapSeamlessHtml(html,page,storageAvailable){
  html=html.replace(/<html(\s|>)/,'<html data-map-page="'+page+'"'+(storageAvailable?'':' data-map-degraded="r2"')+'$1');
  html=html.replace('</head>','<style id="map-seamless-style">'+AE_MAP_SEAMLESS_CSS+'</style>'+MAP_THEME_BOOT+'</head>');
  if(!html.includes('id="theme"')&&!html.includes('id="map-theme-toggle"'))html=html.replace('</header>','<button id="map-theme-toggle" type="button" aria-label="Toggle light and dark theme">Theme</button></header>');
  if(!storageAvailable){
    const message=page==='research'?'Showing the reviewed 1,337-project catalogue snapshot. Live additions and R2-only research are temporarily unavailable.':page==='system'?'R2 is unavailable. The map is using its reviewed snapshot; historical storage endpoints remain unavailable.':'R2-backed evidence is temporarily unavailable. The retained V48 record history remains accessible.';
    html=html.replace('</header>','</header><div class="map-degraded-banner" role="status">'+message+' <a href="/map/api/record-history">V48 record history</a></div>');
    if(page==='history'){
      const status='R2-backed historical series are unavailable. The retained V48 record history is linked above.';
      html=html.replace('Loading the accepted data manifest…',status);
      html=html.replaceAll("Q('#error').textContent=e.message;","Q('#error').textContent='';Q('#status').textContent="+JSON.stringify(status)+";");
    }
  }
  if(page==='system')html=html.replace('<span>Branch</span><span>main</span>','<span>Source branch</span><span>'+MAP_SEAMLESS_SOURCE_BRANCH+'</span>');
  return html;
}
const MAP_SEAMLESS_PREVIOUS_FETCH=worker_default.fetch;
worker_default.fetch=async function(request,env,ctx){
  const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'')||'/',isCanonical=url.hostname==='espacios.me';
  const response=await MAP_SEAMLESS_PREVIOUS_FETCH.call(this,request,env,ctx);
  if(!isCanonical||!['GET','HEAD'].includes(request.method))return response;
  if(path==='/map/api/research'&&!response.ok&&!env.MARKET_R2){
    try{
      const snapshot=await aeEmergencyMapObject(),data=AR.build(snapshot,{projects:[]});
      data.asOf=snapshot.meta?.exportedAt||snapshot.meta?.sourceGeneratedAt||'2026-09-22';
      data.upstream={snapshotProjects:snapshot.projects.length,complete:false,reason:'r2-account-unavailable',liveProjectsIncluded:false};
      data.counts.snapshotProjects=snapshot.projects.length;data.counts.liveProjects=0;
      return new Response(request.method==='HEAD'?null:JSON.stringify(data),{status:200,headers:{'content-type':'application/json; charset=utf-8','cache-control':'public,max-age=60,s-maxage=300','x-content-type-options':'nosniff','x-ae-data-source':'embedded-reviewed-emergency-snapshot','x-ae-data-degraded':'r2-account-unavailable','x-espacios-seamless':MAP_SEAMLESS_RELEASE}});
    }catch(error){console.error(JSON.stringify({event:'research_snapshot_fallback_failed',error:String(error?.message||error)}));return response;}
  }
  if(path==='/map/abu-dhabi'&&!response.ok&&!env.MARKET_R2){
    const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Abu Dhabi evidence · Espacios</title></head><body><main><header><a href="/map">espacios</a><nav><a href="/map">Map</a><a href="/map/research">Research</a><a href="/map/history">History</a></nav></header><section class="panel"><span class="eyebrow">Evidence temporarily unavailable</span><h1>Abu Dhabi registry and valuation research</h1><p>The detailed source package is stored in R2, which is currently unavailable. The map catalogue remains usable and the retained V48 record history is available. No prices or registered sales are being reconstructed from the map snapshot.</p><p><a href="/map/api/record-history">Open retained V48 records</a></p></section></main></body></html>';
    return new Response(request.method==='HEAD'?null:mapSeamlessHtml(html,'abu-dhabi',false),{status:503,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-ae-data-degraded':'r2-account-unavailable','x-espacios-seamless':MAP_SEAMLESS_RELEASE}});
  }
  const page=MAP_SEAMLESS_PAGES.get(path);
  if(page&&response.ok&&(response.headers.get('content-type')||'').includes('text/html')){
    const headers=new Headers(response.headers);headers.delete('content-length');headers.delete('etag');headers.set('cache-control','no-store');headers.set('x-espacios-seamless',MAP_SEAMLESS_RELEASE);
    return new Response(request.method==='HEAD'?null:mapSeamlessHtml(await response.text(),page,Boolean(env.MARKET_R2)),{status:response.status,headers});
  }
  return response;
};
