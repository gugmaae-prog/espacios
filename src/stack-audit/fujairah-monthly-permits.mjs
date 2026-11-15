const FUJAIRAH_MONTHLY_PATH='/map/api/uae-evidence/fujairah/building-permits-monthly';
const FUJAIRAH_MONTHLY_MUNICIPALITIES=['Fujairah','Dibba'];

export function mapFujairahMonthlyPermits(request,report,data,replica=null){
 const url=new URL(request.url);
 if(url.pathname.replace(/\/+$/,'')!==FUJAIRAH_MONTHLY_PATH)return null;
 const reply=(body,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public,max-age=60,s-maxage=300':'no-store','x-content-type-options':'nosniff','x-espacios-evidence-source':report.sourceId,...(status===405?{allow:'GET, HEAD'}:{})}});
 if(!['GET','HEAD'].includes(request.method))return reply({error:'Read-only endpoint'},405);
 if(data?.sourceId!==report?.sourceId||data.rows?.length!==72||report.rows!==72)return reply({error:'Verified Fujairah monthly permits are not configured.'},503);
 const params=url.searchParams,year=params.get('year'),municipality=params.get('municipality'),month=params.get('month');
 if(year!==null&&!report.years.includes(Number(year))||municipality!==null&&!FUJAIRAH_MONTHLY_MUNICIPALITIES.includes(municipality)||month!==null&&!/^(2023|2024|2025)-(0[1-9]|1[0-2])$/.test(month)||year!==null&&month!==null&&!month.startsWith(year+'-'))return reply({error:'Invalid year, municipality, or month.'},400);
 const rows=data.rows.filter(row=>(year===null||String(row.month.slice(0,4))===year)&&(municipality===null||row.municipality===municipality)&&(month===null||row.month===month));
 return reply({source:{id:report.sourceId,authority:data.authority,originalSources:data.originalSources,publication:data.publication,sourcePdfs:report.sourcePdfs,sourceSha256:report.dataSha256,rightsScope:data.rightsScope,storage:'checksum_verified_immutable_worker_snapshot',idriveReplica:replica?{attestationId:replica.attestationId,verifiedAt:replica.verifiedAt,role:'verified_private_replica_not_runtime_primary'}:null},scope:{emirate:'Fujairah',evidenceClass:data.evidenceClass,grain:data.grain,years:report.years,municipalities:report.municipalities,unit:'issued permits',newAndRenewCombined:true,commercialUseAtMonthlyGrain:false,completedBuildings:false,availableUnits:false,registeredTransactions:false,projectCoordinates:false,limits:data.limits},filters:{year:year===null?null:Number(year),municipality,month},totalRows:rows.length,rows});
}
