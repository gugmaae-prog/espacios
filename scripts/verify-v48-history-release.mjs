#!/usr/bin/env node
/**
 * Read-only V48 historical-evidence acceptance check.
 *
 * Usage:
 *   node scripts/verify-v48-history-release.mjs \
 *     --origin https://<candidate-or-canonical-origin> \
 *     --output docs/verification/history-v48-2026-10-14/candidate-api.json
 *
 * Local pre-publication contract only:
 *   node scripts/verify-v48-history-release.mjs --local-only \
 *     --output docs/verification/history-v48-2026-10-14/local-contract.json
 *
 * The script only performs GET requests when an origin is supplied and writes a
 * local receipt. It never mutates R2, D1, Workers, traffic, or the source
 * snapshot.
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXPECTED = Object.freeze({
  version: '20261014-enrichment-v48',
  rootSHA256: 'ca1133d5169abc0bc2aec24eb193719018e47a3e9d06c773a951b9cc9a7424a0',
  canonicalSnapshotSHA256: 'bbb7c8037a11221e94843d6be0882d073a9fea7550aa0748435c9a806e89ecc7',
  counts: Object.freeze({ records: 1860, projects: 1645, communities: 215, sources: 3371, events: 105, exposures: 7382, historicalRows: 633891, series: 16872 }),
  ledger: Object.freeze({ present: 3352, partial: 3404, missing: 26724, unestablished: 9300 }),
  targetYears: Object.freeze({ first: 2027, last: 2080, slots: 54 }),
  v47: Object.freeze({
    packetPath: 'data/historical-intelligence/dld-lifecycle-pass47-20261013.json',
    sourceId: 'dld47-public-project-status-20261013',
    facts: 15
  }),
  v48: Object.freeze({
    packetPath: 'data/historical-intelligence/emaar-primary-lifecycle-pass48-20261014.json',
    reconciliationPath: 'data/historical-intelligence/emaar-primary-pass48-reconciliation.json',
    packetSHA256: '705714067dd9ba1c897c5d31ea6ffc84d07568fcd24c3f1ca8f92d9b283a6400',
    passId: 'emaar-primary-lifecycle-pass48-20261014',
    facts: 5,
    sources: Object.freeze([
      'emaar48-expo-living-terra-heights',
      'emaar48-palace-residences-sales-report',
      'emaar48-h1-2024-rally'
    ]),
    records: Object.freeze([
      {
        recordId: 'project:apartments-in-terra-heights-in-emaar-expo-living-expo-city-dubai',
        name: 'Terra Heights', projectNumber: '3381', projectId: '678761680', developerNumber: '1237', areaId: '462',
        factIds: Object.freeze(['emaar48-terra-heights-launch'])
      },
      {
        recordId: 'project:palace-residences-dubai-hills-estate-emaar-properties',
        name: 'Palace Residences Dubai Hills Estate', projectNumber: '2884', projectId: '568286816', developerNumber: '984', areaId: '482',
        factIds: Object.freeze(['emaar48-palace-launch-window', 'emaar48-palace-sales-status', 'emaar48-palace-h1-sales-status'])
      },
      {
        recordId: 'project:address-residences-zabeel-by-emaar-properties-in-zaabeel-dubai',
        name: 'Address Residences Zabeel', projectNumber: '2957', projectId: '583695609', developerNumber: '1212', areaId: '331',
        factIds: Object.freeze(['emaar48-zabeel-h1-sales-status'])
      }
    ])
  })
});

const args = process.argv.slice(2);
function option(name) {
  const index = args.indexOf(name);
  if (index < 0) return null;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`${name} requires a value`);
  return args[index + 1];
}
const originInput = option('--origin');
const outputInput = option('--output');
const localOnly = args.includes('--local-only');
if (!outputInput || (localOnly && originInput) || (!localOnly && !originInput)) {
  throw new Error('Usage: node scripts/verify-v48-history-release.mjs (--origin https://<origin> | --local-only) --output <receipt.json>');
}
let origin = null;
if (originInput) {
  const originURL = new URL(originInput);
  const loopback = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(originURL.hostname);
  assert.ok(originURL.protocol === 'https:' || (originURL.protocol === 'http:' && loopback), 'Origin must be HTTPS (HTTP is only allowed for loopback offline checks)');
  assert.ok(originURL.pathname === '/' && !originURL.search && !originURL.hash && !originURL.username && !originURL.password, 'Origin must not include a path, query, fragment, or credentials');
  origin = originURL.origin;
}
const output = path.resolve(process.cwd(), outputInput);
const readJSON = relative => readFile(path.join(repoRoot, relative), 'utf8').then(JSON.parse);
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const sortedObject = value => Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
const defined = value => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
const identifiers = value => {
  const found = new Set();
  const visit = item => {
    if (!item || typeof item !== 'object') return;
    if (Array.isArray(item)) return item.forEach(visit);
    if (typeof item.sourceId === 'string') found.add(item.sourceId);
    if (Array.isArray(item.sourceIds)) item.sourceIds.filter(id => typeof id === 'string').forEach(id => found.add(id));
    for (const child of Object.values(item)) visit(child);
  };
  visit(value);
  return found;
};
const groupByRecord = facts => facts.reduce((groups, fact) => {
  (groups.get(fact.recordId) || groups.set(fact.recordId, []).get(fact.recordId)).push(fact);
  return groups;
}, new Map());

const [localPacket, localReconciliation, localV47Packet, localPublication, localSnapshot] = await Promise.all([
  readJSON(EXPECTED.v48.packetPath),
  readJSON(EXPECTED.v48.reconciliationPath),
  readJSON(EXPECTED.v47.packetPath),
  readJSON('data/historical-intelligence/publication-manifest.json'),
  readJSON('data/historical-intelligence-20261003.json')
]);
const localSources = new Map(localSnapshot.sources.map(source => [source.id, source]));
const localV48Facts = new Map(localPacket.facts.map(fact => [fact.id, fact]));
const localV47Facts = new Map(localV47Packet.facts.map(fact => [fact.id, fact]));
const localV48FactsByRecord = groupByRecord(localPacket.facts);
const localV47FactsByRecord = groupByRecord(localV47Packet.facts);
const allV48SourceIds = new Set(EXPECTED.v48.sources);

function expectedLifecycle(fact) {
  const sourceIds = fact.sourceIds || (fact.sourceId ? [fact.sourceId] : []);
  const source = localSources.get(sourceIds[0]);
  return defined({
    id: fact.id,
    sourceIds,
    publishedAt: fact.publishedAt ?? source?.publishedAt ?? null,
    firstAvailableAt: fact.firstAvailableAt ?? source?.firstAvailableAt ?? null,
    retrievedAt: source?.retrievedAt ?? fact.retrievedAt,
    identityBasis: fact.identityBasis,
    identitySourceIds: fact.identitySourceIds,
    identityVerified: fact.identityVerified,
    kind: fact.milestone ?? fact.kind,
    date: fact.date,
    status: fact.verification ?? fact.status ?? 'reported',
    scope: fact.scope ?? 'subject',
    eventStatus: fact.eventStatus ?? 'reported',
    primaryEvidence: fact.primaryEvidence ?? false,
    label: fact.label,
    note: fact.note,
    evidenceClass: fact.evidenceClass ?? 'source_reported_milestone',
    dateBasis: fact.dateBasis,
    progressPercent: fact.progressPercent
  });
}
function actualLifecycle(row) {
  return defined({
    id: row.id,
    sourceIds: row.sourceIds,
    publishedAt: row.publishedAt,
    firstAvailableAt: row.firstAvailableAt,
    retrievedAt: row.retrievedAt,
    identityBasis: row.identityBasis,
    identitySourceIds: row.identitySourceIds,
    identityVerified: row.identityVerified,
    kind: row.kind,
    date: row.date,
    status: row.status,
    scope: row.scope,
    eventStatus: row.eventStatus,
    primaryEvidence: row.primaryEvidence,
    label: row.label,
    note: row.note,
    evidenceClass: row.evidenceClass,
    dateBasis: row.dateBasis,
    progressPercent: row.progressPercent
  });
}
function assertFactSet(record, facts, prefix, label) {
  const expected = facts.map(fact => fact.id).sort();
  const actual = (record.lifecycle || []).filter(item => String(item.id || '').startsWith(prefix));
  assert.deepEqual(actual.map(item => item.id).sort(), expected, `${label} lifecycle fact identities`);
  for (const item of actual) {
    const local = facts.find(fact => fact.id === item.id);
    assert.ok(local, `${label} returns an unexpected lifecycle fact`);
    assert.deepEqual(stable(actualLifecycle(item)), stable(expectedLifecycle(local)), `${label} lifecycle fact ${item.id}`);
  }
  return actual;
}
function assertNoFinancialPromotion(record, body, sourceIds, label) {
  const financialContainers = [
    record.observations, body.observations, body.validatedObservations, body.historySeries,
    record.currentSnapshot, record.priorCurrentSnapshots, body.scenarios?.priceAnchor,
    body.scenarios?.rentAnchor
  ];
  const found = financialContainers.some(container => [...identifiers(container)].some(id => sourceIds.has(id)));
  assert.equal(found, false, `${label} promotes lifecycle source evidence into financial data`);
}
function assertLocalLifecycleFacts() {
  const records = new Map(localSnapshot.records.map(record => [record.id, record]));
  for (const expected of EXPECTED.v48.records) {
    const record = records.get(expected.recordId);
    assert.ok(record, `Local V48 record absent: ${expected.recordId}`);
    assertFactSet(record, localV48FactsByRecord.get(expected.recordId) || [], 'emaar48-', expected.recordId);
    assertNoFinancialPromotion(record, { historySeries: record.historySeries, scenarios: {} }, allV48SourceIds, expected.recordId);
  }
  for (const [recordId, facts] of localV47FactsByRecord) {
    const record = records.get(recordId);
    assert.ok(record, `Local retained V47 record absent: ${recordId}`);
    assertFactSet(record, facts, 'dld47-', `retained ${recordId}`);
  }
}
function assertLocalContract() {
  const manifest = localSnapshot.manifest || {};
  assert.equal(localSnapshot.version, EXPECTED.version, 'Local snapshot version differs from V48 contract');
  assert.equal(localSnapshot.asOf, '2026-10-14', 'Local snapshot as-of differs from V48 contract');
  assert.equal(manifest.version, EXPECTED.version, 'Local snapshot manifest version differs from V48 contract');
  assert.equal(manifest.recordCount, EXPECTED.counts.records, 'Local snapshot record count');
  assert.equal(manifest.projectCount, EXPECTED.counts.projects, 'Local snapshot project count');
  assert.equal(manifest.communityCount, EXPECTED.counts.communities, 'Local snapshot community count');
  assert.equal(manifest.historicalObservationRows, EXPECTED.counts.historicalRows, 'Local snapshot historical rows');
  assert.equal(manifest.historicalSeriesCount, EXPECTED.counts.series, 'Local snapshot historical series');
  assert.equal(manifest.approved2080ForecastRecords, 0, 'Local snapshot must not claim approved V48 forecasts');
  assert.equal(manifest.requiredAnnualMetricSlots, EXPECTED.counts.records * 3 * EXPECTED.targetYears.slots, 'Local snapshot annual scenario slots');
  assert.equal(localPublication.version, EXPECTED.version, 'Local publication version differs from V48 contract');
  assert.equal(localPublication.rootIndex?.sha256, EXPECTED.rootSHA256, 'Local immutable root differs from V48 contract');
  assert.equal(localPublication.runtime?.canonicalArchiveSHA256, EXPECTED.rootSHA256, 'Local runtime root differs from V48 contract');
  assert.equal(localPublication.runtime?.canonicalSnapshotSHA256, EXPECTED.canonicalSnapshotSHA256, 'Local runtime snapshot checksum differs from V48 contract');
  assert.equal(localPacket.passId, EXPECTED.v48.passId, 'V48 lifecycle packet differs from expected pass');
  assert.equal(localPacket.candidateVersion, EXPECTED.version, 'V48 lifecycle packet candidate version');
  assert.equal(localPacket.preserveExistingFinancialCoverage, true, 'V48 packet must preserve existing financial coverage');
  assert.equal(localPacket.sources.length, EXPECTED.v48.sources.length, 'V48 packet source count');
  assert.deepEqual(localPacket.sources.map(source => source.id).sort(), [...EXPECTED.v48.sources].sort(), 'V48 packet source identities');
  assert.equal(localPacket.facts.length, EXPECTED.v48.facts, 'V48 packet lifecycle fact count');
  assert.deepEqual([...localV48Facts.keys()].sort(), EXPECTED.v48.records.flatMap(record => record.factIds).sort(), 'V48 packet fact identities');
  assert.ok(localPacket.facts.every(fact => fact.kind === 'lifecycle' && fact.status === 'accepted'), 'V48 packet contains a non-lifecycle or non-accepted fact');
  assert.equal(localPacket.collection?.newFinancialObservations, 0, 'V48 packet claims financial additions');
  assert.equal(localPacket.collection?.rawBodiesRedistributed, false, 'V48 packet claims raw-body redistribution');
  assert.deepEqual(localReconciliation, {
    changedRecords: EXPECTED.v48.records.map(record => record.recordId).sort(),
    developerSalesStatusReports: 3,
    historicalRowsPreserved: EXPECTED.counts.historicalRows,
    ledger: { missing: EXPECTED.ledger.missing, partial: EXPECTED.ledger.partial, present: EXPECTED.ledger.present, unestablished: EXPECTED.ledger.unestablished },
    newFinancialObservations: 0,
    newLifecycleFacts: EXPECTED.v48.facts,
    newSources: EXPECTED.v48.sources.length,
    reportedLaunchWindows: 1,
    rootSHA256: EXPECTED.rootSHA256,
    seriesPreserved: EXPECTED.counts.series,
    verifiedLaunchFacts: 1,
    version: EXPECTED.version
  }, 'V48 reconciliation receipt');
  const expectedV48Manifest = {
    factsAdded: EXPECTED.v48.facts,
    financialObservationsAdded: 0,
    packetPath: EXPECTED.v48.packetPath,
    packetSHA256: EXPECTED.v48.packetSHA256,
    rawBodiesRedistributed: false,
    recordsChanged: EXPECTED.v48.records.length,
    sourcesAdded: EXPECTED.v48.sources.length
  };
  assert.deepEqual(stable(manifest.emaarPrimaryLifecyclePass48), stable(expectedV48Manifest), 'V48 manifest block');
  assert.deepEqual(stable(manifest.dldLifecyclePass47), stable({
    factsAdded: EXPECTED.v47.facts,
    invalidCompletionFieldsQuarantined: 2,
    packetPath: EXPECTED.v47.packetPath,
    packetSHA256: 'd3a6565f6ad988cf864968c256e97a4c4b38d4b4a5498c13ef3d61fdcc0924e6',
    recordsChanged: 5,
    sourcesAdded: 1
  }), 'V47 retention manifest block');
  const supplemental = manifest.sourceEnrichment?.supplementalPasses?.find(pass => pass.passId === EXPECTED.v48.passId);
  assert.ok(supplemental, 'Local snapshot omits V48 supplemental-pass metadata');
  assert.deepEqual(stable(supplemental.counts), stable({ acceptedFacts: EXPECTED.v48.facts, lifecycleFacts: EXPECTED.v48.facts }), 'V48 supplemental fact counts');
  assert.equal(supplemental.collection?.newFinancialObservations, 0, 'V48 supplemental pass must not add financial evidence');
  assert.equal(supplemental.incompleteFinancialCoverageRemainsExplicit, true, 'V48 supplemental pass must retain incomplete financial coverage');
  for (const source of localPacket.sources) {
    assert.deepEqual(stable(localSources.get(source.id)), stable(source), `V48 source ${source.id} differs in the snapshot`);
    assert.equal(source.rawBodyRedistributed, false, `V48 source ${source.id} must not redistribute raw HTML`);
    assert.ok(source.firstAvailableAt && source.retrievedAt && source.publishedAt, `V48 source ${source.id} must retain publication, availability, and retrieval dates`);
  }
  const v47Source = localV47Packet.sources.find(source => source.id === EXPECTED.v47.sourceId);
  assert.ok(v47Source, 'Local V47 authority source is absent from retained packet');
  assert.deepEqual(stable(localSources.get(EXPECTED.v47.sourceId)), stable(v47Source), 'V47 authority source was not retained exactly');
  assert.equal(localV47Packet.facts.length, EXPECTED.v47.facts, 'V47 fact count changed before V48 release');
  assertLocalLifecycleFacts();
  const statuses = {};
  for (const record of localSnapshot.records) {
    const coverage = record.researchStatus?.itemCoverage;
    assert.ok(coverage && typeof coverage === 'object', `${record.id} omits local item coverage`);
    assert.equal(Object.keys(coverage).length, 23, `${record.id} local item-coverage field count`);
    for (const item of Object.values(coverage)) statuses[item.status] = (statuses[item.status] || 0) + 1;
  }
  assert.deepEqual(sortedObject(statuses), sortedObject(EXPECTED.ledger), 'Local V48 exact coverage ledger statuses');
  return { statuses: sortedObject(statuses), v47Source, expectedV48Manifest };
}
function assertManifest(manifest, label) {
  assert.ok(manifest && typeof manifest === 'object', `${label} omits its historical manifest`);
  assert.equal(manifest.version, EXPECTED.version, `${label} manifest version`);
  assert.equal(manifest.runtime?.canonicalArchiveSHA256, EXPECTED.rootSHA256, `${label} immutable archive root`);
  assert.equal(manifest.r2?.sha256, EXPECTED.rootSHA256, `${label} R2 immutable archive root`);
  assert.equal(manifest.runtime?.canonicalSnapshotSHA256, EXPECTED.canonicalSnapshotSHA256, `${label} canonical snapshot checksum`);
  assert.equal(manifest.recordCount, EXPECTED.counts.records, `${label} record count`);
  assert.equal(manifest.projectCount, EXPECTED.counts.projects, `${label} project count`);
  assert.equal(manifest.communityCount, EXPECTED.counts.communities, `${label} community count`);
  assert.equal(manifest.historicalObservationRows, EXPECTED.counts.historicalRows, `${label} historical rows`);
  assert.equal(manifest.historicalSeriesCount, EXPECTED.counts.series, `${label} historical series`);
  assert.equal(manifest.approved2080ForecastRecords, 0, `${label} must not claim approved V48 forecasts`);
  assert.equal(manifest.requiredAnnualMetricSlots, EXPECTED.counts.records * 3 * EXPECTED.targetYears.slots, `${label} annual scenario slot count`);
  assert.deepEqual(stable(manifest.emaarPrimaryLifecyclePass48), stable({
    factsAdded: EXPECTED.v48.facts,
    financialObservationsAdded: 0,
    packetPath: EXPECTED.v48.packetPath,
    packetSHA256: EXPECTED.v48.packetSHA256,
    rawBodiesRedistributed: false,
    recordsChanged: EXPECTED.v48.records.length,
    sourcesAdded: EXPECTED.v48.sources.length
  }), `${label} V48 lifecycle manifest`);
  assert.deepEqual(stable(manifest.dldLifecyclePass47), stable({
    factsAdded: EXPECTED.v47.facts,
    invalidCompletionFieldsQuarantined: 2,
    packetPath: EXPECTED.v47.packetPath,
    packetSHA256: 'd3a6565f6ad988cf864968c256e97a4c4b38d4b4a5498c13ef3d61fdcc0924e6',
    recordsChanged: 5,
    sourcesAdded: 1
  }), `${label} V47 retention manifest`);
  const supplemental = manifest.sourceEnrichment?.supplementalPasses?.find(pass => pass.passId === EXPECTED.v48.passId);
  assert.ok(supplemental, `${label} omits V48 supplemental-pass metadata`);
  assert.deepEqual(stable(supplemental.counts), stable({ acceptedFacts: EXPECTED.v48.facts, lifecycleFacts: EXPECTED.v48.facts }), `${label} V48 lifecycle-only supplemental counts`);
  assert.equal(supplemental.collection?.newFinancialObservations, 0, `${label} V48 supplemental financial additions`);
  assert.equal(supplemental.incompleteFinancialCoverageRemainsExplicit, true, `${label} retains incomplete financial coverage`);
  return { rootSHA256: manifest.runtime.canonicalArchiveSHA256, canonicalSnapshotSHA256: manifest.runtime.canonicalSnapshotSHA256 };
}
async function getJSON(endpoint) {
  const response = await fetch(origin + endpoint, {
    method: 'GET',
    headers: { accept: 'application/json', 'cache-control': 'no-cache' },
    signal: AbortSignal.timeout(120000)
  });
  assert.equal(response.status, 200, `${endpoint} returned HTTP ${response.status}`);
  assert.match(response.headers.get('content-type') || '', /application\/json/i, `${endpoint} content type`);
  assert.equal(response.headers.get('x-espacios-historical'), EXPECTED.version, `${endpoint} historical response header`);
  const body = await response.json();
  assert.equal(body.version, EXPECTED.version, `${endpoint} evidence version`);
  return { body, headers: response.headers };
}

const receipt = {
  schemaVersion: 1,
  status: 'failed',
  ...(origin ? { origin } : { mode: 'local_only' }),
  checkedAt: new Date().toISOString(),
  readOnly: true,
  expected: { version: EXPECTED.version, rootSHA256: EXPECTED.rootSHA256, counts: EXPECTED.counts }
};
try {
  const local = assertLocalContract();
  receipt.localContract = {
    passed: true,
    ledger: local.statuses,
    v48: { facts: EXPECTED.v48.facts, sources: EXPECTED.v48.sources.length, financialObservationsAdded: 0, rawBodiesRedistributed: false },
    retainedV47: { facts: EXPECTED.v47.facts, sourceId: EXPECTED.v47.sourceId }
  };
  if (!origin) {
    receipt.version = EXPECTED.version;
    receipt.rootSHA256 = EXPECTED.rootSHA256;
    receipt.canonicalSnapshotSHA256 = EXPECTED.canonicalSnapshotSHA256;
    receipt.counts = EXPECTED.counts;
    receipt.status = 'passed_local_only';
    receipt.passed = true;
  } else {
    const ledgerResult = await getJSON('/map/api/record-history?includeItemCoverage=1');
    const ledger = ledgerResult.body;
    const manifestProof = assertManifest(ledger.manifest, 'ledger');
    assert.equal(ledger.records.length, EXPECTED.counts.records, 'Ledger record count');
    assert.equal(new Set(ledger.records.map(record => record.id)).size, EXPECTED.counts.records, 'Ledger record identities are not unique');
    assert.equal(ledger.records.filter(record => record.type === 'project').length, EXPECTED.counts.projects, 'Ledger project count');
    assert.equal(ledger.records.filter(record => record.type === 'community').length, EXPECTED.counts.communities, 'Ledger community count');
    const statuses = {}, annualSlots = { checkedRecords: 0, first: null, last: null };
    for (const record of ledger.records) {
      const coverage = record.researchStatus?.itemCoverage;
      assert.ok(coverage && typeof coverage === 'object', `${record.id} omits item coverage`);
      assert.equal(Object.keys(coverage).length, 23, `${record.id} item-coverage field count`);
      for (const item of Object.values(coverage)) statuses[item.status] = (statuses[item.status] || 0) + 1;
      const annual = coverage.annual_scenario_inputs;
      assert.ok(annual, `${record.id} omits annual scenario coverage`);
      assert.equal(annual.firstYear, EXPECTED.targetYears.first, `${record.id} annual scenario first year`);
      assert.equal(annual.lastYear, EXPECTED.targetYears.last, `${record.id} annual scenario endpoint`);
      assert.equal(coverage.complete_registered_sale_history?.completeLifetimeHistory, false, `${record.id} must not claim complete lifetime registered-sale history`);
      assert.equal(coverage.complete_signed_rent_history?.completeLifetimeHistory, false, `${record.id} must not claim complete lifetime signed-rent history`);
      annualSlots.checkedRecords++;
      annualSlots.first = annual.firstYear;
      annualSlots.last = annual.lastYear;
    }
    assert.deepEqual(sortedObject(statuses), sortedObject(EXPECTED.ledger), 'V48 exact coverage ledger statuses');
    receipt.ledger = { records: ledger.records.length, items: Object.values(statuses).reduce((sum, count) => sum + count, 0), statuses: sortedObject(statuses), annualSlots, manifestRootVerified: true };

    const eventsResult = await getJSON('/map/api/events');
    const events = eventsResult.body;
    assertManifest(events.manifest, 'events');
    assert.equal(events.events.length, EXPECTED.counts.events, 'V48 event count');
    assert.equal(events.sources.length, EXPECTED.counts.sources, 'V48 source count');
    assert.equal(events.exposures.length, EXPECTED.counts.exposures, 'V48 exposure count');
    assert.equal(events.classification, 'event_evidence_not_causal_price_effects', 'Event classification');
    const remoteV48Sources = EXPECTED.v48.sources.map(sourceId => events.sources.find(source => source.id === sourceId));
    assert.ok(remoteV48Sources.every(Boolean), 'V48 primary sources are absent from the global source register');
    for (const remoteSource of remoteV48Sources) {
      assert.deepEqual(stable(remoteSource), stable(localSources.get(remoteSource.id)), `V48 source ${remoteSource.id} metadata changed`);
      assert.equal(remoteSource.rawBodyRedistributed, false, `V48 source ${remoteSource.id} must not redistribute raw HTML`);
    }
    const remoteV47Source = events.sources.find(source => source.id === EXPECTED.v47.sourceId);
    assert.ok(remoteV47Source, 'Retained V47 authority source is absent from the global source register');
    assert.deepEqual(stable(remoteV47Source), stable(local.v47Source), 'Retained V47 authority source metadata changed');
    receipt.globalEvents = { events: events.events.length, sources: events.sources.length, exposures: events.exposures.length, manifestRootVerified: true };
    receipt.primarySources = { sourceIds: EXPECTED.v48.sources, sourcesAdded: EXPECTED.v48.sources.length, rawBodiesRedistributed: false };
    receipt.retainedAuthoritySource = { id: remoteV47Source.id, publisher: remoteV47Source.publisher, retainedFacts: EXPECTED.v47.facts };

    const retainedV47RecordIds = [...localV47FactsByRecord.keys()];
    const requestedRecordIds = [...new Set([...EXPECTED.v48.records.map(record => record.recordId), ...retainedV47RecordIds])];
    const recordResults = await Promise.all(requestedRecordIds.map(async recordId => ({ recordId, ...(await getJSON('/map/api/record-history?' + new URLSearchParams({ recordId }))) })));
    const resultById = new Map(recordResults.map(result => [result.recordId, result.body]));
    const lifecycleFacts = [], recordProofs = [];
    for (const expected of EXPECTED.v48.records) {
      const body = resultById.get(expected.recordId);
      assertManifest(body.manifest, expected.recordId);
      const record = body.record;
      assert.ok(record, `${expected.recordId} omits record evidence`);
      assert.equal(record.id, expected.recordId, `${expected.recordId} record identity`);
      assert.equal(record.name, expected.name, `${expected.recordId} record name`);
      assert.equal(record.type, 'project', `${expected.recordId} record type`);
      assert.equal(record.emirate, 'Dubai', `${expected.recordId} emirate`);
      const register = (record.registerEvidence || []).find(item => String(item.fields?.projectNumber) === expected.projectNumber && String(item.registeredProjectId ?? item.fields?.projectId) === expected.projectId);
      assert.ok(register, `${expected.recordId} lacks the exact DLD project/register identity`);
      assert.equal(String(register.fields?.developerNumber), expected.developerNumber, `${expected.recordId} developer number`);
      assert.equal(String(register.fields?.areaId), expected.areaId, `${expected.recordId} area ID`);
      assert.equal(register.identityVerified, true, `${expected.recordId} register identity proof`);
      const facts = localV48FactsByRecord.get(expected.recordId) || [];
      const actual = assertFactSet(record, facts, 'emaar48-', expected.recordId);
      for (const item of actual) {
        assert.ok(!['completion', 'actual_completion', 'handover', 'occupancy', 'delivery'].includes(item.kind), `${item.id} falsely infers actual completion/handover/occupancy`);
        assert.notEqual(item.eventStatus, 'actual', `${item.id} falsely marks a reported status as actual`);
        lifecycleFacts.push(item);
      }
      assertNoFinancialPromotion(record, body, allV48SourceIds, expected.recordId);
      assert.deepEqual(body.scenarios?.targetYears, Array.from({ length: EXPECTED.targetYears.slots }, (_, index) => EXPECTED.targetYears.first + index), `${expected.recordId} annual scenario target slots`);
      assert.equal(record.scenarioCoverage?.firstYear, EXPECTED.targetYears.first, `${expected.recordId} scenario coverage first year`);
      assert.equal(record.scenarioCoverage?.lastYear, EXPECTED.targetYears.last, `${expected.recordId} scenario coverage endpoint`);
      assert.equal(record.scenarioCoverage?.approvedAnnualPoints, 0, `${expected.recordId} must not claim V48 annual forecast points`);
      recordProofs.push({ recordId: record.id, name: record.name, authorityProjectNumber: expected.projectNumber, factIds: [...expected.factIds].sort() });
    }
    assert.equal(lifecycleFacts.length, EXPECTED.v48.facts, 'V48 lifecycle fact count across exact identities');
    assert.equal(new Set(lifecycleFacts.map(item => item.id)).size, EXPECTED.v48.facts, 'V48 lifecycle fact IDs are not unique');
    for (const [recordId, facts] of localV47FactsByRecord) {
      const body = resultById.get(recordId);
      assertManifest(body.manifest, `retained ${recordId}`);
      assertFactSet(body.record, facts, 'dld47-', `retained ${recordId}`);
    }
    receipt.selectedRecordHistory = {
      records: recordProofs.length,
      identities: recordProofs,
      lifecycleFacts: lifecycleFacts.length,
      primarySources: EXPECTED.v48.sources,
      retainedV47Facts: EXPECTED.v47.facts,
      financialObservationsAdded: 0,
      inferredActualCompletionHandoverOrOccupancy: 0,
      annualTargetYears: EXPECTED.targetYears
    };

    const systemResponse = await fetch(origin + '/map/api/system', { method: 'GET', headers: { accept: 'application/json', 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(60000) });
    assert.equal(systemResponse.status, 200, 'System endpoint status');
    const system = await systemResponse.json();
    assert.equal(system.dataRoom?.access, 'restricted', 'Data Room access must remain restricted');
    assert.equal(system.dataRoom?.gate, 'DATA_ROOM_PUBLIC', 'Data Room access gate');
    assert.equal(system.security?.secretsExposed, false, 'System endpoint must not expose secrets');
    const roomResponse = await fetch(origin + '/map/data-room', { method: 'GET', headers: { accept: 'text/html', 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(60000) });
    assert.equal(roomResponse.status, 404, 'Restricted Data Room route status');
    assert.match(roomResponse.headers.get('cache-control') || '', /no-store/i, 'Restricted Data Room cache policy');
    assert.match(roomResponse.headers.get('x-robots-tag') || '', /noindex/i, 'Restricted Data Room robots policy');
    receipt.system = { dataRoomAccess: system.dataRoom.access, dataRoomGate: system.dataRoom.gate, dataRoomRouteStatus: roomResponse.status, secretsExposed: system.security.secretsExposed };
    receipt.version = EXPECTED.version;
    receipt.rootSHA256 = manifestProof.rootSHA256;
    receipt.canonicalSnapshotSHA256 = manifestProof.canonicalSnapshotSHA256;
    receipt.counts = EXPECTED.counts;
    receipt.status = 'passed';
    receipt.passed = true;
  }
} catch (error) {
  receipt.passed = false;
  receipt.error = error?.stack || String(error);
  process.exitCode = 1;
}
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ receipt: output, status: receipt.status, version: receipt.version || EXPECTED.version, rootSHA256: receipt.rootSHA256 || EXPECTED.rootSHA256, error: receipt.error || null }, null, 2));
