import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const packetDir = 'enrichment/transaction-snapshots-20261006';
const manifest = JSON.parse(fs.readFileSync(path.join(packetDir, 'manifest.json'), 'utf8'));
const completion = JSON.parse(fs.readFileSync(path.join(packetDir, 'completion.json'), 'utf8'));

test('every hashed print is stored and unprinted sales stay missing', () => {
  const hashes = new Set(manifest.files.map((file) => file.sha256));
  assert.equal(hashes.size, completion.uniqueSha256);
  assert.equal(manifest.files.length, completion.filesOnDisk);
  assert.equal(completion.printedSalesCountingRepeatedDowntownFile, manifest.sourceCount.printedRows);
  let uniqueRows = 0;
  let uniqueStated = 0;
  const seen = new Set();
  for (const area of completion.areaDetails) {
    assert.ok(hashes.has(area.sha256), area.title);
    const source = manifest.sources.find((item) => item.sha256 === area.sha256);
    const extract = JSON.parse(fs.readFileSync(path.join(packetDir, source.extract), 'utf8'));
    assert.equal(extract.rows.length, area.printedSales, area.title);
    assert.equal(area.statedTransactions - area.printedSales, area.notPrintedOnPage, area.title);
    assert.equal(area.pageIsComplete, area.notPrintedOnPage === 0, area.title);
    if (!seen.has(area.title)) {
      seen.add(area.title);
      uniqueRows += area.printedSales;
      uniqueStated += area.statedTransactions;
    }
  }
  assert.equal(uniqueRows, completion.printedSalesUniqueTitles);
  assert.equal(uniqueStated - uniqueRows, completion.salesNotOnThePrintedPages);
  assert.equal(completion.printedSalesUniqueTitles, 5651);
  assert.equal(completion.statedTransactionsUniqueTitles, 62392);
  assert.equal(completion.salesNotOnThePrintedPages, 56741);
  assert.deepEqual(completion.completePages, [
    'Arancia Yards By Beyond (All Buildings), City of Arabia',
    'Nad Al Sheba',
  ]);
  assert.equal(completion.status, 'printed_rows_complete_unprinted_sales_remain_missing');
});
