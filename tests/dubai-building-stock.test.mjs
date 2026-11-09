import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {mapDubaiBuildingStock} from '../src/stack-audit/dubai-building-stock.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url),dir='data/uae-evidence/dubai/';
const dataBytes=await fs.readFile(new URL(dir+'commercial-building-stock-20261110.json',root));
const data=JSON.parse(dataBytes),report=JSON.parse(await fs.readFile(new URL(dir+'commercial-building-stock-validation.json',root)));
const raw=gunzipSync(await fs.readFile(new URL(dir+'dsc-housing-building-2019.csv.gz',root)));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const request=(query='',method='GET',host='espacios.me')=>new Request(`https://${host}/map/api/uae-evidence/dubai/commercial-building-stock${query}`,{method});

test('historical Dubai stock retains its source and excludes ambiguous keys',()=>{
 assert.equal(sha(raw),report.sourceRawSha256);assert.equal(raw.length,report.sourceRawBytes);
 assert.equal(sha(dataBytes),report.dataSha256);assert.equal(dataBytes.length,report.dataBytes);
 assert.equal(report.sourceRows,966);assert.equal(report.sourceDistinctKeys,718);assert.equal(report.ambiguousKeyRowsWithheld,403);
 assert.equal(data.observations.length,30);
 for(const year of [2015,2016,2017,2018,2019])for(const type of ['commercial_building','industrial_building']){
  const rows=data.observations.filter(row=>row.year===year&&row.buildingType===type);
  assert.equal(rows.length,3);assert.equal(rows.find(row=>row.area==='all').buildingCount,rows.find(row=>row.area==='urban').buildingCount+rows.find(row=>row.area==='rural').buildingCount);
 }
 assert.equal(data.observations.find(row=>row.year===2019&&row.buildingType==='commercial_building'&&row.area==='all').buildingCount,10405);
 assert.match(data.limits,/not annual new completions/);
});

test('read-only Dubai stock API retains evidence class and bounded filters',async()=>{
 const response=mapDubaiBuildingStock(request('?year=2019&area=all'),report,data),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.totalRows,2);
 assert.equal(body.scope.listingAvailability,false);assert.equal(body.scope.transactions,false);assert.equal(body.scope.projectCoordinates,false);
 assert.equal(body.observations.find(row=>row.buildingType==='industrial_building').buildingCount,1055);
 assert.equal((await (await mapDubaiBuildingStock(request('?year=2016&type=commercial_building&area=rural'),report,data)).json()).observations[0].buildingCount,298);
 assert.equal(mapDubaiBuildingStock(request('?year=2024'),report,data).status,400);
 assert.equal(mapDubaiBuildingStock(request('?type=shop'),report,data).status,400);
 assert.equal(mapDubaiBuildingStock(request('','POST'),report,data).status,405);
 assert.equal(mapDubaiBuildingStock(request('','HEAD'),report,data).body,null);
});

test('compiled Worker serves Dubai stock on canonical host only',async()=>{
 const env={DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'dubai-stock-test'}};
 const response=await worker.fetch(request('?year=2019&area=all'),env,{}),body=await response.json();
 assert.equal(response.status,200);assert.equal(response.headers.get('x-espacios-evidence-source'),report.sourceId);
 assert.equal(body.observations.find(row=>row.buildingType==='commercial_building').buildingCount,10405);
 assert.equal((await worker.fetch(request('','GET','psrhomes.ae'),env,{})).status,404);
});
