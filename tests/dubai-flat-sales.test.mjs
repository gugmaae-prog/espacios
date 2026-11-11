import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {mapDubaiFlatSales} from '../src/stack-audit/dubai-flat-sales.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url);
const report=JSON.parse(await fs.readFile(new URL('data/uae-evidence/dubai/flat-sales-2026-partial-validation.json',root)));
const packed=await fs.readFile(new URL('data/uae-evidence/dubai/flat-sales-2026-partial-20261111.json.gz',root));
const base64=packed.toString('base64');
const request=(query='',method='GET')=>new Request(`https://espacios.me/map/api/uae-evidence/dubai/flat-sales-2026-partial${query}`,{method});

test('flat-sale aggregates preserve the pinned population and suppress sparse monetary groups',()=>{
 assert.equal(createHash('sha256').update(packed).digest('hex'),report.compressedSha256);
 const raw=gunzipSync(packed),data=JSON.parse(raw);
 assert.equal(createHash('sha256').update(raw).digest('hex'),report.rawSha256);
 assert.equal(data.areaMonthRows.length,1117);
 assert.equal(data.monthlyTotals.length,20);
 assert.equal(data.areaMonthRows.reduce((n,row)=>n+row[4],0),105473);
 assert.equal(data.monthlyTotals.reduce((n,row)=>n+row[2],0),105473);
 assert.equal(data.monthlyTotals.filter(row=>row[1]==='Ready').reduce((n,row)=>n+row[2],0),26973);
 assert.equal(data.monthlyTotals.filter(row=>row[1]==='Off-Plan').reduce((n,row)=>n+row[2],0),78500);
 assert.equal(data.areaMonthRows.filter(row=>row[5]<10).length,316);
 assert.ok(data.areaMonthRows.every(row=>row[5]>=10||(row[6]===null&&row[7]===null)));
});

test('read-only API exposes native month and area groups without combining medians',async()=>{
 const monthly=await (await mapDubaiFlatSales(request(),report,base64)).json();
 assert.equal(monthly.scope.evidenceClass,'registered_residential_flat_sale_aggregate');
 assert.equal(monthly.scope.estimated,false);
 assert.equal(monthly.scope.availableUnits,false);
 assert.equal(monthly.totalSaleRows,105473);
 assert.equal(monthly.totalCleanPriceRows,103804);
 assert.equal(monthly.rows.length,20);
 const january=await (await mapDubaiFlatSales(request('?month=2026-01'),report,base64)).json();
 assert.deepEqual(january.rows.map(row=>[row.registration,row.saleCount,row.medianCleanPriceAedPerSqft]),[['Off-Plan',8684,1870],['Ready',3428,1403]]);
 const area=await (await mapDubaiFlatSales(request('?view=areas&month=2026-01&areaId=526'),report,base64)).json();
 assert.equal(area.totalRows,2);
 assert.deepEqual(area.rows.map(row=>[row.areaName,row.registration,row.saleCount]),[['Business Bay','Off-Plan',516],['Business Bay','Ready',240]]);
 const unknown=await (await mapDubaiFlatSales(request('?view=areas&areaId=unknown'),report,base64)).json();
 assert.equal(unknown.totalSaleRows,35);
 assert.ok(unknown.rows.every(row=>row.areaId===null));
 const page=await (await mapDubaiFlatSales(request('?view=areas&limit=2&offset=2'),report,base64)).json();
 assert.equal(page.rows.length,2);
 assert.equal(page.totalRows,1117);
 assert.equal(page.offset,2);
});

test('filters, corrupted bytes, and methods fail closed',async()=>{
 assert.equal((await mapDubaiFlatSales(request('?month=2025-12'),report,base64)).status,400);
 assert.equal((await mapDubaiFlatSales(request('?view=monthly&areaId=526'),report,base64)).status,400);
 assert.equal((await mapDubaiFlatSales(request('?view=areas&limit=501'),report,base64)).status,400);
 assert.equal((await mapDubaiFlatSales(request('','POST'),report,base64)).status,405);
 assert.equal((await mapDubaiFlatSales(request('','HEAD'),report,base64)).body,null);
 assert.equal((await mapDubaiFlatSales(request(),{...report,rawSha256:'bad'},base64)).status,503);
});

test('compiled Worker serves flat aggregates without an R2 binding',async()=>{
 const response=await worker.fetch(request('?month=2026-01'),{DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'flat-sales-test'}},{}),data=await response.json();
 assert.equal(response.status,200);
 assert.equal(response.headers.get('x-espacios-map-release'),'20261111-map-stack-v64');
 assert.equal(response.headers.get('x-espacios-evidence-source'),report.sourceId);
 assert.equal(data.totalSaleRows,12112);
 assert.equal(data.source.licenseUrl,'https://creativecommons.org/licenses/by/4.0/');
});
