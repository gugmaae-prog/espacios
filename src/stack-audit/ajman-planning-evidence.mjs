const AJMAN_PLANNING_MONTHS='January February March April May June July August September October November December'.split(' ');
const AJMAN_PLANNING_CITIES=new Map([
 ['number of land plots according to the main use in ajman city','Ajman City'],
 ['number of land plots according to the main use in masfout city','Masfout'],
 ['number of land plots according to the main use in manama city','Manama']
]);
const AJMAN_PLANNING_USES=['agricultural use','commercial use','industrial use','multi-use','recrational and touristic use','residential use'];
const AJMAN_PLANNING_TYPES=['Annexes','New','Others','Renewal'];
const AJMAN_PLANNING_CACHE=new Map();
const planningDigest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
const planningInt=(value,min,max)=>/^(0|[1-9]\d*)$/.test(value||'')&&Number.isSafeInteger(Number(value))&&Number(value)>=min&&Number(value)<=max?Number(value):null;
const planningReply=(request,body,status,sourceId)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public,max-age=60,s-maxage=300':'no-store','x-content-type-options':'nosniff','x-espacios-evidence-source':sourceId,...(status===405?{allow:'GET, HEAD'}:{})}});

async function verifiedPlanningRows(report,packed){
 const key=report.sourceId+'|'+report.rawSha256;
 if(!AJMAN_PLANNING_CACHE.has(key))AJMAN_PLANNING_CACHE.set(key,(async()=>{
  const compressed=Uint8Array.from(atob(packed),char=>char.charCodeAt(0));
  if(compressed.byteLength!==report.compressedBytes||await planningDigest(compressed)!==report.compressedSha256)throw Error('Ajman planning compressed source mismatch');
  const raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if(raw.byteLength!==report.rawBytes||await planningDigest(raw)!==report.rawSha256)throw Error('Ajman planning decoded source mismatch');
  const rows=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
  if(!Array.isArray(rows)||rows.length!==report.sourceRows)throw Error('Ajman planning source population mismatch');
  const isLicence=report.evidenceClass==='official_building_licence_count_by_licence_type',groups=new Map();
  for(const row of rows){
   const value=row[report.valueField];
   if(!Number.isSafeInteger(value)||value<0||!Number.isInteger(row.year))throw Error('Ajman planning source row invalid');
   let dimension;
   if(isLicence){
    const month=AJMAN_PLANNING_MONTHS.indexOf(row.month_en)+1;
    if(row.year<2015||row.year>2026||month<1||!row.month_ar||!AJMAN_PLANNING_TYPES.includes(row.type_of_license_ar)||!row.type_of_license_en)throw Error('Ajman licence dimension invalid');
    dimension=[row.year,month,row.type_of_license_ar].join('|');
   }else{
    if(row.year<2013||row.year>2019||!AJMAN_PLANNING_CITIES.has(row.service_en)||!row.service_ar||!AJMAN_PLANNING_USES.includes(row.contract_category_en)||!row.contract_category_ar)throw Error('Ajman site-plan dimension invalid');
    dimension=[row.year,row.service_en,row.contract_category_en].join('|');
   }
   groups.set(dimension,[...(groups.get(dimension)||[]),row]);
  }
  const conflicts=[...groups.values()].filter(group=>group.length>1),usable=[...groups.values()].filter(group=>group.length===1).map(group=>group[0]);
  if(groups.size!==report.distinctDimensionGroups||conflicts.length!==report.conflictingGroups||conflicts.reduce((n,group)=>n+group.length,0)!==report.conflictingSourceRows||usable.length!==report.usableRows)throw Error('Ajman planning quality profile mismatch');
  const projected=usable.map(row=>isLicence?{
   period:`${row.year}-${String(AJMAN_PLANNING_MONTHS.indexOf(row.month_en)+1).padStart(2,'0')}`,
   year:row.year,month:AJMAN_PLANNING_MONTHS.indexOf(row.month_en)+1,monthEn:row.month_en,monthAr:row.month_ar,
   licenceTypeEn:row.type_of_license_ar,licenceTypeAr:row.type_of_license_en,licenceCount:row[report.valueField]
  }:{year:row.year,city:AJMAN_PLANNING_CITIES.get(row.service_en),sourceCityLabelAr:row.service_ar,useEn:row.contract_category_en,useAr:row.contract_category_ar,reportedLandPlotCount:row[report.valueField]});
  projected.sort((a,b)=>isLicence?a.period.localeCompare(b.period)||a.licenceTypeEn.localeCompare(b.licenceTypeEn):a.year-b.year||a.city.localeCompare(b.city)||a.useEn.localeCompare(b.useEn));
  const byYear=Object.fromEntries([...new Set(projected.map(row=>row.year))].sort((a,b)=>a-b).map(year=>[year,projected.filter(row=>row.year===year).length]));
  const latest=isLicence?projected.at(-1)?.period:String(projected.at(-1)?.year);
  if(JSON.stringify(byYear)!==JSON.stringify(report.usableRowsByYear)||latest!==report.latestReportedPeriod)throw Error('Ajman planning period profile mismatch');
  return projected;
 })().catch(error=>{AJMAN_PLANNING_CACHE.delete(key);throw error}));
 return AJMAN_PLANNING_CACHE.get(key);
}

