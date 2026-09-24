import * as maplibregl from '/map/vendor/maplibre-gl.mjs?v=6.8.0';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (v='') => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
const norm = (v='') => String(v ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();
const nowYear = 2026;

const state = {
  mapData:null, amenities:null, transport:null, verification:null,
  projects:[], communities:[], initiatives:[], places:[],
  siteProjects:[], allRecords:[], recordById:new Map(),
  timeline:'all', kinds:new Set(['project','community','initiative']),
  roiMode:'off', placeMode:'off', transportModes:new Set(), is3d:true, in3DBuildingRange:false, locationQuality:'all', availabilityMode:'all',
  selected:null, hoverLocked:false, hoverToken:0,
};

const views = {
  uae:{center:[54.55,24.35],zoom:6.55,pitch:0,bearing:0},
  dubai:{center:[55.18,25.08],zoom:10.25,pitch:58,bearing:-17},
  abudhabi:{center:[54.54,24.46],zoom:9.85,pitch:56,bearing:-12},
};

const AE_3D_MIN_ZOOM=9.7;
const AE_3D_ENTRY_PITCH=54;
const AE_3D_LAYERS=['psr-3d-buildings','project-footprint-extrusions','psr-universal-hover-extrusion','psr-universal-selected-extrusion'];

const map = new maplibregl.Map({
  container:'map',
  style:'/map/basemap/styles/dark?v=20260922-auditfix-v13&theme='+(document.documentElement.dataset.espaciosTheme||'dark'),
  ...views.uae,
  minZoom:5,
  maxZoom:18,
  maxPitch:75,
  attributionControl:true,
  canvasContextAttributes:{antialias:!matchMedia('(max-width:760px)').matches}
});
const aeNativeAddLayer=map.addLayer.bind(map);
map.addLayer=(layer,before)=>{
  if(layer?.type==='symbol'&&layer.layout?.['text-field'])layer={...layer,layout:{...layer.layout,'text-font':['Noto Sans Regular']}};
  const result=aeNativeAddLayer(layer,before);queueMicrotask(()=>window.__ESPACIOS_PAINT_MAP__?.());return result;
};
map.addControl(new maplibregl.NavigationControl({visualizePitch:true}), 'bottom-right');
window.__PSR_MAP__=map;window.__PSR_STATE__=state;

function toast(msg){ const el=$('#toast'); el.textContent=msg; el.classList.add('show'); clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove('show'),2400); }
function absHref(href){ if(!href) return '#'; try{return new URL(href, location.origin).href}catch{return href} }
function coordsOf(r){ const c=r?.coordinates; return c && Number.isFinite(Number(c.lng)) && Number.isFinite(Number(c.lat)) ? [Number(c.lng),Number(c.lat)] : null; }

function isFallback(r){ return /fallback|centroid|emirate-level|not a surveyed project-site coordinate|area-level|masterplan location|community location/i.test(String(r.coordinateBasis||'')); }
function validUaeCoord(r){
  const c=coordsOf(r); if(!c)return false;
  return c[1]>=22.45&&c[1]<=26.55&&c[0]>=51.35&&c[0]<=56.65;
}
function locationQuality(r){
  if(!coordsOf(r))return 'unmapped';
  if(!validUaeCoord(r))return 'review';
  return isFallback(r)?'area':'exact';
}
function locationLabel(r){
  const q=locationQuality(r);
  return q==='exact'?'Exact project pin':q==='area'?'Area-level location':q==='review'?'Coordinate review':'Unmapped';
}
function annotateLocationQuality(records){ for(const r of records||[]) r.locationQuality=locationQuality(r); }
function updateLocationQualityUI(){
  const all=state.projects.length;let exact=0,area=0,review=0,unmapped=0;for(const r of state.projects){const q=r.locationQuality||locationQuality(r);if(q==='exact')exact++;else if(q==='area')area++;else if(q==='review')review++;else if(q==='unmapped')unmapped++;}
  const set=(id,v)=>{const el=$(id);if(el)el.textContent=Number(v).toLocaleString()};
  set('#quality-all-count',all);set('#quality-exact-count',exact);set('#quality-area-count',area);
  const q=$('#quality-summary'); if(q)q.textContent=exact.toLocaleString()+' exact · '+area.toLocaleString()+' area-level'+(review?' · '+review.toLocaleString()+' review':'')+(unmapped?' · '+unmapped.toLocaleString()+' unpinned':'');
}


function inferTimeline(p){
  if(p.archived) return 'past';
  const s=norm([p.statusLabel,p.status,p.handover].join(' '));
  if(/archive|historical|completed|ready/.test(s) && !/launch|off plan|under construction/.test(s)) return 'present';
  const years=String(p.handover||'').match(/20\d{2}/g)?.map(Number)||[];
  if(years.some(y=>y>nowYear)) return 'future';
  if(/launch|off plan|under construction|coming soon|future/.test(s)) return 'future';
  return 'present';
}


const PROJECT_LOCATION_OVERRIDES={
  'select-group-six-senses-hotel-residences-for-sale-on-palm-jumeirah-dubai':{
    name:'Six Senses Residences The Palm, Dubai',developer:'Select Group',emirate:'Dubai',area:'Palm Jumeirah – West Crescent',
    coordinates:{lat:25.1004238,lng:55.1177276},
    coordinateBasis:'Official Select Group Google Maps project pin',
    sourceUrl:'https://www.select-group.ae/developments/six-senses-residences-the-palm-dubai',
    locationEvidenceUrl:'https://www.google.com/maps/place/Six+Senses+Residences+The+Palm,+Dubai/@25.1004238,55.1177276,17z',
    sourceLabel:'Select Group official project page and Google Maps location',
    status:'Sold Out - Completed',availability:'Sold out',handover:'Completed May 2026',availability:'Sold out',availabilityVerifiedOn:'2026-09-09',availabilitySource:'https://www.select-group.ae/developments/six-senses-residences-the-palm-dubai'
  },
  'six-senses-residences-dubai-marina-by-select-group':{
    name:'Six Senses Residences Dubai Marina',developer:'Select Group',emirate:'Dubai',area:'Dubai Marina',
    coordinates:{lat:25.0892179,lng:55.1505379},
    coordinateBasis:'Official Select Group Google Maps project pin',
    sourceUrl:'https://www.select-group.ae/developments/six-senses-residences-dubai-marina',
    locationEvidenceUrl:'https://www.google.com/maps/place/Six+Senses+Residences+Dubai+Marina/@25.0892179,55.1505379,17z',
    sourceLabel:'Select Group official project page and Google Maps location',
    status:'Available - Off Plan',availability:'On sale',handover:'2029',availability:'On sale',availabilityVerifiedOn:'2026-09-09',availabilitySource:'https://www.select-group.ae/developments/six-senses-residences-dubai-marina'
  },
  'canal-front-residences-meydan-for-sale-in-dubai':{
    area:'Dubai Water Canal / Al Wasl',coordinates:{lat:25.18579,lng:55.24821},
    coordinateBasis:'Verified project map coordinate — location QA correction'
  },
  'omniyat-the-sterling-apartments-for-sale-in-dubai-business-bay':{
    area:'Business Bay',coordinates:{lat:25.18880,lng:55.28192},
    coordinateBasis:'Verified project map coordinate — location QA correction'
  },
  'xtreme-vision-volante-apartments-dubai':{
    area:'Business Bay',coordinates:{lat:25.18253,lng:55.27163},
    coordinateBasis:'Verified project map coordinate — location QA correction'
  },
  'nura-rak-properties-mina-ras-al-khaimah-uae':{
    area:'Mina Al Arab, Ras Al Khaimah',coordinates:{lat:25.71961,lng:55.83528},
    coordinateBasis:'Verified project map coordinate — location QA correction'
  },
  'tonino-lamborghini-residences-bnw-al-marjan-island-rak':{
    area:'Al Marjan Island, Ras Al Khaimah',coordinates:{lat:25.68272,lng:55.73908},
    coordinateBasis:'Verified project map coordinate — location QA correction'
  },
  'sobha-elwood-jebel-ali-dubai':{
    area:'Dubailand / Al Yalayis',coordinates:{lat:25.02070,lng:55.44974},
    coordinateBasis:'Verified project map coordinate — location QA correction'
  },
  'ovelle-the-valley-emaar-dubai':{
    area:'The Valley, Dubai',coordinates:{lat:25.01584,lng:55.45453},
    coordinateBasis:'Verified project map coordinate — location QA correction'
  },
  'aldar-saadiyat-lagoons-villas-for-sale-on-saadiyat-island-abu-dhabi':{
    area:'Saadiyat Island, Abu Dhabi',coordinates:{lat:24.54040,lng:54.45240},
    coordinateBasis:'Verified masterplan location — not a surveyed villa pin'
  },
  'hudayriyat-island-by-modon-properties-abu-dhabi':{
    area:'Hudayriyat Island, Abu Dhabi',coordinates:{lat:24.41706,lng:54.36027},
    coordinateBasis:'Verified masterplan location — not a surveyed building pin'
  },
  'beachfront-island-villas-for-sale-in-abu-dhabi':{
    area:'Ramhan Island, Abu Dhabi',coordinates:{lat:24.53650,lng:54.52450},
    coordinateBasis:'Verified masterplan location — not a surveyed villa pin'
  },
  'dubai-properties-serena-townhouses':{
    area:'Serena, Dubailand',coordinates:{lat:25.03546,lng:55.28594},
    coordinateBasis:'Verified community location — not a surveyed project-site pin'
  },
  'cascada-waada-dubai-south':{
    area:'WAADA, Dubai South',coordinates:{lat:24.83814,lng:55.11479},
    coordinateBasis:'Verified masterplan location — exact tower pin pending'
  },
  'alandalus-jumeirah-golf-estates-dubai':{
    area:'Al Andalus, Jumeirah Golf Estates',coordinates:{lat:25.02045,lng:55.188085},
    coordinateBasis:'Verified area-level Al Andalus location — exact unit/building pin pending'
  }
};
const REJECTED_FALSE_FALLBACK_SLUGS=new Set([
  'davinci-tower-by-pagani-dar-al-arkan-apartments-for-sale-in-dubai',
  'tiger-downtown-ajman-uae',
  'w-residences-dubai'
]);
function applyProjectLocationCorrections(records){
  for(const r of records||[]){
    const o=PROJECT_LOCATION_OVERRIDES[r.slug];
    if(o){
      Object.assign(r,o);
      r.coordinates=o.coordinates?{...o.coordinates}:r.coordinates;
      r.unmapped=!r.coordinates;
      r.locationCorrected=true;
      continue;
    }
    if(REJECTED_FALSE_FALLBACK_SLUGS.has(r.slug)&&isFallback(r)){
      r.coordinates=null;
      r.unmapped=true;
      r.locationCorrected=true;
      r.coordinateBasis='Previous false community-centroid fallback rejected by location QA — exact project coordinate pending';
    }
  }
  return records;
}

function communityMatch(project, communities){
  const area=norm(project.area); if(!area) return null;
  const emirate=norm(project.emirate);
  const stop=new Set(['dubai','abu','dhabi','emirate','uae','united','arab','emirates','city','island','district','community','the','at','in','of','and','by','properties','development']);
  const areaTokens=area.split(' ').filter(x=>x.length>2&&!stop.has(x));
  if(!areaTokens.length) return null;
  let best=null,bestScore=0;
  for(const c of communities){
    if(emirate && norm(c.emirate)!==emirate) continue;
    const cn=norm(c.name);
    const cTokens=cn.split(' ').filter(x=>x.length>2&&!stop.has(x));
    if(!cTokens.length) continue;
    const overlap=cTokens.filter(t=>areaTokens.includes(t));
    let score=overlap.length*34;
    if(area===cn) score+=180;
    else if(area.includes(cn)&&cTokens.length) score+=130;
    else if(cn.includes(area)&&areaTokens.length>=2) score+=95;
    if(overlap.some(t=>t.length>=7)) score+=30;
    if(score>bestScore){bestScore=score;best=c;}
  }
  return bestScore>=72?best:null;
}

function mergeSiteIntoMap(mapProjects, siteProjects, communities){
  const bySlug=new Map(mapProjects.map(p=>[p.slug,p]));
  const siteBySlug=new Map(siteProjects.map(p=>[p.slug,p]));
  const merged=[];
  const seen=new Set();
  for(const base of mapProjects){
    const live=siteBySlug.get(base.slug);
    if(live){
      merged.push({...base,
        name:live.name||live.title||base.name,
        developer:live.developer||base.developer,
        emirate:live.emirate||base.emirate,
        area:live.area||base.area,
        image:live.image||base.image,
        price:live.price||base.price,
        paymentPlan:live.paymentPlan||base.paymentPlan,
        handover:live.handover||base.handover,
        status:live.statusLabel||base.status,
        href:absHref(live.href||base.href),
        siteUpdatedAt:live.updatedAt||null,
        bedrooms:live.bedrooms||base.bedrooms,
        propertyTypes:live.propertyTypes||base.propertyTypes,
        summary:live.summary||base.summary,
        timeline:base.timeline||inferTimeline(live),
        liveSite:true
      });
      seen.add(base.slug);
    } else merged.push({...base,href:absHref(base.href)});
  }
  for(const live of siteProjects){
    if(seen.has(live.slug) || bySlug.has(live.slug)) continue;
    const c=communityMatch(live,communities);
    merged.push({
      id:'project:'+live.slug,kind:'project',slug:live.slug,name:live.name||live.title||live.slug,
      developer:live.developer,emirate:live.emirate,area:live.area,price:live.price,handover:live.handover,
      status:live.statusLabel||'Current PSR catalogue',timeline:inferTimeline(live),archived:false,
      coordinates:c?.coordinates?{...c.coordinates}:null,href:absHref(live.href||('/projects/'+live.slug)),sourceUrl:null,sourceLabel:'PSR live catalogue API',
      image:live.image||null,coordinateBasis:c?('Community centroid fallback — '+c.name+'; not a surveyed project-site coordinate'):'No verified project or community coordinate — searchable but intentionally unpinned',
      paymentPlan:live.paymentPlan,bedrooms:live.bedrooms,propertyTypes:live.propertyTypes,summary:live.summary,siteUpdatedAt:live.updatedAt,liveSite:true,siteOnly:true,unmapped:!c
    });
  }
  return merged;
}


const MASTER_AVAILABILITY_ROWS=[["Burj Khalifa","BURJ KHALIFA TOWERS","Ready","On sale","1462","https://www.mitchellscommercialrealty.com/off-plan/burj-khalifa-towers","2026-09-09"],["52 | 42 Tower 1","52 | 42 Tower 1","Ready",null,null,"https://dubricks.com/","2026-09-09"],["Address Residences Zabeel","Address Residences Zabeel","Under construction","On sale","2957","https://www.mitchellscommercialrealty.com/off-plan/address-residences-zabeel","2026-09-09"],["Arabian Ranches 3","Arabian Ranches 3 (master development)","Under construction","Sold out","MULTIPLE","https://www.emaar.com/","2026-09-09"],["Creek Gate","Creek Gate","Ready",null,"1813","https://www.mitchellscommercialrealty.com/off-plan/creek-gate","2026-09-09"],["A La Carte Villas","A La Carte Villas","Under construction","On sale",null,"https://dubricks.com/development/damac-hills","2026-09-09"],["Altitude de Grisogono","Altitude de Grisogono","Under construction","Sold out",null,"https://www.propertystellar.com/new-projects/dubai/altitude-de-grisogono","2026-09-09"],["Antigua at Damac Islands","DAMAC ISLANDS 2 - ANTIGUA 1","Under construction",null,"4369","https://dubricks.com/project/antigua-1","2026-09-09"],["Amargo (Duo Prestige Villas)","Amargo","Ready","On sale","1840","https://www.dubricks.com/project/amargo","2026-09-09"],["Artesia","DAMAC HILLS - ARTESIA","Ready",null,"1523","https://www.mitchellscommercialrealty.com/off-plan/damac-hills-artesia","2026-09-09"],["Al Furjan Villas","Al Furjan Villas","Ready","Sold out","MULTIPLE","https://www.nakheel.com/en/developments/nakheel-projects/alfurjan","2026-09-09"],["Azure Blue Villas","Azure Blue Villas","Ready","Sold out",null,"https://www.nakheel.com/","2026-09-09"],["Al Furjan Pavilion","Al Furjan Pavilion","Ready",null,null,"https://www.nakheel.com/en/developments/nakheel-projects/alfurjan","2026-09-09"],["Al Khail Avenue Mall","Al Khail Avenue Mall","Under construction",null,null,"https://www.nakheel.com/","2026-09-09"],["Avani Deira Island Resort","Avani Deira Island Resort",null,null,null,"https://www.nakheel.com/","2026-09-09"],["Ain Dubai Observation Wheel","Ain Dubai","Ready",null,null,"https://www.aindubai.com/en/contact-us","2026-09-09"],["Al Jazi - Madinat Jumeriah Living","Al Jazi - Madinat Jumeriah Living","Under construction",null,"2407","https://www.mitchellscommercialrealty.com/off-plan/al-jazi-madinat-jumeriah-living","2026-09-09"],["Al Jazi Building 1","Al Jazi - Madinat Jumeriah Living","Ready","On sale","2407","https://www.mitchellscommercialrealty.com/off-plan/al-jazi-madinat-jumeriah-living","2026-09-09"],["Al Mamzar Front","Al Mamzar Front","Under construction","On sale",null,"https://www.bayut.com/area-guides/al-mamzar-front/","2026-09-09"],["Amalfi Villa","Villa Amalfi","Under construction",null,"2114","https://disruptiveestate.com/off-plan/villa-amalfi","2026-09-09"],["Adeba Azizi","ADEBA AZIZI","Ready","Sold out","2917","https://www.mitchellscommercialrealty.com/off-plan/adeba-azizi","2026-09-09"],["Arian By Azizi","Arian By Azizi","Under construction","On sale","3510","https://disruptiveestate.com/off-plan/arian","2026-09-09"],["Azizi Abraham","Azizi Abraham","Under construction","Sold out","4024","https://continentalclub.ae/project/azizi-abraham-downtown-jebel-ali/","2026-09-09"],["Azizi Amber","Azizi Amber","Ready","Sold out","2624","https://www.azizidevelopments.com/","2026-09-09"],["Azizi Ameer","Azizi Amir","Under construction","On sale","3844","https://uaepropertychecker.com/developers/azizi","2026-09-09"],["310 Riverside Crescent","310 Riverside Crescent","Under construction","On sale","3067","https://www.propertystellar.com/new-projects/dubai/310-riverside-crescent","2026-09-09"],["320 Riverside Crescent","320 Riverside Crescent","Under construction","On sale","3088","https://www.mitchellscommercialrealty.com/off-plan/320-riverside-crescent","2026-09-09"],["330 Riverside Crescent","330 Riverside Crescent","Under construction","Sold out","2788","https://www.mitchellscommercialrealty.com/off-plan/330-riverside-crescent","2026-09-09"],["340 Riverside Crescent","340 Riverside Crescent","Under construction","Sold out","3082","https://www.mitchellscommercialrealty.com/off-plan/340-riverside-crescent","2026-09-09"],["350 Riverside Crescent","350 Riverside Crescent","Under construction","On sale","3083","https://www.propertystellar.com/new-projects/dubai/350-riverside-crescent","2026-09-09"],["Al Deem Townhomes","Al Deem Townhomes","Under construction","On sale","20250000555235","https://adrec.gov.ae/Directory/ProjectsDetails?projectId=620","2026-09-09"],["Al Ghadeer 2 By Aldar","Al Ghadeer - Phase 2 (Tala)","Under construction","Sold out",null,"https://www.aldar.com/properties/en/alghadeer","2026-09-09"],["Al Ghadeer Gardens","Al Ghadeer Gardens","Under construction","On sale",null,"https://www.aldar.com/en/news-and-media/aldar-unveils-al-ghadeer-gardens-bringing-modern-family-living-to-the-key-growth-corridor-between-abu-dhabi-and-dubai","2026-09-09"],["Al Sidr","Saadiyat Lagoons Phase 2- AL SIDR","Under construction","Sold out","2023/17878","https://adxinteract.com/abu-dhabi-new-projects/saadiyat-lagoons-phase-2-al-sidr","2026-09-09"],["Aldar Expo City","Aldar developments at Expo City Dubai","Under construction",null,"MULTIPLE / PARTNERSHIP","https://www.expocitydubai.com/","2026-09-09"],["Aurora by Binghatti","Binghatti Aurora","Ready","Sold out",null,"https://www.binghatti.com/en/project-details/binghatti-aurora/10026","2026-09-09"],["Binghatti Amber","Binghatti Amber","Ready","Sold out","2673","https://www.mitchellscommercialrealty.com/off-plan/binghatti-amber","2026-09-09"],["Binghatti Amberhall","Binghatti Amberhall","Under construction","On sale","3552","https://dubaihandover.com/projects/3552-binghatti-amberhall","2026-09-09"],["Binghatti Apex","Binghatti Apex","Under construction","On sale","3066","https://www.mitchellscommercialrealty.com/off-plan/binghatti-apex","2026-09-09"],["Binghatti Aquarise","Binghatti Aquarise","Under construction","On sale","3585","https://disruptiveestate.com/off-plan/binghatti-aquarise","2026-09-09"],["180 Degree","180 Degree","Ready",null,"2351","https://dubricks.com/project/180-degree","2026-09-09"],["Altiera Heights","ELTIERA HEIGHTS","Under construction","On sale","3852","https://www.propertyfinder.ae/en/new-projects/ellington/altiera-heights","2026-09-09"],["Arbor View","ARBOR VIEW","Under construction","Sold out","2814","https://www.mitchellscommercialrealty.com/off-plan/arbor-view","2026-09-09"],["Art Bay","ART BAY EAST + ART BAY WEST","Under construction","Sold out","2994 + 2996","https://dubricks.com/project/art-bay-west","2026-09-09"],["Art Bay East","ART BAY EAST","Under construction","Sold out","2994","https://continentalclub.ae/project/art-bay-east-healthcare-city-phase-2/","2026-09-09"],["Al Khail Gate","Al Khail Gate","Ready",null,"MULTIPLE / COMMUNITY","https://dubairesidential.ae/en/our-communities/al-khail-gate","2026-09-09"],["Al Ramth","Remraam - Al Ramth","Ready",null,"1924","https://www.mitchellscommercialrealty.com/off-plan/remraam-al-ramth","2026-09-09"],["Al Wasl Plaza","Al Wasl Plaza","Ready",null,null,"https://www.expocitydubai.com/","2026-09-09"],["Amaranta 1","Villanova Amaranta","Ready",null,"1817","https://www.forrsa.com/market/projects/villanova-amaranta","2026-09-09"],["Amaranta 2","AMARANTA 2","Ready",null,"2017","https://dubricks.com/project/amaranta-2","2026-09-09"]];
let masterAvailabilityIndex=null;
function buildMasterAvailabilityIndex(){
  if(masterAvailabilityIndex)return masterAvailabilityIndex;
  const idx=new Map();
  for(const row of MASTER_AVAILABILITY_ROWS){
    const [project,registered,status,availability,rera,source,verifiedOn]=row;
    const item={project,registered,status,availability,rera,source,verifiedOn};
    for(const key of [project,registered].map(norm).filter(Boolean)) if(!idx.has(key))idx.set(key,item);
  }
  masterAvailabilityIndex=idx; return idx;
}
function attachMasterAvailability(records){
  const idx=buildMasterAvailabilityIndex();
  for(const r of records||[]){
    if(r.kind!=='project')continue;
    const keys=[r.name,r.verification?.project,r.verification?.registeredProjectName].map(norm).filter(Boolean);
    let hit=null;
    for(const k of keys){if(idx.has(k)){hit=idx.get(k);break;}}
    if(!hit)continue;
    if(hit.status&&!r.masterStatus)r.masterStatus=hit.status;
    if(hit.availability)r.availability=hit.availability;
    if(hit.rera&&!r.masterRera)r.masterRera=hit.rera;
    r.availabilitySource=hit.source||r.availabilitySource;
    r.availabilityVerifiedOn=hit.verifiedOn||r.availabilityVerifiedOn;
    r.masterAvailabilityMatch=hit.project;
  }
}


const MASTER_ONLY_PROJECTS=[{"project":"Arabian Ranches 3","registered":"Arabian Ranches 3 (master development)","developer":"Emaar","emirate":"Dubai","community":"Arabian Ranches 3","status":"Under construction","availability":"Sold out","rera":"MULTIPLE","latitude":null,"longitude":null,"pinPrecision":"Project-name + master-community map search","source":"https://www.emaar.com/","verifiedOn":"2026-09-09"},{"project":"Amargo (Duo Prestige Villas)","registered":"Amargo","developer":"DAMAC Properties","emirate":"Dubai","community":"DAMAC Hills 2","status":"Ready","availability":"On sale","rera":"1840","latitude":null,"longitude":null,"pinPrecision":"Project-name + master-community map search","source":"https://www.dubricks.com/project/amargo","verifiedOn":"2026-09-09"},{"project":"Azure Blue Villas","registered":"Azure Blue Villas","developer":"Nakheel","emirate":"Dubai","community":"Palm Jebel Ali","status":"Ready","availability":"Sold out","rera":null,"latitude":null,"longitude":null,"pinPrecision":"Project-name + master-community map search","source":"https://www.nakheel.com/","verifiedOn":"2026-09-09"},{"project":"Al Jazi Building 1","registered":"Al Jazi - Madinat Jumeriah Living","developer":"Meraas","emirate":"Dubai","community":"Madinat Jumeirah Living","status":"Ready","availability":"On sale","rera":"2407","latitude":null,"longitude":null,"pinPrecision":"Project-name + master-community map search","source":"https://www.mitchellscommercialrealty.com/off-plan/al-jazi-madinat-jumeriah-living","verifiedOn":"2026-09-09"},{"project":"Al Mamzar Front","registered":"Al Mamzar Front","developer":"Meraas","emirate":"Dubai","community":"Al Mamzar Front","status":"Under construction","availability":"On sale","rera":null,"latitude":null,"longitude":null,"pinPrecision":"Project-name + master-community map search","source":"https://www.bayut.com/area-guides/al-mamzar-front/","verifiedOn":"2026-09-09"},{"project":"Adeba Azizi","registered":"ADEBA AZIZI","developer":"Azizi Developments","emirate":"Dubai","community":"Dubai Healthcare City Phase 2","status":"Ready","availability":"Sold out","rera":"2917","latitude":null,"longitude":null,"pinPrecision":"Project-name + master-community map search","source":"https://www.mitchellscommercialrealty.com/off-plan/adeba-azizi","verifiedOn":"2026-09-09"},{"project":"Arian By Azizi","registered":"Arian By Azizi","developer":"Azizi Developments","emirate":"Dubai","community":"Downtown Jebel Ali","status":"Under construction","availability":"On sale","rera":"3510","latitude":null,"longitude":null,"pinPrecision":"Project-name + master-community map search","source":"https://disruptiveestate.com/off-plan/arian","verifiedOn":"2026-09-09"},{"project":"Azizi Abraham","registered":"Azizi Abraham","developer":"Azizi Developments","emirate":"Dubai","community":"Downtown Jebel Ali","status":"Under construction","availability":"Sold out","rera":"4024","latitude":null,"longitude":null,"pinPrecision":"Project-name + master-community map search","source":"https://continentalclub.ae/project/azizi-abraham-downtown-jebel-ali/","verifiedOn":"2026-09-09"},{"project":"Azizi Amber","registered":"Azizi Amber","developer":"Azizi Developments","emirate":"Dubai","community":"Al Furjan","status":"Ready","availability":"Sold out","rera":"2624","latitude":null,"longitude":null,"pinPrecision":"Project-name + master-community map search","source":"https://www.azizidevelopments.com/","verifiedOn":"2026-09-09"},{"project":"Azizi Ameer","registered":"Azizi Amir","developer":"Azizi Developments","emirate":"Dubai","community":"Al Furjan","status":"Under construction","availability":"On sale","rera":"3844","latitude":null,"longitude":null,"pinPrecision":"Project-name + master-community map search","source":"https://uaepropertychecker.com/developers/azizi","verifiedOn":"2026-09-09"},{"project":"Al Deem Townhomes","registered":"Al Deem Townhomes","developer":"Aldar","emirate":"Abu Dhabi","community":"Al Bahyah / Bal Ghaiylam","status":"Under construction","availability":"On sale","rera":"20250000555235","latitude":null,"longitude":null,"pinPrecision":"Project-name + master-community map search","source":"https://adrec.gov.ae/Directory/ProjectsDetails?projectId=620","verifiedOn":"2026-09-09"},{"project":"Al Ghadeer 2 By Aldar","registered":"Al Ghadeer - Phase 2 (Tala)","developer":"Aldar","emirate":"Abu Dhabi","community":"Al Ghadeer","status":"Under construction","availability":"Sold out","rera":null,"latitude":null,"longitude":null,"pinPrecision":"Project-name + master-community map search","source":"https://www.aldar.com/properties/en/alghadeer","verifiedOn":"2026-09-09"},{"project":"Al Sidr","registered":"Saadiyat Lagoons Phase 2- AL SIDR","developer":"Aldar","emirate":"Abu Dhabi","community":"Saadiyat Lagoons / Saadiyat Island","status":"Under construction","availability":"Sold out","rera":"2023/17878","latitude":24.53974,"longitude":54.44153,"pinPrecision":"Exact sourced coordinates","source":"https://adxinteract.com/abu-dhabi-new-projects/saadiyat-lagoons-phase-2-al-sidr","verifiedOn":"2026-09-09"},{"project":"Aurora by Binghatti","registered":"Binghatti Aurora","developer":"Binghatti Developers","emirate":"Dubai","community":"Jumeirah Village Circle (JVC)","status":"Ready","availability":"Sold out","rera":null,"latitude":null,"longitude":null,"pinPrecision":"Project-name + master-community map search","source":"https://www.binghatti.com/en/project-details/binghatti-aurora/10026","verifiedOn":"2026-09-09"},{"project":"Binghatti Amber","registered":"Binghatti Amber","developer":"Binghatti Developers","emirate":"Dubai","community":"Jumeirah Village Circle (JVC)","status":"Ready","availability":"Sold out","rera":"2673","latitude":null,"longitude":null,"pinPrecision":"Project-name + master-community map search","source":"https://www.mitchellscommercialrealty.com/off-plan/binghatti-amber","verifiedOn":"2026-09-09"},{"project":"Binghatti Amberhall","registered":"Binghatti Amberhall","developer":"Binghatti Developers","emirate":"Dubai","community":"Jumeirah Village Circle (JVC)","status":"Under construction","availability":"On sale","rera":"3552","latitude":null,"longitude":null,"pinPrecision":"Project-name + master-community map search","source":"https://dubaihandover.com/projects/3552-binghatti-amberhall","verifiedOn":"2026-09-09"},{"project":"Binghatti Apex","registered":"Binghatti Apex","developer":"Binghatti Developers","emirate":"Dubai","community":"Jumeirah Village Circle (JVC)","status":"Under construction","availability":"On sale","rera":"3066","latitude":null,"longitude":null,"pinPrecision":"Project-name + master-community map search","source":"https://www.mitchellscommercialrealty.com/off-plan/binghatti-apex","verifiedOn":"2026-09-09"},{"project":"Altiera Heights","registered":"ELTIERA HEIGHTS","developer":"Ellington Properties","emirate":"Dubai","community":"Jumeirah Islands","status":"Under construction","availability":"On sale","rera":"3852","latitude":null,"longitude":null,"pinPrecision":"Project-name + master-community map search","source":"https://www.propertyfinder.ae/en/new-projects/ellington/altiera-heights","verifiedOn":"2026-09-09"}];
function masterSlug(v=''){return norm(v).replace(/ /g,'-')||'record'}
function injectMasterOnlyProjects(records){
  const existing=records||[],names=new Set(existing.map(r=>norm(r.name)).filter(Boolean));
  const addRecord=(m,minimal=false)=>{
    const pk=norm(m.project),rk=norm(m.registered);if(names.has(pk)||names.has(rk))return;
    const exact=Number.isFinite(Number(m.latitude))&&Number.isFinite(Number(m.longitude))&&/exact|landmark/i.test(String(m.pinPrecision||''))&&!/approximate|centroid|offset/i.test(String(m.pinPrecision||''));
    const r={id:'master:'+masterSlug(m.project),kind:'project',slug:'master-'+masterSlug(m.project),name:m.project,developer:m.developer||null,emirate:m.emirate||null,area:m.community||null,status:m.status,masterStatus:m.status,availability:m.availability,masterRera:m.rera,availabilitySource:m.source,sourceUrl:m.source,availabilityVerifiedOn:m.verifiedOn,masterAvailabilityMatch:m.project,timeline:inferTimeline({status:m.status}),archived:false,liveSite:false,masterOnly:true,coordinates:exact?{lat:Number(m.latitude),lng:Number(m.longitude)}:null,coordinateBasis:exact?'Exact sourced coordinates — uploaded master workbook':'No exact coordinate in uploaded master workbook — searchable and availability-synced; intentionally unpinned',href:'#',unmapped:!exact};
    existing.push(r);names.add(pk);if(rk)names.add(rk);
  };
  for(const m of MASTER_ONLY_PROJECTS)addRecord(m);
  const rich=new Map(MASTER_ONLY_PROJECTS.map(m=>[norm(m.project),m]));
  const verificationByName=new Map();for(const [__vi,__v] of (state.verification?.projects||[]).entries()){for(const __k of [__v.project,__v.registeredProjectName].map(norm).filter(Boolean))if(!verificationByName.has(__k))verificationByName.set(__k,{row:__v,index:__vi})}
  const represented=new Set(existing.map(r=>norm(r.masterAvailabilityMatch)).filter(Boolean));
  for(const row of MASTER_AVAILABILITY_ROWS){const [project,registered,status,availability,rera,source,verifiedOn]=row;if(!availability||represented.has(norm(project)))continue;const __a=verificationByName.get(norm(project)),__b=verificationByName.get(norm(registered)),vr=!__a?__b?.row:!__b?__a.row:(__a.index<=__b.index?__a.row:__b.row);const m=rich.get(norm(project))||{project,registered,status,availability,rera,source,verifiedOn,developer:vr?.developer,emirate:vr?.emirate,community:vr?.masterCommunity,latitude:vr?.latitude,longitude:vr?.longitude,pinPrecision:vr?.pinPrecision};addRecord(m,true);represented.add(norm(project));}
  return existing;
}


