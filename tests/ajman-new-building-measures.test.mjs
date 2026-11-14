import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {mapAjmanNewBuildingMeasures} from '../src/stack-audit/ajman-new-building-measures.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url),dir='data/uae-evidence/ajman/';
const read=name=>fs.readFile(new URL(dir+name,root));
const measures=await Promise.all(['new-building-licences-20260901','new-building-area-20240709'].map(async stem=>({report:JSON.parse(await read(stem+'-validation.json')),packed:(await read(stem+'.json.gz')).toString('base64'),capture:JSON.parse(await read(stem+'-capture.json'))})));
const request=(route,suffix='',method='GET')=>new Request(`https://espacios.me${route}${suffix}`,{method});

test('two independent Ajman publisher exports match exact stored bytes and preserve conflicting rows',async()=>{
 for(const item of measures){
  const raw=gunzipSync(Buffer.from(item.packed,'base64'));
  assert.equal(createHash('sha256').update(raw).digest('hex'),item.report.rawSha256);
  assert.equal(item.capture.sourceResponseSha256,item.capture.independentReadbackSha256);
  assert.equal(item.report.sourceRows,item.capture.totalCount);
 }
 assert.equal(measures[0].report.sourceRows,268);
 assert.equal(measures[0].report.conflictingGroups,10);
 assert.equal(measures[0].report.conflictingSourceRows,20);
 assert.equal(measures[0].report.usableRows,248);
 assert.equal(measures[1].report.sourceRows,198);
 assert.equal(measures[1].report.sourceUnit,null);
 assert.equal(measures[1].report.latestReportedMonth,'2023-03');
});

test('licence counts and unitless built-up area remain separate from completed or available spaces',async()=>{
 const licences=measures[0].report.route,area=measures[1].report.route;
 const selected=await mapAjmanNewBuildingMeasures(request(licences,'?year=2025&use=Non-residential%20buildings'),measures),body=await selected.json();
 assert.equal(selected.status,200);
 assert.equal(body.totalRows,9);
 assert.equal(body.rows.reduce((sum,row)=>sum+row.value,0),220);
 assert.ok(body.rows.every(row=>row.unit==='licences'&&!row.completeReportedDimensionYear));
 assert.equal(body.scope.availableSpacesEstablished,false);
 assert.match(body.scope.limits,/Non-residential includes uses beyond commercial/);
 const conflicts=await (await mapAjmanNewBuildingMeasures(request(licences,'?year=2023&month=1'),measures)).json();
 assert.equal(conflicts.totalRows,0);
 const built=await (await mapAjmanNewBuildingMeasures(request(area,'?year=2023'),measures)).json();
 assert.equal(built.totalRows,6);
 assert.equal(built.scope.sourceUnit,null);
 assert.ok(built.rows.every(row=>row.unit===null));
 assert.match(built.scope.limits,/does not specify the area unit/);
 assert.equal((await mapAjmanNewBuildingMeasures(request(area,'?year=2024'),measures)).status,200);
 assert.equal((await mapAjmanNewBuildingMeasures(request(area,'?month=13'),measures)).status,400);
 assert.equal((await mapAjmanNewBuildingMeasures(request(area,'','POST'),measures)).status,405);
 assert.equal((await mapAjmanNewBuildingMeasures(request(area,'','HEAD'),measures)).body,null);
});

test('compiled Worker exposes only the canonical read-only Ajman evidence routes',async()=>{
 const env={DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'ajman-measures-test'}};
 for(const item of measures){
  const response=await worker.fetch(request(item.report.route+'?limit=1'),env,{}),body=await response.json();
  assert.equal(response.status,200);
  assert.equal(response.headers.get('x-espacios-evidence-source'),item.report.sourceId);
  assert.equal(body.rows.length,1);
  assert.equal(body.source.idriveReplica?.attestationId,'ajman-new-building-permissions-idrive-e2-readback-20261114');
  assert.equal((await worker.fetch(new Request('https://psrhomes.ae'+item.report.route),env,{})).status,404);
 }
 assert.equal((await worker.fetch(request('/map/new-building-area-20240709.json.gz'),env,{})).status,404);
});
