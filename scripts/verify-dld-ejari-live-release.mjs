// Verify every V31 DLD project and community rent series against the live API.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
const root=new URL('../',import.meta.url),args=process.argv.slice(2);
const option=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const origin=option('--origin','https://espacios.me');
const report=option('--output','.local-data/history-v31-rent-verification.json');
const read=async p=>JSON.parse(await fs.readFile(new URL(p,root),'utf8'));
const snapshot=await read('data/historical-intelligence-20261003.json');
const manifest=await read('data/historical-intelligence/publication-manifest.json');
const projectPacket=JSON.parse(gunzipSync(await fs.readFile(new URL('data/historical-intelligence/dld-rent-recapture-20261008.json.gz',root))));
const communityPacket=JSON.parse(gunzipSync(await fs.readFile(new URL('data/historical-intelligence/dld-community-ejari-rent-pass31-20261007.json.gz',root))));
const version='20261008-enrichment-v31';
const sourceIds=new Set(['dld-official-rents-recapture-20261008','dld-official-community-master-ejari-rents-20261007']);
assert.equal(snapshot.version,version);assert.equal(manifest.version,version);
const expected=new Map();
for(const object of manifest.objects.filter(item=>item.kind==='history_partition')){
 const archive=JSON.parse(gunzipSync(await fs.readFile(new URL(object.path,root))));
 for(const series of archive.series){
  if(!sourceIds.has(series.sourceId)||series.metric!=='rent'||series.scope!=='subject'||series.identityVerified!==true)continue;
  if(expected.has(series.id))throw new Error(`Duplicate direct rent series ID: ${series.id}`);
  expected.set(series.id,series);
 }
}
assert.equal(expected.size,3664);
assert.equal(projectPacket.series.length,1974);
assert.equal(communityPacket.series.length,1690);
// Existing V30 project cohorts retain their stable `dld-primary-*` series IDs.
// The refresh packet uses a pass-local ID, so reconcile by exact native identity
// instead of assuming the packet ID is the published series ID. V31 community
// IDs are new and stable, so they match by ID.
const projectIdentityKey=item=>JSON.stringify([item.recordId,item.segment,item.registration,item.frequency]);
const expectedProjectsByIdentity=new Map();
for(const series of expected.values()){
 if(series.sourceId!=='dld-official-rents-recapture-20261008')continue;
 const key=projectIdentityKey({recordId:series.subjectRecordId,segment:series.segment,registration:series.registration,frequency:series.frequency});
 if(expectedProjectsByIdentity.has(key))throw new Error(`Duplicate published project rent identity: ${key}`);
 expectedProjectsByIdentity.set(key,series);
}
assert.equal(expectedProjectsByIdentity.size,1974);
const jobs=[
 ...projectPacket.series.map(packetSeries=>({packetSeries,recordType:'project',series:expectedProjectsByIdentity.get(projectIdentityKey(packetSeries))})),
 ...communityPacket.series.map(packetSeries=>({packetSeries,recordType:'community'})),
].map(job=>{
 const series=job.series||expected.get(job.packetSeries.id);
 if(!series)throw new Error(`Published direct rent series missing for packet cohort: ${job.packetSeries.id}`);
 if(job.recordType==='project'&&(series.subjectRecordId!==job.packetSeries.recordId||series.segment!==job.packetSeries.segment||series.registration!==job.packetSeries.registration||series.frequency!==job.packetSeries.frequency))throw new Error(`Project rent identity mismatch: ${job.packetSeries.id}`);
 return {...job,series};
});
assert.equal(jobs.length,expected.size);
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
let completed=0,points=0;const records=new Set(),byLevel={project:{series:0,points:0,records:new Set()},community:{series:0,points:0,records:new Set()}};
for(let index=0;index<jobs.length;index+=6){
 await Promise.all(jobs.slice(index,index+6).map(async ({packetSeries,series,recordType})=>{
  const body=await get('/map/api/record-history?'+new URLSearchParams({recordId:packetSeries.recordId,seriesId:series.id}));
  const record=body.record,actual=body.historySeries.find(item=>item.id===series.id);
  assert.ok(record&&record.type===recordType,packetSeries.recordId);
  assert.ok(actual,series.id);assert.equal(actual.scope,'subject');assert.equal(actual.identityVerified,true);
  assert.equal(actual.subjectRecordId,packetSeries.recordId);assert.ok(sourceIds.has(actual.sourceId));
  assert.deepEqual(actual.points,series.points,series.id+' exact full point list');
  assert.equal(actual.pointCount,series.pointCount,series.id+' point count');
  const sourceSet=new Set(body.sources.map(item=>item.id));
  assert.ok(sourceSet.has(actual.sourceId),series.id+' rent source');
  assert.ok(series.identitySourceIds.every(id=>sourceSet.has(id)),series.id+' identity sources');
  assert.ok(series.points.every(point=>Number(point[2])>0),series.id+' empty point');
  if(series.frequency==='monthly')assert.ok(series.points.every(point=>point[0]<='2026-10'),series.id+' future month');
  else assert.ok(series.points.every(point=>point[0]<='2026Q4'),series.id+' future quarter');
  if(recordType==='community'){
   assert.equal(actual.sourceAreaId,Number(packetSeries.areaId),series.id+' native area ID');
   assert.equal(actual.sourceAreaName,packetSeries.areaName,series.id+' native area name');
   assert.ok(actual.identityBasis.includes('master_project_en'),series.id+' exact master-label basis');
  }
  records.add(packetSeries.recordId);completed++;points+=actual.points.length;
  byLevel[recordType].series++;byLevel[recordType].points+=actual.points.length;byLevel[recordType].records.add(packetSeries.recordId);
 }));
 if(completed%120===0||completed===jobs.length)console.error(JSON.stringify({completed,total:jobs.length,points,records:records.size}));
}
assert.equal(completed,3664);assert.equal(records.size,135);
assert.equal(byLevel.project.series,1974);assert.equal(byLevel.project.records.size,90);
assert.equal(byLevel.community.series,1690);assert.equal(byLevel.community.records.size,45);
const result={origin,version,readOnly:true,series:completed,points,records:records.size,
 project:{series:byLevel.project.series,points:byLevel.project.points,records:byLevel.project.records.size},
 community:{series:byLevel.community.series,points:byLevel.community.points,records:byLevel.community.records.size},
 observationStart:{project:'2015-01-25',community:'2007-12-30'},observationEnd:'2026-10-07',
 newProjectPeriodCells:snapshot.manifest.dldEjariRentRecapture.newPeriodCells,
 newCommunityPoints:snapshot.manifest.dldCommunityEjariRentPass31.aggregateObservationRows,
 allSeriesHydrated:true,passed:true,checkedAt:new Date().toISOString()};
await fs.writeFile(new URL(report,root),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
