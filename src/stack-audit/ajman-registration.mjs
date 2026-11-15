const AJMAN_REGISTRATION_PATH='/map/api/uae-evidence/ajman/registrations';
let AJMAN_REGISTRATION_ROWS;
const registrationDigest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
const registrationInt=(value,min,max)=>/^\d+$/.test(value||'')&&Number.isSafeInteger(Number(value))&&Number(value)>=min&&Number(value)<=max?Number(value):null;
const registrationResponse=(request,body,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public,max-age=60,s-maxage=300':'no-store','x-content-type-options':'nosniff','x-espacios-evidence-source':'ajman-dlrr-20260821-unit-registration'}});

async function verifiedRegistrationRows(env,report,storeFactory){
 if(!env.MAP_EVIDENCE||env.MAP_IDRIVE_READY!=='true')throw Error('Private evidence binding unavailable');
 if(!AJMAN_REGISTRATION_ROWS)AJMAN_REGISTRATION_ROWS=(async()=>{
  const object=await storeFactory(env.MAP_EVIDENCE,env.MAP_IDRIVE_TRACE).get(report.storageKey);
  if(!object||object.sha256!==report.compressedSha256||object.size!==report.compressedBytes)throw Error('Registration object metadata mismatch');
  const compressed=await object.arrayBuffer();
  if(compressed.byteLength!==report.compressedBytes||await registrationDigest(compressed)!==report.compressedSha256)throw Error('Registration object checksum mismatch');
  const raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if(raw.byteLength!==report.rawBytes||await registrationDigest(raw)!==report.rawSha256)throw Error('Registration decoded checksum mismatch');
  const rows=JSON.parse(new TextDecoder().decode(raw));
  if(!Array.isArray(rows)||rows.length!==report.rows)throw Error('Registration row count mismatch');
  let initialCount=0,initialValue=0,deedCount=0,deedValue=0;const labels=new Set();
  for(const row of rows){
   if(typeof row.project_name_english!=='string'||!row.project_name_english||!Number.isInteger(row.year)||!Number.isInteger(row.quarter)||!Number.isInteger(row.initial_certificates_count)||!Number.isInteger(row.title_deeds_count)||!Number.isFinite(row.initial_certificates_values_in_aed)||!Number.isFinite(row.title_deeds_values_in_aed))throw Error('Registration row invalid');
   labels.add(row.project_name_english);initialCount+=row.initial_certificates_count;initialValue+=row.initial_certificates_values_in_aed;deedCount+=row.title_deeds_count;deedValue+=row.title_deeds_values_in_aed;
  }
  if(labels.size!==report.distinctSourceProjectLabels||initialCount!==report.initialCertificatesCountSum||deedCount!==report.titleDeedsCountSum||Math.abs(initialValue-report.initialCertificatesValueAedSum)>0.01||Math.abs(deedValue-report.titleDeedsValueAedSum)>0.01)throw Error('Registration population mismatch');
  return rows;
 })().catch(error=>{AJMAN_REGISTRATION_ROWS=undefined;throw error});
 return AJMAN_REGISTRATION_ROWS;
}

export async function mapAjmanRegistration(request,env,report,storeFactory=mapEvidenceStore){
 const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'');
 if(path!==AJMAN_REGISTRATION_PATH)return null;
 if(!['GET','HEAD'].includes(request.method))return registrationResponse(request,{error:'Read-only endpoint'},405);
 if(!report?.storageKey||!report.compressedSha256)return registrationResponse(request,{error:'Verified Ajman registration source is not configured.'},503);
 const source={id:report.sourceId,publisher:report.publisher,datasetUrl:report.datasetUrl,licence:report.licence,licenceUrl:report.licenceUrl,sourceModifiedAt:report.sourceModifiedAt,retrievedAt:report.retrievedAt,rawSha256:report.rawSha256,compressedSha256:report.compressedSha256,rows:report.rows,distinctSourceProjectLabels:report.distinctSourceProjectLabels,initialCertificatesCountSum:report.initialCertificatesCountSum,initialCertificatesValueAedSum:report.initialCertificatesValueAedSum,titleDeedsCountSum:report.titleDeedsCountSum,titleDeedsValueAedSum:report.titleDeedsValueAedSum,firstPeriod:report.firstPeriod,lastPeriod:report.lastPeriod,grain:report.grain,storage:'private_idrive_e2_verified_object'};
 const scope={emirate:'Ajman',evidenceClass:report.evidenceClass,canonicalProjectMatches:0,limits:'Quarterly source-project-label aggregates. Initial certificates and title deeds are separate registration stages and may refer to the same unit; their counts must not be added as unique sales. No individual transactions, verified coordinates, or automatic V48 identity joins.'};
 const params=url.searchParams,year=params.has('year')?registrationInt(params.get('year'),2019,2026):null,quarter=params.has('quarter')?registrationInt(params.get('quarter'),1,4):null,limit=params.has('limit')?registrationInt(params.get('limit'),1,100):50,offset=params.has('offset')?registrationInt(params.get('offset'),0,5124):0,project=params.get('project'),stage=params.get('stage')||'all';
 if((params.has('year')&&year===null)||(params.has('quarter')&&quarter===null)||limit===null||offset===null||(project!==null&&(!project.trim()||project.length>180))||!['all','initial','final'].includes(stage))return registrationResponse(request,{error:'Invalid year, quarter, project, stage, limit, or offset.'},400);
 try{
  const rows=await verifiedRegistrationRows(env,report,storeFactory),matches=[];let initialCount=0,initialValue=0,deedCount=0,deedValue=0;
  for(let i=0;i<rows.length;i++){const row=rows[i];if(year!==null&&row.year!==year||quarter!==null&&row.quarter!==quarter||project!==null&&row.project_name_english!==project||stage==='initial'&&!row.initial_certificates_count||stage==='final'&&!row.title_deeds_count)continue;matches.push({...row,sourceRowIndex:i,canonicalProjectId:null,matchStatus:'unmatched'});initialCount+=row.initial_certificates_count;initialValue+=row.initial_certificates_values_in_aed;deedCount+=row.title_deeds_count;deedValue+=row.title_deeds_values_in_aed;}
  matches.sort((a,b)=>b.year-a.year||b.quarter-a.quarter||a.project_name_english.localeCompare(b.project_name_english)||a.sourceRowIndex-b.sourceRowIndex);
  return registrationResponse(request,{source,scope,filters:{year,quarter,project,stage},totalRows:matches.length,totals:{initialCertificatesCount:initialCount,initialCertificatesValueAed:Number(initialValue.toFixed(2)),titleDeedsCount:deedCount,titleDeedsValueAed:Number(deedValue.toFixed(2))},limit,offset,rows:matches.slice(offset,offset+limit)});
 }catch{return registrationResponse(request,{error:'The verified Ajman registration source is temporarily unavailable.'},503);}
}
