import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const app=await fs.readFile(new URL('../src/minimal-map/app.js',import.meta.url),'utf8');
const css=await fs.readFile(new URL('../src/minimal-map/style.css',import.meta.url),'utf8');
const worker=await fs.readFile(new URL('../src/worker.js',import.meta.url),'utf8');
const builder=await fs.readFile(new URL('../scripts/build-smart.mjs',import.meta.url),'utf8');
const baseApp=await fs.readFile(new URL('../src/assets/app-v2.js',import.meta.url),'utf8');

test('minimal composition exposes the approved controls without changing evidence ownership',()=>{
  for(const label of ['Map','Satellite','3D','Heatmap','Price / sqft','ROI','Transaction Volume','Forecast'])assert.ok(app.includes(label),label);
  assert.match(app,/transaction_value_aed/);
  assert.match(app,/EspaciosUnifiedMap\?\.setMetric/);
  assert.doesNotMatch(app,/DATA_ROOM_PUBLIC|SUPABASE|service_role|MARKET_R2|env\.DB/);
  assert.match(app,/\['price','Price \/ sqft','accent'\]/);
  assert.doesNotMatch(app,/\['price','Price \/ sqft','gold'\]/);
});

test('bundled map focus and fallback colors use the shared neutral Espacios theme',()=>{
  assert.match(css,/--minimal-accent:var\(--minimal-blue\)/);
  assert.match(css,/html body #app \.ae-mobile-map-modes \.rail-btn\{[\s\S]*?background:color-mix\(in srgb,var\(--su-panel,#f4f6f7\) 92%,transparent\)!important[\s\S]*?color:var\(--su-ink,#27323b\)!important/);
  assert.match(css,/\.layer-rail \.rail-btn\.active,[\s\S]*?background:color-mix\(in srgb,var\(--su-panel,#f4f6f7\) 94%,var\(--su-ink,#27323b\) 6%\)!important[\s\S]*?box-shadow:inset 0 -2px 0 color-mix\(in srgb,var\(--minimal-accent,#657d98\) 35%,var\(--su-panel,#f4f6f7\)\)!important/);
  assert.match(css,/html\{[\s\S]*?--ae-gold:var\(--minimal-accent\)/);
  assert.match(css,/--minimal-selected:color-mix\(in srgb,var\(--minimal-accent\) 4%,var\(--su-panel\)\)/);
  assert.match(css,/--minimal-selected-line:color-mix\(in srgb,var\(--minimal-accent\) 14%,var\(--su-line\)\)/);
  assert.match(css,/\.ae-search-map-tools \.ae-map-focus-toggle\.active[\s\S]*?background:var\(--minimal-selected\)!important/);
  assert.match(css,/#minimal-map-modes button\[aria-pressed="true"\][\s\S]*?background:var\(--minimal-selected\);border:1px solid var\(--minimal-selected-line\)/);
  assert.match(css,/#minimal-map-modes button\{[^}]*transition:background-color \.16s ease,border-color \.16s ease,color \.16s ease/);
  assert.match(css,/:is\(#toggle-3d\.active,.ae-mobile-map-modes #toggle-3d\.active\)[\s\S]*?background:var\(--minimal-selected\)!important/);
  assert.match(css,/\.ae-mobile-map-modes \.rail-btn\{[\s\S]*?background:var\(--minimal-surface\)!important[\s\S]*?color:var\(--su-ink\)!important/);
  assert.match(css,/\.ae-mobile-map-modes \.rail-btn\.active[\s\S]*?background:var\(--minimal-selected\)!important[\s\S]*?box-shadow:inset 0 -2px 0 var\(--minimal-accent\)!important/);
  assert.match(css,/#minimal-map-modes button\[aria-pressed="true"\],[\s\S]*?background:color-mix\(in srgb,var\(--su-panel\) 94%,transparent\)!important[\s\S]*?color:var\(--su-ink\)!important/);
  assert.match(css,/\.quality-shield\{\s*border-color:var\(--minimal-selected-line\)!important;[\s\S]*?color:var\(--minimal-accent\)!important/);
  assert.match(css,/\.detail-badge\{\s*border-color:var\(--minimal-selected-line\)!important;[\s\S]*?color:var\(--su-ink\)!important/);
  assert.ok(worker.includes('.ae-mobile-map-modes .rail-btn{'));
  assert.ok(worker.includes('background:var(--minimal-surface)!important'));
  assert.ok(worker.includes('box-shadow:inset 0 -2px 0 var(--minimal-accent)!important'));
  assert.ok(worker.includes('background:color-mix(in srgb,var(--su-panel,#f4f6f7) 92%,transparent)!important'));
  assert.match(css,/\.ae-search-map-tools button[\s\S]*?color:var\(--su-muted\)!important/);
  assert.match(css,/\.map-bottom \.dot\.fallback\{\s*background:#89959a!important;box-shadow:none!important/);
  assert.match(css,/--eg-theme-apricot:var\(--minimal-neutral\)/);
  assert.match(css,/\.dot\.fallback\{\s*background:var\(--minimal-neutral\)!important;box-shadow:none!important/);
  assert.match(css,/\.ae-emirate-row:nth-child\(3\) \.ae-emirate-mark\{\s*background:radial-gradient\(circle at 62% 28%,color-mix\(in srgb,var\(--minimal-accent\)/);
  assert.doesNotMatch(css,/#c9a45d|#c77955/i);
  assert.match(css,/--gold:var\(--minimal-accent\)/);
  assert.match(css,/--psr-gold:var\(--minimal-accent\)/);
  assert.match(css,/--ae-gold:var\(--minimal-accent\)/);
  assert.match(css,/\.quality-filter button\.active/);
  assert.match(css,/\.availability-filter button\.active/);
  assert.match(css,/\.route-card\.active/);
  assert.match(css,/\.search-wrap:focus-within/);
  assert.ok(worker.includes('background:var(--minimal-selected)!important'));
  assert.ok(worker.includes('background:var(--minimal-selected);border:1px solid var(--minimal-selected-line)'));
  assert.ok(worker.includes('--ae-premium-gold:var(--minimal-accent)'));
  assert.ok(worker.lastIndexOf('--eg-theme-apricot:var(--minimal-neutral)')>worker.indexOf('--eg-theme-apricot:#c77955'));
  assert.ok(worker.lastIndexOf('.ae-emirate-row:nth-child(3) .ae-emirate-mark')>worker.indexOf('#c9a45d'));
  assert.match(worker,/\.map-bottom \.dot\.fallback\{\\n\s*background:#89959a!important;box-shadow:none!important/);
});

test('selection and watchlist colors use Espacios slate and teal, not legacy gold',()=>{
  assert.match(app,/selectionLight='#5f6d85',selectionDark='#aab7bd'/);
  assert.match(app,/hotspotColors=\['#4f817c','#718991','#9ba8ac'\]/);
  assert.match(app,/ae-emerging-hotspots','circle-color',expression/);
  assert.match(app,/layer\.paint\?\.\[property\]===undefined\)continue/);
  assert.match(app,/attributeFilter:\['data-espacios-theme'\]/);
  assert.doesNotMatch(app,/paletteCopy|refreshPaletteCopy/);
  assert.doesNotMatch(app,/PSR_GOLD/);
  assert.ok(worker.includes("setPaintProperty('ae-emerging-hotspots','circle-color',expression)"));
  assert.match(builder,/paletteCopyReplacements/);
  assert.match(builder,/Selected places are outlined for orientation, not as a price signal/);
  assert.match(builder,/do not represent expected property returns/);
  assert.doesNotMatch(baseApp,/Gold (?:indicates|is this selected)|Gold remains selection-only/);
});

test('active map controls share the soft Espacios palette in light and dark themes',()=>{
  assert.match(css,/V26: keep selected map controls on the same quiet Espacios surface/);
  assert.match(css,/\.layer-rail \.rail-btn\.active,[\s\S]*#minimal-map-modes button\[aria-pressed="true"\],[\s\S]*#minimal-kind-controls button\[aria-pressed="true"\],[\s\S]*\.ae-search-map-tools \.ae-map-focus-toggle\.active[\s\S]*background:var\(--minimal-selected\)!important;[\s\S]*color:var\(--su-ink\)!important;[\s\S]*box-shadow:none!important/);
  assert.match(css,/\.search-item:hover,[\s\S]*?\.search-item\.is-active\{[\s\S]*?border-color:var\(--minimal-selected-line\)!important;[\s\S]*?background:var\(--minimal-selected\)!important/);
  assert.match(css,/\.search-item\.is-active\{\s*box-shadow:inset 3px 0 0 var\(--minimal-accent\)!important/);
  assert.doesNotMatch(css,/(?:#(?:c7a24d|c4a04b|c89b3f|d9be78)|rgba\((?:199,162,77|200,155,63),)/i);
  assert.match(css,/--minimal-selected:color-mix\(in srgb,var\(--minimal-accent\) 4%,var\(--su-panel\)\)/);
  assert.match(css,/--minimal-selected-line:color-mix\(in srgb,var\(--minimal-accent\) 14%,var\(--su-line\)\)/);
  assert.match(css,/Light mode also needs the unselected place cards on a pale surface/);
  assert.match(css,/data-espacios-theme="light"[\s\S]*?\.category-list button:not\(\.active\)[\s\S]*?background:color-mix\(in srgb,var\(--su-panel\) 90%,transparent\)!important/);
  assert.match(css,/data-espacios-theme="dark"[\s\S]*?--minimal-blue:#a7bbcf/);
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
  assert.equal(light[0].paint['line-color'],'#5f6d85');
  assert.equal(dark[0].paint['line-color'],'#aab7bd');
  assert.ok(JSON.stringify(light[1].paint['fill-color']).includes('#5f6d85'));
  assert.equal(dark[2].paint['circle-color'],'rgba(170,183,189,.10)');
  assert.equal(light[2].paint['circle-stroke-color'],'#89959a');
  assert.equal(light[2].paint['circle-color'],'rgba(95,109,133,.08)');
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
  assert.ok(worker.includes('20261008-map-palette-v27'));
  assert.ok(worker.includes('Minimalist map composition from approved October UI mockup'));
  assert.ok(worker.indexOf('20260930-unified-map-v2')<worker.indexOf('Minimalist map composition from approved October UI mockup'));
});
