import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {mapRgestateIndex} from '../src/stack-audit/rgestate-index.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url);
const report=JSON.parse(await fs.readFile(new URL('data/uae-evidence/rgestate/full-index-validation.json',root)));
const labels=JSON.parse(await fs.readFile(new URL('data/uae-evidence/rgestate/emirate-label-validation.json',root)));
const areas=JSON.parse(await fs.readFile(new URL('data/uae-evidence/rgestate/area-geography-validation.json',root)));
const packedBytes=await fs.readFile(new URL('data/uae-evidence/rgestate/full-index-20261109.json.gz',root));
const packed=packedBytes.toString('base64');
const sourceRows=JSON.parse(gunzipSync(packedBytes));
const request=(query='',method='GET')=>new Request('https://espacios.me/map/api/uae-evidence/rgestate/index'+query,{method});

test('full index preserves all source facts and boundaries without adding project pins',async()=>{
 const seen=[];
 for(let offset=0;offset<1670;offset+=100){
  const response=await mapRgestateIndex(request(`?limit=100&offset=${offset}`),report,packed,labels,areas);
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.scope.totalSnapshotRows,1670);
  assert.equal(body.scope.commercialCategoryRows,863);
  assert.equal(body.scope.notInCommercialCategoryRows,807);
  assert.equal(body.source.comparison.previousSourceId,'rgestate-full-index-20261103');
  assert.equal(body.source.comparison.continuingIds,1670);
  assert.equal(body.source.comparison.addedIds.length,0);
  assert.equal(body.source.comparison.absentFromCurrentIndexIds.length,38);
  assert.equal(body.source.comparison.changedAskingPrices.length,4);
  assert.match(body.source.comparison.limits,/does not establish a sale/);
  assert.equal(body.scope.availability,'publisher_listed_at_capture_unverified_now');
  assert.equal(body.scope.registeredTransactionEvidence,false);
  assert.equal(body.scope.photosIncluded,false);
  assert.equal(body.scope.explicitEmirateLabelRows,603);
  assert.equal(body.scope.unassignedEmirateRows,1067);
  assert.equal(body.scope.reviewedAreaLocationRows,837);
  assert.equal(body.scope.unresolvedLocationRows,230);
  seen.push(...body.rows);
 }
 assert.deepEqual(seen.map(({publisherEmirate,reviewedAreaLocation,...row})=>row),sourceRows);
 assert.equal(new Set(seen.map(row=>row.sourceListingId)).size,1670);
 assert.ok(seen.every(row=>row.coordinates===null&&row.canonicalProjectId===null&&row.availabilityStatus==='publisher_listed_unverified'));
 assert.ok(seen.every(row=>!('image' in row)&&!('phone' in row)));
 assert.equal(seen.filter(row=>row.commercialCategoryMember).length,863);
 assert.equal(seen.filter(row=>row.listingPathClass==='business-sale'&&row.priceAed!==null).length,0);
 assert.equal(seen.filter(row=>row.publisherEmirate).length,603);
 assert.equal(seen.find(row=>row.locationLabel==='Al Qusais').publisherEmirate,null);
 assert.equal(seen.find(row=>row.locationLabel==='Al Qusais').reviewedAreaLocation.emirate,'Dubai');
 assert.equal(seen.filter(row=>row.reviewedAreaLocation).length,837);
 assert.equal(seen.find(row=>row.locationLabel==='Al Ain').reviewedAreaLocation.emirate,'Abu Dhabi');
 assert.equal(seen.find(row=>row.locationLabel==='Al Layan').reviewedAreaLocation,null);
});

test('filters and read-only boundary retain source classification',async()=>{
 for(const [query,total] of [['?kind=rent',727],['?kind=sale',823],['?kind=business-sale',105],['?kind=off-plan',15],['?commercial=yes',863],['?commercial=no',807]]){
  const response=await mapRgestateIndex(request(query),report,packed,labels,areas);
  assert.equal((await response.json()).totalRows,total);
 }
 for(const [emirate,total] of Object.entries({'Abu Dhabi':9,Ajman:32,Dubai:5,Fujairah:3,'Ras Al Khaimah':7,Sharjah:354,'Umm Al Quwain':193,unassigned:1067})){
  const body=await (await mapRgestateIndex(request('?emirate='+encodeURIComponent(emirate)+'&limit=100'),report,packed,labels,areas)).json();
  assert.equal(body.totalRows,total);
  if(emirate!=='unassigned')assert.ok(body.rows.every(row=>row.publisherEmirate===emirate));
 }
 const sharjahRent=await (await mapRgestateIndex(request('?emirate=Sharjah&kind=rent'),report,packed,labels,areas)).json();
 assert.equal(sharjahRent.totalRows,162);
 const dubai=await (await mapRgestateIndex(request('?locationEmirate=Dubai&limit=100'),report,packed,labels,areas)).json();
 assert.equal(dubai.totalRows,840);
 assert.ok(dubai.rows.every(row=>row.publisherEmirate==='Dubai'||row.reviewedAreaLocation?.emirate==='Dubai'));
 const unresolved=await (await mapRgestateIndex(request('?locationEmirate=unresolved'),report,packed,labels,areas)).json();
 assert.equal(unresolved.totalRows,230);
 for(const query of ['?kind=forecast','?commercial=maybe','?emirate=Oman','?locationEmirate=Oman','?limit=101','?offset=-1','?q='+encodeURIComponent('x'.repeat(121))])assert.equal((await mapRgestateIndex(request(query),report,packed,labels,areas)).status,400);
 assert.equal((await mapRgestateIndex(request('','POST'),report,packed,labels,areas)).status,405);
 assert.equal((await mapRgestateIndex(request('','HEAD'),report,packed,labels,areas)).status,200);
 assert.equal((await mapRgestateIndex(request(),{...report,rawSha256:'0'.repeat(64)},packed,labels,areas)).status,503);
 assert.equal((await mapRgestateIndex(request(),report,packed,{...labels,sourceRawSha256:'0'.repeat(64)},areas)).status,503);
 assert.equal((await mapRgestateIndex(request(),report,packed,labels,{...areas,areaReferenceSha256:'0'.repeat(64)})).status,503);
});

test('compiled Worker exposes the index only on the canonical Map tenant',async()=>{
 const env={DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'rge-index-test'}};
 const response=await worker.fetch(request('?kind=rent&limit=2'),env,{});
 assert.equal(response.status,200);
 assert.equal((await response.json()).totalRows,727);
 const uaq=await (await worker.fetch(request('?emirate=Umm%20Al%20Quwain&limit=2'),env,{})).json();
 assert.equal(uaq.totalRows,193);
 assert.ok(uaq.rows.every(row=>row.publisherEmirate==='Umm Al Quwain'));
 assert.equal((await worker.fetch(new Request('https://espacios.me/psr/map/api/uae-evidence/rgestate/index'),env,{})).status,404);
 assert.equal((await worker.fetch(new Request('https://espacios.me/map/full-index-20261109.json.gz'),env,{})).status,404);
});
