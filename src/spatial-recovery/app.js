/* All metric glows use the project heatmap's blue, teal, green and amber family. */
const hmStops=[[72,111,174],[78,167,188],[83,190,171],[179,204,135],[225,172,93]];
function hmColor(value,domain,change=false){
 if(change)return tlK.color(value,domain,true);
 const low=Number(domain?.[0]),high=Number(domain?.[1]),at=Number.isFinite(low)&&Number.isFinite(high)&&high>low?Math.max(0,Math.min(1,(value-low)/(high-low))):.5;
 const position=at*(hmStops.length-1),first=Math.min(hmStops.length-2,Math.floor(position)),part=position-first;
 return 'rgb('+hmStops[first].map((channel,i)=>Math.round(channel+(hmStops[first+1][i]-channel)*part)).join(',')+')';
}
const hmRamp='linear-gradient(90deg,'+hmStops.map(rgb=>'rgb('+rgb.join(',')+')').join(',')+')';
function hmLegend(){
 const tl=tlQ('#tl-scale');
 if(tl&&tlState.view!=='change'&&(bhActive()||msActive()))tl.style.background=hmRamp;
 const ms=tlQ('#ms-legend .ms-ramp');if(ms&&msActive())ms.style.background=hmRamp;
}
const hmOriginalLegend=tlLegend;tlLegend=function(){const result=hmOriginalLegend(...arguments);hmLegend();return result;};
/* Source-area benchmarks are located at one unambiguous catalogue centre. */
const msSpotLayers=['ms-spot-halo','ms-spot-core'];
let msSpotCount=0;
function msHideSpots(){
 for(const id of msSpotLayers)if(map.getLayer(id))map.setLayoutProperty(id,'visibility','none');
 if(map.getLayer('ms-fill'))map.setPaintProperty('ms-fill','fill-opacity',.57);
 if(map.getLayer('ms-outline'))map.setPaintProperty('ms-outline','line-opacity',.7);
 msSpotCount=0;
}
const msOriginalHide=msHide;
msHide=function(){msHideSpots();return msOriginalHide();};
const msOriginalRender=msRender;
msRender=function(){
 msHideSpots();msOriginalRender();
 if(!msActive()||tlState.loading||msState.segment==='both')return;
 const communities=arState.catalogue?.communities||[];
 const features=[];
 for(const row of tlState.frame){
  if(!msK.finite(row.value))continue;
  const matches=communities.filter(c=>SG.key(c.emirate,c.name)===SG.key(row.emirate,row.name)&&Number.isFinite(c.coordinates?.lng)&&Number.isFinite(c.coordinates?.lat));
  const centres=[...new Set(matches.map(c=>c.coordinates.lng.toFixed(5)+','+c.coordinates.lat.toFixed(5)))];
  if(centres.length!==1)continue;
  const [lng,lat]=centres[0].split(',').map(Number);
  features.push({type:'Feature',id:row.id,geometry:{type:'Point',coordinates:[lng,lat]},properties:{name:row.name,period:row.period,value:row.value,color:hmColor(row.value,tlState.domain),locationBasis:'Approximate catalogue community centre; not a source-area boundary'}});
 }
 msSpotCount=features.length;
 sgSource('ms-spots',{type:'FeatureCollection',features});
 if(!features.length){msSync();return;}
 const before=map.getLayer('project-hit')?'project-hit':undefined;
 if(!map.getLayer('ms-spot-halo'))map.addLayer({id:'ms-spot-halo',type:'circle',source:'ms-spots',paint:{'circle-color':['get','color'],'circle-radius':['interpolate',['linear'],['zoom'],6,18,9,34,12,46],'circle-opacity':.54,'circle-blur':.7}},before);
 if(!map.getLayer('ms-spot-core'))map.addLayer({id:'ms-spot-core',type:'circle',source:'ms-spots',paint:{'circle-color':['get','color'],'circle-radius':['interpolate',['linear'],['zoom'],6,3,9,5,12,7],'circle-opacity':.8,'circle-stroke-color':document.documentElement.dataset.espaciosTheme==='light'?'#f6f9fc':'#17283b','circle-stroke-width':1.3}},before);
 if(map.getLayer('ms-fill'))map.setPaintProperty('ms-fill','fill-opacity',.12);
 if(map.getLayer('ms-outline'))map.setPaintProperty('ms-outline','line-opacity',.42);
 for(const id of msSpotLayers)map.setLayoutProperty(id,'visibility','visible');
 if(!msState.spotClickBound){
  msState.spotClickBound=true;
  map.on('click','ms-spot-core',event=>{if(!msActive())return;msState.area=event.features?.[0]?.properties?.name||'';msState.open=true;msSync();});
  map.on('mouseenter','ms-spot-core',()=>{map.getCanvas().style.cursor='pointer';});
  map.on('mouseleave','ms-spot-core',()=>{map.getCanvas().style.cursor='';});
 }
 msSync();
};
const msOriginalSync=msSync;
msSync=function(){
 msOriginalSync();
 if(!msActive()){msHideSpots();return;}
 if(msSpotCount){
  const note=tlQ('#tl-note'),status=tlQ('#ms-status');
  const coverage=msSpotCount+' benchmark glow'+(msSpotCount===1?'':'s')+' at approximate catalogue community centres; unmatched areas stay unshaded.';
  if(note&&!note.textContent.includes('benchmark glow'))note.textContent+=' '+coverage;
  if(status&&!status.textContent.includes('benchmark glow'))status.textContent+=' · '+coverage;
 }
 hmLegend();
};
new MutationObserver(()=>{
 if(map.getLayer('ms-spot-core'))map.setPaintProperty('ms-spot-core','circle-stroke-color',document.documentElement.dataset.espaciosTheme==='light'?'#f6f9fc':'#17283b');
}).observe(document.documentElement,{attributes:true,attributeFilter:['data-espacios-theme']});
