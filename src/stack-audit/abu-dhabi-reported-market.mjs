const ADREC_MARKET_PATH='/map/api/uae-evidence/abu-dhabi/reported-market';

export function mapAbuDhabiReportedMarket(request,report,data){
 const url=new URL(request.url);
 if(url.pathname.replace(/\/+$/,'')!==ADREC_MARKET_PATH)return null;
 const headers={'content-type':'application/json; charset=utf-8','cache-control':'public,max-age=60,s-maxage=300','x-content-type-options':'nosniff','x-espacios-evidence-source':report.sourceId};
 const reply=(payload,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(payload),{status,headers:{...headers,...(status===200?{}:{'cache-control':'no-store'})}});
 if(!['GET','HEAD'].includes(request.method))return new Response(JSON.stringify({error:'Read-only endpoint'}),{status:405,headers:{...headers,'cache-control':'no-store',allow:'GET, HEAD'}});
 const period=url.searchParams.get('period'),segment=url.searchParams.get('segment');
 const periods=[...new Set(data.marketObservations.map(row=>row.periodId))];
 const segments=[...new Set(data.segmentObservations.map(row=>row.segment))];
 if(period&&!periods.includes(period))return reply({error:'No verified observation for this period.',availablePeriods:periods},400);
 if(segment&&!segments.includes(segment))return reply({error:'No verified observation for this segment.',availableSegments:segments},400);
 if(segment&&period&&period!=='2026H1')return reply({error:'Segment observations are available only for 2026H1.',availablePeriod:'2026H1'},400);
 const marketObservations=segment?[]:data.marketObservations.filter(row=>!period||row.periodId===period);
 const districtTransactionValues=segment?[]:data.districtTransactionValues.filter(row=>!period||row.periodId===period);
 const segmentObservations=data.segmentObservations.filter(row=>(!period||row.periodId===period)&&(!segment||row.segment===segment));
 const publishedProjections=data.publishedProjections.filter(row=>(!period||row.periodId===period)&&(!segment||row.segment===segment));
 return reply({source:{id:report.sourceId,authority:data.authority,evidenceClass:data.evidenceClass,sourceMethod:data.sourceMethod,dataSha256:report.dataSha256,rightsScope:report.rightsScope,sourceLinks:report.captures.map(item=>item.url)},scope:{emirate:data.emirate,periods,segments,selectedPeriod:period||null,selectedSegment:segment||null,transactionLevel:false,commercialUnitSales:false,availableUnits:false,districtValuesAreAllUseTransactions:true,projectionIsObserved:false,limits:data.limits},marketObservations,districtTransactionValues,segmentObservations,publishedProjections});
}
