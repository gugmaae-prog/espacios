const RAK_MONTHLY_PATH='/map/api/uae-evidence/ras-al-khaimah/monthly-market';

export function mapRakMonthlyMarket(request,report,data){
 const url=new URL(request.url);
 if(url.pathname.replace(/\/+$/,'')!==RAK_MONTHLY_PATH)return null;
 const headers={'content-type':'application/json; charset=utf-8','cache-control':'public,max-age=60,s-maxage=300','x-content-type-options':'nosniff','x-espacios-evidence-source':report.sourceId};
 const reply=(body,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{...headers,...(status===200?{}:{'cache-control':'no-store'})}});
 if(!['GET','HEAD'].includes(request.method))return new Response(JSON.stringify({error:'Read-only endpoint'}),{status:405,headers:{...headers,'cache-control':'no-store',allow:'GET, HEAD'}});
 const selected=url.searchParams.get('month');
 if(selected!==null&&!/^20\d{2}-(0[1-9]|1[0-2])$/.test(selected))return reply({error:'Invalid calendar month.'},400);
 if(selected&&!data.observations.some(row=>row.month===selected))return reply({error:'Unknown calendar month.'},400);
 const observations=selected?data.observations.filter(row=>row.month===selected):data.observations;
 return reply({source:{id:report.sourceId,authority:data.authority,publication:data.publication,sourcePageUrl:data.sourcePageUrl,sourceReports:data.sourceReports,evidenceClass:data.evidenceClass,grain:data.grain,sourceMethod:data.sourceMethod,dataSha256:report.dataSha256,sourceReportSha256:report.captureReports.map(item=>({month:item.month,sha256:item.sha256})),rightsScope:report.rightsScope},scope:{emirate:data.emirate,months:observations.map(row=>row.month),unit:data.unit,calendarYearComplete:false,transactionLevel:false,commercialOnly:false,projectRegister:false,listingAvailability:false,countsMissingMonths:['2026-02','2026-03','2026-04','2026-05','2026-06'],limits:data.limits},observations});
}
