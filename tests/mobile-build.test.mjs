import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source=await fs.readFile(new URL('../src/worker.js',import.meta.url),'utf8');
const context=vm.createContext({console,Headers,Request,Response,URL,URLSearchParams,atob,btoa,TextEncoder,TextDecoder,DecompressionStream,CompressionStream,ReadableStream,Blob,crypto:globalThis.crypto});
vm.runInContext(source.replace(/export \{\s*worker_default as default\s*\};/,''),context);
const app=await(await vm.runInContext('aePatchedAppJs()',context)).text();
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
