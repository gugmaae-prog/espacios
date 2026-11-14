import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {mapRakMarketValues} from '../src/stack-audit/rak-market-values.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url);
const bytes=await fs.readFile(new URL('data/uae-evidence/ras-al-khaimah/market-values-20261109.json',root));
const data=JSON.parse(bytes),report=JSON.parse(await fs.readFile(new URL('data/uae-evidence/ras-al-khaimah/market-values-validation.json',root)));
const request=(query='',method='GET')=>new Request(`https://espacios.me/map/api/uae-evidence/ras-al-khaimah/market-values${query}`,{method});

test('selected official annual values preserve source units and component totals',()=>{
 assert.equal(createHash('sha256').update(bytes).digest('hex'),report.dataSha256);
 assert.equal(bytes.length,report.dataBytes);
 assert.deepEqual(data.observations.map(row=>row.year),[2015,2020,2022,2023,2024,2025]);
 for(const row of data.observations){
  assert.ok(Math.abs(row.salesValueAedThousand+row.mortgagesValueAedThousand+row.waiverMarketValueAedThousand-row.totalTransactionValueAedThousand)<=1.01);
  assert.ok(row.commercialUnitSalesValueAedThousand===null||row.commercialUnitSalesValueAedThousand>0);
 }
 assert.equal(data.observations[0].commercialUnitSalesValueAedThousand,null);
 assert.equal(data.observations[2].commercialUnitSalesValueAedThousand,14646.44);
 assert.equal(data.observations[5].totalTransactionValueAedThousand,18803019);
 assert.equal(report.capturePage.sha256.length,64);
});

test('read-only API keeps annual values separate from listings and transaction counts',async()=>{
 const response=mapRakMarketValues(request(),report,data),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.scope.unit,'AED thousand');
 assert.equal(body.scope.transactionLevel,false);assert.equal(body.scope.transactionCountsPresent,false);
 assert.equal(body.scope.listingAvailability,false);assert.equal(body.scope.projectRegister,false);
 assert.equal(body.observations.length,6);
 assert.deepEqual((await mapRakMarketValues(request('?year=2025'),report,data).json()).observations.map(row=>row.year),[2025]);
 assert.equal(mapRakMarketValues(request('?year=2026'),report,data).status,400);
 assert.equal(mapRakMarketValues(request('','POST'),report,data).status,405);
 assert.equal(mapRakMarketValues(request('','HEAD'),report,data).body,null);
});

test('compiled Worker serves the RAK source',async()=>{
 const response=await worker.fetch(request(),{DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'rak-test'}},{}),body=await response.json();
 assert.equal(response.status,200);
 assert.equal(response.headers.get('x-espacios-evidence-source'),report.sourceId);
 assert.equal(body.observations[5].commercialLandSalesValueAedThousand,10720);
});
