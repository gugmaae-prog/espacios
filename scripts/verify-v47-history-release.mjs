#!/usr/bin/env node
/**
 * Read-only V47 historical-evidence acceptance check.
 *
 * Usage:
 *   node scripts/verify-v47-history-release.mjs \
 *     --origin https://<candidate-or-canonical-origin> \
 *     --output docs/verification/history-v47-2026-10-13/candidate-api.json
 *
 * The script only performs GET requests and writes a local receipt. It never
 * mutates R2, D1, Workers, traffic, or the source snapshot.
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXPECTED = Object.freeze({
  version: '20261013-enrichment-v47',
  rootSHA256: '66755b6af985b16b56ea331353769914dfd9cff92678c0fd8e9f0f1e6ddb1240',
  canonicalSnapshotSHA256: 'f188684e8f54d9c90a3f378f0cf1bc25d3efeaf51eea1983b5f0d6ae6422108f',
  counts: Object.freeze({ records: 1860, projects: 1645, communities: 215, sources: 3368, events: 105, exposures: 7382, historicalRows: 633891, series: 16872 }),
  ledger: Object.freeze({ present: 3351, partial: 3403, missing: 26726, unestablished: 9300 }),
  sourceId: 'dld47-public-project-status-20261013',
  passId: 'dld-lifecycle-pass47-20261013',
  facts: 15,
  targetYears: Object.freeze({ first: 2027, last: 2080, slots: 54 }),
  records: Object.freeze([
    { recordId: 'project:sobha-hartland-one-park-avenue', name: 'Sobha Hartland One Park Avenue', projectNumber: '2166', projectId: '256512783', developerNumber: '966', areaId: '412', factIds: ['dld47-2166-registration', 'dld47-2166-2022-09-16', 'dld47-2166-2026-10-13'] },
    { recordId: 'project:montiva-by-vida-dubai-creek-harbour', name: 'Montiva', projectNumber: '3744', projectId: '755616583', developerNumber: '1224', areaId: '447', factIds: ['dld47-3744-registration', 'dld47-3744-2026-04-22', 'dld47-3744-2026-10-13'] },
    { recordId: 'project:apartments-albero-green-gate-dubai-creek-harbour', name: 'Albero', projectNumber: '3609', projectId: '733159836', developerNumber: '1224', areaId: '447', factIds: ['dld47-3609-registration', 'dld47-3609-2026-07-02', 'dld47-3609-2026-10-13'] },
    { recordId: 'project:parkside-views-by-emaar-properties', name: 'Parkside Views', projectNumber: '2728', projectId: '523735283', developerNumber: '984', areaId: '482', factIds: ['dld47-2728-registration', 'dld47-2728-2026-05-05', 'dld47-2728-2026-10-13'] },
    { recordId: 'project:arlo-emaar-properties-dubai-creek-harbour-dubai', name: 'ARLO', projectNumber: '3104', projectId: '616626353', developerNumber: '1224', areaId: '447', factIds: ['dld47-3104-registration', 'dld47-3104-2026-06-03', 'dld47-3104-2026-10-13'] }
  ])
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
if (!originInput || !outputInput) throw new Error('Usage: node scripts/verify-v47-history-release.mjs --origin https://<origin> --output <receipt.json>');
const originURL = new URL(originInput);
const loopback = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(originURL.hostname);
assert.ok(originURL.protocol === 'https:' || (originURL.protocol === 'http:' && loopback), 'Origin must be HTTPS (HTTP is only allowed for loopback offline checks)');
assert.ok(originURL.pathname === '/' && !originURL.search && !originURL.hash && !originURL.username && !originURL.password, 'Origin must not include a path, query, fragment, or credentials');
const origin = originURL.origin;
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
const localPacket = await readJSON('data/historical-intelligence/dld-lifecycle-pass47-20261013.json');
const localPublication = await readJSON('data/historical-intelligence/publication-manifest.json');
const localSnapshot = await readJSON('data/historical-intelligence-20261003.json');
const localFacts = new Map(localPacket.facts.map(fact => [fact.id, fact]));
const localSource = localPacket.sources.find(source => source.id === EXPECTED.sourceId);

function localContract() {
  assert.equal(localSnapshot.version, EXPECTED.version, 'Local snapshot version differs from V47 contract');
  assert.equal(localPublication.version, EXPECTED.version, 'Local publication version differs from V47 contract');
  assert.equal(localPublication.rootIndex.sha256, EXPECTED.rootSHA256, 'Local immutable root differs from V47 contract');
  assert.equal(localPacket.passId, EXPECTED.passId, 'Local lifecycle packet differs from V47 contract');
  assert.equal(localPacket.financialObservationsAdded, 0, 'V47 packet claims financial additions');
  assert.equal(localPacket.sources.length, 1, 'V47 packet must have exactly one authority source');
  assert.ok(localSource, 'V47 authority source is absent from local packet');
  assert.equal(localPacket.facts.length, EXPECTED.facts, 'V47 packet fact count changed');
  assert.deepEqual([...localFacts.keys()].sort(), EXPECTED.records.flatMap(record => record.factIds).sort(), 'V47 packet fact identities changed');
  assert.ok([...localFacts.values()].every(fact => fact.kind === 'lifecycle' && fact.status === 'accepted' && fact.sourceId === EXPECTED.sourceId), 'V47 packet contains a non-lifecycle or non-authority fact');
  assert.deepEqual([...new Set(localPacket.facts.map(fact => fact.recordId))].sort(), EXPECTED.records.map(record => record.recordId).sort(), 'V47 packet record identities changed');
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
  assert.equal(manifest.approved2080ForecastRecords, 0, `${label} must not claim approved V47 forecasts`);
  assert.equal(manifest.requiredAnnualMetricSlots, EXPECTED.counts.records * 3 * EXPECTED.targetYears.slots, `${label} annual scenario slot count`);
  assert.deepEqual(stable(manifest.dldLifecyclePass47), stable({
    factsAdded: EXPECTED.facts,
    recordsChanged: EXPECTED.records.length,
    sourcesAdded: 1,
    packetSHA256: 'd3a6565f6ad988cf864968c256e97a4c4b38d4b4a5498c13ef3d61fdcc0924e6',
    packetPath: 'data/historical-intelligence/dld-lifecycle-pass47-20261013.json',
    invalidCompletionFieldsQuarantined: 2
  }), `${label} V47 lifecycle manifest`);
  const supplemental = manifest.sourceEnrichment?.supplementalPasses?.find(pass => pass.passId === EXPECTED.passId);
  assert.ok(supplemental, `${label} omits V47 supplemental-pass metadata`);
  assert.deepEqual(stable(supplemental.counts), stable({ acceptedFacts: 15, lifecycleFacts: 15 }), `${label} V47 facts must remain lifecycle-only`);
  assert.equal(supplemental.incompleteFinancialCoverageRemainsExplicit, true, `${label} must retain incomplete financial coverage`);
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
function expectedLifecycle(fact) {
  return defined({
    id: fact.id,
    sourceIds: [fact.sourceId],
    publishedAt: fact.publishedAt ?? localSource.publishedAt ?? null,
    firstAvailableAt: fact.firstAvailableAt ?? localSource.firstAvailableAt,
    retrievedAt: localSource.retrievedAt,
    identityBasis: fact.identityBasis,
    identitySourceIds: fact.identitySourceIds,
    identityVerified: fact.identityVerified,
    kind: fact.milestone,
    date: fact.date,
    status: fact.verification ?? 'reported',
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

const receipt = {
  schemaVersion: 1,
  status: 'failed',
  origin,
  checkedAt: new Date().toISOString(),
  readOnly: true,
  expected: { version: EXPECTED.version, rootSHA256: EXPECTED.rootSHA256, counts: EXPECTED.counts }
};
try {
  localContract();
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
  assert.deepEqual(sortedObject(statuses), sortedObject(EXPECTED.ledger), 'V47 exact coverage ledger statuses');
  receipt.ledger = { records: ledger.records.length, items: Object.values(statuses).reduce((sum, count) => sum + count, 0), statuses: sortedObject(statuses), annualSlots, manifestRootVerified: true };

  const eventsResult = await getJSON('/map/api/events');
  const events = eventsResult.body;
  assertManifest(events.manifest, 'events');
  assert.equal(events.events.length, EXPECTED.counts.events, 'V47 event count');
  assert.equal(events.sources.length, EXPECTED.counts.sources, 'V47 source count');
  assert.equal(events.exposures.length, EXPECTED.counts.exposures, 'V47 exposure count');
  assert.equal(events.classification, 'event_evidence_not_causal_price_effects', 'Event classification');
  const remoteSource = events.sources.find(source => source.id === EXPECTED.sourceId);
  assert.ok(remoteSource, 'V47 DLD source is absent from the global source register');
  assert.deepEqual(stable(remoteSource), stable(localSnapshot.sources.find(source => source.id === EXPECTED.sourceId)), 'V47 DLD source metadata changed');
  receipt.globalEvents = { events: events.events.length, sources: events.sources.length, exposures: events.exposures.length, manifestRootVerified: true };
  receipt.authoritySource = { id: remoteSource.id, publisher: remoteSource.publisher, retrievedAt: remoteSource.retrievedAt, sourcesAdded: 1 };

  const recordResults = await Promise.all(EXPECTED.records.map(async expected => ({ expected, ...(await getJSON('/map/api/record-history?' + new URLSearchParams({ recordId: expected.recordId }))) })));
  const allFacts = [], authoritySources = new Set(), recordProofs = [];
  for (const { expected, body } of recordResults) {
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
    const allV47 = (record.lifecycle || []).filter(item => String(item.id || '').startsWith('dld47-'));
    assert.deepEqual(allV47.map(item => item.id).sort(), [...expected.factIds].sort(), `${expected.recordId} V47 lifecycle fact identities`);
    for (const item of allV47) {
      const local = localFacts.get(item.id);
      assert.ok(local, `${expected.recordId} returns an unexpected V47 fact`);
      assert.deepEqual(stable(actualLifecycle(item)), stable(expectedLifecycle(local)), `${expected.recordId} lifecycle fact ${item.id}`);
      assert.ok(!['completion', 'actual_completion', 'handover', 'occupancy', 'delivery'].includes(item.kind), `${item.id} falsely infers actual completion/handover/occupancy`);
      assert.notEqual(item.eventStatus, 'actual', `${item.id} falsely marks a reported status as actual`);
      assert.deepEqual(item.sourceIds, [EXPECTED.sourceId], `${item.id} source linkage`);
      allFacts.push(item);
      authoritySources.add(item.sourceIds[0]);
    }
    const financialContainers = [record.observations, body.observations, body.validatedObservations, body.historySeries, record.currentSnapshot, record.priorCurrentSnapshots, body.scenarios?.priceAnchor, body.scenarios?.rentAnchor];
    assert.ok(financialContainers.every(container => !identifiers(container).has(EXPECTED.sourceId)), `${expected.recordId} promotes V47 authority evidence into financial data`);
    assert.deepEqual(body.scenarios?.targetYears, Array.from({ length: EXPECTED.targetYears.slots }, (_, index) => EXPECTED.targetYears.first + index), `${expected.recordId} annual scenario target slots`);
    assert.equal(record.scenarioCoverage?.firstYear, EXPECTED.targetYears.first, `${expected.recordId} scenario coverage first year`);
    assert.equal(record.scenarioCoverage?.lastYear, EXPECTED.targetYears.last, `${expected.recordId} scenario coverage endpoint`);
    assert.equal(record.scenarioCoverage?.approvedAnnualPoints, 0, `${expected.recordId} must not claim V47 annual forecast points`);
    recordProofs.push({ recordId: record.id, name: record.name, authorityProjectNumber: expected.projectNumber, factIds: [...expected.factIds].sort() });
  }
  assert.equal(allFacts.length, EXPECTED.facts, 'V47 lifecycle fact count across exact identities');
  assert.equal(new Set(allFacts.map(item => item.id)).size, EXPECTED.facts, 'V47 lifecycle fact IDs are not unique');
  assert.deepEqual([...authoritySources], [EXPECTED.sourceId], 'V47 must retain one authority source for its lifecycle facts');
  receipt.selectedRecordHistory = { records: recordProofs.length, identities: recordProofs, lifecycleFacts: allFacts.length, authoritySources: [...authoritySources], financialObservationsAdded: 0, inferredActualCompletionHandoverOrOccupancy: 0, annualTargetYears: EXPECTED.targetYears };

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
} catch (error) {
  receipt.passed = false;
  receipt.error = error?.stack || String(error);
  process.exitCode = 1;
}
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ receipt: output, status: receipt.status, version: receipt.version || EXPECTED.version, rootSHA256: receipt.rootSHA256 || EXPECTED.rootSHA256, error: receipt.error || null }, null, 2));
