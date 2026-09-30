/** Deterministic, conditional scenarios. No source observations are rewritten. */
export const ESTIMATE_VERSION = 'espacios-smart-estimates-v1';
export const HORIZON_YEARS = Object.freeze([1, 3, 5, 10]);
export const DEFAULT_POLICY = Object.freeze({
  minimumQuarterObservations: 20, minimumSalesPerQuarter: 20,
  maxAgeDays: 185, shrink: 0.5, rateFloor: -0.10, rateCeiling: 0.10,
  annualDamping: 0.8, fallbackRates: Object.freeze([-0.03, 0, 0.03]),
});
const IDENTITY_FIELDS = ['emirate', 'geography', 'segment', 'registration'];
const DAY = 86400000;
const isNumber = x => typeof x === 'number' && Number.isFinite(x);
const clone = x => JSON.parse(JSON.stringify(x));
function number(value, name, min = -Infinity, max = Infinity) {
  if (!isNumber(value) || value < min || value > max) throw new TypeError(`${name} must be a finite number between ${min} and ${max}.`);
  return value;
}
function integer(value, name, min, max) {
  number(value, name, min, max);
  if (!Number.isInteger(value)) throw new TypeError(`${name} must be a whole number.`);
  return value;
}
function text(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} is required.`);
  return value.trim();
}
function date(value, name) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) || !Number.isFinite(Date.parse(value))) throw new TypeError(`${name} must be an ISO date.`);
  const day = value.slice(0, 10), parsed = new Date(`${day}T00:00:00Z`);
  if (parsed.toISOString().slice(0, 10) !== day) throw new TypeError(`${name} is not a calendar date.`);
  return Date.parse(value);
}
function quarter(period) {
  const m = /^(\d{4})-?Q([1-4])$/.exec(String(period));
  if (!m) throw new TypeError('Quarter must use YYYYQn or YYYY-Qn.');
  const year = +m[1], q = +m[2];
  return {period: `${year}Q${q}`, index: year * 4 + q - 1, end: new Date(Date.UTC(year, q * 3, 0)).toISOString().slice(0, 10)};
}
function periodEnd(period) {
  if (/^\d{4}-?Q[1-4]$/.test(period)) return quarter(period).end;
  let m = /^(\d{4})H([12])$/.exec(period);
  if (m) return `${m[1]}-${m[2] === '1' ? '06-30' : '12-31'}`;
  m = /^(\d{4})(?:FY)?$/.exec(period);
  if (m) return `${m[1]}-12-31`;
  m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period);
  if (m) return new Date(Date.UTC(+m[1], +m[2], 0)).toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) { date(period, 'anchor period'); return period; }
  throw new TypeError('Use a source-native quarter, month, FY, half-year, year, or ISO date.');
}
function addYearsToPeriod(period, years) {
  return String(Number(period.slice(0, 4)) + years).padStart(4, '0') + period.slice(4);
}
function canonical(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') { number(value, 'hash number'); return JSON.stringify(value); }
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  throw new TypeError('Identifiers require JSON values without undefined or non-finite numbers.');
}
/** Stable non-cryptographic identifier, not an authentication or integrity digest. */
export function stableId(value) {
  const input = canonical(value); let a = 0x811c9dc5, b = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) { a = Math.imul(a ^ input.charCodeAt(i), 0x01000193); b = Math.imul(b ^ input.charCodeAt(i), 0x85ebca6b); }
  return 'se-' + (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}
export function quantile(values, p) {
  number(p, 'quantile probability', 0, 1);
  if (!Array.isArray(values) || !values.length) throw new TypeError('Quantile needs values.');
  const v = values.map(x => number(x, 'quantile value')).sort((a, b) => a - b), position = (v.length - 1) * p, lo = Math.floor(position), hi = Math.ceil(position);
  return v[lo] + (v[hi] - v[lo]) * (position - lo);
}
function validateAnchor(anchor, asOf) {
  if (!anchor) return null;
  number(anchor.value, 'anchor value', Number.MIN_VALUE);
  const period = text(anchor.period, 'anchor period'), end = periodEnd(period);
  if (anchor.periodEnd !== undefined && anchor.periodEnd !== end) throw new TypeError('Anchor periodEnd disagrees with its native period.');
  if (date(end, 'anchor periodEnd') > asOf) throw new TypeError('Anchor period is not yet complete at asOf.');
  return {...clone(anchor), period, periodEnd: end, sourceId: text(anchor.sourceId, 'anchor sourceId'), unit: text(anchor.unit, 'anchor unit'), observed: true};
}
/** One homogeneous quarterly source basket; sparse history remains visible outside this scenario. */
export function derivePriceScenario(history, {asOf, anchor = null, identity = null} = {}) {
  const now = date(asOf, 'asOf');
  if (!history || typeof history !== 'object' || !Array.isArray(history.points)) throw new TypeError('history.points is required.');
  const basket = Object.fromEntries(IDENTITY_FIELDS.map(k => [k, text(identity?.[k] ?? history[k], k)]));
  for (const k of IDENTITY_FIELDS) if (history[k] !== undefined && history[k] !== basket[k]) throw new TypeError(`History ${k} does not match the selected basket.`);
  if (!['quarter', 'quarterly'].includes(history.frequency)) throw new TypeError('Historical calibration requires native quarterly medians.');
  const rows = history.points.map(p => {
    const native = Array.isArray(p), r = native ? {period: p[0], sampleCount: p[1], value: p[2]} : p;
    if (!r || typeof r !== 'object') throw new TypeError('Invalid historical point.');
    for (const k of IDENTITY_FIELDS) if (r[k] !== undefined && r[k] !== basket[k]) throw new TypeError(`Mixed ${k} observations are not comparable.`);
    const q = quarter(r.period);
    // Explicit nulls remain source gaps; strings/NaN/infinities never become numbers.
    if (r.value !== null && !isNumber(r.value)) throw new TypeError('Historical value must be numeric or null.');
    if (r.sampleCount !== null && (!isNumber(r.sampleCount) || !Number.isInteger(r.sampleCount) || r.sampleCount < 0)) throw new TypeError('Sample count must be a non-negative integer or null.');
    return {...q, value: r.value, sampleCount: r.sampleCount};
  }).sort((a, b) => a.index - b.index);
  if (new Set(rows.map(r => r.index)).size !== rows.length) throw new TypeError('Duplicate source quarter.');
  const complete = rows.filter(r => date(r.end, 'quarter end') <= now), futurePeriodsExcluded = rows.length - complete.length;
  let suffix = [];
  for (const r of complete) {
    if (!(r.value > 0) || r.sampleCount === null || r.sampleCount < DEFAULT_POLICY.minimumSalesPerQuarter) { suffix = []; continue; }
    if (suffix.length && r.index !== suffix.at(-1).index + 1) suffix = [];
    suffix.push(r);
  }
  const last = complete.at(-1), latestEligible = last && suffix.at(-1)?.index === last.index ? last : null;
  const ageDays = latestEligible ? (now - date(latestEligible.end, 'quarter end')) / DAY : null;
  const enough = suffix.length >= DEFAULT_POLICY.minimumQuarterObservations;
  const fresh = ageDays !== null && ageDays <= DEFAULT_POLICY.maxAgeDays;
  let baseline = validateAnchor(anchor, now);
  for (const k of IDENTITY_FIELDS) if (baseline?.[k] !== undefined && baseline[k] !== basket[k]) throw new TypeError(`Anchor ${k} does not match the selected basket.`);
  const sourceId = typeof history.sourceId === 'string' && history.sourceId.trim() ? history.sourceId.trim() : null;
  if (!baseline && latestEligible && sourceId) baseline = validateAnchor({value: latestEligible.value, period: latestEligible.period, sourceId, unit: history.unit || 'AED/sqft'}, now);
  const sourceMatches = !baseline || (latestEligible && /^\d{4}-?Q[1-4]$/.test(baseline.period) && quarter(baseline.period).period === latestEligible.period && baseline.value === latestEligible.value && baseline.periodEnd === latestEligible.end && baseline.sourceId === sourceId && baseline.unit === (history.unit || 'AED/sqft'));
  const learned = enough && fresh && !!latestEligible && !!sourceId && sourceMatches;
  const reason = learned ? null : !latestEligible ? 'Latest complete quarter has insufficient local price evidence.' : !enough ? 'Fewer than 20 contiguous eligible quarters.' : !fresh ? 'Latest quarterly evidence is older than 185 days.' : !sourceMatches ? 'Explicit anchor is a different source or period; historical calibration is not transferred.' : 'Historical source identity is missing.';
  const observations = suffix.map(r => ({period: r.period, value: r.value, sampleCount: r.sampleCount}));
  const annualChanges = [];
  if (learned) for (let i = 4; i < suffix.length; i++) annualChanges.push({from: suffix[i - 4].period, to: suffix[i].period, logChange: Math.log(suffix[i].value / suffix[i - 4].value)});
  const rawSeeds = learned ? [0.25, 0.5, 0.75].map(p => quantile(annualChanges.map(x => x.logChange), p)) : DEFAULT_POLICY.fallbackRates.map(Math.log1p);
  const calibration = {eligibleQuarterCount: suffix.length, samplePeriods: observations.map(r => r.period), observations, annualChanges, overlappingReturns: learned, rawLogRateSeeds: rawSeeds, futurePeriodsExcluded, excludedHistoricalPeriods: complete.length - suffix.length, reason};
  const policy = {...DEFAULT_POLICY, fallbackRates: [...DEFAULT_POLICY.fallbackRates], rateConvention: 'Historical log-rate quantiles are shrunk, converted to simple annual rates, then capped. The simple rate is multiplied by annualDamping^(year-1).', interpretation: 'Scenario spread is not a confidence or prediction interval. Shrink, cap, damping and fallback seeds are explicit policy assumptions, not fitted facts.'};
  if (!baseline) return {id: stableId({version: ESTIMATE_VERSION, asOf, basket, calibration}), version: ESTIMATE_VERSION, classification: 'unavailable', identity: basket, baseline: null, calibration, policy, scenarios: {}, reason: 'A positive dated local source anchor is required; observations are not filled or substituted.'};
  baseline.ageDays = (now - date(baseline.periodEnd, 'baseline end')) / DAY;
  baseline.isCurrentObservation = false;
  const scenarios = {};
  for (const [i, name] of ['lower', 'reference', 'higher'].entries()) {
    const rawSimpleRate = Math.expm1(rawSeeds[i]);
    const beforeCap = learned ? Math.expm1(rawSeeds[i] * policy.shrink) : rawSimpleRate;
    const rateSeed = learned ? Math.max(policy.rateFloor, Math.min(policy.rateCeiling, beforeCap)) : DEFAULT_POLICY.fallbackRates[i];
    let ratio = 1; const annual = [];
    for (let year = 1; year <= 10; year++) {
      const annualGrowth = rateSeed * policy.annualDamping ** (year - 1); ratio *= 1 + annualGrowth;
      const value = baseline.value * ratio;
      if (!Number.isFinite(value)) throw new RangeError('Scenario exceeds numeric range.');
      annual.push({year, period: addYearsToPeriod(baseline.period, year), value, ratio, annualGrowth});
    }
    scenarios[name] = {name, rawLogRateSeed: rawSeeds[i], rawSimpleRate, rateBeforeCap: beforeCap, rateSeed, capped: learned && rateSeed !== beforeCap, annual};
  }
  const result = {version: ESTIMATE_VERSION, classification: 'conditional_scenario', basis: learned ? 'historical_trend' : 'explicit_assumptions', asOf, identity: basket, baseline, calibration, policy, horizons: [...HORIZON_YEARS], scenarios, probabilityAssigned: false, validatedForecast: false, methodology: 'Same-basket source medians can change with transaction mix. Scenarios start at the dated source anchor, not an invented present value. No catalyst uplift, nearby-price substitution or historical interpolation.'};
  return {id: stableId(result), ...result};
}

/** Nominal, all-cash, before-tax; rent input is the rent at the first operating year. */
export function calculateROI(input) {
  if (!input || typeof input !== 'object') throw new TypeError('ROI assumptions are required.');
  const price = number(input.price, 'price', Number.MIN_VALUE), annualRent = number(input.annualRent, 'annualRent', 0);
  const buyCostsPct = number(input.buyCostsPct, 'buyCostsPct', 0, 100), sellCostsPct = number(input.sellCostsPct, 'sellCostsPct', 0, 100);
  const operatingCostsPct = number(input.operatingCostsPct, 'operatingCostsPct', 0, 100), vacancyPct = number(input.vacancyPct, 'vacancyPct', 0, 100), rentGrowthPct = number(input.rentGrowthPct, 'rentGrowthPct', -100, 100);
  const horizonYears = integer(input.horizonYears, 'horizonYears', 1, 30), incomeStartYear = integer(input.incomeStartYear, 'incomeStartYear', 1, 31);
  if (!Array.isArray(input.capitalPath)) throw new TypeError('An explicit capitalPath is required.');
  const path = input.capitalPath.map(p => ({year: integer(p?.year, 'capital year', 1, 30), ratio: number(p?.ratio, 'capital ratio', 0)})).sort((a, b) => a.year - b.year);
  if (new Set(path.map(p => p.year)).size !== path.length) throw new TypeError('Duplicate capital year.');
  for (let y = 1; y <= horizonYears; y++) if (!path.some(p => p.year === y)) throw new TypeError('Capital path must contain each holding-period year.');
  const normalizedCapital = input.normalizedCapital === undefined ? null : number(input.normalizedCapital, 'normalizedCapital', Number.MIN_VALUE);
  if (normalizedCapital !== null && normalizedCapital !== price) throw new TypeError('Normalized capital must equal entry capital; it is not a unit price.');
  const assumptions = {price, annualRent, buyCostsPct, sellCostsPct, operatingCostsPct, vacancyPct, rentGrowthPct, incomeStartYear, horizonYears, capitalPath: path, ...(normalizedCapital === null ? {} : {normalizedCapital})};
  const initialOutlay = price * (1 + buyCostsPct / 100), flows = [{year: 0, rent: 0, operatingCosts: 0, acquisition: initialOutlay, exitValue: 0, disposalCosts: 0, net: -initialOutlay}], annual = [];
  for (let year = 1; year <= horizonYears; year++) {
    const scheduledRent = year < incomeStartYear ? 0 : annualRent * (1 + rentGrowthPct / 100) ** (year - incomeStartYear);
    const rent = scheduledRent * (1 - vacancyPct / 100), operatingCosts = price * operatingCostsPct / 100, netIncome = rent - operatingCosts;
    const propertyValue = price * path.find(p => p.year === year).ratio;
    const exitValue = year === horizonYears ? propertyValue : 0, disposalCosts = year === horizonYears ? propertyValue * sellCostsPct / 100 : 0;
    flows.push({year, rent, operatingCosts, acquisition: 0, exitValue, disposalCosts, net: netIncome + exitValue - disposalCosts});
    annual.push({year, propertyValue, scheduledRent, collectedRent: rent, netIncome, grossYieldOnEntryPct: 100 * scheduledRent / price, netYieldOnEntryPct: 100 * netIncome / price, netYieldOnEstimatedValuePct: propertyValue > 0 ? 100 * netIncome / propertyValue : null});
  }
  const netProfit = flows.reduce((n, f) => n + f.net, 0), cumulativeReturnPct = 100 * netProfit / initialOutlay;
  if (![initialOutlay, netProfit, cumulativeReturnPct, ...flows.flatMap(f => Object.values(f)), ...annual.flatMap(a => Object.values(a).filter(v => v !== null))].every(Number.isFinite)) throw new RangeError('ROI scenario exceeds numeric range.');
  const result = {version: ESTIMATE_VERSION, classification: 'conditional_scenario', basis: 'explicit_cash_flow_assumptions', assumptions, capitalLabel: normalizedCapital === null ? 'Entered acquisition price' : `Illustrative normalized capital: AED ${normalizedCapital}; not a unit price`, initialOutlay, cashflows: flows, annual, netProfit, cumulativeReturnPct, annualizedReturnPct: null, annualizedReturnReason: 'Holding-period return is not an annualized yield; no IRR is asserted.', incomeConvention: 'Annual rent is entered at the first income year; growth begins the following year. Operating costs apply every holding year, including pre-income years.', limitations: 'Nominal all-cash scenario before tax. Financing, staged payments and individual property characteristics are not modelled. Every cost or vacancy zero must be explicitly supplied.'};
  return {id: stableId(result), ...result};
}

/** Capital allocations scale complete cashflows; yields are recomputed from totals. */
export function combineROI(legs, {capital = 1000000} = {}) {
  number(capital, 'combined capital', Number.MIN_VALUE);
  if (!Array.isArray(legs) || legs.length < 2) throw new TypeError('Combine at least two independently specified legs.');
  const validated = legs.map(leg => ({weight: number(leg.weight, 'capital weight', 0, 1), result: calculateROI(leg.result?.assumptions)}));
  if (Math.abs(validated.reduce((n, l) => n + l.weight, 0) - 1) > 1e-10) throw new TypeError('Capital allocation weights must sum to one.');
  const horizonYears = validated[0].result.assumptions.horizonYears;
  if (validated.some(l => l.result.assumptions.horizonYears !== horizonYears)) throw new TypeError('Combined legs must use the same holding period.');
  const flowFields = ['rent', 'operatingCosts', 'acquisition', 'exitValue', 'disposalCosts', 'net'];
  const cashflows = Array.from({length: horizonYears + 1}, (_, year) => ({year, ...Object.fromEntries(flowFields.map(field => [field, validated.reduce((n, l) => n + l.result.cashflows[year][field] * capital * l.weight / l.result.assumptions.price, 0)]))}));
  const annual = Array.from({length: horizonYears}, (_, i) => {
    const sums = Object.fromEntries(['propertyValue', 'scheduledRent', 'collectedRent', 'netIncome'].map(field => [field, validated.reduce((n, l) => n + l.result.annual[i][field] * capital * l.weight / l.result.assumptions.price, 0)]));
    return {year: i + 1, ...sums, grossYieldOnEntryPct: 100 * sums.scheduledRent / capital, netYieldOnEntryPct: 100 * sums.netIncome / capital, netYieldOnEstimatedValuePct: sums.propertyValue > 0 ? 100 * sums.netIncome / sums.propertyValue : null};
  });
  const initialOutlay = cashflows[0].acquisition, netProfit = cashflows.reduce((n, f) => n + f.net, 0), cumulativeReturnPct = 100 * netProfit / initialOutlay;
  if (![initialOutlay, netProfit, cumulativeReturnPct, ...cashflows.flatMap(f => Object.values(f)), ...annual.flatMap(a => Object.values(a).filter(v => v !== null))].every(Number.isFinite)) throw new RangeError('Combined ROI exceeds numeric range.');
  const result = {version: ESTIMATE_VERSION, classification: 'conditional_scenario', basis: 'capital_weighted_cashflows', capital, capitalLabel: `Illustrative normalized portfolio capital: AED ${capital}; not a unit price`, horizonYears, legs: validated.map(l => ({weight: l.weight, resultId: l.result.id, assumptions: l.result.assumptions})), cashflows, annual, initialOutlay, netProfit, cumulativeReturnPct, annualizedReturnPct: null, methodology: 'Weights allocate acquisition-price capital. Each complete cashflow is scaled to its capital allocation; fees are additional. Portfolio yields and holding-period return use the summed cashflows and denominators, not averages of percentages.'};
  return {id: stableId(result), ...result};
}
