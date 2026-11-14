import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {mapAbuDhabiDeveloperProjects} from '../src/stack-audit/abu-dhabi-developer-projects.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url);
const report=JSON.parse(await fs.readFile(new URL('data/uae-evidence/abu-dhabi/sdi-developer-projects-validation.json',root)));
const compressed=await fs.readFile(new URL('data/uae-evidence/abu-dhabi/sdi-developer-projects-20261103.json.gz',root));
const packed=compressed.toString('base64');
const geometryReport=JSON.parse(await fs.readFile(new URL('data/uae-evidence/abu-dhabi/sdi-developer-projects-geometry-validation.json',root)));
const geometrySource=JSON.parse(gunzipSync(await fs.readFile(new URL('data/uae-evidence/abu-dhabi/sdi-developer-projects-geometry-20261103.json.gz',root))));
const geometryChunks=JSON.parse(gunzipSync(await fs.readFile(new URL('data/uae-evidence/abu-dhabi/sdi-developer-projects-geometry-chunks-20261103.json.gz',root))));
const geometryById=Object.fromEntries(geometryChunks.map(([id,...chunk])=>[id,chunk]));
const request=(suffix='',method='GET')=>new Request('https://espacios.me/map/api/uae-evidence/abu-dhabi/developer-projects'+suffix,{method});

test('independent authority reads match a bounded public-attribute capture',()=>{
 const raw=gunzipSync(compressed),source=JSON.parse(raw),rows=source.features.map(feature=>feature.attributes);
 assert.equal(createHash('sha256').update(raw).digest('hex'),report.rawSha256);
 assert.equal(report.independentReadbackSha256,report.rawSha256);
 assert.equal(rows.length,411);
 assert.equal(new Set(rows.map(row=>row.OBJECTID)).size,411);
 assert.equal(new Set(rows.map(row=>row.PROJECT_NAME)).size,410);
 assert.equal(rows.filter(row=>row.DEVELOPER_NAME===null).length,13);
 assert.ok(source.features.every(feature=>!('geometry' in feature)));
});

test('all 411 source polygons preserve exact identities, EPSG:4326 coordinates and closed rings',()=>{
 const sourceRows=JSON.parse(gunzipSync(compressed)).features;
 assert.equal(geometryReport.independentReadbackSha256,geometryReport.rawSha256);
 assert.equal(geometrySource.spatialReference.wkid,4326);
 assert.equal(geometrySource.features.length,411);
 assert.equal(geometryChunks.length,411);
 let rings=0,vertices=0;
 for(let i=0;i<411;i++){
  const feature=geometrySource.features[i],a=feature.attributes,b=sourceRows[i].attributes,chunk=geometryChunks[i];
  assert.equal(a.OBJECTID,b.OBJECTID);assert.equal(a.PROJECT_NAME,b.PROJECT_NAME);assert.equal(a.DEVELOPER_NAME,b.DEVELOPER_NAME);assert.equal(a.CH_FID,b.CH_FID);
  assert.equal(chunk[0],a.OBJECTID);
  const packed=Buffer.from(chunk[1],'base64'),raw=gunzipSync(packed);
  assert.equal(createHash('sha256').update(packed).digest('hex'),chunk[2]);assert.equal(raw.length,chunk[3]);assert.equal(createHash('sha256').update(raw).digest('hex'),chunk[4]);assert.deepEqual(JSON.parse(raw),feature);
  for(const ring of feature.geometry.rings){assert.deepEqual(ring[0],ring.at(-1));rings++;for(const [x,y] of ring){assert.ok(x>=51.5&&x<=56&&y>=22.5&&y<=26);vertices++;}}
 }
 assert.equal(rings,528);assert.equal(vertices,92121);
});

