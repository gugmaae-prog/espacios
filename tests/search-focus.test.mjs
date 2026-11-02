import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/mobile-map/search-focus.js', import.meta.url), 'utf8');
const coreSource = source.slice(0, source.indexOf('\n(() => {'));
const context = vm.createContext({});vm.runInContext(coreSource, context);
const K = vm.runInContext('EspaciosSearchFocusCore', context);
const plain = value => JSON.parse(JSON.stringify(value));
const cameraMoves=h=>h.moves.filter(move=>!['stop','setPadding'].includes(move.type));
const community = (name = 'Palm Jumeirah', emirate = 'Dubai') => ({kind: 'community', name, emirate});
const polygon = (name, emirate, box = [[55, 25], [55.2, 25.2]], extra = {}) => ({properties: {name, emirate, ...extra}, geometry: {type: 'Polygon', coordinates: [[box[0], [box[1][0], box[0][1]], box[1], [box[0][0], box[1][1]], box[0]]]}});

test('search position order matches grouped visible options, not the mixed score ranking', () => {
  const entries = [{id:'project1',kind:'Project'}, {id:'community',kind:'Community'}, {id:'project2',kind:'Project'}, {id:'developer',kind:'Developer'}];
  assert.deepEqual(plain(K.groupedEntries(entries, e => e.kind).map(e => e.id)), ['project1','project2','community','developer']);
  assert.equal(entries[1].id, 'community');
});
test('exact boundary joins include emirate and do not fuzzy-match similarly named areas', () => {
  const features = [polygon('Palm Jumeirah','Dubai'),polygon('Palm Jumeirah','Abu Dhabi'),polygon('Palm Jebel Ali','Dubai')];
  assert.equal(K.exactFeatures(community(),features).length, 1);
  assert.equal(K.exactFeatures(community('Jumeirah'),features).length, 0);
  assert.equal(K.exactFeatures({name:'Palm Jumeirah'},features).length, 0);
});
test('community search uses full source boundary, even when zoomed deep into a single building', () => {
  const result = K.target({type:'record',record:{...community(),coordinates:{lat:25.1,lng:55.1}}},{surfaces:[polygon('Palm Jumeirah','Dubai')]});
  assert.deepEqual(plain(result.bounds), [[55,25],[55.2,25.2]]);
  assert.equal(result.maxZoom,13);
  assert.equal(result.basis,'exact-source-boundary');
});
test('master development geometry takes priority over broader same-name surface geometry', () => {
  const result = K.target({type:'record',record:community()},{territories:[polygon('Palm Jumeirah','Dubai',[[55.1,25.1],[55.11,25.11]])],surfaces:[polygon('Palm Jumeirah','Dubai')]});
  assert.deepEqual(plain(result.bounds),[[55.1,25.1],[55.11,25.11]]);
});
test('record coordinate locations do not borrow an area or emirate centroid', () => {
  const record = {kind:'project',name:'Unlocated project',area:'Palm Jumeirah',emirate:'Dubai'};
  assert.equal(K.target({type:'record',record},{surfaces:[polygon('Palm Jumeirah','Dubai')]}),null);
  assert.equal(K.coordinate({coordinates:{lat:null,lng:55}}),null);
  assert.equal(K.coordinate({coordinates:{lat:'',lng:55}}),null);
  assert.equal(K.coordinate({coordinates:{lat:91,lng:55}}),null);
  assert.equal(K.coordinate({coordinates:{lat:25,lng:Infinity}}),null);
  assert.deepEqual(plain(K.coordinate({coordinates:{lat:'25.1',lng:'55.2'}})),[55.2,25.1]);
});
test('developer selection includes all located catalogue projects without inventing missing points', () => {
  const result=K.target({type:'developer',projects:[{coordinates:{lat:25.1,lng:55.2}},{coordinates:{lat:24.4,lng:54.5}},{name:'No location'}]});
  assert.deepEqual(plain(result.bounds),[[54.5,24.4],[55.2,25.1]]);
});
test('market synchronization needs one exact source area in the selected emirate', () => {
  const rows=[{name:'Palm Jumeirah',emirate:'Dubai'},{name:'Palm Jebel Ali',emirate:'Dubai'},{name:'Palm Jumeirah',emirate:'Abu Dhabi'}];
  assert.deepEqual(plain(K.marketArea(community(),rows)),rows[0]);
  assert.equal(K.marketArea(community('Palm'),rows),null);
  assert.equal(K.marketArea({kind:'project',emirate:'Dubai',area:'Palm Jumeirah',masterCommunity:'Palm Jebel Ali'},rows),null);
  assert.equal(K.marketArea(community('Palm Jumeirah','Sharjah'),rows),null);
});
test('measured desktop padding follows the visible detail and collapsed timeline rectangles', () => {
  const rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
  const result=K.padding({width:1440,height:900},[{side:'top',rect:rect(16,16,1408,66)},{side:'left',rect:rect(16,100,86,780)},{side:'left',rect:rect(118,100,400,600)},{side:'bottom',rect:rect(118,780,1200,100)}]);
  assert.deepEqual(plain(result),{top:94,left:530,right:12,bottom:132});
});
test('mobile keyboard and expanded details always retain a nonempty camera viewport', () => {
  const result=K.padding({width:390,height:360},[{side:'top',rect:{left:10,right:380,top:10,bottom:120,width:370,height:110}},{side:'bottom',rect:{left:10,right:380,top:130,bottom:350,width:370,height:220}}]);
  assert.ok(360-result.top-result.bottom>=95);
  assert.ok(390-result.left-result.right>=96);
  assert.ok(Object.values(result).every(Number.isFinite));
});

