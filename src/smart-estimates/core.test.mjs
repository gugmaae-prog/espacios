import test from 'node:test';
import assert from 'node:assert/strict';
import {derivePriceScenario,calculateROI,combineROI,stableId,quantile,DEFAULT_POLICY,HORIZON_YEARS} from './core.mjs';

const near=(actual,expected,epsilon=1e-8)=>assert.ok(Math.abs(actual-expected)<=epsilon,`${actual} != ${expected}`);
const asOf='2026-09-30';
function history(growth=.04,count=24){return {emirate:'Dubai',geography:'Exact source area',segment:'apartment',registration:'Ready',frequency:'quarterly',sourceId:'test-source',unit:'AED/sqft',points:Array.from({length:count},(_,i)=>{const ix=2020*4+2+i;return {period:`${Math.floor(ix/4)}Q${ix%4+1}`,value:1000*(1+growth)**(i/4),sampleCount:25};})};}
function assumptions(extra={}){return {price:1000000,annualRent:80000,buyCostsPct:4,sellCostsPct:2,operatingCostsPct:1,vacancyPct:5,rentGrowthPct:0,incomeStartYear:1,horizonYears:3,capitalPath:Array.from({length:10},(_,i)=>({year:i+1,ratio:1})),...extra};}
const anchor=(extra={})=>({value:1200,period:'2025FY',sourceId:'test-source',unit:'AED/sqft',...extra});

