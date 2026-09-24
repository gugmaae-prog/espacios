import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp, mkdir, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE=process.env.AE_MAP_URL||'http://127.0.0.1:8792/map';
const HEADLESS=process.env.AE_CHROME_HEADLESS!=='0';
const OUT=path.resolve('../../work/browser-acceptance');
await mkdir(OUT,{recursive:true});

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

class Cdp {
  constructor(url){this.url=url;this.ws=null;this.id=0;this.pending=new Map();this.listeners=new Map()}
  async connect(){
    this.ws=new WebSocket(this.url);
    await new Promise((resolve,reject)=>{this.ws.addEventListener('open',resolve,{once:true});this.ws.addEventListener('error',reject,{once:true})});
    this.ws.addEventListener('message',event=>{
      const msg=JSON.parse(event.data);
      if(msg.id){const pending=this.pending.get(msg.id);if(!pending)return;this.pending.delete(msg.id);if(msg.error)pending.reject(new Error(`${pending.method}: ${msg.error.message}`));else pending.resolve(msg.result);return}
      for(const fn of this.listeners.get(msg.method)||[])fn(msg.params||{});
    });
  }
  call(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error(`${method}: timed out`))},15000);this.pending.set(id,{method,resolve:value=>{clearTimeout(timer);resolve(value)},reject:error=>{clearTimeout(timer);reject(error)}});this.ws.send(JSON.stringify({id,method,params}))})}
  on(method,fn){const list=this.listeners.get(method)||[];list.push(fn);this.listeners.set(method,list)}
  close(){this.ws?.close()}
}

async function launchChrome(){
  const profile=await mkdtemp(path.join(tmpdir(),'ae-map-chrome-'));
  const chrome=spawn(CHROME,[
    ...(HEADLESS?['--headless=new']:[]),'--remote-debugging-port=0',`--user-data-dir=${profile}`,
    '--no-first-run','--no-default-browser-check','--disable-background-networking',
    '--disable-component-update','--disable-features=Translate,MediaRouter','about:blank'
  ],{stdio:['ignore','ignore','pipe']});
  const endpoint=await new Promise((resolve,reject)=>{
    let stderr='';const timer=setTimeout(()=>reject(new Error(`Chrome DevTools endpoint timeout\n${stderr}`)),15000);
    chrome.stderr.on('data',chunk=>{stderr+=String(chunk);const match=stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);resolve(match[1])}});
    chrome.once('exit',code=>reject(new Error(`Chrome exited before DevTools was ready (${code})\n${stderr}`)));
  });
  return {chrome,profile,port:new URL(endpoint).port};
}

