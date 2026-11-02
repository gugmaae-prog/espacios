import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

const root=new URL('../',import.meta.url);
const manifest=JSON.parse(fs.readFileSync(new URL('data/recovery/psr-public-d1-export-20261102.manifest.json',root)));
const compressed=fs.readFileSync(new URL('data/recovery/psr-public-d1-export-20261102.json.gz',root));
const digest=value=>createHash('sha256').update(value).digest('hex');
if(compressed.length!==manifest.compressedBytes||digest(compressed)!==manifest.compressedSha256)throw Error('Compressed PSR D1 export mismatch');
const raw=gunzipSync(compressed),snapshot=JSON.parse(raw);
if(raw.length!==manifest.rawBytes||digest(raw)!==manifest.rawSha256||snapshot.projects?.length!==manifest.rows||new Set(snapshot.projects.map(p=>p.slug)).size!==manifest.uniqueSlugs||snapshot.registry?.total!==manifest.registry.total||snapshot.registry?.revision!==manifest.registry.revision||snapshot.registry?.contentHash!==manifest.registry.contentHash||snapshot.projects.some(p=>!p.slug||!p.href?.startsWith('/projects/')||p.revision!==manifest.registry.revision||Object.hasOwn(p,'provenance_json')))throw Error('PSR D1 public snapshot population mismatch');

// Reproduce the public Data Hub projection when the read-only SQL exports are
// available locally. The raw table exports are intentionally not committed.
const sourceDir=process.argv.find(arg=>arg.startsWith('--source-dir='))?.slice('--source-dir='.length);
if(sourceDir){
 const dir=new URL(sourceDir.endsWith('/')?sourceDir:sourceDir+'/',root);
 for(const table of manifest.tables){
  const source=fs.readFileSync(new URL(table.table+'.sql',dir));
  if(digest(source)!==table.sha256)throw Error('D1 table export checksum mismatch: '+table.table);
 }
 const db=new URL('registry.sqlite',dir).pathname;
 const query=sql=>JSON.parse(execFileSync('sqlite3',['-json',db,sql],{maxBuffer:20_000_000}));
 const state=query("SELECT tenant_key,revision,project_count,content_hash,updated_at FROM project_registry_state WHERE tenant_key='psr'")[0];
 const rows=query("SELECT p.canonical_slug,p.name,p.developer,p.emirate,p.area,p.payload_json,tp.public_slug,tp.href,tp.indexable,tp.overrides_json,tp.sort_rank FROM tenant_project_publications tp JOIN projects p ON p.project_id=tp.project_id WHERE tp.tenant_key='psr' AND tp.visibility='published' AND p.status='active' ORDER BY tp.sort_rank ASC,p.name COLLATE NOCASE ASC,p.canonical_slug ASC");
 const object=text=>{try{const value=JSON.parse(text);return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}};
 const projects=rows.map(row=>{const payload=object(row.payload_json),overrides=object(row.overrides_json);return {...payload,...overrides,slug:row.public_slug,canonicalSlug:row.canonical_slug,title:overrides.title||payload.title||row.name,developer:overrides.developer||payload.developer||row.developer,emirate:overrides.emirate||payload.emirate||row.emirate,area:overrides.area||payload.area||row.area,href:row.href,indexable:Boolean(row.indexable),revision:Number(state.revision)};});
 if(JSON.stringify({projects,registry:{total:state.project_count,revision:state.revision,updatedAt:state.updated_at,contentHash:state.content_hash}})!==raw.toString('utf8'))throw Error('Public PSR projection differs from D1 export');
 const hashRows=query("SELECT p.project_id,p.content_hash,tp.public_slug,tp.href,tp.visibility,tp.indexable,tp.sort_rank,tp.overrides_json FROM tenant_project_publications tp JOIN projects p ON p.project_id=tp.project_id WHERE tp.tenant_key='psr' AND tp.visibility='published' AND p.status='active' ORDER BY tp.sort_rank,tp.public_slug");
 if(digest(JSON.stringify(hashRows))!==manifest.localProjectionHash||manifest.localProjectionHash===manifest.registry.contentHash||manifest.registryContentHashReproduced!==false)throw Error('D1 registry hash observation changed');
}
console.log(JSON.stringify({passed:true,rows:manifest.rows,registryUpdatedAt:manifest.registry.updatedAt,rawSha256:manifest.rawSha256,sourceReproduced:Boolean(sourceDir)}));
