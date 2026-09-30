// Read-only public API checks. Saved receipts contain hashes/counts, never source rows.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2), arg=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
const origin=arg('--origin')||'https://espacios.me';
assert.equal(new URL(origin).protocol,'https:','Only HTTPS public origins are accepted');
const beforePath=arg('--before'), output=arg('--output');
assert.ok(output,'Pass --output with the verification receipt path');
const definitions=[
 {endpoint:'/map/api/research', preserve:['projects','communities','developers','benchmarks','officialRegistries'],kind:'data'},
 {endpoint:'/map/api/market-segments',preserve:['rows','sources','metrics','retention','mixedPolicy','forecast','periodPolicy','sourceComparability','availablePeriods','availableEmirates'],kind:'data'},
 {endpoint:'/map/api/prediction-catalogue?status=all&limit=1',preserve:['counts','statusCounts','historyWindow','dataContract','methods','sources','dubaiMethodology','dubaiSourcePublication','modelCodeSha256','runs','total'],kind:'data'},
 {endpoint:'/map/api/history-library?limit=1',preserve:['counts','statusCounts','historyWindow','dataContract','methods','sources','dubaiMethodology','dubaiSourcePublication','modelCodeSha256','series','total'],kind:'data'},
 {endpoint:'/map/api/uae-heatmap',preserve:['counts','completeness','projectFeatures','unmappedProjectRecords','evidenceByEmirate','outlook','periodPolicy'],kind:'data'},
 {endpoint:'/map/api/system',preserve:['topology','dataRoom','security'],kind:'system'},
 {endpoint:'/map/data-room',kind:'access'}
];
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value;}
const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(canonical(value))).digest('hex');
const numbers=value=>Object.fromEntries(Object.entries(value||{}).filter(([,v])=>typeof v==='number'&&Number.isFinite(v)));
function counts(body){
 const result={...numbers(body?.counts),...numbers({total:body?.total}),...Object.fromEntries(Object.entries(body||{}).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[`${k}Returned`,v.length]))};
 if(body?.projectFeatures?.features)result.featuresReturned=body.projectFeatures.features.length;
 for(const[k,v]of Object.entries(numbers(body?.statusCounts)))result[`status.${k}`]=v;
 return result;
}
const checks=[];
for(const definition of definitions){
 const response=await fetch(origin+definition.endpoint,{headers:{accept:definition.kind==='access'?'text/html':'application/json'},signal:AbortSignal.timeout(45000)});
 const text=await response.text();
 const expected=definition.kind==='access'?404:200;
 assert.equal(response.status,expected,`${definition.endpoint} expected status ${expected}`);
 const body=definition.kind==='access'?null:JSON.parse(text);
 if(definition.kind==='access'){
  assert.match(response.headers.get('cache-control')||'',/no-store/);
  assert.match(response.headers.get('x-robots-tag')||'',/noindex/);
 }
 if(definition.kind==='system'){
  assert.equal(body.dataRoom?.access,'restricted');
  assert.equal(body.security?.secretsExposed,false);
 }
 const preserved=definition.preserve?Object.fromEntries(definition.preserve.map(k=>{assert.ok(k in body,`${definition.endpoint} missing ${k}`);return[k,body[k]];})):null;
 checks.push({endpoint:definition.endpoint,kind:definition.kind,status:response.status,counts:counts(body),payloadSha256:hash(body||text),preservedSha256:preserved?hash(preserved):null,
  cacheControl:response.headers.get('cache-control'),robots:response.headers.get('x-robots-tag')});
}
let comparison=null;
if(beforePath){
 const before=JSON.parse(await readFile(path.resolve(root,beforePath),'utf8'));
 comparison=checks.map(check=>{
  const prior=before.checks.find(x=>x.endpoint===check.endpoint);assert.ok(prior,`No baseline for ${check.endpoint}`);
  const countChanges=Object.fromEntries(Object.entries(check.counts).filter(([k,v])=>prior.counts[k]!==v).map(([k,v])=>[k,{before:prior.counts[k]??null,after:v}]));
  return{endpoint:check.endpoint,statusUnchanged:prior.status===check.status,preservationUnchanged:prior.preservedSha256===check.preservedSha256,countChanges};
 });
}
const result={schemaVersion:1,checkedAt:new Date().toISOString(),origin,scope:'Public curated API fingerprints; no raw payloads stored. Prediction/history checks cover catalogue metadata and first page, not every partition.',checks,comparison};
const out=path.resolve(root,output);await mkdir(path.dirname(out),{recursive:true});await writeFile(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({receipt:out,checks:checks.map(({endpoint,status,counts})=>({endpoint,status,counts})),comparison},null,2));
if(comparison?.some(c=>!c.statusUnchanged||!c.preservationUnchanged||Object.keys(c.countChanges).length)){
 console.error('Preservation fingerprint changed: review the receipt before promotion. A live-feed update may be legitimate; do not overwrite or silently normalize it.');
 process.exitCode=1;
}
