const UAE_EVIDENCE_STORAGE_PATH='/map/api/uae-evidence/storage';
const uaeEvidenceStorageReply=(request,body,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public,max-age=60,s-maxage=300':'no-store','x-content-type-options':'nosniff','x-espacios-evidence-source':'dated-idrive-readback-attestations',...(status===405?{allow:'GET, HEAD'}:{})}});

export function mapUaeEvidenceStorage(request,inventory,runtime=null){
 const url=new URL(request.url);
 if(url.pathname.replace(/\/+$/,'')!==UAE_EVIDENCE_STORAGE_PATH)return null;
 if(!['GET','HEAD'].includes(request.method))return uaeEvidenceStorageReply(request,{error:'Read-only endpoint'},405);
 const sourceId=url.searchParams.get('sourceId'),emirate=url.searchParams.get('emirate');
 if(sourceId!==null&&!inventory.sources.some(source=>source.id===sourceId))return uaeEvidenceStorageReply(request,{error:'Unknown published source ID.'},400);
 if(emirate!==null&&!inventory.byEmirate.some(item=>item.name.toLocaleLowerCase('en')===emirate.trim().toLocaleLowerCase('en')))return uaeEvidenceStorageReply(request,{error:'Unknown emirate.'},400);
 const sources=inventory.sources.filter(source=>(sourceId===null||source.id===sourceId)&&(emirate===null||source.emirate.toLocaleLowerCase('en')===emirate.trim().toLocaleLowerCase('en')));
 return uaeEvidenceStorageReply(request,{
  inventoryVersion:inventory.inventoryVersion,
  evidenceScope:inventory.evidenceScope,
  publishedSourceSnapshots:inventory.publishedSourceSnapshots,
  verifiedReplicaSnapshots:inventory.verifiedReplicaSnapshots,
  unreplicatedSourceIds:inventory.unreplicatedSourceIds,
  byEmirate:inventory.byEmirate,
  filters:{sourceId,emirate},
  sources,
  replicas:inventory.replicas,
  publisherListingInventory:inventory.publisherListingInventory,
  acceptedV48Archive:{configuredPrimary:runtime?.storagePolicy?.primary||null,configuredFallback:runtime?.storagePolicy?.fallback||null,readProof:'/map/api/health?storage=idrive',proofScope:'one bounded immutable object, not whole-store health'},
  limits:inventory.limits
 });
}
