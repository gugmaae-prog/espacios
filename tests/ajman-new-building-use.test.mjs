import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {mapAjmanNewBuildingUse} from '../src/stack-audit/ajman-new-building-use.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url),dir='data/uae-evidence/ajman/';
const read=name=>fs.readFile(new URL(dir+name,root));
const report=JSON.parse(await read('new-building-use-validation.json'));
const packed=await read('new-building-use-20260923.json.gz');
const request=(suffix='',method='GET')=>new Request(`https://espacios.me/map/api/uae-evidence/ajman/new-building-use${suffix}`,{method});

test('independent publisher reads match and conflicting month/use pairs are withheld',async()=>{
 const raw=gunzipSync(packed),capture=JSON.parse(await read('new-building-use-capture.json'));
 assert.equal(createHash('sha256').update(raw).digest('hex'),report.rawSha256);
 assert.equal(capture.sourceResponseSha256,capture.independentReadbackSha256);
 assert.equal(report.sourceRows,284);assert.equal(report.usableRows,268);
 assert.equal(report.conflictingGroups,8);assert.equal(report.conflictingSourceRows,16);
 assert.equal(report.usableRowsByYear['2023'],16);
 assert.deepEqual(report.completeYears,[2015,2016,2017,2018,2019,2020,2021,2022,2024,2025]);
});

test('API keeps non-residential permits distinct from commercial inventory and partial years',async()=>{
 const encoded=packed.toString('base64');
 const result=await mapAjmanNewBuildingUse(request('?year=2025&use=Non-residential%20buildings'),report,encoded),body=await result.json();
 assert.equal(result.status,200);assert.equal(body.totalRows,12);
 assert.equal(body.rows.reduce((n,row)=>n+row.buildingCount,0),228);
 assert.ok(body.rows.every(row=>row.yearComplete&&row.useEn==='Non-residential buildings'));
 assert.match(body.scope.limits,/uses beyond commercial/);
 assert.equal(body.scope.canonicalProjectMatches,0);
 const conflict=await (await mapAjmanNewBuildingUse(request('?year=2023&month=1'),report,encoded)).json();
 assert.equal(conflict.totalRows,0);
 const partial=await (await mapAjmanNewBuildingUse(request('?year=2026'),report,encoded)).json();
 assert.equal(partial.totalRows,12);assert.ok(partial.rows.every(row=>!row.yearComplete));
 assert.equal((await mapAjmanNewBuildingUse(request('?year=2027'),report,encoded)).status,400);
 assert.equal((await mapAjmanNewBuildingUse(request('','POST'),report,encoded)).status,405);
 assert.equal((await mapAjmanNewBuildingUse(request('','HEAD'),report,encoded)).body,null);
});

test('compiled Worker serves the snapshot only on the canonical route',async()=>{
 const env={DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'new-building-test'}};
 const response=await worker.fetch(request('?year=2025&use=Non-residential%20buildings'),env,{}),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.totalRows,12);
 assert.equal(response.headers.get('x-espacios-evidence-source'),report.sourceId);
 assert.equal((await worker.fetch(new Request('https://psrhomes.ae/map/api/uae-evidence/ajman/new-building-use'),env,{})).status,404);
 assert.equal((await worker.fetch(new Request('https://espacios.me/map/new-building-use-20260923.json.gz'),env,{})).status,404);
});
