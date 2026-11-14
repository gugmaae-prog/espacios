import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';
import {mapDubaiBuildingCards} from '../src/stack-audit/dubai-building-cards.mjs';
import {loadDubaiIdriveReplica} from '../scripts/idrive-dubai-upload/verify-attestation.mjs';

globalThis.crypto??=webcrypto;
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(await fs.readFile(new URL('data/uae-evidence/dubai/dm-building-cards-20261026/manifest.json',root)));
const base='https://espacios.me/map/api/uae-evidence/dubai/building-cards';
const assets={fetch:async request=>{
 const hash=new URL(request.url).pathname.split('/').at(-1).replace(/\.bin$/,'');
 const shard=manifest.shards.find(item=>item.sha256===hash);
 if(!shard)return new Response('Missing',{status:404});
 return new Response(await fs.readFile(new URL('data/uae-evidence/dubai/dm-building-cards-20261026/'+shard.file,root)),{headers:{'content-type':'application/octet-stream'}});
}};
const call=async (suffix='',method='GET',store=assets)=>mapDubaiBuildingCards(new Request(base+suffix,{method}),manifest,store);

test('full source partitions preserve all building IDs and fields',async()=>{
 assert.equal(manifest.sourceRows,536946);
 assert.equal(manifest.uniqueBuildingIds,536946);
 assert.equal(manifest.sourceFields.length,38);
 assert.equal(manifest.shards.length,96);
 assert.equal(manifest.shards.reduce((sum,shard)=>sum+shard.rows,0),manifest.sourceRows);
 assert.equal(manifest.idriveReplicaVerified,false);
 for(const shard of manifest.shards){
  const bytes=await fs.readFile(new URL('data/uae-evidence/dubai/dm-building-cards-20261026/'+shard.file,root));
  assert.equal(bytes.length,shard.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),shard.sha256);
 }
});

test('read-only API returns source labels, pages, detail, and stable cursor',async()=>{
 const summary=await (await call('?view=summary')).json();
 assert.equal(summary.totalRows,536946);
 assert.equal(summary.source.evidenceClass,'official_permit_system_building_card_snapshot');
 assert.equal(summary.scope.availableUnits,false);
 assert.equal(summary.scope.coordinatesPresent,false);
 const first=await (await call('?limit=3')).json();
 assert.equal(first.rows.length,3);
 assert.equal(first.rows[0]&&Object.keys(first.rows[0]).length,38);
 assert.ok(first.nextCursor);
 const second=await (await call('?limit=3&cursor='+first.nextCursor)).json();
 assert.equal(second.rows.length,3);
 assert.notEqual(first.rows[0].building_id,second.rows[0].building_id);
 const id=await (await call('/87558')).json();
 assert.equal(id.record.building_id,'87558');
 assert.equal(id.record.building_type_english,'Private Villa');
 assert.equal(id.source.storage,'checksum_verified_immutable_worker_assets');
 const firstShard=manifest.shards[0],edge=await (await call(`?limit=3&cursor=${firstShard.bucket}:${firstShard.rows-1}`)).json();
 assert.equal(edge.rows.length,1);
 assert.equal(edge.nextCursor,`${manifest.shards[1].bucket}:0`);
});

test('verified IDrive copy is labelled as a replica while Worker assets still serve the API',async()=>{
 const replica=await loadDubaiIdriveReplica();
 const result=await mapDubaiBuildingCards(new Request(base+'?view=summary'),{...manifest,...replica},assets);
 const body=await result.json();
 assert.equal(body.source.storage,'checksum_verified_immutable_worker_assets');
 assert.equal(body.source.idriveReplicaVerified,true);
 assert.equal(body.source.idriveReplicaAttestationId,'dubai-municipality-idrive-e2-readback-20261114');
 assert.equal(body.totalRows,536946);
});

test('invalid filters and broken storage fail without invented records',async()=>{
 assert.equal((await call('?limit=101')).status,400);
 assert.equal((await call('?q=marina')).status,400);
 assert.equal((await call('?cursor=9999:0')).status,400);
 assert.equal((await call('/9999999999')).status,404);
 assert.equal((await call('', 'POST')).status,405);
 assert.equal((await call('/87558','GET',{fetch:async()=>new Response('Bad bytes')})).status,503);
});
