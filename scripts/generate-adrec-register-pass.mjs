#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const option=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
const capturePath=option('--capture');
if(!capturePath){console.error('Usage: node scripts/generate-adrec-register-pass.mjs --capture <private-capture.json> [--output <packet.json>]');process.exit(2);}
const outputPath=path.resolve(option('--output')||path.join(ROOT,'enrichment/v17/pass40-adrec-register-listing.json'));
const baselinePath=path.resolve(option('--baseline')||path.join(ROOT,'data/historical-intelligence-20261003.json'));
const priorPath=path.join(ROOT,'enrichment/v16/pass39-adrec-nawayef-primary.json');
const asOf='2026-10-07';
const capture=await fs.readFile(path.resolve(capturePath));
const captureSha=createHash('sha256').update(capture).digest('hex');
const prior=JSON.parse(await fs.readFile(priorPath,'utf8'));
const source=prior.sources.find(row=>row.id==='v16-src-adrec-project-listing');
if(!source||capture.length!==source.bytes||captureSha!==source.sha256)throw new Error('Private capture does not match the checksum-recorded ADREC ProjectListing response');
const envelope=JSON.parse(capture.toString('utf8'));
const rows=envelope?.Data?.Result?.Projects;
if(envelope?.Success!==true||!Array.isArray(rows)||rows.length!==320)throw new Error('Unexpected ADREC ProjectListing envelope or row count');
const ids=rows.map(row=>Number(row.Id));
if(ids.some(id=>!Number.isSafeInteger(id))||new Set(ids).size!==rows.length)throw new Error('ProjectListing IDs must be unique safe integers');

const baseline=JSON.parse(await fs.readFile(baselinePath,'utf8'));
if(baseline.records.length!==1860)throw new Error('Baseline catalogue must retain exactly 1,860 records');
const records=new Map(baseline.records.map(record=>[record.id,record]));
const listingSourceId=source.id;
const alreadyAllocated=new Map();
for(const record of baseline.records){
  for(const evidence of record.registerEvidence||[]){
    const registered=evidence.registeredProjectId;
    if(evidence.sourceIds?.includes(listingSourceId)&&!String(evidence.id||'').startsWith('v17-adrec-register-')&&/^ADREC:\d+$/.test(registered||'')){
      const id=Number(registered.slice('ADREC:'.length));
      alreadyAllocated.set(id,{recordId:record.id,evidenceId:evidence.id});
    }
  }
}