test('developer layer is searchable and separate from V48 identities and ADREC sales',async()=>{
 const response=await mapAbuDhabiDeveloperProjects(request('?q=Aldar&limit=10'),report,packed),body=await response.json();
 assert.equal(response.status,200);
 assert.ok(body.totalFeatures>0);
 assert.ok(body.features.every(row=>row.canonicalProjectId===null&&row.coordinates===null&&row.matchStatus==='unmatched_source_identity'));
 assert.equal(body.scope.canonicalProjectMatches,0);
 assert.equal(body.scope.projectCoordinatesPresent,false);
 assert.equal(body.source.rows,411);
 assert.equal(body.source.sourcePublicationDate,null);
 const detail=await (await mapAbuDhabiDeveloperProjects(request('/1016'),report,packed)).json();
 assert.equal(detail.project.name,'Al Haffar');
 assert.equal(detail.project.developerName,'Aldar');
});

test('source route is read-only and fails closed on altered bytes',async()=>{
 for(const suffix of ['?limit=0','?offset=-1','?q='+encodeURIComponent('x'.repeat(121))])assert.equal((await mapAbuDhabiDeveloperProjects(request(suffix),report,packed)).status,400);
 assert.equal((await mapAbuDhabiDeveloperProjects(request('','POST'),report,packed)).status,405);
 assert.equal((await mapAbuDhabiDeveloperProjects(request(),{...report,rawSha256:'0'.repeat(64)},packed)).status,503);
 assert.equal((await mapAbuDhabiDeveloperProjects(request(),report,packed.slice(1))).status,503);
 assert.equal((await mapAbuDhabiDeveloperProjects(request(),report,packed)).status,200);
 assert.equal((await mapAbuDhabiDeveloperProjects(request('','HEAD'),report,packed)).body,null);
 assert.equal(await mapAbuDhabiDeveloperProjects(new Request('https://espacios.me/map/api/system'),report,packed),null);
});

test('feature detail returns only its verified source polygon when requested',async()=>{
 const response=await mapAbuDhabiDeveloperProjects(request('/1016?geometry=1'),report,packed,geometryReport,geometryById),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.source.geometryAvailable,true);assert.equal(body.scope.projectCoordinatesPresent,false);
 assert.equal(body.project.name,'Al Haffar');assert.equal(body.project.canonicalProjectId,null);
 assert.equal(body.project.sourceGeometry.format,'esriPolygonRings');assert.equal(body.project.sourceGeometry.crs,'EPSG:4326');
 assert.deepEqual(body.project.sourceGeometry.rings,geometrySource.features.find(feature=>feature.attributes.OBJECTID===1016).geometry.rings);
 assert.equal((await mapAbuDhabiDeveloperProjects(request('?geometry=1'),report,packed,geometryReport,geometryById)).status,400);
 assert.equal((await mapAbuDhabiDeveloperProjects(request('/1016?geometry=yes'),report,packed,geometryReport,geometryById)).status,400);
 assert.equal((await mapAbuDhabiDeveloperProjects(request('/1016?geometry=1'),report,packed,{...geometryReport,rawSha256:'0'.repeat(64)},geometryById)).status,503);
 assert.equal((await mapAbuDhabiDeveloperProjects(request('/1016?geometry=1'),report,packed,geometryReport,{...geometryById,1016:['bad',...geometryById[1016].slice(1)]})).status,503);
});

test('compiled Worker serves the source but not its compressed asset',async()=>{
 const env={DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'developer-source-test'}};
 const response=await worker.fetch(request('?q=Al%20Haffar'),env,{}),body=await response.json();
 assert.equal(response.status,200);
 assert.equal(response.headers.get('x-espacios-evidence-source'),report.sourceId);
 assert.ok(body.totalFeatures>=1);
 assert.ok(body.features.some(row=>row.name==='Al Haffar'&&row.developerName==='Aldar'));
 const geometry=await worker.fetch(request('/35?geometry=1'),env,{}),geometryBody=await geometry.json();
 assert.equal(geometry.status,200);assert.equal(geometryBody.project.sourceGeometry.crs,'EPSG:4326');assert.ok(geometryBody.project.sourceGeometry.rings[0].length>100);
 const raw=await worker.fetch(new Request('https://espacios.me/map/sdi-developer-projects-20261103.json.gz'),env,{});
 assert.equal(raw.status,404);
 const rawGeometry=await worker.fetch(new Request('https://espacios.me/map/sdi-developer-projects-geometry-20261103.json.gz'),env,{});
 assert.equal(rawGeometry.status,404);
});
