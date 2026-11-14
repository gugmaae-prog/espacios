import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {mapAjmanRegistration} from '../src/stack-audit/ajman-registration.mjs';

const root=new URL('../',import.meta.url);
const report=JSON.parse(await fs.readFile(new URL('data/uae-evidence/ajman/registration-validation.json',root),'utf8'));
const compressed=await fs.readFile(new URL('data/uae-evidence/ajman/real-estate-units-registration-20260821.json.gz',root));
const req=(suffix='',method='GET')=>new Request('https://espacios.me/map/api/uae-evidence/ajman/registrations'+suffix,{method});
const env={MAP_IDRIVE_READY:'true',MAP_EVIDENCE:{}};
const store=()=>({get:async key=>key===report.storageKey?{sha256:report.compressedSha256,size:compressed.length,arrayBuffer:async()=>compressed.buffer.slice(compressed.byteOffset,compressed.byteOffset+compressed.byteLength)}:null});

test('the registration source fails closed without exact private bytes',async()=>{
 assert.equal((await mapAjmanRegistration(req(),{...env,MAP_EVIDENCE:null},report,store)).status,503);
 assert.equal((await mapAjmanRegistration(req(),env,{...report,rawSha256:'0'.repeat(64)},store)).status,503);
});
test('quarterly registration data keeps tentative and final stages separate',async()=>{
 const response=await mapAjmanRegistration(req(),env,report,store),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.source.rows,5124);assert.equal(body.source.distinctSourceProjectLabels,335);
 assert.equal(body.totalRows,5124);assert.equal(body.totals.initialCertificatesCount,14242);assert.equal(body.totals.titleDeedsCount,7852);
 assert.equal(body.source.licence,'CC BY 4.0');assert.equal(body.scope.canonicalProjectMatches,0);
 assert.match(body.scope.limits,/must not be added as unique sales/);
 assert.ok(body.rows.every(row=>row.canonicalProjectId===null&&row.matchStatus==='unmatched'));
 assert.equal((await mapAjmanRegistration(req(),{...env,MAP_IDRIVE_READY:'false'},report,store)).status,503);
});
test('year, quarter and registration stage filters have honest totals',async()=>{
 const initial=await (await mapAjmanRegistration(req('?year=2026&quarter=2&stage=initial&limit=100'),env,report,store)).json();
 const final=await (await mapAjmanRegistration(req('?year=2026&quarter=2&stage=final&limit=100'),env,report,store)).json();
 assert.ok(initial.totalRows>0&&final.totalRows>0);
 assert.ok(initial.rows.every(row=>row.year===2026&&row.quarter===2&&row.initial_certificates_count>0));
 assert.ok(final.rows.every(row=>row.year===2026&&row.quarter===2&&row.title_deeds_count>0));
 assert.notEqual(initial.totals.initialCertificatesCount,final.totals.titleDeedsCount);
});
test('invalid filters and write methods fail closed',async()=>{
 for(const query of ['?year=2027','?limit=101','?stage=sale','?offset=-1'])assert.equal((await mapAjmanRegistration(req(query),env,report,store)).status,400);
 assert.equal((await mapAjmanRegistration(req('','POST'),env,report,store)).status,405);
 assert.equal(await mapAjmanRegistration(new Request('https://espacios.me/map/api/system'),env,report,store),null);
});
