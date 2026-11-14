import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const ROOT=new URL('../../',import.meta.url);
const read=async name=>fs.readFile(new URL(name,ROOT));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

export async function loadDubaiIdriveReplica(){
 const [planBytes,reportBytes,cardsBytes,projectsBytes]=await Promise.all([
  read('data/uae-evidence/dubai/idrive-e2-replica-plan-20261114.json'),
  read('data/uae-evidence/dubai/idrive-e2-replica-readback-20261114.json'),
  read('data/uae-evidence/dubai/dm-building-cards-20261026/manifest.json'),
  read('data/uae-evidence/dubai/dm-municipal-projects-20261026/manifest.json'),
 ]);
 const plan=JSON.parse(planBytes),report=JSON.parse(reportBytes),cards=JSON.parse(cardsBytes),projects=JSON.parse(projectsBytes);
 if(plan.status!=='prepared_not_uploaded'||plan.accountId!=='b1b843ec85bc39a3a4d370ba4f84f17a'||plan.bucket!=='espacios-store-a'||plan.prefix!=='espacios-map/uae-evidence/dubai/20261026/'||plan.objectCount!==155||plan.objects?.length!==155||plan.publishedProjectionObjects!==145||plan.privateOriginalPartObjects!==10||plan.originalAssemblies?.length!==3)throw Error('Dubai IDrive transfer scope changed');
 if(report.attestationId!=='dubai-municipality-idrive-e2-readback-20261114'||report.planId!==plan.planId||report.planSha256!==sha(planBytes)||report.bucket!==plan.bucket||report.prefix!==plan.prefix||report.objectCount!==155||report.totalBytes!==plan.totalBytes||report.publishedProjectionObjects!==145||report.privateOriginalPartObjects!==10||report.originalSourceCount!==3||report.allObjectsVerified!==true||report.productionTrafficChangedByCopy!==false||!/^[a-f0-9]{64}$/.test(report.privateJournalSha256)||!/^[a-f0-9]{64}$/.test(report.bridgeSha256)||!Number.isFinite(Date.parse(report.verifiedAt)))throw Error('Dubai IDrive readback attestation invalid');
 if(plan.sourceManifests.buildingCardsSha256!==sha(cardsBytes)||plan.sourceManifests.municipalProjectsSha256!==sha(projectsBytes))throw Error('Dubai source manifest changed after IDrive copy');
 const entries=new Map(plan.objects.map(item=>[item.idriveKey,item]));
 if(entries.size!==155||plan.objects.reduce((n,item)=>n+item.bytes,0)!==plan.totalBytes)throw Error('Dubai IDrive object inventory changed');
 for(const [name,manifest] of [['building-cards',cards],['municipal-projects',projects]])for(const shard of manifest.shards){
  const key=plan.prefix+name+'/published/'+shard.sha256+'.json.gz',item=entries.get(key);
  if(!item||item.kind!=='published_projection'||item.sourceId!==manifest.sourceId||item.bytes!==shard.bytes||item.sha256!==shard.sha256)throw Error('Dubai IDrive shard coverage mismatch');
 }
 const originals=plan.objects.filter(item=>item.kind==='private_original_part');
 if(originals.length!==10||plan.objects.filter(item=>item.kind==='published_projection').length!==145)throw Error('Dubai IDrive source-part coverage mismatch');
 const expectedOriginals=new Map([[cards.sourceId,cards.sourceSha256],...projects.sources.map(item=>[item.id,item.sha256])]);
 if(expectedOriginals.size!==3||plan.originalAssemblies.some(assembly=>expectedOriginals.get(assembly.sourceId)!==assembly.originalSha256))throw Error('Dubai IDrive original-source identity mismatch');
 for(const assembly of plan.originalAssemblies)for(const [index,key] of assembly.partKeysInOrder.entries()){
  const item=entries.get(key);
  if(!item||item.kind!=='private_original_part'||item.partIndex!==index||item.sourceId!==assembly.sourceId||item.originalSha256!==assembly.originalSha256||item.packedSha256!==assembly.packedSha256)throw Error('Dubai original source assembly changed');
 }
 return {idriveReplicaVerified:true,idriveReplicaAttestationId:report.attestationId,idriveReplicaVerifiedAt:report.verifiedAt,idriveReplicaObjectCount:report.objectCount,idriveReplicaBytes:report.totalBytes,idriveReplicaAttestationSha256:sha(reportBytes)};
}

if(process.argv[1]&&new URL('file://'+process.argv[1]).href===import.meta.url){
 loadDubaiIdriveReplica().then(value=>console.log(JSON.stringify(value))).catch(error=>{console.error(error.message);process.exitCode=1;});
}
