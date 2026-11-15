import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {gunzipSync} from 'node:zlib';
import {webcrypto,createHash} from 'node:crypto';

const root=new URL('../',import.meta.url),read=p=>fs.readFile(new URL(p,root));
const indexManifest=JSON.parse(await read('data/recovery/v48-native-history-index.manifest.json'));
const native=JSON.parse(gunzipSync(await read(indexManifest.path)));
const metadata=JSON.parse(await read('data/historical-intelligence/runtime-index.json'));
const originals=JSON.parse(await read('data/recovery/legacy-history-series-metadata.json'));
const modelPage=JSON.parse(await read('data/recovery/predictions-public-page-20261013.json'));
const recoveryShards=JSON.parse(await read('data/recovery/recovery-native-shards.manifest.json'));
const source=(await read('src/map-recovery/legacy-history-compat.mjs')).toString().replace(/^export /gm,'');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function environment(){
 const paths=new Map([[indexManifest.key,indexManifest.path],['recovery/accepted-history-library-20261003/series-metadata.json','data/recovery/legacy-history-series-metadata.json'],['recovery/accepted-model-catalogue-20261013/published-first-page.json','data/recovery/predictions-public-page-20261013.json']]);
 for(const object of recoveryShards.objects)paths.set(object.key,object.path);
 let writes=0,reads=0;
 const env={MARKET_R2:{async get(key){reads++;const path=paths.get(key)||(key.startsWith('research/published/')?'data/historical-intelligence/objects/'+key.split('/').at(-1):null);if(!path)return null;const b=await read(path);return{async arrayBuffer(){return b.buffer.slice(b.byteOffset,b.byteOffset+b.length)}}},put(){writes++;throw Error('Evidence is read-only')}}};
 const context=vm.createContext({Request,Response,Headers,URL,TextEncoder,TextDecoder,crypto:webcrypto,Date,console,HI_DATA:metadata,MAP_NATIVE_INDEX_MANIFEST:indexManifest,HI_GET_DATA:async()=>metadata,hiDigest:async b=>sha(Buffer.from(b)),hiDecodeJSON:async(b,compression,max)=>{const bytes=compression==='gzip'?gunzipSync(Buffer.from(b)):Buffer.from(b);assert.ok(bytes.length<=max);return JSON.parse(bytes)},hiPartition:async(pointer,data,e)=>{const p=pointer.partition,o=await e.MARKET_R2.get(p.key);if(!o)return null;const b=Buffer.from(await o.arrayBuffer());assert.equal(sha(b),p.sha256);return JSON.parse(p.compression==='gzip'?gunzipSync(b):b)},mapStackJSON:(r,d,status=200)=>new Response(r.method==='HEAD'?null:JSON.stringify(d),{status,headers:{'content-type':'application/json'}}),mapSeamlessHtml:s=>s});
 vm.runInContext(source,context);
 return{env,context,async get(path,method='GET'){const response=await context.mapLegacyHistoryRoute(new Request('https://espacios.me'+path,{method}),env,{});return{response,data:method==='HEAD'?null:await response.json()}},counts:()=>({reads,writes})};
}
test('retained library paginates the exact approved population and validates input',async()=>{
 const app=environment(),a=await app.get('/map/api/history-library?limit=1'),b=await app.get('/map/api/history-library?limit=1&offset=1');
 assert.equal(a.response.status,200);assert.equal(a.data.total,16872);assert.equal(a.data.counts.retainedNativePoints,633891);assert.equal(a.data.series[0].id,native.rows[0][0]);assert.equal(b.data.series[0].id,native.rows[1][0]);assert.equal(a.data.dataContract.valuesRecalculated,false);
 for(const q of ['limit=0','limit=101','offset=-1','limit=1e2','pointLimit=2001','pointOffset=1.5'])assert.equal((await app.get('/map/api/history-library?'+q)).response.status,400,q);
 assert.equal((await app.get('/map/api/history-library','POST')).response.status,405);assert.equal((await app.get('/map/api/history-library','HEAD')).response.status,200);assert.equal(app.counts().writes,0);
});
test('Dubai history preserves original native arrays, counts, low-sample flags and every source area',async()=>{
 const app=environment(),result=await app.get('/map/api/dubai-history?frequency=monthly&segment=apartment&registration=Ready');assert.equal(result.response.status,200);const expected=originals.filter(s=>s.family==='dubai'&&s.frequency==='monthly'&&s.segment==='apartment'&&s.registration==='Ready').length;assert.equal(result.data.total,expected);assert.equal(result.data.series.length,expected);assert.equal(result.data.partial,false);assert.equal(result.data.method.valuesRecalculated,false);
 const original=originals.find(s=>s.family==='dubai'&&s.frequency==='monthly'&&s.segment==='apartment'&&s.registration==='Ready');
 const series=result.data.series.find(s=>s.historySeriesId===original.id);assert.ok(series);assert.equal(series.points.length,original.pointCount);assert.equal(sha(JSON.stringify(series.points)),original.dataSha256);
 const detail=await app.get('/map/api/history-series?series='+original.id);assert.equal(detail.response.status,200);assert.equal(sha(JSON.stringify(detail.data.series.points)),original.dataSha256);assert.equal(detail.data.series.originalMetadata.id,original.id);assert.ok(detail.data.series.retainedColumns.includes('qualityStatus'));
 const page=await app.get('/map/api/dubai-history?frequency=monthly&segment=apartment&registration=Ready&limit=1&offset=1');assert.equal(page.data.series.length,1);assert.equal(page.data.total,expected);assert.equal(page.data.nextOffset,2);
 assert.equal((await app.get('/map/api/dubai-history?frequency=annual')).response.status,400);assert.equal(app.counts().writes,0);
});
test('large retained series returns explicit point pagination without rewriting values',async()=>{
 const app=environment(),n=native.columns,largest=[...native.rows].sort((a,b)=>b[n.indexOf('pointCount')]-a[n.indexOf('pointCount')])[0],id=largest[0];
 const first=await app.get('/map/api/history-series?series='+encodeURIComponent(id)+'&pointLimit=2'),next=await app.get('/map/api/history-series?series='+encodeURIComponent(id)+'&pointLimit=2&pointOffset=2');
 assert.equal(first.response.status,200);assert.equal(first.data.series.pointCount,8570);assert.equal(first.data.series.pagination.nextPointOffset,2);assert.equal(first.data.series.retainedPoints.length,2);assert.notDeepEqual(first.data.series.retainedPoints,next.data.series.retainedPoints);
 assert.equal((await app.get('/map/api/history-series?series=missing')).response.status,404);
});
test('only the real 50 captured model results are published with an explicit 135-run gap',async()=>{
 const app=environment(),result=await app.get('/map/api/prediction-catalogue?status=all&limit=100');assert.equal(result.response.status,200);assert.equal(result.data.total,50);assert.equal(result.data.capturedRuns,50);assert.equal(result.data.sourceReportedTotal,185);assert.equal(result.data.missingRuns,135);assert.equal(result.data.archiveComplete,false);assert.equal(result.data.sourceReportedAllModelRuns,2223);assert.equal(result.data.unrecoveredAllModelRuns,2173);assert.equal(result.data.statusCounts.experimental_projection,50);assert.deepEqual(result.data.runs.map(r=>r.id),modelPage.runs.map(r=>r.id));
 assert.deepEqual(result.data.runs[0].storedPrediction,modelPage.runs[0].storedPrediction??modelPage.runs[0].prediction);assert.equal(result.data.runs[0].commercialForecastReady,false);
 assert.equal((await app.get('/map/api/prediction-catalogue?horizon=120')).response.status,400);assert.equal((await app.get('/map/api/prediction?run=unrecovered')).response.status,404);assert.equal(app.counts().writes,0);
});
test('history and stored-model pages are truthful usable pages with no network writes',async()=>{
 const app=environment();for(const path of ['/map/history','/map/predictions']){const r=await app.context.mapLegacyHistoryRoute(new Request('https://espacios.me'+path),app.env,{});assert.equal(r.status,200);const html=await r.text();assert.match(html,/retained|Retained/);assert.match(html,/partial|separate recovery gaps/);assert.doesNotMatch(html,/1,337-project|government datasets normalized/);}
 assert.equal(await app.context.mapLegacyHistoryRoute(new Request('https://espacios.me/map/api/unrelated'),app.env,{}),null);
});
