import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {basename} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import test from 'node:test';
import {workspaceUiAsset} from '../dist/workspace-ui-assets.js';
import {applyUiSpans} from '../scripts/apply-auth-ui.mjs';
import {seamlessControlsMarkup} from '../integration/seamless-controls.js';
const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const graph=JSON.parse(await read('integration/asset-graph.json'));
const hash=s=>createHash('sha256').update(s).digest('hex');

test('release graph retains exact reviewed bytes and a single bootstrap dependency graph',async()=>{
  assert.equal(graph.assets.length,18);
  const paths=new Set(graph.assets.map(x=>x.path));
  for(const item of graph.assets){
    const source=await read('assets/'+basename(item.path));
    assert.equal(hash(source),item.sha256,item.path);
    assert.equal(Buffer.byteLength(source),item.bytes,item.path);
    if(item.type.startsWith('application/javascript')){
      execFileSync(process.execPath,['--check',new URL('assets/'+basename(item.path),root).pathname]);
      assert.ok(!source.includes('/assets/index-C5rSNAIW.js'),'original bootstrap must never re-enter graph');
      assert.ok(!/(?:from|import\()\s*["'`](\.\/[^"'`]+\.js)/.test(source),'no relative module resolution from revision directory');
      for(const match of source.matchAll(/["'`]((?:\/__espacios\/workspace-ui\/)[^"'`]+\.js)["'`]/g))assert.ok(paths.has(match[1]),match[1]);
    }
  }
  const manifest=await read('integration/vite-rsc-assets-manifest.js');
  assert.ok(manifest.includes(graph.bootstrap));
  assert.ok(manifest.includes(graph.workspace));
  assert.ok(manifest.includes(graph.css));
  assert.ok(!manifest.includes('/assets/index-C5rSNAIW.js'));
});

test('asset outlet preserves HTTP cache and method behavior without owning app requests',async()=>{
  const url='https://espacios.me'+graph.css;
  const get=workspaceUiAsset(new Request(url));
  assert.equal(get.status,200);
  assert.equal(get.headers.get('content-type'),'text/css; charset=utf-8');
  assert.equal(hash(await get.text()),graph.assets.find(x=>x.path===graph.css).sha256);
  assert.equal(workspaceUiAsset(new Request('https://espacios.me/learn')),null);
  assert.equal(workspaceUiAsset(new Request(url,{method:'POST'})).status,405);
  assert.equal(await workspaceUiAsset(new Request(url,{method:'HEAD'})).text(),'');
  const cached=workspaceUiAsset(new Request(url,{headers:{'if-none-match':get.headers.get('etag')}}));
  assert.equal(cached.status,304);
  assert.equal(await cached.text(),'');
});

test('previous immutable asset URLs remain available to already-open tabs',async()=>{
  const revisions=[...new Set(graph.retainedRevisionPaths.map(path=>path.split('/')[3]))];
  const retained=[];
  for(const revision of revisions){
    const previous=JSON.parse(await read('compatibility/'+revision+'/asset-graph.json'));
    assert.equal(previous.assets.length,18);
    retained.push(...previous.assets);
  }
  assert.deepEqual(new Set(graph.retainedRevisionPaths),new Set(retained.map(x=>x.path)));
  for(const asset of retained){
    const response=workspaceUiAsset(new Request('https://espacios.me'+asset.path));
    assert.equal(response.status,200,asset.path);
    assert.equal(hash(await response.text()),asset.sha256,asset.path);
    assert.equal(response.headers.get('etag'),'"'+asset.sha256+'"');
  }
});

test('auth preservation contains only disjoint UI spans and fails closed on altered bases',async()=>{
  const patch=JSON.parse(await read('integration/auth-ui-spans.json'));
  const edits=[...patch.edits].sort((a,b)=>a.startByte-b.startByte);
  assert.equal(edits.length,16);
  let end=0;
  for(const edit of edits){
    assert.ok(edit.startByte>=end,edit.finding);
    assert.equal(edit.endByte-edit.startByte,Buffer.byteLength(edit.before));
    assert.equal(hash(edit.before),edit.beforeSha256);
    end=edit.endByte;
    assert.ok(!/eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(edit.before+edit.after));
    assert.ok(!/-----BEGIN .*PRIVATE KEY-----/.test(edit.before+edit.after));
  }
  assert.deepEqual(patch.scope,['/plug','/expenses','shared legacy theme preference migration']);
  assert.throws(()=>applyUiSpans(Buffer.from('changed owning module'),patch),/differs from the reviewed base/);
});

test('legacy shared focus markup matches readable policy and excludes Map paths',async()=>{
  const css=await read('styles/public-seamless.css');
  const init=await read('styles/input-modality.js');
  const expected='<style id="esp-seamless-controls">'+css+'</style><script id="esp-input-modality">'+init+'</script>';
  assert.equal(seamlessControlsMarkup('/expenses'),expected);
  for(const path of ['/map','/map/example','/legacy/map','/legacy/map/example'])assert.equal(seamlessControlsMarkup(path),'');
});

test('direct modern bootstrap and global CSS preserve the shared hydration-safe controls policy',async()=>{
  const init=await read('styles/input-modality.js');
  const bootstrap=await read('assets/'+basename(graph.bootstrap));
  assert.ok(bootstrap.startsWith(init),'direct Workspace routes must initialize without the public shell');
  assert.ok(init.includes('__ESPACIOS_INPUT_MODALITY_SYNC__'),'shell and bootstrap initialization must deduplicate');
  assert.ok(init.includes('MutationObserver'),'hydration removing the DOM attribute must be repaired');
  const css=await read('assets/'+basename(graph.css));
  assert.ok(css.includes(await read('styles/workspace-controls.css')));
  assert.ok(css.endsWith(await read('styles/public-seamless.css')),'floating and header controls outside the workspace must receive the shared policy');
});
