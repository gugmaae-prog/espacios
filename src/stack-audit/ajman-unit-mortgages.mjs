const UNIT_MORTGAGE_PATH='/map/api/uae-evidence/ajman/unit-mortgages';
const UNIT_MORTGAGE_FIELDS=['project_name_english','project_name_arabic','sector_english','sector_arabic','district_english','district_arabic','unit_type_english','unit_type_arabic','rooms_count','total_mortgage_value_in_aed','mortgage_count','max_mortgage_value_in_aed','year','quarter'];
let UNIT_MORTGAGE_ROWS,UNIT_MORTGAGE_PACKED;
const unitMortgageSha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
const unitMortgageInt=(value,min,max)=>/^\d+$/.test(value||'')&&Number.isSafeInteger(Number(value))&&Number(value)>=min&&Number(value)<=max?Number(value):null;
const unitMortgageReply=(request,body,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public,max-age=60,s-maxage=300':'no-store','x-content-type-options':'nosniff','x-espacios-evidence-source':'ajman-dlrr-20260821-unit-mortgages',...(status===405?{allow:'GET, HEAD'}:{})}});

export function normalizeAjmanUnitMortgages(sourceRows){
 if(!Array.isArray(sourceRows))throw Error('Unit mortgage source is not an array');
 const rows=[],periods=new Set(),names=new Set(),districts=new Set(),types=new Set(),dimensions=new Set();
 let duplicateDimensionRows=0,unknownRoomRows=0,mortgageCountSum=0,mortgageValueAedSum=0;
 for(const [index,row] of sourceRows.entries()){
  if(Object.keys(row).length!==UNIT_MORTGAGE_FIELDS.length||UNIT_MORTGAGE_FIELDS.some(field=>!Object.hasOwn(row,field)))throw Error('Unit mortgage schema mismatch');
  for(const field of UNIT_MORTGAGE_FIELDS.slice(0,9))if(typeof row[field]!=='string'||!row[field].trim())throw Error('Unit mortgage label invalid');
  const {year,quarter,mortgage_count:count,total_mortgage_value_in_aed:total,max_mortgage_value_in_aed:max}=row;
  if(!Number.isSafeInteger(year)||year<2019||year>2026||!Number.isSafeInteger(quarter)||quarter<1||quarter>4||year===2026&&quarter>2||!Number.isSafeInteger(count)||count<1)throw Error('Unit mortgage period or count invalid');
  if(!Number.isFinite(total)||!Number.isFinite(max)||total<=0||max<=0||max>total)throw Error('Unit mortgage value invalid');
  const period=`${year}Q${quarter}`,dimension=JSON.stringify([row.project_name_english,row.district_english,row.unit_type_english,row.rooms_count,year,quarter]);
  periods.add(period);names.add(row.project_name_english);districts.add(row.district_english);types.add(row.unit_type_english);
  if(dimensions.has(dimension))duplicateDimensionRows++;dimensions.add(dimension);
  if(row.rooms_count==='unknown')unknownRoomRows++;
  mortgageCountSum+=count;mortgageValueAedSum+=total;
  rows.push({sourceRowIndex:index,projectNameEnglish:row.project_name_english,projectNameArabic:row.project_name_arabic,sectorEnglish:row.sector_english,sectorArabic:row.sector_arabic,districtEnglish:row.district_english,districtArabic:row.district_arabic,unitTypeEnglish:row.unit_type_english,unitTypeArabic:row.unit_type_arabic,roomsCount:row.rooms_count,totalMortgageValueAed:total,maxMortgageValueAed:max,mortgageCount:count,year,quarter,period,canonicalProjectId:null,coordinates:null});
 }
 const observedPeriods=[...periods].sort(),allPeriods=[];
 for(let year=2019;year<=2026;year++)for(let quarter=1;quarter<=4;quarter++){if(year===2026&&quarter>2)break;allPeriods.push(`${year}Q${quarter}`);}
 return {rows,quality:{rows:rows.length,observedPeriods,missingPeriods:allPeriods.filter(period=>!periods.has(period)),distinctSourceProjectLabels:names.size,distinctDistricts:districts.size,distinctUnitTypes:types.size,duplicateDimensionRows,unknownRoomRows,mortgageCountSum,mortgageValueAedSum}};
}

async function unitMortgageRowsFor(report,packed){
 if(!UNIT_MORTGAGE_ROWS||UNIT_MORTGAGE_PACKED!==packed){UNIT_MORTGAGE_PACKED=packed;UNIT_MORTGAGE_ROWS=(async()=>{
  const binary=atob(packed),compressed=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)compressed[i]=binary.charCodeAt(i);
  if(compressed.byteLength!==report.compressedBytes||await unitMortgageSha(compressed)!==report.compressedSha256)throw Error('Unit mortgage compressed checksum mismatch');
  const raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if(raw.byteLength!==report.rawBytes||await unitMortgageSha(raw)!==report.rawSha256||report.independentReadbackSha256!==report.rawSha256)throw Error('Unit mortgage raw checksum mismatch');
  const normalized=normalizeAjmanUnitMortgages(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw)));
  if(JSON.stringify(normalized.quality)!==JSON.stringify(report.quality))throw Error('Unit mortgage quality mismatch');
  return normalized.rows;
 })().catch(error=>{UNIT_MORTGAGE_ROWS=undefined;UNIT_MORTGAGE_PACKED=undefined;throw error});}
 return UNIT_MORTGAGE_ROWS;
}