function availabilityClass(r){
  const a=norm(r?.availability||'');
  if(/sold out|soldout/.test(a))return 'sold-out';
  if(/on sale|available|availability open|selling/.test(a))return 'on-sale';
  return 'unverified';
}
function availabilityLabel(r){
  const c=availabilityClass(r);
  return c==='on-sale'?'On sale':c==='sold-out'?'Sold out':'Availability not verified';
}
function updateAvailabilityUI(){
  const total=state.projects.length;let on=0,sold=0;for(const r of state.projects){const a=availabilityClass(r);if(a==='on-sale')on++;else if(a==='sold-out')sold++;}const un=total-on-sold;
  const set=(id,v)=>{const el=$(id);if(el)el.textContent=Number(v).toLocaleString()};
  set('#availability-all-count',total);set('#availability-on-sale-count',on);set('#availability-sold-out-count',sold);set('#availability-unverified-count',un);
  const el=$('#availability-summary');if(el)el.textContent=(on+sold).toLocaleString()+' verified availability matches · '+on.toLocaleString()+' on sale · '+sold.toLocaleString()+' sold out';
}

function buildVerificationIndexes(v){
  const p=new Map(),d=new Map();
  for(const row of v?.projects||[]){
    const keys=[norm(row.project), norm(row.registeredProjectName)].filter(Boolean);
    for(const k of keys) p.set(k,row);
  }
  for(const row of v?.developers||[]){
    for(const key of [row.developerName,row.catalogMatchName].map(norm).filter(Boolean)) if(!d.has(key)) d.set(key,row);
  }
  return {p,d};
}

function verificationNameRatio(a,b){const aa=norm(a).split(' ').filter(Boolean),bb=norm(b).split(' ').filter(Boolean);if(!aa.length||!bb.length)return 0;const A=aa.join(' '),B=bb.join(' ');if(!(A.includes(B)||B.includes(A)))return 0;return Math.min(aa.length,bb.length)/Math.max(aa.length,bb.length);}
function verificationContextScore(r,row){let s=0;const re=norm(r.emirate),ve=norm(row.emirate);if(re&&ve&&re===ve)s+=80;const rd=norm(r.developer),vd=norm(row.developer);if(rd&&vd&&(rd===vd||rd.includes(vd)||vd.includes(rd)))s+=110;const area=norm(r.area),mc=norm(row.masterCommunity);if(area&&mc){const ats=new Set(area.split(' ').filter(x=>x.length>2)),mts=mc.split(' ').filter(x=>x.length>2);const ov=mts.filter(x=>ats.has(x)).length;if(ov)s+=Math.min(100,ov*45);if(area.includes(mc)||mc.includes(area))s+=70;}return s;}
function attachVerification(records){
  const list=records||[],entries=[],byName=new Map();
  for(const r of list){
    delete r.verification;if(r.kind!=='project')continue;
    const area=norm(r.area),name=norm(r.name),developer=norm(r.developer),emirate=norm(r.emirate);
    const e={r,name,developer,emirate,area,areaTokens:area?new Set(area.split(' ').filter(x=>x.length>2)):null};entries.push(e);
    if(name){let bucket=byName.get(name);if(!bucket)byName.set(name,bucket=[]);bucket.push(e)}
  }
  const rows=state.verification?.projects||[],claimed=new Set();
  const ratio=(A,B)=>{if(!A||!B)return 0;const aa=A.split(' ').filter(Boolean),bb=B.split(' ').filter(Boolean);if(!aa.length||!bb.length)return 0;if(!(A.includes(B)||B.includes(A)))return 0;return Math.min(aa.length,bb.length)/Math.max(aa.length,bb.length)};
  const exactCandidate=(name,ve)=>{if(!name)return null;const bucket=byName.get(name);if(!bucket)return null;for(const e of bucket){if(claimed.has(e.r.id))continue;if(ve&&e.emirate&&ve!==e.emirate)continue;return e.r}return null};
  for(const row of rows){
    const pn=norm(row.project),rn=norm(row.registeredProjectName),ve=norm(row.emirate),vd=norm(row.developer),mc=norm(row.masterCommunity),mts=mc?mc.split(' ').filter(x=>x.length>2):[];
    let best=exactCandidate(pn,ve),bestScore=best?1300:-1;if(!best&&rn){best=exactCandidate(rn,ve);if(best)bestScore=1275}
    if(!best){for(const e of entries){if(claimed.has(e.r.id))continue;if(ve&&e.emirate&&ve!==e.emirate)continue;if(!e.name)continue;const vr=Math.max(ratio(e.name,pn),ratio(e.name,rn));if(vr<.72)continue;let ctx=0;if(e.emirate&&ve&&e.emirate===ve)ctx+=80;if(e.developer&&vd&&(e.developer===vd||e.developer.includes(vd)||vd.includes(e.developer)))ctx+=110;if(e.area&&mc){let ov=0;if(e.areaTokens)for(const x of mts)if(e.areaTokens.has(x))ov++;if(ov)ctx+=Math.min(100,ov*45);if(e.area.includes(mc)||mc.includes(e.area))ctx+=70}if(ctx<80)continue;const score=700+Math.round(vr*250)+ctx;if(score>bestScore){bestScore=score;best=e.r}}}
    if(best&&bestScore>=900){best.verification=row;claimed.add(best.id)}
  }
}

function applyExactVerificationCoordinates(records){for(const r of records||[]){const v=r.verification;if(!v||r.locationCorrected)continue;const lat=Number(v.latitude),lng=Number(v.longitude),p=String(v.pinPrecision||'');const exact=Number.isFinite(lat)&&Number.isFinite(lng)&&/exact|landmark/i.test(p)&&!/approximate|centroid|offset/i.test(p);if(!exact)continue;r.coordinates={lat,lng};r.coordinateBasis='Verified exact coordinate — '+p;r.unmapped=false;}}


async function fetchAllSiteProjects(){
  try{
    const first=await fetch('/map/api/projects-batch?start=1&count=1').then(r=>{if(!r.ok)throw Error('batch api');return r.json()});
    const unique=[...new Map((first.projects||[]).map(x=>[x.slug,x])).values()];state.siteProjects=unique;
    const pages=Number(first.pages)||46;if(pages>1)setTimeout(()=>psrContinueLiveProjectBatches(2,pages),1400);
    return {projects:unique,total:first.total||unique.length,registry:first.registry||null};
  }catch(e){return {projects:[],total:0,error:e};}
}
async function psrContinueLiveProjectBatches(start,pages){
  try{
    const agg=await fetch('/map/api/projects-all').then(r=>{if(!r.ok)throw Error('aggregate '+r.status);return r.json()});
    const rows=agg.projects||agg.data||[];
    if(Array.isArray(rows)&&rows.length){
      state.siteProjects=[...new Map(rows.filter(x=>x?.slug).map(x=>[x.slug,x])).values()];
      state.projects=mergeSiteIntoMap(state.mapData.projects||[],state.siteProjects,state.communities);applyProjectLocationCorrections(state.projects);attachVerification(state.projects);applyExactVerificationCoordinates(state.projects);attachMasterAvailability(state.projects);injectMasterOnlyProjects(state.projects);annotateLocationQuality(state.projects);rebuildIndexes();refreshSources();
      $('#sync-pill span').textContent=state.siteProjects.length.toLocaleString()+' live projects enriched';
      if(state.analysisMetric!=='off')psrSetAnalysis(state.analysisMetric);
      state.liveSyncDone=true;$('#sync-pill').classList.add('ready');$('#sync-pill span').textContent=state.siteProjects.length.toLocaleString()+' live PSR projects synced';
      return;
    }
  }catch(e){console.warn('aggregate project sync fallback',e)}
  for(let s=start;s<=pages;s+=2){
    try{
      const j=await fetch('/map/api/projects-batch?start='+s+'&count='+Math.min(2,pages-s+1)).then(r=>r.json()),all=[...(state.siteProjects||[]),...(j.projects||[])];
      state.siteProjects=[...new Map(all.filter(x=>x?.slug).map(x=>[x.slug,x])).values()];
      state.projects=mergeSiteIntoMap(state.mapData.projects||[],state.siteProjects,state.communities);applyProjectLocationCorrections(state.projects);attachVerification(state.projects);applyExactVerificationCoordinates(state.projects);attachMasterAvailability(state.projects);injectMasterOnlyProjects(state.projects);annotateLocationQuality(state.projects);rebuildIndexes();refreshSources();
      $('#sync-pill span').textContent=state.siteProjects.length.toLocaleString()+' live projects enriched';
      if(state.analysisMetric!=='off')psrSetAnalysis(state.analysisMetric);
    }catch(e){console.warn('progressive project batch',s,e)}
    await new Promise(r=>setTimeout(r,220));
  }
  state.liveSyncDone=true;$('#sync-pill').classList.add('ready');$('#sync-pill span').textContent=(state.siteProjects||[]).length.toLocaleString()+' live PSR projects synced';
}


function pointFeature(r){ const c=coordsOf(r); if(!c)return null; return {type:'Feature',geometry:{type:'Point',coordinates:c},properties:{id:r.id,kind:r.kind,timeline:r.timeline||'present',fallback:isFallback(r)?1:0,quality:locationQuality(r),name:r.name||''}}; }
function fc(features){return {type:'FeatureCollection',features:features.filter(Boolean)}}

function projectGeo(){ return fc(filteredProjects().map(pointFeature)); }
function communityGeo(){ return fc(state.kinds.has('community')?state.communities.map(pointFeature):[]); }
function initiativeGeo(){ return fc(state.kinds.has('initiative')?state.initiatives.filter(timelineMatch).map(pointFeature):[]); }
function roiGeo(){
  if(state.roiMode==='off') return fc([]);
  const vals=state.communities.filter(c=>c.roi&&Number(c.roi[state.roiMode])>0);
  const numbers=vals.map(c=>Number(c.roi[state.roiMode])); const lo=Math.min(...numbers,0), hi=Math.max(...numbers,1);
  return fc(vals.map(c=>{const f=pointFeature(c); if(!f)return null; const v=Number(c.roi[state.roiMode]); f.properties.roi=v; f.properties.weight=hi===lo?1:(v-lo)/(hi-lo); f.properties.label=v.toFixed(1)+'%'; return f;}));
}
function filteredProjects(){ if(!state.kinds.has('project'))return []; let arr=state.projects.filter(timelineMatch); if(state.locationQuality==='exact')arr=arr.filter(r=>locationQuality(r)==='exact'); else if(state.locationQuality==='area')arr=arr.filter(r=>locationQuality(r)==='area'); if(state.availabilityMode!=='all')arr=arr.filter(r=>availabilityClass(r)===state.availabilityMode); return arr; }
function timelineMatch(r){ return state.timeline==='all'||r.timeline===state.timeline; }

function placeGeo(){
  if(state.placeMode==='off')return fc([]);
  const arr=state.placeMode==='all'?state.places:state.places.filter(p=>(p.categories||[p.category]).includes(state.placeMode));
  return fc(arr.map(p=>({type:'Feature',geometry:{type:'Point',coordinates:[p.coordinates.lng,p.coordinates.lat]},properties:{id:p.id,category:p.category,name:p.name}})));
}

function transportGeo(){
  if(!state.transportModes.size)return fc([]);
  const allowed=new Set();
  if(state.transportModes.has('road'))allowed.add('road');
  if(state.transportModes.has('metro'))['metro','tram','metro_station','tram_station'].forEach(x=>allowed.add(x));
  if(state.transportModes.has('rail'))['rail','rail_station'].forEach(x=>allowed.add(x));
  if(state.transportModes.has('marine'))['marine','marine_station'].forEach(x=>allowed.add(x));
  return {type:'FeatureCollection',features:(state.transport?.features||[]).filter(f=>allowed.has(f.properties?.category))};
}

function aeBuildingSourceId(){return map.getSource('openmaptiles')?'openmaptiles':'psr-buildings'}
function add3DBuildings(){
  if(map.getLayer('psr-3d-buildings')){set3DLayerVisibility(state.is3d);return;}
  const buildingSource=aeBuildingSourceId();
  if(buildingSource==='psr-buildings'&&!map.getSource(buildingSource))map.addSource(buildingSource,{type:'vector',url:'https://tiles.openfreemap.org/planet'});
  const before=map.getStyle().layers.find(l=>l.type==='symbol'&&l.layout&&l.layout['text-field'])?.id;
  map.addLayer({id:'psr-3d-buildings',source:buildingSource,'source-layer':'building',type:'fill-extrusion',minzoom:9.7,layout:{visibility:state.is3d?'visible':'none'},
    paint:{'fill-extrusion-color':['interpolate',['linear'],['coalesce',['get','render_height'],12],0,'#eceeec',50,'#e2e5e5',150,'#d8dcdd',350,'#cbd1d3'],
      'fill-extrusion-height':['interpolate',['linear'],['zoom'],9.7,0,10.45,['*',['coalesce',['get','render_height'],10],.42],11.4,['coalesce',['get','render_height'],10]],
      'fill-extrusion-base':['coalesce',['get','render_min_height'],0],'fill-extrusion-opacity':.92,'fill-extrusion-vertical-gradient':true}},before);
}

function set3DLayerVisibility(visible){
  for(const id of AE_3D_LAYERS)if(map.getLayer(id))map.setLayoutProperty(id,'visibility',visible?'visible':'none');
}

function sync3DForCamera({animate=true,forcePitch=false}={}){
  const buildingRange=state.is3d&&map.getZoom()>=AE_3D_MIN_ZOOM;
  if(buildingRange){
    add3DBuildings();
    set3DLayerVisibility(true);
    if((forcePitch||!state.in3DBuildingRange)&&map.getPitch()<32){
      map.easeTo({pitch:AE_3D_ENTRY_PITCH,duration:animate?420:0});
    }
  }else if(!state.is3d){
    set3DLayerVisibility(false);
  }else if(state.in3DBuildingRange&&map.getPitch()>0){
    map.easeTo({pitch:0,duration:animate?320:0});
  }
  state.in3DBuildingRange=buildingRange;
}


let footprintTimer=null,footprintRetry=0,footprintRenderKey='';
function geometryBoundsKey(g){
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  (function walk(c){if(!Array.isArray(c))return;if(c.length>=2&&typeof c[0]==='number'&&typeof c[1]==='number'){minX=Math.min(minX,c[0]);maxX=Math.max(maxX,c[0]);minY=Math.min(minY,c[1]);maxY=Math.max(maxY,c[1]);return;}for(const x of c)walk(x)})(g?.coordinates);
  return [minX,minY,maxX,maxY].every(Number.isFinite)?[minX,minY,maxX,maxY].map(v=>v.toFixed(6)).join('|'):'';
}
function ringContainsPoint(p,ring){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1];
    const cross=((yi>p[1])!==(yj>p[1]))&&(p[0]<(xj-xi)*(p[1]-yi)/((yj-yi)||1e-12)+xi);
    if(cross)inside=!inside;
  }
  return inside;
}
function geometryContainsPoint(g,p){
  if(!g)return false;
  // Exterior ring only — interior rings are holes and must not count as containment.
  if(g.type==='Polygon')return ringContainsPoint(p,g.coordinates[0]||[]);
  if(g.type==='MultiPolygon')return g.coordinates.some(poly=>ringContainsPoint(p,poly[0]||[]));
  return false;
}
function geometryCentroid(g){
  let sx=0,sy=0,n=0;
  (function walk(c){if(!Array.isArray(c))return;if(c.length>=2&&typeof c[0]==='number'&&typeof c[1]==='number'){sx+=c[0];sy+=c[1];n++;return;}for(const x of c)walk(x)})(g?.coordinates);
  return n?[sx/n,sy/n]:null;
}
function metersBetween(a,b){
  const lat=((a[1]+b[1])/2)*Math.PI/180,dx=(a[0]-b[0])*111320*Math.cos(lat),dy=(a[1]-b[1])*110540;
  return Math.hypot(dx,dy);
}
function buildingPartsForProject(r,buildings){
  const c=coordsOf(r);if(!c||locationQuality(r)!=='exact')return [];
  // Strict identity: only a footprint that actually contains the project coordinate can inherit the project identity.
  const direct=buildings.filter(f=>geometryContainsPoint(f.geometry,c));
  if(!direct.length)return [];
  const unique=[],seen=new Set();
  for(const f of direct){const k=f.id!=null?'id:'+f.id:'g:'+geometryBoundsKey(f.geometry);if(seen.has(k))continue;seen.add(k);unique.push(f);}
  unique.sort((a,b)=>{const ca=geometryCentroid(a.geometry),cb=geometryCentroid(b.geometry);const da=ca?metersBetween(c,ca):1e9,db=cb?metersBetween(c,cb):1e9;return da-db;});
  // One project coordinate resolves to one primary footprint. Explicit multi-building identity must come from verified building data.
  return unique.slice(0,1);
}

function footprintFeature(building,r){
  const h=Number(building?.properties?.render_height??building?.properties?.height??16);
  const base=Number(building?.properties?.render_min_height??0);
  return {type:'Feature',geometry:building.geometry,properties:{id:r.id,name:recordTitle(r),availability:availabilityClass(r),availabilityLabel:availabilityLabel(r),status:r.masterStatus||r.status||r.statusLabel||'',rera:r.masterRera||r.verification?.dldReraNo||'',selected:state.selected?.id===r.id?1:0,renderHeight:Number.isFinite(h)&&h>0?h:16,renderBase:Number.isFinite(base)&&base>=0?base:0}};
}
function updateProjectFootprints(){
  const source=map.getSource('psr-project-footprints'),unresolvedSource=map.getSource('psr-project-unresolved');if(!source)return;
  if(!state.is3d){footprintRetry=0;source.setData(fc([]));unresolvedSource?.setData(fc([]));const el=$('#footprint-status');if(el)el.textContent='3D buildings are off';return;}
  if(map.getZoom()<13.9){footprintRetry=0;source.setData(fc([]));unresolvedSource?.setData(fc([]));const el=$('#footprint-status');if(el)el.textContent='Zoom closer to resolve buildings';window.__PSR_FOOTPRINT_STATS__={zoom:map.getZoom(),eligible:0,matched:0,unresolved:0};return;}
  const buildingSource=aeBuildingSourceId();if(!map.isSourceLoaded?.(buildingSource)){const el=$('#footprint-status');if(el)el.textContent='Loading building geometry…';if(footprintRetry++<30){clearTimeout(footprintTimer);footprintTimer=setTimeout(updateProjectFootprints,220)}return;}
  footprintRetry=0;
  const buildings=map.querySourceFeatures(buildingSource,{sourceLayer:'building'});
  const bounds=map.getBounds(),eligible=filteredProjects().filter(r=>locationQuality(r)==='exact'&&bounds.contains(coordsOf(r))).slice(0,140);
  const out=[],seen=new Set(),resolvedProjects=new Set();
  for(const r of eligible){const parts=buildingPartsForProject(r,buildings);if(!parts.length)continue;resolvedProjects.add(r.id);for(const part of parts){const key=part.id!=null?'id:'+part.id:'g:'+geometryBoundsKey(part.geometry);if(seen.has(key))continue;seen.add(key);out.push(footprintFeature(part,r));}}
  const unresolved=eligible.filter(r=>!resolvedProjects.has(r.id)).map(r=>({type:'Feature',geometry:{type:'Point',coordinates:coordsOf(r)},properties:{id:r.id,name:recordTitle(r),availabilityLabel:availabilityLabel(r)}}));
  const renderKey=String(state.selected?.id||'')+'|'+out.map(f=>geometryBoundsKey(f.geometry)+'@'+f.properties.id).join(';')+'|'+unresolved.map(f=>f.properties.id).join(';');
  if(renderKey!==footprintRenderKey){footprintRenderKey=renderKey;source.setData(fc(out));unresolvedSource?.setData(fc(unresolved));}
  const el=$('#footprint-status');if(el)el.textContent=resolvedProjects.size.toLocaleString()+' buildings resolved · '+unresolved.length.toLocaleString()+' awaiting footprint match';
  window.__PSR_FOOTPRINT_STATS__={zoom:map.getZoom(),eligible:eligible.length,matched:resolvedProjects.size,unresolved:unresolved.length,parts:out.length,sourceBuildings:buildings.length,names:[...resolvedProjects].slice(0,30).map(id=>state.recordById.get(String(id))?.name).filter(Boolean)};
}

function scheduleProjectFootprints(delay=120){if(state.is3d&&map.getZoom()>=AE_3D_MIN_ZOOM)add3DBuildings();footprintRetry=0;clearTimeout(footprintTimer);footprintTimer=setTimeout(()=>{try{updateProjectFootprints()}catch(e){console.warn('footprint sync',e)}},delay)}

function addSourcesAndLayers(){
  map.addSource('psr-projects',{type:'geojson',data:projectGeo(),cluster:true,clusterRadius:44,clusterMaxZoom:13});
  map.addLayer({id:'project-clusters',type:'circle',source:'psr-projects',filter:['has','point_count'],paint:{'circle-color':'rgba(24,165,226,.58)','circle-radius':['step',['get','point_count'],18,15,23,60,29],'circle-stroke-width':2.2,'circle-stroke-color':'rgba(129,224,255,.98)','circle-blur':.08}});
  map.addLayer({id:'project-cluster-count',type:'symbol',source:'psr-projects',filter:['has','point_count'],layout:{'text-field':['get','point_count_abbreviated'],'text-size':10},paint:{'text-color':'#f4fbff','text-halo-color':'rgba(2,12,21,.72)','text-halo-width':1}});
  map.addLayer({id:'project-hit',type:'circle',source:'psr-projects',maxzoom:13.6,filter:['!',['has','point_count']],paint:{'circle-radius':18,'circle-color':'rgba(0,0,0,.01)'}});
  map.addLayer({id:'project-points',type:'circle',source:'psr-projects',maxzoom:13.6,filter:['!',['has','point_count']],paint:{'circle-color':['case',['==',['get','fallback'],1],'#ffc866',['match',['get','timeline'],'past','#74889a','future','#5aaeff','#34dfc4']],'circle-radius':['interpolate',['linear'],['zoom'],6,4,12,6,16,8],'circle-stroke-width':2,'circle-stroke-color':'rgba(255,255,255,.95)'}});
  map.addLayer({id:'project-fallback-ring',type:'circle',source:'psr-projects',maxzoom:13.9,filter:['all',['!',['has','point_count']],['==',['get','fallback'],1]],paint:{'circle-radius':['interpolate',['linear'],['zoom'],7,7,15,11],'circle-color':'rgba(0,0,0,0)','circle-stroke-width':2.2,'circle-stroke-color':'#ffc866','circle-stroke-opacity':.95}});
  map.addLayer({id:'project-labels',type:'symbol',source:'psr-projects',minzoom:12.8,maxzoom:13.6,filter:['!',['has','point_count']],layout:{'text-field':['get','name'],'text-size':10,'text-offset':[0,1.4],'text-anchor':'top','text-max-width':12,'text-optional':true},paint:{'text-color':'#555d62','text-halo-color':'rgba(255,255,255,.94)','text-halo-width':1.5}});

  map.addSource('psr-project-footprints',{type:'geojson',data:fc([])});
  map.addSource('psr-project-unresolved',{type:'geojson',data:fc([])});
  map.addLayer({id:'project-footprint-extrusions',type:'fill-extrusion',source:'psr-project-footprints',minzoom:13.9,paint:{
    'fill-extrusion-color':['case',['==',['get','selected'],1],'#69d8ff','#688091'],
    'fill-extrusion-height':['get','renderHeight'],'fill-extrusion-base':['get','renderBase'],'fill-extrusion-opacity':.68,'fill-extrusion-vertical-gradient':true
  }});
  map.addLayer({id:'project-footprint-outline',type:'line',source:'psr-project-footprints',minzoom:13.9,paint:{'line-color':['case',['==',['get','selected'],1],'#69d8ff','#567182'],'line-width':['case',['==',['get','selected'],1],3.6,1.15],'line-opacity':['case',['==',['get','selected'],1],1,.58]}});
  map.addLayer({id:'project-footprint-labels',type:'symbol',source:'psr-project-footprints',minzoom:14.1,filter:['==',['get','selected'],1],layout:{
    'text-field':['get','name'],'text-size':10.5,'text-max-width':15,'text-anchor':'center','text-optional':true
  },paint:{'text-color':'#f6f3ea','text-halo-color':'rgba(8,19,27,.96)','text-halo-width':1.8}});
  map.addLayer({id:'project-unresolved-labels',type:'symbol',source:'psr-project-unresolved',minzoom:14.1,layout:{'visibility':'none','text-field':['get','name'],'text-size':9.5,'text-max-width':14,'text-anchor':'center','text-optional':true},paint:{'text-color':'#6d7479','text-halo-color':'rgba(255,255,255,.96)','text-halo-width':1.6}});


  map.addSource('psr-communities',{type:'geojson',data:communityGeo()});
  map.addLayer({id:'community-hit',type:'circle',source:'psr-communities',paint:{'circle-radius':20,'circle-color':'rgba(0,0,0,.01)'}});
  map.addLayer({id:'community-points',type:'circle',source:'psr-communities',paint:{'circle-radius':['interpolate',['linear'],['zoom'],6,4,12,8],'circle-color':'#202529','circle-stroke-width':3,'circle-stroke-color':'rgba(255,255,255,.9)'}});
  map.addLayer({id:'community-labels',type:'symbol',source:'psr-communities',minzoom:8.5,layout:{'text-field':['get','name'],'text-size':11,'text-offset':[0,1.3],'text-anchor':'top','text-optional':true},paint:{'text-color':'#343a3e','text-halo-color':'rgba(255,255,255,.95)','text-halo-width':1.5}});

  map.addSource('psr-initiatives',{type:'geojson',data:initiativeGeo()});
  map.addLayer({id:'initiative-hit',type:'circle',source:'psr-initiatives',paint:{'circle-radius':20,'circle-color':'rgba(0,0,0,.01)'}});
  map.addLayer({id:'initiative-points',type:'circle',source:'psr-initiatives',paint:{'circle-radius':['interpolate',['linear'],['zoom'],6,5,12,8],'circle-color':'#a37d31','circle-stroke-width':2,'circle-stroke-color':'rgba(255,255,255,.96)'}});

  map.addSource('selection',{type:'geojson',data:fc([])});
  map.addLayer({id:'selection-halo',type:'circle',source:'selection',paint:{'circle-radius':['interpolate',['linear'],['zoom'],6,14,14,28],'circle-color':'rgba(53,120,246,.10)','circle-stroke-width':3,'circle-stroke-color':'#3578f6'}});
}

function ensureRoiLayers(){
  if(!map.getSource('psr-roi'))map.addSource('psr-roi',{type:'geojson',data:roiGeo()});
  if(!map.getLayer('roi-heat'))map.addLayer({id:'roi-heat',type:'heatmap',source:'psr-roi',maxzoom:14,paint:{'heatmap-weight':['get','weight'],'heatmap-intensity':['interpolate',['linear'],['zoom'],5,.8,12,2.3],'heatmap-radius':['interpolate',['linear'],['zoom'],5,26,12,65],'heatmap-opacity':.76,'heatmap-color':['interpolate',['linear'],['heatmap-density'],0,'rgba(38,124,95,0)',.25,'rgba(38,124,95,.40)',.5,'rgba(78,155,130,.55)',.72,'rgba(183,146,66,.68)',1,'rgba(240,196,91,.88)']}});
  if(!map.getLayer('roi-points'))map.addLayer({id:'roi-points',type:'circle',source:'psr-roi',paint:{'circle-radius':5,'circle-color':'#b58d39','circle-stroke-width':2,'circle-stroke-color':'white'}});
  if(!map.getLayer('roi-labels'))map.addLayer({id:'roi-labels',type:'symbol',source:'psr-roi',minzoom:8,layout:{'text-field':['get','label'],'text-size':10,'text-offset':[0,1.3]},paint:{'text-color':'#6f561d','text-halo-color':'white','text-halo-width':1.5}});
}

function ensureContextLayers(){
  if(!map.getSource('psr-places'))map.addSource('psr-places',{type:'geojson',data:placeGeo(),cluster:true,clusterRadius:42,clusterMaxZoom:13});
  if(!map.getLayer('place-clusters'))map.addLayer({id:'place-clusters',type:'circle',source:'psr-places',filter:['has','point_count'],paint:{'circle-radius':['step',['get','point_count'],15,30,20,150,27],'circle-color':'rgba(255,255,255,.90)','circle-stroke-color':'rgba(45,55,62,.18)','circle-stroke-width':1.5}});
  if(!map.getLayer('place-cluster-count'))map.addLayer({id:'place-cluster-count',type:'symbol',source:'psr-places',filter:['has','point_count'],layout:{'text-field':['get','point_count_abbreviated'],'text-size':9},paint:{'text-color':'#555d62'}});
  if(!map.getLayer('place-hit'))map.addLayer({id:'place-hit',type:'circle',source:'psr-places',filter:['!',['has','point_count']],paint:{'circle-radius':16,'circle-color':'rgba(0,0,0,.01)'}});
  if(!map.getLayer('place-points'))map.addLayer({id:'place-points',type:'circle',source:'psr-places',filter:['!',['has','point_count']],paint:{'circle-radius':['interpolate',['linear'],['zoom'],6,3,13,6],'circle-color':'#6b747b','circle-stroke-width':1.5,'circle-stroke-color':'white'}});
  if(!map.getSource('psr-transport'))map.addSource('psr-transport',{type:'geojson',data:transportGeo()});
  if(!map.getLayer('transport-roads'))map.addLayer({id:'transport-roads',type:'line',source:'psr-transport',filter:['==',['get','category'],'road'],paint:{'line-color':'#b18b3b','line-width':['interpolate',['linear'],['zoom'],5,.8,12,2.6],'line-opacity':.75}});
  if(!map.getLayer('transport-lines'))map.addLayer({id:'transport-lines',type:'line',source:'psr-transport',filter:['in',['get','category'],['literal',['metro','tram','rail','marine']]],paint:{'line-color':['coalesce',['get','color'],'#4c76a8'],'line-width':['interpolate',['linear'],['zoom'],5,1.2,12,4.2],'line-opacity':.9,'line-dasharray':['case',['==',['get','status'],'operational'],['literal',[1,0]],['literal',[2,1.3]]]}});
  if(!map.getLayer('transport-stations'))map.addLayer({id:'transport-stations',type:'circle',source:'psr-transport',filter:['in',['get','category'],['literal',['metro_station','tram_station','rail_station','marine_station']]],paint:{'circle-radius':['interpolate',['linear'],['zoom'],7,3,12,6],'circle-color':'#4c76a8','circle-stroke-width':1.5,'circle-stroke-color':'white'}});
}

function refreshRoiSource(){ensureRoiLayers();map.getSource('psr-roi')?.setData(roiGeo())}
function refreshPlaceSource(){ensureContextLayers();map.getSource('psr-places')?.setData(placeGeo())}
function refreshTransportSource(){ensureContextLayers();map.getSource('psr-transport')?.setData(transportGeo())}

function refreshSources(){
  map.getSource('psr-projects')?.setData(projectGeo());
  map.getSource('psr-communities')?.setData(communityGeo());
  map.getSource('psr-initiatives')?.setData(initiativeGeo());
  map.getSource('psr-roi')?.setData(roiGeo());
  map.getSource('psr-places')?.setData(placeGeo());
  map.getSource('psr-transport')?.setData(transportGeo());
  updateStatus();
  scheduleProjectFootprints();
}

function updateStatus(){
  const p=filteredProjects().length,c=state.kinds.has('community')?state.communities.length:0,i=state.kinds.has('initiative')?state.initiatives.filter(timelineMatch).length:0;
  $('#visible-status').textContent=(p+c+i).toLocaleString()+' portfolio records visible';
  $('#project-count').textContent=state.projects.length.toLocaleString(); $('#community-count').textContent=state.communities.length.toLocaleString(); $('#initiative-count').textContent=state.initiatives.length.toLocaleString();
  updateLocationQualityUI();
  updateAvailabilityUI();
}

function recordTitle(r){return r.name||r.title||'Untitled'}
function recordSub(r){return r.kind==='project'?[r.developer,r.area].filter(Boolean).join(' · '):r.kind==='community'?[r.emirate,r.indexedProjects? r.indexedProjects+' indexed projects':''].filter(Boolean).join(' · '):r.kind==='initiative'?[r.category,r.emirate].filter(Boolean).join(' · '):[r.categoryLabel,r.address].filter(Boolean).join(' · ')}
function aeMediaUrl(src){if(!src)return null;try{const u=new URL(src,location.origin);if(u.origin===location.origin||u.pathname==='/map/media')return u.href;if(u.protocol!=='https:')return null;return '/map/media?url='+encodeURIComponent(u.href)}catch{return src}}
function recordImage(r){return aeMediaUrl(r.image||r.gallery?.[0]||null)}
function recordHref(r){return r.kind==='place'?(r.website||'#'):absHref(r.href||'#')}

function showHover(r,point,extra=''){
  if(!r)return; const card=$('#hover-card'),img=$('#hover-image'),fallback=$('#hover-fallback');
  const image=recordImage(r); img.style.display=image?'block':'none'; fallback.style.display=image?'none':'block';
  if(image){img.src=image;img.onerror=()=>{img.style.display='none';fallback.style.display='block'}}
  $('#hover-kicker').textContent=r.kind==='initiative'?'FUTURE PLAN':r.kind==='community'?'COMMUNITY':r.kind==='place'?(r.categoryLabel||'PLACE'):'PROJECT';
  $('#hover-title').textContent=recordTitle(r); $('#hover-sub').textContent=recordSub(r);
  const tags=[]; if(r.price)tags.push(r.price); if(r.timeline)tags.push(r.timeline); if(r.kind==='project'){tags.push(availabilityLabel(r));tags.push(locationLabel(r));} if(r.verification?.dldReraNo)tags.push('RERA '+r.verification.dldReraNo); if(extra)tags.push(extra);
  $('#hover-meta').innerHTML=tags.slice(0,3).map(x=>'<span>'+esc(x)+'</span>').join('');
  card.href=recordHref(r); card.target=r.kind==='place'&&r.website?'_blank':'_self';
  const w=286,h=118,m=12; let x=point.x+18,y=point.y-68; if(x+w>innerWidth-m)x=point.x-w-18; if(y+h>innerHeight-m)y=innerHeight-h-m; if(y<m)y=m;
  card.style.left=x+'px';card.style.top=y+'px';card.classList.remove('hidden');
}
function hideHover(delay=90){ clearTimeout(hideHover.t); hideHover.t=setTimeout(()=>{if(!state.hoverLocked)$('#hover-card').classList.add('hidden')},delay); }
$('#hover-card').addEventListener('mouseenter',()=>state.hoverLocked=true); $('#hover-card').addEventListener('mouseleave',()=>{state.hoverLocked=false;hideHover(60)});

