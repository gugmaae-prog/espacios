const UAE_EVIDENCE_BASE='/map/api/uae-evidence';
let UAE_AJMAN_DATA_PROMISE;
const uaeHex=bytes=>Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
const uaeDigest=async bytes=>uaeHex(await crypto.subtle.digest('SHA-256',bytes));
function uaeEvidenceResponse(request,body,status=200){return new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public,max-age=60,s-maxage=300':'no-store','x-content-type-options':'nosniff','x-espacios-evidence-source':'ajman-dlrr-20260821-unit-sales'}});}
function uaeInteger(value,min,max){if(value===null||!/^\d+$/.test(value))return null;const n=Number(value);return Number.isSafeInteger(n)&&n>=min&&n<=max?n:null;}
async function uaeAjmanRows(env,report,storeFactory){
 if(!env.MAP_EVIDENCE||env.MAP_IDRIVE_READY!=='true')throw Error('IDrive evidence source unavailable');
 if(!UAE_AJMAN_DATA_PROMISE)UAE_AJMAN_DATA_PROMISE=(async()=>{
  const object=await storeFactory(env.MAP_EVIDENCE,env.MAP_IDRIVE_TRACE).get(report.storageKey);
  if(!object||object.sha256!==report.compressedSha256||object.size!==report.compressedBytes)throw Error('Ajman source metadata mismatch');
  const compressed=await object.arrayBuffer();
  if(compressed.byteLength!==report.compressedBytes||await uaeDigest(compressed)!==report.compressedSha256)throw Error('Ajman source compressed checksum mismatch');
  const raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if(raw.byteLength!==report.rawBytes||await uaeDigest(raw)!==report.rawSha256)throw Error('Ajman source decoded checksum mismatch');
  const rows=JSON.parse(new TextDecoder().decode(raw));
  if(!Array.isArray(rows)||rows.length!==report.rows)throw Error('Ajman source row count mismatch');
  const labels=new Set();let sales=0,value=0;
  for(const row of rows){if(typeof row.project_name_english!=='string'||!Number.isInteger(row.sales_count)||row.sales_count<1||!Number.isFinite(row.total_sales_values_in_aed)||!Number.isInteger(row.year)||!Number.isInteger(row.quarter))throw Error('Ajman source row invalid');labels.add(row.project_name_english);sales+=row.sales_count;value+=row.total_sales_values_in_aed;}
  if(labels.size!==report.distinctSourceProjectLabels||sales!==report.reportedUnitSalesCountSum||Math.abs(value-report.reportedValueAedSum)>0.01)throw Error('Ajman source totals mismatch');
  return rows;
 })().catch(error=>{UAE_AJMAN_DATA_PROMISE=undefined;throw error});
 return UAE_AJMAN_DATA_PROMISE;
}
export async function mapUaeEvidence(request,env,report,storeFactory=mapEvidenceStore){
 const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'');
 const commercialPath=UAE_EVIDENCE_BASE+'/ajman/commercial-sales';
 if(![UAE_EVIDENCE_BASE,UAE_EVIDENCE_BASE+'/ajman/sales',UAE_EVIDENCE_BASE+'/ajman/projects',commercialPath].includes(path))return null;
 if(!['GET','HEAD'].includes(request.method))return uaeEvidenceResponse(request,{error:'Read-only endpoint'},405);
 if(!report?.storageKey||!report.compressedSha256)return uaeEvidenceResponse(request,{error:'The verified Ajman source is not configured.'},503);
 const source={id:report.sourceId,publisher:report.publisher,datasetUrl:report.datasetUrl,licence:report.licence,licenceUrl:report.licenceUrl,sourceModifiedAt:report.sourceModifiedAt,retrievedAt:report.retrievedAt,rawSha256:report.rawSha256,rawBytes:report.rawBytes,compressedSha256:report.compressedSha256,rows:report.rows,distinctSourceProjectLabels:report.distinctSourceProjectLabels,reportedSalesCountSum:report.reportedUnitSalesCountSum,reportedValueAedSum:report.reportedValueAedSum,firstPeriod:report.firstPeriod,lastPeriod:report.lastPeriod,grain:report.grain,storage:'private_idrive_e2_verified_object'};
 const scope={emirate:'Ajman',evidenceClass:'official_registered_sale_aggregate',canonicalProjectMatches:0,matchStatus:'unmatched_source_project_labels',limits:'Quarterly project-label aggregates, not individual transactions, a full Ajman development register, a map-coordinate source, or complete lifetime histories.'};
 try{
  const rows=await uaeAjmanRows(env,report,storeFactory);
  if(path===UAE_EVIDENCE_BASE)return uaeEvidenceResponse(request,{sources:[source],scope,relatedSources:[{route:'/map/api/uae-evidence/ajman/commercial-sales',evidenceClass:'official_commercial_unit_sale_aggregate',relation:'Office and shop sale aggregates within this same verified Ajman source; no current availability or individual spaces.'},{route:'/map/api/uae-evidence/ajman/rent-contracts?city=ajman&category=Commercial',evidenceClass:'official_commercial_rent_contract_count',relation:'Separate municipal contract counts, without rent prices or unit identities.'},{route:'/map/api/uae-evidence/ajman/register',evidenceClass:'official_project_register_snapshot',relation:'Separate dated Ajman source project IDs; no automatic joins or coordinates.'},{route:'/map/api/uae-evidence/ajman/registrations',evidenceClass:'official_unit_registration_aggregate',relation:'Tentative certificates and final title deeds remain separate stages; no automatic joins or coordinates.'},{route:'/map/api/uae-evidence/ajman/dispositions',evidenceClass:'official_mixed_unit_disposition_aggregate',relation:'Mixed unit dispositions and mortgage activity overlap sales; missing values and periods remain unknown. Stored as a separately verified immutable asset.'},{route:'/map/api/uae-evidence/ajman/management',evidenceClass:'official_project_management_appointment',relation:'Annual management-company appointments linked to exact official Ajman source IDs; not developer identity or map coordinates.'},{route:'/map/api/uae-evidence/ajman/areas',evidenceClass:'official_area_reference_point',relation:'Dated Ajman area reference points only; not project coordinates or verified district centroids.'}],otherEmirates:'No new source is asserted here; accepted V48 map and history evidence remain separate.'});
  if(path.endsWith('/projects')){
   const grouped=new Map();
   for(const row of rows){let item=grouped.get(row.project_name_english);if(!item){item={nameEn:row.project_name_english,nameAr:row.project_name_arabic,aggregateRows:0,reportedSalesCountSum:0,reportedValueAedSum:0};grouped.set(row.project_name_english,item);}item.aggregateRows++;item.reportedSalesCountSum+=row.sales_count;item.reportedValueAedSum+=row.total_sales_values_in_aed;}
   const projects=[...grouped.values()].map(item=>({...item,reportedValueAedSum:Number(item.reportedValueAedSum.toFixed(2))})).sort((a,b)=>a.nameEn.localeCompare(b.nameEn));
   return uaeEvidenceResponse(request,{source,scope,projects,count:projects.length});
  }
  const commercial=path===commercialPath,params=url.searchParams,year=params.has('year')?uaeInteger(params.get('year'),2019,2026):null,quarter=params.has('quarter')?uaeInteger(params.get('quarter'),1,4):null,limit=params.has('limit')?uaeInteger(params.get('limit'),1,100):50,offset=params.has('offset')?uaeInteger(params.get('offset'),0,6075):0,project=params.get('project'),unitType=params.get('unitType');
  if((params.has('year')&&year===null)||(params.has('quarter')&&quarter===null)||limit===null||offset===null||(project!==null&&(!project.trim()||project.length>180))||(unitType!==null&&(!commercial||!['Office','Shop'].includes(unitType))))return uaeEvidenceResponse(request,{error:'Invalid year, quarter, project, unitType, limit, or offset.'},400);
  const matches=[];for(let i=0;i<rows.length;i++){const row=rows[i];if(commercial&&!['Office','Shop'].includes(row.unit_type_english)||unitType!==null&&row.unit_type_english!==unitType||year!==null&&row.year!==year||quarter!==null&&row.quarter!==quarter||project!==null&&row.project_name_english!==project)continue;matches.push({...row,sourceRowIndex:i,canonicalProjectId:null,matchStatus:'unmatched'});}
  matches.sort((a,b)=>b.year-a.year||b.quarter-a.quarter||a.project_name_english.localeCompare(b.project_name_english)||a.sourceRowIndex-b.sourceRowIndex);
  const commercialScope=commercial?{...scope,evidenceClass:'official_commercial_unit_sale_aggregate',unitTypes:['Office','Shop'],limits:'Quarterly office and shop sale aggregates for named Ajman projects. Reported sales counts are not distinct available spaces; no active listing, rent quote, floor area, exact unit identity, coordinates, or complete market coverage is established.'}:scope;
  return uaeEvidenceResponse(request,{source,scope:commercialScope,filters:{year,quarter,project,...(commercial?{unitType}:{} )},totalRows:matches.length,...(commercial?{reportedSalesCountSum:matches.reduce((sum,row)=>sum+row.sales_count,0),reportedValueAedSum:Number(matches.reduce((sum,row)=>sum+row.total_sales_values_in_aed,0).toFixed(2)),distinctSourceProjectLabels:new Set(matches.map(row=>row.project_name_english)).size,relatedRentalEvidence:'/map/api/uae-evidence/ajman/rent-contracts?city=ajman&category=Commercial'}:{}),limit,offset,rows:matches.slice(offset,offset+limit)});
 }catch{return uaeEvidenceResponse(request,{error:'The verified Ajman evidence source is temporarily unavailable.'},503);}
}
