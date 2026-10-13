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
const registrations = ['const oldTooltip=sgTooltip;', 'const oldExport=tlExport;', 'const oldRender=tlUpdate;'].map(prefix => {
  const matches = controllerSource.split('\n').filter(line => line.trim().startsWith(prefix));
  assert.equal(matches.length, 1, `One production ${prefix} registration exists`);
  return matches[0];
}).join('\n');
const controller = controllerSource.replace(' const timer=setInterval', `${registrations}\n globalThis.__UNIFIED_TEST__={U,refresh,choose,render,prepare,readout,mapValue,cohort,current,future,setMetric,setType,hide,setMapDisplay,displayContext,sync,details};\n const timer=setInterval`);
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
  const calls = {nativeRender: 0, nativeChoose: [], stop: 0, sync: 0, tooltip: 0, legacyExport: 0, downloads: [], sources: [], contexts: [], analyses: [], views: [], activations: [], inspectorInfo: 0, nativeEffect: null};
  const timers = new Map(), nodes = new Map(), layers = new Map(), mapEvents = new Map(); let sequence = 0;
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
    SECore, UMCore, window: {}, document: {querySelector: node, documentElement: {dataset: {}}, dispatchEvent(event) {calls.contexts.push(event);}},
    CustomEvent: class {constructor(type, options) {this.type = type; this.detail = options.detail;}},
    setInterval: () => 1, clearInterval() {},
    setTimeout(fn, ms) {const id = ++sequence; timers.set(id, {fn, ms}); return id;},
    clearTimeout(id) {timers.delete(id);},
    msState: {emirate: 'Dubai', area: 'Exact area', segment: 'apartment', basis: 'sales', kind: 'price'},
    bhState: {registration: 'Ready'}, tgState: {coverage: 'catalogue'}, aeUaeState: {view: 'heat', renderedPeriod: null}, state: {analysisMetric: 'history:dubai-sale-psf'},
    rcK: {key: (emirate, name) => emirate + '|' + (emirate === 'Dubai' ? String(name || '').replace('Palm Jabal Ali', 'Palm Jebel Ali') : name)},
    tlState: {period: '2026-08', periods: ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11'], loading: false,
      series: [{geography: 'Exact area', points: [{period: '2026-07', value: null}, {period: '2026-08', value: 1000}, {period: '2026-11', value: 1100, projection: true}]}],
      frame: [{name: 'Exact area', period: '2026-08', value: 1000}]},
    tlK: {domain: values => values.length ? [Math.min(...values), Math.max(...values)] : [0, 1], color: () => '#123456'},
    map: {
      on(name, fn) {mapEvents.set(name, fn);},
      getLayer: id => layers.get(id), getStyle: () => ({layers: [...layers].map(([id]) => ({id}))}),
      getLayoutProperty: id => layers.get(id)?.visibility,
      setLayoutProperty(id, key, value) {layers.set(id, {...layers.get(id), [key]: value}); mapEvents.get('styledata')?.();},
      addLayer(layer) {layers.set(layer.id, {visibility: 'visible'}); mapEvents.get('styledata')?.();},
    },
    sgState: {data: {features: [{id: 'exact-boundary', properties: {name: 'Exact area', emirate: 'Dubai', rank: 1}, geometry: {type: 'Polygon', coordinates: []}}]}},
    SG: {key: (emirate, name) => emirate + '|' + name},
    sgLoad: async () => {}, sgSource: (id, data) => calls.sources.push({id, data}),
    tlStop: () => calls.stop++, tlUpdate: () => {calls.nativeRender++; calls.nativeEffect?.();},
    tlChooseDate: period => {calls.nativeChoose.push(period); sandbox.tlState.period = period;},
    sgTooltip: () => calls.tooltip++, tlExport: () => calls.legacyExport++,
    tgDownload: (name, value) => calls.downloads.push({name, value}),
    msOpen() {}, msInfo() {calls.inspectorInfo++;}, msSetSegment(segment) {sandbox.msState.segment = segment;},
    psrSetAnalysis(metric) {calls.analyses.push(metric); sandbox.state.analysisMetric = metric; if(metric === 'uae-project-coverage') sandbox.tlState.period = '2026';},
    aeUaeCoverageActive: () => sandbox.state.analysisMetric === 'uae-project-coverage',
    aeUaeSetView(view) {calls.views.push(view); sandbox.aeUaeState.view = view; for(const [id, on] of [['ae-uae-project-heat', view === 'heat'], ['ae-uae-project-points', view === 'points']]) if(layers.has(id)) sandbox.map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');},
    cxCatalogue: () => false,
  };
  vm.createContext(sandbox);
  new vm.Script(smart).runInContext(sandbox);
  Object.assign(sandbox.__SMART_TEST__.S, {data: snapshot, open: false});
  sandbox.window.EspaciosMobileUI = {sync: () => calls.sync++, activate(panel) {calls.activations.push(panel);}};
  new vm.Script(controller).runInContext(sandbox);
  const api = sandbox.__UNIFIED_TEST__;
  Object.assign(api.U, {metric: 'price', data: snapshot});
  return {api, mapEvents, smart: sandbox.__SMART_TEST__, sandbox, calls, timers, node, layers, snapshot};
}

