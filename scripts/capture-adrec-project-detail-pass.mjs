#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const option=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
const outputPath=option('--output');
const delayMs=Number(option('--delay-ms')||750);
const resume=args.includes('--resume');
const buildOnly=args.includes('--build-only');
if(!outputPath||!Number.isFinite(delayMs)||delayMs<500){
  console.error('Usage: node scripts/capture-adrec-project-detail-pass.mjs --output <private-or-sanitized-output.json> [--resume] [--delay-ms >=500]');
  process.exit(2);
}

const asOf='2026-10-07';
const prior=JSON.parse(await fs.readFile(path.join(ROOT,'enrichment/v17/pass40-adrec-register-listing.json'),'utf8'));
const byId=new Map();
for(const fact of prior.facts.filter(row=>row.status==='accepted'&&row.kind==='register')){
  const id=Number(fact.fields?.directoryId);
  if(!Number.isSafeInteger(id)||!fact.recordId||!fact.fields?.projectNumber)throw new Error('V17 register facts need exact numeric IDs and project numbers');
  if(byId.has(id))throw new Error(`Duplicate V17 register ID ${id}`);
  byId.set(id,{recordId:fact.recordId,projectNumber:String(fact.fields.projectNumber),nativeName:fact.fields.nativeName||null,registrationDate:fact.fields.projectCreateDateDubai||null});
}
if(byId.size!==305)throw new Error(`Expected 305 V17 exact-ID project records; found ${byId.size}`);

