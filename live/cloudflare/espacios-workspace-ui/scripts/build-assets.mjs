import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {basename} from 'node:path';
const root=new URL('../',import.meta.url);
const graph=JSON.parse(await readFile(new URL('integration/asset-graph.json',root),'utf8'));
const css=await readFile(new URL('assets/'+basename(graph.css),root),'utf8');
const controls=await readFile(new URL('styles/workspace-controls.css',root),'utf8');
const publicControls=await readFile(new URL('styles/public-seamless.css',root),'utf8');
if(!css.includes(controls)||!css.endsWith(publicControls))throw Error('Current CSS must preserve the complete base plus both reviewed control policies');
const assets={};
const collections=[{graph,directory:'assets/'}];
const retainedRevisions=[...new Set((graph.retainedRevisionPaths||[]).map(path=>path.split('/')[3]))];
for(const revision of retainedRevisions){
  const previous=JSON.parse(await readFile(new URL('compatibility/'+revision+'/asset-graph.json',root),'utf8'));
  collections.push({graph:previous,directory:'compatibility/'+revision+'/assets/'});
}
for(const collection of collections)for(const item of collection.graph.assets){
  const body=await readFile(new URL(collection.directory+basename(item.path),root),'utf8');
  const sha=createHash('sha256').update(body).digest('hex');
  if(sha!==item.sha256||Buffer.byteLength(body)!==item.bytes)throw Error('Asset bytes differ: '+item.path);
  assets[item.path]={type:item.type,body,etag:sha};
}
const source='const revision='+JSON.stringify(graph.revision)+';\nconst assets='+JSON.stringify(assets)+';\n'+`
export function workspaceUiAsset(request) {
  const asset=assets[new URL(request.url).pathname];
  if(!asset)return null;
  if(request.method!=="GET"&&request.method!=="HEAD")return new Response("Method not allowed",{status:405,headers:{allow:"GET, HEAD"}});
  const headers={"content-type":asset.type,"cache-control":"public, max-age=31536000, immutable","x-content-type-options":"nosniff","etag":'"'+asset.etag+'"',"x-espacios-workspace-ui":revision};
  if(request.headers.get("if-none-match")===headers.etag)return new Response(null,{status:304,headers});
  return new Response(request.method==="HEAD"?null:asset.body,{status:200,headers});
}
`;
await mkdir(new URL('dist/',root),{recursive:true});
await writeFile(new URL('dist/workspace-ui-assets.js',root),source);
console.log('Verified and built '+Object.keys(assets).length+' public assets for '+graph.revision+' with immutable earlier URLs retained');
