const AD_BUILDING_USE_PATH='/map/api/uae-evidence/abu-dhabi/building-uses';
let AD_BUILDING_USE_ROWS;
const adBuildingDigest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
const adBuildingInt=(value,min,max)=>/^\d+$/.test(value||'')&&Number.isSafeInteger(Number(value))&&Number(value)>=min&&Number(value)<=max?Number(value):null;
const adBuildingReply=(request,body,status=200,sourceId='ad-sdi-building-use-20261109')=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public,max-age=60,s-maxage=300':'no-store','x-content-type-options':'nosniff','x-espacios-evidence-source':sourceId,...(status===405?{allow:'GET, HEAD'}:{})}});

async function verifiedAdBuildingUseRows(report,packed){
 if(!AD_BUILDING_USE_ROWS)AD_BUILDING_USE_ROWS=(async()=>{
  const compressed=Uint8Array.from(atob(packed),char=>char.charCodeAt(0));
  if(compressed.byteLength!==report.compressedBytes||await adBuildingDigest(compressed)!==report.compressedSha256)throw Error('AD-SDI building-use compressed checksum mismatch');
  const raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if(raw.byteLength!==report.canonicalBytes||await adBuildingDigest(raw)!==report.canonicalSha256)throw Error('AD-SDI building-use canonical checksum mismatch');
  const rows=JSON.parse(new TextDecoder().decode(raw));
  if(!Array.isArray(rows)||rows.length!==report.groupRows)throw Error('AD-SDI building-use group count mismatch');
  const keys=new Set();let total=0,unknown=0;
  for(const row of rows){
   if(!['ADM','AAM','WRM'].includes(row.municipalityCode)||row.primaryUse!==null&&(typeof row.primaryUse!=='string'||!row.primaryUse.trim())||!Number.isSafeInteger(row.featureCount)||row.featureCount<1)throw Error('AD-SDI building-use row invalid');
   const key=JSON.stringify([row.municipalityCode,row.primaryUse]);if(keys.has(key))throw Error('AD-SDI building-use group repeated');keys.add(key);
   total+=row.featureCount;if(row.primaryUse===null||row.primaryUse==='UNDEFINED')unknown+=row.featureCount;
  }
  if(total!==report.layerFeatureCount||unknown!==report.unknownUseFeatures||total-unknown!==report.knownUseFeatures)throw Error('AD-SDI building-use quality profile mismatch');
  const byMunicipality=Object.fromEntries(report.municipalityCodes.map(code=>[code,rows.filter(row=>row.municipalityCode===code).reduce((n,row)=>n+row.featureCount,0)]));
  if(JSON.stringify(byMunicipality)!==JSON.stringify(report.byMunicipality))throw Error('AD-SDI building-use municipality totals differ');
  return rows;
 })().catch(error=>{AD_BUILDING_USE_ROWS=undefined;throw error});
 return AD_BUILDING_USE_ROWS;
}

export async function mapAbuDhabiBuildingUses(request,report,packed){
 const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'');
 if(path!==AD_BUILDING_USE_PATH)return null;
 if(!['GET','HEAD'].includes(request.method))return adBuildingReply(request,{error:'Read-only endpoint'},405,report?.sourceId);
 if(!report?.canonicalSha256||typeof packed!=='string')return adBuildingReply(request,{error:'Verified AD-SDI building-use source is not configured.'},503,report?.sourceId);
 const params=url.searchParams,municipality=params.get('municipality'),use=params.get('use'),q=params.get('q'),limit=params.has('limit')?adBuildingInt(params.get('limit'),1,200):100,offset=params.has('offset')?adBuildingInt(params.get('offset'),0,report.groupRows):0;
 if(municipality!==null&&!report.municipalityCodes.includes(municipality)||use!==null&&use.length>100||q!==null&&q.length>100||limit===null||offset===null)return adBuildingReply(request,{error:'Invalid municipality, use, q, limit, or offset.'},400,report.sourceId);
 try{
  const rows=await verifiedAdBuildingUseRows(report,packed),uses=[...new Set(rows.map(row=>row.primaryUse).filter(Boolean))].sort();
  if(use!==null&&!uses.includes(use))return adBuildingReply(request,{error:'Unknown source use label.',useLabels:uses},400,report.sourceId);
  const search=q?.trim().toLocaleLowerCase('en')||null;
  const matched=rows.filter(row=>(municipality===null||row.municipalityCode===municipality)&&(use===null||row.primaryUse===use)&&(search===null||row.primaryUse?.toLocaleLowerCase('en').includes(search)));
  return adBuildingReply(request,{source:{id:report.sourceId,publisher:report.publisher,attribution:report.attribution,sourceLayerUrl:report.sourceLayerUrl,termsUrl:report.termsUrl,retrievedAt:report.retrievedAt,canonicalSha256:report.canonicalSha256,storage:'checksum_verified_immutable_worker_snapshot'},scope:{emirate:report.emirate,evidenceClass:report.evidenceClass,grain:report.grain,quality:{layerFeatureCount:report.layerFeatureCount,groupRows:report.groupRows,unknownUseFeatures:report.unknownUseFeatures,knownUseFeatures:report.knownUseFeatures,byMunicipality:report.byMunicipality},limits:report.limits,featureGeometryIncluded:false,projectCoordinatesPresent:false,canonicalProjectMatches:0},filters:{municipality,use,q:search},municipalityCodes:report.municipalityCodes,totalRows:matched.length,matchedFeatureCount:matched.reduce((n,row)=>n+row.featureCount,0),limit,offset,rows:matched.slice(offset,offset+limit)},200,report.sourceId);
 }catch{return adBuildingReply(request,{error:'The verified AD-SDI building-use source is temporarily unavailable.'},503,report.sourceId);}
}