test('Details routes only compatible price evidence and leaves density inert', async () => {
  const h = harness(); await h.api.refresh();
  h.api.U.metric = 'projects'; h.sandbox.state.analysisMetric = 'uae-project-coverage';
  h.api.details();
  assert.equal(h.calls.inspectorInfo, 0);
  assert.deepEqual(h.calls.activations, [], 'Density has no price or yield inspector.');

  h.api.U.metric = 'price'; h.sandbox.state.analysisMetric = 'history:dubai-sale-psf';
  await h.api.refresh();
  assert.equal(h.api.future(), false);
  h.api.details();
  assert.equal(h.sandbox.msState.open, true);
  assert.equal(h.calls.inspectorInfo, 1);
  assert.equal(h.calls.activations.at(-1), h.node('#ms-inspect'));

  h.api.choose(h.api.U.options.find(option => option.kind === 'scenario').id);
  assert.equal(h.api.future(), true);
  h.api.details();
  assert.equal(h.node('#se-panel').hidden, false);
  assert.equal(h.calls.activations.at(-1), h.node('#se-panel'));
});

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

test('Map and Heatmap presentation preserve the selected historical date, scope and source basket', async () => {
  const h = harness(); await h.api.refresh();
  h.api.choose(h.api.U.options.find(o => o.period === '2026-07').id);
  h.layers.set('bh-price-gradient', {visibility: 'visible'});
  h.layers.set('bh-water-mask', {visibility: 'none'});
  const selection = () => plain({selected: h.api.U.selected, options: h.api.U.options, metric: h.api.U.metric,
    period: h.sandbox.tlState.period, series: h.sandbox.tlState.series, market: h.sandbox.msState, registration: h.sandbox.bhState.registration});
  const before = selection(), chosen = h.calls.nativeChoose.length;
  h.calls.nativeEffect = () => {h.sandbox.map.setLayoutProperty('bh-price-gradient', 'visibility', 'visible'); h.sandbox.map.setLayoutProperty('bh-water-mask', 'visibility', 'none');};
  await h.api.setMapDisplay(false);
  assert.equal(h.layers.get('bh-price-gradient').visibility, 'none');
  assert.equal(h.api.displayContext().mapDisplay, false);
  const renders = h.calls.nativeRender;
  await h.api.setMapDisplay(true);
  assert.deepEqual(selection(), before);
  assert.equal(h.calls.nativeChoose.length, chosen, 'Presentation never reselects latest evidence');
  assert.equal(h.calls.nativeRender, renders + 1, 'The existing native owner redraws the same date');
  assert.equal(h.layers.get('bh-price-gradient').visibility, 'visible');
  assert.equal(h.layers.get('bh-water-mask').visibility, 'none');
  assert.deepEqual(h.calls.analyses, [], 'No legacy metric substitution occurs');
});

test('late source layers, refresh and native redraw stay hidden until Heatmap is requested', async () => {
  const h = harness(); await h.api.refresh(); await h.api.setMapDisplay(false);
  h.sandbox.map.addLayer({id: 'bh-price-gradient'});
  h.sandbox.map.addLayer({id: 'project-points'});
  h.calls.nativeEffect = () => h.sandbox.map.setLayoutProperty('bh-price-gradient', 'visibility', 'visible');
  h.sandbox.tlUpdate(); await h.api.refresh();
  assert.equal(h.layers.get('bh-price-gradient').visibility, 'none');
  assert.equal(h.layers.get('project-points').visibility, 'visible', 'Neutral map keeps project pins');
  h.api.setMetric('roi');
  h.sandbox.map.addLayer({id: 'ms-fill'});
  assert.equal(h.layers.get('ms-fill').visibility, 'none', 'Metric hydration cannot overrule presentation');
  assert.equal(h.api.displayContext().mapDisplay, false);
});

