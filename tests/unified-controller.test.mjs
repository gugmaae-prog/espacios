import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as SECore from '../src/smart-estimates/core.mjs';
import * as UMCore from '../src/unified-map/core.mjs';

const controllerSource = await fs.readFile(new URL('../src/unified-map/app.js', import.meta.url), 'utf8');
const smartSource = await fs.readFile(new URL('../src/smart-estimates/app.js', import.meta.url), 'utf8');
// Execute production closures with a small deterministic DOM/map boundary. Only
// test access and the otherwise install-time export/tooltip registrations are
// injected; controller and calculation behavior is not copied or replaced.
const registrations = ['const oldTooltip=sgTooltip;', 'const oldExport=tlExport;'].map(prefix => {
  const matches = controllerSource.split('\n').filter(line => line.trim().startsWith(prefix));
  assert.equal(matches.length, 1, `One production ${prefix} registration exists`);
  return matches[0];
}).join('\n');
const controller = controllerSource.replace(' const timer=setInterval', `${registrations}\n globalThis.__UNIFIED_TEST__={U,refresh,choose,render,prepare,readout,mapValue,cohort,current,future,setMetric,setType,hide};\n const timer=setInterval`);
const smart = smartSource.replace(' const timer=setInterval', ' globalThis.__SMART_TEST__={S,estimate,calculation,render};\n const timer=setInterval');
assert.notEqual(controller, controllerSource, 'Controller closure instrumentation point exists');
assert.notEqual(smart, smartSource, 'Smart closure instrumentation point exists');
const plain = value => JSON.parse(JSON.stringify(value));

function row(segment = 'apartment', period = '2026Q2', extra = {}) {
  const anchor = {period, periodEnd: UMCore.periodEnd(period), value: 1000, sourceId: 'reviewed-source', unit: 'AED/sqft'};
  const record = {
    id: `source-${segment}-${period}`, emirate: 'Dubai', geography: 'Exact area', segment,
    registration: 'Ready', evidenceClass: 'registered_sale', sourceId: anchor.sourceId,
    unit: anchor.unit, anchor, geometryIds: ['exact-boundary'],
    grossYieldBenchmark: {value: segment === 'apartment' ? 8 : 6, period},
    history: {rows: [{period, askPsf: anchor.value, roi: 8}]}, ...extra,
  };
  record.estimate = SECore.derivePriceScenario({...record, frequency: 'quarterly', points: []}, {asOf: '2026-09-30', anchor});
  return record;
}

