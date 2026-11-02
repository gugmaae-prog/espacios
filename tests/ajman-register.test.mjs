import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {mapAjmanRegister} from '../src/stack-audit/ajman-register.mjs';

const root=new URL('../',import.meta.url);
const report=JSON.parse(await fs.readFile(new URL('data/uae-evidence/ajman/projects-validation.json',root),'utf8'));
const crosswalk=JSON.parse(await fs.readFile(new URL('data/uae-evidence/ajman/reviewed-v48-crosswalk.json',root),'utf8'));
const compressed=await fs.readFile(new URL('data/uae-evidence/ajman/real-estate-projects-20260826.json.gz',root));
const req=(path='',method='GET')=>new Request('https://espacios.me/map/api/uae-evidence/ajman/register'+path,{method});
const env={MAP_IDRIVE_READY:'true',MAP_EVIDENCE:{}};
const store=()=>({get:async key=>key===report.storageKey?{sha256:report.compressedSha256,size:compressed.length,arrayBuffer:async()=>compressed.buffer.slice(compressed.byteOffset,compressed.byteOffset+compressed.byteLength)}:null});

test('Ajman register requires verified private source even when cache is warm',async()=>{
 assert.equal((await mapAjmanRegister(req(),{...env,MAP_EVIDENCE:null},report,store)).status,503);
 assert.equal((await mapAjmanRegister(req(),env,report,store)).status,200);
 assert.equal((await mapAjmanRegister(req(),{...env,MAP_IDRIVE_READY:'false'},report,store)).status,503);
});
test('latest snapshot and historical source IDs remain distinct without a reviewed crosswalk',async()=>{
 const latest=await (await mapAjmanRegister(req(),env,report,store)).json();
 assert.equal(latest.source.rows,3457);
 assert.equal(latest.source.distinctSourceProjectIds,364);
 assert.equal(latest.source.latestSnapshotProjectIds,298);
 assert.equal(latest.totalProjects,298);
 assert.equal(latest.projects.length,50);
 assert.ok(latest.projects.every(row=>row.inLatestSnapshot&&row.canonicalProjectId===null&&row.coordinates===null));
 const all=await (await mapAjmanRegister(req('?scope=all&limit=100'),env,report,store)).json();
 assert.equal(all.totalProjects,364);
 assert.equal(all.source.notInLatestSnapshotProjectIds,66);
});
test('three reviewed source IDs link to V48 identity without borrowing map coordinates or timeline',async()=>{
 const list=await (await mapAjmanRegister(req('?q=SEALINE%20RESIDENCE'),env,report,store,crosswalk)).json();
 assert.equal(list.scope.canonicalProjectMatches,3);
 assert.equal(list.scope.unmatchedLatestSourceProjectIds,295);
 assert.equal(list.totalProjects,1);
 assert.equal(list.projects[0].sourceProjectId,501);
 assert.equal(list.projects[0].canonicalProjectId,'project:sealine-residence-by-al-zorah-development-in-al-zorah-city');
 assert.equal(list.projects[0].matchStatus,'reviewed_one_to_one_identity');
 assert.equal(list.projects[0].coordinates,null);
 for(const [id,canonical] of [[416,'project:seaside-hills-residence-by-al-zorah-development-company-in-al-zorah-ajman'],[528,'project:barajeel-towers-rashidiya-1-ajman-uae']]){
  const detail=await (await mapAjmanRegister(req('/'+id),env,report,store,crosswalk)).json();
  assert.equal(detail.history[0].canonicalProjectId,canonical);
  assert.equal(detail.history[0].coordinates,null);
 }
 const unmatched=await (await mapAjmanRegister(req('/493'),env,report,store,crosswalk)).json();
 assert.equal(unmatched.history[0].canonicalProjectId,null);
 assert.equal(unmatched.history[0].matchStatus,'unmatched');
 assert.equal((await mapAjmanRegister(req(),env,report,store,{...crosswalk,sourceRawSha256:'0'.repeat(64)})).status,503);
});
test('source snapshots are searchable and unknown unit counts are never numeric guesses',async()=>{
 const search=await (await mapAjmanRegister(req('?q=AL%20AMEERA%20C2'),env,report,store)).json();
 assert.equal(search.totalProjects,1);
 assert.equal(search.projects[0].sourceProjectId,493);
 assert.equal(search.projects[0].reportedUnitCount,null);
 assert.deepEqual(search.projects[0].sourceFieldWarnings,['unit_count_unknown']);
 assert.equal(Object.hasOwn(search.projects[0],'escrow_account_number'),false);
 const detail=await (await mapAjmanRegister(req('/493'),env,report,store)).json();
 assert.equal(detail.sourceProjectId,493);
 assert.equal(detail.inLatestSnapshot,true);
 assert.ok(detail.history.length>=1);
 const old=await (await mapAjmanRegister(req('?scope=all&limit=100&offset=298'),env,report,store)).json();
 assert.equal(old.projects.length,66);
});
test('register filters and routes fail closed',async()=>{
 assert.equal((await mapAjmanRegister(req('?scope=unknown'),env,report,store)).status,400);
 assert.equal((await mapAjmanRegister(req('?limit=101'),env,report,store)).status,400);
 assert.equal((await mapAjmanRegister(req('/999999'),env,report,store)).status,404);
 assert.equal((await mapAjmanRegister(req('','POST'),env,report,store)).status,405);
 assert.equal(await mapAjmanRegister(new Request('https://espacios.me/map/api/uae-evidence'),env,report,store),null);
});
