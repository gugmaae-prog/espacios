import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {sensitivity,isPalmJebelAli,contextFeatures,visibleDrivers} from '../src/value-drivers/core.mjs';
import worker from '../src/worker.js';
const data=JSON.parse(await fs.readFile(new URL('../data/value-drivers-20261003.json',import.meta.url)));
test('sensitivity permits losses and flat outcomes without claiming a forecast',()=>{
 assert.equal(sensitivity(0,10).index,100);assert.ok(sensitivity(-5,10).index<100);assert.ok(sensitivity(5,10).index>100);
 for(const [r,y]of [[NaN,5],[-100,5],[5,0],[5,31],['5',10],[101,10]])assert.equal(sensitivity(r,y),null);
 assert.equal(sensitivity(5,5).classification,'user_assumption_sensitivity');
});
test('Palm aliases require explicit geography and do not match a different island',()=>{
 assert.equal(isPalmJebelAli({emirate:'Dubai',area:'The Palm Jebel Ali'}),true);
 assert.equal(isPalmJebelAli({emirate:'Dubai',name:'Palm Jabal Ali'}),true);
 assert.equal(isPalmJebelAli({emirate:'Dubai',name:'Palm Jumeirah'}),false);
 assert.equal(isPalmJebelAli({emirate:'Abu Dhabi',name:'Palm Jebel Ali'}),false);
});
test('research preserves sparse source evidence and never creates local uplift percentages',()=>{
 assert.equal(data.drivers.length,16);assert.equal(data.sources.length,26);assert.equal(data.coverage.length,7);
 assert.ok(data.drivers.some(d=>d.id==='guggenheim-abu-dhabi'));assert.ok(data.drivers.some(d=>d.id==='disney-yas'));assert.ok(data.drivers.some(d=>d.id==='wynn-al-marjan'));
 assert.equal(new Set(data.drivers.map(d=>d.id)).size,data.drivers.length);
 for(const d of data.drivers){assert.equal(d.priceUpliftPct,null);assert.equal(d.geometry,null);assert.ok(d.risk);for(const id of d.sourceIds)assert.ok(data.sources.some(s=>s.id===id));}
 for(const s of data.sources){assert.match(s.url,/^https:\/\//);if(s.published)assert.ok(s.published<=data.asOf);assert.equal(s.retrieved,data.asOf);}
 const h=data.palmJebelAli.localPriceEvidence;assert.equal(h.segment,'apartment');assert.equal(h.points.at(-1).eligibleSales,1);assert.equal(h.points.at(-1).displayEligible,false);
 assert.equal(data.policy.validatedPalmForecast,false);assert.equal(data.policy.automaticForecastAdjustment,false);
 assert.equal(data.sensitivity.confidenceInterval,null);assert.equal(data.drivers.find(d=>d.id==='metro-blue').palmRelationship,'not_direct');
});
test('catalogue count partitions reconcile and archive/compound labels are retained',()=>{
 const c=data.catalogue;assert.equal(c.propertyRecords,c.activeRecords+c.archivedRecords);
 assert.equal(c.areas.reduce((n,a)=>n+a.records,0),c.propertyRecords);assert.equal(c.communities.length,c.communityRecords);
 assert.equal(c.communities.filter(c=>c.indexedProjects>0).length,c.communitiesWithIndexedProjects);
 assert.equal(c.areas.find(a=>a.area==='Dubai, Palm Jebel Ali').archived,1);
 assert.equal(c.areas.find(a=>a.area==='Palm Jebel Ali').active,5);
});
test('context markers never fabricate coordinates for unmapped catalysts',()=>{
 const d={id:'test',name:'Airport',emirates:['Dubai'],areas:['Dubai South']};
 assert.equal(contextFeatures([d],[]).features.length,0);
 assert.equal(contextFeatures([d],[{id:'wrong',emirate:'Abu Dhabi',name:'Dubai South',coordinates:{lat:25,lng:55}}]).features.length,0);
 const fc=contextFeatures([d],[{id:'exact',emirate:'Dubai',name:'Dubai South',coordinates:{lat:25,lng:55}}]);
 assert.deepEqual(fc.features[0].geometry.coordinates,[55,25]);assert.match(fc.features[0].properties.basis,/not project site/);
});
test('government filters retain cross-emirate rail and return honest empty selections',()=>{
 const rows=visibleDrivers(data,'Sharjah');assert.ok(rows.some(r=>r.id==='passenger-rail'));assert.ok(rows.every(r=>r.emirates.includes('Sharjah')));
 assert.equal(visibleDrivers(data,'Ajman','Contracts awarded').length,0);
});
test('public API needs no bindings, rejects writes and stays off the PSR tenant',async()=>{
 const forbidden=new Proxy({},{get(){throw Error('No bindings should be read');}}),ctx={waitUntil(){}};
 const get=await worker.fetch(new Request('https://espacios.me/map/api/value-drivers'),forbidden,ctx);assert.equal(get.status,200);assert.deepEqual(await get.json(),data);
 const etag=get.headers.get('etag');const head=await worker.fetch(new Request('https://espacios.me/map/api/value-drivers/',{method:'HEAD'}),forbidden,ctx);assert.equal(head.status,200);assert.equal(await head.text(),'');
 const conditional=await worker.fetch(new Request('https://espacios.me/map/api/value-drivers',{headers:{'if-none-match':etag}}),forbidden,ctx);assert.equal(conditional.status,304);
 const post=await worker.fetch(new Request('https://espacios.me/map/api/value-drivers',{method:'POST'}),forbidden,ctx);assert.equal(post.status,405);
 const tenant=await worker.fetch(new Request('https://psrhomes.ae/map/api/value-drivers'),forbidden,ctx);assert.equal(tenant.status,404);
});
