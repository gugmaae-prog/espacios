import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {mapAjmanPlanningEvidence} from '../src/stack-audit/ajman-planning-evidence.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url),dir='data/uae-evidence/ajman/';
const read=name=>fs.readFile(new URL(dir+name,root));
const sources=await Promise.all(['licence-types-20260901','site-plans-by-use-20240709'].map(async stem=>({report:JSON.parse(await read(stem+'-validation.json')),packed:(await read(stem+'.json.gz')).toString('base64'),capture:JSON.parse(await read(stem+'-capture.json'))})));
const request=(route,suffix='',method='GET')=>new Request(`https://espacios.me${route}${suffix}`,{method});

test('independent Ajman captures match stored bytes and conflicting licence groups stay withheld',async()=>{
 for(const item of sources){
  const raw=gunzipSync(Buffer.from(item.packed,'base64'));
  assert.equal(createHash('sha256').update(raw).digest('hex'),item.report.rawSha256);
  assert.equal(item.capture.sourceResponseSha256,item.capture.independentReadbackSha256);
  assert.equal(item.report.sourceRows,item.capture.totalCount);
 }
 assert.deepEqual(sources.map(item=>item.report.sourceRows),[572,126]);
 assert.deepEqual(sources.map(item=>item.report.usableRows),[532,126]);
 assert.equal(sources[0].report.conflictingGroups,20);
 assert.equal(sources[0].report.conflictingSourceRows,40);
});

test('Ajman licences and three-city historical site plans remain separate from commercial availability',async()=>{
 const licence=sources[0].report.route,site=sources[1].report.route;
 const licences=await (await mapAjmanPlanningEvidence(request(licence,'?year=2025&type=New'),sources)).json();
 assert.equal(licences.totalRows,12);
 assert.ok(licences.rows.every(row=>row.licenceTypeEn==='New'&&Number.isSafeInteger(row.licenceCount)&&row.licenceTypeAr));
 assert.equal(licences.scope.availableSpacesEstablished,false);
 assert.match(licences.scope.limits,/overlap other Ajman permit measures/);
 const conflict=await (await mapAjmanPlanningEvidence(request(licence,'?year=2023&month=1&type=New'),sources)).json();
 assert.equal(conflict.totalRows,0);
 const commercial=await (await mapAjmanPlanningEvidence(request(site,'?year=2019&use=commercial%20use'),sources)).json();
 assert.equal(commercial.totalRows,3);
 assert.deepEqual(new Set(commercial.rows.map(row=>row.city)),new Set(['Ajman City','Manama','Masfout']));
 assert.equal(commercial.scope.availableSpacesEstablished,false);
 assert.match(commercial.scope.limits,/2013–2019 historical/);
 assert.equal((await mapAjmanPlanningEvidence(request(site,'?month=1'),sources)).status,400);
 assert.equal((await mapAjmanPlanningEvidence(request(site,'','POST'),sources)).status,405);
 assert.equal((await mapAjmanPlanningEvidence(request(site,'','HEAD'),sources)).body,null);
});

test('compiled Worker serves canonical read-only planning routes and records the verified IDrive replica',async()=>{
 const env={DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'ajman-planning-test'}};
 for(const item of sources){
  const response=await worker.fetch(request(item.report.route+'?limit=1'),env,{}),body=await response.json();
  assert.equal(response.status,200);
  assert.equal(response.headers.get('x-espacios-evidence-source'),item.report.sourceId);
  assert.equal(body.rows.length,1);
  assert.equal(body.source.idriveReplica?.attestationId,'ajman-planning-idrive-e2-readback-20261115');
  assert.equal((await worker.fetch(new Request('https://psrhomes.ae'+item.report.route),env,{})).status,404);
 }
 assert.equal((await worker.fetch(request('/map/site-plans-by-use-20240709.json.gz'),env,{})).status,404);
});
