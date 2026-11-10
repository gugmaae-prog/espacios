import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {mapRakMonthlyMarket} from '../src/stack-audit/rak-monthly-market.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url);
const bytes=await fs.readFile(new URL('data/uae-evidence/ras-al-khaimah/monthly-market-20261110.json',root));
const data=JSON.parse(bytes);
const report=JSON.parse(await fs.readFile(new URL('data/uae-evidence/ras-al-khaimah/monthly-market-validation.json',root)));
const request=(query='',method='GET')=>new Request(`https://espacios.me/map/api/uae-evidence/ras-al-khaimah/monthly-market${query}`,{method});

test('monthly source preserves the reported precision and missing counts',()=>{
 assert.equal(createHash('sha256').update(bytes).digest('hex'),report.dataSha256);
 assert.equal(bytes.length,report.dataBytes);
 assert.equal(report.captureReports.length,4);
 assert.deepEqual(data.observations.map(row=>row.month),Array.from({length:9},(_,i)=>`2026-${String(i+1).padStart(2,'0')}`));
 assert.deepEqual(data.observations[0],{month:'2026-01',salesValueAed:249794299,mortgagesValueAed:136953350,waiverMarketValueAed:36171892,valuePrecision:'reported_exact_aed',salesTransactions:302,mortgageRegistrations:104,waiverTransactions:39,countSourceMonth:'2026-01'});
 assert.ok(data.observations.slice(1).every(row=>row.valuePrecision==='rounded_nearest_aed_million'&&[row.salesValueAed,row.mortgagesValueAed,row.waiverMarketValueAed].every(value=>value%1000000===0)));
 assert.ok(data.observations.slice(1,6).every(row=>row.salesTransactions===null&&row.mortgageRegistrations===null&&row.waiverTransactions===null));
 assert.deepEqual(data.observations.slice(6).map(row=>[row.salesTransactions,row.mortgageRegistrations,row.waiverTransactions]),[[199,48,64],[218,78,57],[202,66,64]]);
 assert.deepEqual(data.observations.at(-1).salesValueAed,230000000);
});

test('monthly API keeps all-use market data separate from annual and commercial evidence',async()=>{
 const response=mapRakMonthlyMarket(request(),report,data),body=await response.json();
 assert.equal(response.status,200);
 assert.equal(body.scope.calendarYearComplete,false);
 assert.equal(body.scope.commercialOnly,false);
 assert.equal(body.scope.transactionLevel,false);
 assert.equal(body.scope.listingAvailability,false);
 assert.equal(body.observations.length,9);
 assert.deepEqual((await mapRakMonthlyMarket(request('?month=2026-09'),report,data).json()).observations.map(row=>row.month),['2026-09']);
 assert.equal(mapRakMonthlyMarket(request('?month=2026-10'),report,data).status,400);
 assert.equal(mapRakMonthlyMarket(request('?month=2026-13'),report,data).status,400);
 assert.equal(mapRakMonthlyMarket(request('','POST'),report,data).status,405);
 assert.equal(mapRakMonthlyMarket(request('','HEAD'),report,data).body,null);
});

test('compiled Worker serves September monthly source',async()=>{
 const response=await worker.fetch(request('?month=2026-09'),{DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'rak-monthly-test'}},{});
 const body=await response.json();
 assert.equal(response.status,200);
 assert.equal(response.headers.get('x-espacios-evidence-source'),report.sourceId);
 assert.equal(response.headers.get('x-espacios-map-release'),'20261111-map-stack-v58');
 assert.equal(body.observations[0].salesTransactions,202);
});
