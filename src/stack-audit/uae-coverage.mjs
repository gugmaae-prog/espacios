const UAE_COVERAGE_PATH='/map/api/uae-evidence/coverage';
const uaeCoverageReply=(request,body,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public,max-age=60,s-maxage=300':'no-store','x-content-type-options':'nosniff','x-espacios-evidence-source':'accepted-v48-and-published-source-inventory',...(status===405?{allow:'GET, HEAD'}:{})}});

export function mapUaeCoverage(request,report){
 const url=new URL(request.url);
 if(url.pathname.replace(/\/+$/,'')!==UAE_COVERAGE_PATH)return null;
 if(!['GET','HEAD'].includes(request.method))return uaeCoverageReply(request,{error:'Read-only endpoint'},405);
 const selected=url.searchParams.get('emirate');
 if(selected===null)return uaeCoverageReply(request,report);
 const emirate=report.emirates.find(item=>item.name.toLocaleLowerCase('en')===selected.trim().toLocaleLowerCase('en'));
 if(!emirate)return uaeCoverageReply(request,{error:'Unknown emirate. Use an emirate name from the coverage catalogue.'},400);
 return uaeCoverageReply(request,{version:report.version,basis:report.basis,acceptedSnapshot:report.acceptedSnapshot,publisherListingInventory:report.publisherListingInventory,allUaeProjectDenominator:report.allUaeProjectDenominator,projectCompletenessPercent:report.projectCompletenessPercent,emirates:[emirate],basisSha256:report.basisSha256});
}
