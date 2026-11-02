import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'data/historical-intelligence-20261003.json.gz');
const target=path.join(root,'data/historical-intelligence-20261003.json');
try{
  const current=await fs.stat(target);
  if(current.size>0){console.log(`Canonical history snapshot already restored (${current.size} bytes).`);process.exit(0);}
}catch(error){if(error.code!=='ENOENT')throw error;}
const compressed=await fs.readFile(source);
const snapshot=gunzipSync(compressed);
JSON.parse(snapshot.toString('utf8'));
await fs.writeFile(target,snapshot,{flag:'wx'}).catch(async error=>{
  if(error.code!=='EEXIST')throw error;
  const current=await fs.stat(target);
  if(current.size!==snapshot.length)throw new Error('A conflicting canonical history snapshot exists.');
});
console.log(`Restored canonical history snapshot (${snapshot.length} bytes).`);
