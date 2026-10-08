// Verify every DLD rent series in the current candidate against the live API.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
const root=new URL('../',import.meta.url),args=process.argv.slice(2);
const option=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const origin=option('--origin','https://espacios.me');
const report=option('--output','.local-data/history-v30-rent-verification.json');
const read=async p=>JSON.parse(await fs.readFile(new URL(p,root),'utf8'));
const snapshot=await read('data/historical-intelligence-20261003.json');
const manifest=await read('data/historical-intelligence/publication-manifest.json');
const packet=JSON.parse(gunzipSync(await fs.readFile(new URL('data/historical-intelligence/dld-rent-recapture-20261008.json.gz',root))));
const version='20261008-enrichment-v30',sourceId='dld-official-rents-recapture-20261008';
assert.equal(snapshot.version,version);assert.equal(manifest.version,version);
const expected=new Map();
for(const object of manifest.objects.filter(item=>item.kind==='history_partition')){
 const archive=JSON.parse(gunzipSync(await fs.readFile(new URL(object.path,root))));
 for(const series of archive.series){
  if(series.sourceId!==sourceId||series.metric!=='rent'||series.scope!=='subject'||series.identityVerified!==true)continue;
  const key=[series.subjectRecordId,series.segment,series.registration,series.frequency].join('\u0000');
  if(expected.has(key))throw new Error(`Duplicate V30 direct rent series key: ${key}`);
  expected.set(key,series);
 }
}
assert.equal(expected.size,1974);
assert.equal(packet.series.length,expected.size);
const headers={'Cache-Control':'no-cache'};
async function get(path){
 let last;
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetch(origin+path,{headers,signal:AbortSignal.timeout(120000)});
   if(response.status===429||response.status>=500){last=new Error(`HTTP ${response.status}`);await new Promise(r=>setTimeout(r,500*(attempt+1)));continue;}
   assert.equal(response.status,200,path);const body=await response.json();assert.equal(body.version,version,path+' version');return body;
  }catch(error){last=error;if(attempt<2)await new Promise(r=>setTimeout(r,500*(attempt+1)));}
 }
 throw last;
}
const jobs=packet.series.map(packetSeries=>{
 const key=[packetSeries.recordId,packetSeries.segment,packetSeries.registration,packetSeries.frequency].join('\u0000');
 const series=expected.get(key);if(!series)throw new Error(`Published direct rent series missing: ${packetSeries.recordId} ${packetSeries.segment}`);
 return {packetSeries,series};
});
let completed=0,points=0;const records=new Set();
for(let index=0;index<jobs.length;index+=6){
 await Promise.all(jobs.slice(index,index+6).map(async ({packetSeries,series})=>{
  const body=await get('/map/api/record-history?'+new URLSearchParams({recordId:packetSeries.recordId,seriesId:series.id}));
  const record=body.record,actual=body.historySeries.find(item=>item.id===series.id);
  assert.ok(record&&record.type==='project',packetSeries.recordId);
  assert.ok(actual,series.id);assert.equal(actual.scope,'subject');assert.equal(actual.identityVerified,true);
  assert.equal(actual.subjectRecordId,packetSeries.recordId);assert.equal(actual.sourceId,sourceId);
  assert.deepEqual(actual.points,series.points,series.id+' exact full point list');
  assert.equal(actual.pointCount,series.pointCount,series.id+' point count');
  const sourceSet=new Set(body.sources.map(item=>item.id));
  assert.ok(sourceSet.has(sourceId),series.id+' rent source');
  assert.ok(series.identitySourceIds.every(id=>sourceSet.has(id)),series.id+' identity sources');
  assert.ok(series.points.every(point=>point[0]<'2027-01'&&Number(point[2])>0),series.id+' future/empty point');
  records.add(packetSeries.recordId);completed++;points+=actual.points.length;
 }));
 if(completed%120===0||completed===jobs.length)console.error(JSON.stringify({completed,total:jobs.length,points,records:records.size}));
}
assert.equal(completed,1974);assert.equal(records.size,90);
const result={origin,version,readOnly:true,sourceId,series:completed,points,records:records.size,
 observationStart:'2015-01-25',observationEnd:'2026-10-07',newPeriodCells:snapshot.manifest.dldEjariRentRecapture.newPeriodCells,
 allSeriesHydrated:true,passed:true,checkedAt:new Date().toISOString()};
await fs.writeFile(new URL(report,root),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
