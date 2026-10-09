import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const snapshot = JSON.parse(readFileSync(new URL('../data/historical-intelligence-20261003.json', import.meta.url), 'utf8'));
const record = snapshot.records.find(row => row.id === 'community:Dubai:palm-jebel-ali');
const ids = [
  'pja-2003-garden-home-launch-quote',
  'pja-2003-signature-villa-launch-quote',
  'pja-2003-waterhome-lower-launch-quote',
  'pja-2003-waterhome-higher-launch-quote',
  'pja-2005-waterhome-resale-quote-floor',
];

test('V24 adds dated Palm Jebel Ali quote references without changing direct-sale history', () => {
  assert.ok(['20261008-enrichment-v24','20261008-enrichment-v25','20261008-enrichment-v26','20261008-enrichment-v27','20261008-enrichment-v28','20261008-enrichment-v29','20261008-enrichment-v30','20261008-enrichment-v31','20261008-enrichment-v32','20261008-enrichment-v33','20261008-enrichment-v34','20261008-enrichment-v35','20261008-enrichment-v36','20261008-enrichment-v37','20261008-enrichment-v38','20261009-enrichment-v39'].includes(snapshot.version));
  assert.equal(snapshot.records.length, 1860);
  assert.ok(record);
  const observations = record.observations.filter(row => ids.includes(row.id));
  assert.deepEqual(observations.map(row => row.id), ids);
  assert.deepEqual(observations.map(row => row.value), [2860000, 5115000, 2000000, 3000000, 2900000]);
  assert.deepEqual(observations.map(row => row.period), ['2003-05', '2003-05', '2003-05', '2003-05', '2005-03']);
  for (const row of observations) {
    assert.equal(row.scope, 'published_reference');
    assert.equal(row.identityVerified, false);
    assert.equal(row.observationKind, 'asking_quote');
    assert.equal(row.publishedAt, '2005-03-25T00:00:00Z');
    assert.equal(row.firstAvailableAt, '2005-03-25T00:00:00Z');
    assert.match(row.observationDateBasis, /not a registered sale|not a transaction/i);
  }
  assert.equal(record.coverageSummary.directSaleTransactionCount, 415);
  assert.equal(record.coverageSummary.directSalePeriods, 57);
  assert.equal(record.coverageSummary.directRentTransactionCount, 0);
  assert.equal(record.coverageSummary.newFinancialEvidencePoints, 5);
  assert.equal(record.currentSnapshot.observationId?.startsWith('pja-') ?? false, false);
  assert.equal(record.researchStatus.itemCoverage.advertised_prices.status, 'partial');
  assert.equal(record.researchStatus.itemCoverage.complete_registered_sale_history.status, 'unestablished');
  assert.equal(record.researchStatus.itemCoverage.signed_rent_history.status, 'missing');
  assert.equal(snapshot.manifest.approved2080ForecastRecords, 0);
});

test('V24 source metadata keeps the contemporaneous report and quote limits explicit', () => {
  const source = snapshot.sources.find(row => row.id === 'pja-gulfnews-2005-real-estate-report');
  assert.ok(source);
  assert.equal(source.publishedAt, '2005-03-25T00:00:00Z');
  assert.equal(source.firstAvailableAt, '2005-03-25T00:00:00Z');
  assert.equal(source.rawBodyRetained, false);
  assert.equal(source.rawBodiesRedistributed, false);
  assert.match(source.classification, /broker_market_report/);
  const packet = JSON.parse(readFileSync(new URL('../data/historical-intelligence/palm-jebel-ali-historical-quotes-20261008.json', import.meta.url), 'utf8'));
  assert.equal(packet.collection.passId, 'pja-historical-launch-quotes-20261008');
  assert.equal(packet.collection.acceptedFinancialFacts, 5);
});
