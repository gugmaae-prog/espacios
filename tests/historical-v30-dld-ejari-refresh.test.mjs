import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';

const snapshot = JSON.parse(fs.readFileSync('data/historical-intelligence-20261003.json', 'utf8'));
const publication = JSON.parse(fs.readFileSync('data/historical-intelligence/publication-manifest.json', 'utf8'));
const packet = JSON.parse(zlib.gunzipSync(fs.readFileSync('data/historical-intelligence/dld-rent-recapture-20261008.json.gz')));
const sources = new Map(snapshot.sources.map((source) => [source.id, source]));
const records = new Map(snapshot.records.map((record) => [record.id, record]));
const sourceId = 'dld-official-rents-recapture-20261008';
const rentSource = sources.get(sourceId);

test('V31 retains V30 project rent evidence and the complete catalogue/event ledgers', () => {
  assert.equal(snapshot.version, '20261008-enrichment-v31');
  assert.equal(publication.version, snapshot.version);
  assert.deepEqual(publication.counts, {
    collectedHistoricalRows: 634107, communities: 215, events: 105, exposures: 7382,
    historicalRows: 633891, originalCollectionRows: 122268, projects: 1645, records: 1860,
    rightsPendingRows: 216, series: 16872, sources: 3295, supplementHistoricalRows: 18539,
  });
  assert.equal(snapshot.manifest.historicalSeriesCount, 16872);
  assert.equal(snapshot.records.reduce((count, record) => count + record.historySeries.length, 0), 13230);
  assert.equal(snapshot.manifest.approved2080ForecastRecords, 0);
  const rentCoverage = snapshot.records.map((record) => record.researchStatus.itemCoverage.signed_rent_history.status);
  assert.equal(rentCoverage.filter((status) => status === 'present').length, 132);
  assert.equal(rentCoverage.filter((status) => status === 'partial').length, 3);
  assert.equal(rentCoverage.filter((status) => status === 'missing').length, 1725);
  assert.equal(snapshot.records.filter((record) => record.type === 'project').length, 1645);
  assert.equal(snapshot.records.filter((record) => record.type === 'community').length, 215);
  assert.equal(snapshot.events.length, 105);
  assert.equal(snapshot.exposures.length, 7382);
});

test('the DLD rent vintage has dated, licensed provenance and exact source bounds', () => {
  assert.equal(packet.schemaVersion, 1);
  assert.equal(packet.passId, 'dld-ejari-exact-project-rent-recapture-20261007');
  assert.equal(packet.asOf, '2026-10-07');
  assert.equal(packet.catalogueRecordCount, 1860);
  assert.equal(packet.catalogueProjectCount, 1645);
  assert.equal(packet.catalogueCommunityCount, 215);
  assert.equal(packet.observationCount, 35198);
  assert.equal(packet.recordsWithRentEvidence, 90);
  assert.equal(packet.verifiedProjectIdCount, 280);
  assert.equal(rentSource.url, 'https://data.dubai/en/l/468586');
  assert.equal(rentSource.licence, 'Dubai Open Data Licence; attributed derivatives allowed; original data resale prohibited');
  assert.equal(rentSource.sourceRows, 10573532);
  assert.equal(rentSource.eligibleUniqueContracts, 71477);
  assert.equal(rentSource.exactProjectRecords, 90);
  assert.equal(rentSource.observationStart, '2015-01-25');
  assert.equal(rentSource.observationEnd, '2026-10-07');
  assert.equal(rentSource.sourceSnapshotDate, '2026-10-07');
  assert.equal(rentSource.publicationDateStatus, 'unknown');
  assert.equal(rentSource.firstAvailableAt, '2026-10-08T15:53:50Z');
  assert.equal(rentSource.duplicateContractIdsQuarantined, 0);
  assert.equal(rentSource.sparseMedianValuesWithheld, 31744);
  assert.equal(rentSource.recordsWithContractStartsAfter2026_10_03, 64);
  assert.equal(rentSource.contractRowsAfter2026_10_03, 180);
  assert.equal(rentSource.rawContractsRedistributed, false);
  assert.equal(rentSource.rawRowsRedistributed, false);
  assert.equal(snapshot.manifest.dldEjariRentRecapture.newPeriodCells, 84);
  assert.equal(snapshot.manifest.dldEjariRentRecapture.newSeries, 0);
  assert.equal(snapshot.manifest.dldEjariRentRecapture.refreshedSeries, 1974);
  assert.equal(snapshot.manifest.dldEjariRentRecapture.communityRecordsChanged, 0);
});

test('identity joins remain one-to-one and sparse price statistics stay withheld', () => {
  assert.equal(packet.series.length, 1974);
  const recordIds = new Set();
  const seriesIds = new Set();
  for (const series of packet.series) {
    const record = records.get(series.recordId);
    assert.ok(record, `catalogue record exists: ${series.recordId}`);
    assert.equal(record.type, 'project');
    recordIds.add(record.id);
    assert.ok(!seriesIds.has(series.id));
    seriesIds.add(series.id);
    assert.ok(record.registerEvidence.some((item) => item.identityVerified === true
      && item.scope === 'subject'
      && item.sourceIds.includes('dld-official-projects-20260706')
      && String(item.fields?.projectId) === String(series.registeredProjectId)));
    assert.ok(['monthly', 'quarterly'].includes(series.frequency));
    assert.ok(series.points.length > 0);
    const compact = record.historySeries.find((item) => item.sourceId === sourceId
      && item.metric === 'rent'
      && item.segment === series.segment
      && item.registration === series.registration
      && item.frequency === series.frequency);
    assert.ok(compact, `direct history link exists: ${series.id}`);
    assert.equal(compact.scope, 'subject');
    assert.equal(compact.identityVerified, true);
    assert.equal(compact.sourceId, sourceId);
    assert.match(compact.periodCoverage.startDate, /^\d{4}-\d{2}-01$/);
    assert.match(compact.periodCoverage.endDate, /^\d{4}-\d{2}-\d{2}$/);
    for (const point of series.points) {
      assert.ok(point.sampleCount > 0);
      if (series.frequency === 'monthly') assert.ok(point.period <= '2026-10');
      else assert.ok(point.period <= '2026Q4');
      assert.ok(point.medianAEDYear === null || point.medianAEDYear > 0);
      if (point.sampleCount < 20) {
        assert.equal(point.medianAEDYear, null);
        assert.equal(point.p25AEDYear, null);
        assert.equal(point.p75AEDYear, null);
      }
      assert.ok(!Object.keys(point).some((key) => /contract.?id/i.test(key)));
    }
  }
  assert.equal(recordIds.size, 90);
});
