import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const packetDir = 'enrichment/transaction-snapshots-20261006';
const manifest = JSON.parse(fs.readFileSync(path.join(packetDir, 'manifest.json'), 'utf8'));
const analysis = JSON.parse(fs.readFileSync(path.join(packetDir, 'analysis.json'), 'utf8'));
const doc = fs.readFileSync('docs/TRANSACTION_SNAPSHOT_TRENDS_20261006.md', 'utf8');

const required = [
  'Jebel_Ali_fc28.pdf',
  'Arancia_Yards_By_Beyond__All_Buildings___City_of_Arabia_8642.pdf',
  'Emaar_Beachfront__Dubai_Harbour_3ded.pdf',
  'Town_Square__Al_Yelayiss_2_2f80.pdf',
  'Sobha_Hartland__Al_Merkadh_829b.pdf',
  'The_Oasis__All_Phases___Me_Aisem_Second_d0aa.pdf',
  'Damac_Hills__Al_Hebiah_Third_ed43.pdf',
  'Dubai_Hills_Estate_acbf.pdf',
  'Dubai_Marina__Marsa_Dubai_5a24.pdf',
  'Jumeirah_Village_Circle__JVC__b203.pdf',
  'Business_Bay_4e00.pdf',
  'Dubai_Creek_Harbour_638f.pdf',
  'Dubai_South_bda4.pdf',
  'Palm_Jebel_Ali_8316.pdf',
  'Downtown_Dubai_e760.pdf',
  'Tilal_Al_Ghaf__Al_Hebiah_Fourth_7989.pdf',
  'Nad_Al_Sheba_a706.pdf',
  'Downtown_Dubai_1287.pdf',
  'Rashid_Yachts_And_Marina__Mina_Rashid_30d8.pdf',
  'Dubai_Investment_Park_First_45ae.pdf',
  'Dubai_Land_Residence_Complex__Wadi_Al_Safa_5_3fc2.pdf',
  'Jebel_Ali_c6d6.pdf',
  'Arancia_Yards_By_Beyond__All_Buildings___City_of_Arabia_0b18.pdf',
  'Emaar_Beachfront__Dubai_Harbour_8662.pdf',
];

test('every required transaction-snapshot PDF is represented', () => {
  const names = new Set(manifest.files.map((file) => file.filename));
  for (const name of required) assert.ok(names.has(name), name);
  assert.deepEqual(manifest.requiredUploadBasenames, required);
  assert.equal(manifest.retrievalDate, '2026-10-06');
  assert.equal(manifest.provenance, 'user-supplied');
  assert.equal(analysis.areas.length, 20);
});

test('extracted row counts match the packet', () => {
  let rows = 0;
  for (const source of manifest.sources) {
    const extract = JSON.parse(fs.readFileSync(path.join(packetDir, source.extract), 'utf8'));
    assert.equal(extract.rows.length, source.rowCount, source.sourceId);
    assert.equal(extract.sha256, source.sha256);
    assert.equal(extract.numericSha256, source.numericSha256);
    assert.equal(extract.retrievalDate, '2026-10-06');
    rows += extract.rows.length;
    for (const row of extract.rows) {
      assert.equal(typeof row.priceAed, 'number');
      assert.equal(typeof row.pricePerSqftAed, 'number');
      assert.equal(typeof row.sqft, 'number');
      assert.match(row.date, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(row.status === 'Ready' || row.status === 'Offplan');
      assert.equal(typeof row.propertyType, 'string');
    }
  }
  assert.equal(rows, manifest.sourceCount.printedRows);
  for (const area of analysis.areas) {
    const periodSales = area.printed.periods.reduce((sum, period) => sum + period.printedSales, 0);
    assert.equal(periodSales, area.printed.rowCount, area.id);
    assert.ok(doc.includes(`### ${area.title}`), area.title);
    if (area.sources.length === 1) {
      assert.equal(area.sources[0].rowCount, area.printed.rowCount);
    }
  }
  const nad = analysis.areas.find((area) => area.id === 'nad-al-sheba');
  assert.equal(nad.printed.rowCount, 4);
  assert.equal(nad.summary.transactions, 4);
});

test('Downtown Dubai byte conflict is kept and not averaged', () => {
  const conflict = manifest.conflicts.find((item) => item.title === 'Downtown Dubai');
  assert.equal(conflict.kind, 'byte_difference_without_numeric_conflict');
  assert.equal(new Set(conflict.sha256).size, 2);
  const extracts = conflict.sha256.map((hash) => {
    const source = manifest.sources.find((item) => item.sha256 === hash);
    return JSON.parse(fs.readFileSync(path.join(packetDir, source.extract), 'utf8'));
  });
  assert.equal(extracts[0].numericSha256, extracts[1].numericSha256);
  assert.equal(extracts[0].rows.length, extracts[1].rows.length);
  assert.equal(extracts[0].rows.length, 300);
  const area = analysis.areas.find((item) => item.id === 'downtown-dubai');
  assert.equal(area.sources.length, 2);
  assert.equal(area.printed.rowCount, 300);
  assert.equal(area.tooLittleHistoryForAPriceTrend, true);
});

test('identical file bytes share one extract', () => {
  const byHash = new Map();
  for (const file of manifest.files) {
    const names = byHash.get(file.sha256) || [];
    names.push(file.filename);
    byHash.set(file.sha256, names);
  }
  assert.equal(byHash.size, manifest.sourceCount.uniqueSha256);
  for (const [hash, names] of byHash) {
    const sources = manifest.sources.filter((source) => source.sha256 === hash);
    assert.equal(sources.length, 1, hash);
    for (const name of names) assert.ok(sources[0].filenames.includes(name));
  }
});

test('the write-up states evidence limits and does not estimate a price path', () => {
  assert.equal(analysis.method.forecast, 'none');
  assert.equal(analysis.method.causalPriceEffect, 'none');
  assert.match(doc, /No forward price path is estimated/);
  assert.match(doc, /not market volumes/);
  assert.doesNotMatch(doc, /price uplift/i);
  assert.doesNotMatch(doc, /2080/);
  const thin = analysis.areas.filter((area) => area.tooLittleHistoryForAPriceTrend).map((area) => area.id).sort();
  assert.deepEqual(thin, [
    'damac-hills',
    'downtown-dubai',
    'dubai-investment-park-first',
    'dubai-south',
    'jebel-ali',
    'nad-al-sheba',
  ]);
});

test('uploaded PDFs still parse to the stored row counts when they are on disk', () => {
  const pdfDir = process.env.TRANSACTION_SNAPSHOT_PDF_DIR || '/home/ubuntu/.cursor/projects/workspace/uploads';
  if (!fs.existsSync(pdfDir)) return;
  const out = spawnSync('python3', [
    'scripts/extract_transaction_snapshots.py',
    '--check',
    '--pdf-dir', pdfDir,
    '--out', packetDir,
    '--doc', 'docs/TRANSACTION_SNAPSHOT_TRENDS_20261006.md',
  ], {encoding: 'utf8'});
  assert.equal(out.status, 0, out.stderr || out.stdout);
});
