import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as SECore from '../src/smart-estimates/core.mjs';

const source = await fs.readFile(new URL('../src/smart-estimates/app.js', import.meta.url), 'utf8');
const instrumented = source.replace(' const timer=setInterval', ' globalThis.__SMART_TEST__={S,field,calculation,estimate,selected,rows,results,history,method,render,mapCohort,mapGeometry,installProjectionNavigation};\n const timer=setInterval');
assert.notEqual(instrumented, source, 'Test-only access injection point exists');
const near = (a, b, e = 1e-8) => assert.ok(Math.abs(a - b) <= e, `${a} != ${b}`);
function fixture(segment = 'apartment', extra = {}) {
  const row = {id: 'test-' + segment, sourceId: 'publisher-current', sourceObservationId: 'current-' + segment, evidenceClass: 'advertised_price_benchmark', emirate: 'Dubai', geography: 'Exact area', segment, registration: 'Not specified by publisher', unit: 'AED/sqft', anchor: {value: 1000, period: '2026H1', periodEnd: '2026-06-30', sourceId: 'publisher-current', unit: 'AED/sqft'}, grossYieldBenchmark: {value: segment === 'apartment' ? 8 : 6, period: '2026H1', sourceId: 'publisher-current'}, history: {rows: [{id: 'current-' + segment, sourceId: 'publisher-current', period: '2026H1', sourceUrl: 'https://publisher.example/current', askPsf: 1000, roi: 8}, {id: 'old-' + segment, sourceId: 'publisher-old', period: '2025FY', sourceUrl: 'https://publisher.example/old', askPsf: 900, roi: null}]}, ...extra};
  row.estimate = row.anchor ? SECore.derivePriceScenario({...row, frequency: 'quarterly', points: []}, {asOf: '2026-09-30T00:00:00Z', anchor: row.anchor}) : null;
  if (extra.estimate === null) row.estimate = null;
  return row;
}
function harness(records = [fixture()], additions = {}) {
  const nodes = new Map(), defaults = {capital: '1000000', yield: '8', 'yield-apartment': '8', 'yield-villa': '6', buy: '7', sell: '2', holding: '1', vacancy: '5', rentgrowth: '0', income: '1', weight: '50'};
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {value: defaults[selector.replace('#se-', '')] || '', innerHTML: '', textContent: '', hidden: false, disabled: false, parentElement: {hidden: false, firstChild: {textContent: selector}}, checkValidity(){const id=selector.replace('#se-',''),spec=[...source.matchAll(/field\('([^']+)','([^']+)',('[^']*'|[^,]+),([^,]+),([^,]+),([^)]+)\)/g)].find(m=>m[1]===id);if(!spec)return Number.isFinite(Number(this.value));const html=api.field(id,spec[2],this.value,Number(spec[4]),Number(spec[5]),Number(spec[6])),min=Number(/min="([^"]+)"/.exec(html)[1]),max=Number(/max="([^"]+)"/.exec(html)[1]),step=/step="([^"]+)"/.exec(html)[1],value=Number(this.value),units=(value-min)/Number(step);return Number.isFinite(value)&&value>=min&&value<=max&&(step==='any'||Math.abs(units-Math.round(units))<1e-8);}, querySelectorAll(){return [];}, setAttribute(){}, remove(){}, insertAdjacentHTML(where, html){this.innerHTML += html;}});
    const el=nodes.get(selector);if(!Object.getOwnPropertyDescriptor(el,'value').set){let value=String(el.value);Object.defineProperty(el,'value',{enumerable:true,get(){return value;},set(next){value=String(next);}});}return el;
  };
  const sandbox = {SECore, window: {}, document: {querySelector: node, documentElement: {dataset: {}}}, setInterval: () => 1, clearInterval: () => {}, map: {getLayer: () => null, setLayoutProperty(){}}, msState: {area: 'Exact area', kind: 'price'}, arState: {segment: 'apartment'}, bhState: {registration: 'Ready', frequency: 'quarterly'}, ueState: {requestedFrequency: null}, ppState: {error: ''}, tlState: {loading: false, series: [], period: '2026-08'}, ppActive: () => true, ppSelected: () => null, ppSync: () => {}, tlStop: () => {}, sgState: {data: {features: []}}, SG: {key: (e,n) => e + '|' + n}, ...additions};
  sandbox.ppSeries = name => sandbox.tlState.series.find(s => s.geography === name) || null;
  sandbox.tlChooseDate = period => {sandbox.tlState.period = period;};
  sandbox.tlLoadHistory ||= async () => {};
  sandbox.ppOpen = async (date, basket) => {sandbox.bhState.frequency = sandbox.ueState.requestedFrequency || sandbox.bhState.frequency;sandbox.ueState.requestedFrequency = null;sandbox.tlState.period = '2026-08';await sandbox.tlLoadHistory();};
  vm.createContext(sandbox); new vm.Script(instrumented).runInContext(sandbox);
  const api = sandbox.__SMART_TEST__;
  Object.assign(api.S, {open: true, data: {version: 'test', asOf: '2026-09-30T00:00:00Z', sales: records.filter(r => r.evidenceClass === 'registered_sale'), asking: records.filter(r => r.evidenceClass !== 'registered_sale'), sources: []}, area: 'Exact area', emirate: 'Dubai', kind: 'roi', basis: 'asking', segment: 'apartment', year: 3, case: 'reference'});
  return {api, sandbox, node};
}

test('UI passes percentage units unchanged and uses the correct ROI result fields', () => {
  const {api,node} = harness(); const out = api.calculation(), r = out.returns[0].result;
  near(r.initialOutlay, 1070000); near(r.cashflows[1].rent, 76000); near(r.cashflows[1].operatingCosts, 10000); near(r.cashflows[3].disposalCosts, 20000); near(r.netProfit, 108000);
  assert.equal(r.assumptions.normalizedCapital, 1000000); assert.equal(out.inputs.vacancyPct, 5);
  api.results(); const html = node('#se-result').innerHTML;
  assert.match(html, /10\.1%/); assert.match(html, /108,000/); assert.match(html, /1,070,000/); assert.doesNotMatch(html, /—%|AED —/);
  assert.match(html, /2026H1 → 2029H1/); assert.match(html, /not today/); assert.match(html, /Annual cash flows/);
});
test('single-type user rental assumption overrides benchmark and remains explicit', () => {
  const {api,node} = harness(); node('#se-yield').value = '3'; const out = api.calculation();
  assert.equal(out.returns[0].yieldAssumptionPct, 3); assert.equal(out.returns[0].grossYieldBenchmark.value, 8); near(out.returns[0].result.assumptions.annualRent, 30000);
  assert.match(out.returns[0].rentInputClassification, /not_observed_rent/);
});
test('both types use independent editable rental assumptions and capital-weighted cashflows', () => {
  const {api,node} = harness([fixture('apartment'), fixture('villa')]); api.S.segment = 'both'; node('#se-yield-apartment').value = '4'; node('#se-yield-villa').value = '12'; node('#se-weight').value = '25';
  const out = api.calculation(), apt = out.returns.find(x => x.segment === 'apartment'), villa = out.returns.find(x => x.segment === 'villa'), mixed = out.returns.find(x => x.segment === 'combined');
  near(apt.result.assumptions.annualRent, 40000); near(villa.result.assumptions.annualRent, 120000); near(mixed.result.cashflows[1].rent, 95000);
  assert.equal(out.combinedUnavailable, null); assert.equal(mixed.anchorPeriod, '2026H1');
});
test('combined registered-sales scenarios permit explicit rent inputs without a benchmark', () => {
  const make = type => fixture(type, {evidenceClass: 'registered_sale', registration: 'Ready', grossYieldBenchmark: null});
  const {api,node} = harness([make('apartment'),make('villa')]); api.S.basis = 'sales'; api.S.segment = 'both'; node('#se-yield-apartment').value = '5'; node('#se-yield-villa').value = '7';
  assert.ok(api.calculation().returns.some(r => r.segment === 'combined'));
});
test('missing one property type does not produce or export a false combined portfolio', () => {
  const {api,node} = harness([fixture('apartment')]); api.S.segment = 'both';
  const out = api.calculation(); assert.equal(out.returns.length, 1); assert.match(out.combinedUnavailable, /requires eligible apartment and villa/);
  api.results(); assert.match(node('#se-result').innerHTML, /do not represent a mixed portfolio/); assert.doesNotMatch(node('#se-result').innerHTML, /CAPITAL-WEIGHTED PORTFOLIO/);
});
test('mixed source periods retain individual results but withhold the combined return', () => {
  const older = fixture('villa', {anchor: {value: 900, period: '2025FY', periodEnd: '2025-12-31', sourceId: 'publisher-old', unit: 'AED/sqft'}});
  const {api} = harness([fixture('apartment'),older]); api.S.segment = 'both';
  const out = api.calculation(); assert.equal(out.returns.length, 2); assert.match(out.combinedUnavailable, /exact anchor period/);
});
test('no baseline never becomes zero-price or assumed-yield output', () => {
  const row = fixture('apartment', {anchor: null}); const {api,node} = harness([row]); node('#se-yield').value = '';
  const out = api.calculation(); assert.equal(out.returns.length, 0); assert.equal(out.paths[0].estimate, null);
  api.results(); assert.equal(node('#se-export').disabled, true); assert.match(node('#se-result').innerHTML, /Evidence retained/);
});
test('stale anchors require opt-in and retain their original date', () => {
  const older = fixture('apartment', {estimate: null, anchor: {value: 900, period: '2025FY', periodEnd: '2025-12-31', sourceId: 'publisher-current', unit: 'AED/sqft'}});
  const {api,node} = harness([older]); assert.equal(api.estimate(older), null); api.S.stale = true;
  assert.equal(api.estimate(older).basis, 'explicit_assumptions'); assert.equal(api.estimate(older).baseline.period, '2025FY');
  const out = api.calculation(); assert.equal(out.olderAnchorOptIn, true); assert.equal(out.returns[0].targetPeriod, '2028FY');
  api.results(); assert.match(node('#se-result').innerHTML, /Older source anchor used by explicit opt-in/);
});
test('first income year and cash-flow disclosure agree', () => {
  const {api,node} = harness(); node('#se-income').value = '3'; node('#se-rentgrowth').value = '10'; api.S.year = 5;
  const r = api.calculation().returns[0].result; assert.equal(r.cashflows[1].rent, 0); assert.equal(r.cashflows[2].rent, 0); near(r.cashflows[3].rent, 76000); near(r.cashflows[4].rent, 83600);
  api.results(); assert.match(node('#se-result').innerHTML, /Growth begins the following year/);
});
test('rent overrides survive horizon/path/metric rerenders; source changes reset them', () => {
  const {api,node} = harness([fixture(),fixture('apartment',{id:'other',geography:'Other area',grossYieldBenchmark:{value:9}})]); api.render(true); node('#se-yield').value = '3.5';
  api.S.year = 5; api.render(); api.S.case = 'higher'; api.render(); api.S.kind = 'price'; api.render(true); api.S.kind = 'roi'; api.render(true); assert.equal(node('#se-yield').value, '3.5');
  api.S.area = 'Other area'; api.render(true); assert.equal(node('#se-yield').value, '9');
});
test('method link resolves the displayed source observation, not the final appended historical row', () => {
  const {api,node} = harness(); api.method(); const html = node('#se-method').innerHTML;
  assert.match(html, /href="https:\/\/publisher\.example\/current"/); assert.doesNotMatch(html, /href="https:\/\/publisher\.example\/old"/);
  api.history(); assert.match(node('#se-history-body').innerHTML, /Not published/); assert.doesNotMatch(node('#se-history-body').innerHTML, /—%/);
});
test('scenario map cohort cannot mix source dates or asking/sale basis', () => {
  const a = fixture(), b = fixture('apartment',{id:'different-date',geography:'Different date',anchor:{value:900,period:'2025FY',periodEnd:'2025-12-31',sourceId:'publisher-current',unit:'AED/sqft'}}), c = fixture('apartment',{id:'same-date',geography:'Same date'});
  const {api} = harness([a,b,c]); api.S.kind = 'price'; const cohort = api.mapCohort(); assert.equal(cohort.length, 2); assert.ok(cohort.every(p => p.estimate.baseline.period === '2026H1'));
});
test('reviewed geometry identifier wins; ambiguous and nearby names are never guessed', () => {
  const {api,sandbox} = harness(); const geo = (id,name) => ({id,properties:{emirate:'Dubai',name,level:'community',rank:1}});
  sandbox.sgState.data.features = [geo('official-1','Different published boundary name'),geo('exact','Exact area'),geo('nearby','Exact area extension')];
  assert.equal(api.mapGeometry({evidenceClass:'registered_sale',geometryIds:['official-1'],emirate:'Dubai',geography:'Exact area'}).id,'official-1');
  assert.equal(api.mapGeometry({evidenceClass:'registered_sale',geometryIds:['official-1','exact'],emirate:'Dubai',geography:'Exact area'}),null);
  assert.equal(api.mapGeometry({evidenceClass:'advertised_price_benchmark',emirate:'Dubai',geography:'Exact'}),null);
});
test('released research navigation forces monthly and chooses the exact selected area target after load', async () => {
  const {api,sandbox,node} = harness(); sandbox.tlState.series = [{geography:'Exact area',points:[{period:'2026-08',value:1000},{period:'2027-02',value:1010,projection:true}]},{geography:'Other area',points:[{period:'2026-11',value:1200,projection:true}]}];
  api.installProjectionNavigation(); assert.equal(node('#pp-projection').disabled,false); await sandbox.ppOpen('projection','apartment|Ready');
  assert.equal(sandbox.bhState.frequency,'monthly'); assert.equal(sandbox.tlState.period,'2027-02');
});
test('released research navigation does not borrow another area forecast', async () => {
  const {api,sandbox} = harness(); sandbox.tlState.series = [{geography:'Exact area',points:[{period:'2026-08',value:1000}]},{geography:'Other area',points:[{period:'2026-11',value:1200,projection:true}]}];
  api.installProjectionNavigation(); await sandbox.ppOpen('projection','apartment|Ready'); assert.equal(sandbox.tlState.period,'2026-08'); assert.match(sandbox.ppState.error,/No released research projection for Exact area/);
});
test('in-flight research navigation is discarded when selected area changes', async () => {
  let finish; const {api,sandbox} = harness([], {tlLoadHistory: () => new Promise(resolve => {finish=resolve;})});
  sandbox.tlState.series = [{geography:'Exact area',points:[{period:'2026-11',value:1200,projection:true}]}]; api.installProjectionNavigation(); const pending=sandbox.ppOpen('projection','apartment|Ready');sandbox.msState.area='Other area';finish();await pending;assert.equal(sandbox.tlState.period,'2026-08');
});
test('unsupported requested area remains explicit and never switches to a convenient benchmark', () => {
  const {api,node} = harness([fixture('apartment',{geography:'Palm Jumeirah'}),fixture('apartment',{geography:'Yas Island'})]);
  api.S.area = 'The World Islands'; api.render(true);
  assert.equal(api.S.area,'The World Islands'); assert.equal(node('#se-area').value,'The World Islands');
  assert.match(node('#se-area').innerHTML,/The World Islands · no compatible anchor/);
  assert.match(node('#se-result').innerHTML,/No approved local price anchor for The World Islands/);
  assert.equal(api.calculation().paths.length,0); assert.equal(node('#se-export').disabled,true);
});
test('clearing a filter selection requires an explicit alternative area choice', () => {
  const {api,node} = harness([fixture('apartment',{geography:'Palm Jumeirah'})]); api.S.area='';api.render(true);
  assert.equal(api.S.area,'');assert.equal(node('#se-area').value,'');assert.match(node('#se-area').innerHTML,/Choose a source area/);assert.equal(api.calculation().paths.length,0);
});
test('HTML number constraints accept default capital and exact source yield precision', () => {
  const {api,node}=harness([fixture('apartment',{grossYieldBenchmark:{value:6.34}})]);api.render(true);
  assert.equal(node('#se-capital').checkValidity(),true);assert.equal(node('#se-yield').checkValidity(),true);
  assert.match(api.field('capital','Capital',1000000,1,1000000000,10000),/step="1"/);
  for(const id of ['yield','yield-apartment','yield-villa'])assert.match(api.field(id,'Yield','',0,100,.1),/step="any"/);
  assert.equal(api.calculation().returns[0].yieldAssumptionPct,6.34);node('#se-capital').value='0';assert.equal(node('#se-capital').checkValidity(),false);
});