function runtime({reduced = false, entries = [], market = false, unloaded = false, fetchImpl} = {}) {
  const frames = new Map(), timers = new Map(), moves = [], events = [], elements = new Map(), canvasListeners=new Map();let frame = 0,timer=0;
  const basic = () => ({classList:{add(){},remove(){},contains(){return false;}},setAttribute(){},replaceChildren(){},blur(){},addEventListener(){},querySelectorAll(){return [];}});
  elements.set('#search',basic());elements.set('#search-results',basic());
  const inputListeners={};elements.get('#search').addEventListener=(name,fn)=>{inputListeners[name]=fn;};
  elements.set('#detail',basic());elements.set('#detail-body',basic());
  const map = {stop(){moves.push({type:'stop'});},getSource(){return{setData(){}};},getCanvas(){return{addEventListener(name,handler){canvasListeners.set(name,handler);}};},getContainer(){return {getBoundingClientRect(){return {left:0,top:0,width:390,height:844};}};}};
  for(const type of ['easeTo','flyTo','jumpTo','fitBounds','setPadding'])map[type]=(...args)=>{moves.push({type,args});return map;};
  const state={searchResults:entries,is3d:false,analysisMetric:market?'history:market-yield':'uae-project-coverage',spatial:{}};
  const env={console,map,state,window:{},fetch:fetchImpl,AbortController,queueMicrotask:()=>{},sgState:{data:unloaded?null:{features:[polygon('Palm Jumeirah','Dubai')]}},tlState:{series:[]},msState:{kind:'roi',emirate:'Dubai',segment:'villa',area:'Old area',data:{rows:[{community:'Palm Jumeirah',emirate:'Dubai'}]}},
    document:{querySelector:selector=>elements.get(selector)||null,querySelectorAll:()=>[],dispatchEvent:event=>events.push(event)},
    CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}},
    matchMedia:query=>({matches:query.includes('reduced-motion')?reduced:true}),
    requestAnimationFrame:fn=>{frames.set(++frame,fn);return frame;},cancelAnimationFrame:id=>frames.delete(id),getComputedStyle:()=>({display:'block',visibility:'visible'}),
    setTimeout:fn=>{timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id),
    recordTitle:r=>r.name,renderSearch(){state.searchResults=entries;},aeActivateSearchPosition(){throw Error('Legacy selection invoked');},aeSearchKindLabel:e=>e.record?.kind||e.type,
    aeSearchText:value=>String(value||'').toLowerCase().trim(),aeSearchResultsFor:()=>[],aeSearchSubLabel:()=>'',aeSearchEntryForRecord:record=>({type:'record',record,title:record.name||'',id:String(record.id)}),aeSearchScore:()=>0,
    showDetail(record){state.selected=record;map.easeTo({center:[0,0],duration:850});},psrSetSelectedPoint(){},aeShowDeveloperSearch(){map.fitBounds([[0,0],[1,1]]);},
    fc:features=>({type:'FeatureCollection',features}),esc:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;'),psrApplyDockPadding(){},
    msVisible:()=>market,ppActive:()=>false,msSync(){},msOpen(){},toast(){}};
  elements.get('#search-results').addEventListener=()=>{};
  const ctx=vm.createContext(env);vm.runInContext(source,ctx);
  const flush=()=>{for(let passes=0;frames.size&&passes<5;passes++){const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());}};
  return {ctx,moves,events,flush,state,env,elements,timers,canvasListeners,inputListeners};
}
test('selection suppresses legacy fixed camera and reduced-motion performs one immediate measured focus', () => {
  const h=runtime({reduced:true,entries:[{type:'record',id:'palm',record:community()}]});
  vm.runInContext('aeActivateSearchPosition(0)',h.ctx);h.flush();
  const cameras=cameraMoves(h);assert.equal(cameras.length,1);
  assert.equal(cameras[0].type,'fitBounds');assert.equal(cameras[0].args[1].duration,0);assert.equal(cameras[0].args[1].essential,false);
  assert.deepEqual(plain(cameras[0].args[0]),[[55,25],[55.2,25.2]]);
  assert.equal(h.events[0].type,'espacios:search-selection');assert.equal(h.events[0].detail.id,'palm');
});
test('a newer search cancels a pending older camera before either frame is rendered', () => {
  const entries=[{type:'record',id:'palm',record:community()},{type:'record',id:'yas',record:{...community('Yas Island','Abu Dhabi'),coordinates:{lng:54.603,lat:24.494}}}];
  const h=runtime({entries});vm.runInContext('aeActivateSearchPosition(0);aeActivateSearchPosition(1)',h.ctx);h.flush();
  const cameras=cameraMoves(h);assert.equal(cameras.length,1);
  assert.deepEqual(plain(cameras[0].args[0].center),[54.603,24.494]);
  assert.equal(h.state.selected.name,'Yas Island');
});

