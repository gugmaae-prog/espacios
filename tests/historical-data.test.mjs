import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {annualScenarios,TARGET_YEARS} from '../src/historical-intelligence/core.mjs';
const root=new URL('../',import.meta.url),read=p=>fs.readFile(new URL(p,root)),sha=x=>createHash('sha256').update(x).digest('hex');
const data=JSON.parse(await read('data/historical-intelligence-20261003.json'));
const publication=JSON.parse(await read('data/historical-intelligence/publication-manifest.json'));
const inputs=JSON.parse(await read('data/historical-intelligence/inputs/manifest.json'));

test('full reviewed inventory and exact identities survive normalization',async()=>{
 const bytes=await read(inputs.inventory.path),inventory=JSON.parse(gunzipSync(bytes));
 const original=[...inventory.projects,...inventory.communities].map(r=>r.id).sort();
 assert.equal(data.records.length,1860);assert.equal(data.records.filter(r=>r.type==='project').length,1645);assert.equal(data.records.filter(r=>r.type==='community').length,215);
 assert.equal(new Set(data.records.map(r=>r.id)).size,1860);assert.deepEqual(data.records.map(r=>r.id).sort(),original);
 assert.equal(data.records.filter(r=>r.emirate==='Dubai').length,1266);
 for(const record of data.records){assert.ok(record.researchStatus);assert.equal(record.scenarioCoverage.lastYear,2080);assert.equal(record.scenarioCoverage.annualSlotsPerMetric,54);if(record.communityId)assert.ok(data.records.some(r=>r.type==='community'&&r.id===record.communityId));}
});
test('immutable inputs and every publishable object match their content address',async()=>{
 for(const input of Object.values(inputs)){const bytes=await read(input.path);assert.equal(sha(bytes),input.compressedSha256,input.path);assert.equal(sha(gunzipSync(bytes)),input.sha256,input.path);}
 const pointers=[...publication.objects,publication.d1Index].filter(Boolean),keys=new Set();
 for(const object of pointers){assert.match(object.key,/^research\/published\/\d{4}-\d{2}-\d{2}\/historical-intelligence\/objects\/[a-f0-9]{64}\./);assert.equal(keys.has(object.key),false,'Manifest objects must be unique');keys.add(object.key);const bytes=await read(object.path);assert.equal(bytes.length,object.bytes);assert.equal(sha(bytes),object.sha256);assert.ok(object.key.includes(object.sha256));}
 assert.equal(publication.counts.records,1860);assert.equal(publication.counts.projects,1645);assert.equal(publication.counts.communities,215);
});
test('archival root retains present evidence and complete record-to-series relationships',async()=>{
 const archive=JSON.parse(gunzipSync(await read(publication.rootIndex.path)));
 const seriesIds=new Set(archive.series.map(s=>s.id));
 for(const record of data.records){
  const archived=archive.records.find(r=>r.id===record.id);
  assert.ok(archived);assert.deepEqual(archived.currentSnapshot,record.currentSnapshot);
  assert.deepEqual(archived.historySeriesIds,record.historySeries.map(s=>s.id));
  for(const id of archived.historySeriesIds)assert.ok(seriesIds.has(id));
 }
});
test('context, research candidates and incomplete subject coverage remain separate',()=>{
 assert.equal(data.manifest.identityCandidateProjects,263);
 for(const record of data.records){for(const s of record.historySeries){if(s.scope==='subject'){assert.equal(s.identityVerified,true);assert.ok(s.identitySourceIds?.length);assert.ok(s.linkBasis);}else assert.equal(s.identityVerified,false);assert.ok(s.partition);assert.ok(s.pointCount>=s.points.length);assert.ok(s.columns.includes('value'));}
  for(const milestone of record.lifecycle){assert.ok(milestone.sourceIds.length);if(['occupancy','completion'].includes(milestone.kind))assert.ok(milestone.date.start<=data.asOf);if(milestone.status==='verified')assert.ok(milestone.identityBasis);}
  if(record.currentSnapshot.scope==='source_observed_asking_quote'){assert.ok(record.currentSnapshot.firstAvailableAt);assert.ok(record.currentSnapshot.observationId);assert.ok(record.priorCurrentSnapshots.length);}else assert.equal(record.currentSnapshot.freshness,'unverified_source_date');
 }
 assert.equal(data.manifest.directSubjectSaleHistoryRecords,data.records.filter(r=>r.historySeries.some(s=>s.scope==='subject'&&s.identityVerified&&s.metric==='price')).length);assert.equal(data.manifest.directSubjectRentHistoryRecords,data.records.filter(r=>r.historySeries.some(s=>s.scope==='subject'&&s.identityVerified&&s.metric==='rent')).length);assert.equal(data.manifest.approved2080ForecastRecords,0);
 assert.equal(data.manifest.historyWindow.start,null,'A common subject inception is not imposed');
});
test('each retained record has exactly54 annual slots for every metric and scenario',()=>{
 assert.equal(TARGET_YEARS.length,54);assert.equal(TARGET_YEARS[0],2027);assert.equal(TARGET_YEARS.at(-1),2080);
 for(const record of data.records){const scenarios=annualScenarios(record,{asOf:data.asOf,sources:data.sources});assert.equal(scenarios.validatedForecast,false);
  for(const metric of ['price','rent','netROI'])for(const name of ['downside','base','upside']){const path=scenarios.metrics[metric].paths[name];assert.deepEqual(path.map(p=>p.year),TARGET_YEARS);assert.ok(path.every(p=>p.value===null&&p.reason),'Missing evidence must not become invented forecasts');}
 }
});
test('source references and dated event revisions have no orphan links or mechanical uplifts',()=>{
 const ids=new Set(data.sources.map(s=>s.id));assert.equal(ids.size,data.sources.length);
 for(const source of data.sources){const url=new URL(source.url);assert.equal(url.protocol,'https:');assert.equal(url.username,'');assert.equal(url.password,'');assert.ok(!/[?&](?:token|secret|api_key|access_token)=/i.test(source.url));}
 const eventIds=new Set(data.events.map(e=>e.id));assert.equal(eventIds.size,data.events.length);
 for(const event of data.events){assert.ok(event.eventDate);assert.equal(event.priceUpliftPct,null);assert.ok(event.sourceIds.length);for(const id of event.sourceIds)assert.ok(ids.has(id),'Missing event source: '+id);}
 for(const exposure of data.exposures){assert.ok(eventIds.has(exposure.eventId));assert.ok(data.records.some(r=>r.id===exposure.recordId));assert.equal(exposure.priceUpliftPct,null);}
 for(const term of ['mobilisation','rainfall','guggenheim','gold','wynn'])assert.ok(data.events.some(e=>(e.id+' '+e.title).toLowerCase().includes(term)),'Required event family: '+term);
});
