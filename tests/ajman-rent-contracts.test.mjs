import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {normalizeAjmanRentContracts,mapAjmanRentContracts} from '../src/stack-audit/ajman-rent-contracts.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url),dir='data/uae-evidence/ajman/';
const read=name=>fs.readFile(new URL(dir+name,root));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const report=JSON.parse(await read('certified-rent-validation.json'));
const packed=[];
for(const source of report.sources){
 const compressed=await read(`certified-rent-${source.city}.json.gz`),raw=gunzipSync(compressed),metadataBytes=await read(`certified-rent-${source.city}-metadata.json`),capture=JSON.parse(await read(`certified-rent-${source.city}-capture.json`));
 assert.equal(sha(compressed),source.compressedSha256);assert.equal(sha(raw),source.rawSha256);assert.equal(sha(metadataBytes),source.metadataSha256);assert.equal(capture.independentReadbackSha256,source.rawSha256);
 const verified=normalizeAjmanRentContracts(JSON.parse(raw),source.city);
 assert.deepEqual(verified.quality,source.quality);
 assert.ok(verified.rows.every(row=>row.canonicalProjectId===null&&row.coordinates===null));
 packed.push(compressed.toString('base64'));
}
const request=(suffix='',method='GET')=>new Request(`https://espacios.me/map/api/uae-evidence/ajman/rent-contracts${suffix}`,{method});

test('three licensed city snapshots retain their distinct vintages and source errors',()=>{
 assert.deepEqual(report.sources.map(source=>source.quality.rows),[948,946,862]);
 assert.equal(report.sources.reduce((sum,source)=>sum+source.quality.rows,0),2756);
 assert.deepEqual(report.sources.map(source=>source.quality.duplicateDimensionRows),[3,1,10]);
 assert.deepEqual(report.sources.map(source=>source.quality.unavailableTokens),[{NA:24},{NA:51,'#REF!':1},{NA:53}]);
 assert.ok(report.sources.every(source=>source.licence==='CC BY 4.0'));
});

test('city choice is explicit and counts cannot be mistaken for rents or project prices',async()=>{
 const catalogue=await (await mapAjmanRentContracts(request(),report,packed)).json();
 assert.equal(catalogue.sources.length,3);assert.equal(catalogue.rows,undefined);assert.equal(catalogue.scope.amountsPresent,false);
 for(const source of report.sources){
  const response=await mapAjmanRentContracts(request(`?city=${source.city}&limit=2`),report,packed),body=await response.json();
  assert.equal(response.status,200);assert.equal(body.totalRows,source.quality.rows);assert.equal(body.rows.length,2);
  assert.equal(response.headers.get('cache-control'),'public,max-age=60,s-maxage=300');
  assert.ok(body.rows.every(row=>row.city===source.city&&row.canonicalProjectId===null&&row.coordinates===null));
 }
 const errors=await (await mapAjmanRentContracts(request('?city=manama&year=2017&month=7&limit=100'),report,packed)).json();
 assert.ok(errors.rows.some(row=>row.sourceCountToken==='#REF!'&&row.reportedContracts===null));
 assert.equal((await mapAjmanRentContracts(request('?city=masfoot&year=2026'),report,packed)).status,200);
 assert.equal((await (await mapAjmanRentContracts(request('?city=masfoot&year=2026'),report,packed)).json()).totalRows,0);
 assert.equal((await mapAjmanRentContracts(request('?city=ajman&month=13'),report,packed)).status,400);
 assert.equal((await mapAjmanRentContracts(request('','POST'),report,packed)).status,405);
 assert.equal((await mapAjmanRentContracts(request('?city=ajman'),report,[packed[0].slice(1),...packed.slice(1)])).status,503);
 assert.equal((await mapAjmanRentContracts(request('','HEAD'),report,packed)).body,null);
});

test('compiled Worker serves the city snapshots and hides raw assets',async()=>{
 const env={DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'rent-test'}};
 const response=await worker.fetch(request('?city=manama&year=2025&month=2&limit=1'),env,{}),body=await response.json();
 assert.equal(response.status,200);assert.equal(response.headers.get('x-espacios-evidence-source'),'ajman-municipality-certified-rent-contracts');
 assert.ok(body.totalRows>0);assert.equal(body.rows[0].period,'2025-02');
 const raw=await worker.fetch(new Request('https://espacios.me/map/certified-rent-ajman.json.gz'),env,{});
 assert.equal(raw.status,404);
});
