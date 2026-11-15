const SCAD_BUILDING_PATH='/map/api/uae-evidence/abu-dhabi/building-activity';

export function mapScadBuildingActivity(request,report,data){
 const url=new URL(request.url);
 if(url.pathname.replace(/\/+$/,'')!==SCAD_BUILDING_PATH)return null;
 const headers={'content-type':'application/json; charset=utf-8','cache-control':'public,max-age=60,s-maxage=300','x-content-type-options':'nosniff','x-espacios-evidence-source':report.sourceId};
 const reply=(body,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{...headers,...(status===200?{}:{'cache-control':'no-store'})}});
 if(!['GET','HEAD'].includes(request.method))return new Response(JSON.stringify({error:'Read-only endpoint'}),{status:405,headers:{...headers,'cache-control':'no-store',allow:'GET, HEAD'}});
 const selected=url.searchParams.get('period');
 if(selected!==null&&!/^20\d{2}Q[1-4]$/.test(selected))return reply({error:'Invalid quarter.'},400);
 if(selected&&!data.observations.some(row=>row.period===selected))return reply({error:'Quarter unavailable in the verified source set.'},400);
 const observations=selected?data.observations.filter(row=>row.period===selected):data.observations;
 return reply({source:{id:report.sourceId,publisher:data.publisher,underlyingSource:data.underlyingSource,sourcePageUrl:report.sourcePageUrl,publicationReports:report.captureReports.map(item=>({period:item.period,publicationPageUrl:item.publicationPageUrl,publicationDate:data.observations.find(row=>row.period===item.period)?.publicationDate,sha256:item.sha256})),evidenceClass:data.evidenceClass,grain:data.grain,dataSha256:report.dataSha256,rightsScope:report.rightsScope},scope:{emirate:data.emirate,periods:observations.map(row=>row.period),periodsUnavailable:data.periodsUnavailable,unit:data.unit,regions:data.regions,preliminary:true,commercialCompletionsAvailable:false,transactionLevel:false,projectRegister:false,listingAvailability:false,limits:data.limits},observations});
}
