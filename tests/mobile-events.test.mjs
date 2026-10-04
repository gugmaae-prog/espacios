import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as MMCore from '../src/mobile-map/core.mjs';

const source = await fs.readFile(new URL('../src/mobile-map/app.js', import.meta.url), 'utf8');
const unifiedSource = await fs.readFile(new URL('../src/unified-map/app.js', import.meta.url), 'utf8');
// Extract the real unified semantic picker, not a behaviorally looser stub.
const unifiedPickStart = unifiedSource.indexOf('pick(event){');
assert.ok(unifiedPickStart >= 0, 'Unified controller exposes its semantic picker');
let unifiedPickEnd = unifiedPickStart + 'pick(event)'.length, braces = 0;
do {const char = unifiedSource[unifiedPickEnd++];if(char === '{')braces++;else if(char === '}')braces--;} while(braces > 0 && unifiedPickEnd < unifiedSource.length);
const unifiedPick = unifiedSource.slice(unifiedPickStart, unifiedPickEnd);
assert.ok(unifiedPick.endsWith('}'), 'Complete production unified callback is extracted');
// Exercise production callbacks inside their real closure, without installing
// the unrelated layout DOM. Fail rather than silently replacing missing hooks.
const pointerRegistration = source.split('\n').find(line => line.includes("const canvas=map.getCanvas();canvas.addEventListener('pointerdown'"));
const captureRegistration = source.split('\n').find(line => line.includes("map.getCanvasContainer().addEventListener('click'"));
assert.ok(pointerRegistration, 'Actual canvas pointer listeners exist');
assert.ok(captureRegistration, 'Actual native capture listener exists');
const instrumented = source.replace('  const timer=setInterval(',
  `${pointerRegistration}\n${captureRegistration}\n  globalThis.__MOBILE_EVENTS_TEST__={pick,M,choose,periodsNow,selectedNow,domain,applyPointer,finish,installPointer,renderMap};\n  const timer=setInterval(`);
assert.notEqual(instrumented, source, 'Test-only closure access injection point exists');

function target() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(type, callback, capture) {
      const list = listeners.get(type) || [];
      list.push({callback, capture});
      listeners.set(type, list);
    },
    emit(type, event) {
      for (const {callback} of listeners.get(type) || []) {
        callback(event);
        if (event.stopped) break;
      }
    }
  };
}

