/* Public, versioned research; no runtime storage, credentials or mutation. */
var VD_PREVIOUS_FETCH=worker_default.fetch;
worker_default.fetch=async function(request,env,ctx){
 const u=new URL(request.url),path=u.pathname.replace(/\/+$/,'');
 if(path!=='/map/api/value-drivers')return VD_PREVIOUS_FETCH.call(this,request,env,ctx);
 if(['psrhomes.ae','www.psrhomes.ae'].includes(u.hostname))return new Response(JSON.stringify({error:'Not found'}),{status:404,headers:{'content-type':'application/json','cache-control':'no-store','x-robots-tag':'noindex'}});
 const headers={'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=300','x-content-type-options':'nosniff','x-espacios-value-drivers':VD_DATA.version,'etag':VD_ETAG};
 if(!['GET','HEAD'].includes(request.method))return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers:{...headers,'cache-control':'no-store','allow':'GET, HEAD'}});
 if(request.headers.get('if-none-match')===VD_ETAG)return new Response(null,{status:304,headers});
 return new Response(request.method==='HEAD'?null:JSON.stringify(VD_DATA),{headers});
};
