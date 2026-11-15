import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {mapRakCommercialHistory,mapRakMunicipalCommercialSales} from '../src/stack-audit/rak-market-values.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url);
const bytes=await fs.readFile(new URL('data/uae-evidence/ras-al-khaimah/municipal-commercial-sales-2025-20261115.json',root));
const data=JSON.parse(bytes);
const report=JSON.parse(await fs.readFile(new URL('data/uae-evidence/ras-al-khaimah/municipal-commercial-sales-2025-validation.json',root)));
const request=(query='',method='GET')=>new Request(`https://espacios.me/map/api/uae-evidence/ras-al-khaimah/municipal-commercial-sales-2025${query}`,{method});

test('municipal commercial sale projection has exact selected 2025 figures and separately flags 2024 conflict',()=>{
 assert.equal(createHash('sha256').update(bytes).digest('hex'),report.dataSha256);
 assert.equal(bytes.length,report.dataBytes);
 assert.equal(report.sourceCapture.sha256,report.sourceCapture.independentReadbackSha256);
 assert.equal(data.year,2025);
 assert.deepEqual(data.observations.map(row=>[row.propertyUse,row.salesValueAed,row.saleCount]),[
  ['Commercial',10720000,21],['Commercial Unit',31787851,41],['Commercial Residential',603003371,194],['Industrial',6360000,4]
 ]);
 assert.match(report.sourceConflict,/2024 Commercial Unit value is AED 22,190,885/);
});

test('municipal sale API preserves use classes and read-only boundary',async()=>{
 const response=mapRakMunicipalCommercialSales(request(),report,data),body=await response.json();
 assert.equal(response.status,200);
 assert.equal(body.scope.transactionLevel,false);
 assert.equal(body.scope.currentAvailability,false);
 assert.equal(body.scope.selectedUseCategories,4);
 assert.equal(body.observations[1].unitSales,true);
 assert.equal(body.observations[2].commercialOnly,false);
 assert.deepEqual((await mapRakMunicipalCommercialSales(request('?use=Commercial%20Unit'),report,data).json()).observations.map(row=>row.propertyUse),['Commercial Unit']);
 assert.equal(mapRakMunicipalCommercialSales(request('?use=Office'),report,data).status,400);
 assert.equal(mapRakMunicipalCommercialSales(request('','POST'),report,data).status,405);
 assert.equal(mapRakMunicipalCommercialSales(request('','HEAD'),report,data).body,null);
});

test('compiled Worker serves the 2025 projection without exposing individual sales',async()=>{
 const response=await worker.fetch(request('?use=Commercial%20Unit'),{DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'rak-municipal-test'}},{});
 const body=await response.json();
 assert.equal(response.status,200);
 assert.equal(response.headers.get('x-espacios-evidence-source'),report.sourceId);
 assert.equal(body.scope.transactionLevel,false);
 assert.deepEqual(body.observations.map(row=>[row.propertyUse,row.saleCount]),[['Commercial Unit',41]]);
});

test('yearbook API labels the conflicting 2024 comparison without changing its original row',async()=>{
 const priorData=JSON.parse(await fs.readFile(new URL('data/uae-evidence/ras-al-khaimah/commercial-sales-history-20261110.json',root)));
 const priorReport=JSON.parse(await fs.readFile(new URL('data/uae-evidence/ras-al-khaimah/commercial-sales-history-validation.json',root)));
 const response=mapRakCommercialHistory(new Request('https://espacios.me/map/api/uae-evidence/ras-al-khaimah/commercial-sales-history?year=2024'),priorReport,priorData,report);
 const body=await response.json();
 assert.match(body.scope.sourceConflict,/22,190,885/);
 assert.equal(body.observations[0].commercialUnitSalesValueAedThousand,35209.02);
});