function harness(mode = 'projects') {
  const container = target(), canvas = target(), nodes = new Map(), microtasks = [], queries = [];
  const calls = {project: [], benchmark: [], scenario: [], unified: [], chosen: [], native: [], render: 0, nativeRender: 0, stop: 0, legacyClick: 0};
  const feature = {type: 'Feature', properties: {id: 'exact-project'}, geometry: {type: 'Point', coordinates: [10, 20]}};
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {...target(), hidden: false, dataset: {}, classList:{add(){},remove(){},contains(){return false;}},style:{setProperty(){}},getBoundingClientRect:()=>({left:100,top:50,width:300,height:44}),focus(){},hasPointerCapture:()=>false,setPointerCapture(){}});
    return nodes.get(selector);
  };
  canvas.getBoundingClientRect = () => ({left: 100, top: 50, width: 390, height: 844});
  const sandbox = {
    MMCore,
    document: {...target(), documentElement: {dataset: {}}, querySelector: node},
    matchMedia: () => ({matches: false}),
    setInterval: () => 1,
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {}, clearTimeout() {}, addEventListener() {},
    performance: {now:()=>200}, suState: {pointer:null},
    queueMicrotask: callback => microtasks.push(callback),
    window: {EspaciosEstimateUI: {
      context: () => ({map: mode === 'scenario'}),
      selectArea: name => {calls.scenario.push(name);return true;}
    }},
    map: {
      getCanvas: () => canvas,
      getCanvasContainer: () => container,
      getLayer: id => (mode === 'benchmark' && id === 'ms-fill') || (mode === 'scenario' && id === 'se-fill') || (mode === 'unified' && id === 'um-fill'),
      project: ([x, y]) => ({x, y}),
      unproject: ({x, y}) => ({lng: x, lat: y}),
      queryRenderedFeatures(point, options) {
        // Native capture supplies plain {x,y}, NOT MapLibre's Point instance.
        // MapLibre 6.8 treats a plain object as the options overload and queries
        // the whole viewport. Enforce the actual screen-coordinate array API.
        assert.ok(Array.isArray(point), 'Rendered-feature query must use [x, y], not a plain event.point object');
        assert.equal(point.length, 2); assert.ok(point.every(Number.isFinite));
        queries.push({point: Array.from(point), layers: Array.from(options.layers)});
        return point[0] === 10 && point[1] === 20 ? [{properties: {name: 'Exact area'}}] : [];
      },
      stop: () => {calls.stop++;}
    },
    state: {analysisMetric: mode, recordById: new Map([['exact-project', {id: 'exact-project', name: 'Exact project'}]])},
    tlState: {mode: 'delivery', period: '2036', periods: ['2019', '2036'], loading: false, frame: [{name: 'Exact area', geometryIds: ['exact-boundary']}]},
    msState: {emirate: 'Dubai', segment: 'apartment', area: '', open: false},
    bhState: {registration: 'Ready', loadingRaster: false},
    tgState: {coverage: 'cumulative'},
    sgState: {data: {features: [{id: 'exact-boundary', geometry: {type: 'Polygon'}}]}},
    SG: {contains: ([x, y]) => x === 10 && y === 20},
    aeUaeCoverageActive: () => mode === 'projects',
    aeUaeTimelineData: () => ({features: [feature]}),
    msActive: () => mode === 'benchmark',
    ppActive: () => mode === 'registered',
    msSync: () => calls.benchmark.push(sandbox.msState.area),
    showDetail: record => calls.project.push(record.id),
    psrSetSelectedPoint() {},
    recordTitle: record => record.name
  };
  sandbox.cxCatalogue=()=>false;sandbox.tlChooseDate=period=>calls.native.push(period);
  sandbox.tlUpdate=()=>calls.nativeRender++;sandbox.tlStop=()=>{};
  if(mode==='unified'){
    sandbox.future=()=>true;sandbox.prepare=()=>{};sandbox.details=()=>calls.unified.push(sandbox.msState.area);sandbox.refreshSoon=()=>{};
    const timeline={periods:['["2019-01","registered_sale"]','["2027Q2","conditional_scenario"]','["2036Q2","conditional_scenario"]'],selected:'["2019-01","registered_sale"]',key:'same-reviewed-domain',metric:'price',loading:false};
    sandbox.window.EspaciosUnifiedMap={timeline:()=>timeline,choose(period){calls.chosen.push(period);timeline.selected=period;},render:()=>calls.render++};
  }
  vm.createContext(sandbox);
  if(mode==='unified')sandbox.window.EspaciosUnifiedMap.pick=vm.runInContext('(function '+unifiedPick+')',sandbox);
  new vm.Script(instrumented).runInContext(sandbox);
  const flush = () => {while (microtasks.length) microtasks.shift()();};
  const click = (extra = {}) => {
    const event = {target: canvas, detail: 1, pointerType: 'touch', clientX: 110, clientY: 70,
      preventDefault() {this.prevented = true;},
      stopImmediatePropagation() {this.stopped = true;}, ...extra};
    container.emit('click', event);
    if (!event.stopped) calls.legacyClick++;
    return event;
  };
  return {api: sandbox.__MOBILE_EVENTS_TEST__, sandbox, canvas, container, calls, click, flush, microtasks, node, queries};
}

