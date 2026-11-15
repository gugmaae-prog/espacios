/* Published area benchmarks without a boundary appear only at a reviewed catalogue centre. */
const msSpotLayers=['ms-spot-halo','ms-spot-core'];
let msSpotCount=0;
function msHideSpots(){
 for(const id of msSpotLayers)if(map.getLayer(id))map.setLayoutProperty(id,'visibility','none');
 msSpotCount=0;
}
const msOriginalHide=msHide;
msHide=function(){msHideSpots();return msOriginalHide();};
const msOriginalRender=msRender;
msRender=function(){
 msHideSpots();msOriginalRender();
 if(!msActive()||tlState.loading||msState.segment==='both'||!sgState.data?.meta?.fallback)return;
 const communities=arState.catalogue?.communities||[];
 const features=[];
 for(const row of tlState.frame){
  if(!msK.finite(row.value)||row.geometryIds?.length)continue;
  const matches=communities.filter(c=>SG.key(c.emirate,c.name)===SG.key(row.emirate,row.name)&&Number.isFinite(c.coordinates?.lng)&&Number.isFinite(c.coordinates?.lat));
  const centres=[...new Set(matches.map(c=>c.coordinates.lng.toFixed(5)+','+c.coordinates.lat.toFixed(5)))];
  if(centres.length!==1)continue;
  const [lng,lat]=centres[0].split(',').map(Number);
  features.push({type:'Feature',id:row.id,geometry:{type:'Point',coordinates:[lng,lat]},properties:{name:row.name,period:row.period,value:row.value,color:tlK.color(row.value,tlState.domain,false),locationBasis:'Approximate catalogue community centre; not a source-area boundary'}});
 }
 msSpotCount=features.length;
 sgSource('ms-spots',{type:'FeatureCollection',features});
 if(!features.length){msSync();return;}
 const before=map.getLayer('project-hit')?'project-hit':undefined;
 if(!map.getLayer('ms-spot-halo'))map.addLayer({id:'ms-spot-halo',type:'circle',source:'ms-spots',paint:{'circle-color':['get','color'],'circle-radius':['interpolate',['linear'],['zoom'],6,12,9,22,12,29],'circle-opacity':.25,'circle-blur':.42}},before);
 if(!map.getLayer('ms-spot-core'))map.addLayer({id:'ms-spot-core',type:'circle',source:'ms-spots',paint:{'circle-color':['get','color'],'circle-radius':['interpolate',['linear'],['zoom'],6,5,9,8,12,10],'circle-opacity':.88,'circle-stroke-color':document.documentElement.dataset.espaciosTheme==='light'?'#f6f9fc':'#17283b','circle-stroke-width':1.5}},before);
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
 if(sgState.data?.meta?.fallback){
  const note=tlQ('#tl-note'),status=tlQ('#ms-status');
  const coverage=msSpotCount+' benchmark spot'+(msSpotCount===1?'':'s')+' at approximate catalogue community centres; unmatched areas stay unshaded.';
  if(note&&!note.textContent.includes('benchmark spot'))note.textContent+=' '+coverage;
  if(status&&!status.textContent.includes('benchmark spot'))status.textContent+=' · '+coverage;
 }
};
new MutationObserver(()=>{
 if(map.getLayer('ms-spot-core'))map.setPaintProperty('ms-spot-core','circle-stroke-color',document.documentElement.dataset.espaciosTheme==='light'?'#f6f9fc':'#17283b');
}).observe(document.documentElement,{attributes:true,attributeFilter:['data-espacios-theme']});
