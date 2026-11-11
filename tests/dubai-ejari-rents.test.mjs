import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {mapDubaiEjariRents} from '../src/stack-audit/dubai-ejari-rents.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url);
const report=JSON.parse(await fs.readFile(new URL('data/uae-evidence/dubai/ejari-community-rents-validation.json',root)));
const dataBytes=await fs.readFile(new URL('data/uae-evidence/dubai/ejari-community-rents-20261101.json',root));
const data=JSON.parse(dataBytes);
const request=(query='',method='GET')=>new Request(`https://espacios.me/map/api/uae-evidence/dubai/ejari-community-rents${query}`,{method});

test('rent source is pinned and separate community and bedroom populations reconcile',()=>{
 assert.equal(createHash('sha256').update(dataBytes).digest('hex'),report.dataSha256);
 assert.equal(data.communityRows.length,102);
 assert.equal(data.bedroomRows.length,418);
 assert.equal(data.communityRows.reduce((sum,row)=>sum+row.contractCount,0),304464);
 assert.equal(data.bedroomRows.reduce((sum,row)=>sum+row.contractCount,0),286628);
 assert.equal(data.bedroomRows.filter(row=>row.medianAnnualRentAed===null).length,66);
 assert.equal(data.bedroomRows.filter(row=>row.sampleStatus==='low_5_to_19').length,33);
 assert.deepEqual(data.bedroomRows.filter(row=>row.communitySlug==='palm-jabal-ali').map(row=>[row.contractCount,row.medianAnnualRentAed]),Array.from({length:5},()=>[0,null]));
});

test('rent API exposes publisher medians without generating estimates or mixing views',async()=>{
 const response=await mapDubaiEjariRents(request('?limit=200'),report,data),body=await response.json();
 assert.equal(response.status,200);
 assert.equal(body.scope.evidenceClass,'registered_ejari_contract_rent_aggregate');
 assert.equal(body.scope.estimated,false);
 assert.equal(body.scope.askingRent,false);
 assert.equal(body.scope.storage,'checksum_verified_embedded_worker_snapshot');
 assert.equal(body.scope.idriveReplicaVerified,false);
 assert.equal(body.scope.propertyClass,'unspecified_in_published_csv');
 assert.equal(body.totalRows,102);
 assert.equal(body.totalContractCount,304464);
 assert.equal(body.rows.find(row=>row.communitySlug==='jumeirah-village-circle').medianAnnualRentAed,67000);
 const bedrooms=await (await mapDubaiEjariRents(request('?view=bedrooms&community=palm-jabal-ali'),report,data)).json();
 assert.equal(bedrooms.totalRows,5);
 assert.equal(bedrooms.totalContractCount,0);
 assert.ok(bedrooms.rows.every(row=>row.medianAnnualRentAed===null));
 const segment=await (await mapDubaiEjariRents(request('?view=bedrooms&community=jumeirah-village-circle&bedroom=1%20B%2FR'),report,data)).json();
 assert.equal(segment.totalRows,1);
 assert.equal(segment.rows[0].contractCount,15642);
 assert.equal(segment.rows[0].medianAnnualRentAed,70000);
 assert.equal(segment.rows[0].sampleStatus,'published_20_plus');
});

test('invalid filters and writes fail closed',async()=>{
 assert.equal((await mapDubaiEjariRents(request('?view=sales'),report,data)).status,400);
 assert.equal((await mapDubaiEjariRents(request('?bedroom=Studio'),report,data)).status,400);
 assert.equal((await mapDubaiEjariRents(request('?limit=201'),report,data)).status,400);
 assert.equal((await mapDubaiEjariRents(request('','POST'),report,data)).status,405);
 assert.equal((await mapDubaiEjariRents(request('','HEAD'),report,data)).body,null);
});

test('compiled Worker serves Ejari rent rows without an R2 binding',async()=>{
 const response=await worker.fetch(request('?view=bedrooms&community=palm-jabal-ali'),{DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'ejari-test'}},{}),body=await response.json();
 assert.equal(response.status,200);
 assert.equal(response.headers.get('x-espacios-map-release'),'20261111-map-stack-v64');
 assert.equal(response.headers.get('x-espacios-evidence-source'),report.sourceId);
 assert.equal(body.totalRows,5);
 assert.equal(body.totalContractCount,0);
});
