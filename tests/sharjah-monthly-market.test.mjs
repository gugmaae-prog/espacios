import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {mapSharjahMonthlyMarket} from '../src/stack-audit/sharjah-monthly-market.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url);
const bytes=await fs.readFile(new URL('data/uae-evidence/sharjah/monthly-market-20261114-supplement.json',root));
const data=JSON.parse(bytes),report=JSON.parse(await fs.readFile(new URL('data/uae-evidence/sharjah/monthly-market-20261114-supplement-validation.json',root)));
const request=(query='',method='GET')=>new Request(`https://espacios.me/map/api/uae-evidence/sharjah/monthly-market${query}`,{method});

test('Sharjah monthly evidence is hash pinned and partial',()=>{
 assert.equal(bytes.length,report.dataBytes);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),report.dataSha256);
 assert.deepEqual(data.observations.map(row=>row.month),['2026-01','2026-04','2026-05','2026-06','2026-07','2026-08','2026-09']);
 assert.deepEqual(data.missingMonths,['2026-02','2026-03']);
 assert.deepEqual(data.incompleteMonths,['2026-06','2026-09']);
 assert.deepEqual(data.observations.map(row=>row.salesTransactions),[4868,2675,1851,null,2884,2367,null]);
 assert.deepEqual(data.observations.map(row=>row.allProcedureTransactions),[10333,15669,7119,null,9376,9139,null]);
 assert.equal(data.observations[3].reportedTransactionValueAedApprox,4400000000);
 assert.equal(data.observations[3].reportingBasis,'retrospective_comparison_in_july_release');
 assert.equal(data.observations[4].officeUnitSales,17);
 assert.equal(data.observations[4].shopUnitSales,1);
 assert.ok(data.observations.filter(row=>row.month!=='2026-07').every(row=>row.officeUnitSales===null&&row.shopUnitSales===null));
 assert.equal(data.observations[6].reportedTransactionValueAedApprox,5700000000);
 assert.equal(data.observations[6].reportedAllProcedureTransactionsApprox,13700);
 assert.equal(data.combinedPeriodObservations.length,1);
 assert.deepEqual([data.combinedPeriodObservations[0].startMonth,data.combinedPeriodObservations[0].endMonth],['2026-02','2026-03']);
 assert.equal(data.combinedPeriodObservations[0].reportedTransactionValueAedApprox,9200000000);
 assert.equal(data.combinedPeriodObservations[0].reportedAllProcedureTransactionsApprox,18900);
 assert.equal(report.reconciliation.retainedOriginalObservations,6);
 assert.equal(report.sourceArticles[5].tableSha256.length,64);
});

test('read-only API labels missing months and keeps transaction classes separate',async()=>{
 const response=mapSharjahMonthlyMarket(request(),report,data),body=await response.json();
 assert.equal(response.status,200);
 assert.equal(body.scope.partial,true);
 assert.equal(body.scope.transactionLevel,false);
 assert.equal(body.scope.commercialOnly,false);
 assert.equal(body.scope.currentAvailability,false);
 assert.equal(body.observations.length,7);
 assert.deepEqual(body.scope.missingMonths,data.missingMonths);
 assert.deepEqual(body.scope.incompleteMonths,['2026-06','2026-09']);
 assert.equal(body.combinedPeriodObservations.length,1);
 assert.equal((await mapSharjahMonthlyMarket(request('?month=2026-07'),report,data).json()).observations[0].officeUnitSales,17);
 assert.deepEqual((await mapSharjahMonthlyMarket(request('?month=2026-06'),report,data).json()).observations.map(row=>[row.reportedTransactionValueAedApprox,row.salesTransactions]),[[4400000000,null]]);
 assert.deepEqual((await mapSharjahMonthlyMarket(request('?month=2026-09'),report,data).json()).observations.map(row=>[row.reportedTransactionValueAedApprox,row.allProcedureTransactions]),[[5700000000,null]]);
 assert.deepEqual((await mapSharjahMonthlyMarket(request('?month=2026-09'),report,data).json()).combinedPeriodObservations,[]);
 assert.equal(mapSharjahMonthlyMarket(request('?month=2026-03'),report,data).status,400);
 assert.equal(mapSharjahMonthlyMarket(request('','POST'),report,data).status,405);
 assert.equal(mapSharjahMonthlyMarket(request('','HEAD'),report,data).body,null);
});

test('compiled Worker serves Sharjah partial monthly source',async()=>{
 const response=await worker.fetch(request(),{DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'sharjah-monthly-test'}},{}),body=await response.json();
 assert.equal(response.status,200);
 assert.equal(response.headers.get('x-espacios-evidence-source'),report.sourceId);
 assert.equal(body.observations[4].shopUnitSales,1);
 assert.equal(body.combinedPeriodObservations[0].reportedTransactionValueAedApprox,9200000000);
});
