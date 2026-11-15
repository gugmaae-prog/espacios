import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';

const root=new URL('../',import.meta.url);
const [canonicalBytes,mapBytes,projectionBytes]=await Promise.all([
 'data/historical-intelligence-20261003.json','data/recovery/accepted-map-20261013.json','data/recovery/verified-project-heat-observations.json'
].map(path=>fs.readFile(new URL(path,root))));
const canonical=JSON.parse(canonicalBytes),catalogue=JSON.parse(mapBytes),projection=JSON.parse(projectionBytes);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

test('published project observations reconcile to qualified DLD subject points and exact catalogue IDs',()=>{
 assert.equal(projection.source.canonicalSHA256,hash(canonicalBytes));
 assert.equal(projection.source.catalogueSHA256,hash(mapBytes));
 assert.equal(projection.counts.observations,175);
 assert.equal(projection.counts.projects,96);
 const records=new Map(canonical.records.map(row=>[row.id,row]));
 const projects=new Map(catalogue.projects.map(row=>[row.id,row]));
 const ids=new Set();
 for(const row of projection.observations){
  assert(!ids.has(row.id),'source point identity is unique');ids.add(row.id);
  const project=projects.get(row.projectId),record=records.get(row.projectId);
  assert(project&&record,'observation has an accepted project identity');
  assert.equal(project.coordinateBasis,'Project coordinate recorded in the PSR catalogue');
  assert.deepEqual(row.coordinates,[project.coordinates.lng,project.coordinates.lat]);
  const matches=record.historySeries.filter(series=>series.id===row.sourceSeriesId&&series.scope==='subject'&&series.identityVerified===true&&series.classification==='official DLD derived primary snapshot');
  assert.equal(matches.length,1,'one identity-verified DLD subject series');
  assert(matches[0].points.some(point=>point[6]===row.id&&point[3]==='sample >=20 and positive median'&&point[2]===row.eligibleSaleCount));
  assert(row.eligibleSaleCount>=20);
  assert(row.periodEnd<='2026-09-30');
 }
});

test('August 2026 apartment supplement is dated, bounded and does not borrow a later quarter',()=>{
 const end=2026*12+8,latest=new Map();
 for(const row of projection.observations){
  const observed=Number(row.periodEnd.slice(0,4))*12+Number(row.periodEnd.slice(5,7));
  if(row.segment!=='apartment'||observed>end||end-observed>12)continue;
  const prior=latest.get(row.projectId);
  if(!prior||row.periodEnd>prior.periodEnd||(row.periodEnd===prior.periodEnd&&row.eligibleSaleCount>prior.eligibleSaleCount))latest.set(row.projectId,row);
 }
 assert.equal(latest.size,56);
 assert([...latest.values()].every(row=>row.periodEnd<='2026-08-31'));
});