test('opening a newer drawer cancels deferred search activation before the next frame',()=>{
  const h=runtime({entries:[{type:'record',id:'palm',record:community()}]});
  vm.runInContext('aeActivateSearchPosition(0);window.EspaciosSearchFocus.cancel("history-drawer-opened")',h.ctx);h.flush();
  assert.equal(cameraMoves(h).length,0);assert.equal(h.env.window.__ESPACIOS_SEARCH_FOCUS__.status,'cancelled');
  assert.ok(h.env.window.__ESPACIOS_SEARCH_FOCUS__.events.includes('history-drawer-opened'));
});
test('search retains ROI and villa basket while synchronizing the exact selected market area', () => {
  const h=runtime({market:true,entries:[{type:'record',id:'palm',record:community()}]});
  vm.runInContext('aeActivateSearchPosition(0)',h.ctx);h.flush();
  assert.equal(h.state.analysisMetric,'history:market-yield');assert.equal(h.env.msState.kind,'roi');assert.equal(h.env.msState.segment,'villa');
  assert.equal(h.env.msState.area,'Palm Jumeirah');assert.equal(h.events[0].detail.exactMarketMatch,true);
});
test('unlocated search result still opens its own dossier but cannot borrow another camera location', () => {
  const h=runtime({entries:[{type:'record',id:'unlocated',record:{kind:'project',name:'Unlocated',emirate:'Dubai',area:'Palm Jumeirah'}}]});
  vm.runInContext('aeActivateSearchPosition(0)',h.ctx);h.flush();
  assert.equal(h.state.selected.name,'Unlocated');assert.equal(cameraMoves(h).length,0);
});
test('Arabic project names remain searchable and an Ajman source selection never invents a map location', () => {
  const project={sourceProjectId:412,nameEn:'سيسايد هيلز فيلا',nameAr:'Seaside Hills Villa',districtEn:'Zorah',statusSource:'Completed',snapshotDate:'2026-06-30',reportedUnitCount:1};
  const h=runtime({entries:[{type:'record',id:'ajman-register:412',sourceRegistry:'ajman',record:{kind:'project',name:project.nameEn},sourceProject:project}]});
  assert.equal(vm.runInContext('aeSearchText("سيسايد هيلز")',h.ctx),'سيسايد هيلز');
  vm.runInContext('aeActivateSearchPosition(0)',h.ctx);h.flush();
  assert.equal(cameraMoves(h).length,0);
  assert.equal(h.env.window.__ESPACIOS_SEARCH_FOCUS__.status,'source-without-coordinates');
  assert.match(h.elements.get('#detail-body').innerHTML,/No verified project coordinates/);
  assert.match(h.elements.get('#detail-body').innerHTML,/2026-06-30/);
  assert.equal(h.events[0].detail.kind,'official-source-project');
});

