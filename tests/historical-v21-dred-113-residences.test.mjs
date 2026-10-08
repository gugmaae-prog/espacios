import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const snapshot = JSON.parse(readFileSync(new URL('../data/historical-intelligence-20261003.json', import.meta.url), 'utf8'));
const record = snapshot.records.find((item) => item.id === 'project:113-residences-iman-developers-al-sufouh-dubai');

test('V22 preserves the catalogue and exposes 113 Residences evidence with unresolved gaps', () => {
  assert.ok(['20261008-enrichment-v22', '20261008-enrichment-v24','20261008-enrichment-v25','20261008-enrichment-v26','20261008-enrichment-v27','20261008-enrichment-v28','20261008-enrichment-v29','20261008-enrichment-v30','20261008-enrichment-v31','20261008-enrichment-v32','20261008-enrichment-v33','20261008-enrichment-v23'].includes(snapshot.version));
  assert.equal(snapshot.records.length, 1860);
  assert.equal(snapshot.manifest.projectCount, 1645);
  assert.equal(snapshot.manifest.communityCount, 215);
  assert.equal(snapshot.manifest.identityCandidateProjects, ['20261008-enrichment-v29','20261008-enrichment-v30','20261008-enrichment-v31','20261008-enrichment-v32','20261008-enrichment-v33'].includes(snapshot.version) ? 247 : 258);
  assert.equal(snapshot.manifest.identityCandidateCommunities, 59);
  assert.equal(snapshot.manifest.approved2080ForecastRecords, 0);
  assert.ok(record);

  const sales = record.observations.filter((item) => item.evidenceClass === 'registered_sale_transaction_secondary_distribution');
  assert.equal(sales.length, 46);
  assert.equal(new Set(sales.map((item) => item.transactionId)).size, 46);
  assert.equal(new Set(sales.map((item) => item.period)).size, 19);
  const dates = sales.map((item) => item.period).sort();
  assert.equal(dates[0], '2026-07-30');
  assert.equal(dates.at(-1), '2026-10-02');
  assert.ok(sales.every((item) => item.observationDateBasis.includes('registration date')));
  assert.ok(sales.every((item) => item.sourceIds.includes('v19-dred-sales-20261005')));

  const developerQuotes = record.observations.filter((item) => item.id.startsWith('v21-113-residences-developer-starting-price-'));
  assert.deepEqual(developerQuotes.map((item) => item.value).sort((a, b) => a - b), [1800000, 2560000, 3650000, 5440000]);
  assert.ok(developerQuotes.every((item) => item.observationKind === 'asking_quote' && item.currentSnapshotEligible === false));
  assert.equal(record.registerEvidence.length, 1);
  assert.equal(record.registerEvidence[0].registeredProjectId, null);

  const targets = record.lifecycle.filter((item) => item.id.startsWith('v21-113-residences-') && item.eventStatus === 'planned');
  assert.deepEqual(targets.map((item) => item.date.start).sort(), ['2029-02-28', '2029-Q2']);
  assert.ok(!record.lifecycle.some((item) => item.kind === 'completion' && item.eventStatus === 'actual'));
  assert.equal(record.researchStatus.identityCandidateCount, 0);
  assert.equal(record.researchStatus.identityCandidateReview.registeredProjectId, null);
  assert.equal(record.researchStatus.itemCoverage.registered_sale_history.completeLifetimeHistory, false);
  assert.equal(record.researchStatus.itemCoverage.signed_rent_history.status, 'missing');
  assert.ok(record.researchStatus.gaps.includes('complete_registered_sale_history'));
  assert.ok(record.researchStatus.gaps.includes('direct_signed_rent_history'));
  assert.equal(record.scenarioCoverage.firstYear, 2027);
  assert.equal(record.scenarioCoverage.lastYear, 2080);
  assert.equal(record.scenarioCoverage.approvedAnnualPoints, 0);
  assert.equal(record.scenarioCoverage.status, 'unavailable_required_inputs_and_validation');
});
