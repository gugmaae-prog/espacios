const AJMAN_LAND_DISPOSITIONS_PATH='/map/api/uae-evidence/ajman/land-dispositions';
const LAND_DISPOSITION_FIELDS=['sector_english','sector_arabic','district_english','district_arabic','total_transactions_value_in_aed','transactions_count','max_transactions_value_in_aed','year','quarter'];
let AJMAN_LAND_DISPOSITIONS_ROWS;
let AJMAN_LAND_DISPOSITIONS_PACKED;
const landDispositionSha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
const landDispositionInt=(value,min,max)=>/^\d+$/.test(value||'')&&Number.isSafeInteger(Number(value))&&Number(value)>=min&&Number(value)<=max?Number(value):null;
const landDispositionReply=(request,body,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public,max-age=60,s-maxage=300':'no-store','x-content-type-options':'nosniff','x-espacios-evidence-source':'ajman-dlrr-20260821-land-dispositions',...(status===405?{allow:'GET, HEAD'}:{})}});

export function normalizeAjmanLandDispositions(sourceRows){
 if(!Array.isArray(sourceRows))throw Error('Land disposition source is not an array');
 const rows=[],periods=new Set(),englishDistricts=new Set(),arabicDistricts=new Set(),dimensions=new Set();
 let duplicateDimensionRows=0,transactionCountSum=0,transactionValueAedSum=0;
 for(const [index,row] of sourceRows.entries()){
  if(Object.keys(row).length!==LAND_DISPOSITION_FIELDS.length||LAND_DISPOSITION_FIELDS.some(field=>!Object.hasOwn(row,field)))throw Error('Land disposition schema mismatch');
  for(const field of LAND_DISPOSITION_FIELDS.slice(0,4))if(typeof row[field]!=='string'||!row[field].trim())throw Error('Land disposition district label invalid');
  const {year,quarter,transactions_count:count,total_transactions_value_in_aed:total,max_transactions_value_in_aed:max}=row;
  if(!Number.isSafeInteger(year)||year<2019||year>2026||!Number.isSafeInteger(quarter)||quarter<1||quarter>4||year===2026&&quarter>2||!Number.isSafeInteger(count)||count<1)throw Error('Land disposition period or count invalid');
  if(!Number.isFinite(total)||!Number.isFinite(max)||total<=0||max<=0||max>total)throw Error('Land disposition value invalid');
  const period=`${year}Q${quarter}`,dimension=JSON.stringify([row.sector_english,row.district_english,year,quarter]);
  periods.add(period);englishDistricts.add(row.district_english);arabicDistricts.add(row.district_arabic);
  if(dimensions.has(dimension))duplicateDimensionRows++;dimensions.add(dimension);
  transactionCountSum+=count;transactionValueAedSum+=total;
  rows.push({sourceRowIndex:index,sectorEnglish:row.sector_english,sectorArabic:row.sector_arabic,districtEnglish:row.district_english,districtArabic:row.district_arabic,totalTransactionValueAed:total,maxTransactionValueAed:max,transactionCount:count,year,quarter,period,propertyScope:'land',includesMortgageActivity:true,canonicalProjectId:null,coordinates:null});
 }
 const observedPeriods=[...periods].sort(),allPeriods=[];
 for(let year=2019;year<=2026;year++)for(let quarter=1;quarter<=4;quarter++){if(year===2026&&quarter>2)break;allPeriods.push(`${year}Q${quarter}`);}
 return {rows,quality:{rows:rows.length,observedPeriods,missingPeriods:allPeriods.filter(period=>!periods.has(period)),distinctEnglishDistricts:englishDistricts.size,distinctArabicDistricts:arabicDistricts.size,duplicateDimensionRows,transactionCountSum,transactionValueAedSum:Number(transactionValueAedSum.toFixed(2))}};
}

async function verifiedLandDispositionRows(report,packed){
 if(!AJMAN_LAND_DISPOSITIONS_ROWS||AJMAN_LAND_DISPOSITIONS_PACKED!==packed){AJMAN_LAND_DISPOSITIONS_PACKED=packed;AJMAN_LAND_DISPOSITIONS_ROWS=(async()=>{
  const binary=atob(packed),compressed=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)compressed[i]=binary.charCodeAt(i);
  if(compressed.byteLength!==report.compressedBytes||await landDispositionSha(compressed)!==report.compressedSha256)throw Error('Land disposition compressed checksum mismatch');
  const raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if(raw.byteLength!==report.rawBytes||await landDispositionSha(raw)!==report.rawSha256||report.independentReadbackSha256!==report.rawSha256)throw Error('Land disposition raw checksum mismatch');
  const sourceRows=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw)),verified=normalizeAjmanLandDispositions(sourceRows);
  if(JSON.stringify(verified.quality)!==JSON.stringify(report.quality))throw Error('Land disposition quality mismatch');
  return verified.rows;
 })().catch(error=>{AJMAN_LAND_DISPOSITIONS_ROWS=undefined;AJMAN_LAND_DISPOSITIONS_PACKED=undefined;throw error});}
 return AJMAN_LAND_DISPOSITIONS_ROWS;
}

export async function mapAjmanLandDispositions(request,report,packed){
 const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'');
 if(path!==AJMAN_LAND_DISPOSITIONS_PATH)return null;
 if(!['GET','HEAD'].includes(request.method))return landDispositionReply(request,{error:'Read-only endpoint'},405);
 const params=url.searchParams,year=params.has('year')?landDispositionInt(params.get('year'),2019,2026):null,quarter=params.has('quarter')?landDispositionInt(params.get('quarter'),1,4):null,limit=params.has('limit')?landDispositionInt(params.get('limit'),1,100):50,offset=params.has('offset')?landDispositionInt(params.get('offset'),0,report?.quality?.rows??0):0,district=(params.get('district')||'').trim();
 if(params.has('year')&&year===null||params.has('quarter')&&quarter===null||limit===null||offset===null||district.length>120)return landDispositionReply(request,{error:'Invalid year, quarter, district, limit, or offset.'},400);
 try{
  const rows=await verifiedLandDispositionRows(report,packed),needle=district.toLocaleLowerCase('en');
  const filtered=rows.filter(row=>(year===null||row.year===year)&&(quarter===null||row.quarter===quarter)&&(!needle||row.districtEnglish.toLocaleLowerCase('en')===needle||row.districtArabic===district));
  const source={id:report.sourceId,publisher:report.publisher,datasetUrl:report.datasetUrl,licence:report.licence,licenceUrl:report.licenceUrl,sourceModifiedAt:report.sourceModifiedAt,retrievedAt:report.retrievedAt,rawSha256:report.rawSha256,rows:report.quality.rows,storage:'checksum_verified_immutable_worker_snapshot'};
  const {transactionCountSum,transactionValueAedSum,...publicQuality}=report.quality;
  const scope={emirate:'Ajman',evidenceClass:report.evidenceClass,grain:report.grain,quality:publicQuality,projectCoordinatesPresent:false,overlapsOtherAjmanLandEvidence:true,limits:report.limits};
  return landDispositionReply(request,{source,scope,filters:{year,quarter,district:district||null},totalRows:filtered.length,limit,offset,rows:filtered.slice(offset,offset+limit)});
 }catch{return landDispositionReply(request,{error:'The verified Ajman land-disposition snapshot is temporarily unavailable.'},503);}
}