test('Dubai source search excludes reviewed map links and returns ranked search hits',async()=>{
  const fetchImpl=async url=>{
    if(url.includes('/ajman/register'))return new Response(JSON.stringify({scope:{evidenceClass:'official_project_register_snapshot'},source:{latestSnapshotDate:'2026-06-30'},projects:[],totalProjects:0}));
    if(url.includes('/dubai/project-status'))return new Response(JSON.stringify({scope:{evidenceClass:'licensed_secondary_copy_of_authority_project_register'},source:{sourcePublicationDate:'2026-11-01'},totalProjects:2,projects:[
      {sourceProjectNumber:'4591',name:'Melograno Yards By Beyond',community:'Wadi Al Safa 4',developerName:'Beyond',matchStatus:'unmatched_source_identity',canonicalProjectId:null,coordinates:null},
      {sourceProjectNumber:'3519',name:'Olaia Residences',community:'Palm Jumeirah',developerName:'Gulf House',matchStatus:'reviewed_one_to_one',canonicalProjectId:'project:olaia',coordinates:null}
    ]}));
    throw Error('Unexpected source request '+url);
  };
  const h=runtime({fetchImpl});h.inputListeners.input({target:{value:'melograno'}});
  const pending=[...h.timers.values()];h.timers.clear();await Promise.all(pending.map(fn=>fn()));
  const hits=vm.runInContext('aeSearchResultsFor("melograno")',h.ctx);
  assert.equal(hits.length,1);assert.equal(hits[0].e.sourceProject.sourceProjectNumber,'4591');
  assert.equal(hits[0].e.sourceRegistry,'dubai');
  assert.equal(vm.runInContext('aeSearchKindLabel(aeSearchResultsFor("melograno")[0].e)',h.ctx),'Dubai register · licensed copy');
});

test('a transient source 503 retries once and retains the unlinked Dubai result',async()=>{
  let dubaiReads=0;
  const fetchImpl=async url=>{
    if(url.includes('/ajman/register'))return new Response(JSON.stringify({scope:{evidenceClass:'official_project_register_snapshot'},source:{latestSnapshotDate:'2026-06-30'},projects:[],totalProjects:0}));
    if(url.includes('/dubai/project-status')){
      dubaiReads++;
      if(dubaiReads===1)return new Response('temporarily unavailable',{status:503});
      return new Response(JSON.stringify({scope:{evidenceClass:'licensed_secondary_copy_of_authority_project_register'},source:{sourcePublicationDate:'2026-11-01'},totalProjects:1,projects:[{sourceProjectNumber:'4591',name:'Melograno Yards By Beyond',community:'Wadi Al Safa 4',developerName:'Beyond',matchStatus:'unmatched_source_identity',canonicalProjectId:null,coordinates:null}]}));
    }
    throw Error('Unexpected source request '+url);
  };
  const h=runtime({fetchImpl});h.inputListeners.input({target:{value:'melograno'}});
  const initial=[...h.timers.values()];h.timers.clear();const running=initial.map(fn=>fn());
  await new Promise(setImmediate);
  const retry=[...h.timers.values()];h.timers.clear();retry.forEach(fn=>fn());
  await Promise.all(running);
  assert.equal(dubaiReads,2);
  assert.equal(vm.runInContext('aeSearchResultsFor("melograno")[0].e.sourceProject.sourceProjectNumber',h.ctx),'4591');
});

