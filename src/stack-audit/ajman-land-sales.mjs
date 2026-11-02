const AJMAN_LAND_SALES_PATH='/map/api/uae-evidence/ajman/land-sales';
const LAND_SALES_FIELDS=['sector_english','sector_arabic','district_english','district_arabic','total_sales_value_in_aed','sales_count','max_sales_value_in_aed','year','quarter'];
let AJMAN_LAND_SALES_ROWS;
let AJMAN_LAND_SALES_PACKED;
const landSalesSha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
const landSalesInt=(value,min,max)=>/^\d+$/.test(value||'')&&Number.isSafeInteger(Number(value))&&Number(value)>=min&&Number(value)<=max?Number(value):null;
const landSalesValue=value=>value==='Unavailable'?null:typeof value==='string'&&/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)&&Number.isFinite(Number(value))?Number(value):NaN;
const landSalesReply=(request,body,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public,max-age=60,s-maxage=300':'no-store','x-content-type-options':'nosniff','x-espacios-evidence-source':'ajman-dlrr-20260821-land-sales',...(status===405?{allow:'GET, HEAD'}:{})}});

export function normalizeAjmanLandSales(sourceRows){
 if(!Array.isArray(sourceRows))throw Error('Land sales source is not an array');
 const rows=[],periods=new Set(),englishDistricts=new Set(),arabicDistricts=new Set(),dimensions=new Set(),districtLabels=new Map();
 let unavailableValueRows=0,duplicateEnglishDimensionRows=0,salesCountSum=0,knownValueAedSum=0;
 for(const [index,row] of sourceRows.entries()){
  if(Object.keys(row).length!==LAND_SALES_FIELDS.length||LAND_SALES_FIELDS.some(field=>!Object.hasOwn(row,field)))throw Error('Land sales schema mismatch');
  for(const field of LAND_SALES_FIELDS.slice(0,4))if(typeof row[field]!=='string'||!row[field].trim())throw Error('Land sales district label invalid');
  if(!Number.isSafeInteger(row.year)||row.year<2019||row.year>2026||!Number.isSafeInteger(row.quarter)||row.quarter<1||row.quarter>4||row.year===2026&&row.quarter>2||!Number.isSafeInteger(row.sales_count)||row.sales_count<1)throw Error('Land sales period or count invalid');
  const totalSalesValueAed=landSalesValue(row.total_sales_value_in_aed),maxSaleValueAed=landSalesValue(row.max_sales_value_in_aed);
  if(Number.isNaN(totalSalesValueAed)||Number.isNaN(maxSaleValueAed)||(totalSalesValueAed===null)!==(maxSaleValueAed===null)||totalSalesValueAed!==null&&(totalSalesValueAed<=0||maxSaleValueAed<=0||maxSaleValueAed>totalSalesValueAed))throw Error('Land sales value invalid');
  const period=`${row.year}Q${row.quarter}`,dimension=JSON.stringify([row.sector_english,row.district_english,row.year,row.quarter]);
  periods.add(period);englishDistricts.add(row.district_english);arabicDistricts.add(row.district_arabic);salesCountSum+=row.sales_count;
  if(dimensions.has(dimension))duplicateEnglishDimensionRows++;dimensions.add(dimension);
  if(!districtLabels.has(row.district_english))districtLabels.set(row.district_english,new Set());
  districtLabels.get(row.district_english).add(row.district_arabic);
  if(totalSalesValueAed===null)unavailableValueRows++;else knownValueAedSum+=totalSalesValueAed;
  rows.push({sourceRowIndex:index,sectorEnglish:row.sector_english,sectorArabic:row.sector_arabic,districtEnglish:row.district_english,districtArabic:row.district_arabic,totalSalesValueAed,maxSaleValueAed,salesCount:row.sales_count,year:row.year,quarter:row.quarter,period,valueStatus:totalSalesValueAed===null?'unavailable':'reported',propertyScope:'land',canonicalProjectId:null,coordinates:null});
 }
 const observedPeriods=[...periods].sort(),allPeriods=[];
 for(let year=2019;year<=2026;year++)for(let quarter=1;quarter<=4;quarter++){if(year===2026&&quarter>2)break;allPeriods.push(`${year}Q${quarter}`);}
 const districtLabelConflicts=[...districtLabels].filter(([,labels])=>labels.size>1).map(([name])=>name).sort();
 const quality={rows:rows.length,observedPeriods,missingPeriods:allPeriods.filter(period=>!periods.has(period)),distinctEnglishDistricts:englishDistricts.size,distinctArabicDistricts:arabicDistricts.size,duplicateEnglishDimensionRows,districtLabelConflicts,unavailableValueRows,salesCountSum,knownValueAedSum:Number(knownValueAedSum.toFixed(2))};
 return {rows,quality};
}

async function verifiedLandSalesRows(report,packed){
 if(!AJMAN_LAND_SALES_ROWS||AJMAN_LAND_SALES_PACKED!==packed){AJMAN_LAND_SALES_PACKED=packed;AJMAN_LAND_SALES_ROWS=(async()=>{
  const binary=atob(packed),compressed=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)compressed[i]=binary.charCodeAt(i);
  if(compressed.byteLength!==report.compressedBytes||await landSalesSha(compressed)!==report.compressedSha256)throw Error('Land sales compressed checksum mismatch');
  const raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if(raw.byteLength!==report.rawBytes||await landSalesSha(raw)!==report.rawSha256||report.independentReadbackSha256!==report.rawSha256)throw Error('Land sales raw checksum mismatch');
  const sourceRows=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw)),verified=normalizeAjmanLandSales(sourceRows);
  if(JSON.stringify(verified.quality)!==JSON.stringify(report.quality))throw Error('Land sales quality mismatch');
  return verified.rows;
 })().catch(error=>{AJMAN_LAND_SALES_ROWS=undefined;AJMAN_LAND_SALES_PACKED=undefined;throw error});}
 return AJMAN_LAND_SALES_ROWS;
}

