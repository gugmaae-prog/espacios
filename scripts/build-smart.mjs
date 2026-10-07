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
const paletteCopyReplacements=[
  ['Heat maps are opt-in. Gold is reserved for your current selection.','Heat maps are opt-in. Selected places are outlined for orientation, not as a price signal.'],
  ['Heat colors are analytical only. Gold remains selection-only.','Heat colors are analytical only. Selection highlights identify the current place and do not indicate value.'],
  ['Indicative future-investment signal. Not investment advice. Gold remains selection-only.','Indicative signal only; colors distinguish activity bands and do not represent expected property returns.'],
  ['Emirate boundary is loaded from the highest available polygon source. Gold indicates selection only.','Emirate boundary is loaded from the highest available polygon source. A subdued outline marks the current selection.'],
  ['Gold indicates the current selection only.','A subdued outline marks the current selection.'],
  ['Gold is this selected community boundary only. Market history and forecasts follow this community in Analyze.','The selected boundary is highlighted for orientation, not as a value signal. Market history and forecasts follow this community in Analyze.'],
  ['Gold is reserved for this selected community only.','The selected boundary is highlighted for orientation, not as a value signal.']
];
let paletteBrowser=acquiredBrowser;
let paletteReplacementCount=0;
for(const [before,after] of paletteCopyReplacements){
  const matches=paletteBrowser.split(before).length-1;
  if(!matches)continue;
  paletteBrowser=paletteBrowser.replaceAll(before,after);
  paletteReplacementCount+=matches;
}
if(paletteReplacementCount!==6)throw Error(`Expected six legacy palette sentences; replaced ${paletteReplacementCount}`);
const guardedBrowser=paletteBrowser.replace(legacyCollapseSync,guardedCollapseSync);
source+='\n// Idempotent legacy collapse icons; evidence and all other embedded assets unchanged.\nGZ.js = '+JSON.stringify(gzipSync(guardedBrowser,{level:9}).toString('base64'))+';\n';
source+='\nAE_UAE_RELEASE_APP_JS += '+JSON.stringify(app)+';\nAE_UAE_RELEASE_CSS += '+JSON.stringify(await read('src/smart-estimates/style.css'))+';\n';
const mobileCore=await read('src/mobile-map/core.mjs');
const mobileApp='\nconst MMCore=(()=>{\n'+mobileCore.replace(/^export /gm,'')+'\nreturn {clamp,fractionAt,periodAt,pickProjects,viewportPadding};})();\n'+await read('src/mobile-map/app.js');
source+='\nAE_UAE_RELEASE_APP_JS += '+JSON.stringify(mobileApp)+';\nAE_UAE_RELEASE_CSS += '+JSON.stringify(await read('src/mobile-map/style.css'))+';\n';
const unifiedCore=await read('src/unified-map/core.mjs');
const unifiedApp='\nconst UMCore=(()=>{\n'+unifiedCore.replace(/^export /gm,'')+'\nreturn {periodEnd,sortNativePeriods,extendPriceScenario,timelineOptions,profitability};})();\n'+await read('src/mobile-map/search-focus.js')+'\n'+await read('src/unified-map/app.js');
source+='\nAE_UAE_RELEASE_APP_JS += '+JSON.stringify(unifiedApp)+';\nAE_UAE_RELEASE_CSS += '+JSON.stringify(await read('src/unified-map/style.css'))+';\n';
source+='\nAE_UAE_RELEASE_APP_JS += '+JSON.stringify(await read('src/minimal-map/app.js'))+';\nAE_UAE_RELEASE_CSS += '+JSON.stringify(await read('src/minimal-map/style.css'))+';\n';
const valueCore=await read('src/value-drivers/core.mjs');
const valueApp='\nconst VDCore=(()=>{\n'+valueCore.replace(/^export /gm,'')+'\nreturn {sensitivity,isPalmJebelAli,visibleDrivers,contextFeatures};})();\n'+await read('src/value-drivers/app.js');
source+='\nAE_UAE_RELEASE_APP_JS += '+JSON.stringify(valueApp)+';\nAE_UAE_RELEASE_CSS += '+JSON.stringify(await read('src/value-drivers/style.css'))+';\n';
const historicalCore=await read('src/historical-intelligence/core.mjs');
const historicalExports=[...historicalCore.matchAll(/^export (?:const|function|async function|class) (\w+)/gm)].map(m=>m[1]);
if(!historicalExports.length)throw Error('Historical intelligence module exposes no functions');
source+='\nvar HI_CORE=(()=>{\n'+historicalCore.replace(/^export /gm,'')+'\nreturn {'+historicalExports.join(',')+'};})();\n';
const historicalApp='\nwindow.EspaciosHistoricalCore=(()=>{\n'+historicalCore.replace(/^export /gm,'')+'\nreturn {annualScenarios,validateScenarioAssumptions};})();\n'+await read('src/historical-intelligence/app.js');
source+='\nAE_UAE_RELEASE_APP_JS += '+JSON.stringify(historicalApp)+';\nAE_UAE_RELEASE_CSS += '+JSON.stringify(await read('src/historical-intelligence/style.css'))+';\n';
const historicalData=await read('data/historical-intelligence/runtime-index.json');
const historicalIndex=JSON.parse(historicalData);
if(historicalIndex.manifest?.runtime?.classification!=='bounded_manifest_backed_runtime')throw Error('Bounded runtime index required; build historical data before bundling the Worker');
const canonicalHistorical=JSON.parse(await read('data/historical-intelligence-20261003.json'));
const historicalCommunities=new Map(canonicalHistorical.records.filter(r=>r.type==='community').map(r=>[r.id,r]));
const mapCorrections=canonicalHistorical.records.filter(r=>r.communityAssociationRevisions?.length).map(r=>{const revision=r.communityAssociationRevisions.at(-1),community=historicalCommunities.get(revision.toCommunityId);if(!community||revision.verification!=='verified'||!revision.primaryEvidence)throw Error('Unverified map community correction');return{recordId:r.id,emirate:r.emirate,communityId:community.id,area:community.name,revisionId:revision.id,sourceIds:revision.sourceIds,firstAvailableAt:revision.firstAvailableAt,reason:revision.reason};});
source+='\nvar HI_MAP_CORRECTIONS='+JSON.stringify(mapCorrections)+';\n';
if(historicalIndex.version!==canonicalHistorical.version||historicalIndex.asOf!==canonicalHistorical.asOf||historicalIndex.manifest.runtime.canonicalSnapshotSHA256!==createHash('sha256').update(await read('data/historical-intelligence-20261003.json')).digest('hex'))throw Error('Runtime index differs from canonical evidence snapshot');
source+='\nvar HI_DATA='+JSON.stringify({version:historicalIndex.version,asOf:historicalIndex.asOf})+';\nvar HI_PACKED='+JSON.stringify(gzipSync(historicalData,{level:9}).toString('base64'))+';\nvar HI_DATA_READY;\nasync function HI_GET_DATA(){if(!HI_DATA_READY)HI_DATA_READY=(async()=>{const b=atob(HI_PACKED),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);HI_DATA=await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream("gzip"))).json();return HI_DATA;})();return HI_DATA_READY;}\n';
source+='\nvar HI_ETAG='+JSON.stringify('"'+createHash('sha256').update(historicalData).digest('hex')+'"')+';\n';
const valueData=JSON.parse(await read('data/value-drivers-20261003.json'));
source+='\nvar VD_DATA='+JSON.stringify(valueData)+';\nvar VD_ETAG='+JSON.stringify('"'+createHash('sha256').update(JSON.stringify(valueData)).digest('hex')+'"')+';\n';
source+='\nvar SE_SOURCE_REVIEW='+JSON.stringify(JSON.parse(await read('data/source-review-20260930.json')))+';\n'+await read('src/smart-estimates/worker-extension.js')+'\nexport {worker_default as default};\n';
source=source.replace('\nexport {worker_default as default};\n','\n'+await read('src/value-drivers/worker-extension.js')+'\n'+await read('src/historical-intelligence/worker-extension.js')+'\n'+await read('src/mobile-map/worker-extension.js')+'\n'+await read('src/runtime-control/worker-extension.js')+'\n'+await read('src/tenant-guard/worker-extension.js')+'\nexport {worker_default as default};\n');
await fs.writeFile(new URL('src/worker.js',root),source);
const context=vm.createContext({console,Headers,Request,Response,URL,URLSearchParams,atob,btoa,TextEncoder,TextDecoder,DecompressionStream,CompressionStream,ReadableStream,Blob,crypto:globalThis.crypto,fetch});vm.runInContext(source.replace(/export \{\s*worker_default as default\s*\};/,''),context);
const browser=await(await vm.runInContext('aePatchedAppJs()',context)).text();new vm.Script(browser.replace(/^import .*;$/gm,''));
console.log(JSON.stringify({release,workerBytes:Buffer.byteLength(source),appBytes:Buffer.byteLength(browser),workerSha256:createHash('sha256').update(source).digest('hex')}));
