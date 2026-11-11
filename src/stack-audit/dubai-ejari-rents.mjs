const DUBAI_EJARI_RENTS_PATH='/map/api/uae-evidence/dubai/ejari-community-rents';
const BEDROOM_CODES=new Set(['Studio','1 B/R','2 B/R','3 B/R','4 B/R','5 B/R']);

export function mapDubaiEjariRents(request,report,data){
 const url=new URL(request.url);
 if(url.pathname.replace(/\/+$/,'')!==DUBAI_EJARI_RENTS_PATH)return null;
 const headers={'content-type':'application/json; charset=utf-8','cache-control':'public,max-age=60,s-maxage=300','x-content-type-options':'nosniff','x-espacios-evidence-source':report.sourceId};
 const reply=(body,status=200,extra={})=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{...headers,...(status===200?{}:{'cache-control':'no-store'}),...extra}});
 if(!['GET','HEAD'].includes(request.method))return reply({error:'Read-only endpoint'},405,{allow:'GET, HEAD'});
 const p=url.searchParams,view=p.get('view')||'communities',community=p.get('community'),bedroom=p.get('bedroom'),q=p.get('q')?.trim()||'';
 const limitRaw=p.get('limit')||'100',offsetRaw=p.get('offset')||'0';
 if(!['communities','bedrooms'].includes(view)||(community&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(community))||(bedroom&&(view!=='bedrooms'||!BEDROOM_CODES.has(bedroom)))||q.length>100||!/^[0-9]+$/.test(limitRaw)||Number(limitRaw)<1||Number(limitRaw)>200||!/^[0-9]+$/.test(offsetRaw)||Number(offsetRaw)>data.bedroomRows.length)return reply({error:'Use view=communities|bedrooms; optional community slug, bedroom code for bedrooms, q (at most 100 characters), limit 1–200, and offset.'},400);
 const source={id:report.sourceId,publisher:report.publisher,sourceUrl:report.sourceUrl,methodologyUrl:report.methodologyUrl,originalSourceUrl:report.originalSourceUrl,license:report.license,licenseUrl:report.licenseUrl,sourceCommit:report.sourceCommit,sourceRepositoryUpdatedAt:report.sourceRepositoryUpdatedAt,sourceDataThrough:report.sourceDataThrough,sourceCsvSha256:report.sourceCsvSha256,derivedSha256:report.dataSha256};
 const scope={emirate:'Dubai',evidenceClass:'registered_ejari_contract_rent_aggregate',grain:view==='communities'?'publisher community':'publisher community × bedroom label',unit:'AED annual registered rent median',sourceWindow:report.sourceWindow,sourceRows:view==='communities'?report.communityRows:report.bedroomRows,storage:'checksum_verified_embedded_worker_snapshot',idriveReplicaVerified:false,renewalsIncluded:true,propertyClass:'unspecified_in_published_csv',estimated:false,availableUnits:false,askingRent:false,limits:report.limits};
 const rows=(view==='communities'?data.communityRows:data.bedroomRows).filter(row=>(!community||row.communitySlug===community)&&(!bedroom||row.bedroomCode===bedroom)&&(!q||`${row.communityName} ${row.communitySlug} ${row.bedroomCode||''}`.toLocaleLowerCase('en').includes(q.toLocaleLowerCase('en'))));
 const offset=Number(offsetRaw),limit=Number(limitRaw);
 return reply({source,scope,filters:{view,community:community||null,bedroom:bedroom||null,q:q||null},totalRows:rows.length,totalContractCount:rows.reduce((sum,row)=>sum+row.contractCount,0),offset,limit,rows:rows.slice(offset,offset+limit)});
}
