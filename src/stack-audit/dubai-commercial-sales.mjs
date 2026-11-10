const DUBAI_COMMERCIAL_SALES_PATH='/map/api/uae-evidence/dubai/commercial-unit-sales';
const DUBAI_COMMERCIAL_SALES_PARTIAL_PATH='/map/api/uae-evidence/dubai/commercial-unit-sales-2026-partial';
const dubaiCommercialSalesRowsPromises=new Map();

async function dubaiCommercialSalesRows(base64,report){
 if(!dubaiCommercialSalesRowsPromises.has(report.rawSha256))dubaiCommercialSalesRowsPromises.set(report.rawSha256,(async()=>{
  const binary=atob(base64),bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  const raw=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
  if(raw.sourceId!==report.sourceId||raw.columns?.join(',')!=='transactionId,date,areaId,areaName,projectName,buildingName,spaceType,registration,areaSqm,priceAed,qualityFlags'||raw.rows?.length!==report.rows)throw Error('Dubai commercial sales snapshot failed validation');
  return raw.rows;
 })().catch(error=>{dubaiCommercialSalesRowsPromises.delete(report.rawSha256);throw error}));
 return dubaiCommercialSalesRowsPromises.get(report.rawSha256);
}

function dubaiSalesSummary(rows){
 const clean=rows.filter(row=>row[10]===0&&Number.isFinite(row[8])&&row[8]>0&&Number.isFinite(row[9])&&row[9]>0);
 const rates=clean.map(row=>row[9]/(row[8]*10.7639)).sort((a,b)=>a-b);
 const median=rates.length?(rates.length%2?rates[(rates.length-1)/2]:(rates[rates.length/2-1]+rates[rates.length/2])/2):null;
 return {registeredSaleRecords:rows.length,cleanPriceRecords:clean.length,cleanSaleValueAed:clean.reduce((sum,row)=>sum+row[9],0),medianCleanPriceAedPerSqft:median===null?null:Math.round(median),readyRecords:rows.filter(row=>row[7]==='Ready').length,offPlanRecords:rows.filter(row=>row[7]==='Off-Plan').length,officeRecords:rows.filter(row=>row[6]==='Office').length,shopRecords:rows.filter(row=>row[6]==='Shop').length};
}

export async function mapDubaiCommercialSales(request,report,packed,partialReport=null,partialPacked=null){
 const url=new URL(request.url);
 const path=url.pathname.replace(/\/+$/,'');
 if(path!==DUBAI_COMMERCIAL_SALES_PATH&&path!==DUBAI_COMMERCIAL_SALES_PARTIAL_PATH)return null;
 const partial=path===DUBAI_COMMERCIAL_SALES_PARTIAL_PATH;
 if(partial){if(!partialReport||!partialPacked)return new Response('Source unavailable',{status:503});report=partialReport;packed=partialPacked}
 const headers={'content-type':'application/json; charset=utf-8','cache-control':'public,max-age=60,s-maxage=300','x-content-type-options':'nosniff','x-espacios-evidence-source':report.sourceId};
 const reply=(body,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{...headers,...(status===200?{}:{'cache-control':'no-store'})}});
 if(!['GET','HEAD'].includes(request.method))return new Response(JSON.stringify({error:'Read-only endpoint'}),{status:405,headers:{...headers,'cache-control':'no-store',allow:'GET, HEAD'}});
 const year=url.searchParams.get('year'),areaId=url.searchParams.get('areaId'),type=url.searchParams.get('type'),registration=url.searchParams.get('registration'),view=url.searchParams.get('view')||'summary';
 if((year&&(!/^\d{4}$/.test(year)||(partial?+year!==2026:+year<2006||+year>2025)))||(areaId&&(!/^\d+$/.test(areaId)||+areaId<=0))||(type&&!['Office','Shop'].includes(type))||(registration&&!['Ready','Off-Plan'].includes(registration))||!['summary','areas','records'].includes(view))return reply({error:partial?'Unknown filter. This endpoint contains only the partial 1 January–9 February 2026 period.':'Unknown filter. Supported years are 2006–2025; use the separately labelled 2026 partial endpoint for later records.'},400);
 const source={id:report.sourceId,publisher:report.publisher,sourceUrl:report.sourceUrl,originalSourceUrl:report.originalSourceUrl,license:report.license,licenseUrl:report.licenseUrl,sourceSnapshotDate:report.sourceSnapshotDate,sourceParquetSha256:report.sourceParquetSha256,derivedSubsetSha256:report.rawSha256};
 const scope={emirate:'Dubai',evidenceClass:'registered_commercial_unit_sales',population:'DLD Commercial Unit Office and Shop sale registrations',grain:view==='records'?'one registered sale':view==='areas'?'DLD cadastral area':'selected population',dateRange:report.dateRange,periodStatus:partial?report.periodStatus:'pre_2026_historical_source_slice',qualityRule:'Counts include flagged source rows; sale value and price median use qualityFlags=0 only.',limits:partial?'Partial 2026 source period, 1 January–9 February only. The source commercial-unit classification then stops while other sale categories continue. Do not annualize or compare this count with a full year. Registered prices are not asking prices, current availability, rents, or valuations. DLD cadastral areas are not verified unit coordinates.':'Historical snapshot through 2025. The source commercial-unit classification stops after 9 February 2026 despite other sale categories continuing, so 2026 is withheld from this historical series. Registered prices are not asking prices, current availability, rents, or property valuations. DLD cadastral areas are not verified unit coordinates.'};
 try{
  const all=await dubaiCommercialSalesRows(packed,report);
  const rows=all.filter(row=>(!year||row[1].startsWith(year))&&(!areaId||row[2]===+areaId)&&(!type||row[6]===type)&&(!registration||row[7]===registration));
  if(view==='summary')return reply({source,scope,filters:{year:year?+year:null,areaId:areaId?+areaId:null,type:type||null,registration:registration||null},...dubaiSalesSummary(rows)});
  if(view==='areas'){
   const groups=new Map();for(const row of rows){const key=row[2];if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row)}
   const areas=[...groups].map(([id,group])=>({areaId:id,areaName:group[0][3],...dubaiSalesSummary(group)})).sort((a,b)=>b.registeredSaleRecords-a.registeredSaleRecords||a.areaId-b.areaId);
   return reply({source,scope,filters:{year:year?+year:null,type:type||null,registration:registration||null},totalAreas:areas.length,areas});
  }
  const limitRaw=url.searchParams.get('limit')||'100',offsetRaw=url.searchParams.get('offset')||'0';
  if(!/^\d+$/.test(limitRaw)||+limitRaw<1||+limitRaw>500||!/^\d+$/.test(offsetRaw)||+offsetRaw>report.rows)return reply({error:`Use limit 1–500 and offset 0–${report.rows}.`},400);
  const records=rows.slice(+offsetRaw,+offsetRaw+(+limitRaw)).map(row=>Object.fromEntries(['transactionId','date','areaId','areaName','projectName','buildingName','spaceType','registration','areaSqm','priceAed','qualityFlags'].map((key,index)=>[key,row[index]])));
  return reply({source,scope,filters:{year:year?+year:null,areaId:areaId?+areaId:null,type:type||null,registration:registration||null},totalRecords:rows.length,offset:+offsetRaw,limit:+limitRaw,records});
 }catch{return reply({error:'Verified commercial sales snapshot unavailable. Retry shortly.'},503)}
}
