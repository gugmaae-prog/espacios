const SHARJAH_MARKET_PATH='/map/api/uae-evidence/sharjah/market-aggregates';

export function mapSharjahMarketAggregates(request,report,data){
 const url=new URL(request.url);
 if(url.pathname.replace(/\/+$/,'')!==SHARJAH_MARKET_PATH)return null;
 const headers={'content-type':'application/json; charset=utf-8','cache-control':'public,max-age=60,s-maxage=300','x-content-type-options':'nosniff','x-espacios-evidence-source':report.sourceId};
 const reply=(body,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{...headers,...(status===200?{}:{'cache-control':'no-store'})}});
 if(!['GET','HEAD'].includes(request.method))return new Response(JSON.stringify({error:'Read-only endpoint'}),{status:405,headers:{...headers,'cache-control':'no-store',allow:'GET, HEAD'}});
 const period=url.searchParams.get('period');
 if(period&&!data.observations.some(row=>row.periodId===period))return reply({error:'Unknown cumulative period.'},400);
 const observations=period?data.observations.filter(row=>row.periodId===period):data.observations;
 return reply({source:{id:report.sourceId,authority:data.authority,publication:data.publication,evidenceClass:data.evidenceClass,grain:data.grain,sourceMethod:data.sourceMethod,dataSha256:report.dataSha256,rightsScope:report.rightsScope},scope:{emirate:data.emirate,observations:observations.length,cumulative:true,transactionLevel:false,projectRegister:false,sourceLinks:observations.map(row=>({periodId:row.periodId,sourceUrl:row.sourceUrl,corroboratingUrl:row.corroboratingUrl})),limits:data.limits},observations});
}
