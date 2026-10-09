import test from 'node:test';
import assert from 'node:assert/strict';
import {parseEvidenceDate,isAvailableAsOf,eligibleFeaturesAsOf,expandRecordObservations,deduplicateObservations,monthlyCoverage,filterTrainingFold,eventStudy,annualScenarios,recordExposures,recordHistory,reconstructionCoverage,resolveRecordCommunityHistory,validateObservation,relevantSources} from './core.mjs';
const sources=[{id:'sales',url:'https://example.com/sales',publishedAt:'2000-01-01'},{id:'news',url:'https://example.com/news',publishedAt:'2021-01-10'}],asOf='2026-10-03';
const record={id:'project:a',type:'project',name:'Phase A',emirate:'Dubai',lifecycle:[],observations:[],historySeries:[]};
const observation=(period,value=100,extra={})=>({id:'a:'+period,recordId:record.id,metric:'price',frequency:'monthly',period,value,unit:'AED/sqft',sampleCount:25,sourceId:'sales',scope:'subject',identityVerified:true,publishedAt:period,firstAvailableAt:period,...extra});
const event={id:'event:a',title:'Dated event',eventDate:{start:'2021-01-10',precision:'day'},publishedAt:'2021-01-10',firstAvailableAt:'2021-01-10',sourceIds:['news']};
const exposure={eventId:event.id,recordId:record.id,scope:'emirate',verified:false};
const rates={downside:-2,base:0,upside:3};
const assumptions={priceAED:200000,annualRentAED:10000,occupancyYear:2028,annualPriceGrowthPct:rates,annualRentGrowthPct:rates,vacancyPct:5,annualOperatingCostsAED:1000,acquisitionCostsPct:4,disposalCostsPct:2};
test('exact-identity advertisements and valuations stay outside registered history and transaction training',()=>{
 for(const kind of ['asking_quote','developer_advertised_price','listing_price','valuation']){
  const o=observation('2020-01',100,{observationKind:kind,sampleCount:null});
  const checked=validateObservation(o,record,{asOf,sources});
  assert.equal(checked.valid,true);assert.equal(checked.displayEligible,true);assert.equal(checked.direct,false);
  assert.equal(monthlyCoverage({...record,observations:[o]},{asOf,sources}).summary.directObservedMonths,0);
  assert.equal(filterTrainingFold([o],{asOf,sources}).retained.length,0);
  const values=Array.from({length:36},(_,i)=>observation(`${2020+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}`,100+i,{observationKind:kind,sampleCount:null}));
  assert.equal(eventStudy({...record,observations:values},event,{asOf,sources,exposures:[exposure]}).status,'insufficient_evidence');
 }
 const disguised=observation('2020-01',100,{observationKind:'aggregate',evidenceClass:'advertised_asking_price'});
 assert.equal(filterTrainingFold([disguised],{asOf,sources}).retained.length,0);
 assert.equal(validateObservation(disguised,record,{asOf,sources}).direct,false);
 const priceAnchor=observation('2026-08',200000,{observationKind:'developer_advertised_price',unit:'AED'});
 const out=annualScenarios({...record,scenarioInputs:{priceAnchor,assumptions:{annualPriceGrowthPct:rates}}},{asOf,sources});
 assert.ok(out.metrics.price.paths.base.every(p=>p.value===null));
});
test('a rejected geographic link preserves native points but cannot supply usable context or volume',()=>{
 const series={id:'old',metric:'price',unit:'AED/sqft',scope:'area_context',identityVerified:false,sourceId:'sales',frequency:'monthly',columns:['period','value','sampleCount'],points:[['2026-08',100,40]],recordLinkReview:{status:'rejected',reason:'Wrong community',sourceIds:['news']}};
 const r={...record,historySeries:[series]};const out=recordHistory({version:'test',asOf,sources,events:[],exposures:[],manifest:{}},r);
 assert.equal(out.historySeries[0].points[0][1],100);assert.equal(out.validatedObservations.length,2);
 assert.ok(out.validatedObservations.every(p=>!p.displayEligible&&p.issues.includes('rejected_record_geography_link')));
 assert.equal(out.coverage.summary.contextMonths,0);
});
test('disputed financial anchors cannot generate forecast prices, rents or net returns',()=>{
 const anchor=(unit,value)=>({period:'2026-08',value,unit,scope:'subject',identityVerified:true,recordId:record.id,sourceId:'sales',firstAvailableAt:'2026-08',qualityStatus:'conflict: contract chronology'});
 const r={...record,scenarioInputs:{priceAnchor:anchor('AED',200000),rentAnchor:anchor('AED/year',10000),assumptions}};
 const out=annualScenarios(r,{asOf,sources});for(const metric of ['price','rent','netROI'])assert.ok(out.metrics[metric].paths.base.every(p=>p.value===null));
 const manual=annualScenarios(r,{asOf,sources,userAssumptions:assumptions});assert.equal(manual.classification,'user_assumption_scenario');assert.equal(manual.validatedForecast,false);
});
test('precision preserves ranges and rejects bad calendar dates or false precision',()=>{
 assert.deepEqual(parseEvidenceDate('2024-02'),{start:'2024-02-01',end:'2024-02-29',precision:'month'});
 assert.deepEqual(parseEvidenceDate('2025Q4'),{start:'2025-10-01',end:'2025-12-31',precision:'quarter'});
 assert.equal(parseEvidenceDate({start:'2024-01-01',precision:'year'}).end,'2024-12-31');
 assert.equal(parseEvidenceDate({start:'2020-03',end:'2021-06',precision:'range'}).end,'2021-06-30');
 for(const invalid of ['2023-02-29','2024-13','2024Q5','2024-01-01T00:00:00'])assert.throws(()=>parseEvidenceDate(invalid));
 assert.throws(()=>parseEvidenceDate({start:'2024-01',precision:'day'}));
});
test('availability never substitutes retrieval and requires all referenced source support',()=>{
 assert.equal(isAvailableAsOf({retrieved:'2020-01-01'},'2021-01-01'),false);
 assert.equal(isAvailableAsOf({firstAvailableAt:'2021'},'2021-06-30'),false);
 assert.equal(isAvailableAsOf({firstAvailableAt:'2021-01-10',publishedAt:'2021-02-01'},'2022-01-01'),false);
 const features=[{id:'known',publishedAt:'2021-01-10',sourceIds:['news']},{id:'late',publishedAt:'2021-01-10',sourceIds:['news','future']},{id:'unknown',publishedAt:'2021-01-10',sourceIds:['absent']}];
 const out=eligibleFeaturesAsOf(features,{asOf:'2022-01-01',sources:[...sources,{id:'future',publishedAt:'2023-01-01'}]});
 assert.deepEqual(out.eligible.map(f=>f.id),['known']);assert.equal(out.withheld.length,2);
});
test('raw sparse rows survive, context stays separate and quarterly evidence is not resampled',()=>{
 const row={...record,observations:[observation('2026-07',99,{sampleCount:1}),observation('2026-08',110)],historySeries:[{id:'context',metric:'price',frequency:'quarterly',unit:'AED/sqft',sourceId:'sales',scope:'area_context',identityVerified:false,columns:['period','value','sampleCount'],points:[['2026Q2',120,30]]}]};
 const before=structuredClone(row),out=recordHistory({version:'test',asOf,sources,events:[],exposures:[],manifest:{}},row);
 assert.deepEqual(row,before);assert.equal(out.observations[0].value,99);
 assert.equal(out.validatedObservations.find(o=>o.period==='2026-07').displayEligible,false);
 assert.equal(out.coverage.metrics.price.periods.find(p=>p.period==='2026-07').status,'sparse');
 assert.equal(out.coverage.metrics.price.periods.find(p=>p.period==='2026-08').status,'observed');
 assert.equal(out.coverage.metrics.price.nativePeriods.quarterly[0].status,'context_only');
 assert.equal(out.coverage.metrics.price.nativePeriods.quarterly[0].period,'2026Q2');
 assert.equal(out.coverage.summary.directObservedMonths,1);
});
test('native mixed annual/half-year prices stay at their original frequencies',()=>{
 const r={...record,historySeries:[{id:'asking',metric:'price',frequency:'native_mixed',unit:'AED/sqft',sourceId:'sales',scope:'asking_benchmark',columns:['period','value','sampleCount'],points:[['2024FY',100,null],['2025H1',110,null]]}]};
 const expanded=expandRecordObservations(r);assert.deepEqual(expanded.map(o=>o.frequency),['annual','half_year']);
 const coverage=monthlyCoverage(r,{asOf,sources});assert.equal(coverage.metrics.price.nativePeriods.annual[0].status,'context_only');assert.equal(coverage.metrics.price.nativePeriods.half_year[0].status,'context_only');assert.equal(coverage.summary.directObservedMonths,0);
});
test('median-only sparse source flag retains raw prices and does not suppress eligible-count volume',()=>{
 const r={...record,historySeries:[{id:'one',metric:'price',frequency:'monthly',unit:'AED/sqft',sourceId:'sales',scope:'area_context',columns:['period','value','sampleCount','qualityStatus'],points:[['2026-08',100,1,'withheld median: sparse/invalid']]}]},out=recordHistory({version:'test',asOf,sources,events:[],exposures:[]},r);
 const price=out.validatedObservations.find(o=>o.metric==='price'),count=out.validatedObservations.find(o=>o.metric==='volume');
 assert.equal(price.valid,true);assert.equal(price.sparse,true);assert.equal(price.displayEligible,false);assert.equal(price.value,100);
 assert.equal(count.value,1);assert.equal(count.displayEligible,true);assert.equal(count.unit,'eligible sales count');assert.equal(count.seriesId,price.seriesId);
});
test('same transaction deduplicates across fields and conflicting amendments are quarantined',()=>{
 const a=observation('2026-08',100,{sourceObservationId:'transaction:1'}),b={...a,id:'alternate-field'};
 const exact=deduplicateObservations([a,b]);assert.equal(exact.retained.length,1);assert.equal(exact.duplicates.length,1);
 const conflict=deduplicateObservations([a,{...b,value:101}]);assert.equal(conflict.conflicts.length,1);assert.equal(conflict.retained[0].duplicateConflict,true);
 const coverage=monthlyCoverage({...record,observations:[a,{...b,value:101}]},{asOf,sources});assert.equal(coverage.summary.directObservedMonths,0);assert.equal(coverage.summary.conflictMonths,1);
 const wrong=monthlyCoverage({...record,observations:[{...a,recordId:'project:b'}]},{asOf,sources});assert.equal(wrong.summary.directObservedMonths,0);
});
test('verified occupancy permits pre-applicability while reported handover does not',()=>{
 const r={...record,historyStartPeriod:'2026-01',lifecycle:[{kind:'occupancy',date:'2026-07-01',status:'verified',sourceIds:['sales']}]};
 const out=monthlyCoverage(r,{asOf,sources});assert.equal(out.metrics.rent.statusCounts.not_applicable,6);
 const reported=monthlyCoverage({...r,lifecycle:[{...r.lifecycle[0],kind:'target_handover',status:'reported'}]},{asOf,sources});assert.equal(reported.metrics.rent.statusCounts.not_applicable,0);
 const inaccessible=monthlyCoverage({...r,historyAccess:{price:{status:'inaccessible',reason:'Licensed contract export pending'}}},{asOf,sources});assert.equal(inaccessible.metrics.price.statusCounts.inaccessible,9);
});
test('fold-only outliers cannot see later prices or future publication and ignore publisher future-year band bit',()=>{
 const training=Array.from({length:100},(_,i)=>observation('2021-01',i+100,{id:'tx:'+i,sourceObservationId:'tx:'+i,qualityFlags:4}));
 const baseline=filterTrainingFold(training,{asOf:'2021-01-31',sources}),withFuture=filterTrainingFold([...training,observation('2021-12',999999,{id:'future'})],{asOf:'2021-01-31',sources});
 assert.deepEqual(withFuture.bands,baseline.bands);assert.ok(baseline.retained.length>0);assert.equal(withFuture.withheld.length,baseline.withheld.length+1);
 const unavailable=filterTrainingFold([observation('2020-01',100,{publishedAt:'2022-01-01',firstAvailableAt:'2022-01-01'})],{asOf:'2021-01-01',sources});assert.equal(unavailable.retained.length,0);
});
function eventRows(scope='subject',frequency='monthly'){
 const rows=[];for(let i=0;i<25;i++){const ix=2020*12+i,p=`${Math.floor(ix/12)}-${String(ix%12+1).padStart(2,'0')}`;rows.push(observation(p,i<=11?100:i>=13?120:110,{scope,identityVerified:scope==='subject',frequency,seriesId:'one'}));}return rows;
}
test('event association requires complete native windows and never claims causation',()=>{
 const r={...record,observations:eventRows()},study=eventStudy(r,event,{asOf,sources,exposures:[exposure]});
 assert.equal(study.status,'descriptive_association');assert.ok(Math.abs(study.observedChangePct-20)<1e-10);assert.equal(study.causalAttribution,false);assert.equal(study.preWindow.observedPeriods,12);assert.equal(study.postWindow.observedPeriods,12);
 const gap=eventStudy({...r,observations:r.observations.slice(0,-1)},event,{asOf,sources,exposures:[exposure]});assert.equal(gap.status,'insufficient_evidence');assert.equal(gap.observedChangePct,null);
 const coarse=eventStudy(r,{...event,eventDate:'2021'},{asOf,sources,exposures:[exposure]});assert.equal(coarse.status,'insufficient_evidence');
});
test('explicit context study never promotes subject history and annual windows remain one native point',()=>{
 const r={...record,observations:eventRows('area_context')};
 assert.equal(eventStudy(r,event,{asOf,sources,exposures:[exposure]}).status,'insufficient_evidence');
 const context=eventStudy(r,event,{asOf,sources,scope:'area_context',exposures:[exposure]});assert.equal(context.classification,'descriptive_context_association');assert.equal(context.subjectEvidence,false);
 const community=eventStudy({...record,observations:eventRows('community_context')},event,{asOf,sources,scope:'community_context',exposures:[exposure]});assert.equal(community.classification,'descriptive_context_association');assert.equal(community.subjectEvidence,false);assert.equal(community.causalAttribution,false);
 const annual={...record,observations:[observation('2020',100,{frequency:'annual'}),observation('2022',120,{frequency:'annual'})]};
 const out=eventStudy(annual,event,{asOf,sources,frequency:'annual',exposures:[exposure]});assert.equal(out.preWindow.expectedPeriods,1);assert.equal(out.postWindow.expectedPeriods,1);assert.equal(out.causalAttribution,false);
});
test('event studies match native period aliases without changing source period labels or merging duplicates',()=>{
 const annual={...record,observations:[observation('2020FY',100,{frequency:'annual'}),observation('2022-FY',120,{frequency:'annual'})]};
 const out=eventStudy(annual,event,{asOf,sources,frequency:'annual',exposures:[exposure]});
 assert.equal(out.status,'descriptive_association');assert.equal(out.preWindow.points[0].period,'2020');assert.equal(out.preWindow.points[0].sourcePeriod,'2020FY');assert.equal(out.postWindow.points[0].sourcePeriod,'2022-FY');
 const quarterly={...record,observations:['2020-Q1','2020-Q2','2020-Q3','2020-Q4','2021-Q2','2021-Q3','2021-Q4','2022-Q1'].map((p,i)=>observation(p,i<4?100:120,{frequency:'quarterly',seriesId:'one'}))};
 const q=eventStudy(quarterly,event,{asOf,sources,frequency:'quarterly',exposures:[exposure]});assert.equal(q.status,'descriptive_association');assert.equal(q.preWindow.points[0].sourcePeriod,'2020-Q1');
 const duplicate=eventStudy({...annual,observations:[...annual.observations,observation('2020',101,{frequency:'annual'})]},event,{asOf,sources,frequency:'annual',exposures:[exposure]});
 assert.equal(duplicate.status,'insufficient_evidence');assert.equal(duplicate.preWindow.points[0].status,'conflict');assert.equal(duplicate.observedChangePct,null);
});
test('all54 annual slots exist, missing anchors stay null, and user inputs never fill historical coverage',()=>{
 const missing=annualScenarios(record,{asOf,sources});assert.equal(missing.targetYears.length,54);assert.equal(missing.targetYears.at(-1),2080);
 for(const m of Object.values(missing.metrics))for(const p of Object.values(m.paths)){assert.equal(p.length,54);assert.ok(p.every(x=>x.value===null));}
 const calculated=annualScenarios(record,{asOf,sources,userAssumptions:assumptions});assert.equal(calculated.classification,'user_assumption_scenario');assert.equal(calculated.validatedForecast,false);assert.equal(calculated.originalCoverageUnchanged,true);
 assert.equal(calculated.metrics.rent.paths.base[0].value,0);assert.equal(calculated.metrics.rent.paths.base[1].value,10000);assert.ok(calculated.metrics.netROI.paths.base[0].value<0);
 assert.equal(calculated.metrics.price.paths.base.at(-1).value,200000);assert.equal(calculated.metrics.price.paths.base[0].realValue,null);
 assert.equal(monthlyCoverage(record,{asOf,sources}).summary.directObservedMonths,0);
});
test('annual overrides support delay, inflation, changing costs and explicit macro context without uplift',()=>{
 const annual=Array.from({length:54},(_,i)=>({year:2027+i,priceGrowthPct:0,rentGrowthPct:0,inflationPct:2,vacancyPct:5,operatingCostsAED:1000+i*10,deliveryDelayYears:2,supplyGrowthPct:10,migrationGrowthPct:5,ratePct:6}));
 const out=annualScenarios(record,{asOf,sources,userAssumptions:{...assumptions,annualInputs:{base:annual}}});
 assert.deepEqual(out.metrics.rent.paths.base.slice(0,3).map(x=>x.value),[0,0,0]);assert.equal(out.metrics.rent.paths.base[3].value,10000);
 assert.equal(out.metrics.price.paths.base[0].value,200000);assert.ok(Math.abs(out.metrics.price.paths.base[0].realValue-200000/1.02)<1e-8);
 assert.ok(out.metrics.netROI.paths.base[0].realValue<out.metrics.netROI.paths.base[0].value);
 assert.equal(out.appliedAnnualInputs.base[0].supplyGrowthPct,10);assert.equal(out.causalPriceUplift,false);
 assert.throws(()=>annualScenarios(record,{asOf,sources,userAssumptions:{...assumptions,annualInputs:{base:[annual[0],annual[0]]}}}));
});
test('stale verified rent requires explicit rebasing and cannot borrow growth from future annual inputs',()=>{
 const anchor=(period,value,unit)=>({period,value,unit,scope:'subject',identityVerified:true,recordId:record.id,sourceId:'sales',publishedAt:period,firstAvailableAt:period});
 const r={...record,scenarioInputs:{priceAnchor:anchor('2026-08',200000,'AED'),rentAnchor:anchor('2019',10000,'AED/year'),occupancyYear:2019,assumptions:{...assumptions,occupancyYear:2019,annualInputs:{base:Array.from({length:54},(_,i)=>({year:2027+i,rentGrowthPct:10}))}}}};
 const out=annualScenarios(r,{asOf,sources});assert.ok(out.metrics.rent.paths.base.every(p=>p.value===null));assert.ok(out.metrics.netROI.paths.base.every(p=>p.value===null));assert.match(out.metrics.rent.paths.base[0].reason,/dated rebasing to 2026/);assert.equal(out.metrics.price.paths.base[0].value,200000);
 const current=annualScenarios({...r,scenarioInputs:{...r.scenarioInputs,rentAnchor:anchor('2026-08',10000,'AED/year')}},{asOf,sources});assert.equal(current.metrics.rent.paths.base[0].value,11000);
 const manual=annualScenarios(r,{asOf,sources,userAssumptions:{...assumptions,occupancyYear:2019}});assert.equal(manual.metrics.rent.paths.base[0].value,10000);assert.equal(manual.rentAnchor,null);assert.equal(manual.classification,'user_assumption_scenario');
});
test('missing annual growth propagates null and absent costs prevent net returns',()=>{
 const partial=annualScenarios(record,{asOf,sources,userAssumptions:{priceAED:200000,annualInputs:{base:[{year:2027,priceGrowthPct:-10},{year:2028,priceGrowthPct:5}]}}});
 assert.equal(partial.metrics.price.paths.base[0].value,180000);assert.equal(partial.metrics.price.paths.base[1].value,189000);assert.equal(partial.metrics.price.paths.base[2].value,null);assert.ok(partial.metrics.netROI.paths.base.every(x=>x.value===null));
 assert.throws(()=>annualScenarios(record,{asOf,sources,userAssumptions:{...assumptions,priceAED:-1}}));
});
test('compact macro rules create context exposures without double counting explicit links',()=>{
 const data={exposures:[exposure],exposureRules:[{eventId:event.id,scope:'national',appliesTo:'project'},{eventId:'other',scope:'emirate',emirates:['Dubai'],appliesTo:'project'},{eventId:'wrong',scope:'emirate',emirates:['Abu Dhabi'],appliesTo:'project'}]};
 const out=recordExposures(data,record);assert.equal(out.length,2);assert.equal(out[1].derivedFromRule,true);assert.equal(out[1].existenceAtEvent,'research_pending');assert.equal(out[1].priceUpliftPct,null);
});

 test('current asking evidence without older history remains outside complete-month accountability',()=>{
  const record={id:'project:current-only',observations:[{id:'ask',period:'2026-10-05',frequency:'daily',metric:'price',value:1000000,unit:'AED',scope:'asking_benchmark',identityVerified:false,sourceId:'page',observationKind:'asking_quote'}]};
  const result=monthlyCoverage(record,{asOf:'2026-10-05',sources:[{id:'page',retrievedAt:'2026-10-05',firstAvailableAt:'2026-10-05'}]});
  assert.equal(result.window.start,'2026-09');assert.equal(result.window.end,'2026-09');assert.match(result.window.basis,/current\/incomplete/);assert.equal(result.metrics.price.statusCounts.observed,0);assert.equal(result.metrics.price.nonMonthlyObservationCount,1);
 });

 test('shared community histories retain context scope and require the exact recorded community relation',()=>{
  const context={id:'native-master',scope:'community_context',identityVerified:false,points:[]};
  const community={id:'community:c',type:'community',emirate:'Dubai',historySeries:[context,{id:'bad-subject',scope:'subject',identityVerified:true,points:[]}]};
  const p={...record,communityId:community.id,sharedCommunityHistoryId:community.id,historySeries:[]};
  const data={records:[community,p]};const resolved=resolveRecordCommunityHistory(data,p);
  assert.equal(resolved.historySeries.length,1);assert.equal(resolved.historySeries[0].scope,'community_context');assert.equal(resolved.historySeries[0].identityVerified,false);assert.equal(p.historySeries.length,0);
  assert.equal(resolveRecordCommunityHistory(data,{...p,sharedCommunityHistoryId:'community:other'}).historySeries.length,0);
  assert.equal(resolveRecordCommunityHistory({...data,records:[{...community,emirate:'Abu Dhabi'}]},p).historySeries.length,0);
 });