test('history calibration preserves inputs and provides dated, explicitly non-probabilistic paths',()=>{
 const source=history(),before=structuredClone(source),out=derivePriceScenario(source,{asOf});
 assert.deepEqual(source,before);assert.equal(out.basis,'historical_trend');assert.equal(out.classification,'conditional_scenario');
 assert.equal(out.calibration.eligibleQuarterCount,24);assert.equal(out.calibration.annualChanges.length,20);assert.equal(out.calibration.overlappingReturns,true);
 near(out.scenarios.reference.rateSeed,Math.sqrt(1.04)-1);assert.equal(out.baseline.period,'2026Q2');assert.equal(out.baseline.isCurrentObservation,false);
 assert.equal(out.scenarios.reference.annual.at(-1).period,'2036Q2');assert.equal(out.probabilityAssigned,false);assert.equal(out.validatedForecast,false);
 assert.deepEqual(out.horizons,[1,3,5,10]);assert.match(out.policy.interpretation,/not a confidence/);
});
test('flat and declining history never receives compulsory positive growth',()=>{
 const flat=derivePriceScenario(history(0),{asOf}),decline=derivePriceScenario(history(-.08),{asOf});
 for(const row of flat.scenarios.reference.annual)near(row.ratio,1);
 assert.ok(decline.scenarios.reference.rateSeed<0);assert.ok(decline.scenarios.reference.annual.at(-1).value<decline.baseline.value);
});
test('explicit caps and annual damping retain raw seeds for audit',()=>{
 const high=derivePriceScenario(history(1),{asOf}),low=derivePriceScenario(history(-.8),{asOf});
 near(high.scenarios.reference.rawSimpleRate,1);near(high.scenarios.reference.rateSeed,.1);assert.equal(high.scenarios.reference.capped,true);
 near(low.scenarios.reference.rateSeed,-.1);near(high.scenarios.reference.annual[1].annualGrowth,.08);assert.ok(low.scenarios.reference.rawSimpleRate<-.1);
});
test('low sample count or missing quarter breaks contiguous history instead of filling gaps',()=>{
 const source=history();source.points[10].sampleCount=19;const before=structuredClone(source),out=derivePriceScenario(source,{asOf});
 assert.equal(out.basis,'explicit_assumptions');assert.equal(out.calibration.eligibleQuarterCount,13);assert.deepEqual(source,before);
 assert.deepEqual(Object.values(out.scenarios).map(s=>s.rateSeed),[-.03,0,.03]);
 const gap=history();gap.points.splice(10,1);assert.equal(derivePriceScenario(gap,{asOf}).basis,'explicit_assumptions');
});
test('ineligible latest quarter never silently carries a previous eligible anchor forward',()=>{
 const source=history();source.points.at(-1).sampleCount=0;const out=derivePriceScenario(source,{asOf});
 assert.equal(out.classification,'unavailable');assert.equal(out.baseline,null);assert.deepEqual(out.scenarios,{});
});
test('sparse dated asking anchor receives explicit assumptions from its own date, not today',()=>{
 const source={...history(),points:[]},out=derivePriceScenario(source,{asOf,anchor:anchor()});
 assert.equal(out.basis,'explicit_assumptions');assert.equal(out.baseline.periodEnd,'2025-12-31');assert.equal(out.scenarios.reference.annual[0].period,'2026FY');
 assert.equal(out.scenarios.reference.annual.at(-1).period,'2035FY');near(out.scenarios.reference.annual.at(-1).value,1200);assert.equal(out.calibration.annualChanges.length,0);
});
test('stale observations retain old dates but cannot claim learned calibration',()=>{
 const out=derivePriceScenario(history(),{asOf:'2027-02-01'});assert.equal(out.basis,'explicit_assumptions');assert.equal(out.baseline.period,'2026Q2');assert.equal(out.calibration.observations.length,24);assert.match(out.calibration.reason,/older than 185/);
});
test('incomplete future source quarters are excluded without rewriting the source',()=>{
 const source=history();source.points.push({period:'2026Q3',value:2000,sampleCount:30});const out=derivePriceScenario(source,{asOf:'2026-09-20'});
 assert.equal(out.calibration.futurePeriodsExcluded,1);assert.equal(out.baseline.period,'2026Q2');assert.equal(source.points.length,25);
});
test('a foreign source, unit or native period cannot borrow local quarterly calibration',()=>{
 const source=history(),value=source.points.at(-1).value;
 for(const a of [anchor({value,period:'2026Q2',sourceId:'different'}),anchor({value,period:'2026H1'}),anchor({value,period:'2026Q2',unit:'AED/sqm'})])assert.equal(derivePriceScenario(source,{asOf,anchor:a}).basis,'explicit_assumptions');
 assert.throws(()=>derivePriceScenario(source,{asOf,anchor:anchor({geography:'Nearby area'})}),/does not match/);
});
test('invalid numeric history, mixed identity, duplicates and resampled frequencies are rejected',()=>{
 for(const value of [NaN,Infinity,-Infinity,'1000',undefined]){const source=history();source.points[0].value=value;assert.throws(()=>derivePriceScenario(source,{asOf}));}
 const mixed=history();mixed.points[0].geography='Nearby area';assert.throws(()=>derivePriceScenario(mixed,{asOf}),/Mixed geography/);
 const duplicate=history();duplicate.points.push({...duplicate.points[0]});assert.throws(()=>derivePriceScenario(duplicate,{asOf}),/Duplicate/);
 assert.throws(()=>derivePriceScenario({...history(),frequency:'monthly'},{asOf}),/native quarterly/);
 assert.throws(()=>derivePriceScenario(history(),{asOf,identity:{...history(),segment:'villa'}}),/does not match/);
});
test('native tuples preserve explicit nulls as unknown instead of zero',()=>{
 const source=history();source.points=source.points.map(p=>[p.period,p.sampleCount,p.value,null,null,null,null,null]);
 assert.equal(derivePriceScenario(source,{asOf}).basis,'historical_trend');source.points.at(-1)[2]=null;assert.equal(derivePriceScenario(source,{asOf}).baseline,null);
});
test('anchors require real positive finite values, complete native periods and consistent dates',()=>{
 for(const a of [anchor({value:0}),anchor({value:null}),anchor({value:NaN}),anchor({value:'1200'}),anchor({period:'2026Q4'}),anchor({period:'2026-02-30'}),anchor({sourceId:''}),anchor({periodEnd:'2025-11-30'})])assert.throws(()=>derivePriceScenario({...history(),points:[]},{asOf,anchor:a}));
 assert.throws(()=>derivePriceScenario(history(),{asOf:'2026-02-30'}));
});
test('ROI uses percentage point units, subtracts every cost and reports cumulative rather than annualized return',()=>{
 const out=calculateROI(assumptions());near(out.initialOutlay,1040000);near(out.cashflows[1].rent,76000);near(out.cashflows[1].operatingCosts,10000);near(out.cashflows[3].disposalCosts,20000);near(out.netProfit,138000);
 near(out.cumulativeReturnPct,100*138000/1040000);near(out.annual[0].netYieldOnEntryPct,6.6);assert.equal(out.annualizedReturnPct,null);assert.equal(out.cashflows[0].net,-1040000);
});
test('delayed income has no rent before operation but keeps holding costs and delays rent growth',()=>{
 const out=calculateROI(assumptions({incomeStartYear:3,horizonYears:5,rentGrowthPct:10}));
 assert.equal(out.cashflows[1].rent,0);assert.equal(out.cashflows[2].rent,0);near(out.cashflows[1].operatingCosts,10000);near(out.annual[2].scheduledRent,80000);near(out.annual[3].scheduledRent,88000);near(out.annual[4].scheduledRent,96800);
 const delayed=calculateROI(assumptions({incomeStartYear:11,horizonYears:10}));assert.ok(delayed.annual.every(row=>row.collectedRent===0));
});
test('higher vacancy/costs and negative capital growth reduce actual modeled returns',()=>{
 const baseline=calculateROI(assumptions());for(const changes of [{vacancyPct:20},{buyCostsPct:10},{sellCostsPct:10},{operatingCostsPct:5},{capitalPath:Array.from({length:10},(_,i)=>({year:i+1,ratio:.95**(i+1)}))}])assert.ok(calculateROI(assumptions(changes)).netProfit<baseline.netProfit);
});
test('explicit zero is valid while missing, string, nonfinite and out-of-range ROI assumptions fail',()=>{
 const zeros=calculateROI(assumptions({annualRent:0,buyCostsPct:0,sellCostsPct:0,operatingCostsPct:0,vacancyPct:0,rentGrowthPct:0}));near(zeros.netProfit,0);
 for(const key of ['price','annualRent','buyCostsPct','sellCostsPct','operatingCostsPct','vacancyPct','rentGrowthPct','incomeStartYear','horizonYears'])for(const value of [null,undefined,'','0',NaN,Infinity])assert.throws(()=>calculateROI(assumptions({[key]:value})),`${key}: ${value}`);
 for(const changes of [{price:0},{price:-1},{annualRent:-1},{vacancyPct:101},{rentGrowthPct:-101},{buyCostsPct:-1},{incomeStartYear:0},{incomeStartYear:1.5},{horizonYears:11}])assert.throws(()=>calculateROI(assumptions(changes)));
});
test('zero terminal value is valid and undefined denominator yield stays null; overflow fails',()=>{
 const out=calculateROI(assumptions({capitalPath:Array.from({length:10},(_,i)=>({year:i+1,ratio:0}))}));assert.equal(out.annual[0].netYieldOnEstimatedValuePct,null);assert.ok(out.netProfit<0);
 assert.throws(()=>calculateROI(assumptions({price:Number.MAX_VALUE})),/numeric range/);
});
test('capital paths reject omitted years, duplicates, negative values and numeric strings',()=>{
 for(const capitalPath of [[{year:3,ratio:1}],[{year:1,ratio:1},{year:1,ratio:1}],[{year:1,ratio:-1}],[{year:1,ratio:'1'}]])assert.throws(()=>calculateROI(assumptions({capitalPath})));
});
test('all horizons preserve inputs and normalized capital is labelled without claiming a unit price',()=>{
 for(const horizonYears of HORIZON_YEARS){const input=assumptions({horizonYears,normalizedCapital:1000000}),before=structuredClone(input),out=calculateROI(input);assert.deepEqual(input,before);assert.equal(out.cashflows.length,horizonYears+1);assert.equal(out.annual.length,horizonYears);assert.match(out.capitalLabel,/not a unit price/);}
 assert.throws(()=>calculateROI(assumptions({normalizedCapital:900000})),/must equal/);
});
test('portfolio mixes complete cashflows by capital allocation, never average percentage yields',()=>{
 const zero={buyCostsPct:0,sellCostsPct:0,operatingCostsPct:0,vacancyPct:0,horizonYears:1};
 const apt=calculateROI(assumptions({...zero,price:100,annualRent:10,buyCostsPct:10})),villa=calculateROI(assumptions({...zero,price:200,annualRent:10}));
 const out=combineROI([{weight:.5,result:apt},{weight:.5,result:villa}],{capital:1000});near(out.initialOutlay,1050);near(out.cashflows[1].rent,75);near(out.netProfit,25);near(out.cumulativeReturnPct,100*25/1050);near(out.annual[0].grossYieldOnEntryPct,7.5);assert.notEqual(out.cumulativeReturnPct,(apt.cumulativeReturnPct+villa.cumulativeReturnPct)/2);
});
test('combined allocations require consistent horizons, numeric weights and a full allocation',()=>{
 const result=calculateROI(assumptions());for(const weights of [[.4,.4],[-.1,1.1],['.5',.5],[null,1]])assert.throws(()=>combineROI(weights.map(weight=>({weight,result}))));
 assert.throws(()=>combineROI([{weight:.5,result},{weight:.5,result:calculateROI(assumptions({horizonYears:5}))}]),/same holding period/);
 near(combineROI([{weight:0,result},{weight:1,result}],{capital:1000000}).netProfit,result.netProfit);
});
test('stable identifiers are reproducible across key order and sensitive to genuine inputs',()=>{
 assert.equal(stableId({a:1,b:2}),stableId({b:2,a:1}));assert.notEqual(stableId({a:1}),stableId({a:2}));assert.equal(calculateROI(assumptions()).id,calculateROI(assumptions()).id);
 assert.throws(()=>stableId({a:undefined}));assert.throws(()=>stableId({a:NaN}));assert.equal(derivePriceScenario(history(),{asOf}).id,derivePriceScenario(history(),{asOf}).id);
});
test('quantiles and immutable policies have explicit reproducible definitions',()=>{
 near(quantile([4,0,2,6],.25),1.5);near(quantile([4,0,2,6],.5),3);near(quantile([4,0,2,6],.75),4.5);assert.throws(()=>quantile([],0));assert.throws(()=>quantile([NaN],.5));assert.ok(Object.isFrozen(DEFAULT_POLICY));assert.ok(Object.isFrozen(DEFAULT_POLICY.fallbackRates));
});
