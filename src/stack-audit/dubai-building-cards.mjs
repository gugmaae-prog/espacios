const DM_BUILDING_CARDS_PATH='/map/api/uae-evidence/dubai/building-cards';

const dmSha256=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');

async function dmReadShard(assets,shard,columns){
 if(!assets?.fetch)throw Error('Building-card asset binding unavailable');
 const response=await assets.fetch(new Request(`https://map-archive.internal/__map_archive/dm/${shard.sha256}.bin`,{headers:{accept:'application/octet-stream'}}));
 if(!response.ok||response.status!==200)throw Error('Building-card shard unavailable');
 const packed=await response.arrayBuffer();
 if(packed.byteLength!==shard.bytes||await dmSha256(packed)!==shard.sha256)throw Error('Building-card shard checksum mismatch');
 const decoded=await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 if(decoded.byteLength!==shard.decodedBytes||await dmSha256(decoded)!==shard.decodedSha256)throw Error('Building-card decoded checksum mismatch');
 const payload=JSON.parse(new TextDecoder().decode(decoded));
 if(!Array.isArray(payload.rows)||payload.rows.length!==shard.rows||payload.rows.some(row=>!Array.isArray(row)||row.length!==columns.length))throw Error('Building-card shard schema mismatch');
 return payload.rows;
}

export async function mapDubaiBuildingCards(request,manifest,assets){
 const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'');
 if(path!==DM_BUILDING_CARDS_PATH&&!path.startsWith(DM_BUILDING_CARDS_PATH+'/'))return null;
 const headers={'content-type':'application/json; charset=utf-8','cache-control':'public,max-age=60,s-maxage=300','x-content-type-options':'nosniff','x-espacios-evidence-source':manifest.sourceId};
 const reply=(body,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{...headers,...(status===200?{}:{'cache-control':'no-store'})}});
 if(!['GET','HEAD'].includes(request.method))return new Response(JSON.stringify({error:'Read-only endpoint'}),{status:405,headers:{...headers,'cache-control':'no-store',allow:'GET, HEAD'}});
 const source={id:manifest.sourceId,publisher:manifest.publisher,sourceUrl:manifest.sourceUrl,publisherOpenDataUrl:manifest.publisherOpenDataUrl,captureDate:manifest.captureDate,sourceUpdatedLabel:manifest.sourceUpdatedLabel,sourceSha256:manifest.sourceSha256,sourceRows:manifest.sourceRows,evidenceClass:manifest.evidenceClass,grain:manifest.grain,license:manifest.license,rightsNotes:manifest.rightsNotes,storage:manifest.storage,idriveReplicaVerified:manifest.idriveReplicaVerified};
 const scope={emirate:'Dubai',columns:manifest.sourceFields,quality:manifest.quality,limits:manifest.limits,coordinatesPresent:false,availableUnits:false,registeredTransactions:false,completedBuildingsOnly:false};
 if(path===DM_BUILDING_CARDS_PATH&&url.searchParams.get('view')==='summary')return reply({source,scope,buckets:manifest.shards.map(({bucket,rows})=>({bucket,rows})),totalRows:manifest.sourceRows});
 if(path===DM_BUILDING_CARDS_PATH){
  if(url.searchParams.has('view')||url.searchParams.has('q')||url.searchParams.has('community'))return reply({error:'Unsupported filter. Use the stable cursor to page through the source records.'},400);
  const rawLimit=url.searchParams.get('limit')||'100',rawCursor=url.searchParams.get('cursor');
  if(!/^\d+$/.test(rawLimit)||Number(rawLimit)<1||Number(rawLimit)>100)return reply({error:'limit must be an integer from 1 to 100.'},400);
  let bucket=manifest.shards[0]?.bucket,offset=0;
  if(rawCursor!==null){const match=/^(\d{1,4}):(\d{1,6})$/.exec(rawCursor);if(!match)return reply({error:'Invalid cursor.'},400);bucket=Number(match[1]);offset=Number(match[2]);}
  const index=manifest.shards.findIndex(shard=>shard.bucket===bucket),shard=manifest.shards[index];
  if(!shard||offset>=shard.rows)return reply({error:'Unknown or exhausted cursor.'},400);
  try{
   const rows=await dmReadShard(assets,shard,manifest.sourceFields),limit=Number(rawLimit),page=rows.slice(offset,offset+limit).map(row=>Object.fromEntries(manifest.sourceFields.map((field,i)=>[field,row[i]])));
   const nextOffset=offset+page.length;
   const nextCursor=nextOffset<shard.rows?`${bucket}:${nextOffset}`:manifest.shards[index+1]?`${manifest.shards[index+1].bucket}:0`:null;
   return reply({source,scope,totalRows:manifest.sourceRows,cursor:rawCursor,nextCursor,rows:page});
  }catch{return reply({error:'Verified building-card shard is temporarily unavailable.',sourceId:manifest.sourceId},503);}
 }
 const idText=path.slice(DM_BUILDING_CARDS_PATH.length+1);
 if(!/^\d{1,10}$/.test(idText))return reply({error:'Invalid building ID.'},400);
 const id=Number(idText),shard=manifest.shards.find(item=>item.bucket===Math.floor(id/manifest.bucketSize));
 if(!shard)return reply({error:'Building ID not present in this dated source snapshot.',sourceId:manifest.sourceId},404);
 try{
  const rows=await dmReadShard(assets,shard,manifest.sourceFields),idIndex=manifest.sourceFields.indexOf('building_id');
  const row=rows.find(item=>item[idIndex]===idText);
  if(!row)return reply({error:'Building ID not present in this dated source snapshot.',sourceId:manifest.sourceId},404);
  return reply({source,scope,record:Object.fromEntries(manifest.sourceFields.map((field,i)=>[field,row[i]]))});
 }catch{return reply({error:'Verified building-card shard is temporarily unavailable.',sourceId:manifest.sourceId},503);}
}
