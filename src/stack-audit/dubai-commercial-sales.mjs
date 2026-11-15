const DUBAI_COMMERCIAL_SALES_PATH='/map/api/uae-evidence/dubai/commercial-unit-sales';
const DUBAI_COMMERCIAL_SALES_PARTIAL_PATH='/map/api/uae-evidence/dubai/commercial-unit-sales-2026-partial';
const DUBAI_COMMERCIAL_SALES_SUBTYPE_PATH='/map/api/uae-evidence/dubai/commercial-unit-sales-2026-subtype';
// Exact reviewed DLD area names with a separate OSM area reference. A broader
// neighbourhood (for example Al Warsan) is not a match for a numbered DLD area.
const DUBAI_COMMERCIAL_MAP_AREAS=[
 [526,'Business Bay','business-bay'],
 [334,'Al Jadaf','al-jaddaf'],
 [364,'Al Wasl','al-wasl'],
 [232,'Mirdif','mirdif'],
];
const dubaiCommercialSalesRowsPromises=new Map();

async function dubaiCommercialSalesRows(base64,report){
 if(!dubaiCommercialSalesRowsPromises.has(report.rawSha256))dubaiCommercialSalesRowsPromises.set(report.rawSha256,(async()=>{
  const binary=atob(base64),bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  const raw=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
  const columns='transactionId,date,areaId,areaName,projectName,buildingName,spaceType,registration,areaSqm,priceAed,qualityFlags'+(report.periodStatus==='partial_2026_subtype_based_usage_label_conflict'?',usageLabel':'');
  if(raw.sourceId!==report.sourceId||raw.columns?.join(',')!==columns||raw.rows?.length!==report.rows)throw Error('Dubai commercial sales snapshot failed validation');
  return raw.rows;
 })().catch(error=>{dubaiCommercialSalesRowsPromises.delete(report.rawSha256);throw error}));
 return dubaiCommercialSalesRowsPromises.get(report.rawSha256);
}

function dubaiSalesSummary(rows){
 const clean=rows.filter(row=>row[10]===0&&Number.isFinite(row[8])&&row[8]>0&&Number.isFinite(row[9])&&row[9]>0);
 const rates=clean.map(row=>row[9]/(row[8]*10.7639)).sort((a,b)=>a-b);
 const median=rates.length?(rates.length%2?rates[(rates.length-1)/2]:(rates[rates.length/2-1]+rates[rates.length/2])/2):null;
 return {registeredSaleRecords:rows.length,cleanPriceRecords:clean.length,cleanSaleValueAed:clean.reduce((sum,row)=>sum+row[9],0),medianCleanPriceAedPerSqft:median===null?null:Math.round(median),readyRecords:rows.filter(row=>row[7]==='Ready').length,offPlanRecords:rows.filter(row=>row[7]==='Off-Plan').length,officeRecords:rows.filter(row=>row[6]==='Office').length,shopRecords:rows.filter(row=>row[6]==='Shop').length,...(rows.some(row=>row.length===12)?{commercialUsageRecords:rows.filter(row=>row[11]==='Commercial').length,conflictingResidentialUsageRecords:rows.filter(row=>row[11]==='Residential').length}:{})};
}

