/* Public, versioned research; no runtime storage, credentials or mutation. */
var VD_PREVIOUS_FETCH=worker_default.fetch;
worker_default.fetch=async function(request,env,ctx){
 const u=new URL(request.url),path=u.pathname.replace(/\/+$/,'');
 if(!['/map/api/value-drivers','/map/api/palm-jebel-ali'].includes(path))return VD_PREVIOUS_FETCH.call(this,request,env,ctx);
 if(['psrhomes.ae','www.psrhomes.ae'].includes(u.hostname))return new Response(JSON.stringify({error:'Not found'}),{status:404,headers:{'content-type':'application/json','cache-control':'no-store','x-robots-tag':'noindex'}});
 const etag=path==='/map/api/palm-jebel-ali'?VD_ETAG.replace(/"$/,'-palm"'):VD_ETAG;
 const headers={'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=300','x-content-type-options':'nosniff','x-espacios-value-drivers':VD_DATA.version,'etag':etag};
 if(!['GET','HEAD'].includes(request.method))return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers:{...headers,'cache-control':'no-store','allow':'GET, HEAD'}});
 if((request.headers.get('if-none-match')||'').split(',').map(value=>value.trim().replace(/^W\//,'')).includes(etag))return new Response(null,{status:304,headers});
 const payload=path==='/map/api/palm-jebel-ali'?{version:VD_DATA.version,asOf:VD_DATA.asOf,recordId:VD_DATA.palmJebelAli.id,palmJebelAli:VD_DATA.palmJebelAli,sources:VD_DATA.sources.filter(s=>VD_DATA.palmJebelAli.sourceIds.includes(s.id))}:VD_DATA;
 return new Response(request.method==='HEAD'?null:JSON.stringify(payload),{headers});
};
