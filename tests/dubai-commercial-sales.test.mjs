import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {mapDubaiCommercialSales} from '../src/stack-audit/dubai-commercial-sales.mjs';
import {RGE_AREA_CENTRES} from '../src/stack-audit/rgestate-commercial.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url);
const report=JSON.parse(await fs.readFile(new URL('data/uae-evidence/dubai/commercial-unit-sales-validation.json',root)));
const packed=await fs.readFile(new URL('data/uae-evidence/dubai/commercial-unit-sales-20261110.json.gz',root));
const base64=packed.toString('base64');
const partialReport=JSON.parse(await fs.readFile(new URL('data/uae-evidence/dubai/commercial-unit-sales-2026-partial-validation.json',root)));
const partialPacked=await fs.readFile(new URL('data/uae-evidence/dubai/commercial-unit-sales-2026-partial-20261110.json.gz',root));
const partialBase64=partialPacked.toString('base64');
const subtypeReport=JSON.parse(await fs.readFile(new URL('data/uae-evidence/dubai/commercial-unit-sales-2026-subtype-validation.json',root)));
const subtypePacked=await fs.readFile(new URL('data/uae-evidence/dubai/commercial-unit-sales-2026-subtype-20261111.json.gz',root));
const subtypeBase64=subtypePacked.toString('base64');
const request=(query='',method='GET')=>new Request(`https://espacios.me/map/api/uae-evidence/dubai/commercial-unit-sales${query}`,{method});
const partialRequest=(query='',method='GET')=>new Request(`https://espacios.me/map/api/uae-evidence/dubai/commercial-unit-sales-2026-partial${query}`,{method});
const subtypeRequest=(query='',method='GET')=>new Request(`https://espacios.me/map/api/uae-evidence/dubai/commercial-unit-sales-2026-subtype${query}`,{method});

test('commercial unit sale subset keeps exact source rows and quality flags',()=>{
 assert.equal(packed.length,report.compressedBytes);
 assert.equal(createHash('sha256').update(packed).digest('hex'),report.compressedSha256);
 const raw=gunzipSync(packed);
 assert.equal(createHash('sha256').update(raw).digest('hex'),report.rawSha256);
 const rows=JSON.parse(raw).rows;
 assert.equal(rows.length,66366);
 assert.equal(new Set(rows.map(row=>row[0])).size,66366);
 assert.equal(rows.filter(row=>row[10]===0).length,64151);
 assert.ok(rows.every(row=>row[1]<'2026-01-01'&&['Office','Shop'].includes(row[6])));
});

test('API separates registered 2025 sales from current asking listings',async()=>{
 const response=await mapDubaiCommercialSales(request('?year=2025'),report,base64);
 const body=await response.json();
 assert.equal(response.status,200);
 assert.equal(response.headers.get('x-espacios-evidence-source'),report.sourceId);
 assert.equal(body.scope.evidenceClass,'registered_commercial_unit_sales');
 assert.equal(body.registeredSaleRecords,6092);
 assert.equal(body.officeRecords,4564);
 assert.equal(body.shopRecords,1528);
 assert.equal(body.readyRecords,3920);
 assert.equal(body.offPlanRecords,2172);
 assert.ok(body.cleanPriceRecords<body.registeredSaleRecords);
 assert.match(body.scope.limits,/2026 is withheld/);
});

test('API pages records, groups DLD areas, and refuses incomplete 2026',async()=>{
 const records=await(await mapDubaiCommercialSales(request('?view=records&year=2025&type=Office&limit=2'),report,base64)).json();
 assert.equal(records.totalRecords,4564);
 assert.equal(records.records.length,2);
 assert.ok(records.records.every(row=>row.spaceType==='Office'&&row.date.startsWith('2025')));
 const areas=await(await mapDubaiCommercialSales(request('?view=areas&year=2025'),report,base64)).json();
 assert.ok(areas.totalAreas>0);
 assert.equal(areas.areas.reduce((sum,row)=>sum+row.registeredSaleRecords,0),6092);
 assert.equal((await mapDubaiCommercialSales(request('?year=2026'),report,base64)).status,400);
 assert.equal((await mapDubaiCommercialSales(request('','POST'),report,base64)).status,405);
 assert.equal((await mapDubaiCommercialSales(request('','HEAD'),report,base64)).status,200);
});

test('2025 registered sales map uses only four reviewed area references',async()=>{
 const url=request('?view=map&year=2025');
 const response=await mapDubaiCommercialSales(url,report,base64,null,null,RGE_AREA_CENTRES);
 const body=await response.json();
 assert.equal(response.status,200);
 assert.equal(body.totalSaleRecords,6092);
 assert.equal(body.scope.mappedSaleRecords,1288);
 assert.equal(body.scope.unmappedSaleRecords,4804);
 assert.deepEqual(body.mappedAreas.map(area=>[area.areaName,area.registeredSaleRecords]),[['Business Bay',1167],['Al Jadaf',112],['Al Wasl',1],['Mirdif',8]]);
 assert.ok(body.mappedAreas.every(area=>area.locationBasis==='reviewed_osm_area_reference_not_cadastral_centroid_or_unit_coordinate'&&area.osmUrl.startsWith('https://www.openstreetmap.org/')));
 assert.match(body.scope.mapLimits,/not DLD boundary centroids/);
 assert.equal((await mapDubaiCommercialSales(url,report,base64)).status,503);
 const live=await worker.fetch(url,{DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'commercial-map-test'}},{});
 assert.equal(live.status,200);
 assert.equal((await live.json()).scope.mappedSaleRecords,1288);
});

