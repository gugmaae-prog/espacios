import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {annualScenarios,validateScenarioAssumptions} from '../src/historical-intelligence/core.mjs';

const source=await fs.readFile(new URL('../src/historical-intelligence/app.js',import.meta.url),'utf8');
const context=vm.createContext({window:{},document:{querySelector:()=>null},URL,setInterval:()=>1,clearInterval(){}});
vm.runInContext(source,context);
const UI=context.window.EspaciosHistoricalUIHelpers;
const plain=value=>JSON.parse(JSON.stringify(value));

test('history selector resolves exact catalogue identity without borrowing a neighbouring or ambiguous record',()=>{
 const records=[{id:'project:one',type:'project',name:'One',emirate:'Dubai'},{id:'community:one',type:'community',name:'One',emirate:'Dubai'},{id:'community:ad-one',type:'community',name:'One',emirate:'Abu Dhabi'}];
 assert.equal(UI.exactRecord({id:'project:one'},records).id,'project:one');
 assert.equal(UI.exactRecord({kind:'community',name:'one',emirate:'Dubai'},records).id,'community:one');
 assert.equal(UI.exactRecord({kind:'project',name:'One'},records),null);
 assert.equal(UI.exactRecord({kind:'community',name:'Palm Jebel Ali',emirate:'Dubai'},records),null);
 assert.equal(UI.exactRecord({kind:'community',name:'One',emirate:'Dubai'},[...records,{id:'duplicate',type:'community',name:'One',emirate:'Dubai'}]),null);
});

test('native dates retain quarter, half-year and financial-year precision and reject invalid calendar dates',()=>{
 assert.equal(UI.periodTime('2025Q1'),Date.UTC(2025,3,0));
 assert.equal(UI.periodTime('2025-Q1'),UI.periodTime('2025Q1'));
 assert.equal(UI.periodTime('2025H1'),Date.UTC(2025,6,0));
 assert.equal(UI.periodTime('2025FY'),Date.UTC(2025,11,31));
 assert.equal(UI.periodTime('2024-02-29'),Date.UTC(2024,1,29));
 for(const invalid of ['2025-02-29','2026-02-31','2025Q5','2025-00','not dated'])assert.equal(UI.periodTime(invalid),null);
});

test('raw native tuples survive normalization while chart eligibility comes from validated same-series evidence',()=>{
 const data={historySeries:[{id:'sales-villa',metric:'sale_statistics',frequency:'quarterly',columns:['period','sampleCount','value'],points:[['2025Q1',5,1500],['2025Q2',22,1600],['2025Q3',30,1700]]},{id:'different',metric:'rent',points:[{period:'2025',value:100000}]}],validatedObservations:[{seriesId:'sales-villa',period:'2025Q1',metric:'price',value:1500,displayEligible:false,sparse:true},{seriesId:'sales-villa',period:'2025Q2',metric:'price',value:1600,displayEligible:true}]};
 const rows=UI.seriesRows(data,'price');assert.equal(rows.length,1);assert.equal(rows[0].points[0].value,1500);assert.equal(rows[0].points[0].displayEligible,false);assert.equal(rows[0].points[1].displayEligible,true);assert.equal(rows[0].points[2].displayEligible,false);
 assert.deepEqual(data.historySeries[0].points[0],['2025Q1',5,1500]);
 const segments=UI.lineSegments(rows[0].points,x=>x,x=>x,'quarterly');assert.equal(segments.length,1);assert.equal(segments[0].length,1);
});

test('native lines break at withheld values and absent native periods; zero remains a valid volume',()=>{
 const points=[{period:'2025Q1',value:100},{period:'2025Q2',value:null},{period:'2025Q3',value:120},{period:'2026Q1',value:130},{period:'2026Q2',value:0}];
 const segments=UI.lineSegments(points,x=>x,x=>x,'quarterly');
 assert.deepEqual(plain(segments.map(segment=>segment.length)),[1,1,2]);assert.equal(UI.pointValue({value:0}),0);assert.equal(UI.pointValue({value:'100'}),null);
});

