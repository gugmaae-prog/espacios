import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {createHash} from 'node:crypto';

const source=await fs.readFile(new URL('../src/worker.js',import.meta.url),'utf8');
const context=vm.createContext({console,Headers,Request,Response,URL,URLSearchParams,atob,btoa,TextEncoder,TextDecoder,DecompressionStream,CompressionStream,ReadableStream,Blob,crypto:globalThis.crypto});
vm.runInContext(source.replace(/export \{\s*worker_default as default\s*\};/,''),context);
const app=await(await vm.runInContext('aePatchedAppJs()',context)).text();
const extension=await fs.readFile(new URL('../src/mobile-map/worker-extension.js',import.meta.url),'utf8');
const frontendRelease=/var MM_RELEASE\s*=\s*['"]([^'"]+)['"]/.exec(extension)?.[1];
assert.ok(frontendRelease,'Frontend extension exposes one release token');
const repairStart=app.indexOf('(function aeCollapseRepairV3(){');
assert.ok(repairStart>=0,'The emitted browser app retains legacy card repair');
const repair=app.slice(repairStart,app.indexOf('/* ===== Espacios UAE coverage',repairStart));
const syncLine=repair.split('\n').find(line=>line.trimStart().startsWith('function sync(el,btn)'));
const iconLine=repair.split('\n').find(line=>line.trimStart().startsWith('const icon=c=>'));

test('emitted browser bundle guards the exact legacy collapse-repair renderer',()=>{
  assert.equal((repair.match(/function sync\(el,btn\)/g)||[]).length,1);
  assert.match(syncLine,/if\(btn\.aeCollapseIconKey!==html\)/);
  assert.doesNotMatch(syncLine,/title=btn\.dataset\.title\|\|'Section';btn\.innerHTML=icon/);
  assert.ok(app.indexOf('One pointer owner')>repairStart,'Mobile controls follow the preserved legacy implementation');
});

test('repairing unchanged cards produces no repeated DOM mutations',()=>{
  assert.ok(syncLine&&iconLine,'Expected renderer and icon factory in emitted browser app');
  const sync=vm.runInNewContext('(()=>{'+iconLine+'\n'+syncLine+'\nreturn sync;})()');
  let collapsed=true,html='',title='';
  const attributes=new Map(),writes={html:0,title:0,attributes:0};
  const button={dataset:{title:'Price history'},getAttribute:name=>attributes.get(name),setAttribute(name,value){attributes.set(name,value);writes.attributes++;}};
  Object.defineProperties(button,{
    innerHTML:{get:()=>html,set:value=>{html=value;writes.html++;}},
    title:{get:()=>title,set:value=>{title=value;writes.title++;}}
  });
  const card={classList:{contains:()=>collapsed}};
  sync(card,button);
  assert.deepEqual(writes,{html:1,title:1,attributes:2});
  assert.equal(attributes.get('aria-expanded'),'false');
  assert.equal(title,'Expand Price history');
  for(let i=0;i<20;i++)sync(card,button);
  assert.deepEqual(writes,{html:1,title:1,attributes:2},'An observer-triggered repair reaches a stable state');
  collapsed=false;sync(card,button);
  assert.deepEqual(writes,{html:2,title:2,attributes:4});
  assert.equal(attributes.get('aria-expanded'),'true');
  assert.equal(title,'Collapse Price history');
  button.dataset.title='Rental yield';sync(card,button);
  assert.equal(writes.html,2,'Renaming a section must not replace the unchanged icon');
  assert.equal(attributes.get('aria-label'),'Collapse Rental yield');
  for(let i=0;i<20;i++)sync(card,button);
  assert.deepEqual(writes,{html:2,title:3,attributes:5});
});