for (const [mode, layer] of [['benchmark', 'ms-fill'], ['scenario', 'se-fill'], ['unified', 'um-fill']]) {
  test(`${mode}: native screen point is converted to a bounded MapLibre array query`, () => {
    const h = harness(mode);
    h.click(); h.flush();
    assert.deepEqual(h.queries, [{point: [10, 20], layers: [layer]}]);
    const selected = [...h.calls.benchmark, ...h.calls.scenario, ...h.calls.unified];
    assert.deepEqual(selected, ['Exact area']);
    h.click({clientX: 350, clientY: 400}); h.flush();
    assert.deepEqual(h.queries.at(-1), {point: [250, 350], layers: [layer]});
    assert.deepEqual([...h.calls.benchmark, ...h.calls.scenario, ...h.calls.unified], ['Exact area'], 'An empty location must not select the first feature elsewhere in the viewport');
  });
}

for (const mode of ['projects', 'benchmark', 'registered', 'scenario']) {
  test(`${mode}: first semantic click selects once and blocks legacy territory selection`, () => {
    const h = harness(mode), event = h.click();
    assert.equal(h.container.listeners.get('click')[0].capture, true);
    assert.equal(event.prevented, true);
    assert.equal(event.stopped, true);
    assert.equal(h.calls.legacyClick, 0);
    assert.equal(h.microtasks.length, 1, 'Selection is queued only once');
    h.flush();
    const selections = [...h.calls.project, ...h.calls.benchmark, ...h.calls.scenario];
    assert.deepEqual(selections, [mode === 'projects' ? 'exact-project' : 'Exact area']);
  });

  test(`${mode}: second click keeps semantic ownership without selecting twice`, () => {
    const h = harness(mode);
    h.click();h.flush();
    const first = JSON.stringify(h.calls), second = h.click({detail: 2});
    assert.equal(second.stopped, true);
    assert.equal(second.prevented, true);
    assert.equal(h.microtasks.length, 0, 'Second click must not schedule selection');
    h.flush();
    assert.equal(JSON.stringify(h.calls), first);
    assert.equal(h.container.listeners.has('dblclick'), false, 'Separate zoom event is not intercepted');
  });

  test(`${mode}: unmatched native clicks continue to MapLibre`, () => {
    const h = harness(mode), event = h.click({clientX: 350, clientY: 400});
    assert.equal(event.stopped, undefined);
    assert.equal(event.prevented, undefined);
    assert.equal(h.calls.legacyClick, 1);
    assert.equal(h.microtasks.length, 0);
  });
}

test('canvas capture does not consume clicks on other map controls', () => {
  const h = harness(), event = h.click({target: {id: 'zoom-control'}});
  assert.equal(event.stopped, undefined);
  assert.equal(event.prevented, undefined);
  assert.equal(h.calls.legacyClick, 1);
  assert.equal(h.microtasks.length, 0);
});

test('actual pointer movement marks a drag and prevents semantic selection', () => {
  const h = harness();
  h.canvas.emit('pointerdown', {clientX: 100, clientY: 70, pointerId: 1});
  h.canvas.emit('pointermove', {clientX: 110, clientY: 70, pointerId: 1, buttons: 1});
  assert.equal(h.api.M.mapDragged, true);
  const dragged = h.click();
  assert.equal(dragged.stopped, undefined, 'MapLibre keeps ownership of the drag completion');
  assert.equal(h.microtasks.length, 0);
  assert.deepEqual(h.calls.project, []);
  h.canvas.emit('pointerdown', {clientX: 110, clientY: 70, pointerId: 2});
  assert.equal(h.api.M.mapDragged, false, 'The next independent tap resets the drag guard');
  assert.equal(h.click().stopped, true);
  h.flush();
  assert.deepEqual(h.calls.project, ['exact-project']);
});

test('pointer hover without a pressed button does not become a drag', () => {
  const h = harness();
  h.canvas.emit('pointerdown', {clientX: 100, clientY: 70});
  h.canvas.emit('pointermove', {clientX: 300, clientY: 70, buttons: 0});
  assert.equal(h.api.M.mapDragged, false);
});

