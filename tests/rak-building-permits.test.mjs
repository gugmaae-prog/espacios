import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {mapRakBuildingPermits} from '../src/stack-audit/rak-building-permits.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url);
const bytes=await fs.readFile(new URL('data/uae-evidence/ras-al-khaimah/building-permits-20261109.json',root));
const data=JSON.parse(bytes),report=JSON.parse(await fs.readFile(new URL('data/uae-evidence/ras-al-khaimah/building-permits-validation.json',root)));
const request=(query='',method='GET')=>new Request(`https://espacios.me/map/api/uae-evidence/ras-al-khaimah/building-permits${query}`,{method});

test('official RAK annual permit totals retain their source grain',()=>{
 assert.equal(createHash('sha256').update(bytes).digest('hex'),report.dataSha256);
 assert.equal(bytes.length,report.dataBytes);
 assert.deepEqual(data.annual.map(row=>row.year),[2017,2018,2019,2020,2021,2022,2023,2024,2025]);
 assert.deepEqual(data.annual.map(row=>row.issuedPermits),[9561,10071,8909,6789,6561,5756,6258,5830,6315]);
 assert.equal(1595+1396+1319+2005,data.annual.at(-1).issuedPermits);
 assert.equal(report.capturePage.sha256,'9367cd9259e11cbdaaed9a3a1e9cec2510cb9d7a9a2591b361506b1313eed1d9');
});

test('read-only API does not describe permits as buildings or listings',async()=>{
 const response=mapRakBuildingPermits(request(),report,data),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.scope.unit,'issued permits');
 assert.equal(body.scope.projectRegister,false);assert.equal(body.scope.transactions,false);
 assert.equal(body.scope.listingAvailability,false);assert.equal(body.scope.projectCoordinates,false);
 assert.equal(body.annual.length,9);
 assert.deepEqual((await mapRakBuildingPermits(request('?year=2025'),report,data).json()).annual,[{year:2025,issuedPermits:6315}]);
 assert.equal(mapRakBuildingPermits(request('?year=2026'),report,data).status,400);
 assert.equal(mapRakBuildingPermits(request('','POST'),report,data).status,405);
 assert.equal(mapRakBuildingPermits(request('','HEAD'),report,data).body,null);
});

test('compiled Worker serves the RAK permit series',async()=>{
 const response=await worker.fetch(request(),{DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'rak-permits-test'}},{}),body=await response.json();
 assert.equal(response.status,200);
 assert.equal(response.headers.get('x-espacios-evidence-source'),report.sourceId);
 assert.equal(body.annual.at(-1).issuedPermits,6315);
});
