import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const app=await fs.readFile(new URL('../src/minimal-map/app.js',import.meta.url),'utf8');
const css=await fs.readFile(new URL('../src/minimal-map/style.css',import.meta.url),'utf8');
const worker=await fs.readFile(new URL('../src/worker.js',import.meta.url),'utf8');

test('minimal composition exposes the approved controls without changing evidence ownership',()=>{
  for(const label of ['Map','Satellite','3D','Heatmap','Price / sqft','ROI','Transaction Volume','Forecast'])assert.ok(app.includes(label),label);
  assert.match(app,/transaction_value_aed/);
  assert.match(app,/EspaciosUnifiedMap\?\.setMetric/);
  assert.match(app,/DATA_ROOM_PUBLIC|SUPABASE|service_role|MARKET_R2|env\.DB/g,()=>false);
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
