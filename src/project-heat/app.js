/* Identity-verified DLD subject observations supplement the area heatmap. */
(() => {
 const P={rows:[],loaded:false,error:'',visible:[],period:'',detail:null,bound:false};
 const root=document.documentElement,fmt=value=>Number(value).toLocaleString('en',{maximumFractionDigits:0});
 const endMonth=period=>{const quarter=/^(\d{4})Q([1-4])$/.exec(period);if(quarter)return Number(quarter[1])*12+Number(quarter[2])*3;const month=/^(\d{4})-(\d{2})$/.exec(period);return month?Number(month[1])*12+Number(month[2]):null;};
 const active=()=>bhActive()&&(bhPrice()||bhActivity())&&tlState.view==='value'&&root.dataset.unifiedFuture!=='1';
 function hide(){for(const id of ['ph-halo','ph-core'])if(map.getLayer(id))map.setLayoutProperty(id,'visibility','none');if(P.detail)P.detail.hidden=true;P.visible=[];diagnostic();}
 function diagnostic(){window.__ESPACIOS_PROJECT_HEAT__={ready:P.loaded,error:P.error,qualifiedObservations:P.rows.length,qualifiedProjects:96,visibleProjects:P.visible.length,period:P.period,source:'V48 identity-verified DLD project subjects; separate from area raster'};}
 function selectRows(){
  const end=endMonth(tlState.period);if(end===null)return[];
  const latest=new Map();
  for(const row of P.rows){if(msState.segment!=='both'&&row.segment!==msState.segment)continue;const observed=endMonth(row.period);if(observed===null||observed>end||end-observed>12)continue;
   const previous=latest.get(row.projectId),prior=previous&&endMonth(previous.period);
   if(!previous||observed>prior||(observed===prior&&row.eligibleSaleCount>previous.eligibleSaleCount))latest.set(row.projectId,row);
  }
  return [...latest.values()];
 }
 function render(){
  if(!P.loaded||!map.getStyle?.()?.layers?.length||!active()){hide();return;}
  const selected=selectRows();P.visible=selected;P.period=tlState.period;
  sgSource('ph-project-observations',{type:'FeatureCollection',features:selected.map(row=>({type:'Feature',id:row.id,geometry:{type:'Point',coordinates:row.coordinates},properties:{observationId:row.id,projectId:row.projectId}}))});
  const before=map.getStyle().layers.find(layer=>layer.type==='symbol')?.id;
  if(!map.getLayer('ph-halo'))map.addLayer({id:'ph-halo',type:'circle',source:'ph-project-observations',paint:{'circle-color':'#53beab','circle-radius':['interpolate',['linear'],['zoom'],6,7,9,13,12,18],'circle-opacity':.32,'circle-blur':.72}},before);
  if(!map.getLayer('ph-core'))map.addLayer({id:'ph-core',type:'circle',source:'ph-project-observations',paint:{'circle-color':'#53beab','circle-radius':['interpolate',['linear'],['zoom'],6,2.5,9,4,12,5],'circle-opacity':.9,'circle-stroke-color':root.dataset.espaciosTheme==='light'?'#f6f9fc':'#17283b','circle-stroke-width':1.5}},before);
  for(const id of ['ph-halo','ph-core'])map.setLayoutProperty(id,'visibility','visible');
  if(!P.bound){P.bound=true;
   map.on('click','ph-core',event=>{if(!active())return;const id=event.features?.[0]?.properties?.observationId,row=P.visible.find(item=>item.id===id);if(row)show(row);});
   map.on('mouseenter','ph-core',()=>{if(active())map.getCanvas().style.cursor='pointer';});
   map.on('mouseleave','ph-core',()=>{map.getCanvas().style.cursor='';});
  }
  diagnostic();window.EspaciosMobileUI?.sync();
 }
 function show(row){
  let card=P.detail;
  if(!card){card=document.createElement('aside');card.id='ph-detail';card.setAttribute('role','status');document.querySelector('#app').append(card);P.detail=card;}
  card.replaceChildren();
  const head=document.createElement('div'),title=document.createElement('strong'),close=document.createElement('button');
  title.textContent=row.projectName;close.type='button';close.textContent='Close';close.setAttribute('aria-label','Close project sale observation');close.onclick=()=>card.hidden=true;head.append(title,close);
  const value=document.createElement('p');value.textContent='AED '+fmt(row.medianAedSqft)+' / sqft · '+fmt(row.eligibleSaleCount)+' eligible sales';
  const detail=document.createElement('small');detail.textContent=row.period+' · '+(row.segment==='apartment'?'Flats':'Villas')+' · '+row.registration+' · official DLD subject aggregate. Latest-vintage retrospective evidence; this project cohort is not added to the area heatmap count.';
  const link=document.createElement('a');link.href='https://data.dubai/en/l/470061';link.target='_blank';link.rel='noopener';link.textContent='Dubai Land Department source';
  card.append(head,value,detail,link);card.hidden=false;
 }
 async function load(){
  try{const response=await fetch('/map/api/verified-project-observations');if(!response.ok)throw Error('Project evidence '+response.status);const data=await response.json();
   if(data.version!=='20261115-v48-qualified-project-heat-v1'||data.counts?.observations!==175||data.counts?.projects!==96)throw Error('Project evidence version mismatch');
   P.rows=data.observations;P.loaded=true;diagnostic();render();
  }catch(error){P.error=String(error.message||error);diagnostic();}
 }
 const timer=setInterval(()=>{
  if(!map?.getStyle?.()?.layers?.length||!document.querySelector('#tl-dock')||!bhState?.installed)return;
  clearInterval(timer);
  const prior=tlLegend;tlLegend=function(){const result=prior(...arguments);queueMicrotask(render);return result;};
  map.on('style.load',()=>queueMicrotask(render));
  new MutationObserver(mutations=>{if(mutations.some(item=>item.attributeName==='data-unified-future'))queueMicrotask(render);if(map.getLayer('ph-core'))map.setPaintProperty('ph-core','circle-stroke-color',root.dataset.espaciosTheme==='light'?'#f6f9fc':'#17283b');}).observe(root,{attributes:true,attributeFilter:['data-espacios-theme','data-unified-future']});
  diagnostic();load();
 },150);
})();
