import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));

test('V27 retains six dated Nakheel Palm Jebel Ali frond progress snapshots without price inference', () => {
  const snapshot = read('data/historical-intelligence-20261003.json');
  const pass = read('data/historical-intelligence/palm-jebel-ali-nakheel-progress-20261008.json');
  const record = snapshot.records.find((item) => item.id === 'community:Dubai:palm-jebel-ali');

  assert.ok(['20261008-enrichment-v27', '20261008-enrichment-v28','20261008-enrichment-v29','20261008-enrichment-v30','20261008-enrichment-v31','20261008-enrichment-v32','20261008-enrichment-v33','20261008-enrichment-v34','20261008-enrichment-v35','20261008-enrichment-v36','20261008-enrichment-v37','20261008-enrichment-v38','20261009-enrichment-v39'].includes(snapshot.version));
  assert.equal(pass.facts.length, 6);
  assert.equal(pass.sources.length, 1);
  assert.equal(pass.sources[0].sourceSnapshotDate, '2026-03-10');
  assert.equal(pass.sources[0].publishedAt, null);
  assert.equal(pass.sources[0].sha256, '9f5c8ccaa4ed0d9f31a5fa540eb67413c800889a7457d0d38c36b1e193d2615c');
  assert.equal(snapshot.manifest.palmJebelAliNakheelProgressMarch2026.frondSnapshotsAdded, 6);
  assert.deepEqual(snapshot.manifest.palmJebelAliNakheelProgressMarch2026.fronds, ['K', 'L', 'M', 'N', 'O', 'P']);

  const expected = new Map([['K', 27.71], ['L', 24.71], ['M', 22.10], ['N', 29.20], ['O', 37.44], ['P', 20.50]]);
  for (const fact of pass.facts) {
    assert.equal(fact.recordId, record.id);
    assert.equal(fact.identityVerified, true);
    assert.equal(fact.date.start, '2026-03-10');
    assert.equal(fact.verification, 'reported');
    assert.equal(fact.primaryEvidence, true);
    assert.equal(fact.publishedAt, null);
    const frond = fact.label.split(' ')[1];
    assert.equal(fact.progressPercent, expected.get(frond));
    const stored = record.lifecycle.find((item) => item.id === fact.id);
    assert.ok(stored, `lifecycle item stored for Frond ${frond}`);
    assert.equal(stored.dateBasis, 'Nakheel-reported internal inspection date; not the page publication date.');
    assert.equal(stored.progressPercent, expected.get(frond));
    assert.match(stored.note, /not a whole-island completion measure/);
  }

  assert.equal(pass.methodology.includes('The 26.75% overall progress figure is excluded'), true);
  assert.equal(snapshot.manifest.palmJebelAliNakheelProgressMarch2026.financialObservationsAdded, 0);
  assert.equal(snapshot.manifest.palmJebelAliNakheelProgressMarch2026.forecastRecordsAdded, 0);
  assert.equal(snapshot.manifest.approved2080ForecastRecords, 0);
});