test('future heat resumes its exact target and cannot return after selecting history while hidden', async () => {
  const h = harness(); await h.api.refresh();
  h.api.choose(h.api.U.options.find(o => o.period === '2036Q2').id); await h.api.render();
  const selected = h.api.U.selected, native = h.sandbox.tlState.period;
  await h.api.setMapDisplay(false); await h.api.refresh();
  assert.equal(h.layers.get('um-fill').visibility, 'none');
  await h.api.setMapDisplay(true);
  assert.equal(h.api.U.selected, selected); assert.equal(h.sandbox.tlState.period, native);
  assert.equal(h.layers.get('um-fill').visibility, 'visible');
  assert.equal(h.calls.sources.at(-1).data.features[0].properties.period, '2036Q2');
  await h.api.setMapDisplay(false);
  h.api.choose(h.api.U.options.find(o => o.period === '2026-07').id);
  await h.api.setMapDisplay(true);
  assert.equal(h.layers.get('um-fill').visibility, 'none', 'A saved visibility snapshot cannot resurrect an old future');
  assert.equal(h.api.current().period, '2026-07');
});

test('hiding Heatmap cancels an in-flight future boundary render without losing its selection', async () => {
  const h = harness(); await h.api.refresh();
  let release; h.sandbox.sgLoad = () => new Promise(resolve => {release = resolve;});
  h.api.choose(h.api.U.options.find(o => o.kind === 'scenario').id);
  const selected = h.api.U.selected, pending = h.api.render();
  await h.api.setMapDisplay(false); release(); await pending;
  assert.equal(h.calls.sources.length, 0); assert.equal(h.api.U.selected, selected);
  assert.equal(h.api.displayContext().mapDisplay, false);
});

test('density presentation uses UAE coverage and preserves a chosen handover scope and year', async () => {
  const h = harness(); h.api.U.metric = 'projects';
  h.sandbox.state.analysisMetric = 'uae-project-coverage';
  h.sandbox.tgState.coverage = 'annual'; h.sandbox.tlState.period = '2029';
  h.layers.set('ae-uae-project-heat', {visibility: 'visible'});
  h.layers.set('ae-uae-project-points', {visibility: 'none'});
  await h.api.setMapDisplay(false);
  assert.equal(h.layers.get('ae-uae-project-heat').visibility, 'none');
  assert.equal(h.layers.get('ae-uae-project-points').visibility, 'visible');
  h.sandbox.state.analysisMetric = 'off'; // Recover an externally changed presentation owner.
  await h.api.setMapDisplay(true);
  assert.equal(h.sandbox.state.analysisMetric, 'uae-project-coverage');
  assert.equal(h.sandbox.tlState.period, '2029'); assert.equal(h.sandbox.tgState.coverage, 'annual');
  assert.equal(h.layers.get('ae-uae-project-heat').visibility, 'visible');
  assert.equal(h.layers.get('ae-uae-project-points').visibility, 'none');
  assert.equal(h.api.displayContext().emirate, 'UAE'); assert.equal(h.api.displayContext().area, '');
});

test('explicit Palm Jabal Ali alias joins readout and eligible scenario rows without crossing baskets', async () => {
  const h = harness([row('apartment', '2026Q2', {geography: 'Palm Jabal Ali', registration: 'Off-Plan'})]);
  h.sandbox.msState.area = 'Palm Jebel Ali'; h.sandbox.bhState.registration = 'Off-Plan';
  h.sandbox.tlState.series[0].geography = 'Palm Jabal Ali';
  h.sandbox.tlState.frame = [{name: 'Palm Jabal Ali', period: '2026-08', value: 3542.53}];
  await h.api.refresh();
  assert.match(h.api.readout()[0], /Palm Jebel Ali.*3,543 AED\/sqft/);
  assert.equal(h.api.U.options.filter(o => o.kind === 'scenario').length, 10);
  h.api.choose(h.api.U.options.find(o => o.kind === 'scenario').id); h.api.prepare();
  assert.equal(h.api.U.result.rows[0].geography, 'Palm Jabal Ali', 'Calculation keeps the original source identity');
  h.sandbox.bhState.registration = 'Ready'; await h.api.refresh();
  assert.equal(h.api.U.options.some(o => o.kind === 'scenario'), false, 'Off-Plan is not substituted into Ready');
  h.sandbox.msState.area = 'Palm Jumeirah';
  assert.doesNotMatch(h.api.readout()[0], /3,543/);
});