test('volume exposes validated eligible sales in each price cohort without a median sample gate or invented market totals',()=>{
 const data={historySeries:[{id:'villa-offplan',metric:'price',frequency:'quarterly',scope:'area_context',segment:'villa',registration:'Off-Plan',columns:['period','sampleCount','value'],points:[['2026Q1',1,1500],['2026Q2',0,null]]}],validatedObservations:[{seriesId:'villa-offplan',period:'2026Q1',metric:'price',value:1500,displayEligible:false,sparse:true},{seriesId:'villa-offplan',period:'2026Q1',metric:'volume',value:1,displayEligible:true,sparse:false},{seriesId:'villa-offplan',period:'2026Q2',metric:'volume',value:0,displayEligible:true,sparse:false}]};
 const volume=UI.seriesRows(data,'volume');assert.equal(volume.length,1);assert.match(volume[0].label,/Eligible sales in price cohort/);assert.equal(volume[0].unit,'eligible sales count');assert.equal(volume[0].id,'villa-offplan');assert.equal(volume[0].scope,'area_context');assert.deepEqual(plain(volume[0].points.map(p=>p.value)),[1,0]);assert.ok(volume[0].points.every(p=>p.displayEligible));assert.equal(UI.seriesRows(data,'price')[0].points[0].displayEligible,false);
});

test('unavailable annual slots stay null, including 2080, instead of extending another year',()=>{
 const data={scenarios:{metrics:{price:{paths:{base:[{year:2027,value:100,status:'conditional'}]}}}}};
 assert.equal(UI.scenarioPoint(data,'price','base',2027).value,100);assert.equal(UI.scenarioPoint(data,'price','base',2080).value,null);assert.equal(UI.scenarioPoint(data,'rent','upside',2080).status,'unavailable');
});

test('annual overrides have explicit values, cover all 54 years and preserve year-specific overrides',()=>{
 assert.deepEqual(plain(UI.buildAnnualInputs({},{})),{});
 const annual=plain(UI.buildAnnualInputs({annualOperatingCostsAED:100},{inflationPct:'0',costGrowthPct:'2','delay.downside':'3'},'{"common":[{"year":2027,"inflationPct":4}],"downside":[{"year":2030,"deliveryDelayYears":2,"priceGrowthPct":-5}]}'));
 assert.equal(annual.common.length,54);assert.equal(annual.common[0].year,2027);assert.equal(annual.common.at(-1).year,2080);assert.equal(annual.common[0].inflationPct,4);assert.equal(annual.common[1].inflationPct,0);assert.equal(annual.common[0].operatingCostsAED,102);assert.equal(annual.downside.length,54);assert.equal(annual.downside.find(row=>row.year===2030).deliveryDelayYears,2);assert.equal(annual.downside.find(row=>row.year===2030).priceGrowthPct,-5);
 for(const text of ['[]','{"base":[{"year":2027},{"year":2027}]}','{"base":[{"year":2081}]}'])assert.throws(()=>UI.buildAnnualInputs({}, {}, text));
 assert.throws(()=>UI.buildAnnualInputs({}, {costGrowthPct:'2'}),/explicit 2026 operating cost/);
});

test('UI-generated annual assumptions run through the same validated engine without changing source history',()=>{
 const record={id:'project:test',name:'Test',historySeries:[]};const before=JSON.stringify(record);
 const assumptions={priceAED:1000000,annualRentAED:50000,occupancyYear:2028,vacancyPct:0,annualOperatingCostsAED:1000,acquisitionCostsPct:0,disposalCostsPct:0,annualPriceGrowthPct:{downside:-1,base:0,upside:1},annualRentGrowthPct:{downside:0,base:0,upside:0}};
 assumptions.annualInputs=plain(UI.buildAnnualInputs(assumptions,{inflationPct:'2','delay.downside':'2'}));
 validateScenarioAssumptions(assumptions);const result=annualScenarios(record,{asOf:'2026-10-03',sources:[],userAssumptions:assumptions});
 assert.equal(result.classification,'user_assumption_scenario');assert.equal(result.validatedForecast,false);assert.equal(result.metrics.price.paths.base.length,54);assert.equal(result.metrics.price.paths.base.at(-1).year,2080);assert.equal(result.metrics.price.paths.base.at(-1).value,1000000);assert.ok(result.metrics.price.paths.base.at(-1).realValue<1000000);assert.equal(result.metrics.rent.paths.downside.find(p=>p.year===2029).value,0);assert.equal(result.metrics.rent.paths.downside.find(p=>p.year===2030).value,50000);assert.equal(JSON.stringify(record),before);
});

