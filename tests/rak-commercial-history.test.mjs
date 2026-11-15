import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {mapRakCommercialHistory} from '../src/stack-audit/rak-market-values.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url);
const bytes=await fs.readFile(new URL('data/uae-evidence/ras-al-khaimah/commercial-sales-history-20261110.json',root));
const data=JSON.parse(bytes),report=JSON.parse(await fs.readFile(new URL('data/uae-evidence/ras-al-khaimah/commercial-sales-history-validation.json',root)));
const existing=JSON.parse(await fs.readFile(new URL('data/uae-evidence/ras-al-khaimah/market-values-20261109.json',root)));
const request=(query='',method='GET')=>new Request(`https://espacios.me/map/api/uae-evidence/ras-al-khaimah/commercial-sales-history${query}`,{method});

test('official RAK commercial categories preserve reported gaps and existing observations',()=>{
 assert.equal(createHash('sha256').update(bytes).digest('hex'),report.dataSha256);
 assert.equal(bytes.length,report.dataBytes);
 assert.equal(report.sourceCapture.sha256,report.sourceCapture.independentReadbackSha256);
 assert.deepEqual(data.observations.map(row=>row.year),Array.from({length:11},(_,i)=>2015+i));
 assert.deepEqual(data.observations.filter(row=>row.commercialUnitSalesValueAedThousand!==null).map(row=>row.year),[2019,2021,2022,2023,2024,2025]);
 assert.equal(data.observations.find(row=>row.year===2020).commercialUnitSalesValueAedThousand,null);
 assert.equal(data.observations.find(row=>row.year===2019).commercialUnitSalesValueAedThousand,2269);
 assert.equal(data.observations.find(row=>row.year===2021).commercialUnitSalesValueAedThousand,8341.45);
 for(const prior of existing.observations){const row=data.observations.find(item=>item.year===prior.year);for(const key of ['commercialLandSalesValueAedThousand','mixedCommercialResidentialLandSalesValueAedThousand','commercialUnitSalesValueAedThousand'])assert.equal(row[key],prior[key]);}
});

test('commercial history API is read-only and does not imply inventory',async()=>{
 const response=mapRakCommercialHistory(request(),report,data),body=await response.json();
 assert.equal(response.status,200);
 assert.equal(body.scope.evidenceClass,'official_annual_commercial_sales_value_aggregate');
 assert.equal(body.scope.unit,'AED thousand');
 assert.equal(body.scope.listingAvailability,false);
 assert.equal(body.scope.transactionCountsPresent,false);
 assert.equal(body.observations.length,11);
 assert.deepEqual((await mapRakCommercialHistory(request('?year=2021'),report,data).json()).observations.map(row=>row.year),[2021]);
 assert.equal(mapRakCommercialHistory(request('?year=2026'),report,data).status,400);
 assert.equal(mapRakCommercialHistory(request('?year=2021x'),report,data).status,400);
 assert.equal(mapRakCommercialHistory(request('','POST'),report,data).status,405);
 assert.equal(mapRakCommercialHistory(request('','HEAD'),report,data).body,null);
});

test('compiled Worker serves the verified commercial series',async()=>{
 const response=await worker.fetch(request(),{DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'rak-commercial-test'}},{}),body=await response.json();
 assert.equal(response.status,200);
 assert.equal(response.headers.get('x-espacios-evidence-source'),report.sourceId);
 assert.equal(body.observations.at(-1).commercialUnitSalesValueAedThousand,31787.85);
});
