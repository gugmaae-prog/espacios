import test from 'node:test';
import assert from 'node:assert/strict';
import {loadUaeIdriveStorage} from '../scripts/verify-uae-idrive-storage.mjs';
import {mapUaeEvidenceStorage} from '../src/stack-audit/uae-evidence-storage.mjs';
import worker from '../src/worker.js';

test('all 42 published projections have source-matched, dated IDrive readback attestations',async()=>{
 const inventory=await loadUaeIdriveStorage();
 assert.equal(inventory.publishedSourceSnapshots,42);
 assert.equal(inventory.verifiedReplicaSnapshots,42);
 assert.deepEqual(inventory.unreplicatedSourceIds,[]);
 assert.equal(inventory.byEmirate.length,7);
 assert.equal(new Set(inventory.sources.map(source=>source.id)).size,42);
 assert.equal(Object.values(inventory.replicas).reduce((sum,item)=>sum+item.objectCount,0),206);
 assert.equal(Object.values(inventory.replicas).reduce((sum,item)=>sum+item.totalBytes,0),108476586);
 assert.equal(inventory.sources.find(source=>source.id==='fcsc-emirates-in-figures-2009-historical-building-housing')?.replica?.attestationId,'federal-census-20261115-idrive-e2-readback');
 assert.equal(inventory.sources.find(source=>source.id==='fscfuj-construction-chapter-monthly-permits-2023-2025-20261114')?.replica?.attestationId,'fujairah-monthly-20261114-idrive-e2-readback');
 assert.equal(inventory.sources.find(source=>source.id==='sharjah-rerd-reported-monthly-market-20261114-supplement')?.replica?.attestationId,'sharjah-supplement-20261114-idrive-e2-readback');
 assert.equal(inventory.sources.find(source=>source.id==='ajman-mpd-20260901-new-building-licences')?.replica?.attestationId,'ajman-new-building-permissions-idrive-e2-readback-20261114');
 assert.equal(inventory.sources.find(source=>source.id==='scad-abu-dhabi-census-2024-real-estate-stock')?.replica?.role,'verified_private_replica_not_runtime_primary');
 assert.equal(inventory.publisherListingInventory.availability,'publisher_listed_at_capture_unverified_now');
 assert.equal(inventory.publisherListingInventory.sourceId,'rgestate-full-index-20261114');
 assert.equal(inventory.publisherListingInventory.replicaAttestationId,'rgestate-20261114-idrive-e2-readback');
});

test('compiled Worker keeps the federal source in emirate-filtered storage results',async()=>{
 const response=await worker.fetch(new Request('https://espacios.me/map/api/uae-evidence/storage?emirate=Dubai'),{DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'storage-filter-test'}},{});
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.sources.length,10);
 assert.equal(body.sources.filter(source=>source.geographicScope==='all_seven_emirates').length,1);
});

test('storage endpoint filters the attested inventory and keeps the archive proof scoped',async()=>{
 const inventory=await loadUaeIdriveStorage();
 const runtime={storagePolicy:{primary:'idrive_e2',fallback:'immutable_static_recovery'}};
 const url='https://espacios.me/map/api/uae-evidence/storage';
 const selected=mapUaeEvidenceStorage(new Request(url+'?sourceId=scad-abu-dhabi-census-2024-real-estate-stock'),inventory,runtime);
 assert.equal(selected.status,200);
 const body=await selected.json();
 assert.equal(body.sources.length,1);
 assert.equal(body.sources[0].emirate,'Abu Dhabi');
 const byEmirate=mapUaeEvidenceStorage(new Request(url+'?emirate=Dubai'),inventory,runtime);
 assert.equal(byEmirate.status,200);
 const dubai=await byEmirate.json();
 assert.equal(dubai.sources.length,inventory.byEmirate.find(row=>row.name==='Dubai').publishedSourceSnapshots+1);
 assert.equal(dubai.sources.filter(source=>source.geographicScope==='all_seven_emirates').length,1);
 assert.equal((await mapUaeEvidenceStorage(new Request(url+'?emirate=Dubai&sourceId=fcsc-emirates-in-figures-2009-historical-building-housing'),inventory,runtime).json()).sources.length,1);
 assert.equal(body.acceptedV48Archive.configuredPrimary,'idrive_e2');
 assert.match(body.acceptedV48Archive.proofScope,/not whole-store health/);
 assert.match(body.limits,/not complete authority archives/);
 assert.equal(mapUaeEvidenceStorage(new Request(url+'?sourceId=unknown'),inventory,runtime).status,400);
 assert.equal(mapUaeEvidenceStorage(new Request(url,{method:'POST'}),inventory,runtime).status,405);
 assert.equal(mapUaeEvidenceStorage(new Request(url,{method:'HEAD'}),inventory,runtime).body,null);
});
