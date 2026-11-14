const DUBAI_STATUS_BASE='/map/api/uae-evidence/dubai/project-status';
const DUBAI_STATUS_SHA='e27ecc33ef7bb065b499a5395188c448dff4c2943d593a0157cdbca7ffbcee03';
const DUBAI_STATUS_NORMALIZED_SHA='1b684f784bbaff51255b086365b5a1c6d413aa533b4c736a37bbe145c3d60fc1';
const DUBAI_STATUS_FIELDS=['project_number','project_name','developer_number','developer_name','community','land_number','total_area_sqm','total_units','completion_percent','completion_date','previous_percent','previous_date','start_date','handover_date'];
let DUBAI_STATUS_ROWS,DUBAI_STATUS_PACKED;
const dubaiHex=bytes=>Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
const dubaiDigest=async bytes=>dubaiHex(await crypto.subtle.digest('SHA-256',bytes));
const dubaiInt=(value,min,max)=>/^\d+$/.test(value||'')&&Number.isSafeInteger(Number(value))&&Number(value)>=min&&Number(value)<=max?Number(value):null;
const dubaiReply=(request,body,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public,max-age=60,s-maxage=300':'no-store','x-content-type-options':'nosniff','x-espacios-evidence-source':'continental-dld-mashrooi-project-status-20261114',...(status===405?{allow:'GET, HEAD'}:{})}});
const dubaiStatusReplica=id=>{
 const replica=typeof UAE_CURRENT_IDRIVE_REPLICA==='object'?UAE_CURRENT_IDRIVE_REPLICA:null;
 return replica?.sourceIds?.includes(id)?{verifiedAt:replica.verifiedAt,attestationId:replica.attestationId,role:replica.storageRole}:null;
};

export function parseDubaiStatusCsv(text){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(quoted){if(ch==='"'&&text[i+1]==='"'){field+='"';i++;}else if(ch==='"')quoted=false;else field+=ch;continue;}
  if(ch==='"'){if(field!=='')throw Error('Malformed quoted CSV field');quoted=true;}
  else if(ch===','){row.push(field);field='';}
  else if(ch==='\n'){row.push(field);rows.push(row);row=[];field='';}
  else if(ch==='\r'&&text[i+1]==='\n'){}
  else field+=ch;
 }
 if(quoted)throw Error('Unclosed CSV quote');
 if(field!==''||row.length){row.push(field);rows.push(row);}
 return rows;
}

const dubaiNumber=(value,min,max,nullable=false)=>{
 if(value===''&&nullable)return null;
 if(!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value))throw Error('Invalid numeric source value');
 const number=Number(value);if(!Number.isFinite(number)||number<min||number>max)throw Error('Numeric source value out of range');
 return number;
};
const dubaiDate=(value,nullable=false)=>{
 if(value===''&&nullable)return null;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw Error('Invalid source date');
 return value;
};

const dubaiDateReviewFlags=row=>{
 const flags=[];
 if(row.declaredHandoverDate&&row.declaredHandoverDate<row.registeredStartDate)flags.push('declared_handover_before_registered_start');
 if(row.declaredHandoverDate&&row.inspectionDate&&row.declaredHandoverDate<row.inspectionDate&&row.completionPercent<100)flags.push('declared_handover_before_incomplete_inspection');
 return flags;
};

