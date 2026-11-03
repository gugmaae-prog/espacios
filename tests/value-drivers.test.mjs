import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {createHash} from 'node:crypto';
import {sensitivity,villaCapitalScenario,isPalmJebelAli,contextFeatures,visibleDrivers} from '../src/value-drivers/core.mjs';
import worker from '../src/worker.js';
const data=JSON.parse(await fs.readFile(new URL('../data/value-drivers-20261003.json',import.meta.url)));
test('sensitivity permits losses and flat outcomes without claiming a forecast',()=>{
 assert.equal(sensitivity(0,10).index,100);assert.ok(sensitivity(-5,10).index<100);assert.ok(sensitivity(5,10).index>100);
 for(const [r,y]of [[NaN,5],[-100,5],[5,0],[5,31],['5',10],[101,10]])assert.equal(sensitivity(r,y),null);
 assert.equal(sensitivity(5,5).classification,'user_assumption_sensitivity');
});
test('villa scenario uses only user price and costs and permits a capital loss',()=>{
 const inputs={purchasePriceAED:10000000,entryCostPct:4,exitCostPct:2,annualHoldingCostAED:100000,annualGrowthPct:0,years:5};
 const flat=villaCapitalScenario(inputs);
 assert.equal(flat.classification,'user_entered_villa_capital_scenario');
 assert.equal(flat.committedAED,10400000);assert.equal(flat.grossExitAED,10000000);
 assert.equal(flat.netProceedsAED,9300000);assert.equal(flat.capitalGainAED,-1100000);
 assert.ok(villaCapitalScenario({...inputs,annualGrowthPct:-5}).capitalReturnPct<flat.capitalReturnPct);
 for(const bad of [{purchasePriceAED:0},{entryCostPct:-1},{exitCostPct:101},{annualHoldingCostAED:-1},{annualGrowthPct:-100}])assert.equal(villaCapitalScenario({...inputs,...bad}),null);
});
test('Palm aliases require explicit geography and do not match a different island',()=>{
 assert.equal(isPalmJebelAli({emirate:'Dubai',area:'The Palm Jebel Ali'}),true);
 assert.equal(isPalmJebelAli({emirate:'Dubai',name:'Palm Jabal Ali'}),true);
 assert.equal(isPalmJebelAli({emirate:'Dubai',name:'Palm Jumeirah'}),false);
 assert.equal(isPalmJebelAli({emirate:'Abu Dhabi',name:'Palm Jebel Ali'}),false);
});
test('research preserves sparse source evidence and never creates local uplift percentages',()=>{
 assert.equal(data.drivers.length,16);assert.equal(data.sources.length,36);assert.equal(data.coverage.length,7);
 assert.ok(data.drivers.some(d=>d.id==='guggenheim-abu-dhabi'));assert.ok(data.drivers.some(d=>d.id==='disney-yas'));assert.ok(data.drivers.some(d=>d.id==='wynn-al-marjan'));
 assert.equal(new Set(data.drivers.map(d=>d.id)).size,data.drivers.length);
 for(const d of data.drivers){assert.equal(d.priceUpliftPct,null);assert.equal(d.geometry,null);assert.ok(d.risk);for(const id of d.sourceIds)assert.ok(data.sources.some(s=>s.id===id));}
 for(const s of data.sources){assert.match(s.url,/^https:\/\//);if(s.published)assert.ok(s.published<=data.asOf);assert.ok(s.retrieved<=data.asOf);}
 const h=data.palmJebelAli.localPriceEvidence;assert.equal(h.segment,'apartment');assert.equal(h.points.at(-1).eligibleSales,1);assert.equal(h.points.at(-1).displayEligible,false);
 assert.equal(data.policy.validatedPalmForecast,false);assert.equal(data.policy.automaticForecastAdjustment,false);
 assert.equal(data.sensitivity.confidenceInterval,null);assert.equal(data.drivers.find(d=>d.id==='metro-blue').palmRelationship,'not_direct');
});
test('Palm quarterly cohorts reconcile to accepted V48 without inventing villa prices',async()=>{
 const h=data.palmJebelAli.history;
 assert.equal(h.classification,'official_dld_derived_area_context');assert.equal(h.acceptedV48AsOf,'2026-10-14');
 assert.equal(createHash('sha256').update(JSON.stringify(h.series)).digest('hex'),h.seriesSHA256);
 for(const [kind,count]of Object.entries({land:1685,unit:415,building:2})){
  const s=h.series.find(row=>row.kind===kind);assert.equal(s.sourceAreaId,411);assert.equal(s.scope,'area_context');
  assert.equal(s.points.reduce((n,p)=>n+p.saleCount,0),count);
  for(const p of s.points)if(p.saleCount<20)assert.equal(p.medianAEDPerSqft,null);
 }
 assert.equal(h.aggregateDistinctSaleCounts.total,2102);
 const unit=h.series.find(s=>s.kind==='unit'),anchor=unit.points.filter(p=>p.periodComplete&&p.medianAEDPerSqft!==null).at(-1);
 assert.deepEqual([anchor.period,anchor.saleCount,anchor.medianAEDPerSqft],['2026Q3',197,3564.89]);
 assert.deepEqual([unit.points.at(-1).period,unit.points.at(-1).periodComplete,unit.points.at(-1).medianAEDPerSqft],['2026Q4',false,null]);
 assert.equal(h.missing.registeredVillaPrices,true);assert.equal(h.missing.verifiedVillaRents,true);assert.equal(h.scenarioPolicy.confidenceInterval,null);
 assert.equal(data.palmJebelAli.historicalQuotes.rows.length,5);
 assert.equal(data.palmJebelAli.historicalQuotes.classification,'published_reference_asking_quotes_not_registered_sales');
 assert.equal(data.palmJebelAli.deliveryMilestones.length,8);
 assert.deepEqual(data.palmJebelAli.deliveryMilestones.map(m=>m.date),[...data.palmJebelAli.deliveryMilestones.map(m=>m.date)].sort());
 assert.equal(data.palmJebelAli.deliveryMilestones.find(m=>m.date==='2026-06-24').unit,'released residences');
 const progress=data.palmJebelAli.constructionProgress;
 const captured=JSON.parse(await fs.readFile(new URL('../data/palm-jebel-ali-progress-20261103.json',import.meta.url)));
 assert.equal(progress.version,'20261103-palm-jebel-ali-progress-v1');
 assert.deepEqual(progress.observations,captured.observations);
 assert.match(captured.source.sourcePageSHA256,/^[a-f0-9]{64}$/);
 assert.deepEqual(progress.observations.map(row=>row.frond),'ABCDEF'.split(''));
 assert.ok(progress.observations.every(row=>row.inspectionDate==='2026-06-18'&&row.progressPct>4&&row.progressPct<5));
 assert.ok(data.sources.some(row=>row.id===progress.sourceId&&row.publisher==='Nakheel'));
 assert.equal(data.palmJebelAli.villaScenarioPolicy.purchasePriceAED,null);
});
test('Palm named-phase cohorts are immutable, disjoint subdivisions with no villa estimate',()=>{
 const h=data.palmJebelAli.history;
 assert.equal(h.version,'20261103-palm-jebel-ali-history-v2');
 assert.equal(h.phaseSeries.length,19);
 assert.equal(createHash('sha256').update(JSON.stringify(h.phaseSeries)).digest('hex'),h.phaseSeriesSHA256);
 const sum=kind=>h.phaseSeries.filter(s=>s.kind===kind).reduce((n,s)=>n+s.points.reduce((m,p)=>m+p.saleCount,0),0);
 assert.equal(sum('land'),1573);assert.equal(sum('unit'),415);
 assert.equal(h.phaseReconciliation.unassignedCommercialLandSales,112);
 assert.equal(h.phaseReconciliation.additiveToAreaTotal,false);
 assert.deepEqual(h.scenarioPolicy.horizonsYears,[1,3,5,10]);
 for(const s of h.phaseSeries){
  assert.equal(s.identityVerified,false);assert.equal(s.sourceAreaId,411);assert.match(s.archivePartitionSHA256,/^[a-f0-9]{64}$/);
  for(const p of s.points)if(p.saleCount<20||!p.periodComplete){assert.equal(p.medianAEDPerSqft,null);assert.equal(p.p25AEDPerSqft,null);}
 }
});
test('newer DLD Palm snapshot adds only count evidence for the incomplete quarter',async()=>{
 const refresh=data.palmJebelAli.latestDldRefresh;
 const stored=JSON.parse(await fs.readFile(new URL('../data/palm-jebel-ali-dld-refresh-20261103.json',import.meta.url)));
 assert.deepEqual(refresh,stored);
 assert.equal(refresh.geography.sourceAreaId,411);
 assert.equal(refresh.reconciliation.acceptedSnapshotSales,2102);
 assert.equal(refresh.reconciliation.newerSnapshotSales,2141);
 assert.equal(refresh.reconciliation.netCountDifference,39);
 assert.equal(refresh.reconciliation.priorPeriodPointsMatched,17);
 assert.deepEqual(refresh.saleCohortTotals,{land:1716,unit:423,building:2});
 assert.deepEqual([refresh.latestPeriod.landSales,refresh.latestPeriod.residentialUnitSales],[31,13]);
 assert.equal(refresh.latestPeriod.periodComplete,false);
 assert.equal(refresh.latestPeriod.medianAEDPerSqft,null);
 assert.equal(refresh.source.files.length,2);
 assert.ok(refresh.source.files.every(file=>/^[a-f0-9]{64}$/.test(file.sha256)));
 assert.equal(data.palmJebelAli.history.aggregateDistinctSaleCounts.total,2102);
 assert.equal(data.palmJebelAli.villaScenarioPolicy.purchasePriceAED,null);
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
 const palm=await worker.fetch(new Request('https://espacios.me/map/api/palm-jebel-ali'),forbidden,ctx);assert.equal(palm.status,200);
 const palmData=await palm.json();assert.equal(palmData.recordId,'community:Dubai:palm-jebel-ali');assert.equal(palmData.palmJebelAli.history.aggregateDistinctSaleCounts.total,2102);assert.equal(palmData.palmJebelAli.constructionProgress.observations.length,6);assert.equal(palmData.palmJebelAli.villaScenarioPolicy.purchasePriceAED,null);assert.notEqual(palm.headers.get('etag'),etag);
 const palm304=await worker.fetch(new Request('https://espacios.me/map/api/palm-jebel-ali',{headers:{'if-none-match':palm.headers.get('etag')}}),forbidden,ctx);assert.equal(palm304.status,304);
 const palmWeak304=await worker.fetch(new Request('https://espacios.me/map/api/palm-jebel-ali',{headers:{'if-none-match':'W/'+palm.headers.get('etag')}}),forbidden,ctx);assert.equal(palmWeak304.status,304);
 const post=await worker.fetch(new Request('https://espacios.me/map/api/value-drivers',{method:'POST'}),forbidden,ctx);assert.equal(post.status,405);
 const palmPost=await worker.fetch(new Request('https://espacios.me/map/api/palm-jebel-ali',{method:'POST'}),forbidden,ctx);assert.equal(palmPost.status,405);
 const tenant=await worker.fetch(new Request('https://psrhomes.ae/map/api/value-drivers'),forbidden,ctx);assert.equal(tenant.status,404);
 const palmTenant=await worker.fetch(new Request('https://psrhomes.ae/map/api/palm-jebel-ali'),forbidden,ctx);assert.equal(palmTenant.status,404);
});
