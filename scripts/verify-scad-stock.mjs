import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {SCAD_STOCK_ROWS,SCAD_STOCK_SOURCE} from '../src/stack-audit/scad-stock.mjs';

const root=new URL('../data/uae-evidence/abu-dhabi/',import.meta.url);
const metadata=JSON.parse(await readFile(new URL('source-metadata.json',root)));
const compressed=await readFile(new URL('scad-census-real-estate-2024.html.gz',root));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(compressed.length,metadata.compressedBytes);
assert.equal(hash(compressed),metadata.compressedSha256);
const raw=gunzipSync(compressed);
assert.equal(raw.length,metadata.sourceResponseBytes);
assert.equal(hash(raw),metadata.sourceResponseSha256);
assert.equal(hash(raw),SCAD_STOCK_SOURCE.sourceResponseSha256);
assert.equal(metadata.sourceUrl,SCAD_STOCK_SOURCE.url);
assert.equal(metadata.retrievedAt,SCAD_STOCK_SOURCE.retrievedAt);
const html=raw.toString('utf8');
const label='Number of Units and Buildings by Region, Emirate of Abu Dhabi';
const start=html.indexOf(label);
assert.ok(start>=0,'Official table label missing');
const table=html.slice(start).match(/<table\b[^>]*>([\s\S]*?)<\/table>/i)?.[1];
assert.ok(table,'Official source table missing');
const slug=name=>name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const rows=[...table.matchAll(/<tr>\s*<td(?:\s+[^>]*)?>([^<]+)<\/td>\s*<td>([\d,]+)<\/td>\s*<td>([\d,]+)<\/td>\s*<td>([\d,]+)<\/td>\s*<td>([\d,]+)<\/td>\s*<\/tr>/g)].flatMap(([,name,units23,units24,buildings23,buildings24])=>[
  {region:slug(name),regionName:name,period:2023,units:Number(units23.replaceAll(',','')),buildings:Number(buildings23.replaceAll(',',''))},
  {region:slug(name),regionName:name,period:2024,units:Number(units24.replaceAll(',','')),buildings:Number(buildings24.replaceAll(',',''))}
]);
assert.deepEqual(rows,SCAD_STOCK_ROWS);
assert.equal(rows.length,8);
assert.ok(rows.every(row=>row.units%5===0&&row.buildings%5===0));
console.log('SCAD stock source verified: 8 region-year rows, exact source bytes and checksums match');
