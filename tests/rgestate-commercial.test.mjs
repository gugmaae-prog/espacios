import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {mapRgestateCommercial,mapRgestateCommercialPage} from '../src/stack-audit/rgestate-commercial.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url);
const report=JSON.parse(await fs.readFile(new URL('data/uae-evidence/rgestate/commercial-listings-validation.json',root)));
const packed=(await fs.readFile(new URL('data/uae-evidence/rgestate/commercial-listings-20261103.json.gz',root))).toString('base64');
const request=(query='',method='GET')=>new Request('https://espacios.me/map/api/uae-evidence/commercial/listings'+query,{method});

test('commercial listing facts retain publisher and evidence boundaries',async()=>{
 const all=await(await mapRgestateCommercial(request('?limit=100'),report,packed)).json();
 assert.equal(all.scope.totalSnapshotRows,894);
 assert.equal(all.scope.rentRows,477);
 assert.equal(all.scope.saleRows,417);
 assert.equal(all.scope.photosIncluded,false);
 assert.equal(all.scope.registeredTransactionEvidence,false);
 assert.equal(all.scope.availability,'publisher_listed_at_capture_unverified_now');
 const seen=new Set();
 for(let offset=0;offset<894;offset+=100){
  const page=await(await mapRgestateCommercial(request(`?limit=100&offset=${offset}`),report,packed)).json();
  for(const row of page.rows){
   assert.ok(row.sourceUrl.startsWith(`https://www.rgestate.com/${row.purpose}/`));
   assert.equal(row.canonicalProjectId,null);assert.equal(row.coordinates,null);
   assert.equal(row.availabilityStatus,'publisher_listed_unverified');
   assert.ok(!('image' in row)&&!('phone' in row));
   seen.add(row.sourceListingId);
  }
 }
 assert.equal(seen.size,894);
 assert.equal((await(await mapRgestateCommercial(request('?purpose=rent&limit=100'),report,packed)).json()).totalRows,477);
 assert.equal((await(await mapRgestateCommercial(request('?purpose=sale&limit=100'),report,packed)).json()).totalRows,417);
});

test('commercial routes reject bad input and tampered bytes',async()=>{
 for(const query of ['?purpose=forecast','?limit=0','?offset=-1','?q='+encodeURIComponent('x'.repeat(121))])assert.equal((await mapRgestateCommercial(request(query),report,packed)).status,400);
 assert.equal((await mapRgestateCommercial(request('','POST'),report,packed)).status,405);
 assert.equal((await mapRgestateCommercial(request(),{...report,rawSha256:'0'.repeat(64)},packed)).status,503);
 const page=mapRgestateCommercialPage(new Request('https://espacios.me/map/commercial'));
 assert.equal(page.status,200);
 const html=await page.text();assert.match(html,/Historical evidence/);assert.match(html,/No listing photos/);assert.doesNotMatch(html,/<img\b/);
 assert.match(html,/\[hidden\]\{display:none!important\}/);
});

test('compiled Worker serves commercial API and page with restricted raw path',async()=>{
 const env={DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'rge-test'}};
 const result=await worker.fetch(request('?q=Jebel%20Ali&purpose=rent'),env,{}),body=await result.json();
 assert.equal(result.status,200);assert.ok(body.totalRows>0);
 assert.equal(result.headers.get('x-espacios-map-release'),'20261103-map-stack-v24');
 assert.equal((await worker.fetch(new Request('https://espacios.me/map/commercial'),env,{})).status,200);
 const mapHtml=await(await worker.fetch(new Request('https://espacios.me/map'),env,{})).text();
 assert.match(mapHtml,/a\.href="\/map\/commercial"/);
 assert.equal((await worker.fetch(new Request('https://espacios.me/map/commercial-listings-20261103.json.gz'),env,{})).status,404);
});
