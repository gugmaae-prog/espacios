const AJMAN_MANAGEMENT_PATH='/map/api/uae-evidence/ajman/management';
let AJMAN_MANAGEMENT_ROWS;
const managementDigest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
const managementInt=(value,min,max)=>/^\d+$/.test(value||'')&&Number.isSafeInteger(Number(value))&&Number(value)>=min&&Number(value)<=max?Number(value):null;
const managementReply=(request,body,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public,max-age=60,s-maxage=300':'no-store','x-content-type-options':'nosniff','x-espacios-evidence-source':'ajman-dlrr-20260609-project-management',...(status===405?{allow:'GET, HEAD'}:{})}});

async function verifiedManagementRows(report,packed){
 if(!AJMAN_MANAGEMENT_ROWS)AJMAN_MANAGEMENT_ROWS=(async()=>{
  const binary=atob(packed),compressed=Uint8Array.from(binary,char=>char.charCodeAt(0));
  if(compressed.byteLength!==report.compressedBytes||await managementDigest(compressed)!==report.compressedSha256)throw Error('Management compressed checksum mismatch');
  const raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if(raw.byteLength!==report.rawBytes||await managementDigest(raw)!==report.rawSha256)throw Error('Management decoded checksum mismatch');
  const rows=JSON.parse(new TextDecoder().decode(raw));
  if(!Array.isArray(rows)||rows.length!==report.rows)throw Error('Management row count mismatch');
  const ids=new Set(),offices=new Set(),yearRows={},projectYears=new Set();
  for(const row of rows){
   if(!Number.isSafeInteger(row.project_id)||row.project_id<1||!Number.isSafeInteger(row.office_id)||row.office_id<1||!Number.isSafeInteger(row.year)||row.year<2024||row.year>2026||typeof row.project_name_english!=='string'||!row.project_name_english.trim()||typeof row.management_company_name_in_english!=='string'||!row.management_company_name_in_english.trim())throw Error('Management row invalid');
   const key=row.project_id+'|'+row.year;if(projectYears.has(key))throw Error('Duplicate management project-year');projectYears.add(key);
   ids.add(row.project_id);offices.add(row.office_id);yearRows[row.year]=(yearRows[row.year]||0)+1;
  }
  if(ids.size!==report.distinctSourceProjectIds||offices.size!==report.distinctOfficeIds||JSON.stringify(yearRows)!==JSON.stringify(report.yearRows))throw Error('Management population mismatch');
  return rows;
 })().catch(error=>{AJMAN_MANAGEMENT_ROWS=undefined;throw error});
 return AJMAN_MANAGEMENT_ROWS;
}

export async function mapAjmanManagement(request,report,packed){
 const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'');
 if(path!==AJMAN_MANAGEMENT_PATH)return null;
 if(!['GET','HEAD'].includes(request.method))return managementReply(request,{error:'Read-only endpoint'},405);
 if(!report?.rawSha256||typeof packed!=='string')return managementReply(request,{error:'Verified Ajman management source is not configured.'},503);
 const params=url.searchParams,year=params.has('year')?managementInt(params.get('year'),2024,2026):null,projectId=params.has('projectId')?managementInt(params.get('projectId'),1,999999):null,limit=params.has('limit')?managementInt(params.get('limit'),1,100):50,offset=params.has('offset')?managementInt(params.get('offset'),0,report.rows):0,scope=params.get('scope')||'latest',q=(params.get('q')||'').trim();
 if((params.has('year')&&year===null)||(params.has('projectId')&&projectId===null)||limit===null||offset===null||!['latest','all'].includes(scope)||q.length>120)return managementReply(request,{error:'Invalid year, projectId, scope, q, limit, or offset.'},400);
 try{
  const rows=await verifiedManagementRows(report,packed),latestById=new Map();
  for(const row of rows){const prev=latestById.get(row.project_id);if(!prev||prev.year<row.year)latestById.set(row.project_id,row);}
  const query=q.toLocaleLowerCase('en');
  const matches=rows.filter(row=>year!==null?row.year===year:scope==='all'||latestById.get(row.project_id)===row).filter(row=>(projectId===null||row.project_id===projectId)&&(!query||[row.project_name_english,row.project_name_arabic,row.management_company_name_in_english,row.management_company_name_in_arabic].some(value=>value.toLocaleLowerCase('en').includes(query)))).sort((a,b)=>b.year-a.year||a.project_name_english.localeCompare(b.project_name_english)||a.project_id-b.project_id);
  const source={id:report.sourceId,publisher:report.publisher,datasetUrl:report.datasetUrl,licence:report.licence,licenceUrl:report.licenceUrl,sourceModifiedAt:report.sourceModifiedAt,retrievedAt:report.retrievedAt,rawSha256:report.rawSha256,rows:report.rows,distinctSourceProjectIds:report.distinctSourceProjectIds,linkedOfficialRegisterIds:report.linkedOfficialRegisterIds,latestReportedYear:report.latestReportedYear,yearRows:report.yearRows,grain:report.grain,storage:'checksum_verified_immutable_worker_snapshot'};
  const scopeInfo={emirate:'Ajman',evidenceClass:report.evidenceClass,canonicalProjectMatches:0,coordinatesPresent:false,limits:'Annual management-company appointments for 153 official Ajman source IDs. These are not developers, property owners, map pins, sale observations, or a complete Ajman project census. The 2026 rows are latest reported appointments, not proof of present-day status.'};
  return managementReply(request,{source,scope:scopeInfo,filters:{year,projectId,scope:year!==null?'reported_year':scope,q:q||null},totalRows:matches.length,distinctSourceProjectIds:new Set(matches.map(row=>row.project_id)).size,limit,offset,rows:matches.slice(offset,offset+limit).map(row=>({sourceProjectId:row.project_id,projectNameEn:row.project_name_english,projectNameAr:row.project_name_arabic,managementCompanyEn:row.management_company_name_in_english,managementCompanyAr:row.management_company_name_in_arabic,officeId:row.office_id,reportedYear:row.year,latestForSourceProject:latestById.get(row.project_id)===row,canonicalProjectId:null,coordinates:null}))});
 }catch{return managementReply(request,{error:'The verified Ajman management source is temporarily unavailable.'},503);}
}
