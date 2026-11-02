import test from 'node:test';
import assert from 'node:assert/strict';
import hub from '../src/data-hub/worker.js';

const env={REGISTRY:{prepare(){throw Error('D1 read quota exceeded (7500)');}},DATA_RELEASE:'espacios-data-hub-v8-public-snapshot-fallback'};
const get=path=>hub.fetch(new Request('https://espacios.me'+path),env,{});

test('public PSR registry serves a labelled, checksum-verified D1 export when live reads fail',async()=>{
 const response=await get('/data/api/v1/projects?tenant=psr&limit=100&page=1');
 const body=await response.json();
 assert.equal(response.status,200);
 assert.equal(body.total,1091);
 assert.equal(body.projects.length,100);
 assert.equal(body.registry.revision,2);
 assert.equal(body.source.degraded,true);
 assert.equal(body.source.completeForCurrentDataHub,false);
 assert.equal(body.source.registryHashReconciled,false);
 assert.equal(response.headers.get('x-espacios-data-degraded'),'true');
 const last=await (await get('/data/api/v1/projects?tenant=psr&limit=100&page=11')).json();
 assert.equal(last.projects.length,91);
 const detail=await (await get('/data/api/v1/projects/'+body.projects[0].slug+'?tenant=psr')).json();
 assert.equal(detail.project.slug,body.projects[0].slug);
 assert.equal(detail.source.degraded,true);
 const manifest=await (await get('/data/api/v1/projects/manifest?tenant=psr')).json();
 assert.equal(manifest.projectCount,1091);
 assert.equal(manifest.source.degraded,true);
});

test('fallback preserves tenant and archive restrictions',async()=>{
 assert.equal((await get('/data/api/v1/projects?tenant=haus-and-grace')).status,503);
 assert.equal((await get('/data/psr/api/archive')).status,401);
 assert.equal((await get('/data/api/v1/projects?tenant=unknown')).status,400);
 const sitemap=await get('/data/api/v1/projects/sitemap?tenant=psr');
 assert.equal(sitemap.status,200);
 assert.equal(sitemap.headers.get('x-espacios-data-degraded'),'true');
 const authorized={...env,DATA_ADMIN_EMAILS:'owner@example.com',AUTH:{fetch:async()=>Response.json({user:{id:'test',email:'owner@example.com'}})}};
 const archive=await hub.fetch(new Request('https://espacios.me/data/psr/api/archive',{headers:{authorization:'Bearer test'}}),authorized,{});
 assert.equal(archive.status,503);
 assert.match((await archive.json()).error,/Archive storage is currently unavailable/);
});
