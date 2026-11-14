const UAQ_INDUSTRIAL_GUIDE_PATH='/map/api/uae-evidence/umm-al-quwain/industrial-plot-guide';

export function mapUaqIndustrialGuide(request,report,data){
 const url=new URL(request.url);
 if(url.pathname.replace(/\/+$/,'')!==UAQ_INDUSTRIAL_GUIDE_PATH)return null;
 const headers={'content-type':'application/json; charset=utf-8','cache-control':'public,max-age=60,s-maxage=300','x-content-type-options':'nosniff','x-espacios-evidence-source':report.sourceId};
 const reply=(body,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{...headers,...(status===200?{}:{'cache-control':'no-store'})}});
 if(!['GET','HEAD'].includes(request.method))return new Response(JSON.stringify({error:'Read-only endpoint'}),{status:405,headers:{...headers,'cache-control':'no-store',allow:'GET, HEAD'}});
 const type=url.searchParams.get('plotType');
 if(type&&!data.rows.some(row=>row.plotType===type))return reply({error:'Unknown guide plot type.'},400);
 const rows=type?data.rows.filter(row=>row.plotType===type):data.rows;
 return reply({source:{id:report.sourceId,authority:data.authority,publication:data.publication,sourceUrl:data.sourceUrl,sourcePdfSha256:report.capturePdf.sha256,dataSha256:report.dataSha256,rightsScope:report.rightsScope,retrievedAt:report.capturePdf.retrievedAt},scope:{emirate:data.emirate,evidenceClass:data.evidenceClass,grain:data.grain,rateUnit:data.rateUnit,ratePeriod:null,ratePeriodStatus:'not_stated_in_source_table',standardLeaseTermYears:data.standardLeaseTermYears,currentOffer:false,currentAvailability:false,completedBuiltSpaces:false,transactions:false,projectRegister:false,projectCoordinates:false,limits:data.limits},filters:{plotType:type},totalRows:rows.length,rows});
}
