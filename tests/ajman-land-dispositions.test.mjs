import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {normalizeAjmanLandDispositions,mapAjmanLandDispositions} from '../src/stack-audit/ajman-land-dispositions.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url),read=path=>fs.readFile(new URL(path,root));
const report=JSON.parse(await read('data/uae-evidence/ajman/lands-transactions-validation.json'));
const capture=JSON.parse(await read('data/uae-evidence/ajman/lands-transactions-capture.json'));
const compressed=await read('data/uae-evidence/ajman/lands-transactions-20260821.json.gz');
const raw=gunzipSync(compressed),sourceRows=JSON.parse(raw),packed=compressed.toString('base64');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const request=(suffix='',method='GET')=>new Request('https://espacios.me/map/api/uae-evidence/ajman/land-dispositions'+suffix,{method});

test('Ajman land dispositions retain the exact licensed source and separate grain',()=>{
 assert.equal(sha(raw),report.rawSha256);assert.equal(sha(compressed),report.compressedSha256);
 assert.equal(capture.independentReadbackSha256,report.rawSha256);assert.equal(capture.independentReadbackBytes,raw.length);
 const {rows,quality}=normalizeAjmanLandDispositions(sourceRows);
 assert.equal(rows.length,1646);assert.deepEqual(quality,report.quality);
 assert.deepEqual(quality.missingPeriods,['2019Q3','2019Q4','2021Q2']);assert.equal(quality.duplicateDimensionRows,0);
 assert.ok(rows.every(row=>row.propertyScope==='land'&&row.includesMortgageActivity&&row.canonicalProjectId===null&&row.coordinates===null));
});

test('read-only API preserves source rows and does not sum overlapping land sales',async()=>{
 const response=await mapAjmanLandDispositions(request('?limit=2'),report,packed),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.source.id,report.sourceId);assert.equal(body.source.licence,'CC BY 4.0');
 assert.equal(body.totalRows,1646);assert.equal(body.rows.length,2);assert.equal(body.scope.overlapsOtherAjmanLandEvidence,true);
 assert.equal(body.scope.quality.transactionCountSum,undefined);assert.equal(body.scope.quality.transactionValueAedSum,undefined);
 const missing=await (await mapAjmanLandDispositions(request('?year=2021&quarter=2'),report,packed)).json();
 assert.equal(missing.totalRows,0);assert.deepEqual(missing.rows,[]);
 const filtered=await (await mapAjmanLandDispositions(request('?district=Yasmeen&year=2021&quarter=3'),report,packed)).json();
 assert.equal(filtered.totalRows,1);assert.equal(filtered.rows[0].period,'2021Q3');
 assert.equal((await mapAjmanLandDispositions(request('?limit=0'),report,packed)).status,400);
 assert.equal((await mapAjmanLandDispositions(request('','POST'),report,packed)).status,405);
 assert.equal((await mapAjmanLandDispositions(request(),report,packed.slice(1))).status,503);
 assert.equal((await mapAjmanLandDispositions(request('','HEAD'),report,packed)).body,null);
});

test('compiled Worker serves the land-disposition snapshot without exposing raw bytes',async()=>{
 const env={DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'land-dispositions-test'}};
 const response=await worker.fetch(request('?year=2025&quarter=2&limit=1'),env,{}),body=await response.json();
 assert.equal(response.status,200);assert.equal(response.headers.get('x-espacios-evidence-source'),report.sourceId);
 assert.ok(body.totalRows>0);assert.equal(body.rows.length,1);assert.equal(body.rows[0].period,'2025Q2');
 const rawAsset=await worker.fetch(new Request('https://espacios.me/map/lands-transactions-20260821.json.gz'),env,{});
 assert.equal(rawAsset.status,404);
});
