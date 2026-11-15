const ABU_DHABI_URBAN_BASE='/map/api/uae-evidence/abu-dhabi/urban-projects';
const ABU_DHABI_URBAN_RAW_SHA='68bb6355c7847fba5f32bbe38f965b883f2e02ff60a56517d54d67c3ef5caa94';
let ABU_DHABI_URBAN_ROWS,ABU_DHABI_URBAN_PACKED;
const urbanHex=bytes=>Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
const urbanDigest=async bytes=>urbanHex(await crypto.subtle.digest('SHA-256',bytes));
const urbanInt=(value,min,max)=>/^\d+$/.test(value||'')&&Number.isSafeInteger(Number(value))&&Number(value)>=min&&Number(value)<=max?Number(value):null;
const urbanReply=(request,body,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public,max-age=60,s-maxage=300':'no-store','x-content-type-options':'nosniff','x-espacios-evidence-source':'ad-sdi-urban-development-projects-20261102',...(status===405?{allow:'GET, HEAD'}:{})}});
async function urbanRows(report,packed){
 if(report?.rawSha256!==ABU_DHABI_URBAN_RAW_SHA||report.independentReadbackSha256!==report.rawSha256||report.rows!==374||report.distinctSourceProjectIds!==372||report.distinctNames!==371||report.geometryCaptured!==false)throw Error('Urban source manifest mismatch');
 if(!ABU_DHABI_URBAN_ROWS||ABU_DHABI_URBAN_PACKED!==packed){ABU_DHABI_URBAN_PACKED=packed;ABU_DHABI_URBAN_ROWS=(async()=>{
  const binary=atob(packed),compressed=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)compressed[i]=binary.charCodeAt(i);
  if(compressed.byteLength!==report.compressedBytes||await urbanDigest(compressed)!==report.compressedSha256)throw Error('Urban compressed source mismatch');
  const raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if(raw.byteLength!==report.rawBytes||await urbanDigest(raw)!==report.rawSha256)throw Error('Urban decoded source mismatch');
  const source=JSON.parse(new TextDecoder().decode(raw)),features=source.features;
  if(!Array.isArray(features)||features.length!==report.rows||source.exceededTransferLimit===true||source.error)throw Error('Urban source population mismatch');
  const objectIds=new Set(),featureIds=new Set(),projectIds=new Set(),names=new Set();
  for(const feature of features){
   if(feature.geometry!==undefined||!feature.attributes||Object.keys(feature.attributes).sort().join('|')!=='CH_FID|COMPANYNAME|COMPANYROLES|OBJECTID|PROJECTID|PROJECT_NAME')throw Error('Unexpected urban source fields');
   const a=feature.attributes;
   if(!Number.isSafeInteger(a.OBJECTID)||a.OBJECTID<1||typeof a.PROJECTID!=='string'||!a.PROJECTID||typeof a.PROJECT_NAME!=='string'||!a.PROJECT_NAME||typeof a.CH_FID!=='string'||!a.CH_FID||a.COMPANYNAME!==null||a.COMPANYROLES!==null||objectIds.has(a.OBJECTID)||featureIds.has(a.CH_FID))throw Error('Urban source identity invalid');
   objectIds.add(a.OBJECTID);featureIds.add(a.CH_FID);projectIds.add(a.PROJECTID);names.add(a.PROJECT_NAME);
  }
  if(projectIds.size!==report.distinctSourceProjectIds||names.size!==report.distinctNames)throw Error('Urban source distinct counts mismatch');
  return features.map(({attributes:a})=>({sourceObjectId:a.OBJECTID,sourceProjectId:a.PROJECTID,name:a.PROJECT_NAME,sourceFeatureId:a.CH_FID,canonicalProjectId:null,matchStatus:'unmatched_source_identity',coordinates:null}));
 })().catch(error=>{ABU_DHABI_URBAN_ROWS=undefined;ABU_DHABI_URBAN_PACKED=undefined;throw error});}
 return ABU_DHABI_URBAN_ROWS;
}
export async function mapAbuDhabiUrbanProjects(request,report,packed){
 const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'');
 if(path!==ABU_DHABI_URBAN_BASE&&!(path.startsWith(ABU_DHABI_URBAN_BASE+'/')&&/^\d+$/.test(path.slice(ABU_DHABI_URBAN_BASE.length+1))))return null;
 if(!['GET','HEAD'].includes(request.method))return urbanReply(request,{error:'Read-only endpoint'},405);
 const source={id:report?.sourceId,publisher:report?.publisher,layerTitle:report?.layerTitle,serviceLayerUrl:report?.serviceLayerUrl,termsUrl:report?.termsUrl,sourceQuery:report?.sourceQuery,retrievedAt:report?.retrievedAt,sourcePublicationDate:report?.sourcePublicationDate,attribution:report?.attribution,rawSha256:report?.rawSha256,compressedSha256:report?.compressedSha256,rows:report?.rows,distinctSourceProjectIds:report?.distinctSourceProjectIds,distinctNames:report?.distinctNames,repeatedSourceProjectIds:report?.repeatedSourceProjectIds,storage:'checksum_verified_immutable_worker_snapshot'};
 const scope={emirate:'Abu Dhabi',evidenceClass:'official_open_geospatial_urban_development_feature_attributes',grain:'one_polygon_layer_feature_attribute_row',canonicalProjectMatches:0,geometryCaptured:false,projectCoordinatesPresent:false,limits:'374 source features under 372 source project IDs, including housing, hotel, port and other urban developments. Not a current real-estate development census, a sales register, a map pin source, or 374 distinct projects. No automatic V48 joins or project-lead names.'};
 try{
  const rows=await urbanRows(report,packed);
  if(path!==ABU_DHABI_URBAN_BASE){const id=Number(path.slice(ABU_DHABI_URBAN_BASE.length+1)),row=rows.find(item=>item.sourceObjectId===id);return row?urbanReply(request,{source,scope,project:row}):urbanReply(request,{error:'Source feature not found'},404);}
  const params=url.searchParams,limit=params.has('limit')?urbanInt(params.get('limit'),1,100):50,offset=params.has('offset')?urbanInt(params.get('offset'),0,report.rows):0,query=(params.get('q')||'').trim();
  if(limit===null||offset===null||query.length>120)return urbanReply(request,{error:'Invalid q, limit, or offset'},400);
  const q=query.toLocaleLowerCase('en'),filtered=q?rows.filter(row=>[row.name,row.sourceProjectId,row.sourceFeatureId].some(value=>value.toLocaleLowerCase('en').includes(q))):rows;
  return urbanReply(request,{source,scope,filters:{q:query||null},totalFeatures:filtered.length,limit,offset,features:filtered.slice(offset,offset+limit)});
 }catch{return urbanReply(request,{error:'The verified Abu Dhabi urban project source is temporarily unavailable.'},503);}
}
