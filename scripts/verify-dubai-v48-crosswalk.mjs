import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {normalizeDubaiStatusCsv} from '../src/stack-audit/dubai-project-status.mjs';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const norm=value=>String(value).toLowerCase().replace(/[^a-z0-9]+/g,'');
const crosswalk=JSON.parse(await read('data/uae-evidence/dubai/reviewed-v48-crosswalk.json'));
const report=JSON.parse(await read('data/uae-evidence/dubai/dld-project-status-validation.json'));
const sourceBytes=gunzipSync(await read('data/uae-evidence/dubai/dld-project-status-20261101.csv.gz'));
const mapBytes=await read('data/recovery/accepted-map-20261013.json');
assert.equal(sha(sourceBytes),crosswalk.sourceRawSha256);
assert.equal(sha(mapBytes),crosswalk.acceptedMapSha256);
assert.equal(crosswalk.sourceRawSha256,report.rawSha256);
assert.equal(crosswalk.sourceSnapshotDate,report.sourcePublicationDate);
assert.equal(crosswalk.sourceDatasetId,report.sourceId);
const source=normalizeDubaiStatusCsv(sourceBytes.toString('utf8'),report);
const map=JSON.parse(mapBytes).projects.filter(project=>project.emirate==='Dubai');
const sourceIds=new Set(),mapIds=new Set();
for(const match of crosswalk.matches){
  assert.match(match.sourceProjectNumber,/^\d+$/);
  assert.ok(!sourceIds.has(match.sourceProjectNumber)&&!mapIds.has(match.canonicalProjectId),'Crosswalk must be one-to-one');
  sourceIds.add(match.sourceProjectNumber);mapIds.add(match.canonicalProjectId);
  const sourceRows=source.filter(row=>row.sourceProjectNumber===match.sourceProjectNumber);
  const mapRows=map.filter(project=>project.id===match.canonicalProjectId);
  assert.equal(sourceRows.length,1);assert.equal(mapRows.length,1);
  const row=sourceRows[0],project=mapRows[0];
  assert.equal(row.name,match.sourceProjectName);assert.equal(project.name,match.mapProjectName);
  assert.equal(row.developerName,match.sourceDeveloper);assert.equal(project.developer,match.mapDeveloper);
  assert.equal(row.community,match.sourceDistrict);assert.equal(project.area,match.mapArea);
  assert.equal(norm(row.name),norm(project.name),'Crosswalk names must match after punctuation normalization');
  assert.equal(source.filter(candidate=>norm(candidate.name)===norm(row.name)).length,1,'Source name must be unique');
  assert.equal(map.filter(candidate=>norm(candidate.name)===norm(project.name)).length,1,'Map name must be unique');
  const developerTokens=project.developer.toLowerCase().split(/[^a-z0-9]+/).filter(token=>token.length>=4&&!['real','estate','development','developments','properties'].includes(token));
  assert.ok(developerTokens.some(token=>row.developerName.toLowerCase().includes(token)),'Developer or brand must agree');
  const compatibleDistrict=norm(project.area)===norm(row.community)||
    (norm(project.area)==='aljaddaf'&&norm(row.community)==='aljadaf');
  assert.ok(compatibleDistrict,'District must agree or use reviewed Al Jaddaf spelling');
  assert.equal(row.coordinates,null);
}
console.log(JSON.stringify({passed:true,sourceProjects:source.length,v48DubaiProjects:map.length,reviewedOneToOneMatches:crosswalk.matches.length,unmatchedSourceProjects:source.length-crosswalk.matches.length}));
