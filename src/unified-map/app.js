/* One timeline for native evidence and explicitly conditional future outcomes. */
(() => {
 window.__ESPACIOS_UNIFIED_RELEASE__='20260930-unified-map-v1';
 const Q=s=>document.querySelector(s),root=document.documentElement;
 const U={installed:false,metric:'projects',options:[],selected:'',horizon:10,path:'reference',data:null,loading:false,key:'',request:0,renderToken:0,refreshTimer:0,busy:false,contextKey:'',preferFuture:false,result:null,hidden:new Map()};
 const finite=n=>typeof n==='number'&&Number.isFinite(n),num=(n,d=0)=>finite(n)?n.toLocaleString('en',{maximumFractionDigits:d}):'—';
 const text=(el,value)=>{if(el&&el.textContent!==value)el.textContent=value;};
 const types=()=>msState.segment==='both'?['apartment','villa']:[msState.segment];
 const current=()=>U.options.find(o=>o.id===U.selected),future=()=>current()?.kind==='scenario';
 const context=()=>({kind:U.metric,emirate:msState.emirate,area:msState.area,segment:msState.segment,basis:U.metric==='roi'?'asking':msState.basis,registration:bhState.registration,path:U.path});
 const rowPool=()=>((U.data?.[context().basis==='sales'?'sales':'asking'])||[]).filter(r=>r.emirate===msState.emirate&&types().includes(r.segment)&&(context().basis!=='sales'||r.registration===bhState.registration));
 const selectedRows=()=>rowPool().filter(r=>r.geography===msState.area);
 const nativeClass=period=>tlState.series.some(s=>s.points?.some(p=>p.period===period&&p.projection))?'released_projection':U.metric==='roi'?'gross_yield_benchmark':context().basis==='sales'?'registered_sale':'advertised_price_benchmark';
 function refreshSoon(){if(!U.installed||U.busy)return;clearTimeout(U.refreshTimer);U.refreshTimer=setTimeout(refresh,30);}
 async function refresh(){
  if(U.metric==='projects'){U.options=[];U.loading=false;hide();sync();return;}
  const token=++U.request;U.loading=!!tlState.loading;U.contextKey=JSON.stringify(context());
  try{
   try{U.data=await window.EspaciosEstimateUI.load();U.estimatesError='';}
   catch(error){if(token!==U.request||U.metric==='projects')return;U.data=null;U.estimatesError='Future estimates are temporarily unavailable; source history is unchanged.';}
   if(token!==U.request||U.metric==='projects')return;
   if(tlState.loading){U.loading=true;window.EspaciosMobileUI.sync();return;}
   const sourcePeriods=new Set(tlState.series.flatMap(s=>(s.points||[]).map(p=>p.period)));
   const nativePeriods=(tlState.periods||[]).filter(p=>/^\d{4}/.test(p)&&sourcePeriods.has(p)).map(period=>({period,evidenceClass:nativeClass(period)}));
   // A selected area with no compatible estimate keeps its native evidence; a
   // neighbour's anchor is never used to manufacture an estimate for that area.
   const estimates=msState.area?selectedRows():rowPool();
   const previous=current();U.options=UMCore.timelineOptions({nativePeriods,estimates,path:U.path,horizonYears:U.horizon});
   U.key=JSON.stringify([U.contextKey,U.horizon,U.path,U.options.map(o=>o.id)]);
   const same=U.options.find(o=>o.id===U.selected);
   U.selected=(U.preferFuture?U.options.find(o=>o.kind==='scenario'):same)||U.options.find(o=>o.kind==='native'&&o.period===tlState.period)||U.options.at(-1);
   U.selected=U.selected?.id||'';U.preferFuture=false;U.loading=false;U.error='';
   if(previous?.kind==='scenario'&&!future())hide();
   if(current()?.kind==='native'&&current().period!==tlState.period)tlChooseDate(current().period);
   prepare();render();window.EspaciosMobileUI.sync();
  }catch(error){if(token!==U.request)return;U.loading=false;U.error=error.message;sync();}
 }
 function prepare(){
  U.pending=false;U.result=null;if(!future()||!U.data)return;
  const option=current(),record=option.records.find(r=>r.identity?.geography===msState.area)||option.records[0];
  U.result=window.EspaciosEstimateUI.prepare({...context(),year:record?.year||1,targetPeriod:option.period});
 }
 function choose(id){const option=U.options.find(o=>o.id===id);if(!option||U.loading)return;U.selected=id;U.error='';
  clearTimeout(U.renderTimer);if(option.kind==='native'){U.pending=false;U.result=null;hide();tlChooseDate(option.period);}else{tlStop();U.result=null;U.pending=true;U.renderTimer=setTimeout(render,120);}
  window.EspaciosMobileUI.sync();
 }
 function setMetric(metric){
  if(!['projects','price','roi'].includes(metric))return;U.request++;U.renderToken++;U.pending=false;U.result=null;U.options=[];U.selected='';U.metric=metric;U.error='';U.preferFuture=metric==='roi';hide();tlStop();window.EspaciosEstimateUI.close(false);
  U.busy=true;msState.open=false;
  if(metric==='projects')psrSetAnalysis('uae-project-coverage');
  else{if(metric==='roi')msState.basis='asking';msOpen(metric,false);}
  U.busy=false;refreshSoon();sync();
 }
 function setType(type){if(!['apartment','villa','townhouse','both'].includes(type))return;U.pending=false;U.result=null;U.busy=true;msSetSegment(type);msOpen(U.metric,false);U.busy=false;U.selected='';U.preferFuture=U.metric==='roi';refreshSoon();}
 function hide(){
  U.renderToken++;for(const id of ['um-fill','um-outline'])if(map.getLayer(id))map.setLayoutProperty(id,'visibility','none');
  for(const [id,value]of U.hidden)if(map.getLayer(id))map.setLayoutProperty(id,'visibility',value);U.hidden.clear();Q('#um-map-key')?.remove();delete root.dataset.unifiedFuture;
 }
 function geometry(row){const geos=(sgState.data?.features||[]).filter(g=>g.properties.level!=='emirate');
  if(row.evidenceClass==='registered_sale'&&row.geometryIds?.length){if(row.geometryIds.length!==1)return null;return geos.find(g=>String(g.id)===String(row.geometryIds[0]))||null;}
  const matches=geos.filter(g=>SG.key(g.properties.emirate,g.properties.name)===SG.key(row.emirate,row.geography));const rank=Math.min(...matches.map(g=>g.properties.rank||99)),best=matches.filter(g=>(g.properties.rank||99)===rank);return best.length===1?best[0]:null;
 }
 function cohort(){const ref=selectedRows().find(r=>r.estimate?.classification==='conditional_scenario');if(!ref||msState.segment==='both')return[];return rowPool().filter(r=>r.estimate?.classification==='conditional_scenario'&&r.evidenceClass===ref.evidenceClass&&r.estimate.baseline.period===ref.estimate.baseline.period&&r.estimate.baseline.unit===ref.estimate.baseline.unit).map(row=>({row,estimate:UMCore.extendPriceScenario(row.estimate,U.horizon)}));}
 function mapValue(entry,year){
  if(U.metric==='price')return entry.estimate.scenarios[U.path].annual[year-1]?.value;
  const calc=U.result?.calculation,own=entry.row.geography===msState.area,ret=calc?.returns.find(r=>r.segment===entry.row.segment);
  if(!calc?.inputs)return null;
  // An edited rent is local to the selected investment, not copied across UAE.
  const rent=own?ret?.yieldAssumptionPct:entry.row.grossYieldBenchmark?.value;if(!finite(rent))return null;
  const result=UMCore.profitability({...calc.inputs,horizonYears:year,annualRent:calc.inputs.price*rent/100,capitalPath:entry.estimate.scenarios[U.path].annual},SECore.calculateROI);
  return result.cumulativeReturnPct;
 }
 async function render(){
  if(!future()){if(U.metric==='projects')return;tlUpdate();sync();return;}
  clearTimeout(U.renderTimer);if(U.pending)prepare();
  const token=++U.renderToken,option=current();try{await sgLoad();if(token!==U.renderToken||!future()||current()!==option)return;
   const basket=cohort(),features=[],year=option.records[0]?.year||1;
   for(const item of basket){const shape=geometry(item.row),value=mapValue(item,year);if(shape&&finite(value))features.push({...shape,properties:{name:item.row.geography,value,period:option.period}});}
   const values=basket.flatMap(item=>Array.from({length:U.horizon},(_,i)=>mapValue(item,i+1))).filter(finite),domain=tlK.domain(values);
   for(const f of features)f.properties.color=tlK.color(f.properties.value,domain,false);
   for(const layer of map.getStyle().layers||[])if(/^(ms-|tl-history|dg-|bh-|psr-analysis|roi-|ae-emerging|ae-uae-|sg-|se-|ue-benchmark-)/.test(layer.id)){
    if(!U.hidden.has(layer.id))U.hidden.set(layer.id,map.getLayoutProperty(layer.id,'visibility')||'visible');map.setLayoutProperty(layer.id,'visibility','none');
   }
   sgSource('um-polygons',{type:'FeatureCollection',features});
   if(!map.getLayer('um-fill'))map.addLayer({id:'um-fill',type:'fill',source:'um-polygons',paint:{'fill-color':['get','color'],'fill-opacity':.56}});
   if(!map.getLayer('um-outline'))map.addLayer({id:'um-outline',type:'line',source:'um-polygons',paint:{'line-color':'#8da9b4','line-width':1}});
   for(const id of ['um-fill','um-outline'])map.setLayoutProperty(id,'visibility','visible');
   let key=Q('#um-map-key');if(!key){key=document.createElement('aside');key.id='um-map-key';Q('#app').append(key);}
   text(key,features.length?num(domain[0],U.metric==='roi'?1:0)+'–'+num(domain[1],U.metric==='roi'?1:0)+(U.metric==='roi'?'% net return':' AED/sqft')+' · '+features.length+' areas':'No comparable mapped estimate');
   key.title='Conditional '+U.path+' path. Fixed colour range across the selected horizon and same-anchor cohort. Unshaded is unknown, not zero. Each other area uses its own published starting gross yield; costs use your disclosed assumptions.';
   root.dataset.unifiedFuture='1';sync();
  }catch(error){if(token!==U.renderToken)return;U.error='Estimate shading unavailable; source evidence is retained.';sync();}
 }
 function readout(){
  if(U.metric==='projects')return[Q('#ae-density-count')?.textContent||'UAE project catalogue',cxCatalogue()?'All dates · future and undated records included':'Reported handovers · '+tlState.period+' · density, not price growth'];
  if(U.loading||tlState.loading||U.pending)return['Loading matching evidence…','Existing records remain stored.'];
  if(U.error)return[U.error,'History and original source records remain available.'];
  const area=msState.area||'Select an area',option=current();
  if(!future()){
   const rows=tlState.frame.filter(r=>r.name===msState.area&&r.period===option?.period&&finite(r.value));
   return[area+(rows.length?' · '+rows.map(r=>(msState.segment==='both'?(r.segment||'Combined')+' ':'')+num(r.value,U.metric==='roi'?2:0)+(U.metric==='roi'?'% gross yield':' AED/sqft')).join(' / '):' · No published value for this selection'),(U.metric==='roi'?'Historical gross rental yield · not realized profit':option?.evidenceClass==='released_projection'?'Released research projection · not a recorded sale':context().basis==='sales'?'Registered-sale median · '+msState.segment+' · '+bhState.registration:'Published asking benchmark · '+msState.segment)+(U.estimatesError?' · '+U.estimatesError:'')];
  }
  const calc=U.result?.calculation;
  if(U.result?.error)return[area+' · Enter investment assumptions',U.result.error];
  const returns=calc?.returns||[],combined=returns.find(r=>r.segment==='combined'),paths=calc?.paths.filter(p=>p.estimate)||[];
  const record=option?.records.find(r=>r.identity?.geography===area)||option?.records[0],year=record?.year||1;
  const typeName=t=>({apartment:'Apartments',villa:'Villas',townhouse:'Townhouses',combined:'Mixed portfolio'})[t]||t;
  let value=U.metric==='roi'?(combined?[combined]:returns).map(r=>(msState.segment==='both'?typeName(r.segment)+' ':'')+num(r.result.cumulativeReturnPct,1)+'% net return').join(' / '):paths.map(p=>(msState.segment==='both'?typeName(p.estimate.identity.segment)+' ':'')+num(p.estimate.scenarios[U.path].annual[year-1]?.value)+' AED/sqft').join(' / ');
  return[area+' · '+(value||'Compatible local estimate unavailable'),(U.metric==='roi'?'Cumulative after-cost scenario':'Conditional price estimate')+' · '+U.path+' · '+(record?.anchorPeriod||'source anchor')+' → '+option.period+(year>10?' · long-term assumptions':'')+(calc?.combinedUnavailable?' · mixed result withheld':'')];
 }
 function sync(){if(!U.installed)return;
  Q('#um-property').hidden=U.metric==='projects';Q('#mm-points').hidden=U.metric!=='projects';Q('#mm-play').hidden=true;
  Q('#mm-metrics').querySelectorAll('[data-mm-metric]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mmMetric===U.metric)));
  Q('#um-property').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.umType===msState.segment)));
  for(const option of Q('#ms-area').options)if(option.value)text(option,option.value);
  const option=current(),label=U.metric==='projects'?'Project density':future()?U.metric==='roi'?'Net return · estimate':'Conditional estimate':U.metric==='roi'?'Yield history · not profit':option?.evidenceClass==='released_projection'?'Research projection':'Recorded source period';
  text(Q('#um-evidence'),label);Q('#um-evidence').title=label;
  const [headline,note]=readout();text(Q('#um-value'),headline);text(Q('#um-note'),note);Q('#um-details').hidden=U.metric==='projects';text(Q('#um-details'),future()&&U.metric==='roi'?'Assumptions':'Details');
  Q('#mm-legend').hidden=U.metric==='projects'||future();Q('#um-horizon-label').hidden=U.metric==='projects';Q('#um-path-label').hidden=U.metric==='projects';
  if(U.metric!=='projects'&&U.options.length){const i=Math.max(0,U.options.findIndex(o=>o.id===U.selected)),slider=Q('#tl-slider');slider.max=String(U.options.length-1);slider.value=String(i);slider.disabled=U.loading||U.options.length<2;
   if(suState.pointer===null)Q('#dr-track').style.setProperty('--su-position',(100*i/Math.max(1,U.options.length-1))+'%');
   const marks=[...new Set([0,Math.floor((U.options.length-1)/2),U.options.length-1])];const labels=marks.map(at=>U.options[at].period);
   if([...Q('#dr-dates').children].map(x=>x.textContent).join('|')!==labels.join('|'))Q('#dr-dates').replaceChildren(...labels.map(label=>{const span=document.createElement('span');span.textContent=label;return span;}));
  }
  window.__ESPACIOS_UNIFIED_MAP__={metric:U.metric,period:option?.period||tlState.period,evidenceClass:option?.evidenceClass||'catalogue',horizonYears:U.horizon,area:msState.area,segment:msState.segment,nativeCount:U.options.filter(o=>o.kind==='native').length,futureCount:U.options.filter(o=>o.kind==='scenario').length,loading:U.loading};
 }
 function details(){if(future()){prepare();window.EspaciosEstimateUI.details();window.EspaciosMobileUI.activate(Q('#se-panel'));}else{msState.open=true;msInfo();window.EspaciosMobileUI.activate(Q('#ms-inspect'));}}
 function install(){if(!window.EspaciosMobileUI||!Q('#mm-date'))return false;
  U.installed=true;root.dataset.unifiedMap='1';U.metric=aeUaeCoverageActive()?'projects':msState.kind==='roi'?'roi':'price';
  const dock=Q('#tl-dock'),property=document.createElement('div');property.id='um-property';property.setAttribute('role','group');property.setAttribute('aria-label','Property type');
  for(const [type,label]of [['apartment','Apartments'],['villa','Villas'],['townhouse','Townhouses'],['both','Both · A + V']]){const b=document.createElement('button');b.type='button';b.dataset.umType=type;b.textContent=label;b.onclick=()=>setType(type);property.append(b);}Q('#mm-metrics').after(property);text(Q('[data-mm-metric="projects"]'),'Density');
  const actions=document.createElement('div');actions.id='um-actions';actions.append(Q('#mm-settings'),Q('#tl-minimize'));dock.querySelector('.tl-head').append(actions);
  const evidence=document.createElement('small');evidence.id='um-evidence';Q('#su-date').append(evidence);
  const output=document.createElement('div');output.id='um-readout';output.innerHTML='<div><strong id="um-value"></strong><small id="um-note"></small></div><button id="um-details" type="button">Details</button>';dock.append(output);Q('#um-details').onclick=details;
  const horizon=document.createElement('label');horizon.id='um-horizon-label';horizon.textContent='Future scenario horizon';horizon.insertAdjacentHTML('beforeend','<select id="um-horizon"><option value="10">10 years from source anchor</option><option value="20">20 years · long-term assumptions</option><option value="30">30 years · long-term assumptions</option></select><small>Native history is retained. Longer paths continue disclosed damping; they are not validated forecasts.</small>');Q('#su-settings').querySelector('.su-dialog-head').after(horizon);
  Q('#um-horizon').onchange=e=>{U.horizon=+e.target.value;refreshSoon();};
  const path=document.createElement('label');path.id='um-path-label';path.innerHTML='Future path<select id="um-path"><option value="lower">Lower</option><option value="reference">Reference</option><option value="higher">Higher</option></select>';horizon.after(path);Q('#um-path').value=U.path;Q('#um-path').onchange=e=>{U.path=e.target.value;refreshSoon();};
  root.dataset.umExplore='0';Q('#timeline-panel').classList.add('hidden');Q('[data-panel="timeline"]')?.setAttribute('aria-expanded','false');text(Q('#ae-system-access'),'System');
  Q('[data-panel="timeline"]')?.addEventListener('click',()=>{root.dataset.umExplore=root.dataset.umExplore==='1'?'0':'1';if(root.dataset.umExplore==='1')Q('#timeline-panel').classList.remove('hidden','ae-collapsed');});
  for(const id of ['tg-play','tg-scenario','se-open','mm-play'])if(Q('#'+id))Q('#'+id).hidden=true;
  const oldSync=msSync;msSync=function(){oldSync(...arguments);if(U.installed&&!U.busy&&U.metric!=='projects'&&(JSON.stringify(context())!==U.contextKey||!tlState.loading&&U.loading))refreshSoon();};
  const oldLoad=tlLoadHistory;tlLoadHistory=async function(){await oldLoad(...arguments);refreshSoon();};
  const oldRender=tlUpdate;tlUpdate=function(){const result=oldRender(...arguments);if(U.installed&&future())render();return result;};
  const oldTooltip=sgTooltip;sgTooltip=function(){if(future()){for(const id of ['tl-tooltip','sg-tooltip']){const el=Q('#'+id);if(el)el.hidden=true;}return;}return oldTooltip(...arguments);};
  const oldExport=tlExport;tlExport=function(){if(!future())return oldExport(...arguments);prepare();tgDownload('espacios-'+U.metric+'-estimate-'+current().period+'.json',{release:window.__ESPACIOS_UNIFIED_RELEASE__,classification:'conditional_scenario',selection:{...context(),period:current().period,horizonYears:U.horizon},...U.result,limitation:'Conditional anchor-relative assumptions, not observed values, probability intervals, valuation or guaranteed return.'});};
  Q('#tl-export').onclick=()=>tlExport();
  Q('#tl-reset').onclick=()=>{setMetric('projects');Q('#reset-view').click();};
  Q('#ms-area').onchange=e=>{msState.area=e.target.value;msState.open=false;window.EspaciosSearchFocus?.focusArea({name:msState.area,emirate:msState.emirate});refreshSoon();};
  Q('#ms-details').onclick=details;
  document.addEventListener('click',event=>{const button=event.target.closest?.('[data-ms-period],[data-pp-date]');if(!button||U.metric==='projects')return;const period=button.dataset.msPeriod||button.dataset.ppDate,option=U.options.find(o=>o.kind==='native'&&o.period===period);if(option){event.preventDefault();event.stopImmediatePropagation();choose(option.id);}},true);
  Q('#se-assumptions').addEventListener('input',()=>{if(future()){prepare();render();window.EspaciosMobileUI.sync();}});
  document.addEventListener('espacios:search-selection',event=>{if(U.metric==='projects')return;const d=event.detail;if(d.kind==='community'){msState.area=d.area||d.name;if(d.emirate)msState.emirate=d.emirate;if(msState.emirate!=='Dubai')msState.basis='asking';U.busy=true;msOpen(U.metric,false);U.busy=false;msState.area=d.area||d.name;}refreshSoon();});
  window.EspaciosUnifiedMap=Object.freeze({setMetric,choose,render,sync,timeline:()=>U.metric==='projects'?null:{periods:U.options.map(o=>o.id),labels:Object.fromEntries(U.options.map(o=>[o.id,o.period+(o.kind==='scenario'?' · Estimate':o.evidenceClass==='released_projection'?' · Projection':'')])),selected:U.selected,loading:U.loading,key:U.key,metric:U.metric},pick(event){if(!future())return false;if(event.originalEvent?.detail>1)return true;const hit=map.getLayer('um-fill')&&map.queryRenderedFeatures(event.point,{layers:['um-fill']})[0];if(hit)queueMicrotask(()=>{msState.area=hit.properties.name;prepare();details();refreshSoon();});return true;}});
  refreshSoon();window.EspaciosMobileUI.sync();return true;
 }
 const timer=setInterval(()=>{if(install())clearInterval(timer);},150);
})();
