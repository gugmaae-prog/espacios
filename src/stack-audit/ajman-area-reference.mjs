const AJMAN_AREA_REFERENCE_PATH='/map/api/uae-evidence/ajman/areas';
let AJMAN_AREA_REFERENCE_ROWS;
const areaDigest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
const areaInt=(value,min,max)=>/^\d+$/.test(value||'')&&Number.isSafeInteger(Number(value))&&Number(value)>=min&&Number(value)<=max?Number(value):null;
const areaReply=(request,body,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public,max-age=60,s-maxage=300':'no-store','x-content-type-options':'nosniff','x-espacios-evidence-source':'ajman-mpd-20231003-area-reference',...(status===405?{allow:'GET, HEAD'}:{})}});

async function verifiedAreaReferenceRows(report,packed){
 if(!AJMAN_AREA_REFERENCE_ROWS)AJMAN_AREA_REFERENCE_ROWS=(async()=>{
  const compressed=Uint8Array.from(atob(packed),char=>char.charCodeAt(0));
  if(compressed.byteLength!==report.compressedBytes||await areaDigest(compressed)!==report.compressedSha256)throw Error('Ajman area-reference compressed checksum mismatch');
  const raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if(raw.byteLength!==report.rawBytes||await areaDigest(raw)!==report.rawSha256)throw Error('Ajman area-reference decoded checksum mismatch');
  const rows=JSON.parse(new TextDecoder().decode(raw));
  if(!Array.isArray(rows)||rows.length!==report.rows)throw Error('Ajman area-reference row count mismatch');
  const names=new Set();
  for(const row of rows){
   const lat=Number(row.latitude),lon=Number(row.longitude);
   if(typeof row.area_in_ajman!=='string'||!row.area_in_ajman.trim()||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<25.2||lat>25.6||lon<55.3||lon>55.8||Math.abs(row.geopoint?.lat-lat)>1e-8||Math.abs(row.geopoint?.lon-lon)>1e-8||names.has(row.area_in_ajman))throw Error('Ajman area-reference row invalid');
   names.add(row.area_in_ajman);
  }
  if(names.size!==report.distinctAreaNames)throw Error('Ajman area-reference population mismatch');
  return rows;
 })().catch(error=>{AJMAN_AREA_REFERENCE_ROWS=undefined;throw error});
 return AJMAN_AREA_REFERENCE_ROWS;
}

export async function mapAjmanAreaReference(request,report,packed){
 const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'');
 if(path!==AJMAN_AREA_REFERENCE_PATH)return null;
 if(!['GET','HEAD'].includes(request.method))return areaReply(request,{error:'Read-only endpoint'},405);
 if(!report?.rawSha256||typeof packed!=='string')return areaReply(request,{error:'Verified Ajman area-reference source is not configured.'},503);
 const params=url.searchParams,q=(params.get('q')||'').trim(),limit=params.has('limit')?areaInt(params.get('limit'),1,100):50,offset=params.has('offset')?areaInt(params.get('offset'),0,report.rows):0;
 if(q.length>120||limit===null||offset===null)return areaReply(request,{error:'Invalid q, limit, or offset.'},400);
 try{
  const rows=await verifiedAreaReferenceRows(report,packed),query=q.toLocaleLowerCase('en');
  const matches=rows.filter(row=>!query||row.area_in_ajman.toLocaleLowerCase('en').includes(query)).sort((a,b)=>a.area_in_ajman.localeCompare(b.area_in_ajman));
  const source={id:report.sourceId,publisher:report.publisher,datasetUrl:report.datasetUrl,licence:report.licence,licenceUrl:report.licenceUrl,sourceModifiedAt:report.sourceModifiedAt,retrievedAt:report.retrievedAt,rawSha256:report.rawSha256,rows:report.rows,grain:report.grain,storage:'checksum_verified_immutable_worker_snapshot'};
  const scope={emirate:'Ajman',evidenceClass:report.evidenceClass,canonicalProjectMatches:0,projectCoordinatesPresent:false,limits:'These 20 labelled area reference points are dated geographic context. They are not project coordinates, cadastral boundaries, verified district centroids, or a complete Ajman project census.'};
  return areaReply(request,{source,scope,filters:{q:q||null},totalRows:matches.length,limit,offset,rows:matches.slice(offset,offset+limit).map(row=>({areaName:row.area_in_ajman,referencePoint:{latitude:Number(row.latitude),longitude:Number(row.longitude)},locationKind:'area_reference_point',projectId:null}))});
 }catch{return areaReply(request,{error:'The verified Ajman area-reference source is temporarily unavailable.'},503);}
}
