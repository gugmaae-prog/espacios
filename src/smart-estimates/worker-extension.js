/* Additive immutable snapshot. No observed data, model trials or bindings are replaced. */
var SE_RELEASE='20260930-smart-estimates-v1';
var SE_R2_KEY='research/published/2026-09-30/smart-estimates-v1/scenarios.json';
var SE_PREVIOUS_FETCH=worker_default.fetch;
worker_default.fetch=async function(request,env,ctx){
 const path=new URL(request.url).pathname.replace(/\/+$/,'')||'/';
 if(path==='/map/api/smart-estimates/sources'){
  const headers={'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=300','x-content-type-options':'nosniff'};
  if(!['GET','HEAD'].includes(request.method))return new Response('Read-only source register',{status:405,headers:{...headers,allow:'GET, HEAD'}});
  return new Response(request.method==='HEAD'?null:JSON.stringify(SE_SOURCE_REVIEW),{headers});
 }
 if(path==='/map/api/smart-estimates'){
  const headers={'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=300, s-maxage=3600','x-content-type-options':'nosniff','x-espacios-estimates':SE_RELEASE};
  if(!['GET','HEAD'].includes(request.method))return new Response('Read-only scenario snapshot',{status:405,headers:{...headers,allow:'GET, HEAD','cache-control':'no-store'}});
  try{const object=await env.MARKET_R2?.get(SE_R2_KEY);if(!object)return new Response(JSON.stringify({error:'Scenario snapshot temporarily unavailable. Observed data remains on its original endpoints.'}),{status:503,headers:{...headers,'cache-control':'no-store'}});
   if(object.httpEtag)headers.etag=object.httpEtag;
   if(object.httpEtag&&request.headers.get('if-none-match')===object.httpEtag)return new Response(null,{status:304,headers});
   return new Response(request.method==='HEAD'?null:object.body,{headers});
  }catch{return new Response(JSON.stringify({error:'Scenario snapshot temporarily unavailable'}),{status:503,headers:{...headers,'cache-control':'no-store'}});}
 }
 const response=await SE_PREVIOUS_FETCH.call(this,request,env,ctx);
 if(path==='/map/api/system'&&request.method==='GET'&&response.ok){const payload=await response.json();payload.smartEstimates={release:SE_RELEASE,route:'/map/api/smart-estimates',storage:'Cloudflare R2',key:SE_R2_KEY,classification:'conditional_scenarios_not_validated_forecasts',horizonsYears:[1,3,5,10],originalHistoryPreserved:true};payload.source.productionSourceFullyReconciled=true;payload.source.productionDeploymentManifest='wrangler.production.jsonc';return new Response(JSON.stringify(payload,null,2),{status:response.status,headers:response.headers});}
 return response;
};