test('compiled Worker serves the new data without an R2 binding',async()=>{
 const response=await worker.fetch(request('?year=2025'),{DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'commercial-test'}},{});
 const body=await response.json();
 assert.equal(response.status,200);
 assert.equal(response.headers.get('x-espacios-map-release'),'20261111-map-stack-v63');
 assert.equal(body.registeredSaleRecords,6092);
 assert.equal(body.source.licenseUrl,'https://creativecommons.org/licenses/by/4.0/');
});

test('2026 commercial sales remain a separate, explicitly partial source',async()=>{
 assert.equal(partialPacked.length,partialReport.compressedBytes);
 assert.equal(partialReport.other2026SalesAfterCommercialCutoff,113302);
 assert.equal(partialReport.latestOther2026SaleDate,'2026-11-02');
 assert.equal(createHash('sha256').update(partialPacked).digest('hex'),partialReport.compressedSha256);
 assert.equal(createHash('sha256').update(gunzipSync(partialPacked)).digest('hex'),partialReport.rawSha256);
 const response=await mapDubaiCommercialSales(partialRequest('?view=summary&year=2026'),report,base64,partialReport,partialBase64);
 const body=await response.json();
 assert.equal(response.status,200);
 assert.equal(body.scope.periodStatus,'partial_source_classification_stops_2026-02-09');
 assert.deepEqual(body.scope.dateRange,['2026-01-01','2026-02-09']);
 assert.equal(body.registeredSaleRecords,1133);
 assert.equal(body.officeRecords,889);
 assert.equal(body.shopRecords,244);
 assert.equal(body.cleanPriceRecords,1077);
 assert.match(body.scope.limits,/Do not annualize/);
 const records=await(await mapDubaiCommercialSales(partialRequest('?view=records&type=Shop&limit=2'),report,base64,partialReport,partialBase64)).json();
 assert.equal(records.totalRecords,244);
 assert.ok(records.records.every(row=>row.spaceType==='Shop'&&row.date.startsWith('2026')));
 assert.equal((await mapDubaiCommercialSales(partialRequest('?year=2025'),report,base64,partialReport,partialBase64)).status,400);
 const live=await worker.fetch(partialRequest(),{DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'commercial-partial-test'}},{});
 assert.equal(live.status,200);
 assert.equal((await live.json()).registeredSaleRecords,1133);
});

test('2026 subtype source preserves usage conflicts and maps only reviewed area references',async()=>{
 assert.equal(createHash('sha256').update(subtypePacked).digest('hex'),subtypeReport.compressedSha256);
 const snapshot=JSON.parse(gunzipSync(subtypePacked));
 assert.equal(snapshot.rows.length,5452);
 assert.equal(snapshot.rows.filter(row=>row[11]==='Residential').length,4319);
 assert.equal(snapshot.rows.filter(row=>row[11]==='Commercial').length,1133);
 assert.equal(snapshot.rows.filter(row=>row[10]===0).length,4982);
 const args=[report,base64,partialReport,partialBase64,RGE_AREA_CENTRES,subtypeReport,subtypeBase64];
 const summary=await (await mapDubaiCommercialSales(subtypeRequest('?year=2026'),...args)).json();
 assert.equal(summary.scope.evidenceClass,'registered_office_shop_subtype_sales_with_usage_conflict');
 assert.equal(summary.scope.periodStatus,'partial_2026_subtype_based_usage_label_conflict');
 assert.equal(summary.registeredSaleRecords,5452);
 assert.equal(summary.conflictingResidentialUsageRecords,4319);
 assert.match(summary.scope.limits,/source verification/i);
 const mapped=await (await mapDubaiCommercialSales(subtypeRequest('?view=map&year=2026'),...args)).json();
 assert.equal(mapped.scope.mappedSaleRecords+mapped.scope.unmappedSaleRecords,5452);
 assert.ok(mapped.mappedAreas.length>0&&mapped.mappedAreas.length<=4);
 assert.ok(mapped.mappedAreas.every(area=>area.locationBasis==='reviewed_osm_area_reference_not_cadastral_centroid_or_unit_coordinate'));
 const records=await (await mapDubaiCommercialSales(subtypeRequest('?view=records&limit=2'),...args)).json();
 assert.ok(records.records.every(row=>['Commercial','Residential'].includes(row.usageLabel)));
 assert.equal((await mapDubaiCommercialSales(subtypeRequest('?year=2025'),...args)).status,400);
 const live=await worker.fetch(subtypeRequest('?view=map&year=2026'),{DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'subtype-test'}},{});
 assert.equal(live.status,200);
 assert.equal((await live.json()).totalSaleRecords,5452);
});
