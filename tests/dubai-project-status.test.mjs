import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {normalizeDubaiStatusCsv,parseDubaiStatusCsv,mapDubaiProjectStatus} from '../src/stack-audit/dubai-project-status.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url);
const report=JSON.parse(await fs.readFile(new URL('data/uae-evidence/dubai/dld-project-status-validation.json',root)));
const crosswalk=JSON.parse(await fs.readFile(new URL('data/uae-evidence/dubai/reviewed-v48-crosswalk.json',root)));
const captured=await fs.readFile(new URL('data/uae-evidence/dubai/dld-project-status-20261101.csv.gz',root));
const raw=gunzipSync(captured),rows=normalizeDubaiStatusCsv(raw.toString('utf8'),report);
const normalized=Buffer.from(JSON.stringify(rows)),normalizedPacked=gzipSync(normalized,{level:9}).toString('base64');
const sha=value=>createHash('sha256').update(value).digest('hex');
const request=(suffix='',method='GET')=>new Request('https://espacios.me/map/api/uae-evidence/dubai/project-status'+suffix,{method});

test('licensed 1 November source capture survives byte, schema and identity checks',()=>{
 assert.equal(sha(captured),report.compressedSha256);
 assert.equal(sha(raw),report.rawSha256);
 assert.equal(report.independentReadbackSha256,report.rawSha256);
 assert.equal(rows.length,3871);
 assert.equal(new Set(rows.map(row=>row.sourceProjectNumber)).size,3871);
 assert.equal(new Set(rows.map(row=>row.name)).size,3852);
 assert.equal(report.actualCsvFieldCount,14);
 assert.equal(report.sourcePageClaimedFieldCount,16);
 assert.equal(sha(normalized),report.normalizedSha256);
 assert.equal(sha(Buffer.from(normalizedPacked,'base64')),report.normalizedCompressedSha256);
 assert.ok(rows.every(row=>row.canonicalProjectId===null&&row.coordinates===null&&row.completionPercent>=0&&row.completionPercent<=100));
 assert.deepEqual(parseDubaiStatusCsv('a,b\n"one, two","a""b"\n'),[['a','b'],['one, two','a"b']]);
});

test('read-only Dubai API keeps republisher, date, inspection and identity limits visible',async()=>{
 const list=await mapDubaiProjectStatus(request('?limit=2'),report,normalizedPacked,crosswalk),body=await list.json();
 assert.equal(list.status,200);assert.equal(body.totalProjects,3871);assert.equal(body.projects.length,2);
 assert.equal(body.source.republisher,'Continental Club Property LLC');
 assert.equal(body.source.sourcePublicationDate,'2026-11-01');
 assert.equal(body.source.rawSha256,report.rawSha256);
 assert.equal(body.scope.canonicalProjectMatches,23);
 assert.equal(body.scope.crosswalkVersion,crosswalk.version);
 assert.equal(body.scope.projectCoordinatesPresent,false);
 assert.equal(body.projects[0].sourceProjectNumber,'2');
 const detail=await (await mapDubaiProjectStatus(request('/4591'),report,normalizedPacked,crosswalk)).json();
 assert.equal(detail.project.name,'Melograno Yards By Beyond');
 assert.equal(detail.project.declaredHandoverDate,'2029-06-30');
 assert.equal(detail.project.canonicalProjectId,null);
 const reviewed=await (await mapDubaiProjectStatus(request('/3519'),report,normalizedPacked,crosswalk)).json();
 assert.equal(reviewed.project.canonicalProjectId,'project:olaia-residences-by-gulf-house-real-estate');
 assert.equal(reviewed.project.matchStatus,'reviewed_one_to_one');
 assert.equal(reviewed.project.coordinates,null);
 const filtered=await (await mapDubaiProjectStatus(request('?q=Melograno%20Yards&community=Wadi%20Al%20Safa%204'),report,normalizedPacked,crosswalk)).json();
 assert.equal(filtered.totalProjects,1);
 assert.equal((await mapDubaiProjectStatus(request('?limit=0'),report,normalizedPacked,crosswalk)).status,400);
 assert.equal((await mapDubaiProjectStatus(request('','POST'),report,normalizedPacked,crosswalk)).status,405);
 assert.equal((await mapDubaiProjectStatus(request(),{...report,rawSha256:'0'.repeat(64)},normalizedPacked,crosswalk)).status,503);
 assert.equal((await mapDubaiProjectStatus(request(),report,normalizedPacked.slice(1),crosswalk)).status,503);
 assert.equal((await mapDubaiProjectStatus(request(),report,normalizedPacked,{...crosswalk,sourceRawSha256:'0'.repeat(64)})).status,503);
 assert.equal((await mapDubaiProjectStatus(request(),report,normalizedPacked,crosswalk)).status,200);
 assert.equal((await mapDubaiProjectStatus(request('','HEAD'),report,normalizedPacked,crosswalk)).body,null);
});

test('compiled Worker serves the attributed register and keeps raw source private',async()=>{
 const env={DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'dubai-source-test'}};
 const response=await worker.fetch(request('?q=Jumeirah%20Business%20Centre%205'),env,{}),body=await response.json();
 assert.equal(response.status,200);
 assert.equal(response.headers.get('x-espacios-evidence-source'),report.sourceId);
 assert.equal(body.totalProjects,1);
 assert.equal(body.scope.canonicalProjectMatches,23);
 assert.equal(body.projects[0].sourceProjectNumber,'2');
 const asset=await worker.fetch(new Request('https://espacios.me/map/dld-project-status-20261101.csv.gz'),env,{});
 assert.equal(asset.status,404);
});
