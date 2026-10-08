import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {annualScenarios} from '../src/historical-intelligence/core.mjs';

const pass=JSON.parse(fs.readFileSync('enrichment/v18/pass41-adrec-project-details.json','utf8'));
const snapshot=JSON.parse(fs.readFileSync('data/historical-intelligence-20261003.json','utf8'));
const listing=JSON.parse(fs.readFileSync('enrichment/v17/pass40-adrec-register-listing.json','utf8'));
const records=new Map(snapshot.records.map(record=>[record.id,record]));
const sources=new Map(snapshot.sources.map(source=>[source.id,source]));
const rows=new Map(pass.collection.recordResults.map(row=>[row.directoryId,row]));
const registerFacts=pass.facts.filter(fact=>fact.kind==='register');
const progressFacts=pass.facts.filter(fact=>fact.kind==='lifecycle');

test('Offline packet rebuild is deterministic and does not repeat public requests',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'espacios-v18-adrec-'));
 try{
  const output=path.join(directory,'packet.json');
  fs.copyFileSync('enrichment/v18/pass41-adrec-project-details.json',output);
  const result=spawnSync(process.execPath,['scripts/capture-adrec-project-detail-pass.mjs','--output',output,'--build-only'],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(output,'utf8')),pass);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

test('V18 detail capture is bounded to V17 exact IDs and preserves the fixed 1,860-record universe',()=>{
 assert.ok(['20261007-enrichment-v18','20261007-enrichment-v19','20261008-enrichment-v20','20261008-enrichment-v21','20261008-enrichment-v22','20261008-enrichment-v24','20261008-enrichment-v23'].includes(snapshot.version));
 assert.equal(snapshot.records.length,1860);
 assert.equal(snapshot.records.filter(record=>record.type==='project').length,1645);
 assert.equal(snapshot.records.filter(record=>record.type==='community').length,215);
 assert.equal(pass.collection.requestedRecordCount,305);
 assert.equal(pass.collection.completedRecordCount,305);
 assert.equal(pass.collection.acceptedExactIdAndProjectNumberMatches,291);
 assert.equal(pass.collection.failedOrDisputedRows,15);
 assert.equal(pass.collection.registrationDateComparisons.mismatch,0);
 assert.equal(pass.collection.rawBodiesRetained,false);
 assert.equal(pass.collection.rawBodiesRedistributed,false);
 assert.equal(pass.collection.imagesDownloaded,0);
 assert.equal(pass.collection.projectOrCommunityRecordsAdded,0);
 assert.equal(pass.collection.pricesOrRentsAdded,0);
 assert.equal(new Set(rows.keys()).size,305);
 assert.deepEqual(pass.facts.filter(fact=>fact.status==='accepted'&&fact.kind==='register').map(fact=>fact.fields.directoryId).sort((a,b)=>a-b),
  rows.size===305?[...rows.values()].filter(row=>row.status==='accepted').map(row=>row.directoryId).sort((a,b)=>a-b):[]);
 for(const prior of listing.facts.filter(fact=>fact.status==='accepted'&&fact.kind==='register'))
  assert.ok(records.get(prior.recordId)?.registerEvidence?.some(fact=>fact.id===prior.id),prior.id);
});

test('Only exact ADREC project ID and number matches create facts; source rows contain no unrelated fields',()=>{
 assert.equal(registerFacts.length,291);
 assert.equal(new Set(registerFacts.map(fact=>fact.id)).size,291);
 assert.equal(progressFacts.length,145);
 for(const fact of registerFacts){
  const id=fact.fields.directoryId,row=rows.get(id),record=records.get(fact.recordId);
  assert.equal(fact.recordId,`adrec:${id}`);
  assert.equal(row.status,'accepted');
  assert.equal(row.projectNumberMatch,true);
  assert.equal(fact.identityVerified,true);
  assert.equal(fact.scope,'subject');
  assert.deepEqual(fact.identitySourceIds,fact.sourceIds);
  assert.ok(fact.identityBasis.includes(`record ${fact.recordId}`));
  assert.ok(record.registerEvidence.some(item=>item.id===fact.id));
  const source=sources.get(fact.sourceIds[0]);
  assert.ok(source);
  assert.equal(new URL(source.url).hostname,'adrec.gov.ae');
  assert.equal(new URL(source.url).pathname,'/en/Directory/ProjectsDetails');
  assert.equal(new URL(source.url).searchParams.get('projectId'),String(id));
  assert.match(source.sha256,/^[a-f0-9]{64}$/);
  assert.match(fact.fields.responseSha256,/^[a-f0-9]{64}$/);
  assert.equal(source.rawBodyRetained,false);
  assert.equal(source.rawBodyRedistributed,false);
  for(const key of ['developerName','personalContact','email','phone','escrow','iban','imageUrl','reportId'])assert.equal(key in fact.fields,false);
 }
});

