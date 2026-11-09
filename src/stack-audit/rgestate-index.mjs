import {RGE_AREA_CENTRES,RGE_AREA_EMIRATES,rgeAreaLocationFor} from './rgestate-commercial.mjs';
const RGE_INDEX_API='/map/api/uae-evidence/rgestate/index';
const RGE_EMIRATE_LABELS={
 'Abu Dhabi':'Abu Dhabi',Ajman:'Ajman',Dubai:'Dubai',Fujairah:'Fujairah',
 'Ras Al Khaimah':'Ras Al Khaimah',Sharjah:'Sharjah',
 'Umm Al Quwain':'Umm Al Quwain','Emirate of Umm Al Quwain':'Umm Al Quwain'
};
const RGE_EMIRATES=['Abu Dhabi','Ajman','Dubai','Fujairah','Ras Al Khaimah','Sharjah','Umm Al Quwain'];
let RGE_INDEX_ROWS;
let RGE_INDEX_CACHE_SHA;
const rgeIndexDigest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
const rgeIndexReply=(request,body,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public,max-age=60,s-maxage=300':'no-store','x-content-type-options':'nosniff','x-espacios-evidence-source':'rgestate-full-index-20261109',...(status===405?{allow:'GET, HEAD'}:{})}});

async function rgeIndexVerifiedRows(report,packed){
 if(RGE_INDEX_CACHE_SHA!==report.rawSha256){RGE_INDEX_ROWS=undefined;RGE_INDEX_CACHE_SHA=report.rawSha256;}
 if(!RGE_INDEX_ROWS)RGE_INDEX_ROWS=(async()=>{
  const compressed=Uint8Array.from(atob(packed),c=>c.charCodeAt(0));
  if(compressed.length!==report.compressedBytes||await rgeIndexDigest(compressed)!==report.compressedSha256)throw Error('RGEstate full index compressed checksum mismatch');
  const raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if(raw.byteLength!==report.rawBytes||await rgeIndexDigest(raw)!==report.rawSha256)throw Error('RGEstate full index decoded checksum mismatch');
  const rows=JSON.parse(new TextDecoder().decode(raw));
  if(!Array.isArray(rows)||rows.length!==report.rows||new Set(rows.map(row=>row.sourceListingId)).size!==report.rows)throw Error('RGEstate full index population mismatch');
  const counts={rent:0,sale:0,'business-sale':0,'off-plan':0};let commercial=0;
  for(const row of rows){
   if(!(row.listingPathClass in counts)||!row.sourceUrl.startsWith('https://www.rgestate.com/'+row.listingPathClass+'/')||row.coordinates!==null||row.canonicalProjectId!==null||row.availabilityStatus!=='publisher_listed_unverified'||typeof row.commercialCategoryMember!=='boolean'||'image' in row||'phone' in row)throw Error('RGEstate full index row invariant failed');
   counts[row.listingPathClass]++;if(row.commercialCategoryMember)commercial++;
  }
  if(Object.keys(counts).some(kind=>counts[kind]!==report.pathClassCounts[kind])||commercial!==report.commercialCategoryRows)throw Error('RGEstate full index class count mismatch');
  return rows;
 })().catch(error=>{RGE_INDEX_ROWS=undefined;throw error});
 return RGE_INDEX_ROWS;
}

function rgeIndexLabelReport(report,labels,rows){
 if(labels?.sourceRawSha256!==report.rawSha256||labels.sourceId!==report.sourceId||JSON.stringify(labels.labelMap)!==JSON.stringify(RGE_EMIRATE_LABELS)||labels.explicitEmirateRows+labels.unassignedRows!==rows.length)throw Error('Publisher emirate label derivation changed');
 let assigned=0;
 for(const emirate of RGE_EMIRATES){
  const subset=rows.filter(row=>RGE_EMIRATE_LABELS[row.locationLabel]===emirate);
  const item=labels.byEmirate?.[emirate];
  if(!item||item.rows!==subset.length||item.commercialCategoryRows!==subset.filter(row=>row.commercialCategoryMember).length||Object.entries(item.byPathClass).some(([kind,count])=>subset.filter(row=>row.listingPathClass===kind).length!==count))throw Error('Publisher emirate label counts changed');
  assigned+=subset.length;
 }
 if(assigned!==labels.explicitEmirateRows||rows.length-assigned!==labels.unassignedRows)throw Error('Publisher unassigned label count changed');
}

async function rgeIndexAreaReport(report,areas,labels,rows){
 if(areas?.sourceRawSha256!==report.rawSha256||areas.sourceId!==report.sourceId||areas.reviewedAreaReferences!==RGE_AREA_CENTRES.length||areas.reviewedAreaRows+areas.unresolvedRows!==labels.unassignedRows||areas.areaReferenceSha256!==await rgeIndexDigest(new TextEncoder().encode(JSON.stringify({areas:RGE_AREA_CENTRES,emirates:RGE_AREA_EMIRATES}))))throw Error('Reviewed area geography derivation changed');
 const matched=rows.filter(row=>!RGE_EMIRATE_LABELS[row.locationLabel]&&rgeAreaLocationFor(row));
 if(matched.length!==areas.reviewedAreaRows||rows.length-labels.explicitEmirateRows-matched.length!==areas.unresolvedRows||RGE_EMIRATES.some(name=>matched.filter(row=>rgeAreaLocationFor(row).emirate===name).length!==areas.byEmirate[name]))throw Error('Reviewed area geography counts changed');
}

export async function mapRgestateIndex(request,report,packed,labels,areas){
 const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'');
 if(path!==RGE_INDEX_API)return null;
 if(!['GET','HEAD'].includes(request.method))return rgeIndexReply(request,{error:'Read-only endpoint'},405);
 if(!report?.rawSha256||typeof packed!=='string')return rgeIndexReply(request,{error:'Verified publisher index is not configured.'},503);
 const p=url.searchParams,kind=p.get('kind')||'all',commercial=p.get('commercial')||'all',emirate=p.get('emirate')||'all',locationEmirate=p.get('locationEmirate')||'all',q=(p.get('q')||'').trim(),limit=p.has('limit')?Number(p.get('limit')):24,offset=p.has('offset')?Number(p.get('offset')):0;
 if(!['all','sale','rent','business-sale','off-plan'].includes(kind)||!['all','yes','no'].includes(commercial)||!['all','unassigned',...RGE_EMIRATES].includes(emirate)||!['all','unresolved',...RGE_EMIRATES].includes(locationEmirate)||q.length>120||!Number.isSafeInteger(limit)||limit<1||limit>100||!Number.isSafeInteger(offset)||offset<0||offset>report.rows)return rgeIndexReply(request,{error:'Invalid kind, commercial, emirate, locationEmirate, q, limit, or offset.'},400);
 try{
  const rows=await rgeIndexVerifiedRows(report,packed),needle=q.toLocaleLowerCase('en');
  rgeIndexLabelReport(report,labels,rows);
  await rgeIndexAreaReport(report,areas,labels,rows);
  const locationFor=row=>RGE_EMIRATE_LABELS[row.locationLabel]||rgeAreaLocationFor(row)?.emirate||null;
  const matches=rows.filter(row=>(kind==='all'||row.listingPathClass===kind)&&(commercial==='all'||row.commercialCategoryMember===(commercial==='yes'))&&(emirate==='all'||(emirate==='unassigned'?!RGE_EMIRATE_LABELS[row.locationLabel]:RGE_EMIRATE_LABELS[row.locationLabel]===emirate))&&(locationEmirate==='all'||(locationEmirate==='unresolved'?!locationFor(row):locationFor(row)===locationEmirate))&&(!needle||[row.title,row.locationLabel,row.sourceListingId].some(value=>String(value||'').toLocaleLowerCase('en').includes(needle))));
  return rgeIndexReply(request,{source:{id:report.sourceId,publisher:report.publisher,sourceUrl:report.sourceUrl,observedAt:report.observedAt,evidenceClass:report.evidenceClass,rights:report.rights,rawSha256:report.rawSha256,verification:report.verification,comparison:report.comparison,storage:'checksum_verified_immutable_worker_snapshot'},scope:{totalSnapshotRows:report.rows,pathClassCounts:report.pathClassCounts,commercialCategoryRows:report.commercialCategoryRows,notInCommercialCategoryRows:report.notInCommercialCategoryRows,explicitEmirateLabelRows:labels.explicitEmirateRows,unassignedEmirateRows:labels.unassignedRows,reviewedAreaLocationRows:areas.reviewedAreaRows,unresolvedLocationRows:areas.unresolvedRows,reviewedAreaEmirateCounts:areas.byEmirate,reviewedAreaMethod:areas.method,reviewedAreaStatus:areas.geographyStatus,areaReferenceAttribution:'© OpenStreetMap contributors',publisherEmirateLabelCounts:Object.fromEntries(RGE_EMIRATES.map(name=>[name,labels.byEmirate[name].rows])),geographyStatus:labels.geographyStatus,emirateLabelMethod:labels.method,availability:'publisher_listed_at_capture_unverified_now',limits:report.limits+' '+labels.limits+' '+areas.limits,photosIncluded:false,coordinatesPresent:false,registeredTransactionEvidence:false,projectIdentityVerified:false},filters:{kind,commercial,emirate,locationEmirate,q:q||null},totalRows:matches.length,limit,offset,rows:matches.slice(offset,offset+limit).map(row=>({...row,publisherEmirate:RGE_EMIRATE_LABELS[row.locationLabel]||null,reviewedAreaLocation:RGE_EMIRATE_LABELS[row.locationLabel]?null:rgeAreaLocationFor(row)}))});
 }catch{return rgeIndexReply(request,{error:'The verified publisher index is temporarily unavailable.'},503);}
}
