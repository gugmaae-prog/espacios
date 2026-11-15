import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
import {mapScadStock} from '../src/stack-audit/scad-stock.mjs';

const request=(query='',method='GET')=>new Request('https://espacios.me/map/api/uae-evidence/abu-dhabi/stock'+query,{method});

test('SCAD census stock keeps its original grain and scope',async()=>{
  const response=await worker.fetch(request(),{DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'scad-stock-test'}},{});
  const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(response.headers.get('x-espacios-evidence-source'),'scad-abu-dhabi-census-2024-real-estate-stock');
  assert.equal(body.totalRows,8);
  assert.equal(body.scope.isAllUae,false);
  assert.equal(body.scope.projectCoordinatesPresent,false);
  assert.equal(body.rows.find(row=>row.region==='emirate-of-abu-dhabi'&&row.period===2024).units,783970);
  assert.equal(body.rows.find(row=>row.region==='al-dhafra-region'&&row.period===2023).buildings,22385);
  assert.ok(body.rows.every(row=>row.units%5===0&&row.buildings%5===0));
  assert.equal(body.source.url,'https://census.scad.gov.ae/home/realestate?lang=en');
});

test('SCAD stock API is filtered, read-only, and fails on invalid filters',async()=>{
  const selected=await (await mapScadStock(request('?period=2024&region=al-ain-region'))).json();
  assert.equal(selected.totalRows,1);
  assert.equal(selected.rows[0].buildings,114715);
  for(const query of ['?period=2025','?region=dubai'])assert.equal(mapScadStock(request(query)).status,400);
  assert.equal(mapScadStock(request('','POST')).status,405);
  assert.equal((await mapScadStock(request('','HEAD')).text()),'');
  assert.equal(mapScadStock(new Request('https://espacios.me/map/api/system')),null);
});