async function hoverFromMap(e){
  const layers=['project-footprint-extrusions','project-hit','project-clusters','community-hit','initiative-hit','place-hit','place-clusters','roi-points'].filter(id=>map.getLayer(id));
  const features=map.queryRenderedFeatures(e.point,{layers}); if(!features.length){hideHover();map.getCanvas().style.cursor='';return;}
  map.getCanvas().style.cursor='pointer'; const f=features[0], token=++state.hoverToken;
  if(f.layer.id==='project-clusters'){
    const clusterId=f.properties.cluster_id; const leaves=await map.getSource('psr-projects').getClusterLeaves(clusterId,12,0); if(token!==state.hoverToken)return;
    const rec=leaves.map(x=>state.recordById.get(String(x.properties.id))).find(x=>x&&recordImage(x))||state.recordById.get(String(leaves[0]?.properties?.id));
    if(rec)showHover(rec,e.point,(f.properties.point_count||'')+' projects'); return;
  }
  if(f.layer.id==='place-clusters'){
    const clusterId=f.properties.cluster_id; const leaves=await map.getSource('psr-places').getClusterLeaves(clusterId,8,0); if(token!==state.hoverToken)return;
    const rec=state.recordById.get(String(leaves[0]?.properties?.id)); if(rec)showHover(rec,e.point,(f.properties.point_count||'')+' places'); return;
  }
  const id=String(f.properties.id||''); const rec=state.recordById.get(id); if(rec)showHover(rec,e.point);
}

let hoverFrame=0,hoverPoint=null,hoverLastRun=0;
function scheduleHoverFromMap(e){
  hoverPoint=e?.point?{x:e.point.x,y:e.point.y}:null;
  if(hoverFrame||!hoverPoint)return;
  hoverFrame=requestAnimationFrame(()=>{
    hoverFrame=0;
    if(!hoverPoint||map.isMoving?.()){state.hoverToken++;hideHover(0);return}
    const now=performance.now();
    if(now-hoverLastRun<48){hoverFrame=requestAnimationFrame(()=>{hoverFrame=0;scheduleHoverFromMap({point:hoverPoint})});return}
    hoverLastRun=now;const point=hoverPoint;hoverPoint=null;hoverFromMap({point});
  });
}


/* Initiative enrichment helpers (2026-09-22)
 * catalystScore dimensions are 0–100 integers.
 * deliveryCertainty order: construction > procurement > announced > strategy
 * linkedCommunities come from area-name match only — never geo-distance.
 */
function initiativeCatalystBlock(r){
  const s=r.catalystScore; if(!s) return '';
  const row=(label,val,hint)=>'<div class="catalyst-score-row"><span>'+esc(label)+'</span><b>'+esc(String(val??'—'))+'</b><small>'+esc(hint||'')+'</small></div>';
  return '<div class="detail-section initiative-catalyst"><h3>Catalyst score <span class="muted">(0–100)</span></h3>'+
    '<div class="catalyst-score-grid">'+
      row('Delivery',s.delivery,'construction > procurement > announced')+
      row('Accessibility',s.accessibility,'access / network effect')+
      row('Demand',s.demand,'visitor / employment pull')+
      row('Supply risk',s.supplyRisk,'higher = more risk')+
    '</div>'+
    (s.asOf?'<p class="muted" style="margin-top:6px">As of '+esc(s.asOf)+'</p>':'')+
  '</div>';
}
function initiativeLinkedBlock(r){
  const counts=r.linkedProjectCounts||{};
  const list=r.linkedCommunities||[];
  if(!list.length && !counts.total) return '';
  const top=list.slice(0,8).map(c=>'<li><span>'+esc(c.name)+'</span><b>'+esc(String(c.projectCount))+'</b></li>').join('');
  return '<div class="detail-section initiative-linked"><h3>Linked catalogue areas</h3>'+
    '<div class="detail-facts">'+detailFact('Matched projects',counts.total??list.reduce((n,c)=>n+(c.projectCount||0),0))+detailFact('Matched areas',list.length)+'</div>'+
    (top?'<ul class="linked-community-list">'+top+'</ul>':'')+
    '<p class="muted" style="margin-top:6px">Matched by area name from map-data — not by distance from strategy markers.</p>'+
  '</div>';
}
function initiativeNotesBlock(r){
  const bits=[];
  if(r.deliveryCertainty) bits.push(detailFact('Delivery certainty',r.deliveryCertainty));
  if(r.coordinateBasis) bits.push(detailFact('Coordinate basis',r.coordinateBasis));
  const warn=r.coordinateBasis&&/strategy marker|centroid|not a surveyed|no single project-site/i.test(r.coordinateBasis)
    ?'<div class="coord-basis-warn">Coordinate basis warning: '+esc(r.coordinateBasis)+'. Do not infer walking distance or plot-level proximity from this pin.</div>': '';
  const notes=[
    r.accessibilityNote&&('<p><strong>Accessibility.</strong> '+esc(r.accessibilityNote)+'</p>'),
    r.demandNote&&('<p><strong>Demand.</strong> '+esc(r.demandNote)+'</p>'),
    r.supplyRiskNote&&('<p><strong>Supply risk.</strong> '+esc(r.supplyRiskNote)+'</p>'),
    r.researchNotes&&('<p class="muted"><strong>Research.</strong> '+esc(r.researchNotes)+'</p>'),
  ].filter(Boolean).join('');
  if(!bits.length && !notes && !warn) return '';
  return '<div class="detail-section initiative-intel"><h3>Initiative intelligence</h3>'+
    (bits.length?'<div class="detail-facts">'+bits.join('')+'</div>':'')+warn+notes+'</div>';
}

function detailFact(label,value){ if(value===null||value===undefined||value==='')return''; return '<div class="detail-fact"><span>'+esc(label)+'</span><b>'+esc(value)+'</b></div>'; }
function showDetail(r){
  state.selected=r; const c=coordsOf(r); if(c)map.getSource('selection')?.setData(fc([pointFeature({...r,id:'selected'})]));
  const image=recordImage(r); const v=r.verification;
  const hero=image?'<div class="detail-hero"><img src="'+esc(image)+'" alt="" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'"></div>':'';
  const facts=[];
  if(r.kind==='project'){
    facts.push(detailFact('Availability',availabilityLabel(r)),detailFact('Availability checked',r.availabilityVerifiedOn),detailFact('Price',r.price),detailFact('Handover',r.handover),detailFact('Payment plan',r.paymentPlan),detailFact('Status',r.masterStatus||r.status||r.statusLabel),detailFact('RERA / Project ID',r.masterRera||r.verification?.dldReraNo),detailFact('Timeline',r.timeline),detailFact('Location accuracy',locationLabel(r)),detailFact('Location basis',r.coordinateBasis));
  } else if(r.kind==='community') facts.push(detailFact('Projects',r.indexedProjects),detailFact('Active',r.activeProjects),detailFact('Emirate',r.emirate),detailFact('Coordinate basis',r.coordinateBasis));
  else if(r.kind==='initiative') facts.push(detailFact('Category',r.category),detailFact('Status',r.status),detailFact('Timing',r.timing),detailFact('Emirate',r.emirate),detailFact('Delivery certainty',r.deliveryCertainty),detailFact('Linked projects',(r.linkedProjectCounts&&r.linkedProjectCounts.total!=null)?r.linkedProjectCounts.total:null));
  else facts.push(detailFact('Category',r.categoryLabel),detailFact('Address',r.address),detailFact('Confidence',r.confidence));
  let verify=''; if(v){verify='<div class="detail-section"><h3>Workbook verification</h3><div class="verify-row">'+[v.verificationStatus,v.regulator,v.dldReraNo?'RERA '+v.dldReraNo:null,v.verifiedOn?'Checked '+v.verifiedOn:null].filter(Boolean).map(x=>'<span class="verify-chip">'+esc(x)+'</span>').join('')+'</div>'+(v.verificationNotes?'<p style="margin-top:8px">'+esc(v.verificationNotes)+'</p>':'')+'</div>'}
  const db=r.developerBrain; let developerIntel=''; if(db){developerIntel='<div class="detail-section"><h3>Developer intelligence</h3><div class="detail-facts">'+detailFact('Emirates',db.emiratesPresent)+detailFact('Catalog assets',db.catalogProjectsBuildings)+detailFact('On sale',db.catalogOnSale)+detailFact('Catalog from',db.catalogFrom)+'</div>'+(db.keyCommunities?'<p style="margin-top:8px">Key communities: '+esc(db.keyCommunities)+'</p>':'')+'</div>'}
  const summary=r.summary||r.marketImpact||r.descriptor||'';
  const primary=recordHref(r), secondary=r.officialSourceUrl||r.availabilitySource||v?.registryEvidenceUrl||r.sourceUrl||r.source?.url||r.website||'';
  $('#detail-body').innerHTML=hero+'<div class="detail-content"><span class="detail-badge">'+esc(r.kind==='initiative'?'Future initiative':r.kind||'record')+'</span><h2>'+esc(recordTitle(r))+'</h2><div class="detail-sub">'+esc(recordSub(r))+'</div><div class="detail-facts">'+facts.join('')+'</div>'+(summary?'<div class="detail-section"><h3>Context</h3><p>'+esc(summary)+'</p></div>':'')+verify+developerIntel+(r.kind==='initiative'?(initiativeNotesBlock(r)+initiativeLinkedBlock(r)+initiativeCatalystBlock(r)):'')+'<div class="detail-actions">'+(primary&&primary!=='#'?'<a href="'+esc(primary)+'">Open in PSR</a>':'')+(secondary?'<a class="secondary" href="'+esc(secondary)+'" target="_blank" rel="noopener">Source</a>':'')+'</div></div>';
  $('#detail').classList.remove('hidden'); psrApplyDockPadding(true); if(c){const z=r.kind==='project'?(isFallback(r)?Math.max(map.getZoom(),11.8):Math.max(map.getZoom(),15.2)):Math.max(map.getZoom(),11);map.easeTo({center:c,zoom:z,pitch:state.is3d?60:0,duration:850});if(r.kind==='project')setTimeout(()=>scheduleProjectFootprints(40),900);}
}
$('#detail-close').addEventListener('click',()=>{$('#detail').classList.add('hidden');psrApplyDockPadding(true);state.selected=null;map.getSource('selection')?.setData(fc([]));scheduleProjectFootprints(40)});

function clickFromMap(e){
  const layers=['project-footprint-extrusions','project-hit','community-hit','initiative-hit','place-hit','roi-points','project-clusters','place-clusters'].filter(id=>map.getLayer(id)); const f=map.queryRenderedFeatures(e.point,{layers})[0]; if(!f)return;
  if(f.layer.id==='project-clusters'){const cid=f.properties.cluster_id;map.getSource('psr-projects').getClusterExpansionZoom(cid).then(z=>map.easeTo({center:f.geometry.coordinates,zoom:z,duration:600}));return;}
  if(f.layer.id==='place-clusters'){const cid=f.properties.cluster_id;map.getSource('psr-places').getClusterExpansionZoom(cid).then(z=>map.easeTo({center:f.geometry.coordinates,zoom:z,duration:600}));return;}
  const r=state.recordById.get(String(f.properties.id||'')); if(r)showDetail(r);
}

function setupUI(){
  $$('.rail-btn[data-panel]').forEach(b=>b.addEventListener('click',()=>{ const id=b.dataset.panel+'-panel'; $$('.floating-panel').forEach(p=>p.classList.toggle('hidden',p.id!==id)); $$('.rail-btn[data-panel]').forEach(x=>x.classList.toggle('active',x===b)); }));
  $$('.panel-close').forEach(b=>b.addEventListener('click',()=>b.closest('.floating-panel').classList.add('hidden')));
  $$('#timeline-filter button').forEach(b=>b.addEventListener('click',()=>{state.timeline=b.dataset.timeline;$$('#timeline-filter button').forEach(x=>x.classList.toggle('active',x===b));refreshSources()}));
  $$('#kind-filter .kind').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.kind;state.kinds.has(k)?state.kinds.delete(k):state.kinds.add(k);b.classList.toggle('active',state.kinds.has(k));refreshSources()}));
  $$('#location-quality-filter button').forEach(b=>b.addEventListener('click',()=>{state.locationQuality=b.dataset.locationQuality;$$('#location-quality-filter button').forEach(x=>x.classList.toggle('active',x===b));refreshSources()}));
  $$('#availability-filter button').forEach(b=>b.addEventListener('click',()=>{state.availabilityMode=b.dataset.availability;$$('#availability-filter button').forEach(x=>x.classList.toggle('active',x===b));refreshSources()}));
  $('#roi-mode').addEventListener('change',e=>{state.roiMode=e.target.value;refreshRoiSource()});
  $('#toggle-3d').addEventListener('click',()=>{state.is3d=!state.is3d;state.in3DBuildingRange=false;$('#toggle-3d').classList.toggle('active',state.is3d);$('#toggle-3d').setAttribute('aria-pressed',String(state.is3d));if(state.is3d){sync3DForCamera({forcePitch:true});if(map.getZoom()<AE_3D_MIN_ZOOM)toast('3D is on. Buildings rise automatically at city scale.')}else{set3DLayerVisibility(false);map.easeTo({pitch:0,duration:420});scheduleProjectFootprints(20)}});
  $('#reset-view').addEventListener('click',()=>map.flyTo({...views.uae,duration:900}));
  $$('[data-focus]').forEach(b=>b.addEventListener('click',()=>{const v={dubai:[55.18,25.08,10.25],abudhabi:[54.54,24.46,9.85],yas:[54.603,24.494,13.1],hudayriyat:[54.388,24.379,13.0],palmjebelali:[54.981,24.991,12.2]}[b.dataset.focus];if(v)map.flyTo({center:[v[0],v[1]],zoom:v[2],pitch:state.is3d?56:0,bearing:-14,duration:850})}));
  $$('.transport-list input').forEach(c=>c.addEventListener('change',()=>{c.checked?state.transportModes.add(c.value):state.transportModes.delete(c.value);refreshTransportSource()}));
  $('#clear-search').addEventListener('click',()=>{$('#search').value='';$('#search-results').classList.add('hidden')});
  $('#search').addEventListener('input',renderSearch);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('#search-results').classList.add('hidden');hideHover(0)}});
}

function renderPlaceCategories(){
  const counts=state.amenities?.meta?.counts||{},labels=state.amenities?.meta?.categoryLabels||{}; const el=$('#place-categories');
  el.innerHTML=Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([k,v])=>'<button data-place="'+esc(k)+'"><span>'+esc(labels[k]||k)+'</span><small>'+Number(v).toLocaleString()+'</small></button>').join('');
  $$('[data-place]').forEach(b=>b.addEventListener('click',()=>{state.placeMode=b.dataset.place;$$('[data-place]').forEach(x=>x.classList.toggle('active',x.dataset.place===state.placeMode));refreshPlaceSource()}));
}

function aeSearchText(v){return norm(String(v||'')).replace(/\s+/g,' ').trim()}
function aeSearchTokens(v){return aeSearchText(v).split(' ').filter(Boolean)}
function aeEditDistance(a,b,max=2){a=String(a||'');b=String(b||'');if(Math.abs(a.length-b.length)>max)return max+1;let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const cur=[i];let row=i;for(let j=1;j<=b.length;j++){const v=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));cur[j]=v;row=Math.min(row,v)}if(row>max)return max+1;prev=cur}return prev[b.length]}
function aeSearchEntryForRecord(r){const title=aeSearchText(recordTitle(r)),sub=aeSearchText(recordSub(r)),dev=aeSearchText(r.developer),area=aeSearchText(r.area||r.community||r.masterCommunity),ids=aeSearchText([r.id,r.slug,r.masterRera,r.projectNumber,r.rera,r.verification?.dldReraNo,r.verification?.registeredProjectName].filter(Boolean).join(' ')),aliases=aeSearchText([...(Array.isArray(r.aliases)?r.aliases:[]),r.oldName,r.previousName,r.buildingName,r.building,r.projectName].filter(Boolean).join(' '));return {type:'record',id:String(r.id),record:r,title,sub,dev,area,ids,aliases,hay:aeSearchText([title,sub,dev,area,r.emirate,r.status,r.availability,r.category,r.summary,ids,aliases].filter(Boolean).join(' '))}}
function aeBuildSearchIndex(){state.searchIndex=(state.allRecords||[]).map(aeSearchEntryForRecord);const dm=new Map();for(const p of state.projects||[]){const name=String(p.developer||'').trim();if(!name)continue;const k=aeSearchText(name);if(!dm.has(k))dm.set(k,{type:'developer',id:'developer:'+k,name,projects:[],title:k,sub:'',dev:k,area:'',ids:'',aliases:'',hay:k});dm.get(k).projects.push(p)}state.searchDevelopers=[...dm.values()].map(d=>{const emirates=[...new Set(d.projects.map(p=>p.emirate).filter(Boolean))];const areas=[...new Set(d.projects.map(p=>p.area).filter(Boolean))];d.sub=aeSearchText(emirates.join(' '));d.area=aeSearchText(areas.join(' '));d.hay=aeSearchText([d.name,emirates.join(' '),areas.join(' '),'developer'].join(' '));return d})}
function searchHay(r){return aeSearchEntryForRecord(r).hay}
function aeSearchScore(e,q){const tokens=aeSearchTokens(q);if(!tokens.length)return -1;let score=0;const title=e.title||'',hay=e.hay||'',ids=e.ids||'',dev=e.dev||'',area=e.area||'',aliases=e.aliases||'',words=aeSearchTokens([title,dev,area,aliases].join(' '));if(title===q)score+=1400;if(ids===q||ids.split(' ').includes(q))score+=1350;if(dev===q)score+=1250;if(title.startsWith(q))score+=1000;if(dev.startsWith(q))score+=880;if(aliases.startsWith(q))score+=820;if(area===q)score+=760;if(title.includes(q))score+=720;if(dev.includes(q))score+=650;if(area.includes(q))score+=560;if(aliases.includes(q))score+=520;if(ids.includes(q))score+=500;let matched=0,fuzzyCount=0;for(const t of tokens){let s=0;if(title.split(' ').some(w=>w.startsWith(t)))s=Math.max(s,150);if(dev.split(' ').some(w=>w.startsWith(t)))s=Math.max(s,130);if(area.split(' ').some(w=>w.startsWith(t)))s=Math.max(s,100);if(ids.includes(t))s=Math.max(s,120);if(hay.includes(t))s=Math.max(s,70);if(!s&&t.length>=3){const max=t.length>=5?2:1;let best=max+1;for(const w of words){if(Math.abs(w.length-t.length)>max)continue;best=Math.min(best,aeEditDistance(w,t,max));if(best===0)break}if(best<=max){s=best===1?72:42;fuzzyCount++}}if(s){matched++;score+=s}}if(matched!==tokens.length)return -1;const tw=title.split(' ').filter(Boolean);const titleCoverage=tokens.every(t=>tw.some(w=>w.startsWith(t)||aeEditDistance(w,t,t.length>=5?2:1)<= (t.length>=5?2:1)));if(titleCoverage)score+=Math.max(240,430-Math.min(title.length*4,180));if(fuzzyCount)score-=fuzzyCount*8;if(e.type==='developer')score+=35;if(e.type==='record'&&e.record?.kind==='project')score+=24;if(e.type==='record'&&e.record?.kind==='community')score+=18;return score}
function aeSearchResultsFor(q){const nq=aeSearchText(q);const pool=[...(state.searchIndex||[]),...(state.searchDevelopers||[])];return pool.map(e=>({e,score:aeSearchScore(e,nq)})).filter(x=>x.score>=0).sort((a,b)=>b.score-a.score||String(a.e.title||a.e.name).localeCompare(String(b.e.title||b.e.name))).slice(0,18)}
function aeSearchKindLabel(e){if(e.type==='developer')return 'Developer';const k=e.record?.kind||'record';return k==='initiative'?'Future plan':k.charAt(0).toUpperCase()+k.slice(1)}
function aeSearchSubLabel(e){if(e.type==='developer'){const em=[...new Set(e.projects.map(p=>p.emirate).filter(Boolean))].slice(0,2).join(' · ');return e.projects.length.toLocaleString()+' projects'+(em?' · '+em:'')}const r=e.record;return [recordSub(r),r.developer&&r.kind!=='project'?r.developer:null,r.masterRera?('RERA '+r.masterRera):null].filter(Boolean).join(' · ')}
function aeRenderSearchPrompt(){const box=$('#search-results');if(!box)return;box.innerHTML='<div class="ae-search-prompt"><strong>Search the UAE</strong><span>Projects · communities · developers · buildings · RERA / project IDs</span><small><kbd>↑</kbd><kbd>↓</kbd> navigate &nbsp; <kbd>Enter</kbd> open &nbsp; <kbd>Esc</kbd> close</small></div>';box.classList.remove('hidden');$('#search')?.setAttribute('aria-expanded','true')}
function renderSearch(){const input=$('#search'),box=$('#search-results');if(!input||!box)return;const raw=input.value||'',q=aeSearchText(raw);input.closest('.search-wrap')?.classList.toggle('has-query',!!q);if(q.length<2){state.searchResults=[];state.searchCursor=-1;if(document.activeElement===input)aeRenderSearchPrompt();else{box.classList.add('hidden');input.setAttribute('aria-expanded','false')}return}if(!(state.searchIndex?.length))aeBuildSearchIndex();const hits=aeSearchResultsFor(q);state.searchResults=hits.map(x=>x.e);state.searchCursor=hits.length?0:-1;if(!hits.length){box.innerHTML='<div class="ae-search-empty"><strong>No exact match</strong><span>Try a project, community, developer, RERA number, or a shorter spelling.</span></div>';box.classList.remove('hidden');input.setAttribute('aria-expanded','true');return}const groups=new Map();for(const x of hits){const label=aeSearchKindLabel(x.e);if(!groups.has(label))groups.set(label,[]);groups.get(label).push(x.e)}let pos=0;box.innerHTML='<div class="ae-search-summary"><span>'+hits.length+' best matches</span><small>Press Enter to open the first result</small></div>'+[...groups].map(([label,arr])=>'<section class="ae-search-group"><div class="ae-search-group-title">'+esc(label)+'</div>'+arr.map(e=>{const p=pos++;const img=e.type==='record'?recordImage(e.record):'';const title=e.type==='developer'?e.name:recordTitle(e.record);return '<button class="search-item'+(p===0?' is-active':'')+'" type="button" role="option" aria-selected="'+(p===0?'true':'false')+'" data-search-pos="'+p+'">'+(img?'<img class="search-thumb" src="'+esc(img)+'" alt="" loading="lazy" referrerpolicy="no-referrer">':'<span class="search-thumb ae-search-glyph">'+esc(label.charAt(0))+'</span>')+'<span class="ae-search-copy"><strong>'+esc(title)+'</strong><small>'+esc(aeSearchSubLabel(e))+'</small></span><em>'+esc(label)+'</em></button>'}).join('')+'</section>').join('');box.classList.remove('hidden');input.setAttribute('aria-expanded','true')}
function aeShowDeveloperSearch(e){const ps=e.projects||[],coords=ps.map(coordsOf).filter(Boolean);state.selected={id:e.id,kind:'developer',name:e.name,developer:e.name};const communities=[...new Set(ps.map(p=>p.area).filter(Boolean))];const emirates=[...new Set(ps.map(p=>p.emirate).filter(Boolean))];const exact=ps.filter(p=>locationQuality(p)==='exact').length,onSale=ps.filter(p=>availabilityClass(p)==='on-sale').length;$('#detail-body').innerHTML='<div class="detail-content"><span class="detail-badge">DEVELOPER</span><h2>'+esc(e.name)+'</h2><div class="detail-sub">'+esc(emirates.join(' · '))+'</div><div class="detail-facts">'+detailFact('Projects',ps.length)+detailFact('Communities',communities.length)+detailFact('Exact project locations',exact)+detailFact('On sale',onSale)+'</div><div class="detail-section"><h3>Coverage</h3><p>'+esc(communities.slice(0,14).join(' · ')||'Project coverage is being enriched.')+'</p></div></div>';$('#detail').classList.remove('hidden');if(coords.length){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const c of coords){minX=Math.min(minX,c[0]);maxX=Math.max(maxX,c[0]);minY=Math.min(minY,c[1]);maxY=Math.max(maxY,c[1])}try{map.fitBounds([[minX,minY],[maxX,maxY]],{padding:{top:90,bottom:120,left:90,right:90},maxZoom:12.5,duration:650})}catch{}}psrApplyDockPadding?.(true)}
function aeActivateSearchPosition(pos){const e=state.searchResults?.[pos];if(!e)return;const box=$('#search-results');box?.classList.add('hidden');$('#search')?.setAttribute('aria-expanded','false');if(box)box.replaceChildren();if(e.type==='developer'){aeShowDeveloperSearch(e);return}const r=e.record;if(!r)return;showDetail(r);if(typeof psrSetSelectedPoint==='function')psrSetSelectedPoint(r);const direct=coordsOf(r);let target=direct;if(!target){const areaKey=norm(r.area||r.community||r.masterCommunity||'');const area=(state.communities||[]).find(x=>areaKey&&norm(x.name)===areaKey&&coordsOf(x));target=area?coordsOf(area):null}const contextKey=norm([r.emirate,r.area,r.community,r.masterCommunity,recordSub(r)].filter(Boolean).join(' '));if(!target){target=contextKey.includes('abu dhabi')?views.abudhabi.center:contextKey.includes('dubai')?views.dubai.center:null}if(target){const targetZoom=r.kind==='project'?(direct?15.2:14.4):r.kind==='community'?12.6:14;setTimeout(()=>{try{map.stop();map.jumpTo({center:target,zoom:Math.max(map.getZoom(),targetZoom),pitch:state.is3d?58:0,bearing:-16});if(typeof psrApplyDockPadding==='function')psrApplyDockPadding(false);if(typeof sync3DForCamera==='function')sync3DForCamera({animate:false,forcePitch:state.is3d});if(r.kind==='project')scheduleProjectFootprints(40)}catch(err){console.warn('search navigation',err)}},280)}}
function aeSearchMoveCursor(delta){const list=state.searchResults||[];if(!list.length)return;state.searchCursor=(Number.isInteger(state.searchCursor)?state.searchCursor:0)+delta;if(state.searchCursor<0)state.searchCursor=list.length-1;if(state.searchCursor>=list.length)state.searchCursor=0;$$('#search-results [data-search-pos]').forEach((b,i)=>{const on=i===state.searchCursor;b.classList.toggle('is-active',on);b.setAttribute('aria-selected',on?'true':'false');if(on)b.scrollIntoView({block:'nearest'})})}
function rebuildIndexes(){
  state.allRecords=[...state.projects,...state.communities,...state.initiatives,...state.places.map(p=>({...p,kind:'place'}))];
  state.recordById=new Map(state.allRecords.map(r=>[String(r.id),r]));
  state.searchIndex=[];state.searchDevelopers=[];
}

async function bootData(){
  const boot=window.__AE_BOOT||{};
  const mapResponse=await (boot.mapData||fetch('/map/map-core.json',{cache:'force-cache'}));
  if(!mapResponse.ok)throw Error('Core map data '+mapResponse.status);
  const mapData=await mapResponse.json();
  state.mapData=mapData;state.verification={projects:[],developers:[]};state.amenities={places:[],meta:{counts:{},categoryLabels:{}}};state.transport={type:'FeatureCollection',features:[]};
  state.communities=(mapData.communities||[]).map(x=>({...x,href:absHref(x.href)}));
  state.initiatives=(mapData.initiatives||[]).map(x=>({...x,href:absHref(x.href)}));
  state.places=[];
  state.projects=(mapData.projects||[]).map(x=>({...x,href:absHref(x.href)}));
  const __bt={};let __t=performance.now();
  applyProjectLocationCorrections(state.projects);__bt.location=performance.now()-__t;__t=performance.now();
  __bt.verification=0;__bt.exactCoords=0;
  attachMasterAvailability(state.projects);__bt.availability=performance.now()-__t;__t=performance.now();
  injectMasterOnlyProjects(state.projects);__bt.inject=performance.now()-__t;__t=performance.now();
  annotateLocationQuality(state.projects);__bt.quality=performance.now()-__t;__t=performance.now();
  rebuildIndexes();__bt.indexes=performance.now()-__t;__t=performance.now();
  updateStatus();__bt.status=performance.now()-__t;state.aeBootTimings=__bt;
  const exact=state.projects.filter(r=>locationQuality(r)==='exact').length,area=state.projects.filter(r=>locationQuality(r)==='area').length;
  $('#data-note').textContent=state.projects.length.toLocaleString()+' projects ready · '+Number(mapData.meta?.communities||state.communities.length).toLocaleString()+' communities · '+Number(mapData.meta?.initiatives||state.initiatives.length).toLocaleString()+' strategic initiatives. '+exact.toLocaleString()+' exact project pins; '+area.toLocaleString()+' area-level locations. Deep verification is loading after first paint.';
  $('#sync-pill span').textContent='Core map ready';performance.mark('ae:core-data-ready');
  queueMicrotask(()=>{try{aeBindScopeTabs();aeRenderExplorer()}catch{}});
}
async function hydrateContextData(){
  try{
    const [amenities,transport]=await Promise.all([
      fetch('/map/amenities.json',{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error('amenities '+r.status);return r.json()}),
      fetch('/map/transport-network.json',{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error('transport '+r.status);return r.json()})
    ]);
    state.amenities=amenities;state.transport=transport;state.places=amenities.places||[];rebuildIndexes();renderPlaceCategories();refreshPlaceSource();refreshTransportSource();
  }catch(e){console.warn('Context layers deferred',e);throw e}
}
async function syncLiveCatalogue(){
  const live=await fetchAllSiteProjects();
  if(live.projects.length){
    state.projects=mergeSiteIntoMap(state.mapData.projects||[],live.projects,state.communities);applyProjectLocationCorrections(state.projects);attachVerification(state.projects);applyExactVerificationCoordinates(state.projects);attachMasterAvailability(state.projects);injectMasterOnlyProjects(state.projects);annotateLocationQuality(state.projects);rebuildIndexes();refreshSources();
    $('#sync-pill').classList.add('ready');$('#sync-pill span').textContent=live.projects.length.toLocaleString()+' live PSR projects synced';
    const siteOnly=state.projects.filter(x=>x.siteOnly).length,positioned=state.projects.filter(x=>coordsOf(x)).length,unmapped=state.projects.length-positioned,exact=state.projects.filter(r=>locationQuality(r)==='exact').length,area=state.projects.filter(r=>locationQuality(r)==='area').length;
    $('#data-note').textContent=state.projects.length.toLocaleString()+' PSR project records after live sync · '+exact.toLocaleString()+' exact · '+area.toLocaleString()+' area-level · '+unmapped.toLocaleString()+' searchable but unpinned · '+siteOnly.toLocaleString()+' site-only records reconciled. Availability snapshot synced from the uploaded master workbook.';
  }else{$('#sync-pill').classList.add('ready');$('#sync-pill span').textContent='Snapshot mode · core verified'}
}

async function psrHydrateFullMapData(){
  if(state.fullMapLoaded||state.fullMapLoading)return;state.fullMapLoading=true;
  try{
    const full=await fetch('/map/map-data.json',{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error('full map '+r.status);return r.json()});
    state.mapData=full;state.communities=(full.communities||[]).map(x=>({...x,href:absHref(x.href)}));state.initiatives=(full.initiatives||[]).map(x=>({...x,href:absHref(x.href)}));state.projects=(full.projects||[]).map(x=>({...x,href:absHref(x.href)}));
    applyProjectLocationCorrections(state.projects);if(state.verification?.projects?.length){attachVerification(state.projects);applyExactVerificationCoordinates(state.projects)}attachMasterAvailability(state.projects);injectMasterOnlyProjects(state.projects);annotateLocationQuality(state.projects);rebuildIndexes();refreshSources();state.fullMapLoaded=true;performance.mark('ae:full-map-ready');
  }catch(e){console.warn('Full map hydration deferred',e)}finally{state.fullMapLoading=false}
}
async function psrHydrateVerification(){
  if(state.verificationHydrated||state.verificationHydrating)return;state.verificationHydrating=true;
  try{const verification=await fetch('/map/verification.json',{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error('verification '+r.status);return r.json()});state.verification=verification;attachVerification(state.projects);applyExactVerificationCoordinates(state.projects);attachMasterAvailability(state.projects);injectMasterOnlyProjects(state.projects);annotateLocationQuality(state.projects);rebuildIndexes();refreshSources();state.verificationHydrated=true;performance.mark('ae:verification-ready')}catch(e){console.warn('Verification hydration deferred',e)}finally{state.verificationHydrating=false}
}
async function psrHydrateDeepData(){await Promise.all([psrHydrateFullMapData(),psrHydrateVerification()]);const pill=$('#sync-pill');if(pill){pill.classList.add('ready');const s=pill.querySelector('span');if(s)s.textContent='Full intelligence ready'}}
let aeDeepHydrationPromise=null;function psrRequestDeepHydration(reason='interaction'){if(state.fullMapLoaded&&state.verificationHydrated)return Promise.resolve();if(aeDeepHydrationPromise)return aeDeepHydrationPromise;const run=()=>psrHydrateDeepData().finally(()=>{aeDeepHydrationPromise=null});aeDeepHydrationPromise=new Promise(resolve=>{const queue=()=>{const idle=window.requestIdleCallback?cb=>window.requestIdleCallback(cb,{timeout:2400}):cb=>setTimeout(cb,360);idle(()=>resolve(run()))};setTimeout(()=>{if(map.isMoving?.())map.once('moveend',queue);else queue()},650)});return aeDeepHydrationPromise}function scheduleDeepHydration(){state.deepHydrationDeferred=true}

const __aeCoreReady=bootData();
map.once('style.load',async()=>{
  try{await __aeCoreReady;addSourcesAndLayers();setupUI();performance.mark('ae:map-ui-ready');scheduleDeepHydration();setTimeout(()=>psrLoadEmirates().catch(e=>console.warn('emirates',e)),180);map.on('mousemove',scheduleHoverFromMap);map.on('click',clickFromMap);map.on('mouseout',()=>{hoverPoint=null;hideHover()});map.on('zoom',()=>{const z=map.getZoom();$('#zoom-label').textContent='Zoom '+z.toFixed(1);if(state.is3d&&z>=AE_3D_MIN_ZOOM)add3DBuildings()});map.on('moveend',()=>scheduleProjectFootprints(80));map.on('zoomend',()=>{sync3DForCamera();scheduleProjectFootprints(80)});/* seamless-v12: footprint resolution runs only after camera movement, never in an idle feedback loop */sync3DForCamera({animate:false});}
  catch(e){console.error(e);$('#sync-pill').classList.add('error');$('#sync-pill span').textContent='Data load failed';toast('Map data could not be loaded.');}
});


