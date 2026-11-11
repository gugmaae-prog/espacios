import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {mapRgestateCommercial,mapRgestateCommercialPage} from '../src/stack-audit/rgestate-commercial.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url);
const report=JSON.parse(await fs.readFile(new URL('data/uae-evidence/rgestate/commercial-listings-validation.json',root)));
const packed=(await fs.readFile(new URL('data/uae-evidence/rgestate/commercial-listings-20261111.json.gz',root))).toString('base64');
const candidateReport=JSON.parse(await fs.readFile(new URL('data/uae-evidence/rgestate/commercial-title-candidates-validation.json',root)));
const candidatePacked=(await fs.readFile(new URL('data/uae-evidence/rgestate/commercial-title-candidates-20261111.json.gz',root))).toString('base64');
const parentReport=JSON.parse(await fs.readFile(new URL('data/uae-evidence/rgestate/full-index-validation.json',root)));
const combined=(query='')=>mapRgestateCommercial(request(query),report,packed,candidateReport,candidatePacked,parentReport);
const request=(query='',method='GET')=>new Request('https://espacios.me/map/api/uae-evidence/commercial/listings'+query,{method});

test('commercial listing facts retain publisher and evidence boundaries',async()=>{
 const all=await(await mapRgestateCommercial(request('?limit=100'),report,packed)).json();
 assert.equal(all.scope.totalSnapshotRows,861);
 assert.equal(all.scope.rentRows,450);
 assert.equal(all.scope.saleRows,411);
 assert.equal(all.source.comparison.previousSourceId,'rgestate-commercial-category-20261110');
 assert.equal(all.source.comparison.continuingIds,861);
 assert.equal(all.source.comparison.addedIds.length,0);
 assert.deepEqual(all.source.comparison.absentFromCurrentCategoryIds,[]);
 assert.deepEqual(all.source.comparison.changedAskingPrices,[]);
 assert.deepEqual(all.source.comparison.changedTitles,[]);
 assert.match(all.source.comparison.limits,/does not establish a sale/);
 assert.equal(all.scope.photosIncluded,false);
 assert.equal(all.scope.registeredTransactionEvidence,false);
 assert.equal(all.scope.availability,'publisher_listed_at_capture_unverified_now');
 const seen=new Set();
 for(let offset=0;offset<861;offset+=100){
  const page=await(await mapRgestateCommercial(request(`?limit=100&offset=${offset}`),report,packed)).json();
  for(const row of page.rows){
   assert.ok(row.sourceUrl.startsWith(`https://www.rgestate.com/${row.purpose}/`));
   assert.equal(row.canonicalProjectId,null);assert.equal(row.coordinates,null);
   assert.equal(row.availabilityStatus,'publisher_listed_unverified');
   assert.ok(!('image' in row)&&!('phone' in row));
   seen.add(row.sourceListingId);
  }
 }
 assert.equal(seen.size,861);
 assert.equal((await(await mapRgestateCommercial(request('?purpose=rent&limit=100'),report,packed)).json()).totalRows,450);
 assert.equal((await(await mapRgestateCommercial(request('?purpose=sale&limit=100'),report,packed)).json()).totalRows,411);
});

