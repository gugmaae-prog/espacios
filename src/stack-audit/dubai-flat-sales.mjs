const DUBAI_FLAT_SALES_PATH='/map/api/uae-evidence/dubai/flat-sales-2026-partial';
const AREA_COLUMNS='month,areaId,areaName,registration,saleCount,cleanPriceCount,medianCleanPriceAedPerSqft,cleanSaleValueAed';
const MONTH_COLUMNS='month,registration,saleCount,cleanPriceCount,medianCleanPriceAedPerSqft,cleanSaleValueAed';
const cachedFlatSales=new Map();

async function sha256(bytes){
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}

async function flatSalesSnapshot(report,base64){
 if(!cachedFlatSales.has(report.rawSha256))cachedFlatSales.set(report.rawSha256,(async()=>{
  const packed=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
  if(packed.length!==report.compressedBytes||await sha256(packed)!==report.compressedSha256)throw Error('Dubai flat-sale compressed snapshot mismatch');
  const bytes=await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if(bytes.byteLength!==report.rawBytes||await sha256(bytes)!==report.rawSha256)throw Error('Dubai flat-sale decoded snapshot mismatch');
  const data=JSON.parse(new TextDecoder().decode(bytes));
  if(data.sourceId!==report.sourceId||data.areaColumns?.join(',')!==AREA_COLUMNS||data.monthColumns?.join(',')!==MONTH_COLUMNS||data.areaMonthRows?.length!==report.areaMonthRows||data.monthlyTotals?.length!==report.monthlyRows)throw Error('Dubai flat-sale source schema mismatch');
  if(data.areaMonthRows.reduce((n,r)=>n+r[4],0)!==report.sourceRows||data.monthlyTotals.reduce((n,r)=>n+r[2],0)!==report.sourceRows||data.areaMonthRows.reduce((n,r)=>n+r[5],0)!==report.cleanRows||data.monthlyTotals.reduce((n,r)=>n+r[3],0)!==report.cleanRows||data.areaMonthRows.filter(r=>r[5]<10).length!==report.suppressedAreaMonetaryGroups||data.areaMonthRows.some(r=>r[5]<10&&(r[6]!==null||r[7]!==null)))throw Error('Dubai flat-sale population mismatch');
  return data;
 })().catch(error=>{cachedFlatSales.delete(report.rawSha256);throw error}));
 return cachedFlatSales.get(report.rawSha256);
}

export async function mapDubaiFlatSales(request,report,packed){
 const url=new URL(request.url);
 if(url.pathname.replace(/\/+$/,'')!==DUBAI_FLAT_SALES_PATH)return null;
 const headers={'content-type':'application/json; charset=utf-8','cache-control':'public,max-age=60,s-maxage=300','x-content-type-options':'nosniff','x-espacios-evidence-source':report.sourceId};
 const reply=(body,status=200,extra={})=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{...headers,...(status===200?{}:{'cache-control':'no-store'}),...extra}});
 if(!['GET','HEAD'].includes(request.method))return reply({error:'Read-only endpoint'},405,{allow:'GET, HEAD'});
 const p=url.searchParams,view=p.get('view')||'monthly',month=p.get('month'),registration=p.get('registration'),areaId=p.get('areaId');
 const limitRaw=p.get('limit')||'100',offsetRaw=p.get('offset')||'0';
 if(!['monthly','areas'].includes(view)||(month&&!/^2026-(?:0[1-9]|10)$/.test(month))||(registration&&!['Ready','Off-Plan'].includes(registration))||(areaId&&view!=='areas')||(areaId&&!/^(?:[1-9]\d*|unknown)$/.test(areaId))||(view==='monthly'&&(p.has('limit')||p.has('offset')))||(view==='areas'&&(!/^\d+$/.test(limitRaw)||+limitRaw<1||+limitRaw>500||!/^\d+$/.test(offsetRaw)||+offsetRaw>report.areaMonthRows)))return reply({error:'Use view=monthly|areas, month=2026-01..2026-10, registration=Ready|Off-Plan, and for areas optional areaId, limit 1–500, offset 0–1117.'},400);
 const source={id:report.sourceId,publisher:report.publisher,sourceUrl:report.sourceUrl,originalSourceUrl:report.originalSourceUrl,license:report.license,licenseUrl:report.licenseUrl,sourceSnapshotDate:report.sourceSnapshotDate,sourceParquetSha256:report.sourceParquetSha256,derivedSha256:report.rawSha256};
 const scope={emirate:'Dubai',evidenceClass:'registered_residential_flat_sale_aggregate',propertyType:'Residential Unit Flat',grain:view==='areas'?'DLD area × month × registration type':'month × registration type',dateRange:report.dateRange,periodStatus:'partial_2026_January_through_October_source_snapshot',totalSourceSaleRows:report.sourceRows,cleanPriceSourceRows:report.cleanRows,distinctSourceAreaIds:report.distinctAreaIds,unknownAreaSaleRows:report.unknownAreaSaleRows,suppressedAreaMonetaryGroups:report.suppressedAreaMonetaryGroups,qualityRule:report.qualityRule,locationBasis:'DLD cadastral area labels; no building or unit coordinates',estimated:false,availableUnits:false,limits:report.limits};
 try{
  const data=await flatSalesSnapshot(report,packed);
  const columns=view==='areas'?data.areaColumns:data.monthColumns;
  const rows=(view==='areas'?data.areaMonthRows:data.monthlyTotals).filter(r=>(!month||r[0]===month)&&(!registration||r[view==='areas'?3:1]===registration)&&(view!=='areas'||!areaId||(areaId==='unknown'?r[1]===null:r[1]===+areaId)));
  const saleIndex=view==='areas'?4:2,cleanIndex=view==='areas'?5:3;
  const offset=view==='areas'?+offsetRaw:0,limit=view==='areas'?+limitRaw:rows.length;
  return reply({source,scope,filters:{view,month:month||null,registration:registration||null,areaId:areaId||null},totalRows:rows.length,totalSaleRows:rows.reduce((n,r)=>n+r[saleIndex],0),totalCleanPriceRows:rows.reduce((n,r)=>n+r[cleanIndex],0),offset,limit,rows:rows.slice(offset,offset+limit).map(r=>Object.fromEntries(columns.map((name,i)=>[name,r[i]])))});
 }catch{return reply({error:'Verified flat-sales aggregate temporarily unavailable. Retry shortly.'},503)}
}