export function normalizeDubaiStatusCsv(text,report){
 const table=parseDubaiStatusCsv(text.replace(/^\uFEFF/,'')),header=table.shift();
 if(header?.join('|')!==DUBAI_STATUS_FIELDS.join('|')||table.length!==report?.rowCount||report.actualCsvFieldCount!==14||report.distinctProjectNumbers!==report.rowCount)throw Error('Dubai source schema or population mismatch');
 const ids=new Set(),names=new Set();
 const rows=table.map(cells=>{
  if(cells.length!==14)throw Error('Dubai source row width changed');
  const [projectNumber,projectName,developerNumber,developerName,community,landNumber,totalArea,totalUnits,completionPercent,inspectionDate,previousPercent,previousInspectionDate,startDate,declaredHandoverDate]=cells;
  if(!/^\d+$/.test(projectNumber)||ids.has(projectNumber)||!projectName||!/^\d+$/.test(developerNumber)||!developerName||!community)throw Error('Dubai source identity invalid');
  ids.add(projectNumber);names.add(projectName);
  return {sourceProjectNumber:projectNumber,name:projectName,sourceDeveloperNumber:developerNumber,developerName,community,sourceLandNumber:landNumber||null,totalAreaSqm:dubaiNumber(totalArea,0,1e10),totalUnits:dubaiNumber(totalUnits,0,1e7),completionPercent:dubaiNumber(completionPercent,0,100),inspectionDate:dubaiDate(inspectionDate,true),previousPercent:dubaiNumber(previousPercent,0,100,true),previousInspectionDate:dubaiDate(previousInspectionDate,true),registeredStartDate:dubaiDate(startDate),declaredHandoverDate:dubaiDate(declaredHandoverDate,true),canonicalProjectId:null,matchStatus:'unmatched_source_identity',coordinates:null};
 });
 if(ids.size!==report.distinctProjectNumbers||names.size!==report.distinctNames)throw Error('Dubai source distinct counts mismatch');
 return rows;
}

async function dubaiRows(report,packed){
 if(report?.rawSha256!==DUBAI_STATUS_SHA||report.independentReadbackSha256!==report.rawSha256||report.normalizedSha256!==DUBAI_STATUS_NORMALIZED_SHA||report.rowCount!==3882||report.actualCsvFieldCount!==14||report.sourcePublicationDate!=='2026-11-14'||report.geometryCaptured!==false)throw Error('Dubai source manifest mismatch');
 if(!DUBAI_STATUS_ROWS||DUBAI_STATUS_PACKED!==packed){DUBAI_STATUS_PACKED=packed;DUBAI_STATUS_ROWS=(async()=>{
  const binary=atob(packed),compressed=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)compressed[i]=binary.charCodeAt(i);
  if(compressed.byteLength!==report.normalizedCompressedBytes||await dubaiDigest(compressed)!==report.normalizedCompressedSha256)throw Error('Dubai compressed source mismatch');
  const raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if(raw.byteLength!==report.normalizedBytes||await dubaiDigest(raw)!==report.normalizedSha256)throw Error('Dubai decoded source mismatch');
  const rows=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
  if(!Array.isArray(rows)||rows.length!==report.rowCount||new Set(rows.map(row=>row.sourceProjectNumber)).size!==report.distinctProjectNumbers||rows.some(row=>row.canonicalProjectId!==null||row.coordinates!==null||row.matchStatus!=='unmatched_source_identity'))throw Error('Dubai normalized source population mismatch');
  return rows;
 })().catch(error=>{DUBAI_STATUS_ROWS=undefined;DUBAI_STATUS_PACKED=undefined;throw error});}
 return DUBAI_STATUS_ROWS;
}