test('commercial area map aggregates reviewed labels without assigning unit pins',async()=>{
 const areaRequest=(query='')=>new Request('https://espacios.me/map/api/uae-evidence/commercial/areas'+query);
 const all=await(await mapRgestateCommercial(areaRequest(),report,packed)).json();
 assert.equal(all.totalRows,861);
 assert.equal(all.mappedRows,806);
 assert.equal(all.unmappedRows,55);
 assert.equal(all.areas.reduce((sum,area)=>sum+area.count,0),806);
 assert.equal(all.scope.mapGranularity,'publisher_area_label');
 assert.equal(all.scope.unitCoordinatesPresent,false);
 assert.equal(all.scope.areaAttributionUrl,'https://www.openstreetmap.org/copyright');
 assert.equal(all.areas.find(area=>area.key==='umm-al-quwain').count,144);
 assert.equal(all.areas.find(area=>area.key==='al-ain').count,1);
 assert.equal(all.areas.find(area=>area.key==='majan').count,2);
 const byEmirate={
  'Abu Dhabi':9,Ajman:16,Dubai:502,Fujairah:2,
  'Ras Al Khaimah':4,Sharjah:129,'Umm Al Quwain':144,
 };
 for(const [emirate,count] of Object.entries(byEmirate)){
  const query='?emirate='+encodeURIComponent(emirate);
  const filtered=await(await mapRgestateCommercial(areaRequest(query),report,packed)).json();
  assert.equal(filtered.totalRows,count);
  assert.equal(filtered.mappedRows,count);
  assert.equal(filtered.unmappedRows,0);
  assert.ok(filtered.areas.every(area=>area.emirate===emirate));
  const listings=await(await mapRgestateCommercial(request(query+'&limit=100'),report,packed)).json();
  assert.equal(listings.totalRows,count);
  assert.ok(listings.rows.every(row=>row.reviewedAreaEmirate===emirate&&row.coordinates===null));
 }
 assert.equal(Object.values(byEmirate).reduce((sum,count)=>sum+count,0),all.mappedRows);
 for(const area of all.areas){
  assert.match(area.osmUrl,/^https:\/\/www\.openstreetmap\.org\/(relation|node|way)\/\d+$/);
  assert.equal(area.locationBasis,'osm_area_reference_not_unit_coordinate');
  assert.equal(area.rentRows+area.saleRows,area.count);
  assert.ok(area.center[0]>=51.35&&area.center[0]<=56.65&&area.center[1]>=22.45&&area.center[1]<=26.55);
 }
 const rent=await(await mapRgestateCommercial(areaRequest('?purpose=rent'),report,packed)).json();
 const sale=await(await mapRgestateCommercial(areaRequest('?purpose=sale'),report,packed)).json();
 assert.equal(rent.totalRows,450);assert.equal(sale.totalRows,411);
 assert.equal(rent.mappedRows+rent.unmappedRows,450);assert.equal(sale.mappedRows+sale.unmappedRows,411);
 const dip=await(await mapRgestateCommercial(request('?area=dip&limit=100'),report,packed)).json();
 assert.equal(dip.totalRows,61);assert.ok(dip.rows.every(row=>['DIP Dubai Investment Park','DIP','Dubai Investment Park'].includes(row.locationLabel)));
 const alAin=await(await mapRgestateCommercial(request('?area=al-ain'),report,packed)).json();
 assert.equal(alAin.totalRows,1);assert.equal(alAin.rows[0].locationLabel,'Al Ain');assert.equal(alAin.rows[0].coordinates,null);
 const ambiguous=await(await mapRgestateCommercial(areaRequest('?q=Al%20Layan'),report,packed)).json();
 assert.equal(ambiguous.mappedRows,0);assert.ok(ambiguous.unmappedRows>0);
 assert.equal((await mapRgestateCommercial(request('?area=unknown'),report,packed)).status,400);
 assert.equal((await mapRgestateCommercial(request('?emirate=Unknown'),report,packed)).status,400);
});

test('commercial asking rates are derived only from usable publisher prices and areas',async()=>{
 const page=await(await mapRgestateCommercial(request('?limit=100'),report,packed)).json();
 assert.match(page.scope.askingRateBasis,/not a registered transaction/);
 assert.equal(page.scope.askingRateEligibleSnapshotRows,729);
 const warehouse=page.rows.find(row=>row.sourceListingId==='60770');
 assert.equal(warehouse.askingAedPerSqft,55);
 assert.equal(warehouse.askingRatePeriod,'year');
 for(let offset=0;offset<report.rows;offset+=100){
  const data=await(await mapRgestateCommercial(request(`?limit=100&offset=${offset}`),report,packed)).json();
  for(const row of data.rows){
   const valid=Number.isFinite(row.priceAed)&&row.priceAed>0&&Number.isFinite(row.areaSqft)&&row.areaSqft>0&&['year','total'].includes(row.pricePeriod);
   assert.equal(row.askingAedPerSqft,valid?Math.round(row.priceAed/row.areaSqft*100)/100:null);
   assert.equal(row.askingRatePeriod,valid?row.pricePeriod:null);
  }
 }
});

test('137 title-matched spaces add publisher data without becoming category rows or unit pins',async()=>{
 const all=await(await combined('?limit=100')).json();
 assert.equal(all.scope.totalSnapshotRows,998);
 assert.equal(all.scope.publisherCategoryRows,861);
 assert.equal(all.scope.titleCandidateRows,137);
 assert.equal(all.source.supplement.parentRawSha256,parentReport.rawSha256);
 assert.equal((await(await combined('?scope=category')).json()).totalRows,861);
 const candidate=await(await combined('?scope=title-candidates&limit=100')).json();
 assert.equal(candidate.totalRows,137);
 assert.ok(candidate.rows.every(row=>row.sourceCategory==='title_matched_candidate'&&row.coordinates===null&&row.canonicalProjectId===null));
 assert.ok(candidate.rows.some(row=>row.sourceListingId==='60594'));
 assert.equal((await(await combined('?scope=title-candidates&purpose=rent')).json()).totalRows,candidateReport.rentRows);
 assert.equal((await(await combined('?scope=title-candidates&purpose=sale')).json()).totalRows,candidateReport.saleRows);
 const areas=await(await mapRgestateCommercial(new Request('https://espacios.me/map/api/uae-evidence/commercial/areas'),report,packed,candidateReport,candidatePacked,parentReport)).json();
 assert.equal(areas.totalRows,998);
 assert.equal(areas.mappedRows,936);
 assert.equal(areas.unmappedRows,62);
 assert.equal(areas.areas.reduce((sum,area)=>sum+area.count,0),areas.mappedRows);
 assert.equal(areas.scope.unitCoordinatesPresent,false);
 for(const [key,label] of [['meydan','Meydan'],['jumeirah-lake-towers','Jumeirah Lake Tower'],['al-warqa','Al Warqa'],['al-karama','Al Karama']]){
  const area=areas.areas.find(item=>item.key===key);
  assert.ok(area&&area.count>0,key);
  const rows=await(await combined('?area='+key+'&limit=100')).json();
  assert.ok(rows.rows.some(row=>row.locationLabel===label),key);
  assert.ok(rows.rows.every(row=>row.coordinates===null&&row.reviewedAreaEmirate==='Dubai'));
 }
 for(const [key,label] of [['jvc','Jumeirah Village Circle'],['dip','DIP 1'],['dubai-islands','Dubai Island'],['dubai-internet-city','Dubai Internet City'],['jumeirah','Jumeirah']]){
  const rows=await(await combined('?area='+key+'&limit=100')).json();
  assert.ok(rows.rows.some(row=>row.locationLabel===label),key);
  assert.ok(rows.rows.every(row=>row.coordinates===null&&row.reviewedAreaEmirate==='Dubai'));
 }
});

