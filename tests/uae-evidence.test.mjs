import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import { mapUaeEvidence } from '../src/stack-audit/uae-evidence.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url);
const report=JSON.parse(await fs.readFile(new URL('data/uae-evidence/ajman/validation.json',root),'utf8'));
const compressed=await fs.readFile(new URL('data/uae-evidence/ajman/real-estate-units-sales-20260821.json.gz',root));
const request=(suffix='',method='GET')=>new Request('https://espacios.me/map/api/uae-evidence'+suffix,{method});
const env={MAP_IDRIVE_READY:'true',MAP_EVIDENCE:{}};
const store=()=>({get:async key=>key===report.storageKey?{sha256:report.compressedSha256,size:compressed.length,arrayBuffer:async()=>compressed.buffer.slice(compressed.byteOffset,compressed.byteOffset+compressed.byteLength)}:null});
const areaReport=JSON.parse(await fs.readFile(new URL('data/uae-evidence/ajman/area-reference-validation.json',root),'utf8'));
const areaPacked=await fs.readFile(new URL('data/uae-evidence/ajman/area-reference-20231003.json.gz',root));
const areaRows=JSON.parse(gunzipSync(areaPacked));
const areas=async()=>({report:areaReport,rows:areaRows});

test('Ajman API fails closed when the private source is unavailable',async()=>{
 const response=await mapUaeEvidence(request(),{...env,MAP_EVIDENCE:null},report,store);
 assert.equal(response.status,503);
 assert.equal((await response.json()).sources,undefined);
});

test('Ajman API verifies exact source bytes and reports licensed aggregate grain',async()=>{
 const response=await mapUaeEvidence(request(),env,report,store);
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.sources[0].rows,6075);
 assert.equal(body.sources[0].licence,'CC BY 4.0');
 assert.equal(body.scope.canonicalProjectMatches,0);
 assert.match(body.scope.limits,/not individual transactions/);
 const disabled=await mapUaeEvidence(request(),{...env,MAP_IDRIVE_READY:'false'},report,store);
 assert.equal(disabled.status,503,'cached data must not bypass a disabled private binding');
});

test('project summary and filtered rows preserve source project labels without joins',async()=>{
 const groups=await (await mapUaeEvidence(request('/ajman/projects'),env,report,store)).json();
 assert.equal(groups.count,239);
 const sales=await (await mapUaeEvidence(request('/ajman/sales?year=2026&quarter=2&project=AJMAN%20ONE%20%20T11&limit=25'),env,report,store)).json();
 assert.ok(sales.totalRows>0);
 assert.ok(sales.rows.every(row=>row.project_name_english==='AJMAN ONE  T11'&&row.year===2026&&row.quarter===2&&row.canonicalProjectId===null&&row.matchStatus==='unmatched'));
});

test('commercial sales expose only verified office and shop aggregates without availability claims',async()=>{
 const response=await mapUaeEvidence(request('/ajman/commercial-sales?limit=100'),env,report,store);
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.source.rawSha256,report.rawSha256);
 assert.equal(body.scope.evidenceClass,'official_commercial_unit_sale_aggregate');
 assert.match(body.scope.limits,/no active listing/);
 assert.equal(body.totalRows,89);
 assert.equal(body.reportedSalesCountSum,346);
 assert.equal(body.reportedValueAedSum,121329157);
 assert.equal(body.distinctSourceProjectLabels,22);
 assert.ok(body.rows.every(row=>['Office','Shop'].includes(row.unit_type_english)&&row.canonicalProjectId===null&&row.matchStatus==='unmatched'));
 const office=await (await mapUaeEvidence(request('/ajman/commercial-sales?unitType=Office'),env,report,store)).json();
 const shop=await (await mapUaeEvidence(request('/ajman/commercial-sales?unitType=Shop'),env,report,store)).json();
 assert.equal(office.totalRows,64);
 assert.equal(shop.totalRows,25);
 assert.equal(office.reportedSalesCountSum,315);
 assert.equal(shop.reportedSalesCountSum,31);
});

