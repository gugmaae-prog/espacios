const RAK_MARKET_PATH='/map/api/uae-evidence/ras-al-khaimah/market-values';

export function mapRakMarketValues(request,report,data){
 const url=new URL(request.url);
 if(url.pathname.replace(/\/+$/,'')!==RAK_MARKET_PATH)return null;
 const headers={'content-type':'application/json; charset=utf-8','cache-control':'public,max-age=60,s-maxage=300','x-content-type-options':'nosniff','x-espacios-evidence-source':report.sourceId};
 const reply=(body,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{...headers,...(status===200?{}:{'cache-control':'no-store'})}});
 if(!['GET','HEAD'].includes(request.method))return new Response(JSON.stringify({error:'Read-only endpoint'}),{status:405,headers:{...headers,'cache-control':'no-store',allow:'GET, HEAD'}});
 const selected=url.searchParams.get('year');
 if(selected&&!data.observations.some(row=>String(row.year)===selected))return reply({error:'Unknown calendar year.'},400);
 const observations=selected?data.observations.filter(row=>String(row.year)===selected):data.observations;
 return reply({source:{id:report.sourceId,authority:data.authority,originalSource:data.originalSource,publication:data.publication,sourceUrl:data.sourceUrl,evidenceClass:data.evidenceClass,grain:data.grain,sourceMethod:data.sourceMethod,sourcePageSha256:report.capturePage.sha256,dataSha256:report.dataSha256,rightsScope:report.rightsScope},scope:{emirate:data.emirate,years:observations.length,unit:'AED thousand',transactionLevel:false,transactionCountsPresent:false,projectRegister:false,listingAvailability:false,limits:data.limits},observations});
}