test('unified search and timeline controllers ship after their existing data and mobile dependencies',async()=>{
  const search=await fs.readFile(new URL('../src/mobile-map/search-focus.js',import.meta.url),'utf8');
  const unified=await fs.readFile(new URL('../src/unified-map/app.js',import.meta.url),'utf8');
  assert.ok(app.includes(search),'Exact reviewed search implementation is emitted');
  assert.ok(app.includes(unified),'Exact reviewed unified controller is emitted');
  assert.ok(app.indexOf('const SECore=')<app.indexOf('const MMCore='));
  assert.ok(app.indexOf('const MMCore=')<app.indexOf('const UMCore='));
  assert.ok(app.indexOf('const UMCore=')<app.indexOf('const EspaciosSearchFocusCore ='));
  assert.ok(app.indexOf('const EspaciosSearchFocusCore =')<app.indexOf('/* One timeline for native evidence'));
  assert.ok(app.includes(frontendRelease),'Browser diagnostic token matches the frontend response token');
  assert.match(app,/window\.EspaciosUnifiedMap=Object\.freeze/);
  assert.match(app,/window\.EspaciosSearchFocus = Object\.freeze/);
  assert.match(app,/espacios:search-selection/);
  assert.match(app,/UMCore\.timelineOptions\(/);
});

test('UI consolidation leaves the acquired baseline and published evidence snapshots byte-identical',async()=>{
  const checks=[
    ['src/baseline/worker-20260930.js','b9aab494d2297e7208f5257c069a54c2a6f9eb3762ff79224350ae4006357e06'],
    ['data/smart-estimates-20260930.json','f77472b65fad63bb6dd59323ed93823fb623a193d58c8cd014c2e3f868a3c4b4'],
    ['data/source-review-20260930.json','3798cd5d0a84fde7452ce58e9dc6af52a38472de4905a3120cb5571521cac6a6']
  ];
  for(const [path,hash]of checks){
    const contents=await fs.readFile(new URL('../'+path,import.meta.url));
    assert.equal(createHash('sha256').update(contents).digest('hex'),hash,path+' retains its reviewed bytes');
  }
  assert.match(source,/research\/published\/2026-09-30\/smart-estimates-v1\/scenarios\.json/);
  assert.match(extension,/\['\/map','\/map\/app-v2\.js','\/map\/app-v2\.css'\]/,'Version wrapper is frontend-only');
  assert.doesNotMatch(extension,/\.put\(|\.prepare\(|\.exec\(|SUPABASE|service_role|PSR_PROPERTY|MARKET_R2|env\.(?:DB|AI)/,'UI wrapper has no storage mutation or private binding access');
  assert.deepEqual([...extension.matchAll(/([\w.]+)\.delete\(/g)].map(match=>match[1]),['headers','headers'],'Only response metadata may be removed, never stored records');
});

test('unique frontend release identifies matching HTML, JS and CSS without relabeling evidence APIs',async()=>{
  const worker=vm.runInContext('worker_default',context),ctx={waitUntil(){}};
  for(const path of ['/map','/map/app-v2.js','/map/app-v2.css']){
    const response=await worker.fetch(new Request('https://espacios.me'+path),{},ctx);
    assert.equal(response.status,200);
    assert.equal(response.headers.get('x-espacios-mobile'),frontendRelease);
    if(path==='/map'){
      const html=await response.text();
      assert.ok(html.includes('app-v2.js?v='+frontendRelease));assert.ok(html.includes('app-v2.css?v='+frontendRelease));
      assert.equal(response.headers.get('x-ae-navigation'),frontendRelease);
    }
    if(path==='/map/app-v2.js')assert.equal(response.headers.get('x-psr-map-navfix'),frontendRelease);
  }
  const api=await worker.fetch(new Request('https://espacios.me/map/api/smart-estimates'),{MARKET_R2:{get:async()=>({body:'{}',httpEtag:'"retained-snapshot"'})}},ctx);
  assert.equal(api.status,200);assert.equal(api.headers.get('x-espacios-mobile'),null);
  assert.equal(api.headers.get('x-espacios-estimates'),'20260930-smart-estimates-v1');
});
