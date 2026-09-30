/** Reproduce reviewed scenario snapshot without modifying the archived inputs.
 * node scripts/build-estimate-data.mjs --source-root /absolute/path/to/recovered
 * Optional --output /absolute/output.json. As-of is intentionally fixed below.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {derivePriceScenario, stableId, DEFAULT_POLICY, ESTIMATE_VERSION} from '../src/smart-estimates/core.mjs';

export const SNAPSHOT_VERSION = '20260930-smart-estimates-v1';
export const AS_OF = '2026-09-30T00:00:00Z';
const args = process.argv.slice(2), arg = name => {const at = args.indexOf(name); return at === -1 ? null : args[at + 1];};
for (let i = 0; i < args.length; i += 2) if (!['--source-root', '--output'].includes(args[i]) || !args[i + 1]) throw Error('Use --source-root PATH and/or --output PATH.');
const root = path.resolve(arg('--source-root') || fileURLToPath(new URL('../../../', import.meta.url)));
const output = path.resolve(arg('--output') || fileURLToPath(new URL('../data/smart-estimates-20260930.json', import.meta.url)));
const inputs = [], sha = value => createHash('sha256').update(value).digest('hex');
async function read(relative) {
  const bytes = await fs.readFile(path.join(root, relative));
  inputs.push({path: relative, sha256: sha(bytes), bytes: bytes.length});
  return JSON.parse(bytes);
}
const catalogue = await read('history-predictions-20260927/published/catalogue.json');
const manifest = await read('history-predictions-20260927/raw/dubai-manifest.json');
const benchmarks = await read('coverage-expansion-20260928/market-segments.json');
const sourceIds = new Set([manifest.source.id, ...benchmarks.sources.map(s => s.id)]);
const sales = [], asking = [], DAY = 86400000, now = Date.parse(AS_OF);
const columns = ['period', 'eligible_sale_count', 'median_sale_aed_sqft', 'p25_sale_aed_sqft', 'p75_sale_aed_sqft', 'eligible_sale_value_aed', 'source_auxiliary_6', 'source_auxiliary_7'];
const nativeQuarterEnd = period => {const m = /^(\d{4})Q([1-4])$/.exec(period); assert(m, 'Unexpected native quarter'); return new Date(Date.UTC(+m[1], +m[2] * 3, 0)).toISOString().slice(0, 10);};
const groupCounts = (rows, key) => Object.fromEntries([...Map.groupBy(rows, key)].map(([k, values]) => [k, values.length]));

for (const segment of ['apartment', 'villa']) for (const registrationPath of ['ready', 'offplan']) {
  const part = `quarterly/${segment}/${registrationPath}`;
  const d = await read(`history-predictions-20260927/raw/${part.replaceAll('/', '--')}.json`);
  const expected = manifest.parts.find(p => p.key === part);
  assert(expected); assert.equal(d.frequency, 'quarterly'); assert.equal(d.segment, segment);
  assert.equal(d.series.length, expected.series); assert.equal(d.series.reduce((n, s) => n + s.points.length, 0), expected.points);
  for (const s of d.series) {
    const matches = catalogue.series.filter(e => e.family === 'dubai' && e.part === part && e.sourceSeriesId === String(s.id));
    assert.equal(matches.length, 1, `Exact catalogue identity required: ${part}/${s.id}`);
    const original = matches[0];
    assert.equal(original.geography, s.name); assert.equal(original.segment, d.segment); assert.equal(original.registration, d.registration);
    assert.equal(original.dataSha256, sha(JSON.stringify(s.points)), 'Archived native historical values changed');
    assert.equal(original.sourceId, manifest.source.id);
    const identity = {emirate: 'Dubai', geography: s.name, segment: d.segment, registration: d.registration};
    const sourceHistory = {...identity, frequency: 'quarterly', unit: 'AED/sqft', sourceId: original.sourceId, points: s.points};
    const derived = derivePriceScenario(sourceHistory, {asOf: AS_OF});
    const complete = s.points.filter(p => Date.parse(nativeQuarterEnd(p[0])) <= now).toSorted((a, b) => a[0].localeCompare(b[0]));
    const latest = complete.at(-1), ageDays = latest ? (now - Date.parse(nativeQuarterEnd(latest[0]))) / DAY : null;
    const anchorEligible = latest && typeof latest[2] === 'number' && Number.isFinite(latest[2]) && latest[2] > 0 && latest[1] >= DEFAULT_POLICY.minimumSalesPerQuarter;
    const fresh = ageDays !== null && ageDays <= DEFAULT_POLICY.maxAgeDays;
    const eligible = anchorEligible && fresh && derived.classification === 'conditional_scenario';
    const anchor = anchorEligible ? {value: latest[2], period: latest[0], periodEnd: nativeQuarterEnd(latest[0]), sourceId: original.sourceId, sourceRows: latest[1], unit: 'AED/sqft', ageDays, observed: true, isCurrentObservation: false} : null;
    sales.push({
      id: stableId({snapshot: SNAPSHOT_VERSION, evidenceClass: 'registered_sale', historySeriesId: original.id}),
      evidenceClass: 'registered_sale', ...identity, frequency: 'quarterly', unit: 'AED/sqft', sourceId: original.sourceId,
      historySeriesId: original.id, sourceSeriesId: original.sourceSeriesId, sourceVersion: original.sourceVersion,
      geometryIds: s.geometryIds || [], geometryName: s.geometryName || null, geometryMatch: s.geometryMatch || null,
      geometryBasis: s.geometryBasis || 'Source-area geometry does not establish marketed-community equivalence.',
      history: {columns, points: s.points, dataSha256: original.dataSha256, sourceFrequency: 'quarterly', latestCompletePeriod: latest?.[0] || null, retainedPoints: s.points.length},
      anchor, estimate: eligible ? derived : null,
      scenarioStatus: eligible ? derived.basis : anchorEligible ? 'stale_anchor' : 'insufficient_anchor_evidence',
      reason: eligible ? derived.calibration.reason : !anchorEligible ? 'Latest complete source quarter lacks a positive median with at least 20 eligible sales. All original periods remain retained.' : 'The latest anchor is older than 185 days. History remains retained; no default current estimate is published.',
      quality: {minimumPriceSamplePerQuarter: 20, latestSourceSampleCount: latest?.[1] ?? null, historicalSourceTrainingApproved: false, forecastApprovalChanged: false, independentGovernmentExport: false, pointInTimeBacktest: false, unitAreaBasis: 'Registered procedure area; not necessarily internal floor area.', futurePeriodsRetainedOutsideCalibration: s.points.length - complete.length},
    });
  }
}

const grouped = Map.groupBy(benchmarks.rows, r => JSON.stringify([r.emirate, r.community, r.segment, r.basis]));
for (const rows of grouped.values()) {
  const first = rows[0], identity = {emirate: first.emirate, geography: first.community, segment: first.segment, registration: 'Not specified by publisher'};
  assert(rows.every(r => r.emirate === first.emirate && r.community === first.community && r.segment === first.segment && r.basis === first.basis));
  assert(rows.every(r => sourceIds.has(r.sourceId)), 'Missing asking source provenance');
  const completedRows = rows.filter(r => Date.parse(r.periodEnd) <= now);
  const latestEnd = completedRows.map(r => r.periodEnd).sort().at(-1);
  const latestRows = completedRows.filter(r => r.periodEnd === latestEnd);
  // Do not choose between report vintages or different native windows ending on the same date.
  const latest = latestRows.length === 1 ? latestRows[0] : null;
  const validPrice = latest && typeof latest.askPsf === 'number' && Number.isFinite(latest.askPsf) && latest.askPsf > 0;
  const ageDays = latest ? (now - Date.parse(latest.periodEnd)) / DAY : null;
  const fresh = ageDays !== null && ageDays <= DEFAULT_POLICY.maxAgeDays;
  const anchor = validPrice ? {value: latest.askPsf, period: latest.period, periodEnd: latest.periodEnd, sourceId: latest.sourceId, sourceObservationId: latest.id, unit: 'AED/sqft', ageDays, observed: true, isCurrentObservation: false} : null;
  const estimate = anchor && fresh ? derivePriceScenario({...identity, frequency: 'quarterly', sourceId: latest.sourceId, unit: 'AED/sqft', points: []}, {asOf: AS_OF, anchor}) : null;
  assert(!estimate || estimate.basis === 'explicit_assumptions');
  asking.push({
    id: stableId({snapshot: SNAPSHOT_VERSION, evidenceClass: 'advertised_price_benchmark', identity, basis: first.basis}),
    evidenceClass: 'advertised_price_benchmark', ...identity, unit: 'AED/sqft', sourceId: latest?.sourceId || null,
    sourceObservationId: latest?.id || null,
    history: {rows, dataSha256: sha(JSON.stringify(rows)), retainedRows: rows.length, nativePeriods: [...new Set(rows.map(r => r.period))].sort(), periodPolicy: 'Source annual and half-year windows remain separate; no interpolation, monthly backfill or reconstruction from reported percentage changes.'},
    anchor,
    grossYieldBenchmark: latest && typeof latest.roi === 'number' && Number.isFinite(latest.roi) ? {value: latest.roi, unit: '%', period: latest.period, periodStart: latest.periodStart, periodEnd: latest.periodEnd, sourceId: latest.sourceId, sourceObservationId: latest.id, basis: latest.roiBasis, sampleSize: latest.sampleSize, isNetROI: false, isForecast: false} : null,
    estimate, scenarioStatus: estimate ? 'explicit_assumptions' : !latest ? 'ambiguous_latest_period' : !anchor ? 'insufficient_anchor_evidence' : 'stale_anchor',
    reason: estimate ? 'Only the dated price anchor is source-backed. Lower/reference/higher growth and damping are explicit scenario assumptions, not learned from sparse benchmark history.' : !latest ? 'Latest-period source rows require reconciliation before selecting an anchor; every row is retained.' : !anchor ? 'Latest source observation has no positive asking-price anchor; every row is retained.' : 'Latest asking-price anchor is older than 185 days. It is retained for explicitly dated, user-selected scenarios but is not published as a default current estimate.',
    quality: {sampleSize: latest?.sampleSize ?? null, historicalSourceTrainingApproved: false, forecastApprovalChanged: false, sourceComparability: benchmarks.sourceComparability, rentalGrowthLearned: false, grossYieldIsObservedRent: false, privateCandidateDataUsed: false},
  });
}

sales.sort((a, b) => a.id.localeCompare(b.id)); asking.sort((a, b) => a.id.localeCompare(b.id));
const benchmarkIds = asking.flatMap(g => g.history.rows.map(r => r.id));
assert.equal(benchmarkIds.length, benchmarks.rows.length); assert.equal(new Set(benchmarkIds).size, new Set(benchmarks.rows.map(r => r.id)).size);
assert.deepEqual(benchmarkIds.toSorted(), benchmarks.rows.map(r => r.id).toSorted(), 'No asking observation may be omitted');
const eligibleSales = sales.filter(s => s.estimate), eligibleAsking = asking.filter(s => s.estimate);
const byEmirate = Object.fromEntries([...new Set(asking.map(r => r.emirate))].sort().map(emirate => [emirate, {groups: asking.filter(r => r.emirate === emirate).length, retainedRows: asking.filter(r => r.emirate === emirate).reduce((n, r) => n + r.history.rows.length, 0), defaultScenarioGroups: eligibleAsking.filter(r => r.emirate === emirate).length, staleAnchors: asking.filter(r => r.emirate === emirate && r.scenarioStatus === 'stale_anchor').length}]));
const payload = {
  version: SNAPSHOT_VERSION, methodVersion: ESTIMATE_VERSION, owner: 'Espacios', asOf: AS_OF,
  asOfPolicy: 'Fixed reviewed snapshot cutoff 2026-09-30 00:00 UTC. Source periods and publication vintages remain distinct from computation date. No nowcast bridge is inserted between a dated anchor and today.',
  reproducibility: {command: 'node scripts/build-estimate-data.mjs --source-root PATH_TO_RETAINED_RECOVERED_ARCHIVES', deterministic: true, inputs, inputManifestSha256: sha(JSON.stringify(inputs)), identifierPolicy: 'Stable IDs are non-cryptographic; SHA-256 separately records archived inputs and historical point arrays.'},
  sources: [manifest.source, ...benchmarks.sources], policy: DEFAULT_POLICY,
  counts: {salesSeries: sales.length, retainedNativeQuarterlyPoints: sales.reduce((n, s) => n + s.history.points.length, 0), salesScenarioSeries: eligibleSales.length, salesScenarioByBasis: groupCounts(eligibleSales, s => s.estimate.basis), salesScenarioBySegment: groupCounts(eligibleSales, s => `${s.segment}|${s.registration}`), askingGroups: asking.length, retainedAskingObservations: benchmarks.rows.length, askingScenarioGroups: eligibleAsking.length, askingByEmirate: byEmirate, priceScenarioSets: eligibleSales.length + eligibleAsking.length, conditionalPriceOutcomes: (eligibleSales.length + eligibleAsking.length) * 3 * 10, savedNetROIForecasts: 0},
  quality: {historicalRecordsDeleted: 0, historicalValuesChanged: 0, sourcePrivateCandidateDataUsed: false, sourceIdentityRule: 'Exact catalogue part/sourceSeriesId and exact source names; no fuzzy aliases, nearby substitutes or asking/registered-sale joins.', historyRetention: 'All native history within the four source quarterly partitions and every one of the 228 asking/yield benchmark rows are retained. Other existing monthly, official, context and project datasets are unchanged, not replaced by this focused layer.', trainedForecastApprovalChanged: false, probabilityAssigned: false, validatedForecast: false, observedNetROIAdded: false, sourceMonthlyDataUnchanged: true, sourceLimitations: [...catalogue.dataContract.limitations], comparisonPolicy: 'Compare only equivalent price basis, property type, registration, anchor date and explicit cash-flow assumptions. Missing evidence is not zero or a negative investment score.'},
  methodology: {price: 'Historical-trend scenarios use same-area, same-type, same-registration native quarterly medians with ≥20 eligible sales each for ≥20 contiguous quarters. Empirical quartiles of four-quarter log changes seed policy-shrunk/capped/damped paths. Other eligible dated anchors receive separate assumption-led paths. These are not probability intervals or backtested long-horizon forecasts.', roi: 'No net return is stored as observed or forecast. ROI is computed only from disclosed all-cash acquisition, rent, vacancy, operating costs, delivery timing, exit values and fees. A same-row publisher gross-yield benchmark is optional input context, not observed rent or net ROI.', stale: 'Stale anchors retain values, dates and complete histories. Default estimates are withheld beyond 185 days. A user may explicitly choose a dated old anchor for a separate conditional scenario without recasting it as current.'},
  sales, asking,
};
const serialized = JSON.stringify(payload);
for (const input of inputs) assert.equal(sha(await fs.readFile(path.join(root, input.path))), input.sha256, `Source changed during build: ${input.path}`);
await fs.mkdir(path.dirname(output), {recursive: true});
await fs.writeFile(output, serialized + '\n');
assert.equal(sha(await fs.readFile(output)), sha(serialized + '\n'));
console.log(JSON.stringify({output, bytes: Buffer.byteLength(serialized) + 1, sha256: sha(serialized + '\n'), version: SNAPSHOT_VERSION, asOf: AS_OF, counts: payload.counts, historyPreservationVerified: true}, null, 2));