test('source links allow web URLs and reject executable or local URL schemes',()=>{
 assert.equal(UI.safeURL('https://www.rta.ae/news'),'https://www.rta.ae/news');
 for(const unsafe of ['javascript:alert(1)','data:text/html,test','file:///private/key','/relative-source'])assert.equal(UI.safeURL(unsafe),null);
});

test('dense event markers cluster without overlapping 44px targets and retain every source event',()=>{
 const rows=Array.from({length:27},(_,index)=>({event:{id:'event-'+index},index,time:index<26?index:1000}));
 const groups=UI.clusterEventMarkers(rows,0,1000,280);
 assert.equal(groups.reduce((sum,group)=>sum+group.rows.length,0),27);assert.ok(groups.length<27);
 for(let index=1;index<groups.length;index++)assert.ok(groups[index].position-groups[index-1].position>=48);
 assert.equal(new Set(groups.flatMap(group=>group.rows.map(row=>row.event.id))).size,27);
});

test('verified planned handovers retain stage, milestone and geographic scope in lifecycle cards',()=>{
 const row={kind:'target_handover',label:'Phase handover',date:{start:'2027Q2',precision:'quarter'},scope:'community_context',eventStatus:'planned',status:'verified',sourceIds:['developer']};
 const html=UI.lifecycleHTML({lifecycle:[row],sources:[{id:'developer',url:'https://example.com/project',publisher:'Developer'}]});
 for(const label of ['Milestone: target handover','Stage: planned','Scope: community context','Verified source','2027Q2','quarter precision'])assert.ok(html.includes(label),label);
 assert.ok(html.includes('https://example.com/project'));
 assert.ok(UI.lifecycleLabels({kind:'target_handover',status:'verified'}).includes('Stage: planned'));
 assert.ok(UI.lifecycleLabels({kind:'completion',status:'reported',eventStatus:'actual',scope:'subject'}).includes('Stage: actual'));
 assert.ok(UI.lifecycleLabels({kind:'completion',status:'verified'}).includes('Stage: not established'));
});

test('per-item evidence disclosure distinguishes presence from complete history and escapes source text',()=>{
 const html=UI.itemCoverageHTML({record:{researchStatus:{itemCoverage:{registered_sale_history:{status:'present',nativePointCount:2,reason:'Sparse <evidence>',sourceIds:['source']},complete_registered_sale_history:{status:'unestablished',reason:'Applicable periods unknown',sourceIds:[]}}}},sources:[{id:'source',url:'https://example.org/verified',publisher:'Authority'}]});
 assert.ok(html.includes('Evidence and remaining gaps'));
 assert.ok(html.includes('Complete lifetime price and rent histories require every applicable period'));
 assert.ok(html.includes('2 retained native points'));assert.ok(html.includes('Unestablished')||html.includes('unestablished'));
 assert.ok(html.includes('Sparse &lt;evidence&gt;'));assert.ok(!html.includes('Sparse <evidence>'));
 assert.ok(html.includes('https://example.org/verified'));
});

test('unresolved retained provenance IDs remain explicit non-link labels beside their registered upstream source',()=>{
 const html=UI.itemCoverageHTML({record:{researchStatus:{itemCoverage:{handover_targets:{status:'present',reason:'Reported target; actual completion is not established',sourceIds:['catalogue-core','unresolved<&>','upstream']}}}},sources:[{id:'upstream',publisher:'Upstream source',url:'https://example.org/project'}]});
 assert.match(html,/Unresolved retained source reference: catalogue-core/);
 assert.ok(html.includes('Unresolved retained source reference: unresolved&lt;&amp;&gt;'));
 assert.match(html,/No source URL is verified for this reference/);
 assert.ok(html.includes('https://example.org/project'));assert.equal((html.match(/<a /g)||[]).length,1);
 assert.ok(!html.includes('href="catalogue-core"'));assert.ok(!html.includes('unresolved<&>'));
});