test('subject histories fail closed for the wrong owner, missing owner and missing identity proof',()=>{
 const descriptor={id:'owned',scope:'subject',identityVerified:true,subjectRecordId:record.id,identitySourceIds:['sales'],sourceId:'sales',metric:'price',frequency:'monthly',unit:'AED/sqft',columns:['period','value','sampleCount'],points:[['2026-08',100,25]]};
 const validate=series=>validateObservation(expandRecordObservations({...record,historySeries:[series]})[0],record,{asOf,sources});
 assert.equal(validate(descriptor).displayEligible,true);
 for(const bad of [{...descriptor,subjectRecordId:'project:other'},{...descriptor,subjectRecordId:null},{...descriptor,identitySourceIds:['absent']}]){const result=validate(bad);assert.equal(result.displayEligible,false);assert.equal(result.coverageStatus,'conflict');}
 const wrong=expandRecordObservations({...record,historySeries:[{...descriptor,subjectRecordId:'project:other'}]});
 assert.equal(filterTrainingFold(wrong,{asOf,sources}).retained.length,0);
 const promotion={...descriptor,scope:'community_context',identityVerified:false,points:[{period:'2026-08',value:100,sampleCount:25,scope:'subject',identityVerified:true}]};
 assert.ok(validate(promotion).issues.includes('series_identity_override'));
});

