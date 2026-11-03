const ABU_DHABI_DEVELOPER_BASE='/map/api/uae-evidence/abu-dhabi/developer-projects';
const ABU_DHABI_DEVELOPER_RAW_SHA='347fa57d07e57cd359f63fffbed14cd5beda429475ba24db954950240d479f45';
let developerRowsPromise,developerPacked;
const developerDigest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
const developerInt=(value,min,max)=>/^\d+$/.test(value||'')&&Number.isSafeInteger(Number(value))&&Number(value)>=min&&Number(value)<=max?Number(value):null;
const developerReply=(request,body,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public,max-age=60,s-maxage=300':'no-store','x-content-type-options':'nosniff','x-espacios-evidence-source':'ad-sdi-developer-projects-20261103',...(status===405?{allow:'GET, HEAD'}:{})}});

async function verifiedDeveloperRows(report,packed){
 if(report?.rawSha256!==ABU_DHABI_DEVELOPER_RAW_SHA||report.independentReadbackSha256!==report.rawSha256||report.rows!==411||report.distinctNames!==410||report.geometryCaptured!==false)throw Error('Developer source manifest mismatch');
 if(!developerRowsPromise||developerPacked!==packed){developerPacked=packed;developerRowsPromise=(async()=>{
  const binary=atob(packed),compressed=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)compressed[i]=binary.charCodeAt(i);
  if(compressed.byteLength!==report.compressedBytes||await developerDigest(compressed)!==report.compressedSha256)throw Error('Developer compressed source mismatch');
  const raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if(raw.byteLength!==report.rawBytes||await developerDigest(raw)!==report.rawSha256)throw Error('Developer decoded source mismatch');
  const source=JSON.parse(new TextDecoder().decode(raw)),features=source.features;
  if(!Array.isArray(features)||features.length!==report.rows||source.exceededTransferLimit===true||source.error)throw Error('Developer source population mismatch');
  const objectIds=new Set(),featureIds=new Set(),names=new Set(),developers=new Set();let nullDevelopers=0;
  for(const feature of features){
   if(feature.geometry!==undefined||!feature.attributes||Object.keys(feature.attributes).sort().join('|')!=='CH_FID|DEVELOPER_NAME|OBJECTID|PROJECT_NAME|SHARINGSTATUS_DM')throw Error('Unexpected developer source fields');
   const a=feature.attributes;
   if(!Number.isSafeInteger(a.OBJECTID)||a.OBJECTID<1||typeof a.PROJECT_NAME!=='string'||!a.PROJECT_NAME||typeof a.CH_FID!=='string'||!a.CH_FID||a.SHARINGSTATUS_DM!=='Report'||a.DEVELOPER_NAME!==null&&typeof a.DEVELOPER_NAME!=='string'||objectIds.has(a.OBJECTID)||featureIds.has(a.CH_FID))throw Error('Developer source identity invalid');
   objectIds.add(a.OBJECTID);featureIds.add(a.CH_FID);names.add(a.PROJECT_NAME);if(a.DEVELOPER_NAME)developers.add(a.DEVELOPER_NAME);else nullDevelopers++;
  }
  if(names.size!==report.distinctNames||developers.size!==report.distinctDevelopers||nullDevelopers!==report.nullDeveloperRows)throw Error('Developer source distinct counts mismatch');
  return features.map(({attributes:a})=>({sourceObjectId:a.OBJECTID,name:a.PROJECT_NAME,developerName:a.DEVELOPER_NAME,sourceFeatureId:a.CH_FID,canonicalProjectId:null,matchStatus:'unmatched_source_identity',coordinates:null}));
 })().catch(error=>{developerRowsPromise=undefined;developerPacked=undefined;throw error});}
 return developerRowsPromise;
}

export async function mapAbuDhabiDeveloperProjects(request,report,packed){
 const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'');
 if(path!==ABU_DHABI_DEVELOPER_BASE&&!(path.startsWith(ABU_DHABI_DEVELOPER_BASE+'/')&&/^\d+$/.test(path.slice(ABU_DHABI_DEVELOPER_BASE.length+1))))return null;
 if(!['GET','HEAD'].includes(request.method))return developerReply(request,{error:'Read-only endpoint'},405);
 const source={id:report?.sourceId,publisher:report?.publisher,layerTitle:report?.layerTitle,serviceLayerUrl:report?.serviceLayerUrl,termsUrl:report?.termsUrl,retrievedAt:report?.retrievedAt,sourcePublicationDate:report?.sourcePublicationDate,attribution:report?.attribution,rawSha256:report?.rawSha256,compressedSha256:report?.compressedSha256,rows:report?.rows,distinctNames:report?.distinctNames,storage:'checksum_verified_immutable_worker_snapshot'};
 const scope={emirate:'Abu Dhabi',evidenceClass:'official_open_geospatial_developer_project_feature_attributes',grain:'one_polygon_layer_feature_attribute_row',canonicalProjectMatches:0,geometryCaptured:false,projectCoordinatesPresent:false,limits:'411 source features with 410 distinct names. Developer names are source labels, not independently validated project ownership. This layer overlaps the separate Urban Development Projects layer and is not an ADREC register, current property-project census, sales source, or map pin source. No automatic V48 joins.'};
 try{
  const rows=await verifiedDeveloperRows(report,packed);
  if(path!==ABU_DHABI_DEVELOPER_BASE){const id=Number(path.slice(ABU_DHABI_DEVELOPER_BASE.length+1)),row=rows.find(item=>item.sourceObjectId===id);return row?developerReply(request,{source,scope,project:row}):developerReply(request,{error:'Source feature not found'},404);}
  const params=url.searchParams,limit=params.has('limit')?developerInt(params.get('limit'),1,100):50,offset=params.has('offset')?developerInt(params.get('offset'),0,report.rows):0,query=(params.get('q')||'').trim();
  if(limit===null||offset===null||query.length>120)return developerReply(request,{error:'Invalid q, limit, or offset'},400);
  const q=query.toLocaleLowerCase('en'),filtered=q?rows.filter(row=>[row.name,row.developerName,row.sourceFeatureId].some(value=>value?.toLocaleLowerCase('en').includes(q))):rows;
  return developerReply(request,{source,scope,filters:{q:query||null},totalFeatures:filtered.length,limit,offset,features:filtered.slice(offset,offset+limit)});
 }catch{return developerReply(request,{error:'The verified Abu Dhabi developer-project source is temporarily unavailable.'},503);}
}
