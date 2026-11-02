const AJMAN_REGISTER_BASE='/map/api/uae-evidence/ajman/register';
let AJMAN_REGISTER_PROMISE;
const ajmanHex=bytes=>Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
const ajmanDigest=async bytes=>ajmanHex(await crypto.subtle.digest('SHA-256',bytes));
const ajmanReply=(request,body,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public,max-age=60,s-maxage=300':'no-store','x-content-type-options':'nosniff','x-espacios-evidence-source':'ajman-dlrr-20260826-project-register'}});
const ajmanInt=(value,min,max)=>/^\d+$/.test(value||'')&&Number.isSafeInteger(Number(value))&&Number(value)>=min&&Number(value)<=max?Number(value):null;
async function ajmanRegisterRows(env,report,storeFactory){
 if(!env.MAP_EVIDENCE||env.MAP_IDRIVE_READY!=='true')throw Error('Private evidence binding unavailable');
 if(!AJMAN_REGISTER_PROMISE)AJMAN_REGISTER_PROMISE=(async()=>{
  const object=await storeFactory(env.MAP_EVIDENCE,env.MAP_IDRIVE_TRACE).get(report.storageKey);
  if(!object||object.sha256!==report.compressedSha256||object.size!==report.compressedBytes)throw Error('Register object metadata mismatch');
  const compressed=await object.arrayBuffer();
  if(compressed.byteLength!==report.compressedBytes||await ajmanDigest(compressed)!==report.compressedSha256)throw Error('Register object checksum mismatch');
  const raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if(raw.byteLength!==report.rawBytes||await ajmanDigest(raw)!==report.rawSha256)throw Error('Register decoded checksum mismatch');
  const rows=JSON.parse(new TextDecoder().decode(raw));
  if(!Array.isArray(rows)||rows.length!==report.rows)throw Error('Register row count mismatch');
  const ids=new Set(),idDates=new Set();let current=0,unknown=0,cityAnomalies=0;
  for(const row of rows){
   if(!Number.isSafeInteger(row.project_id)||row.project_id<1||typeof row.project_name_english!=='string'||!row.project_name_english||!/^\d{4}-\d{2}-\d{2}$/.test(row.update_date))throw Error('Register identity invalid');
   ids.add(row.project_id);const idDate=row.project_id+'|'+row.update_date;if(idDates.has(idDate))throw Error('Register duplicate snapshot');idDates.add(idDate);
   if(row.update_date===report.latestSnapshotDate)current++;
   if(!/^\d+$/.test(String(row.number_of_real_estate_units)))unknown++;
   if(row.city_english!=='Ajman')cityAnomalies++;
  }
  if(ids.size!==report.distinctSourceProjectIds||current!==report.latestSnapshotProjectIds||unknown!==report.unknownUnitRows||cityAnomalies!==report.cityFieldAnomalyRows)throw Error('Register quality totals mismatch');
  return rows;
 })().catch(error=>{AJMAN_REGISTER_PROMISE=undefined;throw error});
 return AJMAN_REGISTER_PROMISE;
}
function ajmanRegisterCrosswalk(report,crosswalk){
 if(!crosswalk)return new Map();
 if(crosswalk.sourceRawSha256!==report.rawSha256||crosswalk.latestSourceSnapshotDate!==report.latestSnapshotDate||!Array.isArray(crosswalk.matches)||crosswalk.matches.length!==3)throw Error('Ajman identity crosswalk source mismatch');
 const byId=new Map(),canonicalIds=new Set();
 for(const match of crosswalk.matches){
  if(!Number.isSafeInteger(match.sourceProjectId)||!match.canonicalProjectId?.startsWith('project:')||byId.has(match.sourceProjectId)||canonicalIds.has(match.canonicalProjectId))throw Error('Ajman identity crosswalk invalid');
  byId.set(match.sourceProjectId,match);canonicalIds.add(match.canonicalProjectId);
 }
 return byId;
}
function ajmanRegisterProject(row,latestDate,match){
 const units=/^\d+$/.test(String(row.number_of_real_estate_units))?Number(row.number_of_real_estate_units):null;
 const status=row.project_status_english?.toLowerCase()==='completed'?'completed':'under_construction';
 return {sourceProjectId:row.project_id,nameEn:row.project_name_english,nameAr:row.project_name_arabic,status,statusSource:row.project_status_english,registrationNumber:row.project_registration_number==='none'?null:row.project_registration_number,reportedUnitCount:units,districtEn:row.district_english,districtAr:row.district_arabic,developerEn:row.developer_name_english,developerAr:row.developer_name_arabic,mainProjectNameEn:row.main_project_name_english==='none'?null:row.main_project_name_english,snapshotDate:row.update_date,inLatestSnapshot:row.update_date===latestDate,canonicalProjectId:match?.canonicalProjectId||null,matchStatus:match?'reviewed_one_to_one_identity':'unmatched',coordinates:null,sourceFieldWarnings:[...(units===null?['unit_count_unknown']:[]),...(row.city_english!=='Ajman'?['city_field_anomaly']:[])]};
}
export async function mapAjmanRegister(request,env,report,storeFactory=mapEvidenceStore,crosswalk=null){
 const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'');
 if(path!==AJMAN_REGISTER_BASE&&!(path.startsWith(AJMAN_REGISTER_BASE+'/')&&/^[0-9]+$/.test(path.slice(AJMAN_REGISTER_BASE.length+1))))return null;
 if(!['GET','HEAD'].includes(request.method))return ajmanReply(request,{error:'Read-only endpoint'},405);
 if(!report?.storageKey||!report.compressedSha256)return ajmanReply(request,{error:'Verified Ajman register is not configured.'},503);
 const source={id:report.sourceId,publisher:report.publisher,datasetUrl:report.datasetUrl,licence:report.licence,licenceUrl:report.licenceUrl,sourceModifiedAt:report.sourceModifiedAt,retrievedAt:report.retrievedAt,rawSha256:report.rawSha256,compressedSha256:report.compressedSha256,rows:report.rows,distinctSourceProjectIds:report.distinctSourceProjectIds,latestSnapshotDate:report.latestSnapshotDate,latestSnapshotProjectIds:report.latestSnapshotProjectIds,notInLatestSnapshotProjectIds:report.notInLatestSnapshotProjectIds,unknownUnitRows:report.unknownUnitRows,cityFieldAnomalyRows:report.cityFieldAnomalyRows,coordinatesPresent:false,storage:'private_idrive_e2_verified_object',grain:report.grain,identityCrosswalk:crosswalk?.version||null};
 const scope={emirate:'Ajman',evidenceClass:'official_project_register_snapshot',canonicalProjectMatches:crosswalk?.matches?.length||0,unmatchedLatestSourceProjectIds:report.latestSnapshotProjectIds-(crosswalk?.matches?.length||0),limits:'Dated source snapshots, not 3,457 unique projects or complete current coverage. Three manually reviewed identity links when the crosswalk is present; no coordinate or timeline inference and no automatic name-only joins.'};
 try{
  const rows=await ajmanRegisterRows(env,report,storeFactory);
  const matches=ajmanRegisterCrosswalk(report,crosswalk);
  if(path!==AJMAN_REGISTER_BASE){
   const id=Number(path.slice(AJMAN_REGISTER_BASE.length+1));
   const history=rows.filter(row=>row.project_id===id).sort((a,b)=>b.update_date.localeCompare(a.update_date)).map(row=>ajmanRegisterProject(row,report.latestSnapshotDate,matches.get(id)));
   if(!history.length)return ajmanReply(request,{error:'Source project ID not found.'},404);
   return ajmanReply(request,{source,scope,sourceProjectId:id,inLatestSnapshot:history[0].inLatestSnapshot,currentStatusEstablished:history[0].inLatestSnapshot,history});
  }
  const params=url.searchParams,limit=params.has('limit')?ajmanInt(params.get('limit'),1,100):50,offset=params.has('offset')?ajmanInt(params.get('offset'),0,364):0,scopeParam=params.get('scope')||'latest',status=params.get('status')||'',query=(params.get('q')||'').trim();
  if(limit===null||offset===null||!['latest','all'].includes(scopeParam)||!['','completed','under_construction'].includes(status)||query.length>120)return ajmanReply(request,{error:'Invalid scope, status, q, limit, or offset.'},400);
  const latestById=new Map();for(const row of rows){const prev=latestById.get(row.project_id);if(!prev||prev.update_date<row.update_date)latestById.set(row.project_id,row);}
  const q=query.toLocaleLowerCase('en');
  const projects=[...latestById.values()].filter(row=>scopeParam==='all'||row.update_date===report.latestSnapshotDate).map(row=>ajmanRegisterProject(row,report.latestSnapshotDate,matches.get(row.project_id))).filter(row=>(!status||row.status===status)&&(!q||[row.nameEn,row.nameAr,row.developerEn,row.developerAr,row.districtEn,row.districtAr].some(value=>String(value||'').toLocaleLowerCase('en').includes(q)))).sort((a,b)=>a.nameEn.localeCompare(b.nameEn)||a.sourceProjectId-b.sourceProjectId);
  return ajmanReply(request,{source,scope,filters:{scope:scopeParam,status:status||null,q:query||null},totalProjects:projects.length,limit,offset,projects:projects.slice(offset,offset+limit)});
 }catch{return ajmanReply(request,{error:'The verified Ajman project register is temporarily unavailable.'},503);}
}