test('financial observations are unavailable to a forecasting origin before their identity proof exists',()=>{
 const proofs=[...sources,{id:'identity',url:'https://example.com/identity',firstAvailableAt:'2025-06-01'}];
 const value=observation('2020-01',100,{identitySourceIds:['identity']});
 assert.equal(validateObservation(value,record,{asOf:'2024-12-31',sources:proofs}).availability,'unknown_or_later');
 assert.equal(filterTrainingFold([value],{asOf:'2024-12-31',sources:proofs}).retained.length,0);
 assert.equal(filterTrainingFold([value],{asOf:'2025-06-01',sources:proofs}).retained.length,1);
});

test('earlier verified subject milestones extend accountability without supplying earlier prices',()=>{
 const milestone={id:'origin',kind:'launch',status:'verified',scope:'subject',primaryEvidence:true,sourceIds:['sales'],date:{start:'2010Q2',precision:'quarter'}};
 const out=monthlyCoverage({...record,lifecycle:[milestone],observations:[observation('2020-01')]},{asOf,sources});
 assert.equal(out.window.start,'2010-04');assert.equal(out.metrics.price.periods[0].status,'missing');
 assert.equal(out.metrics.price.statusCounts.observed,1);
 const context=monthlyCoverage({...record,lifecycle:[{...milestone,scope:'published_reference'}],observations:[observation('2020-01')]},{asOf,sources});
 assert.equal(context.window.start,'2020-01');assert.equal(context.metrics.price.subjectApplicabilityKnown,false);
});