export async function mapAjmanPlanningEvidence(request,sources){
 const url=new URL(request.url),selected=sources.find(item=>item.report?.route===url.pathname.replace(/\/+$/,''));
 if(!selected)return null;
 const {report,packed}=selected,isLicence=report.evidenceClass==='official_building_licence_count_by_licence_type';
 if(!['GET','HEAD'].includes(request.method))return planningReply(request,{error:'Read-only endpoint'},405,report.sourceId);
 const params=url.searchParams,year=params.has('year')?planningInt(params.get('year'),isLicence?2015:2013,isLicence?2026:2019):null,
  month=params.has('month')?planningInt(params.get('month'),1,12):null,limit=params.has('limit')?planningInt(params.get('limit'),1,200):100,
  offset=params.has('offset')?planningInt(params.get('offset'),0,report.usableRows):0,
  type=params.get('type'),city=params.get('city'),use=params.get('use');
 if(params.has('year')&&year===null||params.has('month')&&(month===null||!isLicence)||limit===null||offset===null||type!==null&&(!isLicence||!AJMAN_PLANNING_TYPES.includes(type))||city!==null&&(isLicence||![...AJMAN_PLANNING_CITIES.values()].includes(city))||use!==null&&(isLicence||!AJMAN_PLANNING_USES.includes(use)))return planningReply(request,{error:'Invalid year, month, type, city, use, limit, or offset.'},400,report.sourceId);
 try{
  const rows=await verifiedPlanningRows(report,packed),matched=rows.filter(row=>(year===null||row.year===year)&&(month===null||row.month===month)&&(type===null||row.licenceTypeEn===type)&&(city===null||row.city===city)&&(use===null||row.useEn===use));
  const replica=typeof UAE_IDRIVE_STORAGE_INVENTORY==='object'?UAE_IDRIVE_STORAGE_INVENTORY.sources.find(source=>source.id===report.sourceId)?.replica:null;
  return planningReply(request,{source:{id:report.sourceId,publisher:report.publisher,datasetUrl:report.datasetUrl,licence:report.licence,licenceUrl:report.licenceUrl,sourceModifiedAt:report.sourceModifiedAt,retrievedAt:report.retrievedAt,rawSha256:report.rawSha256,storage:'checksum_verified_immutable_worker_snapshot',idriveReplica:replica||null},scope:{emirate:'Ajman',evidenceClass:report.evidenceClass,grain:report.grain,quality:{sourceRows:report.sourceRows,usableRows:report.usableRows,conflictingGroups:report.conflictingGroups,conflictingSourceRows:report.conflictingSourceRows,usableRowsByYear:report.usableRowsByYear,latestReportedPeriod:report.latestReportedPeriod},limits:report.limits,projectCoordinatesPresent:false,availableSpacesEstablished:false},filters:{year,month,type,city,use},totalRows:matched.length,limit,offset,rows:matched.slice(offset,offset+limit)},200,report.sourceId);
 }catch{return planningReply(request,{error:'The verified Ajman planning source is temporarily unavailable.'},503,report.sourceId);}
}
