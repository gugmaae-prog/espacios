import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {normalizeAjmanLandMortgages,mapAjmanLandMortgages} from '../src/stack-audit/ajman-land-mortgages.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url),read=path=>fs.readFile(new URL(path,root));
const report=JSON.parse(await read('data/uae-evidence/ajman/lands-mortgage-validation.json'));
const capture=JSON.parse(await read('data/uae-evidence/ajman/lands-mortgage-capture.json'));
const compressed=await read('data/uae-evidence/ajman/lands-mortgage-20260821.json.gz');
const raw=gunzipSync(compressed),rows=JSON.parse(raw),packed=compressed.toString('base64');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const request=(suffix='',method='GET')=>new Request('https://espacios.me/map/api/uae-evidence/ajman/land-mortgages'+suffix,{method});

test('Ajman mortgage rows preserve the licensed source and action grain',()=>{
 assert.equal(sha(raw),report.rawSha256);assert.equal(sha(compressed),report.compressedSha256);
 assert.equal(capture.independentReadbackSha256,report.rawSha256);
 const checked=normalizeAjmanLandMortgages(rows);
 assert.deepEqual(checked.quality,report.quality);
 assert.equal(checked.rows.length,1098);assert.deepEqual(checked.quality.missingPeriods,['2021Q2']);
 assert.ok(checked.rows.every(row=>row.includesMortgageValueModifications&&row.canonicalProjectId===null&&row.coordinates===null));
 assert.ok(checked.rows.some(row=>row.period==='2019Q3'));
});

test('read-only mortgage API labels overlap and filters quarters',async()=>{
 const response=await mapAjmanLandMortgages(request('?year=2019&quarter=3&limit=2'),report,packed),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.source.id,report.sourceId);
 assert.ok(body.totalRows>0);assert.equal(body.rows.length,2);
 assert.ok(body.rows.every(row=>row.period==='2019Q3'));
 assert.equal(body.scope.overlapsOtherAjmanLandEvidence,true);
 assert.equal(body.scope.quality.mortgageActionCountSum,undefined);
 assert.equal((await mapAjmanLandMortgages(request('?limit=0'),report,packed)).status,400);
 assert.equal((await mapAjmanLandMortgages(request('','POST'),report,packed)).status,405);
 assert.equal((await mapAjmanLandMortgages(request(),report,packed.slice(1))).status,503);
});

test('compiled Worker exposes the mortgage aggregate but no raw asset',async()=>{
 const env={DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'mortgage-test'}};
 const response=await worker.fetch(request('?year=2025&quarter=2&limit=1'),env,{}),body=await response.json();
 assert.equal(response.status,200);assert.equal(response.headers.get('x-espacios-evidence-source'),report.sourceId);
 assert.equal(body.rows[0].period,'2025Q2');
 assert.equal((await worker.fetch(new Request('https://espacios.me/map/lands-mortgage-20260821.json.gz'),env,{})).status,404);
});
