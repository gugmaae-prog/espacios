import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {mapAbuDhabiBuildingUses} from '../src/stack-audit/abu-dhabi-building-use.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url);
const dir='data/uae-evidence/abu-dhabi/';
const report=JSON.parse(await fs.readFile(new URL(dir+'sdi-building-use-validation.json',root)));
const packed=(await fs.readFile(new URL(dir+'sdi-building-use-20261109.json.gz',root))).toString('base64');
const request=(suffix='',method='GET',host='espacios.me')=>new Request(`https://${host}/map/api/uae-evidence/abu-dhabi/building-uses${suffix}`,{method});
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

test('two independent source captures reconcile to the published groups',async()=>{
 const capture=JSON.parse(await fs.readFile(new URL(dir+'sdi-building-use-capture.json',root)));
 const canonical=JSON.parse(gunzipSync(await fs.readFile(new URL(dir+'sdi-building-use-20261109.json.gz',root))));
 assert.equal(canonical.length,266);
 assert.equal(canonical.reduce((sum,row)=>sum+row.featureCount,0),392495);
 assert.equal(canonical.filter(row=>row.primaryUse===null||row.primaryUse==='UNDEFINED').reduce((sum,row)=>sum+row.featureCount,0),249177);
 assert.equal(digest(Buffer.from(JSON.stringify(canonical))),report.canonicalSha256);
 for(const letter of 'ab'){
  const raw=gunzipSync(await fs.readFile(new URL(dir+`sdi-building-use-capture-${letter}.json.gz`,root)));
  assert.equal(digest(raw),capture[`capture${letter.toUpperCase()}`].rawSha256);
  const source=JSON.parse(raw);
  assert.equal(source.features.length,266);
  const rows=source.features.map(item=>({municipalityCode:item.attributes.MUNICIPALITYNAME,primaryUse:item.attributes.PRIMARYUSAGETYPE,featureCount:item.attributes.feature_count}));
  assert.deepEqual(rows.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),canonical.slice().sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
 }
});

test('read-only route preserves use labels and counts',async()=>{
 const response=await mapAbuDhabiBuildingUses(request('?use=WAREHOUSE'),report,packed);
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.totalRows,2);assert.equal(body.matchedFeatureCount,2545);
 assert.equal(body.scope.quality.unknownUseFeatures,249177);
 assert.equal(body.scope.featureGeometryIncluded,false);
 const adm=await (await mapAbuDhabiBuildingUses(request('?municipality=ADM&use=WAREHOUSE'),report,packed)).json();
 assert.equal(adm.totalRows,1);assert.equal(adm.matchedFeatureCount,1793);
 assert.equal((await mapAbuDhabiBuildingUses(request('?limit=999'),report,packed)).status,400);
 assert.equal((await mapAbuDhabiBuildingUses(request('','POST'),report,packed)).status,405);
 assert.equal((await mapAbuDhabiBuildingUses(request('','HEAD'),report,packed)).body,null);
});

test('compiled Worker exposes the canonical route without raw captures',async()=>{
 const env={DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'ad-building-use-test'}};
 const response=await worker.fetch(request('?municipality=AAM&use=WAREHOUSE'),env,{});
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.matchedFeatureCount,0);
 assert.equal(response.headers.get('x-espacios-map-release'),'20261110-map-stack-v51');
 assert.equal((await worker.fetch(request('','GET','another.example'),env,{})).status,404);
 assert.equal((await worker.fetch(new Request('https://espacios.me/map/data/uae-evidence/abu-dhabi/sdi-building-use-capture.json'),env,{})).status,404);
});
