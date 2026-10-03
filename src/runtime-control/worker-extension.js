/* Cloudflare <-> Supabase read-only control plane. Market evidence remains in D1/R2. */
var MAP_CONTROL_RELEASE='20261003-supabase-control-v1';
var MAP_CONTROL_PREVIOUS_FETCH=worker_default.fetch;

async function mapControlRead(env){
  const base=String(env.SUPABASE_URL||'').replace(/\/$/,'');
  const key=String(env.SUPABASE_PUBLISHABLE_KEY||'');
  if(!base||!key)return {connected:false,error:'Supabase control bindings unavailable'};
  const headers={apikey:key,accept:'application/json'};
  const [configResponse,releaseResponse]=await Promise.all([
    fetch(base+'/rest/v1/espacios_map_runtime_config?id=eq.production&select=*',{headers}),
    fetch(base+'/rest/v1/espacios_map_release_registry?environment=eq.production&select=*&order=created_at.desc&limit=1',{headers})
  ]);
  if(!configResponse.ok||!releaseResponse.ok){
    return {connected:false,error:'Supabase control plane unavailable',status:{config:configResponse.status,release:releaseResponse.status}};
  }
  const config=(await configResponse.json())[0]||null;
  const release=(await releaseResponse.json())[0]||null;
  return {
    connected:true,
    release:MAP_CONTROL_RELEASE,
    projectRef:'ypkfganbwdvcjrcxygta',
    config,
    latestRelease:release,
    authority:{
      runtime:'Cloudflare Workers',
      source:'GitHub gugmaae-prog/espacios',
      controlAudit:'Supabase',
      marketEvidence:'Cloudflare D1/R2 + PSR_PROPERTY'
    }
  };
}

worker_default.fetch=async function(request,env,ctx){
  const u=new URL(request.url),path=u.pathname.replace(/\/+$/,'')||'/';
  if(path==='/map/api/control-plane'){
    if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{allow:'GET, HEAD'}});
    let payload;
    try{payload=await mapControlRead(env);}catch(error){payload={connected:false,error:'Supabase control plane request failed'};}
    const body=JSON.stringify(payload,null,2);
    return new Response(request.method==='HEAD'?null:body,{status:payload.connected?200:503,headers:{
      'content-type':'application/json; charset=utf-8',
      'cache-control':'no-store',
      'x-content-type-options':'nosniff',
      'x-robots-tag':'noindex, nofollow',
      'x-espacios-control':MAP_CONTROL_RELEASE
    }});
  }
  const response=await MAP_CONTROL_PREVIOUS_FETCH.call(this,request,env,ctx);
  if(path==='/map/api/system'&&request.method==='GET'&&response.ok){
    let payload;
    try{payload=await response.json();}catch{return response;}
    let control;
    try{control=await mapControlRead(env);}catch{control={connected:false,error:'Supabase control plane request failed'};}
    payload.controlPlane=control;
    const headers=new Headers(response.headers);headers.set('cache-control','no-store');headers.delete('content-length');headers.delete('etag');
    return new Response(JSON.stringify(payload,null,2),{status:response.status,headers});
  }
  return response;
};
