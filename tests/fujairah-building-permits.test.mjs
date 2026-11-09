import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {mapFujairahBuildingPermits} from '../src/stack-audit/fujairah-building-permits.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url);
const bytes=await fs.readFile(new URL('data/uae-evidence/fujairah/building-permits-20261109.json',root));
const data=JSON.parse(bytes),report=JSON.parse(await fs.readFile(new URL('data/uae-evidence/fujairah/building-permits-validation.json',root)));
const request=(query='',method='GET')=>new Request(`https://espacios.me/map/api/uae-evidence/fujairah/building-permits${query}`,{method});

test('selected official permit figures reconcile at each native grain',()=>{
 assert.equal(bytes.length,report.dataBytes);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),report.dataSha256);
 assert.deepEqual(data.annual.map(row=>row.year),[2022,2023,2024,2025]);
 for(const row of data.annual){
  for(const municipality of [row.fujairahMunicipality,row.dibbaMunicipality])assert.equal(municipality.newAndRenew+municipality.annexes+municipality.maintenance+municipality.temporary+municipality.other,municipality.total);
  assert.equal(row.fujairahMunicipality.total+row.dibbaMunicipality.total,row.emirateTotal);
 }
 for(const row of data.buildingUse2024)assert.equal(row.fujairahMunicipality+row.dibbaMunicipality,row.emirateTotal);
 assert.deepEqual(data.buildingUse2024.map(row=>[row.use,row.emirateTotal]),[['commercial_buildings',112],['residential_and_commercial_buildings',95],['industrial_buildings',116]]);
 for(const row of data.buildingUse2025)assert.equal(row.fujairahMunicipality+row.dibbaMunicipality,row.emirateTotal);
 assert.deepEqual(data.buildingUse2025.map(row=>[row.use,row.emirateTotal]),[['commercial_buildings',112],['residential_and_commercial_buildings',105],['industrial_buildings',136]]);
 assert.equal(data.annual.at(-1).emirateTotal,2806);
 assert.equal(report.capturePdf.sha256.length,64);
 assert.equal(report.priorCapturePdf.sha256.length,64);
});

test('read-only API labels permits apart from spaces and transactions',async()=>{
 const response=mapFujairahBuildingPermits(request(),report,data),body=await response.json();
 assert.equal(response.status,200);
 assert.equal(body.scope.unit,'issued permits');
 assert.equal(body.scope.projectRegister,false);
 assert.equal(body.scope.transactions,false);
 assert.equal(body.scope.listingAvailability,false);
 assert.equal(body.scope.projectCoordinates,false);
 assert.equal(body.annual.length,4);
 assert.equal((await mapFujairahBuildingPermits(request('?year=2024'),report,data).json()).buildingUse2024[0].emirateTotal,112);
 assert.equal((await mapFujairahBuildingPermits(request('?year=2023'),report,data).json()).buildingUse2024,null);
 assert.equal((await mapFujairahBuildingPermits(request('?year=2025'),report,data).json()).buildingUse2025[0].emirateTotal,112);
 assert.equal((await mapFujairahBuildingPermits(request('?year=2024'),report,data).json()).buildingUse2025,null);
 assert.equal(mapFujairahBuildingPermits(request('?year=2026'),report,data).status,400);
 assert.equal(mapFujairahBuildingPermits(request('','POST'),report,data).status,405);
 assert.equal(mapFujairahBuildingPermits(request('','HEAD'),report,data).body,null);
});

test('compiled Worker serves the Fujairah source',async()=>{
 const response=await worker.fetch(request(),{DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'fujairah-test'}},{}),body=await response.json();
 assert.equal(response.status,200);
 assert.equal(response.headers.get('x-espacios-evidence-source'),report.sourceId);
 assert.equal(body.annual[2].emirateTotal,2779);
 assert.equal(body.annual[3].emirateTotal,2806);
});
