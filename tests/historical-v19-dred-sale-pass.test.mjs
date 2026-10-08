import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {annualScenarios,recordHistory} from '../src/historical-intelligence/core.mjs';

const pass=JSON.parse(fs.readFileSync('enrichment/v19/pass42-dred-registered-sales.json','utf8'));
const snapshot=JSON.parse(fs.readFileSync('data/historical-intelligence-20261003.json','utf8'));
const records=new Map(snapshot.records.map(record=>[record.id,record]));
const sources=new Map(snapshot.sources.map(source=>[source.id,source]));
const facts=pass.facts;
const projectFacts=facts.filter(fact=>fact.recordId.startsWith('project:'));
const communityFacts=facts.filter(fact=>fact.recordId.startsWith('community:'));
const source=sources.get('v19-dred-sales-20261005');

test('V19 appends a pinned, CC BY source snapshot without changing the fixed catalogue',()=>{
 assert.ok(['20261007-enrichment-v19','20261008-enrichment-v20','20261008-enrichment-v21','20261008-enrichment-v22','20261008-enrichment-v24','20261008-enrichment-v25','20261008-enrichment-v26','20261008-enrichment-v27','20261008-enrichment-v28','20261008-enrichment-v29','20261008-enrichment-v30','20261008-enrichment-v23'].includes(snapshot.version));
 assert.equal(snapshot.records.length,1860);
 assert.equal(snapshot.records.filter(record=>record.type==='project').length,1645);
 assert.equal(snapshot.records.filter(record=>record.type==='community').length,215);
 assert.equal(new Set(snapshot.records.map(record=>record.id)).size,1860);
 assert.equal(source.datasetVersion,'a2c9d1c447e4db0416c2badcda8c1b4011f6e677');
 assert.equal(source.sourceSnapshotDate,'2026-10-05');
 assert.equal(source.sha256,pass.collection.sourceFileSHA256);
 assert.equal(source.bytes,22658248);
 assert.equal(source.licence,'CC BY 4.0');
 assert.match(source.attribution,/Dubai Real Estate Data.*Dubai Land Department open data/);
 assert.equal(source.primaryEvidence,false);
 assert.equal(source.rawDatasetRedistributed,false);
 assert.equal(pass.collection.sourceRows,1372277);
 assert.equal(pass.collection.sourceUniqueTransactionIds,1372277);
 assert.equal(pass.collection.projectIdentityKeyCollisions,0);
 assert.equal(pass.collection.exactProjectIdentityKeysReviewed,238);
 assert.equal(pass.collection.exactProjectRecordsWithResidentialUnitOrVillaSales,158);
 assert.equal(pass.collection.exactResidentialUnitOrVillaSaleRowsInSource,74708);
});

