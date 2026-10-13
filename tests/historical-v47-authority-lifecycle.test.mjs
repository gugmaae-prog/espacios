import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';

const read = (path) => JSON.parse(fs.readFileSync(path));
const unpack = (path) => JSON.parse(gunzipSync(fs.readFileSync(path)));
const snapshot = read('data/historical-intelligence-20261003.json');
const publication = read('data/historical-intelligence/publication-manifest.json');
const packet = read('data/historical-intelligence/dld-lifecycle-pass47-20261013.json');
const before = unpack('data/historical-intelligence/objects/9912e0a2c673160168f5f223ec67c482e230db5bca51a532d4fe0d2e64eea672.json.gz');
const current = unpack(`data/historical-intelligence/objects/${publication.rootIndex.sha256}.json.gz`);

test('V47 appends only bounded exact-ID authority lifecycle/status evidence to five projects', () => {
  assert.equal(snapshot.version, '20261013-enrichment-v47');
  assert.equal(publication.version, snapshot.version);
  assert.equal(packet.publicationStatus, 'prepared_not_integrated');
  assert.equal(packet.financialObservationsAdded, 0);
  assert.equal(packet.facts.length, 15);
  assert.equal(new Set(packet.facts.map((fact) => fact.recordId)).size, 5);
  assert.equal(snapshot.manifest.historicalObservationRows, 633891);
  assert.equal(snapshot.manifest.historicalSeriesCount, 16872);
  assert.equal(snapshot.sources.length, before.sources.length + 1);
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

test('V47 retains authority status semantics and quarantines invalid dates', () => {
  const retained = snapshot.records.flatMap((record) => record.lifecycle)
    .filter((item) => item.id.startsWith('dld47-'));
  assert.equal(retained.length, 15);
  assert.equal(retained.filter((item) => item.kind === 'registration').length, 5);
  assert.equal(retained.filter((item) => item.kind === 'construction_progress').length, 5);
  assert.equal(retained.filter((item) => item.kind === 'authority_status_snapshot').length, 5);
  assert.ok(retained.every((item) => !['completion', 'actual_completion', 'handover', 'occupancy', 'delivery'].includes(item.kind)));
  assert.ok(retained.every((item) => item.date.start <= '2026-10-13'));
  assert.equal(packet.quarantinedFields.length, 2);
  assert.ok(packet.quarantinedFields.every((item) => item.raw === '01/01/1'));
  assert.equal(packet.reconciledExistingLifecycle.length, 5);
  assert.ok(packet.reconciledExistingLifecycle.every((item) => item.reconciliation.includes('no duplicate fact')));
});
