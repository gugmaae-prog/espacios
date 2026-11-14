import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {mapFcscHistoricalCensus} from '../src/stack-audit/fcsc-historical-census.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url);
const [report,data]=await Promise.all([
 fs.readFile(new URL('data/uae-evidence/federal/fcsc-census-selected-validation.json',root),'utf8').then(JSON.parse),
 fs.readFile(new URL('data/uae-evidence/federal/fcsc-census-selected-20261114.json',root),'utf8').then(JSON.parse),
]);
const request=(query='',method='GET')=>new Request('https://espacios.me/map/api/uae-evidence/federal/historical-building-housing'+query,{method});

test('federal census returns only selected, explicitly historical rows',async()=>{
 const all=await (await mapFcscHistoricalCensus(request(),report,data)).json();
 assert.equal(all.totalRows,56);
 assert.equal(all.scope.historicalOnly,true);
 assert.equal(all.scope.notCurrentStock,true);
 assert.equal(all.scope.availableUnits,false);
 assert.equal(all.scope.registeredTransactions,false);
 assert.equal(all.scope.forecasts,false);
 assert.equal(all.source.evidenceClass,'official_historical_census_stock_count');
 assert.equal(all.rows.filter(row=>row.metric==='buildings'&&row.year===2005).reduce((sum,row)=>sum+row.count,0),335487);
 const selected=await (await mapFcscHistoricalCensus(request('?metric=buildings&year=2005&emirate=Dubai'),report,data)).json();
 assert.deepEqual(selected.rows,[{metric:'buildings',year:2005,emirate:'Dubai',count:77886}]);
 assert.equal((await mapFcscHistoricalCensus(request('?metric=housingUnits&year=1975'),report,data)).status,400);
 assert.equal((await mapFcscHistoricalCensus(request('?emirate=Atlantis'),report,data)).status,400);
 assert.equal((await mapFcscHistoricalCensus(request('','POST'),report,data)).status,405);
 assert.equal((await mapFcscHistoricalCensus(request('','HEAD'),report,data)).body,null);
});

test('compiled map Worker serves federal census with verified replica label',async()=>{
 const response=await worker.fetch(request('?metric=buildings&year=2005&emirate=Dubai'),{DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'fcsc-test'}},{});
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.rows[0].count,77886);
 assert.equal(body.source.idriveReplica.role,'verified_private_replica_not_runtime_primary');
 assert.equal(body.scope.notCurrentStock,true);
});
