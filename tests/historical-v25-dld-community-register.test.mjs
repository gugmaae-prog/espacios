import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {test} from 'node:test';
import * as core from '../src/historical-intelligence/core.mjs';

const base = new URL('../data/historical-intelligence/', import.meta.url);
const snapshot = JSON.parse(readFileSync(new URL('../data/historical-intelligence-20261003.json', import.meta.url), 'utf8'));
const sidecar = JSON.parse(readFileSync(new URL('dld-project-register-community-context-20261008.json', base), 'utf8'));
const publication = JSON.parse(readFileSync(new URL('publication-manifest.json', base), 'utf8'));
const runtime = JSON.parse(readFileSync(new URL('runtime-index.json', base), 'utf8'));

test('V25 appends exact DLD project-register context without changing financial history', () => {
  assert.ok(['20261008-enrichment-v25', '20261008-enrichment-v26','20261008-enrichment-v27','20261008-enrichment-v28','20261008-enrichment-v29','20261008-enrichment-v30','20261008-enrichment-v31','20261008-enrichment-v32','20261008-enrichment-v33','20261008-enrichment-v34','20261008-enrichment-v35','20261008-enrichment-v36'].includes(snapshot.version));
  assert.equal(snapshot.records.length, 1860);
  assert.equal(snapshot.records.filter(row => row.type === 'project').length, 1645);
  assert.equal(snapshot.records.filter(row => row.type === 'community').length, 215);
  assert.equal(snapshot.sources.length, snapshot.version === '20261008-enrichment-v36' ? 3340 : snapshot.version === '20261008-enrichment-v35' ? 3334 : snapshot.version === '20261008-enrichment-v34' ? 3333 : snapshot.version === '20261008-enrichment-v33' ? 3320 : snapshot.version === '20261008-enrichment-v32' ? 3306 : snapshot.version === '20261008-enrichment-v31' ? 3295 : snapshot.version === '20261008-enrichment-v30' ? 3294 : snapshot.version === '20261008-enrichment-v29' ? 3292 : snapshot.version === '20261008-enrichment-v28' ? 3291 : snapshot.version === '20261008-enrichment-v27' ? 3255 : 3254);
  assert.ok(snapshot.sources.some(row => row.url === 'https://data.dubai/en/l/467654'));
  assert.equal(snapshot.manifest.historicalObservationRows, ['20261008-enrichment-v31','20261008-enrichment-v32','20261008-enrichment-v33','20261008-enrichment-v34','20261008-enrichment-v35','20261008-enrichment-v36'].includes(snapshot.version) ? 633891 : snapshot.version === '20261008-enrichment-v30' ? 565004 : snapshot.version === '20261008-enrichment-v29' ? 564920 : snapshot.version === '20261008-enrichment-v28' ? 563738 : 563675);
  assert.equal(snapshot.manifest.historicalSeriesCount, ['20261008-enrichment-v31','20261008-enrichment-v32','20261008-enrichment-v33','20261008-enrichment-v34','20261008-enrichment-v35','20261008-enrichment-v36'].includes(snapshot.version) ? 16872 : ['20261008-enrichment-v29','20261008-enrichment-v30'].includes(snapshot.version) ? 15182 : snapshot.version === '20261008-enrichment-v28' ? 15126 : 15063);
  assert.equal(snapshot.manifest.approved2080ForecastRecords, 0);
  assert.equal(publication.counts.historicalRows, ['20261008-enrichment-v31','20261008-enrichment-v32','20261008-enrichment-v33','20261008-enrichment-v34','20261008-enrichment-v35','20261008-enrichment-v36'].includes(snapshot.version) ? 633891 : snapshot.version === '20261008-enrichment-v30' ? 565004 : snapshot.version === '20261008-enrichment-v29' ? 564920 : snapshot.version === '20261008-enrichment-v28' ? 563738 : 563675);
  assert.equal(publication.counts.series, ['20261008-enrichment-v31','20261008-enrichment-v32','20261008-enrichment-v33','20261008-enrichment-v34','20261008-enrichment-v35','20261008-enrichment-v36'].includes(snapshot.version) ? 16872 : ['20261008-enrichment-v29','20261008-enrichment-v30'].includes(snapshot.version) ? 15182 : snapshot.version === '20261008-enrichment-v28' ? 15126 : 15063);
  assert.equal(publication.counts.sources, snapshot.version === '20261008-enrichment-v36' ? 3340 : snapshot.version === '20261008-enrichment-v35' ? 3334 : snapshot.version === '20261008-enrichment-v34' ? 3333 : snapshot.version === '20261008-enrichment-v33' ? 3320 : snapshot.version === '20261008-enrichment-v32' ? 3306 : snapshot.version === '20261008-enrichment-v31' ? 3295 : snapshot.version === '20261008-enrichment-v30' ? 3294 : snapshot.version === '20261008-enrichment-v29' ? 3292 : snapshot.version === '20261008-enrichment-v28' ? 3291 : snapshot.version === '20261008-enrichment-v27' ? 3255 : 3254);
  assert.equal(sidecar.sources[0].sourceRecordCount, 3039);
  assert.equal(sidecar.sources[0].uniqueProjectIdCount, 3039);
  assert.equal(sidecar.facts.length, 43);
  assert.ok(sidecar.facts.every(row => row.kind === 'register' && row.scope === 'community_context' && row.identityVerified === true));
  assert.equal(sidecar.collection.matchedProjectRows, 1829);
  assert.equal(sidecar.collection.ambiguousOrUnmatchedRowsExcluded, 1210);
  assert.equal(sidecar.collection.newPriceOrRentObservations, 0);
  assert.equal(sidecar.collection.newProjectOrCommunityRecords, 0);
  const added = snapshot.records.flatMap(record => (record.registerEvidence ?? []).filter(row => row.id.startsWith('dld-project-register-community-')));
  assert.equal(added.length, 43);
  assert.equal(new Set(added.map(row => row.id)).size, 43);
  assert.ok(added.every(row => row.scope === 'community_context' && row.identityVerified === true && row.publishedAt === null));
  assert.ok(snapshot.records.filter(row => row.type === 'project').every(row => !(row.registerEvidence ?? []).some(f => f.id.startsWith('dld-project-register-community-'))));
  assert.ok(publication.objects.filter(row => row.kind === 'history_partition').length > 800);
});

