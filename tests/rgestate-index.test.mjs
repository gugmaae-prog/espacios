import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {mapRgestateIndex} from '../src/stack-audit/rgestate-index.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url);
const report=JSON.parse(await fs.readFile(new URL('data/uae-evidence/rgestate/full-index-validation.json',root)));
const packedBytes=await fs.readFile(new URL('data/uae-evidence/rgestate/full-index-20261103.json.gz',root));
const packed=packedBytes.toString('base64');
const sourceRows=JSON.parse(gunzipSync(packedBytes));
const request=(query='',method='GET')=>new Request('https://espacios.me/map/api/uae-evidence/rgestate/index'+query,{method});

test('full index preserves all source facts and boundaries without adding project pins',async()=>{
 const seen=[];
 for(let offset=0;offset<1708;offset+=100){
  const response=await mapRgestateIndex(request(`?limit=100&offset=${offset}`),report,packed);
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.scope.totalSnapshotRows,1708);
  assert.equal(body.scope.commercialCategoryRows,894);
  assert.equal(body.scope.notInCommercialCategoryRows,814);
  assert.equal(body.scope.availability,'publisher_listed_at_capture_unverified_now');
  assert.equal(body.scope.registeredTransactionEvidence,false);
  assert.equal(body.scope.photosIncluded,false);
  seen.push(...body.rows);
 }
 assert.deepEqual(seen,sourceRows);
 assert.equal(new Set(seen.map(row=>row.sourceListingId)).size,1708);
 assert.ok(seen.every(row=>row.coordinates===null&&row.canonicalProjectId===null&&row.availabilityStatus==='publisher_listed_unverified'));
 assert.ok(seen.every(row=>!('image' in row)&&!('phone' in row)));
 assert.equal(seen.filter(row=>row.commercialCategoryMember).length,894);
 assert.equal(seen.filter(row=>row.listingPathClass==='business-sale'&&row.priceAed!==null).length,0);
});

test('filters and read-only boundary retain source classification',async()=>{
 for(const [query,total] of [['?kind=rent',756],['?kind=sale',831],['?kind=business-sale',106],['?kind=off-plan',15],['?commercial=yes',894],['?commercial=no',814]]){
  const response=await mapRgestateIndex(request(query),report,packed);
  assert.equal((await response.json()).totalRows,total);
 }
 for(const query of ['?kind=forecast','?commercial=maybe','?limit=101','?offset=-1','?q='+encodeURIComponent('x'.repeat(121))])assert.equal((await mapRgestateIndex(request(query),report,packed)).status,400);
 assert.equal((await mapRgestateIndex(request('','POST'),report,packed)).status,405);
 assert.equal((await mapRgestateIndex(request('','HEAD'),report,packed)).status,200);
 assert.equal((await mapRgestateIndex(request(),{...report,rawSha256:'0'.repeat(64)},packed)).status,503);
});

test('compiled Worker exposes the index only on the canonical Map tenant',async()=>{
 const env={DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'rge-index-test'}};
 const response=await worker.fetch(request('?kind=rent&limit=2'),env,{});
 assert.equal(response.status,200);
 assert.equal((await response.json()).totalRows,756);
 assert.equal((await worker.fetch(new Request('https://espacios.me/psr/map/api/uae-evidence/rgestate/index'),env,{})).status,404);
 assert.equal((await worker.fetch(new Request('https://espacios.me/map/full-index-20261103.json.gz'),env,{})).status,404);
});
