import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const {chromium}=createRequire(import.meta.url)('playwright');
const source=await readFile(new URL('./worker.js',import.meta.url),'utf8');
const css=await readFile(new URL('./public-seamless.css',import.meta.url),'utf8');
const init=await readFile(new URL('./input-modality.js',import.meta.url),'utf8');
const worker=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
vm.runInNewContext(init,{location:{pathname:'/map'},document:{get documentElement(){throw Error('Map guard must return before touching the document');}}});
const listeners=[];
const mockRoot={dataset:{}};
let repair;
const context=vm.createContext({location:{pathname:'/learn'},window:{},document:{documentElement:mockRoot,addEventListener:(type,handler,capture)=>listeners.push({type,handler,capture})},MutationObserver:class{constructor(callback){repair=callback;}observe(root,options){assert.equal(root,mockRoot);assert.deepEqual(Array.from(options.attributeFilter),['data-espacios-input-modality']);}}});
vm.runInContext(init,context);
assert.equal(mockRoot.dataset.espaciosInputModality,'pointer');
assert.equal(listeners.length,2);
listeners.find(x=>x.type==='keydown').handler({key:'Tab'});
assert.equal(mockRoot.dataset.espaciosInputModality,'keyboard');
delete mockRoot.dataset.espaciosInputModality;repair();
assert.equal(mockRoot.dataset.espaciosInputModality,'keyboard');
delete mockRoot.dataset.espaciosInputModality;vm.runInContext(init,context);
assert.equal(mockRoot.dataset.espaciosInputModality,'keyboard');
assert.equal(listeners.length,2,'repeated shell/bootstrap initialization must preserve one listener pair');
const markup=`<!doctype html><html><head><style>
input,textarea{border:1px solid #9ca3af;border-radius:8px;padding:12px}
input:focus,textarea:focus,.unified-command:focus-within{outline:2px solid #635bff;border-color:#635bff;box-shadow:0 0 0 3px #635bff}
.unified-command{display:flex;border:1px solid #9ca3af;border-radius:8px;padding:12px;gap:8px}
[aria-invalid="true"]{border-color:#b4233f!important}
</style></head><body><main>
<button id="start">Start</button><input id="field" aria-label="Name"><button id="action">Save</button>
<label class="unified-command"><span aria-hidden="true">Search</span><input id="search" aria-label="Search"></label>
<input id="invalid" aria-label="Invalid value" aria-invalid="true">
</main></body></html>`;
const html=await (await worker.fetch(new Request('https://espacios.me/request-proposal'),{MARKETING:{fetch:async()=>new Response(markup,{headers:{'content-type':'text/html'}})}})).text();
const polish=await (await worker.fetch(new Request('https://espacios.me/__espacios/public-polish.js'),{})).text();
const browser=await chromium.launch({...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{}),headless:true,args:['--no-sandbox']});
let checks=6;
try{
  const page=await browser.newPage();
  await page.route('**/*',route=>route.fulfill({contentType:route.request().url().endsWith('/__espacios/public-polish.js')?'application/javascript':'text/html',body:route.request().url().endsWith('/__espacios/public-polish.js')?polish:html}));
  await page.goto('https://espacios.me/request-proposal');
  assert.equal(await page.locator('#esp-seamless-controls').textContent(),css);checks++;
  assert.equal(await page.locator('#esp-input-modality').textContent(),init);checks++;
  const style=selector=>page.locator(selector).evaluate(el=>{const s=getComputedStyle(el);return{outline:s.outlineWidth,shadow:s.boxShadow,border:s.borderColor,borderWidth:s.borderWidth};});
  await page.locator('#field').click();
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.espaciosInputModality),'pointer');checks++;
  assert.equal((await style('#field')).outline,'0px');checks++;
  assert.equal((await style('#field')).shadow,'none');checks++;
  await page.locator('#start').click();await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'field');checks++;
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.espaciosInputModality),'keyboard');checks++;
  const keyboard=await style('#field');
  assert.notEqual(keyboard.shadow,'none');checks++;
  assert.ok(!keyboard.border.includes('99, 91, 255'));checks++;
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'action');checks++;
  assert.notEqual((await style('#action')).outline,'0px');checks++;
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'search');checks++;
  assert.equal((await style('#search')).outline,'0px');checks++;
  assert.equal((await style('#search')).shadow,'none');checks++;
  assert.equal((await style('#search')).borderWidth,'0px');checks++;
  assert.notEqual((await style('.unified-command')).shadow,'none');checks++;
  await page.locator('#invalid').click();
  assert.equal((await style('#invalid')).border,'rgb(180, 35, 63)');checks++;
  console.log(JSON.stringify({passed:true,checks,liveRequests:0,mapDocumentTouched:false}));
}finally{await browser.close();}
