import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {mapAjmanBuildingPermits} from '../src/stack-audit/ajman-building-permits.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url),dir='data/uae-evidence/ajman/';
const read=async name=>fs.readFile(new URL(dir+name,root));
const report=JSON.parse(await read('building-permits-validation.json'));
const packed=await read('building-permits-20260901.json.gz');
const request=(suffix='',method='GET')=>new Request(`https://espacios.me/map/api/uae-evidence/ajman/building-permits${suffix}`,{method});

test('official permit capture is exact and ambiguous source rows cannot enter the series',async()=>{
 const raw=gunzipSync(packed),capture=JSON.parse(await read('building-permits-capture.json'));
 assert.equal(createHash('sha256').update(raw).digest('hex'),report.rawSha256);
 assert.equal(capture.sourceResponseSha256,capture.independentReadbackSha256);
 assert.equal(report.sourceRows,741);assert.equal(report.usableRows,537);
 assert.equal(report.conflictingGroups,33);assert.equal(report.conflictingSourceRows,66);assert.equal(report.nullCountRows,138);
 assert.deepEqual(report.completeYears,[2015,2016,2017,2018,2019,2020,2021]);
 assert.equal(Object.values(report.usableRowsByYear).reduce((n,value)=>n+value,0),537);
 const types=new Set(JSON.parse(raw).map(row=>row.building_type_en).filter(Boolean));assert.equal(types.size,5);
});

test('read-only API preserves native month, building type and incomplete-year warnings',async()=>{
 const result=await mapAjmanBuildingPermits(request('?year=2015&month=1&limit=20'),report,packed.toString('base64'));
 const body=await result.json();assert.equal(result.status,200);assert.equal(body.totalRows,5);
 assert.ok(body.rows.every(row=>row.period==='2015-01'&&row.yearComplete&&Number.isInteger(row.permitCount)));
 assert.equal(body.scope.quality.conflictingGroups,33);assert.equal(body.scope.quality.usableRows,537);
 assert.equal(body.scope.canonicalProjectMatches,0);assert.match(body.scope.limits,/2025–2026/);
 const incomplete=await (await mapAjmanBuildingPermits(request('?year=2023&limit=100'),report,packed.toString('base64'))).json();
 assert.equal(incomplete.totalRows,36);assert.ok(incomplete.rows.every(row=>row.yearComplete===false));
 const empty=await (await mapAjmanBuildingPermits(request('?year=2026'),report,packed.toString('base64'))).json();assert.equal(empty.totalRows,0);
 assert.equal((await mapAjmanBuildingPermits(request('?year=2027'),report,packed.toString('base64'))).status,400);
 assert.equal((await mapAjmanBuildingPermits(request('','POST'),report,packed.toString('base64'))).status,405);
 assert.equal((await mapAjmanBuildingPermits(request('','HEAD'),report,packed.toString('base64'))).body,null);
});

test('compiled Worker serves permit evidence without tenant or raw-asset leakage',async()=>{
 const env={DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'permits-test'}};
 const response=await worker.fetch(request('?year=2015&limit=100'),env,{}),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.totalRows,60);assert.equal(response.headers.get('x-espacios-evidence-source'),report.sourceId);
 assert.equal((await worker.fetch(new Request('https://psrhomes.ae/map/api/uae-evidence/ajman/building-permits'),env,{})).status,404);
 assert.equal((await worker.fetch(new Request('https://espacios.me/map/building-permits-20260901.json.gz'),env,{})).status,404);
});