/* ===== PSR Spatial Intelligence v10: selection / spatial / heat ===== */
state.analysisMetric='off';
state.selectedSpatial=null;
state.spatial={emiratesLoaded:false,dubaiPolygonsLoaded:false,dubaiPolygonsLoading:false,dubaiPolygonData:null};

const PSR_GOLD='#69d8ff';
const PSR_NEUTRAL_BUILDING='#d9dddc';
const PSR_NEUTRAL_INK='#54cbff';
const FGIC_EMIRATE='https://stgnsdi.fgic.gov.ae/publishing/rest/services/Functional_Areas/Functional_Areas/MapServer/23/query';
const GEOBOUNDARIES_ARE_ADM1='/map/spatial/emirates-lite.geojson';
const DUBAI_COMMUNITY_POLYGONS='/map/spatial/dubai-communities.geojson';

function psrCommunityKey(v){
  return norm(v).replace(/\bjumeirah village circle jvc\b/g,'jumeirah village circle').replace(/\bjumeirah lake towers jlt\b/g,'jumeirah lake towers').replace(/\bdubai creek harbour the lagoons\b/g,'dubai creek harbour').replace(/\bdamac\b/g,'damac').replace(/\s+/g,' ').trim();
}
function psrCommunityIndex(){
  const m=new Map();
  for(const c of state.communities||[]){
    const vals=[c.name,c.slug,c.roi?.marketArea].filter(Boolean);
    for(const v of vals){const k=psrCommunityKey(v);if(k&&!m.has(k))m.set(k,c)}
  }
  return m;
}
function psrMatchCommunityByName(name){
  const k=psrCommunityKey(name),idx=psrCommunityIndex();
  if(idx.has(k))return idx.get(k);
  let best=null,score=0;
  for(const [ck,c] of idx){
    if(k.length<4||ck.length<4)continue;
    if(k.includes(ck)||ck.includes(k)){const s=Math.min(k.length,ck.length)/Math.max(k.length,ck.length);if(s>score){score=s;best=c}}
  }
  return score>=.62?best:null;
}
function psrCommunityProjectStats(){
  const out=new Map();
  for(const c of state.communities||[])out.set(c.id,{onSale:0,soldOut:0,exact:0,total:0});
  for(const p of state.projects||[]){
    const c=communityMatch(p,state.communities);if(!c)continue;
    const s=out.get(c.id)||{onSale:0,soldOut:0,exact:0,total:0};s.total++;
    if(availabilityClass(p)==='on-sale')s.onSale++;
    if(availabilityClass(p)==='sold-out')s.soldOut++;
    if(locationQuality(p)==='exact')s.exact++;
    out.set(c.id,s);
  }
  return out;
}
function psrPriceValue(r){
  const s=String(r.price||r.priceAed||'').replace(/,/g,'');
  const m=s.match(/(?:aed\s*)?([0-9]+(?:\.[0-9]+)?)\s*(m|million|k|thousand)?/i);if(!m)return null;
  let v=Number(m[1]);if(!Number.isFinite(v))return null;
  const u=(m[2]||'').toLowerCase();if(u==='m'||u==='million')v*=1000000;else if(u==='k'||u==='thousand')v*=1000;
  return v>10000?v:null;
}
function psrHeatPointData(metric){
  const feats=[];
  for(const r of state.projects||[]){
    const c=coordsOf(r);if(!c)continue;let value=null;
    if(metric==='price'){const p=psrPriceValue(r);if(p)value=Math.min(1,Math.max(.05,Math.log10(p/250000)/2.2))}
    else if(metric==='price-psf'){const p=psrPricePsfValue(r);if(p)value=Math.min(1,Math.max(.05,(p-500)/4500))}
    else if(metric==='projects')value=1;
    else if(metric==='active'&&r.timeline!=='past')value=1;
    else if(metric==='future'&&r.timeline==='future')value=1;
    else if(metric==='on-sale'&&availabilityClass(r)==='on-sale')value=1;
    else if(metric==='sold-out'&&availabilityClass(r)==='sold-out')value=1;
    else if(metric==='location-confidence'&&locationQuality(r)==='exact')value=1;
    if(value!=null)feats.push({type:'Feature',geometry:{type:'Point',coordinates:c},properties:{id:r.id,value}})
  }
  return fc(feats);
}
function psrPolygonMetric(c,metric,stats){
  if(!c)return null;
  if(metric==='projects')return Number(c.indexedProjects)||0;
  if(metric==='active')return Number(c.activeProjects)||0;
  if(metric==='future')return Number(c.timelineCounts?.future)||0;
  if(metric==='developers')return Array.isArray(c.developers)?c.developers.length:0;
  if(metric==='roi-apartment')return Number(c.roi?.apartment)||null;
  if(metric==='roi-villa')return Number(c.roi?.villa)||null;
  const s=stats.get(c.id)||{};
  if(metric==='on-sale')return Number(s.onSale)||0;
  if(metric==='sold-out')return Number(s.soldOut)||0;
  if(metric==='location-confidence')return s.total?100*(Number(s.exact)||0)/s.total:null;
  return null;
}
function psrRefreshDubaiPolygonMetrics(){
  if(!state.spatial.dubaiPolygonData)return;
  const stats=psrCommunityProjectStats(),metric=state.analysisMetric;
  for(const f of state.spatial.dubaiPolygonData.features||[]){
    const c=f.properties?.psrId?state.recordById.get(String(f.properties.psrId)):psrMatchCommunityByName(f.properties?.name);
    const v=psrPolygonMetric(c,metric,stats);
    f.properties.analysisValue=Number.isFinite(v)?v:null;
    if(c){f.properties.psrId=c.id;f.properties.psrName=c.name;f.properties.projectCount=c.indexedProjects||0}
  }
  map.getSource('psr-dubai-community-polygons')?.setData(state.spatial.dubaiPolygonData);
}
function psrAnalysisLabel(metric){
  return ({off:'Neutral map',price:'Starting price intensity','roi-apartment':'Apartment ROI','roi-villa':'Villa ROI','on-sale':'On-sale concentration','sold-out':'Sold-out concentration',projects:'Project density',active:'Active projects',future:'Future pipeline',developers:'Developer diversity','location-confidence':'Exact-location coverage'})[metric]||metric;
}
function psrUpdateAnalysisLegend(metric){
  const el=$('#analysis-legend'),note=$('#analysis-note');if(!el)return;
  if(metric==='off'){el.classList.add('hidden');if(note)note.textContent='Heat maps are opt-in. Gold is reserved for your current selection.';return}
  el.classList.remove('hidden');
  el.innerHTML='<strong>'+esc(psrAnalysisLabel(metric))+'</strong><div class="analysis-scale"></div><div class="analysis-legend-row"><span>Lower</span><span>Higher</span></div>';
  if(note)note.textContent=(metric.startsWith('roi-')?'Community projected gross ROI where sourced. ':'')+'Heat colors are analytical only. Gold remains selection-only.';
}
function psrSetAnalysis(metric){
  state.analysisMetric=metric||'off';
  const pointMetrics=new Set(['price','price-psf','projects','active','future','on-sale','sold-out','location-confidence']);
  const polyMetrics=new Set(['projects','active','future','developers','roi-apartment','roi-villa','on-sale','sold-out','location-confidence']);
  if(map.getLayer('psr-analysis-heat'))map.setLayoutProperty('psr-analysis-heat','visibility',pointMetrics.has(state.analysisMetric)?'visible':'none');
  if(map.getLayer('psr-community-analysis'))map.setLayoutProperty('psr-community-analysis','visibility',polyMetrics.has(state.analysisMetric)&&state.spatial.dubaiPolygonsLoaded?'visible':'none');
  map.getSource('psr-analysis-points')?.setData(pointMetrics.has(state.analysisMetric)?psrHeatPointData(state.analysisMetric):fc([]));
  psrRefreshDubaiPolygonMetrics();
  if(map.getLayer('roi-heat'))map.setLayoutProperty('roi-heat','visibility','none');
  if(map.getLayer('roi-points'))map.setLayoutProperty('roi-points','visibility','none');
  if(map.getLayer('roi-labels'))map.setLayoutProperty('roi-labels','visibility','none');
  psrUpdateAnalysisLegend(state.analysisMetric);
}
function psrSetSelectedPoint(r){
  state.selectedSpatial=r?{type:r.kind||'record',id:r.id,name:recordTitle(r)}:null;
  map.getSource('psr-selected-point')?.setData(r&&coordsOf(r)?fc([pointFeature({...r,id:r.id})]):fc([]));
  if(map.getLayer('psr-community-selected'))map.setFilter('psr-community-selected',['==',['get','psrId'],r?.kind==='community'?r.id:'__none__']);
  if(map.getLayer('psr-emirate-selected'))map.setFilter('psr-emirate-selected',['==',['get','psrName'],r?.kind==='emirate'?r.name:'__none__']);
  scheduleProjectFootprints(30);
}
function psrShowEmirate(name){
  const n=String(name||'').trim();if(!n)return;
  const projects=(state.projects||[]).filter(r=>norm(r.emirate)===norm(n));
  const communities=(state.communities||[]).filter(r=>norm(r.emirate)===norm(n));
  const future=(state.initiatives||[]).filter(r=>norm(r.emirate)===norm(n));
  state.selectedSpatial={type:'emirate',name:n,id:'emirate:'+norm(n)};
  if(map.getLayer('psr-emirate-selected'))map.setFilter('psr-emirate-selected',['==',['get','psrName'],n]);
  map.getSource('psr-selected-point')?.setData(fc([]));
  $('#detail-body').innerHTML='<div class="detail-content"><span class="detail-badge">EMIRATE</span><h2>'+esc(n)+'</h2><div class="detail-sub">UAE spatial intelligence</div><div class="detail-facts">'+detailFact('Projects',projects.length)+detailFact('Communities',communities.length)+detailFact('Future initiatives',future.length)+detailFact('On sale',projects.filter(r=>availabilityClass(r)==='on-sale').length)+detailFact('Exact project locations',projects.filter(r=>locationQuality(r)==='exact').length)+'</div><div class="detail-section"><h3>Geometry</h3><p>Emirate boundary is loaded from the highest available polygon source. Gold indicates selection only.</p></div></div>';
  $('#detail').classList.remove('hidden');
}
async function psrLoadEmirates(){
  if(state.spatial.emiratesLoaded)return;
  const status=$('#spatial-status');if(status)status.textContent='Loading emirate boundaries…';
  let data=null,source='geoBoundaries gbOpen / OpenStreetMap';
  try{const r=await (window.__AE_BOOT?.emirates||fetch(GEOBOUNDARIES_ARE_ADM1,{cache:'force-cache'}));if(r.ok)data=await r.json()}catch(e){console.warn('Emirate boundary load',e)}
  if(!data?.features?.length){if(status)status.textContent='Emirate geometry unavailable — no boundary fabricated';return}
  for(const f of data.features){const p=f.properties||{},name=p.EmirateName||p.shapeName||p.NAME_1||p.name||'';p.psrName=name;p.psrType='emirate';p.geometrySource=source;f.properties=p}
  state.spatial.emirateData=data;map.getSource('psr-emirate-polygons')?.setData(data);state.spatial.emiratesLoaded=true;state.spatial.emirateSource=source;performance.mark('ae:emirates-ready');
  if(status&&!state.spatial.dubaiPolygonsLoading)status.textContent=(data.features?.length||7)+' emirates · '+source;
}

async function psrLoadDubaiPolygons(){
  if(state.spatial.dubaiPolygonsLoaded||state.spatial.dubaiPolygonsLoading)return;
  state.spatial.dubaiPolygonsLoading=true;const status=$('#spatial-status');if(status)status.textContent='Loading Dubai community polygons…';
  try{
    const data=await fetch(DUBAI_COMMUNITY_POLYGONS).then(r=>{if(!r.ok)throw Error('polygons '+r.status);return r.json()});
    let matched=0;
    for(const f of data.features||[]){
      const p=f.properties||{},c=psrMatchCommunityByName(p.name||p.area_name_en||p.key||'');
      p.geometrySource='DLD-area / OSM curated polygon';p.psrType='community';
      if(c){p.psrId=c.id;p.psrName=c.name;p.projectCount=c.indexedProjects||0;matched++}
      f.properties=p;
    }
    state.spatial.dubaiPolygonData=data;state.spatial.dubaiPolygonsLoaded=true;
    map.getSource('psr-dubai-community-polygons')?.setData(data);psrRefreshDubaiPolygonMetrics();
    if(map.getLayer('community-points')){map.setPaintProperty('community-points','circle-opacity',0);map.setPaintProperty('community-points','circle-stroke-opacity',0);}
    if(map.getLayer('community-labels'))map.setLayoutProperty('community-labels','visibility','none');
    if(state.analysisMetric!=='off')psrSetAnalysis(state.analysisMetric);
    if(status)status.textContent=(data.features?.length||0)+' Dubai polygons · '+matched+' matched to PSR communities';
  }catch(e){console.warn('Dubai polygon load',e);if(status)status.textContent='Dubai polygons unavailable — centroid layer retained'}
  state.spatial.dubaiPolygonsLoading=false;
}
async function psrEnsureFullEmirates(){
  if(state.spatial.emiratesFullLoaded||state.spatial.emiratesFullLoading)return;state.spatial.emiratesFullLoading=true;
  try{const r=await fetch('/map/spatial/emirates.geojson',{cache:'force-cache'});if(!r.ok)throw Error('full emirates '+r.status);const data=await r.json();for(const f of data.features||[]){const p=f.properties||{},name=p.EmirateName||p.shapeName||p.NAME_1||p.name||'';p.psrName=name;p.psrType='emirate';p.geometrySource='geoBoundaries gbOpen / OpenStreetMap full-resolution';f.properties=p}state.spatial.emirateData=data;map.getSource('psr-emirate-polygons')?.setData(data);state.spatial.emiratesFullLoaded=true;state.spatial.emirateSource='geoBoundaries gbOpen / OpenStreetMap full-resolution'}catch(e){console.warn('Full emirate geometry deferred',e)}finally{state.spatial.emiratesFullLoading=false}
}
function psrShouldLoadDubai(){
  if(map.getZoom()<7.6)return false;const b=map.getBounds();return b.getEast()>54.95&&b.getWest()<55.65&&b.getNorth()>24.7&&b.getSouth()<25.55;
}

const _psrBaseAddSources=addSourcesAndLayers;
addSourcesAndLayers=function(){
  _psrBaseAddSources();
  if(map.getLayer('project-points'))map.setPaintProperty('project-points','circle-color',PSR_NEUTRAL_INK);
  if(map.getLayer('project-fallback-ring')){map.setPaintProperty('project-fallback-ring','circle-stroke-color','#ffc866');map.setPaintProperty('project-fallback-ring','circle-stroke-opacity',.8)}
  if(map.getLayer('initiative-points'))map.setPaintProperty('initiative-points','circle-color','#5aaeff');
  if(map.getLayer('project-footprint-extrusions')){
    map.setPaintProperty('project-footprint-extrusions','fill-extrusion-color',['case',['==',['get','selected'],1],PSR_GOLD,PSR_NEUTRAL_BUILDING]);
    map.setPaintProperty('project-footprint-extrusions','fill-extrusion-opacity',.68);
  }
  if(map.getLayer('project-footprint-outline')){
    map.setPaintProperty('project-footprint-outline','line-color',['case',['==',['get','selected'],1],PSR_GOLD,'rgba(87,145,171,.28)']);
    map.setPaintProperty('project-footprint-outline','line-width',['case',['==',['get','selected'],1],4,1.1]);
  }
  if(map.getLayer('project-footprint-labels'))map.setPaintProperty('project-footprint-labels','text-color','#e6f8ff');
  if(map.getLayer('roi-heat'))map.setPaintProperty('roi-heat','heatmap-color',['interpolate',['linear'],['heatmap-density'],0,'rgba(45,103,120,0)',.25,'rgba(45,103,120,.30)',.5,'rgba(54,128,139,.46)',.75,'rgba(70,157,151,.62)',1,'rgba(32,102,122,.82)']);
  if(map.getLayer('psr-3d-buildings'))map.setPaintProperty('psr-3d-buildings','fill-extrusion-height',['interpolate',['linear'],['zoom'],9.7,0,10.45,['case',['any',['==',['get','name'],'Burj Khalifa'],['==',['get','name:en'],'Burj Khalifa'],['==',['get','name_en'],'Burj Khalifa']],347.76,['*',['coalesce',['get','render_height'],10],.42]],11.4,['case',['any',['==',['get','name'],'Burj Khalifa'],['==',['get','name:en'],'Burj Khalifa'],['==',['get','name_en'],'Burj Khalifa']],828,['coalesce',['get','render_height'],10]]]);

  map.addSource('psr-selected-point',{type:'geojson',data:fc([])});
  map.addLayer({id:'psr-selected-point-glow',type:'circle',source:'psr-selected-point',paint:{'circle-radius':['interpolate',['linear'],['zoom'],6,8,15,15],'circle-color':'rgba(169,121,37,.12)','circle-stroke-color':PSR_GOLD,'circle-stroke-width':3.5}});

  map.addSource('psr-analysis-points',{type:'geojson',data:fc([])});
  map.addLayer({id:'psr-analysis-heat',type:'heatmap',source:'psr-analysis-points',maxzoom:15,layout:{visibility:'none'},paint:{'heatmap-weight':['coalesce',['get','value'],1],'heatmap-intensity':['interpolate',['linear'],['zoom'],6,.75,13,2.3],'heatmap-radius':['interpolate',['linear'],['zoom'],6,18,13,52],'heatmap-opacity':.74,'heatmap-color':['interpolate',['linear'],['heatmap-density'],0,'rgba(47,111,124,0)',.2,'rgba(160,199,204,.28)',.45,'rgba(94,160,169,.48)',.72,'rgba(49,126,139,.66)',1,'rgba(22,76,94,.86)']}});

  map.addSource('psr-emirate-polygons',{type:'geojson',data:fc([])});
  map.addLayer({id:'psr-emirate-fill',type:'fill',source:'psr-emirate-polygons',paint:{'fill-color':'#5bc7ff','fill-opacity':.035}});
  map.addLayer({id:'psr-emirate-line',type:'line',source:'psr-emirate-polygons',paint:{'line-color':'rgba(108,204,255,.42)','line-width':['interpolate',['linear'],['zoom'],5,.7,10,1.4]}});
  map.addLayer({id:'psr-emirate-selected',type:'fill',source:'psr-emirate-polygons',filter:['==',['get','psrName'],'__none__'],paint:{'fill-color':PSR_GOLD,'fill-opacity':.16,'fill-outline-color':PSR_GOLD}});

  map.addSource('psr-dubai-community-polygons',{type:'geojson',data:fc([])});
  const before=map.getLayer('project-clusters')?'project-clusters':undefined;
  map.addLayer({id:'psr-community-base',type:'fill',source:'psr-dubai-community-polygons',paint:{'fill-color':'#7d8b8f','fill-opacity':['case',['==',['get','psrId'],null],.012,.035]}},before);
  map.addLayer({id:'psr-community-analysis',type:'fill',source:'psr-dubai-community-polygons',layout:{visibility:'none'},paint:{'fill-color':['interpolate',['linear'],['coalesce',['get','analysisValue'],0],0,'#e9eef0',5,'#b9d4d9',15,'#6aa7ae',40,'#2f6f7c',80,'#174b5b'],'fill-opacity':['case',['has','analysisValue'],.6,0]}},before);
  map.addLayer({id:'psr-community-line',type:'line',source:'psr-dubai-community-polygons',paint:{'line-color':'rgba(71,81,86,.24)','line-width':['interpolate',['linear'],['zoom'],8,.4,13,1.2]}},before);
  map.addLayer({id:'psr-community-selected',type:'fill',source:'psr-dubai-community-polygons',filter:['==',['get','psrId'],'__none__'],paint:{'fill-color':PSR_GOLD,'fill-opacity':.2,'fill-outline-color':PSR_GOLD}});
  map.addLayer({id:'psr-community-polygon-labels',type:'symbol',source:'psr-dubai-community-polygons',minzoom:9.3,layout:{'text-field':['coalesce',['get','psrName'],['get','name']],'text-size':['interpolate',['linear'],['zoom'],9,9,13,12],'text-max-width':12,'text-optional':true},paint:{'text-color':'#4e575c','text-halo-color':'rgba(255,255,255,.9)','text-halo-width':1.3}});

  map.on('click','psr-community-selected',()=>{});
  map.on('click','psr-community-base',e=>{const f=e.features?.[0],id=f?.properties?.psrId;if(!id)return;const r=state.recordById.get(String(id));if(r){showDetail(r);psrSetSelectedPoint(r)}});
  map.on('mouseenter','psr-community-base',()=>map.getCanvas().style.cursor='pointer');map.on('mouseleave','psr-community-base',()=>map.getCanvas().style.cursor='');
  map.on('click','psr-emirate-fill',e=>{const n=e.features?.[0]?.properties?.psrName;if(n)psrShowEmirate(n)});
  map.on('mouseenter','psr-emirate-fill',()=>map.getCanvas().style.cursor='pointer');map.on('mouseleave','psr-emirate-fill',()=>map.getCanvas().style.cursor='');
};

const _psrBaseShowDetail=showDetail;
showDetail=function(r){
  _psrBaseShowDetail(r);psrSetSelectedPoint(r);
  const body=$('#detail-body');if(body&&r?.kind==='project'){const note=document.createElement('div');note.className='selection-only-note';note.textContent='Gold indicates the current selection only.';body.querySelector('.detail-content')?.appendChild(note)}
};
const _psrBaseRefresh=refreshSources;
refreshSources=function(){_psrBaseRefresh();if(state.analysisMetric!=='off')psrSetAnalysis(state.analysisMetric);if(state.spatial.dubaiPolygonsLoaded)psrRefreshDubaiPolygonMetrics()};

map.on('load',()=>{if(!state.spatial.emiratesLoaded)psrLoadEmirates();setTimeout(()=>{if(psrShouldLoadDubai())psrLoadDubaiPolygons()},500)});
map.on('moveend',()=>{if(psrShouldLoadDubai())psrLoadDubaiPolygons()});


/* ===== PSR Spatial Intelligence v12: compare / performance / interaction ===== */
state.compareIds=new Set();
state.compareMetrics=new Set(['price','availability','handover','developer','community','rera','roiApartment']);
state.contextLoaded=false;
state.contextLoading=false;

const PSR_COMPARE_METRICS=[
  ['price','Starting price'],['pricePsf','Price / sqft'],['availability','Availability'],['status','Status'],['handover','Handover'],['paymentPlan','Payment plan'],
  ['developer','Developer'],['community','Community'],['rera','RERA / Project ID'],['roiApartment','Apartment ROI'],['roiVilla','Villa ROI'],
  ['location','Location accuracy'],['propertyTypes','Property types'],['bedrooms','Bedrooms'],['timeline','Timeline']
];
function psrCommunityForProject(r){return communityMatch(r,state.communities)||psrMatchCommunityByName(r.area)}
function psrMetricValue(r,key){
  const c=psrCommunityForProject(r);const live=(state.siteProjects||[]).find(x=>x.slug&&r.slug&&x.slug===r.slug)||{};
  const val=k=>r?.[k]??live?.[k];
  if(key==='price')return val('price')||'—';
  if(key==='pricePsf')return val('pricePerSqft')||val('pricePerSqftLabel')||'—';
  if(key==='availability')return availabilityLabel(r);
  if(key==='status')return r.masterStatus||r.status||r.statusLabel||live.statusLabel||'—';
  if(key==='handover')return val('handover')||'—';
  if(key==='paymentPlan')return val('paymentPlan')||'—';
  if(key==='developer')return val('developer')||'—';
  if(key==='community')return c?.name||val('area')||'—';
  if(key==='rera')return r.masterRera||r.verification?.dldReraNo||r.verification?.otherProjectId||'—';
  if(key==='roiApartment')return Number.isFinite(Number(c?.roi?.apartment))?Number(c.roi.apartment).toFixed(2)+'%':'—';
  if(key==='roiVilla')return Number.isFinite(Number(c?.roi?.villa))?Number(c.roi.villa).toFixed(2)+'%':'—';
  if(key==='location')return locationLabel(r);
  if(key==='propertyTypes'){const x=val('propertyTypes');return Array.isArray(x)&&x.length?x.join(', '):'—'}
  if(key==='bedrooms'){const x=val('bedrooms');return Array.isArray(x)&&x.length?x.join(', '):'—'}
  if(key==='timeline')return r.timeline||'—';
  return '—';
}

function psrCompareRecords(){return [...state.compareIds].map(id=>state.recordById.get(String(id))).filter(Boolean)}
function psrUpdateCompareSource(){
  const recs=psrCompareRecords(),features=[];
  recs.forEach((r,i)=>{const c=coordsOf(r);if(c)features.push({type:'Feature',geometry:{type:'Point',coordinates:c},properties:{id:r.id,n:String(i+1),name:recordTitle(r)}})});
  map.getSource('psr-compare')?.setData(fc(features));
}
function psrRenderCompareTray(){
  const tray=$('#compare-tray'),chips=$('#compare-chips'),recs=psrCompareRecords();if(!tray||!chips)return;
  tray.classList.toggle('hidden',!recs.length);$('#compare-count').textContent=recs.length+' selected';
  chips.innerHTML=recs.map((r,i)=>'<span class="compare-chip"><b>'+String(i+1)+'</b>'+esc(recordTitle(r))+'<button type="button" data-remove-compare="'+esc(r.id)+'">×</button></span>').join('');
  chips.querySelectorAll('[data-remove-compare]').forEach(b=>b.addEventListener('click',()=>{state.compareIds.delete(b.dataset.removeCompare);psrRenderCompareTray();psrRenderCompareTable();psrUpdateCompareSource()}));
  psrUpdateCompareSource();
}
function psrToggleCompare(r){
  if(!r||r.kind!=='project')return;
  if(state.compareIds.has(r.id))state.compareIds.delete(r.id);
  else{if(state.compareIds.size>=5){toast('Compare up to 5 projects.');return}state.compareIds.add(r.id)}
  psrRenderCompareTray();psrRenderCompareTable();
}
function psrRenderMetricPicker(){
  const el=$('#compare-metrics');if(!el)return;
  el.innerHTML=PSR_COMPARE_METRICS.map(([k,l])=>'<label class="compare-metric"><input type="checkbox" data-compare-metric="'+k+'" '+(state.compareMetrics.has(k)?'checked':'')+'> <span>'+esc(l)+'</span></label>').join('');
  el.querySelectorAll('[data-compare-metric]').forEach(cb=>cb.addEventListener('change',()=>{cb.checked?state.compareMetrics.add(cb.dataset.compareMetric):state.compareMetrics.delete(cb.dataset.compareMetric);psrRenderCompareTable()}));
}
function psrRenderCompareTable(){
  const el=$('#compare-table');if(!el)return;const recs=psrCompareRecords();
  if(!recs.length){el.innerHTML='<div style="padding:18px">Select projects to compare.</div>';return}
  const metrics=PSR_COMPARE_METRICS.filter(([k])=>state.compareMetrics.has(k));
  let h='<table class="compare-table"><thead><tr><th>Metric</th>'+recs.map((r,i)=>'<th>'+String(i+1)+'. '+esc(recordTitle(r))+'</th>').join('')+'</tr></thead><tbody>';
  for(const [k,l] of metrics)h+='<tr><td>'+esc(l)+'</td>'+recs.map(r=>'<td>'+esc(psrMetricValue(r,k))+'</td>').join('')+'</tr>';
  h+='</tbody></table>';el.innerHTML=h;
}
async function psrEnsureContextData(){
  if(state.contextLoaded)return;
  if(state.contextPromise)return state.contextPromise;
  ensureContextLayers();state.contextLoading=true;
  document.querySelectorAll('[data-context-status]').forEach(el=>{el.textContent='Loading nearby places and transport…'});
  state.contextPromise=_psrOriginalHydrateContextData().then(()=>{
    state.contextLoaded=true;document.querySelectorAll('[data-context-status]').forEach(el=>{el.textContent='Nearby places and transport are ready.'});toast('Places & transport loaded.');
  }).catch(e=>{
    console.warn(e);document.querySelectorAll('[data-context-status]').forEach(el=>{el.textContent='Could not load context. Select Places or Transit to retry.'});toast('Context data could not be loaded.');
  }).finally(()=>{state.contextLoading=false;state.contextPromise=null});
  return state.contextPromise;
}

const _psrOriginalHydrateContextData=hydrateContextData;
hydrateContextData=async function(){state.contextDeferred=true};

const _psrCurrentFootprintFeature=footprintFeature;
footprintFeature=function(building,r){
  const f=_psrCurrentFootprintFeature(building,r);
  const canonical=norm(r?.verification?.project||r?.name);
  if(canonical==='burj khalifa'||norm(r?.verification?.registeredProjectName)==='burj khalifa towers'){f.properties.renderHeight=828;f.properties.heightSource='Emaar official 828 m'}
  return f;
};

const _psrCurrentAddSources=addSourcesAndLayers;
addSourcesAndLayers=function(){
  _psrCurrentAddSources();
  map.addSource('psr-compare',{type:'geojson',data:fc([])});
  map.addLayer({id:'psr-compare-points',type:'circle',source:'psr-compare',paint:{'circle-radius':12,'circle-color':'#171b1e','circle-stroke-width':2.5,'circle-stroke-color':'rgba(255,255,255,.95)'}});
  map.addLayer({id:'psr-compare-labels',type:'symbol',source:'psr-compare',layout:{'text-field':['get','n'],'text-size':10,'text-allow-overlap':true},paint:{'text-color':'#fff'}});
};

const _psrCurrentShowDetail=showDetail;
showDetail=function(r){
  _psrCurrentShowDetail(r);
  if(r?.kind==='project'){
    const actions=$('#detail-body .detail-actions');if(actions&&!actions.querySelector('.compare-action')){
      const b=document.createElement('button');b.type='button';b.className='compare-action';b.textContent=state.compareIds.has(r.id)?'Remove from compare':'Compare project';b.addEventListener('click',()=>{psrToggleCompare(r);b.textContent=state.compareIds.has(r.id)?'Remove from compare':'Compare project'});actions.appendChild(b)
    }
  }
};

map.on('load',()=>{
  const metric=$('#analysis-metric');if(metric)metric.addEventListener('change',e=>psrSetAnalysis(e.target.value));
  const roi=$('#roi-mode');if(roi?.closest('.row-toggle'))roi.closest('.row-toggle').style.display='none';
  psrRenderMetricPicker();psrRenderCompareTable();
  $('#compare-open')?.addEventListener('click',()=>{$('#compare-panel').classList.remove('hidden');psrRenderMetricPicker();psrRenderCompareTable()});
  $('#compare-close')?.addEventListener('click',()=>$('#compare-panel').classList.add('hidden'));
  $('#compare-clear')?.addEventListener('click',()=>{state.compareIds.clear();psrRenderCompareTray();psrRenderCompareTable();psrUpdateCompareSource()});
  $('#detail-close')?.addEventListener('click',()=>psrSetSelectedPoint(null));
  document.querySelectorAll('.rail-btn[data-panel="places"],.rail-btn[data-panel="transport"]').forEach(b=>b.addEventListener('click',psrEnsureContextData));
});

window.__PSR_COMPARE_API__={toggle:psrToggleCompare,records:psrCompareRecords,render:psrRenderCompareTable,clear:()=>{state.compareIds.clear();psrRenderCompareTray();psrRenderCompareTable();psrUpdateCompareSource()}};


/* ===== PSR Spatial Intelligence v22 — UAE analytics / routes / units / AI ===== */
state.unitsLoaded=false;state.unitById=new Map();state.routeCache=new Map();state.officialSpatialCache=new Map();state.officialSpatialBusy=false;

function psrLiveProject(r){return (state.siteProjects||[]).find(x=>x.slug&&r?.slug&&x.slug===r.slug)||{}}
function psrParseAedNumber(v){
  if(v===null||v===undefined)return null;if(typeof v==='number')return Number.isFinite(v)?v:null;
  const s=String(v).replace(/,/g,'').trim(),m=s.match(/([0-9]+(?:.[0-9]+)?)s*(m|million|k|thousand)?/i);if(!m)return null;
  let n=Number(m[1]);const u=(m[2]||'').toLowerCase();if(u==='m'||u==='million')n*=1e6;else if(u==='k'||u==='thousand')n*=1e3;return Number.isFinite(n)?n:null;
}
function psrPricePsfValue(r){
  if(!r)return null;
  if(r.kind==='unit'){const p=Number(r.price_per_sqft);return Number.isFinite(p)&&p>0?p:(Number(r.size_sqft)>0&&Number(r.price_aed)>0?Number(r.price_aed)/Number(r.size_sqft):null)}
  const l=psrLiveProject(r),vals=[r.pricePerSqft,r.pricePerSqftLabel,r.price_psf,r.psf,l.pricePerSqft,l.pricePerSqftLabel,l.price_psf,l.psf];
  for(const v of vals){const n=psrParseAedNumber(v);if(n&&n>50&&n<100000)return n}
  return null;
}
function psrFmtAed(v){const n=Number(v);return Number.isFinite(n)?'AED '+Math.round(n).toLocaleString():'—'}
function psrFmtPsf(v){const n=Number(v);return Number.isFinite(n)?'AED '+Math.round(n).toLocaleString()+' / sqft':'—'}
function psrMedian(a){const x=a.filter(Number.isFinite).sort((a,b)=>a-b);if(!x.length)return null;const m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2}

function psrEmirateMetric(name,metric){
  const ps=(state.projects||[]).filter(r=>norm(r.emirate)===norm(name));if(!ps.length)return null;
  if(metric==='projects')return ps.length;
  if(metric==='active')return ps.filter(r=>r.timeline!=='past').length;
  if(metric==='future')return ps.filter(r=>r.timeline==='future').length;
  if(metric==='on-sale')return ps.filter(r=>availabilityClass(r)==='on-sale').length;
  if(metric==='sold-out')return ps.filter(r=>availabilityClass(r)==='sold-out').length;
  if(metric==='location-confidence')return 100*ps.filter(r=>locationQuality(r)==='exact').length/ps.length;
  if(metric==='price')return psrMedian(ps.map(psrPriceValue));
  if(metric==='price-psf')return psrMedian(ps.map(psrPricePsfValue));
  return null;
}
function psrRefreshEmirateAnalysis(){
  const data=state.spatial?.emirateData;if(!data?.features)return;
  const metric=state.analysisMetric,vals=[];
  for(const f of data.features){const n=f.properties?.psrName||f.properties?.shapeName||'';const v=psrEmirateMetric(n,metric);f.properties.analysisValue=Number.isFinite(v)?v:null;if(Number.isFinite(v))vals.push(v)}
  const lo=Math.min(...vals),hi=Math.max(...vals);
  for(const f of data.features){const v=Number(f.properties.analysisValue);f.properties.analysisNorm=Number.isFinite(v)&&Number.isFinite(lo)&&Number.isFinite(hi)?(hi===lo?1:(v-lo)/(hi-lo)):null}
  map.getSource('psr-emirate-polygons')?.setData(data);
  if(map.getLayer('psr-emirate-analysis'))map.setLayoutProperty('psr-emirate-analysis','visibility',metric==='off'?'none':'visible');
}
const _psrSetAnalysisV22=psrSetAnalysis;
psrSetAnalysis=function(metric){_psrSetAnalysisV22(metric);psrRefreshEmirateAnalysis()};

