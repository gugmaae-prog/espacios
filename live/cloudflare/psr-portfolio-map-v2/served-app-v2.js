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
function coordsOf(r){ const c=r?.coordinates, lng=Array.isArray(c)?c[0]:c?.lng, lat=Array.isArray(c)?c[1]:c?.lat; return lng!==null&&lng!==undefined&&lng!==''&&lat!==null&&lat!==undefined&&lat!==''&&Number.isFinite(Number(lng))&&Number.isFinite(Number(lat))?[Number(lng),Number(lat)]:null; }

function isFallback(r){ return /fallback|centroid|emirate-level|not a surveyed project-site coordinate|area-level|masterplan location|community location/i.test(String(r.coordinateBasis||'')); }
function validUaeCoord(r){
  const c=coordsOf(r); if(!c)return false;
  return c[1]>=22.45&&c[1]<=26.55&&c[0]>=51.35&&c[0]<=56.65;
}
function locationQuality(r){
  if(!coordsOf(r))return 'unmapped';
  if(!validUaeCoord(r)||r.recordGrain==='authority_registered_project_or_phase')return 'review';
  return isFallback(r)?'area':'exact';
}
function locationLabel(r){ if(r.recordGrain==='authority_registered_project_or_phase'&&coordsOf(r))return 'Authority coordinate · not independently surveyed';
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

// Pointer queries must use a MapLibre PointLike tuple, never a plain {x,y} options object.
function aePointerCoordinates(point){
  const x=Array.isArray(point)?point[0]:point?.x,y=Array.isArray(point)?point[1]:point?.y;
  return typeof x==='number'&&typeof y==='number'&&Number.isFinite(x)&&Number.isFinite(y)?[x,y]:null;
}
function aeQueryAtPointer(point,layers){
  const xy=aePointerCoordinates(point),root=map.getContainer();
  if(!xy||!Array.isArray(layers)||!layers.length||xy[0]<0||xy[1]<0||xy[0]>root.clientWidth||xy[1]>root.clientHeight)return [];
  return map.queryRenderedFeatures(xy,{layers});
}
function aePickPointerFeature(features,point){
  if(!features?.length)return null;
  const xy=aePointerCoordinates(point);if(!xy)return null;
  const footprint=features.find(f=>f.layer?.id==='project-footprint-extrusions'&&/Polygon$/.test(f.geometry?.type||''));
  if(footprint)return footprint;
  let nearest=null,distance=Infinity;
  for(const f of features){
    if(f.geometry?.type!=='Point')continue;
    try{const p=map.project(f.geometry.coordinates),d=(p.x-xy[0])**2+(p.y-xy[1])**2;
      if(Number.isFinite(d)&&d<distance){nearest=f;distance=d;}
    }catch{}
  }
  return nearest||features[0];
}

function showHover(r,point,extra=''){
  if(!r)return; clearTimeout(hideHover.t); const card=$('#hover-card'),img=$('#hover-image'),fallback=$('#hover-fallback'); card.dataset.recordId=String(r.id||''); card.dataset.hoverKind=r.kind||'record';
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
function hideHover(delay=90){ state.hoverToken++; clearTimeout(hideHover.t); hideHover.t=setTimeout(()=>{if(!state.hoverLocked)$('#hover-card').classList.add('hidden')},delay); }
$('#hover-card').addEventListener('mouseenter',()=>state.hoverLocked=true); $('#hover-card').addEventListener('mouseleave',()=>{state.hoverLocked=false;hideHover(60)});

async function hoverFromMap(e){
  const layers=['project-footprint-extrusions','project-hit','project-clusters','community-hit','initiative-hit','place-hit','place-clusters','roi-points'].filter(id=>map.getLayer(id));
  const features=aeQueryAtPointer(e.point,layers); if(!features.length){hideHover(0);map.getCanvas().style.cursor='';return;}
  map.getCanvas().style.cursor='pointer'; const f=aePickPointerFeature(features,e.point), token=++state.hoverToken;
  if(f.layer.id==='project-clusters'){
    const clusterId=f.properties.cluster_id; const leaves=await map.getSource('psr-projects').getClusterLeaves(clusterId,12,0); if(token!==state.hoverToken)return;
    const rec=leaves.map(x=>state.recordById.get(String(x.properties.id))).find(x=>x&&recordImage(x))||state.recordById.get(String(leaves[0]?.properties?.id));
    if(rec)showHover(rec,e.point,(f.properties.point_count||'')+' projects'); return;
  }
  if(f.layer.id==='place-clusters'){
    const clusterId=f.properties.cluster_id; const leaves=await map.getSource('psr-places').getClusterLeaves(clusterId,8,0); if(token!==state.hoverToken)return;
    const rec=state.recordById.get(String(leaves[0]?.properties?.id)); if(rec)showHover(rec,e.point,(f.properties.point_count||'')+' places'); return;
  }
  const id=String(f.properties.id||''); const rec=state.recordById.get(id); if(rec)showHover(rec,e.point);else{hideHover(0);map.getCanvas().style.cursor='';}
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
    hoverLastRun=now;const point=hoverPoint;hoverPoint=null;const pending=hoverFromMap({point}),token=state.hoverToken;pending.catch(()=>{if(token===state.hoverToken)hideHover(0)});
  });
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
  else if(r.kind==='initiative') facts.push(detailFact('Category',r.category),detailFact('Status',r.status),detailFact('Timing',r.timing),detailFact('Emirate',r.emirate));
  else facts.push(detailFact('Category',r.categoryLabel),detailFact('Address',r.address),detailFact('Confidence',r.confidence));
  let verify=''; if(v){verify='<div class="detail-section"><h3>Workbook verification</h3><div class="verify-row">'+[v.verificationStatus,v.regulator,v.dldReraNo?'RERA '+v.dldReraNo:null,v.verifiedOn?'Checked '+v.verifiedOn:null].filter(Boolean).map(x=>'<span class="verify-chip">'+esc(x)+'</span>').join('')+'</div>'+(v.verificationNotes?'<p style="margin-top:8px">'+esc(v.verificationNotes)+'</p>':'')+'</div>'}
  const db=r.developerBrain; let developerIntel=''; if(db){developerIntel='<div class="detail-section"><h3>Developer intelligence</h3><div class="detail-facts">'+detailFact('Emirates',db.emiratesPresent)+detailFact('Catalog assets',db.catalogProjectsBuildings)+detailFact('On sale',db.catalogOnSale)+detailFact('Catalog from',db.catalogFrom)+'</div>'+(db.keyCommunities?'<p style="margin-top:8px">Key communities: '+esc(db.keyCommunities)+'</p>':'')+'</div>'}
  const summary=r.summary||r.marketImpact||r.descriptor||'';
  const primary=recordHref(r), secondary=r.availabilitySource||v?.registryEvidenceUrl||r.sourceUrl||r.source?.url||r.website||'';
  $('#detail-body').innerHTML=hero+'<div class="detail-content"><span class="detail-badge">'+esc(r.kind==='initiative'?'Future initiative':r.kind||'record')+'</span><h2>'+esc(recordTitle(r))+'</h2><div class="detail-sub">'+esc(recordSub(r))+'</div><div class="detail-facts">'+facts.join('')+'</div>'+(summary?'<div class="detail-section"><h3>Context</h3><p>'+esc(summary)+'</p></div>':'')+verify+developerIntel+'<div class="detail-actions">'+(primary&&primary!=='#'?'<a href="'+esc(primary)+'">Open project</a>':'')+(secondary?'<a class="secondary" href="'+esc(secondary)+'" target="_blank" rel="noopener">Source</a>':'')+'</div></div>';
  $('#detail').classList.remove('hidden'); psrApplyDockPadding(true); if(c){const z=r.kind==='project'?(isFallback(r)?Math.max(map.getZoom(),11.8):Math.max(map.getZoom(),15.2)):Math.max(map.getZoom(),11);map.easeTo({center:c,zoom:z,pitch:state.is3d?60:0,duration:850});if(r.kind==='project')setTimeout(()=>scheduleProjectFootprints(40),900);}
}
$('#detail-close').addEventListener('click',()=>{$('#detail').classList.add('hidden');psrApplyDockPadding(true);state.selected=null;map.getSource('selection')?.setData(fc([]));scheduleProjectFootprints(40)});

function clickFromMap(e){
  const layers=['project-footprint-extrusions','project-hit','community-hit','initiative-hit','place-hit','roi-points','project-clusters','place-clusters'].filter(id=>map.getLayer(id)); const f=aePickPointerFeature(aeQueryAtPointer(e.point,layers),e.point); if(!f)return;
  if(f.layer.id==='project-clusters'){const cid=f.properties.cluster_id;map.getSource('psr-projects').getClusterExpansionZoom(cid).then(z=>map.easeTo({center:f.geometry.coordinates,zoom:z,duration:600}));return;}
  if(f.layer.id==='place-clusters'){const cid=f.properties.cluster_id;map.getSource('psr-places').getClusterExpansionZoom(cid).then(z=>map.easeTo({center:f.geometry.coordinates,zoom:z,duration:600}));return;}
  const r=state.recordById.get(String(f.properties.id||'')); if(r){queueMicrotask(()=>showDetail(r));} // Resolve the explicit pin after background territory listeners.
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
  const mapResponse=await (boot.mapData||fetch('/map/map-core.json?v=20260929-collapse-repair-v3',{cache:'force-cache'}));
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
    const full=await fetch('/map/map-data.json?v=20260929-collapse-repair-v3',{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error('full map '+r.status);return r.json()});
    state.mapData=full;state.communities=(full.communities||[]).map(x=>({...x,href:absHref(x.href)}));state.initiatives=(full.initiatives||[]).map(x=>({...x,href:absHref(x.href)}));state.projects=mergeSiteIntoMap(full.projects||[],state.siteProjects||[],state.communities);
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
  try{await __aeCoreReady;addSourcesAndLayers();setupUI();performance.mark('ae:map-ui-ready');scheduleDeepHydration();setTimeout(()=>psrLoadEmirates().catch(e=>console.warn('emirates',e)),180);map.on('mousemove',scheduleHoverFromMap);map.on('click',clickFromMap);map.on('mouseout',()=>{hoverPoint=null;state.hoverToken++;if(hoverFrame)cancelAnimationFrame(hoverFrame);hoverFrame=0;hideHover();map.getCanvas().style.cursor=''});map.on('movestart',()=>{hoverPoint=null;state.hoverLocked=false;if(hoverFrame)cancelAnimationFrame(hoverFrame);hoverFrame=0;hideHover(0);map.getCanvas().style.cursor=''});map.on('zoom',()=>{const z=map.getZoom();$('#zoom-label').textContent='Zoom '+z.toFixed(1);if(state.is3d&&z>=AE_3D_MIN_ZOOM)add3DBuildings()});map.on('moveend',()=>scheduleProjectFootprints(80));map.on('zoomend',()=>{sync3DForCamera();scheduleProjectFootprints(80)});/* seamless-v12: footprint resolution runs only after camera movement, never in an idle feedback loop */sync3DForCamera({animate:false});}
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
  const metric=$('#analysis-metric');if(metric){if(!metric.querySelector('option[value=emerging-hotspots]')){const og=document.createElement('optgroup');og.label='Emerging signal';const opt=document.createElement('option');opt.value='emerging-hotspots';opt.textContent='Emerging hotspots';og.appendChild(opt);metric.appendChild(og);}metric.addEventListener('change',e=>psrSetAnalysis(e.target.value));}
async function aeEnsureEmergingHotspots(){if(state._hotspotsLoaded)return state._hotspotsLoaded;state._hotspotsLoaded=(async()=>{try{const r=await fetch('/map/api/hotspots',{cache:'no-store'});if(!r.ok)throw new Error('hotspots '+r.status);const data=await r.json();const feats=(data.hotspots||[]).map(h=>{const c=h.coordinates||h.centroid||{};const lng=Number(c.lng??c[0]),lat=Number(c.lat??c[1]);if(!Number.isFinite(lng)||!Number.isFinite(lat))return null;return{type:'Feature',geometry:{type:'Point',coordinates:[lng,lat]},properties:{name:h.area||h.communityName||'',band:h.band||'monitor',score:Number(h.hotspotScore)||0,drivers:(h.drivers||[]).slice(0,4).join(' · '),emirate:h.emirate||''}}}).filter(Boolean);if(!map.getSource('ae-emerging-hotspots')){map.addSource('ae-emerging-hotspots',{type:'geojson',data:{type:'FeatureCollection',features:feats}});map.addLayer({id:'ae-emerging-hotspots-glow',type:'circle',source:'ae-emerging-hotspots',paint:{'circle-radius':['interpolate',['linear'],['get','score'],50,10,80,22],'circle-color':['match',['get','band'],'emerging_hotspot','#35d6c6','watchlist','#f0c45b','#6b8a99'],'circle-opacity':0.22,'circle-blur':0.6}});map.addLayer({id:'ae-emerging-hotspots-core',type:'circle',source:'ae-emerging-hotspots',paint:{'circle-radius':['interpolate',['linear'],['get','score'],50,5,80,9],'circle-color':['match',['get','band'],'emerging_hotspot','#1ec4b3','watchlist','#e0b34a','#7f96a3'],'circle-stroke-width':2,'circle-stroke-color':'rgba(255,255,255,.92)'}});map.addLayer({id:'ae-emerging-hotspots-label',type:'symbol',source:'ae-emerging-hotspots',minzoom:8.5,layout:{'text-field':['get','name'],'text-size':11,'text-offset':[0,1.35],'text-anchor':'top','text-optional':true},paint:{'text-color':'#d7f7f3','text-halo-color':'rgba(4,18,28,.85)','text-halo-width':1.4}});map.on('click','ae-emerging-hotspots-core',e=>{const f=e.features?.[0];if(!f)return;const p=f.properties||{};const body=$('#detail-body');if(body){body.innerHTML='<div class="detail-content"><span class="detail-badge">EMERGING HOTSPOT</span><h2>'+esc(p.name||'Area')+'</h2><div class="detail-sub">'+esc(p.emirate||'UAE')+' · '+esc(String(p.band||'').replaceAll('_',' '))+'</div><div class="detail-facts">'+detailFact('Hotspot score',Number(p.score).toFixed(1))+detailFact('Drivers',p.drivers||'—')+'</div><p class="data-note">Indicative emerging-hotspot signal from pipeline, catalysts, and ROI coverage. Not investment advice.</p></div>';$('#detail')?.classList.remove('hidden')}});map.on('mouseenter','ae-emerging-hotspots-core',()=>map.getCanvas().style.cursor='pointer');map.on('mouseleave','ae-emerging-hotspots-core',()=>map.getCanvas().style.cursor='');}else{map.getSource('ae-emerging-hotspots').setData({type:'FeatureCollection',features:feats});}return data;}catch(err){console.warn('emerging hotspots',err);return null;}})();return state._hotspotsLoaded}
function aeSetEmergingHotspotsVisible(on){['ae-emerging-hotspots-glow','ae-emerging-hotspots-core','ae-emerging-hotspots-label'].forEach(id=>{if(map.getLayer(id))map.setLayoutProperty(id,'visibility',on?'visible':'none')})}
const _aeSetAnalysis=typeof psrSetAnalysis==='function'?psrSetAnalysis:null;if(_aeSetAnalysis){psrSetAnalysis=function(metric){_aeSetAnalysis(metric);const on=metric==='emerging-hotspots';if(on){aeEnsureEmergingHotspots().then(()=>aeSetEmergingHotspotsVisible(true));const el=$('#analysis-legend'),note=$('#analysis-note');if(el){el.classList.remove('hidden');el.innerHTML='<strong>Emerging hotspots</strong><div class="analysis-legend-row"><span style="color:#1ec4b3">Emerging</span><span style="color:#e0b34a">Watchlist</span><span style="color:#7f96a3">Monitor</span></div>'}if(note)note.textContent='Indicative future-investment signal. Not investment advice. Gold remains selection-only.';}else aeSetEmergingHotspotsVisible(false)};}
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
async function psrRenderMarketForecast(){const el=$('#market-forecast-card'),scope=await psrMarketScope(),metric=$('#market-history-metric')?.value||'transaction_value_aed',h=Number($('#forecast-horizon')?.value||12);if(!el)return;$('#forecast-scope-label').textContent=scope.label;psrRenderPipeline(scope);const ck=scope.type+'|'+scope.key+'|'+metric+'|'+h;let j=state.marketForecastCache.get(ck);if(!j){el.innerHTML='<div class="market-empty">Checking evidence and historical validation…</div>';try{j=await fetch('/map/api/market-forecast?model_version=20260922-forecast-v1&scope_type='+encodeURIComponent(scope.type)+'&scope_key='+encodeURIComponent(scope.key)+'&metric='+encodeURIComponent(metric)+'&horizon='+h).then(r=>r.json())}catch{j={forecast:null}}state.marketForecastCache.set(ck,j)}const f=j.forecast;if(!f){el.innerHTML='<div class="market-empty">'+esc(j.reason||'Comparable historical evidence is not yet sufficient.')+'</div>';return}el.innerHTML='<div class="market-history-head"><strong>'+esc(psrMetricLabel(metric))+' · '+h+'M</strong><b>'+esc(psrFormatMarket(f.central,j.unit,j.currencyCode))+'</b></div><div class="forecast-range"><div><span>Low</span><b>'+esc(psrFormatMarket(f.low,j.unit,j.currencyCode))+'</b></div><div><span>Base</span><b>'+esc(psrFormatMarket(f.central,j.unit,j.currencyCode))+'</b></div><div><span>High</span><b>'+esc(psrFormatMarket(f.high,j.unit,j.currencyCode))+'</b></div></div><div class="forecast-meta">Research preview · '+f.inputCount+' comparable monthly observations · '+esc(f.selectedModel||'evidence-gated')+'<br>'+esc(f.methodology)+'<br>Target period: '+esc(f.targetPeriodEnd||'not available')+'. Error band is indicative, not a probability guarantee.'+'</div>'}
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
psrRenderMarketForecast=async function(){const el=$('#market-forecast-card'),scope=psrMarketScopeFast(),metric=$('#market-history-metric')?.value||'transaction_value_aed',h=Number($('#forecast-horizon')?.value||12);if(!el)return;$('#forecast-scope-label').textContent=scope.label;psrRenderPipeline(scope);el.innerHTML='<div class="market-empty">Checking evidence and historical validation…</div>';const cov=await psrLoadMarketCoverage().catch(()=>[]),cover=psrCoverageForScope(scope,cov),key=cover?.scope_key||scope.key;let j=await fetch('/map/api/market-forecast?model_version=20260922-forecast-v1&scope_type='+encodeURIComponent(scope.type)+'&scope_key='+encodeURIComponent(key)+'&metric='+encodeURIComponent(metric)+'&horizon='+h).then(r=>r.json()).catch(()=>({forecast:null}));const f=j.forecast;if(!f){el.innerHTML='<div class="market-empty">'+esc(j.reason||'Comparable historical evidence is not yet sufficient.')+'</div>';return}el.innerHTML='<div class="market-history-head"><strong>'+esc(psrMetricLabel(metric))+' · '+h+'M</strong><b>'+esc(psrFormatMarket(f.central,j.unit,j.currencyCode))+'</b></div><div class="forecast-range"><div><span>Low</span><b>'+esc(psrFormatMarket(f.low,j.unit,j.currencyCode))+'</b></div><div><span>Base</span><b>'+esc(psrFormatMarket(f.central,j.unit,j.currencyCode))+'</b></div><div><span>High</span><b>'+esc(psrFormatMarket(f.high,j.unit,j.currencyCode))+'</b></div></div><div class="forecast-meta">Research preview · '+f.inputCount+' comparable monthly observations · '+esc(f.selectedModel||'evidence-gated')+'<br>'+esc(f.methodology)+'<br>Target period: '+esc(f.targetPeriodEnd||'not available')+'. Error band is indicative, not a probability guarantee.'+'</div>'}
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
function psrEnsureCommunityLayers(){if(!map||!map.getStyle?.())return false;const data=state.spatial?.dubaiPolygonData;if(data)psrPrepareCommunityBoundaryData(data);if(!map.getSource('psr-dubai-community-polygons')){map.addSource('psr-dubai-community-polygons',{type:'geojson',data:data||fc([])});state.communitySourceHydrated=!!data}else if(data&&!state.communitySourceHydrated){map.getSource('psr-dubai-community-polygons').setData(data);state.communitySourceHydrated=true}const before=psrCommunityBeforeLayer();const add=(def)=>{if(!map.getLayer(def.id))map.addLayer(def,before)};add({id:'psr-community-base',type:'fill',source:'psr-dubai-community-polygons',paint:{'fill-color':'#788489','fill-opacity':['case',['==',['get','psrMatched'],1],.045,.024]}});add({id:'psr-community-line',type:'line',source:'psr-dubai-community-polygons',paint:{'line-color':'rgba(57,67,72,.48)','line-width':['interpolate',['linear'],['zoom'],7.5,.7,10,1.15,13,1.75,16,2.2],'line-opacity':['interpolate',['linear'],['zoom'],7.5,.55,12,.78,16,.9]}});add({id:'psr-community-click',type:'fill',source:'psr-dubai-community-polygons',paint:{'fill-color':'#000000','fill-opacity':.001}});add({id:'psr-community-hover',type:'fill',source:'psr-dubai-community-polygons',filter:['==',['get','psrBoundaryId'],'__none__'],paint:{'fill-color':'#52656d','fill-opacity':.09}});add({id:'psr-community-selection-fill',type:'fill',source:'psr-dubai-community-polygons',filter:['==',['get','psrBoundaryId'],'__none__'],paint:{'fill-color':PSR_GOLD,'fill-opacity':.09}});add({id:'psr-community-selection-outline',type:'line',source:'psr-dubai-community-polygons',filter:['==',['get','psrBoundaryId'],'__none__'],paint:{'line-color':PSR_GOLD,'line-width':['interpolate',['linear'],['zoom'],7.5,2.2,11,3.2,15,4.2],'line-opacity':1}});add({id:'psr-community-polygon-labels',type:'symbol',source:'psr-dubai-community-polygons',minzoom:8.7,layout:{'text-field':['get','psrDisplayLabel'],'text-size':['interpolate',['linear'],['zoom'],8.7,9,12,11,15,12.5],'text-max-width':12,'text-optional':true,'text-allow-overlap':false},paint:{'text-color':'#525d62','text-halo-color':'rgba(255,255,255,.95)','text-halo-width':1.4}});add({id:'psr-community-selection-label',type:'symbol',source:'psr-dubai-community-polygons',filter:['==',['get','psrBoundaryId'],'__none__'],layout:{'text-field':['get','psrBoundaryName'],'text-size':['interpolate',['linear'],['zoom'],8,12,12,15,16,18],'text-max-width':16,'text-optional':false,'text-allow-overlap':false},paint:{'text-color':'#171b1e','text-halo-color':'rgba(255,255,255,.98)','text-halo-width':2.2}});if(map.getLayer('community-labels'))map.setLayoutProperty('community-labels','visibility','none');if(map.getLayer('community-points')){map.setPaintProperty('community-points','circle-opacity',0);map.setPaintProperty('community-points','circle-stroke-opacity',0)}if(!state.communityLayerEventsBound){state.communityLayerEventsBound=true;map.on('mousemove','psr-community-click',e=>{const f=e.features?.[0],id=f?.properties?.psrBoundaryId;if(!id)return;map.setFilter('psr-community-hover',['==',['get','psrBoundaryId'],id]);map.getCanvas().style.cursor='pointer'});map.on('mouseleave','psr-community-click',()=>{map.setFilter('psr-community-hover',['==',['get','psrBoundaryId'],'__none__']);map.getCanvas().style.cursor=''});map.on('click','psr-community-click',e=>{const block=['project-footprint-extrusions','project-hit','project-points','project-clusters','initiative-hit','initiative-points'].filter(id=>map.getLayer(id));if(block.length&&aeQueryAtPointer(e.point,block).length)return;const f=e.features?.[0];if(f)psrSelectCommunityFeature(f)})}return true}
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
function psrShowMasterTerritory(f){const p=f.properties||{},name=p.name||p.canonicalName||'Master development',s=psrTerritoryStats(name),detail=$('#detail-body');state.selected={id:p.territoryId||('master:'+psrSlug(name)),kind:'community',name,emirate:p.emirate||'Dubai',masterDevelopment:true};state.selectedSpatial={type:'master-development',id:p.territoryId||'',name};const render=()=>{const q=psrTerritoryStats(name);detail.innerHTML='<div class="detail-content"><span class="detail-badge">MASTER DEVELOPMENT</span><h2>'+esc(name)+'</h2><div class="detail-sub">'+esc([p.emirate,p.developer].filter(Boolean).join(' · '))+'</div><div class="detail-facts">'+detailFact('Projects',q.projects)+detailFact('Off-plan / future',q.offplan)+detailFact('Ready / completed',q.ready)+detailFact('On sale',q.onSale)+detailFact('Median project ask AED / sqft',q.askPsfMedian?psrFmtPsf(q.askPsfMedian):'—')+detailFact('Parent territory',p.parentTerritory||'—')+'</div><div class="detail-section"><h3>Territory</h3><p>Selected geometry is the verified master-development footprint, not the catalogue point. '+esc(p.boundarySource||'Verified spatial source')+' · confidence '+esc(p.boundaryConfidence||'reviewed')+'.</p></div></div>';return q};const first=render();$('#detail').classList.remove('hidden');psrApplyDockPadding(false);if(!first.projects){fetch('/map/map-data.json?v=20260929-collapse-repair-v3',{cache:'force-cache'}).then(r=>r.json()).then(j=>{if(state.selectedSpatial?.type!=='master-development'||state.selectedSpatial?.name!==name)return;const q=psrTerritoryStatsFromPool(name,j.projects||[]);detail.querySelector('.detail-content')&&(detail.innerHTML='<div class="detail-content"><span class="detail-badge">MASTER DEVELOPMENT</span><h2>'+esc(name)+'</h2><div class="detail-sub">'+esc([p.emirate,p.developer].filter(Boolean).join(' · '))+'</div><div class="detail-facts">'+detailFact('Projects',q.projects)+detailFact('Off-plan / future',q.offplan)+detailFact('Ready / completed',q.ready)+detailFact('On sale',q.onSale)+detailFact('Median project ask AED / sqft',q.askPsfMedian?psrFmtPsf(q.askPsfMedian):'—')+detailFact('Parent territory',p.parentTerritory||'—')+'</div><div class="detail-section"><h3>Territory</h3><p>Selected geometry is the verified master-development footprint, not the catalogue point. '+esc(p.boundarySource||'Verified spatial source')+' · confidence '+esc(p.boundaryConfidence||'reviewed')+'.</p></div></div>')}).catch(()=>{})};let tries=0;const tick=setInterval(()=>{tries++;if(state.selectedSpatial?.type!=='master-development'||state.selectedSpatial?.name!==name){clearInterval(tick);return}const q=psrTerritoryStats(name);if(q.projects){render();clearInterval(tick)}else if(tries>=18)clearInterval(tick)},350)}
function psrBestGeometryAt(point){const order=['project-footprint-extrusions','psr-official-building-hit','psr-master-territory-hit','psr-universal-community-hit','psr-official-district-fill','psr-universal-emirate-hit','project-points','project-fallback-points'].filter(id=>map.getLayer(id));for(const id of order){const fs=aeQueryAtPointer(point,[id])||[];if(fs.length)return {feature:fs[0],layerId:id}}return null}
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
const _psrBestGeometryAtV56=psrBestGeometryAt;psrBestGeometryAt=function(point){const order=['project-footprint-extrusions','psr-official-building-hit','psr-master-territory-hit','psr-universal-community-hit','psr-official-district-fill','psr-universal-emirate-hit','project-points','project-fallback-points'].filter(id=>map.getLayer(id));for(const id of order){const fs=aeQueryAtPointer(point,[id])||[];if(!fs.length)continue;return {feature:id==='psr-universal-community-hit'?psrChooseCommunityFeature(fs,point):fs[0],layerId:id}}return null};
const _psrRefreshSourcesV56=refreshSources;refreshSources=function(){_psrRefreshSourcesV56();setTimeout(psrReconcileCommunityPolygons,60)};
map.on('load',()=>setTimeout(psrReconcileCommunityPolygons,800));
/* ===== PSR native territory highlight v57 ===== */
function psrClearNativeTerritoryHighlight(){const none=['==',['get','territoryId'],'__none__'];for(const id of ['psr-master-native-hover-fill','psr-master-native-hover-line','psr-master-native-selected-fill','psr-master-native-selected-line'])if(map.getLayer(id))map.setFilter(id,none);const cnone=['==',['get','psrBoundaryId'],'__none__'];for(const id of ['psr-community-native-hover-fill','psr-community-native-hover-line','psr-community-native-selected-fill','psr-community-native-selected-line'])if(map.getLayer(id))map.setFilter(id,cnone)}
function psrApplyNativeHover(hit){for(const id of ['psr-master-native-hover-fill','psr-master-native-hover-line'])if(map.getLayer(id))map.setFilter(id,['==',['get','territoryId'],hit?.layerId==='psr-master-territory-hit'?(hit.feature.properties?.territoryId||'__none__'):'__none__']);for(const id of ['psr-community-native-hover-fill','psr-community-native-hover-line'])if(map.getLayer(id))map.setFilter(id,['==',['get','psrBoundaryId'],hit?.layerId==='psr-universal-community-hit'?(hit.feature.properties?.psrBoundaryId||'__none__'):'__none__'])}
function psrApplyNativeSelection(hit){for(const id of ['psr-master-native-selected-fill','psr-master-native-selected-line'])if(map.getLayer(id))map.setFilter(id,['==',['get','territoryId'],hit?.layerId==='psr-master-territory-hit'?(hit.feature.properties?.territoryId||'__none__'):'__none__']);for(const id of ['psr-community-native-selected-fill','psr-community-native-selected-line'])if(map.getLayer(id))map.setFilter(id,['==',['get','psrBoundaryId'],hit?.layerId==='psr-universal-community-hit'?(hit.feature.properties?.psrBoundaryId||'__none__'):'__none__'])}
function psrCommunityStatsFromPool(name,pool){const nk=norm(name),ps=(pool||[]).filter(p=>{const a=norm(p.area||'');return a===nk}),off=ps.filter(p=>p.timeline==='future'||/off.?plan|under construction|launch/i.test([p.masterStatus,p.status,p.statusLabel].filter(Boolean).join(' '))).length,ready=ps.filter(p=>p.timeline==='past'||/ready|complete|completed/i.test([p.masterStatus,p.status,p.statusLabel].filter(Boolean).join(' '))).length,on=ps.filter(p=>availabilityClass(p)==='on-sale').length,sold=ps.filter(p=>availabilityClass(p)==='sold-out').length,vals=ps.map(psrPricePsfValue).filter(Number.isFinite).sort((a,b)=>a-b);return {projects:ps.length,offplan:off,ready,onSale:on,soldOut:sold,askPsfMedian:vals.length?vals[Math.floor(vals.length/2)]:null}}
function psrRefreshBoundaryDetailFromSnapshot(f){const name=psrBoundaryName(f),p=f.properties||{};fetch('/map/map-data.json?v=20260929-collapse-repair-v3',{cache:'force-cache'}).then(r=>r.json()).then(j=>{if(state.selectedSpatial?.type!=='community'||state.selectedSpatial?.name!==name)return;const s=psrCommunityStatsFromPool(name,j.projects||[]),record=(j.communities||[]).find(c=>norm(c.name)===norm(name));const d=$('#detail-body');if(!d)return;d.innerHTML='<div class="detail-content"><span class="detail-badge">COMMUNITY</span><h2>'+esc(name)+'</h2><div class="detail-sub">Dubai · '+(record?'Catalogue community + mapped boundary':'Mapped boundary · catalogue join pending')+'</div><div class="detail-facts">'+detailFact('Projects',s.projects)+detailFact('Off-plan / future',s.offplan)+detailFact('Ready / completed',s.ready)+detailFact('On sale',s.onSale)+detailFact('Sold out',s.soldOut)+detailFact('Median project ask AED / sqft',s.askPsfMedian?psrFmtPsf(s.askPsfMedian):'—')+'</div><div class="detail-section"><h3>Boundary</h3><p>'+esc(p.geometrySource||p.boundarySource||'DLD-area / OpenStreetMap curated polygon')+'. The full polygon—not a centroid—is the selected territory.</p></div></div>'}).catch(()=>{})}
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

/* Espacios research layer. Catalogue facts, reference statistics and scenarios are separate. */
var AR = (() => {
  const VERSION='20260923-research-v4', CHECKED='2026-09-23';
  const urls={dubai:'https://www.bayut.com/mybayut/dubai-sales-market-report-h1-2026/',abu:'https://www.bayut.com/mybayut/abu-dhabi-sales-market-report-h1-2026/',binghatti:'https://www.binghatti.com/en-uk/area-guides/al-jaddaf',aldar:'https://www.aldar.com/ar/news-and-media/aldar-launches-first-homes-at-marsa-al-saadiyat-with-351-exclusive-villas-at-talay',rics:'https://www.rics.org/profession-standards/rics-standards-and-guidance/sector-standards/valuation-standards/comparable-evidence-in-real-estate-valuation',dcf:'https://www.rics.org/profession-standards/rics-standards-and-guidance/sector-standards/valuation-standards/discounted-cash-flow-valuation',iaao:'https://www.iaao.org/industry-data/iaao-technical-standards/'};
  const norm=v=>String(v??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();
  const number=v=>{if(v===null||v===undefined||v==='')return null;if(typeof v==='number')return Number.isFinite(v)?v:null;const t=String(v).replace(/,/g,'');if(/request|announce|confirm|contact|unknown|^na$/i.test(t))return null;const m=t.match(/(?:AED\s*)?(\d+(?:\.\d+)?)\s*(million|billion|[mkb])?\b/i);if(!m)return null;return Number(m[1])*({m:1e6,million:1e6,k:1e3,b:1e9,billion:1e9}[m[2]?.toLowerCase()]||1)};
  const median=a=>{a=a.filter(Number.isFinite).sort((a,b)=>a-b);const n=a.length;return n?(a[Math.floor((n-1)/2)]+a[Math.floor(n/2)])/2:null};
  const areaAliases={'jvt':'jumeirah village triangle','jumeirah village triangle jvt':'jumeirah village triangle','jvc':'jumeirah village circle','jumeirah village circle jvc':'jumeirah village circle','dso':'dubai silicon oasis','dubai silicon oasis dso':'dubai silicon oasis','palm jumeirah island':'palm jumeirah','damac hills 2 akoya by damac':'damac hills 2','al reem island abu dhabi emirate':'al reem island','saadiyat island abu dhabi emirate':'saadiyat island','yas island abu dhabi emirate':'yas island','al marjan island ras al khaimah emirate':'al marjan island','ras al khaimah al marjan island':'al marjan island','muwailih commercial':'muwaileh commercial','al belaida':'al belaida'};
  const area=v=>areaAliases[norm(v)]||norm(v);
  const devAliases={'emaar properties':'Emaar','aldar properties':'Aldar','damac properties':'DAMAC','binghatti developers':'Binghatti','sobha':'Sobha Realty','nakheel properties':'Nakheel','meraas holding':'Meraas','danube properties':'Danube','ellington properties':'Ellington','arada developments':'Arada','samana':'SAMANA Developers','azizi developments':'Azizi','al hamra group':'Al Hamra','al barari developers':'Al Barari'};
  const dev=v=>devAliases[norm(v)]||String(v||'Developer not recorded').trim();
  const rawBench=[
    ['Dubai','Palm Jumeirah','apartment',3529,4.48,6797332],['Dubai','Bluewaters Island','apartment',6091,5.01,11602791],['Dubai','Al Barari','apartment',2447,null,2390976],
    ['Dubai','Dubai Marina','apartment',2111,5.88,2397156],['Dubai','Downtown Dubai','apartment',3179,5.46,4085963],['Dubai','Dubai Hills Estate','apartment',2522,6.3,2391551],
    ['Dubai','Jumeirah Village Circle','apartment',1470,7.15,1077347],['Dubai','Business Bay','apartment',2124,6.29,2058595],['Dubai','Arjan','apartment',1517,7.1,970764],
    ['Dubai','Dubai Silicon Oasis','apartment',1086,8.23,862770],['Dubai','Dubai Sports City','apartment',1083,8.12,765716],['Dubai','Dubai South','apartment',1190,7.24,842220],
    ['Dubai','Palm Jumeirah','villa',6350,3.95,50216667],['Dubai','Al Barari','villa',3322,6.37,23457645],['Dubai','Jumeirah Islands','villa',3905,3.89,28243113],
    ['Dubai','Dubai Hills Estate','villa',2870,4.3,13673839],['Dubai','Arabian Ranches','villa',2184,3.87,9109706],['Dubai','Tilal Al Ghaf','villa',2282,5.27,9971848],
    ['Dubai','Al Furjan','villa',1677,4.56,5490707],['Dubai','DAMAC Lagoons','villa',1603,6.09,3391642],['Dubai','DAMAC Hills','villa',1876,4.95,5375973],
    ['Dubai','DAMAC Hills 2','villa',1072,null,1820589],['Dubai','Dubailand','villa',1609,5.23,2925169],['Dubai','Dubai South','villa',1368,4.92,3336891],
    ['Abu Dhabi','Saadiyat Island','apartment',3893,3.51,null],['Abu Dhabi','The Marina','apartment',2831,5.4,null],['Abu Dhabi','Al Raha Beach','apartment',1859,5.72,null],['Abu Dhabi','Yas Island','apartment',2393,5.94,null],['Abu Dhabi','Al Maryah Island','apartment',2707,5.94,null],['Abu Dhabi','Al Reem Island','apartment',1690,6.34,null],['Abu Dhabi','Masdar City','apartment',1781,7.63,null],['Abu Dhabi','Zayed City','apartment',1472,3.87,null],
    ['Abu Dhabi','Saadiyat Island','villa',2250,4.32,null],['Abu Dhabi','Yas Island','villa',1634,5,null],['Abu Dhabi','Al Raha Beach','villa',1418,5.11,null],['Abu Dhabi','Al Raha Gardens','villa',984,5.91,null],['Abu Dhabi','Al Samha','villa',1145,5.43,null],['Abu Dhabi','Al Muntazah','villa',1541,5.63,null],['Abu Dhabi','Al Shamkha','villa',768,5.29,null],['Abu Dhabi','Al Reef','villa',1070,5.92,null],['Abu Dhabi','Rabdan','villa',1315,5.26,null]
  ];
  const benchmarks=rawBench.map(([emirate,community,segment,askPsf,roi,averageTransactionValue])=>({id:norm(emirate+' '+community+' '+segment).replace(/ /g,'-'),emirate,community,segment,askPsf,roi,averageTransactionValue,period:'H1 2026',periodStart:'2026-01-01',periodEnd:'2026-06-30',checkedAt:CHECKED,sourceUrl:emirate==='Dubai'?urls.dubai:urls.abu,sourceLabel:'Bayut H1 2026 sales report',basis:'Published community/property-type advertised price benchmark; not a subject-property valuation',roiBasis:'Projected gross rental yield; not net total return',sampleSize:null,forecastTrainingApproved:false,conflict:roi===null?'ROI differs between sections of source report; withheld pending reconciliation':null}));
  function benchmark(c,segment='apartment'){return benchmarks.find(b=>norm(b.emirate)===norm(c.emirate)&&area(b.community)===area(c.name)&&b.segment===segment)||null}
  const corrections={
    'ashwood-residences-jvt-dubai':{developer:'Skyland Properties',area:'Jumeirah Village Triangle',sourceUrl:'https://skylandproperties.ae/ashwood-residences',sourceLabel:'Skyland official Ashwood page',evidence:'Official page identifies JVT and 151 apartments. Its Q4 2027 handover conflicts with May 2028 in the catalogue; both retained, not silently reconciled.',announcedUnits:151,scheduleConflict:{catalogue:'May 2028',officialPage:'Q4 2027',status:'confirmation_required'}},
    'binghatti-starfall-al-jaddaf-dubai':{developer:'Binghatti',area:'Al Jaddaf',sourceUrl:urls.binghatti,sourceLabel:'Binghatti official Al Jaddaf property guide',evidence:'Developer and locality confirmed in official property offers',offers:[{type:'Studio',priceAed:769999,sizeSqft:348},{type:'1 bedroom',priceAed:1249999,sizeSqft:625},{type:'2 bedrooms',priceAed:1974999,sizeSqft:855}]},
    'talay-marsa-al-saadiyat-aldar-abu-dhabi':{developer:'Aldar',area:'Saadiyat Island',sourceUrl:urls.aldar,sourceLabel:'Aldar newsroom, 17 September 2026',evidence:'Official announcement names Talay at Marsa Al Saadiyat; 351 villas',announcedUnits:351}
  };
  function corrected(r){const c=corrections[r.slug];if(!c)return{...r};const conflict=/^damac(?: properties)?$/.test(norm(r.rawDeveloper||r.developer))&&!/^damac/.test(norm(c.developer));const review=conflict?{rawPrice:r.rawPrice??r.price,rawPriceAed:r.rawPriceAed??r.priceAed??null,price:'Price confirmation required',priceAed:null,startingPrice:null,askingEvidenceStatus:'identity_conflict_requires_price_verification'}:{};return{...r,...review,rawDeveloper:r.rawDeveloper||r.developer,rawArea:r.rawArea||r.area,developer:c.developer,area:c.area,sourceUrl:c.sourceUrl,sourceLabel:c.sourceLabel,researchCorrection:{checkedAt:CHECKED,...c}}}
  function priceEvidence(r){const v=number(r.pricePerSqft??r.price_psf??r.psf),label=String(r.pricePerSqftLabel||'');if(!(v>0))return{value:null,basis:'not_recorded',subjectEligible:false};const basis=/wide average/i.test(label)?'emirate_benchmark':/area/i.test(label)?'area_benchmark':/indicative/i.test(label)?'indicative_unverified':'unverified_project_ask';return{value:v,label,basis,subjectEligible:false,reason:'Original feed lacks matched closed-sale evidence; do not interpret this number as a property valuation'}}
  function handover(v){const t=String(v||'');if(/confirm|announce|unknown|n\/a|request/i.test(t))return null;const y=t.match(/\b(20[2-9][0-9])\b/);if(!y)return null;const q=t.match(/\bQ([1-4])\b/i);return{year:Number(y[1]),quarter:q?Number(q[1]):null,raw:t,basis:'reported_schedule_not_completion_prediction'}}
  function matchCommunity(r,communities){let a=area(r.area),em=norm(r.emirate);const same=communities.filter(c=>norm(c.emirate)===em);let choices=same.filter(c=>area(c.name)===a);if(!choices.length){const without=String(r.area||'').replace(/,\s*(Dubai|Abu Dhabi|Sharjah|Ajman|Ras Al Khaimah|Fujairah|Umm Al Quwain)\s*$/i,'');choices=same.filter(c=>area(c.name)===area(without))}if(choices.length){return choices.sort((a,b)=>String(a.id).localeCompare(String(b.id)))[0]}return null}
  function build(cat,live={projects:[]}){
    const lm=new Map((live.projects||[]).filter(r=>r.slug).map(r=>[r.slug,r])),seen=new Set(),rows=[];
    for(const base of cat.projects||[]){const l=lm.get(base.slug)||{};seen.add(base.slug);const merged={...base,...l,id:base.id||'project:'+base.slug,kind:'project',name:l.name||l.title||base.name,coordinates:base.coordinates,coordinateBasis:base.coordinateBasis,archived:base.archived===true,sourceUrl:base.sourceUrl||l.sourceUrl||null,price:l.price||base.price};rows.push(corrected(merged))}
    for(const l of live.projects||[])if(l.slug&&!seen.has(l.slug)){seen.add(l.slug);rows.push(corrected({...l,id:'project:'+l.slug,name:l.name||l.title||l.slug,kind:'project',archived:false,coordinates:null,coordinateBasis:'No verified site coordinate supplied by live catalogue'}))}
    const communities=(cat.communities||[]).map(c=>({...c,projectIds:[],benchmarks:benchmarks.filter(b=>norm(b.emirate)===norm(c.emirate)&&area(b.community)===area(c.name)),scheduledProjectsByYear:{}}));
    const developerMap=new Map();
    const projects=rows.map(r=>{const c=matchCommunity(r,communities),h=handover(r.handover),name=dev(r.developer),key=norm(name),price=number(r.priceAed??r.startingPrice??r.price);const p={...r,communityId:c?.id||null,communityMatch:c?'exact_normalized_name':'unmatched_or_ambiguous',askingPriceAed:price>0?price:null,priceEvidence:priceEvidence(r),handoverWindow:h,developerId:'developer:'+key.replace(/ /g,'-'),forecast:{price:null,rent:null,status:'No calibrated project model'},sourceCheckedAt:r.researchCorrection?.checkedAt||null};
      if(c){c.projectIds.push(p.id);if(h&&h.year>=2026&&!p.archived)c.scheduledProjectsByYear[h.year]=(c.scheduledProjectsByYear[h.year]||0)+1}
      if(!developerMap.has(key))developerMap.set(key,{id:p.developerId,name,aliases:[],projectIds:[],emirates:[],communities:[],askingPriceCount:0,readyCatalogue:0,scheduledCatalogue:0,sourceUrls:[],verification:/^\d+$/.test(name)||name.length>65||/exclusive|only \d/i.test(name)?'name_needs_review':'catalogue_identity_not_legal_verification',deliveredLifetimeProjects:null,onTimeDeliveryRate:null});
      const d=developerMap.get(key);d.projectIds.push(p.id);d.aliases.push(r.developer);d.emirates.push(r.emirate);if(c)d.communities.push(c.name);if(p.askingPriceAed)d.askingPriceCount++;if(/ready|complete/i.test(r.statusLabel||r.status||''))d.readyCatalogue++;if(h)d.scheduledCatalogue++;if(r.sourceUrl)d.sourceUrls.push(r.sourceUrl);
      return p;
    });
    const developers=[...developerMap.values()].map(d=>({...d,aliases:[...new Set(d.aliases)],emirates:[...new Set(d.emirates)],communities:[...new Set(d.communities)],sourceUrls:[...new Set(d.sourceUrls)]})).sort((a,b)=>a.name.localeCompare(b.name));
    return{version:VERSION,asOf:new Date().toISOString(),counts:{projects:projects.length,developers:developers.length,developerNamesNeedingReview:developers.filter(d=>d.verification==='name_needs_review').length,rawDeveloperLabels:new Set(rows.map(r=>norm(r.rawDeveloper||r.developer))).size,communities:communities.length,initiatives:cat.initiatives?.length||0,liveProjects:live.projects?.length||0,pricedProjects:projects.filter(p=>p.askingPriceAed).length,benchmarks:benchmarks.length,matchedProjects:projects.filter(p=>p.communityId).length,projectPsfVerified:0},projects,communities,developers,benchmarks,sourceNote:'Catalogue project records and normalized developer-name groups; not a legal-entity census or individual dwelling-unit inventory. Original records retained.'}
  }
  function scenario(input){
    const required=['price','rent','vacancy','costs','buyCosts','sellCosts','rentGrowth','costGrowth','discount','exitCap','years'];
    const a={};for(const k of required){const v=input[k];if(v===''||v===null||v===undefined||!Number.isFinite(Number(v)))throw Error('Enter '+k);a[k]=Number(v)}
    if(a.price<=0||a.rent<0||a.costs<0||a.vacancy<0||a.vacancy>=100||a.buyCosts<0||a.buyCosts>100||a.sellCosts<0||a.sellCosts>=100||a.exitCap<=0||a.exitCap>100||a.discount<=-100||a.rentGrowth<=-100||a.costGrowth<=-100||a.years<1||a.years>30||!Number.isInteger(a.years))throw Error('Inputs outside valid range');
    const initial=a.price*(1+a.buyCosts/100),noi1=a.rent*(1-a.vacancy/100)-a.costs,cash=[];let pv=0;
    for(let y=1;y<=a.years;y++){const noi=a.rent*(1+a.rentGrowth/100)**(y-1)*(1-a.vacancy/100)-a.costs*(1+a.costGrowth/100)**(y-1);cash.push(noi);pv+=noi/(1+a.discount/100)**y}
    const exitNoi=a.rent*(1+a.rentGrowth/100)**a.years*(1-a.vacancy/100)-a.costs*(1+a.costGrowth/100)**a.years;
    if(exitNoi<=0)throw Error('Exit NOI must be positive for income capitalisation');
    const grossExit=exitNoi/(a.exitCap/100),netExit=grossExit*(1-a.sellCosts/100);pv+=netExit/(1+a.discount/100)**a.years;
    const flows=[-initial,...cash];flows[flows.length-1]+=netExit;const npv=r=>flows.reduce((s,v,i)=>s+v/(1+r)**i,0);let lo=-.95,hi=5,irr=null;if(flows.slice(1).every(v=>v>=0)&&npv(lo)*npv(hi)<0){for(let i=0;i<100;i++){const m=(lo+hi)/2;if(npv(m)>0)lo=m;else hi=m}irr=(lo+hi)/2*100}
    return{basis:'User-entered unlevered investment scenario, not market value or a forecast',grossYield:100*a.rent/a.price,netYieldOnCost:100*noi1/initial,yearOneNoi:noi1,discountedValue:pv,npv:pv-initial,irr,netExit,totalReturnPct:100*(cash.reduce((s,v)=>s+v,0)+netExit-initial)/initial,cashflows:cash,assumptions:a};
  }
  function comps(subject,projects){const types=r=>(r.propertyTypes||[]).map(norm);return projects.filter(p=>p.id!==subject.id&&subject.communityId&&p.communityId===subject.communityId&&p.archived===subject.archived&&(!types(subject).length||types(p).some(t=>types(subject).includes(t)))).slice(0,6).map(p=>({id:p.id,name:p.name,askingPriceAed:p.askingPriceAed,developer:p.developer,sourceUrl:p.sourceUrl,updatedAt:p.updatedAt||null,basis:'Unadjusted catalogue asking reference; not a completed comparable sale'}))}
  return {VERSION,CHECKED,urls,norm,number,median,area,dev,benchmarks,benchmark,corrections,corrected,priceEvidence,handover,matchCommunity,build,scenario,comps};
})();

/* Appended to the existing MapLibre module: retains pointer fix and existing controls. */
document.documentElement.dataset.arUi=AR.VERSION;
const arState={catalogue:null,byId:new Map(),segment:'apartment',scope:'community',market:null,marketPromise:null,timer:0,hydrated:false};
const arFmt=(v,suffix='')=>v===null||v===undefined||!Number.isFinite(Number(v))?'Not recorded':Number(v).toLocaleString(undefined,{maximumFractionDigits:2})+suffix;
const arAed=v=>v===null||v===undefined?'Not recorded':'AED '+arFmt(v);
const arOwned=new Set(['price-psf','roi-apartment','roi-villa','avg-transaction','volume','transaction-value','projects','active','future','developers']);
const arOldPsf=psrPricePsfValue;
psrPricePsfValue=function(r){if(r?.kind==='unit')return arOldPsf(r);return null};
psrFmtPsf=function(v){return v===null||v===undefined?'Not recorded':'AED '+arFmt(v)+' / sqft'};
function arFind(r){return arState.byId.get(r?.id)||arState.catalogue?.projects.find(p=>p.slug===r?.slug)||null}
function arSchedule(){clearTimeout(arState.timer);arState.timer=setTimeout(arRebuild,180)}
const arOldIndex=rebuildIndexes;
rebuildIndexes=function(){for(const r of state.projects||[])if(AR.corrections[r.slug])Object.assign(r,AR.corrected(r));arOldIndex();arSchedule()};
function arRebuild(){
 if(!state.projects?.length)return;
 arState.catalogue=arState.canonical||AR.build({projects:state.projects,communities:state.communities,initiatives:state.initiatives},{projects:state.siteProjects||[]});arState.byId=new Map(arState.catalogue.projects.map(p=>[p.id,p]));
 if(!arState.booted)setTimeout(arBoot,100);arSetup();arSummary();document.querySelector('#analysis-note')&&(document.querySelector('#analysis-note').textContent='Area asking-price benchmarks by default. Missing evidence remains uncoloured.');if(arOwned.has(state.analysisMetric))arPaint(state.analysisMetric);if(state.selected)arDossier(state.selected);
 window.__ESPACIOS_RESEARCH__={version:AR.VERSION,counts:arState.catalogue.counts,ready:!!arState.canonical,metric:state.analysisMetric,basis:'catalogue_and_sourced_area_benchmarks',coverage:()=>arCoverage()};
}
async function arMarket(){if(arState.market)return arState.market;if(arState.marketPromise)return arState.marketPromise;arState.marketPromise=fetch('/map/api/research-market?v='+AR.VERSION).then(r=>{if(!r.ok)throw Error('Market observations unavailable');return r.json()}).then(d=>{arState.market=d;return d}).catch(e=>{arState.marketPromise=null;throw e});return arState.marketPromise}
function arMetric(c,metric){
 const bench=AR.benchmark(c,metric==='roi-villa'?'villa':metric==='roi-apartment'?'apartment':arState.segment),rows=arState.catalogue?.projects||[],projects=c.projectIds||rows.filter(p=>p.communityId===c.id).map(p=>p.id);
 if(metric==='price-psf')return bench?.askPsf??null;
 if(metric==='roi-apartment'||metric==='roi-villa')return bench?.roi??null;
 if(metric==='avg-transaction')return bench?.averageTransactionValue??null;
 if(metric==='projects')return projects.length;
 if(metric==='active')return projects.filter(id=>!arState.byId.get(id)?.archived).length;
 if(metric==='future')return projects.filter(id=>arState.byId.get(id)?.timeline==='future').length;
 if(metric==='developers')return new Set(projects.map(id=>arState.byId.get(id)?.developerId).filter(Boolean)).size;
 if(metric==='volume'||metric==='transaction-value'){
  const key=arState.scope==='emirate'?(metric==='volume'?'sales_count':'transaction_value_aed'):(metric==='volume'?'community_sales_count':'community_sales_value_aed');
  const obs=(arState.market?.observations||[]).filter(o=>o.scope_type===arState.scope&&o.metric_key===key&&o.period_start==='2026-01-01'&&o.period_end==='2026-06-30'&&AR.area(o.scope_label)===AR.area(c.name));
  if(obs.length===1)return Number(obs[0].value_numeric);return null;
 }
 return null;
}
function arGeographies(){const cs=arState.catalogue?.communities||[];if(arState.scope!=='emirate')return cs;const out=new Map();for(const c of cs){if(!out.has(c.emirate))out.set(c.emirate,{id:'emirate:'+AR.norm(c.emirate).replace(/ /g,'-'),name:c.emirate,emirate:c.emirate,projectIds:[]});out.get(c.emirate).projectIds.push(...c.projectIds)}const centers={'Dubai':[55.27,25.2],'Abu Dhabi':[54.4,24.45],'Sharjah':[55.42,25.34],'Ajman':[55.51,25.4],'Ras Al Khaimah':[55.95,25.79],'Fujairah':[56.34,25.12],'Umm Al Quwain':[55.56,25.56]};return [...out.values()].map(c=>({...c,coordinates:centers[c.name]?{lng:centers[c.name][0],lat:centers[c.name][1]}:null}))}
function arCoverage(){const gs=arGeographies(),metric=state.analysisMetric||'price-psf';return{metric,scope:arState.scope,segment:arState.segment,total:gs.length,withData:gs.filter(c=>arMetric(c,metric)!==null).length,period:'H1 2026'}}
function arLabel(metric){return({'price-psf':'AED / sqft · area asking benchmarks','roi-apartment':'Apartment projected gross rental yield','roi-villa':'Villa projected gross rental yield','avg-transaction':'Average transaction amount · reported reference','volume':'Sales volume · recorded sales count','transaction-value':arState.scope==='emirate'?'Transaction value · AED':'Community sales value · AED','projects':'Catalogue project count','active':'Active catalogue projects','future':'Future catalogue projects','developers':'Recorded developer groups'})[metric]||'Map analysis'}
const arColors=['#739bbb','#58bbaa','#efb25b','#b96371'];
function arPaint(metric){
 if(!arState.catalogue||!map.getStyle()?.layers)return;
 for(const id of ['psr-analysis-heat','psr-community-analysis','psr-emirate-analysis','roi-heat','roi-points','roi-labels'])if(map.getLayer(id))map.setLayoutProperty(id,'visibility','none');
 const dedupe=new Set(),records=arGeographies().filter(c=>{const k=AR.norm(c.emirate)+'|'+AR.area(c.name);if(dedupe.has(k))return false;dedupe.add(k);return true});
 const values=records.map(c=>arMetric(c,metric)).filter(v=>v!==null&&Number.isFinite(v)).sort((a,b)=>a-b),thresholds=[.25,.5,.75].map(q=>values.length?values[Math.floor((values.length-1)*q)]:0);
 const color=v=>v===null?'#8896a6':v<=thresholds[0]?arColors[0]:v<=thresholds[1]?arColors[1]:v<=thresholds[2]?arColors[2]:arColors[3];
 const features=records.map(c=>{const xy=coordsOf(c);if(!xy||!xy.every(Number.isFinite))return null;const v=arMetric(c,metric);return{type:'Feature',geometry:{type:'Point',coordinates:xy},properties:{id:c.id,name:c.name,value:v,known:v!==null,color:color(v),label:v===null?'':metric.startsWith('roi')?arFmt(v)+'%':arFmt(v)}}}).filter(Boolean);
 const source='ar-metric-points';if(!map.getSource(source))map.addSource(source,{type:'geojson',data:fc([])});map.getSource(source).setData(fc(features));
 if(!map.getLayer('ar-metric-circles'))map.addLayer({id:'ar-metric-circles',type:'circle',source,paint:{'circle-radius':['interpolate',['linear'],['zoom'],5,12,10,21,15,28],'circle-color':['get','color'],'circle-opacity':['case',['get','known'],.52,.08],'circle-stroke-width':['case',['get','known'],1.5,.4],'circle-stroke-color':['get','color']}},map.getLayer('project-hit')?'project-hit':undefined);
 if(!map.getLayer('ar-metric-labels'))map.addLayer({id:'ar-metric-labels',type:'symbol',source,minzoom:8,filter:['==',['get','known'],true],layout:{'text-field':['get','label'],'text-size':11,'text-offset':[0,2.2],'text-allow-overlap':false},paint:{'text-color':document.documentElement.dataset.espaciosTheme==='light'?'#1b2940':'#f3f6fc','text-halo-color':document.documentElement.dataset.espaciosTheme==='light'?'#ffffff':'#152030','text-halo-width':1.5}});
 const polys=state.spatial?.dubaiPolygonData?.features||[],byId=new Map(features.map(f=>[f.properties.id,f.properties])),byName=new Map(records.map(c=>[AR.area(c.name),c]));
 const pf=arState.scope==='community'?polys.map(f=>{const p=f.properties||{},c=byName.get(AR.area(p.psrName||p.name||p.NAME_EN||p.community||'')),m=byId.get(p.psrId)||byId.get(c?.id);return m?.known?{...f,properties:{...p,arColor:m.color}}:null}).filter(Boolean):[];
 if(!map.getSource('ar-metric-polygons'))map.addSource('ar-metric-polygons',{type:'geojson',data:fc([])});map.getSource('ar-metric-polygons').setData(fc(pf));
 if(!map.getLayer('ar-metric-fill'))map.addLayer({id:'ar-metric-fill',type:'fill',source:'ar-metric-polygons',paint:{'fill-color':['get','arColor'],'fill-opacity':.25}},map.getLayer('project-hit')?'project-hit':undefined);
 for(const id of ['ar-metric-circles','ar-metric-labels','ar-metric-fill'])map.setLayoutProperty(id,'visibility','visible');
 let leg=document.querySelector('#ar-map-legend');if(!leg){leg=document.createElement('aside');leg.id='ar-map-legend';leg.setAttribute('aria-live','polite');document.querySelector('#app').append(leg)}leg.hidden=false;
 const suffix=metric.startsWith('roi')?'%':metric==='volume'||['projects','active','future','developers'].includes(metric)?'':' AED';
 leg.innerHTML='<strong>'+esc(arLabel(metric))+'</strong><small>'+esc(arState.scope==='community'?arState.segment+' segment · community-level':'Emirate-level totals')+'</small><div class="ar-ramp"></div><div>'+esc(values.length?arFmt(values[0])+suffix+' — '+arFmt(values.at(-1))+suffix:'No comparable observations for this selection')+'</div><small>'+values.length+' / '+records.length+' mapped '+(arState.scope==='community'?'areas':'emirates')+' with data. Grey = not reported.</small><small>'+(['projects','active','future','developers'].includes(metric)?'Current catalogue only; not full-market supply.':'H1 2026 reference · no interpolation into uncovered areas.')+'</small>';
 const box=document.querySelector('#ar-coverage');if(box){box.innerHTML='<h3>'+esc(arLabel(metric))+'</h3><p>'+esc(values.length+' of '+records.length+' mapped areas have a value for this metric.')+'</p><p>'+(['price-psf','roi-apartment','roi-villa','avg-transaction'].includes(metric)?'Published community benchmarks, not prices or returns for each building. Apartment and villa records are kept separate.':'Sales volume counts recorded sales. Transaction value measures AED, not the number of properties in the catalogue.')+'</p><a href="/map/research">Open all property and developer profiles</a>'}
 if(window.__ESPACIOS_RESEARCH__)window.__ESPACIOS_RESEARCH__.metric=metric;
}
const arOldAnalysis=psrSetAnalysis;
psrSetAnalysis=function(metric){const own=arOwned.has(metric);if(!own){arOldAnalysis(metric)}else{state.analysisMetric=metric;const sel=document.querySelector('#analysis-metric');if(sel)sel.value=metric;for(const id of ['ae-emerging-hotspots-glow','ae-emerging-hotspots-core','ae-emerging-hotspots-label'])if(map.getLayer(id))map.setLayoutProperty(id,'visibility','none')}for(const id of ['ar-metric-circles','ar-metric-labels','ar-metric-fill'])if(map.getLayer(id))map.setLayoutProperty(id,'visibility',own?'visible':'none');const l=document.querySelector('#ar-map-legend');if(l)l.hidden=!own;if(own){if(['volume','transaction-value'].includes(metric))arMarket().then(()=>{if(arOwned.has(state.analysisMetric))arPaint(state.analysisMetric)}).catch(()=>{const x=document.querySelector('#ar-coverage');if(x)x.textContent='Market evidence unavailable. Existing catalogue retained.'});arPaint(metric)}};
function arSummary(){const el=document.querySelector('#ar-summary');if(!el||!arState.catalogue)return;const c=arState.catalogue.counts;el.innerHTML='<h3>Current inventory</h3><div class="ar-grid"><div class="ar-kpi"><span>Project records</span><strong>'+arFmt(c.projects)+'</strong></div><div class="ar-kpi"><span>Developer-name groups</span><strong>'+arFmt(c.developers)+'</strong></div><div class="ar-kpi"><span>Catalogue communities</span><strong>'+arFmt(c.communities)+'</strong></div><div class="ar-kpi"><span>With an asking amount</span><strong>'+arFmt(c.pricedProjects)+'</strong></div></div><p>'+c.developerNamesNeedingReview+' developer labels need review. Counts describe catalogue records, not individual homes or verified legal companies.</p><a href="/map/research">Explore the full registry and data gaps</a>'}
function arDossier(record){
 const p=arFind(record),community=record?.kind==='community'?arState.catalogue?.communities.find(c=>c.id===record.id):arState.catalogue?.communities.find(c=>c.id===p?.communityId);
 const target=document.querySelector('#detail-body .detail-content')||document.querySelector('#detail-body');if(!target)return;document.querySelector('#ar-dossier')?.remove();if(!p&&!community)return;
 const box=document.createElement('section');box.id='ar-dossier';box.className='ar-block';const benches=community?.benchmarks||[];
 let html='<h3>Evidence & market context</h3>';
 if(p){html+='<div class="ar-row"><span>Recorded developer</span><b>'+esc(p.developer)+'</b></div><div class="ar-row"><span>Advertised from</span><b>'+esc(arAed(p.askingPriceAed))+'</b></div><div class="ar-row"><span>Property-specific AED / sqft</span><b>Not verified</b></div>';
  if(p.priceEvidence.value)html+='<p>Feed reference: AED '+esc(arFmt(p.priceEvidence.value))+' / sqft — '+esc(p.priceEvidence.label||p.priceEvidence.basis)+'. Not a subject-property price.</p>';
  if(p.askingEvidenceStatus)html+='<p>Catalogue price held pending verification because developer metadata conflicted. Original values remain in the research record.</p>';
  if(p.researchCorrection)html+='<p>Source correction applied; original developer and area retained in the research record.</p><a target="_blank" rel="noopener" href="'+esc(p.sourceUrl)+'">'+esc(p.sourceLabel)+'</a>';
  if(p.researchCorrection?.offers)html+='<h3 style="margin-top:14px!important">Official advertised unit-type offers</h3>'+p.researchCorrection.offers.map(o=>'<div class="ar-row"><span>'+esc(o.type)+' · '+o.sizeSqft+' sqft</span><b>'+esc(arAed(o.priceAed))+'</b></div>').join('')+'<p>Offer-type examples, not confirmed unit availability or completed sales.</p>';
 }
 if(benches.length)html+='<h3 style="margin-top:14px!important">'+esc(community.name)+' · H1 2026</h3>'+benches.map(b=>'<div class="ar-row"><span>'+esc(b.segment)+' asking benchmark</span><b>AED '+esc(arFmt(b.askPsf))+' / sqft</b></div><div class="ar-row"><span>Projected gross rental yield</span><b>'+esc(arFmt(b.roi,'%'))+'</b></div>'+(b.conflict?'<p>'+esc(b.conflict)+'</p>':'')+'<a href="'+esc(b.sourceUrl)+'" target="_blank" rel="noopener">Source and reporting basis</a>').join('');else html+='<p>No verified matched area benchmark for this selection. No emirate average has been substituted.</p>';
 if(p){const refs=AR.comps(p,arState.catalogue.projects);html+='<h3 style="margin-top:14px!important">Comparable candidates</h3><p>Same normalized community, compatible property type and archive state. Unadjusted asking references, not closed-sale valuations.</p>'+refs.map(c=>'<div class="ar-row"><button data-ar-open="'+esc(c.id)+'">'+esc(c.name)+'</button><b>'+esc(arAed(c.askingPriceAed))+'</b></div>').join('');if(!refs.length)html+='<p>No qualifying catalogue candidates.</p>'}
 html+='<p>Price/rent forecast: insufficient calibrated transaction history. Use explicit cash-flow scenarios in Value; scenario outputs are not forecasts.</p><a href="/map/research">Full record, developer portfolio and source coverage</a>';box.innerHTML=html;target.append(box);box.querySelectorAll('[data-ar-open]').forEach(b=>b.onclick=()=>{const r=state.recordById.get(b.dataset.arOpen);if(r)showDetail(r)})
}
const arOldDetail=showDetail;showDetail=function(r){arOldDetail(r);arDossier(r);arForecastContext(r)};
function arForecastContext(r){const x=document.querySelector('#ar-forecast-context');if(!x||!arState.catalogue)return;const p=arFind(r),c=r?.kind==='community'?arState.catalogue.communities.find(c=>c.id===r.id):arState.catalogue.communities.find(c=>c.id===p?.communityId);const rows=c?arState.catalogue.projects.filter(p=>p.communityId===c.id):[];const h={};for(const p of rows)if(p.handoverWindow&&p.handoverWindow.year>=2026&&!p.archived)h[p.handoverWindow.year]=(h[p.handoverWindow.year]||0)+1;x.innerHTML='<h3>'+esc(c?.name||r?.name||'Choose a community')+'</h3><p>'+rows.length+' matched project records. Reported handover pipeline, not predicted units:</p>'+Object.entries(h).map(([y,n])=>'<div class="ar-row"><span>'+y+'</span><b>'+n+' projects</b></div>').join('')+'<p>12 / 24 / 36-month price and rent estimates require compatible closed-sale/rent histories. Missing observations are not treated as zero.</p><a href="/map/intelligence">Inspect model readiness and sources</a>'}
function arScenarioHTML(){const inputs=[['price','Acquisition price · AED',''],['rent','Annual rent · AED',''],['vacancy','Vacancy · %',''],['costs','Annual operating costs · AED',''],['buyCosts','Acquisition costs · %',0],['sellCosts','Exit costs · %',0],['rentGrowth','Annual rent growth · %',0],['costGrowth','Annual cost growth · %',0],['discount','Discount rate · %',''],['exitCap','Exit capitalisation rate · %',''],['years','Holding period · years',3]];return '<h3>Cash-flow & yield scenario</h3><p>Your inputs, not predicted market facts. Unlevered, before tax. Enter all costs; zero defaults are assumptions, not fee quotes.</p><form class="ar-scenario"><div class="ar-grid">'+inputs.map(([key,label,val])=>'<label>'+label+'<input name="'+key+'" type="number" step="any" value="'+val+'" required></label>').join('')+'</div><button class="ar-action" type="submit">Calculate scenario</button></form><div class="ar-results" aria-live="polite"></div>'}
function arSetup(){
 if(document.querySelector('#ar-summary'))return;
 for(const [id,title] of [['valuation-panel','Property valuation'],['transport-panel','Transport & infrastructure']]){const h=document.querySelector('#'+id+' h2');if(h)h.textContent=title}
 const select=document.querySelector('#analysis-metric');if(select){const opts=[['price-psf','AED / sqft · area asking benchmark'],['roi-apartment','ROI · apartment gross rental yield'],['roi-villa','ROI · villa gross rental yield'],['avg-transaction','Average transaction amount'],['volume','Volume · recorded sales count'],['transaction-value','Transaction / sales value · AED'],['projects','Catalogue project count'],['active','Active catalogue projects'],['future','Reported future pipeline'],['developers','Developer-name groups'],['off','Off — neutral map']];for(const [value,label] of opts){let o=[...select.options].find(o=>o.value===value);if(!o){o=document.createElement('option');o.value=value;select.append(o)}o.textContent=label}const first=[...select.options].find(o=>o.value==='price-psf');if(first)select.prepend(first)}
 const heat=document.querySelector('#analysis-heat-view');if(heat){const controls=document.createElement('div');controls.className='ar-controls';controls.innerHTML='<label>Property segment<select id="ar-segment"><option value="apartment">Apartments</option><option value="villa">Villas</option></select></label><label>Geographic level<select id="ar-scope"><option value="community">Communities</option><option value="emirate">Emirates · recorded totals only</option></select></label><div class="ar-block" id="ar-coverage"></div><div class="ar-block" id="ar-summary"></div>';heat.append(controls);controls.querySelector('#ar-segment').onchange=e=>{arState.segment=e.target.value;arPaint(state.analysisMetric)};controls.querySelector('#ar-scope').onchange=e=>{arState.scope=e.target.value;arPaint(state.analysisMetric)}}
 const forecast=document.querySelector('#analysis-forecast-view');if(forecast){const box=document.createElement('div');box.className='ar-block';box.innerHTML='<h3>Community outlook</h3><div class="ar-controls"><label>Choose any catalogue community<select id="ar-forecast-community"><option value="">Select community</option>'+arState.catalogue.communities.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.emirate+' · '+c.name)+'</option>').join('')+'</select></label></div><div id="ar-forecast-context"></div>';forecast.append(box);box.querySelector('select').onchange=e=>{const c=state.recordById.get(e.target.value)||state.communities.find(c=>c.id===e.target.value);if(c){state.selected=c;state.selectedSpatial={type:'community',name:c.name,id:c.id};arForecastContext(c);psrRenderMarketForecastFast()}}}
 const val=document.querySelector('#valuation-panel');if(val){const scenario=document.createElement('section');scenario.className='ar-block';scenario.id='ar-scenario';scenario.innerHTML=arScenarioHTML();val.append(scenario);scenario.querySelector('form').onsubmit=e=>{e.preventDefault();const input=Object.fromEntries(new FormData(e.target)),result=scenario.querySelector('.ar-results');try{const s=AR.scenario(input);result.innerHTML='<h3 style="margin-top:14px!important">Scenario result — not a forecast</h3>'+[['Gross rental yield',arFmt(s.grossYield,'%')],['Net yield on acquisition cost',arFmt(s.netYieldOnCost,'%')],['Year-one net operating income',arAed(s.yearOneNoi)],['Discounted investment value',arAed(s.discountedValue)],['NPV after acquisition costs',arAed(s.npv)],['Unlevered IRR',arFmt(s.irr,'%')],['Net terminal proceeds',arAed(s.netExit)]].map(([a,b])=>'<div class="ar-row"><span>'+a+'</span><b>'+esc(b)+'</b></div>').join('')+'<h3 style="margin-top:14px!important">Rent sensitivity</h3>'+[-10,0,10].map(shock=>{const v=AR.scenario({...input,rent:Number(input.rent)*(1+shock/100)});return'<div class="ar-row"><span>Rent '+(shock>0?'+':'')+shock+'%</span><b>NPV '+esc(arAed(v.npv))+'</b></div>'}).join('')+'<p>Terminal value uses following-year NOI divided by your exit cap rate. Sensitivities are hypothetical shocks, not probabilities.</p>'}catch(err){result.textContent=err.message}};
 const methods=document.createElement('section');methods.className='ar-block';methods.innerHTML='<h3>Method & evidence</h3><p>Comparable screening separates completed sales from advertised offers. This catalogue has asking references; it does not supply verified closed-sale comparables for a market valuation.</p><p>Income analysis explicitly models vacancy, operating costs, growth, transaction costs and exit assumptions. Property AVMs, repeat-sales indices and causal infrastructure premiums require separate fitted models and holdout validation; they are not claimed as deployed here.</p><a href="'+AR.urls.rics+'" target="_blank" rel="noopener">RICS comparable evidence · current first edition</a><br><a href="'+AR.urls.dcf+'" target="_blank" rel="noopener">RICS discounted cash-flow guidance</a><br><a href="'+AR.urls.iaao+'" target="_blank" rel="noopener">IAAO model-validation standards</a><p><a href="/map/research">Property & developer registry</a></p>';val.append(methods)}
}
async function arHydrate(){if(arState.hydrated)return;arState.hydrated=true;try{const r=await fetch('/map/api/projects-all?research='+AR.VERSION);if(!r.ok)throw Error('Live inventory unavailable');const d=await r.json();if(!Array.isArray(d.projects)||d.projects.length!==Number(d.total))throw Error('Partial live inventory; previous complete catalogue preserved');const cr=await fetch('/map/api/research?v='+AR.VERSION);if(!cr.ok)throw Error('Canonical research records unavailable');const canonical=await cr.json();if(!canonical.upstream?.complete||canonical.counts?.liveProjects!==d.projects.length)throw Error('Catalogue versions differ; retry required');arState.canonical=canonical;state.siteProjects=d.projects;state.projects=mergeSiteIntoMap(state.mapData.projects||[],state.siteProjects,state.communities);applyProjectLocationCorrections(state.projects);attachVerification(state.projects);applyExactVerificationCoordinates(state.projects);attachMasterAvailability(state.projects);injectMasterOnlyProjects(state.projects);annotateLocationQuality(state.projects);rebuildIndexes();refreshSources();arRebuild();const slug=new URL(location.href).searchParams.get('project');if(slug){const found=state.projects.find(p=>p.slug===slug);if(found)showDetail(found)}}catch(e){console.warn('Espacios inventory',e.message);arRebuild()}}
function arBoot(){if(arState.booted||!state.projects?.length)return;arState.booted=true;setTimeout(arHydrate,250);arRebuild();state.analysisMetric='price-psf';try{psrSetAnalysis('price-psf')}catch(e){console.warn('Espacios first paint',e.message);setTimeout(()=>{if(arOwned.has(state.analysisMetric))arPaint(state.analysisMetric)},600)}}
map.on('load',()=>setTimeout(arBoot,700));setTimeout(arBoot,1000);
new MutationObserver(()=>{if(arOwned.has(state.analysisMetric))setTimeout(()=>arPaint(state.analysisMetric),80)}).observe(document.documentElement,{attributes:true,attributeFilter:['data-espacios-theme']});

/* Pure, descriptive aggregation. No observations, forecasts, or source records are altered. */
var AX = (() => {
  const VERSION='20260923-alltypes-v1';
  const labels={apartment:'Apartments',villa:'Villas',townhouse:'Townhouses',penthouse:'Penthouses',duplex:'Duplexes',office:'Offices',retail:'Retail',warehouse:'Warehouses / industrial',land:'Land / plots',hotel:'Hotels',hotel_apartment:'Hotel / serviced apartments',commercial:'Other commercial',mixed:'Mixed use',other:'Other recorded types',unknown:'Unclassified'};
  const norm=v=>String(v??'').toLowerCase().replace(/[_-]/g,' ').replace(/\s+/g,' ').trim();
  function typeKey(v){const s=norm(v);if(!s)return 'unknown';if(/hotel apartment|serviced apartment/.test(s))return 'hotel_apartment';if(/penthouse/.test(s))return 'penthouse';if(/town\s?house|townhome/.test(s))return 'townhouse';if(/duplex/.test(s))return 'duplex';if(/apartment|flat|studio/.test(s))return 'apartment';if(/villa/.test(s))return 'villa';if(/office/.test(s))return 'office';if(/retail|shop|showroom/.test(s))return 'retail';if(/warehouse|industrial|factory/.test(s))return 'warehouse';if(/land|plot/.test(s))return 'land';if(/hotel|resort/.test(s))return 'hotel';if(/mixed/.test(s))return 'mixed';if(/commercial/.test(s))return 'commercial';return 'other'}
  function types(p){const a=Array.isArray(p?.propertyTypes)?p.propertyTypes:[p?.propertyTypes||p?.property_type];return [...new Set(a.filter(Boolean).map(typeKey))].length?[...new Set(a.filter(Boolean).map(typeKey))]:['unknown']}
  const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
  const median=a=>{a=a.filter(finite).map(Number).sort((a,b)=>a-b);return a.length?(a[(a.length-1)>>1]+a[a.length>>1])/2:null};
  function selected(segment,custom=[]){return segment==='all'?null:new Set(segment==='custom'?custom:[segment])}
  function matches(p,segment,custom){const s=selected(segment,custom);return !s||types(p).some(t=>s.has(t))}
  function summarize(rows,field,segment='all',custom=[],aggregation='median'){
    const requested=selected(segment,custom);const relevant=rows.filter(r=>!requested||requested.has(typeKey(r.segment)));
    const missingTypes=[...new Set(relevant.filter(r=>!finite(r[field])).map(r=>typeKey(r.segment)))];
    const eligible=relevant.filter(r=>finite(r[field])&&Number(r[field])>=0&&(field!=='askPsf'||Number(r[field])>0));
    const buckets=new Map();for(const r of eligible){const k=[norm(r.emirate),norm(r.community),typeKey(r.segment),r.periodStart||r.period,r.periodEnd||''].join('|');if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(r)}
    const unique=[],conflicts=[];for(const [k,a] of buckets){if(new Set(a.map(r=>Number(r[field]))).size>1){conflicts.push(k);continue}unique.push(a[0])}
    const periods=[...new Set(unique.map(r=>[r.periodStart||r.period,r.periodEnd||''].join('|')))];
    const base={value:null,low:null,high:null,rows:[],types:[],count:0,missingTypes,conflicts,aggregation,period:null,basis:'Available source benchmarks; not a transaction-weighted market average'};
    if(periods.length>1)return {...base,reason:'Reporting periods differ; no blended value is published.'};
    if(!unique.length)return {...base,reason:segment==='custom'&&!custom.length?'Choose one or more types.':'No sourced benchmark for the selected property types.'};
    const values=unique.map(r=>Number(r[field])).sort((a,b)=>a-b);const value=aggregation==='low'?values[0]:aggregation==='high'?values.at(-1):median(values);
    return {...base,value,low:values[0],high:values.at(-1),rows:unique,types:[...new Set(unique.map(r=>typeKey(r.segment)))],count:unique.length,period:unique[0].period||periods[0],reason:null};
  }
  function csvCell(v){let s=v===null||v===undefined?'':String(v);if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  return{VERSION,labels,typeKey,types,finite,median,selected,matches,summarize,csvCell};
})();

/* Additive heatmap controls; preserves research, forecast, comparison, AI and legacy layers. */
const axState={aggregation:'median',custom:['apartment','villa'],memo:new Map(),inspected:null,paintToken:0};
arState.segment='all';
const axBenchmarkMetrics=new Set(['price-psf','roi','roi-apartment','roi-villa','avg-transaction']);
const axTotals=new Set(['volume','transaction-value','transaction-count']);
const axCountMetrics=new Set(['projects','active','future','developers']);
arOwned.add('roi');arOwned.add('transaction-count');
const axTypesLabel=s=>s==='all'?'All property types':s==='custom'?(axState.custom.map(t=>AX.labels[t]||t).join(' + ')||'No types selected'):(AX.labels[s]||s);
const axModeLabel=()=>({median:'Median',low:'Lowest',high:'Highest'})[axState.aggregation];
function axField(metric){return metric==='price-psf'?'askPsf':metric.startsWith('roi')?'roi':'averageTransactionValue'}
function axBenchmarks(c){return AR.benchmarks.filter(b=>AR.norm(b.emirate)===AR.norm(c.emirate)&&(arState.scope==='emirate'||AR.area(b.community)===AR.area(c.name)))}
function axDescribe(c,metric){
 const key=[c.id,metric,arState.scope,arState.segment,axState.custom.join(','),axState.aggregation].join('|');if(axState.memo.has(key))return axState.memo.get(key);
 let result={value:null,rows:[],types:[],count:0,low:null,high:null,reason:null,period:'Current catalogue',filterApplied:true};
 if(axBenchmarkMetrics.has(metric))result=AX.summarize(axBenchmarks(c),axField(metric),arState.segment,axState.custom,axState.aggregation);
 else if(axCountMetrics.has(metric)){
  const source=arState.scope==='emirate'?(arState.catalogue.projects||[]).filter(p=>AR.norm(p.emirate)===AR.norm(c.emirate)):(c.projectIds||[]).map(id=>arState.byId.get(id)).filter(Boolean);
  let ps=[...new Map(source.map(p=>[p.id,p])).values()].filter(p=>AX.matches(p,arState.segment,axState.custom));if(metric==='active')ps=ps.filter(p=>!p.archived);if(metric==='future')ps=ps.filter(p=>p.timeline==='future');
  result={...result,value:metric==='developers'?new Set(ps.map(p=>p.developerId).filter(Boolean)).size:ps.length,count:ps.length,types:[...new Set(ps.flatMap(AX.types))],basis:'Catalogue records; not dwelling units or market transactions'};
 }else if(axTotals.has(metric)){
  const em=arState.scope==='emirate';const mk=metric==='volume'?(em?'sales_count':'community_sales_count'):metric==='transaction-value'?(em?'transaction_value_aed':'community_sales_value_aed'):'transaction_count';
  const rows=(arState.market?.observations||[]).filter(o=>o.scope_type===arState.scope&&o.metric_key===mk&&o.period_start==='2026-01-01'&&o.period_end==='2026-06-30'&&AR.area(o.scope_label)===AR.area(c.name)&&AX.finite(o.value_numeric));
  result={...result,value:rows.length===1?Number(rows[0].value_numeric):null,rows:rows.length===1?rows:[],count:rows.length===1?1:0,filterApplied:false,period:'H1 2026',basis:'Published geographic total; no property-type split in this series',reason:rows.length===1?null:'No unambiguous H1 2026 observation at this geographic level.'};
 }
 axState.memo.set(key,result);return result;
}
arMetric=function(c,metric){return axDescribe(c,metric).value};
const axOriginalGeographies=arGeographies;
arGeographies=function(){const gs=axOriginalGeographies();if(arState.scope==='emirate'){for(const c of gs)c.projectIds=(arState.catalogue.projects||[]).filter(p=>AR.norm(p.emirate)===AR.norm(c.emirate)).map(p=>p.id);return gs}const groups=new Map();for(const c of gs){const k=AR.norm(c.emirate)+'|'+AR.area(c.name);if(!groups.has(k))groups.set(k,{...c,projectIds:[],memberIds:[]});const g=groups.get(k);g.projectIds.push(...(c.projectIds||[]));g.memberIds.push(c.id)}return [...groups.values()].map(c=>({...c,projectIds:[...new Set(c.projectIds)]}))};
function axGeographies(){const seen=new Set();return arGeographies().filter(c=>{const k=AR.norm(c.emirate)+'|'+AR.area(c.name);if(seen.has(k))return false;seen.add(k);return true})}
arCoverage=function(){const gs=axGeographies(),metric=state.analysisMetric||'price-psf',rows=gs.map(c=>axDescribe(c,metric));return{metric,scope:arState.scope,segment:arState.segment,effectiveSegment:axTotals.has(metric)?'all':arState.segment,aggregation:axState.aggregation,total:gs.length,withData:rows.filter(r=>r.value!==null).length,contributingTypes:[...new Set(rows.flatMap(r=>r.types))],benchmarkCount:rows.reduce((n,r)=>n+r.rows.length,0),period:axCountMetrics.has(metric)?'Current catalogue':'H1 2026',catalogueCommunities:arState.catalogue?.communities.length||0}}
const axOriginalLabel=arLabel;
arLabel=function(metric){if(metric==='roi')return 'ROI · projected gross rental yield';if(metric==='transaction-count')return 'Transaction count · recorded transactions';return axOriginalLabel(metric)};
function axValue(v,metric){if(v===null||v===undefined)return 'Not reported';return metric.startsWith('roi')?arFmt(v)+'%':metric==='price-psf'?'AED '+arFmt(v)+' / sqft':['transaction-value','avg-transaction'].includes(metric)?'AED '+arFmt(v):arFmt(v)}
function axCalculation(metric){
 if(axTotals.has(metric))return 'All property types in the reported total. The type filter is inactive because this source does not provide a type split.';
 if(axCountMetrics.has(metric))return 'Selected property types apply to catalogue records. Multi-type projects are counted once; unclassified records remain included in All property types.';
 if(axBenchmarkMetrics.has(metric))return axModeLabel()+' of the available, same-period '+(metric==='avg-transaction'?'reported type averages':'type benchmarks')+'. Each source area/type gets equal weight; transaction counts, floor areas and market-share weights are not available. Not an all-market weighted average.';
 return 'Existing layer retained. The new property-type and summary controls do not alter this legacy layer.';
}
function axInspect(id){
 axState.inspected=id||axState.inspected;const box=document.querySelector('#ax-area-values');if(!box)return;const c=axGeographies().find(c=>c.id===axState.inspected||c.memberIds?.includes(axState.inspected));if(!c){box.innerHTML='<p>Select an area to inspect its property-type values and sources.</p>';return}
 const metric=state.analysisMetric,d=axDescribe(c,metric);let h='<h3>'+esc(c.name)+'</h3><div class="ar-row"><span>'+esc(axTotals.has(metric)?'Reported total':axModeLabel()+' / selected types')+'</span><b>'+esc(axValue(d.value,metric))+'</b></div>';
 if(axBenchmarkMetrics.has(metric)){
  if(d.count)h+='<p>'+esc(d.types.map(t=>AX.labels[t]||t).join(' + '))+' · '+d.count+' source benchmark'+(d.count===1?'':'s')+'. '+(d.count===1?'Only one available benchmark; no blend.':'')+'</p><p>Available range: '+esc(axValue(d.low,metric))+' – '+esc(axValue(d.high,metric))+'</p>';
  if(d.reason)h+='<p>'+esc(d.reason)+'</p>';
  h+=d.rows.map(b=>'<div class="ar-row"><span>'+esc((arState.scope==='emirate'?b.community+' · ':'')+(AX.labels[AX.typeKey(b.segment)]||b.segment))+'</span><b>'+esc(axValue(Number(b[axField(metric)]),metric))+'</b></div>').join('');
  h+='<p>Only listed types contribute. Townhouses, offices, retail, land and other types are not represented unless a separate source benchmark exists.</p>';
  const links=[...new Map(d.rows.filter(b=>b.sourceUrl).map(b=>[b.sourceUrl,b])).values()];h+=links.map(b=>'<a href="'+esc(b.sourceUrl)+'" target="_blank" rel="noopener">'+esc(b.sourceLabel+' · '+b.period)+'</a>').join('<br>');
 }else if(axTotals.has(metric)){h+='<p>'+esc(d.reason||d.basis)+'</p>'+d.rows.map(o=>'<a href="'+esc(o.canonical_url)+'" target="_blank" rel="noopener">'+esc(o.publisher+' · '+d.period)+'</a>').join('')}
 else h+='<p>'+esc(d.basis||'')+'</p>';
 box.innerHTML=h;
}
function axControls(){
 const segment=document.querySelector('#ar-segment');if(!segment)return;
 const metric=state.analysisMetric,owned=arOwned.has(metric),bench=axBenchmarkMetrics.has(metric),totals=axTotals.has(metric);
 segment.disabled=!owned||totals;document.querySelector('#ax-aggregate').disabled=!bench;document.querySelector('#ax-custom-types').hidden=arState.segment!=='custom'||segment.disabled;
 const hint=document.querySelector('#ax-type-hint');hint.textContent=totals?'Reported totals include all types; no type breakdown is supplied.':!owned?'Legacy layer active; its original controls and legend are preserved.':bench?'All types includes every available source type. Missing types are not substituted or treated as zero.':'The type filter applies to catalogue counts, not the other map layers.';
 document.querySelector('#ax-export').disabled=!owned;
 document.documentElement.dataset.axHeatmap=owned?'owned':'legacy';
}
const axOriginalPaint=arPaint;
arPaint=function(metric){
 if(!arOwned.has(metric)){axControls();return}
 axState.memo.clear();axOriginalPaint(metric);if(!arState.catalogue)return;axControls();
 const gs=axGeographies(),covered=gs.filter(c=>axDescribe(c,metric).value!==null),cov=arCoverage(),types=cov.contributingTypes.map(t=>AX.labels[t]||t).join(' + '),leg=document.querySelector('#ar-map-legend');
 const heading=axBenchmarkMetrics.has(metric)?axModeLabel()+' · '+arLabel(metric):arLabel(metric);
 const vals=covered.map(c=>axDescribe(c,metric).value).sort((a,b)=>a-b);const description=axCalculation(metric);
 if(leg)leg.innerHTML='<strong>'+esc(heading)+'</strong><small>'+esc(axTotals.has(metric)?'All property types · published totals':axTypesLabel(arState.segment)+' · '+(arState.scope==='emirate'?'published area/type benchmarks':'community-level'))+'</small><div class="ar-ramp"></div><div>'+esc(vals.length?axValue(vals[0],metric)+' — '+axValue(vals.at(-1),metric):'No sourced values for this selection')+'</div><small>'+covered.length+' / '+gs.length+' '+(arState.scope==='emirate'?'emirates':'distinct catalogue areas')+' with data · '+esc(cov.period)+'. Grey = not reported.</small>'+(axBenchmarkMetrics.has(metric)?'<small>Contributing types: '+esc(types||'none')+'. Equal-weight benchmarks, not a market average.</small>':'');
 const box=document.querySelector('#ar-coverage');if(box){box.innerHTML='<h3>'+esc(arLabel(metric))+'</h3><p>'+covered.length+' of '+gs.length+' distinct '+(arState.scope==='emirate'?'emirates':'catalogue areas')+' have a value. All '+arState.catalogue.communities.length+' community profiles remain in the directory.</p><p>'+esc(description)+'</p>'+(benchCoverage(metric,gs))+'<a href="/map/research">All property, developer and community profiles</a>'}
 const pick=document.querySelector('#ax-area');if(pick){const selected=pick.value||axState.inspected;const key=arState.scope+'|'+gs.map(c=>c.id).join(',');if(pick.dataset.geographies!==key){pick.innerHTML='<option value="">Inspect an area</option>'+gs.slice().sort((a,b)=>(a.emirate+' '+a.name).localeCompare(b.emirate+' '+b.name)).map(c=>'<option value="'+esc(c.id)+'">'+esc(arState.scope==='emirate'?c.name:c.emirate+' · '+c.name)+'</option>').join('');pick.dataset.geographies=key}if(gs.some(c=>c.id===selected))pick.value=selected;axInspect(pick.value)}
 if(window.__ESPACIOS_RESEARCH__){window.__ESPACIOS_RESEARCH__.heatmapVersion=AX.VERSION;window.__ESPACIOS_RESEARCH__.metric=metric;window.__ESPACIOS_RESEARCH__.segment=arState.segment;window.__ESPACIOS_RESEARCH__.aggregation=axState.aggregation;window.__ESPACIOS_RESEARCH__.heatmapEvidence=id=>{const c=axGeographies().find(c=>c.id===id||c.memberIds?.includes(id));return c?axDescribe(c,state.analysisMetric):null};}
}
function benchCoverage(metric,gs){if(!axBenchmarkMetrics.has(metric))return '';const field=axField(metric);const types=[...new Set(AR.benchmarks.map(b=>AX.typeKey(b.segment)))];return '<div class="ax-type-coverage">'+types.map(t=>{const n=gs.filter(c=>AX.summarize(axBenchmarks(c),field,t).value!==null).length;return '<div class="ar-row"><span>'+esc(AX.labels[t]||t)+'</span><b>'+n+' areas</b></div>'}).join('')+'</div><p>Coverage rows describe available source types, not the number of transactions. Area coverage changes with the selected types; type coverage rows may overlap.</p>'}
function axExport(){const metric=state.analysisMetric;const heads=['geography','emirate','metric','selected_types','effective_types','aggregation','value','range_low','range_high','period','source_record_count','source_urls','basis'];const rows=axGeographies().map(c=>{const d=axDescribe(c,metric);return [c.name,c.emirate,metric,axTypesLabel(arState.segment),axTotals.has(metric)?'all types in reported total':d.types.map(t=>AX.labels[t]||t).join('; '),axBenchmarkMetrics.has(metric)?axState.aggregation:'reported total or catalogue count',d.value,d.low,d.high,d.period,d.count,[...new Set(d.rows.map(r=>r.sourceUrl||r.canonical_url).filter(Boolean))].join('; '),axCalculation(metric)]});const text=[heads,...rows].map(r=>r.map(AX.csvCell).join(',')).join('\r\n');const a=document.createElement('a'),u=URL.createObjectURL(new Blob(['\uFEFF'+text],{type:'text/csv;charset=utf-8'}));a.href=u;a.download='espacios-heatmap-'+metric+'-'+arState.segment+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
const axOriginalSetup=arSetup;
arSetup=function(){axOriginalSetup();if(document.querySelector('#ax-aggregate'))return;const segment=document.querySelector('#ar-segment');if(!segment)return;
 const oldLabel=segment.parentElement.firstChild;if(oldLabel?.nodeType===Node.TEXT_NODE)oldLabel.textContent='Property types';
 segment.innerHTML='<option value="all">All property types</option>'+Object.entries(AX.labels).map(([v,n])=>'<option value="'+v+'">'+n+'</option>').join('')+'<option value="custom">Custom selection</option>';segment.value=arState.segment;
 const more=document.createElement('div');more.className='ax-controls';more.innerHTML='<p id="ax-type-hint" class="ax-note"></p><div id="ax-custom-types" hidden>'+Object.entries(AX.labels).map(([v,n])=>'<label><input type="checkbox" value="'+v+'" '+(axState.custom.includes(v)?'checked':'')+'><span>'+n+'</span></label>').join('')+'</div><label>Heatmap summary<select id="ax-aggregate"><option value="median">Median of available benchmarks</option><option value="low">Lowest available benchmark</option><option value="high">Highest available benchmark</option></select></label><div class="ax-actions"><button id="ax-reset" type="button">Reset heatmap</button><button id="ax-export" type="button">Export values</button></div><details id="ax-inspect"><summary>Inspect values by property type</summary><label>Area<select id="ax-area"><option value="">Inspect an area</option></select></label><div id="ax-area-values" class="ar-block"></div></details>';segment.parentElement.after(more);
 const sel=document.querySelector('#analysis-metric');for(const [v,n] of [['roi','ROI · all / selected types'],['transaction-count','Transaction count · all recorded types']])if(![...sel.options].some(o=>o.value===v)){const o=document.createElement('option');o.value=v;o.textContent=n;sel.append(o)}
 const generic=[...sel.options].find(o=>o.value==='roi');const price=[...sel.options].find(o=>o.value==='price-psf');if(generic&&price)price.after(generic);
 const scope=document.querySelector('#ar-scope');[...scope.options].find(o=>o.value==='emirate').textContent='Emirates · available area benchmarks / totals';
 const repaint=()=>psrSetAnalysis(['roi-apartment','roi-villa'].includes(state.analysisMetric)?'roi':state.analysisMetric);
 segment.onchange=e=>{arState.segment=e.target.value;repaint()};scope.onchange=e=>{arState.scope=e.target.value;psrSetAnalysis(state.analysisMetric)};
 more.querySelector('#ax-aggregate').onchange=e=>{axState.aggregation=e.target.value;psrSetAnalysis(state.analysisMetric)};
 more.querySelector('#ax-custom-types').onchange=()=>{axState.custom=[...more.querySelectorAll('#ax-custom-types input:checked')].map(e=>e.value);repaint()};
 more.querySelector('#ax-area').onchange=e=>axInspect(e.target.value);
 more.querySelector('#ax-export').onclick=axExport;
 more.querySelector('#ax-reset').onclick=()=>{arState.segment='all';arState.scope='community';axState.aggregation='median';segment.value='all';scope.value='community';more.querySelector('#ax-aggregate').value='median';psrSetAnalysis('price-psf')};
 axControls();
}
const axOriginalSetAnalysis=psrSetAnalysis;
psrSetAnalysis=function(metric){
 if(metric==='roi-apartment'||metric==='roi-villa'){arState.segment=metric==='roi-villa'?'villa':'apartment';const sel=document.querySelector('#ar-segment');if(sel)sel.value=arState.segment}
 axState.memo.clear();axOriginalSetAnalysis(metric);document.documentElement.dataset.axHeatmap=arOwned.has(metric)?'owned':'legacy';
 if(!arOwned.has(metric)){const box=document.querySelector('#ar-coverage');if(box)box.innerHTML='<h3>'+esc(document.querySelector('#analysis-metric')?.selectedOptions[0]?.text||'Existing layer')+'</h3><p>'+esc(axCalculation(metric))+'</p>';const pick=document.querySelector('#ax-area-values');if(pick)pick.textContent='Use the original controls for this layer.';if(document.querySelector('#ax-aggregate'))axControls()}
 if(metric==='transaction-count')arMarket().then(()=>{if(state.analysisMetric===metric)arPaint(metric)}).catch(()=>{const e=document.querySelector('#ar-coverage');if(e)e.textContent='Recorded transaction data could not be loaded.'})
};
/* Selection enriches the inspector but never changes map hit-testing or project identity. */
const axOriginalDossier=arDossier;
arDossier=function(r){axOriginalDossier(r);if(!arState.catalogue)return;const p=arFind(r);const c=arState.scope==='emirate'?axGeographies().find(c=>AR.norm(c.name)===AR.norm(r?.emirate)):axGeographies().find(c=>c.id===(r?.kind==='community'?r.id:p?.communityId)||c.memberIds?.includes(r?.kind==='community'?r.id:p?.communityId));if(c){axState.inspected=c.id;const s=document.querySelector('#ax-area');if(s)s.value=c.id;axInspect(c.id)}};
const axOriginalRebuild=arRebuild;
arRebuild=function(){axOriginalRebuild();const d=window.__ESPACIOS_RESEARCH__;if(d){d.heatmapVersion=AX.VERSION;d.segment=arState.segment;d.aggregation=axState.aggregation;d.heatmapEvidence=id=>{const c=axGeographies().find(c=>c.id===id||c.memberIds?.includes(id));return c?axDescribe(c,state.analysisMetric):null};}};

/* Geographic display only. No nearest-neighbour prices, synthetic boundaries, or valuation interpolation. */
var SG = (() => {
 const VERSION='20260923-area-surface-v1';
 const norm=v=>String(v??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const em=v=>({'umm al quwain':'Umm Al Quwain','ras al khaimah':'Ras Al Khaimah','abu dhabi':'Abu Dhabi','dubai':'Dubai','sharjah':'Sharjah','ajman':'Ajman','fujairah':'Fujairah'})[norm(v)]||null;
 const aliases={'dubai hills':'dubai hills estate','al shamkhah':'al shamkha','al samhah':'al samha','silicon oasis':'dubai silicon oasis','the palm jumeirah':'palm jumeirah','palm jumeirah island':'palm jumeirah','al sa diyat':'saadiyat island','jbr jumeirah beach residence':'jumeirah beach residence','jumeirah beach residence jbr':'jumeirah beach residence','jlt jumeirah lake towers':'jumeirah lake towers','jumeirah lake towers jlt':'jumeirah lake towers','jumeirah village circle jvc':'jumeirah village circle','jvc':'jumeirah village circle','jumeirah village triangle jvt':'jumeirah village triangle','jvt':'jumeirah village triangle','muwailih commercial':'muwaileh commercial','al reem island abu dhabi emirate':'al reem island','saadiyat island abu dhabi emirate':'saadiyat island','yas island abu dhabi emirate':'yas island','al marjan island ras al khaimah emirate':'al marjan island'};
 const area=v=>aliases[norm(v)]||norm(v);
 const key=(emirate,name)=>(em(emirate)||norm(emirate))+'|'+area(name);
 const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
 function ringContains(p,r){let inside=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside}return inside}
 function contains(p,g){if(!g||!['Polygon','MultiPolygon'].includes(g.type))return false;return(g.type==='Polygon'?[g.coordinates]:g.coordinates).some(a=>ringContains(p,a[0])&&!a.slice(1).some(r=>ringContains(p,r)))}
 function bbox(g){const out=[Infinity,Infinity,-Infinity,-Infinity];function walk(c){if(typeof c[0]==='number'){out[0]=Math.min(out[0],c[0]);out[1]=Math.min(out[1],c[1]);out[2]=Math.max(out[2],c[0]);out[3]=Math.max(out[3],c[1])}else c.forEach(walk)}walk(g.coordinates);return out}
 function ringArea(r){let a=0;for(let i=0,j=r.length-1;i<r.length;j=i++)a+=r[j][0]*r[i][1]-r[i][0]*r[j][1];return Math.abs(a/2)}
 function validGeometry(g){if(!g||!['Polygon','MultiPolygon'].includes(g.type)||!Array.isArray(g.coordinates)||!g.coordinates.length)return false;return(g.type==='Polygon'?[g.coordinates]:g.coordinates).every(p=>p.length&&p.every(r=>r.length>=4&&r.every(c=>c.length>=2&&c.slice(0,2).every(Number.isFinite)&&c[0]>=-180&&c[0]<=180&&c[1]>=-90&&c[1]<=90)&&r[0][0]===r.at(-1)[0]&&r[0][1]===r.at(-1)[1]&&ringArea(r)>1e-14))}
 function distanceSq(p,a,b){let x=a[0],y=a[1],dx=b[0]-x,dy=b[1]-y;if(dx||dy){const t=((p[0]-x)*dx+(p[1]-y)*dy)/(dx*dx+dy*dy);if(t>1){x=b[0];y=b[1]}else if(t>0){x+=dx*t;y+=dy*t}}return(p[0]-x)**2+(p[1]-y)**2}
 function simplifyRing(r,tol){if(r.length<8)return r;const keep=new Uint8Array(r.length);keep[0]=keep[r.length-1]=1;const stack=[[0,r.length-1]];while(stack.length){const[a,b]=stack.pop();let high=tol*tol,index=-1;for(let j=a+1;j<b;j++){const d=distanceSq(r[j],r[a],r[b]);if(d>high){high=d;index=j}}if(index>=0){keep[index]=1;stack.push([a,index],[index,b])}}const out=r.filter((_,i)=>keep[i]);return out.length>=4&&ringArea(out)>0?out:r}
 function simplify(g,tol=.00012){const r=c=>simplifyRing(c,tol).map(v=>v.slice(0,2).map(x=>Math.round(x*1e6)/1e6));const out={type:g.type,coordinates:g.type==='Polygon'?g.coordinates.map(r):g.coordinates.map(p=>p.map(r))};return validGeometry(out)?out:g}
 function prepare(input){
  const features=[],rejected=[];const push=(g,p)=>{if(!validGeometry(g)){rejected.push(p.id);return}const geometry=simplify(g);features.push({type:'Feature',id:p.id,geometry,properties:{...p,bbox:bbox(geometry),areaKey:key(p.emirate,p.name)}})};
  for(const f of input.emirates.features)push(f.geometry,{id:'emirate:'+norm(f.properties.shapeName).replace(/ /g,'-'),level:'emirate',name:em(f.properties.shapeName)||f.properties.shapeName,nativeName:f.properties.shapeName,emirate:em(f.properties.shapeName),source:'geoBoundaries gbOpen / OpenStreetMap',sourceUrl:'https://www.geoboundaries.org/',geometryBasis:'Administrative overview boundary; simplified for display',rank:0});
  for(const f of input.district.features){const p=f.properties;push(f.geometry,{id:'fgic:'+p.OBJECTID,level:'district',name:p.NameEnglish||'Unnamed district',nativeName:p.NameEnglish,nameArabic:p.NameArabic,emirate:em(p.surfaceEmirate),emirateBasis:p.surfaceEmirate?'Geometric membership in non-overlapping emirate boundary':'Unresolved administrative join; no values attached',source:'UAE FGIC national district layer',sourceUrl:'https://stgnsdi.fgic.gov.ae/publishing/rest/services/platform_layers_list/MapServer/28',sourceRecordId:String(p.OBJECTID),sourceDate:p.SourceDate?new Date(p.SourceDate).toISOString().slice(0,10):null,geometryBasis:'Published district boundary, simplified for display; not cadastral survey',rank:1})}
  for(const [i,f]of input.dubai.features.entries()){const p=f.properties;push(f.geometry,{id:'dubai-curated:'+i,level:'community',name:p.name,nativeName:p.name,nameArabic:p.name_ar,emirate:'Dubai',source:'Existing DLD-area / OpenStreetMap curated layer',sourceUrl:'https://github.com/AntonTkachev/dld-viewer',sourceRecordId:String(p.comm_num||p.key||i),geometryBasis:p.source||'curated',rank:3})}
  for(const f of(input.master?.features||[])){const p=f.properties;push(f.geometry,{id:'master-surface:'+p.territoryId,level:'community',name:p.name,nativeName:p.name,emirate:em(p.emirate),source:p.boundarySource,sourceUrl:p.boundarySourceUrl,sourceDate:p.verifiedAt,geometryBasis:p.verificationMethod,rank:4})}
  for(const f of(input.abudhabi?.features||[])){const p=f.properties;push(f.geometry,{id:'ad-community:'+p.OBJECTID,level:'planning-community',name:p.COMMPOPNAMEENG||p.COMMUNITYNAMEENG,nativeName:p.COMMUNITYNAMEENG,nameArabic:p.COMMUNITYNAMEARA,parentName:p.DISTRICTNAMEENG,emirate:'Abu Dhabi',source:'Abu Dhabi Spatial Data Infrastructure OpenData',sourceUrl:'https://arcgis.sdi.abudhabi.ae/agspublish/rest/services/OpenData/ADSDI_OpenData/MapServer/2',sourceRecordId:String(p.COMMUNITYID||p.OBJECTID),geometryBasis:'Published planning community; district reference not silently assigned to sub-area',rank:2})}
  const counts=features.reduce((o,f)=>(o[f.properties.level]=(o[f.properties.level]||0)+1,o),{});
  return{type:'FeatureCollection',features,meta:{version:VERSION,checkedAt:'2026-09-23',counts,rejectedGeometryIds:rejected,emirateUnresolved:features.filter(f=>!f.properties.emirate).length,simplificationToleranceDegrees:.00012,disclaimer:'Geographic coverage is not price coverage. Boundary sources can have older source dates. No value interpolation, no synthetic price catchments, no property count inferred from polygon count.'}};
 }
 function match(p,geographies){if(!p.emirate)return null;const wanted=key(p.emirate,p.name),hits=geographies.filter(c=>key(c.emirate,c.name)===wanted);return hits.length===1?hits[0]:null}
 return{VERSION,norm,em,area,key,finite,contains,bbox,validGeometry,simplify,prepare,match};
})();

/* Area-first view. Existing point markers are navigation; thematic values use published polygons only. */
const sgState={data:null,loading:null,error:null,automatic:true,opacity:.34,rendered:[],lastKey:'',hoverFrame:0,geoGeneration:0};
const sgOwned=metric=>arOwned.has(metric);
const sgLayers=['sg-overview-fill','sg-area-base','sg-area-fill','sg-area-outline','sg-overview-outline'];
const sgOldGeographies=axGeographies;
axGeographies=function(){
 const gs=sgOldGeographies();if(arState.scope!=='community'||!axBenchmarkMetrics.has(state.analysisMetric))return gs;
 const keys=new Set(gs.map(c=>SG.key(c.emirate,c.name)));
 for(const b of AR.benchmarks){const k=SG.key(b.emirate,b.community);if(!keys.has(k)){keys.add(k);gs.push({id:'source-locality:'+SG.norm(b.emirate+' '+b.community).replace(/ /g,'-'),name:b.community,emirate:b.emirate,projectIds:[],marketReferenceOnly:true})}}
 return gs;
};
const sgOldDescribe=axDescribe;
axDescribe=function(c,metric){if(c?.marketReferenceOnly&&axCountMetrics.has(metric))return{value:null,rows:[],types:[],count:0,period:'Current catalogue',reason:'Source locality is not a separate catalogue project population.'};return sgOldDescribe(c,metric)};
function sgFind(p,gs){if(p.level==='emirate')return gs.find(c=>SG.em(c.emirate)===SG.em(p.emirate)&&SG.area(c.name)===SG.area(p.name))||null;return SG.match(p,gs)}
function sgHideBubbles(){for(const id of ['ar-metric-circles','ar-metric-labels','ar-metric-fill'])if(map.getLayer(id))map.setLayoutProperty(id,'visibility','none')}
function sgVisible(show){for(const id of sgLayers)if(map.getLayer(id))map.setLayoutProperty(id,'visibility',show?'visible':'none');if(!show)sgHideTooltip()}
async function sgLoad(){
 if(sgState.data)return sgState.data;if(sgState.loading)return sgState.loading;
 sgState.loading=fetch('/map/spatial/area-surface-20260923-v1.geojson').then(r=>{if(!r.ok)throw Error('Boundary service '+r.status);return r.json()}).then(d=>{if(d.type!=='FeatureCollection'||d.meta?.version!==SG.VERSION||d.features?.length!==3126||d.features.filter(f=>f.properties.level==='emirate').length!==7||d.features.some(f=>!SG.validGeometry(f.geometry)))throw Error('Incomplete or invalid boundary snapshot');for(const f of d.features)f.properties.surfaceKey=f.properties.emirate?SG.key(f.properties.emirate,f.properties.name):null;sgState.data=d;sgState.error=null;sgState.geoGeneration++;if(sgOwned(state.analysisMetric))arPaint(state.analysisMetric);return d}).catch(e=>{sgState.error=e.message;sgState.loading=null;sgStatus();return null});return sgState.loading;
}
function sgEmpty(){return{type:'FeatureCollection',features:[]}}
function sgSource(id,data){const s=map.getSource(id);if(s)s.setData(data);else map.addSource(id,{type:'geojson',data,tolerance:.3})}
function sgAddLayers(){
 const before=map.getLayer('project-hit')?'project-hit':undefined;
 const add=layer=>{if(!map.getLayer(layer.id))map.addLayer(layer,before)};
 const color=['case',['==',['get','known'],true],['get','surfaceColor'],document.documentElement.dataset.espaciosTheme==='light'?'#7e8b9c':'#697d91'];
 add({id:'sg-overview-fill',type:'fill',source:'sg-overview',paint:{'fill-color':color,'fill-opacity':['case',['==',['get','known'],true],sgState.opacity,.08]}});
 add({id:'sg-area-base',type:'fill',source:'sg-areas',minzoom:8.4,filter:['!=',['get','known'],true],paint:{'fill-color':color,'fill-opacity':.025}});
 add({id:'sg-area-fill',type:'fill',source:'sg-areas',filter:['==',['get','known'],true],paint:{'fill-color':['get','surfaceColor'],'fill-opacity':sgState.opacity,'fill-outline-color':['get','surfaceColor']}});
 add({id:'sg-area-outline',type:'line',source:'sg-areas',minzoom:8.4,paint:{'line-color':document.documentElement.dataset.espaciosTheme==='light'?'#66778a':'#b6c5d4','line-width':['interpolate',['linear'],['zoom'],8.4,.25,12,.65,16,1],'line-opacity':['case',['==',['get','known'],true],.75,.28]}});
 add({id:'sg-overview-outline',type:'line',source:'sg-overview',paint:{'line-color':document.documentElement.dataset.espaciosTheme==='light'?'#5a7083':'#adc3d6','line-width':1,'line-opacity':.5}});
}
function sgStatus(){
 const box=document.querySelector('#sg-coverage');if(!box)return;
 const d=sgState.data,coverage=window.__ESPACIOS_SURFACE__;
 if(!d){box.textContent=sgState.error?'Boundary data could not load. Retry preserves all map controls.':'Loading published UAE boundaries…';return}
 const m=d.meta.counts;box.innerHTML='<b>Area shading · no heatmap bubbles</b><p>'+m.emirate+' emirate outlines · '+m.district+' national districts · '+m.community+' curated / master polygons · '+m['planning-community']+' Abu Dhabi planning communities.</p>'+(coverage?'<p>'+coverage.matchedValueAreas+' value-bearing geographies matched to polygons. '+coverage.noBoundaryValueAreas+' source geographies have a value but no exact boundary-name match.</p>':'')+'<p>Boundary coverage is not market-data coverage. Grey means no value at this level. Source dates may predate this map update.</p>';
}
function sgPaint(metric){
 sgHideBubbles();if(!sgOwned(metric)){sgVisible(false);return}sgLoad();if(!sgState.data){sgStatus();return}
 const gs=axGeographies(),join=new Map();for(const c of gs){const k=SG.key(c.emirate,c.name);join.set(k,join.has(k)?null:c)}const values=gs.map(c=>axDescribe(c,metric).value).filter(SG.finite).map(Number).sort((a,b)=>a-b);
 const cuts=[.25,.5,.75].map(q=>values.length?values[Math.floor((values.length-1)*q)]:0),color=v=>v<=cuts[0]?arColors[0]:v<=cuts[1]?arColors[1]:v<=cuts[2]?arColors[2]:arColors[3];
 const matches=new Set(),overview=[],areas=[];
 const key=[metric,arState.scope,arState.segment,axState.custom.join(','),axState.aggregation,sgState.geoGeneration,arState.catalogue?.counts?.projects,arState.market?.observations?.length||0].join('|');
 if(key!==sgState.lastKey){
 for(const f of sgState.data.features){const p=f.properties,isEm=p.level==='emirate';let c=null;
  if(arState.scope==='emirate'){if(isEm)c=join.get(p.surfaceKey)||null}else if(!isEm)c=join.get(p.surfaceKey)||null;
  const report=c?axDescribe(c,metric):null,v=report?.value,known=SG.finite(v),prop={...p,known,value:known?Number(v):null,surfaceColor:known?color(Number(v)):'#8594a5',metric,metricName:arLabel(metric),evidenceId:c?.id||'',evidenceName:c?.name||'',period:report?.period||'',basis:known?(isEm&&axBenchmarkMetrics.has(metric)?'Summary of sourced area/type benchmarks; not an emirate-wide price index':report?.basis||axCalculation(metric)):'No matching evidence at this geographic level',sources:report?.rows?.map(r=>r.sourceUrl||r.canonical_url).filter(Boolean).join('|')||''};
  if(known)matches.add(c.id);
  const output={type:'Feature',id:f.id,geometry:f.geometry,properties:prop};
  if(isEm)overview.push(output);else if(arState.scope==='community')areas.push(output);
 }
 areas.sort((a,b)=>Number(a.properties.known)-Number(b.properties.known)||a.properties.rank-b.properties.rank);
 sgState.rendered=[...overview,...areas];sgState.lastKey=key;sgState.renderKey='';
 }else{for(const f of sgState.rendered)if(f.properties.known)matches.add(f.properties.evidenceId)}
 // Keep the complete boundary registry, but tile only the visible neighbourhood. Detailed planning zones enter at building-neighbourhood zoom.
 const bounds=map.getBounds(),padX=(bounds.getEast()-bounds.getWest())*.15,padY=(bounds.getNorth()-bounds.getSouth())*.15,view=[bounds.getWest()-padX,bounds.getSouth()-padY,bounds.getEast()+padX,bounds.getNorth()+padY],detailed=map.getZoom()>=12;
 const renderKey=key+'|'+detailed+'|'+view.map(v=>v.toFixed(3)).join(',');
 if(renderKey!==sgState.renderKey||!map.getSource('sg-areas')){
  const shown=sgState.rendered.filter(f=>{const p=f.properties;if(p.level==='emirate')return false;if(p.level==='planning-community'&&!detailed)return false;const b=p.bbox;return !b||(b[0]<=view[2]&&b[2]>=view[0]&&b[1]<=view[3]&&b[3]>=view[1])});
  sgSource('sg-overview',{type:'FeatureCollection',features:sgState.rendered.filter(f=>f.properties.level==='emirate')});sgSource('sg-areas',{type:'FeatureCollection',features:shown});sgState.visibleCount=shown.length;sgState.renderKey=renderKey;
 }
 sgAddLayers();sgVisible(true);sgHideBubbles();
 const light=document.documentElement.dataset.espaciosTheme==='light';
 map.setPaintProperty('sg-overview-fill','fill-color',['case',['==',['get','known'],true],['get','surfaceColor'],light?'#7e8b9c':'#697d91']);map.setPaintProperty('sg-overview-fill','fill-opacity',['case',['==',['get','known'],true],sgState.opacity,.08]);map.setPaintProperty('sg-area-fill','fill-opacity',sgState.opacity);map.setPaintProperty('sg-area-outline','line-color',light?'#66778a':'#b6c5d4');map.setPaintProperty('sg-overview-outline','line-color',light?'#5a7083':'#adc3d6');
 const missing=gs.filter(c=>SG.finite(axDescribe(c,metric).value)&&!matches.has(c.id));
 window.__ESPACIOS_SURFACE__={version:SG.VERSION,ready:true,geometryRecords:sgState.data.features.length,visibleLocalBoundaryFeatures:sgState.visibleCount,boundaryCounts:sgState.data.meta.counts,scope:arState.scope,automatic:sgState.automatic,metric,matchedValueAreas:matches.size,noBoundaryValueAreas:missing.length,noBoundaryNames:missing.map(c=>c.name),polygonFeaturesWithValue:sgState.rendered.filter(f=>f.properties.known).length,geometrySourceDates:'FGIC records: 2022; other source snapshots retain their own metadata',sources:()=>sgState.data.meta,inspect:id=>sgState.rendered.find(f=>f.id===id)?.properties};
 if(window.__ESPACIOS_RESEARCH__)window.__ESPACIOS_RESEARCH__.surfaceVersion=SG.VERSION;
 const leg=document.querySelector('#ar-map-legend');if(leg){leg.querySelectorAll('.sg-legend-note').forEach(n=>n.remove());for(const el of leg.querySelectorAll('small'))el.textContent=el.textContent.replace('distinct catalogue areas','distinct catalogue / source-reference areas');const note=document.createElement('small');note.className='sg-legend-note';note.textContent=arState.scope==='emirate'?(axBenchmarkMetrics.has(metric)?'Emirate outlines show summaries of available area benchmarks—not a price for every location. Zoom in for local polygons.':'Emirate outlines show reported totals or catalogue counts at the selected scope.'):'Local polygons only. Grey/uncoloured territory has no matching local evidence; no value spread from neighbours.';leg.append(note);const n=document.createElement('small');n.className='sg-legend-note';n.textContent=matches.size+' value-bearing areas have matched geometry · '+missing.length+' have data but no matched outline.';leg.append(n)}
 sgStatus();
}
const sgOldPaint=arPaint;
arPaint=function(metric){sgOldPaint(metric);sgPaint(metric)};
const sgOldSet=psrSetAnalysis;
psrSetAnalysis=function(metric){sgOldSet(metric);if(!sgOwned(metric)){sgVisible(false);sgHideTooltip()}else sgHideBubbles();};
function sgSetLevel(){if(!sgState.automatic)return;const next=map.getZoom()<8.4?'emirate':'community';if(next!==arState.scope){arState.scope=next;axState.memo.clear();sgState.lastKey='';if(sgOwned(state.analysisMetric))psrSetAnalysis(state.analysisMetric)}}
const sgOldSetup=arSetup;
arSetup=function(){sgOldSetup();const scope=document.querySelector('#ar-scope');if(!scope||document.querySelector('#sg-controls'))return;
 const option=document.createElement('option');option.value='auto';option.textContent='Automatic · emirates to local areas';scope.prepend(option);scope.value='auto';arState.scope=map.getZoom()<8.4?'emirate':'community';axState.memo.clear();
 const oldScopeChange=scope.onchange;scope.onchange=e=>{sgState.automatic=e.target.value==='auto';sgState.lastKey='';if(sgState.automatic){arState.scope=map.getZoom()<8.4?'emirate':'community';psrSetAnalysis(state.analysisMetric)}else oldScopeChange?.(e)};
 const controls=document.createElement('details');controls.id='sg-controls';controls.innerHTML='<summary>Area shading and map coverage</summary><label>Shading opacity <output id="sg-opacity-label">34%</output><input id="sg-opacity" type="range" min="10" max="65" value="34" aria-label="Area shading opacity"></label><div id="sg-coverage"></div><button id="sg-retry" type="button">Reload boundary data</button>';document.querySelector('#ar-coverage')?.before(controls);
 controls.querySelector('#sg-opacity').oninput=e=>{sgState.opacity=Number(e.target.value)/100;document.querySelector('#sg-opacity-label').textContent=e.target.value+'%';if(sgOwned(state.analysisMetric))arPaint(state.analysisMetric)};
 controls.querySelector('#sg-retry').onclick=()=>{sgState.data=null;sgState.loading=null;sgState.lastKey='';sgLoad()};
 const reset=document.querySelector('#ax-reset'),oldReset=reset?.onclick;if(reset)reset.onclick=()=>{oldReset?.();sgState.automatic=true;scope.value='auto';arState.scope=map.getZoom()<8.4?'emirate':'community';sgState.lastKey='';psrSetAnalysis('price-psf')};
 const tip=document.createElement('aside');tip.id='sg-tooltip';tip.hidden=true;tip.setAttribute('aria-hidden','true');document.querySelector('#app').append(tip);sgLoad();sgStatus();
};
function sgHideTooltip(){if(sgState.hoverFrame)cancelAnimationFrame(sgState.hoverFrame);sgState.hoverFrame=0;sgState.hoverEvent=null;const t=document.querySelector('#sg-tooltip');if(t)t.hidden=true}
function sgHit(e){if(!sgOwned(state.analysisMetric)||!sgState.data||map.isMoving?.())return null;const p=e.point;if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return null;const point=[p.x,p.y],pinLayers=['project-hit','project-clusters','initiative-hit','place-hit','place-clusters','project-footprint-extrusions'].filter(id=>map.getLayer(id));if(pinLayers.length&&map.queryRenderedFeatures(point,{layers:pinLayers}).length)return null;
 const layers=(arState.scope==='emirate'?['sg-overview-fill']:['sg-area-fill','sg-area-base','sg-area-outline']).filter(id=>map.getLayer(id));if(!layers.length)return null;const fs=map.queryRenderedFeatures(point,{layers});fs.sort((a,b)=>Number(b.properties.known)-Number(a.properties.known)||Number(b.properties.rank)-Number(a.properties.rank));return fs[0]||null;
}
function sgTooltip(e){const hit=sgHit(e),t=document.querySelector('#sg-tooltip');if(!hit||!t){sgHideTooltip();return}const p=hit.properties;t.innerHTML='<strong>'+esc(p.evidenceName||p.name)+'</strong><b>'+esc(p.known?axValue(p.value,state.analysisMetric):'No local value reported')+'</b><small>'+esc(p.known?p.period+' · '+p.basis:'Published boundary only; not a property valuation.')+'</small><small>'+esc(p.source)+(p.sourceDate?' · source '+esc(p.sourceDate):'')+'</small>';t.hidden=false;const width=Math.min(290,innerWidth-24);t.style.width=width+'px';t.style.left=Math.max(10,Math.min(innerWidth-width-10,e.point.x+16))+'px';t.style.top=Math.max(10,Math.min(innerHeight-t.offsetHeight-12,e.point.y+18))+'px'}
map.on('mousemove',e=>{sgState.hoverEvent=e;if(sgState.hoverFrame)return;sgState.hoverFrame=requestAnimationFrame(()=>{sgState.hoverFrame=0;const next=sgState.hoverEvent;sgState.hoverEvent=null;if(next)sgTooltip(next)})});
map.on('moveend',()=>{if(sgOwned(state.analysisMetric)&&sgState.data)sgPaint(state.analysisMetric)});
map.on('mouseout',sgHideTooltip);map.on('movestart',sgHideTooltip);map.on('zoomend',sgSetLevel);
map.on('click',e=>{const hit=sgHit(e);if(!hit)return;const p=hit.properties;if(!p.evidenceId)return;axState.inspected=p.evidenceId;const pick=document.querySelector('#ax-area');if(pick)pick.value=p.evidenceId;axInspect(p.evidenceId);const d=document.querySelector('#ax-inspect');if(d)d.open=true});
map.on('style.load',()=>{sgState.lastKey='';if(sgOwned(state.analysisMetric))setTimeout(()=>arPaint(state.analysisMetric),120)});
/* Old logic remains available for non-area thematic layers and all navigation markers. */

/* Rendering-only normalized scalar smoothing. Does not create financial observations. */
function DGKernel(){
 const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
 const merc=p=>[(p[0]+180)/360,(1-Math.log(Math.tan(Math.PI/4+p[1]*Math.PI/360))/Math.PI)/2];
 const unmerc=p=>[p[0]*360-180,Math.atan(Math.sinh(Math.PI*(1-2*p[1])))*180/Math.PI];
 function box(src,w,h,r,horizontal){const out=new Float32Array(src.length),lines=horizontal?h:w,n=horizontal?w:h;for(let line=0;line<lines;line++){let sum=0;const at=i=>horizontal?line*w+i:i*w+line;for(let i=0;i<=Math.min(r,n-1);i++)sum+=src[at(i)];for(let i=0;i<n;i++){out[at(i)]=sum/(2*r+1);const old=i-r,next=i+r+1;if(old>=0)sum-=src[at(old)];if(next<n)sum+=src[at(next)];}}return out;}
 function blur(a,w,h,r){let out=a;for(let i=0;i<3;i++){out=box(out,w,h,r,true);out=box(out,w,h,r,false);}return out;}
 function distance(mask,w,h){const d=new Float32Array(mask.length);for(let i=0;i<d.length;i++)d[i]=mask[i]?0:1e8;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(x)d[i]=Math.min(d[i],d[i-1]+1);if(y){d[i]=Math.min(d[i],d[i-w]+1);if(x)d[i]=Math.min(d[i],d[i-w-1]+Math.SQRT2);if(x+1<w)d[i]=Math.min(d[i],d[i-w+1]+Math.SQRT2);}}for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;if(x+1<w)d[i]=Math.min(d[i],d[i+1]+1);if(y+1<h){d[i]=Math.min(d[i],d[i+w]+1);if(x)d[i]=Math.min(d[i],d[i+w-1]+Math.SQRT2);if(x+1<w)d[i]=Math.min(d[i],d[i+w+1]+Math.SQRT2);}}return d;}
 const palette=[[49,111,231],[29,185,181],[151,208,84],[247,182,46],[222,68,69]];
 function color(t){const k=Math.max(0,Math.min(1,t))*(palette.length-1),a=Math.min(palette.length-2,Math.floor(k)),f=k-a;return palette[a].map((v,i)=>Math.round(v+(palette[a+1][i]-v)*f));}
 function extent(features){const b=[Infinity,Infinity,-Infinity,-Infinity];const walk=c=>{if(typeof c[0]==='number'){const p=merc(c);b[0]=Math.min(b[0],p[0]);b[1]=Math.min(b[1],p[1]);b[2]=Math.max(b[2],p[0]);b[3]=Math.max(b[3],p[1]);}else c.forEach(walk)};features.forEach(f=>walk(f.geometry.coordinates));return b;}
 return{finite,merc,unmerc,box,blur,distance,color,extent,palette};
}
function DGWorkerMain(){
 const K=DGKernel();
 onmessage=e=>{const d=e.data;try{const start=performance.now(),fs=d.features.filter(f=>K.finite(f.value));if(!fs.length){postMessage({token:d.token,empty:true});return;}
 const rawExtent=K.extent(fs),lat=K.unmerc([(rawExtent[0]+rawExtent[2])/2,(rawExtent[1]+rawExtent[3])/2])[1],worldKm=40075.017*Math.cos(lat*Math.PI/180),padding=4*d.bandwidthKm/worldKm;
 const bounds=[rawExtent[0]-padding,rawExtent[1]-padding,rawExtent[2]+padding,rawExtent[3]+padding];const sx=bounds[2]-bounds[0],sy=bounds[3]-bounds[1],n=d.maxDimension||1024;
 const w=Math.max(96,Math.ceil(n*sx/Math.max(sx,sy))),h=Math.max(96,Math.ceil(n*sy/Math.max(sx,sy))),len=w*h,kmPerPx=Math.max(sx/w,sy/h)*worldKm,r=Math.max(1,Math.min(100,Math.round(d.bandwidthKm/kmPerPx))),limit=3*d.bandwidthKm/kmPerPx;
 const canv=new OffscreenCanvas(w,h),ctx=canv.getContext('2d',{willReadFrequently:true}),maskCanvas=new OffscreenCanvas(w,h),mc=maskCanvas.getContext('2d',{willReadFrequently:true});
 const pixel=c=>{const p=K.merc(c);return[(p[0]-bounds[0])*w/sx,(p[1]-bounds[1])*h/sy]};
 const draw=(c,g)=>{for(const polygon of g.type==='Polygon'?[g.coordinates]:g.coordinates){c.beginPath();for(const ring of polygon){ring.forEach((q,i)=>{const p=pixel(q);i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]);});c.closePath();}c.fill('evenodd');}};
 const output=new Uint8ClampedArray(len*4),values=new Float32Array(len),direct=new Uint8Array(len),strength=new Float32Array(len);values.fill(NaN);const lo=Math.min(...fs.map(f=>f.value)),hi=Math.max(...fs.map(f=>f.value)),range=hi-lo||1;
 for(const em of new Set(fs.map(f=>f.emirate))){const group=fs.filter(f=>f.emirate===em);ctx.clearRect(0,0,w,h);mc.clearRect(0,0,w,h);mc.fillStyle='white';for(const f of d.masks.filter(f=>f.emirate===em))draw(mc,f.geometry);for(const f of group)draw(mc,f.geometry);
 const shapeMask=mc.getImageData(0,0,w,h).data;
 group.forEach((f,j)=>{const id=j+1;ctx.fillStyle=`rgb(${id&255},${(id>>8)&255},${(id>>16)&255})`;draw(ctx,f.geometry);});const pixels=ctx.getImageData(0,0,w,h).data;
 const input=new Float32Array(len),weight=new Float32Array(len);for(let i=0;i<len;i++){const id=pixels[i*4]+(pixels[i*4+1]<<8)+(pixels[i*4+2]<<16);if(pixels[i*4+3]===255&&id>0&&id<=group.length){weight[i]=1;input[i]=(group[id-1].value-lo)/range;}}
 const nearest=K.distance(weight,w,h),num=K.blur(input,w,h,r),den=K.blur(weight,w,h,r);
 for(let i=0;i<len;i++){if(shapeMask[i*4+3]<240||den[i]<.008||nearest[i]>limit)continue;const t=Math.max(0,Math.min(1,num[i]/den[i])),fade=weight[i]?1:Math.pow(Math.max(0,1-nearest[i]/limit),.7),support=Math.min(1,den[i]*4)*fade;if(support<.035||support<strength[i])continue;
 strength[i]=support;values[i]=lo+t*range;direct[i]=weight[i]?1:0;const rgb=K.color(t);output[i*4]=rgb[0];output[i*4+1]=rgb[1];output[i*4+2]=rgb[2];output[i*4+3]=Math.round(255*support);}
 }
 const colors=new Set();let colored=0,interpolated=0;for(let i=0;i<len;i++)if(output[i*4+3]>0){colored++;if(!direct[i])interpolated++;colors.add((output[i*4]<<16)|(output[i*4+1]<<8)|output[i*4+2]);}
 postMessage({token:d.token,w,h,bounds,rgba:output,values,direct,lo,hi,colored,interpolated,colorCount:colors.size,renderTimeMs:Math.round(performance.now()-start),kmPerPx,bandwidthKm:d.bandwidthKm,supportRadiusKm:3*d.bandwidthKm},[output.buffer,values.buffer,direct.buffer]);
 }catch(error){postMessage({token:d.token,error:String(error)});}};
}

/* Continuous price/yield visualization. Raw source-area mode and all legacy controls remain. */
const dgK=DGKernel();
const dgState={mode:'gradient',bandwidthKm:1.5,worker:null,workerUrl:null,token:0,key:'',timer:0,result:null,empty:false,features:[],geographies:[],canvas:null,renderCount:0,error:null};
const dgVersion='20260923-gradient-v2';
const dgEligible=()=>dgState.mode==='gradient'&&axBenchmarkMetrics.has(state.analysisMetric)&&arState.scope==='community';
const dgGradientColors='linear-gradient(90deg,#316fe7 0%,#1db9b5 25%,#97d054 50%,#f7b62e 75%,#de4445 100%)';
function dgVisible(show){if(map.getLayer('dg-value-gradient'))map.setLayoutProperty('dg-value-gradient','visibility',show?'visible':'none');if(map.getLayer('dg-water-mask'))map.setLayoutProperty('dg-water-mask','visibility',show?'visible':'none');}
function dgHideAreas(){sgVisible(false);sgHideBubbles();for(const id of ['psr-community-analysis','psr-analysis-heat','roi-heat','roi-points','roi-labels'])if(map.getLayer(id))map.setLayoutProperty(id,'visibility','none');}
function dgSetDiagnostic(extra={}){window.__ESPACIOS_GRADIENT__={version:dgVersion,mode:dgState.mode,ready:!!dgState.result,active:dgEligible(),metric:state.analysisMetric,inputAreaCount:new Set(dgState.features.map(f=>f.id)).size,sourceFeatureCount:dgState.features.length,sourcePeriod:'H1 2026',sourceBasis:'Published area/type benchmarks, not individual transactions',method:'Normalized scalar convolution of matched source polygons; separate emirate support masks; continuous linear colour scale',bandwidthKm:dgState.bandwidthKm,renderCount:dgState.renderCount,colorCount:dgState.result?.colorCount||0,renderTimeMs:dgState.result?.renderTimeMs||null,missingData:'Unsupported areas transparent; limited visual interpolation is labelled, not stored as observed data',sampleAt:(lng,lat)=>dgSample(lng,lat),...extra};}
function dgNote(){const root=document.querySelector('#dg-status');if(root){root.textContent=dgState.error?'Gradient unavailable: '+dgState.error:!dgEligible()?(dgState.mode==='areas'?'Reported areas view: original values remain inspectable.':'This metric/level shows reported geographic totals. No spatially invented counts.'):(dgState.empty?'No sourced values with matched boundaries for this selection. No gradient has been invented.':dgState.result?new Set(dgState.features.map(f=>f.id)).size+' source areas · smooth numeric field · '+dgState.result.colorCount+' colour shades. Smoothing does not add observations.':'Building the gradient from sourced area values…');}
 const leg=document.querySelector('#ar-map-legend');if(!leg||!dgEligible())return;
 leg.querySelectorAll('.sg-legend-note,.dg-legend-note,.dg-source-toggle').forEach(n=>n.remove());const ramp=leg.querySelector('.ar-ramp');if(ramp){ramp.style.background=dgGradientColors;if(dgState.result&&ramp.nextElementSibling)ramp.nextElementSibling.textContent=axValue(dgState.result.lo,state.analysisMetric)+' — '+axValue(dgState.result.hi,state.analysisMetric);}
 const head=leg.querySelector('strong');if(head)head.textContent='Smooth gradient · '+(state.analysisMetric==='price-psf'?'AED / sqft':state.analysisMetric.startsWith('roi')?'Gross rental yield':'Average transaction reference');
 for(const small of leg.querySelectorAll('small'))small.textContent=small.textContent.replace('Grey = not reported.','Transparent = unsupported.').replace('distinct catalogue areas','catalogue / source areas');
 const info=document.createElement('small');info.className='dg-legend-note';info.textContent=dgState.result?'Data range '+axValue(dgState.result.lo,state.analysisMetric)+' — '+axValue(dgState.result.hi,state.analysisMetric)+'. Smooth visual interpolation, not a measured property value or forecast.':'Sourced area benchmarks; continuous rendering is loading.';leg.append(info);
 const a=document.createElement('button');a.type='button';a.className='dg-source-toggle';a.textContent='Compare with reported areas';a.onclick=()=>dgChangeMode('areas');leg.append(a);
}
function dgSetup(){if(document.querySelector('#dg-mode'))return;const at=document.querySelector('#ar-coverage');if(!at)return;
 const box=document.createElement('section');box.id='dg-controls';box.className='ar-block';box.innerHTML='<label>Map appearance<select id="dg-mode"><option value="gradient">Smooth data gradient</option><option value="areas">Reported area values</option></select></label><label>Blend distance <output id="dg-bandwidth-label">1.5 km</output><input id="dg-bandwidth" type="range" min="0.5" max="3" step="0.5" value="1.5" aria-label="Gradient blend distance in kilometres"></label><p id="dg-status" role="status"></p><details><summary>What drives the colours?</summary><p>Colour follows the selected numeric price or yield, not the number of pins. The same-period source benchmarks are drawn on their matched boundaries, then blended as a numeric field. All-types uses the selected summary of available types.</p><p>Hover shows the smoothed reference separately from the published area value. Limited edge interpolation fades out; unsupported geography stays transparent. This is not a property valuation, forecast, or newly observed price.</p><p>Counts and transaction totals keep their reported geographic basis; no transaction-density data is invented. Export values continues to export the source values, not raster pixels.</p></details>';
 at.before(box);document.querySelector('#dg-mode').onchange=e=>dgChangeMode(e.target.value);document.querySelector('#dg-bandwidth').oninput=e=>{dgState.bandwidthKm=Number(e.target.value);document.querySelector('#dg-bandwidth-label').textContent=e.target.value+' km';dgState.key='';dgSchedule();};
 const opacity=document.querySelector('#sg-opacity');if(opacity){opacity.max='85';opacity.value='62';sgState.opacity=.62;document.querySelector('#sg-opacity-label').textContent='62%';const old=opacity.oninput;opacity.oninput=e=>{old?.(e);if(map.getLayer('dg-value-gradient'))map.setPaintProperty('dg-value-gradient','raster-opacity',sgState.opacity);};}
 const scope=document.querySelector('#ar-scope');if(scope){const auto=[...scope.options].find(o=>o.value==='auto');if(auto)auto.textContent='Automatic · local evidence gradient';if(sgState.automatic&&axBenchmarkMetrics.has(state.analysisMetric)){arState.scope='community';axState.memo.clear();}}
 const reset=document.querySelector('#ax-reset'),prev=reset?.onclick;if(reset)reset.onclick=()=>{dgState.mode='gradient';document.querySelector('#dg-mode').value='gradient';dgState.key='';prev?.();dgSetLevel();dgSchedule();};dgNote();
}
function dgChangeMode(mode){dgState.mode=mode==='areas'?'areas':'gradient';document.querySelector('#dg-mode').value=dgState.mode;dgState.key='';dgSetLevel();if(!dgEligible())dgVisible(false);psrSetAnalysis(state.analysisMetric);dgSetDiagnostic();dgNote();}
function dgSetLevel(){if(!sgState.automatic)return;const next=dgState.mode==='gradient'&&axBenchmarkMetrics.has(state.analysisMetric)?'community':map.getZoom()<8.4?'emirate':'community';if(arState.scope!==next){arState.scope=next;axState.memo.clear();sgState.lastKey='';}}
function dgInputs(){const gs=axGeographies(),byKey=new Map(),ambiguous=new Set();for(const c of gs){const k=SG.key(c.emirate,c.name);if(byKey.has(k))ambiguous.add(k);else byKey.set(k,c);}const rows=[];for(const f of sgState.data.features){const p=f.properties;if(p.level==='emirate'||!p.emirate)continue;const k=SG.key(p.emirate,p.name),c=ambiguous.has(k)?null:byKey.get(k);if(!c)continue;const d=axDescribe(c,state.analysisMetric);if(!dgK.finite(d.value))continue;rows.push({id:c.id,name:c.name,emirate:SG.em(c.emirate),rank:p.rank||0,geometry:f.geometry,value:Number(d.value),sourceRows:d.rows||[],period:d.period,geometryId:f.id});}
 const maxRank=new Map();rows.forEach(f=>maxRank.set(f.id,Math.max(maxRank.get(f.id)||0,f.rank)));return{gs,features:rows.filter(f=>f.rank===maxRank.get(f.id)).sort((a,b)=>a.rank-b.rank),masks:sgState.data.features.filter(f=>f.properties.level==='emirate').map(f=>({geometry:f.geometry,emirate:SG.em(f.properties.emirate)}))};}
function dgSample(lng,lat){const r=dgState.result;if(!r||!dgEligible())return null;const p=dgK.merc([lng,lat]),x=Math.floor((p[0]-r.bounds[0])*r.w/(r.bounds[2]-r.bounds[0])),y=Math.floor((p[1]-r.bounds[1])*r.h/(r.bounds[3]-r.bounds[1]));if(x<0||x>=r.w||y<0||y>=r.h)return null;const i=y*r.w+x;if(!Number.isFinite(r.values[i]))return null;const direct=dgState.features.filter(f=>SG.contains([lng,lat],f.geometry)).at(-1);return{value:r.values[i],interpolated:true,sourceArea:direct?.name||null,reportedValue:direct?.value??null,evidenceId:direct?.id||null,period:direct?.period||'H1 2026',basis:direct?'Smoothed display reference; published area value shown separately':'Neighbourhood visual interpolation; no direct area observation here'};}
function dgAttach(result){let canvas=dgState.canvas;if(!canvas){canvas=document.createElement('canvas');canvas.id='dg-data-canvas';canvas.hidden=true;document.body.append(canvas);dgState.canvas=canvas;}canvas.width=result.w;canvas.height=result.h;canvas.getContext('2d').putImageData(new ImageData(result.rgba,result.w,result.h),0,0);
 const b=result.bounds,coordinates=[dgK.unmerc([b[0],b[1]]),dgK.unmerc([b[2],b[1]]),dgK.unmerc([b[2],b[3]]),dgK.unmerc([b[0],b[3]])];let source=map.getSource('dg-gradient-source');if(!source){map.addSource('dg-gradient-source',{type:'canvas',canvas,animate:false,coordinates});source=map.getSource('dg-gradient-source');}else source.setCoordinates(coordinates);
 const before=map.getLayer('waterway')?'waterway':map.getStyle().layers.find(l=>l.type==='symbol')?.id;if(!map.getLayer('dg-value-gradient'))map.addLayer({id:'dg-value-gradient',type:'raster',source:'dg-gradient-source',paint:{'raster-opacity':sgState.opacity,'raster-fade-duration':0,'raster-resampling':'linear'}},before);
 const water=map.getStyle().layers.find(l=>l.id==='water');if(water&&!map.getLayer('dg-water-mask'))map.addLayer({...water,id:'dg-water-mask'},before);if(water&&map.getLayer('dg-water-mask'))for(const [k,v]of Object.entries(water.paint||{}))map.setPaintProperty('dg-water-mask',k,v);
 // Canvas is uploaded on a change, not through a perpetual animation loop.
 source.play();map.once('render',()=>source.pause());map.triggerRepaint();dgVisible(dgEligible());if(dgEligible())dgHideAreas();}
function dgWorker(){if(dgState.worker)return dgState.worker;if(typeof Worker!=='function'||typeof OffscreenCanvas!=='function')throw Error('This browser cannot render the off-thread gradient. Reported areas remain available.');const js=DGKernel.toString()+'\n('+DGWorkerMain.toString()+')();';const url=URL.createObjectURL(new Blob([js],{type:'application/javascript'}));dgState.workerUrl=url;const worker=new Worker(url);dgState.worker=worker;worker.onmessage=e=>{const d=e.data;if(d.token!==dgState.token)return;if(d.error){dgState.error=d.error;dgState.key='';dgNote();dgSetDiagnostic({error:d.error});return;}if(d.empty)return;dgState.error=null;dgState.result=d;dgState.renderCount++;if(dgEligible()){dgAttach(d);dgNote();}dgSetDiagnostic();};worker.onerror=e=>{dgState.error=e.message||'Worker failed';dgState.key='';dgNote();dgSetDiagnostic({error:dgState.error});};return worker;}
function dgRender(){if(!dgEligible()||!sgState.data||!arState.catalogue)return;const input=dgInputs(),features=input.features;const key=[state.analysisMetric,arState.segment,axState.custom.join(','),axState.aggregation,dgState.bandwidthKm,sgState.geoGeneration,...features.map(f=>f.geometryId+':'+f.value)].join('|');dgState.features=features;dgState.geographies=input.gs;if(key===dgState.key&&dgState.result){if(!map.getSource('dg-gradient-source'))dgAttach(dgState.result);else dgVisible(true);dgNote();return;}dgState.key=key;dgState.token++;dgState.result=null;dgState.empty=!features.length;dgVisible(false);dgSetDiagnostic();if(!features.length){dgState.empty=true;dgState.error=null;dgSetDiagnostic({ready:true,empty:true,inputAreaCount:0});const root=document.querySelector('#dg-status');if(root)root.textContent='No sourced values with matched boundaries for this selection. No gradient has been invented.';dgNote();return;}
 try{dgWorker().postMessage({token:dgState.token,features:features.map(({sourceRows,...f})=>f),masks:input.masks,bandwidthKm:dgState.bandwidthKm,maxDimension:1024});}catch(e){dgState.error=e.message;dgNote();dgSetDiagnostic({error:e.message});}}
function dgSchedule(){clearTimeout(dgState.timer);dgState.timer=setTimeout(dgRender,140);}
const dgOriginalSetup=arSetup;arSetup=function(){dgOriginalSetup();dgSetup();};
const dgOriginalLevel=sgSetLevel;sgSetLevel=function(){if(dgState.mode==='gradient'&&axBenchmarkMetrics.has(state.analysisMetric)){dgSetLevel();if(dgEligible())dgSchedule();}else dgOriginalLevel();};
const dgOriginalPaint=sgPaint;sgPaint=function(metric){dgSetup();if(dgEligible()){dgHideAreas();sgLoad();dgSchedule();dgNote();dgSetDiagnostic();}else{dgVisible(false);dgOriginalPaint(metric);dgNote();dgSetDiagnostic();}};
const dgOriginalSet=psrSetAnalysis;psrSetAnalysis=function(metric){if(sgState.automatic){arState.scope=dgState.mode==='gradient'&&axBenchmarkMetrics.has(metric)?'community':map.getZoom()<8.4?'emirate':'community';axState.memo.clear();}dgOriginalSet(metric);if(!dgEligible())dgVisible(false);dgNote();dgSetDiagnostic();};
const dgOriginalTooltip=sgTooltip;sgTooltip=function(e){if(!dgEligible())return dgOriginalTooltip(e);const t=document.querySelector('#sg-tooltip');if(!t||!e.point||map.isMoving?.())return sgHideTooltip();const pins=['project-hit','project-clusters','initiative-hit','place-hit','place-clusters','project-footprint-extrusions','dg-water-mask'].filter(id=>map.getLayer(id));if(pins.length&&map.queryRenderedFeatures([e.point.x,e.point.y],{layers:pins}).length)return sgHideTooltip();const ll=map.unproject([e.point.x,e.point.y]),s=dgSample(ll.lng,ll.lat);if(!s)return sgHideTooltip();t.innerHTML='<strong>'+esc(s.sourceArea||'Interpolated neighbourhood')+'</strong><b>'+esc(axValue(s.value,state.analysisMetric))+' · smoothed reference</b>'+(s.reportedValue!==null?'<small>Published area value: '+esc(axValue(s.reportedValue,state.analysisMetric))+'</small>':'')+'<small>'+esc(s.period+' · '+s.basis)+'</small><small>Visual interpolation, not a measured property value or forecast. Inspect source values in Analyze.</small>';t.style.width=Math.min(300,innerWidth-24)+'px';t.hidden=false;t.style.left=Math.max(12,Math.min(innerWidth-t.offsetWidth-12,e.point.x+16))+'px';t.style.top=Math.max(12,Math.min(innerHeight-t.offsetHeight-12,e.point.y+16))+'px';};
map.on('style.load',()=>{if(dgState.result&&dgEligible())setTimeout(()=>dgAttach(dgState.result),120);});
new MutationObserver(()=>{if(dgEligible()&&dgState.result){dgAttach(dgState.result);dgNote();}}).observe(document.documentElement,{attributes:true,attributeFilter:['data-espacios-theme']});
setTimeout(()=>{dgSetup();dgSetLevel();if(dgEligible())arPaint(state.analysisMetric);},1200);

/* Pure timeline math: no implicit dates, nulls or fabricated observations. */
function TLCore(){
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 const palette=[[49,111,231],[29,185,181],[151,208,84],[247,182,46],[222,68,69]];
 const changePalette=[[200,62,70],[224,229,236],[26,158,134]];
 function color(v,domain,change=false){if(!finite(v))return 'rgba(0,0,0,0)';const t=domain[1]===domain[0]?.5:Math.max(0,Math.min(1,(v-domain[0])/(domain[1]-domain[0]))),p=change?changePalette:palette,k=t*(p.length-1),a=Math.min(p.length-2,Math.floor(k)),f=k-a;return 'rgb('+p[a].map((x,i)=>Math.round(x+(p[a+1][i]-x)*f)).join(',')+')';}
 function change(a,b,points=false){return finite(a)&&finite(b)&&(points||b>0)?points?a-b:100*(a/b-1):null;}
 function scenario(v,rate,years,yieldMetric=false){if(!finite(v)||!finite(rate)||!finite(years)||years<0||years>20)return null;if(yieldMetric){const n=v+rate*years;return n>=0&&n<=100?n:null;}return rate> -100?v*Math.pow(1+rate/100,years):null;}
 function domain(vals,diverging=false){const a=vals.filter(finite);if(!a.length)return[0,1];if(diverging){const m=Math.max(1,...a.map(Math.abs));return[-m,m];}const lo=Math.min(...a),hi=Math.max(...a);return lo===hi?[Math.min(0,lo),hi||1]:[lo,hi];}
 function quarterPeriods(first,last){const p=s=>{const m=/^(\d{4})Q([1-4])$/.exec(s);return m?Number(m[1])*4+Number(m[2])-1:null;},a=p(first),b=p(last);if(a===null||b===null||b<a||b-a>400)return[];return Array.from({length:b-a+1},(_,i)=>Math.floor((a+i)/4)+'Q'+((a+i)%4+1));}
 function periodLabel(s){const m=/^(\d{4})Q([1-4])$/.exec(s);return m?'Q'+m[2]+' '+m[1]:s==='2026H1'?'H1 2026':s;}
 function periodEnd(s){const m=/^(\d{4})Q([1-4])$/.exec(s);return m?new Date(Date.UTC(Number(m[1]),Number(m[2])*3,0)).toISOString().slice(0,10):s==='2026H1'?'2026-06-30':/^\d{4}$/.test(s)?s+'-12-31':s;}
 function comparable(a,b){return a&&b&&a.metric===b.metric&&a.geographyId===b.geographyId&&a.segment===b.segment&&a.frequency===b.frequency&&a.dataset===b.dataset;}
 function csv(rows){return rows.map(r=>r.map(v=>{let s=v==null?'':String(v);if(/^[=+@\-]/.test(s)&&!/^[-+]?\d+(\.\d+)?$/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');}
 return{finite,palette,changePalette,color,change,scenario,domain,quarterPeriods,periodLabel,periodEnd,comparable,csv};
}
if(typeof module!=='undefined')module.exports={TLCore};

/* Espacios temporal dock: state and date labels are shared by legend, frame and export. */
const tlK=TLCore();
const tlState={version:'20260923-timeline-v1',mode:'history',view:'value',catalogue:null,cache:new Map(),series:[],periods:['2026H1'],period:'2026H1',baseline:'2026H1',scope:'district',type:'all',rate:null,speed:1200,playing:false,timer:0,request:0,frame:[],domain:[0,1],unit:'AED/sqft',source:null,loading:false,message:'',baseGradient:null,scenarioResult:null,ready:false,selectedArea:'',renderTimer:0};
const tlQ=s=>document.querySelector(s),tlHist=()=>state.analysisMetric?.startsWith('history:'),tlMetric=()=>tlHist()?state.analysisMetric.slice(8):state.analysisMetric,tlBench=()=>axBenchmarkMetrics.has(state.analysisMetric),tlActive=()=>tlHist()||tlState.mode!=='history';
const tlOldSet=psrSetAnalysis,tlOldDgAttach=dgAttach,tlOldDgNote=dgNote,tlOldDgSample=dgSample,tlOldSgTooltip=sgTooltip;
function tlText(v,unit=tlState.unit){if(!tlK.finite(v))return 'Not reported';const n=Number(v).toLocaleString(undefined,{maximumFractionDigits:unit==='%'||unit==='pp'?2:0});return unit==='AED/sqft'?n+' /sqft':unit==='AED'?'AED '+n:unit==='%'||unit==='pp'?n+' '+unit:n;}
function tlType(){const t=arState.segment||'all';return t==='custom'?axState.custom.join(', '):t==='all'?'All property types':AX.labels[t]||t;}
function tlHideCustom(){for(const l of ['tl-history-fill','tl-history-outline'])if(map.getLayer(l))map.setLayoutProperty(l,'visibility','none');tlQ('#tl-tooltip')?.setAttribute('hidden','');}
function tlStop(){clearInterval(tlState.timer);tlState.playing=false;const b=tlQ('#tl-play');if(b){b.textContent='Play';b.setAttribute('aria-pressed','false');}if(tlState.ready)tlDiagnostic();}
function tlHideOld(){dgVisible(false);sgVisible(false);sgHideBubbles();for(const id of ['psr-analysis-heat','psr-community-analysis','psr-emirate-analysis','roi-heat','roi-points','roi-labels','ae-emerging-hotspots-glow','ae-emerging-hotspots-core','ae-emerging-hotspots-label'])if(map.getLayer(id))map.setLayoutProperty(id,'visibility','none');}
function tlSetPeriods(periods){const old=tlState.period;tlState.periods=periods.length?periods:['Unavailable'];if(!tlState.periods.includes(old)){tlState.period=tlState.periods.at(-1);tlState.message='Period changed to the latest available for this metric.';}if(!tlState.periods.includes(tlState.baseline))tlState.baseline=tlState.periods[Math.max(0,tlState.periods.length-5)];const dates=tlQ('#tl-date'),base=tlQ('#tl-baseline');for(const el of [dates,base])if(el)el.innerHTML=tlState.periods.map(p=>'<option value="'+esc(p)+'">'+esc(tlK.periodLabel(p))+'</option>').join('');if(dates)dates.value=tlState.period;if(base)base.value=tlState.baseline;const slider=tlQ('#tl-slider');if(slider){slider.max=String(Math.max(0,tlState.periods.length-1));slider.value=String(Math.max(0,tlState.periods.indexOf(tlState.period)));slider.disabled=tlState.periods.length<2;slider.setAttribute('aria-valuetext',tlK.periodLabel(tlState.period));}tlQ('#tl-play').disabled=tlState.periods.length<2;}
function tlDiagnostic(){window.__ESPACIOS_TIMELINE__={version:tlState.version,ready:tlState.ready,metric:state.analysisMetric,mode:tlState.mode,view:tlState.view,period:tlState.period,baseline:tlState.baseline,domain:tlState.domain.slice(),unit:tlState.unit,frames:tlState.periods.length,loadedSeries:tlState.series.length,visibleValues:tlState.frame.filter(r=>tlK.finite(r.value)).length,sourceVersion:tlState.catalogue?.version||null,loading:tlState.loading,rate:tlState.rate,playing:tlState.playing,frame:()=>tlState.frame.map(r=>({...r})),series:()=>tlState.series,periods:()=>tlState.periods.slice()};}
function tlResize(){const d=tlQ('#tl-dock');if(!d)return;const b=d.getBoundingClientRect();document.documentElement.style.setProperty('--tl-clear',Math.ceil(innerHeight-b.top+12)+'px');}
function tlLegend(){if(!tlQ('#tl-dock'))return;const hist=tlHist(),bench=tlBench(),mode=tlState.mode,changed=tlState.view==='change'&&tlActive();let legacyLegend=false;let title=tlQ('#analysis-metric')?.selectedOptions[0]?.textContent||'Map analysis',domain=tlState.domain,unit=tlState.unit,badge=mode==='scenario'?'SCENARIO':mode==='delivery'?'REPORTED SCHEDULE':mode==='forecast'?'MODEL UNAVAILABLE':'REPORTED';let note='',palette=changed?tlK.changePalette:tlK.palette;
 if(!tlActive()){
  if(bench&&dgState.mode==='gradient'){const r=dgState.result;domain=r?[r.lo,r.hi]:[0,1];unit=state.analysisMetric.startsWith('roi')?'%':state.analysisMetric==='price-psf'?'AED/sqft':'AED';badge='SMOOTHED REFERENCE';note='H1 2026 only · '+tlType()+' · '+(r?new Set(dgState.features.map(f=>f.id)).size+' source areas':'loading')+' · transparent = unsupported, not zero.';}
  else{legacyLegend=true;const l=tlQ('#ar-map-legend');note=l?.textContent?.slice(0,230)||tlQ('#analysis-legend')?.textContent||'Original layer and controls remain available.';const vals=arOwned.has(state.analysisMetric)?axGeographies().map(c=>axDescribe(c,state.analysisMetric).value).filter(tlK.finite):[];domain=tlK.domain(vals);unit=state.analysisMetric.startsWith('roi')?'%':['price','avg-transaction','transaction-value'].includes(state.analysisMetric)?'AED':state.analysisMetric==='price-psf'?'AED/sqft':'';}
  tlState.domain=domain;tlState.unit=unit;
 }else if(mode==='scenario'){title='Hypothetical '+(state.analysisMetric.startsWith('roi')?'rental yield':'price reference');note=tlState.rate===null?'Enter an explicit annual assumption in Timeline settings; no forecast is implied.':'Uniform '+tlState.rate+(state.analysisMetric.startsWith('roi')?' pp/year':'%/year')+' assumption from H1 2026; no predicted market growth. Transparent = unsupported.';}
 else if(mode==='delivery'){title='Reported handover schedule · project records';note='Catalogue targets for '+tlState.period+'; not units or guaranteed completions. '+tlState.frame.filter(r=>tlK.finite(r.value)).length+' supported community groups.';}
 else if(mode==='forecast'){note='No approved local price/rent forecast. Available horizons are selectable; missing estimates are not zero. Existing Forecast panel retains model-readiness details.';}
 else{const total=tlState.frame.length,known=tlState.frame.filter(r=>tlK.finite(r.value)).length;note='Ajman · '+tlState.scope+' source groups · '+known+'/'+total+' with values · '+(tlState.loading?'loading':tlState.message||'Missing periods and blocked groups are not zero.');}
 if(changed){title='Change from '+tlK.periodLabel(tlState.baseline)+' · '+title;unit='%';if(mode==='scenario'&&state.analysisMetric.startsWith('roi'))unit='pp';}
 tlQ('#tl-title').textContent=title;tlQ('#tl-badge').textContent=badge;const colors=palette.map(p=>'rgb('+p.join(',')+')');tlQ('#tl-scale').style.background='linear-gradient(90deg,'+colors.join(',')+')';const ticks=Array.from({length:5},(_,i)=>domain[0]+(domain[1]-domain[0])*i/4);tlQ('#tl-ticks').innerHTML=ticks.map((v,i)=>'<span title="'+esc(tlText(v,unit))+'">'+esc(tlText(v,unit))+'</span>').join('');tlQ('#tl-scale').setAttribute('aria-label',(changed?'Decline to increase':'Low to high')+'; '+unit+'; '+ticks.map(v=>tlText(v,unit)).join(', '));if(legacyLegend&&arOwned.has(state.analysisMetric)){const vals=axGeographies().map(c=>axDescribe(c,state.analysisMetric).value).filter(tlK.finite).sort((a,b)=>a-b);const cuts=[.25,.5,.75].map(q=>vals.length?vals[Math.floor((vals.length-1)*q)]:0);tlQ('#tl-scale').style.background='linear-gradient(90deg,'+arColors.map((c,i)=>c+' '+(25*i)+'%,'+c+' '+(25*(i+1))+'%').join(',')+')';tlQ('#tl-ticks').innerHTML=(vals.length?[vals[0],...cuts,vals.at(-1)]:[]).map(v=>'<span>'+esc(tlText(v,unit))+'</span>').join('');tlQ('#tl-scale').setAttribute('aria-label','Reported value categories with quartile boundaries; '+unit);legacyLegend=false;}if(legacyLegend){const old=tlQ('#ar-map-legend .ar-ramp')||tlQ('#analysis-legend .analysis-scale');if(old)tlQ('#tl-scale').style.background=getComputedStyle(old).backgroundImage;tlQ('#tl-ticks').innerHTML='<span>Lower</span><span></span><span>Reported layer</span><span></span><span>Higher</span>';tlQ('#tl-scale').setAttribute('aria-label','Original analytical layer scale; inspect values in Analyze.');}if(tlActive()&&(mode==='forecast'||!tlState.frame.some(r=>tlK.finite(r.value)))){tlQ('#tl-ticks').innerHTML='<span>No supported values for this selection</span>';tlQ('#tl-scale').style.background='repeating-linear-gradient(135deg,rgba(128,140,155,.25) 0 5px,transparent 5px 10px)';}tlQ('#tl-note').textContent=note;tlQ('#tl-date').value=tlState.period;const slider=tlQ('#tl-slider');slider.value=String(Math.max(0,tlState.periods.indexOf(tlState.period)));slider.setAttribute('aria-valuetext',tlK.periodLabel(tlState.period)+' · '+badge);tlQ('#tl-prev').disabled=tlState.periods.indexOf(tlState.period)<=0;tlQ('#tl-next').disabled=tlState.periods.indexOf(tlState.period)>=tlState.periods.length-1;
 const gaps=tlQ('#tl-gaps');gaps.innerHTML=tlState.periods.map(p=>{const available=hist?tlState.series.some(s=>s.points.some(x=>x.period===p&&tlK.finite(x.value))):mode!=='forecast';return'<i class="'+(available?'':'missing')+'" title="'+esc(tlK.periodLabel(p)+(available?'':' · unavailable'))+'"></i>';}).join('');tlQ('#tl-assumption-wrap').hidden=mode!=='scenario';tlQ('#tl-type').value=arState.segment||'all';tlQ('#tl-baseline').disabled=mode==='forecast'||mode==='delivery'||mode==='scenario'||!hist;tlQ('#tl-view').disabled=mode==='forecast'||mode==='delivery'||(!hist&&mode!=='scenario');tlQ('#tl-scope').disabled=!hist;tlQ('#tl-focus').hidden=!hist;tlQ('#tl-controls-mode').value=mode;tlQ('#tl-controls-mode option[value=scenario]').disabled=!bench;tlQ('#tl-metric').value=state.analysisMetric;tlDiagnostic();tlResize();}
function tlPoint(s,p){return s?.points.find(x=>x.period===p)||null;}
function tlRows(period){return tlState.series.map(s=>{const p=tlPoint(s,period),b=tlPoint(s,tlState.baseline),raw=p?.value??null,base=b?.value??null;return{id:s.geographyId,name:s.geography,segment:s.segment,metric:s.metric,period,unit:s.unit,source:s.dataset,geometryIds:s.geometryIds||[],rawValue:raw,baselineValue:base,value:tlState.view==='change'?tlK.change(raw,base):raw,sourceRows:p?.sourceRows||0,eventCount:p?.eventCount??null,reason:p?.value===null?'Withheld: '+p.quality:!p?'No observation in this period':tlState.view==='change'&&(!tlK.finite(base)||base<=0)?'Missing or non-positive comparison baseline':null,basis:s.basis};});}
async function tlLoadHistory(){const metric=tlMetric(),selected=arState.segment||'all',segment=selected==='custom'?axState.custom.join(','):selected,scope=tlState.scope,token=++tlState.request;tlState.pendingKey=[metric,segment,scope].join('|');tlState.loading=true;tlState.message='';tlState.frame=[];tlHideOld();tlHideCustom();tlLegend();try{
 const types=selected==='custom'?axState.custom:[selected];if(!types.length)throw Error('Choose at least one property type');const key=[metric,segment,scope].join('|');let series=tlState.cache.get(key);if(!series){const responses=await Promise.all(types.map(t=>fetch('/map/api/history?metric='+encodeURIComponent(metric)+'&segment='+encodeURIComponent(t)+'&scope='+scope+'&v=20260923-history-v1').then(r=>{if(!r.ok)throw Error('History service '+r.status);return r.json();})));if(responses.some(r=>r.version!==tlState.catalogue.version))throw Error('History version mismatch');series=responses.flatMap(r=>r.series);if(types.length>1)series=tlCombine(series,types);tlState.cache.set(key,series);}await sgLoad();if(token!==tlState.request||!tlHist())return;tlState.series=series;tlState.loadedKey=[metric,segment,scope].join('|');
 const meta=tlState.catalogue.metrics.find(m=>m.id===metric),periods=meta.frequency==='quarter'?tlK.quarterPeriods(meta.periods[0],meta.periods.at(-1)):meta.periods;tlState.source=tlState.catalogue.sources.find(s=>s.id===meta.dataset);tlState.unit=meta.unit;tlSetPeriods(periods);tlState.loading=false;tlState.message=series.length?'Source-defined population; not all emirate transactions.':'No compatible records for these property types.';tlRenderHistory();
 }catch(e){if(token!==tlState.request)return;tlState.loading=false;tlState.message=e.message;tlState.series=[];tlState.frame=[];tlLegend();}}
function tlCombine(series,types){const groups=new Map();for(const s of series){const k=s.geographyId;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(s);}return[...groups.values()].map(g=>{const base=g[0],periods=[...new Set(g.flatMap(s=>s.points.map(p=>p.period)))].sort();return{...base,id:base.id+':custom',segment:types.join('+'),points:periods.map(period=>{const ps=types.map(t=>tlPoint(g.find(s=>s.segment===t),period));if(ps.some(p=>!tlK.finite(p?.value)))return{period,value:null,quality:'withheld_incomplete_custom_basket'};const count=ps.reduce((n,p)=>n+(p.eventCount||0),0),average=base.metric.endsWith('average');return{period,value:average?(count?ps.reduce((n,p)=>n+p.value*p.eventCount,0)/count:null):ps.reduce((n,p)=>n+p.value,0),eventCount:count,sourceRows:ps.reduce((n,p)=>n+(p.sourceRows||0),0),quality:'accepted_custom_basket'};})};});}
function tlDraw(frame){tlState.frame=frame;tlHideOld();const by=new Map((sgState.data?.features||[]).map(f=>[String(f.id),f])),features=[];for(const r of frame)if(tlK.finite(r.value))for(const id of r.geometryIds||[]){const f=by.get(String(id));if(f)features.push({...f,properties:{tlId:r.id,name:r.name,value:r.value,raw:r.rawValue,period:r.period,unit:tlState.unit,color:tlK.color(r.value,tlState.domain,tlState.view==='change'),source:r.source||'',basis:r.basis||''}});}
 const data={type:'FeatureCollection',features};if(!map.getSource('tl-history-polygons'))map.addSource('tl-history-polygons',{type:'geojson',data});else map.getSource('tl-history-polygons').setData(data);const before=map.getLayer('project-hit')?'project-hit':undefined;if(!map.getLayer('tl-history-fill'))map.addLayer({id:'tl-history-fill',type:'fill',source:'tl-history-polygons',paint:{'fill-color':['get','color'],'fill-opacity':.52}},before);if(!map.getLayer('tl-history-outline'))map.addLayer({id:'tl-history-outline',type:'line',source:'tl-history-polygons',paint:{'line-color':['get','color'],'line-opacity':.8,'line-width':1}},before);for(const id of ['tl-history-fill','tl-history-outline'])map.setLayoutProperty(id,'visibility','visible');tlLegend();tlEvidence();}
function tlRenderHistory(){if(tlState.loading||!tlHist())return;const vals=tlState.periods.flatMap(p=>tlRows(p).map(r=>r.value));tlState.domain=tlK.domain(vals,tlState.view==='change');tlState.unit=tlState.view==='change'?'%':tlState.catalogue.metrics.find(m=>m.id===tlMetric())?.unit||'';tlDraw(tlRows(tlState.period));}
function tlScenario(base=dgState.result){if(tlState.mode!=='scenario'||!tlBench())return;tlHideCustom();const rate=tlState.rate,years=(Date.parse(tlK.periodEnd(tlState.period))-Date.parse('2026-06-30'))/86400000/365.25,yieldMetric=state.analysisMetric.startsWith('roi');if(!base||rate===null){dgVisible(false);tlState.scenarioResult=null;tlState.frame=[];tlLegend();return;}
 const baseRate=p=>tlK.scenario(p,rate,Math.max(0,years),yieldMetric),vals=[base.lo,base.hi].flatMap(v=>[v,tlK.scenario(v,rate,3,yieldMetric)]),change=tlState.view==='change';tlState.domain=change?tlK.domain([yieldMetric?rate*3:100*(Math.pow(1+rate/100,3)-1)],true):tlK.domain(vals);tlState.unit=change?(yieldMetric?'pp':'%'):yieldMetric?'%':state.analysisMetric==='price-psf'?'AED/sqft':'AED';
 const rgba=new Uint8ClampedArray(base.rgba.length),values=new Float32Array(base.values.length);values.fill(NaN);for(let i=0;i<base.values.length;i++){if(!Number.isFinite(base.values[i])||!base.rgba[i*4+3])continue;let v=baseRate(base.values[i]);if(!tlK.finite(v))continue;if(change)v=tlK.change(v,base.values[i],yieldMetric);if(!tlK.finite(v))continue;values[i]=v;const col=tlK.color(v,tlState.domain,change).match(/\d+/g).map(Number);rgba.set([...col,base.rgba[i*4+3]],i*4);}
 const rendered={...base,rgba,values,lo:tlState.domain[0],hi:tlState.domain[1]};tlState.scenarioResult=rendered;tlOldDgAttach(rendered);dgHideAreas();dgVisible(true);tlState.frame=dgState.features.map(f=>({...f,rawValue:f.value,baselineValue:f.value,value:change?tlK.change(baseRate(f.value),f.value,yieldMetric):baseRate(f.value),period:tlState.period,basis:'Uniform user-entered scenario, not a model forecast',source:'H1 2026 benchmark'}));tlLegend();tlEvidence();}
function tlDelivery(){const ps=arState.catalogue?.projects||[],groups=arState.catalogue?.communities||[],year=Number(tlState.period),byId=new Map(ps.map(p=>[p.id,p])),types=arState.segment==='custom'?axState.custom:arState.segment==='all'?null:[arState.segment];const selected=p=>!types||types.some(t=>(p.propertyTypes||[]).some(x=>AX.typeKey(x)===t));const eligible=p=>p&&!p.archived&&p.timeline==='future'&&p.handoverWindow?.year&&selected(p);const all=groups.map(c=>{const pool=(c.projectIds||[]).map(id=>byId.get(id)).filter(eligible);const shapes=(sgState.data?.features||[]).filter(f=>f.properties.level!=='emirate'&&SG.key(f.properties.emirate,f.properties.name)===SG.key(c.emirate,c.name));return{id:c.id,name:c.name,geometryIds:shapes.map(f=>f.id),pool};});tlState.domain=[0,Math.max(1,...all.flatMap(c=>tlState.periods.map(y=>c.pool.filter(p=>p.handoverWindow.year===Number(y)).length)))];tlState.unit='projects';tlDraw(all.map(c=>({id:c.id,name:c.name,geometryIds:c.geometryIds,value:c.pool.length?c.pool.filter(p=>p.handoverWindow.year===year).length:null,rawValue:c.pool.filter(p=>p.handoverWindow.year===year).length,period:String(year),source:'Espacios catalogue',basis:'Reported future project schedules; not units or guaranteed delivery',sourceRows:c.pool.length})));}
function tlUpdate(){if(!tlState.ready)return;if(tlState.mode==='history'){if(tlHist())tlRenderHistory();else{tlHideCustom();tlLegend();tlEvidence();}}else if(tlState.mode==='scenario')tlScenario();else if(tlState.mode==='delivery')tlDelivery();else{tlHideOld();tlHideCustom();tlState.frame=[];tlState.domain=[0,1];tlLegend();tlEvidence();}}
function tlMode(mode){if(mode==='scenario'&&!tlBench()){tlState.message='Future scenarios require a price or gross-yield benchmark; the selected metric has not been substituted.';tlLegend();return;}tlStop();tlState.mode=mode;tlState.request++;if(mode==='history'){tlState.scenarioResult=null;if(tlHist())tlLoadHistory();else{tlSetPeriods(tlBench()?['2026H1']:['Current']);tlOldSet(state.analysisMetric);if(dgState.result&&dgEligible())tlOldDgAttach(dgState.result);tlUpdate();}}
 else if(mode==='scenario'){if(!tlBench()){state.analysisMetric='price-psf';tlQ('#analysis-metric').value='price-psf';tlOldSet('price-psf');}tlState.baseGradient=dgState.result;tlState.period='2027Q2';tlState.baseline='2026Q2';tlSetPeriods(tlK.quarterPeriods('2026Q2','2029Q2'));tlUpdate();}
 else if(mode==='delivery'){tlState.view='value';tlQ('#tl-view').value='value';tlState.period=String(new Date().getUTCFullYear());tlSetPeriods(Array.from({length:11},(_,i)=>String(new Date().getUTCFullYear()+i)));tlUpdate();}
 else{tlState.period='12 months';tlSetPeriods(['12 months','24 months','36 months']);tlUpdate();}tlLegend();}
function tlChooseDate(p){if(!tlState.periods.includes(p))return;tlState.period=p;clearTimeout(tlState.renderTimer);tlState.renderTimer=setTimeout(tlUpdate,50);tlQ('#tl-date').value=p;tlQ('#tl-slider').setAttribute('aria-valuetext',tlK.periodLabel(p));}
function tlStep(delta){const at=tlState.periods.indexOf(tlState.period),i=Math.max(0,Math.min(tlState.periods.length-1,at+delta));tlChooseDate(tlState.periods[i]);}
function tlPlay(){if(tlState.playing){tlStop();return;}if(tlState.periods.length<2)return;tlState.playing=true;tlDiagnostic();tlQ('#tl-play').textContent='Pause';tlQ('#tl-play').setAttribute('aria-pressed','true');if(tlState.period===tlState.periods.at(-1))tlChooseDate(tlState.periods[0]);tlState.timer=setInterval(()=>{if(tlState.period===tlState.periods.at(-1)){tlStop();return;}tlStep(1);},tlState.speed);}
function tlEvidence(){let box=tlQ('#tl-evidence');const at=tlQ('#analysis-heat-view');if(!box&&at){box=document.createElement('section');box.id='tl-evidence';at.append(box);}if(!box)return;
 if(!tlActive()){box.innerHTML='<h3>Time and source evidence</h3><p>Only H1 2026 area/type price benchmarks are available for this layer. No earlier months are invented.</p><p>Use the visible timeline settings for official activity history, reported schedules or explicit future scenarios.</p><p><a href="/map/history">Government history and source register</a></p>';return;}
 const fr=tlState.frame,area=fr.find(r=>r.id===tlState.selectedArea)||fr.find(r=>tlK.finite(r.value))||fr[0];if(!area){box.innerHTML='<h3>'+esc(tlState.mode==='forecast'?'Forecast evidence':'Time and source evidence')+'</h3><p>'+esc(tlState.message||'No value is supported for this selection. Forecasts have not been approved; use explicit scenarios separately.')+'</p><a href="/map/intelligence">Model readiness and sources</a>';return;}
 const rows=tlHist()?tlState.series.find(s=>s.geographyId===area.id)?.points||[]:[];const d=tlK.domain(rows.map(p=>p.value)),lo=d[0],hi=d[1],periods=tlState.periods;let path='',open=false;for(let i=0;i<periods.length;i++){const p=rows.find(r=>r.period===periods[i]);if(!tlK.finite(p?.value)){open=false;continue;}const x=8+284*i/Math.max(1,periods.length-1),y=95-80*(p.value-lo)/(hi-lo||1);path+=(open?'L':'M')+x.toFixed(1)+','+y.toFixed(1)+' ';open=true;}
 const src=tlState.source;box.innerHTML='<h3>'+esc(tlK.periodLabel(tlState.period))+' · '+esc(tlState.mode)+'</h3><label>Inspect an area<select id="tl-inspect-area">'+fr.map(r=>'<option value="'+esc(r.id)+'" '+(r.id===area.id?'selected':'')+'>'+esc(r.name)+'</option>').join('')+'</select></label><p><b>'+esc(area.name)+': '+esc(tlText(area.value))+'</b><br>'+esc(area.reason||area.basis||'')+'</p>'+(rows.length?'<svg viewBox="0 0 300 110" role="img" aria-label="Recorded series; missing periods break the line"><path d="'+path+'" stroke="currentColor" fill="none" stroke-width="2"/></svg><details><summary>Recorded periods and values</summary><table><thead><tr><th>Period</th><th>Value</th><th>Source rows</th></tr></thead><tbody>'+periods.map(p=>{const r=rows.find(x=>x.period===p);return'<tr><td>'+esc(tlK.periodLabel(p))+'</td><td>'+esc(tlText(r?.value,tlState.catalogue.metrics.find(m=>m.id===tlMetric())?.unit||''))+'</td><td>'+esc(r?.sourceRows??'—')+'</td></tr>';}).join('')+'</tbody></table></details>':'')+(src?'<p><a href="'+esc(src.url)+'" target="_blank" rel="noopener">'+esc(src.publisher+' · '+src.title)+'</a><br><a href="'+esc(src.licenceUrl)+'">CC BY 4.0</a> · normalized by Espacios; no official endorsement.</p>':'')+'<a href="/map/history">Full government history and source register</a>';tlQ('#tl-inspect-area').onchange=e=>{tlState.selectedArea=e.target.value;tlEvidence();};}
function tlExport(){if(!tlActive()){axExport();return;}const rows=[['area','metric','period','mode','view','selected_types','value','unit','reported_value','baseline_value','source','basis'],...tlState.frame.map(r=>[r.name,state.analysisMetric,tlState.period,tlState.mode,tlState.view,tlType(),r.value,tlState.unit,r.rawValue,r.baselineValue,r.source,r.basis])],u=URL.createObjectURL(new Blob(['\uFEFF'+tlK.csv(rows)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=u;a.download='espacios-time-'+tlState.period+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
function tlSyncMetricOptions(){const a=tlQ('#analysis-metric'),b=tlQ('#tl-metric');if(!a||!b)return;b.innerHTML=a.innerHTML;b.value=state.analysisMetric;}
function tlSetup(){if(tlQ('#tl-dock')||!tlQ('#analysis-metric')||!arState.catalogue)return;document.documentElement.dataset.tl='1';const d=document.createElement('section');d.id='tl-dock';d.setAttribute('aria-label','Map colour legend and horizontal time control');d.innerHTML='<div class="tl-head"><strong id="tl-title">Price reference · AED/sqft</strong><span class="tl-badge" id="tl-badge">REPORTED</span><button id="tl-settings" type="button" aria-expanded="false" aria-controls="tl-more">Timeline settings</button></div><div id="tl-scale" class="tl-scale" role="img"></div><div id="tl-ticks" class="tl-ticks"></div><div class="tl-player"><button id="tl-prev" type="button" aria-label="Previous period">Previous</button><button id="tl-play" type="button" aria-pressed="false">Play</button><input id="tl-slider" type="range" min="0" max="0" value="0" step="1" aria-label="Selected evidence period"><select id="tl-date" aria-label="Evidence period"></select><button id="tl-next" type="button" aria-label="Next period">Next</button></div><div id="tl-gaps" class="tl-gaps" aria-label="Period availability"></div><small id="tl-note" class="tl-note" role="status"></small><div id="tl-more" class="tl-more" hidden><div class="tl-grid"><label>Metric<select id="tl-metric"></select></label><label>Time mode<select id="tl-controls-mode"><option value="history">Reported history</option><option value="scenario">Hypothetical future</option><option value="delivery">Reported handover schedule</option><option value="forecast">Model forecast readiness</option></select></label><label>Display<select id="tl-view"><option value="value">Value</option><option value="change">Change from baseline</option></select></label><label>Baseline period<select id="tl-baseline"></select></label><label>Property types<select id="tl-type"></select></label><label>Official-history geography<select id="tl-scope"><option value="district">Districts · exact source-name joins</option><option value="emirate">Ajman source population total</option></select></label><label id="tl-assumption-wrap" hidden>Annual assumption · % (yield: pp)<input id="tl-rate" type="number" min="-50" max="50" step="0.5" placeholder="Enter an assumption"></label><label>Playback pace<select id="tl-speed"><option value="1200">Normal · 1.2 s</option><option value="2400">Slower · 2.4 s</option></select></label></div><div class="tl-actions"><button id="tl-focus" type="button" hidden>View Ajman</button><button id="tl-export" type="button">Export this view</button><button id="tl-reset" type="button">Reset map view</button><a href="/map/history">Data register</a></div><p class="tl-note">Today: '+new Date().toISOString().slice(0,10)+'. The selected period is the evidence date, not today. Colour scale remains fixed across the selected comparison. Price scenarios are explicit assumptions, not forecasts.</p></div>';
 tlQ('#app').append(d);const tip=document.createElement('aside');tip.id='tl-tooltip';tip.hidden=true;tlQ('#app').append(tip);new ResizeObserver(tlResize).observe(d);window.addEventListener('resize',tlResize);tlSyncMetricOptions();const type=tlQ('#ar-segment');tlQ('#tl-type').innerHTML=type?.innerHTML||'<option value="all">All property types</option>';tlQ('#tl-type').value=arState.segment;
 tlQ('#tl-settings').onclick=()=>{const m=tlQ('#tl-more');m.hidden=!m.hidden;tlQ('#tl-settings').setAttribute('aria-expanded',String(!m.hidden));};tlQ('#tl-metric').onchange=e=>psrSetAnalysis(e.target.value);tlQ('#tl-controls-mode').onchange=e=>tlMode(e.target.value);tlQ('#tl-view').onchange=e=>{tlState.view=e.target.value;tlUpdate();};tlQ('#tl-baseline').onchange=e=>{tlState.baseline=e.target.value;tlUpdate();};tlQ('#tl-scope').onchange=e=>{tlState.scope=e.target.value;if(tlHist())tlLoadHistory();};tlQ('#tl-type').onchange=e=>{if(type){type.value=e.target.value;type.dispatchEvent(new Event('change',{bubbles:true}));}if(e.target.value==='custom'){tlQ('[data-panel="analyze"]')?.click();tlQ('#ax-custom-types')?.scrollIntoView({block:'nearest'});}if(tlHist())tlLoadHistory();else tlUpdate();};tlQ('#tl-rate').oninput=e=>{const s=e.target.value,v=Number(s);tlState.rate=s!==''&&Number.isFinite(v)&&v>=-50&&v<=50?v:null;clearTimeout(tlState.renderTimer);tlState.renderTimer=setTimeout(tlUpdate,120);};tlQ('#tl-date').onchange=e=>{tlStop();tlChooseDate(e.target.value);};tlQ('#tl-slider').oninput=e=>{tlStop();tlChooseDate(tlState.periods[Number(e.target.value)]);};tlQ('#tl-prev').onclick=()=>{tlStop();tlStep(-1);};tlQ('#tl-next').onclick=()=>{tlStop();tlStep(1);};tlQ('#tl-play').onclick=tlPlay;tlQ('#tl-speed').onchange=e=>{tlStop();tlState.speed=Number(e.target.value);};tlQ('#tl-focus').onclick=()=>map.easeTo({center:[55.53,25.40],zoom:11,pitch:0,duration:500});tlQ('#tl-export').onclick=tlExport;tlQ('#tl-reset').onclick=()=>{tlStop();tlState.mode='history';tlState.view='value';tlState.rate=null;tlQ('#tl-rate').value='';tlQ('#tl-view').value='value';tlState.period='2026H1';tlState.baseline='2026H1';tlQ('#ax-reset')?.click();tlMode('history');};document.addEventListener('keydown',e=>{if(e.key==='Escape'){tlQ('#tl-more').hidden=true;tlQ('#tl-settings').setAttribute('aria-expanded','false');}});tlState.ready=true;tlSetPeriods(['2026H1']);tlLegend();tlEvidence();
 fetch('/map/api/history-catalogue?v=20260923-history-v1').then(r=>{if(!r.ok)throw Error('History catalogue unavailable');return r.json();}).then(c=>{tlState.catalogue=c;const group=document.createElement('optgroup');group.label='Official Ajman historical evidence';for(const m of c.metrics.filter(m=>!m.id.startsWith('adrec_'))){const o=document.createElement('option');o.value='history:'+m.id;o.textContent='Ajman · '+m.label;group.append(o);}tlQ('#analysis-metric').append(group);tlSyncMetricOptions();tlDiagnostic();}).catch(e=>{tlState.message=e.message;tlDiagnostic();});}
psrSetAnalysis=function(metric){const same=metric===state.analysisMetric,key=[metric.startsWith('history:')?metric.slice(8):metric,arState.segment==='custom'?axState.custom.join(','):(arState.segment||'all'),tlState.scope].join('|');if(same&&tlHist()&&tlState.ready){if(tlState.loading&&tlState.pendingKey===key)return;if(!tlState.loading&&tlState.loadedKey===key&&tlState.series.length){tlRenderHistory();return;}}if(!same)tlStop();tlState.request++;tlState.series=[];tlState.frame=[];tlState.loading=false;tlState.selectedArea='';if(metric.startsWith('history:')){tlState.mode='history';tlOldSet('off');state.analysisMetric=metric;tlQ('#analysis-metric').value=metric;if(tlState.catalogue)tlLoadHistory();return;}tlHideCustom();tlOldSet(metric);if(tlState.mode==='scenario'&&!tlBench())tlState.mode='history';if(tlState.ready){if(tlState.mode==='history')tlSetPeriods(tlBench()?['2026H1']:['Current']);tlUpdate();}};
dgAttach=function(result){tlState.baseGradient=result;if(tlState.mode==='scenario'){tlScenario(result);return;}if(tlActive()){tlHideOld();return;}tlOldDgAttach(result);tlLegend();};
dgNote=function(){tlOldDgNote();if(tlState.ready)tlLegend();};
sgTooltip=function(e){if(!tlActive())return tlOldSgTooltip(e);sgHideTooltip();const t=tlQ('#tl-tooltip');if(!t||!e.point||map.isMoving?.())return;if(['project-hit','project-clusters','initiative-hit','place-hit'].filter(id=>map.getLayer(id)).some(id=>map.queryRenderedFeatures([e.point.x,e.point.y],{layers:[id]}).length)){t.hidden=true;return;}let text='';if(tlState.mode==='scenario'&&tlState.scenarioResult){const ll=map.unproject(e.point),s=tlOldDgSample(ll.lng,ll.lat);if(s){const years=(Date.parse(tlK.periodEnd(tlState.period))-Date.parse('2026-06-30'))/86400000/365.25,v=tlK.scenario(s.value,tlState.rate,years,state.analysisMetric.startsWith('roi'));text=esc(s.sourceArea||'Supported neighbourhood')+' · '+esc(tlK.periodLabel(tlState.period))+'<br><b>'+esc(tlText(tlState.view==='change'?tlK.change(v,s.value,state.analysisMetric.startsWith('roi')):v))+'</b><br>Hypothetical assumption, not a market forecast.<br>Original smoothed benchmark: '+esc(tlText(s.value,state.analysisMetric.startsWith('roi')?'%':'AED/sqft'));}}
 else if(map.getLayer('tl-history-fill')){const f=map.queryRenderedFeatures([e.point.x,e.point.y],{layers:['tl-history-fill']})[0];if(f)text=esc(f.properties.name)+' · '+esc(tlK.periodLabel(tlState.period))+'<br><b>'+esc(tlText(f.properties.value))+'</b><br>'+esc(f.properties.basis);}
 if(!text){t.hidden=true;return;}t.innerHTML=text;t.hidden=false;t.style.left=Math.max(8,Math.min(innerWidth-282,e.point.x+14))+'px';t.style.top=Math.max(8,Math.min(innerHeight-t.offsetHeight-8,e.point.y+14))+'px';};
map.on('movestart',()=>tlQ('#tl-tooltip')?.setAttribute('hidden',''));map.on('style.load',()=>setTimeout(()=>{if(tlActive())tlUpdate();},200));
new MutationObserver(()=>{if(tlState.ready){if(tlActive())setTimeout(tlUpdate,30);else tlLegend();}}).observe(document.documentElement,{attributes:true,attributeFilter:['data-espacios-theme']});
const tlSetupTimer=setInterval(()=>{tlSetup();if(tlState.ready)clearInterval(tlSetupTimer);},350);

const tlOldDgRender=dgRender;dgRender=function(){if(tlState.mode==='forecast'||tlState.mode==='delivery'||tlHist()){dgVisible(false);return;}return tlOldDgRender();};
// Keep every existing property-type control connected to the current temporal selection.
document.addEventListener('change',e=>{if(e.target?.matches('#ar-segment,#ax-custom-types input')){if(tlHist())tlLoadHistory();else if(tlState.ready)setTimeout(tlUpdate,80);}});

const tlOldShowDetail=showDetail;showDetail=function(r){tlOldShowDetail(r);if(tlHist()){const key=String(r?.area||r?.name||"").trim().toLowerCase(),hit=tlState.series.find(s=>s.geography.trim().toLowerCase()===key);if(hit)tlState.selectedArea=hit.geographyId;tlEvidence();}};

const drNativePeriodLabel=tlK.periodLabel;tlK.periodLabel=function(p){const m=/^(\d{4})H([12])$/.exec(String(p));return m?'H'+m[2]+' '+m[1]:drNativePeriodLabel(p);};
/* ESPACIOS_DRAG_TIMELINE_V1 — additive interaction fix; no source data edits. */
const drState={version:'20260923-drag-v1',installed:false,browsing:false,sourcePeriods:[],pointer:null,offset:0,guard:false};
const drBrowse=()=>tlState.mode==='history'&&tlBench()&&drState.browsing;
const drMissing=()=>drBrowse()&&!drState.sourcePeriods.includes(tlState.period);
const drCalendar=()=>Array.from({length:12},(_,i)=>String(2024+Math.floor(i/2))+'H'+(i%2+1));
const drOldPeriods=tlSetPeriods;
tlSetPeriods=function(periods){
 drState.browsing=tlState.mode==='history'&&tlBench()&&periods.length===1&&periods[0]==='2026H1';
 drState.sourcePeriods=periods.slice();if(drState.browsing&&!drCalendar().includes(tlState.period))tlState.period='2026H1';drOldPeriods(drState.browsing?drCalendar():periods);drSync();
};
const drOldDiagnostic=tlDiagnostic;
tlDiagnostic=function(){drOldDiagnostic();if(window.__ESPACIOS_TIMELINE__){Object.assign(window.__ESPACIOS_TIMELINE__,{dragVersion:drState.version,browsingDates:drBrowse(),selectedPeriodSupported:!drMissing(),benchmarkObservationCount:drBrowse()?drState.sourcePeriods.length:null});}window.__ESPACIOS_DATE_DRAG__={version:drState.version,ready:drState.installed,browsing:drBrowse(),unsupported:drMissing(),sourcePeriods:drState.sourcePeriods.slice(),pointerActive:drState.pointer!==null};};
function drSupported(p){if(drBrowse())return drState.sourcePeriods.includes(p);if(tlHist())return tlState.series.some(s=>s.points.some(x=>x.period===p&&tlK.finite(x.value)));if(tlState.mode==='forecast')return false;if(tlState.mode==='scenario')return tlState.rate!==null;return true;}
function drSync(){
 const slider=tlQ('#tl-slider'),track=tlQ('#dr-track');if(!slider||!track)return;
 const n=tlState.periods.length,index=Math.max(0,tlState.periods.indexOf(tlState.period)),width=track.clientWidth,pos=14+Math.max(0,width-28)*index/Math.max(1,n-1);
 slider.value=String(index);const handle=tlQ('#dr-handle');handle.textContent=tlK.periodLabel(tlState.period);handle.style.left=pos+'px';
 const hw=handle.offsetWidth||82;handle.style.transform='translateX('+(Math.max(0,Math.min(width-hw,pos-hw/2))-pos)+'px)';
 const marks=tlQ('#dr-dates');const count=Math.min(n,innerWidth<600?4:6),indices=[...new Set(Array.from({length:count},(_,i)=>Math.round(i*(n-1)/Math.max(1,count-1))))];
 const signature=tlState.periods.join('|')+'|'+width+'|'+count;if(marks.dataset.signature!==signature){marks.dataset.signature=signature;marks.innerHTML=indices.map(i=>'<span style="left:'+(14+Math.max(0,width-28)*i/Math.max(1,n-1))+'px">'+esc(tlK.periodLabel(tlState.periods[i]))+'</span>').join('');}
 const evidence=tlQ('#dr-evidence');evidence.innerHTML=tlState.periods.map((p,i)=>'<i class="'+(drSupported(p)?'has-evidence':'no-evidence')+'" style="left:'+(14+Math.max(0,width-28)*i/Math.max(1,n-1))+'px" title="'+esc(tlK.periodLabel(p)+(drSupported(p)?' · available for this mode':' · no supported value'))+'"></i>').join('');
 const mode=tlQ('#dr-mode');mode.value=tlState.mode;mode.querySelector('option[value=scenario]').disabled=!tlBench();
 const help=tlQ('#dr-help');if(drMissing()){help.textContent=tlK.periodLabel(tlState.period)+': no price/yield evidence or approved forecast. No earlier values are carried into this date.';}
 else if(drBrowse()){help.textContent='Drag the date handle. H1 2026 is the only reported benchmark; other dates show no data. Use Scenario for an explicit future assumption.';}
 else if(tlState.mode==='scenario'){help.textContent=tlState.rate===null?'Drag through future quarters; enter your annual assumption below to calculate a scenario.':'Drag to change the scenario date. This uses your assumption, not a market forecast.';}
 else if(tlState.mode==='forecast'){help.textContent='Drag to inspect each forecast horizon. No approved local forecast is available yet.';}
 else if(tlState.mode==='delivery'){help.textContent='Drag to inspect reported handover years. Schedules are targets, not guaranteed completions.';}
 else{help.textContent=n>1?'Drag the date handle or tap the line. Missing periods stay empty. Keyboard: focus the handle and use arrow keys.':'This layer has only one captured period. Choose a dated history metric or Handovers to explore time.';}
 tlQ('#dr-back').hidden=!drMissing();track.dataset.missing=String(drMissing());track.dataset.disabled=String(slider.disabled);
 slider.setAttribute('aria-describedby','dr-help');slider.setAttribute('aria-label','Drag selected date');slider.setAttribute('aria-valuetext',tlK.periodLabel(tlState.period)+(drMissing()?' — no supported data':''));
 tlQ('#dr-caption').textContent=slider.disabled?'One recorded period':'Drag the date';
 const gaps=tlQ('#tl-gaps');if(drBrowse())gaps.innerHTML=tlState.periods.map(p=>'<i class="'+(drSupported(p)?'':'missing')+'" title="'+esc(tlK.periodLabel(p)+(drSupported(p)?' · reported':' · no data'))+'"></i>').join('');
 tlDiagnostic();tlResize();
}
const drOldDgVisible=dgVisible;
dgVisible=function(show){return drOldDgVisible(show&&!drMissing());};
const drOldSgVisible=sgVisible;
sgVisible=function(show){return drOldSgVisible(show&&!drMissing());};
function drHide(){tlHideOld();tlHideCustom();sgHideTooltip();tlQ('#dg-tooltip')?.setAttribute('hidden','');}
const drOldLegend=tlLegend;
tlLegend=function(){drOldLegend();if(drMissing()){
 drHide();tlQ('#tl-badge').textContent='NO DATA';tlQ('#tl-title').textContent=(tlQ('#analysis-metric')?.selectedOptions[0]?.textContent||'Selected metric')+' · '+tlK.periodLabel(tlState.period);
 tlQ('#tl-scale').style.background='repeating-linear-gradient(135deg,rgba(128,140,155,.28) 0 5px,transparent 5px 10px)';tlQ('#tl-scale').setAttribute('aria-label','No supported value for the selected date; missing does not mean zero');
 tlQ('#tl-ticks').innerHTML='<span>No supported values for '+esc(tlK.periodLabel(tlState.period))+'</span>';tlQ('#tl-note').textContent='Only H1 2026 is recorded for this benchmark. The map is not displaying that value at a different date.';
 }drSync();};
const drOldEvidence=tlEvidence;
tlEvidence=function(){drOldEvidence();if(drMissing()){const box=tlQ('#tl-evidence');if(box)box.innerHTML='<h3>'+esc(tlK.periodLabel(tlState.period))+' · no data</h3><p>No dated price/yield observation or approved forecast exists for this selection. H1 2026 reference values have not been carried forward.</p><p>Drag back to H1 2026, choose a historical activity metric, or select Scenario and enter an explicit assumption.</p><a href="/map/history">Dated data register</a>';}};
const drOldUpdate=tlUpdate;
tlUpdate=function(){if(drMissing()){tlState.frame=[];drHide();tlLegend();tlEvidence();return;}if(drBrowse()&&dgEligible()&&dgState.result){tlOldDgAttach(dgState.result);dgHideAreas();dgVisible(true);}else if(drBrowse()&&arOwned.has(state.analysisMetric)&&sgState.data){sgPaint(state.analysisMetric);}drOldUpdate();drSync();};
const drOldChoose=tlChooseDate;
tlChooseDate=function(p){drOldChoose(p);drSync();if(drMissing())drHide();};
const drOldTooltip=sgTooltip;
sgTooltip=function(e){if(drMissing()){sgHideTooltip();tlQ('#tl-tooltip')?.setAttribute('hidden','');return;}return drOldTooltip(e);};
const drOldExport=tlExport;
tlExport=function(){if(!drMissing())return drOldExport();const rows=[['metric','selected_period','status','value','source_period'],[state.analysisMetric,tlState.period,'no_supported_data','','2026H1']];const url=URL.createObjectURL(new Blob(['\uFEFF'+tlK.csv(rows)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='espacios-no-data-'+tlState.period+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
function drInstall(){
 if(drState.installed||!tlQ('#tl-slider')||!tlState.ready)return;drState.installed=true;
 const player=tlQ('.tl-player'),slider=tlQ('#tl-slider'),settings=tlQ('#tl-more');player.classList.add('dr-player');
 const secondary=document.createElement('div');secondary.className='dr-secondary';secondary.setAttribute('aria-label','Optional playback and exact date controls');
 const label=document.createElement('span');label.textContent='Optional playback';secondary.append(label);for(const id of ['tl-prev','tl-play','tl-date','tl-next'])secondary.append(tlQ('#'+id));settings.prepend(secondary);
 const intro=document.createElement('div');intro.className='dr-intro';intro.innerHTML='<span id="dr-caption">Drag the date</span><select id="dr-mode" aria-label="Timeline mode"><option value="history">Reported history</option><option value="scenario">Scenario</option><option value="delivery">Handovers</option><option value="forecast">Forecast readiness</option></select>';
 const track=document.createElement('div');track.id='dr-track';track.innerHTML='<output id="dr-handle" aria-hidden="true"></output><div id="dr-evidence" aria-hidden="true"></div><div id="dr-dates" aria-hidden="true"></div>';track.insertBefore(slider,track.firstChild);
 const info=document.createElement('div');info.className='dr-info';info.innerHTML='<small id="dr-help"></small><button id="dr-back" type="button" hidden>Back to H1 2026</button>';player.append(intro,track,info);
 const assumption=tlQ('#tl-assumption-wrap');if(assumption)player.append(assumption);
 tlQ('#dr-mode').onchange=e=>tlMode(e.target.value);tlQ('#dr-back').onclick=()=>{tlStop();tlChooseDate('2026H1');clearTimeout(tlState.renderTimer);tlUpdate();};
 const coordinate=e=>{const b=slider.getBoundingClientRect(),f=Math.max(0,Math.min(1,(e.clientX-drState.offset-b.left-14)/Math.max(1,b.width-28)));const i=Math.round(f*Math.max(0,tlState.periods.length-1));tlChooseDate(tlState.periods[i]);};
 const down=e=>{if(slider.disabled||e.button>0||drState.pointer!==null)return;e.preventDefault();e.stopPropagation();tlStop();slider.focus({preventScroll:true});drState.pointer=e.pointerId;
 const b=slider.getBoundingClientRect(),i=Math.max(0,tlState.periods.indexOf(tlState.period)),center=b.left+14+(b.width-28)*i/Math.max(1,tlState.periods.length-1);drState.offset=e.currentTarget.id==='dr-handle'?e.clientX-center:0;
 try{e.currentTarget.setPointerCapture(e.pointerId);}catch{}track.classList.add('is-dragging');coordinate(e);};
 slider.addEventListener('pointerdown',down);tlQ('#dr-handle').addEventListener('pointerdown',down);
 document.addEventListener('pointermove',e=>{if(drState.pointer!==e.pointerId)return;e.preventDefault();coordinate(e);},{passive:false});
 const finish=e=>{if(drState.pointer!==e.pointerId)return;coordinate(e);drState.pointer=null;drState.offset=0;track.classList.remove('is-dragging');clearTimeout(tlState.renderTimer);tlUpdate();};
 document.addEventListener('pointerup',finish);document.addEventListener('pointercancel',e=>{if(drState.pointer===e.pointerId){drState.pointer=null;drState.offset=0;track.classList.remove('is-dragging');tlUpdate();}});
 slider.addEventListener('input',drSync);window.addEventListener('resize',drSync);new ResizeObserver(()=>{if(drState.installed)drSync();}).observe(track);
 const periods=drBrowse()?drState.sourcePeriods.slice():tlState.periods.slice();tlSetPeriods(periods);tlLegend();
}
const drInstallTimer=setInterval(()=>{drInstall();if(drState.installed)clearInterval(drInstallTimer);},160);
/* END ESPACIOS_DRAG_TIMELINE_V1 */

{const sheet=document.createElement("style");sheet.id="dr-date-style";sheet.textContent="/* Drag-first date ruler. Original playback and exact-date controls remain in settings. */\nhtml[data-tl] body #app #tl-dock .dr-player{display:block!important;min-width:0!important}\nhtml[data-tl] body #app #tl-dock .dr-intro{display:flex!important;align-items:center;justify-content:space-between;gap:8px;margin-top:3px}\nhtml[data-tl] body #app #dr-caption{font-size:12px;font-weight:600}\nhtml[data-tl] body #app #tl-dock #dr-mode{font-size:11px!important;min-height:30px!important;padding:4px 8px!important;max-width:165px!important}\nhtml[data-tl] body #app #dr-track{position:relative!important;height:86px!important;width:100%!important;margin-top:6px;min-width:0;touch-action:none;user-select:none}\nhtml[data-tl] body #app #tl-slider{position:absolute!important;top:30px!important;left:0!important;width:100%!important;min-width:0!important;height:44px!important;appearance:none!important;-webkit-appearance:none!important;padding:0!important;margin:0!important;box-shadow:none!important;border:0!important;outline:0;background:transparent!important;cursor:ew-resize!important;touch-action:none!important;z-index:3}\nhtml[data-tl] body #app #tl-slider::-webkit-slider-runnable-track{height:5px;border-radius:3px;background:rgba(127,157,190,.45)}\nhtml[data-tl] body #app #tl-slider::-webkit-slider-thumb{-webkit-appearance:none;width:28px;height:28px;border-radius:50%;margin-top:-11.5px;border:3px solid #edf8f8;background:#278d8b;box-shadow:0 0 0 4px rgba(59,177,172,.15);cursor:grab}\nhtml[data-tl] body #app #tl-slider::-moz-range-track{height:5px;border-radius:3px;background:rgba(127,157,190,.45)}\nhtml[data-tl] body #app #tl-slider::-moz-range-thumb{width:22px;height:22px;border-radius:50%;border:3px solid #edf8f8;background:#278d8b;box-shadow:0 0 0 4px rgba(59,177,172,.15);cursor:grab}\nhtml[data-tl] body #app #tl-slider:focus-visible{outline:2px solid #58bbaa!important;outline-offset:1px}\nhtml[data-tl] body #app #dr-handle{position:absolute!important;top:1px;z-index:4;display:block;white-space:nowrap;font-size:12px;font-weight:650;font-variant-numeric:tabular-nums;padding:5px 9px;border:1px solid var(--ar-line);border-radius:7px;color:var(--ar-ink);background:var(--ar-panel,#132136);min-height:27px;cursor:grab;touch-action:none;user-select:none}\nhtml[data-tl] body #app #dr-track.is-dragging #dr-handle{cursor:grabbing;border-color:#58bbaa}\nhtml[data-tl] body #app #dr-track[data-missing=true] #dr-handle{border-style:dashed}\nhtml[data-tl] body #app #dr-dates{position:absolute;left:0;right:0;top:74px;height:13px;pointer-events:none;font-size:10px;line-height:12px;color:var(--ar-muted,#adc0d6);font-variant-numeric:tabular-nums}\nhtml[data-tl] body #app #dr-dates span{position:absolute;transform:translateX(-50%);white-space:nowrap}\nhtml[data-tl] body #app #dr-dates span:first-child{transform:none;left:0!important}\nhtml[data-tl] body #app #dr-dates span:last-child{transform:translateX(-100%);left:100%!important}\nhtml[data-tl] body #app #dr-evidence{position:absolute;left:0;right:0;top:52px;height:5px;pointer-events:none;z-index:2}\nhtml[data-tl] body #app #dr-evidence i{position:absolute;width:5px;height:9px;top:-4px;transform:translateX(-50%);border-radius:2px;background:#748399}\nhtml[data-tl] body #app #dr-evidence .has-evidence{background:#58bbaa}\nhtml[data-tl] body #app #tl-dock .dr-info{display:flex;align-items:center;flex-wrap:wrap;gap:4px 10px;margin-top:4px}\nhtml[data-tl] body #app #dr-help{flex:1 1 220px;font-size:10px;line-height:1.4;color:var(--ar-muted,#adc0d6)}\nhtml[data-tl] body #app #tl-dock #dr-back{min-height:30px!important;font-size:11px!important}\nhtml[data-tl] body #app #tl-dock .dr-secondary{display:flex;align-items:center;gap:6px;flex-wrap:wrap;border-bottom:1px solid var(--ar-line);padding-bottom:12px;margin-bottom:12px}\nhtml[data-tl] body #app #tl-dock .dr-secondary>span{flex-basis:100%;font-size:11px;color:var(--ar-muted)}\nhtml[data-tl] body #app #tl-dock .dr-secondary #tl-date{max-width:130px!important;min-width:90px!important}\nhtml[data-tl] body #app #tl-dock #tl-assumption-wrap{font-size:11px;line-height:1.4;display:flex;align-items:center;gap:9px;margin:8px 0 2px}\nhtml[data-tl] body #app #tl-dock #tl-assumption-wrap[hidden]{display:none!important}\nhtml[data-tl] body #app #tl-dock #tl-rate{width:125px!important}\n@media(max-width:600px){html[data-tl] body #app #tl-dock{gap:5px!important;padding:10px 12px!important}html[data-tl] body #app #tl-dock .tl-head{flex-wrap:wrap;gap:5px}html[data-tl] body #app #tl-dock .tl-head strong{flex-basis:55%}html[data-tl] body #app #tl-dock #tl-settings{min-height:28px!important;font-size:10px!important}html[data-tl] body #app #tl-dock .tl-ticks{font-size:9px}html[data-tl] body #app #dr-help{font-size:10px}html[data-tl] body #app #dr-track{height:84px!important}}\n";document.head.append(sheet);}

/* Dubai source history: additive integration after the drag-first temporal controls. */
const bhState={version:'20260923-dubai-history-ui-v1',manifest:null,frequency:'monthly',registration:'All',cache:new Map(),worker:null,busy:false,pending:null,token:0,rasterCache:new Map(),lastRenderKey:'',lastResult:null,renderedPeriod:null,loadingRaster:false,installed:false};
const bhOwn=()=>String(state.analysisMetric).startsWith('history:dubai-');
const bhActive=()=>bhOwn()&&tlState.mode==='history';
const bhPrice=()=>state.analysisMetric==='history:dubai-sale-psf';
const bhDefinitions=[['dubai-sale-psf','Dubai · registered-sale AED/sqft · research','AED/sqft'],['dubai-sample-count','Dubai · eligible sale sample count','count'],['dubai-sample-value','Dubai · eligible sale sample amount','AED']];
function bhVisible(show){for(const id of ['bh-price-gradient','bh-water-mask'])if(map.getLayer(id))map.setLayoutProperty(id,'visibility',show?'visible':'none');}
const bhOldHide=tlHideOld;tlHideOld=function(){bhVisible(false);return bhOldHide();};
const bhOldLabel=tlK.periodLabel;tlK.periodLabel=s=>/^\d{4}-\d{2}$/.test(s)?new Date(s+'-01T00:00:00Z').toLocaleDateString('en-GB',{month:'short',year:'numeric',timeZone:'UTC'}):bhOldLabel(s);
function bhDiagnostic(){window.__ESPACIOS_DUBAI_HISTORY__={version:bhState.version,ready:!!bhState.manifest,active:bhActive(),frequency:bhState.frequency,registration:bhState.registration,sourceVersion:bhState.manifest?.version,loadingRaster:bhState.loadingRaster,renderedPeriod:bhState.renderedPeriod,acceptedAreas:tlState.frame.filter(r=>tlK.finite(r.value)).length,mappedAreas:tlState.frame.filter(r=>tlK.finite(r.value)&&r.geometryIds?.length).length,rasterColors:bhState.lastResult?.colorCount||0,rawRows:bhState.manifest?.stats.sourceTransactionRows,minimumPriceSample:20};}
function bhBasket(){if(arState.segment!=='custom')return arState.segment||'all';const xs=[...new Set(axState.custom)].sort();return xs.length===1?xs[0]:xs.join('+');}
const bhOldLoad=tlLoadHistory;
tlLoadHistory=async function(){if(!bhOwn())return bhOldLoad();
 const token=++tlState.request,metric=tlMetric(),segment=bhBasket(),key=[bhState.frequency,segment,bhState.registration].join('|');
 tlState.loading=true;tlState.frame=[];tlState.series=[];tlState.message='Loading dated source records';bhState.renderedPeriod=null;bhState.loadingRaster=false;bhState.pending=null;bhState.token++;bhVisible(false);tlHideOld();tlHideCustom();tlLegend();
 try{if(!bhState.manifest?.segments.includes(segment))throw Error('This custom basket is not prepared. No medians have been averaged or another property type substituted.');
 let d=bhState.cache.get(key);if(!d){const r=await fetch('/map/api/dubai-history?frequency='+bhState.frequency+'&segment='+encodeURIComponent(segment)+'&registration='+encodeURIComponent(bhState.registration)+'&v='+bhState.manifest.version);if(!r.ok)throw Error('Historical reference service '+r.status);d=await r.json();if(d.version!==bhState.manifest.version)throw Error('Historical reference version mismatch');if(bhState.cache.size>=8)bhState.cache.delete(bhState.cache.keys().next().value);bhState.cache.set(key,d);}
 await sgLoad();if(token!==tlState.request||!bhOwn())return;
 const def=bhDefinitions.find(x=>x[0]===metric),price=metric==='dubai-sale-psf';
 const basketNote=segment==='all'?'All supported residential types: apartments, villas and classified townhouses. Other asset classes remain individually selectable.':segment==='land'?'Land: registered plot-area denominator, not internal floor area.':segment==='building'?'Building-classified source records include inconsistent subtypes; price-per-area publication is held for review.':'Selected source property-type basket: '+segment+'.';
 const basis='Independent DLD-derived snapshot; '+basketNote+' '+(price?'Descriptive median; changing mix is not same-property appreciation.':'Quality-screened source sample, not all Dubai sales.');
 tlState.series=d.series.map(s=>({id:'dubai:'+s.id+':'+metric+':'+segment,geographyId:'dld-area:'+s.id,geography:s.name,geometryIds:ueGeometry(s),geometryMatch:s.geometryMatch,segment,metric,unit:def[2],frequency:d.frequency,dataset:d.source.id,label:def[1],basis,
 points:s.points.map(p=>({period:p[0],value:price?(p[1]>=20&&segment!=='building'?p[2]:null):metric==='dubai-sample-count'?p[1]:p[5],sourceRows:p[1],eventCount:p[1],quality:price&&segment==='building'?'building_classification_review':price&&p[1]<20?'fewer_than_20_sales':'accepted_descriptive_reference',p25:p[3],p75:p[4],projectGroups:p[6],missingRooms:p[7]}))}));
 tlState.source={...d.source,title:'Dubai sales snapshot · independent publisher',licenceUrl:d.source.licenceUrl};tlState.unit=def[2];tlState.loading=false;
 const meta=tlState.catalogue.metrics.find(x=>x.id===metric);meta.frequency=d.frequency;meta.periods=d.periods;
 tlState.loadedKey=[metric,arState.segment==='custom'?axState.custom.join(','):(arState.segment||'all'),tlState.scope].join('|');
 if(!d.periods.includes(tlState.baseline))tlState.baseline=d.periods[Math.max(0,d.periods.length-(d.frequency==='monthly'?13:5))];tlSetPeriods(d.periods);tlState.message=basis;tlRenderHistory();
 }catch(e){if(token!==tlState.request)return;tlState.loading=false;tlState.series=[];tlState.frame=[];tlState.message=e.message;tlHideOld();tlHideCustom();tlLegend();tlEvidence();}
};
const bhOldDraw=tlDraw;
tlDraw=function(frame){if(!bhActive()||!bhPrice())return bhOldDraw(frame);
 tlState.frame=frame;tlHideOld();tlHideCustom();const by=new Map(sgState.data.features.map(f=>[String(f.id),f]));
 const features=frame.filter(r=>tlK.finite(r.value)).flatMap(r=>(r.geometryIds||[]).flatMap(id=>{const f=by.get(String(id));return f?[{id:r.id,name:r.name,emirate:'Dubai',geometry:f.geometry,value:r.value,period:r.period,geometryId:id}]:[]}));
 bhState.token++;bhState.renderedPeriod=null;bhState.loadingRaster=features.length>0;
 const key=[tlState.period,tlState.baseline,tlState.view,arState.segment,axState.custom.join(','),bhState.frequency,bhState.registration,sgState.opacity,dgState.bandwidthKm].join('|');bhState.lastRenderKey=key;
 tlLegend();tlEvidence();if(!features.length){bhState.loadingRaster=false;bhLegend();return;}
 const cached=bhState.rasterCache.get(key);if(cached){bhAttach(cached);return;}
 try{if(!bhState.worker){const url=URL.createObjectURL(new Blob([DGKernel.toString()+'\n('+DGWorkerMain.toString()+')();'],{type:'text/javascript'}));bhState.worker=new Worker(url);URL.revokeObjectURL(url);
 bhState.worker.onmessage=e=>{const d=e.data;bhState.busy=false;if(bhState.pending){const next=bhState.pending;bhState.pending=null;if(bhActive()&&next.token===bhState.token){bhState.busy=true;bhState.worker.postMessage(next);}}if(d.token!==bhState.token||!bhActive()||!bhPrice())return;if(d.error){bhState.loadingRaster=false;tlState.message=d.error;bhLegend();return;}
 for(let i=0;i<d.values.length;i++){if(!Number.isFinite(d.values[i])||!d.rgba[i*4+3])continue;const rgb=tlK.color(d.values[i],tlState.domain,tlState.view==='change').match(/\d+/g).map(Number);d.rgba[i*4]=rgb[0];d.rgba[i*4+1]=rgb[1];d.rgba[i*4+2]=rgb[2];}
 d.period=tlState.period;d.domain=tlState.domain.slice();if(bhState.rasterCache.size>=4)bhState.rasterCache.delete(bhState.rasterCache.keys().next().value);bhState.rasterCache.set(bhState.lastRenderKey,d);bhAttach(d);};
 bhState.worker.onerror=e=>{bhState.loadingRaster=false;tlState.message='Gradient unavailable: '+e.message;bhVisible(false);bhLegend();};}
 const payload={token:bhState.token,features,masks:sgState.data.features.filter(f=>f.properties.level==='emirate'&&f.properties.emirate==='Dubai').map(f=>({emirate:'Dubai',geometry:f.geometry})),bandwidthKm:dgState.bandwidthKm,maxDimension:768};if(bhState.busy)bhState.pending=payload;else{bhState.busy=true;bhState.worker.postMessage(payload);}
 }catch(e){bhState.loadingRaster=false;tlState.message='Gradient unavailable. '+e.message;bhLegend();}
};
function bhAttach(d){if(!bhActive()||!bhPrice()||d.period!==tlState.period)return;
 let canvas=document.getElementById('bh-price-canvas');if(!canvas){canvas=document.createElement('canvas');canvas.id='bh-price-canvas';canvas.hidden=true;document.body.append(canvas);}canvas.width=d.w;canvas.height=d.h;canvas.getContext('2d').putImageData(new ImageData(d.rgba,d.w,d.h),0,0);
 const b=d.bounds,coordinates=[dgK.unmerc([b[0],b[1]]),dgK.unmerc([b[2],b[1]]),dgK.unmerc([b[2],b[3]]),dgK.unmerc([b[0],b[3]])];let src=map.getSource('bh-price-canvas');if(!src){map.addSource('bh-price-canvas',{type:'canvas',canvas,coordinates,animate:false});src=map.getSource('bh-price-canvas');}else src.setCoordinates(coordinates);
 const before=map.getLayer('waterway')?'waterway':map.getStyle().layers.find(l=>l.type==='symbol')?.id;
 if(!map.getLayer('bh-price-gradient'))map.addLayer({id:'bh-price-gradient',type:'raster',source:'bh-price-canvas',paint:{'raster-opacity':sgState.opacity,'raster-fade-duration':0,'raster-resampling':'linear'}},before);
 map.setPaintProperty('bh-price-gradient','raster-opacity',sgState.opacity);
 const water=map.getLayer('water');if(water&&!map.getLayer('bh-water-mask')){const style=map.getStyle().layers.find(l=>l.id==='water');map.addLayer({...style,id:'bh-water-mask'},before);}if(water&&map.getLayer('bh-water-mask'))for(const[k,v]of Object.entries(map.getStyle().layers.find(l=>l.id==='water').paint||{}))map.setPaintProperty('bh-water-mask',k,v);
 src.play();map.once('render',()=>src.pause());map.triggerRepaint();bhVisible(true);bhState.lastResult=d;bhState.renderedPeriod=d.period;bhState.loadingRaster=false;bhLegend();
}
function bhLegend(){if(!tlQ('#bh-basis'))return;const active=bhActive();tlQ('#bh-basis').value=bhOwn()?'registered':'asking';
 for(const id of ['bh-frequency-wrap','bh-registration-wrap'])tlQ('#'+id).hidden=!bhOwn();for(const id of ['ax-aggregate','ar-scope']){const el=tlQ('#'+id);if(el){el.disabled=active;el.title=active?'Registered history uses raw-record medians at source-area geography. Original controls remain available in asking-reference mode.':'';}}
 if(active){tlQ('#tl-title').textContent=(tlState.view==='change'?(bhPrice()?'Median change · ':'Sample change · '):'')+(bhPrice()?'Registered-sale AED/sqft':'Eligible sale sample')+' · Dubai';tlQ('#tl-badge').textContent=bhState.loadingRaster?'RENDERING':'DLD-DERIVED RESEARCH';
 const known=tlState.frame.filter(r=>tlK.finite(r.value)),mapped=known.filter(r=>r.geometryIds?.length);const basis=arState.segment==='all'?'All supported residential types':'Selected types';
 tlQ('#tl-note').textContent=(tlState.loading?'Loading…':tlK.periodLabel(tlState.period)+' · '+basis+' · '+bhState.registration+' · '+known.length+' areas with values / '+mapped.length+' boundary matches.')+' Independent source snapshot; not a valuation. '+(bhPrice()?'n ≥ 20. Smoothing is visual, not new observations.':'Filtered sample; not whole-market totals.');
 tlQ('#tl-scope').disabled=true;tlQ('#tl-focus').hidden=false;tlQ('#tl-focus').textContent='View Dubai';tlQ('#tl-focus').onclick=()=>map.easeTo({center:[55.26,25.10],zoom:10,pitch:0,duration:500});
 if(!tlState.frame.some(r=>tlK.finite(r.value)))tlQ('#dr-help').textContent=tlState.message||'No supported observations.';
 }else{tlQ('#tl-focus').textContent='View Ajman';tlQ('#tl-focus').onclick=()=>map.easeTo({center:[55.53,25.40],zoom:11,pitch:0,duration:500});}
 bhDiagnostic();
}
const bhOldLegend=tlLegend;tlLegend=function(){bhOldLegend();bhLegend();};
const bhOldEvidence=tlEvidence;tlEvidence=function(){bhOldEvidence();if(!bhActive())return;const box=tlQ('#tl-evidence');if(!box)return;const r=tlState.frame.find(x=>x.id===tlState.selectedArea)||tlState.frame.find(x=>tlK.finite(x.value));const s=r&&tlState.series.find(x=>x.geographyId===r.id),p=s?.points.find(x=>x.period===tlState.period);
 const section=document.createElement('section');section.className='bh-source-detail';section.innerHTML='<h3>Historical source and comparability</h3><p>'+esc(tlState.message)+'</p>'+(r?'<p><b>'+esc(r.name)+'</b> · '+esc(tlK.periodLabel(tlState.period))+'<br>Eligible sample: '+esc(p?.sourceRows??0)+' sales. '+(bhPrice()&&p?.value!=null?'Middle 50% of registered-area prices: '+esc(p.p25)+'–'+esc(p.p75)+' AED/sqft. This is a distribution, not a prediction interval.':'')+'</p>':'')+'<p>Source areas are not necessarily marketed communities. Registration category does not independently verify completion. Publisher cohort filtering uses a revised historical snapshot; no point-in-time backtest or property-price forecast is claimed.</p><p><a href="https://huggingface.co/datasets/dubairealestatedata/dubai-real-estate-sales-transactions" target="_blank" rel="noopener">Downloadable source and licence</a> · <a href="https://www.dubairealestatedata.com/methodology" target="_blank" rel="noopener">Publisher methodology</a></p>';box.append(section);};
const bhOldTooltip=sgTooltip;sgTooltip=function(e){if(!bhActive()||!bhPrice())return bhOldTooltip(e);sgHideTooltip();const t=tlQ('#tl-tooltip');if(!t||!e.point||map.isMoving()||bhState.loadingRaster)return;if(['project-hit','project-clusters','initiative-hit','place-hit','bh-water-mask'].filter(id=>map.getLayer(id)).some(id=>map.queryRenderedFeatures([e.point.x,e.point.y],{layers:[id]}).length)){t.hidden=true;return;}
 const ll=map.unproject(e.point),shapes=sgState.data.features;const r=tlState.frame.find(r=>tlK.finite(r.value)&&(r.geometryIds||[]).some(id=>{const f=shapes.find(f=>String(f.id)===String(id));return f&&SG.contains([ll.lng,ll.lat],f.geometry);}));if(!r){t.hidden=true;return;}
 t.innerHTML='<b>'+esc(r.name)+'</b>'+esc(tlK.periodLabel(tlState.period))+'<br>Reported area '+(tlState.view==='change'?'median change':'median')+': '+esc(tlText(r.value))+'<br>n = '+esc(r.sourceRows)+' · '+esc(bhState.registration)+'<br>Independent DLD-derived reference; smoothed colour is not a measured building value.';t.hidden=false;t.style.left=Math.max(8,Math.min(innerWidth-282,e.point.x+14))+'px';t.style.top=Math.max(8,Math.min(innerHeight-t.offsetHeight-8,e.point.y+14))+'px';};
const bhOldSet=psrSetAnalysis;psrSetAnalysis=function(metric){bhState.token++;bhState.loadingRaster=false;bhVisible(false);return bhOldSet(metric);};
const bhOldMode=tlMode;tlMode=function(mode){bhState.token++;bhState.loadingRaster=false;bhVisible(false);return bhOldMode(mode);};
map.on('style.load',()=>setTimeout(()=>{if(bhActive())tlUpdate();},250));
function bhInstall(){if(bhState.installed||!tlState.catalogue||!drState.installed||!bhState.manifest)return;bhState.installed=true;
 for(const[id,label,unit]of bhDefinitions){tlState.catalogue.metrics.push({id,label,unit,frequency:'monthly',dataset:bhState.manifest.source.id,types:bhState.manifest.segments,periods:bhState.manifest.periods.monthly});const o=document.createElement('option');o.value='history:'+id;o.textContent=label;tlQ('#analysis-metric').append(o);}tlSyncMetricOptions();
 const source=document.createElement('label');source.className='bh-basis-label';source.innerHTML='Price evidence<select id="bh-basis" aria-label="Price evidence source"><option value="asking">Asking benchmarks · H1 2026</option><option value="registered">Registered-sale history · Dubai</option></select>';tlQ('.dr-intro').after(source);
 const grid=tlQ('.tl-grid');const controls=document.createElement('div');controls.className='bh-grid';controls.innerHTML='<label id="bh-frequency-wrap">History frequency<select id="bh-frequency"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option></select></label><label id="bh-registration-wrap">Registration category<select id="bh-registration"><option value="All">All registrations</option><option value="Ready">Ready registration</option><option value="Off-Plan">Off-plan registration</option></select></label>';grid.after(controls);
 tlQ('#bh-basis').onchange=e=>{tlState.mode='history';tlState.view='value';tlQ('#tl-view').value='value';psrSetAnalysis(e.target.value==='registered'?'history:dubai-sale-psf':'price-psf');};
 for(const[id,key]of [['bh-frequency','frequency'],['bh-registration','registration']])tlQ('#'+id).onchange=e=>{bhState[key]=e.target.value;if(bhOwn()){bhState.rasterCache.clear();tlLoadHistory();}};
 for(const id of ['ar-segment','tl-type']){const el=tlQ('#'+id);if(el&&![...el.options].some(o=>o.value==='building')){const o=document.createElement('option');o.value='building';o.textContent='Building-classified · review required';el.append(o);}}bhLegend();if(state.analysisMetric==='price-psf'&&tlState.mode==='history'&&tlState.period==='2026H1')psrSetAnalysis('history:dubai-sale-psf');
}
fetch('/map/api/dubai-history-catalogue?v=20260923-dubai-derived-history-v1').then(r=>{if(!r.ok)throw Error('New history manifest unavailable');return r.json();}).then(m=>{bhState.manifest=m;bhDiagnostic();}).catch(e=>{bhState.error=e.message;bhDiagnostic();});
const bhTimer=setInterval(()=>{bhInstall();if(bhState.installed)clearInterval(bhTimer);},300);
const bhStyle=document.createElement('style');bhStyle.textContent='html[data-tl] #tl-dock .bh-basis-label{display:flex;align-items:center;gap:10px;font-size:11px;margin-top:4px}html[data-tl] #tl-dock #bh-basis{min-width:0;flex:1;font-size:11px!important}html[data-tl] #tl-dock .bh-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}html[data-tl] #tl-dock .bh-grid label{display:grid;gap:5px;font-size:11px}html[data-tl] #tl-dock .bh-grid select{width:100%;min-width:0}.bh-source-detail{border-top:1px solid var(--ar-line);padding-top:10px;margin-top:10px}';document.head.append(bhStyle);

// Date/source transitions never relabel an old raster as a newer period.
const bhOldChoose=tlChooseDate;tlChooseDate=function(p){if(bhActive()&&p!==tlState.period){bhState.token++;bhState.pending=null;bhState.renderedPeriod=null;bhVisible(false);}bhOldChoose(p);bhDiagnostic();};
const bhOldDiagnostic=tlDiagnostic;tlDiagnostic=function(){bhOldDiagnostic();if(bhActive()&&window.__ESPACIOS_TIMELINE__){window.__ESPACIOS_TIMELINE__.catalogueVersion=window.__ESPACIOS_TIMELINE__.sourceVersion;window.__ESPACIOS_TIMELINE__.sourceVersion=bhState.manifest?.version;}};


/* ===== AE universal collapsible cards v2 · 20260926-card-collapse-v2 ===== */
(function aeUniversalCollapsibleCardsV2(){
  const VERSION='20260926-card-collapse-v2';
  if(document.documentElement.dataset.aeCardCollapse===VERSION)return;
  document.documentElement.dataset.aeCardCollapse=VERSION;
  const icon=(collapsed)=>collapsed
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 14 5-5 5 5"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>';
  const specs=[
    ['#ae-explorer-overview','.ae-explorer-head','UAE spatial intelligence'],
    ['.location-quality','.location-quality-head','Location accuracy'],
    ['.availability-block','.availability-head','Availability'],
    ['.market-scope-card',':scope > span','Scope'],
    ['.market-history-chart',null,'History'],
    ['.market-forecast-card',null,'Forecast'],
    ['.spatial-coverage',':scope > div','Spatial geometry'],
    ['.ar-block',':scope > h3','Section'],
    ['.compare-inventory',null,'Inventory'],
    ['.compare-metrics',null,'Metrics'],
    ['.compare-table-wrap',null,'Comparison']
  ];
  const safe=(s)=>String(s||'section').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)||'section';
  const cardKey=(el)=>'ae-card-collapse:'+safe(el.id||el.dataset.aeCardKey||el.className||'card')+':'+[...document.querySelectorAll(el.tagName)].indexOf(el);
  const titleFor=(el,fallback)=>{
    const n=el.querySelector(':scope > h3,:scope > h4,:scope > strong,:scope > span,.ae-explorer-head h2,.location-quality-head strong,.availability-head strong');
    return (n?.textContent||fallback||'Section').trim().replace(/\s+/g,' ').slice(0,70);
  };
  function setCard(el,collapsed,save=true){
    if(!el)return;
    el.classList.toggle('ae2-section-collapsed',collapsed);
    const btn=el.querySelector(':scope > .ae2-card-host .ae2-card-toggle,:scope > .ae2-card-collapse-host .ae2-card-toggle');
    if(btn){
      btn.innerHTML=icon(collapsed);
      btn.setAttribute('aria-expanded',String(!collapsed));
      btn.setAttribute('aria-label',(collapsed?'Expand ':'Collapse ')+(btn.dataset.title||'section'));
      btn.title=(collapsed?'Expand ':'Collapse ')+(btn.dataset.title||'section');
    }
    if(save){try{localStorage.setItem(cardKey(el),collapsed?'1':'0')}catch{}}
    try{psrApplyDockPadding?.(true)}catch{}
  }
  function attach(el,hostSel,fallback){
    if(!el||el.dataset.ae2CardBound)return;
    el.dataset.ae2CardBound='1';
    let host=hostSel?el.querySelector(hostSel):null;
    if(!host){
      host=document.createElement('div');
      host.className='ae2-card-host ae2-card-collapse-host';
      const label=document.createElement('span');
      label.className='ae2-card-label';
      label.textContent=titleFor(el,fallback);
      host.appendChild(label);
      el.prepend(host);
    }else{
      host.classList.add('ae2-card-host');
    }
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='ae2-card-toggle';
    btn.dataset.title=titleFor(el,fallback);
    host.appendChild(btn);
    btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setCard(el,!el.classList.contains('ae2-section-collapsed'))});
    let saved=null;try{saved=localStorage.getItem(cardKey(el))}catch{}
    setCard(el,saved===null?true:saved==='1',false);
  }
  function scan(root=document){
    for(const [sel,host,fallback] of specs){
      if(root.nodeType===1&&root.matches&&root.matches(sel))attach(root,host,fallback);
      if(root.querySelectorAll)root.querySelectorAll(sel).forEach(el=>attach(el,host,fallback));
    }
  }
  scan();
  const app=document.getElementById('app')||document.body;
  let queued=false;
  new MutationObserver(ms=>{
    if(queued)return; queued=true;
    requestAnimationFrame(()=>{queued=false;for(const m of ms)for(const n of m.addedNodes)if(n.nodeType===1)scan(n)});
  }).observe(app,{childList:true,subtree:true});
  function collapseVisibleWorkspace(){
    document.querySelectorAll('.floating-panel:not(.hidden),#detail:not(.hidden),#compare-panel:not(.hidden)').forEach(panel=>{
      if(panel.classList.contains('ae-collapsed'))return;
      const b=panel.querySelector(':scope > .panel-title-row .ae-collapse-toggle,:scope > .compare-head .ae-collapse-toggle,:scope > .ae-collapse-toggle');
      if(b)b.click(); else panel.classList.add('ae-collapsed');
    });
    if(matchMedia('(max-width:760px)').matches){
      try{localStorage.setItem('ae-mobile-sheet-state','peek')}catch{}
      const p=document.querySelector('.floating-panel:not(.hidden)');
      if(p&&typeof aeSetMobileSheet==='function')aeSetMobileSheet(p,'peek',false);
    }
  }
  requestAnimationFrame(()=>setTimeout(collapseVisibleWorkspace,80));
})();

/* ===== Espacios collapse repair v3 · 20260929-collapse-repair-v3 ===== */
(function aeCollapseRepairV3(){
  const VERSION='20260929-collapse-repair-v3';
  if(document.documentElement.dataset.aeCollapseRepair===VERSION)return;
  document.documentElement.dataset.aeCollapseRepair=VERSION;
  const specs=[
    ['#ae-explorer-overview','.ae-explorer-head','UAE spatial intelligence'],
    ['.location-quality','.location-quality-head','Location accuracy'],
    ['.availability-block','.availability-head','Availability'],
    ['.market-scope-card',':scope > span','Scope'],
    ['.market-history-chart',null,'History'],
    ['.market-forecast-card',null,'Forecast'],
    ['.spatial-coverage',':scope > div','Spatial geometry'],
    ['.ar-block',':scope > h3','Section'],
    ['.compare-inventory',null,'Inventory'],
    ['.compare-metrics',null,'Metrics'],
    ['.compare-table-wrap',null,'Comparison']
  ];
  const icon=c=>c?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 14 5-5 5 5"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>';
  const clean=s=>String(s||'Section').trim().replace(/\s+/g,' ').slice(0,80)||'Section';
  const titleFor=(el,fallback)=>clean(el.querySelector(':scope > h2,:scope > h3,:scope > h4,:scope > strong,:scope > span,.ae-explorer-head h2,.location-quality-head strong,.availability-head strong')?.textContent||fallback);
  const storageKey=el=>'ae-card-collapse-v3:'+(el.id||el.className||el.tagName).toString().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,72);
  function sync(el,btn){const collapsed=el.classList.contains('ae2-section-collapsed'),title=btn.dataset.title||'Section';btn.innerHTML=icon(collapsed);btn.setAttribute('aria-expanded',String(!collapsed));btn.setAttribute('aria-label',(collapsed?'Expand ':'Collapse ')+title);btn.title=(collapsed?'Expand ':'Collapse ')+title;}
  function setCollapsed(el,collapsed,save=true){el.classList.toggle('ae2-section-collapsed',!!collapsed);el.querySelectorAll(':scope > .ae2-card-host .ae2-card-toggle,:scope > .ae2-card-collapse-host .ae2-card-toggle').forEach(btn=>sync(el,btn));if(save){try{localStorage.setItem(storageKey(el),collapsed?'1':'0')}catch{}}try{psrApplyDockPadding?.(true)}catch{}}
  function ensureCard(el,hostSel,fallback){
    if(!el)return;
    let host=hostSel?el.querySelector(hostSel):null;
    let btn=el.querySelector(':scope > .ae2-card-host .ae2-card-toggle,:scope > .ae2-card-collapse-host .ae2-card-toggle');
    if(btn){sync(el,btn);return;}
    if(!host){host=document.createElement('div');host.className='ae2-card-host ae2-card-collapse-host';const label=document.createElement('span');label.className='ae2-card-label';label.textContent=titleFor(el,fallback);host.appendChild(label);el.prepend(host);}else host.classList.add('ae2-card-host');
    btn=document.createElement('button');btn.type='button';btn.className='ae2-card-toggle';btn.dataset.title=titleFor(el,fallback);btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setCollapsed(el,!el.classList.contains('ae2-section-collapsed'));});host.appendChild(btn);
    if(!el.dataset.aeCollapseStateInitialized){el.dataset.aeCollapseStateInitialized='1';let saved=null;try{saved=localStorage.getItem(storageKey(el))}catch{}if(saved!==null)setCollapsed(el,saved==='1',false);else if(!el.classList.contains('ae2-section-collapsed'))setCollapsed(el,true,false);}
    sync(el,btn);
  }
  function repair(root=document){for(const [selector,hostSel,fallback] of specs){if(root.nodeType===1&&root.matches?.(selector))ensureCard(root,hostSel,fallback);root.querySelectorAll?.(selector).forEach(el=>ensureCard(el,hostSel,fallback));}document.querySelectorAll('.ae2-section-collapsed').forEach(el=>{const spec=specs.find(([selector])=>el.matches(selector));if(spec&&!el.querySelector(':scope > .ae2-card-host .ae2-card-toggle,:scope > .ae2-card-collapse-host .ae2-card-toggle'))ensureCard(el,spec[1],spec[2]);});}
  let scheduled=false;const scheduleRepair=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;repair(document);});};
  repair(document);
  new MutationObserver(scheduleRepair).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  requestAnimationFrame(()=>setTimeout(()=>{const panel=document.querySelector('.floating-panel:not(.hidden)');if(panel&&!panel.classList.contains('ae-collapsed'))panel.querySelector(':scope > .panel-title-row .ae-collapse-toggle,:scope > .ae-collapse-toggle')?.click();if(matchMedia('(max-width:760px)').matches&&panel){try{localStorage.setItem('ae-mobile-sheet-state','peek')}catch{}if(typeof aeSetMobileSheet==='function')aeSetMobileSheet(panel,'peek',false);}scheduleRepair();},120));
})();

/* ===== Espacios UAE coverage heat + continuous history/outlook dock v3 ===== */
const AE_UAE_RELEASE='20260929-collapse-repair-v3',AE_UAE_DATA_VERSION='20260927-uae-heatmap-v3-adrec';
const aeUaeState={installed:false,manifest:null,view:'heat',events:false,controlsBound:false,oldSet:null,oldMode:null,oldLegend:null,oldUpdate:null,oldAnalysisNote:'',noteObserver:null,pointVisibility:new Map(),selectedCount:0,knownYearCount:0,yearIndex:null,renderedSource:null,renderedPeriod:null,sourceUpdates:0,initComplete:false};
document.documentElement.dataset.uaeHeat=AE_UAE_RELEASE;
const aeUaeTimelineYears=()=>Array.from({length:18},(_,i)=>String(2019+i));
const aeUaeCurrentYear=()=>new Date().getUTCFullYear();
function aeUaePhase(year){return year<aeUaeCurrentYear()?'history':year===aeUaeCurrentYear()?'current':'outlook';}
function aeUaeCoverageActive(){return state.analysisMetric==='uae-project-coverage'&&tlState.mode==='delivery';}
function aeUaeSyncMode(){document.documentElement.dataset.aeUaeCoverage=aeUaeCoverageActive()?'1':'0';}
function aeUaeTimelineData(){
 const all=aeUaeState.manifest?.projectFeatures?.features||[],year=Number(tlState?.period);
 if(!aeUaeState.yearIndex&&aeUaeState.manifest){aeUaeState.yearIndex=new Map();for(const f of all){const v=f.properties?.handoverYear;if(v===null||v===undefined||String(v).trim()===''||!Number.isInteger(Number(v)))continue;const y=Number(v);if(!aeUaeState.yearIndex.has(y))aeUaeState.yearIndex.set(y,[]);aeUaeState.yearIndex.get(y).push(f);aeUaeState.knownYearCount++;}}
 const features=Number.isFinite(year)?aeUaeState.yearIndex?.get(year)||[]:all;
 aeUaeState.selectedCount=features.length;
 return {type:'FeatureCollection',features};
}
function aeUaeApplyPeriod(){
 if(!aeUaeCoverageActive()||!aeUaeState.manifest)return;
 const data=aeUaeTimelineData(),source=map.getSource('ae-uae-project-coverage');
 if(source&&(source!==aeUaeState.renderedSource||tlState.period!==aeUaeState.renderedPeriod)){source.setData(data);aeUaeState.renderedSource=source;aeUaeState.renderedPeriod=tlState.period;aeUaeState.sourceUpdates++;}
 document.documentElement.dataset.aePeriod=aeUaePhase(Number(tlState.period));
}
function aeUaePointLayers(){return ['project-clusters','project-cluster-count','project-points','project-hit','project-labels','project-unresolved-labels','project-fallback-ring','community-points','community-hit','community-labels','initiative-points','initiative-hit','place-points','place-clusters','place-cluster-count','place-hit'];}
function aeUaeVisibility(id,on){try{const desired=on?'visible':'none';if(map.getLayer(id)&&(map.getLayoutProperty(id,'visibility')||'visible')!==desired)map.setLayoutProperty(id,'visibility',desired);}catch(e){}}
function aeUaePointVisibility(heat){for(const id of aeUaePointLayers()){try{if(!map.getLayer(id))continue;if(heat){if(!aeUaeState.pointVisibility.has(id))aeUaeState.pointVisibility.set(id,map.getLayoutProperty(id,'visibility')||'visible');map.setLayoutProperty(id,'visibility','none');}else map.setLayoutProperty(id,'visibility',aeUaeState.pointVisibility.get(id)||'visible');}catch(e){}}}
function aeUaeSyncButtons(){document.querySelectorAll('#ae-map-view [data-ae-map-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.aeMapView===aeUaeState.view)));}
function aeUaeSetView(view,persist=true){
 aeUaeState.view=view==='points'?'points':'heat';
 if(persist)try{localStorage.setItem('espacios_map_view_v1',aeUaeState.view)}catch(e){}
 const heat=aeUaeState.view==='heat',coverage=aeUaeCoverageActive();
 aeUaeVisibility('ae-uae-project-heat',heat&&coverage);
 aeUaeVisibility('ae-uae-project-points',!heat&&coverage);
 aeUaeVisibility('ae-uae-project-hit',coverage);
 aeUaePointVisibility(heat||state.analysisMetric==='uae-project-coverage');
 if(!heat){try{tlHideOld();}catch(e){}}
 else if(state.analysisMetric!=='uae-project-coverage'){try{tlUpdate();}catch(e){}}
 aeUaeSyncButtons();
 aeUaeDensityKey();
}
function aeUaeInstallLayers(){
 if(!aeUaeState.manifest||!map?.getStyle?.())return false;
 const data=aeUaeTimelineData();
 if(!map.getSource('ae-uae-project-coverage')){map.addSource('ae-uae-project-coverage',{type:'geojson',data});aeUaeState.renderedSource=map.getSource('ae-uae-project-coverage');aeUaeState.renderedPeriod=tlState.period;}else aeUaeApplyPeriod();
 const before=['project-footprint-extrusions','project-clusters','project-points'].find(id=>map.getLayer(id));
 // Every catalogue record has the same visual weight across all emirates. The
 // retained v2 manifest's legacy emirate-normalized heatWeight is not used.
 if(!map.getLayer('ae-uae-project-heat'))map.addLayer({id:'ae-uae-project-heat',type:'heatmap',source:'ae-uae-project-coverage',maxzoom:16,paint:{'heatmap-weight':1,'heatmap-intensity':.32,'heatmap-radius':['interpolate',['linear'],['zoom'],4,14,7,22,11,30,16,40],'heatmap-opacity':['interpolate',['linear'],['zoom'],4,.75,12,.7,16,.4],'heatmap-color':['interpolate',['linear'],['heatmap-density'],0,'rgba(72,111,174,0)',.12,'rgba(72,111,174,.42)',.3,'rgba(78,167,188,.65)',.52,'rgba(83,190,171,.78)',.75,'rgba(179,204,135,.86)',1,'rgba(225,172,93,.92)'],'heatmap-opacity-transition':{duration:220,delay:0}}},before);
 if(!map.getLayer('ae-uae-project-hit'))map.addLayer({id:'ae-uae-project-hit',type:'circle',source:'ae-uae-project-coverage',minzoom:8.5,paint:{'circle-radius':['interpolate',['linear'],['zoom'],8.5,5,13,12],'circle-opacity':.001,'circle-stroke-opacity':0}},before);
 if(!map.getLayer('ae-uae-project-points'))map.addLayer({id:'ae-uae-project-points',type:'circle',source:'ae-uae-project-coverage',paint:{'circle-radius':['interpolate',['linear'],['zoom'],4,3,12,6],'circle-color':'#69b8b0','circle-opacity':.88,'circle-stroke-width':1.5,'circle-stroke-color':'#e6f1f2'}},before);
 if(!aeUaeState.events){aeUaeState.events=true;map.on('mouseenter','ae-uae-project-hit',()=>{map.getCanvas().style.cursor='pointer'});map.on('mouseleave','ae-uae-project-hit',()=>{map.getCanvas().style.cursor=''});map.on('click','ae-uae-project-hit',e=>{if(state.analysisMetric!=='uae-project-coverage')return;const id=e.features?.[0]?.properties?.id,r=id&&state.recordById?.get(String(id));if(!r)return;showDetail(r);if(typeof psrSetSelectedPoint==='function')psrSetSelectedPoint(r);});}
 aeUaeSetView(aeUaeState.view,false);return true;
}
function aeUaeSetText(selector,text){const el=tlQ(selector);if(el&&el.textContent!==text)el.textContent=text;}
function aeUaeCoverageEvidence(){
 if(!aeUaeCoverageActive())return;
 let box=tlQ('#tl-evidence');if(!box){box=document.createElement('section');box.id='tl-evidence';tlQ('#analysis-heat-view')?.append(box);}
 const features=aeUaeTimelineData().features,year=tlState.period,counts=aeUaeState.manifest?.counts?.byEmirate||{};
 const rows=Object.entries(counts).map(([name,c])=>{const dated=features.filter(f=>f.properties.emirate===name).length;return '<div class="ae-coverage-row"><span>'+esc(name)+'</span><strong>'+dated+'</strong><small>'+c.projects+' retained</small></div>';}).join('');
 const signature=year+'|'+features.length+'|'+Object.keys(counts).length;if(box.dataset.aeSignature===signature&&box.querySelector('.ae-coverage-table'))return;box.dataset.aeSignature=signature;
 box.innerHTML='<h3>Reported handovers · '+esc(year)+'</h3><p>Each mapped project has equal colour weight. Warmer areas contain more nearby catalogue records at this zoom.</p><div class="ae-coverage-table">'+rows+'</div><p class="ae-coverage-footnote">These are catalogue records, not a census of the market. Some coordinates represent a community location. Empty years have no dated records.</p><a href="/map/history">Historical data & sources</a> · <a href="/map/abu-dhabi">Abu Dhabi registry & valuation methodology</a>';
}
function aeUaeDensityKey(){
 const key=tlQ('#ae-density-key');if(!key)return;
 key.hidden=!aeUaeCoverageActive()||aeUaeState.view!=='heat';
 aeUaeSetText('#ae-density-count',aeUaeState.selectedCount.toLocaleString()+' mapped · '+tlState.period);
}
function aeUaeLayout(){
 const dock=tlQ('#tl-dock');if(!dock)return;
 let legend=dock.querySelector('.ae-legend-side');if(!legend){legend=document.createElement('aside');legend.className='ae-legend-side';legend.setAttribute('aria-label','Colour legend');legend.innerHTML='<span class="ae-legend-label">Colour legend</span>';legend.append(tlQ('#tl-scale'),tlQ('#tl-ticks'));dock.append(legend);}
 requestAnimationFrame(()=>{try{tlResize();}catch(e){}});
}
function aeUaeSetMinimized(minimized,persist=true){const dock=tlQ('#tl-dock'),button=tlQ('#tl-minimize');if(!dock||!button)return;dock.classList.toggle('is-minimized',minimized);button.textContent=minimized?'Expand timeline':'Minimize';button.setAttribute('aria-expanded',String(!minimized));button.setAttribute('aria-label',minimized?'Expand timeline controls':'Minimize timeline controls');if(persist)try{localStorage.setItem('espacios_timeline_compact_v1',minimized?'1':'0')}catch(e){};requestAnimationFrame(()=>{try{tlResize();}catch(e){}});}
function aeUaeBindControls(){
 if(aeUaeState.controlsBound)return;aeUaeState.controlsBound=true;
 document.addEventListener('click',e=>{const minimize=e.target.closest?.('#tl-minimize');if(minimize){e.preventDefault();e.stopPropagation();aeUaeSetMinimized(!tlQ('#tl-dock').classList.contains('is-minimized'));return;}const b=e.target.closest?.('[data-ae-map-view]');if(!b)return;e.preventDefault();e.stopPropagation();aeUaeSetView(b.dataset.aeMapView);},true);
}
function aeUaeCoverageLegend(){
 if(!aeUaeCoverageActive())return;
 const year=Number(tlState.period),phase=aeUaePhase(year),counts=aeUaeState.manifest?.counts||{},all=Number(counts.projects||0),mapped=Number(counts.geocodedProjects||0),unmapped=Number(counts.unmappedProjects||0),selected=aeUaeState.selectedCount,known=aeUaeState.knownYearCount;
 tlQ('#tl-title').textContent='History & outlook';
 tlQ('#tl-badge').textContent=selected?(phase==='history'?'HISTORY':phase==='current'?'CURRENT YEAR':'REPORTED OUTLOOK'):'NO REPORTED DATE';
 const meaning=phase==='history'?'catalogue-reported handover history; not independent proof of completion':phase==='current'?'current-year reported handover schedule':'future reported handover schedule; not a price forecast or guaranteed completion';
 tlQ('#tl-note').textContent=String(year)+' · '+selected.toLocaleString()+' mapped record'+(selected===1?'':'s')+' with a reported handover this year · '+meaning+'.';
 tlQ('#tl-dock').setAttribute('aria-description','History and outlook, 2019 to 2036. '+known+' mapped records have a year. All '+all+' catalogue records are retained: '+mapped+' mapped and '+unmapped+' unmapped. Missing dates are not zero.');
 const scale=tlQ('#tl-scale'),ticks=tlQ('#tl-ticks');if(scale){scale.style.background='linear-gradient(90deg,#486fae,#4ea7bc,#53beab,#b3cc87,#e1ac5d)';scale.setAttribute('aria-label','Lower to higher catalogue concentration; equal weight per mapped project. Not a price, demand or growth scale.');}if(ticks)ticks.innerHTML='<span>Lower</span><span></span><span>Catalogue density</span><span></span><span>Higher</span>';
 aeUaeDensityKey();
}
function aeUaeCoverageNote(){
 if(state.analysisMetric!=='uae-project-coverage')return;
 const note=tlQ('#analysis-note'),counts=aeUaeState.manifest?.counts||{},all=Number(counts.projects||1384),mapped=Number(counts.geocodedProjects||1339),unmapped=Number(counts.unmappedProjects||45);
 const text=all.toLocaleString()+' catalogue records across seven emirates · '+mapped.toLocaleString()+' mapped · '+unmapped.toLocaleString()+' awaiting coordinates. Colour shows catalogue density, not prices, demand or expected returns.';
 if(note&&note.textContent!==text)note.textContent=text;
}
function aeUaeInstallUi(){
 if(aeUaeState.installed||!tlState?.ready||!drState?.installed||!bhState?.installed||!tlQ('#tl-dock'))return false;
 aeUaeState.installed=true;
 const analysis=tlQ('#analysis-metric');if(analysis&&!analysis.querySelector('option[value="uae-project-coverage"]')){const option=document.createElement('option');option.value='uae-project-coverage';option.textContent='UAE project coverage · all emirates';analysis.prepend(option);}tlSyncMetricOptions();
 const head=tlQ('#tl-dock .tl-head');const views=document.createElement('span');views.id='ae-map-view';views.setAttribute('role','group');views.setAttribute('aria-label','Map project display');views.innerHTML='<button type="button" data-ae-map-view="heat" aria-pressed="true">Heatmap</button><button type="button" data-ae-map-view="points" aria-pressed="false">Points</button>';head.append(views);const minimize=document.createElement('button');minimize.id='tl-minimize';minimize.type='button';head.append(minimize);
 aeUaeBindControls();
 const key=document.createElement('details');key.id='ae-density-key';key.innerHTML='<summary><span class="ae-density-ramp" aria-hidden="true"></span><span>Project density</span><strong id="ae-density-count"></strong><span class="ae-key-info" aria-hidden="true">i</span></summary><div class="ae-density-explanation"><strong>What the colours mean</strong><p>Blue to amber shows lower to higher concentration of catalogue projects at the current zoom. Every mapped record has equal weight across all emirates.</p><p>Prices, demand and expected returns use separate metrics. A bright area does not establish a stronger market.</p><p>Some projects share approximate community coordinates. The selected year uses reported handover dates; undated records stay in the catalogue.</p></div>';tlQ('#tl-dock').prepend(key);
 for(const [value,label] of [['scenario','Hypothetical scenario · 10 years'],['delivery','History + 10-year reported outlook'],['forecast','Model forecast · evidence gated']]){for(const select of [tlQ('#tl-controls-mode'),tlQ('#dr-mode')]){const o=select?.querySelector('option[value="'+value+'"]');if(o)o.textContent=label;}}
 aeUaeState.oldMode=tlMode;tlMode=function(mode){const out=aeUaeState.oldMode(mode);if(mode==='scenario'){const keep=tlState.period;tlSetPeriods(tlK.quarterPeriods('2026Q3','2036Q3'));if(tlState.periods.includes(keep))tlState.period=keep;tlUpdate();}else if(mode==='delivery'){const keep=tlState.period;tlSetPeriods(aeUaeTimelineYears());tlState.period=tlState.periods.includes(keep)?keep:String(aeUaeCurrentYear());tlUpdate();}else if(mode==='forecast'){tlState.period='12 months';tlSetPeriods(['12 months','24 months','36 months']);tlUpdate();}aeUaeLayout();aeUaeCoverageLegend();return out;};
 aeUaeState.oldLegend=tlLegend;tlLegend=function(){const out=aeUaeState.oldLegend();aeUaeCoverageLegend();return out;};
 const aeUaeOldEvidence=tlEvidence;tlEvidence=function(){if(aeUaeCoverageActive())return aeUaeCoverageEvidence();const box=tlQ('#tl-evidence');if(box)delete box.dataset.aeSignature;return aeUaeOldEvidence();};
 aeUaeState.oldUpdate=tlUpdate;tlUpdate=function(){aeUaeSyncMode();if(aeUaeCoverageActive()){aeUaeApplyPeriod();tlState.frame=[];tlState.domain=[0,1];tlHideCustom();tlLegend();aeUaeVisibility('ae-uae-project-heat',aeUaeState.view==='heat');aeUaeVisibility('ae-uae-project-points',aeUaeState.view==='points');aeUaeVisibility('ae-uae-project-hit',true);aeUaeCoverageLegend();aeUaeCoverageNote();aeUaeCoverageEvidence();return;}for(const id of ['ae-uae-project-heat','ae-uae-project-points','ae-uae-project-hit'])aeUaeVisibility(id,false);const out=aeUaeState.oldUpdate();aeUaeDensityKey();return out;};
 aeUaeState.oldAnalysisNote=tlQ('#analysis-note')?.textContent||'';
 aeUaeState.oldSet=psrSetAnalysis;psrSetAnalysis=function(metric){const note=tlQ('#analysis-note');if(metric==='uae-project-coverage'){document.documentElement.dataset.aeUaeCoverage='1';aeUaeState.oldSet('off');state.analysisMetric=metric;if(analysis)analysis.value=metric;aeUaeCoverageNote();const m=tlQ('#tl-metric');if(m)m.value=metric;try{bhVisible(false);tlHideOld();tlHideCustom();}catch(e){}aeUaeSetView('heat',false);tlState.mode='delivery';tlState.view='value';const v=tlQ('#tl-view');if(v)v.value='value';tlState.period=String(aeUaeCurrentYear());tlSetPeriods(aeUaeTimelineYears());tlUpdate();aeUaeCoverageLegend();aeUaeCoverageNote();return;}delete document.documentElement.dataset.aeUaeCoverage;if(note&&aeUaeState.oldAnalysisNote)note.textContent=aeUaeState.oldAnalysisNote;const out=aeUaeState.oldSet(metric);aeUaeVisibility('ae-uae-project-heat',false);aeUaeVisibility('ae-uae-project-hit',false);aeUaeSetView(aeUaeState.view,false);return out;};
 const analysisRoot=tlQ('#analysis-heat-view');if(analysisRoot){aeUaeState.noteObserver=new MutationObserver(aeUaeCoverageNote);aeUaeState.noteObserver.observe(analysisRoot,{childList:true,subtree:true,characterData:true});}
 aeUaeLayout();let minimized=true;try{minimized=localStorage.getItem('espacios_timeline_compact_v1')!=='0'}catch(e){}aeUaeSetMinimized(minimized,false);
 map.on('style.load',()=>setTimeout(()=>{aeUaeInstallLayers();aeUaeSetView(aeUaeState.view,false);},180));
 psrSetAnalysis('uae-project-coverage');return true;
}
fetch('/map/api/uae-heatmap?v='+AE_UAE_RELEASE,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('UAE heatmap '+r.status);return r.json();}).then(m=>{if(m.version!==AE_UAE_DATA_VERSION||!m.projectFeatures?.features?.length)throw Error('UAE heatmap manifest mismatch');aeUaeState.manifest=m;aeUaeApplyPeriod();window.__ESPACIOS_UAE_HEATMAP__={release:AE_UAE_RELEASE,version:m.version,counts:m.counts,completeness:m.completeness,outlook:m.outlook,periodPolicy:m.periodPolicy,unmappedProjectRecords:m.unmappedProjectRecords,timeline:{start:'2019',current:String(aeUaeCurrentYear()),end:'2036',selected:()=>tlState.period,phase:()=>aeUaePhase(Number(tlState.period)),mappedRecordsWithYear:()=>aeUaeState.knownYearCount,visibleRecords:()=>aeUaeState.selectedCount},view:()=>aeUaeState.view};aeUaeInstallLayers();aeUaeCoverageLegend();aeUaeCoverageNote();}).catch(e=>console.warn('UAE heatmap manifest',e));
// Ready flags are checked separately: installUi returns false after its first
// success. Keeping it in a combined condition used to repaint every 250ms.
const aeUaeTimer=setInterval(()=>{aeUaeInstallUi();if(aeUaeState.installed&&aeUaeState.manifest&&aeUaeInstallLayers()){aeUaeState.initComplete=true;delete document.documentElement.dataset.aeMapLoading;clearInterval(aeUaeTimer);aeUaeCoverageEvidence();}},250);
window.__ESPACIOS_COVERAGE_RENDER__={weightBasis:'Equal weight per catalogue record across all emirates',get sourceUpdates(){return aeUaeState.sourceUpdates;},get initialized(){return aeUaeState.initComplete;},get selectedPeriod(){return tlState.period;},get selectedRecords(){return aeUaeState.selectedCount;}};

// Pure, deterministic scenario arithmetic. No historical observations are inputs
// to a fabricated crisis correction; every forward effect is an explicit input.
function TGCore(){
 const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const epoch=Date.parse('2026-06-30T00:00:00Z'),yearMs=365.25*86400000;
 function yearAt(period){const m=/^(\d{4})Q([1-4])$/.exec(period);return m?Date.UTC(+m[1],+m[2]*3,0):Date.parse(period+'T00:00:00Z');}
 function validate(a){
  if(!finite(a.rate)||+a.rate< -50||+a.rate>50)throw Error('Enter annual price growth from −50% to +50%; zero is allowed.');
  for(const s of a.shocks||[]){if(!finite(s.year)||+s.year<2027||+s.year>2036||!Number.isInteger(+s.year)||!finite(s.pct)||+s.pct>0||+s.pct< -80||!finite(s.recovery)||+s.recovery<0||+s.recovery>10)throw Error('Each disruption needs a 2027–2036 start year, a −80% to 0% shock and 0–10 recovery years (0 = persistent).');}
  for(const c of a.catalysts||[]){if(!c.initiativeId||!c.areaId||!finite(c.year)||+c.year<2026||+c.year>2036||!Number.isInteger(+c.year)||!finite(c.pct)||+c.pct<0||+c.pct>50||!finite(c.ramp)||+c.ramp<.25||+c.ramp>10||!finite(c.pricedIn)||+c.pricedIn<0||+c.pricedIn>100)throw Error('Each catalyst needs a project, an explicitly selected area, start year 2026–2036, uplift 0–50%, ramp 0.25–10 years and priced-in share 0–100%.');}
  return a;
 }
 function factors(a,period,areaId){
  const time=yearAt(period),years=Math.max(0,(time-epoch)/yearMs);
  if(!Number.isFinite(time)||time<epoch)return null;
  let shock=1,uplift=0;
  for(const s of a.shocks||[]){const elapsed=(time-Date.UTC(+s.year,0,1))/yearMs;if(elapsed>=0)shock*=1+(+s.pct/100)*(+s.recovery===0?1:clamp(1-elapsed/+s.recovery,0,1));}
  for(const c of a.catalysts||[]){if(c.areaId!==areaId)continue;const elapsed=(time-Math.max(epoch,Date.UTC(+c.year,0,1)))/yearMs;uplift=Math.max(uplift,(+c.pct/100)*(1-+c.pricedIn/100)*clamp(elapsed/+c.ramp,0,1));}
  // Overlapping project uplifts use the maximum, not a sum. Correlated projects
  // are not independent additive benefits. This is a disclosed scenario rule.
  return {growth:Math.pow(1+(+a.rate)/100,years),shock,uplift};
 }
 function value(base,a,period,areaId){if(!finite(base)||+base<=0)return null;const f=factors(a,period,areaId);return f?+base*f.growth*f.shock*(1+f.uplift):null;}
 function coverage(features,year,mode='cumulative'){return features.filter(f=>{const v=f.properties?.handoverYear;return finite(v)&&Number.isInteger(+v)&&(mode==='annual'?+v===+year:+v<=+year);});}
 return {finite,validate,factors,value,coverage,version:'20260927-progression-v1'};
}

/* Time progression: catalogue accumulation, observed history, explicit scenarios. */
const tgK=TGCore(),tgState={installed:false,coverage:'cumulative',shocks:[],catalysts:[],worker:null,token:0,busy:false,pending:null,key:'',last:null,error:'',renderedPeriod:null,config:null};
const tgActive=()=>tlState.mode==='scenario'&&tlBench()&&!String(state.analysisMetric).startsWith('roi');
const tgContext=[
 {year:2020,label:'11 Mar 2020 · WHO characterises COVID-19 as a pandemic',url:'https://www.who.int/news/item/29-06-2020-COVIDtimeline'},
 {year:2022,label:'24 Feb 2022 · UN statement on the war in Ukraine',url:'https://www.un.org/sg/en/content/sg/statements/2022-02-24/statement-the-secretary-general-ukraine'},
 {year:2026,label:'Etihad Rail · phased passenger rollout; check station-specific status',url:'https://corporate.etihadrail.ae/en/newsroom/press/etihad-rail-passes-70000-tickets-sold-as-passengers-begin-planning-their-lives-around-rail'},
 {year:2026,label:'Guggenheim Abu Dhabi · announced opening 11 Dec 2026',url:'https://www.mediaoffice.abudhabi/en/arts-culture/department-of-culture-and-tourism-abu-dhabi-announces-opening-of-guggenheim-abu-dhabi-on-11-december-2026/'}
];
function tgAssumptions(){return tgK.validate({rate:tlState.rate,shocks:tgState.shocks,catalysts:tgState.catalysts});}
function tgAreas(){return [...new Map((dgState.features||[]).map(f=>[f.id,f])).values()].sort((a,b)=>(a.emirate+' '+a.name).localeCompare(b.emirate+' '+b.name));}
function tgSafeUrl(url){try{const u=new URL(url);return u.protocol==='https:'?u.href:null;}catch{return null;}}
function tgSync(){
 if(!tgState.installed)return;
 const coverage=aeUaeCoverageActive(),scenario=tgActive();
 tlQ('#tg-coverage-select').hidden=!coverage;tlQ('#tg-scenarios').hidden=!scenario;
 tlQ('#tg-edit').hidden=!scenario;
 tlQ('#tg-play').textContent=tlState.playing?'Pause':'Play';tlQ('#tg-play').setAttribute('aria-pressed',String(tlState.playing));
 tlQ('#tg-play').disabled=tlState.periods.length<2||tlState.loading||(scenario&&(!tgState.config||!!tgState.error));
 for(const [id,on]of [['history',bhActive()],['coverage',coverage],['scenario',scenario]])tlQ('#tg-'+id)?.setAttribute('aria-pressed',String(on));
 const year=Number(String(tlState.period).slice(0,4)),events=tgContext.filter(e=>e.year===year),context=tlQ('#tg-context');
 context.innerHTML=events.map(e=>'<a target="_blank" rel="noopener" href="'+esc(e.url)+'">'+esc(e.label)+'</a>').join(' · ')+(events.length?' <span>Context only · no causal price adjustment.</span>':'');context.hidden=!events.length;
 if(coverage){const mode=tgState.coverage==='cumulative',all=aeUaeState.manifest?.projectFeatures?.features||[],n=all.filter(f=>tgK.finite(f.properties?.handoverYear)).length;
  tlQ('#tl-title').textContent=mode?'Project timeline · cumulative':'Project timeline · selected year';
  tlQ('#tl-note').textContent=tlState.period+' · '+aeUaeState.selectedCount+' dated mapped records '+(mode?'through this year':'in this year')+'. '+(all.length-n)+' mapped records remain undated. Catalogue schedule, not verified building stock or price growth.';
  const box=tlQ('#tl-evidence');if(box){box.querySelector('h3')?.replaceChildren(document.createTextNode((mode?'Reported handovers through ':'Reported handovers in ')+tlState.period));const p=box.querySelector('.ae-coverage-footnote');if(p)p.textContent='Cumulative mode retains dated records after their reported year. Annual mode shows only that year. Archived records are included; neither is a census of completed buildings. Undated records remain in the catalogue.';}
 }
 if(scenario){tlQ('#tl-title').textContent='Price scenario · assumptions, not a forecast';tlQ('#tl-badge').textContent=tgState.error?'CHECK INPUTS':tgState.busy?'RENDERING':'ASSUMPTIONS · NOT FORECAST';
  tlQ('#tl-note').textContent=tgState.error||(!tgState.config?'Set an annual assumption; add optional disruptions and project effects.':tlK.periodLabel(tlState.period)+' · '+tgState.config.rate+'% annual baseline · '+tgState.config.shocks.length+' disruption(s) · '+tgState.config.catalysts.length+' catalyst assumption(s). H1 2026 asking reference; not predicted prices or profit.');
  tlQ('#tg-status').textContent=tgState.error||'Project effects apply only to your chosen source areas. No default premium, automatic station catchment, or guaranteed appreciation.';
 }
 window.__ESPACIOS_PROGRESSION__={version:tgK.version,coverageMode:tgState.coverage,scenario:tgState.config,scenarioError:tgState.error,renderedPeriod:tgState.renderedPeriod,rendering:tgState.busy,historyAdjusted:false,catalystStacking:'maximum_not_sum',assumptionOnly:true};
}
function tgDownload(name,value){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function tgFields(){
 const projects=(state.initiatives||[]).slice().sort((a,b)=>a.name.localeCompare(b.name)),areas=tgAreas();
 const options=projects.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name+' · '+p.emirate)+'</option>').join('');
 const areaOptions=areas.map(a=>'<option value="'+esc(a.id)+'">'+esc(a.name+' · '+a.emirate)+'</option>').join('');
 const input=(key,label,value,min,max,step='any')=>'<label>'+label+'<input data-key="'+key+'" aria-label="'+label+'" type="number" min="'+min+'" max="'+max+'" step="'+step+'" value="'+esc(value)+'" required></label>';
 tlQ('#tg-shocks').innerHTML=tgState.shocks.map((s,i)=>'<fieldset data-shock="'+i+'"><legend>Disruption '+(i+1)+'</legend><div class="tg-grid">'+input('year','Assumed start year',s.year,2027,2036,1)+input('pct','Price shock · %',s.pct,-80,0)+input('recovery','Recovery years · 0 = persistent',s.recovery,0,10)+'</div><button type="button" data-remove-shock="'+i+'">Remove disruption</button></fieldset>').join('');
 tlQ('#tg-catalysts').innerHTML=tgState.catalysts.map((c,i)=>'<fieldset data-catalyst="'+i+'"><legend>Catalyst '+(i+1)+'</legend><div class="tg-grid"><label>Catalogue initiative<select data-key="initiativeId" aria-label="Catalogue initiative" required><option value="">Choose a project</option>'+options+'</select></label><label>Assumed affected area<select data-key="areaId" aria-label="Assumed affected area" required><option value="">Choose an area · no automatic catchment</option>'+areaOptions+'</select></label>'+input('year','Assumed effect start year',c.year,2026,2036,1)+input('pct','Total potential uplift · %',c.pct,0,50)+input('ramp','Ramp-up years',c.ramp,.25,10)+input('pricedIn','Already priced in · %',c.pricedIn,0,100)+'</div><p class="tg-project-source"></p><button type="button" data-remove-catalyst="'+i+'">Remove catalyst</button></fieldset>').join('');
 tlQ('#tg-catalysts').querySelectorAll('[data-catalyst]').forEach(el=>{const c=tgState.catalysts[+el.dataset.catalyst];el.querySelector('[data-key=initiativeId]').value=c.initiativeId;el.querySelector('[data-key=areaId]').value=c.areaId;tgProjectSource(el,c);});
 tlQ('#tg-project-count').textContent=projects.length+' retained initiatives available. Select only projects relevant to an area you can justify; these are scenario links, not verified catchments.';
}
function tgProjectSource(el,c){const p=(state.initiatives||[]).find(p=>p.id===c.initiativeId),node=el.querySelector('.tg-project-source');if(!p){node.textContent='No project selected.';return;}const special=/guggenheim/i.test(p.name)?tgContext[3]:/passenger-rail/i.test(p.name)?tgContext[2]:null,url=tgSafeUrl(special?.url||p.officialSourceUrl||p.source?.url);node.innerHTML=esc(p.timing||'No reported opening date')+' · '+esc(p.status||'Status not verified')+'. '+(url?'<a href="'+esc(url)+'" target="_blank" rel="noopener">Source</a>':'Source link not verified.')+' Effect year and uplift below are your assumptions, not the source’s claims.';}
function tgRenderScenario(){
 if(!tgActive())return;
 tgState.token++;tgState.renderedPeriod=null;tgState.error='';tgState.config=null;tlState.scenarioResult=null;tlState.source=null;tlState.message='Explicit price scenario from H1 2026 asking references; not a forecast.';tlHideCustom();dgVisible(false);tlState.frame=[];
 let a;try{a=tgAssumptions();tgState.config=JSON.parse(JSON.stringify(a));}catch(e){tgState.error=e.message;tlState.domain=[0,1];tlLegend();tgSync();return;}
 if(!sgState.data){tgState.error='Loading matched source boundaries. Retry once the map is ready.';tlLegend();tgSync();return;}
 const input=dgInputs(),source=input.features||[],changed=tlState.view==='change';
 if(!source.length){tgState.error='No sourced price reference with matched boundaries for this selection. Project effects cannot create a baseline price.';tlLegend();tgSync();return;}
 dgState.features=source;
 const areaSignature=source.map(f=>f.id).sort().join('|');if(tgState.areaSignature!==areaSignature){tgState.areaSignature=areaSignature;tgFields();}
 if(a.catalysts.some(c=>!source.some(f=>f.id===c.areaId))){tgState.error='A chosen catalyst area has no baseline for this property selection. Change its area or remove that assumption; no substitute value is used.';tlLegend();tgSync();return;}
 const transform=(f,p)=>{const v=tgK.value(f.value,a,p,f.id);return changed?tlK.change(v,f.value):v;};
 const values=source.flatMap(f=>tlState.periods.map(p=>transform(f,p)));
 tlState.domain=tlK.domain(values,changed);tlState.unit=changed?'%':state.analysisMetric==='price-psf'?'AED/sqft':'AED';
 const frame=source.map(f=>({...f,rawValue:f.value,baselineValue:f.value,value:transform(f,tlState.period),period:tlState.period,basis:'Explicit scenario: compound growth × recovering shock × area-specific catalyst; not a valuation or forecast',source:'H1 2026 asking benchmark',assumptions:JSON.stringify(a)}));
 tlState.frame=frame;tlLegend();tlEvidence();tgSync();
 const payload={token:tgState.token,features:frame,masks:input.masks,bandwidthKm:dgState.bandwidthKm,maxDimension:768};
 const snapshot={period:tlState.period,metric:state.analysisMetric,domain:tlState.domain.slice(),changed,config:JSON.stringify(a)};
 const task={payload,snapshot};
 try{if(!tgState.worker){const url=URL.createObjectURL(new Blob([DGKernel.toString()+'\n('+DGWorkerMain.toString()+')();'],{type:'text/javascript'}));tgState.worker=new Worker(url);URL.revokeObjectURL(url);
   tgState.worker.onmessage=e=>{const d=e.data,s=tgState.activeSnapshot;tgState.busy=false;if(d.token===tgState.token&&tgActive()&&s.period===tlState.period&&s.metric===state.analysisMetric){if(d.error||d.empty){tgState.error=d.error||'No supported scenario surface.';}else{for(let i=0;i<d.values.length;i++){if(!Number.isFinite(d.values[i])||!d.rgba[i*4+3])continue;const rgb=tlK.color(d.values[i],s.domain,s.changed).match(/\d+/g).map(Number);d.rgba.set(rgb,i*4);}tgState.last={...d,period:s.period};tlState.scenarioResult=d;tlOldDgAttach(d);dgHideAreas();dgVisible(true);tgState.renderedPeriod=s.period;}tlLegend();tgSync();}
    const next=tgState.pending;tgState.pending=null;if(next&&next.payload.token===tgState.token&&tgActive())tgPost(next);
   };tgState.worker.onerror=()=>{tgState.busy=false;tgState.pending=null;tgState.error='Scenario rendering failed; no fallback values are displayed.';dgVisible(false);tgSync();};}
  if(tgState.busy)tgState.pending=task;else tgPost(task);
 }catch(e){tgState.error=e.message;tgSync();}
}
function tgPost(task){tgState.busy=true;tgState.activeSnapshot=task.snapshot;tgState.worker.postMessage(task.payload);tgSync();}
function tgSetup(){
 if(tgState.installed||!aeUaeState.initComplete)return false;tgState.installed=true;
 const dock=tlQ('#tl-dock'),bar=document.createElement('div');bar.id='tg-bar';bar.setAttribute('aria-label','Time progression views');bar.innerHTML='<button id="tg-play" type="button" aria-pressed="false">Play</button><button id="tg-coverage" type="button">Projects</button><button id="tg-history" type="button">Price history</button><button id="tg-scenario" type="button">Scenario</button><select id="tg-coverage-mode" aria-label="Project timeline accumulation"><option value="catalogue">All mapped projects</option><option value="cumulative">Handovers through year</option><option value="annual">Handovers in year</option></select><button id="tg-edit" type="button" hidden>Assumptions</button><a href="/map/predictions">Research predictions</a>';dock.querySelector('.tl-head').after(bar);tlQ('#tg-coverage-mode').id='tg-coverage-select';
 const context=document.createElement('small');context.id='tg-context';context.hidden=true;dock.append(context);
 const panel=document.createElement('section');panel.id='tg-scenarios';panel.hidden=true;panel.innerHTML='<h3>Growth, disruptions & project effects</h3><p>These are your assumptions, not an estimated causal model. Prices can fall. Profit also depends on rent, vacancy, financing, fees, service charges and exit costs; use the Value cash-flow calculator separately.</p><p>Set annual growth above. Add a negative shock for a future pandemic, geopolitical disruption or other downside. Recovery is an assumption—not a guarantee. Set recovery to 0 for a persistent loss.</p><div id="tg-shocks"></div><button type="button" id="tg-add-shock">Add disruption</button><p id="tg-project-count"></p><div id="tg-catalysts"></div><button type="button" id="tg-add-catalyst">Add project effect</button><button type="button" id="tg-export">Export assumptions & values</button><p id="tg-status" role="status"></p><details><summary>Scenario methodology</summary><p>H1 2026 asking reference × compounded annual growth × temporary or persistent shock × (1 + incremental catalyst uplift). Each shock starts in January of your chosen year and fades linearly over your recovery duration; shocks multiply. Catalyst uplift ramps from your effect year, removes your already-priced-in share and applies only to the selected source-area geometry. Overlapping catalysts use the largest uplift, never a sum. The same colour scale is held across all displayed future quarters. Smoothing is visual, not new observations. No confidence interval or probability is implied.</p><p>Existing buildings are not erased during downturns. Catalogue density is not a price-growth indicator. Historical observations are never altered by these assumptions.</p></details>';tlQ('#tl-more').append(panel);
 tgFields();
 tlQ('#tg-play').onclick=()=>tlPlay();
 tlQ('#tg-coverage').onclick=()=>psrSetAnalysis('uae-project-coverage');
 tlQ('#tg-history').onclick=()=>{tlStop();tlState.mode='history';psrSetAnalysis('history:dubai-sale-psf');map.easeTo({center:[55.26,25.1],zoom:9,pitch:0,duration:500});};
 const show=()=>{aeUaeSetMinimized(false);tlQ('#tl-more').hidden=false;tlQ('#tl-settings').setAttribute('aria-expanded','true');tgFields();tgSync();tlResize();};
 tlQ('#tg-scenario').onclick=()=>{tlStop();if(!tlBench()||String(state.analysisMetric).startsWith('roi')){tlState.mode='history';psrSetAnalysis('price-psf');}tlMode('scenario');show();};tlQ('#tg-edit').onclick=show;
 tlQ('#tg-coverage-select').onchange=e=>{tlStop();tgState.coverage=e.target.value;aeUaeState.renderedPeriod=null;delete tlQ('#tl-evidence')?.dataset.aeSignature;tlUpdate();};
 tlQ('#tg-add-shock').onclick=()=>{tgState.shocks.push({year:'',pct:'',recovery:''});tgFields();tlUpdate();};
 tlQ('#tg-add-catalyst').onclick=()=>{tgState.catalysts.push({initiativeId:'',areaId:'',year:'',pct:'',ramp:'',pricedIn:''});tgFields();tlUpdate();};
 panel.addEventListener('change',e=>{const row=e.target.closest('[data-shock],[data-catalyst]'),key=e.target.dataset.key;if(!row||!key)return;const list=row.hasAttribute('data-shock')?tgState.shocks:tgState.catalysts,index=+(row.dataset.shock??row.dataset.catalyst);list[index][key]=e.target.value;if(row.hasAttribute('data-catalyst'))tgProjectSource(row,list[index]);tlStop();tlUpdate();});
 panel.addEventListener('click',e=>{const b=e.target.closest('[data-remove-shock],[data-remove-catalyst]');if(!b)return;if(b.hasAttribute('data-remove-shock'))tgState.shocks.splice(+b.dataset.removeShock,1);else tgState.catalysts.splice(+b.dataset.removeCatalyst,1);tgFields();tlUpdate();});
 tlQ('#tg-export').onclick=()=>tgDownload('espacios-scenario-'+tlState.period+'.json',{method:tgK.version,classification:'user_assumptions_not_forecast',baseline:'H1 2026 asking references',period:tlState.period,metric:state.analysisMetric,unit:tlState.unit,assumptions:tgState.config,error:tgState.error||null,initiatives:(state.initiatives||[]).filter(p=>tgState.catalysts.some(c=>c.initiativeId===p.id)),values:tgState.error?[]:tlState.frame,contextSources:tgContext});
 const oldData=aeUaeTimelineData;aeUaeTimelineData=function(){oldData();const features=tgK.coverage(aeUaeState.manifest?.projectFeatures?.features||[],Number(tlState.period),tgState.coverage);aeUaeState.selectedCount=features.length;return{type:'FeatureCollection',features};};aeUaeState.renderedPeriod=null;
 const oldLegend=tlLegend;tlLegend=function(){oldLegend();tgSync();};
 const oldUpdate=tlUpdate;tlUpdate=function(){const out=oldUpdate();tgSync();return out;};
 const oldScenario=tlScenario;tlScenario=function(){if(tgActive())return tgRenderScenario();return oldScenario(...arguments);};
 const oldDiagnostic=tlDiagnostic;tlDiagnostic=function(){oldDiagnostic();tgSync();};
 const oldMode=tlMode;tlMode=function(mode){tgState.token++;tgState.pending=null;tgState.last=null;const out=oldMode(mode);if(mode==='scenario'){tlState.baseline='2026H1';tlQ('#tl-baseline').innerHTML='<option value="2026H1">H1 2026 asking reference</option>';}tgSync();return out;};
 const oldSet=psrSetAnalysis;psrSetAnalysis=function(metric){tgState.token++;tgState.pending=null;tgState.last=null;const out=oldSet(metric);tgSync();return out;};
 const oldChoose=tlChooseDate;tlChooseDate=function(p){if(p!==tlState.period){tgState.token++;tgState.renderedPeriod=null;if(tgActive())dgVisible(false);}return oldChoose(p);};
 const oldStep=tlStep;tlStep=function(delta){if(tlState.playing&&(tlState.loading||bhState.loadingRaster||(tgActive()&&tgState.busy)))return;return oldStep(delta);};
 const oldStop=tlStop;tlStop=function(){oldStop();tgSync();};
 const oldPlay=tlPlay;tlPlay=function(){oldPlay();tgSync();};
 const oldExport=tlExport;tlExport=function(){if(tgActive()){tlQ('#tg-export').click();return;}return oldExport();};
 const oldTip=sgTooltip;sgTooltip=function(e){if(!tgActive())return oldTip(e);sgHideTooltip();const t=tlQ('#tl-tooltip');if(!t||!e.point||tgState.renderedPeriod!==tlState.period||map.isMoving()){if(t)t.hidden=true;return;}const ll=map.unproject(e.point),row=tlState.frame.find(f=>SG.contains([ll.lng,ll.lat],f.geometry));if(!row){t.hidden=true;return;}t.innerHTML='<b>'+esc(row.name)+'</b><br>'+esc(tlK.periodLabel(tlState.period))+' · '+esc(tlText(row.value))+'<br>Assumption-based source-area value, not a forecast or profit.<br>H1 2026 reference: '+esc(tlText(row.rawValue,state.analysisMetric==='price-psf'?'AED/sqft':'AED'));t.hidden=false;t.style.left=Math.max(8,Math.min(innerWidth-282,e.point.x+14))+'px';t.style.top=Math.max(8,Math.min(innerHeight-t.offsetHeight-8,e.point.y+14))+'px';};
 document.addEventListener('visibilitychange',()=>{if(document.hidden)tlStop();});
 tlUpdate();return true;
}
const tgTimer=setInterval(()=>{if(tgSetup())clearInterval(tgTimer);},300);

/* Exact source-area/basket joins. Never interpolate or splice different baskets. */
function PPPriceCore(){
 const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
 const key=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
 function merge(series,runs,segment,registration,cutoff){
  const names=new Map();for(const s of series)names.set(key(s.geography),(names.get(key(s.geography))||0)+1);
  return series.map(s=>{const points=s.points.filter(p=>!p.projection).map(p=>({...p})),byPeriod=new Map();
   for(const r of runs){const p=r.prediction;if(r.status!=='experimental_projection'||r.currentUse!=='research_only'||r.metric!=='median_sale_aed_sqft'||r.emirate!=='Dubai'||r.segment!==segment||r.registration!==registration||key(r.geography)!==key(s.geography)||names.get(key(s.geography))!==1||!p||p.targetPeriod<=cutoff||!/^\d{4}-\d{2}$/.test(p.targetPeriod)||![p.central,p.low,p.high].every(finite)||p.low>p.central||p.high<p.central||p.central<=0)continue;
    const at=p.targetPeriod;if(!byPeriod.has(at))byPeriod.set(at,[]);byPeriod.get(at).push(r);
   }
   for(const [period,rs]of byPeriod){if(rs.length!==1||points.some(p=>p.period===period))continue;const r=rs[0],p=r.prediction;points.push({period,value:p.central,low:p.low,high:p.high,projection:true,quality:'experimental_projection',runId:r.id,model:r.validation?.selectedModel,nominalLevel:p.intervalNominalLevel,sourceRows:null,eventCount:null,trainingCutoff:r.trainingCutoff,historySeriesId:r.historySeriesId});}
   return {...s,points:points.sort((a,b)=>a.period.localeCompare(b.period))};
  });
 }
 function months(first,last){const out=[];let [y,m]=first.split('-').map(Number);while(`${y}-${String(m).padStart(2,'0')}`<=last){out.push(`${y}-${String(m).padStart(2,'0')}`);if(++m===13){m=1;y++;}if(out.length>600)throw Error('Unexpected price horizon');}return out;}
 const latest=s=>s?.points.filter(p=>!p.projection&&finite(p.value)).at(-1)||null;
 return{finite,key,merge,months,latest};
}

/* Prices: recorded medians and saved research projections in the same map. */
const ppK=PPPriceCore(),ppState={installed:false,request:0,runs:null,promise:null,error:'',cutoff:'',targets:[],wanted:null,detailData:null,detailPromise:null};
const ppActive=()=>bhActive()&&bhPrice();
const ppFuture=()=>ppActive()&&!!ppState.cutoff&&tlState.period>ppState.cutoff;
const ppNum=v=>ppK.finite(v)?Number(v).toLocaleString('en',{maximumFractionDigits:0}):'Not supported';
const ppBasket=()=>tlType()+' · '+bhState.registration+' registration';
async function ppRuns(){if(ppState.runs)return ppState.runs;if(ppState.promise)return ppState.promise;ppState.promise=(async()=>{const all=[];let offset=0,total=1;while(offset<total){const r=await fetch('/map/api/prediction-catalogue?metric=median_sale_aed_sqft&limit=100&offset='+offset);if(!r.ok)throw Error('Saved price projections temporarily unavailable');const d=await r.json();if(d.version!=='20260927-history-predictions-v1')throw Error('Projection snapshot needs review');all.push(...d.runs);total=d.total;offset+=100;}ppState.runs=all;return all;})().catch(e=>{ppState.promise=null;throw e;});return ppState.promise;}
function ppSeries(name){const k=ppK.key(name);const xs=tlState.series.filter(s=>ppK.key(s.geography)===k);return xs.length===1?xs[0]:null;}
function ppSelected(){const name=state.selectedSpatial?.type==='community'?state.selectedSpatial.name:null;return (name&&ppSeries(name))||tlState.series.find(s=>s.geographyId===tlState.selectedArea)||null;}
function ppPointHtml(s,period){
 const p=s?.points.find(p=>p.period===period),latest=ppK.latest(s),future=period>(ppState.cutoff||'2026-08');
 if(!p||!ppK.finite(p.value))return '<p class="pp-unavailable">'+(future?'No released projection for this area and property basket at this horizon.':'The selected period has no eligible price for this basket.')+'</p>'+(latest?'<p>Latest eligible observation: AED '+ppNum(latest.value)+' / sqft · '+esc(tlK.periodLabel(latest.period))+'. Not carried into the selected date.</p>':'');
 return '<span class="pp-kind">'+(p.projection?'MODEL PROJECTION · RESEARCH':'OBSERVED SALE MEDIAN')+'</span><strong class="pp-price">AED '+ppNum(p.value)+' <small>/ sqft</small></strong><p>'+esc(tlK.periodLabel(p.period))+' · '+esc(s.segment)+' · '+esc(s.registration||bhState.registration)+' registration</p>'+(p.projection?'<p class="pp-range">Indicative '+Math.round((p.nominalLevel||.8)*100)+'% prediction interval<br><b>AED '+ppNum(p.low)+'–'+ppNum(p.high)+' / sqft</b></p><p>Model: '+esc(p.model||'saved research')+'. '+(p.model==='no-change'?'The tested baseline stays flat; growth has not been forced. ':'')+'Retrospective research, not a valuation or guaranteed return.</p>':'<p>'+ppNum(p.sourceRows)+' eligible sales · median of registered sale prices, not asking prices or an individual property valuation.</p>');
}
function ppTable(s){const latest=ppK.latest(s),ps=s?.points.filter(p=>p.projection)||[];return '<div class="pp-targets">'+(latest?'<button type="button" data-pp-date="'+latest.period+'">Latest · '+esc(tlK.periodLabel(latest.period))+'<b>AED '+ppNum(latest.value)+' / sqft</b></button>':'')+ps.map(p=>'<button type="button" data-pp-date="'+p.period+'">Projection · '+esc(tlK.periodLabel(p.period))+'<b>AED '+ppNum(p.value)+' / sqft</b><small>'+ppNum(p.low)+'–'+ppNum(p.high)+' · indicative 80% interval</small></button>').join('')+'</div>'+(ps.length?'':'<p>No released projection for this source area and basket. Choose a supported series; missing values are not zero.</p>');}
function ppSync(){
 if(!ppState.installed)return;const on=ppActive(),future=ppFuture();document.documentElement.dataset.ppPrices=on?'1':'0';
 tlQ('#pp-toolbar').hidden=!on;tlQ('#tg-history').textContent='Prices';tlQ('#tg-scenario').textContent='10-year scenario';
 if(on){const s=ppSelected(),p=s?.points.find(p=>p.period===tlState.period);tlQ('#tl-title').textContent='Prices · '+(future?'model projections':'observed sales')+' · '+ppBasket();tlQ('#tl-badge').textContent=future?'RESEARCH PROJECTION':'OBSERVED';
  tlQ('#tl-note').textContent=ppState.error||(future?'Saved model targets only. Indicative intervals are available in area details; missing areas are not filled.':'Registered-sale medians; changing property mix is not same-property appreciation.')+' '+ppBasket()+'.';
  tlQ('#pp-now').textContent='Latest prices';tlQ('#pp-now').disabled=tlState.loading;tlQ('#pp-projection').disabled=tlState.loading||!ppState.targets.length;
  tlQ('#pp-series').value=arState.segment+'|'+bhState.registration;
  tlQ('#pp-selected').textContent=s?s.geography+' · '+(ppK.finite(p?.value)?'AED '+ppNum(p.value)+' / sqft':'Not supported for '+tlK.periodLabel(tlState.period))+(p?.projection?' · indicative 80% range '+ppNum(p.low)+'–'+ppNum(p.high):''):future?'Select an area to see its estimate and uncertainty.':'Search or select an area to see prices and projections.';
  tlQ('#dr-help').textContent='Observed monthly prices + saved model targets. Future dragging snaps to released targets; no values are interpolated between them. '+ppBasket()+'.';
  tlQ('#dr-mode option[value="history"]').textContent='Prices + projections';
  tlQ('#tl-slider').setAttribute('aria-valuetext',tlK.periodLabel(tlState.period)+(future?' — research projection':' — observed prices'));
 }else if(tlQ('#dr-mode option[value="history"]'))tlQ('#dr-mode option[value="history"]').textContent='Reported history';
 ppDetail();
}
function ppOpen(date='latest',basket){
 tlStop();if(basket){const [segment,registration]=basket.split('|');arState.segment=segment;bhState.registration=registration;}
 else if(!ppActive()){arState.segment='apartment';bhState.registration='Ready';}
 bhState.frequency=ueState.requestedFrequency||bhState.frequency||'monthly';ueState.requestedFrequency=null;for(const id of ['ar-segment','tl-type'])if(tlQ('#'+id))tlQ('#'+id).value=arState.segment;tlQ('#bh-registration').value=bhState.registration;tlQ('#bh-frequency').value=bhState.frequency;
 tlState.loadedKey='';tlState.pendingKey='';tlState.mode='history';tlState.view='value';tlQ('#tl-view').value='value';ppState.wanted=date;axState.memo.clear();psrSetAnalysis('history:dubai-sale-psf');aeUaeSetView('heat',false);
}
async function ppDetailSource(){if(ppState.detailData)return ppState.detailData;if(ppState.detailPromise)return ppState.detailPromise;
 ppState.detailPromise=Promise.all([fetch('/map/api/dubai-history?frequency=monthly&segment=apartment&registration=Ready').then(r=>{if(!r.ok)throw Error('Price source unavailable');return r.json();}),ppRuns()]).then(([d,runs])=>{const series=d.series.map(s=>({geography:s.name,geographyId:'dld-area:'+s.id,segment:'apartment',registration:'Ready',points:s.points.map(p=>({period:p[0],value:p[1]>=20?p[2]:null,sourceRows:p[1]}))}));ppState.detailData=ppK.merge(series,runs,'apartment','Ready',d.periods.at(-1));return ppState.detailData;}).catch(e=>{ppState.detailPromise=null;throw e;});return ppState.detailPromise;}
function ppDetail(){
 const root=tlQ('#detail-body'),heading=root?.querySelector('h2'),selection=state.selectedSpatial;if(!root||!heading||selection?.type!=='community')return;
 const name=heading.textContent.trim();if(ppK.key(name)!==ppK.key(selection.name))return;
 let box=root.querySelector('.pp-card');if(!box){box=document.createElement('section');box.className='detail-section pp-card';box.setAttribute('aria-label','Area prices and projections');(root.querySelector('.detail-sub')||heading).after(box);}
 const series=ppActive()?ppSeries(name):(ppState.detailData||[]).find(s=>ppK.key(s.geography)===ppK.key(name));
 const period=ppActive()?tlState.period:ppK.latest(series)?.period;let html='<h3>Prices & projections</h3>';
 if(series)html+=ppPointHtml(series,period)+ppTable(series)+'<details><summary>Source & limits</summary><p>Dubai Real Estate Data, independently derived from DLD records. Registered-area denominator; source areas may differ from marketed communities. No villa or off-plan price is substituted for an apartment series. Prediction intervals have a nominal 80% target, not guaranteed future coverage.</p><a href="/map/predictions?q='+encodeURIComponent(series.geography)+'">Full research evidence</a></details>';
 else if(!ppActive()&&!ppState.detailData){html+='<p>Loading source-backed prices…</p>';ppDetailSource().then(ppDetail).catch(()=>{if(box.isConnected)box.innerHTML='<h3>Prices & projections</h3><p>Price evidence is temporarily unavailable. Reopen this area to retry.</p>';});}
 else if(ppActive()&&tlState.loading)html+='<p>Loading prices for the selected property series…</p>';
 else html+='<p>No unambiguous registered-price match for this community and basket. Project asking prices below remain a separate measure.</p><button type="button" data-pp-date="latest">Open Prices</button>';
 // Compare the authored render key, not browser-normalized HTML serialization.
 // Serialization can reorder/escape attributes and otherwise trigger a mutation loop.
 if(box.ppRenderKey!==html){box.ppRenderKey=html;box.innerHTML=html;}
}
function ppEvidence(){const box=tlQ('#tl-evidence');if(!box)return;const s=ppSelected()||tlState.series.find(s=>s.points.some(p=>p.period===tlState.period&&ppK.finite(p.value)));box.innerHTML='<h3>Prices & projections · '+esc(tlK.periodLabel(tlState.period))+'</h3><label>Inspect an area<select id="pp-area">'+tlState.series.map(x=>'<option value="'+esc(x.geographyId)+'" '+(x===s?'selected':'')+'>'+esc(x.geography)+'</option>').join('')+'</select></label>'+(s?'<h4>'+esc(s.geography)+'</h4>'+ppPointHtml(s,tlState.period)+ppTable(s):'<p>Loading source-backed prices…</p>')+'<p><a href="/map/history">Historical sources</a> · <a href="/map/predictions">Model methodology and saved runs</a></p>';tlQ('#pp-area').onchange=e=>{tlState.selectedArea=e.target.value;ppEvidence();ppSync();};}
function ppInstall(){
 if(ppState.installed||!tgState.installed||!bhState.installed)return false;ppState.installed=true;
 const bar=document.createElement('div');bar.id='pp-toolbar';bar.hidden=true;bar.innerHTML='<select id="pp-series" aria-label="Price property series"><option value="apartment|Ready">Apartments · Ready registration</option><option value="apartment|Off-Plan">Apartments · Off-plan registration</option><option value="villa|Ready">Villas · Ready registration</option><option value="villa|Off-Plan">Villas · Off-plan registration</option><option value="all|All">All residential · All registrations</option></select><button id="pp-now" type="button">Latest prices</button><button id="pp-projection" type="button">Projections</button><span id="pp-selected" role="status"></span>';tlQ('#tg-bar').after(bar);
 tlQ('#tg-history').onclick=()=>ppOpen();tlQ('#pp-series').onchange=e=>ppOpen('latest',e.target.value);tlQ('#pp-now').onclick=()=>{tlStop();tlChooseDate(ppState.cutoff);};tlQ('#pp-projection').onclick=()=>{tlStop();const s=ppSelected(),target=s?.points.find(p=>p.projection)?.period||ppState.targets[0];if(target)tlChooseDate(target);};
 document.addEventListener('click',e=>{const b=e.target.closest?.('[data-pp-date]');if(!b)return;const date=b.dataset.ppDate;if(ppActive()&&date!=='latest'&&tlState.periods.includes(date)){tlStop();tlChooseDate(date);}else ppOpen(date);});
 const oldLoad=tlLoadHistory;tlLoadHistory=async function(){const token=++ppState.request;ppState.error='';await oldLoad(...arguments);if(token!==ppState.request||!ppActive()||tlState.loading||!tlState.series.length)return;
  const history=tlState.series.map(s=>({...s,registration:bhState.registration})),observedPeriods=tlState.periods.slice(),segment=bhBasket(),registration=bhState.registration,period=tlState.period;
  ppState.cutoff=observedPeriods.at(-1);ppState.targets=[];
  if(bhState.frequency==='monthly'){try{const runs=await ppRuns();if(token!==ppState.request||!ppActive()||segment!==bhBasket()||registration!==bhState.registration)return;tlState.series=ppK.merge(history,runs,segment,registration,ppState.cutoff);ppState.targets=[...new Set(tlState.series.flatMap(s=>s.points.filter(p=>p.projection).map(p=>p.period)))].sort();}catch(e){ppState.error=e.message;tlState.series=history;}}
  else tlState.series=history;
  const periods=ppState.targets.length?ppK.months(observedPeriods[0],ppState.targets.at(-1)):observedPeriods;
  const wanted=ppState.wanted;ppState.wanted=null;tlState.period=wanted==='latest'?ppState.cutoff:wanted&&periods.includes(wanted)?wanted:period;tlSetPeriods(periods);bhState.rasterCache.clear();bhState.lastRenderKey='';tlRenderHistory();ppSync();
 };
 const oldRows=tlRows;tlRows=function(period){const rows=oldRows(period);if(!ppActive())return rows;return rows.map(r=>{const p=tlState.series.find(s=>s.geographyId===r.id)?.points.find(p=>p.period===period);return{...r,projection:!!p?.projection,low:p?.low,high:p?.high,runId:p?.runId,model:p?.model,nominalLevel:p?.nominalLevel,sourceRows:p?.projection?null:r.sourceRows,basis:p?.projection?'Saved experimental price projection; indicative interval, not a property valuation':r.basis};});};
 const oldLegend=tlLegend;tlLegend=function(){oldLegend();ppSync();};const oldBhLegend=bhLegend;bhLegend=function(){oldBhLegend();ppSync();};
 const oldEvidence=tlEvidence;tlEvidence=function(){if(ppActive()){ppEvidence();return;}return oldEvidence();};
 const oldChoose=tlChooseDate;tlChooseDate=function(p){if(ppActive()&&ppState.targets.length&&p>ppState.cutoff&&!ppState.targets.includes(p)){const opts=[ppState.cutoff,...ppState.targets],at=Date.parse(p+'-01');p=opts.reduce((a,b)=>Math.abs(Date.parse(a+'-01')-at)<=Math.abs(Date.parse(b+'-01')-at)?a:b);}return oldChoose(p);};
 const oldStep=tlStep;tlStep=function(delta){if(!ppActive()||!ppState.targets.length)return oldStep(delta);if(tlState.playing&&(tlState.loading||bhState.loadingRaster))return;const periods=tlState.periods.filter(p=>p<=ppState.cutoff||ppState.targets.includes(p)),i=periods.indexOf(tlState.period);tlChooseDate(periods[Math.max(0,Math.min(periods.length-1,i+delta))]);};
 tlQ('#tl-slider').addEventListener('keydown',e=>{if(ppActive()&&['ArrowRight','ArrowLeft','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();tlStop();tlStep(['ArrowRight','ArrowUp'].includes(e.key)?1:-1);}},true);
 const oldExport=tlExport;tlExport=function(){if(!ppActive())return oldExport();tgDownload('espacios-prices-'+tlState.period+'.json',{classification:ppFuture()?'experimental_projection':'observed_sales',period:tlState.period,segment:bhBasket(),registration:bhState.registration,unit:tlState.unit,values:tlState.frame,limitations:'Independent DLD-derived snapshot; changing mix; retrospective models and nominal intervals, not property valuations. No interpolation.'});};
 const oldTooltip=sgTooltip;sgTooltip=function(e){if(!ppActive()||!ppFuture())return oldTooltip(e);sgHideTooltip();const t=tlQ('#tl-tooltip');if(!t||!e.point||map.isMoving()||bhState.loadingRaster){if(t)t.hidden=true;return;}const ll=map.unproject(e.point),r=tlState.frame.find(r=>r.projection&&(r.geometryIds||[]).some(id=>{const f=sgState.data.features.find(f=>String(f.id)===String(id));return f&&SG.contains([ll.lng,ll.lat],f.geometry);}));if(!r){t.hidden=true;return;}const s=tlState.series.find(s=>s.geographyId===r.id);t.innerHTML='<b>'+esc(r.name)+'</b>'+ppPointHtml(s,tlState.period);t.hidden=false;t.style.left=Math.max(8,Math.min(innerWidth-300,e.point.x+14))+'px';t.style.top=Math.max(8,Math.min(innerHeight-t.offsetHeight-8,e.point.y+14))+'px';};
 new MutationObserver(()=>ppDetail()).observe(tlQ('#detail-body'),{childList:true,subtree:true});
 ppSync();return true;
}
const ppTimer=setInterval(()=>{if(ppInstall())clearInterval(ppTimer);},300);

/* Published observations stay at their native dates and geography/type grain. */
function MSSegmentCore(){
 const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
 const norm=v=>String(v||'').trim().toLowerCase().replace(/\s+/g,' ');
 const types=segment=>segment==='both'?['apartment','villa']:[segment];
 function select(rows,emirate,segment,community){return rows.filter(r=>norm(r.emirate)===norm(emirate)&&types(segment).includes(r.segment)&&(!community||norm(r.community)===norm(community)));}
 const periods=rows=>[...new Set(rows.map(r=>r.period))].sort();
 function point(rows,period,segment){const matches=rows.filter(r=>r.period===period&&r.segment===segment);return matches.length===1?matches[0]:null;}
 function pair(rows,period){return {apartment:point(rows,period,'apartment'),villa:point(rows,period,'villa')};}
 // An optional capital split is an explicit portfolio assumption, never an
 // observed mixed-population statistic or a forecast. Require both source rows.
 function weightedYield(pair,weight){if(!finite(weight)||+weight<0||+weight>100||!finite(pair.apartment?.roi)||!finite(pair.villa?.roi))return null;return +weight/100*pair.apartment.roi+(1-+weight/100)*pair.villa.roi;}
 function series(rows,metric,key){const groups=new Map();for(const r of rows){const id=[r.emirate,r.community,r.segment].join('|');if(!groups.has(id))groups.set(id,[]);groups.get(id).push(r);}return [...groups].map(([id,rs])=>({id,geographyId:id,geography:rs[0].community,emirate:rs[0].emirate,segment:rs[0].segment,metric,unit:metric==='roi'?'%':'AED/sqft',dataset:'Bayut community benchmarks',basis:metric==='roi'?'Publisher gross rental yield benchmark; not net or total return':'Advertised price per sqft; not registered sale price',surfaceKey:key(rs[0].emirate,rs[0].community),points:rs.slice().sort((a,b)=>a.period.localeCompare(b.period)).map(r=>({period:r.period,value:r[metric],sourceRows:null,sourceId:r.sourceId,sourceUrl:r.sourceUrl,observation:r}))}));}
 return {finite,norm,types,select,periods,point,pair,weightedYield,series};
}

/* One explicit property/region selector for prices and gross rental yield. */
const msK=MSSegmentCore(),msState={installed:false,data:null,promise:null,emirate:'Dubai',kind:'price',basis:'sales',segment:'apartment',area:'',open:false,forecastNotice:false,weight:'',error:'',token:0,patterns:new Set(),mapBound:false};
const msActive=()=>['history:market-asking','history:market-yield'].includes(state.analysisMetric);
const msVisible=()=>msActive()||ppActive();
const msMetric=()=>state.analysisMetric==='history:market-yield'?'roi':'askPsf';
const msLabel=s=>({apartment:'Apartments',villa:'Villas',both:'Apartments + villas',all:'All property types'})[s]||s;
const msFormat=(v,metric)=>msK.finite(v)?(metric==='roi'?Number(v).toFixed(2)+'%':'AED '+Number(v).toLocaleString('en',{maximumFractionDigits:0})+' / sqft'):'Not published';
function msSetSegment(segment){msState.segment=segment;if(segment==='both'){arState.segment='custom';axState.custom=['apartment','villa'];}else arState.segment=segment;for(const id of ['ar-segment','tl-type'])if(tlQ('#'+id))tlQ('#'+id).value=arState.segment;axState.memo.clear();}
function msLoad(){if(msState.data)return Promise.resolve(msState.data);if(msState.promise)return msState.promise;msState.promise=fetch('/map/api/market-segments?v=20260928-market-segments-v3').then(r=>{if(!r.ok)throw Error('Market evidence temporarily unavailable');return r.json();}).then(d=>{if(d.version!=='20260928-market-segments-v3'||d.rows?.length!==228)throw Error('Market snapshot needs review');msState.data=d;return d;}).catch(e=>{msState.promise=null;throw e;});return msState.promise;}
function msRows(community){return msK.select(msState.data?.rows||[],msState.emirate,msState.segment,community);}
function msCommunity(){const selected=state.selectedSpatial;if(selected?.type!=='community')return null;const record=[...(state.communities||[]),...(arState.catalogue?.communities||[])].find(c=>String(c.id)===String(selected.id));return record||((state.selected?.kind==='community')?state.selected:null);}
function msHide(){for(const id of ['ms-fill','ms-outline'])if(map.getLayer(id))map.setLayoutProperty(id,'visibility','none');}
function msPeriodAction(action){
 tlStop();msState.forecastNotice=false;
 if(action==='forecast'){
  if(ppActive()){const s=ppSelected(),targets=s?s.points.filter(p=>p.projection).map(p=>p.period):ppState.targets;if(targets.length){tlChooseDate(targets[0]);msState.open=true;msSync();return;}}
  msState.forecastNotice=true;msState.open=true;msSync();tlQ('#ms-inspect').scrollTop=0;return;
 }
 const dates=ppActive()?tlState.periods.filter(p=>p<=ppState.cutoff):tlState.periods;
 if(dates.length&&dates[0]!=='Unavailable')tlChooseDate(action==='history'?dates[0]:dates.at(-1));msSync();tlQ('#ms-inspect').scrollTop=0;
}
function msOpen(kind=msState.kind,focus=false){
 tlStop();msState.kind=kind;msState.error='';msState.forecastNotice=false;msSetSegment(msState.segment);
 if(kind==='price'&&msState.emirate==='Dubai'&&msState.basis==='sales')ppOpen('latest',arState.segment+'|'+bhState.registration);
 else psrSetAnalysis(kind==='roi'?'history:market-yield':'history:market-asking');
 aeUaeSetView('heat',false);
 if(focus){const views={'Dubai':[[55.26,25.10],9],'Abu Dhabi':[[54.48,24.46],10],'Sharjah':[[55.47,25.3],10],'Ajman':[[55.53,25.4],11],'Umm Al Quwain':[[55.68,25.56],10],'Ras Al Khaimah':[[55.98,25.69],10],'Fujairah':[[56.31,25.16],10]},v=views[msState.emirate];if(v)map.easeTo({center:v[0],zoom:v[1],pitch:0,duration:500});}
 msSync();tlQ('#ms-inspect').scrollTop=0;
}
async function msLoadHistory(){
 const token=++msState.token;++tlState.request;++ppState.request;
 tlState.loading=true;tlState.series=[];tlState.frame=[];msState.error='';tlHideOld();tlHideCustom();msHide();tlLegend();
 try{await Promise.all([msLoad(),sgLoad()]);if(token!==msState.token||!msActive())return;
  const rows=msRows(),metric=msMetric();tlState.series=msK.series(rows,metric,SG.key);
  for(const s of tlState.series){const candidates=(sgState.data?.features||[]).filter(f=>f.properties.level!=='emirate'&&SG.key(f.properties.emirate,f.properties.name)===s.surfaceKey);
   // Prefer the published district, then an exact-name community. Never map a
   // locality to a different parent just to increase coloured coverage.
   const rank=Math.min(...candidates.map(f=>f.properties.rank||99)),best=candidates.filter(f=>(f.properties.rank||99)===rank);s.geometryIds=best.length===1?[best[0].id]:[];
  }
  tlState.source=null;tlState.view='value';tlState.unit=metric==='roi'?'%':'AED/sqft';tlState.period=msK.periods(rows).at(-1)||'Unavailable';tlSetPeriods(msK.periods(rows));tlState.loading=false;msRender();
 }catch(e){if(token!==msState.token||!msActive())return;tlState.loading=false;msState.error=e.message;tlSetPeriods([]);tlLegend();msSync();}
}
function msPattern(apartment,villa,domain){
 const color=value=>msK.finite(value)?tlK.color(value,domain,false).match(/\d+/g).slice(0,3).map(Number):[117,130,145];
 const a=color(apartment),v=color(villa),key='ms-'+a.join('-')+'-'+v.join('-')+'-'+Number(msK.finite(apartment))+Number(msK.finite(villa));
 if(!map.hasImage(key)){const data=new Uint8Array(8*8*4);for(let y=0;y<8;y++)for(let x=0;x<8;x++){const stripe=(x+y)%8<4,c=stripe?v:a,present=stripe?msK.finite(villa):msK.finite(apartment);data.set([...c,present?255:45],(y*8+x)*4);}map.addImage(key,{width:8,height:8,data});msState.patterns.add(key);}return key;
}
function msRender(){
 if(!msActive()||tlState.loading)return;
 const metric=msMetric(),all=(msState.data?.rows||[]).filter(r=>r.emirate===msState.emirate),domain=tlK.domain(all.map(r=>r[metric]));tlState.domain=domain;tlState.unit=metric==='roi'?'%':'AED/sqft';
 tlState.frame=tlState.series.map(s=>{const p=s.points.find(p=>p.period===tlState.period);return{id:s.geographyId,name:s.geography,emirate:s.emirate,segment:s.segment,period:tlState.period,value:p?.value??null,rawValue:p?.value??null,geometryIds:s.geometryIds,source:p?.sourceUrl||'',sourceRows:null,basis:s.basis};});
 tlHideOld();tlHideCustom();const groups=new Map(),byId=new Map((sgState.data?.features||[]).map(f=>[String(f.id),f]));
 for(const r of tlState.frame){for(const id of r.geometryIds){if(!groups.has(id))groups.set(id,{name:r.name,apartment:null,villa:null});groups.get(id)[r.segment]=r.value;}}
 const features=[];for(const [id,r]of groups){if(!msK.finite(r.apartment)&&!msK.finite(r.villa))continue;const f=byId.get(String(id));if(!f)continue;const value=msState.segment==='villa'?r.villa:r.apartment;
  features.push({...f,properties:{name:r.name,color:msK.finite(value)?tlK.color(value,domain,false):'#8193a3',pattern:msPattern(r.apartment,r.villa,domain)}});
 }
 sgSource('ms-polygons',{type:'FeatureCollection',features});const before=map.getLayer('project-hit')?'project-hit':undefined;
 if(!map.getLayer('ms-fill'))map.addLayer({id:'ms-fill',type:'fill',source:'ms-polygons',paint:{'fill-color':['get','color'],'fill-opacity':.57}},before);
 if(!map.getLayer('ms-outline'))map.addLayer({id:'ms-outline',type:'line',source:'ms-polygons',paint:{'line-color':document.documentElement.dataset.espaciosTheme==='light'?'#425769':'#b9cddd','line-width':1,'line-opacity':.7}},before);
 map.setPaintProperty('ms-fill','fill-pattern',msState.segment==='both'?['get','pattern']:null);for(const id of ['ms-fill','ms-outline'])map.setLayoutProperty(id,'visibility','visible');
 if(!msState.mapBound){msState.mapBound=true;map.on('click','ms-fill',e=>{if(!msActive())return;msState.area=e.features?.[0]?.properties.name||'';msState.open=true;msSync();});}
 aeUaePointVisibility(true);tlLegend();tlEvidence();msSync();
}
function msHeading(){return msState.kind==='roi'?'ROI · gross rental yield':msActive()?'Asking prices':'Registered-sale prices';}
function msAreas(){return msActive()?[...new Set(msRows().map(r=>r.community))].sort():ppActive()?tlState.series.map(s=>s.geography).sort():[];}
function msTable(rows){
 const periods=msK.periods(rows),both=msState.segment==='both';if(!periods.length)return '';
 const cells=r=>'<td>'+esc(msFormat(r?.askPsf,'askPsf'))+'</td><td>'+esc(msFormat(r?.roi,'roi'))+'</td>';
 return '<details class="ms-history"><summary>All captured history · '+periods.length+' snapshot'+(periods.length===1?'':'s')+'</summary><div class="ms-table-scroll"><table><caption>Published asking prices and gross rental yield; not registered sales or net return</caption><thead>'+(both?'<tr><th rowspan="2">Period</th><th colspan="2">Apartments</th><th colspan="2">Villas</th></tr><tr><th>AED/sqft</th><th>Yield</th><th>AED/sqft</th><th>Yield</th></tr>':'<tr><th>Period</th><th>AED/sqft</th><th>Yield</th></tr>')+'</thead><tbody>'+periods.map(p=>'<tr><th><button type="button" data-ms-period="'+p+'">'+esc(tlK.periodLabel(p))+'</button></th>'+msK.types(msState.segment).map(t=>cells(msK.point(rows,p,t))).join('')+'</tr>').join('')+'</tbody></table></div></details>';
}
function msBenchmarkCard(area,emirate=msState.emirate,segment=msState.segment,period=tlState.period){
 const rows=msK.select(msState.data?.rows||[],emirate,segment,area),p=msK.pair(rows,period),types=msK.types(segment),dates=msK.periods(rows),latest=dates.at(-1);
 if(!msState.data)return '<p>Loading published market evidence…</p>';
 let html='<span class="pp-kind">PUBLISHED ASKING / GROSS YIELD BENCHMARK</span><p>'+esc(emirate+' · '+tlK.periodLabel(period))+' · not a live transaction quote</p><div class="ms-values">'+types.map(t=>{const r=p[t];return '<article><h4>'+esc(msLabel(t))+'</h4>'+(r?'<strong>'+esc(msFormat(r.askPsf,'askPsf'))+'</strong><p>Gross rental yield <b>'+esc(r.conflict?'Withheld':msFormat(r.roi,'roi'))+'</b></p>'+(r.conflict?'<p>'+esc(r.conflict)+'</p>':''):'<p>No published benchmark for this type and period.</p>')+'</article>';}).join('')+'</div>';
 if(!rows.length)html+='<p>This community has no reviewed price/yield series in this source snapshot. Its project records are retained; another community’s values are not substituted.</p>';
 if(rows.length&&msActive()&&emirate===msState.emirate&&!tlState.series.some(s=>s.geography===area&&s.geometryIds.length))html+='<p>Published records are available here, but no unambiguous source-area boundary match is available for map shading.</p>';
 if(latest&&period!==latest)html+='<p>Latest published snapshot: '+esc(tlK.periodLabel(latest))+'. The selected historical period has not been replaced.</p>';
 if(segment==='both')html+='<p>Two separate property baskets—not an averaged price or a blended ROI.</p>';
 // A portfolio result is shown only with a user-entered capital weight and
 // two compatible, same-period source rows. It never colours the map.
 if(segment==='both'&&msState.kind==='roi'&&emirate===msState.emirate){const mixed=msK.weightedYield(p,msState.weight);html+='<p class="ms-mixed">'+(msK.finite(mixed)?'<b>'+mixed.toFixed(2)+'% assumed blended gross yield</b><br>'+esc(msState.weight)+'% of purchase capital in apartments; '+(100-Number(msState.weight))+'% in villas. Uses these source yields; not an observed portfolio, net ROI or forecast.':'For a mixed-portfolio illustration, enter the apartment share of purchase capital below. Both type benchmarks must exist for this period.')+'</p>';}
 if(segment===msState.segment)html+=msTable(rows);
 const sources=[...new Map(rows.map(r=>[r.sourceUrl,r])).values()];html+='<details><summary>Sources & methodology</summary><p>Bayut published area/type asking-price and projected gross rental-yield tables. Yield is a rental benchmark at the source period, not a future price prediction. Source samples and property mix may change; these snapshots do not measure same-property appreciation. No monthly interpolation, backward fill or forward fill. Net ROI also needs vacancy, fees, maintenance, financing and exit costs.</p>'+sources.map(r=>'<a class="ms-source" href="'+esc(r.sourceUrl)+'" target="_blank" rel="noopener">'+esc(r.sourceLabel)+'</a>').join('')+'<a class="ms-source" href="/map/api/market-segments?emirate='+encodeURIComponent(emirate)+'&community='+encodeURIComponent(area)+'">Source records & dates</a>'+(emirate==='Abu Dhabi'?'<a class="ms-source" href="/map/abu-dhabi">ADREC project register & official activity history</a>':'')+'</details>';
 return html;
}
function msForecastCard(){return '<div class="ms-forecast-note"><h4>Forecast availability</h4><p>No released '+(msState.kind==='roi'?'rental-yield':'price')+' forecast for this selected source, area and property basket. '+(msActive()?'The available asking/yield snapshots are too sparse for a validated local forecast.':'A prediction is shown only when a matching saved research model passes the existing release checks.')+'</p><p>The map remains on '+esc(tlK.periodLabel(tlState.period))+'. History is preserved; growth, profit and catalyst premiums are not assumed.</p><a href="/map/predictions">Model evidence & readiness</a></div>';}
function msInfo(){
 if(!msState.installed)return;const panel=tlQ('#ms-inspect'),body=tlQ('#ms-info'),area=msState.area;panel.hidden=!msVisible()||!msState.open;document.documentElement.dataset.msInspect=panel.hidden?'0':'1';tlQ('#ms-details').setAttribute('aria-expanded',String(!panel.hidden));
 let html='<h3>'+esc(area||msState.emirate)+'</h3><p>'+esc(msHeading()+' · '+msLabel(msState.segment))+'</p>';
 if(msState.forecastNotice)html+=msForecastCard();
 if(tlState.loading)html+='<p>Loading matching records…</p>';
 else if(msActive())html+=msBenchmarkCard(area);
 else if(ppActive()){const s=ppSeries(area);html+=s?ppPointHtml(s,tlState.period)+ppTable(s):'<p>Select a source area with registered-sale evidence.</p>';if(msState.segment==='both')html+='<p>Combined apartment + villa sale median uses the pooled eligible transactions, not an average of two medians.</p>';html+='<a href="/map/predictions?q='+encodeURIComponent(area)+'">Historical evidence & projection methodology</a>';}
 if(body.msRenderKey!==html){body.msRenderKey=html;body.innerHTML=html;}
 const mix=tlQ('#ms-mix');mix.hidden=!(msActive()&&msState.kind==='roi'&&msState.segment==='both');
}
function msSync(){
 if(!msState.installed)return;const active=msActive(),visible=msVisible(),bar=tlQ('#ms-toolbar');bar.hidden=!visible;document.documentElement.dataset.msMarket=visible?'1':'0';
 if(ppActive()){msState.emirate='Dubai';msState.kind='price';msState.basis='sales';msState.segment=arState.segment==='custom'&&bhBasket()==='apartment+villa'?'both':arState.segment;}
 tlQ('#ms-emirate').value=msState.emirate;tlQ('#ms-basis').value=msState.basis;tlQ('#ms-basis').hidden=msState.kind==='roi'||msState.emirate!=='Dubai';tlQ('#ms-registration').hidden=!ppActive();tlQ('#ms-registration').value=bhState.registration;
 document.querySelectorAll('[data-ms-segment]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.msSegment===msState.segment)));
 tlQ('#tg-history').setAttribute('aria-pressed',String(visible&&msState.kind==='price'));tlQ('#ms-roi').setAttribute('aria-pressed',String(visible&&msState.kind==='roi'));
 const areas=msAreas(),select=tlQ('#ms-area'),selected=msCommunity();
 if(!areas.includes(msState.area)){msState.area=(selected?.emirate===msState.emirate&&areas.includes(selected.name))?selected.name:areas.includes('Yas Island')?'Yas Island':areas.includes('Palm Jumeirah')?'Palm Jumeirah':cxPreferredArea(areas);}
 const signature=areas.join('|');if(select.dataset.signature!==signature){select.dataset.signature=signature;select.innerHTML=areas.length?areas.map(a=>'<option>'+esc(a)+'</option>').join(''):'<option value="">Coverage pending</option>';}
 select.value=msState.area;select.disabled=tlState.loading||!areas.length;
 if(ppActive()&&msState.area){const s=ppSeries(msState.area);if(s)tlState.selectedArea=s.geographyId;}
 const period=tlK.periodLabel(tlState.period),source=active?'Bayut · asking / gross yield':'DLD-derived · registered-sale median';
 let status=msState.error||(tlState.loading?'Loading matching source records…':source+' · '+period+(active?' · '+msRows().filter(r=>r.period===tlState.period).length+' area/type records · '+new Set(tlState.frame.filter(r=>msK.finite(r.value)&&r.geometryIds.length).map(r=>r.name)).size+' matched map areas':' · '+bhState.registration+' registration'));
 if(active&&!msRows().length)status='Price / yield evidence has not been released for '+msState.emirate+'. Project coverage and other historical datasets are retained.';
 tlQ('#ms-status').textContent=status;
 const key=tlQ('#ms-legend');key.hidden=!active;key.innerHTML='<span>'+esc(msMetric()==='roi'?'Gross rental yield · not net ROI':'Asking price · AED/sqft')+'</span><div class="ms-ramp" style="background:linear-gradient(90deg,'+tlK.palette.map(c=>'rgb('+c.join(',')+')').join(',')+')"></div><div class="ms-key-ends"><b>'+esc(msFormat(tlState.domain[0],msMetric()))+'</b><b>'+esc(msFormat(tlState.domain[1],msMetric()))+'</b></div>'+(msState.segment==='both'?'<small>Apartments / villas shown in alternating bands</small>':'');
 for(const id of ['ms-history','ms-latest','ms-forecast'])tlQ('#'+id).disabled=tlState.loading;
 if(active){
  tlQ('#tl-title').textContent=msHeading()+' · '+msState.emirate+' · '+msLabel(msState.segment);tlQ('#tl-badge').textContent='PUBLISHED BENCHMARK';
  tlQ('#tl-note').textContent='Native report snapshots only; not monthly prices. Gross yield excludes costs and appreciation. '+(msState.segment==='both'?'Solid / diagonal bands compare apartments / villas; unreported type stays transparent.':'Unshaded areas have no exact matched observation, not zero.');
  tlQ('#dr-help').textContent='Drag through captured report periods. No dates or missing values have been filled. Forecast availability is separate.';
  tlQ('#tl-scope').disabled=true;tlQ('#tl-view').disabled=true;tlQ('#tl-baseline').disabled=true;tlQ('#tl-focus').hidden=true;
  tlQ('#tl-slider').setAttribute('aria-valuetext',period+' — published '+(msMetric()==='roi'?'gross rental yield':'asking prices'));
 }
 msInfo();
 window.__ESPACIOS_MARKET_SEGMENTS__={version:'20260928-market-segments-v3',active,emirate:msState.emirate,segment:msState.segment,kind:msState.kind,period:tlState.period,area:msState.area,sourceRows:msRows().length,periods:msK.periods(msRows()),interpolated:false,forecastAvailable:ppActive()&&ppState.targets.length>0,missingNotZero:true,mixedMap:'separate_type_bands',capitalWeight:msState.weight};
}
function msEvidence(){const box=tlQ('#tl-evidence');if(!box)return;box.innerHTML='<h3>'+esc(msHeading())+' · '+esc(msState.emirate)+'</h3><p>'+msRows().length+' retained area/type/report records. Select an area in the time dock for prices, rental yield and all captured dates.</p><button type="button" data-ms-details>Open area details</button><p>Both compares the two source baskets without averaging. The optional portfolio yield is a capital-weighted assumption, not an observed mixed yield.</p><a href="/map/api/market-segments">Source register & dated records</a>'+(msState.emirate==='Abu Dhabi'?' · <a href="/map/abu-dhabi">Official ADREC evidence</a>':'');}
function msInstall(){
 if(msState.installed||!ppState.installed)return false;msState.installed=true;if(!ppActive())bhState.registration='Ready';
 const roi=document.createElement('button');roi.id='ms-roi';roi.type='button';roi.textContent='ROI';roi.title='Gross rental yield, not net profit';tlQ('#tg-history').after(roi);
 const bar=document.createElement('div');bar.id='ms-toolbar';bar.hidden=true;bar.innerHTML='<div class="ms-options"><select id="ms-emirate" aria-label="Price and rental-yield emirate">'+['Dubai','Abu Dhabi','Sharjah','Ajman','Umm Al Quwain','Ras Al Khaimah','Fujairah'].map(e=>'<option>'+e+'</option>').join('')+'</select><div class="ms-segments" role="group" aria-label="Property type"><button type="button" data-ms-segment="apartment">Apartments</button><button type="button" data-ms-segment="villa">Villas</button><button type="button" data-ms-segment="both">Both</button></div><select id="ms-basis" aria-label="Price evidence basis"><option value="sales">Registered sales</option><option value="asking">Asking benchmarks</option></select><select id="ms-registration" aria-label="Registration basket"><option>Ready</option><option>Off-Plan</option><option>All</option></select></div><div class="ms-options"><div class="ms-periods" role="group" aria-label="Evidence time"><button id="ms-history" type="button">History</button><button id="ms-latest" type="button">Latest</button><button id="ms-forecast" type="button">Forecast</button></div><select id="ms-area" aria-label="Inspect price or yield area"></select><button id="ms-details" type="button" aria-controls="ms-inspect" aria-expanded="false">Details</button></div><small id="ms-status" role="status"></small>';tlQ('#tg-bar').after(bar);
 const panel=document.createElement('section');panel.id='ms-inspect';panel.hidden=true;panel.setAttribute('aria-label','Selected area prices, rental yield and forecast availability');panel.innerHTML='<button type="button" id="ms-close" aria-label="Close area price details">×</button><div id="ms-info" class="pp-card"></div><label id="ms-mix" hidden>Apartment share of purchase capital · %<input id="ms-weight" type="number" min="0" max="100" step="1" placeholder="Enter your assumption"><small>Villas use the remaining share. Does not change map colours.</small></label>';tlQ('#app').append(panel);
 const key=document.createElement('aside');key.id='ms-legend';key.hidden=true;key.setAttribute('aria-label','Published benchmark map colour scale');tlQ('#app').append(key);
 tlQ('#tg-history').onclick=()=>{msState.open=true;msOpen('price');};roi.onclick=()=>{msState.open=true;msOpen('roi');};
 tlQ('#ms-emirate').onchange=e=>{msState.emirate=e.target.value;msState.area='';msState.open=true;msOpen(msState.kind,true);};
 tlQ('#ms-basis').onchange=e=>{msState.basis=e.target.value;msOpen();};tlQ('#ms-registration').onchange=e=>{bhState.registration=e.target.value;msOpen();};
 bar.querySelectorAll('[data-ms-segment]').forEach(b=>b.onclick=()=>{msSetSegment(b.dataset.msSegment);msState.weight='';tlQ('#ms-weight').value='';msOpen();});
 for(const action of ['history','latest','forecast'])tlQ('#ms-'+action).onclick=()=>msPeriodAction(action);
 tlQ('#ms-area').onchange=e=>{msState.area=e.target.value;msState.open=true;msState.forecastNotice=false;msSync();const s=tlState.series.find(s=>s.geography===msState.area),f=s?.geometryIds?.map(id=>sgState.data?.features.find(f=>String(f.id)===String(id))).find(Boolean);if(f){const b=SG.bbox(f.geometry);if(b)map.fitBounds([[b[0],b[1]],[b[2],b[3]]],{padding:90,maxZoom:12,duration:500});}};
 tlQ('#ms-details').onclick=()=>{msState.open=!msState.open;msInfo();};tlQ('#ms-close').onclick=()=>{msState.open=false;msInfo();};tlQ('#ms-weight').oninput=e=>{msState.weight=e.target.value;msInfo();};
 document.addEventListener('click',e=>{const b=e.target.closest?.('[data-ms-period],[data-ms-details]');if(!b)return;if(b.hasAttribute('data-ms-details')){msState.open=true;msInfo();}else if(msActive()&&tlState.periods.includes(b.dataset.msPeriod)){msState.forecastNotice=false;tlStop();tlChooseDate(b.dataset.msPeriod);}});
 for(const [value,label]of [['history:market-asking','Community asking prices · dated benchmarks'],['history:market-yield','Community gross rental yield · dated benchmarks']]){const o=document.createElement('option');o.value=value;o.textContent=label;tlQ('#analysis-metric').append(o);}tlSyncMetricOptions();
 const oldSet=psrSetAnalysis;psrSetAnalysis=function(metric){msHide();msState.forecastNotice=false;if(!['history:market-asking','history:market-yield'].includes(metric)){++msState.token;const out=oldSet(metric);msSync();return out;}
  tlStop();tlState.mode='history';tlState.view='value';state.analysisMetric=metric;msState.kind=metric.endsWith('yield')?'roi':'price';tlQ('#analysis-metric').value=metric;tlQ('#tl-metric').value=metric;msLoadHistory();msSync();};
 const oldLoad=tlLoadHistory;tlLoadHistory=function(){if(msActive())return msLoadHistory();return oldLoad(...arguments);};
 const oldMode=tlMode;tlMode=function(mode){if(msActive()&&mode==='forecast')return msPeriodAction('forecast');if(msActive()&&mode==='delivery')return psrSetAnalysis('uae-project-coverage');return oldMode(...arguments);};
 const oldRender=tlRenderHistory;tlRenderHistory=function(){if(msActive())return msRender();return oldRender(...arguments);};
 const oldUpdate=tlUpdate;tlUpdate=function(){const out=oldUpdate(...arguments);msSync();return out;};
 const oldHide=tlHideOld;tlHideOld=function(){msHide();return oldHide(...arguments);};
 const oldLegend=tlLegend;tlLegend=function(){oldLegend(...arguments);msSync();};
 const oldPp=ppSync;ppSync=function(){oldPp(...arguments);msSync();};
 const oldEvidence=tlEvidence;tlEvidence=function(){if(msActive())return msEvidence();return oldEvidence(...arguments);};
 const oldExport=tlExport;tlExport=function(){if(!msActive())return oldExport();tgDownload('espacios-'+msState.emirate+'-'+msState.kind+'-'+tlState.period+'.json',{version:msState.data.version,classification:'published_asking_and_gross_yield_benchmarks',emirate:msState.emirate,segment:msState.segment,period:tlState.period,observations:msRows().filter(r=>r.period===tlState.period),retention:msState.data.retention,forecast:msState.data.forecast,mixedPolicy:msState.data.mixedPolicy});};
 const oldDetail=ppDetail;ppDetail=function(){const c=msCommunity();if(!c||c.emirate==='Dubai'&&!msActive())return oldDetail();const root=tlQ('#detail-body'),h=root?.querySelector('h2');if(!h||msK.norm(h.textContent)!==msK.norm(c.name))return;let box=root.querySelector('.pp-card');if(!box){box=document.createElement('section');box.className='detail-section pp-card';(root.querySelector('.detail-sub')||h).after(box);}const period=msActive()&&c.emirate===msState.emirate?tlState.period:msK.periods(msK.select(msState.data?.rows||[],c.emirate,msState.segment,c.name)).at(-1)||'2026H1';const html='<h3>Prices & rental yield</h3>'+msBenchmarkCard(c.name,c.emirate,msState.segment,period);if(box.ppRenderKey!==html){box.ppRenderKey=html;box.innerHTML=html;}if(!msState.data)msLoad().then(ppDetail).catch(()=>{});};
 const oldTooltip=sgTooltip;sgTooltip=function(e){if(!msActive())return oldTooltip(e);sgHideTooltip();const t=tlQ('#tl-tooltip');if(!t||!e.point||!map.getLayer('ms-fill')||map.isMoving()){if(t)t.hidden=true;return;}const hit=map.queryRenderedFeatures(e.point,{layers:['ms-fill']})[0];if(!hit){t.hidden=true;return;}const rows=msRows(hit.properties.name);t.innerHTML='<b>'+esc(hit.properties.name)+' · '+esc(tlK.periodLabel(tlState.period))+'</b>'+msK.types(msState.segment).map(type=>{const p=msK.point(rows,tlState.period,type);return '<p>'+esc(msLabel(type))+': '+esc(msFormat(p?.[msMetric()],msMetric()))+'</p>';}).join('')+'<small>Published benchmark · click for source history</small>';t.hidden=false;t.style.left=Math.max(8,Math.min(innerWidth-285,e.point.x+14))+'px';t.style.top=Math.max(8,Math.min(innerHeight-t.offsetHeight-8,e.point.y+14))+'px';};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){msState.open=false;msInfo();}});
 msLoad().then(()=>{ppDetail();msSync();}).catch(e=>{msState.error=e.message;msSync();});msSync();return true;
}
const msTimer=setInterval(()=>{if(msInstall())clearInterval(msTimer);},300);

/* Area identity is explicit and emirate-scoped. No fuzzy location joins. */
function RCCoverageCore(){
 const norm=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
 // The non-island aliases below already exist in the site's AR/SG identity
 // registry. Reuse only explicit Dubai identities, never parent/child guesses.
 const aliases={'palm jabal ali':'Palm Jebel Ali','palm jebel ali':'Palm Jebel Ali','world islands':'The World Islands','the world islands':'The World Islands','palm jumeirah island':'Palm Jumeirah','jvc':'Jumeirah Village Circle','jumeirah village circle (jvc)':'Jumeirah Village Circle','jvt':'Jumeirah Village Triangle','jumeirah village triangle (jvt)':'Jumeirah Village Triangle','dso':'Dubai Silicon Oasis','dubai silicon oasis (dso)':'Dubai Silicon Oasis'};
 const name=(emirate,s)=>emirate==='Dubai'&&aliases[norm(s)]||String(s||'').trim();
 const key=(emirate,s)=>norm(emirate)+'|'+norm(name(emirate,s));
 function areas(emirate,catalogue,source){const m=new Map();for(const c of [...catalogue,...source])if(c.emirate===emirate&&c.name)m.set(key(emirate,c.name),name(emirate,c.name));return [...m.values()].sort((a,b)=>a.localeCompare(b));}
 function scenario(input){
  const fields=['price','rent','vacancy','costs','buyFees','sellFees','years','incomeYear','exitPrice'],n={};
  for(const f of fields){if(input[f]===null||input[f]===undefined||String(input[f]).trim()===''||!Number.isFinite(Number(input[f])))throw Error('Enter every assumption, including explicit zero where applicable.');n[f]=Number(input[f]);}
  if(n.price<=0||n.exitPrice<0||n.rent<0||n.costs<0||n.buyFees<0||n.sellFees<0||n.vacancy<0||n.vacancy>100)throw Error('Use a positive acquisition price, non-negative amounts and vacancy from 0 to 100%.');
  if(!Number.isInteger(n.years)||n.years<1||n.years>30||!Number.isInteger(n.incomeYear)||n.incomeYear<1||n.incomeYear>n.years+1)throw Error('Use whole years: holding period 1–30; first income year 1 to holding period + 1.');
  const initial=n.price+n.buyFees,flows=[{year:0,rent:0,costs:initial,exit:0,net:-initial}];
  for(let y=1;y<=n.years;y++){const rent=y>=n.incomeYear?n.rent*(1-n.vacancy/100):0,exit=y===n.years?n.exitPrice-n.sellFees:0;flows.push({year:y,rent,costs:n.costs,exit,net:rent-n.costs+exit});}
  const profit=flows.reduce((a,f)=>a+f.net,0),returnOnInitialCost=100*profit/initial,stabilizedGrossYield=100*n.rent/n.price;
  if(![initial,profit,returnOnInitialCost,stabilizedGrossYield,...flows.map(f=>f.net)].every(Number.isFinite))throw Error('Amounts exceed the supported calculation range.');
  return {initial,profit,returnOnInitialCost,stabilizedGrossYield,flows,assumptions:n};
 }
 return {norm,name,key,areas,scenario};
}

const RC_REGISTER={"version":"20260927-investment-coverage-v1","reviewedOn":"2026-09-27","classification":"qualitative_development_context_not_return_forecast","policy":"All catalogue communities remain selectable. Missing price or rental evidence is not zero, low ROI, or an approved forecast. Explicit aliases only; no area, type, registration or date substitution. History, saved model targets and investor scenarios are separate.","records":[{"emirate":"Dubai","name":"Palm Jebel Ali","registeredSourceName":"Palm Jabal Ali","preferredRegistrationForInspection":"Off-Plan","context":"Nakheel announced a further Beach & Coral Collection villa release in August 2026. This is evidence of ongoing development, not proof of completed homes, realised rent or investor profit.","assessment":"Beachfront positioning and delivery of the wider destination are potential demand drivers. Any appreciation is a hypothesis: entry price, phase-specific delivery, future supply and resale liquidity still matter. Do not transfer Palm Jumeirah prices or yields to this community.","incomeCaution":"Model a phase-specific wait before rent begins. A catalogue handover date or Ready tag alone does not verify completion or an operating rental market.","sourceLabel":"Nakheel · Beach & Coral release · 20 August 2026","sourceUrl":"https://www.nakheel.com/en/media-centre/press-releases/news-detail/2026/08/20/four-studios--one-shoreline--inside-the-latest-release-from-palm-jebel-ali-s-beach---coral-collections","yieldStatus":"no_reviewed_local_benchmark","returnRating":null},{"emirate":"Dubai","name":"The World Islands","registeredSourceName":"World Islands","preferredRegistrationForInspection":"Off-Plan","context":"Nakheel describes a master development containing leisure and residential projects, including hotels and resorts. These are different investment products; one yield cannot represent the whole archipelago.","assessment":"Island and hospitality positioning may support demand, but individual completion, access, operating performance, service costs and resale liquidity must be assessed. No independently supported archipelago-wide return rating is assigned.","incomeCaution":"For hotel or managed products, verify the actual contract, operator charges, payout conditions and counterparty. A promoted or contracted return is not an observed apartment/villa rental yield. This calculator is a simple all-cash scenario, not a hotel underwriting model.","sourceLabel":"Nakheel · The World Islands master development · reviewed 27 September 2026","sourceUrl":"https://www.nakheel.com/en/developments/nakheel-collections/theworld","yieldStatus":"no_reviewed_local_benchmark","returnRating":null}],"scenarioMethod":{"classification":"user_assumptions_not_forecast","initialOutlay":"Full acquisition price plus acquisition costs at year zero; no payment-plan or borrowing benefit assumed.","income":"Constant user-entered annual rent after the first income year, reduced by user-entered vacancy. Annual costs apply in every holding year, including pre-income years.","exit":"User-entered resale price less user-entered disposal costs at the end of the holding period.","profit":"Sum of all annual cash flows including initial acquisition outlay and final disposal.","return":"Net holding-period profit divided by initial acquisition outlay, times 100. Not an annual return, IRR or market forecast.","limits":"All cash, nominal, before tax. No automatic rent growth, price growth, catalyst premium, financing or reinvestment. Users must include applicable fees, operating and holding costs. Actual phased payments, taxes and hotel revenue-sharing require a project-specific model. Does not alter heatmap values."}};
/* Coverage is not performance. Keep every catalogue area discoverable. */
const rcK=RCCoverageCore(),rcState={installed:false,forms:new Map(),scenarioArea:'',scenarioEmirate:'',scenarioSegment:'',lastResult:null};
const rcRecord=(emirate,name)=>RC_REGISTER.records.find(r=>rcK.key(r.emirate,r.name)===rcK.key(emirate,name));
const rcCatalogue=()=>arState.catalogue?.communities||state.communities||[];
const rcAreaKey=()=>rcK.key(msState.emirate,msState.area)+'|'+msState.segment;
const rcOldSelect=msK.select;msK.select=function(rows,emirate,segment,community){const selected=rcOldSelect(rows,emirate,segment);return community?selected.filter(r=>rcK.key(r.emirate,r.community)===rcK.key(emirate,community)):selected;};
// This key is only used by the Dubai price inspector; model joins retain their
// original exact source identifiers and basket constraints inside PPPriceCore.
ppK.key=name=>rcK.norm(rcK.name('Dubai',name));
msAreas=function(){const source=msActive()?msRows().map(r=>({emirate:r.emirate,name:r.community})):ppActive()?tlState.series.map(s=>({emirate:'Dubai',name:s.geography})):[];return rcK.areas(msState.emirate,rcCatalogue(),source);};
const rcOldSelected=ppSelected;ppSelected=function(){return ppActive()&&msState.area?ppSeries(msState.area):rcOldSelected();};
function rcContext(area=msState.area,emirate=msState.emirate){const r=rcRecord(emirate,area);return r?'<details class="rc-context"><summary>Development context & investment risks</summary><p>'+esc(r.context)+'</p><p><b>Research assessment, not a forecast:</b> '+esc(r.assessment)+'</p><p>'+esc(r.incomeCaution)+'</p><a href="'+esc(r.sourceUrl)+'" target="_blank" rel="noopener">'+esc(r.sourceLabel)+'</a><p>Reviewed '+esc(RC_REGISTER.reviewedOn)+'. No return percentage inferred from this source.</p></details>':'';}
const rcOldBenchmark=msBenchmarkCard;
msBenchmarkCard=function(area,emirate=msState.emirate,segment=msState.segment,period=tlState.period){
 const rows=msK.select(msState.data?.rows||[],emirate,segment,area);
 if(!msState.data||rows.length)return rcOldBenchmark(area,emirate,segment,period);
 return '<div class="rc-coverage"><span class="pp-kind">RENTAL EVIDENCE PENDING · NOT LOW ROI</span><p>No reviewed asking-price or rental-yield benchmark for '+esc(area+' · '+msLabel(segment))+' in this dataset. This is an evidence gap, not a zero return or a judgement of investment potential.</p><p>The community and its project records remain in the catalogue. Registered sales, where available, are separate from asking prices and rental yield.</p></div>';
};
function rcActions(area=msState.area,emirate=msState.emirate){return '<div class="rc-actions">'+(emirate==='Dubai'?'<button type="button" data-rc-sales="'+esc(area)+'" data-rc-emirate="'+esc(emirate)+'">Inspect '+(rcRecord(emirate,area)?.preferredRegistrationForInspection||bhState.registration)+' sale history</button>':'')+'<button type="button" data-rc-scenario="'+esc(area)+'" data-rc-emirate="'+esc(emirate)+'">Model investment return</button></div>';}
const rcOldInfo=msInfo;msInfo=function(){rcOldInfo();if(!msState.installed)return;const body=tlQ('#ms-info');if(!body||!msVisible())return;
 let box=body.querySelector('.rc-extra');if(!box){box=document.createElement('section');box.className='rc-extra';body.append(box);}
 const s=ppActive()?ppSeries(msState.area):null,r=rcRecord(msState.emirate,msState.area),eligible=s?.points.filter(p=>!p.projection&&ppK.finite(p.value)).length||0;
 const evidenceLink=body.querySelector('a[href^="/map/predictions?q="]');if(evidenceLink){const href='/map/predictions?q='+encodeURIComponent(s?.geography||r?.registeredSourceName||msState.area);if(evidenceLink.getAttribute('href')!==href)evidenceLink.setAttribute('href',href);}
 let html='<p class="rc-disclosure"><b>Rental yield ≠ total investment return.</b> Capital appreciation, rental income, delivery timing and costs are separate inputs. Missing evidence never means low ROI.</p>';
 if(ppActive()&&r)html+='<p>Registered source name: <b>'+esc(r.registeredSourceName)+'</b>. Exact spelling alias; other communities and property types are not substituted.</p>';
 if(ppActive()&&s&&!eligible)html+='<p>This source area has records, but none meet the existing 20-sale period publication threshold for this basket. Sparse observations are retained, not presented as a reliable median.</p>';
 html+=rcActions()+rcContext()+'<a class="ms-source" href="/map/api/investment-coverage">Coverage policy & scenario methodology</a>';
 if(box.rcKey!==html){box.rcKey=html;box.innerHTML=html;}
 const scenario=tlQ('#rc-scenario');if(scenario&&!scenario.hidden&&scenario.dataset.key!==rcAreaKey()){scenario.hidden=true;rcState.lastResult=null;}
};
const rcOldSync=msSync;msSync=function(){if(msState.area)msState.area=rcK.name(msState.emirate,msState.area);rcOldSync();if(!msState.installed)return;
 const select=tlQ('#ms-area');for(const o of select.options){if(!o.value)continue;const rows=msRows(o.value),has=msActive()?rows.some(r=>msK.finite(r[msMetric()])):!!ppSeries(o.value)?.points.some(p=>!p.projection&&ppK.finite(p.value));const label=ueAreaLabel(o.value,has);if(o.textContent!==label){const value=o.value;o.textContent=label;o.value=value;}}
 if(msActive()&&msState.area&&!msRows(msState.area).length){const el=tlQ('#ms-status'),note=' · '+msState.area+': rental evidence pending, not low ROI';if(!el.textContent.endsWith(note))el.textContent+=note;}
 if(window.__ESPACIOS_MARKET_SEGMENTS__)Object.assign(window.__ESPACIOS_MARKET_SEGMENTS__,{areaOptions:select.options.length,coveragePolicy:'all_catalogue_communities',investmentRating:null});
};
const rcOldRebuild=arRebuild;arRebuild=function(){const out=rcOldRebuild(...arguments);if(msState.installed)msSync();return out;};
function rcDecorateDetail(){if(!msState.installed)return;const c=msCommunity(),root=tlQ('#detail-body'),h=root?.querySelector('h2');if(!c||!h||rcK.norm(h.textContent)!==rcK.norm(c.name))return;const parent=root.querySelector('.pp-card');if(!parent)return;let box=parent.querySelector('.rc-detail');if(!box){box=document.createElement('div');box.className='rc-detail';parent.append(box);}const html=rcActions(c.name,c.emirate)+rcContext(c.name,c.emirate);if(box.rcKey!==html){box.rcKey=html;box.innerHTML=html;}}
function rcScenarioOpen(area,emirate){
 const changeRegion=msState.emirate!==emirate;msState.area=rcK.name(emirate,area);msState.emirate=emirate;msState.open=true;if(!msVisible()||changeRegion)msOpen('roi');else msSync();rcState.lastResult=null;
 const box=tlQ('#rc-scenario'),key=rcAreaKey();rcState.scenarioArea=msState.area;rcState.scenarioEmirate=emirate;rcState.scenarioSegment=msState.segment;
 const previous=rcState.forms.get(key)||{},fields=[['price','Acquisition price · AED'],['buyFees','Acquisition costs · AED'],['rent','Annual rent once operating · AED'],['vacancy','Annual vacancy · %'],['costs','Annual holding / operating costs · AED'],['years','Holding period · whole years'],['incomeYear','First rental income year · 1 = first year'],['exitPrice','Assumed resale price · AED'],['sellFees','Disposal costs · AED']];
 box.dataset.key=key;box.hidden=false;box.innerHTML='<h3>Investment scenario</h3><p>'+esc(msState.area+' · '+msLabel(msState.segment))+'</p><p>Your assumptions—not an observed return or forecast. '+(msState.segment==='both'?'Enter total apartment + villa portfolio amounts, not an average of percentages. ':'')+'Full purchase cost paid at year zero; no loan or payment-plan benefit assumed.</p><form id="rc-form"><div class="rc-fields">'+fields.map(([f,label])=>'<label>'+esc(label)+'<input name="'+f+'" type="number" step="'+(['years','incomeYear'].includes(f)?'1':'any')+'" min="'+(['years','incomeYear'].includes(f)?'1':'0')+'" '+(f==='vacancy'?'max="100"':f==='years'?'max="30"':'')+' value="'+esc(previous[f]??'')+'" required></label>').join('')+'</div><p>For no rent before resale, use holding period + 1 as the first income year. Annual costs apply even before rent begins. Include all relevant costs; enter an explicit zero where appropriate.</p><button type="submit">Calculate my scenario</button></form><div id="rc-result" role="status"></div><p>Nominal, all-cash and before tax. No automatic growth or catalyst uplift. Actual staged payments, financing, taxes or hotel revenue-sharing require a project-specific model. Scenario inputs stay in this tab and never colour the map.</p>';
 const form=tlQ('#rc-form');form.oninput=()=>{rcState.forms.set(key,Object.fromEntries(new FormData(form)));rcState.lastResult=null;tlQ('#rc-result').textContent='Inputs changed. Recalculate to update the result.';};
 form.onsubmit=e=>{e.preventDefault();const input=Object.fromEntries(new FormData(form));rcState.forms.set(key,input);const result=tlQ('#rc-result');try{const s=rcK.scenario(input);rcState.lastResult={area:rcState.scenarioArea,emirate:rcState.scenarioEmirate,segment:rcState.scenarioSegment,classification:'user_assumptions_not_forecast',method:RC_REGISTER.scenarioMethod,...s};result.innerHTML='<h4>Scenario only · not a forecast</h4><p><b>'+esc(arAed(s.profit))+'</b> net cash profit over '+s.assumptions.years+' years</p><p><b>'+s.returnOnInitialCost.toFixed(2)+'%</b> net holding-period return on initial acquisition cost—not annual ROI</p><p>'+s.stabilizedGrossYield.toFixed(2)+'% assumed stabilised gross rental yield, before vacancy and costs; not current rent.</p><details><summary>Annual cash flows & calculation</summary><p>Initial outlay '+esc(arAed(s.initial))+'. Profit = all cash flows below; return = profit ÷ initial outlay × 100.</p><div class="ms-table-scroll"><table><thead><tr><th>Year</th><th>Rent collected</th><th>Costs</th><th>Net disposal</th><th>Cash flow</th></tr></thead><tbody>'+s.flows.map(f=>'<tr>'+[f.year,arAed(f.rent),arAed(f.costs),arAed(f.exit),arAed(f.net)].map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div></details><button type="button" data-rc-export>Export assumptions & cash flows</button>';}catch(err){rcState.lastResult=null;result.textContent=err.message;}};
 box.scrollIntoView({block:'nearest'});form.querySelector('input').focus({preventScroll:true});
}
function rcInstall(){if(rcState.installed||!msState.installed)return false;rcState.installed=true;
 const oldDetail=ppDetail;ppDetail=function(){oldDetail();rcDecorateDetail();};
 const box=document.createElement('section');box.id='rc-scenario';box.hidden=true;tlQ('#ms-inspect').append(box);tlQ('#ms-roi').title='Rental benchmarks and assumption-based investment returns';
 tlQ('#ms-area').onchange=e=>{msState.area=e.target.value;msState.open=true;msState.forecastNotice=false;msSync();const s=ppActive()?ppSeries(msState.area):tlState.series.find(s=>rcK.key(s.emirate,s.geography)===rcK.key(msState.emirate,msState.area)),f=s?.geometryIds?.map(id=>sgState.data?.features.find(f=>String(f.id)===String(id))).find(Boolean);if(f){const b=SG.bbox(f.geometry);if(b)map.fitBounds([[b[0],b[1]],[b[2],b[3]]],{padding:90,maxZoom:12,duration:500});}else{const c=rcCatalogue().find(c=>rcK.key(c.emirate,c.name)===rcK.key(msState.emirate,msState.area)),p=c?.coordinates;if(p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng))map.easeTo({center:[p.lng,p.lat],zoom:11,pitch:0,duration:500});}tlQ('#ms-inspect').scrollTop=0;};
 document.addEventListener('click',e=>{const b=e.target.closest?.('[data-rc-sales],[data-rc-scenario],[data-rc-export]');if(!b)return;
  if(b.hasAttribute('data-rc-export')){if(rcState.lastResult)tgDownload('espacios-investment-scenario.json',rcState.lastResult);return;}
  const emirate=b.dataset.rcEmirate||msState.emirate,area=b.dataset.rcSales||b.dataset.rcScenario;
  if(b.hasAttribute('data-rc-sales')){msState.emirate=emirate;msState.area=rcK.name(emirate,area);msState.basis='sales';msState.open=true;bhState.registration=rcRecord(emirate,area)?.preferredRegistrationForInspection||bhState.registration;msOpen('price');}
  else rcScenarioOpen(area,emirate);
 });msSync();return true;
}
const rcTimer=setInterval(()=>{if(rcInstall())clearInterval(rcTimer);},300);
/* Additive evidence discovery. Different districts, baskets and dates never merge. */
const ueState={installed:false,data:null,promise:null,error:'',requestedFrequency:null,requestedBenchmark:null};
function UECore(){
 const aliases={'nad al shiba':'Nad Al Sheba','nad al shiba first':'Nad Al Sheba 1','nad al shiba second':'Nad Al Sheba 2','nad al shiba third':'Nad Al Sheba 3','nad al shiba fourth':'Nad Al Sheba 4','al yelayiss 1':'Al Yalayis 1','al yelayiss 2':'Al Yalayis 2','al yelayiss 5':'Al Yalayis 5','al safouh first':'Al Sufouh 1','al safouh second':'Al Sufouh 2','al saffa first':'Al Safa 1','al saffa second':'Al Safa 2','jabal ali':'Jebel Ali','jabal ali first':'Jebel Ali 1','jabal ali second':'Jebel Ali 2','jabal ali third':'Jebel Ali 3','al warsan first':'Warsan 1','al warsan second':'Warsan 2','al warsan third':'Warsan 3','warsan fourth':'Warsan 4','al goze first':'Al Quoz 1','al goze third':'Al Quoz 3','al goze fourth':'Al Quoz 4','al barsha first':'Al Barsha 1','al barsha second':'Al Barsha 2','al barsha third':'Al Barsha 3','al barshaa south first':'Al Barsha South 1','al barshaa south second':'Al Barsha South 2','al barshaa south third':'Al Barsha South 3','al barsha south fourth':'Al Barsha South 4','al barsha south fifth':'Al Barsha South 5'};
 const norm=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
 const name=(e,s)=>e==='Dubai'&&aliases[norm(s)]||s;
 const end=p=>{const y=+p.slice(0,4);return /^\d{4}FY$/.test(p)?Date.UTC(y,11,31):/^\d{4}H[12]$/.test(p)?Date.UTC(y,+p.at(-1)*6,0):/^\d{4}Q[1-4]$/.test(p)?Date.UTC(y,+p.at(-1)*3,0):Date.parse(p+'-01');};
 const periods=rows=>[...new Set(rows.map(r=>r.period))].sort((a,b)=>end(a)-end(b)||a.localeCompare(b));
 return {name,norm,end,periods};
}
const ueK=UECore(),ueOldName=rcK.name;
rcK.name=(e,s)=>ueK.name(e,ueOldName(e,s));
rcK.key=(e,s)=>ueK.norm(e)+'|'+ueK.norm(rcK.name(e,s));
rcK.areas=(e,catalogue,source)=>[...new Map([...catalogue,...source].filter(c=>c.emirate===e&&c.name).map(c=>[rcK.key(e,c.name),rcK.name(e,c.name)])).values()].sort((a,b)=>a.localeCompare(b));
msK.periods=ueK.periods;
const ueOldPeriod=tlK.periodLabel;tlK.periodLabel=p=>/^\d{4}FY$/.test(p)?'Full year '+p.slice(0,4):/^\d{4}H[12]$/.test(p)?'H'+p.at(-1)+' '+p.slice(0,4):ueOldPeriod(p);
// Only these reviewed exact district name variants acquire display boundaries.
// Warsan 3 is deliberately excluded: the captured FGIC Arabic label conflicts.
function ueGeometry(s){const joins={343:'fgic:20',344:'fgic:895'};return s.geometryIds?.length?s.geometryIds:joins[s.id]?[joins[s.id]]:[];}
async function ueLoad(){if(ueState.data)return ueState.data;if(ueState.promise)return ueState.promise;ueState.promise=fetch('/map/api/area-evidence?v=20260927-area-evidence-v1').then(r=>{if(!r.ok)throw Error('Area evidence unavailable');return r.json();}).then(d=>{if(d.version!=='20260927-area-evidence-v1'||d.rows?.length!==2652)throw Error('Area evidence snapshot needs review');ueState.byArea=new Map();for(const r of d.rows){const key=rcK.key('Dubai',r.name);if(!ueState.byArea.has(key))ueState.byArea.set(key,[]);ueState.byArea.get(key).push(r);}ueState.data=d;return d;}).catch(e=>{ueState.promise=null;ueState.error=e.message;throw e;});return ueState.promise;}
const ueFamilies={
 'nad al sheba':['Nad Al Shiba','Nad Al Shiba First','Nad Al Shiba Second','Nad Al Shiba Third','Nad Al Shiba Fourth'],
 'al yalayis':['Al Yelayiss 1','Al Yelayiss 2','Al Yelayiss 5'],
 'warsan':['Al Warsan First','Al Warsan Second','Al Warsan Third','Warsan Fourth'],
 'jebel ali':['Jabal Ali','Jabal Ali First','Jabal Ali Second','Jabal Ali Third','Jabal Ali Industrial First','Jabal Ali Industrial Second'],
 'al quoz':['Al Goze First','Al Goze Third','Al Goze Fourth','Al Goze Industrial First','Al Goze Industrial Second','Al Goze Industrial Third','Al Goze Industrial Fourth'],
 'al sufouh':['Al Safouh First','Al Safouh Second'],
 'al barsha':['Al Barsha First','Al Barsha Second','Al Barsha Third','Al Barshaa South First','Al Barshaa South Second','Al Barshaa South Third','Al Barsha South Fourth','Al Barsha South Fifth'],
 'al barsha south':['Al Barshaa South First','Al Barshaa South Second','Al Barshaa South Third','Al Barsha South Fourth','Al Barsha South Fifth'],
 'al safa':['Al Saffa First','Al Saffa Second']
};
const ueOldAreas=msAreas;msAreas=function(){const current=ueOldAreas(),extra=msState.emirate==='Dubai'?[...Object.keys(ueFamilies).map(s=>s.replace(/\b\w/g,c=>c.toUpperCase())),'Wadi Al Shabak',...(ueState.data?.areas||[]).map(a=>a.name)]:[];return rcK.areas(msState.emirate,[],[...current,...extra].map(name=>({name,emirate:msState.emirate})));};
function ueMatches(area){return ueState.byArea?.get(rcK.key('Dubai',area))||[];}
function ueBenchmarks(area){if(ueState.benchmarkData!==msState.data){ueState.benchmarkData=msState.data;ueState.benchmarks=new Map();for(const r of msState.data?.rows||[]){const key=rcK.key(r.emirate,r.community);if(!ueState.benchmarks.has(key))ueState.benchmarks.set(key,[]);ueState.benchmarks.get(key).push(r);}}return ueState.benchmarks?.get(rcK.key(msState.emirate,area))||[];}
function ueAreaLabel(area,has){if(has)return area;if(ppActive()&&ueBenchmarks(area).length)return area+' · published benchmark available';if(msState.emirate==='Dubai'&&ueMatches(area).length)return area+' · other baskets available';return area+' · evidence pending';}
function ueAvailableHtml(){
 const area=msState.area,region=msState.emirate,key=rcK.key(region,area),benchmark=(msState.data?.rows||[]).filter(r=>rcK.key(r.emirate,r.community)===key);
 let html='<h4>Available evidence</h4><p>Choose an actual source, date and property basket. These are not substitutes for the selected value.</p>';
 if(region==='Dubai'&&!ueState.data){html+='<p>'+esc(ueState.error||'Checking retained sale records…')+'</p>';if(ueState.error)html+='<button type="button" data-ue-retry>Retry evidence lookup</button>';}
 const rows=region==='Dubai'?ueMatches(area):[];
 const residential=rows.filter(r=>['apartment','villa'].includes(r.segment));
 for(const type of ['apartment','villa']){const typed=benchmark.filter(r=>r.segment===type),latest=typed.slice().sort((a,b)=>ueK.end(a.period)-ueK.end(b.period)).at(-1);if(latest)html+='<button class="ue-record" type="button" data-ue-benchmark="'+esc(latest.id)+'"><b>'+esc(msLabel(type))+' · published benchmark</b><span>'+esc(tlK.periodLabel(latest.period))+' · '+esc(msFormat(latest.askPsf,'askPsf'))+' · yield '+esc(msFormat(latest.roi,'roi'))+'</span><small>'+typed.length+' retained report periods · asking price / gross yield, not registered sales</small></button>';}
 if(residential.length){html+='<details class="ue-baskets" open><summary>Registered apartment / villa evidence</summary>';for(const r of residential){const id=[r.sourceAreaId,r.frequency,r.segment,r.registration].join('|');html+='<button class="ue-record" type="button" data-ue-record="'+esc(id)+'"><b>'+esc(msLabel(r.segment)+' · '+r.registration+' · '+r.frequency)+'</b><span>'+esc(r.name)+' · '+r.periods+' recorded periods · '+r.eligiblePeriods+' meet n ≥ 20</span><small>'+(r.latest?'Latest eligible: '+esc(tlK.periodLabel(r.latest.period))+' · AED '+ppNum(r.latest.medianPsf)+' / sqft · n='+r.latest.count:'Records retained; largest period n='+r.maxPeriodCount+'. No publishable median.')+'</small></button>';}html+='</details>';}
 const other=rows.filter(r=>!['apartment','villa','apartment+villa'].includes(r.segment)&&r.registration==='All'&&r.frequency==='quarterly');
 if(other.length)html+='<details><summary>Other asset classes · '+other.length+'</summary><p>Land uses registered plot area. Commercial and hotel records are not residential prices or returns.</p>'+other.map(r=>'<button class="ue-record" type="button" data-ue-record="'+esc([r.sourceAreaId,r.frequency,r.segment,r.registration].join('|'))+'"><b>'+esc(r.segment)+' · all registrations · quarterly</b><small>'+r.periods+' recorded periods; '+r.eligiblePeriods+' meet n ≥ 20'+(r.latest?'; latest '+esc(tlK.periodLabel(r.latest.period)):'')+'</small></button>').join('')+'</details>';
 const names=ueFamilies[ueK.norm(area)]||[];const relatives=(ueState.data?.areas||[]).filter(a=>names.includes(a.name)&&rcK.key('Dubai',a.name)!==key);
 if(relatives.length)html+='<details open><summary>Named source districts · not a combined price</summary><p>Inspect each district separately. Their prices are not assigned to the broader community.</p><div class="ue-districts">'+relatives.map(a=>'<button type="button" data-ue-area="'+esc(rcK.name('Dubai',a.name))+'">'+esc(rcK.name('Dubai',a.name))+'</button>').join('')+'</div></details>';
 if(!benchmark.length&&!rows.length&&(region!=='Dubai'||ueState.data))html+='<p>No reviewed local price series in the captured sources for this exact area. Its existing project records remain available. This is a source gap—not zero value or low investment potential.</p>';
 if(benchmark.length)html+='<p class="ue-note">Full-year and half-year reports cover different windows. They are retained separately; no price growth is inferred between them.</p>';
 return html;
}
const ueOldInfo=msInfo;msInfo=function(){ueOldInfo();const body=tlQ('#ms-info');if(!body||!msVisible()||!msState.open)return;let box=body.querySelector('.ue-evidence');if(!box){box=document.createElement('section');box.className='ue-evidence';body.append(box);}const html=ueAvailableHtml();if(box.ueKey!==html){box.ueKey=html;box.innerHTML=html;}
 if(msState.emirate==='Dubai'&&!ueState.data&&!ueState.promise&&!ueState.error)ueLoad().then(()=>msSync()).catch(()=>msInfo());
};
const ueOldSync=msSync;msSync=function(){ueOldSync();if(!ueState.installed)return;const frequency=tlQ('#ue-frequency');frequency.hidden=!ppActive();frequency.value=bhState.frequency;
 if(msActive()&&ueState.pinCount){const status=tlQ('#ms-status');status.textContent+=' · '+ueState.pinCount+' community reference pins (no matched boundary)';}
 if(window.__ESPACIOS_MARKET_SEGMENTS__)Object.assign(window.__ESPACIOS_MARKET_SEGMENTS__,{version:'20260928-market-segments-v3',registeredFrequency:bhState.frequency,areaEvidenceRows:ueState.data?.rows.length||0});
};
const ueOldHide=msHide;msHide=function(){ueOldHide();for(const id of ['ue-benchmark-point','ue-benchmark-label'])if(map.getLayer(id))map.setLayoutProperty(id,'visibility','none');};
const ueOldRender=msRender;msRender=function(){ueOldRender();if(!msActive()||tlState.loading)return;const grouped=new Map();
 for(const s of tlState.series){if(s.geometryIds.length)continue;const p=s.points.find(p=>p.period===tlState.period);if(!msK.finite(p?.value))continue;const matches=rcCatalogue().filter(c=>rcK.key(c.emirate,c.name)===rcK.key(s.emirate,s.geography));if(matches.length!==1)continue;const loc=matches[0].coordinates;if(!Number.isFinite(loc?.lat)||!Number.isFinite(loc?.lng))continue;const key=rcK.key(s.emirate,s.geography);if(!grouped.has(key))grouped.set(key,{name:s.geography,loc,values:[]});grouped.get(key).values.push({type:s.segment,value:p.value});}
 const features=[...grouped.values()].map(r=>({type:'Feature',geometry:{type:'Point',coordinates:[r.loc.lng,r.loc.lat]},properties:{name:r.name,label:r.name+'\n'+r.values.map(v=>(msState.segment==='both'?(v.type==='apartment'?'Apt ':'Villa '):'')+(msMetric()==='roi'?v.value.toFixed(2)+'%':ppNum(v.value)+' AED/sqft')).join(' · '),color:msState.segment==='both'?'#79bfb6':tlK.color(r.values[0].value,tlState.domain,false)}}));
 ueState.pinCount=features.length;sgSource('ue-benchmark-pins',{type:'FeatureCollection',features});
 if(!map.getLayer('ue-benchmark-point'))map.addLayer({id:'ue-benchmark-point',type:'circle',source:'ue-benchmark-pins',paint:{'circle-radius':4,'circle-color':['get','color'],'circle-stroke-width':1,'circle-stroke-color':'#f5f7f8'}});
 if(!map.getLayer('ue-benchmark-label'))map.addLayer({id:'ue-benchmark-label',type:'symbol',source:'ue-benchmark-pins',layout:{'text-field':['get','label'],'text-size':11,'text-anchor':'top','text-offset':[0,1]},paint:{'text-color':'#f4f8ff','text-halo-color':'#152337','text-halo-width':2}});
 for(const id of ['ue-benchmark-point','ue-benchmark-label'])map.setLayoutProperty(id,'visibility','visible');
 if(!ueState.pinBound){ueState.pinBound=true;const pick=e=>{if(!msActive())return;msState.area=e.features?.[0]?.properties.name||msState.area;msState.open=true;msSync();};map.on('click','ue-benchmark-point',pick);map.on('click','ue-benchmark-label',pick);}
 msSync();
};
const ueOldLatest=msPeriodAction;msPeriodAction=function(action){if(action==='latest'&&msActive()){const periods=msK.periods(msRows(msState.area));if(periods.length){tlStop();msState.forecastNotice=false;tlChooseDate(periods.at(-1));msSync();return;}}return ueOldLatest(action);};
function ueInstall(){if(ueState.installed||!rcState.installed)return false;ueState.installed=true;
 const previousLoad=tlLoadHistory;tlLoadHistory=async function(){const wanted=ueState.requestedBenchmark;ueState.requestedBenchmark=null;await previousLoad(...arguments);if(wanted&&msActive()&&msState.area===wanted.area&&msState.emirate===wanted.emirate&&tlState.periods.includes(wanted.period)){tlChooseDate(wanted.period);msSync();}};
 const frequency=document.createElement('select');frequency.id='ue-frequency';frequency.setAttribute('aria-label','Registered sales period');frequency.innerHTML='<option value="monthly">Monthly sales</option><option value="quarterly">Quarterly sales</option>';tlQ('#ms-registration').after(frequency);
 frequency.onchange=e=>{bhState.frequency=e.target.value;tlQ('#bh-frequency').value=bhState.frequency;ppState.wanted='latest';bhState.rasterCache.clear();tlLoadHistory();};
 document.addEventListener('click',async e=>{const b=e.target.closest?.('[data-ue-record],[data-ue-benchmark],[data-ue-area],[data-ue-retry]');if(!b)return;
  if(b.hasAttribute('data-ue-retry')){ueState.error='';ueLoad().then(()=>msSync()).catch(()=>msInfo());return;}
  if(b.dataset.ueArea){msState.area=b.dataset.ueArea;msState.open=true;msState.forecastNotice=false;msSync();return;}
  if(b.dataset.ueBenchmark){const r=msState.data.rows.find(r=>r.id===b.dataset.ueBenchmark);if(!r)return;msState.emirate=r.emirate;msState.area=rcK.name(r.emirate,r.community);msState.segment=r.segment;msState.basis='asking';msState.open=true;ueState.requestedBenchmark={area:msState.area,emirate:r.emirate,period:r.period};msOpen(msState.kind);return;}
  const r=ueState.data?.rows.find(r=>[r.sourceAreaId,r.frequency,r.segment,r.registration].join('|')===b.dataset.ueRecord);if(!r)return;
  msState.emirate='Dubai';msState.area=rcK.name('Dubai',r.name);msState.segment=r.segment;msState.basis='sales';msState.open=true;msState.forecastNotice=false;ueState.requestedFrequency=r.frequency;
  ppOpen(r.latest?.period||'latest',r.segment+'|'+r.registration);
 });msSync();return true;
}
const ueTimer=setInterval(()=>{if(ueInstall())clearInterval(ueTimer);},300);
/* Catalogue visibility is independent of scheduled completion and price evidence. */
function CXCore(){
 function coverage(features,year,mode='catalogue'){
  if(mode==='catalogue')return features.slice();
  return features.filter(f=>{const v=f.properties?.handoverYear;return v!==null&&v!==undefined&&v!==''&&Number.isInteger(Number(v))&&(mode==='annual'?Number(v)===Number(year):Number(v)<=Number(year));});
 }
 return {coverage,version:'20260929-collapse-repair-v3'};
}
const cxK=CXCore();
function cxPreferredArea(areas){
 // On an emirate/type change, open an actual observation for the chosen metric.
 // This does not substitute another locality when the user chooses an area.
 const rows=msRows(),latest=msK.periods(rows).at(-1),field=msMetric();
 return areas.find(a=>rows.some(r=>r.community===a&&r.period===latest&&msK.finite(r[field])))||areas.find(a=>rows.some(r=>r.community===a&&msK.finite(r[field])))||areas[0]||'';
}
tgK.coverage=cxK.coverage;
tgState.coverage='catalogue';
const cxCatalogue=()=>aeUaeCoverageActive()&&tgState.coverage==='catalogue';
let cxWasCatalogue=false;
function cxSync(){
 if(!tgState.installed)return;
 const all=cxCatalogue(),dock=tlQ('#tl-dock');document.documentElement.dataset.cxCatalogue=all?'1':'0';
 if(all||cxWasCatalogue){
  for(const id of ['tl-slider','tl-date','tl-play','tg-play']){const el=tlQ('#'+id);if(el)el.disabled=all||tlState.periods.length<2||tlState.loading||(id==='tg-play'&&tgActive()&&(!tgState.config||!!tgState.error));}
  for(const [id,end]of [['tl-prev',0],['tl-next',tlState.periods.length-1]]){const el=tlQ('#'+id);if(el)el.disabled=all||tlState.periods.indexOf(tlState.period)===end;}
 }
 cxWasCatalogue=all;
 const strip=tlQ('#cx-catalogue-strip');if(strip)strip.hidden=!all;
 if(!all){window.__ESPACIOS_CATALOGUE_VIEW__={version:cxK.version,mode:aeUaeCoverageActive()?tgState.coverage:'other_metric'};return;}
 const c=aeUaeState.manifest?.counts||{},mapped=aeUaeState.selectedCount,unmapped=Number(c.unmappedProjects||0);
 aeUaeSetText('#tl-title','All mapped projects');aeUaeSetText('#tl-badge','CATALOGUE · ALL DATES');
 aeUaeSetText('#tl-note',mapped.toLocaleString()+' mapped records, including future and undated projects. '+unmapped.toLocaleString()+' retained records await coordinates. Colour is project density, not price growth.');
 aeUaeSetText('#ae-density-count',mapped.toLocaleString()+' mapped · all dates');
 aeUaeSetText('#cx-catalogue-label','Future and undated projects included');
 dock.setAttribute('aria-description','All mapped catalogue records, regardless of handover date. '+unmapped+' additional records are retained without coordinates. Choose handover dates for a timeline; price history and forecasts are separate.');
 const context=tlQ('#tg-context');if(context)context.hidden=true;
 const box=tlQ('#tl-evidence');if(box){aeUaeSetText('#tl-evidence h3','All mapped project records');aeUaeSetText('#tl-evidence .ae-coverage-footnote','Future, historical, archived and undated catalogue records are included. Some records share approximate community coordinates; these are not unique completed buildings or valuations. '+unmapped+' records without coordinates remain in search and the data catalogue.');}
 window.__ESPACIOS_CATALOGUE_VIEW__={version:cxK.version,mode:'all_dates',mapped,unmapped,priceEvidenceUnaffected:true};
}
const cxOldSync=tgSync;tgSync=function(){cxOldSync();cxSync();};
const cxOldDensity=aeUaeDensityKey;aeUaeDensityKey=function(){cxOldDensity();if(cxCatalogue())aeUaeSetText('#ae-density-count',aeUaeState.selectedCount.toLocaleString()+' mapped · all dates');};
const cxOldLegend=aeUaeCoverageLegend;aeUaeCoverageLegend=function(){cxOldLegend();cxSync();};
const cxTimer=setInterval(()=>{
 if(!tgState.installed)return;
 const strip=document.createElement('div');strip.id='cx-catalogue-strip';strip.innerHTML='<span id="cx-catalogue-label">Future and undated projects included</span><button type="button" id="cx-handover">Explore handover dates</button>';
 tlQ('#tl-dock .dr-player').after(strip);
 tlQ('#cx-handover').onclick=()=>{const select=tlQ('#tg-coverage-select');select.value='cumulative';select.dispatchEvent(new Event('change',{bubbles:true}));};
 tlQ('#tg-coverage-select').value=tgState.coverage;
 cxSync();clearInterval(cxTimer);
},250);
/* Presentation only: preserve all evidence, periods and data-selection logic. */
function SUCore(){
 const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
 return {clamp,index:(fraction,count)=>Math.round(clamp(fraction)*Math.max(0,count-1))};
}
const suCore=SUCore(),suState={installed:false,pointer:null,fraction:0,frame:0};
function suSync(){
 if(!suState.installed)return;
 const catalogue=document.documentElement.dataset.cxCatalogue==='1';
 const date=tlQ('#su-date');if(date)date.hidden=catalogue;
 const handle=tlQ('#dr-handle');if(handle){handle.removeAttribute('aria-hidden');handle.title='Selected period shown on the map';}
 const label=tlQ('#su-date-label');if(label){const year=Number(tlState.period),now=new Date().getFullYear(),badge=tlQ('#tl-badge')?.textContent||'';label.textContent=aeUaeCoverageActive()&&/^\d{4}$/.test(tlState.period)?year>now?'Reported outlook':year<now?'History':'Selected year':badge.includes('PROJECTION')?'Model projection':badge.includes('ASSUMPTIONS')?'Scenario':badge.includes('BENCHMARK')?'Published period':'Selected period';}
 const slider=tlQ('#tl-slider');if(slider){slider.setAttribute('aria-label','Selected period');slider.setAttribute('aria-describedby','su-date-label dr-help');}
 const min=tlQ('#tl-minimize');if(min)min.textContent=tlQ('#tl-dock').classList.contains('is-minimized')?'Expand':'Collapse';
 const density=tlQ('#ae-density-key'),count=tlQ('#ae-density-count');
 if(density&&count)density.querySelector('summary').setAttribute('aria-label','Project density · '+count.textContent+' · details');
 const strip=tlQ('#cx-catalogue-strip');if(strip){const button=strip.querySelector('button');if(button)button.textContent='Explore timeline';}
 if(suState.pointer===null&&slider){const i=Math.max(0,tlState.periods.indexOf(tlState.period));tlQ('#dr-track')?.style.setProperty('--su-position',100*i/Math.max(1,tlState.periods.length-1)+'%');}
 const filters=tlQ('#su-market-filters'),market=tlQ('#ms-toolbar');if(filters&&market){filters.hidden=market.hidden;const selected=market.querySelector('[data-ms-segment][aria-pressed=true]');filters.querySelector('summary').textContent=[tlQ('#ms-emirate')?.value,selected?.textContent,tlQ('#ms-basis')?.selectedOptions[0]?.textContent].filter(Boolean).join(' · ')+' · Filters';}
}
function suInstall(){
 const dock=tlQ('#tl-dock'),head=dock?.querySelector('.tl-head'),bar=tlQ('#tg-bar'),more=tlQ('#tl-more'),track=tlQ('#dr-track'),slider=tlQ('#tl-slider');
 if(!dock||!head||!bar||!more||!track||!slider||!tlQ('#cx-catalogue-strip'))return false;
 suState.installed=true;document.documentElement.dataset.suUi='1';
 // Date belongs in a stable, labelled position, not an unreadable floating bubble.
 const date=document.createElement('div');date.id='su-date';date.innerHTML='<span id="su-date-label">Selected period</span>';date.append(tlQ('#dr-handle'));head.prepend(date);
 const research=document.createElement('details');research.id='su-research';research.innerHTML='<summary>Research <span aria-hidden="true">↗</span></summary><div id="su-research-panel"><div class="su-popover-title">Behind the map</div><nav aria-label="Map research"></nav><div class="su-research-context"></div></div>';
 const nav=research.querySelector('nav'),pred=bar.querySelector('a'),register=more.querySelector('a[href="/map/history"]');
 if(pred){pred.textContent='Prediction research';nav.append(pred);}
 if(register){register.textContent='Data & sources';nav.append(register);}
 const context=tlQ('#tg-context'),note=tlQ('#tl-note');if(context)research.querySelector('.su-research-context').append(context);if(note)research.querySelector('.su-research-context').append(note);
 head.append(research);
 // Settings are still complete, but no longer expand behind the map header.
 const dialog=document.createElement('dialog');dialog.id='su-settings';dialog.setAttribute('aria-labelledby','su-settings-title');dialog.innerHTML='<div class="su-dialog-head"><div><span>MAP CONTROLS</span><h2 id="su-settings-title">Timeline settings</h2></div><button type="button" id="su-settings-close" aria-label="Close timeline settings">✕</button></div>';
 const views=tlQ('#ae-map-view');if(views)more.prepend(views);
 const basis=tlQ('.bh-basis-label');if(basis)more.append(basis);
 dialog.append(more);document.body.append(dialog);
 const settings=tlQ('#tl-settings');settings.textContent='Settings';settings.setAttribute('aria-controls','su-settings');settings.setAttribute('aria-haspopup','dialog');
 const close=()=>{dialog.close();more.hidden=true;settings.setAttribute('aria-expanded','false');settings.focus({preventScroll:true});};
 settings.onclick=()=>{research.open=false;more.hidden=false;dialog.showModal();settings.setAttribute('aria-expanded','true');};
 tlQ('#su-settings-close').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('click',e=>{if(e.target===dialog){const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)close();}});
 document.addEventListener('pointerdown',e=>{if(research.open&&!research.contains(e.target))research.open=false;});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&research.open){research.open=false;research.querySelector('summary').focus();}});
 // Keep the legend at the bottom-right, independent of timeline height.
 const density=tlQ('#ae-density-key');if(density){tlQ('#app').append(density);const summary=density.querySelector('summary'),count=tlQ('#ae-density-count'),explain=density.querySelector('.ae-density-explanation');if(count&&explain)explain.prepend(count);const label=summary.querySelectorAll('span')[1];if(label)label.textContent='Density';}
 const market=tlQ('#ms-toolbar');if(market){const filters=document.createElement('details');filters.id='su-market-filters';filters.innerHTML='<summary>Property & evidence filters</summary>';market.before(filters);filters.append(market);filters.addEventListener('toggle',()=>requestAnimationFrame(tlResize));}
 // Use continuous pointer feedback; data still selects only real source periods.
 const thumb=document.createElement('span');thumb.id='su-drag-thumb';thumb.setAttribute('aria-hidden','true');track.append(thumb);
 const position=e=>{const b=slider.getBoundingClientRect();return suCore.clamp((e.clientX-b.left-10)/Math.max(1,b.width-20));};
 const apply=()=>{suState.frame=0;track.style.setProperty('--su-position',(10+Math.max(1,slider.clientWidth-20)*suState.fraction)+'px');const p=tlState.periods[suCore.index(suState.fraction,tlState.periods.length)];if(p&&p!==tlState.period)tlChooseDate(p);};
 const move=e=>{suState.fraction=position(e);if(!suState.frame)suState.frame=requestAnimationFrame(apply);};
 slider.addEventListener('pointerdown',e=>{if(slider.disabled||e.button>0||suState.pointer!==null)return;e.preventDefault();e.stopImmediatePropagation();tlStop();slider.focus({preventScroll:true});suState.pointer=e.pointerId;slider.setPointerCapture(e.pointerId);track.classList.add('su-scrubbing');move(e);},true);
 slider.addEventListener('pointermove',e=>{if(e.pointerId!==suState.pointer)return;e.preventDefault();e.stopImmediatePropagation();move(e);},true);
 const finish=(e,cancelled=false)=>{if(e.pointerId!==suState.pointer)return;e.preventDefault();e.stopImmediatePropagation();if(!cancelled)suState.fraction=position(e);cancelAnimationFrame(suState.frame);apply();suState.pointer=null;track.classList.remove('su-scrubbing');clearTimeout(tlState.renderTimer);tlUpdate();suSync();};
 slider.addEventListener('pointerup',e=>finish(e),true);slider.addEventListener('pointercancel',e=>finish(e,true),true);
 const oldSync=drSync;drSync=function(){const r=oldSync.apply(this,arguments);suSync();return r;};
 const oldCX=cxSync;cxSync=function(){const r=oldCX.apply(this,arguments);suSync();return r;};
 const oldMarket=msSync;msSync=function(){const r=oldMarket.apply(this,arguments);suSync();return r;};
 const oldMin=aeUaeSetMinimized;aeUaeSetMinimized=function(){const r=oldMin.apply(this,arguments);suSync();return r;};
 suSync();requestAnimationFrame(tlResize);return true;
}
const suTimer=setInterval(()=>{if(suInstall())clearInterval(suTimer);},120);
