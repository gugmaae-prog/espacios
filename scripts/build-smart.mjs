import fs from 'node:fs/promises';import vm from 'node:vm';import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {validateCatalogueRevisions} from './validate-catalogue-revisions.mjs';
import {normalizeDubaiStatusCsv} from '../src/stack-audit/dubai-project-status.mjs';
const root=new URL('../',import.meta.url),release='20260930-smart-estimates-v1',read=p=>fs.readFile(new URL(p,root),'utf8');
const baseline=await read('src/baseline/worker-20260930.js');if(createHash('sha256').update(baseline).digest('hex')!=='b9aab494d2297e7208f5257c069a54c2a6f9eb3762ff79224350ae4006357e06')throw Error('Acquired live baseline changed');
const core=await read('src/smart-estimates/core.mjs');const app='\nconst SECore=(()=>{\n'+core.replace(/^export /gm,'')+'\nreturn {derivePriceScenario,calculateROI,combineROI};})();\n'+await read('src/smart-estimates/app.js');
let source=baseline.replace(/export \{\s*worker_default as default\s*\};/,'').replace(/\/\/# sourceMappingURL=.*\n?/g,'').replaceAll('20260929-collapse-repair-v3',release);
const oldPremiumMapReady="if(connectedMap===map){paint();return}\n    connectedMap=map;\n    map.on?.('style.load',()=>paint());\n    map.on?.('load',()=>{paint();document.querySelector('.ae-map-recovery')?.remove()});\n    if(map.isStyleLoaded?.())paint();";
const readyPremiumMap="if(connectedMap===map){paint();return}\n    connectedMap=map;\n    const clearRecovery=()=>document.querySelector('.ae-map-recovery')?.remove();\n    map.on?.('style.load',()=>{paint();clearRecovery()});\n    map.on?.('load',()=>{paint();clearRecovery()});\n    if(map.isStyleLoaded?.())paint();\n    if(map.getCanvas?.()&&map.getStyle?.()?.layers?.length)clearRecovery();";
if(source.split(oldPremiumMapReady).length!==2)throw Error('Expected one premium map recovery handler');
source=source.replace(oldPremiumMapReady,readyPremiumMap);
const heatmapCatalogueLoad='catalogue = await arServerCatalogue(request, env);';
const heatmapCatalogueMatches=source.split(heatmapCatalogueLoad).length-1;
if(heatmapCatalogueMatches!==1)throw Error('Expected exactly one UAE heatmap catalogue loader; found '+heatmapCatalogueMatches);
source=source.replace(heatmapCatalogueLoad,'catalogue = env.AE_EMERGENCY_CATALOGUE || await arServerCatalogue(request, env);');
const heatmapCoreLoad='const response = await aeCoreMapData(request, env, ctx);';
const heatmapCoreMatches=source.split(heatmapCoreLoad).length-1;
if(heatmapCoreMatches!==1)throw Error('Expected exactly one UAE heatmap core loader; found '+heatmapCoreMatches);
source=source.replace(heatmapCoreLoad,'const response = await (env.AE_EMERGENCY_CATALOGUE ? aeCoreMapDataLegacy : aeCoreMapData)(request, env, ctx);');
const oldHeatmapCatch=".catch(e=>console.warn('UAE heatmap manifest',e));";
const oldHeatmapTimer="const aeUaeTimer=setInterval(()=>{aeUaeInstallUi();if(aeUaeState.installed&&aeUaeState.manifest&&aeUaeInstallLayers()){aeUaeState.initComplete=true;delete document.documentElement.dataset.aeMapLoading;clearInterval(aeUaeTimer);aeUaeCoverageEvidence();}},250);";
const oldHeatmapUiGate="if(aeUaeState.installed||!tlState?.ready||!drState?.installed||!bhState?.installed||!tlQ('#tl-dock'))return false;";
if(source.split(oldHeatmapCatch).length!==2||source.split(oldHeatmapTimer).length!==2||source.split(oldHeatmapUiGate).length!==2)throw Error('Expected exactly one UAE timeline readiness path');
source=source.replace(oldHeatmapCatch,".catch(e=>{aeUaeState.loadError=String(e?.message||e);console.warn('UAE heatmap manifest',e)});");
const oldHeatmapFetch="if(!r.ok)throw Error('UAE heatmap '+r.status);return r.json();";
const oldHeatmapNote="const note=tlQ('#analysis-note'),counts=aeUaeState.manifest?.counts||{},all=Number(counts.projects||1384),mapped=Number(counts.geocodedProjects||1339),unmapped=Number(counts.unmappedProjects||45);\n const text=all.toLocaleString()+' catalogue records across seven emirates · '+mapped.toLocaleString()+' mapped · '+unmapped.toLocaleString()+' awaiting coordinates. Colour shows catalogue density, not prices, demand or expected returns.';";
if(source.split(oldHeatmapFetch).length!==2||source.split(oldHeatmapNote).length!==2)throw Error('Expected one UAE coverage source and note');
source=source.replace(oldHeatmapFetch,"if(!r.ok)throw Error('UAE heatmap '+r.status);aeUaeState.degraded=r.headers.get('x-ae-data-degraded')==='r2-account-unavailable';return r.json();");
source=source.replace(oldHeatmapNote,"const note=tlQ('#analysis-note'),counts=aeUaeState.manifest?.counts||{},all=Number(counts.projects??0),quality=counts.coordinateQuality||{},source=Number(quality.projectOrSource??0),approximate=Number(quality.approximateCommunityCentre??0),unmapped=Number(quality.withoutCoordinates??0);\n const text=all.toLocaleString()+(aeUaeState.degraded?' reviewed snapshot':' catalogue')+' projects across seven emirates · '+source.toLocaleString()+' reported project/source locations · '+approximate.toLocaleString()+' approximate community locations · '+unmapped.toLocaleString()+' without coordinates'+(aeUaeState.degraded?' · live catalogue unavailable':'')+'. Colour shows catalogue density, not prices, demand or expected returns.';");
// Dubai history requires its R2 catalogue. The independently available UAE
// project timeline must still install while that unrelated source is offline.
source=source.replace(oldHeatmapUiGate,"if(aeUaeState.installed||!tlState?.ready||!drState?.installed||!tlQ('#tl-dock'))return false;");
const oldStyleLayerInstall="map.on('style.load',()=>setTimeout(()=>{aeUaeInstallLayers();aeUaeSetView(aeUaeState.view,false);},180));";
if(source.split(oldStyleLayerInstall).length!==2)throw Error('Expected one UAE style layer readiness handler');
source=source.replace(oldStyleLayerInstall,"map.on('style.load',()=>{aeUaeInstallLayers();aeUaeSetView(aeUaeState.view,false);});");
source=source.replace('Timeline is taking longer to load. Reload to retry.','Map timeline is still initializing. The catalogue remains available.');
source=source.replace(oldHeatmapTimer,`const aeUaeStartedAt=Date.now();
const aeUaeTimer=setInterval(()=>{
 try{aeUaeInstallUi();if(aeUaeState.installed&&aeUaeState.manifest&&aeUaeInstallLayers()){aeUaeState.initComplete=true;delete document.documentElement.dataset.aeMapLoading;clearInterval(aeUaeTimer);aeUaeCoverageEvidence();return;}}catch(e){aeUaeState.loadError=String(e?.message||e);}
 if(Date.now()-aeUaeStartedAt<20000)return;
 clearInterval(aeUaeTimer);delete document.documentElement.dataset.aeMapLoading;
 const notice=document.createElement('div');notice.id='ae-map-layer-error';notice.setAttribute('role','status');notice.append(document.createTextNode(aeUaeState.loadError?'Timeline layer could not finish loading. The catalogue remains available.':'Timeline data is unavailable. The catalogue remains available.'));
 const retry=document.createElement('button');retry.type='button';retry.textContent='Retry timeline';retry.addEventListener('click',()=>location.reload());notice.append(retry);document.body.append(notice);
},250);`);
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
const unsafeHistoryDiagnostic='bhState.manifest?.stats.sourceTransactionRows';
if(paletteBrowser.split(unsafeHistoryDiagnostic).length!==2)throw Error('Expected one history diagnostic stats access');
paletteBrowser=paletteBrowser.replace(unsafeHistoryDiagnostic,'bhState.manifest?.stats?.sourceTransactionRows');
const unsafeHistoryGeometry='sgState.data.features.map(f=>[String(f.id),f])';
if(paletteBrowser.split(unsafeHistoryGeometry).length!==2)throw Error('Expected one history geometry map access');
paletteBrowser=paletteBrowser.replace(unsafeHistoryGeometry,'(sgState.data?.features||[]).map(f=>[String(f.id),f])');
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
source+='\nvar AE_MAP_SEAMLESS_CSS='+JSON.stringify(await read('src/map-seamless/style.css'))+';\nAE_UAE_RELEASE_CSS += AE_MAP_SEAMLESS_CSS;\n';
const historicalData=await read('data/historical-intelligence/runtime-index.json');
const historicalIndex=JSON.parse(historicalData);
if(historicalIndex.manifest?.runtime?.classification!=='bounded_manifest_backed_runtime')throw Error('Bounded runtime index required; build historical data before bundling the Worker');
const canonicalHistorical=JSON.parse(await read('data/historical-intelligence-20261003.json'));
const historicalCommunities=new Map(canonicalHistorical.records.filter(r=>r.type==='community').map(r=>[r.id,r]));
const mapCorrections=canonicalHistorical.records.filter(r=>r.communityAssociationRevisions?.length).map(r=>{const revision=r.communityAssociationRevisions.at(-1),community=historicalCommunities.get(revision.toCommunityId);if(!community||revision.verification!=='verified'||!revision.primaryEvidence)throw Error('Unverified map community correction');return{recordId:r.id,emirate:r.emirate,communityId:community.id,area:community.name,revisionId:revision.id,sourceIds:revision.sourceIds,firstAvailableAt:revision.firstAvailableAt,reason:revision.reason};});
source+='\nvar HI_MAP_CORRECTIONS='+JSON.stringify(mapCorrections)+';\n';
const catalogueRevisions=JSON.parse(await read('data/map-catalogue-revisions.json'));
source+='\nvar HI_CATALOGUE_REVISIONS='+JSON.stringify(validateCatalogueRevisions(catalogueRevisions,canonicalHistorical))+';\n';
if(historicalIndex.version!==canonicalHistorical.version||historicalIndex.asOf!==canonicalHistorical.asOf||historicalIndex.manifest.runtime.canonicalSnapshotSHA256!==createHash('sha256').update(await read('data/historical-intelligence-20261003.json')).digest('hex'))throw Error('Runtime index differs from canonical evidence snapshot');
source+='\nvar HI_DATA='+JSON.stringify({version:historicalIndex.version,asOf:historicalIndex.asOf})+';\nvar HI_PACKED='+JSON.stringify(gzipSync(historicalData,{level:9}).toString('base64'))+';\nvar HI_DATA_READY;\nasync function HI_GET_DATA(){if(!HI_DATA_READY)HI_DATA_READY=(async()=>{const b=atob(HI_PACKED),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);HI_DATA=await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream("gzip"))).json();return HI_DATA;})();return HI_DATA_READY;}\n';
source+='\nvar HI_ETAG='+JSON.stringify('"'+createHash('sha256').update(historicalData).digest('hex')+'"')+';\n';
const valueData=JSON.parse(await read('data/value-drivers-20261003.json'));
source+='\nvar VD_DATA='+JSON.stringify(valueData)+';\nvar VD_ETAG='+JSON.stringify('"'+createHash('sha256').update(JSON.stringify(valueData)).digest('hex')+'"')+';\n';
// R2 is the primary map-data plane. Keep one reviewed, geocoded repository
// snapshot in the Worker bundle so the public map can still render when the
// account-level R2 product is unavailable. The response is visibly labelled as
// degraded and never writes back to storage.
const emergencyMapText=await read('enrichment/2026-09-22/data/map-data.json');
const emergencyMap=JSON.parse(emergencyMapText);
const emergencyLocated=(emergencyMap.projects||[]).filter(project=>Number.isFinite(project?.coordinates?.lat)&&Number.isFinite(project?.coordinates?.lng)).length;
if(emergencyMap.projects?.length!==1337||emergencyMap.communities?.length!==215||emergencyMap.initiatives?.length!==72||emergencyLocated!==1337)throw Error('Emergency map snapshot identity or geocoding coverage changed');
source+='\nvar AE_EMERGENCY_MAP_PACKED='+JSON.stringify(gzipSync(emergencyMapText,{level:9}).toString('base64'))+';\nvar AE_EMERGENCY_MAP_BYTES;\nvar AE_EMERGENCY_MAP_PENDING;\nasync function aeEmergencyMapBytes(){if(AE_EMERGENCY_MAP_BYTES)return AE_EMERGENCY_MAP_BYTES;if(!AE_EMERGENCY_MAP_PENDING)AE_EMERGENCY_MAP_PENDING=(async()=>{const packed=atob(AE_EMERGENCY_MAP_PACKED),bytes=new Uint8Array(packed.length);for(let i=0;i<packed.length;i++)bytes[i]=packed.charCodeAt(i);AE_EMERGENCY_MAP_BYTES=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());return AE_EMERGENCY_MAP_BYTES;})().finally(()=>{AE_EMERGENCY_MAP_PENDING=null;});return AE_EMERGENCY_MAP_PENDING;}\nasync function aeEmergencyMapResponse(request){const bytes=await aeEmergencyMapBytes();return new Response(request.method==="HEAD"?null:bytes.slice(),{status:200,headers:{"content-type":"application/json; charset=utf-8","cache-control":"public,max-age=60,s-maxage=300,stale-while-revalidate=3600","x-content-type-options":"nosniff","x-ae-data-source":"embedded-reviewed-emergency-snapshot","x-ae-data-degraded":"r2-account-unavailable","x-ae-emergency-projects":"1337","x-ae-emergency-communities":"215","x-ae-emergency-initiatives":"72"}});}\n';
source+='\nvar AE_EMERGENCY_MAP_OBJECT;\nasync function aeEmergencyMapObject(){if(!AE_EMERGENCY_MAP_OBJECT)AE_EMERGENCY_MAP_OBJECT=JSON.parse(new TextDecoder().decode(await aeEmergencyMapBytes()));return AE_EMERGENCY_MAP_OBJECT;}\nasync function aeEmergencyHeatmapResponse(request,env,ctx){const snapshot=await aeEmergencyMapObject(),fullKey="snapshots/current/map-data.json",bytes=await aeEmergencyMapBytes(),fakeR2={async head(key){return key===fullKey?{etag:"embedded-reviewed-emergency-snapshot"}:null;},async get(key){if(key!==fullKey)return null;return{body:bytes.slice(),customMetadata:{source_etag:"embedded-reviewed-emergency-snapshot"},async text(){return new TextDecoder().decode(bytes);}};},async put(){}};const emergencyCatalogue={projects:snapshot.projects,counts:{snapshotProjects:snapshot.projects.length,liveProjects:0},asOf:snapshot.meta?.exportedAt||snapshot.meta?.sourceGeneratedAt||null};const response=await aeUaeHeatmap(request,{...env,MARKET_R2:fakeR2,AE_EMERGENCY_CATALOGUE:emergencyCatalogue},ctx),headers=new Headers(response.headers);headers.set("x-ae-data-source","embedded-reviewed-emergency-snapshot");headers.set("x-ae-data-degraded","r2-account-unavailable");headers.delete("content-length");return new Response(request.method==="HEAD"?null:response.body,{status:response.status,headers});}\n';
source+='\nvar SE_SOURCE_REVIEW='+JSON.stringify(JSON.parse(await read('data/source-review-20260930.json')))+';\n'+await read('src/smart-estimates/worker-extension.js')+'\nexport {worker_default as default};\n';
source=source.replace('\nexport {worker_default as default};\n','\n'+await read('src/value-drivers/worker-extension.js')+'\n'+await read('src/historical-intelligence/worker-extension.js')+'\n'+await read('src/mobile-map/worker-extension.js')+'\n'+await read('src/runtime-control/worker-extension.js')+'\n'+await read('src/map-seamless/worker-extension.js')+'\n'+await read('src/tenant-guard/worker-extension.js')+'\nexport {worker_default as default};\n');
source+=`\nAE_UAE_RELEASE_APP_JS=AE_UAE_RELEASE_APP_JS.replace(\"d.version!=='20260927-area-evidence-v1'||d.rows?.length!==2652\",\"!['20260927-area-evidence-v1','20261102-area-evidence-recovery-v1'].includes(d.version)||!Array.isArray(d.rows)\");\n`;
source+='\nAE_UAE_RELEASE_APP_JS += '+JSON.stringify(`\nconst STACK_OLD_AREA_HTML=ueAvailableHtml;ueAvailableHtml=function(){const html=STACK_OLD_AREA_HTML();return (ueState.data?.recovery?'<p class="ue-note">Recovered native source-area availability. Only complete periods by 14 September 2026 with n≥20 qualify; sparse and partial periods remain retained. Additional early native cohorts remain available in <a href=\"/map/history\">History</a>. This is not complete lifetime coverage or a property valuation.</p>':'')+html;};\n`)+';\n';
source+=`\nAE_UAE_RELEASE_APP_JS=AE_UAE_RELEASE_APP_JS.replace("d.version!=='20260927-history-predictions-v1'", "d.version!=='20260927-history-predictions-v1'&&!(d.recoveryVersion==='20261102-retained-history-v1'&&d.sourceVersion==='20260927-history-predictions-v1')");\n`;
const stackModules=['ai.mjs','storage.mjs','catalogue.mjs','recovered-map.mjs','recovered-context.mjs','uae-evidence.mjs','ajman-register.mjs','ajman-registration.mjs','ajman-transactions.mjs','ajman-management.mjs','ajman-area-reference.mjs','ajman-land-sales.mjs','ajman-land-dispositions.mjs','ajman-unit-mortgages.mjs','ajman-rent-contracts.mjs','uae-coverage.mjs','scad-stock.mjs','abu-dhabi-urban-projects.mjs','dubai-project-status.mjs','coordinate-quality.mjs'];
const archiveManifest=JSON.parse(await read('data/recovery/static-archive-manifest.json'));
const nativeIndexManifest=JSON.parse(await read('data/recovery/v48-native-history-index.manifest.json'));delete nativeIndexManifest.localPath;
const inventoryManifest=JSON.parse(await read('data/recovery/full-item-inventory.manifest.json'));delete inventoryManifest.sourceShards;
let stackSource='\nvar MAP_STACK_SOURCE_COMMIT='+JSON.stringify(process.env.MAP_SOURCE_COMMIT||'local-candidate')+';\n';
const digest=value=>createHash('sha256').update(value).digest('hex');
const coverageReport=JSON.parse(await read('data/uae-evidence/coverage-validation.json'));
if(coverageReport.acceptedSnapshot?.projectRecords!==1645||coverageReport.emirates?.length!==7||coverageReport.emirates.reduce((sum,item)=>sum+item.publishedSources.length,0)!==15||coverageReport.allUaeProjectDenominator!==null||coverageReport.projectCompletenessPercent!==null)throw Error('UAE coverage inventory changed');
stackSource+='\nvar UAE_COVERAGE_REPORT='+JSON.stringify(coverageReport)+';\n';
stackSource+='\nvar UAE_AJMAN_REPORT='+JSON.stringify(JSON.parse(await read('data/uae-evidence/ajman/validation.json')))+';\n';
stackSource+='\nvar UAE_AJMAN_REGISTER_REPORT='+JSON.stringify(JSON.parse(await read('data/uae-evidence/ajman/projects-validation.json')))+';\n';
stackSource+='\nvar AJMAN_V48_CROSSWALK='+JSON.stringify(JSON.parse(await read('data/uae-evidence/ajman/reviewed-v48-crosswalk.json')))+';\n';
stackSource+='\nvar UAE_AJMAN_REGISTRATION_REPORT='+JSON.stringify(JSON.parse(await read('data/uae-evidence/ajman/registration-validation.json')))+';\n';
stackSource+='\nvar UAE_AJMAN_DISPOSITION_REPORT='+JSON.stringify(JSON.parse(await read('data/uae-evidence/ajman/transactions-validation.json')))+';\n';
const managementReport=JSON.parse(await read('data/uae-evidence/ajman/management-validation.json'));
const managementCompressed=await fs.readFile(new URL('data/uae-evidence/ajman/management-companies-20260609.json.gz',root));
const managementRaw=gunzipSync(managementCompressed);
if(managementCompressed.length!==managementReport.compressedBytes||digest(managementCompressed)!==managementReport.compressedSha256||managementRaw.length!==managementReport.rawBytes||digest(managementRaw)!==managementReport.rawSha256)throw Error('Ajman management embedded source changed');
stackSource+='\nvar UAE_AJMAN_MANAGEMENT_REPORT='+JSON.stringify(managementReport)+';\nvar UAE_AJMAN_MANAGEMENT_PACKED='+JSON.stringify(managementCompressed.toString('base64'))+';\n';
const areaReferenceReport=JSON.parse(await read('data/uae-evidence/ajman/area-reference-validation.json'));
const areaReferenceCompressed=await fs.readFile(new URL('data/uae-evidence/ajman/area-reference-20231003.json.gz',root));
const areaReferenceRaw=gunzipSync(areaReferenceCompressed);
if(areaReferenceCompressed.length!==areaReferenceReport.compressedBytes||digest(areaReferenceCompressed)!==areaReferenceReport.compressedSha256||areaReferenceRaw.length!==areaReferenceReport.rawBytes||digest(areaReferenceRaw)!==areaReferenceReport.rawSha256)throw Error('Ajman area-reference embedded source changed');
stackSource+='\nvar UAE_AJMAN_AREA_REFERENCE_REPORT='+JSON.stringify(areaReferenceReport)+';\nvar UAE_AJMAN_AREA_REFERENCE_PACKED='+JSON.stringify(areaReferenceCompressed.toString('base64'))+';\n';
const landSalesReport=JSON.parse(await read('data/uae-evidence/ajman/lands-sales-validation.json'));
const landSalesCompressed=await fs.readFile(new URL('data/uae-evidence/ajman/lands-sales-20260821.json.gz',root));
const landSalesRaw=gunzipSync(landSalesCompressed);
if(landSalesCompressed.length!==landSalesReport.compressedBytes||digest(landSalesCompressed)!==landSalesReport.compressedSha256||landSalesRaw.length!==landSalesReport.rawBytes||digest(landSalesRaw)!==landSalesReport.rawSha256||landSalesReport.independentReadbackSha256!==landSalesReport.rawSha256||landSalesReport.quality?.rows!==1554)throw Error('Ajman land-sales embedded source changed');
stackSource+='\nvar UAE_AJMAN_LAND_SALES_REPORT='+JSON.stringify(landSalesReport)+';\nvar UAE_AJMAN_LAND_SALES_PACKED='+JSON.stringify(landSalesCompressed.toString('base64'))+';\n';
const landDispositionsReport=JSON.parse(await read('data/uae-evidence/ajman/lands-transactions-validation.json'));
const landDispositionsCompressed=await fs.readFile(new URL('data/uae-evidence/ajman/lands-transactions-20260821.json.gz',root));
const landDispositionsRaw=gunzipSync(landDispositionsCompressed);
if(landDispositionsCompressed.length!==landDispositionsReport.compressedBytes||digest(landDispositionsCompressed)!==landDispositionsReport.compressedSha256||landDispositionsRaw.length!==landDispositionsReport.rawBytes||digest(landDispositionsRaw)!==landDispositionsReport.rawSha256||landDispositionsReport.independentReadbackSha256!==landDispositionsReport.rawSha256||landDispositionsReport.quality?.rows!==1646)throw Error('Ajman land-disposition embedded source changed');
stackSource+='\nvar UAE_AJMAN_LAND_DISPOSITIONS_REPORT='+JSON.stringify(landDispositionsReport)+';\nvar UAE_AJMAN_LAND_DISPOSITIONS_PACKED='+JSON.stringify(landDispositionsCompressed.toString('base64'))+';\n';
const unitMortgageReport=JSON.parse(await read('data/uae-evidence/ajman/real-estate-units-mortgage-validation.json'));
const unitMortgageCompressed=await fs.readFile(new URL('data/uae-evidence/ajman/real-estate-units-mortgage-20260821.json.gz',root));
const unitMortgageRaw=gunzipSync(unitMortgageCompressed);
if(unitMortgageCompressed.length!==unitMortgageReport.compressedBytes||digest(unitMortgageCompressed)!==unitMortgageReport.compressedSha256||unitMortgageRaw.length!==unitMortgageReport.rawBytes||digest(unitMortgageRaw)!==unitMortgageReport.rawSha256||unitMortgageReport.independentReadbackSha256!==unitMortgageReport.rawSha256||unitMortgageReport.quality?.rows!==651)throw Error('Ajman unit-mortgage embedded source changed');
stackSource+='\nvar UAE_AJMAN_UNIT_MORTGAGES_REPORT='+JSON.stringify(unitMortgageReport)+';\nvar UAE_AJMAN_UNIT_MORTGAGES_PACKED='+JSON.stringify(unitMortgageCompressed.toString('base64'))+';\n';
const rentReport=JSON.parse(await read('data/uae-evidence/ajman/certified-rent-validation.json'));
const rentPacked=[];
for(const rentSource of rentReport.sources){
 const compressed=await fs.readFile(new URL(`data/uae-evidence/ajman/certified-rent-${rentSource.city}.json.gz`,root)),raw=gunzipSync(compressed);
 if(compressed.length!==rentSource.compressedBytes||digest(compressed)!==rentSource.compressedSha256||raw.length!==rentSource.rawBytes||digest(raw)!==rentSource.rawSha256||rentSource.independentReadbackSha256!==rentSource.rawSha256)throw Error(`Ajman ${rentSource.city} rent-contract source changed`);
 rentPacked.push(compressed.toString('base64'));
}
if(rentReport.sources.length!==3||rentReport.sources.reduce((sum,source)=>sum+source.quality.rows,0)!==2756)throw Error('Ajman rent-contract source inventory changed');
stackSource+='\nvar UAE_AJMAN_RENT_REPORT='+JSON.stringify(rentReport)+';\nvar UAE_AJMAN_RENT_PACKED='+JSON.stringify(rentPacked)+';\n';
const urbanReport=JSON.parse(await read('data/uae-evidence/abu-dhabi/sdi-urban-projects-validation.json'));
const urbanCompressed=await fs.readFile(new URL('data/uae-evidence/abu-dhabi/sdi-urban-projects-20261102.json.gz',root));
const urbanRaw=gunzipSync(urbanCompressed),urbanSource=JSON.parse(urbanRaw);
if(urbanCompressed.length!==urbanReport.compressedBytes||digest(urbanCompressed)!==urbanReport.compressedSha256||urbanRaw.length!==urbanReport.rawBytes||digest(urbanRaw)!==urbanReport.rawSha256||urbanReport.independentReadbackSha256!==urbanReport.rawSha256||urbanSource.features?.length!==374||urbanReport.distinctSourceProjectIds!==372||urbanReport.geometryCaptured!==false)throw Error('Abu Dhabi urban-project source changed');
stackSource+='\nvar UAE_ABU_DHABI_URBAN_REPORT='+JSON.stringify(urbanReport)+';\nvar UAE_ABU_DHABI_URBAN_PACKED='+JSON.stringify(urbanCompressed.toString('base64'))+';\n';
const dubaiStatusReport=JSON.parse(await read('data/uae-evidence/dubai/dld-project-status-validation.json'));
const dubaiStatusCrosswalk=JSON.parse(await read('data/uae-evidence/dubai/reviewed-v48-crosswalk.json'));
const dubaiStatusCompressed=await fs.readFile(new URL('data/uae-evidence/dubai/dld-project-status-20261101.csv.gz',root));
const dubaiStatusRaw=gunzipSync(dubaiStatusCompressed);
if(dubaiStatusCompressed.length!==dubaiStatusReport.compressedBytes||digest(dubaiStatusCompressed)!==dubaiStatusReport.compressedSha256||dubaiStatusRaw.length!==dubaiStatusReport.rawBytes||digest(dubaiStatusRaw)!==dubaiStatusReport.rawSha256||dubaiStatusReport.independentReadbackSha256!==dubaiStatusReport.rawSha256)throw Error('Dubai project-status captured CSV changed');
if(dubaiStatusCrosswalk.sourceRawSha256!==dubaiStatusReport.rawSha256||dubaiStatusCrosswalk.sourceDatasetId!==dubaiStatusReport.sourceId||dubaiStatusCrosswalk.sourceSnapshotDate!==dubaiStatusReport.sourcePublicationDate||dubaiStatusCrosswalk.version!=='20261103-dubai-v48-reviewed-crosswalk-v4'||dubaiStatusCrosswalk.matches.length!==67||new Set(dubaiStatusCrosswalk.matches.map(match=>match.sourceProjectNumber)).size!==67||new Set(dubaiStatusCrosswalk.matches.map(match=>match.canonicalProjectId)).size!==67)throw Error('Dubai reviewed crosswalk changed');
const dubaiStatusRows=normalizeDubaiStatusCsv(new TextDecoder('utf-8',{fatal:true}).decode(dubaiStatusRaw),dubaiStatusReport);
const dubaiStatusNormalized=Buffer.from(JSON.stringify(dubaiStatusRows));
const dubaiStatusNormalizedCompressed=await fs.readFile(new URL('data/uae-evidence/dubai/dld-project-status-20261101.normalized.json.gz',root));
if(dubaiStatusNormalized.length!==dubaiStatusReport.normalizedBytes||digest(dubaiStatusNormalized)!==dubaiStatusReport.normalizedSha256||dubaiStatusNormalizedCompressed.length!==dubaiStatusReport.normalizedCompressedBytes||digest(dubaiStatusNormalizedCompressed)!==dubaiStatusReport.normalizedCompressedSha256||!gunzipSync(dubaiStatusNormalizedCompressed).equals(dubaiStatusNormalized))throw Error('Dubai project-status normalization changed');
stackSource+='\nvar UAE_DUBAI_STATUS_REPORT='+JSON.stringify(dubaiStatusReport)+';\nvar UAE_DUBAI_STATUS_PACKED='+JSON.stringify(dubaiStatusNormalizedCompressed.toString('base64'))+';\nvar UAE_DUBAI_STATUS_CROSSWALK='+JSON.stringify(dubaiStatusCrosswalk)+';\n';
const psrLegacyManifest=JSON.parse(await read('data/recovery/psr-public-legacy-20261102.manifest.json'));
const psrLegacyCompressed=await fs.readFile(new URL('data/recovery/psr-public-legacy-20261102.json.gz',root));
const psrLegacyRaw=gunzipSync(psrLegacyCompressed),psrLegacy=JSON.parse(psrLegacyRaw);
if(psrLegacyCompressed.length!==psrLegacyManifest.compressedBytes||digest(psrLegacyCompressed)!==psrLegacyManifest.compressedSha256||psrLegacyRaw.length!==psrLegacyManifest.rawBytes||digest(psrLegacyRaw)!==psrLegacyManifest.rawSha256||psrLegacy.projects?.length!==psrLegacyManifest.uniqueProjectSlugs||new Set(psrLegacy.projects.map(project=>project.slug)).size!==psrLegacyManifest.uniqueProjectSlugs||psrLegacy.registry?.total!==psrLegacyManifest.registryReportedTotal)throw Error('PSR legacy recovery snapshot changed');
stackSource+='\nvar MAP_PSR_LEGACY_SNAPSHOT='+JSON.stringify({...psrLegacyManifest,base64:psrLegacyCompressed.toString('base64')})+';\n';
const psrD1Manifest=JSON.parse(await read('data/recovery/psr-public-d1-export-20261102.manifest.json'));
const psrD1Compressed=await fs.readFile(new URL('data/recovery/psr-public-d1-export-20261102.json.gz',root));
const psrD1Raw=gunzipSync(psrD1Compressed),psrD1=JSON.parse(psrD1Raw);
if(psrD1Compressed.length!==psrD1Manifest.compressedBytes||digest(psrD1Compressed)!==psrD1Manifest.compressedSha256||psrD1Raw.length!==psrD1Manifest.rawBytes||digest(psrD1Raw)!==psrD1Manifest.rawSha256||psrD1.projects?.length!==psrD1Manifest.rows||new Set(psrD1.projects.map(project=>project.slug)).size!==psrD1Manifest.uniqueSlugs||psrD1.registry?.total!==psrD1Manifest.registry.total)throw Error('PSR D1 export recovery snapshot changed');
stackSource+='\nvar MAP_PSR_D1_EXPORT_SNAPSHOT='+JSON.stringify({...psrD1Manifest,base64:psrD1Compressed.toString('base64')})+';\n';
stackSource+='\nvar MAP_ARCHIVE_MANIFEST='+JSON.stringify(archiveManifest)+';\nvar MAP_NATIVE_INDEX_MANIFEST='+JSON.stringify(nativeIndexManifest)+';\n';
stackSource+='\nvar MAP_FULL_INVENTORY_MANIFEST='+JSON.stringify(inventoryManifest)+';\n';
for(const file of stackModules)stackSource+='\n'+(await read('src/stack-audit/'+file)).replace(/^export /gm,'')+'\n';
stackSource+='\n'+(await read('src/map-recovery/legacy-history-compat.mjs')).replace(/^export /gm,'')+'\n';
stackSource+='\n'+await read('src/stack-audit/worker-extension.js')+'\n';
stackSource+='\n'+await read('src/stack-audit/idrive-cutover.js')+'\n';
source=source.replace('\nexport {worker_default as default};\n',()=>stackSource+'\nexport {worker_default as default};\n');
await fs.writeFile(new URL('src/worker.js',root),source);
const context=vm.createContext({console,Headers,Request,Response,URL,URLSearchParams,atob,btoa,TextEncoder,TextDecoder,DecompressionStream,CompressionStream,ReadableStream,Blob,crypto:globalThis.crypto,fetch});vm.runInContext(source.replace(/export \{\s*worker_default as default\s*\};/,''),context);
const browser=await(await vm.runInContext('aePatchedAppJs()',context)).text();new vm.Script(browser.replace(/^import .*;$/gm,''));
console.log(JSON.stringify({release,workerBytes:Buffer.byteLength(source),appBytes:Buffer.byteLength(browser),workerSha256:createHash('sha256').update(source).digest('hex')}));
