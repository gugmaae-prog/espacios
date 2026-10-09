import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));

test('V26 keeps the DLD-derived September register separate and exact', () => {
  const snapshot = readJson('data/historical-intelligence-20261003.json');
  const publication = readJson('data/historical-intelligence/publication-manifest.json');
  const runtime = readJson('data/historical-intelligence/runtime-index.json');
  const pass = readJson('data/historical-intelligence/dld-derived-project-register-enrichment-20261008.json');
  const manifest = snapshot.manifest.dldDerivedProjectRegisterSeptember2026;

  assert.ok(['20261008-enrichment-v26', '20261008-enrichment-v27', '20261008-enrichment-v28', '20261008-enrichment-v29', '20261008-enrichment-v30','20261008-enrichment-v31','20261008-enrichment-v32','20261008-enrichment-v33','20261008-enrichment-v34','20261008-enrichment-v35','20261008-enrichment-v36','20261008-enrichment-v37','20261008-enrichment-v38','20261009-enrichment-v39'].includes(snapshot.version));
  assert.equal(publication.version, snapshot.version);
  assert.equal(runtime.version, snapshot.version);
  assert.deepEqual(publication.counts, {
    collectedHistoricalRows: ['20261008-enrichment-v31','20261008-enrichment-v32','20261008-enrichment-v33','20261008-enrichment-v34','20261008-enrichment-v35','20261008-enrichment-v36','20261008-enrichment-v37','20261008-enrichment-v38','20261009-enrichment-v39'].includes(snapshot.version) ? 634107 : snapshot.version === '20261008-enrichment-v30' ? 565220 : snapshot.version === '20261008-enrichment-v29' ? 565136 : 563954, communities: 215, events: 105, exposures: 7382,
    historicalRows: ['20261008-enrichment-v31','20261008-enrichment-v32','20261008-enrichment-v33','20261008-enrichment-v34','20261008-enrichment-v35','20261008-enrichment-v36','20261008-enrichment-v37','20261008-enrichment-v38','20261009-enrichment-v39'].includes(snapshot.version) ? 633891 : snapshot.version === '20261008-enrichment-v30' ? 565004 : snapshot.version === '20261008-enrichment-v29' ? 564920 : 563738, originalCollectionRows: 122268, projects: 1645, records: 1860,
    rightsPendingRows: 216, series: ['20261008-enrichment-v31','20261008-enrichment-v32','20261008-enrichment-v33','20261008-enrichment-v34','20261008-enrichment-v35','20261008-enrichment-v36','20261008-enrichment-v37','20261008-enrichment-v38','20261009-enrichment-v39'].includes(snapshot.version) ? 16872 : ['20261008-enrichment-v30','20261008-enrichment-v29'].includes(snapshot.version) ? 15182 : 15126, sources: snapshot.version === '20261009-enrichment-v39' ? 3348 : snapshot.version === '20261008-enrichment-v38' ? 3345 : snapshot.version === '20261008-enrichment-v37' ? 3343 : snapshot.version === '20261008-enrichment-v36' ? 3340 : snapshot.version === '20261008-enrichment-v35' ? 3334 : snapshot.version === '20261008-enrichment-v34' ? 3333 : snapshot.version === '20261008-enrichment-v33' ? 3320 : snapshot.version === '20261008-enrichment-v32' ? 3306 : snapshot.version === '20261008-enrichment-v31' ? 3295 : snapshot.version === '20261008-enrichment-v30' ? 3294 : snapshot.version === '20261008-enrichment-v29' ? 3292 : snapshot.version === '20261008-enrichment-v28' ? 3291 : snapshot.version === '20261008-enrichment-v27' ? 3255 : 3254, supplementHistoricalRows: 18539,
  });
  assert.equal(snapshot.records.length, 1860);
  assert.equal(snapshot.manifest.approved2080ForecastRecords, 0);
  assert.equal(manifest.sourceId, 'cp-dubai-project-register-2026');
  assert.equal(manifest.sourceSha256, '4f5365e88b5016edd9e157dac10b99d06fb8d4ca4579c9b4e1012e3fd84c92d7');
  assert.equal(manifest.sourceRows, 373);
  assert.equal(manifest.sourceSnapshotDate, '2026-09-01');
  assert.equal(manifest.exactProjectRecordsAdded, 8);
  assert.equal(manifest.uniqueExactCatalogueNameRowsReviewed, 55);
  assert.equal(manifest.exactTitleRowsQuarantined, 47);
  assert.equal(manifest.unmatchedRowsExcluded, 318);
  assert.equal(manifest.financialObservationsAdded, 0);
  assert.equal(manifest.valuationObservationsAdded, 0);
  assert.equal(manifest.actualCompletionsAdded, 0);
  assert.equal(manifest.occupancyClaimsAdded, 0);
  assert.equal(manifest.approved2080ForecastRecords, 0);
  assert.equal(pass.facts.length, 8);
  assert.equal(pass.lifecycleMilestones.length, 16);
  assert.equal(pass.quarantines.length, 47);
  assert.equal(pass.sourceRowsWithoutUniqueExactCatalogueName, 318);

  const records = new Map(snapshot.records.map((record) => [record.id, record]));
  const registerIds = new Set();
  const milestoneIds = new Set();
  for (const fact of pass.facts) {
    const record = records.get(fact.recordId);
    assert.ok(record, `record exists: ${fact.recordId}`);
    assert.equal(fact.scope, 'subject');
    assert.equal(fact.identityVerified, true);
    assert.equal(fact.classification, 'independent_dld_derived_project_register_snapshot');
    assert.ok(fact.sourceIds.includes('cp-dubai-project-register-2026'));
    assert.ok(fact.identitySourceIds.includes('dld-official-projects-20260706'));
    assert.equal(fact.publishedAt, '2026-09-01T08:35:09+00:00');
    const evidence = record.registerEvidence.find((item) => item.id === fact.id);
    assert.ok(evidence, `register snapshot copied to ${record.id}`);
    assert.equal(evidence.fields.registeredProjectId, fact.registeredProjectId);
    assert.equal(evidence.fields.sourceSnapshotDate, '2026-09-01');
    assert.match(evidence.fields.fieldSemantics.expectedProjectStartDate, /expected/i);
    assert.match(evidence.fields.fieldSemantics.expectedProjectEndDate, /expected/i);
    assert.match(evidence.fields.fieldSemantics.declaredProjectValueAED, /not a market valuation/);
    assert.match(evidence.fields.fieldSemantics.constructionPercent, /inspection date/);
    assert.equal(record.researchStatus.itemCoverage.construction.status, 'present');
    assert.equal(record.researchStatus.itemCoverage.complete_registered_sale_history.status, 'unestablished');
    for (const item of record.registerEvidence.filter((x) => x.id === fact.id)) {
      assert.ok(!registerIds.has(item.id), `unique register ID ${item.id}`);
      registerIds.add(item.id);
    }
  }
  for (const item of pass.lifecycleMilestones) {
    const record = records.get(item.recordId);
    const milestone = record.lifecycle.find((row) => row.id === item.milestone.id);
    assert.ok(milestone, `milestone copied to ${record.id}`);
    assert.ok(!milestoneIds.has(milestone.id), `unique milestone ID ${milestone.id}`);
    milestoneIds.add(milestone.id);
    assert.equal(milestone.identityVerified, true);
    if (milestone.kind === 'construction_progress') {
      assert.equal(milestone.date.start, '2026-09-01');
      assert.match(milestone.dateBasis, /inspection date not reported/);
      assert.equal(milestone.primaryEvidence, false);
      assert.equal(milestone.status, 'reported');
    } else {
      assert.equal(milestone.kind, 'target_construction_start');
      assert.match(milestone.label, /expected project start date/);
      assert.equal(milestone.status, 'reported');
    }
  }

  const rejectedNames = new Set(pass.quarantines.map((item) => item.sourceProjectName));
  assert.ok(rejectedNames.has('Kaia'), 'the conflicting developer match remains quarantined');
  const rootIndex = JSON.parse(gunzipSync(fs.readFileSync(path.join(root, publication.rootIndex.path))));
  assert.equal(rootIndex.version, snapshot.version);
  assert.equal(rootIndex.records.length, 1860);
  for (const fact of pass.facts) {
    const compact = rootIndex.records.find((record) => record.id === fact.recordId);
    assert.ok(compact.registerEvidence.some((item) => item.id === fact.id));
    assert.ok(compact.lifecycle.some((item) => item.sourceIds?.includes('cp-dubai-project-register-2026')));
  }
});