export async function mapAjmanLandSales(request,report,packed){
 const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'');
 if(path!==AJMAN_LAND_SALES_PATH)return null;
 if(!['GET','HEAD'].includes(request.method))return landSalesReply(request,{error:'Read-only endpoint'},405);
 const params=url.searchParams,year=params.has('year')?landSalesInt(params.get('year'),2019,2026):null,quarter=params.has('quarter')?landSalesInt(params.get('quarter'),1,4):null,limit=params.has('limit')?landSalesInt(params.get('limit'),1,100):50,offset=params.has('offset')?landSalesInt(params.get('offset'),0,report?.quality?.rows??0):0,district=(params.get('district')||'').trim();
 if(params.has('year')&&year===null||params.has('quarter')&&quarter===null||limit===null||offset===null||district.length>120)return landSalesReply(request,{error:'Invalid year, quarter, district, limit, or offset.'},400);
 try{
  const rows=await verifiedLandSalesRows(report,packed),needle=district.toLocaleLowerCase('en');
  const filtered=rows.filter(row=>(year===null||row.year===year)&&(quarter===null||row.quarter===quarter)&&(!needle||row.districtEnglish.toLocaleLowerCase('en')===needle||row.districtArabic===district));
  const source={id:report.sourceId,publisher:report.publisher,datasetUrl:report.datasetUrl,licence:report.licence,licenceUrl:report.licenceUrl,sourceModifiedAt:report.sourceModifiedAt,retrievedAt:report.retrievedAt,rawSha256:report.rawSha256,rows:report.quality.rows,storage:'checksum_verified_immutable_worker_snapshot'};
  const {salesCountSum,knownValueAedSum,...publicQuality}=report.quality;
  const scope={emirate:'Ajman',evidenceClass:'official_land_sale_quarterly_district_aggregate',grain:report.grain,quality:publicQuality,projectCoordinatesPresent:false,limits:report.limits};
  return landSalesReply(request,{source,scope,filters:{year,quarter,district:district||null},totalRows:filtered.length,limit,offset,rows:filtered.slice(offset,offset+limit)});
 }catch{return landSalesReply(request,{error:'The verified Ajman land-sales snapshot is temporarily unavailable.'},503);}
}
