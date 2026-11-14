import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {verifyAttestation as verifyPublishedReplica} from './idrive-published-upload/transfer.mjs';
import {verifyAttestation as verifyAjmanPermissionReplica} from './idrive-ajman-permissions-upload/transfer.mjs';
import {verifyAttestation as verifyCurrentReplica} from './idrive-current-evidence-upload/transfer.mjs';
import {verifyAttestation as verifyRgestateRefresh} from './idrive-rgestate-refresh-upload/transfer.mjs';
import {loadDubaiIdriveReplica} from './idrive-dubai-upload/verify-attestation.mjs';

const ROOT=new URL('../',import.meta.url);
const read=async name=>JSON.parse(await fs.readFile(new URL(name,ROOT),'utf8'));
const DM_IDS=['dm-building-summary-information-20261026','dm-municipal-projects-and-building-links-20261026'];

export async function loadUaeIdriveStorage(){
 const [coverage,published,ajmanPermissions,current,dm,rgestateRefresh]=await Promise.all([
  read('data/uae-evidence/coverage-validation.json'),verifyPublishedReplica(),verifyAjmanPermissionReplica(),verifyCurrentReplica(),loadDubaiIdriveReplica(),verifyRgestateRefresh()
 ]);
 const publishedIds=new Set(published.sourceIds),ajmanPermissionIds=new Set(ajmanPermissions.sourceIds),currentIds=new Set(current.sourceIds),dmIds=new Set(DM_IDS);
 const sources=coverage.emirates.flatMap(emirate=>emirate.publishedSources.map(source=>{
  const replica=ajmanPermissionIds.has(source.id)?ajmanPermissions:publishedIds.has(source.id)?published:currentIds.has(source.id)?current:dmIds.has(source.id)?{attestationId:dm.idriveReplicaAttestationId,verifiedAt:dm.idriveReplicaVerifiedAt}:null;
  return {id:source.id,emirate:emirate.name,sourceRows:source.sourceRows,sourceVintage:source.sourceVintage,route:source.route,replica:replica?{attestationId:replica.attestationId,verifiedAt:replica.verifiedAt,role:'verified_private_replica_not_runtime_primary'}:null};
 }));
 const ids=new Set(sources.map(source=>source.id));
 if(sources.length!==40||ids.size!==40||coverage.version!=='20261114-uae-evidence-coverage-v44'||published.sourceInventoryVersion!=='20261114-uae-evidence-coverage-v42'||ajmanPermissions.sourceInventoryVersion!=='20261114-uae-evidence-coverage-v43'||published.sourceIds.length!==34||ajmanPermissions.sourceIds.length!==2||dm.idriveReplicaObjectCount!==155||current.objectCount!==6||published.objectCount!==37||ajmanPermissions.objectCount!==2||rgestateRefresh.objectCount!==3)throw Error('Published evidence storage inventory changed');
 if(JSON.stringify(rgestateRefresh.sourceIds)!==JSON.stringify(['rgestate-full-index-20261114','rgestate-commercial-category-20261114','rgestate-commercial-title-candidates-20261114'])||coverage.publisherListingInventory.sourceId!==rgestateRefresh.sourceIds[0])throw Error('RGEstate replica source identity mismatch');
 if(published.sourceIds.some(id=>!ids.has(id))||ajmanPermissions.sourceIds.some(id=>!ids.has(id)||publishedIds.has(id)||currentIds.has(id)||dmIds.has(id))||DM_IDS.some(id=>!ids.has(id))||current.sourceIds.filter(id=>ids.has(id)).length!==2)throw Error('Replica source identity mismatch');
 const covered=sources.filter(source=>source.replica).length;
 const byEmirate=coverage.emirates.map(emirate=>({name:emirate.name,publishedSourceSnapshots:emirate.publishedSources.length,verifiedReplicaSnapshots:sources.filter(source=>source.emirate===emirate.name&&source.replica).length}));
 return {
  inventoryVersion:coverage.version,
  evidenceScope:'dated_published_evidence_projections_not_complete_uae_source_universe',
  publishedSourceSnapshots:sources.length,
  verifiedReplicaSnapshots:covered,
  unreplicatedSourceIds:sources.filter(source=>!source.replica).map(source=>source.id),
  byEmirate,
  sources,
  replicas:{published:{attestationId:published.attestationId,verifiedAt:published.verifiedAt,objectCount:published.objectCount,totalBytes:published.totalBytes},ajmanPermissions:{attestationId:ajmanPermissions.attestationId,verifiedAt:ajmanPermissions.verifiedAt,objectCount:ajmanPermissions.objectCount,totalBytes:ajmanPermissions.totalBytes},current:{attestationId:current.attestationId,verifiedAt:current.verifiedAt,objectCount:current.objectCount,totalBytes:current.totalBytes},dubaiMunicipality:{attestationId:dm.idriveReplicaAttestationId,verifiedAt:dm.idriveReplicaVerifiedAt,objectCount:dm.idriveReplicaObjectCount,totalBytes:dm.idriveReplicaBytes},rgestateRefresh:{attestationId:rgestateRefresh.attestationId,verifiedAt:rgestateRefresh.verifiedAt,objectCount:rgestateRefresh.objectCount,totalBytes:rgestateRefresh.totalBytes}},
  publisherListingInventory:{sourceId:rgestateRefresh.sourceIds[0],snapshotRows:coverage.publisherListingInventory.snapshotRows,replicaAttestationId:rgestateRefresh.attestationId,verifiedAt:rgestateRefresh.verifiedAt,availability:'publisher_listed_at_capture_unverified_now'},
  limits:'The replica attestations prove exact signed readbacks at their stated times, not current whole-store health. These are published projections and selected facts, not complete authority archives, a complete UAE project census, verified unit coordinates, current listing availability, or a complete sale/rent history. The accepted V48 archive has a separate IDrive primary and immutable fallback.'
 };
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 loadUaeIdriveStorage().then(value=>console.log(JSON.stringify({inventoryVersion:value.inventoryVersion,publishedSourceSnapshots:value.publishedSourceSnapshots,verifiedReplicaSnapshots:value.verifiedReplicaSnapshots,unreplicatedSourceIds:value.unreplicatedSourceIds,replicaObjects:Object.values(value.replicas).reduce((sum,item)=>sum+item.objectCount,0),replicaBytes:Object.values(value.replicas).reduce((sum,item)=>sum+item.totalBytes,0)}))).catch(error=>{console.error(error.message);process.exitCode=1;});
}
