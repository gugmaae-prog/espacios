const AJMAN_PERMISSION_MONTHS='January February March April May June July August September October November December'.split(' ');
const AJMAN_PERMISSION_USES=['Residential buildings','Non-residential buildings'];
const AJMAN_PERMISSION_CACHE=new Map();
const permissionDigest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
const permissionInt=(value,min,max)=>/^(0|[1-9]\d*)$/.test(value||'')&&Number.isSafeInteger(Number(value))&&Number(value)>=min&&Number(value)<=max?Number(value):null;
const permissionReply=(request,body,status=200,sourceId='ajman-new-building-permissions')=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public,max-age=60,s-maxage=300':'no-store','x-content-type-options':'nosniff','x-espacios-evidence-source':sourceId,...(status===405?{allow:'GET, HEAD'}:{})}});

async function verifiedPermissionRows(report,packed){
 const key=report.rawSha256+'|'+report.compressedSha256;
 if(!AJMAN_PERMISSION_CACHE.has(key))AJMAN_PERMISSION_CACHE.set(key,(async()=>{
  const compressed=Uint8Array.from(atob(packed),char=>char.charCodeAt(0));
  if(compressed.byteLength!==report.compressedBytes||await permissionDigest(compressed)!==report.compressedSha256)throw Error('Ajman permission compressed source mismatch');
  const raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if(raw.byteLength!==report.rawBytes||await permissionDigest(raw)!==report.rawSha256)throw Error('Ajman permission decoded source mismatch');
  const source=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
  if(!Array.isArray(source)||source.length!==report.sourceRows)throw Error('Ajman permission source population mismatch');
  const groups=new Map();
  for(const row of source){
   const month=AJMAN_PERMISSION_MONTHS.indexOf(row.month_en)+1,value=row[report.sourceValueField];
   if(!Number.isInteger(row.year)||row.year<2015||row.year>2026||month<1||!row.month_ar||row.service_en!=='New building permission'||!AJMAN_PERMISSION_USES.includes(row.category_1_en)||!row.category_1_ar||row.category_2_en!==(report.sourceUnit==='licences'?'No. of Licenses':'Built-up area')||typeof value!=='number'||!Number.isFinite(value)||value<0||report.sourceUnit==='licences'&&!Number.isSafeInteger(value))throw Error('Ajman permission source row invalid');
   const dimension=[row.year,month,row.category_1_en].join('|');groups.set(dimension,[...(groups.get(dimension)||[]),row]);
  }
  const conflicts=[...groups.values()].filter(group=>group.length>1),usable=[...groups.values()].filter(group=>group.length===1).map(group=>group[0]);
  if(groups.size!==report.distinctDimensionGroups||conflicts.length!==report.conflictingGroups||conflicts.reduce((n,group)=>n+group.length,0)!==report.conflictingSourceRows||usable.length!==report.usableRows)throw Error('Ajman permission quality profile mismatch');
  const rows=usable.map(row=>({period:`${row.year}-${String(AJMAN_PERMISSION_MONTHS.indexOf(row.month_en)+1).padStart(2,'0')}`,year:row.year,month:AJMAN_PERMISSION_MONTHS.indexOf(row.month_en)+1,monthEn:row.month_en,monthAr:row.month_ar,useEn:row.category_1_en,useAr:row.category_1_ar,value:row[report.sourceValueField],unit:report.sourceUnit,completeReportedDimensionYear:report.completeReportedDimensionYears.includes(row.year)})).sort((a,b)=>a.period.localeCompare(b.period)||a.useEn.localeCompare(b.useEn));
  const byYear=Object.fromEntries([...new Set(rows.map(row=>row.year))].sort((a,b)=>a-b).map(year=>[year,rows.filter(row=>row.year===year).length]));
  if(JSON.stringify(byYear)!==JSON.stringify(report.usableRowsByYear)||rows.at(-1)?.period!==report.latestReportedMonth)throw Error('Ajman permission period profile mismatch');
  return rows;
 })().catch(error=>{AJMAN_PERMISSION_CACHE.delete(key);throw error}));
 return AJMAN_PERMISSION_CACHE.get(key);
}

export async function mapAjmanNewBuildingMeasures(request,measures){
 const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'');
 const selected=measures.find(item=>item.report?.route===path);
 if(!selected)return null;
 const {report,packed}=selected;
 if(!['GET','HEAD'].includes(request.method))return permissionReply(request,{error:'Read-only endpoint'},405,report.sourceId);
 if(!report.rawSha256||typeof packed!=='string')return permissionReply(request,{error:'Verified Ajman permission source is not configured.'},503,report.sourceId);
 const params=url.searchParams,year=params.has('year')?permissionInt(params.get('year'),2015,2026):null,month=params.has('month')?permissionInt(params.get('month'),1,12):null,limit=params.has('limit')?permissionInt(params.get('limit'),1,200):100,offset=params.has('offset')?permissionInt(params.get('offset'),0,report.usableRows):0,use=params.get('use');
 if(params.has('year')&&year===null||params.has('month')&&month===null||limit===null||offset===null||use!==null&&!AJMAN_PERMISSION_USES.includes(use))return permissionReply(request,{error:'Invalid year, month, use, limit, or offset.'},400,report.sourceId);
 try{
  const rows=await verifiedPermissionRows(report,packed),matched=rows.filter(row=>(year===null||row.year===year)&&(month===null||row.month===month)&&(use===null||row.useEn===use));
  const replica=typeof UAE_IDRIVE_STORAGE_INVENTORY==='object'?UAE_IDRIVE_STORAGE_INVENTORY.sources.find(source=>source.id===report.sourceId)?.replica:null;
  return permissionReply(request,{source:{id:report.sourceId,publisher:report.publisher,datasetUrl:report.datasetUrl,licence:report.licence,licenceUrl:report.licenceUrl,sourceModifiedAt:report.sourceModifiedAt,retrievedAt:report.retrievedAt,rawSha256:report.rawSha256,storage:'checksum_verified_immutable_worker_snapshot',idriveReplica:replica||null},scope:{emirate:'Ajman',evidenceClass:report.evidenceClass,grain:report.grain,sourceUnit:report.sourceUnit,quality:{sourceRows:report.sourceRows,usableRows:report.usableRows,conflictingGroups:report.conflictingGroups,conflictingSourceRows:report.conflictingSourceRows,usableRowsByYear:report.usableRowsByYear,completeReportedDimensionYears:report.completeReportedDimensionYears,latestReportedMonth:report.latestReportedMonth},limits:report.limits,projectCoordinatesPresent:false,availableSpacesEstablished:false},filters:{year,month,use},uses:AJMAN_PERMISSION_USES,totalRows:matched.length,limit,offset,rows:matched.slice(offset,offset+limit)},200,report.sourceId);
 }catch{return permissionReply(request,{error:'The verified Ajman permission source is temporarily unavailable.'},503,report.sourceId);}
}
