/* Version only frontend responses. Original evidence endpoints and storage are unchanged. */
var MM_RELEASE='20261009-map-evidence-v42';
var MM_PREVIOUS_FETCH=worker_default.fetch;
worker_default.fetch=async function(request,env,ctx){
 const response=await MM_PREVIOUS_FETCH.call(this,request,env,ctx);
 const path=new URL(request.url).pathname.replace(/\/+$/,'')||'/';
 if(!response.ok||!['/map','/map/app-v2.js','/map/app-v2.css'].includes(path))return response;
 const headers=new Headers(response.headers);headers.set('x-espacios-mobile',MM_RELEASE);
 if(headers.has('link'))headers.set('link',headers.get('link').replaceAll('20260930-smart-estimates-v1',MM_RELEASE).replaceAll('20261008-map-palette-v23',MM_RELEASE).replaceAll('20261008-map-palette-v24',MM_RELEASE).replaceAll('20261008-map-palette-v33',MM_RELEASE));
 for(const name of ['x-ae-navigation','x-psr-map-navfix'])if(headers.has(name))headers.set(name,MM_RELEASE);
 if(path==='/map'&&request.method==='GET'){
  const html=(await response.text()).replaceAll('20260930-smart-estimates-v1',MM_RELEASE).replaceAll('20261008-map-palette-v23',MM_RELEASE).replaceAll('20261008-map-palette-v24',MM_RELEASE).replaceAll('20261008-map-palette-v33',MM_RELEASE);
  headers.delete('content-length');headers.delete('etag');return new Response(html,{status:response.status,headers});
 }
 if(path==='/map/app-v2.js'&&request.method==='GET'){
  const javascript=(await response.text()).replaceAll('/map/map-core.json?v=20260929-collapse-repair-v3','/map/map-core.json?v='+MM_RELEASE).replaceAll('/map/map-data.json?v=20260929-collapse-repair-v3','/map/map-data.json?v='+MM_RELEASE).replaceAll('/map/api/projects-batch?','/map/api/projects-batch?review='+MM_RELEASE+'&').replaceAll('/map/api/projects-all','/map/api/projects-all?review='+MM_RELEASE).replaceAll('20261008-map-palette-v23',MM_RELEASE).replaceAll('20261008-map-palette-v24',MM_RELEASE).replaceAll('20261008-map-palette-v33',MM_RELEASE);
  headers.delete('content-length');headers.delete('etag');return new Response(javascript,{status:response.status,headers});
 }
 return new Response(response.body,{status:response.status,headers});
};
