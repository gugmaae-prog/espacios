// Materialize and verify the exact retained release. No network or data rewrite.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(await fs.readFile(path.join(root,'data/historical-intelligence/publication-manifest.json'),'utf8'));
const packed=await fs.readFile(path.join(root,'data/historical-intelligence-20261003.json.gz'));
const canonical=gunzipSync(packed),snapshot=JSON.parse(canonical);
if(snapshot.version!==manifest.version||snapshot.asOf!==manifest.asOf)throw Error('Canonical archive and publication manifest differ');
if(digest(canonical)!==manifest.runtime.canonicalSnapshotSHA256)throw Error('Canonical archive checksum differs from the retained release');
const ids=new Set(snapshot.records.map(r=>r.id));
if(ids.size!==1860||snapshot.records.length!==1860)throw Error('Retained catalogue identity count differs');
const target=path.join(root,'data/historical-intelligence-20261003.json');
try{const current=await fs.readFile(target);if(!current.equals(canonical))throw Error('Local canonical JSON differs from the retained archive; preserve and reconcile it explicitly before rebuilding');}
catch(error){if(error.code!=='ENOENT')throw error;await fs.writeFile(target,canonical,{flag:'wx'});}
let checked=0;
for(const object of [...manifest.objects,manifest.d1Index]){
 if(!/^data\/historical-intelligence\/objects\/[a-f0-9]{64}\.(?:json(?:\.gz)?|csv\.gz|sql\.gz|parquet)$/.test(object.path))throw Error('Unexpected archive object path');
 const bytes=await fs.readFile(path.join(root,object.path));
 if(bytes.length!==object.bytes||digest(bytes)!==object.sha256)throw Error('Archive object checksum differs: '+object.path);
 checked++;
}
const runtime=JSON.parse(await fs.readFile(path.join(root,'data/historical-intelligence/runtime-index.json'),'utf8'));
const storedRuntime=JSON.parse(gunzipSync(await fs.readFile(path.join(root,manifest.runtimeIndex.path))));
if(runtime.version!==snapshot.version||JSON.stringify(runtime)!==JSON.stringify(storedRuntime))throw Error('Runtime index differs from immutable release');
console.log(JSON.stringify({mode:'restore_and_verify_retained_archive',remoteWrites:0,version:snapshot.version,records:ids.size,objectsVerified:checked,canonicalSHA256:digest(canonical)}));