test('Ajman map represents only reviewed bilingual district joins and preserves unmapped sales',async()=>{
 assert.equal(createHash('sha256').update(areaPacked).digest('hex'),areaReport.compressedSha256);
 assert.equal(createHash('sha256').update(gunzipSync(areaPacked)).digest('hex'),areaReport.rawSha256);
 const url=request('/ajman/commercial-sales?view=map&year=2025');
 const response=await mapUaeEvidence(url,env,report,store,areas);
 const body=await response.json();
 assert.equal(response.status,200);
 assert.equal(body.totalRows,12);
 assert.equal(body.reportedSalesCountSum,80);
 assert.deepEqual(body.mappedAreas.map(area=>[area.areaName,area.aggregateRows,area.reportedSalesCountSum]),[['Rashideya 1',5,35],['Rashideya 2',4,42]]);
 assert.equal(body.scope.mappedAggregateRows,9);
 assert.equal(body.scope.unmappedAggregateRows,3);
 assert.equal(body.scope.mappedReportedSales,77);
 assert.equal(body.scope.unmappedReportedSales,3);
 assert.ok(body.mappedAreas.every(area=>area.locationBasis==='dated_official_area_reference_not_project_or_unit_coordinate'));
 assert.match(body.scope.mapLimits,/not verified district centroids/);
 const all=await (await mapUaeEvidence(request('/ajman/commercial-sales?view=map'),env,report,store,areas)).json();
 assert.equal(all.totalRows,89);
 assert.equal(all.scope.mappedReportedSales,302);
 assert.equal(all.scope.unmappedReportedSales,44);
 assert.equal((await mapUaeEvidence(url,env,report,store)).status,503);
 assert.equal((await mapUaeEvidence(request('/ajman/commercial-sales?view=map&year=2025&limit=10'),env,report,store,areas)).status,400);
});

test('compiled Worker serves the Ajman area map through the private evidence binding',async()=>{
 const binding={fetch:async request=>{
  if(new URL(request.url).searchParams.get('key')!==report.storageKey)return new Response('Missing',{status:404});
  return new Response(request.method==='HEAD'?null:compressed,{headers:{'content-type':'application/octet-stream','content-length':String(compressed.length),etag:'"'+report.compressedSha256+'"','x-evidence-sha256':report.compressedSha256}});
 }};
 const live=await worker.fetch(request('/ajman/commercial-sales?view=map&year=2025'),{MAP_IDRIVE_READY:'true',MAP_IDRIVE_VERIFIED_MANIFEST_SHA256:'7b3d9aa40cc8df795f6036f98f5a8c97d99e1d3ec26def3b9fa75b477c6fc642',MAP_IDRIVE_VERIFIED_AT:'2026-11-02T08:57:41.734Z',MAP_EVIDENCE:binding,DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'ajman-map-test'}},{});
 assert.equal(live.status,200);
 assert.equal(live.headers.get('x-espacios-map-release'),'20261111-map-stack-v66');
 const body=await live.json();
 assert.equal(body.scope.mappedReportedSales,77);
 assert.equal(body.scope.unmappedReportedSales,3);
 assert.equal(body.areaSource.rawSha256,areaReport.rawSha256);
});

test('invalid filters and write methods cannot expose source rows',async()=>{
 assert.equal((await mapUaeEvidence(request('/ajman/sales?limit=101'),env,report,store)).status,400);
 assert.equal((await mapUaeEvidence(request('/ajman/sales?year=2027'),env,report,store)).status,400);
 assert.equal((await mapUaeEvidence(request('/ajman/sales','POST'),env,report,store)).status,405);
 assert.equal((await mapUaeEvidence(request('/ajman/commercial-sales?unitType=Apartment'),env,report,store)).status,400);
 assert.equal((await mapUaeEvidence(request('/ajman/commercial-sales','POST'),env,report,store)).status,405);
 assert.equal(await mapUaeEvidence(new Request('https://espacios.me/map/api/system'),env,report,store),null);
});
