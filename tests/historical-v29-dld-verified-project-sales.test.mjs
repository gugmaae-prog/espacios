import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {validateObservation} from '../src/historical-intelligence/core.mjs';

const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const snapshot = readJson('data/historical-intelligence-20261003.json');
const pass = readJson('data/historical-intelligence/dld-verified-project-sales-enrichment-20261008.json');
const csvPath = 'data/historical-intelligence/dld-verified-project-sales-20261008.csv.gz';
const csvBytes = fs.readFileSync(csvPath);
const csv = zlib.gunzipSync(csvBytes).toString('utf8');
const rows = csv.trim().split('\n');
const parseCsvRow = (row) => {
  const fields = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < row.length; index += 1) {
    const char = row[index];
    if (quoted && char === '"' && row[index + 1] === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      fields.push(field);
      field = '';
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields;
};
const header = parseCsvRow(rows[0]);
const records = new Map(snapshot.records.map((record) => [record.id, record]));

test('V29 verified DLD sale cohorts remain intact in the current catalogue', () => {
  assert.ok(['20261008-enrichment-v29', '20261008-enrichment-v30'].includes(snapshot.version));
  assert.equal(snapshot.records.length, 1860);
  assert.equal(snapshot.records.filter((record) => record.type === 'project').length, 1645);
  assert.equal(snapshot.records.filter((record) => record.type === 'community').length, 215);
  assert.equal(snapshot.manifest.historicalObservationRows, snapshot.version === '20261008-enrichment-v30' ? 565004 : 564920);
  assert.equal(snapshot.manifest.historicalSeriesCount, 15182);
  assert.equal(snapshot.manifest.approved2080ForecastRecords, 0);
  assert.equal(pass.passId, 'dld-verified-project-sales-20261008');
  assert.equal(pass.asOf, '2026-10-08');
  assert.equal(pass.collection.completenessClaim, false);
  assert.equal(pass.collection.distinctCatalogueProjects, 11);
  assert.equal(pass.collection.newExactIdentityRecords, 11);
  assert.equal(pass.collection.distinctRegisteredProjectNumbers, 7);
  assert.equal(pass.collection.sourceRowsScanned, 1798873);
  assert.equal(pass.collection.uniqueTransactionIdsSelected, 4781);
  assert.equal(pass.collection.eligibleUniqueTransactionRowsSelected, 4781);
  assert.equal(pass.collection.priceFormulaChecks, 4781);
  assert.equal(pass.collection.priceFormulaDiscrepancies, 0);
  assert.equal(pass.collection.conflictingDuplicateTransactionIds, 0);
  assert.equal(pass.collection.crossRecordTransactionIdsQuarantined, 0);
  assert.equal(pass.collection.rawRowsAndTransactionIdsRedistributed, false);
  assert.equal(pass.collection.minimumDisplaySample, 20);
  assert.equal(pass.collection.cellsMeetingMinimum, 166);
  assert.equal(pass.collection.sparseCellsWithheldMedian, 1016);
  assert.deepEqual(pass.collection.sourceObservationCoverage, {start: '2016-12-22', end: '2026-10-05'});
  assert.deepEqual(pass.collection.transactionQuarantines, {});
  assert.deepEqual(pass.collection.aliasIdentityQuarantines, {});
  assert.deepEqual(pass.collection.duplicateTransactionRows, {});
  assert.equal(pass.recordResearch.length, 11);
  assert.equal(new Set(pass.recordResearch.map((item) => item.recordId)).size, 11);
  assert.equal(new Set(pass.seriesLinks.map((item) => item.recordId)).size, 11);
  assert.equal(pass.seriesLinks.length, 56);
  assert.equal(pass.facts.length, 0);

  const expectedSources = new Set([
    'dld-official-transactions-recapture-20261008',
    'dld-official-projects-20260706',
    'dld-official-developers-20261001',
    'dld-official-areas-20261002',
  ]);
  for (const item of pass.recordResearch) {
    assert.ok(records.has(item.recordId));
    assert.equal(item.identityReview.status, 'verified_exact_name_developer_and_area');
    assert.equal(item.identityReview.remainingCandidateCount, 0);
    assert.ok(item.identityReview.registeredProjectId);
    assert.equal(item.collectionPasses.reduce((sum, cohort) => sum + cohort.eligibleUniqueTransactionRows, 0) > 0, true);
    assert.ok(item.sourceIds.every((id) => expectedSources.has(id)));
    assert.equal(item.acceptedTransactionObservationCount, 0, 'individual transaction rows are not redistributed');
    assert.match(item.status, /partial and not a complete or lifetime history/);
  }

  for (const link of pass.seriesLinks) {
    const record = records.get(link.recordId);
    assert.ok(record);
    assert.equal(link.scope, 'subject');
    assert.equal(link.identityVerified, true);
    assert.ok(link.identitySourceIds.every((id) => expectedSources.has(id)));
    const series = record.historySeries.find((item) => item.id === link.seriesId);
    assert.ok(series);
    assert.equal(series.subjectRecordId, record.id);
    assert.equal(series.scope, 'subject');
    assert.equal(series.identityVerified, true);
    assert.equal(series.frequency, link.seriesId.includes('-month-') ? 'month' : 'quarterly');
    assert.ok(series.points.length > 0);
    for (const point of series.points) {
      assert.ok(point[1] === null || point[1] > 0);
      assert.ok(point[2] > 0);
      assert.ok(point[2] < 20 ? point[1] === null : point[1] !== null);
      if (point[2] < 20) continue;
      const result = validateObservation({
        recordId: record.id,
        metric: series.metric,
        frequency: series.frequency,
        period: point[0],
        value: point[1],
        unit: series.unit,
        sampleCount: point[2],
        sourceId: series.sourceId,
        scope: series.scope,
        identityVerified: series.identityVerified,
        identitySourceIds: series.identitySourceIds,
        subjectRecordId: series.subjectRecordId,
        fromHistorySeries: true,
        seriesScope: series.scope,
        seriesIdentityVerified: series.identityVerified,
        observationKind: series.observationKind,
      }, record, {asOf: snapshot.asOf, sources: snapshot.sources});
      assert.equal(result.issues.length, 0);
      assert.equal(result.direct, true);
    }
  }
});

test('V29 published aggregates retain source integrity and do not expose transaction-level data', () => {
  const input = pass.historyInputs[0];
  assert.equal(input.path, 'dld-verified-project-sales-20261008.csv.gz');
  assert.equal(input.rowCount, 1182);
  assert.equal(rows.length - 1, 1182);
  assert.equal(crypto.createHash('sha256').update(csvBytes).digest('hex'), input.sha256);
  assert.equal(pass.collection.aggregateCellsByFrequencyAndMetric['month:median_sale_aed'], 423);
  assert.equal(pass.collection.aggregateCellsByFrequencyAndMetric['month:median_sale_aed_sqft'], 423);
  assert.equal(pass.collection.aggregateCellsByFrequencyAndMetric['quarter:median_sale_aed'], 168);
  assert.equal(pass.collection.aggregateCellsByFrequencyAndMetric['quarter:median_sale_aed_sqft'], 168);
  assert.ok(!header.some((column) => /transaction.?id|individual.?price/i.test(column)));
  assert.ok(header.includes('Native row JSON'));
  for (const text of rows.slice(1)) {
    const fields = parseCsvRow(text);
    assert.equal(fields.length, header.length);
    assert.ok(!text.includes('transaction_id'));
    const index = header.indexOf('Native row JSON');
    const native = JSON.parse(fields[index]);
    assert.ok(!Object.keys(native).some((key) => /transaction.?id|raw.?price/i.test(key)));
  }

  const source = snapshot.sources.find((item) => item.id === 'dld-official-transactions-recapture-20261008');
  assert.ok(source);
  assert.equal(source.url, 'https://data.dubai/en/l/470061');
  assert.equal(source.publishedAt, null);
  assert.equal(source.firstAvailableAt, '2026-10-08T14:13:10Z');
  assert.match(source.publicationDateStatus, /unknown/);
  assert.ok(pass.methodology.includes('registration date, not contract execution or transfer date'));
  assert.ok(pass.methodology.includes('not first-ever transactions or complete lifetime price history'));
  assert.equal(snapshot.records.every((record) => record.researchStatus.itemCoverage.validated_price_forecast.status === 'unestablished'), true);
});
