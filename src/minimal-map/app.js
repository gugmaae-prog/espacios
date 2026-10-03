/* Minimalist map composition from approved October UI mockup. Visual/control layer only. */
(() => {
  const RELEASE='20261003-minimal-map-v1';
  window.__ESPACIOS_MINIMAL_MAP_RELEASE__=RELEASE;
  const Q=s=>document.querySelector(s), root=document.documentElement;
  const UI={installed:false,mode:'map',metric:'price',satelliteReady:false};
  const SAT_SOURCE='minimal-satellite';
  const SAT_LAYER='minimal-satellite-layer';

  const active=(group,value)=>group.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.value===value)));
  const turn3d=on=>{const b=Q('#toggle-3d');if(!b)return;if(Boolean(state.is3d)!==Boolean(on))b.click();};
  const pointView=()=>{try{if(typeof aeUaeSetView==='function'&&aeUaeCoverageActive())aeUaeSetView('points');}catch{}};
  const analysisOff=()=>{try{if(typeof psrSetAnalysis==='function')psrSetAnalysis('off');}catch{}};

  function satelliteBefore(){
    const layers=map.getStyle()?.layers||[];
    return layers.find(layer=>/^(project|community|initiative|psr-|ae-|ue-|ms-|um-|roi-|sg-)/.test(layer.id))?.id
      ||layers.find(layer=>layer.type==='symbol')?.id;
  }
  function ensureSatellite(){
    if(!map.getSource(SAT_SOURCE))map.addSource(SAT_SOURCE,{
      type:'raster',
      tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize:256,
      attribution:'Esri, Maxar, Earthstar Geographics'
    });
    if(!map.getLayer(SAT_LAYER))map.addLayer({
      id:SAT_LAYER,type:'raster',source:SAT_SOURCE,
      paint:{'raster-opacity':1,'raster-fade-duration':120}
    },satelliteBefore());
    UI.satelliteReady=true;
  }
  function satelliteVisible(show){
    if(show)ensureSatellite();
    if(map.getLayer(SAT_LAYER))map.setLayoutProperty(SAT_LAYER,'visibility',show?'visible':'none');
  }
  function syncModes(){
    const group=Q('#minimal-map-modes');if(group)active(group,UI.mode);
  }
  function setMode(mode){
    if(!['map','satellite','3d','heatmap'].includes(mode))return;
    UI.mode=mode;
    if(mode==='satellite'){
      analysisOff();pointView();turn3d(false);satelliteVisible(true);
    }else{
      satelliteVisible(false);
      if(mode==='3d'){
        analysisOff();pointView();turn3d(true);
      }else if(mode==='heatmap'){
        turn3d(false);
        const metric=window.EspaciosUnifiedMap?.timeline?.()?.metric||'projects';
        const analysis=metric==='price'?'price-psf':metric==='roi'?'roi-apartment':'projects';
        try{psrSetAnalysis(analysis);}catch{}
        try{if(aeUaeCoverageActive())aeUaeSetView('heat');}catch{}
      }else{
        analysisOff();pointView();turn3d(false);
      }
    }
    syncModes();
  }

  function syncMetricButtons(){
    const group=Q('#minimal-metrics');if(!group)return;
    active(group,UI.metric);
  }
  function setMetric(metric){
    UI.metric=metric;
    if(metric==='price'||metric==='roi'){
      window.EspaciosUnifiedMap?.setMetric(metric);
    }else if(metric==='forecast'){
      window.EspaciosUnifiedMap?.setMetric('price');
      setTimeout(()=>{
        const timeline=window.EspaciosUnifiedMap?.timeline?.();
        const next=timeline?.periods?.find(id=>/Estimate/i.test(timeline.labels?.[id]||''));
        if(next)window.EspaciosUnifiedMap?.choose(next);
      },80);
    }else if(metric==='volume'){
      const rail=Q('.rail-btn[data-panel="analyze"]');
      if(rail&&!rail.classList.contains('active'))rail.click();
      setTimeout(()=>{
        const select=Q('#market-history-metric');
        if(select){
          select.value='transaction_value_aed';
          select.dispatchEvent(new Event('change',{bubbles:true}));
        }
      },80);
    }
    syncMetricButtons();
  }

  function setKind(kind){
    const buttons=[...document.querySelectorAll('#kind-filter [data-kind]')];
    if(!buttons.length)return;
    for(const button of buttons){
      const should=button.dataset.kind===kind;
      if(button.classList.contains('active')!==should)button.click();
    }
  }
  function openPanel(name){
    const button=Q('.rail-btn[data-panel="'+name+'"]');
    if(button)button.click();
  }

  function install(){
    if(UI.installed||!window.EspaciosUnifiedMap||!Q('#tl-dock')||!Q('#dr-track')||!Q('.search-wrap'))return false;
    UI.installed=true;root.dataset.minimalMap='1';

    const modes=document.createElement('div');
    modes.id='minimal-map-modes';modes.setAttribute('role','group');modes.setAttribute('aria-label','Map display');
    for(const [value,label] of [['map','Map'],['satellite','Satellite'],['3d','3D'],['heatmap','Heatmap']]){
      const b=document.createElement('button');b.type='button';b.dataset.value=value;b.textContent=label;b.setAttribute('aria-pressed',String(value==='map'));b.onclick=()=>setMode(value);modes.append(b);
    }
    Q('#app').append(modes);

    const tools=document.createElement('button');
    tools.id='minimal-tools-toggle';tools.type='button';tools.setAttribute('aria-label','Map tools');
    tools.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 7 4-7 4-7-4 7-4Zm-7 8 7 4 7-4M5 15l7 4 7-4"/></svg>';
    tools.onclick=()=>{root.dataset.minimalTools=root.dataset.minimalTools==='1'?'0':'1';tools.setAttribute('aria-expanded',String(root.dataset.minimalTools==='1'));};
    tools.setAttribute('aria-expanded','false');Q('#app').append(tools);

    const kinds=document.createElement('nav');kinds.id='minimal-kind-controls';kinds.setAttribute('aria-label','Map categories');
    for(const [value,label] of [['project','Projects'],['community','Communities'],['transport','Transport'],['places','Amenities']]){
      const b=document.createElement('button');b.type='button';b.dataset.value=value;b.textContent=label;
      if(value==='project')b.setAttribute('aria-pressed','true');
      b.onclick=()=>{
        kinds.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
        if(value==='project'||value==='community')setKind(value);else openPanel(value);
      };
      kinds.append(b);
    }
    Q('#app').append(kinds);

    const search=Q('.search-wrap');
    if(!Q('#minimal-search-settings')){
      const b=document.createElement('button');b.id='minimal-search-settings';b.type='button';b.setAttribute('aria-label','Filters and timeline settings');
      b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M10 12h10M4 12h2M4 17h6M14 17h6"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="12" cy="17" r="2"/></svg>';
      b.onclick=()=>Q('#mm-settings')?.click();search.insertBefore(b,Q('#search-results'));
    }

    const metric=document.createElement('div');metric.id='minimal-metrics';metric.setAttribute('role','group');metric.setAttribute('aria-label','Data point');
    const items=[
      ['price','Price / sqft','gold'],
      ['roi','ROI','neutral'],
      ['volume','Transaction Volume','blue'],
      ['forecast','Forecast','green']
    ];
    for(const [value,label,tone] of items){
      const b=document.createElement('button');b.type='button';b.dataset.value=value;b.dataset.tone=tone;b.innerHTML='<i></i><span>'+label+'</span>';b.setAttribute('aria-pressed',String(value==='price'));b.onclick=()=>setMetric(value);metric.append(b);
    }
    Q('#tl-dock').prepend(metric);

    const property=Q('#um-property'),settings=Q('#su-settings');
    if(property&&settings&&!Q('#minimal-property-settings')){
      const section=document.createElement('section');section.id='minimal-property-settings';
      const title=document.createElement('strong');title.textContent='Property type';section.append(title,property);
      const anchor=settings.querySelector('#um-horizon-label')||settings.querySelector('.tl-grid')||settings.firstElementChild;
      if(anchor?.parentNode)anchor.parentNode.insertBefore(section,anchor);else settings.append(section);
    }

    const track=Q('#dr-track'),date=Q('#su-date');
    if(track&&date&&!track.contains(date))track.append(date);
    const evidence=Q('#um-evidence');if(evidence)evidence.hidden=true;

    for(const id of ['mm-play','tg-play']){const el=Q('#'+id);if(el)el.hidden=true;}
    const oldMetrics=Q('#mm-metrics');if(oldMetrics)oldMetrics.hidden=true;
    const readout=Q('#um-readout');if(readout)readout.hidden=true;
    const status=Q('#mm-status');if(status)status.hidden=true;

    setMode('map');setMetric('price');
    return true;
  }

  const timer=setInterval(()=>{if(install())clearInterval(timer);},120);
})();