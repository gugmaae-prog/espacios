import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';
import {mapDubaiMunicipalProjects} from '../src/stack-audit/dubai-municipal-projects.mjs';

globalThis.crypto??=webcrypto;
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(await fs.readFile(new URL('data/uae-evidence/dubai/dm-municipal-projects-20261026/manifest.json',root)));
const base='https://espacios.me/map/api/uae-evidence/dubai/municipal-projects';
const assets={fetch:async request=>{
 const hash=new URL(request.url).pathname.split('/').at(-1).replace(/\.bin$/,'');
 const shard=manifest.shards.find(item=>item.sha256===hash);
 if(!shard)return new Response('Missing',{status:404});
 return new Response(await fs.readFile(new URL('data/uae-evidence/dubai/dm-municipal-projects-20261026/'+shard.file,root)));
}};
const call=(suffix='',method='GET',store=assets)=>mapDubaiMunicipalProjects(new Request(base+suffix,{method}),manifest,store);

test('all official project and link partitions are pinned and redacted',async()=>{
 assert.equal(manifest.projectRows,481358);
 assert.equal(manifest.linkRows,208946);
 assert.equal(manifest.shards.length,49);
 assert.equal(manifest.shards.reduce((n,item)=>n+item.projects,0),manifest.projectRows);
 assert.equal(manifest.shards.reduce((n,item)=>n+item.links,0),manifest.linkRows);
 assert.equal(manifest.sources[0].withheldFields.length,9);
 assert.equal(manifest.idriveReplicaVerified,false);
 for(const shard of manifest.shards){
  const bytes=await fs.readFile(new URL('data/uae-evidence/dubai/dm-municipal-projects-20261026/'+shard.file,root));
  assert.equal(bytes.length,shard.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),shard.sha256);
 }
});

test('read-only API labels storage, preserves conflicts, and pages exact projects',async()=>{
 const summary=await (await call('?view=summary')).json();
 assert.equal(summary.scope.projectRows,481358);
 assert.equal(summary.scope.linkRows,208946);
 assert.equal(summary.scope.dldProjectIdentityVerified,false);
 assert.equal(summary.scope.coordinatesPresent,false);
 assert.equal(summary.source.idriveReplicaVerified,false);
 const first=await (await call('?limit=3')).json();
 assert.equal(first.rows.length,3);
 assert.equal(Object.keys(first.rows[0]).length,10);
 assert.ok(first.nextCursor);
 const second=await (await call('?limit=3&cursor='+first.nextCursor)).json();
 assert.notEqual(first.rows[0].project_no,second.rows[0].project_no);
 const conflict=await (await call('/14738')).json();
 assert.equal(conflict.project.project_no,'14738');
 assert.ok(conflict.buildings.some(row=>row.building_id==='87836'&&row.conflictsWithBuildingCardProjectNo));
 assert.equal(conflict.source.storage,'checksum_verified_immutable_worker_assets');
 assert.equal((await call('/14738','HEAD')).body,null);
});

test('bad filters, absent IDs and damaged assets fail honestly',async()=>{
 assert.equal((await call('?limit=101')).status,400);
 assert.equal((await call('?q=marina')).status,400);
 assert.equal((await call('?cursor=9999:0')).status,400);
 assert.equal((await call('/9999999999')).status,404);
 assert.equal((await call('', 'POST')).status,405);
 assert.equal((await call('/14738','GET',{fetch:async()=>new Response('Bad bytes')})).status,503);
});