function harness(records = [row()]) {
  const calls = {nativeRender: 0, nativeChoose: [], stop: 0, sync: 0, tooltip: 0, legacyExport: 0, downloads: [], sources: []};
  const timers = new Map(), nodes = new Map(), layers = new Map(); let sequence = 0;
  const defaults = {capital: '1000000', yield: '8', 'yield-apartment': '8', 'yield-villa': '6', buy: '7', sell: '2', holding: '1', vacancy: '5', rentgrowth: '0', income: '1', weight: '50'};
  const node = selector => {
    if (!nodes.has(selector)) {
      let value = defaults[selector.replace('#se-', '')] || '';
      nodes.set(selector, {
        get value() {return value;}, set value(next) {value = String(next);},
        innerHTML: '', textContent: '', hidden: false, disabled: false, dataset: {},
        parentElement: {hidden: false, firstChild: {textContent: selector}},
        checkValidity() {return Number.isFinite(Number(this.value));}, querySelectorAll: () => [],
        setAttribute() {}, remove() {}, insertAdjacentHTML() {}, focus() {},
      });
    }
    return nodes.get(selector);
  };
  const snapshot = {version: 'reviewed-test-snapshot', asOf: '2026-09-30', sales: records.filter(r => r.evidenceClass === 'registered_sale'), asking: records.filter(r => r.evidenceClass !== 'registered_sale'), sources: []};
  const sandbox = {
    SECore, UMCore, window: {}, document: {querySelector: node, documentElement: {dataset: {}}},
    setInterval: () => 1, clearInterval() {},
    setTimeout(fn, ms) {const id = ++sequence; timers.set(id, {fn, ms}); return id;},
    clearTimeout(id) {timers.delete(id);},
    msState: {emirate: 'Dubai', area: 'Exact area', segment: 'apartment', basis: 'sales', kind: 'price'},
    bhState: {registration: 'Ready'},
    tlState: {period: '2026-08', periods: ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11'], loading: false,
      series: [{geography: 'Exact area', points: [{period: '2026-07', value: null}, {period: '2026-08', value: 1000}, {period: '2026-11', value: 1100, projection: true}]}],
      frame: [{name: 'Exact area', period: '2026-08', value: 1000}]},
    tlK: {domain: values => values.length ? [Math.min(...values), Math.max(...values)] : [0, 1], color: () => '#123456'},
    map: {
      getLayer: id => layers.get(id), getStyle: () => ({layers: [...layers].map(([id]) => ({id}))}),
      getLayoutProperty: id => layers.get(id)?.visibility,
      setLayoutProperty(id, key, value) {layers.set(id, {...layers.get(id), [key]: value});},
      addLayer(layer) {layers.set(layer.id, {visibility: 'visible'});},
    },
    sgState: {data: {features: [{id: 'exact-boundary', properties: {name: 'Exact area', emirate: 'Dubai', rank: 1}, geometry: {type: 'Polygon', coordinates: []}}]}},
    SG: {key: (emirate, name) => emirate + '|' + name},
    sgLoad: async () => {}, sgSource: (id, data) => calls.sources.push({id, data}),
    tlStop: () => calls.stop++, tlUpdate: () => calls.nativeRender++,
    tlChooseDate: period => {calls.nativeChoose.push(period); sandbox.tlState.period = period;},
    sgTooltip: () => calls.tooltip++, tlExport: () => calls.legacyExport++,
    tgDownload: (name, value) => calls.downloads.push({name, value}),
    msOpen() {}, msSetSegment(segment) {sandbox.msState.segment = segment;},
    psrSetAnalysis() {}, cxCatalogue: () => false,
  };
  vm.createContext(sandbox);
  new vm.Script(smart).runInContext(sandbox);
  Object.assign(sandbox.__SMART_TEST__.S, {data: snapshot, open: false});
  sandbox.window.EspaciosMobileUI = {sync: () => calls.sync++, activate() {}};
  new vm.Script(controller).runInContext(sandbox);
  const api = sandbox.__UNIFIED_TEST__;
  Object.assign(api.U, {metric: 'price', data: snapshot});
  return {api, smart: sandbox.__SMART_TEST__, sandbox, calls, timers, node, layers, snapshot};
}

test('native options exclude synthetic future gap months but preserve an explicit null source point', async () => {
  const h = harness(); await h.api.refresh();
  assert.equal(h.api.U.error, '');
  const native = h.api.U.options.filter(option => option.kind === 'native');
  assert.deepEqual(plain(native.map(option => [option.period, option.evidenceClass])), [
    ['2026-07', 'registered_sale'], ['2026-08', 'registered_sale'], ['2026-11', 'released_projection'],
  ]);
  assert.ok(!h.api.U.options.some(option => ['2026-09', '2026-10'].includes(option.period)));
  assert.equal(h.api.U.options.filter(option => option.kind === 'scenario').length, 10);
  assert.equal(h.sandbox.tlState.series[0].points[0].value, null);
});

test('estimate endpoint failure preserves loaded historical and released-projection selection', async () => {
  const h = harness();
  const retained = plain({periods: h.sandbox.tlState.periods, series: h.sandbox.tlState.series});
  h.sandbox.window.EspaciosEstimateUI = {...h.sandbox.window.EspaciosEstimateUI, load: async () => {throw new Error('Scenario snapshot temporarily unavailable');}};
  await h.api.refresh();
  assert.equal(h.api.U.loading, false); assert.equal(h.api.U.error, '');
  assert.match(h.api.U.estimatesError, /Future estimates are temporarily unavailable/);
  assert.deepEqual(plain(h.api.U.options.map(option => [option.period, option.evidenceClass])), [
    ['2026-07', 'registered_sale'], ['2026-08', 'registered_sale'], ['2026-11', 'released_projection'],
  ]);
  assert.equal(h.api.current().period, '2026-08'); assert.match(h.api.readout()[0], /1,000 AED\/sqft/);
  assert.match(h.api.readout()[1], /source history is unchanged/);
  h.api.choose(h.api.U.options.find(option => option.period === '2026-07').id);
  const beforeRender = h.calls.nativeRender; await h.api.render();
  assert.equal(h.calls.nativeRender, beforeRender + 1); assert.equal(h.sandbox.tlState.period, '2026-07');
  assert.deepEqual(plain({periods: h.sandbox.tlState.periods, series: h.sandbox.tlState.series}), retained);
});

