import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {normalizeAjmanLandSales,mapAjmanLandSales} from '../src/stack-audit/ajman-land-sales.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url);
const read=path=>fs.readFile(new URL(path,root));
const report=JSON.parse(await read('data/uae-evidence/ajman/lands-sales-validation.json'));
const capture=JSON.parse(await read('data/uae-evidence/ajman/lands-sales-capture.json'));
const compressed=await read('data/uae-evidence/ajman/lands-sales-20260821.json.gz');
const raw=gunzipSync(compressed),sourceRows=JSON.parse(raw),packed=compressed.toString('base64');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const request=(suffix='',method='GET')=>new Request('https://espacios.me/map/api/uae-evidence/ajman/land-sales'+suffix,{method});

test('Ajman land sales retain the exact licensed source and quality limits',()=>{
 assert.equal(sha(raw),report.rawSha256);assert.equal(sha(compressed),report.compressedSha256);
 assert.equal(capture.independentReadbackSha256,report.rawSha256);assert.equal(raw.length,report.rawBytes);
 const {rows,quality}=normalizeAjmanLandSales(sourceRows);
 assert.equal(rows.length,1554);assert.deepEqual(quality,report.quality);
 assert.deepEqual(quality.missingPeriods,['2021Q2']);assert.equal(quality.unavailableValueRows,1);
 assert.equal(quality.duplicateEnglishDimensionRows,1);assert.deepEqual(quality.districtLabelConflicts,['Humaideya 2']);
 assert.ok(rows.every(row=>row.propertyScope==='land'&&row.canonicalProjectId===null&&row.coordinates===null));
});

test('read-only API separates land sales from unit/project evidence',async()=>{
 const response=await mapAjmanLandSales(request('?limit=2'),report,packed),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.source.id,'ajman-dlrr-20260821-land-sales');
 assert.equal(body.source.licence,'CC BY 4.0');assert.equal(body.totalRows,1554);assert.equal(body.rows.length,2);
 assert.equal(body.scope.projectCoordinatesPresent,false);assert.equal(body.scope.quality.unavailableValueRows,1);
 assert.equal(body.scope.quality.knownValueAedSum,undefined);
 const missing=await (await mapAjmanLandSales(request('?year=2021&quarter=2'),report,packed)).json();
 assert.equal(missing.totalRows,0);assert.deepEqual(missing.rows,[]);
 const district=await (await mapAjmanLandSales(request('?district=Humaideya%202&year=2019&quarter=1'),report,packed)).json();
 assert.equal(district.totalRows,2);assert.notEqual(district.rows[0].districtArabic,district.rows[1].districtArabic);
 const unavailable=await (await mapAjmanLandSales(request('?district=Jurf%202&year=2019&quarter=1'),report,packed)).json();
 assert.equal(unavailable.rows.find(row=>row.valueStatus==='unavailable')?.totalSalesValueAed,null);
 assert.equal((await mapAjmanLandSales(request('?limit=0'),report,packed)).status,400);
 assert.equal((await mapAjmanLandSales(request('','POST'),report,packed)).status,405);
 assert.equal((await mapAjmanLandSales(request(),report,packed.slice(1))).status,503);
 assert.equal((await mapAjmanLandSales(request('','HEAD'),report,packed)).body,null);
});

test('compiled Worker serves the land-sales snapshot without exposing raw bytes',async()=>{
 const env={DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'land-sales-test'}};
 const response=await worker.fetch(request('?year=2025&quarter=2&limit=1'),env,{}),body=await response.json();
 assert.equal(response.status,200);assert.equal(response.headers.get('x-espacios-evidence-source'),report.sourceId);
 assert.ok(body.totalRows>0);assert.equal(body.rows.length,1);assert.equal(body.rows[0].period,'2025Q2');
 const rawAsset=await worker.fetch(new Request('https://espacios.me/map/lands-sales-20260821.json.gz'),env,{});
 assert.equal(rawAsset.status,404);
});
