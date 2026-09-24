import {spawn} from 'node:child_process';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE=process.env.AE_MAP_URL||'http://127.0.0.1:8792/map';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map();this.listeners=new Map()}
  async connect(){
    this.ws=new WebSocket(this.url);
    await new Promise((resolve,reject)=>{this.ws.addEventListener('open',resolve,{once:true});this.ws.addEventListener('error',reject,{once:true})});
    this.ws.addEventListener('message',event=>{
      const msg=JSON.parse(event.data);
      if(msg.id){const p=this.pending.get(msg.id);if(!p)return;this.pending.delete(msg.id);msg.error?p.reject(new Error(msg.error.message)):p.resolve(msg.result);return}
      for(const fn of this.listeners.get(msg.method)||[])fn(msg.params||{});
    });
  }
  call(method,params={},timeout=20000){const id=++this.id;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error(`${method} timed out`))},timeout);this.pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value)},reject:error=>{clearTimeout(timer);reject(error)}});this.ws.send(JSON.stringify({id,method,params}))})}
  on(method,fn){const list=this.listeners.get(method)||[];list.push(fn);this.listeners.set(method,list)}
}

const profile=await mkdtemp(path.join(tmpdir(),'ae-map-debug-'));
const chrome=spawn(CHROME,['--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-features=Translate,MediaRouter','about:blank'],{stdio:['ignore','ignore','pipe']});
try{
  const endpoint=await new Promise((resolve,reject)=>{let stderr='';const timer=setTimeout(()=>reject(new Error(stderr||'Chrome endpoint timeout')),15000);chrome.stderr.on('data',chunk=>{stderr+=String(chunk);const match=stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);resolve(match[1])}})});
  const port=new URL(endpoint).port;
  const created=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`,{method:'PUT'}).then(r=>r.json());
  const cdp=new Cdp(created.webSocketDebuggerUrl);await cdp.connect();
  let paused;
  const pausedPromise=new Promise(resolve=>{paused=resolve});
  cdp.on('Debugger.paused',paused);
  await Promise.all([cdp.call('Page.enable'),cdp.call('Runtime.enable'),cdp.call('Debugger.enable'),cdp.call('Profiler.enable')]);
  await cdp.call('Profiler.setSamplingInterval',{interval:100});
  await cdp.call('Profiler.start');
  await cdp.call('Page.navigate',{url:BASE});
  await delay(5000);
  const pauseRequest=cdp.call('Debugger.pause',{},10000).catch(error=>({error:String(error)}));
  const pausedEvent=await Promise.race([pausedPromise,delay(12000).then(()=>null)]);
  const stack=(pausedEvent?.callFrames||[]).slice(0,30).map(frame=>({functionName:frame.functionName,url:frame.url,line:frame.location.lineNumber+1,column:frame.location.columnNumber+1}));
  await cdp.call('Debugger.resume',{},5000).catch(()=>{});
  await pauseRequest;
  const stopped=await cdp.call('Profiler.stop',{},15000).catch(error=>({error:String(error)}));
  const output={url:BASE,stack,reason:pausedEvent?.reason||null,profile:stopped.profile||null,profileError:stopped.error||null};
  const target=path.resolve('../../work/browser-acceptance/startup-debug.json');
  await writeFile(target,JSON.stringify(output,null,2));
  console.log(JSON.stringify({target,stack,reason:output.reason,profileError:output.profileError,profileNodes:output.profile?.nodes?.length||0},null,2));
}finally{
  chrome.kill('SIGTERM');
}