export async function mapDubaiProjectStatus(request,report,packed,crosswalk=null){
 const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'');
 if(path!==DUBAI_STATUS_BASE&&!(path.startsWith(DUBAI_STATUS_BASE+'/')&&/^\d+$/.test(path.slice(DUBAI_STATUS_BASE.length+1))))return null;
 if(!['GET','HEAD'].includes(request.method))return dubaiReply(request,{error:'Read-only endpoint'},405);
 const source={id:report?.sourceId,originator:report?.originator,republisher:report?.republisher,title:report?.title,sourcePageUrl:report?.sourcePageUrl,sourceCsvUrl:report?.sourceCsvUrl,originatorPageUrl:report?.originatorPageUrl,license:report?.license,attribution:report?.attribution,sourcePublicationDate:report?.sourcePublicationDate,retrievedAt:report?.retrievedAt,rawSha256:report?.rawSha256,compressedSha256:report?.compressedSha256,rowCount:report?.rowCount,distinctProjectNumbers:report?.distinctProjectNumbers,actualCsvFieldCount:report?.actualCsvFieldCount,sourcePageClaimedFieldCount:report?.sourcePageClaimedFieldCount,sourcePageClaimedRowCount:report?.sourcePageClaimedRowCount,sourcePageMetaProjectCount:report?.sourcePageMetaProjectCount,storage:'checksum_verified_immutable_worker_snapshot',idriveReplica:dubaiStatusReplica(report?.sourceId)};
 try{
  const sourceRows=await dubaiRows(report,packed);
  const links=new Map();
  if(crosswalk){
   if(crosswalk.sourceRawSha256!==report.rawSha256||crosswalk.sourceDatasetId!==report.sourceId||crosswalk.sourceSnapshotDate!==report.sourcePublicationDate||!Array.isArray(crosswalk.matches))throw Error('Dubai crosswalk manifest mismatch');
   const known=new Map(sourceRows.map(row=>[row.sourceProjectNumber,row])),canonicalIds=new Set();
   for(const match of crosswalk.matches){
    const row=known.get(match.sourceProjectNumber);
    if(!row||links.has(match.sourceProjectNumber)||canonicalIds.has(match.canonicalProjectId)||row.name!==match.sourceProjectName||row.developerName!==match.sourceDeveloper||row.community!==match.sourceDistrict||typeof match.canonicalProjectId!=='string')throw Error('Dubai crosswalk identity mismatch');
    links.set(match.sourceProjectNumber,match.canonicalProjectId);canonicalIds.add(match.canonicalProjectId);
   }
  }
  const dateReview=sourceRows.map(dubaiDateReviewFlags);
  const scope={emirate:'Dubai',evidenceClass:'licensed_secondary_copy_of_authority_project_register',grain:'one_republisher_csv_row_per_dld_project_number',canonicalProjectMatches:links.size,crosswalkVersion:crosswalk?.version||null,projectCoordinatesPresent:false,geometryCaptured:false,derivedDateReview:{basis:'The dated source CSV; review flags do not revise source dates or establish actual delivery.',declaredBeforeRegisteredStart:dateReview.filter(flags=>flags.includes('declared_handover_before_registered_start')).length,declaredBeforeIncompleteInspection:dateReview.filter(flags=>flags.includes('declared_handover_before_incomplete_inspection')).length,projectsWithFlags:dateReview.filter(flags=>flags.length).length},limits:report?.limits};
  const rows=sourceRows.map((row,index)=>({...row,dateReviewFlags:dateReview[index],...(links.has(row.sourceProjectNumber)?{canonicalProjectId:links.get(row.sourceProjectNumber),matchStatus:'reviewed_one_to_one'}:{})}));
  if(path!==DUBAI_STATUS_BASE){const id=path.slice(DUBAI_STATUS_BASE.length+1),project=rows.find(row=>row.sourceProjectNumber===id);return project?dubaiReply(request,{source,scope,project}):dubaiReply(request,{error:'Source project not found'},404);}
  const params=url.searchParams,limit=params.has('limit')?dubaiInt(params.get('limit'),1,100):50,offset=params.has('offset')?dubaiInt(params.get('offset'),0,report.rowCount):0,q=(params.get('q')||'').trim(),community=(params.get('community')||'').trim();
  if(limit===null||offset===null||q.length>120||community.length>120)return dubaiReply(request,{error:'Invalid q, community, limit, or offset'},400);
  const needle=q.toLocaleLowerCase('en'),place=community.toLocaleLowerCase('en');
  const filtered=rows.filter(row=>(!place||row.community.toLocaleLowerCase('en')===place)&&(!needle||[row.sourceProjectNumber,row.name,row.developerName,row.community].some(value=>value.toLocaleLowerCase('en').includes(needle))));
  return dubaiReply(request,{source,scope,filters:{q:q||null,community:community||null},totalProjects:filtered.length,limit,offset,projects:filtered.slice(offset,offset+limit)});
 }catch{return dubaiReply(request,{error:'The verified Dubai project-status snapshot is temporarily unavailable.'},503);}
}
