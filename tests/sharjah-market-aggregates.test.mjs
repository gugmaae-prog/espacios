import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {mapSharjahMarketAggregates} from '../src/stack-audit/sharjah-market-aggregates.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url);
const bytes=await fs.readFile(new URL('data/uae-evidence/sharjah/market-aggregates-20261109.json',root));
const data=JSON.parse(bytes),report=JSON.parse(await fs.readFile(new URL('data/uae-evidence/sharjah/market-aggregates-validation.json',root)));
const request=(query='',method='GET')=>new Request(`https://espacios.me/map/api/uae-evidence/sharjah/market-aggregates${query}`,{method});

test('Sharjah source facts reconcile without adding cumulative periods',()=>{
 assert.equal(createHash('sha256').update(bytes).digest('hex'),report.dataSha256);
 assert.equal(bytes.length,report.dataBytes);
 assert.equal(data.observations.length,2);
 assert.deepEqual(data.observations.map(row=>row.periodId),['2026H1','2026M09']);
 for(const row of data.observations){
  assert.equal(Object.values(row.saleTransactionsByUse).reduce((sum,count)=>sum+count,0),row.saleTransactions);
  assert.ok(row.allRegistrationTransactions>row.saleTransactions);
  assert.ok(row.sourceUrl.startsWith('https://sharjah24.ae/'));
 }
 assert.equal(data.observations[1].saleTransactionsByUse.commercial,1295);
 assert.equal(data.observations[0].saleTransactionsByUse.commercial,937);
 assert.equal(data.observations[1].monetaryVolumePrecision,'approximately AED 0.1 billion');
});

test('read-only API labels the Sharjah numbers as cumulative aggregates',async()=>{
 const response=mapSharjahMarketAggregates(request(),report,data),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.scope.cumulative,true);
 assert.equal(body.scope.transactionLevel,false);assert.equal(body.scope.projectRegister,false);
 assert.equal(body.observations.length,2);
 assert.equal((await mapSharjahMarketAggregates(request('?period=2026M09'),report,data).json()).observations[0].saleTransactions,24749);
 assert.equal(mapSharjahMarketAggregates(request('?period=2026M10'),report,data).status,400);
 assert.equal(mapSharjahMarketAggregates(request('','POST'),report,data).status,405);
 assert.equal(mapSharjahMarketAggregates(request('','HEAD'),report,data).body,null);
});

test('compiled Worker serves the Sharjah source',async()=>{
 const response=await worker.fetch(request(),{DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'sharjah-test'}},{}),body=await response.json();
 assert.equal(response.status,200);
 assert.equal(response.headers.get('x-espacios-evidence-source'),report.sourceId);
 assert.equal(body.observations[1].saleTransactionsByUse.commercial,1295);
});
