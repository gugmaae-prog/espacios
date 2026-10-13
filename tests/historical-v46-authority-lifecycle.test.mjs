import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';

const read = (path) => JSON.parse(fs.readFileSync(path));
const unpack = (path) => JSON.parse(gunzipSync(fs.readFileSync(path)));
const snapshot = read('data/historical-intelligence-20261003.json');
const publication = read('data/historical-intelligence/publication-manifest.json');
const packet = read('data/historical-intelligence/dld-lifecycle-pass46-20261013.json');
const before = unpack('data/historical-intelligence/objects/1c17824d39f4399e1fb1088bb52c2a0e761cb2e935286c617e25c883b4afa2c0.json.gz');
const current = unpack(`data/historical-intelligence/objects/${publication.rootIndex.sha256}.json.gz`);

test('V46 appends only bounded authority lifecycle/status evidence to nine verified project records', () => {
  assert.equal(snapshot.version, '20261013-enrichment-v46');
  assert.equal(publication.version, snapshot.version);
  assert.equal(packet.publicationStatus, 'prepared_not_integrated');
  assert.equal(packet.financialObservationsAdded, 0);
  assert.equal(packet.facts.length, 39);
  assert.equal(new Set(packet.facts.map((fact) => fact.recordId)).size, 9);
  assert.equal(snapshot.manifest.historicalObservationRows, 633891);
  assert.equal(snapshot.manifest.historicalSeriesCount, 16872);
  assert.equal(snapshot.sources.length, before.sources.length + 2);
  assert.deepEqual(snapshot.sources.slice(0, before.sources.length), before.sources);
  assert.deepEqual(current.sources, snapshot.sources);

  const previous = new Map(before.records.map((record) => [record.id, record]));
  const changed = new Set(packet.facts.map((fact) => fact.recordId));
  for (const record of snapshot.records) {
    const prior = previous.get(record.id);
    assert.ok(prior, record.id);
    for (const key of ['currentSnapshot', 'scenarioInputs', 'scenarioCoverage', 'observations']) {
      assert.deepEqual(record[key], prior[key], `${record.id}:${key}`);
    }
    if (!changed.has(record.id)) {
      assert.deepEqual(record.lifecycle, prior.lifecycle, `${record.id}:lifecycle`);
      continue;
    }
    assert.deepEqual(record.lifecycle.slice(0, prior.lifecycle.length), prior.lifecycle, `${record.id}:lifecycle prefix`);
    const additions = record.lifecycle.slice(prior.lifecycle.length);
    const expected = packet.facts.filter((fact) => fact.recordId === record.id);
    assert.equal(additions.length, expected.length, record.id);
    assert.deepEqual(additions.map((item) => item.id).sort(), expected.map((fact) => fact.id).sort(), record.id);
    assert.ok(additions.every((item) => item.scope === 'subject' && item.primaryEvidence && item.identityVerified), record.id);
  }
});

test('V46 preserves source semantics and quarantines invalid dates', () => {
  const retained = snapshot.records.flatMap((record) => record.lifecycle)
    .filter((item) => item.id.startsWith('dld46-'));
  assert.equal(retained.length, 39);
  assert.equal(retained.filter((item) => item.kind === 'authority_status_snapshot').length, 9);
  assert.equal(retained.filter((item) => item.kind === 'construction_progress').length, 9);
  assert.equal(retained.filter((item) => item.kind === 'target_completion' && item.eventStatus === 'planned').length, 5);
  assert.ok(retained.every((item) => !['completion', 'occupancy', 'handover', 'delivery'].includes(item.kind)));
  assert.ok(retained.every((item) => item.date.start <= '2026-10-13' || item.eventStatus === 'planned'));
  assert.equal(packet.quarantinedFields.length, 3);
  assert.ok(packet.quarantinedFields.every((item) => item.raw === '01/01/1'));
  const expectedById = new Map(packet.facts.map((fact) => [fact.id, fact]));
  const avenue = retained.filter((item) => expectedById.get(item.id)?.recordId === 'project:binghatti-avenue-apartments-for-sale-in-al-jaddaf-dubai');
  assert.deepEqual(avenue.map((item) => item.kind).sort(), ['authority_status_snapshot', 'construction_progress']);
  assert.equal(avenue.find((item) => item.kind === 'construction_progress').progressPercent, 100);
});