test('proof sources and inherited community attribution survive the presentation view',()=>{
 const context={id:'native',sourceId:'sales',identitySourceIds:['proof'],scope:'community_context',identityVerified:false,metric:'price',unit:'AED/sqft',frequency:'monthly',columns:['period','value','sampleCount'],points:[['2026-08',100,25]]};
 const community={id:'community:c',type:'community',emirate:'Dubai',historySeries:[context]},p={...record,communityId:community.id,sharedCommunityHistoryId:community.id};
 const resolved=resolveRecordCommunityHistory({records:[community]},p),point=expandRecordObservations(resolved)[0];
 assert.equal(point.contextCommunityId,community.id);assert.match(point.linkBasis,/existence.*unverified/);
 assert.equal(validateObservation(point,p,{asOf,sources}).direct,false);
 assert.deepEqual(relevantSources({sources:[...sources,{id:'proof',url:'https://example.com/proof'}]},resolved).map(s=>s.id),['sales','proof']);
});

test('community studies remain descriptive context and published aggregate references obey sample gates',()=>{
 const r={...record,observations:eventRows('community_context')},out=eventStudy(r,event,{asOf,sources,scope:'community_context',exposures:[exposure]});
 assert.equal(out.status,'descriptive_association');assert.equal(out.classification,'descriptive_context_association');assert.equal(out.subjectEvidence,false);assert.equal(out.causalAttribution,false);
 const ref=observation('2026-08',100,{scope:'published_reference',identityVerified:false,sampleCount:1});
 const sparse=validateObservation(ref,record,{asOf,sources});assert.equal(sparse.valid,true);assert.equal(sparse.sparse,true);assert.equal(sparse.displayEligible,false);
 assert.equal(validateObservation({...ref,observationKind:'asking_quote',sampleCount:null},record,{asOf,sources}).displayEligible,true);
});

