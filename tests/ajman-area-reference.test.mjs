import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {mapAjmanAreaReference} from '../src/stack-audit/ajman-area-reference.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url);
const report=JSON.parse(await fs.readFile(new URL('data/uae-evidence/ajman/area-reference-validation.json',root)));
const packed=(await fs.readFile(new URL('data/uae-evidence/ajman/area-reference-20231003.json.gz',root))).toString('base64');
const request=(query='',method='GET')=>new Request('https://espacios.me/map/api/uae-evidence/ajman/areas'+query,{method});

test('area-reference source fails closed on mismatched bytes and rejects writes',async()=>{
 assert.equal((await mapAjmanAreaReference(request(),{...report,rawSha256:'0'.repeat(64)},packed)).status,503);
 assert.equal((await mapAjmanAreaReference(request(),report,packed.slice(1))).status,503);
 assert.equal((await mapAjmanAreaReference(request('','POST'),report,packed)).status,405);
 assert.equal(await mapAjmanAreaReference(new Request('https://espacios.me/map/api/system'),report,packed),null);
});

test('dated official area points remain distinct from project coordinates',async()=>{
 const response=await mapAjmanAreaReference(request(),report,packed),body=await response.json();
 assert.equal(response.status,200);assert.equal(response.headers.get('x-espacios-evidence-source'),report.sourceId);
 assert.equal(body.source.rows,20);assert.equal(body.source.licence,'CC BY 4.0');assert.equal(body.source.sourceModifiedAt,'2023-10-03T09:39:18+00:00');
 assert.equal(body.scope.canonicalProjectMatches,0);assert.equal(body.scope.projectCoordinatesPresent,false);assert.equal(body.totalRows,20);
 assert.ok(body.rows.every(row=>row.locationKind==='area_reference_point'&&row.projectId===null&&Number.isFinite(row.referencePoint.latitude)&&Number.isFinite(row.referencePoint.longitude)));
 const selected=await (await mapAjmanAreaReference(request('?q=AL%20RASHIDEYA%201'),report,packed)).json();
 assert.equal(selected.totalRows,1);assert.equal(selected.rows[0].areaName,'AL RASHIDEYA 1');
 for(const query of ['?limit=0','?offset=-1','?q='+encodeURIComponent('x'.repeat(121))])assert.equal((await mapAjmanAreaReference(request(query),report,packed)).status,400);
 const head=await mapAjmanAreaReference(request('','HEAD'),report,packed);assert.equal(head.status,200);assert.equal(await head.text(),'');
});

test('compiled Worker serves the area source without making its raw bytes public',async()=>{
 const env={DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'ajman-area-test'}};
 const response=await worker.fetch(request('?q=YASMEEN'),env,{}),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.totalRows,1);assert.equal(body.rows[0].areaName,'YASMEEN');
 assert.equal(body.source.storage,'checksum_verified_immutable_worker_snapshot');
 assert.equal(response.headers.get('x-espacios-map-release'),'20261110-map-stack-v54');
 const raw=await worker.fetch(new Request('https://espacios.me/map/area-reference-20231003.json.gz'),env,{});
 assert.equal(raw.status,404);
});
