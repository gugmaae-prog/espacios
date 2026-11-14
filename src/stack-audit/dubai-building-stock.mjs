const DUBAI_BUILDING_STOCK_PATH='/map/api/uae-evidence/dubai/commercial-building-stock';

export function mapDubaiBuildingStock(request,report,data){
 const url=new URL(request.url);
 if(url.pathname.replace(/\/+$/,'')!==DUBAI_BUILDING_STOCK_PATH)return null;
 const headers={'content-type':'application/json; charset=utf-8','cache-control':'public,max-age=60,s-maxage=300','x-content-type-options':'nosniff','x-espacios-evidence-source':report.sourceId};
 const reply=(body,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{...headers,...(status===200?{}:{'cache-control':'no-store'})}});
 if(!['GET','HEAD'].includes(request.method))return new Response(JSON.stringify({error:'Read-only endpoint'}),{status:405,headers:{...headers,'cache-control':'no-store',allow:'GET, HEAD'}});
 const year=url.searchParams.get('year'),type=url.searchParams.get('type'),area=url.searchParams.get('area');
 if((year&&!data.sourceObservationYears.includes(Number(year)))||(type&&!['commercial_building','industrial_building'].includes(type))||(area&&!['all','urban','rural'].includes(area)))return reply({error:'Unknown year, building type, or area.'},400);
 const observations=data.observations.filter(row=>(!year||row.year===Number(year))&&(!type||row.buildingType===type)&&(!area||row.area===area));
 return reply({source:{id:data.sourceId,publisher:data.publisher,host:data.host,sourceUrl:data.sourceUrl,official2019CrossCheckUrl:data.officialCrossCheckUrl,licenseLabel:report.sourceMetadataLicense,sourceRawSha256:report.sourceRawSha256,dataSha256:report.dataSha256,sourceMetadataModified:report.sourceMetadataModified},scope:{emirate:data.emirate,evidenceClass:data.evidenceClass,observationYears:data.sourceObservationYears,grain:data.grain,unit:data.unit,sourceRows:report.sourceRows,ambiguousKeyRowsWithheld:report.ambiguousKeyRowsWithheld,selectedRows:report.selectedRows,projectRegister:false,transactions:false,listingAvailability:false,projectCoordinates:false,limits:data.limits},totalRows:observations.length,observations});
}