function psrBoundsKey(layer,b){return layer+':'+[b.getWest(),b.getSouth(),b.getEast(),b.getNorth()].map(x=>x.toFixed(2)).join(',')}
async function psrFetchOfficial(layer){
  const b=map.getBounds(),key=psrBoundsKey(layer,b);if(state.officialSpatialCache.has(key))return state.officialSpatialCache.get(key);
  const bbox=[b.getWest(),b.getSouth(),b.getEast(),b.getNorth()].join(',');
  const r=await fetch('/map/spatial/official.geojson?layer='+encodeURIComponent(layer)+'&bbox='+encodeURIComponent(bbox));
  if(!r.ok)throw Error(layer+' '+r.status);const j=await r.json();state.officialSpatialCache.set(key,j);return j;
}
function psrNameField(p){return p?.NameEnglish||p?.DistrictName||p?.SubDistrictName||p?.name||p?.Name||p?.ParcelID||p?.BuildingOutlineID||''}
async function psrLoadOfficialViewport(){
  if(state.officialSpatialBusy)return;state.officialSpatialBusy=true;
  const z=map.getZoom(),jobs=[];
  if(z>=7.2)jobs.push(['district','psr-official-districts']);
  if(z>=10.4)jobs.push(['subdistrict','psr-official-subdistricts']);
  if(z>=12.3)jobs.push(['block','psr-official-blocks']);
  if(z>=14.4)jobs.push(['parcel','psr-official-parcels']);
  if(z>=15.8)jobs.push(['building','psr-official-buildings']);
  try{
    for(const [layer,source] of jobs){
      try{const j=await psrFetchOfficial(layer);for(const f of j.features||[]){f.properties=f.properties||{};f.properties.psrLabel=psrNameField(f.properties);f.properties.psrLayer=layer}map.getSource(source)?.setData(j)}catch(e){console.warn('official spatial '+layer,e)}
    }
  }finally{state.officialSpatialBusy=false}
}
let psrSpatialTimer=null;
function psrScheduleOfficial(){clearTimeout(psrSpatialTimer);psrSpatialTimer=setTimeout(psrLoadOfficialViewport,180)}

function psrRouteSection(r){
  const box=document.createElement('div');box.className='route-intelligence';box.innerHTML='<h3>Drive-time intelligence</h3><div class="route-grid"><span style="font-size:9px;color:var(--psr-muted)">Calculating road routes…</span></div>';
  $('#detail-body .detail-content')?.appendChild(box);
  if(locationQuality(r)!=='exact'||!coordsOf(r)){box.querySelector('.route-grid').innerHTML='<span style="font-size:9px;color:var(--psr-muted)">Routes require an exact verified project coordinate.</span>';return}
  psrLoadRouteSummary(r,box);
}
async function psrLoadRouteSummary(r,box){
  const c=coordsOf(r),key=r.id;if(state.routeCache.has(key)){psrRenderRoutes(r,box,state.routeCache.get(key));return}
  try{const q=new URLSearchParams({lat:c[1],lng:c[0],emirate:r.emirate||'Dubai'}),j=await fetch('/map/api/route-summary?'+q).then(x=>x.json());if(j.locations){state.routeCache.set(key,j);psrRenderRoutes(r,box,j)}else throw Error(j.error||'route unavailable')}catch(e){box.querySelector('.route-grid').innerHTML='<span style="font-size:9px;color:var(--psr-muted)">Road routing unavailable right now.</span>'}
}
function psrRenderRoutes(r,box,j){
  box.querySelector('.route-grid').innerHTML=(j.locations||[]).map(x=>'<button type="button" class="route-card" data-route-to="'+esc(x.id)+'"><strong>'+esc(x.name)+'</strong><span>'+(x.durationMin??'—')+' min · '+(x.distanceKm??'—')+' km</span></button>').join('');
  box.querySelectorAll('[data-route-to]').forEach(b=>b.addEventListener('click',()=>psrDrawRoute(r,b.dataset.routeTo,b)));
}
async function psrDrawRoute(r,to,button){
  const c=coordsOf(r);if(!c)return;try{
    const q=new URLSearchParams({lat:c[1],lng:c[0],emirate:r.emirate||'Dubai',to}),j=await fetch('/map/api/route?'+q).then(x=>x.json());if(!j.geometry)throw Error('no route');
    map.getSource('psr-route')?.setData({type:'FeatureCollection',features:[{type:'Feature',geometry:j.geometry,properties:{distanceKm:j.distanceKm,durationMin:j.durationMin}}]});
    document.querySelectorAll('.route-card').forEach(x=>x.classList.remove('active'));button?.classList.add('active');
    const coords=j.geometry.coordinates;if(coords?.length){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const p of coords){minX=Math.min(minX,p[0]);minY=Math.min(minY,p[1]);maxX=Math.max(maxX,p[0]);maxY=Math.max(maxY,p[1])}map.fitBounds([[minX,minY],[maxX,maxY]],{padding:psrFitPadding(),duration:700,maxZoom:13})}
  }catch(e){toast('Route could not be drawn.')}
}

async function psrLoadUnits(q=''){
  try{const u='/map/api/units?limit=30'+(q?'&q='+encodeURIComponent(q):''),j=await fetch(u).then(r=>r.json());const units=j.units||[];for(const r of units){r.kind='unit';r.name=r.title;state.unitById.set(r.id,r);state.recordById.set(String(r.id),r)}state.unitsLoaded=true;return units}catch(e){console.warn('unit inventory',e);return[]}
}
function psrUnitMetric(r,key){
  if(key==='price')return psrFmtAed(r.price_aed);
  if(key==='pricePsf')return psrFmtPsf(psrPricePsfValue(r));
  if(key==='availability'||key==='status')return r.status||'—';
  if(key==='community')return r.community||'—';
  if(key==='developer')return 'Secondary / listing inventory';
  if(key==='propertyTypes')return r.property_type||'—';
  if(key==='bedrooms')return r.bedrooms||'—';
  if(key==='size')return r.size_sqft?Number(r.size_sqft).toLocaleString()+' sqft':'—';
  if(key==='bathrooms')return r.bathrooms??'—';
  if(key==='reference')return r.reference||'—';
  if(key==='location')return r.community||r.emirate||'—';
  return '—';
}
const _psrMetricValueV22=psrMetricValue;
psrMetricValue=function(r,key){if(r?.kind==='unit')return psrUnitMetric(r,key);const v=_psrMetricValueV22(r,key);if(key==='pricePsf'&&(v==='—'||!v))return psrFmtPsf(psrPricePsfValue(r));return v};
if(!PSR_COMPARE_METRICS.some(x=>x[0]==='size'))PSR_COMPARE_METRICS.push(['size','Size'],['bathrooms','Bathrooms'],['reference','Reference']);

psrToggleCompare=function(r){
  if(!r||!['project','unit'].includes(r.kind))return;
  if(state.compareIds.has(r.id))state.compareIds.delete(r.id);else{if(state.compareIds.size>=5){toast('Compare up to 5 projects or units.');return}state.compareIds.add(r.id)}
  psrRenderCompareTray();psrRenderCompareTable();psrRefreshAIContextLabel();
};
async function psrRenderCompareInventory(q){
  const box=$('#compare-inventory-results');if(!box)return;const query=norm(q);if(query.length<2){box.classList.add('hidden');return}
  const projects=(state.projects||[]).filter(r=>searchHay(r).includes(query)).slice(0,7),units=await psrLoadUnits(q);
  const rows=[...projects,...units].slice(0,12);if(!rows.length){box.innerHTML='<div class="data-note">No matching project or published unit.</div>';box.classList.remove('hidden');return}
  box.innerHTML=rows.map(r=>'<button class="compare-inventory-item" data-cmp-id="'+esc(r.id)+'"><span><strong>'+esc(recordTitle(r))+'</strong><small>'+esc(r.kind==='unit'?(r.community||r.emirate||'Unit'):(r.area||r.developer||'Project'))+'</small></span><em>'+esc(r.kind)+'</em></button>').join('');
  box.classList.remove('hidden');box.querySelectorAll('[data-cmp-id]').forEach(b=>b.addEventListener('click',()=>{const r=state.recordById.get(String(b.dataset.cmpId));if(r)psrToggleCompare(r);box.classList.add('hidden')}));
}

function psrAIContext(){
  const sel=state.selected,compare=psrCompareRecords(),route=sel?state.routeCache.get(sel.id):null;
  const shape=r=>r?{kind:r.kind,name:recordTitle(r),developer:r.developer||null,emirate:r.emirate||null,community:r.area||r.community||null,price:r.kind==='unit'?r.price_aed:r.price||null,pricePerSqft:psrPricePsfValue(r),availability:r.kind==='unit'?r.status:availabilityLabel(r),handover:r.handover||null,rera:r.masterRera||r.verification?.dldReraNo||null,sizeSqft:r.size_sqft||null,bedrooms:r.bedrooms||null,bathrooms:r.bathrooms||null,locationAccuracy:r.kind==='project'?locationLabel(r):null}:null;
  return {selected:shape(sel),comparison:compare.map(shape),analysisMetric:state.analysisMetric,routeSummary:route?.locations||null,visible:{projects:filteredProjects().length,zoom:Number(map.getZoom().toFixed(1)),center:map.getCenter().toArray().map(x=>Number(x.toFixed(5)))}};
}
function psrRefreshAIContextLabel(){
  const el=$('#ai-context');if(!el)return;const c=psrAIContext();el.textContent=c.selected?'Selected: '+c.selected.name+(c.comparison.length?' · '+c.comparison.length+' items in Compare':''):(c.comparison.length?c.comparison.length+' items in Compare':'No selection yet — AI will use the visible map and comparison context.');
}
async function psrAskAI(){
  const q=$('#ai-question')?.value.trim(),btn=$('#ai-ask'),ans=$('#ai-answer');if(!q||!btn||!ans)return;
  btn.disabled=true;btn.textContent='Thinking…';ans.textContent='Analyzing verified map context…';
  try{const r=await fetch('/map/api/ai',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:q,context:psrAIContext()})}),j=await r.json();ans.textContent=j.answer||j.error||'No answer returned.'}catch(e){ans.textContent='AI is temporarily unavailable.'}finally{btn.disabled=false;btn.textContent='Ask Espacios AI'}
}

const _psrShowDetailV22=showDetail;
showDetail=function(r){
  _psrShowDetailV22(r);psrRefreshAIContextLabel();
  const facts=$('#detail-body .detail-facts'),psf=psrPricePsfValue(r);
  if(facts&&psf&&!facts.querySelector('[data-psr-psf]')){const d=document.createElement('div');d.className='detail-fact price-psf';d.dataset.psrPsf='1';d.innerHTML='<span>Project ask AED / sqft</span><b>'+esc(psrFmtPsf(psf))+'</b>';facts.appendChild(d)}
  if(r?.kind==='project')psrRouteSection(r);
};

const _psrAddSourcesV22=addSourcesAndLayers;
addSourcesAndLayers=function(){
  _psrAddSourcesV22();
  if(!map.getLayer('psr-emirate-analysis'))map.addLayer({id:'psr-emirate-analysis',type:'fill',source:'psr-emirate-polygons',layout:{visibility:'none'},paint:{'fill-color':['interpolate',['linear'],['coalesce',['get','analysisNorm'],0],0,'#e9eef0',.25,'#bed7dc',.5,'#78adb6',.75,'#397d8c',1,'#164f63'],'fill-opacity':['interpolate',['linear'],['zoom'],5,.5,8,.28,10,0]}},'psr-emirate-selected');

  const mk=(id)=>{if(!map.getSource(id))map.addSource(id,{type:'geojson',data:fc([])})};
  ['psr-official-districts','psr-official-subdistricts','psr-official-blocks','psr-official-parcels','psr-official-buildings'].forEach(mk);
  if(!map.getLayer('psr-official-district-fill'))map.addLayer({id:'psr-official-district-fill',type:'fill',source:'psr-official-districts',minzoom:7.2,paint:{'fill-color':'#748187','fill-opacity':.018}});
  if(!map.getLayer('psr-official-district-line'))map.addLayer({id:'psr-official-district-line',type:'line',source:'psr-official-districts',minzoom:7.2,paint:{'line-color':'rgba(48,59,64,.52)','line-width':['interpolate',['linear'],['zoom'],7,.8,11,1.5,14,2]}});
  if(!map.getLayer('psr-official-district-label'))map.addLayer({id:'psr-official-district-label',type:'symbol',source:'psr-official-districts',minzoom:8.2,layout:{'text-field':['get','psrLabel'],'text-size':10,'text-max-width':12,'text-optional':true},paint:{'text-color':'#5a6368','text-halo-color':'rgba(255,255,255,.9)','text-halo-width':1.2}});
  if(!map.getLayer('psr-official-subdistrict-line'))map.addLayer({id:'psr-official-subdistrict-line',type:'line',source:'psr-official-subdistricts',minzoom:10.4,paint:{'line-color':'rgba(70,80,85,.34)','line-width':['interpolate',['linear'],['zoom'],10,.6,14,1.2]}});
  if(!map.getLayer('psr-official-block-line'))map.addLayer({id:'psr-official-block-line',type:'line',source:'psr-official-blocks',minzoom:12.3,paint:{'line-color':'rgba(84,94,99,.28)','line-width':.75}});
  if(!map.getLayer('psr-official-parcel-line'))map.addLayer({id:'psr-official-parcel-line',type:'line',source:'psr-official-parcels',minzoom:14.4,paint:{'line-color':'rgba(91,101,106,.22)','line-width':.55}});
  if(!map.getLayer('psr-official-building-line'))map.addLayer({id:'psr-official-building-line',type:'line',source:'psr-official-buildings',minzoom:15.8,paint:{'line-color':'rgba(54,64,69,.22)','line-width':.65}});

  if(!map.getSource('psr-route'))map.addSource('psr-route',{type:'geojson',data:fc([])});
  if(!map.getLayer('psr-route-line'))map.addLayer({id:'psr-route-line',type:'line',source:'psr-route',paint:{'line-color':'#a97925','line-width':['interpolate',['linear'],['zoom'],7,2.5,15,5],'line-opacity':.88}});
  if(map.getLayer('psr-community-line')){map.setPaintProperty('psr-community-line','line-color','rgba(45,55,60,.58)');map.setPaintProperty('psr-community-line','line-width',['interpolate',['linear'],['zoom'],7.5,.9,10,1.45,13,2.15,15,2.5])}
  if(map.getLayer('psr-community-base'))map.setPaintProperty('psr-community-base','fill-opacity',['case',['has','psrId'],.05,.024]);
  if(map.getLayer('psr-community-polygon-labels')){map.setPaintProperty('psr-community-polygon-labels','text-color','#485156');void 0}
};

map.on('load',()=>{
  psrRefreshAIContextLabel();psrScheduleOfficial();
  $('#ai-ask')?.addEventListener('click',psrAskAI);$('#ai-question')?.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter')psrAskAI()});
  const ci=$('#compare-inventory-search');ci?.addEventListener('input',()=>psrRenderCompareInventory(ci.value));
  $('#compare-open')?.addEventListener('click',async()=>{const units=await psrLoadUnits('');const s=$('#unit-inventory-status');if(s)s.textContent=units.length?units.length+' published units available for comparison.':'0 published units currently in PSR inventory — project comparison remains available.'});
});
map.on('moveend',psrScheduleOfficial);

/* PSR deterministic live sync v24 */
state.liveSyncInFlight=false;state.liveSyncDone=false;
const _psrSyncLiveV24=syncLiveCatalogue;
syncLiveCatalogue=async function(){if(state.liveSyncInFlight||state.liveSyncDone)return;state.liveSyncInFlight=true;try{await _psrSyncLiveV24();state.liveSyncDone=(state.siteProjects||[]).length>0;if(state.analysisMetric!=='off')psrSetAnalysis(state.analysisMetric)}finally{state.liveSyncInFlight=false}};
map.on('load',()=>{state.liveSyncDone=true;$('#sync-pill').classList.add('ready');$('#sync-pill span').textContent='Snapshot + market cache ready';});


/* ===== PSR Institutional Valuation v31 ===== */
state.valuationSamples=[];state.valuationEvidence=new Map();state.valuationTab='selected';

function psrArrayOverlap(a,b){
  const A=new Set((Array.isArray(a)?a:[a]).filter(Boolean).map(norm)),B=(Array.isArray(b)?b:[b]).filter(Boolean).map(norm);
  return B.some(x=>A.has(x));
}
function psrDistanceKm(a,b){
  const A=coordsOf(a),B=coordsOf(b);if(!A||!B)return null;
  const R=6371,p1=A[1]*Math.PI/180,p2=B[1]*Math.PI/180,dp=(B[1]-A[1])*Math.PI/180,dl=(B[0]-A[0])*Math.PI/180;
  const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.sqrt(h));
}
function psrEvidenceReadiness(r){
  if(!r)return {score:0,checks:[]};let score=0,checks=[];
  const add=(label,ok,pts)=>{if(ok)score+=pts;checks.push({label,ok,pts})};
  const live=psrLiveProject(r),psf=psrPricePsfValue(r);
  add('Exact location',locationQuality(r)==='exact',15);
  add('Observed price',!!psrPriceValue(r),11);
  add('AED / sqft',!!psf,12);
  add('Developer',!!(r.developer||live.developer),6);
  add('Community',!!(r.area||live.area),7);
  add('Regulatory ID',!!(r.masterRera||r.verification?.dldReraNo||r.verification?.otherProjectId),10);
  add('Availability',availabilityClass(r)!=='unverified',6);
  add('Handover / lifecycle',!!(r.handover||live.handover||r.timeline),7);
  add('Property type',!!((r.propertyTypes||live.propertyTypes||[]).length),6);
  add('Bedrooms',!!((r.bedrooms||live.bedrooms||[]).length),5);
  add('Verification evidence',!!r.verification,8);
  add('Registry / source URL',!!(r.sourceUrl||r.verification?.sourceUrl||r.href),7);
  return {score:Math.min(100,score),checks};
}
function psrComparableCandidateScore(subject,c){
  if(!subject||!c||subject.id===c.id||c.kind!=='project')return null;
  if(norm(subject.emirate)!==norm(c.emirate))return null;
  let score=10,reasons=['same emirate'];
  const sa=norm(subject.area),ca=norm(c.area);if(sa&&ca&&(sa===ca||sa.includes(ca)||ca.includes(sa))){score+=28;reasons.push('same / matching community')}
  if(subject.developer&&c.developer&&norm(subject.developer)===norm(c.developer)){score+=12;reasons.push('same developer')}
  if(subject.timeline&&c.timeline&&subject.timeline===c.timeline){score+=7;reasons.push('same lifecycle')}
  if(psrArrayOverlap(subject.propertyTypes,c.propertyTypes)){score+=10;reasons.push('property type overlap')}
  if(psrArrayOverlap(subject.bedrooms,c.bedrooms)){score+=8;reasons.push('bedroom overlap')}
  const p1=psrPriceValue(subject),p2=psrPriceValue(c);if(p1&&p2){const ratio=Math.min(p1,p2)/Math.max(p1,p2);const pts=Math.round(ratio*13);score+=pts;if(ratio>.7)reasons.push('similar observed price')}
  const d=psrDistanceKm(subject,c);if(Number.isFinite(d)){if(d<=1){score+=12;reasons.push('within 1 km')}else if(d<=3){score+=9;reasons.push('within 3 km')}else if(d<=8){score+=5;reasons.push('within 8 km')}}
  if(locationQuality(c)==='exact'){score+=3;reasons.push('exact candidate location')}
  return {record:c,score:Math.min(100,score),reasons,distanceKm:d};
}
function psrTopComparableCandidates(subject){
  return (state.projects||[]).map(c=>psrComparableCandidateScore(subject,c)).filter(Boolean).sort((a,b)=>b.score-a.score).slice(0,5);
}
function psrBasisEstimate(evidence,bases){
  const rows=evidence?.estimates||[];const wanted=new Set(bases.map(norm));
  return rows.find(x=>wanted.has(norm(x.valuation_basis)))||null;
}
function psrEstimateText(e){
  if(!e)return {main:'Not yet estimated',sub:'Awaiting institutional evidence'};
  const cur=e.currency_code||'AED',fmt=n=>Number.isFinite(Number(n))?cur+' '+Math.round(Number(n)).toLocaleString():'—';
  const range=(e.low_estimate!=null&&e.high_estimate!=null)?fmt(e.low_estimate)+'–'+fmt(e.high_estimate):null;
  return {main:e.central_estimate!=null?fmt(e.central_estimate):(range||'—'),sub:range&&e.central_estimate!=null?range:(e.confidence_score!=null?'Confidence '+Math.round(e.confidence_score)+'/100':'Stored valuation evidence')};
}
function psrValuationOutputCard(label,e,fallback){
  const t=psrEstimateText(e);return '<div class="valuation-output"><span>'+esc(label)+'</span><b>'+esc(e?t.main:fallback.main)+'</b><small>'+esc(e?t.sub:fallback.sub)+'</small></div>';
}
function psrMethodRows(r,evidence){
  const comp=(evidence?.comparables||[]).length,exact=locationQuality(r)==='exact',psf=!!psrPricePsfValue(r),price=!!psrPriceValue(r);
  const rows=[
    ['Comparable sales',comp>=3?'ready':(price&&r.area?'partial':'pending'),comp>=3?comp+' stored evidence comps':'Needs verified closed transactions'],
    ['Hedonic AVM',psf&&r.area?'partial':'pending',psf?'Property-level price evidence present':'Needs richer characteristics + transaction training set'],
    ['Spatial residual',exact?'partial':'pending',exact?'Exact micro-location available':'Needs exact verified coordinate'],
    ['Repeat sales',(evidence?.history||[]).some(x=>/sale|transaction/i.test(x.field_key||''))?'partial':'pending','Requires same-asset historical sales'],
    ['Income / yield',r.marketRent||r.rent||r.yield?'partial':'pending','Requires verified market/contract rent and costs'],
    ['Cost / residual',/land|industrial|school|hospital/i.test((r.propertyTypes||[]).join(' '))?'partial':'pending','Used where asset type and evidence justify it'],
    ['Future catalyst',(state.initiatives||[]).length?'partial':'pending','Separate from current market value to avoid double counting']
  ];
  return rows.map(([n,s,d])=>'<div class="method-row"><span><b>'+esc(n)+'</b><small style="display:block;color:var(--psr-muted);margin-top:2px">'+esc(d)+'</small></span><span class="method-state '+s+'">'+(s==='ready'?'Ready':s==='partial'?'Partial':'Pending')+'</span></div>').join('');
}
async function psrLoadValuationEvidence(r){
  if(!r?.id)return null;if(state.valuationEvidence.has(r.id))return state.valuationEvidence.get(r.id);
  try{const j=await fetch('/map/api/valuation-evidence?entity_id='+encodeURIComponent(r.id)).then(x=>x.json());state.valuationEvidence.set(r.id,j);return j}catch{return {estimates:[],comparables:[],history:[]}}
}
function psrValuationFallback(label){
  const map={
    market:{main:'Not yet estimated',sub:'Requires closed-market evidence'},
    avm:{main:'Not yet estimated',sub:'AVM training evidence not yet complete'},
    investment:{main:'Not yet estimated',sub:'Requires investor assumptions + cash flows'},
    catalyst:{main:'Exposure only',sub:'Kept separate from current market value'},
    forecast:{main:'Not yet forecast',sub:'Historical + scenario evidence required'}
  };return map[label];
}
async function psrRenderValuationSelected(){
  const el=$('#valuation-selected');if(!el)return;const r=state.selected||state.selectedSpatial&&state.recordById.get(String(state.selectedSpatial.id));
  if(!r||r.kind!=='project'){el.innerHTML='<div class="valuation-empty">Select a project on the map to inspect valuation readiness, methods and comparable candidates.</div>';return}
  const evidence=await psrLoadValuationEvidence(r),ready=psrEvidenceReadiness(r),psf=psrPricePsfValue(r),price=psrPriceValue(r);
  const market=psrBasisEstimate(evidence,['market value','market_value','institutional market value']);
  const avm=psrBasisEstimate(evidence,['avm','avm estimate','hedonic avm']);
  const invest=psrBasisEstimate(evidence,['investment value','investment_value']);
  const catalyst=psrBasisEstimate(evidence,['future catalyst','catalyst']);
  const forecast=psrBasisEstimate(evidence,['forecast','scenario forecast']);
  const comps=psrTopComparableCandidates(r);
  el.innerHTML=
    '<div class="valuation-subject"><span class="kicker">SELECTED PROJECT</span><h3>'+esc(recordTitle(r))+'</h3><p>'+esc([r.developer,r.area,r.emirate].filter(Boolean).join(' · '))+'</p>'+
      '<div class="valuation-readiness"><div class="valuation-readiness-ring" style="--score:'+ready.score+'"><b>'+ready.score+'</b></div><div class="valuation-readiness-copy"><strong>Evidence readiness</strong><span>Not a valuation confidence score</span></div></div>'+
    '</div>'+
    '<div class="valuation-output-grid">'+
      psrValuationOutputCard('Institutional Market Value',market,psrValuationFallback('market'))+
      psrValuationOutputCard('AVM Estimate',avm,psrValuationFallback('avm'))+
      psrValuationOutputCard('Investment Value',invest,psrValuationFallback('investment'))+
      psrValuationOutputCard('Future Catalyst',catalyst,psrValuationFallback('catalyst'))+
      psrValuationOutputCard('Forecast',forecast,psrValuationFallback('forecast'))+
      '<div class="valuation-output"><span>Observed evidence</span><b>'+(price?esc(psrFmtAed(price)):'No observed price')+'</b><small>'+(psf?esc(psrFmtPsf(psf)):'AED/sqft not yet available')+'</small></div>'+
    '</div>'+
    '<div class="valuation-method-readiness"><h3>Method readiness</h3>'+psrMethodRows(r,evidence)+'</div>'+
    '<div class="valuation-comps"><h3>Project similarity candidates</h3>'+comps.map(x=>'<div class="comp-candidate"><div class="comp-head"><strong>'+esc(recordTitle(x.record))+'</strong><b>'+x.score+'%</b></div><div class="comp-reasons">'+esc(x.reasons.join(' · '))+(Number.isFinite(x.distanceKm)?' · '+x.distanceKm.toFixed(1)+' km':'')+'</div></div>').join('')+
      '<div class="comp-warning">These are similarity candidates from the current project catalogue, not closed-transaction valuation comparables. Verified transaction evidence must replace or validate them before a professional market-value estimate is produced.</div>'+
    '</div>';
}
async function psrLoadValuationSamples(){
  if(state.valuationSamples.length)return state.valuationSamples;
  try{const j=await fetch('/map/api/valuation-samples').then(r=>r.json());state.valuationSamples=j.samples||[];return state.valuationSamples}catch{return[]}
}
function psrRenderSampleDetail(s){
  const el=$('#valuation-sample-detail');if(!el||!s)return;const o=s.outputs||{},i=s.inputs||{},fmt=n=>Number.isFinite(Number(n))?'AED '+Math.round(Number(n)).toLocaleString():'—';
  el.innerHTML='<div class="sample-banner">ILLUSTRATIVE SAMPLE · NOT LIVE MARKET DATA</div><div class="valuation-subject"><span class="kicker">'+esc(s.asset_type)+' · '+esc(s.emirate)+'</span><h3>'+esc(s.label.replace(/^Sample · /,''))+'</h3><p>'+esc(s.scenario)+'</p></div>'+
    '<div class="valuation-output-grid">'+
      '<div class="valuation-output"><span>Market value range</span><b>'+fmt(o.market_value_low)+'–'+fmt(o.market_value_high)+'</b><small>Central '+fmt(o.market_value_central)+'</small></div>'+
      '<div class="valuation-output"><span>Market rent</span><b>'+(o.market_rent_annual?fmt(o.market_rent_annual)+'/yr':'Not modelled')+'</b><small>'+(o.gross_yield_pct?'Gross yield '+o.gross_yield_pct+'%':'Income evidence not applicable')+'</small></div>'+
      '<div class="valuation-output"><span>Confidence</span><b>'+esc(String(o.confidence??'—'))+'/100</b><small>Illustrative model agreement</small></div>'+
      '<div class="valuation-output"><span>Catalyst exposure</span><b>'+esc(String(o.catalyst_exposure??'—'))+'/100</b><small>'+esc(String(o.priced_in_pct??'—'))+'% illustrative priced-in</small></div>'+
      '<div class="valuation-output"><span>Risk-adjusted opportunity</span><b>'+esc(String(o.risk_adjusted_opportunity??'—'))+'/100</b><small>Illustrative scenario only</small></div>'+
      '<div class="valuation-output"><span>Methods</span><b>'+esc((s.methods||[]).slice(0,2).join(' + '))+'</b><small>'+esc((s.methods||[]).slice(2).join(' · '))+'</small></div>'+
    '</div><div class="sample-assumptions"><b>Sample assumptions:</b> '+esc(Object.entries(i).map(([k,v])=>k.replace(/_/g,' ')+' = '+v).join(' · '))+'</div>';
}
async function psrRenderValuationSamples(){
  const list=$('#valuation-sample-list');if(!list)return;const samples=await psrLoadValuationSamples();
  list.innerHTML=samples.map((s,i)=>'<button class="valuation-sample-chip '+(i===0?'active':'')+'" data-sample-id="'+esc(s.id)+'"><b>'+esc(s.label.replace(/^Sample · /,''))+'</b><span>'+esc(s.asset_type)+' · '+esc(s.emirate)+'</span></button>').join('');
  list.querySelectorAll('[data-sample-id]').forEach(b=>b.addEventListener('click',()=>{list.querySelectorAll('.valuation-sample-chip').forEach(x=>x.classList.remove('active'));b.classList.add('active');psrRenderSampleDetail(samples.find(x=>x.id===b.dataset.sampleId))}));
  if(samples[0])psrRenderSampleDetail(samples[0]);
}
function psrSetValuationTab(tab){
  state.valuationTab=tab;document.querySelectorAll('#valuation-tabs [data-valuation-tab]').forEach(b=>b.classList.toggle('active',b.dataset.valuationTab===tab));
  ['selected','samples','models'].forEach(x=>$('#valuation-'+x)?.classList.toggle('hidden',x!==tab));
  if(tab==='selected')psrRenderValuationSelected();if(tab==='samples')psrRenderValuationSamples();
}
function psrReadinessHeatGeo(){
  return fc((state.projects||[]).map(r=>{const c=coordsOf(r);if(!c)return null;return {type:'Feature',geometry:{type:'Point',coordinates:c},properties:{id:r.id,value:psrEvidenceReadiness(r).score/100}}}));
}
const _psrSetAnalysisV31=psrSetAnalysis;
psrSetAnalysis=function(metric){
  _psrSetAnalysisV31(metric);
  if(metric==='valuation-readiness'){map.getSource('psr-analysis-points')?.setData(psrReadinessHeatGeo());if(map.getLayer('psr-analysis-heat'))map.setLayoutProperty('psr-analysis-heat','visibility','visible');psrUpdateAnalysisLegend(metric)}
};
const _psrAnalysisLabelV31=psrAnalysisLabel;
psrAnalysisLabel=function(metric){return metric==='valuation-readiness'?'Valuation evidence readiness':_psrAnalysisLabelV31(metric)};

const _psrShowDetailV31=showDetail;
showDetail=function(r){_psrShowDetailV31(r);if(r?.kind==='project')psrRenderValuationSelected()};

map.on('load',()=>{
  document.querySelectorAll('#valuation-tabs [data-valuation-tab]').forEach(b=>b.addEventListener('click',()=>psrSetValuationTab(b.dataset.valuationTab)));
  document.querySelector('.rail-btn[data-panel="valuation"]')?.addEventListener('click',()=>psrRenderValuationSelected());
  psrRenderValuationSelected();
});


/* PSR valuation integration v32 */
if(!PSR_COMPARE_METRICS.some(x=>x[0]==='evidenceReadiness'))PSR_COMPARE_METRICS.push(['evidenceReadiness','Valuation evidence readiness']);

const _psrMetricValueV32=psrMetricValue;
psrMetricValue=function(r,key){
  if(key==='evidenceReadiness')return r?.kind==='project'?psrEvidenceReadiness(r).score+'/100':'—';
  return _psrMetricValueV32(r,key);
};

const _psrAIContextV32=psrAIContext;
psrAIContext=function(){
  const base=_psrAIContextV32(),r=state.selected;
  if(r?.kind==='project'){
    const ready=psrEvidenceReadiness(r),comps=psrTopComparableCandidates(r).slice(0,3);
    base.valuation={
      evidenceReadiness:ready.score,
      evidenceReadinessIsNotValuationConfidence:true,
      storedEvidence:state.valuationEvidence.get(r.id)||{estimates:[],comparables:[],history:[]},
      similarityCandidates:comps.map(x=>({name:recordTitle(x.record),score:x.score,reasons:x.reasons,distanceKm:Number.isFinite(x.distanceKm)?Number(x.distanceKm.toFixed(1)):null})),
      rules:{marketValueSeparateFromInvestmentValue:true,catalystSeparateFromCurrentMarketValue:true,samplesAreIllustrativeOnly:true}
    };
  }
  return base;
};

