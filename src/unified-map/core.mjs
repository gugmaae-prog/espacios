/** Timeline adapters only: source evidence and conditional scenarios stay distinct. */
export const UNIFIED_VERSION = 'espacios-unified-timeline-v1';
export const MAX_SCENARIO_YEARS = 30;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const copy = value => JSON.parse(JSON.stringify(value));
const requireText = (value, name) => {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} is required.`);
  return value.trim();
};
function wholeYears(value) {
  if (!Number.isInteger(value) || value < 1 || value > MAX_SCENARIO_YEARS) throw new RangeError(`Horizon must be 1–${MAX_SCENARIO_YEARS} whole years.`);
  return value;
}
function isoDay(year, month, day) {
  if (year < 1000 || year > 9999) throw new TypeError('Period year must contain four digits.');
  const stamp = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const parsed = new Date(`${stamp}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== stamp) throw new TypeError('Period must be a real calendar date.');
  return stamp;
}
function monthEnd(year, month) {
  return isoDay(year, month, new Date(Date.UTC(year, month, 0)).getUTCDate());
}

/** Sorting key only. The original native period label is never resampled. */
export function periodEnd(period) {
  const value = requireText(period, 'Native period');
  let match = /^(\d{4})-?Q([1-4])$/.exec(value);
  if (match) return monthEnd(+match[1], +match[2] * 3);
  match = /^(\d{4})-?H([12])$/.exec(value);
  if (match) return monthEnd(+match[1], +match[2] * 6);
  match = /^(\d{4})(?:-?FY)?$/.exec(value);
  if (match) return isoDay(+match[1], 12, 31);
  match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (match) return monthEnd(+match[1], +match[2]);
  match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) return isoDay(+match[1], +match[2], +match[3]);
  throw new TypeError(`Unsupported native period: ${value}`);
}

/** All source records, including explicit missing values and revisions, survive. */
export function sortNativePeriods(records) {
  if (!Array.isArray(records)) throw new TypeError('Native periods must be an array.');
  return records.map((record, index) => ({record, index, end: periodEnd(typeof record === 'string' ? record : record?.period)}))
    .sort((a, b) => a.end.localeCompare(b.end) || a.index - b.index)
    .map(({record}) => record);
}

function yearPeriod(period, year) {
  const result = `${String(Number(period.slice(0, 4)) + year).padStart(4, '0')}${period.slice(4)}`;
  // A 29 February anchor has no identical native date in a non-leap year: do not
  // silently invent an anniversary convention when the source did not specify it.
  periodEnd(result);
  return result;
}
const close = (left, right) => Math.abs(left - right) <= 1e-10 * Math.max(1, Math.abs(left), Math.abs(right));

/**
 * Extend a reviewed conditional scenario using its SAME seed and annual damping.
 * Existing annual rows are retained byte-for-value, including additional metadata.
 * The extension is not new source evidence, calibration or a validated forecast.
 */
export function extendPriceScenario(estimate, horizonYears = 10) {
  wholeYears(horizonYears);
  if (!estimate || estimate.classification !== 'conditional_scenario') throw new TypeError('An existing conditional scenario is required.');
  if (!finite(estimate.baseline?.value) || estimate.baseline.value <= 0) throw new TypeError('A positive dated source anchor is required.');
  const anchorPeriod = requireText(estimate.baseline.period, 'Anchor period');
  const anchorEnd = periodEnd(anchorPeriod);
  if (estimate.baseline.periodEnd !== undefined && estimate.baseline.periodEnd !== anchorEnd) throw new TypeError('Anchor end disagrees with its native period.');
  const damping = estimate.policy?.annualDamping;
  if (!finite(damping) || damping < 0 || damping > 1) throw new TypeError('Disclosed annual damping must be between zero and one.');
  if (!estimate.scenarios || !Object.keys(estimate.scenarios).length) throw new TypeError('At least one reviewed scenario path is required.');
  const result = copy(estimate);
  for (const [name, source] of Object.entries(estimate.scenarios)) {
    if (!finite(source.rateSeed) || source.rateSeed <= -1 || source.rateSeed > 1) throw new TypeError('A disclosed finite simple rate seed between -100% and 100% is required.');
    if (!Array.isArray(source.annual) || !source.annual.length) throw new TypeError('A retained annual scenario path is required.');
    if (source.annual.length > MAX_SCENARIO_YEARS) throw new RangeError('Retained path exceeds the supported horizon.');
    let ratio = 1;
    for (const [index, point] of source.annual.entries()) {
      const year = index + 1, annualGrowth = source.rateSeed * damping ** (year - 1);
      ratio *= 1 + annualGrowth;
      if (point.year !== year || point.period !== yearPeriod(anchorPeriod, year)) throw new TypeError('Retained scenario path must contain consecutive anchor-relative years.');
      if (![point.value, point.ratio, point.annualGrowth].every(finite) || !close(point.ratio, ratio) || !close(point.value, estimate.baseline.value * ratio) || !close(point.annualGrowth, annualGrowth)) throw new TypeError('Retained scenario path disagrees with its disclosed seed/damping policy.');
    }
    const annual = result.scenarios[name].annual;
    // Start from the retained terminal ratio rather than rewriting its rounding.
    ratio = annual.at(-1).ratio;
    for (let year = annual.length + 1; year <= horizonYears; year++) {
      const annualGrowth = source.rateSeed * damping ** (year - 1);
      ratio *= 1 + annualGrowth;
      const value = estimate.baseline.value * ratio;
      if (!finite(ratio) || !finite(value) || value <= 0) throw new RangeError('Conditional path exceeds numeric range.');
      annual.push({year, period: yearPeriod(anchorPeriod, year), value, ratio, annualGrowth});
    }
  }
  const retainedYears = Math.max(...Object.values(estimate.scenarios).map(path => path.annual.length));
  const resultYears = Math.max(horizonYears, retainedYears);
  result.sourceEstimateId = estimate.sourceEstimateId || estimate.id || null;
  result.id = `${result.sourceEstimateId || UNIFIED_VERSION}:conditional-horizon:${resultYears}`;
  result.extension = {
    version: UNIFIED_VERSION, requestedHorizonYears: horizonYears, retainedAnnualYears: retainedYears,
    maximumHorizonYears: resultYears, seedChanged: false, dampingChanged: false,
    methodology: 'Continue the retained simple annual rate seed multiplied by annualDamping^(year-1). No refitting, new observations, source gaps filled, catalyst uplift or current-value bridge.',
    limitation: 'Longer horizons are increasingly assumption-dependent. Scenario paths are not probability intervals, valuations or validated forecasts.',
  };
  result.probabilityAssigned = false;
  result.validatedForecast = false;
  return result;
}

