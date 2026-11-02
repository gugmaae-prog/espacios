const AJMAN_RENT_CONTRACTS_PATH='/map/api/uae-evidence/ajman/rent-contracts';
const AJMAN_RENT_MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const AJMAN_RENT_CITIES=['ajman','manama','masfoot'];
const AJMAN_RENT_FIELDS=['year','month_ar','month_en','service_ar','service_en','contract_category_ar','contract_category_en','contract_type_ar','contract_type_en'];
const ajmanRentCache=new Map();
const ajmanRentSha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
const ajmanRentInteger=(value,min,max)=>/^\d+$/.test(value||'')&&Number.isSafeInteger(Number(value))&&Number(value)>=min&&Number(value)<=max?Number(value):null;
const ajmanRentReply=(request,body,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public,max-age=60,s-maxage=300':'no-store','x-content-type-options':'nosniff','x-espacios-evidence-source':'ajman-municipality-certified-rent-contracts',...(status===405?{allow:'GET, HEAD'}:{})}});

export function normalizeAjmanRentContracts(sourceRows,city){
 if(!AJMAN_RENT_CITIES.includes(city)||!Array.isArray(sourceRows))throw Error('Invalid Ajman rent-contract source');
 const countField=city==='masfoot'?'total_of_certified_rent_contracts_in_masfout_city':`total_of_certified_rent_contracts_in_${city}_city`;
 const rows=[],periods=new Map(),dimensions=new Set(),unavailableTokens={};
 let duplicateDimensionRows=0,zeroCountRows=0;
 for(const [index,row] of sourceRows.entries()){
  if(Object.keys(row).length!==AJMAN_RENT_FIELDS.length+1||AJMAN_RENT_FIELDS.some(field=>!Object.hasOwn(row,field))||!Object.hasOwn(row,countField))throw Error('Rent-contract schema mismatch');
  const year=typeof row.year==='string'?ajmanRentInteger(row.year,2016,2026):row.year;
  const month=AJMAN_RENT_MONTHS.indexOf(row.month_en)+1;
  if(!Number.isSafeInteger(year)||year<2016||year>2026||!month)throw Error('Rent-contract period invalid');
  for(const field of AJMAN_RENT_FIELDS.slice(1))if(typeof row[field]!=='string'||!row[field].trim())throw Error('Rent-contract label invalid');
  const token=row[countField],reportedContracts=typeof token==='string'&&/^\d+$/.test(token)?Number(token):null;
  if(typeof token!=='string'||reportedContracts!==null&&!Number.isSafeInteger(reportedContracts)||reportedContracts===null&&!['NA','#REF!'].includes(token))throw Error('Rent-contract count invalid');
  if(token==='0')zeroCountRows++;
  if(reportedContracts===null)unavailableTokens[token]=(unavailableTokens[token]||0)+1;
  const period=`${year}-${String(month).padStart(2,'0')}`;
  periods.set(period,(periods.get(period)||0)+1);
  const dimension=JSON.stringify([period,row.service_en,row.contract_category_en,row.contract_type_en]);
  if(dimensions.has(dimension))duplicateDimensionRows++;
  dimensions.add(dimension);
  rows.push({sourceRowIndex:index,city,year,month,period,monthEnglish:row.month_en,monthArabic:row.month_ar,serviceEnglish:row.service_en,serviceArabic:row.service_ar,categoryEnglish:row.contract_category_en,categoryArabic:row.contract_category_ar,contractTypeEnglish:row.contract_type_en,contractTypeArabic:row.contract_type_ar,reportedContracts,sourceCountToken:token,valueStatus:reportedContracts===null?'source_unavailable':'reported',canonicalProjectId:null,coordinates:null});
 }
 const observedMonths=[...periods.keys()].sort();
 const quality={rows:rows.length,observedMonthStart:observedMonths[0],observedMonthEnd:observedMonths.at(-1),observedMonths:observedMonths.length,minimumRowsPerReportedMonth:Math.min(...periods.values()),maximumRowsPerReportedMonth:Math.max(...periods.values()),duplicateDimensionRows,zeroCountRows,unavailableTokens};
 return {rows,quality};
}

async function ajmanVerifiedRentRows(source,packed){
 const entry=ajmanRentCache.get(source.city);
 if(entry?.packed===packed)return entry.promise;
 const promise=(async()=>{
  const binary=atob(packed),compressed=Uint8Array.from(binary,x=>x.charCodeAt(0));
  if(compressed.byteLength!==source.compressedBytes||await ajmanRentSha(compressed)!==source.compressedSha256)throw Error('Rent-contract compressed checksum mismatch');
  const raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if(raw.byteLength!==source.rawBytes||await ajmanRentSha(raw)!==source.rawSha256||source.independentReadbackSha256!==source.rawSha256)throw Error('Rent-contract raw checksum mismatch');
  const verified=normalizeAjmanRentContracts(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw)),source.city);
  if(JSON.stringify(verified.quality)!==JSON.stringify(source.quality))throw Error('Rent-contract quality mismatch');
  return verified.rows;
 })().catch(error=>{ajmanRentCache.delete(source.city);throw error});
 ajmanRentCache.set(source.city,{packed,promise});return promise;
}

export async function mapAjmanRentContracts(request,report,packed){
 const url=new URL(request.url);
 if(url.pathname.replace(/\/+$/,'')!==AJMAN_RENT_CONTRACTS_PATH)return null;
 if(!['GET','HEAD'].includes(request.method))return ajmanRentReply(request,{error:'Read-only endpoint'},405);
 const sources=report.sources.map(source=>({id:source.id,city:source.city,cityName:source.cityName,publisher:source.publisher,datasetUrl:source.datasetUrl,licence:source.licence,licenceUrl:source.licenceUrl,sourceModifiedAt:source.sourceModifiedAt,retrievedAt:source.retrievedAt,rawSha256:source.rawSha256,rows:source.quality.rows,quality:source.quality}));
 const params=url.searchParams,city=params.get('city');
 if(city===null)return ajmanRentReply(request,{sources,scope:report.scope,selectCity:'Use city=ajman, city=manama, or city=masfoot to read a source. No cross-city sum is supplied.'});
 const source=report.sources.find(item=>item.city===city),index=AJMAN_RENT_CITIES.indexOf(city);
 if(!source||index<0)return ajmanRentReply(request,{error:'Unknown city. Choose ajman, manama, or masfoot.'},400);
 const year=params.has('year')?ajmanRentInteger(params.get('year'),2016,2026):null,month=params.has('month')?ajmanRentInteger(params.get('month'),1,12):null,limit=params.has('limit')?ajmanRentInteger(params.get('limit'),1,100):50,offset=params.has('offset')?ajmanRentInteger(params.get('offset'),0,source.quality.rows):0,category=(params.get('category')||'').trim();
 if(params.has('year')&&year===null||params.has('month')&&month===null||limit===null||offset===null||category.length>120)return ajmanRentReply(request,{error:'Invalid year, month, category, limit, or offset.'},400);
 try{
  const rows=await ajmanVerifiedRentRows(source,packed[index]);
  const filtered=rows.filter(row=>(year===null||row.year===year)&&(month===null||row.month===month)&&(!category||row.categoryEnglish.toLowerCase()===category.toLowerCase()||row.categoryArabic===category));
  return ajmanRentReply(request,{source:sources[index],scope:report.scope,filters:{city,year,month,category:category||null},totalRows:filtered.length,limit,offset,rows:filtered.slice(offset,offset+limit)});
 }catch{return ajmanRentReply(request,{error:'The verified Ajman rent-contract snapshot is temporarily unavailable.'},503);}
}
