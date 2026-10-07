import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const app=await fs.readFile(new URL('../src/minimal-map/app.js',import.meta.url),'utf8');
const css=await fs.readFile(new URL('../src/minimal-map/style.css',import.meta.url),'utf8');
const worker=await fs.readFile(new URL('../src/worker.js',import.meta.url),'utf8');
const builder=await fs.readFile(new URL('../scripts/build-smart.mjs',import.meta.url),'utf8');

test('minimal composition exposes the approved controls without changing evidence ownership',()=>{
  for(const label of ['Map','Satellite','3D','Heatmap','Price / sqft','ROI','Transaction Volume','Forecast'])assert.ok(app.includes(label),label);
  assert.match(app,/transaction_value_aed/);
  assert.match(app,/EspaciosUnifiedMap\?\.setMetric/);
  assert.doesNotMatch(app,/DATA_ROOM_PUBLIC|SUPABASE|service_role|MARKET_R2|env\.DB/);
  assert.match(app,/\['price','Price \/ sqft','accent'\]/);
  assert.doesNotMatch(app,/\['price','Price \/ sqft','gold'\]/);
});

test('bundled map focus and fallback colors use the shared neutral Espacios theme',()=>{
  assert.match(css,/--minimal-selected:color-mix\(in srgb,var\(--minimal-accent\) 4%,var\(--su-panel\)\)/);
  assert.match(css,/--minimal-selected-line:color-mix\(in srgb,var\(--minimal-accent\) 10%,var\(--su-line\)\)/);
  assert.match(css,/\.ae-search-map-tools \.ae-map-focus-toggle\.active[\s\S]*?background:var\(--minimal-selected\)!important/);
  assert.match(css,/#minimal-map-modes button\[aria-pressed="true"\][\s\S]*?background:color-mix\(in srgb,var\(--minimal-accent\) 4%,transparent\)[\s\S]*?border-bottom:2px solid/);
  assert.match(css,/:is\(#toggle-3d\.active,.ae-mobile-map-modes #toggle-3d\.active\)[\s\S]*?background:var\(--minimal-selected\)!important/);
  assert.match(css,/\.ae-search-map-tools button[\s\S]*?color:var\(--su-muted\)!important/);
  assert.match(css,/\.map-bottom \.dot\.fallback\{\s*background:#89959a!important;box-shadow:none!important/);
  assert.match(css,/--gold:var\(--minimal-accent\)/);
  assert.match(css,/--psr-gold:var\(--minimal-accent\)/);
  assert.match(css,/--ae-gold:var\(--minimal-accent\)/);
  assert.match(css,/\.quality-filter button\.active/);
  assert.match(css,/\.availability-filter button\.active/);
  assert.match(css,/\.route-card\.active/);
  assert.match(css,/\.search-wrap:focus-within/);
  assert.ok(worker.includes('background:var(--minimal-selected)!important'));
  assert.ok(worker.includes('border-bottom:2px solid color-mix(in srgb,var(--minimal-accent) 56%,var(--su-line))'));
  assert.ok(worker.includes('--ae-premium-gold:var(--minimal-accent)'));
  assert.match(worker,/\.map-bottom \.dot\.fallback\{\\n\s*background:#89959a!important;box-shadow:none!important/);
});

test('selection and watchlist colors use Espacios slate and teal, not legacy gold',()=>{
  assert.match(app,/selectionLight='#526b70',selectionDark='#a0bab9'/);
  assert.match(app,/hotspotColors=\['#4f817c','#718991','#9ba8ac'\]/);
  assert.match(app,/ae-emerging-hotspots','circle-color',expression/);
  assert.match(app,/layer\.paint\?\.\[property\]===undefined\)continue/);
  assert.match(app,/attributeFilter:\['data-espacios-theme'\]/);
  assert.doesNotMatch(app,/paletteCopy|refreshPaletteCopy/);
  assert.doesNotMatch(app,/PSR_GOLD/);
  assert.ok(worker.includes("setPaintProperty('ae-emerging-hotspots','circle-color',expression)"));
  assert.match(builder,/paletteCopyReplacements/);
  assert.match(builder,/muted teal outline marks selection/);
  assert.match(builder,/do not represent expected property returns/);
});

test('selection palette safely updates only declared MapLibre paint properties in both themes',()=>{
  const start=app.indexOf("  const selectionLight='");
  const end=app.indexOf('  let selectionPaletteFrame=',start);
  assert.ok(start>=0&&end>start,'palette synchronization source is present');
  const paletteSource=app.slice(start,end);
  const run=theme=>{
    const layers=[
      {id:'project-selection-line',paint:{'line-color':'#69d8ff'}},
      {id:'project-footprint-fill',paint:{'fill-color':['case',['==',['get','selected'],1],'#a97925','#fff']}},
      {id:'project-fallback-ring',paint:{'circle-stroke-color':'#ffc866','circle-color':'rgba(169,121,37,.12)'}},
      {id:'project-points',paint:{'circle-color':['case',['==',['get','fallback'],1],'#ffc866',['match',['get','timeline'],'past','#74889a','future','#5aaeff','#34dfc4']]}},
      {id:'unrelated-layer',paint:{'line-color':'#69d8ff'}},
      {id:'ae-emerging-hotspots',paint:{'circle-color':['match',['get','band'],'emerging_hotspot','#e0b34a','watchlist','#c9a45d','#ffc866']}}
    ];
    const map={
      getStyle:()=>({layers}),
      getLayer:id=>layers.find(layer=>layer.id===id),
      getPaintProperty(id,property){const layer=layers.find(item=>item.id===id);if(!layer?.paint||!Object.hasOwn(layer.paint,property))throw new Error(`undeclared paint ${id}.${property}`);return layer.paint[property]},
      setPaintProperty(id,property,value){const layer=layers.find(item=>item.id===id);layer.paint[property]=value}
    };
    const document={documentElement:{dataset:{espaciosTheme:theme}},querySelector:()=>null};
    vm.runInNewContext(`const Q=s=>document.querySelector(s),root=document.documentElement;${paletteSource}\nsyncSelectionPalette();`,{document,window:{__PSR_MAP__:map}});
    return layers;
  };
  const light=run('light'),dark=run('dark');
  assert.equal(light[0].paint['line-color'],'#526b70');
  assert.equal(dark[0].paint['line-color'],'#a0bab9');
  assert.ok(JSON.stringify(light[1].paint['fill-color']).includes('#526b70'));
  assert.equal(light[2].paint['circle-stroke-color'],'#89959a');
  assert.equal(light[2].paint['circle-color'],'rgba(82,107,112,.08)');
  assert.ok(JSON.stringify(light[3].paint['circle-color']).includes('#89959a'));
  assert.ok(!JSON.stringify(light[3].paint['circle-color']).includes('#ffc866'));
  assert.ok(JSON.stringify(light[5].paint['circle-color']).includes('#4f817c'));
  assert.equal(light[4].paint['line-color'],'#69d8ff');
});

test('timeline is unframed, full width and contains no play control',()=>{
  assert.match(css,/#tl-dock\{[\s\S]*border:0!important[\s\S]*background:transparent!important/);
  assert.match(css,/#tl-slider/);
  assert.match(app,/for\(const id of \['mm-play','tg-play'\]/);
  assert.doesNotMatch(app,/Play timeline/);
});

test('build emits the minimalist release after unified map source',()=>{
  assert.ok(worker.includes('20261003-minimal-map-v1'));
  assert.ok(worker.includes('Minimalist map composition from approved October UI mockup'));
  assert.ok(worker.indexOf('20260930-unified-map-v2')<worker.indexOf('20261003-minimal-map-v1'));
});
