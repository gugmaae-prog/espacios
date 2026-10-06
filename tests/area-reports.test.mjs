import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bedroomQuoteAsHeadline, communitySummaryIsProjectTransaction, headlinePrice } from '../src/area-reports/guards.mjs';

const packet = JSON.parse(fs.readFileSync(new URL('../enrichment/area-reports-20261006/packet.json', import.meta.url)));
const supplied = [
  '/home/ubuntu/.cursor/projects/workspace/uploads/Tilal_Al_Ghaf__Al_Hebiah_Fourth_7989.pdf',
  '/home/ubuntu/.cursor/projects/workspace/uploads/Nad_Al_Sheba_a706.pdf',
  '/home/ubuntu/.cursor/projects/workspace/uploads/Downtown_Dubai_1287.pdf',
  '/home/ubuntu/.cursor/projects/workspace/uploads/Rashid_Yachts_And_Marina__Mina_Rashid_30d8.pdf',
  '/home/ubuntu/.cursor/projects/workspace/uploads/Dubai_Investment_Park_First_45ae.pdf',
  '/home/ubuntu/.cursor/projects/workspace/uploads/Dubai_Land_Residence_Complex__Wadi_Al_Safa_5_3fc2.pdf',
  '/home/ubuntu/.cursor/projects/workspace/uploads/Jebel_Ali_c6d6.pdf',
  '/home/ubuntu/.cursor/projects/workspace/uploads/Arancia_Yards_By_Beyond__All_Buildings___City_of_Arabia_0b18.pdf',
  '/home/ubuntu/.cursor/projects/workspace/uploads/Emaar_Beachfront__Dubai_Harbour_8662.pdf',
  '/home/ubuntu/.cursor/projects/workspace/uploads/Jebel_Ali_fc28.pdf',
  '/home/ubuntu/.cursor/projects/workspace/uploads/Arancia_Yards_By_Beyond__All_Buildings___City_of_Arabia_8642.pdf',
  '/home/ubuntu/.cursor/projects/workspace/uploads/Emaar_Beachfront__Dubai_Harbour_3ded.pdf',
  '/home/ubuntu/.cursor/projects/workspace/uploads/Town_Square__Al_Yelayiss_2_2f80.pdf',
  '/home/ubuntu/.cursor/projects/workspace/uploads/Sobha_Hartland__Al_Merkadh_829b.pdf',
  '/home/ubuntu/.cursor/projects/workspace/uploads/The_Oasis__All_Phases___Me_Aisem_Second_d0aa.pdf',
  '/home/ubuntu/.cursor/projects/workspace/uploads/Damac_Hills__Al_Hebiah_Third_ed43.pdf',
  '/home/ubuntu/.cursor/projects/workspace/uploads/Dubai_Hills_Estate_acbf.pdf',
  '/home/ubuntu/.cursor/projects/workspace/uploads/Dubai_Marina__Marsa_Dubai_5a24.pdf',
  '/home/ubuntu/.cursor/projects/workspace/uploads/Jumeirah_Village_Circle__JVC__b203.pdf',
  '/home/ubuntu/.cursor/projects/workspace/uploads/Business_Bay_4e00.pdf',
  '/home/ubuntu/.cursor/projects/workspace/uploads/Dubai_Creek_Harbour_638f.pdf',
  '/home/ubuntu/.cursor/projects/workspace/uploads/Dubai_South_bda4.pdf',
  '/home/ubuntu/.cursor/projects/workspace/uploads/Palm_Jebel_Ali_8316.pdf',
  '/home/ubuntu/.cursor/projects/workspace/uploads/Downtown_Dubai_e760.pdf',
];

const byTitle = (title) => packet.extracts.filter((extract) => extract.printedTitle === title);
const group = (title) => packet.duplicateGroups.find((item) => item.printedTitle === title);
const metric = (extract, name) => extract.summary.find((item) => item.metric === name);

test('every supplied PDF path is represented with a fact count', () => {
  assert.deepEqual(packet.suppliedPaths, supplied);
  assert.equal(packet.files.length, supplied.length);
  for (const path of supplied) {
    const file = packet.perFileFactCounts.find((item) => item.path === path);
    assert.ok(file, path);
    assert.ok(file.totalFacts > 0);
    assert.equal(file.summaryFacts, 4);
    assert.ok(packet.extracts.some((extract) => extract.extractId === file.extractId));
  }
});

test('duplicate hashes are explicit and Downtown conflicts are retained', () => {
  for (const title of ['Jebel Ali', 'Emaar Beachfront, Dubai Harbour', 'Arancia Yards By Beyond (All Buildings), City of Arabia']) {
    const item = group(title);
    assert.equal(item.relationship, 'identical_bytes');
    assert.equal(item.extractIds.length, 1);
    assert.equal(item.factConflicts.length, 0);
    assert.equal(item.files.length, 2);
    assert.equal(item.files[0].sha256, item.files[1].sha256);
    assert.equal(byTitle(title).length, 1);
  }
  const downtown = group('Downtown Dubai');
  assert.equal(downtown.relationship, 'distinct_bytes_identical_facts');
  assert.notEqual(downtown.files[0].sha256, downtown.files[1].sha256);
  assert.equal(downtown.factConflicts.length, 0);
  assert.equal(downtown.extractIds.length, 2);
  const [left, right] = byTitle('Downtown Dubai');
  assert.deepEqual(left.summary, right.summary);
  assert.equal(left.sales.length, right.sales.length);
  assert.equal(left.sales[0].location, 'Imperial Avenues, Downtown Dubai');
  assert.equal(left.sales[0].priceAed, 4300000);
  assert.equal(packet.analysis.doNotSumRepeatedExtracts, true);
});

