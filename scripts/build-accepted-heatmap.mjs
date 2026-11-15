/** Freeze the accepted V48 project heatmap as a derived UI response. The
 * original 1,645-record catalogue remains the evidence source. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import worker from '../src/worker.js';
import {mapCoordinateQuality} from '../src/stack-audit/coordinate-quality.mjs';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('data/recovery/static-archive-manifest.json', root), 'utf8'));
const byPath = new Map(Object.values(manifest.entries).map(entry => [entry.path, entry]));
const assets = {fetch: async request => {
  const entry = byPath.get(new URL(request.url).pathname);
  if (!entry) return new Response('Not found', {status: 404});
  const bytes = await readFile(new URL('work/archive-assets' + entry.path, root));
  assert.equal(bytes.length, entry.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
  return new Response(request.method === 'HEAD' ? null : bytes);
}};
globalThis.caches = {default: {match: async () => null, put: async () => {}}};
const env = {MAP_ARCHIVE: assets, MAP_IDRIVE_READY: 'false', MAP_HEATMAP_REBUILD: 'true', DATA_ROOM_PUBLIC: 'false', MAP_VERSION: {id: 'offline-derived-build'}};
const response = await worker.fetch(new Request('https://espacios.me/map/api/uae-heatmap'), env, {waitUntil() {}});
assert.equal(response.status, 200);
const payload = mapCoordinateQuality(await response.json());
assert.equal(payload.counts.projects, 1645);
assert.equal(payload.counts.geocodedProjects, 1518);
assert.equal(payload.projectFeatures.features.length, 1518);
assert.equal(payload.unmappedProjectRecords.length, 127);
assert.deepEqual(payload.counts.coordinateQuality,{projectOrSource:1158,approximateCommunityCentre:360,withoutCoordinates:127});
assert.equal(payload.completeness.liveFeedIncluded, false);
assert.equal(payload.sourceSnapshot.recovery.originalBodySHA256, 'b662672fb72cdcbaf62aa5df248c7373105a8f4ca514028188f91315c8fc6b56');
const bytes = Buffer.from(JSON.stringify(payload));
const sha256 = createHash('sha256').update(bytes).digest('hex');
await writeFile(new URL('data/recovery/accepted-uae-heatmap-20261102.json', root), bytes);
await writeFile(new URL('data/recovery/accepted-uae-heatmap-20261102.manifest.json', root), JSON.stringify({classification:'derived_ui_heatmap_from_accepted_v48_catalogue',sourceBodySHA256:payload.sourceSnapshot.recovery.originalBodySHA256,counts:{projects:1645,geocodedProjects:1518,unmappedProjects:127,coordinateQuality:payload.counts.coordinateQuality},bytes:bytes.length,sha256})+'\n');
console.log(JSON.stringify({bytes:bytes.length,sha256,projects:payload.counts.projects,geocodedProjects:payload.counts.geocodedProjects}));