/* PSR persistent dock logic v33B */
state.panelScroll=state.panelScroll||{};
state.activePanel=state.activePanel||'timeline';
function psrVisibleWorkspace(){return [...document.querySelectorAll('.floating-panel')].find(p=>!p.classList.contains('hidden'))||null}
function psrDockGeometry(){const w=window.innerWidth,detailOpen=!$('#detail')?.classList.contains('hidden');if(w>=1180)return {left:468,right:detailOpen?420:24,top:86,bottom:52};if(w>=901)return {left:456,right:detailOpen?340:18,top:86,bottom:48};if(w>=641)return {left:Math.min(430,Math.max(330,w*.43)),right:12,top:78,bottom:46};return {left:0,right:0,top:0,bottom:0}}
function psrFitPadding(){const p=psrDockGeometry();return {left:p.left,right:p.right,top:p.top,bottom:p.bottom}}
function psrApplyDockPadding(animate=false){const p=psrDockGeometry();try{if(window.innerWidth<641){map.setPadding({top:0,right:0,bottom:0,left:0});return}if(animate)map.easeTo({padding:p,duration:220});else map.setPadding(p)}catch(e){console.warn('dock padding',e)}}
function psrSavePanelState(panel){if(!panel)return;state.panelScroll[panel.id]=panel.scrollTop;try{localStorage.setItem('psr-active-panel',panel.id.replace('-panel',''));localStorage.setItem('psr-panel-scroll',JSON.stringify(state.panelScroll))}catch{}}
function psrRestorePanelScroll(panel){if(!panel)return;const y=Number(state.panelScroll?.[panel.id]||0);requestAnimationFrame(()=>{panel.scrollTop=y})}
function psrInitializePersistentDock(){if(state.dockPersistentBound)return;state.dockPersistentBound=true;try{state.panelScroll=JSON.parse(localStorage.getItem('psr-panel-scroll')||'{}')||{}}catch{state.panelScroll={}}let saved='timeline';try{saved=localStorage.getItem('psr-active-panel')||'timeline'}catch{}if(!$('#'+saved+'-panel'))saved='timeline';$$('.rail-btn[data-panel]').forEach(btn=>{btn.addEventListener('click',()=>{const cur=psrVisibleWorkspace();if(cur)psrSavePanelState(cur)},{capture:true});btn.addEventListener('click',()=>setTimeout(()=>{state.activePanel=btn.dataset.panel;const p=$('#'+btn.dataset.panel+'-panel');psrRestorePanelScroll(p);try{localStorage.setItem('psr-active-panel',btn.dataset.panel)}catch{}psrApplyDockPadding(false)},0))});$$('.floating-panel').forEach(p=>p.addEventListener('scroll',()=>{state.panelScroll[p.id]=p.scrollTop},{passive:true}));if(saved!=='timeline')document.querySelector('.rail-btn[data-panel="'+saved+'"]')?.click();else psrRestorePanelScroll($('#timeline-panel'));window.addEventListener('resize',()=>{clearTimeout(window.__psrDockResize);window.__psrDockResize=setTimeout(()=>psrApplyDockPadding(false),100)},{passive:true});const detail=$('#detail');if(detail)new MutationObserver(()=>psrApplyDockPadding(false)).observe(detail,{attributes:true,attributeFilter:['class']});psrApplyDockPadding(false)}
map.on('load',()=>setTimeout(psrInitializePersistentDock,120));
/* PSR persistent dock race fix v33C */
state.dockInitialized=!!state.dockInitialized;state.dockUserInteracted=!!state.dockUserInteracted;
function psrActivateWorkspaceDirect(name){const target=$('#'+name+'-panel');if(!target)return false;$$('.floating-panel').forEach(p=>p.classList.toggle('hidden',p!==target));$$('.rail-btn[data-panel]').forEach(b=>b.classList.toggle('active',b.dataset.panel===name));state.activePanel=name;psrRestorePanelScroll(target);return true}
function psrEnsureWorkspaceVisible(){let current=psrVisibleWorkspace();if(current)return current;const name=state.activePanel&&$('#'+state.activePanel+'-panel')?state.activePanel:'timeline';psrActivateWorkspaceDirect(name);return $('#'+name+'-panel')}
function psrInitializeDockDeterministic(){if(state.dockInitialized){psrEnsureWorkspaceVisible();psrApplyDockPadding(false);return}try{state.panelScroll=JSON.parse(localStorage.getItem('psr-panel-scroll')||'{}')||state.panelScroll||{}}catch{}let saved='timeline';try{saved=localStorage.getItem('psr-active-panel')||'timeline'}catch{}if(!$('#'+saved+'-panel'))saved='timeline';if(!state.dockUserInteracted)psrActivateWorkspaceDirect(saved);else psrEnsureWorkspaceVisible();$$('.rail-btn[data-panel]').forEach(btn=>{if(btn.dataset.dockPersistentBound)return;btn.dataset.dockPersistentBound='1';btn.addEventListener('click',()=>{state.dockUserInteracted=true;const cur=psrVisibleWorkspace();if(cur)psrSavePanelState(cur);state.activePanel=btn.dataset.panel},{capture:true});btn.addEventListener('click',()=>setTimeout(()=>{psrEnsureWorkspaceVisible();psrRestorePanelScroll($('#'+btn.dataset.panel+'-panel'));try{localStorage.setItem('psr-active-panel',btn.dataset.panel)}catch{}psrApplyDockPadding(false)},0))});state.dockInitialized=true;psrEnsureWorkspaceVisible();psrApplyDockPadding(false)}
const _psrShowDetailDockV33C=showDetail;
showDetail=function(r){_psrShowDetailDockV33C(r);psrEnsureWorkspaceVisible();psrApplyDockPadding(false)};
setTimeout(psrInitializeDockDeterministic,220);
map.on('load',()=>setTimeout(psrInitializeDockDeterministic,40));
/* ===== PSR market intelligence v36 ===== */
state.analysisTab=state.analysisTab||'heat';state.marketCoverage=null;state.marketHistoryCache=new Map();state.marketForecastCache=new Map();state.communityMode=false;
function psrSlug(v){return norm(v).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function psrEmirateScopeKey(v){const n=norm(v);return n==='abu dhabi'?'abu-dhabi':n==='ras al khaimah'?'ras-al-khaimah':n==='umm al quwain'?'umm-al-quwain':psrSlug(v)}
async function psrLoadMarketCoverage(){if(state.marketCoverage)return state.marketCoverage;try{const j=await fetch('/map/api/market-coverage').then(r=>r.json());state.marketCoverage=j.coverage||[]}catch{state.marketCoverage=[]}return state.marketCoverage}
async function psrMarketScope(){const cov=await psrLoadMarketCoverage(),r=state.selected;let type='emirate',label='',key='';if(r?.kind==='community'){type='community';label=r.name||recordTitle(r);const exact=cov.find(x=>x.scope_type==='community'&&norm(x.scope_label)===norm(label));key=exact?.scope_key||(psrEmirateScopeKey(r.emirate)+':'+psrSlug(label))}else if(r?.kind==='project'){const c=psrCommunityForProject(r);if(c){type='community';label=c.name;const exact=cov.find(x=>x.scope_type==='community'&&norm(x.scope_label)===norm(label));key=exact?.scope_key||(psrEmirateScopeKey(c.emirate||r.emirate)+':'+psrSlug(label))}else{type='emirate';label=r.emirate||'Dubai';key=psrEmirateScopeKey(label)}}else if(state.selectedSpatial?.type==='emirate'){type='emirate';label=state.selectedSpatial.name;key=psrEmirateScopeKey(label)}else{const c=map.getCenter(),em=(state.projects||[]).reduce((best,p)=>{const pc=coordsOf(p);if(!pc)return best;const d=Math.hypot(pc[0]-c.lng,pc[1]-c.lat);return !best||d<best.d?{d,name:p.emirate}:best},null);label=em?.name||'Dubai';key=psrEmirateScopeKey(label)}const cover=cov.find(x=>x.scope_type===type&&x.scope_key===key)||null;return {type,key,label,coverage:cover}}
function psrMetricLabel(k){return ({transaction_value_aed:'Transaction value',transaction_count:'Transaction count',sales_value_aed:'Sales / trading value',sales_count:'Sales / trading count',offplan_sales_count:'Off-plan / initial sales',offplan_registration_count:'Off-plan registrations',offplan_share_sales_value_pct:'Off-plan share of sales value',community_sales_value_aed:'Community sales value',community_sales_count:'Community sales count'})[k]||k}
function psrFormatMarket(v,unit,currency){const n=Number(v);if(!Number.isFinite(n))return '—';if(currency==='AED'||unit==='AED'){if(n>=1e9)return 'AED '+(n/1e9).toFixed(n>=1e10?1:2)+'B';if(n>=1e6)return 'AED '+(n/1e6).toFixed(n>=1e8?0:1)+'M';return 'AED '+Math.round(n).toLocaleString()}if(unit==='pct')return n.toFixed(1)+'%';return Math.round(n).toLocaleString()}
function psrSparkSvg(rows){const vals=rows.map(r=>Number(r.value_numeric)).filter(Number.isFinite);if(!vals.length)return '';const lo=Math.min(...vals),hi=Math.max(...vals),span=hi-lo||1,w=300,h=108,p=8;const pts=rows.map((r,i)=>{const x=p+(w-2*p)*(rows.length===1?.5:i/(rows.length-1)),y=p+(h-2*p)*(1-(Number(r.value_numeric)-lo)/span);return {x,y,r}});return '<svg class="market-spark" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none"><line class="market-spark-grid" x1="8" y1="54" x2="292" y2="54"/><polyline class="market-spark-line" points="'+pts.map(p=>p.x+','+p.y).join(' ')+'"/>'+pts.map(p=>'<circle class="market-spark-dot" cx="'+p.x+'" cy="'+p.y+'" r="3"><title>'+esc(p.r.period_end+' · '+psrFormatMarket(p.r.value_numeric,p.r.unit,p.r.currency_code))+'</title></circle>').join('')+'</svg>'}
async function psrRenderMarketHistory(){const box=$('#market-history-chart'),src=$('#market-history-source'),scope=await psrMarketScope(),metric=$('#market-history-metric')?.value||'transaction_value_aed';if(!box)return;$('#market-scope-label').textContent=scope.label;$('#forecast-scope-label').textContent=scope.label;$('#market-coverage-label').textContent=scope.coverage?scope.coverage.observation_count+' observations · '+scope.coverage.metric_count+' metrics · '+scope.coverage.first_period.slice(0,4)+'–'+scope.coverage.last_period.slice(0,4):'No stored official history for this exact scope yet.';const ck=scope.type+'|'+scope.key+'|'+metric;let j=state.marketHistoryCache.get(ck);if(!j){box.innerHTML='<div class="market-empty">Loading source-stamped history…</div>';try{j=await fetch('/map/api/market-series?scope_type='+encodeURIComponent(scope.type)+'&scope_key='+encodeURIComponent(scope.key)+'&metric='+encodeURIComponent(metric)).then(r=>r.json())}catch{j={observations:[]}}state.marketHistoryCache.set(ck,j)}const rows=j.observations||[];if(!rows.length){box.innerHTML='<div class="market-empty">No verified '+esc(psrMetricLabel(metric).toLowerCase())+' history is stored for '+esc(scope.label)+' yet.</div>';if(src)src.textContent='The map will not substitute asking-price or neighbouring-area data for missing closed-market history.';return}const last=rows[rows.length-1],first=rows[0];box.innerHTML='<div class="market-history-head"><strong>'+esc(psrMetricLabel(metric))+'</strong><b>'+esc(psrFormatMarket(last.value_numeric,last.unit,last.currency_code))+'</b></div>'+psrSparkSvg(rows)+'<div class="market-axis"><span>'+esc(first.period_start.slice(0,7))+'</span><span>'+esc(last.period_end.slice(0,7))+'</span></div>';const sources=[...new Map(rows.map(r=>[r.source_id,r])).values()];if(src)src.innerHTML=sources.map(r=>'<div>'+esc(r.publisher)+' · '+esc(r.source_label)+' · '+esc(r.methodology||'official observation')+'</div>').join('')}
function psrHandoverYear(r){const s=String(r.handover||psrLiveProject(r).handover||'');const m=s.match(/20(2[0-9]|3[0-5])/);return m?Number(m[0]):null}
function psrScopeProjects(scope){const ps=state.projects||[];if(scope.type==='emirate')return ps.filter(r=>psrEmirateScopeKey(r.emirate)===scope.key);const selected=state.selected;if(selected?.kind==='community')return ps.filter(r=>{const c=psrCommunityForProject(r);return c&&norm(c.name)===norm(selected.name)});if(selected?.kind==='project'){const c0=psrCommunityForProject(selected);return c0?ps.filter(r=>{const c=psrCommunityForProject(r);return c&&norm(c.name)===norm(c0.name)}):ps.filter(r=>psrEmirateScopeKey(r.emirate)===psrEmirateScopeKey(selected.emirate))}return ps}
function psrRenderPipeline(scope){const el=$('#pipeline-forecast');if(!el)return;const ps=psrScopeProjects(scope),years={};for(const r of ps){const y=psrHandoverYear(r);if(y&&y>=2026&&y<=2032)years[y]=(years[y]||0)+1}const keys=Object.keys(years).map(Number).sort((a,b)=>a-b);if(!keys.length){el.innerHTML='<h3>Project pipeline</h3><div class="market-empty" style="min-height:70px">No dated future handovers in the current catalogue for this scope.</div>';return}const max=Math.max(...keys.map(y=>years[y]));el.innerHTML='<h3>Current catalogue handover pipeline</h3><div class="pipeline-bars">'+keys.map(y=>'<div class="pipeline-bar"><b>'+years[y]+'</b><i style="height:'+Math.max(4,70*years[y]/max)+'px"></i><span>'+y+'</span></div>').join('')+'</div><div class="market-source-note">Pipeline is project-count based, not a unit-supply forecast unless unit counts are verified.</div>'}
async function psrRenderMarketForecast(){const el=$('#market-forecast-card'),scope=await psrMarketScope(),metric=$('#market-history-metric')?.value||'transaction_value_aed',h=Number($('#forecast-horizon')?.value||12);if(!el)return;$('#forecast-scope-label').textContent=scope.label;psrRenderPipeline(scope);const ck=scope.type+'|'+scope.key+'|'+metric+'|'+h;let j=state.marketForecastCache.get(ck);if(!j){el.innerHTML='<div class="market-empty">Computing evidence-based trend…</div>';try{j=await fetch('/map/api/market-forecast?scope_type='+encodeURIComponent(scope.type)+'&scope_key='+encodeURIComponent(scope.key)+'&metric='+encodeURIComponent(metric)+'&horizon='+h).then(r=>r.json())}catch{j={forecast:null}}state.marketForecastCache.set(ck,j)}const f=j.forecast;if(!f){el.innerHTML='<div class="market-empty">Not enough comparable historical observations for a nominal forecast. The future project pipeline is still shown below.</div>';return}el.innerHTML='<div class="market-history-head"><strong>'+esc(psrMetricLabel(metric))+' · '+h+'M</strong><b>'+esc(psrFormatMarket(f.central,j.unit,j.currencyCode))+'</b></div><div class="forecast-range"><div><span>Low</span><b>'+esc(psrFormatMarket(f.low,j.unit,j.currencyCode))+'</b></div><div><span>Base</span><b>'+esc(psrFormatMarket(f.central,j.unit,j.currencyCode))+'</b></div><div><span>High</span><b>'+esc(psrFormatMarket(f.high,j.unit,j.currencyCode))+'</b></div></div><div class="forecast-meta">Confidence '+Math.round(f.confidence)+'/100 · '+f.inputCount+' stored observations · R² '+Number(f.r2).toFixed(2)+'<br>'+esc(f.methodology)+'</div>'}
function psrSetAnalysisTab(tab){state.analysisTab=tab;$$('#analysis-tabs [data-analysis-tab]').forEach(b=>b.classList.toggle('active',b.dataset.analysisTab===tab));['heat','history','forecast'].forEach(x=>$('#analysis-'+x+'-view')?.classList.toggle('hidden',x!==tab));if(tab==='history')psrRenderMarketHistoryFast();if(tab==='forecast')psrRenderMarketForecastFast()}
function psrCommunityStats(r){const ps=(state.projects||[]).filter(p=>{const c=psrCommunityForProject(p);return c&&norm(c.name)===norm(r.name)}),off=ps.filter(p=>p.timeline==='future'||/off.?plan|under construction|launch/i.test([p.masterStatus,p.status,p.statusLabel].filter(Boolean).join(' '))).length,ready=ps.filter(p=>p.timeline==='past'||/ready|complete/i.test([p.masterStatus,p.status,p.statusLabel].filter(Boolean).join(' '))).length,on=ps.filter(p=>availabilityClass(p)==='on-sale').length,sold=ps.filter(p=>availabilityClass(p)==='sold-out').length,psf=ps.map(psrPricePsfValue).filter(Number.isFinite).sort((a,b)=>a-b),median=psf.length?psf[Math.floor(psf.length/2)]:null;return {projects:ps.length,offplan:off,ready,onSale:on,soldOut:sold,askPsfMedian:median}}
function psrSetCommunityLabelMode(r){const selected=r?.kind==='community'?r:null;state.communityMode=!!selected;document.body.classList.toggle('community-mode',!!selected);if(map.getLayer('community-labels'))map.setLayoutProperty('community-labels','visibility',selected?'none':'visible');if(map.getLayer('psr-official-district-label'))map.setLayoutProperty('psr-official-district-label','visibility',selected?'none':'visible');if(map.getLayer('psr-community-polygon-labels'))map.setLayoutProperty('psr-community-polygon-labels','visibility',selected?'none':'visible');if(map.getLayer('psr-community-selected-label')){map.setFilter('psr-community-selected-label',['==',['get','psrId'],selected?.id||'__none__']);map.setLayoutProperty('psr-community-selected-label','visibility',selected?'visible':'none')}}
const _psrAddSourcesV36=addSourcesAndLayers;
addSourcesAndLayers=function(){_psrAddSourcesV36();if(!map.getLayer('psr-community-selected-label'))map.addLayer({id:'psr-community-selected-label',type:'symbol',source:'psr-dubai-community-polygons',layout:{visibility:'none','text-field':['coalesce',['get','psrName'],['get','name']],'text-size':['interpolate',['linear'],['zoom'],8,12,14,18],'text-font':['Open Sans Semibold'],'text-max-width':16,'text-optional':false},paint:{'text-color':'#171b1e','text-halo-color':'rgba(255,255,255,.96)','text-halo-width':2}})};
const _psrShowDetailV36=showDetail;
showDetail=function(r){_psrShowDetailV36(r);psrSetCommunityLabelMode(r);if(r?.kind==='community'){const s=psrCommunityStats(r),body=$('#detail-body .detail-content');if(body&&!body.querySelector('.community-intel')){const el=document.createElement('div');el.className='detail-section community-intel';el.innerHTML='<h3>Community view</h3><div class="community-intel-grid"><div><span>Projects</span><b>'+s.projects+'</b></div><div><span>Off-plan / future</span><b>'+s.offplan+'</b></div><div><span>Ready / completed</span><b>'+s.ready+'</b></div><div><span>On sale</span><b>'+s.onSale+'</b></div><div><span>Sold out</span><b>'+s.soldOut+'</b></div><div><span>Median project ask</span><b>'+(s.askPsfMedian?psrFmtPsf(s.askPsfMedian):'—')+'</b></div></div><p style="margin-top:8px">Gold is this selected community boundary only. Market history and forecasts follow this community in Analyze.</p>';body.appendChild(el)}if(state.analysisTab!=='heat'){psrRenderMarketHistory();psrRenderMarketForecast()}}};
const _psrSetSelectedPointV36=psrSetSelectedPoint;
psrSetSelectedPoint=function(r){_psrSetSelectedPointV36(r);if(!r||r.kind!=='community')psrSetCommunityLabelMode(null)};
const _psrAnalysisLabelV36=psrAnalysisLabel;
psrAnalysisLabel=function(metric){return metric==='price-psf'?'Project ask AED / sqft':_psrAnalysisLabelV36(metric)};
map.on('load',()=>{setTimeout(()=>{$$('#analysis-tabs [data-analysis-tab]').forEach(b=>b.addEventListener('click',()=>psrSetAnalysisTab(b.dataset.analysisTab)));$('#market-history-metric')?.addEventListener('change',()=>{if(state.analysisTab==='history')psrRenderMarketHistoryFast();if(state.analysisTab==='forecast')psrRenderMarketForecastFast()});$('#forecast-horizon')?.addEventListener('change',()=>psrRenderMarketForecastFast());document.querySelector('.rail-btn[data-panel="analyze"]')?.addEventListener('click',()=>{if(state.analysisTab==='history')psrRenderMarketHistory();if(state.analysisTab==='forecast')psrRenderMarketForecast()})},250)});
/* ===== PSR snapshot-first v37 ===== */
state.liveSyncDone=true;state.liveSyncInFlight=false;
psrContinueLiveProjectBatches=async function(){return {skipped:true,reason:'snapshot-first market architecture'}};
syncLiveCatalogue=async function(){state.liveSyncDone=true;state.liveSyncInFlight=false;const pill=$('#sync-pill');if(pill){pill.classList.add('ready');const s=pill.querySelector('span');if(s)s.textContent='Snapshot + market cache ready'}return {projects:state.siteProjects||[],total:(state.siteProjects||[]).length,skipped:true}};
map.on('load',()=>setTimeout(()=>{const pill=$('#sync-pill');if(pill){pill.classList.add('ready');const s=pill.querySelector('span');if(s)s.textContent='Snapshot + market cache ready'}},300));
/* ===== PSR fast market renderer v38 ===== */
function psrMarketScopeFast(){const r=state.selected;let type='emirate',label='',key='';if(r?.kind==='community'){type='community';label=r.name||recordTitle(r);key=psrEmirateScopeKey(r.emirate)+':'+psrSlug(label)}else if(r?.kind==='project'){const c=psrCommunityForProject(r);if(c){type='community';label=c.name;key=psrEmirateScopeKey(c.emirate||r.emirate)+':'+psrSlug(label)}else{label=r.emirate||'Dubai';key=psrEmirateScopeKey(label)}}else if(state.selectedSpatial?.type==='emirate'){label=state.selectedSpatial.name;key=psrEmirateScopeKey(label)}else{const ctr=map.getCenter(),em=(state.projects||[]).reduce((best,p)=>{const pc=coordsOf(p);if(!pc)return best;const d=Math.hypot(pc[0]-ctr.lng,pc[1]-ctr.lat);return !best||d<best.d?{d,name:p.emirate}:best},null);label=em?.name||'Dubai';key=psrEmirateScopeKey(label)}return {type,key,label}}
function psrCoverageForScope(scope,cov){return (cov||[]).find(x=>x.scope_type===scope.type&&(x.scope_key===scope.key||norm(x.scope_label)===norm(scope.label)))||null}
async function psrFetchSeriesFast(scope,metric,cov){let key=scope.key,cover=psrCoverageForScope(scope,cov);if(cover)key=cover.scope_key;const url='/map/api/market-series?scope_type='+encodeURIComponent(scope.type)+'&scope_key='+encodeURIComponent(key)+'&metric='+encodeURIComponent(metric);let j=await fetch(url).then(r=>r.json()).catch(()=>({observations:[]}));if(!(j.observations||[]).length&&scope.type==='community'&&cover&&cover.scope_key!==scope.key){j=await fetch('/map/api/market-series?scope_type=community&scope_key='+encodeURIComponent(cover.scope_key)+'&metric='+encodeURIComponent(metric)).then(r=>r.json()).catch(()=>({observations:[]}))}return {j,cover,key:cover?.scope_key||key}}
psrRenderMarketHistory=async function(){const box=$('#market-history-chart'),src=$('#market-history-source'),scope=psrMarketScopeFast(),metric=$('#market-history-metric')?.value||'transaction_value_aed';if(!box)return;$('#market-scope-label').textContent=scope.label;$('#forecast-scope-label').textContent=scope.label;box.innerHTML='<div class="market-empty">Loading source-stamped history…</div>';const covPromise=psrLoadMarketCoverage().catch(()=>[]);const cov=await covPromise,cover=psrCoverageForScope(scope,cov);$('#market-coverage-label').textContent=cover?cover.observation_count+' observations · '+cover.metric_count+' metrics · '+cover.first_period.slice(0,4)+'–'+cover.last_period.slice(0,4):'No stored official history for this exact scope yet.';const res=await psrFetchSeriesFast(scope,metric,cov),rows=res.j.observations||[];if(!rows.length){box.innerHTML='<div class="market-empty">No verified '+esc(psrMetricLabel(metric).toLowerCase())+' history is stored for '+esc(scope.label)+' yet.</div>';if(src)src.textContent='The map will not substitute asking-price or neighbouring-area data for missing closed-market history.';return}const last=rows[rows.length-1],first=rows[0];box.innerHTML='<div class="market-history-head"><strong>'+esc(psrMetricLabel(metric))+'</strong><b>'+esc(psrFormatMarket(last.value_numeric,last.unit,last.currency_code))+'</b></div>'+psrSparkSvg(rows)+'<div class="market-axis"><span>'+esc(first.period_start.slice(0,7))+'</span><span>'+esc(last.period_end.slice(0,7))+'</span></div>';const sources=[...new Map(rows.map(r=>[r.source_id,r])).values()];if(src)src.innerHTML=sources.map(r=>'<div>'+esc(r.publisher)+' · '+esc(r.source_label)+' · '+esc(r.methodology||'official observation')+'</div>').join('')}
psrRenderMarketForecast=async function(){const el=$('#market-forecast-card'),scope=psrMarketScopeFast(),metric=$('#market-history-metric')?.value||'transaction_value_aed',h=Number($('#forecast-horizon')?.value||12);if(!el)return;$('#forecast-scope-label').textContent=scope.label;psrRenderPipeline(scope);el.innerHTML='<div class="market-empty">Computing evidence-based trend…</div>';const cov=await psrLoadMarketCoverage().catch(()=>[]),cover=psrCoverageForScope(scope,cov),key=cover?.scope_key||scope.key;let j=await fetch('/map/api/market-forecast?scope_type='+encodeURIComponent(scope.type)+'&scope_key='+encodeURIComponent(key)+'&metric='+encodeURIComponent(metric)+'&horizon='+h).then(r=>r.json()).catch(()=>({forecast:null}));const f=j.forecast;if(!f){el.innerHTML='<div class="market-empty">Not enough comparable historical observations for a nominal forecast. The future project pipeline is still shown below.</div>';return}el.innerHTML='<div class="market-history-head"><strong>'+esc(psrMetricLabel(metric))+' · '+h+'M</strong><b>'+esc(psrFormatMarket(f.central,j.unit,j.currencyCode))+'</b></div><div class="forecast-range"><div><span>Low</span><b>'+esc(psrFormatMarket(f.low,j.unit,j.currencyCode))+'</b></div><div><span>Base</span><b>'+esc(psrFormatMarket(f.central,j.unit,j.currencyCode))+'</b></div><div><span>High</span><b>'+esc(psrFormatMarket(f.high,j.unit,j.currencyCode))+'</b></div></div><div class="forecast-meta">Confidence '+Math.round(f.confidence)+'/100 · '+f.inputCount+' stored observations · R² '+Number(f.r2).toFixed(2)+'<br>'+esc(f.methodology)+'</div>'}
/* PSR renderer binding fix v39 */
const psrRenderMarketHistoryFast=psrRenderMarketHistory;
const psrRenderMarketForecastFast=psrRenderMarketForecast;
/* ===== PSR direct analysis tab controller v40 ===== */
function psrDirectAnalysisTab(tab){state.analysisTab=tab;$$('#analysis-tabs [data-analysis-tab]').forEach(x=>x.classList.toggle('active',x.dataset.analysisTab===tab));['heat','history','forecast'].forEach(x=>$('#analysis-'+x+'-view')?.classList.toggle('hidden',x!==tab));if(tab==='history')psrRenderMarketHistoryFast();else if(tab==='forecast')psrRenderMarketForecastFast()}
function psrBindDirectAnalysisTabs(){const root=$('#analysis-tabs');if(!root||root.dataset.directBound)return;root.dataset.directBound='1';root.addEventListener('click',e=>{const b=e.target.closest('[data-analysis-tab]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();psrDirectAnalysisTab(b.dataset.analysisTab)},true);const metric=$('#market-history-metric');if(metric&&!metric.dataset.directBound){metric.dataset.directBound='1';metric.addEventListener('change',e=>{e.stopImmediatePropagation();if(state.analysisTab==='history')psrRenderMarketHistoryFast();else if(state.analysisTab==='forecast')psrRenderMarketForecastFast()},true)}const horizon=$('#forecast-horizon');if(horizon&&!horizon.dataset.directBound){horizon.dataset.directBound='1';horizon.addEventListener('change',e=>{e.stopImmediatePropagation();psrRenderMarketForecastFast()},true)}}
setTimeout(psrBindDirectAnalysisTabs,180);
map.on('load',()=>setTimeout(psrBindDirectAnalysisTabs,60));
/* ===== PSR community interaction rebuild v42 ===== */
state.selectedCommunityBoundaryId=null;
function psrBoundaryName(f){const p=f?.properties||{};return p.psrName||p.name||p.area_name_en||p.key||'Community'}
function psrPrepareCommunityBoundaryData(data){const seen=new Set();for(let i=0;i<(data?.features||[]).length;i++){const f=data.features[i],p=f.properties||(f.properties={}),name=psrBoundaryName(f),match=p.psrId?state.recordById.get(String(p.psrId)):psrMatchCommunityByName(name);if(match){p.psrId=match.id;p.psrName=match.name;p.projectCount=match.indexedProjects||0}const canon=p.psrName||name,key=psrSlug(canon)||('boundary-'+i);p.psrBoundaryId=p.psrId||('dubai-boundary:'+key+':'+i);p.psrBoundaryName=canon;const nk=norm(canon);p.psrDisplayLabel=seen.has(nk)?'':canon;seen.add(nk);p.psrMatched=p.psrId?1:0}return data}
function psrCommunityBeforeLayer(){for(const id of ['project-footprint-extrusions','project-hit','project-points','project-clusters','initiative-points'])if(map.getLayer(id))return id;return undefined}
function psrEnsureCommunityLayers(){if(!map||!map.getStyle?.())return false;const data=state.spatial?.dubaiPolygonData;if(data)psrPrepareCommunityBoundaryData(data);if(!map.getSource('psr-dubai-community-polygons')){map.addSource('psr-dubai-community-polygons',{type:'geojson',data:data||fc([])});state.communitySourceHydrated=!!data}else if(data&&!state.communitySourceHydrated){map.getSource('psr-dubai-community-polygons').setData(data);state.communitySourceHydrated=true}const before=psrCommunityBeforeLayer();const add=(def)=>{if(!map.getLayer(def.id))map.addLayer(def,before)};add({id:'psr-community-base',type:'fill',source:'psr-dubai-community-polygons',paint:{'fill-color':'#788489','fill-opacity':['case',['==',['get','psrMatched'],1],.045,.024]}});add({id:'psr-community-line',type:'line',source:'psr-dubai-community-polygons',paint:{'line-color':'rgba(57,67,72,.48)','line-width':['interpolate',['linear'],['zoom'],7.5,.7,10,1.15,13,1.75,16,2.2],'line-opacity':['interpolate',['linear'],['zoom'],7.5,.55,12,.78,16,.9]}});add({id:'psr-community-click',type:'fill',source:'psr-dubai-community-polygons',paint:{'fill-color':'#000000','fill-opacity':.001}});add({id:'psr-community-hover',type:'fill',source:'psr-dubai-community-polygons',filter:['==',['get','psrBoundaryId'],'__none__'],paint:{'fill-color':'#52656d','fill-opacity':.09}});add({id:'psr-community-selection-fill',type:'fill',source:'psr-dubai-community-polygons',filter:['==',['get','psrBoundaryId'],'__none__'],paint:{'fill-color':PSR_GOLD,'fill-opacity':.09}});add({id:'psr-community-selection-outline',type:'line',source:'psr-dubai-community-polygons',filter:['==',['get','psrBoundaryId'],'__none__'],paint:{'line-color':PSR_GOLD,'line-width':['interpolate',['linear'],['zoom'],7.5,2.2,11,3.2,15,4.2],'line-opacity':1}});add({id:'psr-community-polygon-labels',type:'symbol',source:'psr-dubai-community-polygons',minzoom:8.7,layout:{'text-field':['get','psrDisplayLabel'],'text-size':['interpolate',['linear'],['zoom'],8.7,9,12,11,15,12.5],'text-max-width':12,'text-optional':true,'text-allow-overlap':false},paint:{'text-color':'#525d62','text-halo-color':'rgba(255,255,255,.95)','text-halo-width':1.4}});add({id:'psr-community-selection-label',type:'symbol',source:'psr-dubai-community-polygons',filter:['==',['get','psrBoundaryId'],'__none__'],layout:{'text-field':['get','psrBoundaryName'],'text-size':['interpolate',['linear'],['zoom'],8,12,12,15,16,18],'text-max-width':16,'text-optional':false,'text-allow-overlap':false},paint:{'text-color':'#171b1e','text-halo-color':'rgba(255,255,255,.98)','text-halo-width':2.2}});if(map.getLayer('community-labels'))map.setLayoutProperty('community-labels','visibility','none');if(map.getLayer('community-points')){map.setPaintProperty('community-points','circle-opacity',0);map.setPaintProperty('community-points','circle-stroke-opacity',0)}if(!state.communityLayerEventsBound){state.communityLayerEventsBound=true;map.on('mousemove','psr-community-click',e=>{const f=e.features?.[0],id=f?.properties?.psrBoundaryId;if(!id)return;map.setFilter('psr-community-hover',['==',['get','psrBoundaryId'],id]);map.getCanvas().style.cursor='pointer'});map.on('mouseleave','psr-community-click',()=>{map.setFilter('psr-community-hover',['==',['get','psrBoundaryId'],'__none__']);map.getCanvas().style.cursor=''});map.on('click','psr-community-click',e=>{const block=['project-footprint-extrusions','project-hit','project-points','project-clusters','initiative-hit','initiative-points'].filter(id=>map.getLayer(id));if(block.length&&map.queryRenderedFeatures(e.point,{layers:block}).length)return;const f=e.features?.[0];if(f)psrSelectCommunityFeature(f)})}return true}
function psrProjectsForBoundary(name,matched){const nk=norm(name);return (state.projects||[]).filter(p=>{if(matched){const c=psrCommunityForProject(p);if(c&&norm(c.name)===norm(matched.name))return true}const a=norm(p.area||'');return a&&nk&&a===nk})}
function psrCommunityStatsV42(name,matched){const ps=psrProjectsForBoundary(name,matched),off=ps.filter(p=>p.timeline==='future'||/off.?plan|under construction|launch/i.test([p.masterStatus,p.status,p.statusLabel].filter(Boolean).join(' '))).length,ready=ps.filter(p=>p.timeline==='past'||/ready|complete|completed/i.test([p.masterStatus,p.status,p.statusLabel].filter(Boolean).join(' '))).length,on=ps.filter(p=>availabilityClass(p)==='on-sale').length,sold=ps.filter(p=>availabilityClass(p)==='sold-out').length,vals=ps.map(psrPricePsfValue).filter(Number.isFinite).sort((a,b)=>a-b),median=vals.length?vals[Math.floor(vals.length/2)]:null;return {projects:ps.length,offplan:off,ready,onSale:on,soldOut:sold,askPsfMedian:median}}
function psrShowCommunityBoundaryDetail(f,record){const name=psrBoundaryName(f),stats=psrCommunityStatsV42(name,record),p=f.properties||{},detail=$('#detail-body');state.selected=record||{id:p.psrBoundaryId,kind:'community',name,emirate:'Dubai',boundaryOnly:true};state.selectedSpatial={type:'community',id:p.psrBoundaryId,name};detail.innerHTML='<div class="detail-content"><span class="detail-badge">COMMUNITY</span><h2>'+esc(name)+'</h2><div class="detail-sub">Dubai · '+(record?'Catalogue community + mapped boundary':'Mapped boundary · catalogue match pending')+'</div><div class="detail-facts">'+detailFact('Projects',stats.projects)+detailFact('Off-plan / future',stats.offplan)+detailFact('Ready / completed',stats.ready)+detailFact('On sale',stats.onSale)+detailFact('Sold out',stats.soldOut)+detailFact('Median project ask AED / sqft',stats.askPsfMedian?psrFmtPsf(stats.askPsfMedian):'—')+'</div><div class="detail-section"><h3>Boundary</h3><p>'+esc(p.geometrySource||'DLD-area / OpenStreetMap curated polygon')+'. Gold is reserved for this selected community only.</p></div><div class="detail-section"><h3>Data integrity</h3><p>Project asking values and closed-market transaction values remain separate. Unknown figures stay blank rather than inferred.</p></div></div>';$('#detail').classList.remove('hidden');psrApplyDockPadding(false)}
function psrSelectCommunityFeature(f){const p=f.properties||{},id=p.psrBoundaryId||p.psrId||('dubai-boundary:'+psrSlug(psrBoundaryName(f)));state.selectedCommunityBoundaryId=id;const record=p.psrId?state.recordById.get(String(p.psrId)):psrMatchCommunityByName(psrBoundaryName(f));for(const lid of ['psr-community-selection-fill','psr-community-selection-outline','psr-community-selection-label'])if(map.getLayer(lid))map.setFilter(lid,['==',['get','psrBoundaryId'],id]);if(map.getLayer('psr-community-polygon-labels'))map.setLayoutProperty('psr-community-polygon-labels','visibility','none');if(map.getLayer('psr-official-district-label'))map.setLayoutProperty('psr-official-district-label','visibility','none');map.setFilter('psr-community-hover',['==',['get','psrBoundaryId'],'__none__']);psrShowCommunityBoundaryDetail(f,record||null);if(state.analysisTab==='history')psrRenderMarketHistoryFast();if(state.analysisTab==='forecast')psrRenderMarketForecastFast()}
function psrClearCommunitySelection(){state.selectedCommunityBoundaryId=null;for(const lid of ['psr-community-selection-fill','psr-community-selection-outline','psr-community-selection-label'])if(map.getLayer(lid))map.setFilter(lid,['==',['get','psrBoundaryId'],'__none__']);if(map.getLayer('psr-community-polygon-labels'))map.setLayoutProperty('psr-community-polygon-labels','visibility','visible');if(map.getLayer('psr-official-district-label'))map.setLayoutProperty('psr-official-district-label','visibility','visible')}
function psrSelectCommunityRecordV42(r){if(!r||r.kind!=='community'||!state.spatial?.dubaiPolygonData)return false;const f=(state.spatial.dubaiPolygonData.features||[]).find(x=>String(x.properties?.psrId||'')===String(r.id)||norm(psrBoundaryName(x))===norm(r.name));if(!f)return false;psrSelectCommunityFeature(f);return true}
const _psrLoadDubaiPolygonsV42=psrLoadDubaiPolygons;psrLoadDubaiPolygons=async function(){await _psrLoadDubaiPolygonsV42();if(state.spatial?.dubaiPolygonData){psrPrepareCommunityBoundaryData(state.spatial.dubaiPolygonData);psrEnsureCommunityLayers()}};
const _psrShowDetailV42=showDetail;showDetail=function(r){if(r?.kind==='community'&&psrSelectCommunityRecordV42(r))return;_psrShowDetailV42(r)};
/* seamless-v12: community polygon layers hydrate on load or selection, not every styledata event */
map.on('load',()=>setTimeout(()=>{if(state.spatial?.dubaiPolygonData)psrEnsureCommunityLayers();else if(psrShouldLoadDubai())psrLoadDubaiPolygons()},350));
$('#detail-close')?.addEventListener('click',()=>psrClearCommunitySelection());
/* PSR style validity v45 */
map.on('load',()=>setTimeout(()=>{try{if(map.getLayer('project-footprint-extrusions'))map.setPaintProperty('project-footprint-extrusions','fill-extrusion-opacity',.68);if(map.getLayer('psr-3d-buildings'))map.setPaintProperty('psr-3d-buildings','fill-extrusion-height',['interpolate',['linear'],['zoom'],9.7,0,10.45,['case',['any',['==',['get','name'],'Burj Khalifa'],['==',['get','name:en'],'Burj Khalifa'],['==',['get','name_en'],'Burj Khalifa']],347.76,['*',['coalesce',['get','render_height'],10],.42]],11.4,['case',['any',['==',['get','name'],'Burj Khalifa'],['==',['get','name:en'],'Burj Khalifa'],['==',['get','name_en'],'Burj Khalifa']],828,['coalesce',['get','render_height'],10]]]);}catch(e){console.warn('style validity patch',e)}},120));
/* PSR community source hydration v46 */
state.communitySourceHydrated=!!state.communitySourceHydrated;
map.on('sourcedata',e=>{if(e.sourceId==='psr-dubai-community-polygons'&&e.isSourceLoaded)state.communitySourceHydrated=true});
/* ===== PSR universal spatial selection v49 ===== */
state.masterTerritoryData=state.masterTerritoryData||fc([]);state.masterTerritoriesLoaded=!!state.masterTerritoriesLoaded;state.masterTerritorySourceHydrated=!!state.masterTerritorySourceHydrated;state.universalSelection=null;state.universalHover=null;
function psrGeoFeature(geometry,props={}){return {type:'Feature',geometry,properties:props}}
function psrFeatureLabel(f,layerId=''){const p=f?.properties||{};if(layerId==='psr-master-territory-hit')return p.name||p.canonicalName||'Master development';if(layerId==='psr-community-click'||layerId==='psr-universal-community-hit')return p.psrBoundaryName||p.psrName||p.name||'Community';if(layerId==='psr-official-district-fill')return p.psrLabel||p.NameEnglish||p.DistrictName||p.name||'District';if(layerId==='psr-emirate-fill'||layerId==='psr-universal-emirate-hit')return p.psrName||p.name||'Emirate';return p.name||p.psrName||p.NameEnglish||p.name_en||p.ref||'Selection'}
function psrSelectionKind(layerId,f){if(layerId==='project-footprint-extrusions'||layerId==='project-footprint-outline')return 'project';if(layerId==='psr-official-building-hit'||layerId==='psr-official-building-line')return 'building';if(layerId==='psr-master-territory-hit')return f?.properties?.kind||'master-development';if(layerId==='psr-community-click'||layerId==='psr-universal-community-hit')return 'community';if(layerId==='psr-official-district-fill')return 'district';if(layerId==='psr-emirate-fill'||layerId==='psr-universal-emirate-hit')return 'emirate';if(layerId==='project-points'||layerId==='project-fallback-points')return 'project-locator';return 'geometry'}
function psrSelectionFeature(f,layerId){if(!f?.geometry)return null;const p=f.properties||{},kind=psrSelectionKind(layerId,f),label=psrFeatureLabel(f,layerId);return psrGeoFeature(f.geometry,{selectionKind:kind,label,sourceLayer:layerId,sourceId:p.id||p.psrId||p.psrBoundaryId||p.territoryId||'',boundarySource:p.boundarySource||p.geometrySource||p.source||'',boundaryConfidence:p.boundaryConfidence||'',parentTerritory:p.parentTerritory||'',developer:p.developer||'',isBuilding:(kind==='building'||kind==='project')&&f.geometry.type!=='Point'?1:0,isPoint:f.geometry.type==='Point'?1:0,renderHeight:Number(p.renderHeight||p.height||p.render_height||0)||12,renderBase:Number(p.renderBase||p.min_height||0)||0})}
function psrSetUniversalHover(feature){state.universalHover=feature||null;map.getSource('psr-universal-hover')?.setData(feature?fc([feature]):fc([]))}
function psrSetUniversalSelection(feature){state.universalSelection=feature||null;const src=map.getSource('psr-universal-selection'),payload=feature?fc([feature]):fc([]),token=(feature?.properties?.sourceId||'')+'|'+(feature?.properties?.label||'');src?.setData(payload);if(feature){[320,1100].forEach(ms=>setTimeout(()=>{const cur=state.universalSelection;if(cur&&((cur.properties?.sourceId||'')+'|'+(cur.properties?.label||''))===token)map.getSource('psr-universal-selection')?.setData(fc([cur]))},ms))}const active=!!feature;if(map.getLayer('psr-community-polygon-labels'))map.setLayoutProperty('psr-community-polygon-labels','visibility',active?'none':'visible');if(map.getLayer('psr-official-district-label'))map.setLayoutProperty('psr-official-district-label','visibility',active?'none':'visible');if(map.getLayer('community-labels'))map.setLayoutProperty('community-labels','visibility','none')}
function psrTerritoryStatsFromPool(name,pool){const nk=norm(name),ps=(pool||[]).filter(p=>{const a=norm(p.area||'');return a===nk}),off=ps.filter(p=>p.timeline==='future'||/off.?plan|under construction|launch/i.test([p.masterStatus,p.status,p.statusLabel].filter(Boolean).join(' '))).length,ready=ps.filter(p=>p.timeline==='past'||/ready|complete|completed/i.test([p.masterStatus,p.status,p.statusLabel].filter(Boolean).join(' '))).length,on=ps.filter(p=>availabilityClass(p)==='on-sale').length,psf=ps.map(psrPricePsfValue).filter(Number.isFinite).sort((a,b)=>a-b);return {projects:ps.length,offplan:off,ready,onSale:on,askPsfMedian:psf.length?psf[Math.floor(psf.length/2)]:null}}function psrTerritoryStats(name){const pool=state.projects?.length?state.projects:(state.mapData?.projects||[]);return psrTerritoryStatsFromPool(name,pool)}
function psrShowMasterTerritory(f){const p=f.properties||{},name=p.name||p.canonicalName||'Master development',s=psrTerritoryStats(name),detail=$('#detail-body');state.selected={id:p.territoryId||('master:'+psrSlug(name)),kind:'community',name,emirate:p.emirate||'Dubai',masterDevelopment:true};state.selectedSpatial={type:'master-development',id:p.territoryId||'',name};const render=()=>{const q=psrTerritoryStats(name);detail.innerHTML='<div class="detail-content"><span class="detail-badge">MASTER DEVELOPMENT</span><h2>'+esc(name)+'</h2><div class="detail-sub">'+esc([p.emirate,p.developer].filter(Boolean).join(' · '))+'</div><div class="detail-facts">'+detailFact('Projects',q.projects)+detailFact('Off-plan / future',q.offplan)+detailFact('Ready / completed',q.ready)+detailFact('On sale',q.onSale)+detailFact('Median project ask AED / sqft',q.askPsfMedian?psrFmtPsf(q.askPsfMedian):'—')+detailFact('Parent territory',p.parentTerritory||'—')+'</div><div class="detail-section"><h3>Territory</h3><p>Selected geometry is the verified master-development footprint, not the catalogue point. '+esc(p.boundarySource||'Verified spatial source')+' · confidence '+esc(p.boundaryConfidence||'reviewed')+'.</p></div></div>';return q};const first=render();$('#detail').classList.remove('hidden');psrApplyDockPadding(false);if(!first.projects){fetch('/map/map-data.json',{cache:'force-cache'}).then(r=>r.json()).then(j=>{if(state.selectedSpatial?.type!=='master-development'||state.selectedSpatial?.name!==name)return;const q=psrTerritoryStatsFromPool(name,j.projects||[]);detail.querySelector('.detail-content')&&(detail.innerHTML='<div class="detail-content"><span class="detail-badge">MASTER DEVELOPMENT</span><h2>'+esc(name)+'</h2><div class="detail-sub">'+esc([p.emirate,p.developer].filter(Boolean).join(' · '))+'</div><div class="detail-facts">'+detailFact('Projects',q.projects)+detailFact('Off-plan / future',q.offplan)+detailFact('Ready / completed',q.ready)+detailFact('On sale',q.onSale)+detailFact('Median project ask AED / sqft',q.askPsfMedian?psrFmtPsf(q.askPsfMedian):'—')+detailFact('Parent territory',p.parentTerritory||'—')+'</div><div class="detail-section"><h3>Territory</h3><p>Selected geometry is the verified master-development footprint, not the catalogue point. '+esc(p.boundarySource||'Verified spatial source')+' · confidence '+esc(p.boundaryConfidence||'reviewed')+'.</p></div></div>')}).catch(()=>{})};let tries=0;const tick=setInterval(()=>{tries++;if(state.selectedSpatial?.type!=='master-development'||state.selectedSpatial?.name!==name){clearInterval(tick);return}const q=psrTerritoryStats(name);if(q.projects){render();clearInterval(tick)}else if(tries>=18)clearInterval(tick)},350)}
function psrBestGeometryAt(point){const order=['project-footprint-extrusions','psr-official-building-hit','psr-master-territory-hit','psr-universal-community-hit','psr-official-district-fill','psr-universal-emirate-hit','project-points','project-fallback-points'].filter(id=>map.getLayer(id));for(const id of order){const fs=map.queryRenderedFeatures(point,{layers:[id]})||[];if(fs.length)return {feature:fs[0],layerId:id}}return null}
function psrHandleUniversalSelection(hit){if(!hit)return;const sf=psrSelectionFeature(hit.feature,hit.layerId);if(!sf)return;psrSetUniversalSelection(sf);psrSetUniversalHover(null);const p=hit.feature.properties||{};if(hit.layerId==='psr-master-territory-hit')psrShowMasterTerritory(hit.feature);else if(hit.layerId==='psr-community-click'||hit.layerId==='psr-universal-community-hit'){psrSelectCommunityFeature(hit.feature)}else if(hit.layerId==='psr-emirate-fill'||hit.layerId==='psr-universal-emirate-hit'){const n=p.psrName||p.name;if(n)psrShowEmirate(n)}else if(hit.layerId==='psr-official-district-fill'){state.selectedSpatial={type:'district',name:psrFeatureLabel(hit.feature,hit.layerId)};const d=$('#detail-body');if(d){d.innerHTML='<div class="detail-content"><span class="detail-badge">DISTRICT</span><h2>'+esc(psrFeatureLabel(hit.feature,hit.layerId))+'</h2><div class="detail-sub">Official UAE spatial territory</div><div class="detail-section"><h3>Selection</h3><p>The full district geometry is highlighted. Community/master-development boundaries take priority whenever a more specific verified territory exists.</p></div></div>';$('#detail').classList.remove('hidden');psrApplyDockPadding(false)}}}
async function psrLoadMasterTerritories(){if(state.masterTerritoriesLoaded)return state.masterTerritoryData;try{const j=await fetch('/map/spatial/master-territories.geojson',{cache:'force-cache'}).then(r=>r.json());state.masterTerritoryData=j?.type==='FeatureCollection'?j:fc([]);state.masterTerritoriesLoaded=true;const src=map.getSource('psr-master-territories');if(src){src.setData(state.masterTerritoryData);state.masterTerritorySourceHydrated=true}return state.masterTerritoryData}catch(e){console.warn('master territories',e);state.masterTerritoryData=fc([]);return state.masterTerritoryData}}
function psrMatchMasterTerritory(name){const nk=norm(name);return (state.masterTerritoryData?.features||[]).find(f=>{const p=f.properties||{};return [p.name,p.canonicalName,p.alias].filter(Boolean).some(v=>norm(v)===nk)})||null}
function psrSelectBestTerritoryForRecord(r){if(!r||r.kind!=='community')return false;const mf=psrMatchMasterTerritory(r.name);if(mf){psrHandleUniversalSelection({feature:mf,layerId:'psr-master-territory-hit'});return true}if(state.spatial?.dubaiPolygonData){const cf=(state.spatial.dubaiPolygonData.features||[]).find(f=>String(f.properties?.psrId||'')===String(r.id)||norm(psrBoundaryName(f))===norm(r.name));if(cf){psrHandleUniversalSelection({feature:cf,layerId:'psr-community-click'});return true}}return false}
function psrEnsureUniversalSpatialLayers(){if(!map?.getStyle?.())return;const addSource=(id,data)=>{if(!map.getSource(id))map.addSource(id,{type:'geojson',data})};addSource('psr-master-territories',state.masterTerritoryData||fc([]));if(state.masterTerritoryData?.features?.length&&!state.masterTerritorySourceHydrated){map.getSource('psr-master-territories')?.setData(state.masterTerritoryData);state.masterTerritorySourceHydrated=true}addSource('psr-universal-hover',fc([]));addSource('psr-universal-selection',fc([]));const add=def=>{if(!map.getLayer(def.id))map.addLayer(def)};add({id:'psr-universal-emirate-base',type:'fill',source:'psr-emirate-polygons',paint:{'fill-color':'#6f7d82','fill-opacity':.025}});add({id:'psr-universal-emirate-hit',type:'fill',source:'psr-emirate-polygons',paint:{'fill-color':'#000','fill-opacity':.001}});add({id:'psr-master-territory-base',type:'fill',source:'psr-master-territories',paint:{'fill-color':'#7b8588','fill-opacity':.028}});add({id:'psr-master-territory-line',type:'line',source:'psr-master-territories',paint:{'line-color':'rgba(48,58,63,.44)','line-width':['interpolate',['linear'],['zoom'],7,.8,12,1.6,15,2.1]}});add({id:'psr-master-territory-hit',type:'fill',source:'psr-master-territories',paint:{'fill-color':'#000','fill-opacity':.001}});add({id:'psr-universal-community-base',type:'fill',source:'psr-dubai-community-polygons',paint:{'fill-color':'#7d8b8f','fill-opacity':['case',['==',['get','psrMatched'],1],.045,.024]}});add({id:'psr-universal-community-hit',type:'fill',source:'psr-dubai-community-polygons',paint:{'fill-color':'#000','fill-opacity':.001}});if(map.getSource('psr-official-buildings')&&!map.getLayer('psr-official-building-hit'))add({id:'psr-official-building-hit',type:'fill',source:'psr-official-buildings',minzoom:15.5,paint:{'fill-color':'#000','fill-opacity':.001}});add({id:'psr-universal-hover-fill',type:'fill',source:'psr-universal-hover',filter:['!=',['get','isPoint'],1],paint:{'fill-color':'#5d6a6f','fill-opacity':.085}});add({id:'psr-universal-hover-line',type:'line',source:'psr-universal-hover',filter:['!=',['get','isPoint'],1],paint:{'line-color':'rgba(44,54,59,.78)','line-width':['interpolate',['linear'],['zoom'],6,1.4,12,2.3,16,3.2]}});add({id:'psr-universal-hover-extrusion',type:'fill-extrusion',source:'psr-universal-hover',filter:['==',['get','isBuilding'],1],minzoom:13.8,paint:{'fill-extrusion-color':'#6c777b','fill-extrusion-height':['get','renderHeight'],'fill-extrusion-base':['get','renderBase'],'fill-extrusion-opacity':.22}});add({id:'psr-universal-selected-fill',type:'fill',source:'psr-universal-selection',filter:['!=',['get','isPoint'],1],paint:{'fill-color':PSR_GOLD,'fill-opacity':.16}});add({id:'psr-universal-selected-line',type:'line',source:'psr-universal-selection',filter:['!=',['get','isPoint'],1],paint:{'line-color':PSR_GOLD,'line-width':['interpolate',['linear'],['zoom'],5,2.3,10,3.3,15,4.5,18,5.2],'line-opacity':1}});add({id:'psr-universal-selected-extrusion',type:'fill-extrusion',source:'psr-universal-selection',filter:['==',['get','isBuilding'],1],minzoom:13.8,paint:{'fill-extrusion-color':PSR_GOLD,'fill-extrusion-height':['get','renderHeight'],'fill-extrusion-base':['get','renderBase'],'fill-extrusion-opacity':.3}});add({id:'psr-universal-hover-point',type:'circle',source:'psr-universal-hover',filter:['==',['get','isPoint'],1],paint:{'circle-radius':7,'circle-color':'rgba(255,255,255,.75)','circle-stroke-color':'#5d6a6f','circle-stroke-width':2}});add({id:'psr-universal-selected-point',type:'circle',source:'psr-universal-selection',filter:['==',['get','isPoint'],1],paint:{'circle-radius':8,'circle-color':'rgba(255,255,255,.92)','circle-stroke-color':PSR_GOLD,'circle-stroke-width':3}});add({id:'psr-universal-selected-label',type:'symbol',source:'psr-universal-selection',layout:{'text-field':['get','label'],'text-size':['interpolate',['linear'],['zoom'],5,12,12,15,16,18],'text-max-width':16,'text-optional':true,'text-allow-overlap':false},paint:{'text-color':'#171b1e','text-halo-color':'rgba(255,255,255,.98)','text-halo-width':2.2}});for(const id of ['psr-community-selected','psr-community-selection-fill','psr-community-selection-outline','psr-community-selection-label','psr-emirate-selected'])if(map.getLayer(id))map.setLayoutProperty(id,'visibility','none');for(const id of ['psr-community-base','psr-community-click','psr-emirate-fill'])if(map.getLayer(id))map.setLayoutProperty(id,'visibility','none');if(map.getLayer('community-points'))map.setPaintProperty('community-points','circle-opacity',.12);if(map.getLayer('community-hit'))map.setLayoutProperty('community-hit','visibility','none');if(map.getLayer('community-labels'))map.setLayoutProperty('community-labels','visibility','none');if(!state.universalSpatialEventsBound){state.universalSpatialEventsBound=true;map.on('mouseout',()=>psrSetUniversalHover(null));map.on('click',e=>{const hit=psrBestGeometryAt(e.point);if(hit)psrHandleUniversalSelection(hit)})}psrLoadMasterTerritories()}
const _psrShowDetailV49=showDetail;showDetail=function(r){if(r?.kind==='community'&&psrSelectBestTerritoryForRecord(r))return;_psrShowDetailV49(r)};
const _psrClearCommunityV49=psrClearCommunitySelection;psrClearCommunitySelection=function(){_psrClearCommunityV49();psrSetUniversalSelection(null)};
/* Spatial interaction layers are installed only after the user reaches city scale. */
/* PSR master territory hydration v50 */
map.on('sourcedata',e=>{if(e.sourceId==='psr-master-territories'&&e.isSourceLoaded&&state.masterTerritoryData?.features?.length)state.masterTerritorySourceHydrated=true});

/* PSR community event isolation v51 and emirate isolation v52 now run with
   city-scale spatial hydration instead of during initial map startup. */

/* PSR territory stat hydration v53 */

/* PSR master snapshot stats v54 */

/* PSR selection paint resilience v55 */

/* ===== PSR community reconciliation + overlap resolver v56 ===== */
state.communityReconciledCount=state.communityReconciledCount||0;
function psrCommunityRecordForFeature(f){const p=f?.properties||{};if(p.psrId){const r=state.recordById.get(String(p.psrId));if(r)return r}const name=p.psrName||p.psrBoundaryName||p.name||p.area_name_en||'';return psrMatchCommunityByName(name)||null}
function psrFeatureBBoxArea(f){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,n=0;const walk=c=>{if(Array.isArray(c)&&typeof c[0]==='number'){minX=Math.min(minX,c[0]);minY=Math.min(minY,c[1]);maxX=Math.max(maxX,c[0]);maxY=Math.max(maxY,c[1]);n++}else if(Array.isArray(c))c.forEach(walk)};walk(f?.geometry?.coordinates);return n?Math.max(1e-12,(maxX-minX)*(maxY-minY)):1e9}
function psrChooseCommunityFeature(fs,point){if(!fs?.length)return null;if(fs.length===1)return fs[0];const ll=map.unproject(point);const scored=fs.map(f=>{const r=psrCommunityRecordForFeature(f),c=r?.coordinates,lat=Number(c?.lat),lng=Number(c?.lng),d=Number.isFinite(lat)&&Number.isFinite(lng)?Math.hypot(lng-ll.lng,lat-ll.lat):9,src=String(f.properties?.source||'');let sourcePenalty=src==='dm-community'?0:src==='split-osm'?0.04:0.08;const area=psrFeatureBBoxArea(f);return {f,r,score:(r?0:100)+d*40+sourcePenalty+Math.log10(area+1e-12)*.02}}).sort((a,b)=>a.score-b.score);return scored[0].f}
function psrReconcileCommunityPolygons(){if(!state.spatial?.dubaiPolygonData||!state.communities?.length)return false;if(state.communityReconciledCount===state.communities.length)return false;psrPrepareCommunityBoundaryData(state.spatial.dubaiPolygonData);const src=map.getSource('psr-dubai-community-polygons');if(src){src.setData(state.spatial.dubaiPolygonData);state.communitySourceHydrated=true}state.communityReconciledCount=state.communities.length;return true}
const _psrBestGeometryAtV56=psrBestGeometryAt;psrBestGeometryAt=function(point){const order=['project-footprint-extrusions','psr-official-building-hit','psr-master-territory-hit','psr-universal-community-hit','psr-official-district-fill','psr-universal-emirate-hit','project-points','project-fallback-points'].filter(id=>map.getLayer(id));for(const id of order){const fs=map.queryRenderedFeatures(point,{layers:[id]})||[];if(!fs.length)continue;return {feature:id==='psr-universal-community-hit'?psrChooseCommunityFeature(fs,point):fs[0],layerId:id}}return null};
const _psrRefreshSourcesV56=refreshSources;refreshSources=function(){_psrRefreshSourcesV56();setTimeout(psrReconcileCommunityPolygons,60)};
map.on('load',()=>setTimeout(psrReconcileCommunityPolygons,800));
/* ===== PSR native territory highlight v57 ===== */
function psrClearNativeTerritoryHighlight(){const none=['==',['get','territoryId'],'__none__'];for(const id of ['psr-master-native-hover-fill','psr-master-native-hover-line','psr-master-native-selected-fill','psr-master-native-selected-line'])if(map.getLayer(id))map.setFilter(id,none);const cnone=['==',['get','psrBoundaryId'],'__none__'];for(const id of ['psr-community-native-hover-fill','psr-community-native-hover-line','psr-community-native-selected-fill','psr-community-native-selected-line'])if(map.getLayer(id))map.setFilter(id,cnone)}
function psrApplyNativeHover(hit){for(const id of ['psr-master-native-hover-fill','psr-master-native-hover-line'])if(map.getLayer(id))map.setFilter(id,['==',['get','territoryId'],hit?.layerId==='psr-master-territory-hit'?(hit.feature.properties?.territoryId||'__none__'):'__none__']);for(const id of ['psr-community-native-hover-fill','psr-community-native-hover-line'])if(map.getLayer(id))map.setFilter(id,['==',['get','psrBoundaryId'],hit?.layerId==='psr-universal-community-hit'?(hit.feature.properties?.psrBoundaryId||'__none__'):'__none__'])}
function psrApplyNativeSelection(hit){for(const id of ['psr-master-native-selected-fill','psr-master-native-selected-line'])if(map.getLayer(id))map.setFilter(id,['==',['get','territoryId'],hit?.layerId==='psr-master-territory-hit'?(hit.feature.properties?.territoryId||'__none__'):'__none__']);for(const id of ['psr-community-native-selected-fill','psr-community-native-selected-line'])if(map.getLayer(id))map.setFilter(id,['==',['get','psrBoundaryId'],hit?.layerId==='psr-universal-community-hit'?(hit.feature.properties?.psrBoundaryId||'__none__'):'__none__'])}
function psrCommunityStatsFromPool(name,pool){const nk=norm(name),ps=(pool||[]).filter(p=>{const a=norm(p.area||'');return a===nk}),off=ps.filter(p=>p.timeline==='future'||/off.?plan|under construction|launch/i.test([p.masterStatus,p.status,p.statusLabel].filter(Boolean).join(' '))).length,ready=ps.filter(p=>p.timeline==='past'||/ready|complete|completed/i.test([p.masterStatus,p.status,p.statusLabel].filter(Boolean).join(' '))).length,on=ps.filter(p=>availabilityClass(p)==='on-sale').length,sold=ps.filter(p=>availabilityClass(p)==='sold-out').length,vals=ps.map(psrPricePsfValue).filter(Number.isFinite).sort((a,b)=>a-b);return {projects:ps.length,offplan:off,ready,onSale:on,soldOut:sold,askPsfMedian:vals.length?vals[Math.floor(vals.length/2)]:null}}
function psrRefreshBoundaryDetailFromSnapshot(f){const name=psrBoundaryName(f),p=f.properties||{};fetch('/map/map-data.json',{cache:'force-cache'}).then(r=>r.json()).then(j=>{if(state.selectedSpatial?.type!=='community'||state.selectedSpatial?.name!==name)return;const s=psrCommunityStatsFromPool(name,j.projects||[]),record=(j.communities||[]).find(c=>norm(c.name)===norm(name));const d=$('#detail-body');if(!d)return;d.innerHTML='<div class="detail-content"><span class="detail-badge">COMMUNITY</span><h2>'+esc(name)+'</h2><div class="detail-sub">Dubai · '+(record?'Catalogue community + mapped boundary':'Mapped boundary · catalogue join pending')+'</div><div class="detail-facts">'+detailFact('Projects',s.projects)+detailFact('Off-plan / future',s.offplan)+detailFact('Ready / completed',s.ready)+detailFact('On sale',s.onSale)+detailFact('Sold out',s.soldOut)+detailFact('Median project ask AED / sqft',s.askPsfMedian?psrFmtPsf(s.askPsfMedian):'—')+'</div><div class="detail-section"><h3>Boundary</h3><p>'+esc(p.geometrySource||p.boundarySource||'DLD-area / OpenStreetMap curated polygon')+'. The full polygon—not a centroid—is the selected territory.</p></div></div>'}).catch(()=>{})}
const _psrShowCommunityBoundaryDetailV57=psrShowCommunityBoundaryDetail;psrShowCommunityBoundaryDetail=function(f,record){_psrShowCommunityBoundaryDetailV57(f,record);const name=psrBoundaryName(f);state.selectedSpatial={type:'community',id:f.properties?.psrBoundaryId||'',name};psrRefreshBoundaryDetailFromSnapshot(f)};
const _psrHandleUniversalSelectionV57=psrHandleUniversalSelection;psrHandleUniversalSelection=function(hit){psrApplyNativeSelection(hit);_psrHandleUniversalSelectionV57(hit)};
const _psrSetUniversalHoverV57=psrSetUniversalHover;psrSetUniversalHover=function(feature){_psrSetUniversalHoverV57(feature)};
const _psrEnsureUniversalSpatialLayersV57=psrEnsureUniversalSpatialLayers;psrEnsureUniversalSpatialLayers=function(){_psrEnsureUniversalSpatialLayersV57();const add=def=>{if(!map.getLayer(def.id))map.addLayer(def)};add({id:'psr-master-native-hover-fill',type:'fill',source:'psr-master-territories',filter:['==',['get','territoryId'],'__none__'],paint:{'fill-color':'#59676c','fill-opacity':.08}});add({id:'psr-master-native-hover-line',type:'line',source:'psr-master-territories',filter:['==',['get','territoryId'],'__none__'],paint:{'line-color':'rgba(42,52,57,.8)','line-width':2.2}});add({id:'psr-master-native-selected-fill',type:'fill',source:'psr-master-territories',filter:['==',['get','territoryId'],'__none__'],paint:{'fill-color':PSR_GOLD,'fill-opacity':.18}});add({id:'psr-master-native-selected-line',type:'line',source:'psr-master-territories',filter:['==',['get','territoryId'],'__none__'],paint:{'line-color':PSR_GOLD,'line-width':['interpolate',['linear'],['zoom'],7,2.5,12,4,16,5.2]}});add({id:'psr-community-native-hover-fill',type:'fill',source:'psr-dubai-community-polygons',filter:['==',['get','psrBoundaryId'],'__none__'],paint:{'fill-color':'#59676c','fill-opacity':.075}});add({id:'psr-community-native-hover-line',type:'line',source:'psr-dubai-community-polygons',filter:['==',['get','psrBoundaryId'],'__none__'],paint:{'line-color':'rgba(42,52,57,.78)','line-width':2.1}});add({id:'psr-community-native-selected-fill',type:'fill',source:'psr-dubai-community-polygons',filter:['==',['get','psrBoundaryId'],'__none__'],paint:{'fill-color':PSR_GOLD,'fill-opacity':.17}});add({id:'psr-community-native-selected-line',type:'line',source:'psr-dubai-community-polygons',filter:['==',['get','psrBoundaryId'],'__none__'],paint:{'line-color':PSR_GOLD,'line-width':['interpolate',['linear'],['zoom'],7,2.4,12,3.8,16,5]}});if(map.getLayer('community-points'))map.setLayoutProperty('community-points','visibility','none')};
if(!state.nativeHoverBound){state.nativeHoverBound=true;map.on('mouseout',()=>psrApplyNativeHover(null))}
map.on('load',()=>{
  const hydrateSpatialAtCityScale=()=>{if(map.getZoom()<8.4)return;map.off('moveend',hydrateSpatialAtCityScale);setTimeout(psrEnsureUniversalSpatialLayers,80)};
  map.on('moveend',hydrateSpatialAtCityScale);hydrateSpatialAtCityScale();
});
/* ===== AE explorer shell v60 ===== */
const AE_EMIRATE_VIEWS={Dubai:{center:[55.27,25.16],zoom:9.7},'Abu Dhabi':{center:[54.55,24.38],zoom:8.3},Sharjah:{center:[55.62,25.34],zoom:9.1},Ajman:{center:[55.50,25.40],zoom:10.3},'Ras Al Khaimah':{center:[55.94,25.80],zoom:9.2},Fujairah:{center:[56.24,25.13],zoom:9.0},'Umm Al Quwain':{center:[55.58,25.56],zoom:9.5}};
function aeEmirateSummary(){const cs=state.communities||[],ps=state.projects||[];const names=['Dubai','Abu Dhabi','Sharjah','Ajman','Ras Al Khaimah','Fujairah','Umm Al Quwain'];return names.map(name=>({name,communities:cs.filter(c=>norm(c.emirate)===norm(name)).length,projects:ps.filter(p=>norm(p.emirate)===norm(name)).length}))}
function aeRenderExplorer(){const root=$('#ae-emirate-list');if(!root)return;const rows=aeEmirateSummary();$('#ae-catalogue-community-count')&&($('#ae-catalogue-community-count').textContent=(state.communities||[]).length.toLocaleString());root.innerHTML=rows.map(r=>'<button class="ae-emirate-row" data-ae-emirate="'+esc(r.name)+'"><span class="ae-emirate-mark"></span><span class="ae-emirate-copy"><strong>'+esc(r.name)+'</strong><small>'+r.communities.toLocaleString()+' mapped communities · '+r.projects.toLocaleString()+' projects</small></span><span class="ae-chevron">›</span></button>').join('');$$('[data-ae-emirate]').forEach(b=>b.addEventListener('click',()=>{const n=b.dataset.aeEmirate,v=AE_EMIRATE_VIEWS[n];if(v)map.easeTo({center:v.center,zoom:v.zoom,pitch:state.is3d?42:0,duration:650});state.selectedSpatial={type:'emirate',name:n};$$('#ae-scope-tabs button').forEach(x=>x.classList.toggle('active',x.dataset.aeScope===n));if(typeof psrShowEmirate==='function')setTimeout(()=>psrShowEmirate(n),360)}))}
function aeBindScopeTabs(){const root=$('#ae-scope-tabs');if(!root||root.dataset.bound)return;root.dataset.bound='1';root.addEventListener('click',e=>{const b=e.target.closest('[data-ae-scope]');if(!b)return;const s=b.dataset.aeScope;if(s==='uae'){map.easeTo({center:[54.35,24.25],zoom:6.35,pitch:state.is3d?32:0,duration:650});$$('#ae-scope-tabs button').forEach(x=>x.classList.toggle('active',x===b));return}if(s==='more'){const first=$('#ae-emirate-list');first?.scrollIntoView({block:'nearest',behavior:'smooth'});return}const v=AE_EMIRATE_VIEWS[s];if(v){map.easeTo({center:v.center,zoom:v.zoom,pitch:state.is3d?42:0,duration:650});$$('#ae-scope-tabs button').forEach(x=>x.classList.toggle('active',x===b))}})}
function aeHydrateExplorerWhenReady(){aeBindScopeTabs();let tries=0;const timer=setInterval(()=>{tries++;if((state.communities||[]).length){aeRenderExplorer();clearInterval(timer)}else if(tries>40)clearInterval(timer)},150)}
setTimeout(aeHydrateExplorerWhenReady,50);map.on('load',()=>setTimeout(aeHydrateExplorerWhenReady,80));
/* strict footprint identity v65: proximity assignment removed; map labels selected-only; availability kept in details */

/* AE critical-first startup v70: core data before full map load; context on demand; live sync delayed */

/* AE progressive geometry v76 */
map.on('moveend',()=>{if(map.getZoom()>=10.5)psrEnsureFullEmirates()});

/* AE server-snapshot runtime v77: no browser-side 46-page catalogue churn */

/* ===== AE mobile sheet controller v78 ===== */
const AE_MOBILE_SHEET_MQ=window.matchMedia('(max-width:760px)');
function aeMobileSheetVisible(){return $$('.floating-panel').find(p=>!p.classList.contains('hidden'))||null}
function aeMobileSheetPadding(animate=false){if(!AE_MOBILE_SHEET_MQ.matches)return false;const p=aeMobileSheetVisible();let bottom=72;if(p){const mode=p.dataset.aeSheet||'half';const h=mode==='peek'?86:mode==='full'?Math.max(86,window.innerHeight-144):Math.min(window.innerHeight*.46,420);bottom=Math.min(Math.round(h+82),Math.max(82,window.innerHeight-78))}const pad={top:64,right:0,bottom,left:0};try{map.setPadding(pad)}catch{}return true}
const _aePrevDockPaddingV78=psrApplyDockPadding;psrApplyDockPadding=function(animate=false){if(aeMobileSheetPadding(animate))return;return _aePrevDockPaddingV78(animate)};
function aeSetMobileSheet(panel,next,animate=true){if(!panel)return;const allowed=new Set(['peek','half','full']);const stateName=allowed.has(next)?next:'half';panel.dataset.aeSheet=stateName;const min=panel.querySelector('.ae-mobile-sheet-minimize');const handle=panel.querySelector('.ae-mobile-sheet-handle');if(min){min.textContent=stateName==='peek'?'⌃':'⌄';min.setAttribute('aria-label',stateName==='peek'?'Expand panel':'Minimize panel')}if(handle)handle.setAttribute('aria-label','Resize panel, '+stateName+' height');try{localStorage.setItem('ae-mobile-sheet-state',stateName==='full'?'half':stateName)}catch{}requestAnimationFrame(()=>aeMobileSheetPadding(animate))}
function aeStepMobileSheet(panel,dir){const cur=panel?.dataset.aeSheet||'half';if(dir>0){aeSetMobileSheet(panel,cur==='peek'?'half':'full')}else{aeSetMobileSheet(panel,cur==='full'?'half':'peek')}}
function aeAttachMobileSheet(panel){if(!panel||panel.dataset.aeSheetBound)return;panel.dataset.aeSheetBound='1';let saved='half';try{saved=localStorage.getItem('ae-mobile-sheet-state')||'half'}catch{}if(!['peek','half'].includes(saved))saved='half';panel.dataset.aeSheet=saved;const bar=document.createElement('div');bar.className='ae-mobile-sheet-bar';bar.innerHTML='<button type="button" class="ae-mobile-sheet-handle" aria-label="Resize panel"><span></span></button><button type="button" class="ae-mobile-sheet-minimize" aria-label="Minimize panel">⌄</button>';panel.insertBefore(bar,panel.firstChild);const handle=bar.querySelector('.ae-mobile-sheet-handle'),min=bar.querySelector('.ae-mobile-sheet-minimize');handle.addEventListener('click',()=>{if(!AE_MOBILE_SHEET_MQ.matches)return;const cur=panel.dataset.aeSheet||'peek';aeSetMobileSheet(panel,cur==='peek'?'half':cur==='half'?'full':'half')});min.addEventListener('click',e=>{e.stopPropagation();if(!AE_MOBILE_SHEET_MQ.matches)return;aeSetMobileSheet(panel,(panel.dataset.aeSheet||'half')==='peek'?'half':'peek')});let y0=0,tracking=false;bar.addEventListener('pointerdown',e=>{if(!AE_MOBILE_SHEET_MQ.matches)return;tracking=true;y0=e.clientY;try{bar.setPointerCapture(e.pointerId)}catch{}});bar.addEventListener('pointerup',e=>{if(!tracking)return;tracking=false;const dy=e.clientY-y0;if(Math.abs(dy)>48)aeStepMobileSheet(panel,dy<0?1:-1)});bar.addEventListener('pointercancel',()=>tracking=false)}
function aeInitMobileSheets(){ $$('.floating-panel').forEach(aeAttachMobileSheet); if(AE_MOBILE_SHEET_MQ.matches){const visible=aeMobileSheetVisible();if(visible&&!visible.dataset.aeSheet)aeSetMobileSheet(visible,'half',false);aeMobileSheetPadding(false)} }
setTimeout(aeInitMobileSheets,0);
$$('.rail-btn[data-panel]').forEach(btn=>btn.addEventListener('click',()=>{if(!AE_MOBILE_SHEET_MQ.matches)return;requestAnimationFrame(()=>{const p=$('#'+btn.dataset.panel+'-panel');if(p&&!p.classList.contains('hidden'))aeSetMobileSheet(p,'half',false)})}));
$$('.panel-close').forEach(btn=>btn.addEventListener('click',()=>setTimeout(()=>aeMobileSheetPadding(true),0)));
AE_MOBILE_SHEET_MQ.addEventListener?.('change',()=>{aeInitMobileSheets();psrApplyDockPadding(false)});
window.addEventListener('orientationchange',()=>setTimeout(()=>psrApplyDockPadding(false),120),{passive:true});

/* AE mobile sheet padding sync v79 */

/* ===== AE unified mobile sheet + navigation v80 ===== */
const AE_UI80_MQ=window.matchMedia('(max-width:760px)');
const aeUi80={moved:false,placeholders:new Map()};
function aeUi80MobileModeControls(){
  const app=$('#app'),rail=$('.layer-rail'),three=$('#toggle-3d'),reset=$('#reset-view'); if(!app||!rail||!three||!reset)return;
  let box=$('.ae-mobile-map-modes'); if(!box){box=document.createElement('div');box.className='ae-mobile-map-modes';box.setAttribute('aria-label','Map modes');app.appendChild(box)}
  for(const el of [three,reset]) if(!aeUi80.placeholders.has(el)){const ph=document.createComment('ae-ui80-'+el.id);el.parentNode?.insertBefore(ph,el);aeUi80.placeholders.set(el,ph)}
  if(AE_UI80_MQ.matches){box.appendChild(three);box.appendChild(reset);aeUi80.moved=true}
  else if(aeUi80.moved){for(const el of [three,reset]){const ph=aeUi80.placeholders.get(el);if(ph?.parentNode)ph.parentNode.insertBefore(el,ph.nextSibling)}aeUi80.moved=false}
}
function aeUi80SheetLabel(panel){if(!panel)return 'Details';if(panel.classList.contains('floating-panel')){return panel.querySelector('.panel-title-row h1,.panel-title-row h2')?.textContent?.trim()||'Explore'}if(panel.id==='detail')return panel.querySelector('#detail-body h1,#detail-body h2,.detail-content h1,.detail-content h2')?.textContent?.trim()||'Selected place';if(panel.id==='compare-panel')return panel.querySelector('h1,h2')?.textContent?.trim()||'Compare';return 'Details'}
function aeUi80AttachAuxSheet(panel){if(!panel||panel.dataset.aeUi80Sheet)return;panel.dataset.aeUi80Sheet='1';if(!panel.querySelector(':scope > .ae-mobile-sheet-bar')){const bar=document.createElement('div');bar.className='ae-mobile-sheet-bar';bar.innerHTML='<button type="button" class="ae-mobile-sheet-handle" aria-label="Resize panel"><span></span><em class="ae-mobile-sheet-summary"></em></button><button type="button" class="ae-mobile-sheet-minimize" aria-label="Minimize panel">⌄</button>';panel.insertBefore(bar,panel.firstChild);const handle=bar.querySelector('.ae-mobile-sheet-handle'),min=bar.querySelector('.ae-mobile-sheet-minimize'),sum=bar.querySelector('.ae-mobile-sheet-summary');const refresh=()=>{const next=aeUi80SheetLabel(panel);if(sum&&sum.textContent!==next)sum.textContent=next};refresh();new MutationObserver(refresh).observe(panel,{subtree:true,childList:true,characterData:true});handle.addEventListener('click',()=>{if(!AE_UI80_MQ.matches)return;const cur=panel.dataset.aeSheet||'half';aeSetMobileSheet(panel,cur==='peek'?'half':cur==='half'?'full':'half')});min.addEventListener('click',e=>{e.stopPropagation();if(!AE_UI80_MQ.matches)return;aeSetMobileSheet(panel,(panel.dataset.aeSheet||'half')==='peek'?'half':'peek')});let y0=0,tracking=false;bar.addEventListener('pointerdown',e=>{if(!AE_UI80_MQ.matches)return;tracking=true;y0=e.clientY;try{bar.setPointerCapture(e.pointerId)}catch{}});bar.addEventListener('pointerup',e=>{if(!tracking)return;tracking=false;const dy=e.clientY-y0;if(Math.abs(dy)>48)aeStepMobileSheet(panel,dy<0?1:-1)});bar.addEventListener('pointercancel',()=>tracking=false)}}
function aeUi80VisibleSheet(){const candidates=[$('#compare-panel'),$('#detail'),...$$('.floating-panel')];return candidates.find(p=>p&&!p.classList.contains('hidden')&&getComputedStyle(p).visibility!=='hidden'&&Number(getComputedStyle(p).opacity)>.05)||null}
aeMobileSheetVisible=function(){return aeUi80VisibleSheet()};
aeMobileSheetPadding=function(animate=false){if(!AE_UI80_MQ.matches)return false;const p=aeUi80VisibleSheet();let bottom=78;if(p){const mode=p.dataset.aeSheet||'half';const h=mode==='peek'?96:mode==='full'?Math.max(96,window.innerHeight-152):Math.min(window.innerHeight*.50,430);bottom=Math.min(Math.round(h+88),Math.max(88,window.innerHeight-76))}const pad={top:72,right:0,bottom,left:0};try{map.setPadding(pad)}catch{}return true};
function aeUi80Init(){aeUi80MobileModeControls();aeUi80AttachAuxSheet($('#detail'));aeUi80AttachAuxSheet($('#compare-panel'));if(AE_UI80_MQ.matches){const visible=aeUi80VisibleSheet();if(visible)aeSetMobileSheet(visible,'half',false);requestAnimationFrame(()=>aeMobileSheetPadding(false))}}
const aeUi80Watch=new MutationObserver(ms=>{if(!AE_UI80_MQ.matches)return;for(const m of ms){const p=m.target;if(!(p instanceof HTMLElement))continue;if((p.id==='detail'||p.id==='compare-panel')&&m.attributeName==='class'){const wasHidden=(m.oldValue||'').split(/\s+/).includes('hidden');const nowHidden=p.classList.contains('hidden');if(wasHidden&&!nowHidden)aeSetMobileSheet(p,'half',true)}}});
setTimeout(()=>{aeUi80Init();for(const p of [$('#detail'),$('#compare-panel')])if(p)aeUi80Watch.observe(p,{attributes:true,attributeFilter:['class'],attributeOldValue:true})},40);
AE_UI80_MQ.addEventListener?.('change',()=>{aeUi80MobileModeControls();aeUi80Init();setTimeout(()=>psrApplyDockPadding(false),80)});
window.addEventListener('resize',()=>{if(AE_UI80_MQ.matches)requestAnimationFrame(()=>aeMobileSheetPadding(false))},{passive:true});

/* ===== AE mobile sheet padding authority v82 ===== */
function aeUi82PaddingFor(panel,mode,animate=false){if(!AE_UI80_MQ.matches)return;const stateName=mode||panel?.dataset?.aeSheet||'half';const h=stateName==='peek'?100:stateName==='full'?Math.max(100,window.innerHeight-152):Math.min(window.innerHeight*.50,430);const pad={top:72,right:0,bottom:Math.min(Math.round(h+88),Math.max(88,window.innerHeight-76)),left:0};try{map.setPadding(pad)}catch{}}
const _aeSetMobileSheetV82=aeSetMobileSheet;
aeSetMobileSheet=function(panel,next,animate=true){_aeSetMobileSheetV82(panel,next,animate);if(AE_UI80_MQ.matches&&panel&&!panel.classList.contains('hidden'))requestAnimationFrame(()=>aeUi82PaddingFor(panel,next,animate))};
const aeUi82AuxWatch=new MutationObserver(ms=>{if(!AE_UI80_MQ.matches)return;for(const m of ms){if(m.attributeName!=='class')continue;const p=m.target;if(!(p instanceof HTMLElement))continue;if(p.id!=='detail'&&p.id!=='compare-panel')continue;if(p.classList.contains('hidden'))setTimeout(()=>aeMobileSheetPadding(true),30);else setTimeout(()=>aeUi82PaddingFor(p,p.dataset.aeSheet||'half',true),30)}});
setTimeout(()=>{for(const p of [$('#detail'),$('#compare-panel')])if(p)aeUi82AuxWatch.observe(p,{attributes:true,attributeFilter:['class']})},80);

/* ===== AE search command surface v83 ===== */
(()=>{const input=$('#search'),box=$('#search-results'),clear=$('#clear-search');if(!input||!box)return;input.addEventListener('focus',()=>renderSearch());input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();aeSearchMoveCursor(1)}else if(e.key==='ArrowUp'){e.preventDefault();aeSearchMoveCursor(-1)}else if(e.key==='Enter'){if(state.searchResults?.length){e.preventDefault();aeActivateSearchPosition(Number.isInteger(state.searchCursor)?state.searchCursor:0)}}else if(e.key==='Escape'){box.classList.add('hidden');input.setAttribute('aria-expanded','false');input.blur()}});box.addEventListener('mousedown',e=>{const b=e.target.closest('[data-search-pos]');if(!b)return;e.preventDefault();aeActivateSearchPosition(Number(b.dataset.searchPos))});clear?.addEventListener('click',()=>{state.searchResults=[];state.searchCursor=-1;input.closest('.search-wrap')?.classList.remove('has-query');input.focus();renderSearch()});document.addEventListener('pointerdown',e=>{if(!e.target.closest('.search-wrap')){box.classList.add('hidden');input.setAttribute('aria-expanded','false')}});document.addEventListener('keydown',e=>{const typing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'');if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();input.focus();input.select();renderSearch()}else if(e.key==='/'&&!typing&&!e.metaKey&&!e.ctrlKey&&!e.altKey){e.preventDefault();input.focus();renderSearch()}});})();

