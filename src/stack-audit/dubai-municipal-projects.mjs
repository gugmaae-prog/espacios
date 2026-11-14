const DM_MUNICIPAL_PATH='/map/api/uae-evidence/dubai/municipal-projects';
const dmMunicipalSha256=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');

async function dmMunicipalReadShard(assets,shard,manifest){
 if(!assets?.fetch)throw Error('Municipal-project asset binding unavailable');
 const response=await assets.fetch(new Request(`https://map-archive.internal/__map_archive/dmprojects/${shard.sha256}.bin`,{headers:{accept:'application/octet-stream'}}));
 if(response.status!==200)throw Error('Municipal-project shard unavailable');
 const packed=await response.arrayBuffer();
 if(packed.byteLength!==shard.bytes||await dmMunicipalSha256(packed)!==shard.sha256)throw Error('Municipal-project shard checksum mismatch');
 const decoded=await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 if(decoded.byteLength!==shard.decodedBytes||await dmMunicipalSha256(decoded)!==shard.decodedSha256)throw Error('Municipal-project decoded checksum mismatch');
 const payload=JSON.parse(new TextDecoder().decode(decoded));
 if(!Array.isArray(payload.projects)||payload.projects.length!==shard.projects||payload.projects.some(row=>!Array.isArray(row)||row.length!==manifest.projectFields.length))throw Error('Municipal-project row schema mismatch');
 if(!Array.isArray(payload.links)||payload.links.length!==shard.links||payload.links.some(row=>!Array.isArray(row)||row.length!==manifest.linkFields.length))throw Error('Municipal-project link schema mismatch');
 return payload;
}