const classLabel = evidenceClass => ({
  observed: 'Observed', registered_sale: 'Registered sales',
  advertised_price_benchmark: 'Asking benchmark', released_projection: 'Released projection',
  conditional_scenario: 'Conditional estimate', source_period: 'Source period',
}[evidenceClass] || evidenceClass.replaceAll('_', ' '));

/**
 * UI domain. Filter to a comparable geography/type/basis cohort before calling.
 * Same-label/class records share an option but all sources remain in `records`.
 * Distinct native labels/classes never overwrite one another, even on one day.
 */
export function timelineOptions({nativePeriods = [], estimates = [], path = 'reference', horizonYears = 10} = {}) {
  wholeYears(horizonYears);
  if (!Array.isArray(nativePeriods) || !Array.isArray(estimates)) throw new TypeError('Timeline evidence must be arrays.');
  const groups = new Map();
  const add = (record, evidenceClass, kind) => {
    const period = requireText(record.period, 'Native period'), end = periodEnd(period);
    if (record.periodEnd !== undefined && record.periodEnd !== end) throw new TypeError('Record end disagrees with its native period.');
    const id = JSON.stringify([period, evidenceClass]);
    if (!groups.has(id)) groups.set(id, {id, period, periodEnd: end, evidenceClass, kind, label: `${period} · ${classLabel(evidenceClass)}`, records: []});
    groups.get(id).records.push({...record, period, periodEnd: end, evidenceClass});
  };
  for (const value of nativePeriods) {
    const record = typeof value === 'string' ? {period: value} : value;
    if (!record || typeof record !== 'object') throw new TypeError('Native evidence needs a period.');
    const evidenceClass = requireText(record.evidenceClass || record.classification || 'source_period', 'Evidence class');
    add(record, evidenceClass, 'native');
  }
  for (const value of estimates) {
    const original = value?.estimate || value;
    // Unavailable/stale anchors do not silently acquire default estimates.
    if (!original || original.classification !== 'conditional_scenario') continue;
    const estimate = extendPriceScenario(original, horizonYears), selected = estimate.scenarios[path];
    if (!selected) throw new TypeError(`Scenario path is unavailable: ${path}`);
    for (const point of selected.annual.filter(point => point.year <= horizonYears)) add({
      ...point, estimateId: estimate.id, sourceEstimateId: estimate.sourceEstimateId,
      sourceRowId: value?.estimate ? value.id || null : null, path,
      identity: estimate.identity, anchorPeriod: estimate.baseline.period,
      anchorSourceId: estimate.baseline.sourceId, unit: estimate.baseline.unit,
      observed: false, validatedForecast: false,
    }, 'conditional_scenario', 'scenario');
  }
  return [...groups.values()].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
}

/** Use the one audited cash-flow calculator; never substitute missing rent/fees. */
export function profitability(input, calculateROI) {
  const required = ['price', 'annualRent', 'buyCostsPct', 'sellCostsPct', 'operatingCostsPct', 'vacancyPct', 'rentGrowthPct', 'incomeStartYear', 'horizonYears'];
  const missing = required.filter(name => !finite(input?.[name]));
  if (!Array.isArray(input?.capitalPath) || !input.capitalPath.length) missing.push('capitalPath');
  const unavailable = (reason, fields = []) => ({classification: 'unavailable', netProfit: null, cumulativeReturnPct: null, missing: fields, reason});
  if (missing.length) return unavailable('Net profitability needs explicit rent, acquisition, exit, holding, vacancy, timing and capital assumptions. Missing values are not zero.', missing);
  if (typeof calculateROI !== 'function') return unavailable('The audited cash-flow calculator is unavailable.');
  try {
    wholeYears(input.horizonYears);
    const result = calculateROI(input);
    if (result?.classification !== 'conditional_scenario' || !finite(result.netProfit) || !finite(result.cumulativeReturnPct)) return unavailable('The calculator did not produce a finite conditional profitability result.');
    return result;
  } catch (error) {
    return unavailable(error instanceof Error ? error.message : 'Profitability assumptions are invalid.');
  }
}
