import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker from '../src/worker.js';

const file=new URL('../data/spatial/dubai-heatmap-boundary-fallback-20261115.geojson',import.meta.url);
const dataset=JSON.parse(await readFile(file,'utf8'));
const key=name=>String(name).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

test('degraded surface contains only the published Dubai communities and UAE outlines',()=>{
 assert.equal(dataset.features.length,229);
 assert.equal(dataset.features.filter(f=>f.properties.level==='district').length,222);
 assert.equal(dataset.features.filter(f=>f.properties.level==='emirate').length,7);
 assert.equal(new Set(dataset.features.map(f=>f.id)).size,229);
 for(const feature of dataset.features){
  const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
  assert.ok(polygons.length>0);
  for(const polygon of polygons)for(const ring of polygon){
   assert.ok(ring.length>=4);
   assert.deepEqual(ring[0],ring.at(-1));
  }
 }
});

test('reviewed Dubai history name joins are unique and unresolved names stay unshaded',()=>{
 const names=dataset.features.filter(f=>f.properties.level==='district').map(f=>key(f.properties.name));
 assert.equal(new Set(names).size,222);
 for(const name of ['Warsan First','Al Barsha South Third','Nakhlat Jumeira','Al Kheeran First'])assert.equal(names.filter(n=>n===key(name)).length,1);
 assert.equal(names.includes(key('Al Yelayiss 2')),false);
});

test('Worker serves the bounded fallback only when the full boundary source is absent',async()=>{
 const request=new Request('https://espacios.me/map/spatial/area-surface-20260923-v1.geojson');
 const response=await worker.fetch(request,{},{});
 assert.equal(response.status,200);
 assert.equal(response.headers.get('x-espacios-surface'),'dubai-municipality-boundary-fallback-20261115');
 const body=await response.json();
 assert.equal(body.features.length,229);
 assert.equal(body.meta.fallback,'dubai_municipality_222_communities');
});