test('unified conditional map owns the first matching tap once, before all native history handlers',()=>{
  const h=harness('unified'),event=h.click();assert.equal(event.stopped,true);assert.equal(event.prevented,true);
  assert.equal(h.microtasks.length,1);h.flush();assert.deepEqual(h.calls.unified,['Exact area']);
  assert.deepEqual(h.calls.project,[]);assert.deepEqual(h.calls.benchmark,[]);assert.deepEqual(h.calls.scenario,[]);assert.equal(h.calls.legacyClick,0);
});

test('unified future double-click retains semantic ownership without duplicate selection or intercepting dblclick zoom',()=>{
  const h=harness('unified');h.click();h.flush();const event=h.click({detail:2});h.flush();
  assert.equal(event.stopped,true);assert.equal(h.microtasks.length,0);assert.deepEqual(h.calls.unified,['Exact area']);
  assert.equal(h.container.listeners.has('dblclick'),false);
});

test('unmapped future location cannot silently open an underlying current-history value',()=>{
  const h=harness('unified'),event=h.click({clientX:350,clientY:400});h.flush();
  assert.equal(event.stopped,true,'Future map owns its whole semantic view, including unknown locations');
  assert.deepEqual(h.calls.unified,[]);assert.deepEqual(h.calls.benchmark,[]);assert.equal(h.calls.legacyClick,0);
});

test('unified adapter keeps native and conditional option identities instead of passing scenario ids to legacy history',()=>{
  const h=harness('unified'),periods=h.api.periodsNow();
  h.api.choose(periods[2]);assert.deepEqual(h.calls.chosen,[periods[2]]);assert.deepEqual(h.calls.native,[]);
  assert.equal(h.api.selectedNow(),periods[2]);h.api.choose('invented-period');assert.equal(h.calls.chosen.length,1);
  h.api.renderMap();assert.equal(h.calls.render,1);assert.equal(h.calls.nativeRender,0);
});

test('real timeline pointer callbacks drag the unified range to its final conditional year and release cleanly',()=>{
  const h=harness('unified');h.api.installPointer();const track=h.node('#dr-track'),slider=h.node('#tl-slider');
  const event=(clientX)=>({target:slider,button:0,pointerId:7,clientX,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}});
  track.emit('pointerdown',event(112));assert.equal(h.api.M.pointer,7);
  track.emit('pointermove',event(388));h.api.applyPointer();
  assert.equal(h.api.selectedNow(),h.api.periodsNow().at(-1));assert.deepEqual(h.calls.native,[]);
  track.emit('pointerup',event(388));assert.equal(h.api.M.pointer,null);assert.equal(h.sandbox.suState.pointer,null);
  assert.ok(h.calls.render>=1);assert.equal(h.calls.nativeRender,0);
});

test('a unified context change cancels an active drag before applying a stale option',()=>{
  const h=harness('unified');h.api.installPointer();const slider=h.node('#tl-slider');
  h.node('#dr-track').emit('pointerdown',{target:slider,button:0,pointerId:8,clientX:112,preventDefault(){},stopImmediatePropagation(){}});
  h.sandbox.window.EspaciosUnifiedMap.timeline().key='new-property-basket';h.api.M.fraction=1;h.api.applyPointer();
  assert.equal(h.api.M.pointer,null);assert.equal(h.calls.chosen.length,0);assert.deepEqual(h.calls.native,[]);
});

test('keyboard and native range-input alternatives reach both unified endpoints',()=>{
  const h=harness('unified');h.api.installPointer();const track=h.node('#dr-track'),slider=h.node('#tl-slider');
  const event=key=>({target:slider,key,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}});
  const end=event('End');track.emit('keydown',end);assert.equal(h.api.selectedNow(),h.api.periodsNow().at(-1));assert.equal(end.stopped,true);
  track.emit('keydown',event('Home'));assert.equal(h.api.selectedNow(),h.api.periodsNow()[0]);
  slider.value='1';track.emit('input',{target:slider,stopImmediatePropagation(){}});assert.equal(h.api.selectedNow(),h.api.periodsNow()[1]);assert.deepEqual(h.calls.native,[]);
});

