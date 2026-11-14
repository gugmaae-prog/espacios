import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output='data/uae-evidence/idrive-e2-runtime-allowlist-20261114.json';
const pairs=[
 ['data/uae-evidence/dubai/idrive-e2-replica-plan-20261114.json','data/uae-evidence/dubai/idrive-e2-replica-readback-20261114.json'],
 ['data/uae-evidence/idrive-e2-ajman-permissions-replica-plan-20261114.json','data/uae-evidence/idrive-e2-ajman-permissions-replica-readback-20261114.json'],
 ['data/uae-evidence/idrive-e2-current-replica-plan-20261114.json','data/uae-evidence/idrive-e2-current-replica-readback-20261114.json'],
 ['data/uae-evidence/idrive-e2-fujairah-monthly-plan-20261114.json','data/uae-evidence/idrive-e2-fujairah-monthly-readback-20261114.json'],
 ['data/uae-evidence/idrive-e2-published-replica-plan-20261114.json','data/uae-evidence/idrive-e2-published-replica-readback-20261114.json'],
 ['data/uae-evidence/idrive-e2-rgestate-refresh-plan-20261114.json','data/uae-evidence/idrive-e2-rgestate-refresh-readback-20261114.json'],
 ['data/uae-evidence/idrive-e2-sharjah-supplement-plan-20261114.json','data/uae-evidence/idrive-e2-sharjah-supplement-readback-20261114.json'],
];
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const read=async relative=>fs.readFile(path.join(root,relative));
const json=async relative=>JSON.parse((await read(relative)).toString());
const fail=message=>{throw Error(message)};

async function build(){
 const entries=[],attestations=[];let excludedPrivateOriginals=0;
 for(const [planPath,attestationPath] of pairs){
  const planBytes=await read(planPath),plan=JSON.parse(planBytes),attestation=await json(attestationPath);
  if(plan.accountId!=='b1b843ec85bc39a3a4d370ba4f84f17a'||plan.bucket!=='espacios-store-a'||plan.host&&plan.host!=='s3.us-west-2.idrivee2.com'||plan.signingRegion&&plan.signingRegion!=='us-east-1'||plan.status!=='prepared_not_uploaded')fail('Unexpected IDrive plan scope: '+planPath);
  if(!Array.isArray(plan.objects)||plan.objects.length!==plan.objectCount||plan.totalBytes!==plan.objects.reduce((n,o)=>n+o.bytes,0))fail('Invalid object count or byte sum: '+planPath);
  if(attestation.planId!==plan.planId||attestation.planSha256!==sha(planBytes)||attestation.objectCount!==plan.objectCount||attestation.totalBytes!==plan.totalBytes||attestation.bucket!==plan.bucket||attestation.allObjectsVerified!==true||attestation.runtimePrimaryChanged!==false||!Number.isFinite(Date.parse(attestation.verifiedAt)))fail('Readback attestation mismatch: '+attestationPath);
  attestations.push({planId:plan.planId,planSha256:sha(planBytes),attestationId:attestation.attestationId,verifiedAt:attestation.verifiedAt,objectCount:plan.objectCount});
  for(const object of plan.objects){
   if(!object.idriveKey?.startsWith('espacios-map/uae-evidence/')||!object.idriveKey.startsWith(plan.prefix)||!object.sourceId||!Number.isSafeInteger(object.bytes)||object.bytes<1||object.bytes>8*1024*1024||!/^[a-f0-9]{64}$/.test(object.sha256)||!['application/gzip','application/json'].includes(object.contentType))fail('Invalid planned object: '+planPath);
   // Original CSV parts stay private and are absent from clean Git checkouts.
   // Their full transfer was attested above; no runtime key is minted for them.
   if(object.idriveKey.includes('/originals/')){excludedPrivateOriginals++;continue;}
   const localPath=path.resolve(root,object.localPath||'');if(!localPath.startsWith(root+path.sep))fail('Object path escapes checkout');
   const local=await fs.readFile(localPath);if(local.byteLength!==object.bytes||sha(local)!==object.sha256)fail('Local object changed: '+object.localPath);
   entries.push({key:object.idriveKey,sourceId:object.sourceId,bytes:object.bytes,sha256:object.sha256,contentType:object.contentType,attestationId:attestation.attestationId});
  }
 }
 entries.sort((a,b)=>a.key.localeCompare(b.key));
 if(entries.length!==195||excludedPrivateOriginals!==10||new Set(entries.map(x=>x.key)).size!==entries.length)fail('Published/private object boundary changed');
 const coverage=await json('data/uae-evidence/coverage-validation.json');
 const sourceIds=new Set(entries.map(x=>x.sourceId)),coverageIds=new Set(coverage.emirates.flatMap(e=>e.publishedSources.map(s=>s.id)));
 if(coverageIds.size!==41||[...coverageIds].some(id=>!sourceIds.has(id)))fail('Published source coverage changed');
 return {version:'20261114-idrive-e2-runtime-allowlist-v1',accountId:'b1b843ec85bc39a3a4d370ba4f84f17a',bucket:'espacios-store-a',prefix:'espacios-map/uae-evidence/',scope:'Exact checksum-pinned private reads of published source objects only; no private originals or arbitrary keys',publishedObjectCount:entries.length,excludedPrivateOriginalParts:excludedPrivateOriginals,coveredInventoryVersion:coverage.version,coveredInventorySourceCount:coverageIds.size,attestations,entries};
}

const result=await build(),bytes=Buffer.from(JSON.stringify(result,null,2)+'\n');
if(process.argv.includes('--check')){
 if(!(await read(output)).equals(bytes))fail('Runtime allowlist differs from verified plans');
}else await fs.writeFile(path.join(root,output),bytes);
console.log(JSON.stringify({ok:true,publishedObjectCount:result.publishedObjectCount,excludedPrivateOriginalParts:result.excludedPrivateOriginalParts,coveredInventorySourceCount:result.coveredInventorySourceCount,sha256:sha(bytes)}));
