import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {normalizeDubaiStatusCsv,parseDubaiStatusCsv,mapDubaiProjectStatus} from '../src/stack-audit/dubai-project-status.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url);
const report=JSON.parse(await fs.readFile(new URL('data/uae-evidence/dubai/dld-project-status-validation.json',root)));
const crosswalk=JSON.parse(await fs.readFile(new URL('data/uae-evidence/dubai/reviewed-v48-crosswalk.json',root)));
const reconciliation=JSON.parse(await fs.readFile(new URL('data/uae-evidence/dubai/dld-project-status-20261114-reconciliation.json',root)));
const previousCaptured=await fs.readFile(new URL('data/uae-evidence/dubai/dld-project-status-20261101.csv.gz',root));
const captured=await fs.readFile(new URL('data/uae-evidence/dubai/dld-project-status-20261114.csv.gz',root));
const normalizedArtifact=await fs.readFile(new URL('data/uae-evidence/dubai/dld-project-status-20261114.normalized.json.gz',root));
const raw=gunzipSync(captured),rows=normalizeDubaiStatusCsv(raw.toString('utf8'),report);
const normalized=Buffer.from(JSON.stringify(rows)),normalizedPacked=normalizedArtifact.toString('base64');
const sha=value=>createHash('sha256').update(value).digest('hex');
const request=(suffix='',method='GET')=>new Request('https://espacios.me/map/api/uae-evidence/dubai/project-status'+suffix,{method});

test('licensed 14 November source capture survives byte, schema and identity checks',()=>{
 assert.equal(sha(captured),report.compressedSha256);
 assert.equal(sha(raw),report.rawSha256);
 assert.equal(report.independentReadbackSha256,report.rawSha256);
 assert.equal(rows.length,3882);
 assert.equal(new Set(rows.map(row=>row.sourceProjectNumber)).size,3882);
 assert.equal(new Set(rows.map(row=>row.name)).size,3863);
 assert.equal(report.actualCsvFieldCount,14);
 assert.equal(report.sourcePageClaimedFieldCount,16);
 assert.equal(report.sourcePageClaimedRowCount,3883);
 assert.equal(sha(normalized),report.normalizedSha256);
 assert.equal(sha(normalizedArtifact),report.normalizedCompressedSha256);
 assert.ok(gunzipSync(normalizedArtifact).equals(normalized));
 assert.ok(rows.every(row=>row.canonicalProjectId===null&&row.coordinates===null&&row.completionPercent>=0&&row.completionPercent<=100));
 assert.equal(reconciliation.previousRows,3871);
 assert.equal(reconciliation.currentRows,3882);
 assert.equal(reconciliation.addedProjectNumbers.length,11);
 assert.equal(reconciliation.removedProjectNumbers.length,0);
 assert.equal(reconciliation.changedExistingRows,684);
 assert.equal(reconciliation.changedFieldRows.land_number,535);
 assert.equal(reconciliation.retainedReviewedIdentityLinks,83);
 assert.deepEqual(reconciliation.reviewedIdentityFieldChanges,[]);
 assert.deepEqual(parseDubaiStatusCsv('a,b\n"one, two","a""b"\n'),[['a','b'],['one, two','a"b']]);
});

test('source reconciliation is computed from both retained CSV vintages',()=>{
 const previous=parseDubaiStatusCsv(gunzipSync(previousCaptured).toString('utf8'));
 const current=parseDubaiStatusCsv(raw.toString('utf8'));
 assert.deepEqual(current[0],previous[0]);
 const fields=current[0],prior=new Map(previous.slice(1).map(row=>[row[0],row])),next=new Map(current.slice(1).map(row=>[row[0],row]));
 const added=[...next.keys()].filter(id=>!prior.has(id)).sort((a,b)=>Number(a)-Number(b));
 const removed=[...prior.keys()].filter(id=>!next.has(id));
 let changed=0;const fieldCounts={};
 for(const [id,row] of next){const old=prior.get(id);if(!old)continue;let differs=false;for(let i=0;i<fields.length;i++)if(row[i]!==old[i]){differs=true;fieldCounts[fields[i]]=(fieldCounts[fields[i]]||0)+1;}if(differs)changed++;}
 assert.deepEqual(added,reconciliation.addedProjectNumbers);
 assert.deepEqual(removed,reconciliation.removedProjectNumbers);
 assert.equal(changed,reconciliation.changedExistingRows);
 assert.deepEqual(fieldCounts,reconciliation.changedFieldRows);
});