export async function mapAjmanUnitMortgages(request,report,packed){
 const url=new URL(request.url);if(url.pathname.replace(/\/+$/,'')!==UNIT_MORTGAGE_PATH)return null;
 if(!['GET','HEAD'].includes(request.method))return unitMortgageReply(request,{error:'Read-only endpoint'},405);
 const p=url.searchParams,year=p.has('year')?unitMortgageInt(p.get('year'),2019,2026):null,quarter=p.has('quarter')?unitMortgageInt(p.get('quarter'),1,4):null,limit=p.has('limit')?unitMortgageInt(p.get('limit'),1,100):50,offset=p.has('offset')?unitMortgageInt(p.get('offset'),0,report?.quality?.rows??0):0,project=(p.get('project')||'').trim(),district=(p.get('district')||'').trim();
 if(p.has('year')&&year===null||p.has('quarter')&&quarter===null||limit===null||offset===null||project.length>120||district.length>120)return unitMortgageReply(request,{error:'Invalid year, quarter, project, district, limit, or offset.'},400);
 try{
  const rows=await unitMortgageRowsFor(report,packed),needle=project.toLocaleLowerCase('en'),area=district.toLocaleLowerCase('en');
  const filtered=rows.filter(row=>(year===null||row.year===year)&&(quarter===null||row.quarter===quarter)&&(!needle||row.projectNameEnglish.toLocaleLowerCase('en').includes(needle)||row.projectNameArabic.includes(project))&&(!area||row.districtEnglish.toLocaleLowerCase('en')===area||row.districtArabic===district));
  const source={id:report.sourceId,publisher:report.publisher,datasetUrl:report.datasetUrl,licence:report.licence,licenceUrl:report.licenceUrl,sourceModifiedAt:report.sourceModifiedAt,retrievedAt:report.retrievedAt,rawSha256:report.rawSha256,rows:report.quality.rows,storage:'checksum_verified_immutable_worker_snapshot'};
  const {mortgageCountSum,mortgageValueAedSum,...quality}=report.quality;
  const scope={emirate:'Ajman',evidenceClass:report.evidenceClass,grain:report.grain,quality,projectCoordinatesPresent:false,overlapsMixedUnitDispositions:true,limits:report.limits};
  return unitMortgageReply(request,{source,scope,filters:{year,quarter,project:project||null,district:district||null},totalRows:filtered.length,limit,offset,rows:filtered.slice(offset,offset+limit)});
 }catch{return unitMortgageReply(request,{error:'The verified Ajman unit-mortgage snapshot is temporarily unavailable.'},503);}
}