test('bedroom and unit quotes cannot replace the area headline price', () => {
  const fixture = {
    summary: [{ kind: 'area_summary_metric', scope: 'area_summary', metric: 'median_price_aed', isHeadlinePrice: true, isProjectTransaction: false, value: 3000000 }],
    sales: [{ kind: 'listed_sale', bedrooms: 2, unitLabel: '2 Beds', priceAed: 2650000, isHeadlinePrice: false }],
  };
  assert.equal(headlinePrice(fixture), 3000000);
  assert.equal(bedroomQuoteAsHeadline(fixture.sales[0]), null);
  assert.notEqual(bedroomQuoteAsHeadline(fixture.sales[0]), fixture.sales[0].priceAed);
  for (const extract of packet.extracts) {
    const headline = headlinePrice(extract);
    assert.equal(headline, metric(extract, 'median_price_aed').value);
    assert.notEqual(headline, null);
    for (const sale of extract.sales) {
      assert.equal(sale.isHeadlinePrice, false);
      assert.equal(sale.replacesCatalogueHeadlinePrice, false);
      assert.equal(sale.kind, 'listed_sale');
      if (sale.bedrooms != null || sale.unitLabel === 'Studio') assert.equal(bedroomQuoteAsHeadline(sale), null);
      if (!sale.capitalGainPrinted) assert.equal(sale.capitalGainPct, null);
    }
  }
});

test('community summary figures are not relabeled as project transactions', () => {
  for (const extract of packet.extracts) {
    for (const row of extract.summary) {
      assert.equal(row.scope, 'area_summary');
      assert.equal(row.isProjectTransaction, false);
      assert.equal(communitySummaryIsProjectTransaction(row), false);
      assert.equal(row.replacesCatalogueHeadlinePrice, false);
    }
    for (const sale of extract.sales) {
      if (sale.isProjectTransaction) {
        assert.equal(sale.catalogueProject.name.toLowerCase(), sale.projectLabel.toLowerCase());
        assert.equal(sale.replacesCatalogueHeadlinePrice, false);
      } else {
        assert.equal(sale.catalogueProject, null);
      }
    }
    assert.equal(extract.rowCounts.summaryMetrics, 4);
    assert.equal(extract.rowCounts.saleRows, extract.sales.length);
    assert.equal(extract.rowCounts.unparsedPriceTokens, 0);
    assert.equal(extract.rowCounts.missingCoreFields, 0);
  }
  assert.equal(byTitle('Emaar Beachfront, Dubai Harbour')[0].identity.catalogueSubject, null);
  assert.equal(byTitle('Emaar Beachfront, Dubai Harbour')[0].identity.status, 'ambiguous_area_context');
  assert.equal(byTitle('Jebel Ali')[0].identity.catalogueSubject, null);
  assert.equal(byTitle('Jebel Ali')[0].identity.status, 'ambiguous_area_context');
  assert.equal(byTitle('Town Square, Al Yelayiss 2')[0].identity.catalogueSubject, null);
  assert.equal(byTitle('Dubai Investment Park First')[0].identity.catalogueSubject, null);
  assert.equal(byTitle("The Oasis (All Phases), Me'Aisem Second")[0].identity.catalogueSubject, null);
  assert.equal(byTitle('Rashid Yachts And Marina, Mina Rashid')[0].identity.catalogueSubject, null);
  assert.equal(byTitle('Jumeirah Village Circle (JVC)')[0].identity.catalogueSubject.name, 'Jumeirah Village Circle (JVC)');
  assert.notEqual(byTitle('Nad Al Sheba')[0].identity.catalogueSubject.name, 'Nad Al Sheba Gardens');
});

test('blank yields stay blank and printed summary figures are kept', () => {
  const arancia = byTitle('Arancia Yards By Beyond (All Buildings), City of Arabia')[0];
  assert.equal(metric(arancia, 'rental_yield_pct').value, null);
  assert.equal(metric(arancia, 'median_price_per_sqft_aed').yoyPct, 0);
  assert.equal(metric(arancia, 'transaction_count').value, 247);
  assert.equal(arancia.sales.length, 247);
  const jebel = byTitle('Jebel Ali')[0];
  assert.equal(metric(jebel, 'rental_yield_pct').value, null);
  assert.equal(metric(jebel, 'transaction_count').yoyPct, 10867);
  assert.equal(metric(jebel, 'median_price_aed').yoyPct, -98);
  const nad = byTitle('Nad Al Sheba')[0];
  assert.equal(metric(nad, 'transaction_count').value, 4);
  assert.equal(nad.sales.length, 4);
  assert.equal(metric(nad, 'rental_yield_pct').value, null);
  const downtown = byTitle('Downtown Dubai')[0];
  assert.equal(metric(downtown, 'median_price_aed').value, 3000000);
  assert.equal(metric(downtown, 'median_price_per_sqft_aed').value, 3080);
  assert.equal(metric(downtown, 'transaction_count').value, 2861);
  assert.equal(metric(downtown, 'rental_yield_pct').value, 7);
  assert.equal(metric(downtown, 'rental_yield_pct').yoyPct, null);
  assert.equal(packet.deployment, 'not_deployed');
});
