import {PSR_PUBLIC_SNAPSHOT as source} from './psr-public-snapshot.mjs';

let decoded;
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
async function snapshot(){
 if(!decoded)decoded=(async()=>{
  const packed=atob(source.base64),compressed=Uint8Array.from(packed,char=>char.charCodeAt(0));
  if(compressed.length!==source.compressedBytes||await sha(compressed)!==source.compressedSha256)throw Error('Public registry fallback checksum mismatch');
  const raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if(raw.byteLength!==source.rawBytes||await sha(raw)!==source.rawSha256)throw Error('Public registry fallback decoded checksum mismatch');
  const data=JSON.parse(new TextDecoder().decode(raw));
  if(data.projects?.length!==source.rows||new Set(data.projects.map(row=>row.slug)).size!==source.uniqueSlugs||data.registry?.total!==source.registry.total||data.registry?.revision!==source.registry.revision||data.registry?.contentHash!==source.registry.contentHash)throw Error('Public registry fallback population mismatch');
  return data;
 })();
 return decoded;
}
const sourceLabel={service:'reviewed-psr-d1-public-export',degraded:true,completeForCurrentDataHub:false,registryHashReconciled:false,exportedAt:source.exportedAt,registryUpdatedAt:source.registry.updatedAt,databaseBookmark:source.bookmark,sha256:source.rawSha256,note:'Public PSR registry snapshot from a verified D1 export. Live D1 is unavailable; this is not a current feed or an all-UAE census.'};
const headers={'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=60, s-maxage=60','access-control-allow-origin':'*','x-content-type-options':'nosniff','x-espacios-data-source':'reviewed-public-d1-export','x-espacios-data-degraded':'true'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const filtersFor=projects=>({
 emirates:projects.reduce((all,row)=>(row.emirate&&(all[row.emirate]=(all[row.emirate]||0)+1),all),{}),
 developers:[...new Set(projects.map(row=>row.developer).filter(Boolean))].sort((a,b)=>a.localeCompare(b)),
 propertyTypes:[...new Set(projects.flatMap(row=>Array.isArray(row.propertyTypes)?row.propertyTypes:[]))].sort((a,b)=>a.localeCompare(b))
});
const escapeXml=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const same=(a,b)=>String(a||'').toLowerCase()===String(b||'').toLowerCase();

export async function publicProjectFallback(request,tenant,kind,slug){
 if(tenant!=='psr')return null;
 const data=await snapshot(),url=new URL(request.url),all=data.projects;
 if(kind==='manifest')return json({ok:true,owner:'Espacios',tenant,revision:data.registry.revision,projectCount:all.length,contentHash:data.registry.contentHash,updatedAt:data.registry.updatedAt,catalogue:'/data/api/v1/projects?tenant=psr',source:sourceLabel});
 if(kind==='detail'){
  const project=all.find(row=>row.slug===slug||row.canonicalSlug===slug);
  return project?json({ok:true,owner:'Espacios',tenant,project,source:sourceLabel}):json({ok:false,error:'Project not found.',source:sourceLabel},404);
 }
 if(kind==='sitemap'){
  const urls=all.filter(row=>row.indexable&&row.href?.startsWith('/projects/')).map(row=>`  <url><loc>${escapeXml(new URL(row.href,'https://psrhomes.ae').toString())}</loc></url>`).join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,{headers:{...headers,'content-type':'application/xml; charset=utf-8'}});
 }
 const q=String(url.searchParams.get('q')||url.searchParams.get('query')||'').trim().toLowerCase().split(/[^a-z0-9]+/).filter(term=>term.length>1);
 const emirate=url.searchParams.get('emirate'),developer=url.searchParams.get('developer'),type=url.searchParams.get('type')||url.searchParams.get('propertyType'),bedrooms=url.searchParams.get('bedrooms'),maxPrice=Number(url.searchParams.get('maxPrice')||0);
 const selected=all.filter(row=>q.every(term=>[row.title,row.developer,row.emirate,row.area].some(value=>String(value||'').toLowerCase().includes(term)))&&(!emirate||same(row.emirate,emirate))&&(!developer||same(row.developer,developer))&&(!type||row.propertyTypes?.some(value=>same(value,type)))&&(!bedrooms||row.bedrooms?.some(value=>same(value,bedrooms)))&&(!(maxPrice>0)||(Number(row.startingPrice||row.priceAed||0)>0&&Number(row.startingPrice||row.priceAed||0)<=maxPrice)));
 const requestedPage=Number(url.searchParams.get('page')||1),requestedLimit=Number(url.searchParams.get('limit')||url.searchParams.get('pageSize')||24),page=Number.isFinite(requestedPage)?Math.max(1,Math.floor(requestedPage)):1,limit=Number.isFinite(requestedLimit)?Math.max(1,Math.min(100,Math.floor(requestedLimit))):24;
 return json({ok:true,owner:'Espacios',tenant,projects:selected.slice((page-1)*limit,page*limit),total:selected.length,page,pages:Math.max(1,Math.ceil(selected.length/limit)),pageSize:limit,filters:filtersFor(all),registry:data.registry,source:sourceLabel});
}