test('bucketed monthly and native coverage agrees with source rows across mixed scopes and frequencies',()=>{
 const observations=[];for(let i=0;i<72;i++){const p=`${2020+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}`;observations.push(observation(p,100+i,{id:'direct:'+i}),observation(p,80+i,{id:'context:'+i,scope:'community_context',identityVerified:false,sampleCount:i%3?25:1}));}
 const r={...record,observations,historySeries:[{id:'quarters',metric:'price',frequency:'quarterly',scope:'area_context',identityVerified:false,unit:'AED/sqft',sourceId:'sales',columns:['period','value','sampleCount'],points:[['2020Q1',90,25],['2020Q2',95,1]]}]},coverage=monthlyCoverage(r,{asOf,sources});
 assert.equal(coverage.summary.directObservedMonths,72);assert.equal(coverage.metrics.price.periods.find(p=>p.period==='2020-01').rawCount,2);assert.equal(coverage.metrics.price.periods.find(p=>p.period==='2020-01').eligibleCount,1);assert.equal(coverage.metrics.price.periods.find(p=>p.period==='2020-01').contextCount,1);
 assert.equal(coverage.metrics.price.nativePeriods.quarterly[1].sparseContextCount,1);assert.deepEqual(recordHistory({version:'test',asOf,sources,events:[],exposures:[]},r).coverage,coverage);
});

