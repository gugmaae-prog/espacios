const RGE_API='/map/api/uae-evidence/commercial/listings';
const RGE_AREAS_API='/map/api/uae-evidence/commercial/areas';
// Reviewed OpenStreetMap area references. These are never listing or building coordinates.
export const RGE_AREA_CENTRES=[
 ['umm-al-quwain','Umm Al Quwain emirate',55.7182920,25.5144944,'relation/3766487',['Emirate of Umm Al Quwain','Umm Al Quwain']],
 ['sharjah','Sharjah city',55.4210633,25.3461498,'relation/12905785',['Sharjah']],
 ['al-quoz','Al Quoz',55.2540203,25.1595803,'node/8143204838',['Al Quoz','Al quoz']],
 ['dip','Dubai Investments Park',55.1911925,24.9779669,'node/8143204859',['DIP Dubai Investment Park','DIP','Dubai Investment Park']],
 ['jebel-ali-industrial','Jebel Ali Industrial Area',55.1215037,24.9985748,'way/874795299',['Jebel Ali Industrial Area','Jebel AL Industrial Area']],
 ['ras-al-khor','Ras Al Khor',55.3392449,25.1939625,'node/8143204820',['Ras Al Khor']],
 ['dubai-industrial-city','Dubai Industrial City',55.0662934,24.8399006,'node/4916824174',['Dubai Industrial City']],
 ['jafza','Jebel Ali Free Zone',55.0820098,24.9864730,'relation/18471647',['JAFZA Jebel Ali Free Zone','Jebel Ali Free Zone (Jafza)']],
 ['al-qusais','Al Qusais',55.3859389,25.2701436,'relation/18471660',['Al Qusais']],
 ['muhaisnah','Muhaisnah',55.4181049,25.2445037,'relation/18471781',['Muhaisnah','Al Muhaisnah']],
 ['al-khawaneej','Al Khawaneej',55.4890201,25.2407108,'way/874795353',['Al Khawaneej']],
 ['umm-ramool','Umm Ramool',55.3685667,25.2311645,'relation/18471720',['Umm Ramool']],
 ['al-warsan','Al Warsan',55.4082859,25.1539236,'relation/18471741',['Al Warsan','Al warsan international city']],
 ['ajman','Ajman city',55.4451432,25.3936557,'node/262479959',['Ajman']],
 ['deira','Deira',55.3053340,25.2727936,'node/7826901099',['Deira']],
 ['abu-dhabi','Abu Dhabi city',54.3774014,24.4538352,'relation/4479763',['Abu Dhabi']],
 ['business-bay','Business Bay',55.2683707,25.1794564,'relation/18471755',['Business Bay','Business bay']],
 ['jvc','Jumeirah Village Circle',55.2079869,25.0565882,'node/11800596709',['Jumeirah Village Circle (JVC)','JVC']],
 ['bur-dubai','Bur Dubai',55.2963265,25.2623727,'way/1154380547',['Bur Dubai','Bur Dubai , Dubai']],
 ['techno-park','Techno Park',55.0604857,24.8966830,'way/354260411',['Technopark','Technology Park','Techno park','Techno Park']],
 ['ras-al-khaimah','Ras Al Khaimah city',55.9382320,25.7737705,'node/262479317',['Ras Al Khaimah']],
 ['al-jaddaf','Al Jaddaf',55.3245395,25.2142622,'relation/18471794',['Al Jaddaf','Al Jadaf']],
 ['dubai-silicon-oasis','Dubai Silicon Oasis',55.3855055,25.1217058,'way/364819827',['Dubai Silicon Oasis']],
 ['nad-al-hamar','Nad Al Hamar',55.3857707,25.1988837,'relation/18471802',['Nad Al Hamar','Nadd Al hamar']],
 ['al-garhoud','Al Garhoud',55.3519978,25.2406551,'relation/18471788',['Al Garhoud','Garhoud']],
 ['barsha-heights','Barsha Heights',55.1757823,25.0982842,'node/3087418334',['Barsha Heights (Tecom)']],
 ['dubai-production-city','Dubai Production City',55.1912732,25.0321285,'relation/18471777',['Dubai Production City','IMPZ']],
 ['fujairah','Fujairah city',56.3355085,25.1244604,'way/872858707',['Fujairah']],
 ['dubai-islands','Dubai Islands',55.3263177,25.3179174,'relation/8122161',['Dubai Islands']],
 ['jebel-ali-village','Jebel Ali Village',55.1126987,25.0301768,'way/1018273191',['Jebel Ali Village']],
];
// Emirate of each reviewed OSM area reference, distinct from the publisher's label.
export const RGE_AREA_EMIRATES={
 'umm-al-quwain':'Umm Al Quwain',sharjah:'Sharjah',
 'al-quoz':'Dubai',dip:'Dubai','jebel-ali-industrial':'Dubai','ras-al-khor':'Dubai',
 'dubai-industrial-city':'Dubai',jafza:'Dubai','al-qusais':'Dubai',muhaisnah:'Dubai',
 'al-khawaneej':'Dubai','umm-ramool':'Dubai','al-warsan':'Dubai',ajman:'Ajman',
 deira:'Dubai','abu-dhabi':'Abu Dhabi','business-bay':'Dubai',jvc:'Dubai',
 'bur-dubai':'Dubai','techno-park':'Dubai','ras-al-khaimah':'Ras Al Khaimah',
 'al-jaddaf':'Dubai','dubai-silicon-oasis':'Dubai','nad-al-hamar':'Dubai',
 'al-garhoud':'Dubai','barsha-heights':'Dubai','dubai-production-city':'Dubai',
 fujairah:'Fujairah','dubai-islands':'Dubai','jebel-ali-village':'Dubai'
};
if(RGE_AREA_CENTRES.length!==30||RGE_AREA_CENTRES.some(area=>!RGE_AREA_EMIRATES[area[0]])||Object.keys(RGE_AREA_EMIRATES).length!==30)throw Error('Reviewed RGEstate area-to-emirate references changed');
const RGE_AREA_BY_LABEL=new Map(RGE_AREA_CENTRES.flatMap(area=>area[5].map(label=>[label.toLocaleLowerCase('en'),area])));
const RGE_AREA_BY_KEY=new Map(RGE_AREA_CENTRES.map(area=>[area[0],area]));
const rgeAreaFor=row=>RGE_AREA_BY_LABEL.get(String(row.locationLabel||'').toLocaleLowerCase('en'));
export const rgeAreaLocationFor=row=>{const area=rgeAreaFor(row);return area?{key:area[0],name:area[1],emirate:RGE_AREA_EMIRATES[area[0]],osmUrl:'https://www.openstreetmap.org/'+area[4]}:null};
let RGE_ROWS;
let RGE_CACHE_SHA;
const rgeDigest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
const rgeReply=(request,body,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public,max-age=60,s-maxage=300':'no-store','x-content-type-options':'nosniff','x-espacios-evidence-source':'rgestate-commercial-category-20261103',...(status===405?{allow:'GET, HEAD'}:{})}});

async function rgeVerifiedRows(report,packed){
 if(RGE_CACHE_SHA!==report.rawSha256){RGE_ROWS=undefined;RGE_CACHE_SHA=report.rawSha256;}
 if(!RGE_ROWS)RGE_ROWS=(async()=>{
  const compressed=Uint8Array.from(atob(packed),c=>c.charCodeAt(0));
  if(compressed.length!==report.compressedBytes||await rgeDigest(compressed)!==report.compressedSha256)throw Error('RGEstate packed snapshot mismatch');
  const raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if(raw.byteLength!==report.rawBytes||await rgeDigest(raw)!==report.rawSha256)throw Error('RGEstate decoded snapshot mismatch');
  const rows=JSON.parse(new TextDecoder().decode(raw));
  if(!Array.isArray(rows)||rows.length!==report.rows||new Set(rows.map(row=>row.sourceListingId)).size!==report.rows||rows.filter(row=>row.purpose==='rent').length!==report.rentRows||rows.filter(row=>row.purpose==='sale').length!==report.saleRows)throw Error('RGEstate population mismatch');
  for(const row of rows)if(!['rent','sale'].includes(row.purpose)||!row.sourceUrl.startsWith('https://www.rgestate.com/'+row.purpose+'/')||row.coordinates!==null||row.canonicalProjectId!==null||row.availabilityStatus!=='publisher_listed_unverified')throw Error('RGEstate row invariant failed');
  return rows;
 })().catch(error=>{RGE_ROWS=undefined;throw error});
 return RGE_ROWS;
}

export async function mapRgestateCommercial(request,report,packed){
 const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'');
 if(path!==RGE_API&&path!==RGE_AREAS_API)return null;
 if(!['GET','HEAD'].includes(request.method))return rgeReply(request,{error:'Read-only endpoint'},405);
 if(!report?.rawSha256||typeof packed!=='string')return rgeReply(request,{error:'Verified commercial source is not configured.'},503);
 const p=url.searchParams,purpose=p.get('purpose')||'all',q=(p.get('q')||'').trim(),area=p.get('area')||null,limit=p.has('limit')?Number(p.get('limit')):24,offset=p.has('offset')?Number(p.get('offset')):0;
 if(!['all','rent','sale'].includes(purpose)||q.length>120||(area&&!RGE_AREA_BY_KEY.has(area))||!Number.isSafeInteger(limit)||limit<1||limit>100||!Number.isSafeInteger(offset)||offset<0||offset>report.rows)return rgeReply(request,{error:'Invalid purpose, q, area, limit, or offset.'},400);
 try{
  const rows=await rgeVerifiedRows(report,packed),needle=q.toLocaleLowerCase('en');
  const matches=rows.filter(row=>(purpose==='all'||row.purpose===purpose)&&(!needle||[row.title,row.locationLabel,row.sourceListingId].some(value=>String(value||'').toLocaleLowerCase('en').includes(needle))));
  if(path===RGE_AREAS_API){
   const grouped=new Map();let unmappedRows=0;
   for(const row of matches){const place=rgeAreaFor(row);if(!place){unmappedRows++;continue}const key=place[0];if(!grouped.has(key))grouped.set(key,{key,name:place[1],center:[place[2],place[3]],locationBasis:'osm_area_reference_not_unit_coordinate',osmUrl:'https://www.openstreetmap.org/'+place[4],count:0,rentRows:0,saleRows:0});const group=grouped.get(key);group.count++;group[row.purpose==='rent'?'rentRows':'saleRows']++;}
   const areas=[...grouped.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
   return rgeReply(request,{source:{id:report.sourceId,observedAt:report.observedAt,evidenceClass:report.evidenceClass,rawSha256:report.rawSha256},scope:{totalSnapshotRows:report.rows,availability:'publisher_listed_at_capture_unverified_now',mapGranularity:'publisher_area_label',unitCoordinatesPresent:false,areaReference:'OpenStreetMap',areaAttribution:'© OpenStreetMap contributors',mapLimits:'Circles represent publisher location labels at reviewed OSM area references; they are not property, building, or available-unit pins. Unmatched listings remain in the list.'},filters:{purpose,q:q||null},totalRows:matches.length,mappedRows:matches.length-unmappedRows,unmappedRows,areas});
  }
  const listed=area?matches.filter(row=>rgeAreaFor(row)?.[0]===area):matches;
  return rgeReply(request,{source:{id:report.sourceId,publisher:report.publisher,categoryUrls:report.categoryUrls,observedAt:report.observedAt,evidenceClass:report.evidenceClass,rawSha256:report.rawSha256,verification:report.verification,storage:'checksum_verified_immutable_worker_snapshot'},scope:{totalSnapshotRows:report.rows,rentRows:report.rentRows,saleRows:report.saleRows,availability:'publisher_listed_at_capture_unverified_now',limits:report.limits,photosIncluded:false,coordinatesPresent:false,registeredTransactionEvidence:false},filters:{purpose,q:q||null,area},totalRows:listed.length,limit,offset,rows:listed.slice(offset,offset+limit)});
 }catch{return rgeReply(request,{error:'The verified commercial listing snapshot is temporarily unavailable.'},503);}
}

const RGE_PAGE=`<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>Commercial spaces · Espacios Map</title><link rel="stylesheet" href="/map/vendor/maplibre-gl.css?v=6.8.0"><script>(function(){try{document.documentElement.dataset.theme=localStorage.getItem('espacios_theme_v1')==='dark'?'dark':'light'}catch{}})();</script><style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#eef3f7;color:#1c3044;--bg:#eef3f7;--card:#fff;--ink:#1c3044;--muted:#5c7186;--line:#d7e2eb;--accent:#456e87;--soft:#e5eff5;--focus:#3d7797;--art:#dbe8ef;color-scheme:light}html[data-theme=dark]{--bg:#142231;--card:#1d3041;--ink:#eaf2f7;--muted:#b0c2cf;--line:#395166;--accent:#9ac3d8;--soft:#294255;--focus:#abd6ef;--art:#304c60;color-scheme:dark}*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0;background:var(--bg);color:var(--ink)}a{color:inherit}button,input{font:inherit}button{cursor:pointer}a:focus-visible,button:focus-visible,input:focus-visible{outline:3px solid var(--focus);outline-offset:3px}.skip{position:absolute;left:-9999px;top:1rem}.skip:focus{left:1rem;z-index:10;background:var(--card);padding:.7rem}header{border-bottom:1px solid var(--line);background:var(--card)}.top{max-width:1480px;margin:auto;padding:1rem clamp(1rem,3vw,3rem);display:flex;align-items:center;justify-content:space-between;gap:1rem}.brand{text-decoration:none;font-size:1.35rem;font-weight:700;letter-spacing:-.04em}.nav{display:flex;gap:1rem;align-items:center;flex-wrap:wrap}.nav a{text-decoration:none;color:var(--muted)}.nav a:hover,.nav a[aria-current]{color:var(--ink)}.theme{border:1px solid var(--line);background:var(--soft);color:var(--ink);padding:.55rem .8rem;border-radius:999px}main{max-width:1480px;margin:auto;padding:clamp(1rem,3vw,3rem)}.intro{display:grid;grid-template-columns:minmax(0,1fr) minmax(250px,400px);gap:2rem;align-items:end;margin-bottom:2rem}.eyebrow{text-transform:uppercase;font-size:.75rem;font-weight:750;letter-spacing:.16em;color:var(--accent)}h1{font-size:clamp(2rem,4vw,4rem);line-height:1.05;letter-spacing:-.05em;margin:.5rem 0 1rem}p{line-height:1.55;color:var(--muted)}.note{border:1px solid var(--line);background:var(--card);border-radius:1.25rem;padding:1.2rem}.note strong{color:var(--ink)}.toolbar{display:flex;gap:.65rem;align-items:center;flex-wrap:wrap;margin-bottom:1rem}.search{flex:1 1 260px;max-width:480px;border:1px solid var(--line);border-radius:999px;padding:.8rem 1rem;background:var(--card);color:var(--ink)}.pill{border:1px solid var(--line);border-radius:999px;padding:.7rem 1rem;background:var(--card);color:var(--ink)}.pill[aria-pressed=true]{background:var(--ink);color:var(--card);border-color:var(--ink)}.summary{min-height:2rem;color:var(--muted);margin:.5rem 0 1rem}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem}.card{min-width:0;border:1px solid var(--line);border-radius:1.3rem;overflow:hidden;background:var(--card);display:flex;flex-direction:column}.art{height:140px;background:linear-gradient(145deg,var(--art),var(--soft));position:relative;overflow:hidden}.art:before,.art:after{content:"";position:absolute;border:2px solid var(--accent);opacity:.34;transform:rotate(-18deg)}.art:before{width:220px;height:85px;border-radius:50%;top:25px;left:-30px}.art:after{width:145px;height:110px;border-radius:22px;right:-20px;top:44px}.art span{position:absolute;left:1rem;bottom:1rem;background:var(--card);border:1px solid var(--line);padding:.35rem .65rem;border-radius:999px;font-size:.75rem;font-weight:700}.cardbody{padding:1.2rem;display:flex;flex:1;flex-direction:column}.card h2{font-size:1.2rem;line-height:1.25;margin:.4rem 0 .7rem}.meta{font-size:.9rem;color:var(--muted);margin:0}.facts{display:flex;gap:1rem;flex-wrap:wrap;margin:auto 0 1rem;padding-top:1.3rem}.facts div{display:flex;flex-direction:column;gap:.2rem}.facts small{color:var(--muted)}.source{display:inline-flex;align-items:center;justify-content:center;align-self:flex-start;text-decoration:none;border:1px solid var(--line);border-radius:999px;padding:.6rem .9rem}.source:hover{background:var(--soft)}.more{margin:1.5rem auto;display:block;border:1px solid var(--line);border-radius:999px;background:var(--card);color:var(--ink);padding:.75rem 1.2rem}.history{border-top:1px solid var(--line);margin-top:3rem;padding-top:2rem}.history-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.8rem;margin:1.2rem 0}.history-card{border:1px solid var(--line);border-radius:1rem;background:var(--card);padding:1rem}.history-card small{display:block;color:var(--muted);font-size:.77rem}.history-card strong{display:block;font-size:1.45rem;line-height:1.2;margin:.35rem 0}.history-card p{font-size:.83rem;margin:.35rem 0 .7rem}.history-card a{font-size:.82rem;text-decoration:underline;text-underline-offset:3px}.history-links{display:flex;gap:.8rem;flex-wrap:wrap}.history-links a{border:1px solid var(--line);background:var(--card);padding:.7rem 1rem;border-radius:999px;text-decoration:none}@media(max-width:1150px){.history-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:800px){.history-cards{grid-template-columns:1fr}}footer{max-width:1480px;margin:auto;padding:1rem clamp(1rem,3vw,3rem) 3rem;color:var(--muted)}@media(max-width:920px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.intro{grid-template-columns:1fr}}@media(max-width:620px){.top{flex-direction:column;align-items:flex-start}.nav{width:100%;gap:.6rem;font-size:.9rem}.grid{grid-template-columns:1fr}.art{height:115px}.intro{gap:.5rem}.toolbar{gap:.45rem}.pill{padding:.55rem .75rem}}
.results-layout{display:grid;grid-template-columns:minmax(300px,.95fr) minmax(0,1.05fr);gap:1.2rem;align-items:start}.map-pane{position:sticky;top:1rem;border:1px solid var(--line);border-radius:1.3rem;background:var(--card);overflow:hidden}.map-head{padding:1rem 1.1rem;display:flex;align-items:center;justify-content:space-between;gap:.8rem}.map-head h2{font-size:1.05rem;margin:0}.map-head small{color:var(--muted)}#commercial-map{height:min(56vh,560px);min-height:350px;background:var(--art)}.maplibregl-ctrl-attrib{font-size:10px!important}.map-foot{padding:1rem 1.1rem}.map-foot p{margin:.25rem 0 .7rem;font-size:.85rem}.area-list{display:flex;gap:.4rem;overflow:auto;max-height:92px;flex-wrap:wrap}.area-list button{border:1px solid var(--line);background:var(--soft);color:var(--ink);border-radius:999px;padding:.4rem .6rem;font-size:.76rem;white-space:nowrap}.area-list button[aria-pressed=true]{background:var(--ink);color:var(--card)}.list-pane{min-width:0}.list-pane .grid{grid-template-columns:repeat(2,minmax(0,1fr))}.area-selection{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;color:var(--muted);font-size:.88rem;margin:.2rem 0 .6rem}.area-selection button{border:1px solid var(--line);border-radius:999px;padding:.3rem .55rem;background:var(--soft);color:var(--ink)}@media(max-width:1180px){.list-pane .grid{grid-template-columns:1fr}}@media(max-width:920px){.results-layout{grid-template-columns:1fr}.map-pane{position:static}#commercial-map{height:350px;min-height:0}.list-pane .grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){#commercial-map{height:300px}.list-pane .grid{grid-template-columns:1fr}.map-head{padding:.85rem}.map-foot{padding:.85rem}}
</style></head><body><a class="skip" href="#main">Skip to listings</a><header><div class="top"><a class="brand" href="/map">◩ Espacios</a><nav class="nav" aria-label="Map pages"><a href="/map">Map</a><a href="/map/research">Research</a><a href="/map/history">History</a><a href="/map/commercial" aria-current="page">Commercial</a><button id="theme" class="theme" type="button" aria-label="Toggle theme">Theme</button></nav></div></header><main id="main"><section class="intro"><div><div class="eyebrow">Commercial spaces · publisher snapshot</div><h1>Find a space to explore.</h1><p>Browse commercial properties listed for sale and rent on RGEstate. Each card links back to its source. Listing details and availability should be confirmed with the advertiser.</p></div><div class="note"><strong>Two evidence types, kept separate</strong><p>These are publisher asking listings, observed on 3 November 2026. Historical government sales, rent counts, and annual market values appear below as separate evidence. Listing prices are not transaction prices.</p></div></section><div class="toolbar" role="group" aria-label="Listing filters"><input id="search" class="search" type="search" placeholder="Search spaces or locations" aria-label="Search commercial listings" maxlength="120"><button class="pill" data-purpose="all" aria-pressed="true">All</button><button class="pill" data-purpose="rent" aria-pressed="false">For rent</button><button class="pill" data-purpose="sale" aria-pressed="false">For sale</button></div><div class="results-layout"><section class="map-pane" aria-label="Commercial listing area map"><div class="map-head"><h2>Spaces by area</h2><small>Publisher location labels</small></div><div id="commercial-map" role="img" aria-label="Map of commercial listing counts by area"></div><div class="map-foot"><p id="map-status" role="status" aria-live="polite">Loading area map…</p><p>Circles show listing counts near an area reference. They do not mark the actual unit or confirm current availability. © OpenStreetMap contributors.</p><div id="area-list" class="area-list" aria-label="Choose a mapped area"></div></div></section><section class="list-pane" aria-label="Commercial listings"><div id="area-selection" class="area-selection" hidden></div><div id="summary" class="summary" role="status" aria-live="polite">Loading verified snapshot…</div><div id="cards" class="grid"></div><button id="more" class="more" type="button" hidden>Show more</button></section></div><section class="history"><div class="eyebrow">Historical evidence</div><h2>What published sources say</h2><p>Ajman sale and rent aggregates, Sharjah sale totals, Ras Al Khaimah annual market values, and Fujairah building-permit counts are separate historical evidence. They do not identify currently available units or establish comparable prices.</p><div id="history-cards" class="history-cards" aria-live="polite"><p>Loading published historical evidence…</p></div><div class="history-links"><a href="/map/api/uae-evidence/ajman/commercial-sales">Ajman office &amp; shop sales ↗</a><a href="/map/api/uae-evidence/ajman/rent-contracts?city=ajman&amp;category=Commercial">Ajman commercial rent contracts ↗</a><a href="/map/api/uae-evidence/sharjah/market-aggregates">Sharjah market aggregates ↗</a><a href="/map/api/uae-evidence/ras-al-khaimah/market-values">RAK annual market values ↗</a><a href="/map/api/uae-evidence/fujairah/building-permits">Fujairah building permits ↗</a><a href="/map/history">Retained V48 history ↗</a></div></section></main><footer>RGEstate facts and source links reproduced with owner permission. No listing photos are displayed. Availability remains unverified.</footer><script>
(function(){
 const root=document.documentElement;
 const theme=document.getElementById('theme');
 const search=document.getElementById('search');
 const cards=document.getElementById('cards');
 const summary=document.getElementById('summary');
 const more=document.getElementById('more');
 const mapStatus=document.getElementById('map-status');
 const areaList=document.getElementById('area-list');
 const areaSelection=document.getElementById('area-selection');
 const historyCards=document.getElementById('history-cards');
 const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
 const number=new Intl.NumberFormat('en-AE');
 let purpose='all',selectedArea=null,offset=0,total=0,listController,areaController,map,areaData=null,mapLoaded=false,firstFit=true,mapUnavailable=false;
 function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 function card(row){
  const article=document.createElement('article');article.className='card';
  const price=row.priceAed?('AED '+number.format(row.priceAed)+(row.pricePeriod==='year'?' / year':'')):(row.priceLabel==='Price on Request'?'Price on request':'Price not confirmed');
  article.innerHTML='<div class="art" aria-hidden="true"><span>'+esc(row.purpose==='rent'?'For rent':'For sale')+'</span></div><div class="cardbody"><p class="meta">'+esc(row.locationLabel||'Location not supplied')+'</p><h2>'+esc(row.title)+'</h2><div class="facts"><div><small>Asking price</small><strong>'+esc(price)+'</strong></div><div><small>Area</small><strong>'+esc(row.areaSqft?number.format(row.areaSqft)+' sqft':'Not supplied')+'</strong></div></div><a class="source" href="'+esc(row.sourceUrl)+'" target="_blank" rel="noopener noreferrer">View source listing ↗</a></div>';
  return article;
 }
 async function loadHistory(){
  const specs=[
   {path:'/map/api/uae-evidence/ajman/commercial-sales',label:'Ajman · office & shop sales',read:d=>d.scope?.evidenceClass==='official_commercial_unit_sale_aggregate'&&Number.isSafeInteger(d.reportedSalesCountSum)&&d.totalRows===89?{value:number.format(d.reportedSalesCountSum)+' reported sales',detail:number.format(d.totalRows)+' quarterly aggregate rows, through June 2026. Not individual available units.'}:null},
   {path:'/map/api/uae-evidence/ajman/rent-contracts?city=ajman&category=Commercial',label:'Ajman · commercial rents',read:d=>d.scope?.evidenceClass==='official_certified_rent_contract_count'&&Number.isSafeInteger(d.totalRows)?{value:number.format(d.totalRows)+' source rows',detail:'Monthly certified contract counts, 2016–June 2026. No rent amounts or comparable asking prices.'}:null},
   {path:'/map/api/uae-evidence/sharjah/market-aggregates',label:'Sharjah · commercial sales',read:d=>{const row=d.observations?.find(x=>x.periodId==='2026M09');return d.scope?.cumulative===true&&row?.periodEnd==='2026-09-30'&&Number.isSafeInteger(row.saleTransactionsByUse?.commercial)?{value:number.format(row.saleTransactionsByUse.commercial)+' reported sales',detail:'January–September 2026 cumulative emirate total. Includes H1; periods must not be added.'}:null}},
   {path:'/map/api/uae-evidence/ras-al-khaimah/market-values?year=2025',label:'Ras Al Khaimah · commercial units',read:d=>{const row=d.observations?.[0];return d.scope?.unit==='AED thousand'&&row?.year===2025&&Number.isFinite(row.commercialUnitSalesValueAedThousand)?{value:'AED '+number.format(Math.round(row.commercialUnitSalesValueAedThousand/1000*100)/100)+'m',detail:'2025 annual commercial-unit sales value, not a sale count, asking price, or available unit.'}:null}},
   {path:'/map/api/uae-evidence/fujairah/building-permits?year=2024',label:'Fujairah · commercial buildings',read:d=>{const row=d.buildingUse2024?.find(x=>x.use==='commercial_buildings');return d.scope?.unit==='issued permits'&&d.scope?.buildingUseYear===2024&&row?.emirateTotal===112?{value:number.format(row.emirateTotal)+' permits',detail:'2024 commercial-building permits across Fujairah and Dibba municipalities. Not completed spaces, transactions, or available listings.'}:null}}
  ];
  historyCards.replaceChildren();
  specs.forEach(async spec=>{
   const article=document.createElement('article');article.className='history-card';article.innerHTML='<small>'+esc(spec.label)+'</small><strong>Loading evidence…</strong><p>Checking the published source.</p><a href="'+esc(spec.path)+'">Open source data ↗</a>';historyCards.appendChild(article);
   let value=null;try{const response=await fetch(spec.path);if(!response.ok)throw Error('Historical evidence unavailable');value=spec.read(await response.json());}catch{}
   article.querySelector('strong').textContent=value?.value||'Temporarily unavailable';
   article.querySelector('p').textContent=value?.detail||'Open the source data to check availability.';
  });
 }
 function params(path){const url=new URL(path,location.origin);url.searchParams.set('purpose',purpose);if(search.value.trim())url.searchParams.set('q',search.value.trim());return url}
 function areaGeojson(){return {type:'FeatureCollection',features:(areaData?.areas||[]).map(a=>({type:'Feature',geometry:{type:'Point',coordinates:a.center},properties:{key:a.key,name:a.name,count:a.count,rentRows:a.rentRows,saleRows:a.saleRows}}))}}
 function circleColor(){return ['case',['==',['get','key'],selectedArea||''],root.dataset.theme==='dark'?'#e2f0fa':'#203d53',purpose==='rent'?'#5f988f':purpose==='sale'?'#5b7f9d':root.dataset.theme==='dark'?'#9ac3d8':'#456e87']}
 function installLayers(){
  if(!map||!map.getStyle()?.layers)return;
  const data=areaGeojson();
  if(!map.getSource('commercial-areas'))map.addSource('commercial-areas',{type:'geojson',data,cluster:true,clusterMaxZoom:10,clusterRadius:55,clusterProperties:{spaceCount:['+',['get','count']]}});
  else map.getSource('commercial-areas').setData(data);
  if(!map.getLayer('commercial-clusters'))map.addLayer({id:'commercial-clusters',type:'circle',source:'commercial-areas',filter:['has','point_count'],paint:{'circle-color':root.dataset.theme==='dark'?'#557c91':'#698da2','circle-radius':['interpolate',['linear'],['get','spaceCount'],1,20,50,26,200,36,500,44],'circle-stroke-color':root.dataset.theme==='dark'?'#eaf2f7':'#fff','circle-stroke-width':2,'circle-opacity':.94}});
  if(!map.getLayer('commercial-cluster-count'))map.addLayer({id:'commercial-cluster-count',type:'symbol',source:'commercial-areas',filter:['has','point_count'],layout:{'text-field':['to-string',['get','spaceCount']],'text-size':14,'text-font':['Noto Sans Regular']},paint:{'text-color':'#fff'}});
  if(!map.getLayer('commercial-places'))map.addLayer({id:'commercial-places',type:'circle',source:'commercial-areas',filter:['!',['has','point_count']],paint:{'circle-color':circleColor(),'circle-radius':['interpolate',['linear'],['get','count'],1,11,10,17,50,25,150,34],'circle-stroke-color':root.dataset.theme==='dark'?'#eaf2f7':'#fff','circle-stroke-width':2,'circle-opacity':.95}});
  if(!map.getLayer('commercial-place-count'))map.addLayer({id:'commercial-place-count',type:'symbol',source:'commercial-areas',filter:['!',['has','point_count']],layout:{'text-field':['to-string',['get','count']],'text-size':12,'text-font':['Noto Sans Regular']},paint:{'text-color':'#fff'}});
  mapLoaded=true;
  document.getElementById('commercial-map').dataset.layersReady='true';
  if(firstFit&&areaData?.areas?.length)fitMap();
 }
 function fitMap(){if(!mapLoaded||!areaData?.areas?.length)return;firstFit=false;const bounds=areaData.areas.reduce((b,a)=>b.extend(a.center),new maplibreBounds());map.fitBounds(bounds,{padding:window.innerWidth<620?28:60,maxZoom:9,duration:reduceMotion.matches?0:260})}
 let maplibreBounds;
 async function startMap(){
  try{
   const lib=await import('/map/vendor/maplibre-gl.mjs?v=6.8.0');maplibreBounds=lib.LngLatBounds;
   map=new lib.Map({container:'commercial-map',style:'/map/basemap/styles/dark?theme='+root.dataset.theme,center:[55.1,25.1],zoom:6.2,minZoom:5,maxZoom:15,attributionControl:true});
   map.addControl(new lib.NavigationControl({showCompass:false}),'top-right');
   map.on('style.load',installLayers);
   map.on('load',installLayers);
   map.on('click','commercial-clusters',async e=>{const feature=e.features?.[0];if(!feature)return;try{const zoom=await map.getSource('commercial-areas').getClusterExpansionZoom(feature.properties.cluster_id);map.easeTo({center:feature.geometry.coordinates,zoom,duration:reduceMotion.matches?0:260})}catch{}});
   map.on('click','commercial-places',e=>{const key=e.features?.[0]?.properties?.key;if(key)chooseArea(key)});
   for(const layer of ['commercial-clusters','commercial-places']){map.on('mouseenter',layer,()=>map.getCanvas().style.cursor='pointer');map.on('mouseleave',layer,()=>map.getCanvas().style.cursor='')}
  }catch{mapUnavailable=true;mapStatus.textContent='The map is unavailable right now. All listings remain below.'}
 }
 function renderAreas(){
  areaList.replaceChildren();
  for(const area of areaData?.areas||[]){const button=document.createElement('button');button.type='button';button.textContent=area.name+' · '+number.format(area.count);button.setAttribute('aria-pressed',String(selectedArea===area.key));button.onclick=()=>chooseArea(area.key);areaList.appendChild(button)}
  const mapped=areaData?.mappedRows||0,unmapped=areaData?.unmappedRows||0;
  mapStatus.textContent=(mapUnavailable?'The map is unavailable right now. ':'')+number.format(mapped)+' listings have reviewed area references · '+number.format(unmapped)+' remain in the list without one.';
  if(map?.getSource('commercial-areas'))map.getSource('commercial-areas').setData(areaGeojson());
  if(mapLoaded&&firstFit&&mapped)fitMap();
 }
 async function loadAreas(){
  if(areaController)areaController.abort();areaController=new AbortController();
  try{const response=await fetch(params('/map/api/uae-evidence/commercial/areas'),{signal:areaController.signal});if(!response.ok)throw Error('Area source unavailable');areaData=await response.json();renderAreas()}
  catch(error){if(error.name==='AbortError')return;mapStatus.textContent='Area counts are temporarily unavailable. Listings remain below.'}
 }
 async function loadCards(append){
  if(listController)listController.abort();listController=new AbortController();
  const nextOffset=append?offset:0;
  summary.textContent='Loading verified snapshot…';more.hidden=true;
  try{
   const url=params('/map/api/uae-evidence/commercial/listings');url.searchParams.set('limit','24');url.searchParams.set('offset',String(nextOffset));if(selectedArea)url.searchParams.set('area',selectedArea);
   const response=await fetch(url,{signal:listController.signal});if(!response.ok)throw Error('Source unavailable');const data=await response.json();
   const fragment=document.createDocumentFragment();data.rows.forEach(row=>fragment.appendChild(card(row)));
   if(!append)cards.replaceChildren();cards.appendChild(fragment);offset=nextOffset+data.rows.length;total=data.totalRows;
   summary.textContent=total?number.format(total)+' publisher-listed spaces · availability unverified':'No matching spaces in this snapshot.';
   more.textContent='Show more';more.onclick=()=>loadCards(true);more.hidden=offset>=total;
  }catch(error){if(error.name==='AbortError')return;summary.textContent='The verified listing snapshot is temporarily unavailable. Retry below.';more.hidden=false;more.textContent='Retry';more.onclick=()=>loadCards(false)}
 }
 function renderSelection(){
  areaSelection.replaceChildren();
  if(!selectedArea){areaSelection.hidden=true;return}
  const place=areaData?.areas?.find(a=>a.key===selectedArea);const text=document.createElement('span');text.textContent='Showing '+(place?.name||selectedArea);const button=document.createElement('button');button.type='button';button.textContent='Clear area ×';button.onclick=()=>chooseArea(null);areaSelection.append(text,button);areaSelection.hidden=false;
  areaList.querySelectorAll('button').forEach((button,index)=>button.setAttribute('aria-pressed',String(areaData?.areas?.[index]?.key===selectedArea)));
  if(map?.getLayer('commercial-places'))map.setPaintProperty('commercial-places','circle-color',circleColor());
 }
 function chooseArea(key){selectedArea=selectedArea===key?null:key;renderSelection();loadCards(false)}
 function refresh(){selectedArea=null;renderSelection();loadAreas();loadCards(false)}
 theme.onclick=function(){root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('espacios_theme_v1',root.dataset.theme)}catch{};if(map){mapLoaded=false;document.getElementById('commercial-map').dataset.layersReady='false';map.setStyle('/map/basemap/styles/dark?theme='+root.dataset.theme)}};
 document.querySelectorAll('[data-purpose]').forEach(button=>button.onclick=()=>{purpose=button.dataset.purpose;document.querySelectorAll('[data-purpose]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));refresh()});
 let timer;search.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(refresh,220)});
 more.onclick=()=>loadCards(true);
 startMap();loadAreas();loadCards(false);loadHistory();
})();
</script></body></html>`;
export function mapRgestateCommercialPage(request){const path=new URL(request.url).pathname.replace(/\/+$/,'');if(path!=='/map/commercial')return null;if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{allow:'GET, HEAD'}});return new Response(request.method==='HEAD'?null:RGE_PAGE,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public,max-age=60','x-content-type-options':'nosniff'}})}
