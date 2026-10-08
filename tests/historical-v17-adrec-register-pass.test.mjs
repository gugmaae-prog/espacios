import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {annualScenarios} from '../src/historical-intelligence/core.mjs';

const packet=JSON.parse(fs.readFileSync('enrichment/v17/pass40-adrec-register-listing.json','utf8'));
const snapshot=JSON.parse(fs.readFileSync('data/historical-intelligence-20261003.json','utf8'));
const prior=JSON.parse(fs.readFileSync('enrichment/v16/pass39-adrec-nawayef-primary.json','utf8'));
const records=new Map(snapshot.records.map(record=>[record.id,record]));
const sources=new Map(snapshot.sources.map(source=>[source.id,source]));
const registerFacts=packet.facts.filter(fact=>fact.kind==='register');
const registrationFacts=packet.facts.filter(fact=>fact.kind==='lifecycle'&&fact.milestone==='registration');
const progressFacts=packet.facts.filter(fact=>fact.kind==='lifecycle'&&fact.milestone==='construction_progress');

test('V17 is a reviewed, checksum-rooted ADREC register increment over the fixed catalogue',()=>{
 assert.ok(['20261007-enrichment-v17','20261007-enrichment-v18','20261007-enrichment-v19','20261008-enrichment-v20','20261008-enrichment-v21','20261008-enrichment-v22','20261008-enrichment-v24','20261008-enrichment-v25','20261008-enrichment-v26','20261008-enrichment-v27','20261008-enrichment-v28','20261008-enrichment-v29','20261008-enrichment-v30','20261008-enrichment-v23'].includes(snapshot.version));
 assert.equal(snapshot.records.length,1860);
 assert.equal(snapshot.records.filter(record=>record.type==='project').length,1645);
 assert.equal(snapshot.records.filter(record=>record.type==='community').length,215);
 assert.equal(packet.sources.length,0);
 assert.ok(sources.has('v16-src-adrec-project-listing'));
 assert.equal(packet.collection.captureSha256,prior.sources.find(source=>source.id==='v16-src-adrec-project-listing').sha256);
 assert.deepEqual({rows:packet.collection.listingRows,exact:packet.collection.exactCatalogueIdMatches,accepted:packet.collection.acceptedRecordSnapshots,unmatched:packet.collection.unmatchedRowsExcludedFromFixedCatalogue.length},{rows:320,exact:308,accepted:305,unmatched:12});
 assert.deepEqual(packet.collection.excludedAlreadyAllocatedIds.map(row=>row.directoryId).sort((a,b)=>a-b),[594,595,597]);
 assert.equal(packet.collection.rawResponseRedistributed,false);
 assert.equal(packet.collection.projectOrCommunityRecordsAdded,0);
});

test('Every accepted register row is attached to one exact ADREC-ID catalogue project',()=>{
 assert.equal(registerFacts.length,305);
 assert.equal(new Set(registerFacts.map(fact=>fact.id)).size,305);
 assert.equal(registrationFacts.length,305);
 assert.equal(progressFacts.length,302);
 for(const fact of registerFacts){
  const id=fact.fields.directoryId,expected=`adrec:${id}`;
  assert.equal(fact.recordId,expected);
  assert.equal(fact.registeredProjectId,`ADREC:${id}`);
  assert.equal(fact.identityVerified,true);
  assert.equal(fact.scope,'subject');
  assert.match(fact.identityBasis,new RegExp(`ID ${id} resolves exactly to existing catalogue record ${expected}`));
  assert.ok(fact.sourceIds.includes('v16-src-adrec-project-listing'));
  const owners=[...records.values()].filter(record=>(record.registerEvidence||[]).some(row=>row.id===fact.id));
  assert.equal(owners.length,1,fact.id);
  assert.equal(owners[0].id,expected);
 }
 for(const id of [594,595,597]){
  assert.ok(!registerFacts.some(fact=>fact.recordId===`adrec:${id}`));
  assert.ok(!registrationFacts.some(fact=>fact.recordId===`adrec:${id}`));
  assert.ok(!progressFacts.some(fact=>fact.recordId===`adrec:${id}`));
 }
});