const out=path.resolve(outputPath);
let priorRows=[];
if(resume||buildOnly){
  try{priorRows=JSON.parse(await fs.readFile(out,'utf8')).collection?.recordResults||[];}catch{}
}
const resultById=new Map(priorRows.map(row=>[Number(row.directoryId),row]));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const hash=value=>createHash('sha256').update(value).digest('hex');
const parseDate=value=>{
  if(typeof value!=='string')return null;
  const iso=/^(20\d{2}-\d{2}-\d{2})(?:$|T)/.exec(value.trim());
  if(iso)return iso[1];
  const epoch=/^\/Date\((\d+)\)\/$/.exec(value.trim());
  if(epoch){const date=new Date(Number(epoch[1]));if(Number.isFinite(date.getTime()))return date.toISOString().slice(0,10);}
  return null;
};
const pct=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100?value:null;
const safeWrite=async()=>{
  const rows=[...resultById.values()].sort((a,b)=>a.directoryId-b.directoryId);
  const packet=buildPacket(rows);
  await fs.mkdir(path.dirname(out),{recursive:true});
  await fs.writeFile(out,JSON.stringify(packet,null,2)+'\n',{mode:0o600});
};
function buildPacket(rows){
  const sources=[],facts=[],accepted=[],issues=[];
  for(const row of rows){
    if(row.status!=='accepted'){issues.push({directoryId:row.directoryId,status:row.status,httpStatus:row.httpStatus||null,reason:row.reason||null});continue;}
    const identity=byId.get(row.directoryId);if(!identity)throw new Error('Captured ID is absent from fixed V17 register');
    const futureReportDate=Boolean(row.latestReportInspectionDate&&row.latestReportInspectionDate>asOf);
    if(futureReportDate)issues.push({directoryId:row.directoryId,status:'future_report_date_disputed',reportedDate:row.latestReportInspectionDate,retrievedAt:row.retrievedAt,reason:'latest inspection report date is after the fixed snapshot cutoff; report metrics excluded'});
    const sourceId=`v18-src-adrec-project-detail-${row.directoryId}`;
    sources.push({
      id:sourceId,url:row.sourceUrl,publisher:'Abu Dhabi Real Estate Centre (ADREC)',
      retrievedAt:row.retrievedAt,publishedAt:null,firstAvailableAt:row.retrievedAt,
      availabilityBasis:'First verified capture of the official public project-detail response; the inspection date is separate from source availability.',
      publicationDateStatus:'current_api_snapshot',classification:'primary_authority_project_detail_snapshot',primaryEvidence:true,
      licence:'rights_pending: minimal factual fields extracted from the public detail endpoint; no dataset reuse licence inferred; raw response and unrelated contact or escrow fields were not retained or redistributed.',
      sha256:row.rawResponseSha256,bytes:row.rawResponseBytes,httpStatus:row.httpStatus,
      rawBodyRetained:false,rawBodyRedistributed:false,extractionVersion:'reviewed-adrec-v18-1',recordCount:1,
      retrievalEndpoint:row.retrievalEndpoint
    });
    const identityBasis=`The official ADREC detail response numeric ID ${row.directoryId} and project number ${row.projectNumber} both match the existing fixed-catalogue record ${identity.recordId}; no name-only join, community assignment, or cross-record merge is used.`;
    const common={sourceIds:[sourceId],identitySourceIds:[sourceId],identityBasis,firstAvailableAt:row.retrievedAt,publishedAt:null,primaryEvidence:true,identityVerified:true,scope:'subject'};
    facts.push({
      id:`v18-adrec-detail-register-${row.directoryId}`,status:'accepted',recordId:identity.recordId,kind:'register',...common,
      registeredProjectId:`ADREC:${row.directoryId}`,evidenceClass:'primary_authority_project_detail_snapshot',
      fields:{authority:'ADREC',directoryId:row.directoryId,projectNumber:row.projectNumber,registeredOn:row.detailRegistrationDate,
        listingRegistrationDate:row.listingRegistrationDate,registrationDateComparison:row.registrationDateComparison,
        progressPercentage:row.detailProgressPercentage,latestReportInspectionDate:futureReportDate?null:row.latestReportInspectionDate,
        latestReportCompletionPercentage:futureReportDate?null:row.latestReportCompletionPercentage,
        latestReportStatus:futureReportDate?'future_dated_disputed':row.latestReportInspectionDate?'dated_report':'no_latest_report',retrievedAt:row.retrievedAt,
        responseSha256:row.rawResponseSha256,rawResponseRetained:false}
    });
    if(!futureReportDate&&row.latestReportInspectionDate&&row.latestReportCompletionPercentage!==null){
      const date=row.latestReportInspectionDate,pctValue=row.latestReportCompletionPercentage;
      facts.push({id:`v18-adrec-inspection-progress-${row.directoryId}`,status:'accepted',recordId:identity.recordId,kind:'lifecycle',...common,
        milestone:'construction_progress',date:{start:date,precision:'day'},verification:'verified',eventStatus:'reported',
        evidenceClass:'primary_authority_inspection_report_progress',
        label:`ADREC project-detail report for project ID ${row.directoryId} records ${pctValue}% completion at inspection on ${date}.`,
        note:`This dated value is the CompletionPercentage in the latest report's InspectionDate record. It was first retrieved on ${row.retrievedAt}; it was not available to earlier-vintage forecasts. It is progress evidence, not a completion certificate, handover, occupancy, sale-price or rent observation.`
      });
    }else if(!futureReportDate&&row.latestReportInspectionDate){
      const date=row.latestReportInspectionDate;
      facts.push({id:`v18-adrec-inspection-${row.directoryId}`,status:'accepted',recordId:identity.recordId,kind:'lifecycle',...common,
        milestone:'inspection',date:{start:date,precision:'day'},verification:'verified',eventStatus:'reported',
        evidenceClass:'primary_authority_project_inspection_report',
        label:`ADREC project-detail record for project ID ${row.directoryId} lists an inspection report dated ${date}.`,
        note:`The report date was first retrieved on ${row.retrievedAt}; the detail response provided no valid report completion percentage. This does not establish project completion, handover, occupancy, a price, or rent.`
      });
    }
    accepted.push(row.directoryId);
  }
  const exact=rows.filter(row=>row.status==='accepted');
  const registrationComparisons={match:exact.filter(row=>row.registrationDateComparison==='match').length,mismatch:exact.filter(row=>row.registrationDateComparison==='mismatch').length,detailMissing:exact.filter(row=>row.registrationDateComparison==='detail_missing').length};
  const recordResearch=rows.map(row=>{
    const identity=byId.get(row.directoryId),future=Boolean(row.latestReportInspectionDate&&row.latestReportInspectionDate>asOf);
    return {recordId:identity.recordId,sourceScope:'bounded official ADREC detail-page collection; source availability and financial coverage remain separate',
      collectionPass:'pass41-adrec-project-details',collectionStatus:row.status==='accepted'?(future?'detail_verified_report_date_disputed':'detail_verified'):'detail_missing',
      identityVerified:row.status==='accepted',capturedAt:row.retrievedAt,sourceIds:row.status==='accepted'?[`v18-src-adrec-project-detail-${row.directoryId}`]:[],
      unresolvedReason:row.status==='accepted'?null:(row.reason||row.status),excludedFutureReportMetrics:future};
  });
  return {schemaVersion:1,asOf,sources,facts,seriesLinks:[],recordResearch,historyInputs:[],licensedArchives:[],additionalDatasets:[],sourceCandidates:[],
    methodology:'Bounded exact-ID reads of only the 305 ADREC public project-detail records already matched in V17. The website client uses the same first-party detail endpoint. Only project ID/number, registration date, progress percentage, latest report inspection date and latest report completion percentage are retained. Raw JSON, names, personal contacts, escrow identifiers, report IDs and image URLs are discarded; no images are requested. Registration, inspection progress, completion, handover, occupancy, financial observations and source availability remain separate.',
    collection:{pass:'pass41-adrec-project-details',authority:'Abu Dhabi Real Estate Centre (ADREC)',asOf,
      requestedRecordCount:305,completedRecordCount:rows.length,acceptedExactIdAndProjectNumberMatches:accepted.length,
      failedOrDisputedRows:issues.length,registrationDateComparisons:registrationComparisons,
      recordsWithDatedLatestReport:exact.filter(row=>row.latestReportInspectionDate).length,
      datedInspectionProgressFacts:facts.filter(fact=>fact.id?.startsWith('v18-adrec-inspection-progress-')).length,
      inspectionDateOnlyFacts:facts.filter(fact=>fact.id?.startsWith('v18-adrec-inspection-')).length,
      futureReportedInspectionDates:issues.filter(issue=>issue.status==='future_report_date_disputed').length,
      rawBodiesRetained:false,rawBodiesRedistributed:false,imagesDownloaded:0,
      excludedFields:['developer personal contact details','escrow bank/account/IBAN/email','report identifiers','image URLs and image content','coordinates'],
      minimumRequestIntervalMs:delayMs,recordResults:rows,issues,
      pricesOrRentsAdded:0,projectOrCommunityRecordsAdded:0
    }};
}