test('selected cohort paging retains every native point and exact owner without replacing unrelated evidence',async()=>{
 const series={id:'owned',sourceId:'register',scope:'subject',identityVerified:true,subjectRecordId:'project:one',identitySourceIds:['registry','register'],metric:'price',frequency:'monthly',unit:'AED/sqft',pointCount:5,points:[],partition:{key:'immutable'}};
 const other={id:'context',scope:'community_context',identityVerified:false,pointCount:3,points:[],partition:{key:'other'}};
 const history={version:'test',asOf:'2026-10-05',record:{id:'project:one',researchStatus:{itemCoverage:{complete_registered_sale_history:{status:'unestablished'}}}},historySeries:[series,other],validatedObservations:[{seriesId:'context',period:'2025',value:0}],sources:[{id:'registry'}],historyPagination:{totalSeries:2,totalPoints:8,loadedSeries:0,loadedPoints:0,complete:false}};
 const before=JSON.stringify(history),cursors=[],native=[['2025-01',10],['2025-02',11],['2025-03',12],['2025-04',13],['2025-05',14]];
 const loaded=await UI.loadCompleteSeriesPages(history,'owned',async cursor=>{cursors.push(cursor);const points=native.slice(cursor,cursor+2);return{version:'test',asOf:'2026-10-05',record:{id:'project:one'},historySeries:[{...series,points,partitionLoaded:true,pointsPartial:cursor+2<5,nativePointOffset:cursor}],validatedObservations:points.map(point=>({seriesId:'owned',period:point[0],value:point[1],displayEligible:true})),sources:[{id:'register'}],historyPagination:{nextPointCursor:cursor+2<5?cursor+2:null}};});
 assert.deepEqual(cursors,[0,2,4]);assert.deepEqual(plain(loaded.series.points),native);assert.equal(loaded.series.partitionLoaded,true);assert.equal(loaded.series.pointsPartial,false);assert.equal(loaded.validatedObservations.length,5);
 const merged=UI.mergeLoadedSeries(history,loaded);assert.equal(merged.historySeries[0].subjectRecordId,'project:one');assert.equal(merged.historySeries[1].scope,'community_context');assert.equal(merged.historyPagination.loadedPoints,5);assert.equal(merged.historyPagination.complete,false);assert.equal(merged.record.researchStatus.itemCoverage.complete_registered_sale_history.status,'unestablished');assert.equal(merged.validatedObservations.length,6);assert.equal(JSON.stringify(history),before);
 const text=UI.historyRetrievalHTML(merged,loaded.series);assert.match(text,/Retrieved 5 of 8 stored native points/);assert.match(text,/Retrieval completeness and complete lifetime financial coverage are separate/);assert.match(text,/Selected source cohort: 5 of 5/);
});

test('native paging rejects foreign identities, skipped points and a repeated cursor instead of manufacturing completeness',async()=>{
 const series={id:'exact',sourceId:'official',scope:'subject',identityVerified:true,subjectRecordId:'project:one',metric:'price',frequency:'monthly',unit:'AED/sqft',pointCount:3,identitySourceIds:['proof'],points:[],partition:{key:'immutable'}};
 const history={version:'test',asOf:'2026-10-05',record:{id:'project:one'},historySeries:[series],sources:[]};
 const page={version:'test',asOf:'2026-10-05',record:{id:'project:one'},historySeries:[{...series,points:[['2025-01',1]],nativePointOffset:0,partitionLoaded:true}],historyPagination:{nextPointCursor:1}};
 await assert.rejects(()=>UI.loadCompleteSeriesPages(history,'exact',async()=>({...page,record:{id:'project:other'}})),/another record/);
 await assert.rejects(()=>UI.loadCompleteSeriesPages(history,'exact',async()=>({...page,historySeries:[{...page.historySeries[0],subjectRecordId:'project:other'}]})),/cohort identity/);
 await assert.rejects(()=>UI.loadCompleteSeriesPages(history,'exact',async()=>({...page,historyPagination:{nextPointCursor:0}})),/cursor/);
 await assert.rejects(()=>UI.loadCompleteSeriesPages(history,'exact',async()=>({...page,historyPagination:{nextPointCursor:2}})),/cursor/);
 await assert.rejects(()=>UI.loadCompleteSeriesPages(history,'exact',async()=>({...page,historyPagination:{nextPointCursor:null}})),/remains incomplete/);
});
