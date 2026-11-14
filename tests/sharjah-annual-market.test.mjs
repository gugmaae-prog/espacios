import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {mapSharjahAnnualMarket} from '../src/stack-audit/sharjah-annual-market.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url);
const bytes=await fs.readFile(new URL('data/uae-evidence/sharjah/annual-market-20261110.json',root));
const data=JSON.parse(bytes),report=JSON.parse(await fs.readFile(new URL('data/uae-evidence/sharjah/annual-market-validation.json',root)));
const request=(query='',method='GET')=>new Request(`https://espacios.me/map/api/uae-evidence/sharjah/annual-market${query}`,{method});

test('annual Sharjah values preserve full-year grain and missing counts',()=>{
 assert.equal(bytes.length,report.dataBytes);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),report.dataSha256);
 assert.deepEqual(data.observations.map(row=>row.year),[2018,2019,2020,2021,2022,2023,2024,2025]);
 assert.deepEqual(data.observations.map(row=>row.tradingValueAedApprox),[22500000000,24200000000,15900000000,26200000000,24000000000,27100000000,40000000000,65600000000]);
 assert.deepEqual(data.observations.slice(0,4).map(row=>row.allRegistrationTransactions),[54125,61357,64459,84238]);
 assert.deepEqual(data.observations.slice(0,4).map(row=>row.saleTransactions),[3254,3328,3773,6304]);
 assert.deepEqual(data.observations.slice(0,3).map(row=>row.saleTransactionsByUseSharePct.commercial),[18.4,15.9,11.1]);
 assert.ok(data.observations.slice(0,4).every(row=>row.saleTransactionsByUse===null));
 assert.equal(data.observations[3].registeredNewProjects,7);
 assert.equal(data.observations[4].allRegistrationTransactions,91507);
 assert.equal(data.observations[4].saleTransactions,7267);
 assert.equal(Object.values(data.observations[4].saleTransactionsByUse).reduce((a,b)=>a+b,0),7267);
 assert.equal(data.observations[4].saleTransactionsByUse.commercial,807);
 assert.equal(data.observations[5].allRegistrationTransactions,null);
 assert.equal(data.observations[5].saleTransactions,8731);
 assert.equal(data.observations[5].registeredNewProjects,5);
 assert.equal(data.observations[6].allRegistrationTransactions,null);
 assert.equal(data.observations[6].saleTransactions,null);
 assert.equal(data.observations[6].registeredNewProjects,14);
 assert.equal(data.observations[7].allRegistrationTransactions,132659);
 assert.equal(data.observations[7].saleTransactions,33580);
 assert.equal(data.observations[7].registeredNewProjects,null);
 assert.deepEqual(report.archivePdfCaptures.map(row=>row.year),[2018,2019,2020]);
 assert.match(report.archiveCatalogAnomaly,/2022 annual report/);
 assert.ok(report.capturePages.every(page=>page.passes.length===2&&page.passes.every(pass=>pass.sha256.length===64)));
});

test('read-only annual API keeps counts apart from commercial inventory',async()=>{
 const response=mapSharjahAnnualMarket(request(),report,data),body=await response.json();
 assert.equal(response.status,200);
 assert.equal(body.scope.period,'full calendar year');
 assert.equal(body.scope.transactionLevel,false);
 assert.equal(body.scope.commercialOnly,false);
 assert.equal(body.scope.projectRegister,false);
 assert.equal(body.observations.length,8);
 assert.equal((await mapSharjahAnnualMarket(request('?year=2018'),report,data).json()).observations[0].saleTransactionsByUseSharePct.commercial,18.4);
 assert.equal((await mapSharjahAnnualMarket(request('?year=2022'),report,data).json()).observations[0].saleTransactionsByUse.commercial,807);
 assert.equal((await mapSharjahAnnualMarket(request('?year=2025'),report,data).json()).observations[0].saleTransactions,33580);
 assert.equal(mapSharjahAnnualMarket(request('?year=2026'),report,data).status,400);
 assert.equal(mapSharjahAnnualMarket(request('','POST'),report,data).status,405);
 assert.equal(mapSharjahAnnualMarket(request('','HEAD'),report,data).body,null);
});

test('compiled Worker serves annual Sharjah evidence',async()=>{
 const response=await worker.fetch(request(),{DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'sharjah-annual-test'}},{}),body=await response.json();
 assert.equal(response.status,200);
 assert.equal(response.headers.get('x-espacios-evidence-source'),report.sourceId);
 assert.equal(body.observations[7].tradingValueAedApprox,65600000000);
});