test('failed estimate refresh exits future shading honestly and recovery restores conditional options', async () => {
  const h = harness(), bridge = h.sandbox.window.EspaciosEstimateUI;
  await h.api.refresh();
  h.api.choose(h.api.U.options.find(option => option.kind === 'scenario').id); await h.api.render();
  assert.equal(h.layers.get('um-fill').visibility, 'visible');
  h.sandbox.window.EspaciosEstimateUI = {...bridge, load: async () => {throw new Error('Transient estimate failure');}};
  await h.api.refresh();
  assert.equal(h.api.current().kind, 'native'); assert.equal(h.api.U.pending, false);
  assert.equal(h.layers.get('um-fill').visibility, 'none'); assert.equal(h.api.U.options.some(option => option.kind === 'scenario'), false);
  assert.match(h.api.readout()[1], /Future estimates are temporarily unavailable/);
  h.sandbox.window.EspaciosEstimateUI = bridge;
  await h.api.refresh();
  assert.equal(h.api.U.estimatesError, ''); assert.equal(h.api.U.options.filter(option => option.kind === 'scenario').length, 10);
  assert.equal(h.api.current().kind, 'native', 'Recovery does not unexpectedly replace the user historical selection');
  assert.doesNotMatch(h.api.readout()[1], /temporarily unavailable/);
});

test('native controller render flushes the real history owner, not only the controls', async () => {
  const h = harness(); await h.api.refresh();
  const native = h.api.U.options.find(option => option.period === '2026-07');
  h.api.choose(native.id);
  const prior = h.calls.nativeRender; await h.api.render();
  assert.equal(h.calls.nativeRender, prior + 1);
  assert.equal(h.sandbox.tlState.period, '2026-07');
  assert.equal(h.api.current().kind, 'native');
});

test('future then immediate historical selection cancels pending work and clears the loading state', async () => {
  const h = harness(); await h.api.refresh();
  const future = h.api.U.options.find(option => option.kind === 'scenario');
  const native = h.api.U.options.find(option => option.period === '2026-08');
  h.api.choose(future.id);
  assert.equal(h.api.U.pending, true); assert.ok(h.timers.has(h.api.U.renderTimer));
  h.api.choose(native.id);
  assert.equal(h.api.U.pending, false); assert.equal(h.api.U.result, null);
  assert.equal(h.timers.has(h.api.U.renderTimer), false);
  assert.doesNotMatch(h.api.readout()[0], /Loading/);
  assert.match(h.api.readout()[0], /1,000 AED\/sqft/);
});

test('historical readout never shows an old frame value under a newly selected period', async () => {
  const h = harness(); await h.api.refresh();
  h.api.choose(h.api.U.options.find(option => option.period === '2026-07').id);
  assert.doesNotMatch(h.api.readout()[0], /1,000/);
  h.sandbox.tlState.frame = [{name: 'Exact area', period: '2026-07', value: 700}];
  assert.match(h.api.readout()[0], /700 AED\/sqft/);
});

test('metric and property changes invalidate a pending future calculation', async () => {
  for (const change of [api => api.setMetric('projects'), api => api.setType('villa')]) {
    const h = harness(); await h.api.refresh();
    h.api.choose(h.api.U.options.find(option => option.kind === 'scenario').id);
    assert.equal(h.api.U.pending, true);
    change(h.api);
    assert.equal(h.api.U.pending, false); assert.equal(h.api.U.result, null);
  }
});

test('one selected target period cannot label a different property anchor anniversary', () => {
  const apartment = row('apartment', '2026Q2'), villa = row('villa', '2026Q1');
  const h = harness([apartment, villa]);
  const selection = {kind: 'price', emirate: 'Dubai', area: 'Exact area', segment: 'both', basis: 'sales', registration: 'Ready', path: 'reference', year: 4, targetPeriod: '2030Q2'};
  const out = h.sandbox.window.EspaciosEstimateUI.prepare(selection);
  assert.equal(out.error, undefined);
  assert.equal(out.calculation.paths[0].estimate.scenarios.reference.annual[3].period, '2030Q2');
  assert.equal(out.calculation.paths[1].estimate, null, '2030Q1 is not relabelled 2030Q2');
  const reverse = h.sandbox.window.EspaciosEstimateUI.prepare({...selection, targetPeriod: '2030Q1'});
  assert.equal(reverse.calculation.paths[0].estimate, null);
  assert.equal(reverse.calculation.paths[1].estimate.scenarios.reference.annual[3].period, '2030Q1');
});

