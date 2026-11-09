import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {mapUaqIndustrialGuide} from '../src/stack-audit/uaq-industrial-guide.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url);
const bytes=await fs.readFile(new URL('data/uae-evidence/umm-al-quwain/industrial-plot-guide-20261110.json',root));
const data=JSON.parse(bytes);
const report=JSON.parse(await fs.readFile(new URL('data/uae-evidence/umm-al-quwain/industrial-plot-guide-validation.json',root)));
const request=(query='',method='GET')=>new Request(`https://espacios.me/map/api/uae-evidence/umm-al-quwain/industrial-plot-guide${query}`,{method});

test('UAQ source facts match the pinned PDF audit and stay dated',()=>{
 assert.equal(bytes.length,report.dataBytes);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),report.dataSha256);
 assert.equal(report.capturePdf.sha256,'1c6002a99f0150240fdcb098a0a68df2ed2c4f38c078c1a1f7cfb24620bea763');
 assert.deepEqual(data.rows.map(row=>[row.plotType,row.guidePlotSizeSqm,row.guideRateAedPerSqm]),[['industrial',5000,10],['warehouse',5000,12],['labour_accommodation',1200,15],['commercial',1200,20]]);
 assert.match(data.publication,/2021/);
 assert.match(data.rateUnit,/period not stated/);
});

test('read-only UAQ API does not turn a 2021 guide into current units or annual rent',async()=>{
 const response=mapUaqIndustrialGuide(request(),report,data),body=await response.json();
 assert.equal(response.status,200);
 assert.equal(body.scope.ratePeriod,null);
 assert.equal(body.scope.currentOffer,false);
 assert.equal(body.scope.currentAvailability,false);
 assert.equal(body.scope.completedBuiltSpaces,false);
 assert.equal(body.scope.transactions,false);
 assert.equal(body.scope.projectCoordinates,false);
 assert.equal(body.totalRows,4);
 assert.deepEqual((await mapUaqIndustrialGuide(request('?plotType=commercial'),report,data).json()).rows,[data.rows[3]]);
 assert.equal(mapUaqIndustrialGuide(request('?plotType=office'),report,data).status,400);
 assert.equal(mapUaqIndustrialGuide(request('','POST'),report,data).status,405);
 assert.equal(mapUaqIndustrialGuide(request('','HEAD'),report,data).body,null);
});

test('compiled Worker serves the UAQ archival guide separately',async()=>{
 const response=await worker.fetch(request(),{DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'uaq-guide-test'}},{}),body=await response.json();
 assert.equal(response.status,200);
 assert.equal(response.headers.get('x-espacios-evidence-source'),report.sourceId);
 assert.equal(body.rows.length,4);
 assert.equal(body.scope.currentOffer,false);
});
