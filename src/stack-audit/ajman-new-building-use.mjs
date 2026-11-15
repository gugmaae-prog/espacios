const AJMAN_NEW_BUILDING_USE_PATH='/map/api/uae-evidence/ajman/new-building-use';
const AJMAN_NEW_BUILDING_MONTHS='January February March April May June July August September October November December'.split(' ');
let AJMAN_NEW_BUILDING_ROWS;
const newBuildingDigest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
const newBuildingInt=(value,min,max)=>/^\d+$/.test(value||'')&&Number.isSafeInteger(Number(value))&&Number(value)>=min&&Number(value)<=max?Number(value):null;
const newBuildingReply=(request,body,status=200,sourceId='ajman-mpd-20260923-new-building-use')=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public,max-age=60,s-maxage=300':'no-store','x-content-type-options':'nosniff','x-espacios-evidence-source':sourceId,...(status===405?{allow:'GET, HEAD'}:{})}});

async function verifiedNewBuildingRows(report,packed){
 if(!AJMAN_NEW_BUILDING_ROWS)AJMAN_NEW_BUILDING_ROWS=(async()=>{
  const compressed=Uint8Array.from(atob(packed),char=>char.charCodeAt(0));
  if(compressed.byteLength!==report.compressedBytes||await newBuildingDigest(compressed)!==report.compressedSha256)throw Error('Ajman new-building compressed checksum mismatch');
  const raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if(raw.byteLength!==report.rawBytes||await newBuildingDigest(raw)!==report.rawSha256)throw Error('Ajman new-building decoded checksum mismatch');
  const source=JSON.parse(new TextDecoder().decode(raw));
  if(!Array.isArray(source)||source.length!==report.sourceRows)throw Error('Ajman new-building row count mismatch');
  const groups=new Map();
  for(const row of source){
   const month=AJMAN_NEW_BUILDING_MONTHS.indexOf(row.month_en)+1;
   if(!Number.isInteger(row.year)||row.year<2015||row.year>2026||month<1||row.service_en!=='New building permission'||row.category_2_en!=='No. of buildings'||!['Residential buildings','Non-residential buildings'].includes(row.category_1_en)||!Number.isSafeInteger(row.value)||row.value<0)throw Error('Ajman new-building source row invalid');
   const key=[row.year,month,row.category_1_en].join('|');groups.set(key,[...(groups.get(key)||[]),row]);
  }
  const conflicts=[...groups.values()].filter(group=>group.length>1),usable=[...groups.values()].filter(group=>group.length===1).map(group=>group[0]);
  if(groups.size!==report.distinctDimensionGroups||conflicts.length!==report.conflictingGroups||conflicts.reduce((n,group)=>n+group.length,0)!==report.conflictingSourceRows||usable.length!==report.usableRows)throw Error('Ajman new-building quality profile mismatch');
  const byYear=Object.fromEntries([...new Set(usable.map(row=>row.year))].sort((a,b)=>a-b).map(year=>[year,usable.filter(row=>row.year===year).length]));
  if(JSON.stringify(byYear)!==JSON.stringify(report.usableRowsByYear))throw Error('Ajman new-building observed years mismatch');
  return usable.map(row=>({period:`${row.year}-${String(AJMAN_NEW_BUILDING_MONTHS.indexOf(row.month_en)+1).padStart(2,'0')}`,year:row.year,month:AJMAN_NEW_BUILDING_MONTHS.indexOf(row.month_en)+1,monthEn:row.month_en,monthAr:row.month_ar,useEn:row.category_1_en,useAr:row.category_1_ar,buildingCount:row.value,yearComplete:report.completeYears.includes(row.year)})).sort((a,b)=>a.period.localeCompare(b.period)||a.useEn.localeCompare(b.useEn));
 })().catch(error=>{AJMAN_NEW_BUILDING_ROWS=undefined;throw error});
 return AJMAN_NEW_BUILDING_ROWS;
}

export async function mapAjmanNewBuildingUse(request,report,packed){
 const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'');
 if(path!==AJMAN_NEW_BUILDING_USE_PATH)return null;
 if(!['GET','HEAD'].includes(request.method))return newBuildingReply(request,{error:'Read-only endpoint'},405,report?.sourceId);
 if(!report?.rawSha256||typeof packed!=='string')return newBuildingReply(request,{error:'Verified Ajman new-building source is not configured.'},503,report?.sourceId);
 const params=url.searchParams,year=params.has('year')?newBuildingInt(params.get('year'),2015,2026):null,month=params.has('month')?newBuildingInt(params.get('month'),1,12):null,limit=params.has('limit')?newBuildingInt(params.get('limit'),1,200):100,offset=params.has('offset')?newBuildingInt(params.get('offset'),0,report.usableRows):0,use=params.get('use');
 if(params.has('year')&&year===null||params.has('month')&&month===null||limit===null||offset===null||use!==null&&!['Residential buildings','Non-residential buildings'].includes(use))return newBuildingReply(request,{error:'Invalid year, month, use, limit, or offset.'},400,report.sourceId);
 try{
  const rows=await verifiedNewBuildingRows(report,packed),matched=rows.filter(row=>(year===null||row.year===year)&&(month===null||row.month===month)&&(use===null||row.useEn===use));
  return newBuildingReply(request,{source:{id:report.sourceId,publisher:report.publisher,datasetUrl:report.datasetUrl,licence:report.licence,licenceUrl:report.licenceUrl,sourceModifiedAt:report.sourceModifiedAt,retrievedAt:report.retrievedAt,rawSha256:report.rawSha256,storage:'checksum_verified_immutable_worker_snapshot'},scope:{emirate:'Ajman',evidenceClass:report.evidenceClass,grain:report.grain,quality:{sourceRows:report.sourceRows,usableRows:report.usableRows,conflictingGroups:report.conflictingGroups,conflictingSourceRows:report.conflictingSourceRows,usableRowsByYear:report.usableRowsByYear,completeYears:report.completeYears,latestCompleteYear:report.latestCompleteYear,latestReportedMonth:report.latestReportedMonth},limits:report.limits,projectCoordinatesPresent:false,canonicalProjectMatches:0},filters:{year,month,use},uses:['Residential buildings','Non-residential buildings'],totalRows:matched.length,limit,offset,rows:matched.slice(offset,offset+limit)},200,report.sourceId);
 }catch{return newBuildingReply(request,{error:'The verified Ajman new-building source is temporarily unavailable.'},503,report.sourceId);}
}
