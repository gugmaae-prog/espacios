import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {mapFujairahMonthlyPermits} from '../src/stack-audit/fujairah-monthly-permits.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url);
const bytes=await fs.readFile(new URL('data/uae-evidence/fujairah/building-permits-monthly-20261114.json',root));
const data=JSON.parse(bytes),report=JSON.parse(await fs.readFile(new URL('data/uae-evidence/fujairah/building-permits-monthly-validation.json',root)));
const annual=JSON.parse(await fs.readFile(new URL('data/uae-evidence/fujairah/building-permits-20261110.json',root)));
const request=(query='',method='GET')=>new Request('https://espacios.me/map/api/uae-evidence/fujairah/building-permits-monthly'+query,{method});

test('72 official monthly counts reconcile by month, permit type, municipality and year',()=>{
 assert.equal(bytes.length,report.dataBytes);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),report.dataSha256);
 assert.deepEqual(report.years,[2023,2024,2025]);
 assert.equal(data.rows.length,72);
 for(const year of report.years){
  for(const municipality of report.municipalities){
   const rows=data.rows.filter(row=>row.month.startsWith(year+'-')&&row.municipality===municipality);
   const annualRow=annual.annual.find(row=>row.year===year)[municipality==='Fujairah'?'fujairahMunicipality':'dibbaMunicipality'];
   assert.deepEqual(rows.map(row=>row.month),Array.from({length:12},(_,i)=>`${year}-${String(i+1).padStart(2,'0')}`));
   for(const field of ['newAndRenew','total'])assert.equal(rows.reduce((sum,row)=>sum+row[field],0),annualRow[field]);
   for(const row of rows){assert.ok(row.newAndRenew<=row.total);assert.deepEqual(Object.keys(row).sort(),['month','municipality','newAndRenew','total']);}
  }
 }
 assert.deepEqual(data.rows.filter(row=>row.month==='2025-07').map(row=>[row.municipality,row.total]),[['Fujairah',226],['Dibba',59]]);
});

test('monthly endpoint keeps permit evidence separate from available spaces',async()=>{
 const response=mapFujairahMonthlyPermits(request('?year=2025&municipality=Dibba&month=2025-07'),report,data),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.totalRows,1);
 assert.equal(body.rows[0].newAndRenew,34);assert.equal(body.rows[0].total,59);
 assert.equal(body.scope.commercialUseAtMonthlyGrain,false);
 assert.equal(body.scope.completedBuildings,false);assert.equal(body.scope.availableUnits,false);assert.equal(body.scope.registeredTransactions,false);
 assert.equal(body.source.storage,'checksum_verified_immutable_worker_snapshot');
 for(const query of ['?year=2026','?month=2024-13','?municipality=Dubai','?year=2023&month=2025-01'])assert.equal(mapFujairahMonthlyPermits(request(query),report,data).status,400);
 assert.equal(mapFujairahMonthlyPermits(request('','POST'),report,data).status,405);
 assert.equal(mapFujairahMonthlyPermits(request('','HEAD'),report,data).body,null);
});

test('compiled Worker exposes the monthly source',async()=>{
 const response=await worker.fetch(request('?month=2024-01'),{DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'fujairah-monthly-test'}},{}),body=await response.json();
 assert.equal(response.status,200);assert.equal(response.headers.get('x-espacios-evidence-source'),report.sourceId);
 assert.equal(body.totalRows,2);
 assert.deepEqual(body.rows.map(row=>row.total),[171,72]);
 assert.equal(body.source.idriveReplica.attestationId,'fujairah-monthly-20261114-idrive-e2-readback');
});