test('commercial routes reject bad input and tampered bytes',async()=>{
 for(const query of ['?purpose=forecast','?limit=0','?offset=-1','?q='+encodeURIComponent('x'.repeat(121))])assert.equal((await mapRgestateCommercial(request(query),report,packed)).status,400);
 assert.equal((await mapRgestateCommercial(request('','POST'),report,packed)).status,405);
 assert.equal((await mapRgestateCommercial(request(),{...report,rawSha256:'0'.repeat(64)},packed)).status,503);
 const page=mapRgestateCommercialPage(new Request('https://espacios.me/map/commercial'));
 assert.equal(page.status,200);
 const html=await page.text();assert.match(html,/Historical evidence/);assert.match(html,/No listing photos/);assert.doesNotMatch(html,/<img\b/);
 assert.match(html,/The current capture date appears with the results/);
 assert.doesNotMatch(html,/observed on 3 November 2026/);
 assert.match(html,/id="history-cards"/);
 assert.match(html,/ajman\/commercial-sales/);
 assert.match(html,/city=ajman&category=Commercial/);
 assert.match(html,/sharjah\/market-aggregates/);
 assert.match(html,/ras-al-khaimah\/monthly-market\?month=2026-09/);
 assert.match(html,/umm-al-quwain\/industrial-plot-guide\?plotType=commercial/);
 assert.match(html,/The source table does not state the rate period/);
 assert.match(html,/This is not commercial-only activity or available space/);
 assert.match(html,/Includes H1; periods must not be added/);
 assert.match(html,/No rent amounts or comparable asking prices/);
 const inlineScripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match=>match[1]);
 assert.ok(inlineScripts.length>=2);for(const script of inlineScripts)assert.doesNotThrow(()=>new Function(script));
 assert.match(html,/id="commercial-map"/);assert.match(html,/publisher location labels/i);assert.match(html,/not property, building, or available-unit pins|do not mark the actual unit/);
 assert.match(html,/id="asking-map"[^>]*aria-pressed="true"/);
 assert.match(html,/id="sales-map"[^>]*aria-pressed="false"/);
 assert.match(html,/id="sales-2026-map"[^>]*aria-pressed="false"/);
 assert.match(html,/commercial-unit-sales-2026-subtype\?view=map/);
 assert.match(html,/id="ajman-sales-map"[^>]*aria-pressed="false"/);
 assert.match(html,/id="ajman-area-attribution" hidden/);
 assert.match(html,/data\.ajman\.ae\/explore\/dataset\/ajman-area\//);
 assert.match(html,/commercial-unit-sales\?view=map&year=2025/);
 assert.match(html,/ajman\/commercial-sales\?view=map&year=2025/);
 assert.match(html,/Inspect all 2025 DLD areas/);
 assert.match(html,/role="region" aria-label="Interactive map/);
 assert.match(html,/id="emirate"/);assert.match(html,/Asking rate/);
 assert.match(html,/id="source-scope"/);
 assert.match(html,/publisher listings/);
 assert.match(html,/https:\/\/www\.openstreetmap\.org\/copyright/);
 assert.match(html,/\[hidden\]\{display:none!important\}/);
});

test('compiled Worker serves commercial API and page with restricted raw path',async()=>{
 const env={DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'rge-test'}};
 const result=await worker.fetch(request('?q=Jebel%20Ali&purpose=rent'),env,{}),body=await result.json();
 assert.equal(result.status,200);assert.ok(body.totalRows>0);
 const areaResponse=await worker.fetch(new Request('https://espacios.me/map/api/uae-evidence/commercial/areas'),env,{});
 const areas=await areaResponse.json();
 assert.equal(areaResponse.status,200);assert.equal(areas.mappedRows+areas.unmappedRows,998);
 assert.equal(result.headers.get('x-espacios-map-release'),'20261111-map-stack-v66');
 const commercialPage=await worker.fetch(new Request('https://espacios.me/map/commercial'),env,{});
 assert.equal(commercialPage.status,200);
 assert.match(await commercialPage.text(),/The source table does not state the rate period/);
 const mapHtml=await(await worker.fetch(new Request('https://espacios.me/map'),env,{})).text();
 assert.match(mapHtml,/a\.href="\/map\/commercial"/);
 assert.equal((await worker.fetch(new Request('https://espacios.me/map/commercial-listings-20261111.json.gz'),env,{})).status,404);
});