test('Registration dates and progress stay dated, source-visible, and separate from launch or completion',()=>{
 assert.equal(packet.collection.registrationDateCrossChecks.length,3);
 assert.ok(packet.collection.registrationDateCrossChecks.every(check=>check.match));
 assert.equal(packet.collection.missingRegistrationDateRows,0);
 assert.equal(packet.collection.missingProgressRows,3);
 for(const fact of registrationFacts){
  assert.equal(fact.date.precision,'day');
  assert.equal(fact.verification,'verified');
  assert.equal(fact.eventStatus,'actual');
  assert.match(fact.note,/not announcement, first marketing, first sale or physical construction start/i);
  const record=records.get(fact.recordId);
  assert.equal(record.researchStatus.itemCoverage.announcement_registration.status,'present');
  assert.ok(record.researchStatus.itemCoverage.announcement_registration.evidenceIds.includes(fact.id));
 }
 for(const fact of progressFacts){
  const record=records.get(fact.recordId),register=registerFacts.find(row=>row.recordId===fact.recordId);
  assert.equal(fact.date.start,'2026-10-07');
  assert.equal(fact.eventStatus,'reported');
  assert.match(fact.label,new RegExp(`${register.fields.progressPercentage}%`));
  assert.match(fact.note,/not a dated inspection report/i);
  assert.notEqual(record.researchStatus.itemCoverage.construction.status,'missing');
  assert.ok(record.researchStatus.itemCoverage.construction.evidenceIds.includes(fact.id));
 }
 for(const fact of registerFacts){
  const fields=fact.fields;
  assert.ok(fields.projectNumber);
  assert.equal(typeof fields.developerName,'string');
  assert.equal(typeof fields.municipalityLabel,'string');
  assert.match(fields.projectCreateDateDubai,/^\d{4}-\d{2}-\d{2}$/);
  assert.match(fields.createDateDubai,/^\d{4}-\d{2}-\d{2}$/);
  assert.equal(fields.dateFieldsAgree,fields.projectCreateDateDubai===fields.createDateDubai);
  assert.ok(fields.soldCount===null||Number.isSafeInteger(fields.soldCount));
  assert.ok(fields.totalCount===null||Number.isSafeInteger(fields.totalCount));
 }
});

test('Register coverage does not invent sale prices, rents, transaction rows, or 2080 outcomes',()=>{
 assert.equal(packet.facts.filter(fact=>fact.kind==='financial').length,0);
 assert.equal(packet.seriesLinks.length,0);
 assert.equal(packet.historyInputs.length,0);
 assert.equal(snapshot.manifest.recordCount,1860);
 assert.equal(snapshot.manifest.projectCount,1645);
 assert.equal(snapshot.manifest.communityCount,215);
 assert.equal(snapshot.manifest.approved2080ForecastRecords,0);
 const record=records.get('adrec:742');
 assert.ok(record);
 assert.notEqual(record.researchStatus.itemCoverage.registered_sale_history.status,'present');
 assert.equal(record.researchStatus.itemCoverage.signed_rent_history.status,'missing');
 assert.equal(record.researchStatus.itemCoverage.actual_completion.status,'missing');
 assert.equal(record.researchStatus.itemCoverage.occupancy.status,'missing');
 assert.equal(record.researchStatus.itemCoverage.dated_valuation.status,'missing');
 const scenario=annualScenarios(record,{asOf:snapshot.asOf,sources:snapshot.sources});
 assert.deepEqual(scenario.targetYears,[...Array(54)].map((_,index)=>2027+index));
 assert.equal(scenario.validatedForecast,false);
 assert.ok(Object.values(scenario.metrics.price.paths).every(path=>path.every(point=>point.value===null)));
});

test('The V19 snapshot preserves V16 Nawayef registered-sale cohorts and source rows',()=>{
 const park=records.get('project:nawayef-park-views-modon-properties-hudayriyat-island-abu-dhabi');
 const east=records.get('project:nawayef-east-modon-hudayriyat-island-abu-dhabi');
 assert.equal(park.historySeries.find(series=>series.id==='adrec-v16-594-primary-registered-sale-aed').pointCount,177);
 assert.equal(east.historySeries.find(series=>series.id==='adrec-v16-595-primary-registered-sale-aed').pointCount,17);
 assert.equal(east.historySeries.find(series=>series.id==='adrec-v16-597-primary-registered-sale-aed').pointCount,473);
 assert.ok(snapshot.manifest.historicalObservationRows>=318562);
});

test('The V19 ledger preserves V17 lifecycle coverage and incorporates later verified sale evidence',()=>{
 const counts={};
 for(const record of snapshot.records)for(const item of Object.values(record.researchStatus.itemCoverage))counts[item.status]=(counts[item.status]||0)+1;
 assert.deepEqual(counts,['20261008-enrichment-v29','20261008-enrichment-v30'].includes(snapshot.version)
  ?{missing:26833,partial:3438,unestablished:9300,present:3209}
  :snapshot.version==='20261008-enrichment-v28'
  ?{missing:26844,partial:3437,unestablished:9300,present:3199}
  :['20261008-enrichment-v26','20261008-enrichment-v27'].includes(snapshot.version)
  ?{missing:26880,partial:3437,unestablished:9300,present:3163}
  :['20261008-enrichment-v24','20261008-enrichment-v25'].includes(snapshot.version)
  ?{missing:26895,partial:3437,unestablished:9300,present:3148}
  :snapshot.version==='20261008-enrichment-v23'
  ?{missing:26896,partial:3436,unestablished:9300,present:3148}
  :snapshot.version==='20261008-enrichment-v22'
  ?{missing:26941,partial:3433,unestablished:9300,present:3106}
  :snapshot.version==='20261008-enrichment-v21'
  ?{missing:26948,partial:3433,unestablished:9300,present:3099}
  :{missing:26950,partial:3434,unestablished:9300,present:3096});
 assert.equal(Object.values(snapshot.records).reduce((sum,record)=>sum+record.observations.filter(item=>item.id.startsWith('v17-adrec-')).length,0),0);
 assert.equal(snapshot.manifest.approved2080ForecastRecords,0);
});
