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

test('compiled Worker serves the source but not its compressed asset',async()=>{
 const env={DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'developer-source-test'}};
 const response=await worker.fetch(request('?q=Al%20Haffar'),env,{}),body=await response.json();
 assert.equal(response.status,200);
 assert.equal(response.headers.get('x-espacios-evidence-source'),report.sourceId);
 assert.ok(body.totalFeatures>=1);
 assert.ok(body.features.some(row=>row.name==='Al Haffar'&&row.developerName==='Aldar'));
 const raw=await worker.fetch(new Request('https://espacios.me/map/sdi-developer-projects-20261103.json.gz'),env,{});
 assert.equal(raw.status,404);
});
