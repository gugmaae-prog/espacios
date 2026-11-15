import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

const root=new URL('../',import.meta.url),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const prefix='espacios-map/uae-evidence/published/20261115-rak-municipal-commercial/';
const localPath='data/uae-evidence/ras-al-khaimah/municipal-commercial-sales-2025-20261115.json.gz';
const validationPath='data/uae-evidence/ras-al-khaimah/municipal-commercial-sales-2025-validation.json';
const [source,validationBytes]=await Promise.all([fs.readFile(new URL(localPath,root)),fs.readFile(new URL(validationPath,root))]);
const report=JSON.parse(validationBytes),raw=gunzipSync(source);
if(source.length!==report.compressedBytes||sha(source)!==report.compressedSha256||raw.length!==report.dataBytes||sha(raw)!==report.dataSha256||report.rows!==4)throw Error('RAK municipal source changed');
const object={sourceId:report.sourceId,publishedSourceId:report.sourceId,role:'published_projection',localPath,validationPath,validationSha256:sha(validationBytes),idriveKey:`${prefix}ras-al-khaimah/${report.sourceId}/${sha(source)}/municipal-commercial-sales-2025-20261115.json.gz`,bytes:source.length,sha256:sha(source),rawBytes:raw.length,rawSha256:sha(raw),contentType:'application/gzip'};
const plan={planId:'rak-municipal-commercial-idrive-e2-replica-20261115',status:'prepared_not_uploaded',accountId:'b1b843ec85bc39a3a4d370ba4f84f17a',bucket:'espacios-store-a',prefix,sourceInventoryVersion:'20261115-uae-evidence-coverage-v52',previousReplicaAttestationId:'ajman-land-mortgage-idrive-e2-readback-20261115',publishedSourceIds:[report.sourceId],publishedSourceCount:1,objectCount:1,totalBytes:source.length,objects:[object]};
const output=new URL('data/uae-evidence/idrive-e2-rak-municipal-commercial-plan-20261115.json',root),content=JSON.stringify(plan,null,2)+'\n';
if(process.argv.includes('--check')){if(await fs.readFile(output,'utf8')!==content)throw Error('RAK municipal IDrive plan differs from source');}
else await fs.writeFile(output,content);
console.log(JSON.stringify({passed:true,objectCount:plan.objectCount,totalBytes:plan.totalBytes,planSha256:sha(content)}));
