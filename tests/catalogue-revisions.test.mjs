import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import * as core from '../src/historical-intelligence/core.mjs';
import {validateCatalogueRevisions} from '../scripts/validate-catalogue-revisions.mjs';
const packet=JSON.parse(fs.readFileSync(new URL('../data/map-catalogue-revisions.json',import.meta.url))),revision=packet.revisions[0];
const subject={id:revision.recordId,slug:revision.recordId.slice(8),name:revision.catalogueName,emirate:revision.emirate,developer:revision.fromValue,coordinates:{lat:25.7,lng:55.8},askingPrice:800000};
test('Nura correction is pinned to retained primary evidence and cannot affect other records or prices',()=>{
 const snapshot=JSON.parse(fs.readFileSync(new URL('../data/historical-intelligence-20261003.json',import.meta.url)));
 assert.deepEqual(validateCatalogueRevisions(packet,snapshot),packet.revisions);
 const payload={projects:[subject,{...subject,id:'project:other',slug:'other'}],communities:[{id:'community:test'}]},original=structuredClone(payload);
 const reviewed=core.applyCatalogueRevisions(payload,packet.revisions);
 assert.equal(reviewed.projects[0].developer,'RAK Properties');
 assert.equal(reviewed.projects[0].catalogueMetadataReviews[0].priorValue,'nura');
 assert.deepEqual(reviewed.projects[0].coordinates,subject.coordinates);
 assert.equal(reviewed.projects[0].askingPrice,subject.askingPrice);
 assert.deepEqual(reviewed.projects[1],original.projects[1]);assert.deepEqual(reviewed.communities,original.communities);assert.deepEqual(payload,original);
 assert.deepEqual(core.applyCatalogueRevisions(reviewed,packet.revisions),reviewed);
 for(const change of [{sourceRefs:[{...revision.sourceRefs[0],sha256:'wrong'}]},{firstAvailableAt:'2000-01-01'},{catalogueName:'Another phase'},{verification:'candidate'},{field:'askingPrice'}])assert.throws(()=>validateCatalogueRevisions({...packet,revisions:[{...revision,...change}]},snapshot));
 assert.throws(()=>validateCatalogueRevisions({...packet,revisions:[revision,revision]},snapshot));
});
test('reused slugs, mismatched emirates/names, conflicting upstream values and identity fan-out are excluded',()=>{
 for(const change of [{id:'project:another'},{emirate:'Dubai'},{name:'Nura II'},{developer:'Different upstream company'}]){
  const p={projects:[{...subject,...change}]};assert.deepEqual(core.applyCatalogueRevisions(p,packet.revisions),p);
 }
 const duplicate={projects:[subject,subject]};assert.deepEqual(core.applyCatalogueRevisions(duplicate,packet.revisions),duplicate);
 assert.deepEqual(core.applyCatalogueRevisions({projects:[subject]},[revision,revision]),{projects:[subject]});
 const slugOnly={...subject};delete slugOnly.id;assert.equal(core.applyCatalogueRevisions({projects:[slugOnly]},packet.revisions).projects[0].developer,'RAK Properties');
});
test('reviewed developer reaches all four map feeds with correct GET, HEAD, ETag and tenant behavior',async()=>{
 const worker={fetch:async()=>new Response(JSON.stringify({projects:[subject]}),{headers:{'content-type':'application/json','etag':'"upstream"'}})};
 vm.runInNewContext(fs.readFileSync(new URL('../src/historical-intelligence/worker-extension.js',import.meta.url),'utf8'),{worker_default:worker,HI_DATA:{version:'v34'},HI_CORE:core,HI_CATALOGUE_REVISIONS:packet.revisions,crypto:webcrypto,Response,Request,Headers,URL,TextEncoder,TextDecoder,Map,Set,Date,JSON,Uint8Array,ReadableStream});
 for(const path of ['/map/map-core.json','/map/map-data.json','/map/api/projects-all','/map/api/projects-batch']){
  const url='https://espacios.me'+path,response=await worker.fetch(new Request(url),{},{}),data=await response.json(),etag=response.headers.get('etag');
  assert.equal(data.projects[0].developer,'RAK Properties');assert.equal(response.headers.get('x-espacios-catalogue-review'),revision.id);
  assert.equal((await worker.fetch(new Request(url,{headers:{'if-none-match':etag}}),{},{})).status,304);
  const head=await worker.fetch(new Request(url,{method:'HEAD'}),{},{});assert.equal(await head.text(),'');assert.equal(head.headers.get('etag'),etag);
 }
 for(const host of ['psrhomes.ae','hausandgrace.com'])assert.equal((await(await worker.fetch(new Request('https://'+host+'/map/map-core.json'),{},{})).json()).projects[0].developer,'nura');
});