test('Dubai source selection shows dated evidence without moving the map or claiming delivery',()=>{
  const project={sourceProjectNumber:'4591',name:'Melograno Yards By Beyond',community:'Wadi Al Safa 4',developerName:'Beyond',inspectionDate:null,completionPercent:7.5,declaredHandoverDate:'2029-06-30'};
  const h=runtime({entries:[{type:'record',id:'dubai-register:4591',sourceRegistry:'dubai',record:{kind:'project',name:project.name},sourceProject:project}]});
  vm.runInContext('aeActivateSearchPosition(0)',h.ctx);h.flush();
  assert.equal(cameraMoves(h).length,0);
  assert.equal(h.env.window.__ESPACIOS_SEARCH_FOCUS__.status,'source-without-coordinates');
  assert.match(h.elements.get('#detail-body').innerHTML,/LICENSED COPY/);
  assert.match(h.elements.get('#detail-body').innerHTML,/not proof of delivery/);
  assert.match(h.elements.get('#detail-body').innerHTML,/2029-06-30/);
  assert.equal(h.events[0].detail.kind,'licensed-source-project');
});

test('fresh density community selection loads exact source geometry before measured navigation', async()=>{
  const h=runtime({unloaded:true,entries:[{type:'record',id:'palm',record:community()}]});let finishLoad,loads=0;
  h.env.sgLoad=()=>{loads++;return new Promise(resolve=>{finishLoad=()=>{h.env.sgState.data={features:[polygon('Palm Jumeirah','Dubai')]};resolve(h.env.sgState.data);};});};
  vm.runInContext('aeActivateSearchPosition(0)',h.ctx);h.flush();
  assert.equal(loads,1);assert.equal(h.env.window.__ESPACIOS_SEARCH_FOCUS__.status,'resolving');assert.equal(cameraMoves(h).length,0);
  finishLoad();await new Promise(setImmediate);h.flush();
  const cameras=cameraMoves(h);assert.equal(cameras.length,1);assert.equal(cameras[0].type,'fitBounds');
  assert.deepEqual(plain(cameras[0].args[0]),[[55,25],[55.2,25.2]]);assert.equal(h.env.window.__ESPACIOS_SEARCH_FOCUS__.targetBasis,'exact-source-boundary');
});
test('settings focusArea loads geometry even though it has no catalogue coordinates', async()=>{
  const h=runtime({unloaded:true});h.env.sgLoad=async()=>{h.env.sgState.data={features:[polygon('Palm Jumeirah','Dubai')]};return h.env.sgState.data;};
  assert.equal(await h.env.window.EspaciosSearchFocus.focusArea({name:'Palm Jumeirah',emirate:'Dubai'}),true);h.flush();
  assert.equal(h.moves.filter(move=>move.type==='fitBounds').length,1);
});
test('late geometry cannot drag the camera back after a newer project selection',async()=>{
  const h=runtime({unloaded:true,entries:[{type:'record',id:'palm',record:community()},{type:'record',id:'project',record:{kind:'project',name:'Selected project',coordinates:{lat:24.5,lng:54.6}}}]});let finishLoad;
  h.env.sgLoad=()=>new Promise(resolve=>{finishLoad=()=>{h.env.sgState.data={features:[polygon('Palm Jumeirah','Dubai')]};resolve();};});
  vm.runInContext('aeActivateSearchPosition(0);aeActivateSearchPosition(1)',h.ctx);h.flush();finishLoad();await new Promise(setImmediate);h.flush();
  const cameras=cameraMoves(h);assert.equal(cameras.length,1);assert.deepEqual(plain(cameras[0].args[0].center),[54.6,24.5]);
  assert.equal(h.env.window.__ESPACIOS_SEARCH_FOCUS__.recordName,'Selected project');
});
test('failed geometry load never guesses a location and retains an existing coordinate when present',async()=>{
  const h=runtime({unloaded:true});h.env.sgLoad=async()=>{throw Error('temporary offline');};
  assert.equal(await h.env.window.EspaciosSearchFocus.focusArea({name:'Unlocated',emirate:'Dubai'}),false);h.flush();
  assert.equal(cameraMoves(h).length,0);
  assert.equal(await h.env.window.EspaciosSearchFocus.focusRecord({...community(),coordinates:{lat:25.124,lng:55.135}}),true);h.flush();
  assert.deepEqual(plain(h.moves.find(move=>move.type==='easeTo').args[0].center),[55.135,25.124]);
});
test('late legacy padding and 3D pitch cannot replace an active search flight',()=>{
  const h=runtime({entries:[{type:'record',id:'palm',record:community()}]});vm.runInContext('aeActivateSearchPosition(0)',h.ctx);h.flush();
  h.env.map.setPadding({left:400});h.env.map.easeTo({pitch:58,duration:420});h.env.map.jumpTo({bearing:-16});
  assert.equal(cameraMoves(h).length,1);
  for(const fn of [...h.timers.values()])fn();h.env.map.setPadding({left:30});
  assert.equal(h.moves.filter(move=>move.type==='setPadding').length,2,'One measured initial inset, then the temporary ownership expires');
});
test('user pan/zoom releases search ownership immediately, including during lazy geometry loading',async()=>{
  const h=runtime({unloaded:true});let finishLoad;h.env.sgLoad=()=>new Promise(resolve=>{finishLoad=()=>{h.env.sgState.data={features:[polygon('Palm Jumeirah','Dubai')]};resolve();};});
  const focus=h.env.window.EspaciosSearchFocus.focusArea({name:'Palm Jumeirah',emirate:'Dubai'});h.canvasListeners.get('pointerdown')();finishLoad();assert.equal(await focus,false);h.flush();
  assert.equal(cameraMoves(h).length,0);
  await h.env.window.EspaciosSearchFocus.focusArea({name:'Palm Jumeirah',emirate:'Dubai'});h.flush();h.canvasListeners.get('wheel')();h.env.map.easeTo({zoom:14});
  assert.equal(h.moves.filter(move=>move.type==='easeTo').length,1,'Native zoom is never trapped by search ownership');
});
test('an explicit new camera destination replaces the search flight without waiting for its timeout',()=>{
  const h=runtime({entries:[{type:'record',id:'palm',record:community()}]});vm.runInContext('aeActivateSearchPosition(0)',h.ctx);h.flush();h.env.map.easeTo({center:[54.5,24.4],zoom:10});h.env.map.setPadding({right:12});
  assert.equal(h.moves.filter(move=>move.type==='easeTo').length,1);assert.equal(h.moves.filter(move=>move.type==='setPadding').length,2);
});