test('V25 record-history API hydrates the DLD register facts from the exact immutable shard', async () => {
  const wrapper = await fs.readFile(new URL('../src/historical-intelligence/worker-extension.js', import.meta.url), 'utf8');
  const worker = {fetch: async () => new Response('existing route', {status: 202})};
  vm.runInNewContext(wrapper, {
    worker_default: worker, HI_DATA: runtime, HI_CORE: core, crypto: webcrypto,
    Response, Request, URL, TextEncoder, TextDecoder, DecompressionStream,
    TypeError, RangeError, Map, Set, Date, JSON, Uint8Array, ReadableStream,
  });
  const community = snapshot.records.find(row => row.registerEvidence?.some(item => item.id.startsWith('dld-project-register-community-')));
  assert.ok(community);
  const pointer = runtime.records.find(row => row.id === community.id);
  assert.ok(pointer?.recordPartition?.key);
  const shard = publication.objects.find(row => row.key === pointer.recordPartition.key);
  assert.ok(shard);
  const bytes = await fs.readFile(new URL('../' + shard.path, import.meta.url));
  const env = {MARKET_R2: {get: async key => key === shard.key ? {arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)} : null}};
  const response = await worker.fetch(new Request('https://espacios.me/map/api/record-history?recordId=' + encodeURIComponent(community.id)), env, {});
  assert.equal(response.status, 200);
  const body = await response.json();
  const facts = body.record.registerEvidence.filter(item => item.id.startsWith('dld-project-register-community-'));
  assert.equal(facts.length, 1);
  assert.equal(facts[0].scope, 'community_context');
  assert.equal(facts[0].identityVerified, true);
  assert.equal(facts[0].fields.registeredProjectRecordsInSource > 0, true);
  assert.equal(body.version, snapshot.version);
});
