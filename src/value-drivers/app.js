/* One evidence drawer for official catalysts, Palm Jebel Ali and published outlooks. */
(() => {
 const Q=s=>document.querySelector(s),V={data:null,promise:null,tab:'government',emirate:'all',status:'all',markers:true,communities:[],rates:[-5,0,5],focus:null};
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=v=>Number.isFinite(v)?v.toLocaleString('en',{maximumFractionDigits:1}):'—';
 function links(ids){return ids.map(id=>V.data.sources.find(s=>s.id===id)).filter(Boolean).map(s=>'<a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+esc(s.publisher)+' · '+esc(s.published)+'</a>').join('');}
 async function load(){
  if(V.data)return V.data;if(V.promise)return V.promise;
  V.promise=fetch('/map/api/value-drivers',{signal:AbortSignal.timeout(12000)}).then(r=>{if(!r.ok)throw Error('Research unavailable');return r.json();}).then(d=>{
   if(d.version!=='20261005-value-drivers-v2'||!Array.isArray(d.drivers))throw Error('Research version mismatch');V.data=d;return d;
  }).finally(()=>{V.promise=null;});return V.promise;
 }
 function close(){Q('#vd-panel').classList.add('hidden');Q('[data-value="government"]')?.setAttribute('aria-expanded','false');Q('#vd-launch')?.focus({preventScroll:true});}
 async function open(tab='government'){
  V.tab=tab;const panel=Q('#vd-panel');panel.classList.remove('hidden');window.EspaciosMobileUI?.activate(panel);
  Q('[data-value="government"]')?.setAttribute('aria-expanded','true');Q('#vd-body').textContent='Loading sourced research…';
  try{await load();render();if(!V.communities.length){try{const r=await fetch('/map/map-core.json',{signal:AbortSignal.timeout(12000)});if(r.ok)V.communities=(await r.json()).communities||[];}catch{Q('#vd-location-status').textContent='Community locations unavailable; sourced research remains readable.';}}renderMarkers();}
  catch{Q('#vd-body').innerHTML='<p>Research is temporarily unavailable. Existing map history remains available.</p><button type="button" id="vd-retry">Retry research</button>';Q('#vd-retry').onclick=()=>open(V.tab);}
 }
 function driverCard(d){return '<article class="vd-card" id="vd-card-'+esc(d.id)+'"><small>'+esc(d.ownership)+' · '+esc(d.emirates.join(', '))+'</small><h3>'+esc(d.name)+'</h3><strong>'+esc(d.status)+'</strong><p>'+esc(d.timing)+'</p><p>'+esc(d.mechanism)+'</p>'+(d.areas.length?'<p class="vd-note">Context areas: '+d.areas.map(name=>{const a=V.data.catalogue.areas.find(a=>a.area===name&&d.emirates.includes(a.emirate));return esc(name)+(a?' · '+a.active+' active catalogue records':' · exact catalogue label not matched');}).join('; ')+'</p>':'<p class="vd-note">Regional programme: no local community catchment verified.</p>')+'<details><summary>Risks, location & sources</summary><p>'+esc(d.risk)+'</p><p>'+esc(d.geometryBasis)+'</p><div class="vd-sources">'+links(d.sourceIds)+'</div></details>'+(d.areas.length?'<button type="button" data-vd-area="'+esc(d.areas[0])+'" data-vd-emirate="'+esc(d.emirates[0])+'">Explore '+esc(d.areas[0])+' area</button>':'')+'</article>';}
 function render(){
  Q('#vd-tabs').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===V.tab)));
  const body=Q('#vd-body');
  if(V.tab==='government'){
   const rows=VDCore.visibleDrivers(V.data,V.emirate,V.status);
   body.innerHTML='<button type="button" id="vd-palm-thesis">Palm Jebel Ali · investment outlook</button><p class="vd-note">'+rows.length+' reviewed catalysts · checked '+esc(V.data.asOf)+'. Potential value drivers; no automatic price uplift.</p><div class="vd-filters"><label>Emirate<select id="vd-emirate"><option value="all">All emirates</option>'+V.data.coverage.map(c=>'<option>'+esc(c.emirate)+'</option>').join('')+'</select></label><label>Status<select id="vd-status"><option value="all">All stages</option>'+[...new Set(V.data.drivers.map(d=>d.status))].map(s=>'<option>'+esc(s)+'</option>').join('')+'</select></label></div><label class="vd-map-switch"><input type="checkbox" id="vd-markers" '+(V.markers?'checked':'')+'> Show community context markers</label><p id="vd-marker-note" class="vd-note"></p><div id="vd-cards">'+(rows.length?rows.map(driverCard).join(''):'<p>No reviewed catalyst matches these filters. The original initiative catalogue is retained.</p>')+'</div>';
   Q('#vd-palm-thesis').onclick=()=>{V.tab='palm';render();};
   for(const [id,key]of [['vd-emirate','emirate'],['vd-status','status']]){Q('#'+id).value=V[key];Q('#'+id).onchange=e=>{V[key]=e.target.value;render();renderMarkers();};}
   Q('#vd-markers').onchange=e=>{V.markers=e.target.checked;renderMarkers();};
  }else if(V.tab==='areas'){
   const c=V.data.catalogue;
   body.innerHTML='<h3>Areas & community project counts</h3><p><strong>'+c.propertyRecords.toLocaleString()+' property records</strong> · '+c.activeRecords.toLocaleString()+' active · '+c.archivedRecords+' archived.</p><p>'+c.communityRecords+' community records; '+c.communitiesWithIndexedProjects+' have an indexed project count above zero.</p><p class="vd-note">Snapshot '+esc(c.asOf)+'. '+esc(c.limitation)+'</p><label>Find an area or emirate<input id="vd-area-search" type="search" placeholder="Palm Jebel Ali, Dubai South…"></label><div id="vd-area-counts"></div>';
   const update=()=>{const term=Q('#vd-area-search').value.trim().toLowerCase(),rows=c.areas.filter(a=>(a.area+' '+a.emirate).toLowerCase().includes(term));Q('#vd-area-counts').innerHTML='<table><caption>'+rows.length+' raw area labels</caption><thead><tr><th>Area / emirate</th><th>Active</th><th>All</th></tr></thead><tbody>'+rows.map(a=>'<tr><td>'+esc(a.area)+'<small>'+esc(a.emirate)+'</small></td><td>'+a.active+'</td><td>'+a.records+'</td></tr>').join('')+'</tbody></table>';};Q('#vd-area-search').oninput=update;update();
  }else if(V.tab==='palm'){
   const p=V.data.palmJebelAli,h=p.localPriceEvidence;
   body.innerHTML='<h3>Palm Jebel Ali</h3><p class="vd-thesis">'+esc(p.assessment)+'</p><p class="vd-note">6 indexed project records · 5 active records under the exact Palm Jebel Ali area label; one archived phase uses a compound Dubai label.</p><button type="button" data-vd-area="Palm Jebel Ali" data-vd-emirate="Dubai">Explore Palm Jebel Ali</button><p>'+esc(p.nearTerm)+'</p><p>'+esc(p.longTerm)+'</p><h4>Why the thesis has support</h4><ul>'+p.upside.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul><p>Knight Frank reports <strong>40 sales above US$10m in H1 2026</strong>. This is demand evidence, not an appreciation rate.</p><h4>What could weaken it</h4><ul>'+p.risks.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul><details><summary>Existing local price evidence · sparse latest quarter</summary><p>'+esc(h.limitation)+'</p><table><caption>Derived source cohort: apartments · Off-Plan</caption><thead><tr><th>Period</th><th>Sales</th><th>AED/sqft median</th></tr></thead><tbody>'+h.points.map(r=>'<tr><td>'+esc(r.period)+'</td><td>'+r.eligibleSales+'</td><td>'+(r.displayEligible?fmt(r.median):'Withheld · n &lt; '+h.minimumSample)+'</td></tr>').join('')+'</tbody></table><p>No released Palm Jebel Ali local price forecast. Missing forecast does not imply low potential.</p></details><h4>Delivery & regional catalysts</h4>'+p.driverIds.map(id=>driverCard(V.data.drivers.find(d=>d.id===id))).join('')+'<div class="vd-sources">'+links(p.sourceIds)+'</div><button type="button" id="vd-see-outlook">Compare forecasts & scenarios</button>';
   Q('#vd-see-outlook').onclick=()=>{V.tab='outlook';render();};
  }else{
   const f=V.data.publishedOutlooks[0],later=V.data.publishedOutlooks[1];
   body.innerHTML='<h3>Published forecasts & scenarios</h3><article class="vd-card"><small>Third-party forecast · '+esc(f.period)+' · '+esc(f.geography)+'</small><p>Knight Frank’s February outlook: <strong>prime +3%; mainstream +1%</strong> for 2026.</p><p>'+esc(f.status)+'. '+esc(f.limitation)+'</p><div class="vd-sources">'+links([f.sourceId])+'</div><h4>Later July commentary</h4><p>'+esc(later.summary)+'</p><div class="vd-sources">'+links([later.sourceId])+'</div></article><h4>Palm Jebel Ali sensitivity</h4><p>Start at index 100 today. Edit annual capital growth below to compare 5- and 10-year outcomes.</p><p class="vd-note">Illustrative assumptions, not a Palm Jebel Ali forecast or confidence interval. No rent, financing, fees or inflation included.</p><div id="vd-rates">'+V.rates.map((r,i)=>'<label>'+['Downside input','Flat input','Upside input'][i]+'<input type="number" min="-99" max="100" step="0.5" value="'+r+'" data-vd-rate="'+i+'">% / year</label>').join('')+'</div><div id="vd-sensitivity" aria-live="polite"></div><p>Government-project benefits are qualitative evidence; they never add an arbitrary percentage to these inputs or the map’s existing scenarios.</p><button id="vd-history" type="button">Open map price history & scenario settings</button>';
   Q('#vd-rates').oninput=e=>{const i=e.target.dataset.vdRate;if(i===undefined)return;V.rates[+i]=e.target.value===''?NaN:Number(e.target.value);renderSensitivity();};
   Q('#vd-history').onclick=()=>{close();window.EspaciosUnifiedMap?.setMetric('price');Q('#mm-settings')?.click();};renderSensitivity();
  }
  body.querySelectorAll('[data-vd-area]').forEach(b=>b.onclick=()=>{const c=V.communities.find(c=>c.name===b.dataset.vdArea&&c.emirate===b.dataset.vdEmirate);if(c){window.EspaciosSearchFocus?.focusRecord(c);}else{Q('#vd-location-status').textContent='No exact catalogue location for this area. Evidence remains available in the list.';}});
  if(V.focus){Q('#vd-card-'+V.focus)?.scrollIntoView({block:'nearest'});V.focus=null;}
 }
 function renderSensitivity(){
  Q('#vd-sensitivity').innerHTML='<table><caption>Capital-value index · 100 today</caption><thead><tr><th>Annual input</th><th>5 years</th><th>10 years</th></tr></thead><tbody>'+V.rates.map(r=>'<tr><td>'+fmt(r)+'%</td>'+[5,10].map(y=>{const v=VDCore.sensitivity(r,y);return '<td>'+(v?fmt(v.index)+'<small>'+((v.capitalChangePct>=0)?'+':'')+fmt(v.capitalChangePct)+'%</small>':'Enter −99 to 100%')+'</td>';}).join('')+'</tr>').join('')+'</tbody></table>';
 }
 function renderMarkers(){
  if(!V.data||!map.isStyleLoaded())return;
  const rows=VDCore.visibleDrivers(V.data,V.emirate,V.status),fc=VDCore.contextFeatures(rows,V.communities);
  if(map.getSource('vd-context'))map.getSource('vd-context').setData(fc);else map.addSource('vd-context',{type:'geojson',data:fc});
  if(!map.getLayer('vd-context-points'))map.addLayer({id:'vd-context-points',type:'circle',source:'vd-context',paint:{'circle-radius':8,'circle-color':'#a481dc','circle-stroke-color':'#fff','circle-stroke-width':2}});
  map.setLayoutProperty('vd-context-points','visibility',V.markers?'visible':'none');
  const note=Q('#vd-marker-note');if(note)note.textContent=fc.features.length+' of '+rows.length+' catalysts have a named-community context marker. Pins are not surveyed project sites; all '+rows.length+' remain in this list.';
 }
 function evidence(){
  const u=window.__ESPACIOS_UNIFIED_MAP__,el=Q('#vd-evidence-label');if(!u||!el)return;
  const label=(u.evidenceClass==='conditional_scenario'?'Conditional scenario · assumptions':u.evidenceClass==='registered_sale'?'Registered-sale research':u.evidenceClass==='released_projection'?'Research projection':u.evidenceClass==='gross_yield_benchmark'?'Gross yield benchmark':u.evidenceClass==='advertised_price_benchmark'?'Asking-price benchmark':'Project catalogue')+(u.area?' · '+u.area:'');
  if(el.textContent!==label)el.textContent=label;
 }
 function install(){
  if(!Q('#minimal-kind-controls')||!window.EspaciosUnifiedMap)return false;
  const launch=document.createElement('button');launch.id='vd-launch';launch.type='button';launch.dataset.value='government';launch.textContent='Government projects';launch.setAttribute('aria-expanded','false');launch.onclick=()=>open('government');Q('#minimal-kind-controls').append(launch);
  const palm=document.createElement('button');palm.id='vd-palm-launch';palm.type='button';palm.textContent='Palm Jebel Ali outlook';palm.onclick=()=>open('palm');Q('#minimal-kind-controls').append(palm);
  const panel=document.createElement('aside');panel.id='vd-panel';panel.className='vd-drawer hidden';panel.setAttribute('aria-label','Government projects and property outlook');panel.innerHTML='<header><h2>Value drivers & outlook</h2><button type="button" id="vd-close" aria-label="Close value drivers">×</button></header><div id="vd-tabs" role="group" aria-label="Research view"><button type="button" data-tab="government">Government</button><button type="button" data-tab="palm">Palm Jebel Ali</button><button type="button" data-tab="areas">Areas & counts</button><button type="button" data-tab="outlook">Forecasts / scenarios</button></div><p id="vd-location-status" role="status"></p><div id="vd-body"></div>';Q('#app').append(panel);Q('#vd-close').onclick=close;Q('#vd-tabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{if(!V.data)return;V.tab=b.dataset.tab;render();});
  const evidenceRow=document.createElement('div');evidenceRow.id='vd-evidence';evidenceRow.innerHTML='<span id="vd-evidence-label"></span><button type="button" id="vd-evidence-details">Details</button>';Q('#minimal-metrics').after(evidenceRow);Q('#vd-evidence-details').onclick=()=>Q('#um-details')?.click();setInterval(evidence,500);evidence();
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.classList.contains('hidden'))close();});
  document.addEventListener('espacios:search-selection',e=>{if(VDCore.isPalmJebelAli(e.detail))palm.textContent='Palm Jebel Ali · view outlook';});
  map.on('style.load',renderMarkers);
  map.getCanvasContainer().addEventListener('click',e=>{if(e.target!==map.getCanvas()||e.detail>1||!V.markers||!map.getLayer('vd-context-points')||map.getLayoutProperty('vd-context-points','visibility')==='none')return;const r=map.getCanvas().getBoundingClientRect(),hit=map.queryRenderedFeatures([e.clientX-r.left,e.clientY-r.top],{layers:['vd-context-points']})[0];if(hit){e.preventDefault();e.stopImmediatePropagation();V.focus=hit.properties.id;open('government');}},true);
  window.EspaciosValueDrivers=Object.freeze({open,close,classification:'catalysts_and_conditional_outlook'});return true;
 }
 const timer=setInterval(()=>{if(install())clearInterval(timer);},150);
})();