/* ===== AE on-demand deep hydration v86 ===== */
(function(){const deepPanels=new Set(['analyze','valuation','ai']);document.addEventListener('click',e=>{const panel=e.target.closest?.('[data-panel]');if(panel&&deepPanels.has(panel.dataset.panel))setTimeout(()=>psrRequestDeepHydration('panel:'+panel.dataset.panel),180);const canvas=e.target.closest?.('.maplibregl-canvas');const search=e.target.closest?.('.search-item');if(canvas||search)setTimeout(()=>{const d=document.querySelector('#detail');if(d&&!d.classList.contains('hidden'))psrRequestDeepHydration('detail')},420)},{passive:true});})();

/* ===== AE collapsible workspace cards v1 ===== */
(function(){
  const mq=window.matchMedia('(max-width:760px)');
  const icon=(collapsed)=>collapsed?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 14 5-5 5 5"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>';
  function titleFor(panel){
    return panel.querySelector('.panel-title-row h1,.panel-title-row h2,.compare-head h2,.detail-content h2')?.textContent?.trim()||panel.id.replace(/-/g,' ')||'Panel';
  }
  function syncButton(panel,btn){const c=panel.classList.contains('ae-collapsed');btn.innerHTML=icon(c);btn.setAttribute('aria-expanded',String(!c));btn.setAttribute('aria-label',(c?'Expand ':'Collapse ')+titleFor(panel));btn.title=(c?'Expand ':'Collapse ')+titleFor(panel)}
  function setCollapsed(panel,collapsed){
    if(!panel)return;
    if(mq.matches&&panel.classList.contains('floating-panel')&&typeof aeSetMobileSheet==='function'){aeSetMobileSheet(panel,collapsed?'peek':'half',true);panel.classList.toggle('ae-collapsed',collapsed);}
    else panel.classList.toggle('ae-collapsed',collapsed);
    panel.querySelectorAll(':scope > .panel-title-row .ae-collapse-toggle,:scope > .compare-head .ae-collapse-toggle,:scope > .ae-collapse-toggle').forEach(b=>syncButton(panel,b));
    try{psrApplyDockPadding?.(true)}catch{}
  }
  function attach(panel){
    if(!panel||panel.dataset.aeCollapseBound)return;panel.dataset.aeCollapseBound='1';
    let host=panel.querySelector(':scope > .panel-title-row,:scope > .compare-head');
    const btn=document.createElement('button');btn.type='button';btn.className='ae-collapse-toggle';
    if(host){host.appendChild(btn)}else{panel.appendChild(btn)}
    syncButton(panel,btn);
    btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setCollapsed(panel,!panel.classList.contains('ae-collapsed'))});
  }
  function install(){document.querySelectorAll('.floating-panel,#detail,#compare-panel').forEach(attach)}
  install();
  /* panels are static; no whole-document mutation scan needed */
  document.querySelectorAll('.rail-btn[data-panel]').forEach(b=>b.addEventListener('click',()=>{const p=document.getElementById(b.dataset.panel+'-panel');if(p?.classList.contains('ae-collapsed'))setCollapsed(p,false)}));
  window.addEventListener('resize',()=>{document.querySelectorAll('.floating-panel.ae-collapsed').forEach(p=>{if(mq.matches&&typeof aeSetMobileSheet==='function')aeSetMobileSheet(p,'peek',false)})},{passive:true});
})();