test('read-only Dubai API keeps republisher, date, inspection and identity limits visible',async()=>{
 const list=await mapDubaiProjectStatus(request('?limit=2'),report,normalizedPacked,crosswalk),body=await list.json();
 assert.equal(list.status,200);assert.equal(body.totalProjects,3882);assert.equal(body.projects.length,2);
 assert.equal(body.source.republisher,'Continental Club Property LLC');
 assert.equal(body.source.sourcePublicationDate,'2026-11-14');
 assert.equal(body.source.rawSha256,report.rawSha256);
 assert.equal(body.source.rowCount,3882);
 assert.equal(body.source.sourcePageClaimedRowCount,3883);
 assert.equal(body.scope.canonicalProjectMatches,83);
 assert.deepEqual(body.scope.derivedDateReview,{basis:'The dated source CSV; review flags do not revise source dates or establish actual delivery.',declaredBeforeRegisteredStart:11,declaredBeforeIncompleteInspection:243,projectsWithFlags:254});
 assert.equal(body.scope.crosswalkVersion,crosswalk.version);
 assert.equal(body.scope.projectCoordinatesPresent,false);
 assert.match(body.scope.limits,/land-number field is a truncated source display/);
 assert.equal(body.projects[0].sourceProjectNumber,'2');
 const added=await (await mapDubaiProjectStatus(request('/4614'),report,normalizedPacked,crosswalk)).json();
 assert.equal(added.project.name,'Solaya (8,9)');
 assert.equal(added.project.canonicalProjectId,null);
 const detail=await (await mapDubaiProjectStatus(request('/4591'),report,normalizedPacked,crosswalk)).json();
 assert.equal(detail.project.name,'Melograno Yards By Beyond');
 assert.equal(detail.project.declaredHandoverDate,'2029-06-30');
 assert.equal(detail.project.canonicalProjectId,null);
 const reviewed=await (await mapDubaiProjectStatus(request('/3519'),report,normalizedPacked,crosswalk)).json();
 assert.equal(reviewed.project.canonicalProjectId,'project:olaia-residences-by-gulf-house-real-estate');
 assert.equal(reviewed.project.matchStatus,'reviewed_one_to_one');
 assert.equal(reviewed.project.coordinates,null);
 const jvc=await (await mapDubaiProjectStatus(request('/2232'),report,normalizedPacked,crosswalk)).json();
 assert.equal(jvc.project.canonicalProjectId,'project:binghatti-gate-jvc-apartments-in-jumeirah-village-circle-for-sale-in-dubai');
 assert.equal(jvc.project.community,'Al Barsha South Fourth');
 assert.equal(jvc.project.coordinates,null);
 const emaar=await (await mapDubaiProjectStatus(request('/3032'),report,normalizedPacked,crosswalk)).json();
 assert.equal(emaar.project.canonicalProjectId,'project:greenway-by-emaar-properties-in-emaar-south-dubai');
 assert.equal(emaar.project.community,'Madinat Al Mataar');
 assert.equal(emaar.project.coordinates,null);
 const nshama=await (await mapDubaiProjectStatus(request('/4150'),report,normalizedPacked,crosswalk)).json();
 assert.equal(nshama.project.canonicalProjectId,'project:evelyn-on-the-park-nshama-town-square-dubai');
 assert.equal(nshama.project.community,'Al Yelayiss 2');
 assert.equal(nshama.project.coordinates,null);
 for(const [number,id] of [['4142','project:divine-elements-takmeel-dubai-south'],['4300','project:windsor-house-ii-ellington-dubai-south'],['4482','project:binghatti-wraith-al-jaddaf-dubai'],['4503','project:113-residences-iman-developers-al-sufouh-dubai']]){
  const linked=await (await mapDubaiProjectStatus(request('/'+number),report,normalizedPacked,crosswalk)).json();
  assert.equal(linked.project.canonicalProjectId,id);
  assert.equal(linked.project.matchStatus,'reviewed_one_to_one');
  assert.equal(linked.project.coordinates,null);
 }
 for(const [number,id] of [['1946','project:south-living-by-dubai-south-in-dubai-south-dubai'],['2550','project:sobha-seahaven-dubai-marina-apartments-for-sale'],['3328','project:marina-cove-by-emaar-properties-in-dubai-marina'],['3393','project:rove-home-dubai-marina-irth-group-dubai-marina']]){
  const linked=await (await mapDubaiProjectStatus(request('/'+number),report,normalizedPacked,crosswalk)).json();
  assert.equal(linked.project.canonicalProjectId,id);
  assert.equal(linked.project.matchStatus,'reviewed_one_to_one');
  assert.equal(linked.project.coordinates,null);
 }
 const stale=await (await mapDubaiProjectStatus(request('/1946'),report,normalizedPacked,crosswalk)).json();
 assert.deepEqual(stale.project.dateReviewFlags,['declared_handover_before_incomplete_inspection']);
 assert.equal(stale.project.declaredHandoverDate,'2020-02-05');
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
 assert.equal(body.scope.canonicalProjectMatches,83);
 assert.equal(body.projects[0].sourceProjectNumber,'2');
 const asset=await worker.fetch(new Request('https://espacios.me/map/dld-project-status-20261114.csv.gz'),env,{});
 assert.equal(asset.status,404);
});