test('Only procedure 102 quality-zero flat sales are linked to exact project and area identities',()=>{
 assert.equal(projectFacts.length,8);
 assert.equal(communityFacts.length,5);
 assert.equal(new Set(facts.map(fact=>fact.id)).size,13);
 assert.equal(new Set(facts.map(fact=>fact.observation.transactionId)).size,11);
 assert.equal(pass.collection.overlapBetweenProjectAndCommunityFacts,2);
 assert.equal(pass.collection.unresolvedProcedureRowsExcluded,6);
 assert.equal(new Set(pass.collection.excludedTransactionIds).size,6);
 assert.equal(pass.collection.sampleMediansOrForecastsAdded,0);
 assert.equal(pass.collection.projectOrCommunityRecordsAdded,0);
 assert.equal(new Set(projectFacts.map(fact=>fact.recordId)).size,6);
 assert.deepEqual(new Set(communityFacts.map(fact=>fact.recordId)),new Set(['community:Dubai:business-bay']));
 for(const fact of facts){
  const observation=fact.observation;
  assert.equal(fact.status,'accepted');
  assert.equal(fact.kind,'financial');
  assert.equal(fact.scope,'subject');
  assert.equal(fact.identityVerified,true);
  assert.equal(fact.primaryEvidence,false);
  assert.deepEqual(fact.sourceIds,[source.id]);
  assert.equal(fact.firstAvailableAt,source.firstAvailableAt);
  assert.equal(fact.publishedAt,source.publishedAt);
  assert.match(observation.period,/^2026-10-0[35]$/);
  assert.equal(observation.observationDateBasis,'DLD instance_date: registration date; it is not asserted to be the contract execution or transfer date.');
  assert.equal(observation.observationKind,'transaction');
  assert.equal(observation.transactionKind,'sale');
  assert.equal(observation.procedureId,102);
  assert.equal(observation.procedureName,'Sell - Pre registration');
  assert.equal(observation.registration,'Off-Plan');
  assert.equal(observation.qualityFlags,0);
  assert.equal(observation.propertyType,'Unit');
  assert.equal(observation.propertySubtype,'Flat');
  assert.equal(observation.usage,'Residential');
  assert.equal(observation.metric,'price');
  assert.equal(observation.unit,'AED/sqft');
  assert.ok(observation.priceAED>0&&observation.areaSqm>0&&observation.value>0);
  assert.ok(fact.identityBasis.includes(fact.recordId));
  for(const proofId of fact.identitySourceIds)assert.ok(sources.has(proofId),proofId);
  assert.ok(records.has(fact.recordId));
 }
 for(const fact of projectFacts){
  assert.ok(fact.identitySourceIds.includes('dld-official-projects-20260706'));
  assert.ok(fact.identitySourceIds.includes('dld-official-areas-20261002'));
  assert.ok(fact.identitySourceIds.includes('dld-official-buildings-20261003'));
  assert.equal(records.get(fact.recordId).name.toLowerCase().includes(fact.observation.sourceProjectName.toLowerCase()),true,
   `project label should match catalogue record for ${fact.id}`);
 }
 for(const fact of communityFacts){
  assert.deepEqual(fact.identitySourceIds,['dld-official-areas-20261002']);
  assert.equal(fact.observation.sourceAreaId,526);
  assert.equal(fact.observation.sourceAreaName,'Business Bay');
 }
});

test('Verified Business Bay transactions count as dated sale evidence, not complete lifetime history',()=>{
 const community=records.get('community:Dubai:business-bay');
 const coverage=community.researchStatus.itemCoverage.registered_sale_history;
 assert.equal(coverage.status,'present');
 assert.equal(coverage.transactionObservationCount,57511);
 assert.equal(coverage.distinctTransactionDateCount,3373);
 assert.equal(coverage.completeLifetimeHistory,false);
 assert.equal(community.coverageSummary.directSaleTransactionCount,57511);
 assert.equal(community.coverageSummary.directSalePeriods,3553);
 assert.ok(community.researchStatus.gaps.includes('complete_registered_sale_history'));
 assert.equal(community.scenarioCoverage.lastYear,2080);
 assert.equal(community.scenarioCoverage.approvedAnnualPoints,0);
 const history=recordHistory(snapshot,community);
 const newRows=history.validatedObservations.filter(row=>row.sourceId===source.id&&row.transactionId);
 assert.equal(newRows.length,5);
 assert.ok(newRows.every(row=>row.valid&&row.direct&&row.availability==='known_as_of'));
 const scenarios=annualScenarios(community,{asOf:snapshot.asOf,sources:snapshot.sources});
 assert.deepEqual(scenarios.targetYears,[...Array(54)].map((_,i)=>2027+i));
 assert.equal(scenarios.validatedForecast,false);
 assert.ok(Object.values(scenarios.metrics.price.paths).every(path=>path.every(point=>point.value===null)));
 const warsan=records.get('community:Dubai:al-warsan-first');
 assert.equal(warsan.researchStatus.itemCoverage.registered_sale_history.status,'present');
 assert.equal(warsan.researchStatus.itemCoverage.registered_sale_history.transactionObservationCount,40492);
 assert.equal(warsan.researchStatus.itemCoverage.registered_sale_history.completeLifetimeHistory,false);
});
