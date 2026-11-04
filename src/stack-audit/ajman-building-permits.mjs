const AJMAN_BUILDING_PERMITS_PATH='/map/api/uae-evidence/ajman/building-permits';
const AJMAN_BUILDING_MONTHS='January February March April May June July August September October November December'.split(' ');
let AJMAN_BUILDING_PERMIT_ROWS;
const buildingDigest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
const buildingInt=(value,min,max)=>/^\d+$/.test(value||'')&&Number.isSafeInteger(Number(value))&&Number(value)>=min&&Number(value)<=max?Number(value):null;
const buildingReply=(request,body,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public,max-age=60,s-maxage=300':'no-store','x-content-type-options':'nosniff','x-espacios-evidence-source':'ajman-mpd-20260901-building-permits-by-type',...(status===405?{allow:'GET, HEAD'}:{})}});

async function verifiedBuildingPermitRows(report,packed){
 if(!AJMAN_BUILDING_PERMIT_ROWS)AJMAN_BUILDING_PERMIT_ROWS=(async()=>{
  const compressed=Uint8Array.from(atob(packed),char=>char.charCodeAt(0));
  if(compressed.byteLength!==report.compressedBytes||await buildingDigest(compressed)!==report.compressedSha256)throw Error('Ajman building permit compressed checksum mismatch');
  const raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if(raw.byteLength!==report.rawBytes||await buildingDigest(raw)!==report.rawSha256)throw Error('Ajman building permit decoded checksum mismatch');
  const source=JSON.parse(new TextDecoder().decode(raw));
  if(!Array.isArray(source)||source.length!==report.sourceRows)throw Error('Ajman building permit source row count mismatch');
  const groups=new Map();
  for(const row of source){
   const month=AJMAN_BUILDING_MONTHS.indexOf(row.month_en)+1,count=row.number_of_building_permits_issued_by_type_of_building;
   if(!Number.isInteger(row.year)||row.year<2015||row.year>2026||month<1||typeof row.month_ar!=='string'||row.building_type_en!==null&&typeof row.building_type_en!=='string'||row.building_type_ar!==null&&typeof row.building_type_ar!=='string'||count!==null&&(!Number.isSafeInteger(count)||count<0))throw Error('Ajman building permit row invalid');
   const key=[row.year,month,row.building_type_en].join('|');groups.set(key,[...(groups.get(key)||[]),row]);
  }
  const conflicts=[...groups.values()].filter(group=>group.length>1),clean=[...groups.values()].filter(group=>group.length===1).map(group=>group[0]),usable=clean.filter(row=>row.number_of_building_permits_issued_by_type_of_building!==null);
  if(groups.size!==report.distinctDimensionGroups||conflicts.length!==report.conflictingGroups||conflicts.reduce((n,group)=>n+group.length,0)!==report.conflictingSourceRows||clean.length-usable.length!==report.nullCountRows||usable.length!==report.usableRows||usable.some(row=>!row.building_type_en||!row.building_type_ar))throw Error('Ajman building permit quality profile mismatch');
  const counts=Object.fromEntries([...new Set(usable.map(row=>row.year))].sort((a,b)=>a-b).map(year=>[year,usable.filter(row=>row.year===year).length]));
  if(JSON.stringify(counts)!==JSON.stringify(report.usableRowsByYear))throw Error('Ajman building permit observed years mismatch');
  return usable.map(row=>({period:`${row.year}-${String(AJMAN_BUILDING_MONTHS.indexOf(row.month_en)+1).padStart(2,'0')}`,year:row.year,month:AJMAN_BUILDING_MONTHS.indexOf(row.month_en)+1,monthEn:row.month_en,monthAr:row.month_ar,buildingTypeEn:row.building_type_en,buildingTypeAr:row.building_type_ar,permitCount:row.number_of_building_permits_issued_by_type_of_building,yearComplete:report.completeYears.includes(row.year)})).sort((a,b)=>a.period.localeCompare(b.period)||a.buildingTypeEn.localeCompare(b.buildingTypeEn));
 })().catch(error=>{AJMAN_BUILDING_PERMIT_ROWS=undefined;throw error});
 return AJMAN_BUILDING_PERMIT_ROWS;
}

export async function mapAjmanBuildingPermits(request,report,packed){
 const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'');
 if(path!==AJMAN_BUILDING_PERMITS_PATH)return null;
 if(!['GET','HEAD'].includes(request.method))return buildingReply(request,{error:'Read-only endpoint'},405);
 if(!report?.rawSha256||typeof packed!=='string')return buildingReply(request,{error:'Verified Ajman building permit source is not configured.'},503);
 const params=url.searchParams,year=params.has('year')?buildingInt(params.get('year'),2015,2026):null,month=params.has('month')?buildingInt(params.get('month'),1,12):null,limit=params.has('limit')?buildingInt(params.get('limit'),1,200):100,offset=params.has('offset')?buildingInt(params.get('offset'),0,report.usableRows):0,type=params.get('type');
 if(params.has('year')&&year===null||params.has('month')&&month===null||limit===null||offset===null||type!==null&&type.length>100)return buildingReply(request,{error:'Invalid year, month, type, limit, or offset.'},400);
 try{
  const rows=await verifiedBuildingPermitRows(report,packed),types=[...new Set(rows.map(row=>row.buildingTypeEn))].sort();
  if(type!==null&&!types.includes(type))return buildingReply(request,{error:'Invalid building type.',types},400);
  const matched=rows.filter(row=>(year===null||row.year===year)&&(month===null||row.month===month)&&(type===null||row.buildingTypeEn===type));
  return buildingReply(request,{source:{id:report.sourceId,publisher:report.publisher,datasetUrl:report.datasetUrl,licence:report.licence,licenceUrl:report.licenceUrl,sourceModifiedAt:report.sourceModifiedAt,retrievedAt:report.retrievedAt,rawSha256:report.rawSha256,storage:'checksum_verified_immutable_worker_snapshot'},scope:{emirate:'Ajman',evidenceClass:report.evidenceClass,grain:report.grain,quality:{sourceRows:report.sourceRows,usableRows:report.usableRows,conflictingGroups:report.conflictingGroups,conflictingSourceRows:report.conflictingSourceRows,nullCountRows:report.nullCountRows,completeYears:report.completeYears,usableRowsByYear:report.usableRowsByYear},limits:report.limits,projectCoordinatesPresent:false,canonicalProjectMatches:0},filters:{year,month,type},types,totalRows:matched.length,limit,offset,rows:matched.slice(offset,offset+limit)});
 }catch{return buildingReply(request,{error:'The verified Ajman building-permit source is temporarily unavailable.'},503);}
}
