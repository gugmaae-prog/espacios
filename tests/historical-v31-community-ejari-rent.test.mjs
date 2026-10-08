import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';

const snapshot = JSON.parse(fs.readFileSync('data/historical-intelligence-20261003.json', 'utf8'));
const publication = JSON.parse(fs.readFileSync('data/historical-intelligence/publication-manifest.json', 'utf8'));
const packet = JSON.parse(zlib.gunzipSync(fs.readFileSync('data/historical-intelligence/dld-community-ejari-rent-pass31-20261007.json.gz')));
const priorRoot = JSON.parse(zlib.gunzipSync(fs.readFileSync('data/historical-intelligence/objects/cf17752fd97e3e5e930d3d100cdbec20f16f05e1f3c39ad59fef52964f944e0d.json.gz')));
const currentRoot = JSON.parse(zlib.gunzipSync(fs.readFileSync(publication.rootIndex.path)));
const sourceId = 'dld-official-community-master-ejari-rents-20261007';
const records = new Map(snapshot.records.map((record) => [record.id, record]));
const normalize = (value) => value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');

test('V31 preserves the catalogue, prior evidence, events and exposes only exact community rent matches', () => {
  assert.equal(snapshot.version, '20261008-enrichment-v31');
  assert.equal(publication.version, snapshot.version);
  assert.equal(publication.counts.records, 1860);
  assert.equal(publication.counts.projects, 1645);
  assert.equal(publication.counts.communities, 215);
  assert.equal(snapshot.records.filter((record) => record.type === 'project').length, 1645);
  assert.equal(snapshot.records.filter((record) => record.type === 'community').length, 215);
  assert.ok(snapshot.sources.some((source) => source.id === sourceId));
  assert.equal(priorRoot.version, '20261008-enrichment-v30');
  assert.deepEqual(snapshot.records.map((record) => record.id).sort(), priorRoot.records.map((record) => record.id).sort());
  assert.deepEqual(snapshot.events, priorRoot.events);
  assert.deepEqual(snapshot.exposures, priorRoot.exposures);
  assert.ok(priorRoot.sources.every((source) => snapshot.sources.some((current) => current.id === source.id)));
  const currentSeries = new Set(currentRoot.series.map((series) => series.id));
  assert.ok(priorRoot.series.every((series) => currentSeries.has(series.id)));
  assert.equal(snapshot.events.length, 105);
  assert.equal(snapshot.exposures.length, 7382);
  assert.equal(snapshot.manifest.dldCommunityEjariRentPass31.matchedExactDubaiCommunities, 45);
  assert.equal(snapshot.manifest.dldCommunityEjariRentPass31.rawContractIdsRedistributed, false);
  assert.equal(snapshot.manifest.dldCommunityEjariRentPass31.rawContractRowsRedistributed, false);
});

test('community Ejari aggregates preserve exact master labels and area IDs and never publish sparse medians', () => {
  assert.equal(packet.passId, 'dld-ejari-exact-community-master-rent-pass31-20261007');
  assert.equal(packet.catalogueRecordCount, 1860);
  assert.equal(packet.catalogueCommunityCount, 215);
  assert.equal(packet.matchedExactDubaiCommunities, 45);
  assert.equal(packet.seriesCount, packet.series.length);
  assert.equal(packet.observationCount, packet.series.reduce((sum, series) => sum + series.points.length, 0));
  const ids = new Set();
  const communityIds = new Set();
  for (const series of packet.series) {
    assert.ok(!ids.has(series.id));
    ids.add(series.id);
    const record = records.get(series.recordId);
    assert.ok(record, `record exists: ${series.recordId}`);
    assert.equal(record.type, 'community');
    assert.equal(record.emirate, 'Dubai');
    communityIds.add(record.id);
    assert.ok(series.masterProjectLabel.length > 0);
    assert.ok(series.masterProjectLabel.every((label) => normalize(label) === normalize(record.name)));
    assert.ok(series.areaId);
    assert.ok(series.areaName);
    assert.equal(series.metric, 'median_rent_aed_year');
    assert.equal(series.unit, 'AED/year');
    assert.ok(['monthly', 'quarterly'].includes(series.frequency));
    assert.equal(series.points.length, series.pointCount);
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
      assert.ok(!Object.keys(point).some((key) => /contract.?id|tenant/i.test(key)));
    }
  }
  assert.equal(communityIds.size, 45);
  const source = packet.sources.find((item) => item.id === sourceId);
  assert.ok(source);
  assert.equal(source.sourceRows, 10573532);
  assert.equal(source.eligibleUniqueContracts, 1447212);
  assert.equal(source.duplicateContractIdsQuarantined, 2631);
  assert.equal(source.matchedExactDubaiCommunities, 45);
  assert.equal(source.nativeAreaIds, 37);
  assert.equal(source.observationStart, '2007-12-30');
  assert.equal(source.observationEnd, '2026-10-07');
  assert.equal(source.rawRowsRedistributed, false);
  assert.equal(source.rawContractsRedistributed, false);
  assert.match(source.populationOverlap, /not additive/i);
  assert.match(packet.methodology, /not complete lifetime history/i);
});

test('V31 links community rent without certifying complete rent history or future accuracy', () => {
  const linked = snapshot.records.filter((record) => record.type === 'community'
    && record.historySeries.some((series) => series.sourceId === sourceId));
  assert.equal(linked.length, 45);
  for (const record of linked) {
    const links = record.historySeries.filter((series) => series.sourceId === sourceId);
    assert.ok(links.length > 0);
    assert.ok(links.every((series) => series.scope === 'subject' && series.identityVerified === true));
    assert.ok(['present', 'partial'].includes(record.researchStatus.itemCoverage.signed_rent_history.status));
    assert.equal(record.researchStatus.itemCoverage.complete_signed_rent_history.status, 'unestablished');
    assert.equal(record.researchStatus.itemCoverage.validated_rent_forecast.status, 'unestablished');
    assert.equal(record.researchStatus.itemCoverage.annual_scenario_inputs.lastYear, 2080);
  }
  assert.equal(snapshot.manifest.approved2080ForecastRecords, 0);
});