test('future export uses selected conditional target rather than retained historical tlState', async () => {
  const h = harness(); await h.api.refresh();
  const future = h.api.U.options.find(option => option.period === '2036Q2');
  h.api.choose(future.id); h.sandbox.tlExport();
  assert.equal(h.calls.legacyExport, 0); assert.equal(h.calls.downloads.length, 1);
  const {name, value} = h.calls.downloads[0];
  assert.match(name, /2036Q2/); assert.equal(value.classification, 'conditional_scenario');
  assert.equal(value.selection.period, '2036Q2'); assert.equal(value.selection.area, 'Exact area');
  assert.equal(value.calculation.paths[0].estimate.scenarios.reference.annual[9].period, '2036Q2');
  assert.equal(h.sandbox.tlState.period, '2026-08', 'Retained history is not rewritten to a future label');
  h.api.choose(h.api.U.options.find(option => option.period === '2026-08').id); h.sandbox.tlExport();
  assert.equal(h.calls.legacyExport, 1, 'Native export remains with its original evidence owner');
});

test('legacy historical tooltips are suppressed in future views and restored in history', async () => {
  const h = harness(); await h.api.refresh();
  h.sandbox.sgTooltip({point: {x: 1, y: 1}}); assert.equal(h.calls.tooltip, 1);
  h.api.choose(h.api.U.options.find(option => option.kind === 'scenario').id);
  h.node('#tl-tooltip').hidden = false; h.node('#sg-tooltip').hidden = false;
  h.sandbox.sgTooltip({point: {x: 1, y: 1}});
  assert.equal(h.calls.tooltip, 1); assert.equal(h.node('#tl-tooltip').hidden, true); assert.equal(h.node('#sg-tooltip').hidden, true);
  h.api.choose(h.api.U.options.find(option => option.kind === 'native').id);
  h.sandbox.sgTooltip({point: {x: 1, y: 1}}); assert.equal(h.calls.tooltip, 2);
});

test('future rendering hides historical fallback pins and restores their original visibility', async () => {
  const h = harness(); await h.api.refresh();
  h.layers.set('ue-benchmark-point', {visibility: 'visible'});
  h.layers.set('ue-benchmark-label', {visibility: 'none'});
  h.api.choose(h.api.U.options.find(option => option.kind === 'scenario').id);
  await h.api.render();
  assert.equal(h.api.U.error, ''); assert.equal(h.layers.get('ue-benchmark-point').visibility, 'none');
  assert.equal(h.layers.get('ue-benchmark-label').visibility, 'none');
  assert.equal(h.calls.sources.at(-1).data.features[0].properties.period, '2027Q2');
  h.api.choose(h.api.U.options.find(option => option.kind === 'native').id);
  assert.equal(h.layers.get('ue-benchmark-point').visibility, 'visible');
  assert.equal(h.layers.get('ue-benchmark-label').visibility, 'none');
});

test('changing future date/path keeps a manually edited rent within its selected investment', () => {
  const h = harness([row('apartment', '2026H1', {evidenceClass: 'advertised_price_benchmark'})]);
  const selection = {kind: 'roi', emirate: 'Dubai', area: 'Exact area', segment: 'apartment', basis: 'asking', registration: 'Ready', path: 'reference', year: 1, targetPeriod: '2027H1'};
  h.sandbox.window.EspaciosEstimateUI.prepare(selection);
  h.node('#se-yield').value = '3.125';
  const out = h.sandbox.window.EspaciosEstimateUI.prepare({...selection, year: 30, targetPeriod: '2056H1', path: 'lower'});
  assert.equal(out.error, undefined); assert.equal(h.node('#se-yield').value, '3.125');
  assert.equal(out.calculation.returns[0].yieldAssumptionPct, 3.125);
  assert.equal(out.calculation.returns[0].result.assumptions.annualRent, 31250);
  assert.equal(out.calculation.returns[0].result.assumptions.horizonYears, 30);
});