test('a non-Dubai price selection uses asking evidence even when a stale sales basis remains', async () => {
  const h = harness([row('apartment', '2026H1', {emirate: 'Abu Dhabi', geography: 'Al Reem Island', evidenceClass: 'advertised_price_benchmark'})]);
  Object.assign(h.sandbox.msState, {emirate: 'Abu Dhabi', area: 'Al Reem Island', basis: 'sales'});
  h.sandbox.tlState.series = [{geography: 'Al Reem Island', points: [{period: '2026H1', value: 1400}]}];
  h.sandbox.tlState.periods = ['2026H1']; h.sandbox.tlState.period = '2026H1';
  h.sandbox.tlState.frame = [{name: 'Al Reem Island', emirate: 'Abu Dhabi', period: '2026H1', value: 1400}];
  await h.api.refresh();
  assert.equal(h.sandbox.msState.basis, 'asking'); assert.equal(h.api.displayContext().basis, 'asking');
  assert.equal(h.api.current().evidenceClass, 'advertised_price_benchmark');
  assert.equal(h.api.U.options.filter(o => o.kind === 'scenario').length, 10);
  assert.match(h.api.readout()[1], /Published asking benchmark/);
});

test('context notifications reflect source, geography, period and presentation and suppress unchanged repeats', async () => {
  const h = harness(); await h.api.refresh(); h.api.sync();
  const count = h.calls.contexts.length; h.api.sync();
  assert.equal(h.calls.contexts.length, count);
  await h.api.setMapDisplay(false);
  const event = h.calls.contexts.at(-1);
  assert.equal(event.type, 'espacios:map-context');
  assert.deepEqual(plain(event.detail), plain(h.api.displayContext()));
  assert.equal(event.detail.metric, 'price'); assert.equal(event.detail.emirate, 'Dubai');
  assert.equal(event.detail.basis, 'sales'); assert.equal(event.detail.registration, 'Ready');
  assert.equal(event.detail.mapDisplay, false); assert.equal(event.detail.period, '2026-08');
});


test('switching from financial heat to density while hidden never revives the old financial layers', async () => {
  const h = harness(); await h.api.refresh();
  h.layers.set('ms-fill', {visibility: 'visible'});
  h.layers.set('bh-price-gradient', {visibility: 'visible'});
  h.layers.set('ae-uae-project-heat', {visibility: 'none'});
  await h.api.setMapDisplay(false);
  h.api.setMetric('projects');
  h.sandbox.map.setLayoutProperty('ms-fill', 'visibility', 'none');
  await h.api.setMapDisplay(true);
  assert.equal(h.layers.get('ae-uae-project-heat').visibility, 'visible');
  assert.equal(h.layers.get('ms-fill').visibility, 'none');
  assert.equal(h.layers.get('bh-price-gradient').visibility, 'none');
  assert.equal(h.api.displayContext().metric, 'projects');
});

test('resuming a changed financial basket renders only the current owner, not saved prior visibility', async () => {
  const h = harness(); await h.api.refresh();
  h.layers.set('bh-price-gradient', {visibility: 'visible'});
  h.layers.set('ms-fill', {visibility: 'none'});
  await h.api.setMapDisplay(false);
  h.api.setMetric('roi');
  h.calls.nativeEffect = () => h.sandbox.map.setLayoutProperty('ms-fill', 'visibility', 'visible');
  await h.api.setMapDisplay(true);
  assert.equal(h.layers.get('ms-fill').visibility, 'visible');
  assert.equal(h.layers.get('bh-price-gradient').visibility, 'none');
  assert.equal(h.api.displayContext().basis, 'asking');
});
