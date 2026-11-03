import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {normalizeAjmanUnitMortgages,mapAjmanUnitMortgages} from '../src/stack-audit/ajman-unit-mortgages.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url),read=path=>fs.readFile(new URL(path,root));
const report=JSON.parse(await read('data/uae-evidence/ajman/real-estate-units-mortgage-validation.json'));
const capture=JSON.parse(await read('data/uae-evidence/ajman/real-estate-units-mortgage-capture.json'));
const compressed=await read('data/uae-evidence/ajman/real-estate-units-mortgage-20260821.json.gz');
const raw=gunzipSync(compressed),sourceRows=JSON.parse(raw),packed=compressed.toString('base64');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const request=(suffix='',method='GET')=>new Request('https://espacios.me/map/api/uae-evidence/ajman/unit-mortgages'+suffix,{method});

test('unit-mortgage rows retain licensed bytes and distinct mortgage grain',()=>{
 assert.equal(sha(raw),report.rawSha256);assert.equal(sha(compressed),report.compressedSha256);
 assert.equal(capture.independentReadbackSha256,report.rawSha256);assert.equal(capture.independentReadbackBytes,raw.length);
 const {rows,quality}=normalizeAjmanUnitMortgages(sourceRows);
 assert.equal(rows.length,651);assert.deepEqual(quality,report.quality);
 assert.deepEqual(quality.missingPeriods,['2021Q2']);assert.equal(quality.duplicateDimensionRows,0);
 assert.ok(rows.every(row=>row.canonicalProjectId===null&&row.coordinates===null&&row.mortgageCount>0));
});

test('read-only mortgage API filters source rows without merging mixed dispositions',async()=>{
 const response=await mapAjmanUnitMortgages(request('?limit=2'),report,packed),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.source.id,report.sourceId);assert.equal(body.source.licence,'CC BY 4.0');
 assert.equal(body.totalRows,651);assert.equal(body.rows.length,2);assert.equal(body.scope.overlapsMixedUnitDispositions,true);
 assert.equal(body.scope.quality.mortgageCountSum,undefined);assert.equal(body.scope.quality.mortgageValueAedSum,undefined);
 const missing=await (await mapAjmanUnitMortgages(request('?year=2021&quarter=2'),report,packed)).json();
 assert.equal(missing.totalRows,0);assert.deepEqual(missing.rows,[]);
 const filtered=await (await mapAjmanUnitMortgages(request('?project=AJMAN%20ONE&year=2026&quarter=2'),report,packed)).json();
 assert.ok(filtered.totalRows>0);assert.ok(filtered.rows.every(row=>row.year===2026&&row.quarter===2&&row.projectNameEnglish.includes('AJMAN ONE')));
 assert.equal((await mapAjmanUnitMortgages(request('?limit=0'),report,packed)).status,400);
 assert.equal((await mapAjmanUnitMortgages(request('','POST'),report,packed)).status,405);
 assert.equal((await mapAjmanUnitMortgages(request(),report,packed.slice(1))).status,503);
 assert.equal((await mapAjmanUnitMortgages(request('','HEAD'),report,packed)).body,null);
});

test('compiled Worker serves mortgage evidence while keeping raw bytes private',async()=>{
 const env={DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'unit-mortgages-test'}};
 const response=await worker.fetch(request('?year=2025&quarter=2&limit=1'),env,{}),body=await response.json();
 assert.equal(response.status,200);assert.equal(response.headers.get('x-espacios-evidence-source'),report.sourceId);
 assert.ok(body.totalRows>0);assert.equal(body.rows.length,1);assert.equal(body.rows[0].period,'2025Q2');
 const rawAsset=await worker.fetch(new Request('https://espacios.me/map/real-estate-units-mortgage-20260821.json.gz'),env,{});
 assert.equal(rawAsset.status,404);
});
