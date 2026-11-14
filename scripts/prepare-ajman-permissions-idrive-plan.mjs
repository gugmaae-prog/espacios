import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

const root=new URL('../',import.meta.url),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const prefix='espacios-map/uae-evidence/published/20261114-ajman-permissions/';
const stems=['new-building-licences-20260901','new-building-area-20240709'];
const objects=[];
for(const stem of stems){
 const localPath=`data/uae-evidence/ajman/${stem}.json.gz`,validationPath=`data/uae-evidence/ajman/${stem}-validation.json`;
 const [source,validationBytes]=await Promise.all([fs.readFile(new URL(localPath,root)),fs.readFile(new URL(validationPath,root))]);
 const report=JSON.parse(validationBytes),raw=gunzipSync(source);
 if(source.length!==report.compressedBytes||sha(source)!==report.compressedSha256||raw.length!==report.rawBytes||sha(raw)!==report.rawSha256)throw Error(`Ajman permission source changed: ${stem}`);
 objects.push({sourceId:report.sourceId,publishedSourceId:report.sourceId,role:'published_projection',localPath,validationPath,validationSha256:sha(validationBytes),idriveKey:`${prefix}ajman/${report.sourceId}/${sha(source)}/${stem}.json.gz`,bytes:source.length,sha256:sha(source),rawBytes:raw.length,rawSha256:sha(raw),contentType:'application/gzip'});
}
const plan={planId:'ajman-new-building-permissions-idrive-e2-replica-20261114',status:'prepared_not_uploaded',accountId:'b1b843ec85bc39a3a4d370ba4f84f17a',bucket:'espacios-store-a',prefix,sourceInventoryVersion:'20261114-uae-evidence-coverage-v43',previousReplicaAttestationId:'uae-published-evidence-idrive-e2-readback-20261114',publishedSourceIds:objects.map(item=>item.sourceId).sort(),publishedSourceCount:objects.length,objectCount:objects.length,totalBytes:objects.reduce((sum,item)=>sum+item.bytes,0),objects};
const output=new URL('data/uae-evidence/idrive-e2-ajman-permissions-replica-plan-20261114.json',root),content=JSON.stringify(plan,null,2)+'\n';
if(process.argv.includes('--check')){if(await fs.readFile(output,'utf8')!==content)throw Error('Ajman permission IDrive plan differs from source');}
else await fs.writeFile(output,content);
console.log(JSON.stringify({passed:true,objectCount:plan.objectCount,totalBytes:plan.totalBytes,planSha256:sha(content)}));
