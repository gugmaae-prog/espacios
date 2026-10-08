/* One pointer owner, native date alternatives, exact-id picking and measured sheets. */
(() => {
  const Q = s => document.querySelector(s), root = document.documentElement;
  const mobile = matchMedia('(max-width:760px), (max-width:1024px) and (max-height:560px) and (pointer:coarse)');
  const M = {installed:false, pointer:null, frame:0, syncFrame:0, geometryFrame:0, fraction:0, domain:'', optionKey:'', active:null, picks:[], visible:new Map(), lastRender:0};
  const panels = () => [...document.querySelectorAll('.floating-panel, #detail, #ms-inspect, #se-panel, #mm-picker, #vd-panel, #hi-panel')];
  const visible = el => !el.hidden && !el.classList.contains('hidden');
  const unified = () => window.EspaciosUnifiedMap?.timeline();
  const periodsNow = () => unified()?.periods||tlState.periods;
  const selectedNow = () => unified()?.selected||tlState.period;
  const domain = () => JSON.stringify([state.analysisMetric, tlState.mode, periodsNow(), msState.emirate, msState.segment, bhState.registration,tgState.coverage,unified()?.key]);
  const pickerKey = () => domain()+'|'+tlState.period;
  const icon = path => '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+path+'</svg>';
  const icons = {prev:icon('<path d="m14 6-6 6 6 6"/>'),next:icon('<path d="m10 6 6 6-6 6"/>'),play:icon('<path d="m8 5 11 7-11 7z"/>'),pause:icon('<path d="M8 5v14M16 5v14"/>'),settings:icon('<path d="M4 7h16M4 17h16M8 4v6M16 14v6"/>')};
  function dated() {
    if (cxCatalogue()) {const el=Q('#tg-coverage-select');el.value='cumulative';el.dispatchEvent(new Event('change',{bubbles:true}));}
  }
  function choose(period) {if (!periodsNow().includes(period)) return;if(unified()){window.EspaciosUnifiedMap.choose(period);}else{dated();tlChooseDate(period);}schedule();}
  function renderMap(){if(unified())window.EspaciosUnifiedMap.render();else tlUpdate();}
  function sync() {
    M.syncFrame=0;if(!M.installed)return;
    const adapter=unified(),all=!adapter&&cxCatalogue(), periods=periodsNow() || [], key=JSON.stringify([all,periods,adapter?.labels]);
    if(M.pickerKey&&M.pickerKey!==pickerKey()){Q('#mm-picker').hidden=true;M.picks=[];M.pickerKey=null;}
    if(M.pointer!==null&&domain()!==M.domain)finish(null,true);
    const date=Q('#mm-date'),slider=Q('#tl-slider');Q('#su-date').hidden=false;
    if(key!==M.optionKey){M.optionKey=key;date.replaceChildren();if(aeUaeCoverageActive()&&!adapter)date.add(new Option('All dates','all'));for(const p of periods)date.add(new Option(adapter?.labels[p]||tlK.periodLabel(p),p));}
    date.value=all?'all':selectedNow();date.disabled=!!(adapter?adapter.loading:tlState.loading)||!periods.length;
    slider.disabled=!!(adapter?adapter.loading:tlState.loading)||periods.length<2;
    if(adapter){slider.max=String(Math.max(0,periods.length-1));slider.value=String(Math.max(0,periods.indexOf(adapter.selected)));}
    slider.setAttribute('aria-label',all?'Explore project handover dates':'Selected evidence period');
    slider.setAttribute('aria-valuetext',all?'All dates; drag to explore dated handovers':adapter?.labels[adapter.selected]||tlK.periodLabel(tlState.period));
    Q('#su-date-label').textContent=all?'Project coverage':Q('#tl-badge')?.textContent.includes('PROJECTION')?'Research projection':'Selected period';
    const index=periods.indexOf(selectedNow());
    Q('#mm-prev').disabled=(adapter?adapter.loading:tlState.loading)||!periods.length||(!all&&index<=0);
    Q('#mm-next').disabled=(adapter?adapter.loading:tlState.loading)||!periods.length||(!all&&index>=periods.length-1);
    Q('#mm-play').disabled=tlState.loading||periods.length<2;
    const play=Q('#mm-play'),playing=String(!!tlState.playing);if(play.getAttribute('aria-pressed')!==playing){play.setAttribute('aria-pressed',playing);play.setAttribute('aria-label',tlState.playing?'Pause timeline':'Play timeline');play.innerHTML=tlState.playing?icons.pause:icons.play;}
    Q('#mm-metrics').querySelectorAll('[data-mm-metric]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mmMetric===(adapter?.metric||(aeUaeCoverageActive()?'projects':msState.kind==='roi'?'roi':'price')))));
    const points=Q('#mm-points');points.hidden=false;points.setAttribute('aria-pressed',String(aeUaeCoverageActive()&&aeUaeState.view==='points'));points.textContent=aeUaeCoverageActive()?(aeUaeState.view==='points'?'Heatmap':'Points'):'Estimates';
    points.setAttribute('aria-label',aeUaeCoverageActive()?'Toggle heatmap and project points':'Open Smart Estimates for the selected metric');
    const min=Q('#tl-minimize'),collapsed=Q('#tl-dock').classList.contains('is-minimized');min.textContent=collapsed?'⌃':'⌄';min.setAttribute('aria-label',collapsed?'Expand timeline':'Minimize timeline');
    const status=Q('#mm-status');const text=tlState.loading||bhState.loadingRaster?'Loading matching evidence…':all?'All dates · future and undated projects included':aeUaeCoverageActive()?'Dated handovers · '+(tgState.coverage==='annual'?'selected year':'through '+tlState.period)+' · not price growth':Q('#ms-status')?.textContent||Q('#tl-title')?.textContent||'';
    if(status.textContent!==text)status.textContent=text;status.title=text;
    const legend=Q('#mm-legend');legend.hidden=aeUaeCoverageActive();legend.querySelector('summary').textContent=msActive()&&msState.kind==='roi'?'Yield scale':'Price scale';const legacyLegend=legend.querySelector('.ae-legend-side');if(legacyLegend)legacyLegend.hidden=msActive();
    if(M.active&&visible(M.active))updateBar(M.active);
    root.dataset.mobileMap='1';window.EspaciosUnifiedMap?.sync();scheduleGeometry();
  }
  function schedule(){if(!M.syncFrame)M.syncFrame=requestAnimationFrame(sync);}
  function applyPointer() {
    M.frame=0;if(M.pointer===null)return;if(domain()!==M.domain){finish(null,true);return;}
    const period=MMCore.periodAt(periodsNow(),M.fraction);if(period&&period!==selectedNow())choose(period);
    const rect=Q('#tl-slider').getBoundingClientRect();Q('#dr-track').style.setProperty('--su-position',(12+(rect.width-24)*M.fraction)+'px');
    // Bound map work while keeping the visual thumb attached to the finger.
    if(performance.now()-M.lastRender>120){M.lastRender=performance.now();clearTimeout(tlState.renderTimer);renderMap();}
    schedule();
  }
  function finish(event,cancelled=false) {
    if(M.pointer===null||(event&&event.pointerId!==M.pointer))return;
    if(event){event.preventDefault();event.stopImmediatePropagation();}
    const pointer=M.pointer,slider=Q('#tl-slider');
    if(!cancelled&&event){M.fraction=MMCore.fractionAt(event.clientX,slider.getBoundingClientRect());cancelAnimationFrame(M.frame);applyPointer();}
    cancelAnimationFrame(M.frame);M.frame=0;M.pointer=null;suState.pointer=null;Q('#dr-track').classList.remove('su-scrubbing','mm-scrubbing');
    try{if(slider.hasPointerCapture(pointer))slider.releasePointerCapture(pointer);}catch{}
    clearTimeout(tlState.renderTimer);renderMap();schedule();
  }
  function installPointer(){
    const track=Q('#dr-track'),slider=Q('#tl-slider');
    track.addEventListener('pointerdown',event=>{
      if(event.target!==slider||event.button>0||M.pointer!==null||slider.disabled)return;
      event.preventDefault();event.stopImmediatePropagation();tlStop();dated();
      M.pointer=event.pointerId;suState.pointer=event.pointerId;M.domain=domain();M.fraction=MMCore.fractionAt(event.clientX,slider.getBoundingClientRect());
      slider.focus({preventScroll:true});try{slider.setPointerCapture(event.pointerId);}catch{}
      track.classList.add('su-scrubbing','mm-scrubbing');applyPointer();
    },true);
    track.addEventListener('pointermove',event=>{if(event.pointerId!==M.pointer)return;event.preventDefault();event.stopImmediatePropagation();M.fraction=MMCore.fractionAt(event.clientX,slider.getBoundingClientRect());if(!M.frame)M.frame=requestAnimationFrame(applyPointer);},true);
    track.addEventListener('pointerup',event=>finish(event),true);
    track.addEventListener('pointercancel',event=>finish(event,true),true);
    track.addEventListener('lostpointercapture',event=>finish(event,true),true);
    document.addEventListener('pointerup',event=>finish(event),true);
    document.addEventListener('pointercancel',event=>finish(event,true),true);
    track.addEventListener('keydown',event=>{if(!unified()||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key))return;event.preventDefault();event.stopImmediatePropagation();const ps=periodsNow(),at=ps.indexOf(selectedNow()),delta=['ArrowLeft','ArrowDown','PageDown'].includes(event.key)?-1:1;choose(ps[event.key==='Home'?0:event.key==='End'?ps.length-1:Math.max(0,Math.min(ps.length-1,at+delta))]);},true);
    track.addEventListener('input',event=>{if(event.target===slider&&unified()){event.stopImmediatePropagation();choose(periodsNow()[Number(slider.value)]);}},true);
    slider.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key)){tlStop();dated();}},true);
    addEventListener('blur',()=>finish(null,true));addEventListener('pagehide',()=>finish(null,true));
    document.addEventListener('visibilitychange',()=>{if(document.hidden){finish(null,true);tlStop();}});
  }
  function closePanel(panel){
    if(panel.id==='se-panel')window.EspaciosEstimateUI?.close(false);
    else if(panel.id==='ms-inspect'){msState.open=false;msInfo();}
    else if(panel.id==='detail')Q('#detail-close')?.click();
    else if(panel.id==='mm-picker')panel.hidden=true;
    else{panel.classList.add('hidden');document.querySelectorAll('.rail-btn[data-panel]').forEach(b=>{if(b.dataset.panel===panel.id)b.setAttribute('aria-expanded','false');});}
    M.visible.set(panel,false);if(M.active===panel)M.active=null;
  }
  function activate(panel,peek=false){
    if(!mobile.matches)return;
    for(const other of panels())if(other!==panel&&visible(other))closePanel(other);
    panel.classList.remove('ae-collapsed');if(panel.hasAttribute('data-ae-sheet'))panel.dataset.aeSheet='half';
    M.active=panel;panel.dataset.mmSheet=peek?'peek':'open';M.visible.set(panel,true);updateBar(panel);scheduleGeometry();
  }
  function activateLegacyDetails(event){
    const rail=event.target.closest?.('.rail-btn[data-panel]');
    if(rail){const panel=Q('#'+rail.dataset.panel+'-panel');if(panel&&visible(panel))activate(panel);}
    else if(event.target.closest?.('[data-ms-details]'))activate(Q('#ms-inspect'));
    else if(event.target.closest?.('#se-open,#ms-forecast')){const panel=Q('#se-panel');if(panel&&visible(panel))activate(panel);}
  }
  function updateBar(panel){
    const button=panel.querySelector('.mm-sheet-toggle');if(!button)return;const open=panel.dataset.mmSheet!=='peek';
    if(button.getAttribute('aria-expanded')!==String(open)){button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'Minimize details':'Expand details');button.textContent=open?'⌄':'⌃';}
    const label=panel.querySelector('.mm-sheet-label'),title=panel.id==='detail'?(Q('#detail-body h2')?.textContent||recordTitle(state.selected||{})):panel.id==='ms-inspect'?(msState.area||'Market evidence'):panel.id==='se-panel'?(panel.getAttribute('aria-label')||'Estimate evidence'):panel.id==='mm-picker'?'Choose a project':panel.getAttribute('aria-label')||panel.querySelector('h2,h3')?.textContent||'Explore';
    if(label.textContent!==title)label.textContent=title;
  }
  function installSheets(){
    for(const panel of panels()){
      if(panel.querySelector(':scope > .mm-sheet-bar'))continue;
      const bar=document.createElement('div');bar.className='mm-sheet-bar';bar.innerHTML='<button class="mm-sheet-toggle" type="button" aria-label="Minimize details">⌄</button><span class="mm-sheet-label"></span><button class="mm-sheet-close" type="button" aria-label="Close details">×</button>';panel.prepend(bar);
      bar.querySelector('.mm-sheet-toggle').onclick=()=>{panel.dataset.mmSheet=panel.dataset.mmSheet==='peek'?'open':'peek';updateBar(panel);scheduleGeometry();};
      bar.querySelector('.mm-sheet-close').onclick=()=>{closePanel(panel);Q('#map').focus({preventScroll:true});scheduleGeometry();};
      panel.dataset.mmSheet='open';M.visible.set(panel,visible(panel));
      new MutationObserver(()=>{if(!mobile.matches)return;const now=visible(panel),was=M.visible.get(panel);M.visible.set(panel,now);
        // Delayed legacy workspace restores and market refreshes are not new
        // navigation requests. Keep the user-owned drawer until an explicit
        // rail, Details, map selection or search activation replaces it.
        if(now&&!was){if(M.active?.id==='hi-panel'&&panel!==M.active&&visible(M.active))closePanel(panel);else activate(panel);}
        if(visible(panel))updateBar(panel);scheduleGeometry();}).observe(panel,{attributes:true,attributeFilter:['class','hidden']});
    }
    if(mobile.matches){const open=panels().filter(visible);const chosen=open.includes(M.active)?M.active:open.find(p=>p.contains(document.activeElement))||open.find(p=>p.id==='hi-panel')||open.find(p=>p.id==='detail'||p.id==='ms-inspect'||p.id==='se-panel')||open[0];if(chosen)activate(chosen,chosen===M.active?chosen.dataset.mmSheet==='peek':chosen.id!=='hi-panel');}
  }
  function scheduleGeometry(){if(!M.geometryFrame)M.geometryFrame=requestAnimationFrame(measure);}
  function responsive(){const short=mobile.matches&&innerHeight<=560;if(short&&!M.short)aeUaeSetMinimized(true);M.short=short;scheduleGeometry();}
  function measure(){
    M.geometryFrame=0;if(!M.installed)return;
    const header=Q('header.topbar')||Q('#app > header'),dock=Q('#tl-dock'),nav=Q('.layer-rail');
    const h=header?.getBoundingClientRect(),d=dock.getBoundingClientRect(),n=nav?.getBoundingClientRect();
    const values={'--mm-header-bottom':(h?.bottom||100)+'px','--mm-dock-top':d.top+'px','--mm-dock-height':d.height+'px','--mm-nav-height':(n?.height||64)+'px','--mm-bottom':Math.max(0,innerHeight-d.top+8)+'px'};
    for(const [key,value]of Object.entries(values))if(root.style.getPropertyValue(key)!==value)root.style.setProperty(key,value);
    if(mobile.matches&&!map.isMoving()&&M.pointer===null){const sheet=M.active&&visible(M.active)?M.active.getBoundingClientRect().top:undefined,padding=MMCore.viewportPadding(innerHeight,h?.bottom||100,d.top,sheet),signature=JSON.stringify(padding);if(M.padding!==signature){M.padding=signature;map.setPadding(padding);}}
  }
  function selectProject(hit){const record=state.recordById.get(hit.id);if(!record||!aeUaeCoverageActive()||!aeUaeTimelineData().features.some(f=>String(f.properties?.id??f.id)===hit.id))return;Q('#mm-picker').hidden=true;M.pickerKey=null;showDetail(record);psrSetSelectedPoint(record);activate(Q('#detail'));scheduleGeometry();}
  function pick(event){
    if(!event.point||M.mapDragged)return false;
    if(window.EspaciosUnifiedMap?.pick(event))return true;
    // The second native click belongs to the same semantic layer, but only the
    // separate dblclick event should perform zoom. Do not reopen selection.
    const select=event.originalEvent?.detail>1?()=>{}:queueMicrotask;
    if(aeUaeCoverageActive()&&!window.EspaciosEstimateUI?.context().map){
      const hits=MMCore.pickProjects(aeUaeTimelineData().features,event.point,c=>map.project(c),event.originalEvent?.pointerType==='mouse'?12:22).filter(h=>state.recordById.has(h.id));
      if(!hits.length)return false;
      select(()=>{map.stop();if(hits.length===1){selectProject(hits[0]);return;}
        M.picks=hits;M.pickerKey=pickerKey();const picker=Q('#mm-picker'),body=Q('#mm-picker-list');body.replaceChildren();
        const note=document.createElement('p');note.textContent=hits.length+' nearby records. Some share approximate community coordinates.';body.append(note);
        hits.forEach(hit=>{const b=document.createElement('button');b.type='button';b.dataset.mmPick=hit.id;b.textContent=recordTitle(state.recordById.get(hit.id));b.onclick=()=>selectProject(hit);body.append(b);});
        picker.hidden=false;activate(picker);body.querySelector('button')?.focus({preventScroll:true});
      });
      return true;
    }else if(window.EspaciosEstimateUI?.context().map&&map.getLayer('se-fill')){
      const hit=map.queryRenderedFeatures([event.point.x,event.point.y],{layers:['se-fill']})[0];if(hit){select(()=>{window.EspaciosEstimateUI.selectArea(hit.properties.name);activate(Q('#se-panel'));});return true;}
    }else if(msActive()&&map.getLayer('ms-fill')){
      const hit=map.queryRenderedFeatures([event.point.x,event.point.y],{layers:['ms-fill']})[0];if(hit){select(()=>{msState.area=hit.properties.name;msState.open=true;msSync();activate(Q('#ms-inspect'));});return true;}
    }else if(ppActive()&&!tlState.loading&&!bhState.loadingRaster&&sgState.data){
      const location=map.unproject(event.point),rows=tlState.frame.filter(r=>(r.geometryIds||[]).some(id=>{const geometry=sgState.data.features.find(f=>String(f.id)===String(id));return geometry&&SG.contains([location.lng,location.lat],geometry.geometry);}));
      const names=[...new Set(rows.map(r=>r.name))];if(names.length===1){select(()=>{msState.area=names[0];msState.open=true;msSync();activate(Q('#ms-inspect'));});return true;}
    }
    return false;
  }
  function install(){
    if(!suState.installed||!Q('#se-panel')||!Q('#su-market-filters'))return false;
    const dock=Q('#tl-dock'),head=dock.querySelector('.tl-head'),dialog=Q('#su-settings');
    const metrics=document.createElement('div');metrics.id='mm-metrics';metrics.setAttribute('aria-label','Map data view');metrics.innerHTML='<button type="button" data-mm-metric="projects">Projects</button><button type="button" data-mm-metric="price">Prices</button><button type="button" data-mm-metric="roi">ROI</button><button type="button" id="mm-points">Points</button><button type="button" id="mm-settings" aria-label="Map filters and timeline settings">'+icons.settings+'</button>';dock.prepend(metrics);
    metrics.querySelectorAll('[data-mm-metric]').forEach(b=>b.onclick=()=>{finish(null,true);tlStop();if(mobile.matches)for(const panel of panels())if(visible(panel))closePanel(panel);if(window.EspaciosUnifiedMap)window.EspaciosUnifiedMap.setMetric(b.dataset.mmMetric);else if(b.dataset.mmMetric==='projects')psrSetAnalysis('uae-project-coverage');else msOpen(b.dataset.mmMetric);schedule();});
    Q('#mm-points').onclick=()=>{if(aeUaeCoverageActive())aeUaeSetView(aeUaeState.view==='points'?'heat':'points');else Q('#se-open').click();schedule();};
    Q('#mm-settings').onclick=()=>{finish(null,true);Q('#tl-settings').click();};dialog.addEventListener('close',()=>Q('#mm-settings').focus({preventScroll:true}));
    const advanced=document.createElement('details');advanced.id='mm-advanced';advanced.innerHTML='<summary>Advanced timeline controls</summary>';advanced.append(Q('#tl-more'));
    for(const id of ['su-market-filters','pp-toolbar','tg-bar','cx-catalogue-strip']){const el=Q('#'+id);if(el)dialog.append(el);}dialog.append(advanced,Q('#su-research'));
    dialog.addEventListener('click',event=>{if(event.target.closest('#se-open,#ms-details,#ms-forecast,#pp-projection,#tg-scenario'))dialog.close();});
    const date=document.createElement('select');date.id='mm-date';date.setAttribute('aria-label','Select evidence date or all project dates');Q('#su-date').append(date);
    date.onchange=()=>{finish(null,true);tlStop();if(date.value==='all'){const el=Q('#tg-coverage-select');el.value='catalogue';el.dispatchEvent(new Event('change',{bubbles:true}));}else choose(date.value);schedule();};
    const transport=document.createElement('div');transport.className='mm-transport';transport.innerHTML=['prev','play','next'].map(x=>'<button id="mm-'+x+'" type="button" aria-label="'+({prev:'Previous evidence period',play:'Play timeline',next:'Next evidence period'})[x]+'">'+icons[x]+'</button>').join('');head.append(transport);
    for(const [id,delta]of [['prev',-1],['next',1]])Q('#mm-'+id).onclick=()=>{tlStop();if(unified()){const ps=periodsNow();choose(ps[Math.max(0,Math.min(ps.length-1,ps.indexOf(selectedNow())+delta))]);}else{dated();tlStep(delta);}schedule();};
    Q('#mm-play').onclick=()=>{dated();tlPlay();schedule();};
    const status=document.createElement('p');status.id='mm-status';status.setAttribute('role','status');dock.append(status);
    const legend=document.createElement('details');legend.id='mm-legend';legend.innerHTML='<summary>Price scale</summary><div class="mm-legend-body"></div>';for(const el of [dock.querySelector('.ae-legend-side'),Q('#ms-legend')])if(el)legend.querySelector('.mm-legend-body').append(el);Q('#app').append(legend);
    const picker=document.createElement('section');picker.id='mm-picker';picker.hidden=true;picker.setAttribute('aria-label','Nearby projects');picker.innerHTML='<div id="mm-picker-list"></div>';Q('#app').append(picker);
    M.installed=true;installPointer();installSheets();
    const canvas=map.getCanvas();canvas.addEventListener('pointerdown',e=>{M.mapOrigin=[e.clientX,e.clientY];M.mapDragged=false;},true);canvas.addEventListener('pointermove',e=>{if(e.buttons&&M.mapOrigin&&Math.hypot(e.clientX-M.mapOrigin[0],e.clientY-M.mapOrigin[1])>8)M.mapDragged=true;},true);
    // Resolve a semantic data tap before the older delegated territory handlers.
    // Unmatched clicks and the separate dblclick event continue unchanged.
    map.getCanvasContainer().addEventListener('click',e=>{if(e.target!==canvas)return;const rect=canvas.getBoundingClientRect();if(pick({point:{x:e.clientX-rect.left,y:e.clientY-rect.top},originalEvent:e})){e.preventDefault();e.stopImmediatePropagation();}},true);
    const oldSync=suSync;suSync=function(){const result=oldSync(...arguments);schedule();return result;};
    new MutationObserver(schedule).observe(Q('#tl-date'),{childList:true});
    const oldPadding=psrApplyDockPadding;psrApplyDockPadding=function(){if(!mobile.matches)return oldPadding(...arguments);const h=(Q('#app > header')?.getBoundingClientRect().bottom||100),d=dock.getBoundingClientRect().top,s=M.active&&visible(M.active)?M.active.getBoundingClientRect().top:undefined;map.setPadding(MMCore.viewportPadding(innerHeight,h,d,s));};
    const oldDetail=showDetail;showDetail=function(){const r=oldDetail(...arguments);activate(Q('#detail'));return r;};
    const resize=new ResizeObserver(scheduleGeometry);[dock,Q('#app > header'),Q('.layer-rail')].filter(Boolean).forEach(el=>resize.observe(el));map.on('moveend',scheduleGeometry);
    addEventListener('resize',responsive);visualViewport?.addEventListener('resize',scheduleGeometry);mobile.addEventListener('change',()=>{finish(null,true);if(mobile.matches)installSheets();else map.setPadding({top:0,bottom:0,left:0,right:0});responsive();schedule();});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&mobile.matches&&M.active&&!dialog.open){closePanel(M.active);scheduleGeometry();}});
    document.addEventListener('click',activateLegacyDetails);
    window.EspaciosMobileUI=Object.freeze({sync:schedule,activate,closePanel});responsive();sync();window.__ESPACIOS_MOBILE_MAP__={release:'20261008-map-palette-v28',nativePeriodsPreserved:true,allCatalogueRecordsPreserved:true};return true;
  }
  const timer=setInterval(()=>{if(install())clearInterval(timer);},150);
})();
