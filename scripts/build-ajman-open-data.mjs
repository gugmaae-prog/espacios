import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'data/uae-evidence/ajman');
const sourceId = 'ajman-dlrr-20260821-unit-sales';
const api = 'https://data.ajman.ae/api/explore/v2.1/catalog/datasets/real-estate-units-sales';
const sha = value => createHash('sha256').update(value).digest('hex');
const finite = (value, label) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw Error(`Invalid ${label}`);
  return value;
};
const integer = (value, label) => {
  if (!Number.isInteger(finite(value, label))) throw Error(`Invalid ${label}`);
  return value;
};

const rawCompressed = await fs.readFile(path.join(dir, 'real-estate-units-sales-20260821.json.gz'));
const raw = gunzipSync(rawCompressed);
const rows = JSON.parse(raw);
const metadataBytes = await fs.readFile(path.join(dir, 'source-metadata.json'));
const metadata = JSON.parse(metadataBytes);
const meta = metadata.metas?.default;
if (metadata.dataset_id !== 'real-estate-units-sales' || meta?.publisher !== 'Department of Land and Real Estate Regulation' || meta?.license !== 'CC BY 4.0' || meta?.license_url !== 'https://creativecommons.org/licenses/by/4.0/' || meta?.modified !== '2026-08-21T04:37:58.396000+00:00' || meta?.records_count !== 6075 || !Array.isArray(rows) || rows.length !== meta.records_count) throw Error('Ajman source metadata or row count changed. Capture a new vintage.');

const required = ['project_name_english','project_name_arabic','sector_english','sector_arabic','district_english','district_arabic','unit_type_english','unit_type_arabic','rooms_count','total_sales_values_in_aed','sales_count','max_sales_values_in_aed','year','quarter'];
const rowHashes = new Set();
const projectLabels = new Set();
const years = new Set();
let reportedSales = 0, totalValueAed = 0, first = '9999-99-99', last = '0000-00-00';
for (const [index, row] of rows.entries()) {
  if (Object.keys(row).length !== required.length || required.some(key => !Object.hasOwn(row, key))) throw Error(`Unexpected schema at row ${index}`);
  for (const key of required.slice(0, 9)) if (typeof row[key] !== 'string' || !row[key].trim()) throw Error(`Missing ${key} at row ${index}`);
  const year = integer(row.year, 'year'), quarter = integer(row.quarter, 'quarter');
  if (year < 2019 || year > 2026 || quarter < 1 || quarter > 4) throw Error(`Invalid period at row ${index}`);
  const count = integer(row.sales_count, 'sales_count'), total = finite(row.total_sales_values_in_aed, 'total_sales_values_in_aed'), max = finite(row.max_sales_values_in_aed, 'max_sales_values_in_aed');
  if (count < 1 || total < max || total / count > max + 0.00001) throw Error(`Inconsistent sales aggregate at row ${index}`);
  const rowHash = sha(JSON.stringify(row));
  if (rowHashes.has(rowHash)) throw Error(`Exact duplicate at row ${index}`);
  rowHashes.add(rowHash); projectLabels.add(row.project_name_english); years.add(year);
  reportedSales += count; totalValueAed += total;
  const start = `${year}-${String((quarter - 1) * 3 + 1).padStart(2, '0')}-01`;
  const end = new Date(Date.UTC(year, quarter * 3, 0)).toISOString().slice(0, 10);
  if (start < first) first = start; if (end > last) last = end;
}
if (projectLabels.size !== 239 || reportedSales !== 15991 || Math.abs(totalValueAed - 6218360220.16) > 0.01 || years.size !== 8) throw Error('Ajman source population or totals differ from reviewed capture.');

const report = {
  sourceId, datasetUrl: 'https://data.ajman.ae/explore/dataset/real-estate-units-sales/', api,
  publisher: meta.publisher, licence: meta.license, licenceUrl: meta.license_url,
  sourceModifiedAt: meta.modified, retrievedAt: '2026-11-02T14:34:19Z', metadataRetrievedAt: '2026-11-02T14:36:40Z',
  nativeFrequency: 'quarterly', grain: 'source_project_label × sector × district × unit_type × rooms × quarter; aggregated sales, not individual transactions',
  emirate: 'Ajman', evidenceClass: 'official_registered_sale_aggregate',
  storageKey: 'uae/evidence/ajman/2026-08-21/real-estate-units-sales.json.gz',
  rawSha256: sha(raw), rawBytes: raw.length, compressedSha256: sha(rawCompressed), compressedBytes: rawCompressed.length, metadataSha256: sha(metadataBytes),
  rows: rows.length, distinctSourceProjectLabels: projectLabels.size, reportedUnitSalesCountSum: reportedSales,
  reportedValueAedSum: Number(totalValueAed.toFixed(2)), firstPeriod: first, lastPeriod: last,
  canonicalProjectMatches: 0, matchPolicy: 'No name-only joins; source project labels have not been matched to accepted V48 identities or coordinates.'
};
const reportPath = path.join(dir, 'validation.json');
if (process.argv.includes('--check')) {
  const saved = JSON.parse(await fs.readFile(reportPath, 'utf8'));
  if (JSON.stringify(saved) !== JSON.stringify(report)) throw Error('Ajman validation report does not match source capture.');
  console.log(JSON.stringify({passed:true,sourceId,rows:rows.length,rawSha256:report.rawSha256}));
} else {
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
