import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {mapAjmanDispositions} from '../src/stack-audit/ajman-transactions.mjs';

const root=new URL('../',import.meta.url);
const report=JSON.parse(await fs.readFile(new URL('data/uae-evidence/ajman/transactions-validation.json',root)));
const compressed=await fs.readFile(new URL('data/uae-evidence/ajman/real-estate-units-transactions-20260821.json.gz',root));
const manifest={entries:{[report.storageKey]:{sha256:report.compressedSha256,bytes:report.compressedBytes}}};
const request=(query='',method='GET')=>new Request('https://espacios.me/map/api/uae-evidence/ajman/dispositions'+query,{method});
const store={get:async key=>key===report.storageKey?{sha256:report.compressedSha256,size:compressed.length,storageSource:'immutable_static_recovery',arrayBuffer:async()=>compressed.buffer.slice(compressed.byteOffset,compressed.byteOffset+compressed.byteLength)}:null};

test('verified source preserves mixed grain and explicit unknowns',async()=>{
 const response=await mapAjmanDispositions(request(),report,store,manifest),body=await response.json();
 assert.equal(response.status,200);
 assert.equal(body.source.storage,'immutable_static_recovery');
 assert.equal(body.source.rows,6299);
 assert.equal(body.source.unknownPeriodRows,318);
 assert.equal(body.source.unknownValueRows,4594);
 assert.equal(body.totals.reportedDispositionCount,18057);
 assert.equal(body.totals.knownValueIncomplete,true);
 assert.equal(body.scope.canonicalProjectMatches,0);
 assert.match(body.scope.limits,/not a sale-only source/);
 assert.ok(body.rows.every(row=>row.canonicalProjectId===null&&row.matchStatus==='unmatched'));
});

test('filters and pagination retain null period and value semantics',async()=>{
 const unknown=await (await mapAjmanDispositions(request('?period=unknown&value=unknown&limit=10'),report,store,manifest)).json();
 assert.ok(unknown.totalRows>0);
 assert.ok(unknown.rows.every(row=>row.year===null&&row.quarter===null&&row.total_transactions_values_in_aed===null));
 assert.equal(unknown.totals.knownValueAedSum,0);
 const known=await (await mapAjmanDispositions(request('?year=2021&quarter=4&value=known'),report,store,manifest)).json();
 assert.ok(known.totalRows>0);
 assert.ok(known.rows.every(row=>row.year===2021&&row.quarter===4&&row.total_transactions_values_in_aed!==null));
 assert.equal(known.totals.knownValueIncomplete,false);
});

test('missing or corrupted bytes, invalid filters and writes fail closed',async()=>{
 assert.equal((await mapAjmanDispositions(request(),report,null,manifest)).status,503);
 assert.equal((await mapAjmanDispositions(request(),report,store,{entries:{}})).status,503);
 assert.equal((await mapAjmanDispositions(request(),{...report,rawSha256:'0'.repeat(64)},store,manifest)).status,503);
 for(const query of ['?year=2027','?quarter=0','?limit=101','?offset=-1','?period=unknown&year=2026','?value=sale'])assert.equal((await mapAjmanDispositions(request(query),report,store,manifest)).status,400);
 assert.equal((await mapAjmanDispositions(request('','POST'),report,store,manifest)).status,405);
 assert.equal(await mapAjmanDispositions(new Request('https://espacios.me/map/api/system'),report,store,manifest),null);
});
