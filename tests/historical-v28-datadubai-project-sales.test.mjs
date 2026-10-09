import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {parseEvidenceDate, validateObservation} from '../src/historical-intelligence/core.mjs';

const json = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const snapshot = json('data/historical-intelligence-20261003.json');
const pass = json('data/historical-intelligence/datadubai-project-sales-20261008.json');
const readCsv = () => zlib.gunzipSync(fs.readFileSync('data/historical-intelligence/datadubai-project-sales-20261008.csv.gz')).toString('utf8');

test('V28 adds only identity-checked DLD-derived project rolling-12-month sales summaries', () => {
  assert.ok(['20261008-enrichment-v28', '20261008-enrichment-v29','20261008-enrichment-v30','20261008-enrichment-v31','20261008-enrichment-v32','20261008-enrichment-v33','20261008-enrichment-v34','20261008-enrichment-v35','20261008-enrichment-v36','20261008-enrichment-v37','20261008-enrichment-v38'].includes(snapshot.version));
  assert.equal(snapshot.records.length, 1860);
  assert.equal(snapshot.records.filter((record) => record.type === 'project').length, 1645);
  assert.equal(snapshot.records.filter((record) => record.type === 'community').length, 215);
  assert.equal(pass.passId, 'datadubai-project-sales-20261008');
  assert.equal(pass.collection.catalogueRecordsAdded, 36);
  assert.equal(pass.collection.priceSeriesAdded, 36);
  assert.equal(pass.collection.pricePerSqftSeriesAdded, 27);
  assert.equal(pass.collection.aggregatePointsAdded, 63);
  assert.equal(pass.collection.completenessClaim, false);
  assert.deepEqual(pass.collection.quarantines, []);

  const bytes = fs.readFileSync('data/historical-intelligence/datadubai-project-sales-20261008.csv.gz');
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), pass.historyInputs[0].sha256);
  const csvRows = readCsv().trim().split('\n');
  assert.equal(csvRows.length - 1, 63);
  assert.equal(pass.historyInputs[0].rowCount, 63);

  const addedIds = new Set(pass.seriesLinks.map((link) => link.recordId));
  assert.equal(addedIds.size, 36);
  assert.equal(pass.seriesLinks.length, 63);
  assert.equal(pass.sources.length, 36);
  const sourceIds = new Set(pass.sources.map((source) => source.id));
  for (const link of pass.seriesLinks) {
    assert.equal(link.scope, 'subject');
    assert.equal(link.identityVerified, true);
    assert.ok(link.identitySourceIds.every((id) => id === 'catalogue-core' || sourceIds.has(id) || snapshot.sources.some((source) => source.id === id)));
    assert.match(link.identityBasis, /unique DLD project number/);
  }

  for (const recordId of addedIds) {
    const record = snapshot.records.find((row) => row.id === recordId);
    const series = record.historySeries.filter((row) => row.sourceId?.startsWith('datadubai-project-'));
    assert.ok(series.length >= 1 && series.length <= 2);
    for (const item of series) {
      assert.equal(item.scope, 'subject');
      assert.equal(item.identityVerified, true);
      assert.equal(item.subjectRecordId, record.id);
      assert.equal(item.frequency, 'rolling_12_months');
      assert.equal(item.pointCount, 1);
      const point = item.points[0];
      assert.equal(point[0], '2026-09');
      assert.ok(point[1] > 0);
      assert.ok(point[2] >= 50);
      assert.match(point[3], /not a monthly observation/);
      assert.match(point[13], /Window: 2025-10 through 2026-09/);
      assert.match(point[13], /not a single-month sample/);
      assert.equal(point[14], null, 'raw source row stays in the immutable full-series partition, not the record summary');
      const validation = validateObservation({
        recordId: record.id, metric: 'price', frequency: item.frequency, period: point[0], value: point[1],
        unit: item.unit, sampleCount: point[2], sourceId: item.sourceId, scope: item.scope,
        identityVerified: item.identityVerified, identitySourceIds: item.identitySourceIds,
        subjectRecordId: item.subjectRecordId, fromHistorySeries: true, seriesScope: item.scope,
        seriesIdentityVerified: item.identityVerified, observationKind: item.observationKind,
      }, record, {asOf: snapshot.asOf, sources: snapshot.sources});
      assert.equal(validation.issues.length, 0);
      assert.equal(validation.direct, true);
      assert.equal(validation.displayEligible, true);
    }
    assert.equal(record.researchStatus.itemCoverage.complete_registered_sale_history.status, 'unestablished');
    assert.equal(record.researchStatus.itemCoverage.validated_price_forecast.status, 'unestablished');
  }
  assert.equal(snapshot.manifest.approved2080ForecastRecords, 0);
  assert.equal(snapshot.records.every((record) => record.researchStatus.itemCoverage.complete_registered_sale_history.status === 'unestablished'), true);
  assert.equal(snapshot.records.every((record) => record.researchStatus.itemCoverage.complete_signed_rent_history.status === 'unestablished'), true);
});

test('V28 source metadata preserves attribution and point-in-time limits', () => {
  for (const source of pass.sources) {
    assert.equal(source.datasetVersion, '56d6613fe0ebefa18eac21b727a8f22657f9d9ff');
    assert.equal(source.datasetFileSha256, 'e2f8da656f3b0e164daf6009eb0c4e2c402cab2df5e34d8eefb6a5f3b200baca');
    assert.equal(source.sourceDataThrough, '2026-10-06');
    assert.equal(source.sourceWindow, 'Oct 2025 – Sep 2026');
    assert.equal(source.rawTransactionRowsRedistributed, false);
    assert.match(source.licence, /CC BY 4\.0/);
    assert.ok(source.firstAvailableAt.startsWith('2026-10-08T'));
  }
  assert.match(pass.methodology, /not a monthly point/);
  assert.match(pass.methodology, /valuation/);
  assert.match(pass.methodology, /no earlier backtest may use it/);
  assert.deepEqual(parseEvidenceDate('2026-09'), {start: '2026-09-01', end: '2026-09-30', precision: 'month'});
});
