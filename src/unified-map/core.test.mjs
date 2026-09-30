import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {derivePriceScenario, calculateROI} from '../smart-estimates/core.mjs';
import {periodEnd, sortNativePeriods, extendPriceScenario, timelineOptions, profitability, MAX_SCENARIO_YEARS} from './core.mjs';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) <= 1e-8 * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
function estimate() {
  return derivePriceScenario({emirate: 'Abu Dhabi', geography: 'Exact source area', segment: 'apartment', registration: 'Not specified by publisher', frequency: 'quarterly', points: []}, {
    asOf: '2026-09-30', anchor: {period: '2026H1', value: 1000, sourceId: 'test-source', unit: 'AED/sqft'},
  });
}
const assumptions = (horizonYears = 10, extra = {}) => ({
  price: 1000000, annualRent: 80000, buyCostsPct: 4, sellCostsPct: 2,
  operatingCostsPct: 1, vacancyPct: 5, rentGrowthPct: 0, incomeStartYear: 1,
  horizonYears, capitalPath: extendPriceScenario(estimate(), horizonYears).scenarios.reference.annual,
  ...extra,
});

test('period ends use real calendar boundaries without conflating native frequencies', () => {
  const pairs = [['2026Q1', '2026-03-31'], ['2026-Q2', '2026-06-30'], ['2026H1', '2026-06-30'], ['2026-H2', '2026-12-31'], ['2026FY', '2026-12-31'], ['2026-FY', '2026-12-31'], ['2026', '2026-12-31'], ['2024-02', '2024-02-29'], ['2025-02', '2025-02-28'], ['2026-09-30', '2026-09-30']];
  for (const [period, expected] of pairs) assert.equal(periodEnd(period), expected);
  for (const period of ['2026-02-30', '2026Q5', '2026H3', '2026-13', '2026-00', 'today', '', undefined]) assert.throws(() => periodEnd(period));
});

test('mixed native periods sort by end date; tied dates keep source order and gaps remain gaps', () => {
  const values = [
    {period: '2025FY', value: 1000}, {period: '2025H1', value: 900},
    {period: '2024Q4', value: 800}, {period: '2025-02', value: null, reason: 'source gap'},
    {period: '2025Q2', value: 950}, {period: '2025-06', value: 975},
  ];
  const before = structuredClone(values), sorted = sortNativePeriods(values);
  assert.deepEqual(sorted.map(point => point.period), ['2024Q4', '2025-02', '2025H1', '2025Q2', '2025-06', '2025FY']);
  assert.equal(sorted[1].value, null); assert.equal(sorted[1].reason, 'source gap');
  assert.deepEqual(values, before); assert.equal(sorted.length, values.length);
  assert.deepEqual(sortNativePeriods(['2025FY', '2025H1']), ['2025H1', '2025FY']);
});

test('timeline retains same-period observed and released and conditional evidence separately', () => {
  const nativePeriods = [
    {period: '2027H1', evidenceClass: 'released_projection', value: 1100, sourceId: 'released-v1'},
    {period: '2026H1', evidenceClass: 'advertised_price_benchmark', value: 1000, sourceId: 'source-v1'},
    {period: '2026H1', evidenceClass: 'advertised_price_benchmark', value: 1010, sourceId: 'revision-v2'},
    {period: '2026Q2', evidenceClass: 'registered_sale', value: 1200},
    {period: '2025FY', evidenceClass: 'advertised_price_benchmark', value: null},
  ];
  const before = structuredClone(nativePeriods), source = estimate(), options = timelineOptions({nativePeriods, estimates: [source], horizonYears: 10});
  const sameDay = options.filter(option => option.periodEnd === '2026-06-30');
  assert.equal(sameDay.length, 2); assert.deepEqual(sameDay.map(option => option.period), ['2026H1', '2026Q2']);
  assert.equal(sameDay[0].records.length, 2); assert.equal(sameDay[0].records[1].value, 1010);
  const future = options.filter(option => option.period === '2027H1');
  assert.equal(future.length, 2); assert.notEqual(future[0].id, future[1].id);
  assert.deepEqual(future.map(option => option.evidenceClass), ['released_projection', 'conditional_scenario']);
  assert.equal(future[1].records[0].observed, false); assert.equal(future[1].records[0].validatedForecast, false);
  assert.equal(options[0].records[0].value, null); assert.deepEqual(nativePeriods, before);
  assert.equal(options.filter(option => option.kind === 'scenario').length, 10);
  assert.ok(!options.some(option => option.period === '2026-01'));
});

test('unavailable and stale anchors remain unavailable unless explicitly modelled elsewhere', () => {
  const out = timelineOptions({nativePeriods: ['2023FY'], estimates: [{id: 'stale-row', estimate: null, anchor: {period: '2023FY', value: 500}}, {classification: 'unavailable', scenarios: {}}]});
  assert.equal(out.length, 1); assert.equal(out[0].evidenceClass, 'source_period');
  assert.throws(() => extendPriceScenario({classification: 'unavailable'}, 10));
});

