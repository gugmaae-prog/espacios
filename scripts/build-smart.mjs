import fs from 'node:fs/promises';import vm from 'node:vm';import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
const root=new URL('../',import.meta.url),release='20260930-smart-estimates-v1',read=p=>fs.readFile(new URL(p,root),'utf8');
const baseline=await read('src/baseline/worker-20260930.js');if(createHash('sha256').update(baseline).digest('hex')!=='b9aab494d2297e7208f5257c069a54c2a6f9eb3762ff79224350ae4006357e06')throw Error('Acquired live baseline changed');
const core=await read('src/smart-estimates/core.mjs');const app='\nconst SECore=(()=>{\n'+core.replace(/^export /gm,'')+'\nreturn {derivePriceScenario,calculateROI,combineROI};})();\n'+await read('src/smart-estimates/app.js');
let source=baseline.replace(/export \{\s*worker_default as default\s*\};/,'').replace(/\/\/# sourceMappingURL=.*\n?/g,'').replaceAll('20260929-collapse-repair-v3',release);
// The acquired legacy repair observer watches childList changes, including its
// own icons. Keep the baseline immutable and replace exactly this renderer in
// the embedded browser asset so an unchanged card cannot reschedule every frame.
const legacyCollapseSync="function sync(el,btn){const collapsed=el.classList.contains('ae2-section-collapsed'),title=btn.dataset.title||'Section';btn.innerHTML=icon(collapsed);btn.setAttribute('aria-expanded',String(!collapsed));btn.setAttribute('aria-label',(collapsed?'Expand ':'Collapse ')+title);btn.title=(collapsed?'Expand ':'Collapse ')+title;}";
const guardedCollapseSync="function sync(el,btn){const collapsed=el.classList.contains('ae2-section-collapsed'),title=btn.dataset.title||'Section',html=icon(collapsed),expanded=String(!collapsed),label=(collapsed?'Expand ':'Collapse ')+title;if(btn.aeCollapseIconKey!==html){btn.aeCollapseIconKey=html;btn.innerHTML=html;}if(btn.getAttribute('aria-expanded')!==expanded)btn.setAttribute('aria-expanded',expanded);if(btn.getAttribute('aria-label')!==label)btn.setAttribute('aria-label',label);if(btn.title!==label)btn.title=label;}";
const acquiredContext=vm.createContext({console});
vm.runInContext(baseline.replace(/export \{\s*worker_default as default\s*\};/,''),acquiredContext);
const acquiredBrowser=gunzipSync(Buffer.from(acquiredContext.GZ.js,'base64')).toString('utf8');
const collapseMatches=acquiredBrowser.split(legacyCollapseSync).length-1;
if(collapseMatches!==1)throw Error('Expected exactly one legacy collapse-repair sync renderer; found '+collapseMatches);
const guardedBrowser=acquiredBrowser.replace(legacyCollapseSync,guardedCollapseSync);
source+='\n// Idempotent legacy collapse icons; evidence and all other embedded assets unchanged.\nGZ.js = '+JSON.stringify(gzipSync(guardedBrowser,{level:9}).toString('base64'))+';\n';
source+='\nAE_UAE_RELEASE_APP_JS += '+JSON.stringify(app)+';\nAE_UAE_RELEASE_CSS += '+JSON.stringify(await read('src/smart-estimates/style.css'))+';\n';
const mobileCore=await read('src/mobile-map/core.mjs');
const mobileApp='\nconst MMCore=(()=>{\n'+mobileCore.replace(/^export /gm,'')+'\nreturn {clamp,fractionAt,periodAt,pickProjects,viewportPadding};})();\n'+await read('src/mobile-map/app.js');
source+='\nAE_UAE_RELEASE_APP_JS += '+JSON.stringify(mobileApp)+';\nAE_UAE_RELEASE_CSS += '+JSON.stringify(await read('src/mobile-map/style.css'))+';\n';
const unifiedCore=await read('src/unified-map/core.mjs');
const unifiedApp='\nconst UMCore=(()=>{\n'+unifiedCore.replace(/^export /gm,'')+'\nreturn {periodEnd,sortNativePeriods,extendPriceScenario,timelineOptions,profitability};})();\n'+await read('src/mobile-map/search-focus.js')+'\n'+await read('src/unified-map/app.js');
source+='\nAE_UAE_RELEASE_APP_JS += '+JSON.stringify(unifiedApp)+';\nAE_UAE_RELEASE_CSS += '+JSON.stringify(await read('src/unified-map/style.css'))+';\n';
source+='\nvar SE_SOURCE_REVIEW='+JSON.stringify(JSON.parse(await read('data/source-review-20260930.json')))+';\n'+await read('src/smart-estimates/worker-extension.js')+'\nexport {worker_default as default};\n';
source=source.replace('\nexport {worker_default as default};\n','\n'+await read('src/mobile-map/worker-extension.js')+'\nexport {worker_default as default};\n');
await fs.writeFile(new URL('src/worker.js',root),source);
const context=vm.createContext({console,Headers,Request,Response,URL,URLSearchParams,atob,btoa,TextEncoder,TextDecoder,DecompressionStream,CompressionStream,ReadableStream,Blob,crypto:globalThis.crypto,fetch});vm.runInContext(source.replace(/export \{\s*worker_default as default\s*\};/,''),context);
const browser=await(await vm.runInContext('aePatchedAppJs()',context)).text();new vm.Script(browser.replace(/^import .*;$/gm,''));
console.log(JSON.stringify({release,workerBytes:Buffer.byteLength(source),appBytes:Buffer.byteLength(browser),workerSha256:createHash('sha256').update(source).digest('hex')}));