export async function mapDubaiCommercialSales(request,report,packed,partialReport=null,partialPacked=null,mapReferences=null,subtypeReport=null,subtypePacked=null){
 const url=new URL(request.url);
 const path=url.pathname.replace(/\/+$/,'');
 if(path!==DUBAI_COMMERCIAL_SALES_PATH&&path!==DUBAI_COMMERCIAL_SALES_PARTIAL_PATH&&path!==DUBAI_COMMERCIAL_SALES_SUBTYPE_PATH)return null;
 const partial=path===DUBAI_COMMERCIAL_SALES_PARTIAL_PATH;
 if(partial){if(!partialReport||!partialPacked)return new Response('Source unavailable',{status:503});report=partialReport;packed=partialPacked}
 const subtype=path===DUBAI_COMMERCIAL_SALES_SUBTYPE_PATH;
 if(subtype){if(!subtypeReport||!subtypePacked)return new Response('Source unavailable',{status:503});report=subtypeReport;packed=subtypePacked}
 const headers={'content-type':'application/json; charset=utf-8','cache-control':'public,max-age=60,s-maxage=300','x-content-type-options':'nosniff','x-espacios-evidence-source':report.sourceId};
 const reply=(body,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{...headers,...(status===200?{}:{'cache-control':'no-store'})}});
 if(!['GET','HEAD'].includes(request.method))return new Response(JSON.stringify({error:'Read-only endpoint'}),{status:405,headers:{...headers,'cache-control':'no-store',allow:'GET, HEAD'}});
 const year=url.searchParams.get('year'),areaId=url.searchParams.get('areaId'),type=url.searchParams.get('type'),registration=url.searchParams.get('registration'),view=url.searchParams.get('view')||'summary';
 if((year&&(!/^\d{4}$/.test(year)||(partial||subtype?+year!==2026:+year<2006||+year>2025)))||(areaId&&(!/^\d+$/.test(areaId)||+areaId<=0))||(type&&!['Office','Shop'].includes(type))||(registration&&!['Ready','Off-Plan'].includes(registration))||!['summary','areas','records',...(partial?[]:['map'])].includes(view))return reply({error:subtype?'Unknown filter. This subtype-based endpoint covers January–October 2026 only.':partial?'Unknown filter. This endpoint contains only the partial 1 January–9 February 2026 period.':'Unknown filter. Supported years are 2006–2025; use the separately labelled 2026 endpoint for later records.'},400);
 const source={id:report.sourceId,publisher:report.publisher,sourceUrl:report.sourceUrl,originalSourceUrl:report.originalSourceUrl,license:report.license,licenseUrl:report.licenseUrl,sourceSnapshotDate:report.sourceSnapshotDate,sourceParquetSha256:report.sourceParquetSha256,derivedSubsetSha256:report.rawSha256};
 const scope={emirate:'Dubai',evidenceClass:subtype?'registered_office_shop_subtype_sales_with_usage_conflict':'registered_commercial_unit_sales',population:subtype?'DLD-derived Unit Office and Shop subtype sale registrations; usage labels conflict after February 9':'DLD Commercial Unit Office and Shop sale registrations',grain:view==='records'?'one registered sale':view==='areas'?'DLD cadastral area':'selected population',dateRange:report.dateRange,periodStatus:partial||subtype?report.periodStatus:'pre_2026_historical_source_slice',qualityRule:'Counts include flagged source rows; sale value and price median use qualityFlags=0 only.',limits:subtype?report.limits:partial?'Partial 2026 source period, 1 January–9 February only. The source commercial-unit classification then stops while other sale categories continue. Do not annualize or compare this count with a full year. Registered prices are not asking prices, current availability, rents, or valuations. DLD cadastral areas are not verified unit coordinates.':'Historical snapshot through 2025. The source commercial-unit classification stops after 9 February 2026 despite other sale categories continuing, so 2026 is withheld from this historical series. Registered prices are not asking prices, current availability, rents, or property valuations. DLD cadastral areas are not verified unit coordinates.'};
 try{
  const all=await dubaiCommercialSalesRows(packed,report);
  const rows=all.filter(row=>(!year||row[1].startsWith(year))&&(!areaId||row[2]===+areaId)&&(!type||row[6]===type)&&(!registration||row[7]===registration));
  if(view==='summary')return reply({source,scope,filters:{year:year?+year:null,areaId:areaId?+areaId:null,type:type||null,registration:registration||null},...dubaiSalesSummary(rows)});
  if(view==='map'){
   if(!Array.isArray(mapReferences))throw Error('Reviewed area references unavailable');
   const byKey=new Map(mapReferences.map(area=>[area[0],area]));
   const groups=new Map();for(const row of rows){if(!groups.has(row[2]))groups.set(row[2],[]);groups.get(row[2]).push(row)}
   const mapped=DUBAI_COMMERCIAL_MAP_AREAS.map(([areaId,areaName,key])=>{
    const ref=byKey.get(key),group=groups.get(areaId)||[];
    if(!ref||ref[1]!==areaName&&!(areaName==='Al Jadaf'&&ref[1]==='Al Jaddaf')||!ref[5].includes(areaName)||group.some(row=>row[3]!==areaName))throw Error('DLD area reference mismatch');
    return {areaId,areaName,center:[ref[2],ref[3]],osmUrl:'https://www.openstreetmap.org/'+ref[4],locationBasis:'reviewed_osm_area_reference_not_cadastral_centroid_or_unit_coordinate',...dubaiSalesSummary(group)};
   }).filter(area=>area.registeredSaleRecords>0);
   const mappedCount=mapped.reduce((sum,area)=>sum+area.registeredSaleRecords,0);
   return reply({source,scope:{...scope,grain:'DLD cadastral area with reviewed OSM area reference',mapLimits:'Only exact reviewed name matches receive area reference points. These are not DLD boundary centroids, building or unit coordinates. Unmatched sale records remain in the source API.',mappedSaleRecords:mappedCount,unmappedSaleRecords:rows.length-mappedCount,areaAttribution:'© OpenStreetMap contributors',areaAttributionUrl:'https://www.openstreetmap.org/copyright'},filters:{year:year?+year:null,type:type||null,registration:registration||null},totalSaleRecords:rows.length,mappedAreas:mapped});
  }
  if(view==='areas'){
   const groups=new Map();for(const row of rows){const key=row[2];if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row)}
   const areas=[...groups].map(([id,group])=>({areaId:id,areaName:group[0][3],...dubaiSalesSummary(group)})).sort((a,b)=>b.registeredSaleRecords-a.registeredSaleRecords||a.areaId-b.areaId);
   return reply({source,scope,filters:{year:year?+year:null,type:type||null,registration:registration||null},totalAreas:areas.length,areas});
  }
  const limitRaw=url.searchParams.get('limit')||'100',offsetRaw=url.searchParams.get('offset')||'0';
  if(!/^\d+$/.test(limitRaw)||+limitRaw<1||+limitRaw>500||!/^\d+$/.test(offsetRaw)||+offsetRaw>report.rows)return reply({error:`Use limit 1–500 and offset 0–${report.rows}.`},400);
  const records=rows.slice(+offsetRaw,+offsetRaw+(+limitRaw)).map(row=>Object.fromEntries(['transactionId','date','areaId','areaName','projectName','buildingName','spaceType','registration','areaSqm','priceAed','qualityFlags',...(subtype?['usageLabel']:[])].map((key,index)=>[key,row[index]])));
  return reply({source,scope,filters:{year:year?+year:null,areaId:areaId?+areaId:null,type:type||null,registration:registration||null},totalRecords:rows.length,offset:+offsetRaw,limit:+limitRaw,records});
 }catch{return reply({error:'Verified commercial sales snapshot unavailable. Retry shortly.'},503)}
}
