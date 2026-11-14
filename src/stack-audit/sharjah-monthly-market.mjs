const SHARJAH_MONTHLY_PATH='/map/api/uae-evidence/sharjah/monthly-market';
const sharjahMonthlyReplica=id=>{
 const replica=typeof UAE_SHARJAH_IDRIVE_REPLICA==='object'?UAE_SHARJAH_IDRIVE_REPLICA:null;
 return replica?.sourceIds?.includes(id)?{verifiedAt:replica.verifiedAt,attestationId:replica.attestationId,role:replica.storageRole}:null;
};

export function mapSharjahMonthlyMarket(request,report,data){
 const url=new URL(request.url);
 if(url.pathname.replace(/\/+$/,'')!==SHARJAH_MONTHLY_PATH)return null;
 const headers={'content-type':'application/json; charset=utf-8','cache-control':'public,max-age=60,s-maxage=300','x-content-type-options':'nosniff','x-espacios-evidence-source':report.sourceId};
 const reply=(body,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{...headers,...(status===200?{}:{'cache-control':'no-store'})}});
 if(!['GET','HEAD'].includes(request.method))return new Response(JSON.stringify({error:'Read-only endpoint'}),{status:405,headers:{...headers,'cache-control':'no-store',allow:'GET, HEAD'}});
 const month=url.searchParams.get('month');
 if(month&&!data.observations.some(row=>row.month===month))return reply({error:'This month is not in the verified partial series.',availableMonths:data.observations.map(row=>row.month),missingMonths:data.missingMonths,incompleteMonths:data.incompleteMonths},400);
 const observations=month?data.observations.filter(row=>row.month===month):data.observations;
 const combinedPeriodObservations=month?[]:(data.combinedPeriodObservations||[]);
 return reply({source:{id:report.sourceId,authority:data.authority,publication:data.publication,evidenceClass:data.evidenceClass,grain:data.grain,sourceMethod:data.sourceMethod,dataSha256:report.dataSha256,rightsScope:report.rightsScope,storage:'checksum_verified_immutable_worker_snapshot',idriveReplica:sharjahMonthlyReplica(report.sourceId)},scope:{emirate:data.emirate,period:data.period,months:observations.map(row=>row.month),missingMonths:data.missingMonths,incompleteMonths:data.incompleteMonths,combinedPeriods:combinedPeriodObservations.map(row=>({startMonth:row.startMonth,endMonth:row.endMonth})),partial:true,transactionLevel:false,commercialOnly:false,currentAvailability:false,sourceLinks:[...observations.map(row=>({month:row.month,sourceUrl:row.sourceUrl})),...combinedPeriodObservations.map(row=>({startMonth:row.startMonth,endMonth:row.endMonth,sourceUrl:row.sourceUrl}))],limits:data.limits},observations,combinedPeriodObservations});
}