test('an observation cannot override a later or unknown source vintage in backtests',()=>{
 const late=[{id:'sales',firstAvailableAt:'2026-10-05',publishedAt:null}];
 const point=observation('2020-01',100,{firstAvailableAt:'2020-02-01'});
 assert.equal(validateObservation(point,record,{asOf:'2024-12-31',sources:late}).availability,'unknown_or_later');
 assert.equal(filterTrainingFold([point],{asOf:'2024-12-31',sources:late}).retained.length,0);
 assert.equal(filterTrainingFold([point],{asOf:'2026-10-05',sources:late}).retained.length,1);
 assert.equal(filterTrainingFold([point],{asOf,sources:[{id:'sales'}]}).retained.length,0);
});

test('planned occupancy and by-date occupancy bounds cannot establish earlier rental inapplicability',()=>{
 const base={kind:'occupancy',date:{start:'2022-01-01',precision:'day'},status:'verified',scope:'subject',primaryEvidence:true,sourceIds:['sales']};
 for(const milestone of [{...base,eventStatus:'planned'},{...base,date:{...base.date,qualifier:'by_date'}}]){
  const out=monthlyCoverage({...record,historyStartPeriod:'2020-01',lifecycle:[milestone]},{asOf,sources});
  assert.equal(out.metrics.rent.subjectApplicabilityKnown,false);assert.equal(out.metrics.rent.statusCounts.not_applicable,0);
 }
});

