// Restore a scoped map surface when the private full boundary object is absent.
// The original 3,126-feature snapshot continues to win whenever it is readable.
const MAP_SPATIAL_PREVIOUS_FETCH=worker_default.fetch;
worker_default.fetch=async function(request,env,ctx){
 const path=new URL(request.url).pathname.replace(/\/+$/,'');
 if(path!=='/map/spatial/area-surface-20260923-v1.geojson')return MAP_SPATIAL_PREVIOUS_FETCH.call(this,request,env,ctx);
 const original=await MAP_SPATIAL_PREVIOUS_FETCH.call(this,request,env,ctx);
 if(original.status!==503||!['GET','HEAD'].includes(request.method))return original;
 const headers=new Headers({
  'content-type':'application/geo+json; charset=utf-8',
  'cache-control':'public, max-age=300',
  'x-content-type-options':'nosniff',
  'x-espacios-surface':'dubai-municipality-boundary-fallback-20261115',
  'x-espacios-surface-coverage':'222 Dubai communities; seven emirate outlines; no other local polygons',
  'etag':'"'+MAP_DUBAI_BOUNDARY_FALLBACK.sha256+'"'
 });
 const body=request.method==='HEAD'?null:new Blob([bytes(MAP_DUBAI_BOUNDARY_FALLBACK.base64)]).stream().pipeThrough(new DecompressionStream('gzip'));
 return new Response(body,{status:200,headers});
};
