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

test('commercial area map aggregates reviewed labels without assigning unit pins',async()=>{
 const areaRequest=(query='')=>new Request('https://espacios.me/map/api/uae-evidence/commercial/areas'+query);
 const all=await(await mapRgestateCommercial(areaRequest(),report,packed)).json();
 assert.equal(all.totalRows,894);
 assert.equal(all.mappedRows,817);
 assert.equal(all.unmappedRows,77);
 assert.equal(all.areas.reduce((sum,area)=>sum+area.count,0),817);
 assert.equal(all.scope.mapGranularity,'publisher_area_label');
 assert.equal(all.scope.unitCoordinatesPresent,false);
 assert.equal(all.areas.find(area=>area.key==='umm-al-quwain').count,144);
 for(const area of all.areas){
  assert.match(area.osmUrl,/^https:\/\/www\.openstreetmap\.org\/(relation|node|way)\/\d+$/);
  assert.equal(area.locationBasis,'osm_area_reference_not_unit_coordinate');
  assert.equal(area.rentRows+area.saleRows,area.count);
  assert.ok(area.center[0]>=51.35&&area.center[0]<=56.65&&area.center[1]>=22.45&&area.center[1]<=26.55);
 }
 const rent=await(await mapRgestateCommercial(areaRequest('?purpose=rent'),report,packed)).json();
 const sale=await(await mapRgestateCommercial(areaRequest('?purpose=sale'),report,packed)).json();
 assert.equal(rent.totalRows,477);assert.equal(sale.totalRows,417);
 assert.equal(rent.mappedRows+rent.unmappedRows,477);assert.equal(sale.mappedRows+sale.unmappedRows,417);
 const dip=await(await mapRgestateCommercial(request('?area=dip&limit=100'),report,packed)).json();
 assert.equal(dip.totalRows,62);assert.ok(dip.rows.every(row=>['DIP Dubai Investment Park','DIP','Dubai Investment Park'].includes(row.locationLabel)));
 assert.equal((await mapRgestateCommercial(request('?area=unknown'),report,packed)).status,400);
});

test('commercial routes reject bad input and tampered bytes',async()=>{
 for(const query of ['?purpose=forecast','?limit=0','?offset=-1','?q='+encodeURIComponent('x'.repeat(121))])assert.equal((await mapRgestateCommercial(request(query),report,packed)).status,400);
 assert.equal((await mapRgestateCommercial(request('','POST'),report,packed)).status,405);
 assert.equal((await mapRgestateCommercial(request(),{...report,rawSha256:'0'.repeat(64)},packed)).status,503);
 const page=mapRgestateCommercialPage(new Request('https://espacios.me/map/commercial'));
 assert.equal(page.status,200);
 const html=await page.text();assert.match(html,/Historical evidence/);assert.match(html,/No listing photos/);assert.doesNotMatch(html,/<img\b/);
 assert.match(html,/id="commercial-map"/);assert.match(html,/publisher location labels/i);assert.match(html,/not property, building, or available-unit pins|do not mark the actual unit/);
 assert.match(html,/\[hidden\]\{display:none!important\}/);
});

test('compiled Worker serves commercial API and page with restricted raw path',async()=>{
 const env={DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'rge-test'}};
 const result=await worker.fetch(request('?q=Jebel%20Ali&purpose=rent'),env,{}),body=await result.json();
 assert.equal(result.status,200);assert.ok(body.totalRows>0);
 const areaResponse=await worker.fetch(new Request('https://espacios.me/map/api/uae-evidence/commercial/areas'),env,{});
 const areas=await areaResponse.json();
 assert.equal(areaResponse.status,200);assert.equal(areas.mappedRows,817);assert.equal(areas.unmappedRows,77);
 assert.equal(result.headers.get('x-espacios-map-release'),'20261109-map-stack-v31');
 assert.equal((await worker.fetch(new Request('https://espacios.me/map/commercial'),env,{})).status,200);
 const mapHtml=await(await worker.fetch(new Request('https://espacios.me/map'),env,{})).text();
 assert.match(mapHtml,/a\.href="\/map\/commercial"/);
 assert.equal((await worker.fetch(new Request('https://espacios.me/map/commercial-listings-20261103.json.gz'),env,{})).status,404);
});
