const FCSC_CENSUS_PATH='/map/api/uae-evidence/federal/historical-building-housing';
const fcscReply=(request,body,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public,max-age=300,s-maxage=3600':'no-store','x-content-type-options':'nosniff','x-espacios-evidence-source':'fcsc-emirates-in-figures-2009-historical-building-housing',...(status===405?{allow:'GET, HEAD'}:{})}});

export function mapFcscHistoricalCensus(request,report,data,replica=null){
 const url=new URL(request.url);
 if(url.pathname.replace(/\/+$/,'')!==FCSC_CENSUS_PATH)return null;
 if(!['GET','HEAD'].includes(request.method))return fcscReply(request,{error:'Read-only endpoint'},405);
 const metric=url.searchParams.get('metric'),year=url.searchParams.get('year'),emirate=url.searchParams.get('emirate');
 if(metric!==null&&!['buildings','housingUnits'].includes(metric))return fcscReply(request,{error:'Unknown metric. Use buildings or housingUnits.'},400);
 if(year!==null&&(!/^\d{4}$/.test(year)||!Object.values(report.years).some(values=>values.includes(Number(year)))))return fcscReply(request,{error:'Year is not in the selected census tables.'},400);
 if(metric!==null&&year!==null&&!report.years[metric].includes(Number(year)))return fcscReply(request,{error:'Metric has no selected observation for this census year.'},400);
 const selectedEmirate=emirate===null?null:report.emirateNames.find(name=>name.toLocaleLowerCase('en')===emirate.trim().toLocaleLowerCase('en'));
 if(emirate!==null&&!selectedEmirate)return fcscReply(request,{error:'Unknown emirate.'},400);
 const rows=data.rows.filter(row=>(metric===null||row.metric===metric)&&(year===null||row.year===Number(year))&&(selectedEmirate===null||row.emirate===selectedEmirate));
 return fcscReply(request,{source:{id:report.sourceId,publisher:report.publisher,evidenceClass:report.evidenceClass,grain:report.grain,sourceUrl:report.sourceUrl,crossCheckUrl:report.crossCheckUrl,sourcePdfSha256:report.sourcePdfSha256,dataSha256:report.dataSha256,observationStatus:report.observationStatus,storage:'checksum_verified_immutable_worker_snapshot',idriveReplica:replica?{attestationId:replica.attestationId,verifiedAt:replica.verifiedAt,role:'verified_private_replica_not_runtime_primary'}:null},scope:{historicalOnly:true,selectedRows:report.rows,emirates:report.emirates,years:report.years,nationalTotals:report.nationalTotals,crossCheck:report.crossCheck,sourceDiscrepancies:report.sourceDiscrepancies,limits:report.limits,notCurrentStock:true,registeredTransactions:false,availableUnits:false,projectCoordinates:false,forecasts:false},filters:{metric,year:year===null?null:Number(year),emirate:selectedEmirate},totalRows:rows.length,rows});
}
