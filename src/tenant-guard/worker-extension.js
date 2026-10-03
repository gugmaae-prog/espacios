/* Preserve PSR tenant boundary. Espacios map/system stays unavailable on psrhomes.ae. */
var PSR_TENANT_GUARD_RELEASE='20261002-psr-map-tenant-guard-v1';
var PSR_TENANT_GUARD_PREVIOUS_FETCH=worker_default.fetch;
worker_default.fetch=async function(request,env,ctx){
  const u=new URL(request.url),path=u.pathname.replace(/\/+$/,'')||'/';
  const psrHost=u.hostname==='psrhomes.ae'||u.hostname==='www.psrhomes.ae';
  if(psrHost&&(path==='/map'||path==='/map/system'||path==='/map/api/system'||path==='/map/api/control-plane')){
    const common={'cache-control':'no-store','x-robots-tag':'noindex, nofollow','x-content-type-options':'nosniff','x-psr-cache-key':'psr-map-tenant-block-20261002-v1'};
    if(path.startsWith('/map/api/'))return new Response(JSON.stringify({error:'Not found',product:'PSR Homes'}),{status:404,headers:{...common,'content-type':'application/json; charset=utf-8'}});
    const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Not found | PSR Homes</title></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#111715;color:#f5f1e8;font-family:Arial,sans-serif"><main style="max-width:620px;padding:40px;text-align:center"><h1 style="font-weight:400;font-size:36px">This page is not available.</h1><p style="color:#b9b2a8;line-height:1.7">Return to PSR Homes to explore current properties, communities and market research.</p><a href="/" style="color:#f5f1e8">PSR Homes</a></main></body></html>';
    return new Response(html,{status:404,headers:{...common,'content-type':'text/html; charset=utf-8'}});
  }
  return PSR_TENANT_GUARD_PREVIOUS_FETCH.call(this,request,env,ctx);
};