function sheetHarness() {
  const observers = new Map(), pending = new Set(), panels = [];
  const changed = node => {for (const callback of observers.get(node) || []) pending.add(callback);};
  function node(id, hidden = true) {
    const classes = new Set(), attributes = new Map();let concealed = hidden, bar = null;
    const element = {id, dataset:{},
      classList:{contains:value=>classes.has(value),add(...values){values.forEach(value=>classes.add(value));changed(element);},remove(...values){values.forEach(value=>classes.delete(value));changed(element);}},
      querySelector:selector=>selector === ':scope > .mm-sheet-bar' ? bar : bar?.querySelector(selector) || null,
      prepend(value){bar=value;},hasAttribute:()=>false,getAttribute:name=>attributes.get(name),setAttribute:(name,value)=>attributes.set(name,value),
      contains:child=>child===element,focus(){}};
    Object.defineProperty(element,'hidden',{get:()=>concealed,set(value){concealed=value;changed(element);}});
    panels.push(element);return element;
  }
  const history=node('hi-panel',false), inspector=node('ms-inspect'), filters=node('filters');
  const env = {window:{},document:{documentElement:{},activeElement:null,querySelector:selector=>panels.find(panel=>'#'+panel.id===selector)||null,
    querySelectorAll:selector=>selector.startsWith('.rail-btn')?[]:panels,
    createElement(){const children=new Map();return{querySelector(selector){if(!children.has(selector))children.set(selector,{getAttribute:()=>null,setAttribute(){}});return children.get(selector);}};},},
    matchMedia:()=>({matches:true}),setInterval:()=>1,requestAnimationFrame:()=>1,
    MutationObserver:class {constructor(callback){this.callback=callback;}observe(element){const list=observers.get(element)||[];list.push(this.callback);observers.set(element,list);}},
    msState:{open:false},msInfo(){inspector.hidden=!env.msState.open;}};
  const exposed=source.replace('  const timer=setInterval(','  globalThis.__SHEETS_TEST__={M,activate,closePanel,installSheets};\n  const timer=setInterval(');
  vm.runInNewContext(exposed,env);
  function flush(){for(let i=0;pending.size&&i<10;i++){const callbacks=[...pending];pending.clear();callbacks.forEach(callback=>callback());}assert.equal(pending.size,0,'Sheet visibility reconciliation settles');}
  const api=env.__SHEETS_TEST__;api.installSheets();flush();
  return{api,env,history,inspector,filters,flush};
}

test('a background market inspector refresh cannot close the active history drawer',()=>{
  const h=sheetHarness();h.env.msState.open=true;h.env.msInfo();h.flush();
  assert.equal(h.history.classList.contains('hidden'),false);
  assert.equal(h.api.M.active,h.history);
  assert.equal(h.inspector.hidden,true);
  assert.equal(h.env.msState.open,false);
});

test('an explicit new panel request and explicit close retain mobile sheet ownership',()=>{
  const h=sheetHarness();h.env.msState.open=true;h.env.msInfo();h.api.activate(h.inspector);h.flush();
  assert.equal(h.history.classList.contains('hidden'),true);assert.equal(h.inspector.hidden,false);assert.equal(h.api.M.active,h.inspector);
  h.history.classList.remove('hidden');h.api.activate(h.history);h.flush();
  h.api.closePanel(h.history);h.env.msState.open=true;h.env.msInfo();h.flush();
  assert.equal(h.history.classList.contains('hidden'),true);assert.equal(h.api.M.active,h.inspector);
});

test('other user panels still replace history and responsive sheet installation preserves the current owner',()=>{
  const h=sheetHarness();h.inspector.hidden=false;h.api.installSheets();h.flush();
  assert.equal(h.api.M.active,h.history);assert.equal(h.history.classList.contains('hidden'),false);
  h.filters.hidden=false;h.flush();assert.equal(h.api.M.active,h.filters);assert.equal(h.history.classList.contains('hidden'),true);
});
