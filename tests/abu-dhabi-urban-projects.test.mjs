import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {mapAbuDhabiUrbanProjects} from '../src/stack-audit/abu-dhabi-urban-projects.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url);
const report=JSON.parse(await fs.readFile(new URL('data/uae-evidence/abu-dhabi/sdi-urban-projects-validation.json',root)));
const compressed=await fs.readFile(new URL('data/uae-evidence/abu-dhabi/sdi-urban-projects-20261102.json.gz',root));
const packed=compressed.toString('base64');
const request=(suffix='',method='GET')=>new Request('https://espacios.me/map/api/uae-evidence/abu-dhabi/urban-projects'+suffix,{method});

test('the two independent authority reads agree and no lead or geometry field entered the capture',()=>{
 const raw=gunzipSync(compressed),source=JSON.parse(raw),rows=source.features.map(f=>f.attributes);
 assert.equal(createHash('sha256').update(raw).digest('hex'),report.rawSha256);
 assert.equal(report.independentReadbackSha256,report.rawSha256);
 assert.equal(rows.length,374);
 assert.equal(new Set(rows.map(row=>row.OBJECTID)).size,374);
 assert.equal(new Set(rows.map(row=>row.PROJECTID)).size,372);
 assert.equal(new Set(rows.map(row=>row.PROJECT_NAME)).size,371);
 assert.ok(rows.every(row=>!('PROJECTLEAD' in row)&&!('SHAPE' in row)));
 assert.ok(source.features.every(feature=>!('geometry' in feature)));
});

test('source features remain separate from V48 projects and repeated authority IDs remain visible',async()=>{
 const response=await mapAbuDhabiUrbanProjects(request('?q=Al%20Rahayel'),report,packed),body=await response.json();
 assert.equal(response.status,200);
 assert.equal(body.totalFeatures,3);
 assert.deepEqual(body.features.map(row=>row.sourceProjectId),['1997.0','1997.0','1997.0']);
 assert.ok(body.features.every(row=>row.canonicalProjectId===null&&row.coordinates===null&&row.matchStatus==='unmatched_source_identity'));
 assert.equal(body.scope.canonicalProjectMatches,0);
 assert.equal(body.scope.projectCoordinatesPresent,false);
 assert.equal(body.source.rows,374);
 assert.equal(body.source.distinctSourceProjectIds,372);
 assert.equal(body.source.sourcePublicationDate,null);
 assert.equal(body.source.rawSha256,'68bb6355c7847fba5f32bbe38f965b883f2e02ff60a56517d54d67c3ef5caa94');
});

test('urban source is read-only, paginated and fails closed on altered bytes',async()=>{
 const first=await (await mapAbuDhabiUrbanProjects(request('?limit=2&offset=1'),report,packed)).json();
 assert.equal(first.features.length,2);assert.equal(first.totalFeatures,374);
 const detail=await (await mapAbuDhabiUrbanProjects(request('/1'),report,packed)).json();
 assert.equal(detail.project.sourceObjectId,1);
 for(const suffix of ['?limit=0','?offset=-1','?q='+encodeURIComponent('x'.repeat(121))])assert.equal((await mapAbuDhabiUrbanProjects(request(suffix),report,packed)).status,400);
 assert.equal((await mapAbuDhabiUrbanProjects(request('','POST'),report,packed)).status,405);
 assert.equal((await mapAbuDhabiUrbanProjects(request(),{...report,rawSha256:'0'.repeat(64)},packed)).status,503);
 assert.equal((await mapAbuDhabiUrbanProjects(request(),report,packed.slice(1))).status,503);
 assert.equal((await mapAbuDhabiUrbanProjects(request(),report,packed)).status,200);
 assert.equal((await mapAbuDhabiUrbanProjects(request('','HEAD'),report,packed)).body,null);
 assert.equal(await mapAbuDhabiUrbanProjects(new Request('https://espacios.me/map/api/system'),report,packed),null);
});

test('compiled Worker serves attributed urban features but not the source asset',async()=>{
 const env={DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'urban-source-test'}};
 const response=await worker.fetch(request('?q=Royal%20Group'),env,{}),body=await response.json();
 assert.equal(response.status,200);
 assert.equal(response.headers.get('x-espacios-evidence-source'),report.sourceId);
 assert.equal(body.totalFeatures,1);
 assert.equal(body.features[0].name,'Royal Group Phase 1 Villas');
 assert.ok(!JSON.stringify(body).includes('PROJECTLEAD'));
 const raw=await worker.fetch(new Request('https://espacios.me/map/sdi-urban-projects-20261102.json.gz'),env,{});
 assert.equal(raw.status,404);
});
