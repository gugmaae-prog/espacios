import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {mapAbuDhabiReportedMarket} from '../src/stack-audit/abu-dhabi-reported-market.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url);
const bytes=await fs.readFile(new URL('data/uae-evidence/abu-dhabi/adrec-reported-market-20261111.json',root));
const data=JSON.parse(bytes);
const report=JSON.parse(await fs.readFile(new URL('data/uae-evidence/abu-dhabi/adrec-reported-market-validation.json',root)));
const request=(suffix='',method='GET')=>new Request('https://espacios.me/map/api/uae-evidence/abu-dhabi/reported-market'+suffix,{method});

test('ADREC selected facts are pinned and keep native periods separate',()=>{
 assert.equal(bytes.length,report.dataBytes);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),report.dataSha256);
 assert.deepEqual(data.marketObservations.map(row=>row.periodId),['2025','2026Q1','2026H1','2025YTD9','2026YTD9']);
 assert.equal(data.marketObservations[2].totalTransactionCount,null);
 const latest=data.marketObservations.at(-1),prior=data.marketObservations.at(-2);
 assert.equal(latest.periodEnd,'2026-09-30');
 assert.equal(prior.periodEnd,'2025-09-30');
 assert.equal(latest.totalTransactionCount,latest.salesTransactions+latest.mortgageTransactions+latest.giftTransactions+latest.musatahaAndLongLeaseTransactions);
 assert.equal(latest.totalTransactionValueAedApprox,latest.salesValueAedApprox+latest.mortgageValueAedApprox+latest.giftValueAedApprox+latest.musatahaAndLongLeaseValueAedApprox);
 assert.equal(data.districtTransactionValues.length,5);
 assert.equal(data.districtTransactionValues[0].allUseTransactionValueAedApprox,29860000000);
 assert.ok(data.districtTransactionValues.every(row=>row.periodId==='2026YTD9'));
 assert.ok(data.districtTransactionValues.reduce((sum,row)=>sum+row.allUseTransactionValueAedApprox,0)<latest.totalTransactionValueAedApprox);
 assert.equal(data.segmentObservations.find(row=>row.segment==='retail').occupancyPct,null);
 assert.equal(data.publishedProjections[0].validatedForecast,false);
 assert.equal(report.unpublishedCandidateStillRestricted,true);
});

test('API filters market, stock and published projection without mixing classes',async()=>{
 const all=await mapAbuDhabiReportedMarket(request(),report,data).json();
 assert.deepEqual([all.marketObservations.length,all.districtTransactionValues.length,all.segmentObservations.length,all.publishedProjections.length],[5,5,3,1]);
 assert.equal(all.scope.transactionLevel,false);
 assert.equal(all.scope.availableUnits,false);
 assert.equal(all.scope.districtValuesAreAllUseTransactions,true);
 assert.equal(all.scope.projectionIsObserved,false);
 const nineMonths=await mapAbuDhabiReportedMarket(request('?period=2026YTD9'),report,data).json();
 assert.equal(nineMonths.marketObservations[0].totalTransactionCount,38483);
 assert.equal(nineMonths.districtTransactionValues.length,5);
 assert.equal(nineMonths.segmentObservations.length,0);
 const retail=await mapAbuDhabiReportedMarket(request('?period=2026H1&segment=retail'),report,data).json();
 assert.equal(retail.marketObservations.length,0);
 assert.equal(retail.districtTransactionValues.length,0);
 assert.equal(retail.segmentObservations[0].supplyGrossLeasableAreaSqmApprox,3850000);
 assert.equal(retail.publishedProjections.length,0);
 assert.equal(mapAbuDhabiReportedMarket(request('?period=2026Q1&segment=office'),report,data).status,400);
 assert.equal(mapAbuDhabiReportedMarket(request('?period=2026Q2'),report,data).status,400);
 assert.equal(mapAbuDhabiReportedMarket(request('?period=2026YTD9&segment=office'),report,data).status,400);
 assert.equal(mapAbuDhabiReportedMarket(request('','POST'),report,data).status,405);
 assert.equal(mapAbuDhabiReportedMarket(request('','HEAD'),report,data).body,null);
});

test('compiled Worker serves ADREC aggregates and leaves Data Room restricted',async()=>{
 const env={DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'adrec-reported-test'}};
 const response=await worker.fetch(request('?period=2026H1&segment=office'),env,{});
 const body=await response.json();
 assert.equal(response.status,200);
 assert.equal(response.headers.get('x-espacios-evidence-source'),report.sourceId);
 assert.equal(body.segmentObservations[0].occupancyPct,95);
 assert.equal(body.marketObservations.length,0);
 const current=await worker.fetch(request('?period=2026YTD9'),env,{});
 const currentBody=await current.json();
 assert.equal(current.status,200);
 assert.equal(currentBody.marketObservations[0].salesTransactions,23749);
 assert.equal(currentBody.districtTransactionValues.length,5);
 const restricted=await worker.fetch(new Request('https://espacios.me/map/data-room'),env,{});
 assert.equal(restricted.status,404);
});
