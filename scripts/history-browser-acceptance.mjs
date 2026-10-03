import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp, mkdir, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

const CHROME=process.env.HI_CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE=process.env.AE_MAP_URL||'http://127.0.0.1:8798/map';
const HEADLESS=process.env.AE_CHROME_HEADLESS!=='0';
const OUT=path.resolve(process.env.HI_BROWSER_OUTPUT||'../../outputs/historical-acceptance');
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

async function runCase(port,{name,width,height,mobile}){
 const cdp=await newPage(port),exceptions=[];
 cdp.on('Runtime.exceptionThrown',p=>exceptions.push(p.exceptionDetails?.exception?.description||p.exceptionDetails?.text));
 await cdp.call('Page.enable');await cdp.call('Runtime.enable');
 await cdp.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
 if(mobile)await cdp.call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 await cdp.call('Page.navigate',{url:BASE});
 await waitFor(cdp,'window.EspaciosHistoricalUI && window.__PSR_STATE__?.communities?.length===215',{timeout:60000,label:name+' historicalUI ready'});
 await evaluate(cdp,"window.EspaciosHistoricalUI.open('community:Dubai:palm-jebel-ali'); true");
 await waitFor(cdp,"window.EspaciosHistoricalUI.getState().recordId==='community:Dubai:palm-jebel-ali'&&!window.EspaciosHistoricalUI.getState().loading&&document.querySelector('#hi-body').textContent.includes('Financial coverage')",{label:name+' PJA coverage'});
 const index=await evaluate(cdp,"({state:window.EspaciosHistoricalUI.getState(),options:document.querySelector('#hi-record-select').options.length,sources:[...document.querySelectorAll('#hi-body a')].every(a=>a.href.startsWith('https://')),chart:document.querySelector('.hi-chart figcaption')?.textContent})");
 assert.equal(index.state.recordCount,1860);assert.equal(index.options,1861);assert.equal(index.sources,true);
 await evaluate(cdp,"document.querySelector('#hi-tab-events').click();true");
 await waitFor(cdp,"document.querySelector('#hi-body [data-hi-event]')",{label:name+' event cards'});
 const events=await evaluate(cdp,"({cards:document.querySelectorAll('#hi-body [data-hi-event]').length,text:document.querySelector('#hi-body').textContent})");
 assert.ok(events.cards>10);assert.match(events.text,/source|Source/);assert.match(events.text,/price|Price/);
 await evaluate(cdp,"document.querySelector('#hi-body button[data-hi-event]').click();true");
 await waitFor(cdp,"document.querySelector('#hi-event-study')&& !document.querySelector('#hi-body').textContent.includes('Checking comparable')",{label:name+' study complete'});
 const study=await evaluate(cdp,"document.querySelector('#hi-event-study').textContent");assert.match(study,/no causal attribution|Effect not established/);
 await capture(cdp,name+'-events');
 await evaluate(cdp,"document.querySelector('#hi-tab-scenarios').click();true");
 const empty=await evaluate(cdp,"({max:document.querySelector('#hi-year').max,year:document.querySelector('#hi-year').value,rows:document.querySelectorAll('.hi-scenario-table tbody tr').length,text:document.querySelector('#hi-body').textContent})");
 assert.equal(empty.max,'2080');assert.equal(empty.year,'2080');assert.equal(empty.rows,54);assert.match(empty.text,/Unavailable/);
 await evaluate(cdp,`(()=>{const form=document.querySelector('#hi-scenario-form');document.querySelector('#hi-assumptions').open=true;const values={priceAED:1000000,annualRentAED:60000,occupancyYear:2029,vacancyPct:5,annualOperatingCostsAED:10000,acquisitionCostsPct:7,disposalCostsPct:2,'priceGrowth.downside':-2,'priceGrowth.base':0,'priceGrowth.upside':3,'rentGrowth.downside':-1,'rentGrowth.base':0,'rentGrowth.upside':2};for(const[k,v]of Object.entries(values))form.elements.namedItem(k).value=v;form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));return true;})()`);
 await waitFor(cdp,"window.EspaciosHistoricalUI.getState().scenarioClassification==='user_assumption_scenario'",{label:name+' manual scenario'});
 const computed=await evaluate(cdp,"({text:document.querySelector('#hi-scenario-value').textContent,rows:document.querySelectorAll('.hi-scenario-table tbody tr').length,table:document.querySelector('.hi-scenario-table tbody').textContent,state:window.EspaciosHistoricalUI.getState()})");
 assert.equal(computed.rows,54);assert.equal(computed.state.validatedForecast,false);assert.match(computed.text,/1,000,000/);assert.match(computed.table,/2080/);
 await evaluate(cdp,"document.querySelector('#hi-assumptions').open=false;true");
 await capture(cdp,name+'-2080');
 await evaluate(cdp,"document.querySelector('#hi-scenario-metric').value='rent';document.querySelector('#hi-scenario-metric').dispatchEvent(new Event('change',{bubbles:true}));true");
 const rents=await evaluate(cdp,"[...document.querySelectorAll('.hi-scenario-table tbody tr')].slice(0,3).map(tr=>[...tr.children].map(td=>td.textContent))");
 assert.equal(rents[0][2],'0');assert.equal(rents[1][2],'0');assert.equal(rents[2][2],'60,000');
 await evaluate(cdp,"document.querySelector('#hi-overlay-toggle').click();true");
 await waitFor(cdp,"document.querySelector('#hi-overlay-toggle').getAttribute('aria-pressed')==='true'",{label:name+' map overlay active'});
 try {await waitFor(cdp,`(()=>{const p=document.querySelector('#hi-panel').getBoundingClientRect(),b=document.querySelector('#hi-body').getBoundingClientRect(),d=document.querySelector('#tl-dock').getBoundingClientRect();return Math.min(b.bottom,p.bottom-12)-Math.max(b.top,p.top)>=119&&(window.EspaciosHistoricalUI.getState().layout==='expanded'||p.bottom<=d.top+1)})()`,{label:name+' visible history body and stable dock geometry'});} catch(error) {
  console.log(JSON.stringify(await evaluate(cdp,"({state:window.EspaciosHistoricalUI.getState(),panel:document.querySelector('#hi-panel').getBoundingClientRect().toJSON(),body:document.querySelector('#hi-body').getBoundingClientRect().toJSON(),dock:document.querySelector('#tl-dock').getBoundingClientRect().toJSON()})")));
  await capture(cdp,name+'-layout-failure');throw error;
 }
 await evaluate(cdp,'new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
 const geometry=await evaluate(cdp,`(()=>{const p=document.querySelector('#hi-panel').getBoundingClientRect(),dock=document.querySelector('#tl-dock').getBoundingClientRect(),body=document.querySelector('#hi-body').getBoundingClientRect(),search=document.querySelector('.topbar .search-wrap').getBoundingClientRect();return {layout:window.EspaciosHistoricalUI.getState().layout,panel:{left:p.left,right:p.right,top:p.top,bottom:p.bottom,width:p.width,height:p.height},body:{height:body.height,visibleHeight:Math.min(body.bottom,p.bottom-12)-Math.max(body.top,p.top)},search:{bottom:search.bottom},dock:{top:dock.top,bottom:dock.bottom},overflow:document.documentElement.scrollWidth-innerWidth,viewport:{width:innerWidth,height:innerHeight},overlayButtons:[...document.querySelectorAll('#hi-event-track button')].map(b=>{const r=b.getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,right:r.right}})};})()`);
 console.log(JSON.stringify({name,geometry}));await capture(cdp,name+'-overlay');
 assert.ok(geometry.overflow<=1,name+' horizontal viewport overflow');assert.ok(geometry.panel.left>=0&&geometry.panel.right<=width+1,name+' drawer horizontal bounds');assert.ok(geometry.panel.height>150,name+' usable drawer height');
 assert.ok(geometry.body.visibleHeight>=119,name+' visibly readable scrollable history body');
 if(!mobile)assert.ok(geometry.panel.bottom<=geometry.dock.top+1,name+' desktop drawer clears timeline');
 if(mobile){
  assert.ok(geometry.panel.top>=geometry.search.bottom-1,name+' drawer clears search');
  assert.ok(geometry.layout==='expanded'||geometry.panel.bottom<=geometry.dock.top+1,name+' drawer clears timeline or uses labelled expanded mode');
  assert.ok(geometry.overlayButtons.every(b=>b.width>=43&&b.height>=43),name+' event touch targets');
  const buttons=geometry.overlayButtons.slice().sort((a,b)=>a.left-b.left);assert.ok(buttons.every((b,i)=>!i||b.left>=buttons[i-1].right-1),name+' clustered event markers do not overlap');
  await evaluate(cdp,'window.EspaciosHistoricalUI.close();true');
  assert.equal(await evaluate(cdp,"document.querySelector('#hi-panel').classList.contains('hidden')"),true,name+' close restores map');
  assert.ok(await evaluate(cdp,"document.querySelector('#hi-event-track').getBoundingClientRect().height>=43"),name+' timeline remains usable after closing drawer');
  await evaluate(cdp,"document.querySelector('#hi-event-track button').click();true");
  await waitFor(cdp,"!document.querySelector('#hi-panel').classList.contains('hidden')&&!window.EspaciosHistoricalUI.getState().loading",{label:name+' source drawer reopens from clustered marker'});
 }
 await evaluate(cdp,"window.EspaciosHistoricalUI.select('project:arancia-yards-beyond-city-of-arabia-dubai');true");
 await waitFor(cdp,"window.EspaciosHistoricalUI.getState().recordId==='project:arancia-yards-beyond-city-of-arabia-dubai'&&!window.EspaciosHistoricalUI.getState().loading",{label:name+' project switch'});
 assert.notEqual((await evaluate(cdp,'window.EspaciosHistoricalUI.getState()')).scenarioClassification,'user_assumption_scenario',name+' assumptions must reset when changing subject');
 assert.equal(exceptions.length,0,name+' browser exceptions: '+exceptions.join('; '));
 cdp.close();return {name,index,events:{cards:events.cards},study,empty:{max:empty.max,rows:empty.rows},computed:{rows:computed.rows,text:computed.text},rents,geometry,exceptions};
}
const session=await launchChrome();try{
 const results=[];for(const options of [{name:'desktop',width:1440,height:1000,mobile:false},{name:'mobile',width:390,height:844,mobile:true}]){console.log('Checking '+options.name);results.push(await runCase(session.port,options));}
 await writeFile(path.join(OUT,'verification.json'),JSON.stringify({url:BASE,results},null,2)+'\n');console.log(JSON.stringify({passed:true,cases:results.length,output:OUT}));
}finally{session.chrome.kill();}
