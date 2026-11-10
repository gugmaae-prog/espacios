import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {mapScadBuildingActivity} from '../src/stack-audit/scad-building-activity.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url);
const bytes=await fs.readFile(new URL('data/uae-evidence/abu-dhabi/building-activity-20261110.json',root));
const data=JSON.parse(bytes);
const report=JSON.parse(await fs.readFile(new URL('data/uae-evidence/abu-dhabi/building-activity-validation.json',root)));
const request=(query='',method='GET')=>new Request(`https://espacios.me/map/api/uae-evidence/abu-dhabi/building-activity${query}`,{method});

test('SCAD quarterly source preserves regions, periods, and separate permit and completion categories',()=>{
 assert.equal(createHash('sha256').update(bytes).digest('hex'),report.dataSha256);
 assert.equal(bytes.length,report.dataBytes);
 assert.equal(report.captureReports.length,5);
 assert.ok(report.captureReports.every(item=>item.bytes>100000&&/^[a-f0-9]{64}$/.test(item.sha256)&&item.readback.includes('second independent GET')));
 assert.deepEqual(data.observations.map(row=>row.period),['2025Q1','2025Q2','2025Q3','2025Q4','2026Q2']);
 assert.deepEqual(data.periodsUnavailable,['2026Q1']);
 assert.deepEqual(data.observations.map(row=>row.permitByUsage.commercial.emirateTotal),[607,585,751,781,689]);
 for(const row of data.observations){
  assert.equal(row.preliminary,true);
  assert.deepEqual(row.permitByType.total,row.permitByUsage.total);
  for(const table of [row.permitByType,row.permitByUsage,row.completionByConstruction]){
   for(const values of Object.values(table))assert.equal(values.abuDhabi+values.alAin+values.alDhafra,values.emirateTotal);
   for(const region of ['abuDhabi','alAin','alDhafra','emirateTotal'])assert.equal(Object.entries(table).filter(([key])=>key!=='total').reduce((sum,[,value])=>sum+value[region],0),table.total[region]);
  }
 }
 assert.deepEqual(data.observations.at(-1).permitByUsage.commercial,{abuDhabi:635,alAin:52,alDhafra:2,emirateTotal:689});
 assert.equal(data.observations.at(-1).completionByConstruction.total.emirateTotal,6967);
});

test('building activity API exposes preliminary source without implying commercial completions or listings',async()=>{
 const response=mapScadBuildingActivity(request(),report,data),body=await response.json();
 assert.equal(response.status,200);
 assert.equal(body.scope.preliminary,true);
 assert.equal(body.scope.commercialCompletionsAvailable,false);
 assert.equal(body.scope.listingAvailability,false);
 assert.equal(body.scope.projectRegister,false);
 assert.equal(body.observations.length,5);
 assert.deepEqual((await mapScadBuildingActivity(request('?period=2026Q2'),report,data).json()).observations.map(row=>row.period),['2026Q2']);
 assert.equal(mapScadBuildingActivity(request('?period=2026Q1'),report,data).status,400);
 assert.equal(mapScadBuildingActivity(request('?period=2026Q5'),report,data).status,400);
 assert.equal(mapScadBuildingActivity(request('','POST'),report,data).status,405);
 assert.equal(mapScadBuildingActivity(request('','HEAD'),report,data).body,null);
});

test('compiled Worker serves SCAD evidence and restricted routes stay restricted',async()=>{
 const env={DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'scad-building-test'}};
 const response=await worker.fetch(request('?period=2026Q2'),env,{}),body=await response.json();
 assert.equal(response.status,200);
 assert.equal(response.headers.get('x-espacios-evidence-source'),report.sourceId);
 assert.equal(response.headers.get('x-espacios-map-release'),'20261110-map-stack-v55');
 assert.equal(body.observations[0].permitByUsage.commercial.emirateTotal,689);
 assert.equal((await worker.fetch(new Request('https://espacios.me/map/data-room'),env,{})).status,404);
});