export async function mapDubaiMunicipalProjects(request,manifest,assets){
 const path=new URL(request.url).pathname.replace(/\/+$/,'');
 if(path!==DM_MUNICIPAL_PATH&&!path.startsWith(DM_MUNICIPAL_PATH+'/'))return null;
 const url=new URL(request.url);
 const headers={'content-type':'application/json; charset=utf-8','cache-control':'public,max-age=60,s-maxage=300','x-content-type-options':'nosniff','x-espacios-evidence-source':manifest.sourceId};
 const reply=(payload,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(payload),{status,headers:{...headers,...(status===200?{}:{'cache-control':'no-store'})}});
 if(!['GET','HEAD'].includes(request.method))return new Response(JSON.stringify({error:'Read-only endpoint'}),{status:405,headers:{...headers,allow:'GET, HEAD','cache-control':'no-store'}});
 const source={id:manifest.sourceId,publisher:manifest.publisher,captureDate:manifest.captureDate,sourceUpdatedLabel:manifest.sourceUpdatedLabel,sources:manifest.sources.map(item=>({id:item.id,url:item.url,sha256:item.sha256,rows:item.rows,publishedFields:item.publishedFields,withheldFieldCount:item.withheldFields?.length||0})),publisherOpenDataUrl:manifest.publisherOpenDataUrl,license:manifest.license,evidenceClass:manifest.evidenceClass,grain:manifest.grain,storage:manifest.storage,idriveReplicaVerified:manifest.idriveReplicaVerified};
 const scope={emirate:'Dubai',projectRows:manifest.projectRows,linkRows:manifest.linkRows,linkedProjectNos:manifest.linkedProjectNos,linkedBuildingIds:manifest.linkedBuildingIds,buildingCardSourceId:manifest.buildingCardSourceId,buildingCardProjectNoAgreementRows:manifest.buildingCardProjectNoAgreementRows,ambiguousBuildingIds:manifest.ambiguousBuildingIds,projectFields:manifest.projectFields,linkFields:manifest.linkFields,quality:manifest.quality,limits:manifest.limits,coordinatesPresent:false,dldProjectIdentityVerified:false,availableUnits:false,registeredTransactions:false,estimated:false};
 if(path===DM_MUNICIPAL_PATH&&url.searchParams.get('view')==='summary')return reply({source,scope,buckets:manifest.shards.map(({bucket,projects,links})=>({bucket,projects,links}))});
 if(path===DM_MUNICIPAL_PATH){
  if(url.searchParams.has('view')||url.searchParams.has('q')||url.searchParams.has('building_id'))return reply({error:'Unsupported filter. Use the stable cursor or an exact municipal project number.'},400);
  const rawLimit=url.searchParams.get('limit')||'100',rawCursor=url.searchParams.get('cursor');
  if(!/^\d+$/.test(rawLimit)||Number(rawLimit)<1||Number(rawLimit)>100)return reply({error:'limit must be an integer from 1 to 100.'},400);
  let bucket=manifest.shards[0]?.bucket,offset=0;
  if(rawCursor!==null){const match=/^(\d{1,4}):(\d{1,6})$/.exec(rawCursor);if(!match)return reply({error:'Invalid cursor.'},400);bucket=Number(match[1]);offset=Number(match[2]);}
  const index=manifest.shards.findIndex(item=>item.bucket===bucket),shard=manifest.shards[index];
  if(!shard||offset>=shard.projects)return reply({error:'Unknown or exhausted cursor.'},400);
  try{
   const payload=await dmMunicipalReadShard(assets,shard,manifest),page=payload.projects.slice(offset,offset+Number(rawLimit)).map(row=>Object.fromEntries(manifest.projectFields.map((field,i)=>[field,row[i]])));
   const next=offset+page.length,nextCursor=next<shard.projects?`${bucket}:${next}`:manifest.shards[index+1]?`${manifest.shards[index+1].bucket}:0`:null;
   return reply({source,scope,cursor:rawCursor,nextCursor,rows:page});
  }catch{return reply({error:'Verified municipal-project shard is temporarily unavailable.',sourceId:manifest.sourceId},503);}
 }
 const idText=path.slice(DM_MUNICIPAL_PATH.length+1);
 if(!/^\d{1,10}$/.test(idText)||!Number.isSafeInteger(Number(idText)))return reply({error:'Invalid municipal project number.'},400);
 const projectNo=String(Number(idText)),shard=manifest.shards.find(item=>item.bucket===Math.floor(Number(projectNo)/manifest.bucketSize));
 if(!shard)return reply({error:'Municipal project number not present in this dated snapshot.',sourceId:manifest.sourceId},404);
 const rawBuildingLimit=url.searchParams.get('buildingLimit')||'100',rawBuildingCursor=url.searchParams.get('buildingCursor')||'0';
 if(!/^\d+$/.test(rawBuildingLimit)||Number(rawBuildingLimit)<1||Number(rawBuildingLimit)>100||!/^\d{1,6}$/.test(rawBuildingCursor))return reply({error:'Invalid building page options.'},400);
 if([...url.searchParams.keys()].some(key=>!['buildingLimit','buildingCursor'].includes(key)))return reply({error:'Unsupported detail filter.'},400);
 try{
  const payload=await dmMunicipalReadShard(assets,shard,manifest),row=payload.projects.find(item=>item[0]===projectNo);
  if(!row)return reply({error:'Municipal project number not present in this dated snapshot.',sourceId:manifest.sourceId},404);
  const links=payload.links.filter(item=>item[0]===projectNo),start=Number(rawBuildingCursor);
  if(start>links.length)return reply({error:'Unknown building cursor.'},400);
  const page=links.slice(start,start+Number(rawBuildingLimit)).map(item=>({...Object.fromEntries(manifest.linkFields.map((field,i)=>[field,item[i]])),conflictsWithBuildingCardProjectNo:manifest.ambiguousBuildingIds.includes(item[1])}));
  return reply({source,scope,project:Object.fromEntries(manifest.projectFields.map((field,i)=>[field,row[i]])),linkedBuildingRows:links.length,buildingCursor:start,nextBuildingCursor:start+page.length<links.length?String(start+page.length):null,buildings:page});
 }catch{return reply({error:'Verified municipal-project shard is temporarily unavailable.',sourceId:manifest.sourceId},503);}
}