test('retained verified financial evidence before a public launch keeps applicability unresolved',()=>{
 const launch={kind:'launch',date:{start:'2022-01-01',precision:'day'},status:'verified',scope:'subject',primaryEvidence:true,eventStatus:'actual',sourceIds:['sales']};
 const out=monthlyCoverage({...record,lifecycle:[launch],observations:[observation('2020-01')]},{asOf,sources});
 assert.equal(out.window.start,'2020-01');assert.equal(out.metrics.price.subjectApplicabilityKnown,false);
 assert.equal(out.metrics.price.periods[0].status,'observed');assert.equal(out.metrics.price.statusCounts.not_applicable,0);
});

test('a public launch without a proven first-sale boundary cannot exclude earlier price periods',()=>{
 const launch={kind:'launch',date:{start:'2022-01-01',precision:'day'},status:'verified',scope:'subject',primaryEvidence:true,eventStatus:'reported',sourceIds:['sales']};
 const r={...record,historyStartPeriod:'2020-01',lifecycle:[launch]};
 const out=monthlyCoverage(r,{asOf,sources});
 assert.equal(out.metrics.price.subjectApplicabilityKnown,false);
 assert.equal(out.metrics.price.statusCounts.not_applicable,0);
 assert.equal(out.metrics.price.periods.find(p=>p.period==='2020-01').status,'unknown');
 assert.equal(out.metrics.price.periods.find(p=>p.period==='2022-01').status,'missing');
 assert.equal(out.metrics.price.periods.find(p=>p.period==='2026-09').status,'missing');
 const proven=monthlyCoverage({...r,lifecycle:[{...launch,establishesApplicabilityStart:true}]},{asOf,sources});
 assert.equal(proven.metrics.price.subjectApplicabilityKnown,true);
 assert.equal(proven.metrics.price.statusCounts.not_applicable,24);
 const contradictory=monthlyCoverage({...r,lifecycle:[{...launch,establishesApplicabilityStart:true}],observations:[observation('2020-01')]},{asOf,sources});
 assert.equal(contradictory.metrics.price.subjectApplicabilityKnown,false);
 assert.equal(contradictory.metrics.price.periods[0].status,'observed');
});