if(buildOnly){
  await safeWrite();
  const final=buildPacket([...resultById.values()].sort((a,b)=>a.directoryId-b.directoryId));
  console.log(JSON.stringify({output:out,requested:305,completed:final.collection.completedRecordCount,accepted:final.collection.acceptedExactIdAndProjectNumberMatches,failedOrDisputed:final.collection.failedOrDisputedRows,registrationDateComparisons:final.collection.registrationDateComparisons,recordsWithDatedLatestReport:final.collection.recordsWithDatedLatestReport,datedProgressFacts:final.collection.datedInspectionProgressFacts,facts:final.facts.length,recordResearch:final.recordResearch.length}));
  process.exit(0);
}

let lastRequest=0,attempted=0;
for(const [id,identity] of [...byId].sort(([a],[b])=>a-b)){
  const existing=resultById.get(id);
  if(existing?.status==='accepted')continue;
  const elapsed=Date.now()-lastRequest;if(lastRequest&&elapsed<delayMs)await pause(delayMs-elapsed);
  const sourceUrl=`https://adrec.gov.ae/en/Directory/ProjectsDetails?projectId=${id}`;
  const retrievalEndpoint=`https://adrec.gov.ae/api/feature/Profession/ProjectDetail?id=${id}`;
  let responseText='',response=null,error='';
  for(let retry=0;retry<3;retry++){
    lastRequest=Date.now();
    try{
      response=await fetch(retrievalEndpoint,{headers:{Accept:'application/json','User-Agent':'Espacios public project research','Referer':sourceUrl},signal:AbortSignal.timeout(20000)});
      responseText=await response.text();
      if(response.status===429||response.status>=500){if(retry<2){await pause(1500*(retry+1));continue;}}
      break;
    }catch(e){error=e?.name||'network_error';if(retry<2)await pause(1500*(retry+1));}
  }
  attempted++;
  const retrievedAt=new Date().toISOString();
  let row;
  if(!response||response.status!==200){row={directoryId:id,status:'fetch_failed',httpStatus:response?.status||null,reason:error||'non_200_response',retrievedAt,sourceUrl};}
  else{
    let envelope;try{envelope=JSON.parse(responseText);}catch{envelope=null;}
    const record=envelope?.Data?.Result;
    const rawResponseSha256=hash(responseText),rawResponseBytes=Buffer.byteLength(responseText);
    if(envelope?.Success!==true||!record){row={directoryId:id,status:'detail_missing',httpStatus:200,reason:'success_envelope_or_project_detail_missing',retrievedAt,sourceUrl,rawResponseSha256,rawResponseBytes};}
    else if(Number(record.Id)!==id||String(record.ProjectNumber??'')!==identity.projectNumber){row={directoryId:id,status:'identity_disagreement',httpStatus:200,reason:'authority_id_or_project_number_mismatch',retrievedAt,sourceUrl,rawResponseSha256,rawResponseBytes};}
    else{
      const detailRegistrationDate=parseDate(record.ProjectCreateDate);
      const latest=record.LatestReport&&typeof record.LatestReport==='object'?record.LatestReport:null;
      const latestReportInspectionDate=parseDate(latest?.InspectionDate);
      const latestReportCompletionPercentage=pct(latest?.CompletionPercentage);
      const detailProgressPercentage=pct(record.ProgressPercentage);
      const registrationDateComparison=!detailRegistrationDate?'detail_missing':detailRegistrationDate===identity.registrationDate?'match':'mismatch';
      row={directoryId:id,recordId:identity.recordId,status:'accepted',httpStatus:200,retrievedAt,sourceUrl,retrievalEndpoint,
        projectNumber:identity.projectNumber,projectNumberMatch:true,listingRegistrationDate:identity.registrationDate,
        detailRegistrationDate,registrationDateComparison,detailProgressPercentage,latestReportInspectionDate,
        latestReportCompletionPercentage,rawResponseSha256,rawResponseBytes};
    }
  }
  resultById.set(id,row);
  if(attempted%5===0||attempted===byId.size)await safeWrite();
  if(attempted%25===0)console.log(JSON.stringify({attempted,total:byId.size,completed:[...resultById.values()].filter(x=>x.status==='accepted').length,failedOrDisputed:[...resultById.values()].filter(x=>x.status!=='accepted').length}));
}
await safeWrite();
const final=buildPacket([...resultById.values()].sort((a,b)=>a.directoryId-b.directoryId));
console.log(JSON.stringify({output:out,requested:305,completed:final.collection.completedRecordCount,accepted:final.collection.acceptedExactIdAndProjectNumberMatches,failedOrDisputed:final.collection.failedOrDisputedRows,registrationDateComparisons:final.collection.registrationDateComparisons,recordsWithDatedLatestReport:final.collection.recordsWithDatedLatestReport,datedProgressFacts:final.collection.datedInspectionProgressFacts,facts:final.facts.length}));