test('10/20/30 extensions retain original annual rows and never refit or relabel observations', () => {
  const source = estimate(); source.scenarios.lower.annual[0].sourceNote = 'retained metadata';
  const before = structuredClone(source);
  for (const horizonYears of [10, 20, 30]) {
    const out = extendPriceScenario(source, horizonYears);
    assert.equal(out.classification, 'conditional_scenario'); assert.equal(out.validatedForecast, false); assert.equal(out.probabilityAssigned, false);
    assert.equal(out.extension.seedChanged, false); assert.equal(out.extension.dampingChanged, false);
    assert.equal(out.sourceEstimateId, source.id); assert.match(out.extension.limitation, /not probability intervals/);
    for (const name of ['lower', 'reference', 'higher']) {
      assert.equal(out.scenarios[name].annual.length, horizonYears);
      assert.deepEqual(out.scenarios[name].annual.slice(0, 10), source.scenarios[name].annual);
      assert.equal(out.scenarios[name].annual.at(-1).period, `${2026 + horizonYears}H1`);
      let ratio = 1;
      for (let year = 1; year <= horizonYears; year++) ratio *= 1 + source.scenarios[name].rateSeed * source.policy.annualDamping ** (year - 1);
      near(out.scenarios[name].annual.at(-1).ratio, ratio);
    }
    assert.equal(timelineOptions({estimates: [source], horizonYears}).filter(option => option.kind === 'scenario').length, horizonYears);
    assert.deepEqual(source, before);
  }
  assert.equal(MAX_SCENARIO_YEARS, 30);
});

test('flat and negative paths remain flat and negative across 10/20/30 horizons', () => {
  const source = estimate();
  for (const horizon of [10, 20, 30]) {
    const out = extendPriceScenario(source, horizon);
    assert.ok(out.scenarios.reference.annual.every(point => point.value === source.baseline.value));
    assert.ok(out.scenarios.lower.annual.every(point => point.annualGrowth < 0));
    assert.ok(out.scenarios.lower.annual.at(-1).value < source.baseline.value);
    assert.ok(out.scenarios.higher.annual.at(-1).value > source.baseline.value);
  }
});

test('no new horizon destroys retained source path; invalid policy/gaps are not repaired silently', () => {
  assert.equal(extendPriceScenario(estimate(), 1).scenarios.reference.annual.length, 10);
  assert.equal(extendPriceScenario(extendPriceScenario(estimate(), 30), 10).scenarios.reference.annual.length, 30);
  for (const horizon of [0, 31, 10.5, '20', null]) assert.throws(() => extendPriceScenario(estimate(), horizon));
  const changes = [
    source => {source.policy.annualDamping = null;},
    source => {source.policy.annualDamping = 1.1;},
    source => {source.scenarios.reference.rateSeed = undefined;},
    source => {source.scenarios.reference.annual.splice(3, 1);},
    source => {source.scenarios.reference.annual[3].value = 12345;},
    source => {source.baseline.periodEnd = '2026-01-01';},
  ];
  for (const change of changes) {const source = estimate(); change(source); assert.throws(() => extendPriceScenario(source, 20));}
});

test('all retained public snapshot scenarios can extend while every stored row remains unchanged', () => {
  const snapshot = JSON.parse(fs.readFileSync(new URL('../../data/smart-estimates-20260930.json', import.meta.url), 'utf8'));
  const before = JSON.stringify(snapshot);
  const rows = [...snapshot.sales, ...snapshot.asking], eligible = rows.filter(row => row.estimate?.classification === 'conditional_scenario');
  assert.equal(eligible.length, snapshot.counts.priceScenarioSets);
  for (const row of eligible) {
    const out = extendPriceScenario(row.estimate, 30);
    for (const name of Object.keys(row.estimate.scenarios)) {
      assert.deepEqual(out.scenarios[name].annual.slice(0, 10), row.estimate.scenarios[name].annual);
      assert.equal(out.scenarios[name].annual.length, 30);
    }
  }
  assert.equal(JSON.stringify(snapshot), before);
});

test('profitability delegates to audited cashflows for 10/20/30 with exact net costs', () => {
  for (const horizon of [10, 20, 30]) {
    const input = assumptions(horizon), before = structuredClone(input), out = profitability(input, calculateROI);
    assert.equal(out.classification, 'conditional_scenario'); assert.deepEqual(out, calculateROI(input));
    near(out.netProfit, horizon * (80000 * .95 - 10000) - 40000 - 20000);
    near(out.cumulativeReturnPct, out.netProfit / 1040000 * 100);
    assert.equal(out.cashflows.length, horizon + 1); assert.equal(out.annualizedReturnPct, null);
    assert.deepEqual(input, before);
  }
});

test('profitability never defaults missing rent or fees to zero', () => {
  for (const field of ['annualRent', 'buyCostsPct', 'sellCostsPct', 'operatingCostsPct', 'vacancyPct', 'rentGrowthPct']) {
    for (const missing of [undefined, null, '', '0', NaN, Infinity]) {
      const out = profitability(assumptions(10, {[field]: missing}), calculateROI);
      assert.equal(out.classification, 'unavailable'); assert.equal(out.netProfit, null); assert.equal(out.cumulativeReturnPct, null); assert.ok(out.missing.includes(field));
    }
  }
  const zero = profitability(assumptions(30, {annualRent: 0, buyCostsPct: 0, sellCostsPct: 0, operatingCostsPct: 0, vacancyPct: 0, rentGrowthPct: 0}), calculateROI);
  assert.equal(zero.classification, 'conditional_scenario'); near(zero.netProfit, 0);
  assert.equal(profitability(assumptions(), null).classification, 'unavailable');
  assert.equal(profitability(assumptions(10, {horizonYears: 31}), calculateROI).classification, 'unavailable');
});

test('30-year profitability permits loss and delayed income, rather than forcing appreciation', () => {
  const negativePath = extendPriceScenario(estimate(), 30).scenarios.lower.annual;
  const out = profitability(assumptions(30, {capitalPath: negativePath, annualRent: 0, incomeStartYear: 31}), calculateROI);
  assert.equal(out.classification, 'conditional_scenario'); assert.ok(out.netProfit < 0); assert.ok(out.cumulativeReturnPct < 0);
  assert.ok(out.cashflows.slice(1).every(flow => flow.rent === 0 && flow.operatingCosts === 10000));
  assert.equal(profitability(assumptions(10, {capitalPath: [{year: 1, ratio: 1}]}), calculateROI).classification, 'unavailable');
});