async function newPage(port){
  const response=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`,{method:'PUT'});
  if(!response.ok)throw new Error(`Could not create Chrome target: ${response.status}`);
  const target=await response.json();const cdp=new Cdp(target.webSocketDebuggerUrl);await cdp.connect();return cdp;
}

async function evaluate(cdp,expression){
  const out=await cdp.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});
  if(out.exceptionDetails)throw new Error(out.exceptionDetails.exception?.description||out.exceptionDetails.text||'Evaluation failed');
  return out.result?.value;
}

async function waitFor(cdp,expression,{timeout=40000,interval=160,label=expression}={}){
  const start=Date.now();let last;
  while(Date.now()-start<timeout){try{last=await evaluate(cdp,expression);if(last)return last}catch(e){last=String(e)}await delay(interval)}
  throw new Error(`Timed out waiting for ${label}; last=${JSON.stringify(last)}`);
}

async function capture(cdp,name){
  const shot=await cdp.call('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});
  const target=path.join(OUT,`${name}.png`);await writeFile(target,Buffer.from(shot.data,'base64'));return target;
}

async function uiSnapshot(cdp){
  return evaluate(cdp,`(()=>{
    const read=selector=>{const el=document.querySelector(selector);if(!el)return null;const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {left:r.left,top:r.top,width:r.width,height:r.height,fontSize:s.fontSize,transform:s.transform}};
    return {topbar:read('.topbar'),rail:read('.layer-rail'),panel:read('.floating-panel:not(.hidden)'),viewportScale:window.visualViewport?.scale||1,innerWidth,innerHeight};
  })()`);
}

function assertUiStable(before,after,label){
  assert.equal(after.viewportScale,before.viewportScale,`${label}: browser viewport scale must stay fixed`);
  assert.equal(after.innerWidth,before.innerWidth,`${label}: layout viewport width must stay fixed`);
  assert.equal(after.innerHeight,before.innerHeight,`${label}: layout viewport height must stay fixed`);
  for(const key of ['topbar','rail','panel']){
    if(!before[key]||!after[key])continue;
    for(const metric of ['left','top','width','height'])assert.ok(Math.abs(after[key][metric]-before[key][metric])<=1,`${label}: ${key} ${metric} changed from ${before[key][metric]} to ${after[key][metric]}`);
    assert.equal(after[key].fontSize,before[key].fontSize,`${label}: ${key} font size must stay fixed`);
  }
}

async function runCase(port,{name,width,height,mobile}){
  console.log(`[${name}] create target`);
  const cdp=await newPage(port);const exceptions=[],logErrors=[],networkFailures=[],httpErrors=[];
  cdp.on('Runtime.exceptionThrown',p=>exceptions.push(p.exceptionDetails?.exception?.description||p.exceptionDetails?.text||'runtime exception'));
  cdp.on('Log.entryAdded',p=>{if(p.entry?.level==='error')logErrors.push(p.entry.text)});
  cdp.on('Network.loadingFailed',p=>{if(!p.canceled&&p.errorText!=='net::ERR_ABORTED')networkFailures.push({url:p.url,error:p.errorText,type:p.type})});
  cdp.on('Network.responseReceived',p=>{if(p.response?.status>=400)httpErrors.push({url:p.response.url,status:p.response.status,type:p.type})});
  await Promise.all([cdp.call('Page.enable'),cdp.call('Runtime.enable'),cdp.call('Log.enable'),cdp.call('Network.enable'),cdp.call('Performance.enable')]);
  await cdp.call('Network.setCacheDisabled',{cacheDisabled:true});
  await cdp.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile,screenWidth:width,screenHeight:height});
  if(mobile)await cdp.call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await cdp.call('Page.addScriptToEvaluateOnNewDocument',{source:`
    try{localStorage.clear()}catch{}
    window.__aeLab={longTasks:[],lcp:0,cls:0,events:[]};
    try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__aeLab.longTasks.push({start:e.startTime,duration:e.duration})}).observe({type:'longtask',buffered:true})}catch{}
    try{new PerformanceObserver(l=>{const e=l.getEntries().at(-1);if(e)window.__aeLab.lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true})}catch{}
    try{new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__aeLab.cls+=e.value}).observe({type:'layout-shift',buffered:true})}catch{}
    try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__aeLab.events.push({name:e.name,duration:e.duration})}).observe({type:'event',durationThreshold:16,buffered:true})}catch{}
  `});
  await cdp.call('Page.navigate',{url:BASE});
  console.log(`[${name}] navigating`);
  await waitFor(cdp,"document.readyState==='complete'",{label:`${name} document complete`});
  await waitFor(cdp,"window.__PSR_MAP__?.loaded() && window.__PSR_STATE__?.communities?.length>0 && document.documentElement.dataset.aeNavigation==='20260920-v4'",{timeout:50000,label:`${name} map ready`});
  await waitFor(cdp,"document.querySelectorAll('[data-ae-emirate]').length===7",{label:`${name} explorer hydration`});
  console.log(`[${name}] map and explorer ready`);

  const initial=await evaluate(cdp,`(()=>{const m=window.__PSR_MAP__,s=window.__PSR_STATE__,c=m.getCenter();return {center:[c.lng,c.lat],zoom:m.getZoom(),layers:m.getStyle().layers.length,sources:Object.keys(m.getStyle().sources).length,projects:s.projects.length,communities:s.communities.length,plans:s.initiatives.length,is3d:s.is3d,hasBuildings:!!m.getSource('psr-buildings'),hasContext:!!m.getSource('psr-places'),hasUniversal:!!m.getSource('psr-universal-hover'),overflow:document.documentElement.scrollWidth-innerWidth,hit:document.elementFromPoint(${mobile?width/2:width*.78},${mobile?height*.24:height*.55})?.className||''}})()`);
  assert.equal(initial.is3d,true,`${name}: automatic 3D must be enabled`);
  assert.equal(initial.hasBuildings,false,`${name}: building tiles must remain deferred at UAE scale`);
  assert.equal(initial.hasContext,false,`${name}: context layers must be deferred`);
  assert.equal(initial.hasUniversal,false,`${name}: universal spatial layers must be deferred at UAE zoom`);
  assert.ok(initial.projects>=1337&&initial.communities===215&&initial.plans===72,`${name}: expected map registry counts`);
  assert.ok(initial.overflow<=1,`${name}: viewport must not overflow horizontally`);

  let navigation={};
  if(!mobile){
    console.log('[desktop] pointer drag');
    const fixedBefore=await uiSnapshot(cdp);
    const x=Math.round(width*.78),y=Math.round(height*.55);
    await cdp.call('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',buttons:1,clickCount:1});
    for(let step=1;step<=5;step++){await cdp.call('Input.dispatchMouseEvent',{type:'mouseMoved',x:x-step*22,y:y+step*2,button:'left',buttons:1});await delay(35)}
    await cdp.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:x-110,y:y+10,button:'left',buttons:0,clickCount:1});
    await waitFor(cdp,'!window.__PSR_MAP__.isMoving()',{label:'desktop drag completion'});
    const afterDrag=await evaluate(cdp,"(()=>{const c=window.__PSR_MAP__.getCenter();return [c.lng,c.lat]})()");
    assert.ok(Math.abs(afterDrag[0]-initial.center[0])>0.02,'desktop: pointer drag must pan the map');
    await cdp.call('Input.dispatchMouseEvent',{type:'mouseWheel',x,y,deltaX:0,deltaY:-520});
    await delay(700);await waitFor(cdp,'!window.__PSR_MAP__.isMoving()',{label:'desktop wheel completion'});
    const afterWheel=await evaluate(cdp,'window.__PSR_MAP__.getZoom()');
    assert.ok(afterWheel>initial.zoom+.1,'desktop: wheel must zoom the map');
    assertUiStable(fixedBefore,await uiSnapshot(cdp),'desktop wheel zoom');
    console.log('[desktop] trackpad pinch isolation');
    await cdp.call('Input.dispatchMouseEvent',{type:'mouseWheel',x,y,deltaX:0,deltaY:-110,modifiers:2});
    await delay(500);await waitFor(cdp,'!window.__PSR_MAP__.isMoving()',{label:'desktop pinch completion'});
    const afterPinch=await evaluate(cdp,'window.__PSR_MAP__.getZoom()');
    assert.ok(afterPinch>afterWheel+.05,'desktop: ctrl-wheel trackpad pinch must zoom the map camera');
    assertUiStable(fixedBefore,await uiSnapshot(cdp),'desktop trackpad pinch');
    console.log('[desktop] automatic 3D buildings');
    await evaluate(cdp,"window.__PSR_MAP__.jumpTo({center:[55.2744,25.1972],zoom:10.25,pitch:0,bearing:-18});true");
    await waitFor(cdp,"window.__PSR_MAP__.getLayer('psr-3d-buildings') && window.__PSR_MAP__.getPitch()>=40 && !window.__PSR_MAP__.isMoving()",{timeout:50000,label:'desktop automatic 3D camera pitch'});
    const autoPitch=await evaluate(cdp,'window.__PSR_MAP__.getPitch()');
    await evaluate(cdp,"window.__PSR_MAP__.jumpTo({center:[55.2744,25.1972],zoom:15.25,bearing:-18});true");
    await waitFor(cdp,"window.__PSR_MAP__.getLayer('psr-3d-buildings') && window.__PSR_MAP__.isSourceLoaded('psr-buildings') && !window.__PSR_MAP__.isMoving()",{timeout:50000,label:'desktop 3D building tiles'});
    await delay(500);
    const threeD=await evaluate(cdp,"(()=>{const m=window.__PSR_MAP__,layer=m.getLayer('psr-3d-buildings');return {zoom:m.getZoom(),pitch:m.getPitch(),layerType:layer?.type,visibility:m.getLayoutProperty('psr-3d-buildings','visibility'),rendered:m.queryRenderedFeatures({layers:['psr-3d-buildings']}).length,active:document.querySelector('#toggle-3d').classList.contains('active')}})()");
    assert.equal(threeD.layerType,'fill-extrusion','desktop: 3D buildings must use an extrusion layer');
    assert.equal(threeD.visibility,'visible','desktop: 3D building layer must be visible');
    assert.ok(threeD.pitch>=40,'desktop: building scale must use a pitched camera');
    assert.ok(threeD.rendered>0,'desktop: real building extrusions must render in the viewport');
    assert.equal(threeD.active,true,'desktop: 3D control must show its active state');
    const threeDScreenshot=await capture(cdp,`${name}-3d`);
    console.log('[desktop] focus, keyboard, help and search');
    await evaluate(cdp,"document.querySelector('.ae-map-focus-toggle').click()");
    assert.equal(await evaluate(cdp,"document.body.classList.contains('ae-map-focus-mode')"),true,'desktop: focus mode should hide panels');
    const beforeKey=await evaluate(cdp,"window.__PSR_MAP__.getCenter().lng");
    await cdp.call('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39,nativeVirtualKeyCode:39});
    await cdp.call('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39,nativeVirtualKeyCode:39});
    await delay(400);const afterKey=await evaluate(cdp,"window.__PSR_MAP__.getCenter().lng");
    assert.notEqual(afterKey,beforeKey,'desktop: keyboard navigation should pan once');
    await evaluate(cdp,"document.querySelector('.ae-map-focus-toggle').click();document.querySelector('.ae-map-help-toggle').click()");
    assert.equal(await evaluate(cdp,"!document.querySelector('#ae-map-help').hidden"),true,'desktop: navigation help should open');
    await evaluate(cdp,"document.querySelector('.ae-map-help-close').click()");
    await evaluate(cdp,"(()=>{const i=document.querySelector('#search');i.focus();i.value='Burj Khalifa';i.dispatchEvent(new Event('input',{bubbles:true}))})()");
    await waitFor(cdp,"document.querySelectorAll('#search-results [role=option]').length>0",{label:'desktop search results'});
    console.log('[desktop] context hydration');
    await evaluate(cdp,"document.querySelector('.rail-btn[data-panel=places]').click()");
    await waitFor(cdp,"window.__PSR_STATE__.contextLoaded===true",{timeout:50000,label:'desktop context data'});
    await evaluate(cdp,"document.querySelector('[data-place=all]').click()");
    await delay(500);
    const context=await evaluate(cdp,"(()=>({places:window.__PSR_STATE__.places.length,contextSource:!!window.__PSR_MAP__.getSource('psr-places'),contextStatus:document.querySelector('[data-context-status]').textContent}))()");
    assert.ok(context.places>1000&&context.contextSource,'desktop: Places should hydrate on demand');
    navigation={afterDrag,afterWheel,afterPinch,autoPitch,afterKey,context,threeD,threeDScreenshot};
  }else{
    console.log('[mobile] touch pan and pinch isolation');
    const fixedBefore=await uiSnapshot(cdp);
    const x=Math.round(width*.52),y=Math.round(height*.24);
    const hit=await evaluate(cdp,`document.elementFromPoint(${x},${y})?.className||''`);
    assert.match(String(hit),/maplibregl-canvas/,'mobile: focused map center must hit the canvas');
    const beforeTouch=await evaluate(cdp,"(()=>{const c=window.__PSR_MAP__.getCenter();return [c.lng,c.lat]})()");
    await cdp.call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1,radiusX:1,radiusY:1,force:1}]});
    for(let step=1;step<=5;step++){await cdp.call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-step*15,y:y+step*2,id:1,radiusX:1,radiusY:1,force:1}]});await delay(45)}
    await cdp.call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await delay(500);await waitFor(cdp,'!window.__PSR_MAP__.isMoving()',{label:'mobile touch completion'});
    const afterTouch=await evaluate(cdp,"(()=>{const c=window.__PSR_MAP__.getCenter();return [c.lng,c.lat]})()");
    assert.ok(Math.abs(afterTouch[0]-beforeTouch[0])>0.01,'mobile: one-finger gesture must pan the map');
    assertUiStable(fixedBefore,await uiSnapshot(cdp),'mobile touch pan');
    const beforePinch=await evaluate(cdp,'window.__PSR_MAP__.getZoom()');
    await cdp.call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-24,y,id:1,radiusX:1,radiusY:1,force:1},{x:x+24,y,id:2,radiusX:1,radiusY:1,force:1}]});
    for(let step=1;step<=5;step++){const d=24+step*12;await cdp.call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-d,y,id:1,radiusX:1,radiusY:1,force:1},{x:x+d,y,id:2,radiusX:1,radiusY:1,force:1}]});await delay(45)}
    await cdp.call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await delay(600);await waitFor(cdp,'!window.__PSR_MAP__.isMoving()',{label:'mobile pinch completion'});
    const afterPinch=await evaluate(cdp,'window.__PSR_MAP__.getZoom()');
    assert.ok(afterPinch>beforePinch+.1,'mobile: two-finger pinch must zoom the map camera');
    assertUiStable(fixedBefore,await uiSnapshot(cdp),'mobile pinch zoom');
    navigation={beforeTouch,afterTouch,beforePinch,afterPinch,hit};
  }

  await delay(700);
  const lab=await evaluate(cdp,`(()=>{const n=performance.getEntriesByType('navigation')[0]?.toJSON()||{};const paints=Object.fromEntries(performance.getEntriesByType('paint').map(e=>[e.name,e.startTime]));const marks=Object.fromEntries(performance.getEntriesByType('mark').map(e=>[e.name,e.startTime]));return {navigation:{domContentLoaded:n.domContentLoadedEventEnd,loadEventEnd:n.loadEventEnd,responseStart:n.responseStart,transferSize:n.transferSize},paints,marks,vitals:window.__aeLab,resources:performance.getEntriesByType('resource').length,layers:window.__PSR_MAP__.getStyle().layers.length,sources:Object.keys(window.__PSR_MAP__.getStyle().sources).length}})()`);
  const perf=await cdp.call('Performance.getMetrics');
  const screenshot=await capture(cdp,name);
  console.log(`[${name}] acceptance complete`);
  cdp.close();
  return {name,width,height,mobile,initial,navigation,lab,performance:Object.fromEntries(perf.metrics.map(x=>[x.name,x.value])),exceptions,logErrors,networkFailures,httpErrors,screenshot};
}

const {chrome,port}=await launchChrome();
let report;
try{
  const desktop=await runCase(port,{name:'desktop-1440x900',width:1440,height:900,mobile:false});
  const mobile=await runCase(port,{name:'mobile-390x844',width:390,height:844,mobile:true});
  report={createdAt:new Date().toISOString(),url:BASE,desktop,mobile};
  await writeFile(path.join(OUT,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({desktop:{initial:desktop.initial,navigation:desktop.navigation,lab:desktop.lab,exceptions:desktop.exceptions,logErrors:desktop.logErrors,networkFailures:desktop.networkFailures.length,httpErrors:desktop.httpErrors,screenshot:desktop.screenshot},mobile:{initial:mobile.initial,navigation:mobile.navigation,lab:mobile.lab,exceptions:mobile.exceptions,logErrors:mobile.logErrors,networkFailures:mobile.networkFailures.length,httpErrors:mobile.httpErrors,screenshot:mobile.screenshot}},null,2));
}finally{
  chrome.kill('SIGTERM');
}