test('fitBounds never double-counts measured global padding on a narrow mobile canvas',()=>{
  const h=runtime({entries:[{type:'record',id:'palm',record:community()}]});
  let padding={top:120,bottom:596,left:12,right:12};
  const originalPadding=h.env.map.setPadding;h.env.map.setPadding=function(next){padding=next;return originalPadding.call(this,next);};
  h.env.map.cameraForBounds=(bounds,options)=>{
    assert.equal(options.padding,0,'Global measured insets must not be passed again as fitBounds insets');
    assert.ok(844-padding.top-padding.bottom>0);return{center:{lng:55.1,lat:25.1},zoom:12};
  };
  vm.runInContext('aeActivateSearchPosition(0)',h.ctx);h.flush();
  const camera=cameraMoves(h).at(-1);assert.equal(camera.type,'fitBounds');assert.equal(camera.args[1].padding,0);
  assert.equal(h.moves.filter(move=>move.type==='setPadding').length,1);
});
test('selected mobile dossier is compacted before measuring the usable map area',()=>{
  const h=runtime({entries:[{type:'record',id:'palm',record:community()}]}),panel={hidden:false,classList:{contains:()=>false}};let peek=false;
  h.elements.set('#detail',panel);h.env.window.EspaciosMobileUI={activate(target,collapsed){assert.equal(target,panel);peek=collapsed;}};
  h.env.map.cameraForBounds=()=>{assert.equal(peek,true);return{zoom:12};};
  vm.runInContext('aeActivateSearchPosition(0)',h.ctx);h.flush();assert.equal(peek,true);assert.equal(cameraMoves(h).length,1);
});
test('invalid fit records failure instead of reporting success based on a timer',()=>{
  const h=runtime({entries:[{type:'record',id:'palm',record:community()}]});h.env.map.cameraForBounds=()=>undefined;
  vm.runInContext('aeActivateSearchPosition(0)',h.ctx);h.flush();
  assert.equal(h.env.window.__ESPACIOS_SEARCH_FOCUS__.status,'fit-unavailable');assert.equal(cameraMoves(h).length,0);assert.equal(h.timers.size,0);
});
