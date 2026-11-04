import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {mapAjmanManagement} from '../src/stack-audit/ajman-management.mjs';

const root=new URL('../',import.meta.url);
const report=JSON.parse(await fs.readFile(new URL('data/uae-evidence/ajman/management-validation.json',root)));
const packed=(await fs.readFile(new URL('data/uae-evidence/ajman/management-companies-20260609.json.gz',root))).toString('base64');
const request=(query='',method='GET')=>new Request('https://espacios.me/map/api/uae-evidence/ajman/management'+query,{method});

test('management source requires exact embedded bytes and remains read only',async()=>{
 assert.equal((await mapAjmanManagement(request(),{...report,rawSha256:'0'.repeat(64)},packed)).status,503);
 assert.equal((await mapAjmanManagement(request(),report,packed.slice(1))).status,503);
 assert.equal((await mapAjmanManagement(request('','POST'),report,packed)).status,405);
 assert.equal(await mapAjmanManagement(new Request('https://espacios.me/map/api/system'),report,packed),null);
});

test('latest appointments link exact Ajman IDs without creating map projects',async()=>{
 const response=await mapAjmanManagement(request(),report,packed),body=await response.json();
 assert.equal(response.status,200);assert.equal(response.headers.get('x-espacios-evidence-source'),report.sourceId);
 assert.equal(body.source.rows,451);assert.equal(body.source.distinctSourceProjectIds,153);assert.equal(body.source.linkedOfficialRegisterIds,153);
 assert.equal(body.totalRows,153);assert.equal(body.distinctSourceProjectIds,153);
 assert.equal(body.source.licence,'CC BY 4.0');assert.equal(body.scope.canonicalProjectMatches,0);
 assert.ok(body.rows.every(row=>row.reportedYear===2026&&row.latestForSourceProject&&row.canonicalProjectId===null&&row.coordinates===null));
 const head=await mapAjmanManagement(request('','HEAD'),report,packed);assert.equal(head.status,200);assert.equal(await head.text(),'');
});

test('annual and exact project filters retain management changes',async()=>{
 const year=await (await mapAjmanManagement(request('?year=2024&limit=100'),report,packed)).json();
 assert.equal(year.totalRows,149);assert.ok(year.rows.every(row=>row.reportedYear===2024));
 const history=await (await mapAjmanManagement(request('?projectId=415&scope=all'),report,packed)).json();
 assert.equal(history.totalRows,3);assert.deepEqual(history.rows.map(row=>row.reportedYear),[2026,2025,2024]);
 assert.equal(new Set(history.rows.map(row=>row.officeId)).size,3);
 const searched=await (await mapAjmanManagement(request('?projectId=415&q=salsabeel'),report,packed)).json();assert.equal(searched.totalRows,1);
 for(const query of ['?year=2027','?projectId=-1','?scope=current','?limit=101','?offset=-1'])assert.equal((await mapAjmanManagement(request(query),report,packed)).status,400);
});
