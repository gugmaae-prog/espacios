const AJMAN_LAND_MORTGAGE_PATH='/map/api/uae-evidence/ajman/land-mortgages';
const AJMAN_LAND_MORTGAGE_FIELDS=['sector_english','sector_arabic','district_english','district_arabic','total_mortgage_value_in_aed','mortgage_count','max_mortgage_value_in_aed','year','quarter'];
let ajmanLandMortgageCached, ajmanLandMortgageCachedPacked;
const ajmanLandMortgageSha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
const ajmanLandMortgageInteger=(value,min,max)=>/^\d+$/.test(value||'')&&Number.isSafeInteger(Number(value))&&Number(value)>=min&&Number(value)<=max?Number(value):null;
const ajmanLandMortgageReply=(request,body,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public,max-age=60,s-maxage=300':'no-store','x-content-type-options':'nosniff','x-espacios-evidence-source':'ajman-dlrr-20260821-land-mortgage',...(status===405?{allow:'GET, HEAD'}:{})}});

export function normalizeAjmanLandMortgages(sourceRows){
 if(!Array.isArray(sourceRows))throw Error('Mortgage source is not an array');
 const rows=[],periods=new Set(),districts=new Set(),dimensions=new Set();let countSum=0,valueSum=0;
 for(const [index,row] of sourceRows.entries()){
  if(Object.keys(row).length!==AJMAN_LAND_MORTGAGE_FIELDS.length||AJMAN_LAND_MORTGAGE_FIELDS.some(field=>!Object.hasOwn(row,field)))throw Error('Mortgage schema mismatch');
  for(const field of AJMAN_LAND_MORTGAGE_FIELDS.slice(0,4))if(typeof row[field]!=='string'||!row[field].trim())throw Error('Mortgage label invalid');
  const {year,quarter,mortgage_count:count,total_mortgage_value_in_aed:total,max_mortgage_value_in_aed:max}=row;
  if(!Number.isSafeInteger(year)||year<2019||year>2026||!Number.isSafeInteger(quarter)||quarter<1||quarter>4||year===2026&&quarter>2||!Number.isSafeInteger(count)||count<1)throw Error('Mortgage period or count invalid');
  if(!Number.isFinite(total)||!Number.isFinite(max)||total<=0||max<=0||max>total)throw Error('Mortgage value invalid');
  const period=`${year}Q${quarter}`,dimension=JSON.stringify([row.sector_english,row.district_english,year,quarter]);
  if(dimensions.has(dimension))throw Error('Duplicate mortgage dimension');
  dimensions.add(dimension);periods.add(period);districts.add(row.district_english);countSum+=count;valueSum+=total;
  rows.push({sourceRowIndex:index,sectorEnglish:row.sector_english,sectorArabic:row.sector_arabic,districtEnglish:row.district_english,districtArabic:row.district_arabic,mortgageActionCount:count,totalMortgageValueAed:total,maxMortgageValueAed:max,year,quarter,period,propertyScope:'land',includesMortgageValueModifications:true,canonicalProjectId:null,coordinates:null});
 }
 const allPeriods=[];for(let year=2019;year<=2026;year++)for(let quarter=1;quarter<=(year===2026?2:4);quarter++)allPeriods.push(`${year}Q${quarter}`);
 return {rows,quality:{rows:rows.length,observedPeriods:[...periods].sort(),missingPeriods:allPeriods.filter(period=>!periods.has(period)),distinctEnglishDistricts:districts.size,mortgageActionCountSum:countSum,mortgageValueAedSum:Number(valueSum.toFixed(2))}};
}

async function verifiedAjmanLandMortgageRows(report,packed){
 if(!ajmanLandMortgageCached||ajmanLandMortgageCachedPacked!==packed){ajmanLandMortgageCachedPacked=packed;ajmanLandMortgageCached=(async()=>{
  const binary=atob(packed),compressed=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)compressed[i]=binary.charCodeAt(i);
  if(compressed.byteLength!==report.compressedBytes||await ajmanLandMortgageSha(compressed)!==report.compressedSha256)throw Error('Mortgage compressed checksum mismatch');
  const raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if(raw.byteLength!==report.rawBytes||await ajmanLandMortgageSha(raw)!==report.rawSha256||report.independentReadbackSha256!==report.rawSha256)throw Error('Mortgage raw checksum mismatch');
  const checked=normalizeAjmanLandMortgages(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw)));
  if(JSON.stringify(checked.quality)!==JSON.stringify(report.quality))throw Error('Mortgage quality mismatch');
  return checked.rows;
 })().catch(error=>{ajmanLandMortgageCached=undefined;ajmanLandMortgageCachedPacked=undefined;throw error});}
 return ajmanLandMortgageCached;
}

export async function mapAjmanLandMortgages(request,report,packed){
 const url=new URL(request.url);if(url.pathname.replace(/\/+$/,'')!==AJMAN_LAND_MORTGAGE_PATH)return null;
 if(!['GET','HEAD'].includes(request.method))return ajmanLandMortgageReply(request,{error:'Read-only endpoint'},405);
 const params=url.searchParams,year=params.has('year')?ajmanLandMortgageInteger(params.get('year'),2019,2026):null,quarter=params.has('quarter')?ajmanLandMortgageInteger(params.get('quarter'),1,4):null,limit=params.has('limit')?ajmanLandMortgageInteger(params.get('limit'),1,100):50,offset=params.has('offset')?ajmanLandMortgageInteger(params.get('offset'),0,report?.quality?.rows??0):0,district=(params.get('district')||'').trim();
 if(params.has('year')&&year===null||params.has('quarter')&&quarter===null||limit===null||offset===null||district.length>120)return ajmanLandMortgageReply(request,{error:'Invalid year, quarter, district, limit, or offset.'},400);
 try{
  const rows=await verifiedAjmanLandMortgageRows(report,packed),needle=district.toLocaleLowerCase('en');
  const filtered=rows.filter(row=>(year===null||row.year===year)&&(quarter===null||row.quarter===quarter)&&(!needle||row.districtEnglish.toLocaleLowerCase('en')===needle||row.districtArabic===district));
  const {mortgageActionCountSum,mortgageValueAedSum,...publicQuality}=report.quality;
  return ajmanLandMortgageReply(request,{source:{id:report.sourceId,publisher:report.publisher,datasetUrl:report.datasetUrl,licence:report.licence,licenceUrl:report.licenceUrl,sourceModifiedAt:report.sourceModifiedAt,retrievedAt:report.retrievedAt,rawSha256:report.rawSha256,rows:report.quality.rows,storage:'checksum_verified_immutable_worker_snapshot'},scope:{emirate:'Ajman',evidenceClass:report.evidenceClass,grain:report.grain,quality:publicQuality,projectCoordinatesPresent:false,overlapsOtherAjmanLandEvidence:true,limits:report.limits},filters:{year,quarter,district:district||null},totalRows:filtered.length,limit,offset,rows:filtered.slice(offset,offset+limit)});
 }catch{return ajmanLandMortgageReply(request,{error:'The verified Ajman land-mortgage snapshot is temporarily unavailable.'},503);}
}