test('microsecond source capture timestamps retain text and are available at the current cutoff',()=>{
 const instant='2026-10-05T09:59:36.848680+00:00';
 assert.equal(parseEvidenceDate(instant).instant,Date.parse('2026-10-05T09:59:36.848Z'));
 assert.equal(isAvailableAsOf({firstAvailableAt:instant},'2026-10-05'),true);
 assert.equal(isAvailableAsOf({firstAvailableAt:instant},'2026-10-04'),false);
 const current=[{id:'sales',firstAvailableAt:instant}];
 assert.equal(validateObservation(observation('2020-01'),record,{asOf:'2026-10-05',sources:current}).availability,'known_as_of');
 assert.equal(current[0].firstAvailableAt,instant);
 assert.throws(()=>parseEvidenceDate('2026-10-05T09:59:36.848680'),/timezone/);
});


test('reconstruction tiers never promote contextual history into subject observations',()=>{
 const subject={...record,historySeries:[{id:'subject',metric:'price',frequency:'monthly',unit:'AED/sqft',sourceId:'sales',scope:'subject',identityVerified:true,pointCount:12}]};
 assert.equal(reconstructionCoverage(subject).metrics.price.tier,1);assert.equal(reconstructionCoverage(subject).metrics.price.absoluteValueInferenceAllowed,true);
 const community={...record,historySeries:[{id:'community',metric:'price',frequency:'monthly',unit:'AED/sqft',sourceId:'sales',scope:'community_context',identityVerified:false,pointCount:24}]};
 const context=reconstructionCoverage(community);assert.equal(context.recordCovered,true);assert.equal(context.metrics.price.tier,3);assert.equal(context.metrics.price.subjectObserved,false);assert.equal(context.metrics.price.absoluteValueInferenceAllowed,false);
 const empty=reconstructionCoverage(record,{events:[event],exposures:[exposure]});assert.equal(empty.metrics.price.tier,6);assert.equal(empty.metrics.price.numericHistoryAvailable,false);assert.equal(empty.eventContextCount,1);
});