test('Inspection dates and construction progress retain their report dates and cannot imply completion',()=>{
 assert.equal(progressFacts.length,145);
 for(const fact of progressFacts){
  const row=rows.get(Number(fact.recordId.slice('adrec:'.length)));
  assert.ok(row);
  assert.equal(fact.milestone,'construction_progress');
  assert.equal(fact.date.precision,'day');
  assert.equal(fact.date.start,row.latestReportInspectionDate);
  assert.ok(fact.label.includes(`${row.latestReportCompletionPercentage}%`));
  assert.equal(fact.eventStatus,'reported');
  assert.equal(fact.verification,'verified');
  assert.match(fact.note,/first retrieved on .*not available to earlier-vintage forecasts/i);
  assert.doesNotMatch(fact.label,/completion certificate|handover|occupancy|sale|rent/i);
  assert.ok(fact.date.start<=snapshot.asOf);
 }
 const future=pass.collection.issues.filter(issue=>issue.status==='future_report_date_disputed');
 assert.equal(future.length,1);
 assert.equal(future[0].directoryId,505);
 assert.ok(future[0].reportedDate>snapshot.asOf);
 assert.equal(rows.get(505).status,'accepted');
 assert.equal(pass.facts.some(fact=>fact.recordId==='adrec:505'&&fact.kind==='lifecycle'),false);
 assert.equal(pass.facts.find(fact=>fact.recordId==='adrec:505'&&fact.kind==='register').fields.latestReportStatus,'future_dated_disputed');
});

test('Unavailable detail pages remain research gaps; the pass adds no financial history or 2080 outcomes',()=>{
 const missing=pass.collection.issues.filter(issue=>issue.status==='detail_missing');
 assert.equal(missing.length,14);
 assert.equal(pass.recordResearch.length,305);
 for(const status of pass.recordResearch){
  const record=records.get(status.recordId);
  assert.ok(record);
  assert.equal(status.collectionPass,'pass41-adrec-project-details');
  assert.ok(['detail_verified','detail_verified_report_date_disputed','detail_missing'].includes(status.collectionStatus));
  if(status.collectionStatus==='detail_missing')assert.equal(status.sourceIds.length,0);
  assert.equal(record.researchStatus.sourceCollection.collectionPass,'pass41-adrec-project-details');
  assert.ok(record.researchStatus.sourceCollection.collectionPasses.some(item=>item.passId==='pass40-adrec-register-listing'));
  assert.ok(record.researchStatus.sourceCollection.collectionPasses.some(item=>item.collectionPass==='pass41-adrec-project-details'));
 }
 assert.equal(pass.facts.some(fact=>fact.kind==='financial'),false);
 assert.equal(pass.seriesLinks.length,0);
 assert.equal(pass.historyInputs.length,0);
 assert.ok(snapshot.manifest.historicalObservationRows>=318562);
 assert.equal(snapshot.manifest.approved2080ForecastRecords,0);
 const record=records.get('adrec:742');
 assert.equal(record.researchStatus.itemCoverage.registered_sale_history.status,'missing');
 assert.equal(record.researchStatus.itemCoverage.signed_rent_history.status,'missing');
 assert.equal(record.researchStatus.itemCoverage.actual_completion.status,'missing');
 assert.equal(record.researchStatus.itemCoverage.occupancy.status,'missing');
 assert.equal(record.researchStatus.itemCoverage.dated_valuation.status,'missing');
 const scenarios=annualScenarios(record,{asOf:snapshot.asOf,sources:snapshot.sources});
 assert.deepEqual(scenarios.targetYears,[...Array(54)].map((_,index)=>2027+index));
 assert.equal(scenarios.validatedForecast,false);
 assert.ok(Object.values(scenarios.metrics.price.paths).every(path=>path.every(point=>point.value===null)));
});