/* ===== AE mobile sheet authority v7 ===== */
(function(){
 const mq=window.matchMedia('(max-width:760px)');
 const base=aeSetMobileSheet;
 aeSetMobileSheet=function(panel,next,animate=false){
   if(panel&&next!=='peek')panel.classList.remove('ae-collapsed');
   base(panel,next,false);
 };
 if(mq.matches){try{localStorage.setItem('ae-mobile-sheet-state','half')}catch{};requestAnimationFrame(()=>{const p=typeof aeUi80VisibleSheet==='function'?aeUi80VisibleSheet():null;if(p)aeSetMobileSheet(p,'half',false)})}
})();

/* ===== AE dependable navigation v4 ===== */
(function aeInstallDependableNavigation(){
  const VERSION='20260922-auditfix-v13';
  if(document.documentElement.dataset.aeNavigation===VERSION)return;
  const app=$('#app'),mapRoot=$('#map'),search=$('#search'),searchBox=$('#search-results');
  if(!app||!mapRoot)return;
  document.documentElement.dataset.aeNavigation=VERSION;

  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const duration=()=>reducedMotion.matches?0:220;
  let focusMode=false;
  let helpOpen=false;
  let lastFocus=null;
  let fatalTimer=0;
  let mapBaseReady=false;

  const status=document.createElement('div');
  status.className='ae-sr-only';
  status.id='ae-map-status';
  status.setAttribute('role','status');
  status.setAttribute('aria-live','polite');
  app.appendChild(status);
  const announce=message=>{status.textContent='';requestAnimationFrame(()=>{status.textContent=message})};

  mapRoot.tabIndex=0;
  mapRoot.setAttribute('role','region');
  mapRoot.setAttribute('aria-describedby','ae-map-instructions');
  mapRoot.setAttribute('aria-keyshortcuts','ArrowUp ArrowDown ArrowLeft ArrowRight + - Home ? Escape');
  mapRoot.setAttribute('aria-label','Interactive UAE property map. Use arrow keys to pan, plus and minus to zoom, Home to reset, and question mark for help.');
  if(search){search.setAttribute('aria-label','Search UAE projects, communities, developers, buildings, or RERA numbers');search.setAttribute('aria-haspopup','listbox')}

  const instructions=document.createElement('p');
  instructions.id='ae-map-instructions';
  instructions.className='ae-sr-only';
  instructions.textContent='Drag or use arrow keys to move the map. Scroll, pinch, or use plus and minus to zoom. Select a visible pin for details.';
  app.appendChild(instructions);

  const skip=document.createElement('a');
  skip.className='ae-skip-map';
  skip.href='#map';
  skip.textContent='Skip to interactive map';
  skip.addEventListener('click',event=>{event.preventDefault();setFocusMode(true,{focus:true})});
  app.insertBefore(skip,app.firstChild);

  const tools=document.createElement('div');
  tools.className='ae-search-map-tools';
  tools.setAttribute('aria-label','Map navigation tools');
  tools.innerHTML='<button class="ae-map-focus-toggle" type="button" aria-pressed="false" aria-label="Focus map"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5M8 12h8M12 8v8"/></svg><span>Map</span></button><button class="ae-map-help-toggle" type="button" aria-expanded="false" aria-controls="ae-map-help" aria-label="Map navigation help">?</button>';
  const clear=$('#clear-search');
  clear?.parentNode?.insertBefore(tools,clear);
  const focusButton=tools.querySelector('.ae-map-focus-toggle');
  const helpButton=tools.querySelector('.ae-map-help-toggle');

  const help=document.createElement('aside');
  help.id='ae-map-help';
  help.className='ae-map-help';
  help.hidden=true;
  help.setAttribute('role','dialog');
  help.setAttribute('aria-modal','false');
  help.setAttribute('aria-labelledby','ae-map-help-title');
  help.innerHTML='<div class="ae-map-help-head"><div><span>NAVIGATION</span><h2 id="ae-map-help-title">Move around the map</h2></div><button type="button" class="ae-map-help-close" aria-label="Close navigation help">×</button></div><div class="ae-map-help-grid"><div><kbd>Drag</kbd><span>Pan the map</span></div><div><kbd>Scroll / pinch</kbd><span>Zoom in or out</span></div><div><kbd>Arrow keys</kbd><span>Pan with the keyboard</span></div><div><kbd>+ / −</kbd><span>Change zoom</span></div><div><kbd>Home</kbd><span>Return to the UAE</span></div><div><kbd>Esc</kbd><span>Exit map focus</span></div></div><p>Select any visible project or territory to open its details. Use Search for a direct jump.</p>';
  app.appendChild(help);
  const helpClose=help.querySelector('.ae-map-help-close');

  const coach=document.createElement('div');
  coach.className='ae-map-coach';
  coach.innerHTML='<strong>Navigate the map</strong><span>Drag to pan · Scroll or pinch to zoom · Select a pin</span>';
  app.appendChild(coach);
  try{if(sessionStorage.getItem('ae-map-coach-seen')==='1')coach.hidden=true}catch{}
  const dismissCoach=()=>{coach.hidden=true;try{sessionStorage.setItem('ae-map-coach-seen','1')}catch{}};

  function setHelp(open){
    helpOpen=!!open;
    help.hidden=!helpOpen;
    helpButton?.setAttribute('aria-expanded',String(helpOpen));
    if(helpOpen){lastFocus=document.activeElement;helpClose?.focus({preventScroll:true});announce('Map navigation help opened')}
    else{announce('Map navigation help closed');if(lastFocus instanceof HTMLElement)lastFocus.focus({preventScroll:true})}
  }

  function setFocusMode(on,{focus=true}={}){
    const next=!!on;
    if(focusMode===next){if(focus&&next)mapRoot.focus({preventScroll:true});return}
    focusMode=next;
    document.body.classList.toggle('ae-map-focus-mode',focusMode);
    focusButton?.setAttribute('aria-pressed',String(focusMode));
    focusButton?.setAttribute('aria-label',focusMode?'Exit map focus':'Focus map');
    focusButton?.classList.toggle('active',focusMode);
    try{
      if(focusMode)map.setPadding({top:0,right:0,bottom:0,left:0});
      else if(typeof psrApplyDockPadding==='function')psrApplyDockPadding(false);
      map.resize();
    }catch{}
    requestAnimationFrame(()=>{try{map.resize()}catch{}});
    announce(focusMode?'Map focus on. Panels are hidden; drag or use arrow keys to navigate.':'Map focus off. Workspace panels restored.');
    if(focus)mapRoot.focus({preventScroll:true});
  }

  function resetMap(){
    try{map.easeTo({center:views.uae.center,zoom:views.uae.zoom,pitch:0,bearing:0,padding:{top:0,right:0,bottom:0,left:0},duration:duration()});announce('UAE view restored')}
    catch{document.querySelector('#reset-view')?.click()}
  }

  focusButton?.addEventListener('click',()=>setFocusMode(!focusMode,{focus:true}));
  helpButton?.addEventListener('click',()=>setHelp(!helpOpen));
  helpClose?.addEventListener('click',()=>setHelp(false));

  mapRoot.addEventListener('keydown',event=>{
    const step=event.shiftKey?220:110;
    let handled=true;
    try{
      if(event.key==='ArrowLeft')map.panBy([step,0],{duration:duration()});
      else if(event.key==='ArrowRight')map.panBy([-step,0],{duration:duration()});
      else if(event.key==='ArrowUp')map.panBy([0,step],{duration:duration()});
      else if(event.key==='ArrowDown')map.panBy([0,-step],{duration:duration()});
      else if(event.key==='+'||event.key==='=')map.zoomIn({duration:duration()});
      else if(event.key==='-'||event.key==='_')map.zoomOut({duration:duration()});
      else if(event.key==='Home'||event.key==='0')resetMap();
      else if(event.key==='?'||(event.key==='/'&&event.shiftKey))setHelp(!helpOpen);
      else if(event.key==='Escape'){if(helpOpen)setHelp(false);else setFocusMode(false,{focus:true})}
      else handled=false;
    }catch{handled=false}
    if(handled){event.preventDefault();event.stopPropagation();dismissCoach()}
  });

  document.addEventListener('keydown',event=>{
    const typing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'');
    if(event.altKey&&event.key.toLowerCase()==='m'&&!typing){event.preventDefault();setFocusMode(!focusMode,{focus:true})}
    else if(event.key==='Escape'&&focusMode&&!typing){event.preventDefault();setFocusMode(false,{focus:true})}
  });

  $$('.rail-btn[data-panel]').forEach(button=>{
    const panelId=button.dataset.panel+'-panel';
    button.setAttribute('aria-controls',panelId);
    button.setAttribute('aria-label',button.title||button.textContent.trim());
    button.addEventListener('click',()=>{if(focusMode)setFocusMode(false,{focus:false});requestAnimationFrame(syncRailState)});
  });
  $('#toggle-3d')?.setAttribute('aria-label','Toggle 3D buildings');
  $('#reset-view')?.setAttribute('aria-label','Reset UAE view');
  $('#reset-view')?.addEventListener('click',()=>announce('UAE view restored'));

  function syncRailState(){
    $$('.rail-btn[data-panel]').forEach(button=>{
      const active=button.classList.contains('active');
      button.setAttribute('aria-pressed',String(active));
      button.setAttribute('aria-expanded',String(active&&!$('#'+button.dataset.panel+'-panel')?.classList.contains('hidden')));
    });
  }
  syncRailState();
  const rail=$('.layer-rail');
  if(rail)new MutationObserver(syncRailState).observe(rail,{subtree:true,attributes:true,attributeFilter:['class']});

  function syncSearchA11y(){
    if(!search||!searchBox)return;
    const options=$$('#search-results [role="option"]');
    options.forEach((option,index)=>{if(!option.id)option.id='ae-search-option-'+index});
    const active=options.find(option=>option.getAttribute('aria-selected')==='true'||option.classList.contains('is-active'));
    if(active&&!searchBox.classList.contains('hidden'))search.setAttribute('aria-activedescendant',active.id);
    else search.removeAttribute('aria-activedescendant');
  }
  if(searchBox)new MutationObserver(syncSearchA11y).observe(searchBox,{childList:true,subtree:true,attributes:true,attributeFilter:['class','aria-selected']});
  search?.addEventListener('focus',()=>{if(focusMode)setFocusMode(false,{focus:false});syncSearchA11y()});

  for(const handler of ['dragPan','scrollZoom','boxZoom','doubleClickZoom','touchZoomRotate']){
    try{map[handler]?.enable?.()}catch{}
  }
  // The focusable map region owns the documented shortcuts below. Disable the
  // parallel MapLibre handler so one keypress never pans or zooms twice.
  try{map.keyboard?.disable?.()}catch{}
  const canvas=map.getCanvas();
  const canvasContainer=map.getCanvasContainer?.();
  canvas.setAttribute('aria-hidden','true');
  mapRoot.style.touchAction='none';
  if(canvasContainer)canvasContainer.style.touchAction='none';
  canvas.style.touchAction='none';
  // Trackpad pinch arrives in Chromium as a ctrl+wheel gesture. Own it at the
  // map boundary so the map camera changes while the surrounding workspace
  // remains at a stable CSS-pixel size.
  app.addEventListener('wheel',event=>{
    if(!event.ctrlKey||event.metaKey)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const delta=Math.max(-1.25,Math.min(1.25,-event.deltaY*.018));
    if(Math.abs(delta)<.01)return;
    const rect=mapRoot.getBoundingClientRect();
    const point=[event.clientX-rect.left,event.clientY-rect.top];
    let around;
    try{around=map.unproject(point)}catch{}
    map.zoomTo(Math.max(map.getMinZoom(),Math.min(map.getMaxZoom(),map.getZoom()+delta)),{around,duration:0});
    dismissCoach();
  },{capture:true,passive:false});
  let gestureZoom=0;
  app.addEventListener('gesturestart',event=>{event.preventDefault();gestureZoom=map.getZoom()},{capture:true,passive:false});
  app.addEventListener('gesturechange',event=>{event.preventDefault();const scale=Math.max(.25,Number(event.scale)||1);map.zoomTo(Math.max(map.getMinZoom(),Math.min(map.getMaxZoom(),gestureZoom+Math.log2(scale))),{duration:0})},{capture:true,passive:false});
  canvas.addEventListener('pointerdown',dismissCoach,{passive:true,once:true});
  canvas.addEventListener('wheel',dismissCoach,{passive:true,once:true});

  map.on('movestart',()=>document.body.classList.add('ae-map-moving'));
  map.on('moveend',()=>{
    document.body.classList.remove('ae-map-moving');
    const c=map.getCenter();
    mapRoot.setAttribute('aria-label','Interactive UAE property map at zoom '+map.getZoom().toFixed(1)+', centered near '+c.lat.toFixed(3)+', '+c.lng.toFixed(3)+'. Use arrow keys to pan and plus or minus to zoom.');
  });

  const markReady=()=>{
    clearTimeout(fatalTimer);
    mapBaseReady=true;
    document.body.classList.add('ae-map-ready');
    document.querySelector('.ae-map-recovery')?.remove();
    announce('Map ready. Drag to pan, scroll or pinch to zoom, or search for a place.');
    requestAnimationFrame(()=>{try{map.resize()}catch{}});
  };
  map.once('load',markReady);
  if(map.loaded())markReady();
  fatalTimer=setTimeout(()=>{
    if(mapBaseReady||map.loaded()||map.isStyleLoaded?.())return;
    document.dispatchEvent(new CustomEvent('ae:map-recovery',{detail:{message:'The map engine is taking longer than expected to load.'}}));
  },12000);
  map.on('error',event=>{
    console.warn('Map resource error',event?.error||event);
    if(!mapBaseReady)announce('A startup map resource failed to load. Retrying from the edge cache.');
  });

  if('ResizeObserver' in window){
    let observedWidth=0,observedHeight=0,resizeFrame=0;
    new ResizeObserver(entries=>{
      const rect=entries.at(-1)?.contentRect;if(!rect)return;
      if(Math.abs(rect.width-observedWidth)<1&&Math.abs(rect.height-observedHeight)<1)return;
      observedWidth=rect.width;observedHeight=rect.height;
      if(resizeFrame)return;
      resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;try{map.resize()}catch{}});
    }).observe(mapRoot);
  }
  window.addEventListener('orientationchange',()=>setTimeout(()=>{try{map.resize()}catch{}},100),{passive:true});
  if(location.hash==='#map')setTimeout(()=>setFocusMode(true,{focus:true}),0);
  else if(location.hash==='#map-help')setTimeout(()=>setHelp(true),0);
  setTimeout(()=>{if(!coach.hidden)coach.classList.add('is-fading')},6500);
  setTimeout(dismissCoach,7600);
})();