function parseNativeDate(value){
  const match=/^\/Date\((\d+)\)\/$/.exec(value||'');
  if(!match)return null;
  const date=new Date(Number(match[1]));
  if(!Number.isFinite(date.getTime()))throw new Error('Invalid ADREC date epoch');
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Dubai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function finite(value){return typeof value==='number'&&Number.isFinite(value);}
function inRange(value,name){if(value!==null&&value!==undefined&&(!finite(value)||value<0||value>100))throw new Error(`${name} must be a numeric percentage between 0 and 100`);return value??null;}
function count(value,name){if(value!==null&&value!==undefined&&(!Number.isSafeInteger(value)||value<0))throw new Error(`${name} must be a non-negative integer`);return value??null;}

// Cross-check the API epoch's Dubai calendar date against the exact detail
// register dates already accepted for three V16 projects. This guards against
// turning a UTC midnight conversion into the wrong local registration day.
const knownDates=new Map(prior.facts.filter(fact=>fact.kind==='register'&&fact.fields?.directoryId&&fact.fields?.registeredOn)
  .map(fact=>[Number(fact.fields.directoryId),fact.fields.registeredOn]));
const dateChecks=[];
for(const id of [594,595,597]){
  const row=rows.find(item=>Number(item.Id)===id),reported=knownDates.get(id),derived=parseNativeDate(row?.ProjectCreateDate);
  if(!row||!reported||!derived||reported!==derived)throw new Error(`ADREC local-date cross-check failed for project ${id}`);
  dateChecks.push({directoryId:id,detailRegisteredOn:reported,listingProjectCreateDate:derived,match:true});
}

const facts=[],recordResearch=[],unmatched=[],excluded=[];
let registrationFacts=0,progressFacts=0,missingRegistrationDates=0,missingProgress=0;
for(const row of rows){
  const id=Number(row.Id),recordId=`adrec:${id}`,record=records.get(recordId);
  if(!record){unmatched.push({directoryId:id,reason:'No exact ADREC-ID record in the fixed catalogue; no name-based record created.'});continue;}
  if(record.type!=='project')throw new Error(`Exact ADREC ID ${id} resolves to a non-project record`);
  const priorOwner=alreadyAllocated.get(id);
  if(priorOwner){
    excluded.push({directoryId:id,existingRecordId:priorOwner.recordId,evidenceId:priorOwner.evidenceId,reason:'This exact ADREC authority ID is already allocated to reviewed canonical subject evidence; do not fan out the same register row.'});
    continue;
  }
  if(!row.ProjectNumber||!row.Name)throw new Error(`Exact ADREC ID ${id} lacks a project number or native name`);
  const projectCreateDate=parseNativeDate(row.ProjectCreateDate),createDate=parseNativeDate(row.CreateDate);
  if(projectCreateDate&&projectCreateDate>asOf)throw new Error(`Future project registration date for ADREC ID ${id}`);
  const progress=inRange(row.ProgressPercentage,'ProgressPercentage');
  const soldPercentage=inRange(row.SoldPercentage,'SoldPercentage');
  const soldUnitPercentage=inRange(row.SoldUnitPercentage,'SoldUnitPercentage');
  const total=count(row.totalCount,'totalCount'),sold=count(row.SoldCount,'SoldCount');
  if(total!==null&&sold!==null&&sold>total)throw new Error(`ADREC sold count exceeds total for project ${id}`);
  const identityBasis=`The public ADREC directory numeric ID ${id} resolves exactly to existing catalogue record ${recordId}; the native project number ${row.ProjectNumber} is retained as register evidence, not used for a name-only join or cross-record merge.`;
  const common={sourceIds:[listingSourceId],identitySourceIds:[listingSourceId],identityBasis,firstAvailableAt:source.firstAvailableAt||source.retrievedAt,publishedAt:null,primaryEvidence:true,identityVerified:true,scope:'subject'};
  const fields={
    authority:'ADREC',directoryId:id,projectNumber:String(row.ProjectNumber),nativeName:String(row.Name),
    projectType:row.Type??null,projectStatus:row.Status??null,developerName:row.DeveloperName??null,
    municipalityLabel:row.MunicipalityEn??null,communityCode:row.CommunityEn??null,districtCode:row.DistrictEn??null,
    buildingUsage:row.BuildingUsageEn??null,projectCreateDateRaw:row.ProjectCreateDate??null,createDateRaw:row.CreateDate??null,
    projectCreateDateDubai:projectCreateDate,createDateDubai:createDate,dateFieldsAgree:projectCreateDate===createDate,
    progressPercentage:progress,totalCount:total,soldCount:sold,soldPercentage,soldUnitPercentage,
    retrievedAt:source.retrievedAt,registerCaptureId:listingSourceId
  };
  facts.push({id:`v17-adrec-register-${id}`,status:'accepted',recordId,kind:'register',...common,registeredProjectId:`ADREC:${id}`,evidenceClass:'primary_authority_project_register_snapshot',fields});
  if(projectCreateDate){
    facts.push({id:`v17-adrec-registration-${id}`,status:'accepted',recordId,kind:'lifecycle',...common,milestone:'registration',date:{start:projectCreateDate,precision:'day'},verification:'verified',eventStatus:'actual',evidenceClass:'primary_authority_project_register_date',label:`ADREC directory lists ${row.Name} (ID ${id}) as registered on ${projectCreateDate}.`,note:`The native ProjectCreateDate epoch is normalized to the Asia/Dubai calendar date and cross-checked against ADREC ProjectDetail RegisteredOn fields for IDs 594, 595 and 597. Registration is not announcement, first marketing, first sale or physical construction start. The first verified availability of this capture is ${source.retrievedAt}.`});
    registrationFacts++;
  }else missingRegistrationDates++;
  if(progress!==null){
    facts.push({id:`v17-adrec-progress-${id}`,status:'accepted',recordId,kind:'lifecycle',...common,milestone:'construction_progress',date:{start:asOf,precision:'day'},verification:'verified',eventStatus:'reported',evidenceClass:'primary_authority_point_in_time_completion_percentage',label:`ADREC directory snapshot captured ${asOf} reports ${progress}% completion for ${row.Name} (ID ${id}).`,note:'This is a point-in-time ProgressPercentage value from the official directory, not a dated inspection report. Zero remains zero. It does not establish a construction-start date, actual completion, handover or occupancy.'});
    progressFacts++;
  }else missingProgress++;
  recordResearch.push({recordId,status:'ADREC exact-ID register snapshot reviewed; complete price and rent history remains unestablished',sourceIds:[listingSourceId],collectionPasses:[{passId:'pass40-adrec-register-listing',reviewedAt:source.retrievedAt,identityMethod:'exact ADREC numeric ID and project number',financialHistory:'not supplied by this project-listing endpoint',unmatchedRecordCreated:false}]});
}

const packet={
  schemaVersion:1,asOf:asOf,sources:[],facts,seriesLinks:[],recordResearch,historyInputs:[],licensedArchives:[],additionalDatasets:[],sourceCandidates:[],
  methodology:'Current-vintage primary ADREC project-register facts for exact existing ADREC IDs. Registration dates retain the authority calendar date; progress percentages and sold counts are register snapshots. No transaction-level price or rent observations, actual-completion milestone, handover, occupancy or community links are inferred. The 1,860-record catalogue is fixed; rows without an exact record remain unlinked.',
  collection:{
    pass:'pass40-adrec-register-listing',publisher:source.publisher,sourceId:listingSourceId,url:source.url,retrievedAt:source.retrievedAt,captureSha256:captureSha,
    listingRows:rows.length,exactCatalogueIdMatches:rows.length-unmatched.length,acceptedRecordSnapshots:recordResearch.length,
    registrationMilestones:registrationFacts,constructionProgressSnapshots:progressFacts,
    missingRegistrationDateRows:missingRegistrationDates,missingProgressRows:missingProgress,
    excludedAlreadyAllocatedIds:excluded,unmatchedRowsExcludedFromFixedCatalogue:unmatched,
    registrationDateCrossChecks:dateChecks,
    officialFieldLabels:{projectRegistration:'Registered on',completion:'Completion percentage',constructionStatus:'Construction status'},
    interpretationSources:['https://adrec.gov.ae/en/sectors/regulatory-services/project-development','https://adrec.gov.ae/Directory/ProjectsDetails?projectId=611'],
    rawResponseRedistributed:false,pricesOrRentsAdded:0,projectOrCommunityRecordsAdded:0
  }
};
await fs.mkdir(path.dirname(outputPath),{recursive:true});
await fs.writeFile(outputPath,JSON.stringify(packet,null,2)+'\n');
console.log(JSON.stringify({output:outputPath,matched:recordResearch.length,registerFacts:recordResearch.length,registrationMilestones:registrationFacts,constructionProgressSnapshots:progressFacts,missingRegistrationDateRows:missingRegistrationDates,missingProgressRows:missingProgress,excludedAlreadyAllocatedIds:excluded.map(x=>x.directoryId),unmatchedRows:unmatched.length,facts:facts.length}));
