/* Read-only, checksum-pinned V48 project-subject observations. */
var PH_PREVIOUS_FETCH=worker_default.fetch;
worker_default.fetch=async function(request,env,ctx){
 const path=new URL(request.url).pathname.replace(/\/+$/,'')||'/';
 if(path==='/map/api/verified-project-observations'){
  const headers={'content-type':'application/json; charset=utf-8','cache-control':'public,max-age=300,s-maxage=3600','x-content-type-options':'nosniff','x-ae-data-source':'accepted-v48-qualified-dld-project-subject','x-ae-evidence-class':'registered_sale_project_subject_supplement',etag:AE_PROJECT_HEAT_ETAG};
  if(!['GET','HEAD'].includes(request.method))return new Response('Read-only evidence',{status:405,headers:{...headers,allow:'GET, HEAD','cache-control':'no-store'}});
  if(request.headers.get('if-none-match')===AE_PROJECT_HEAT_ETAG)return new Response(null,{status:304,headers});
  return new Response(request.method==='HEAD'?null:AE_PROJECT_HEAT_JSON,{headers});
 }
 return PH_PREVIOUS_FETCH.call(this,request,env,ctx);
};
