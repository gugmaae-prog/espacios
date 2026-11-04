import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const crosswalk=JSON.parse(await read('data/uae-evidence/ajman/reviewed-v48-crosswalk.json'));
const sourceBytes=gunzipSync(await read('data/uae-evidence/ajman/real-estate-projects-20260826.json.gz'));
const mapBytes=await read('data/recovery/accepted-map-20261013.json');
assert.equal(sha(sourceBytes),crosswalk.sourceRawSha256);
assert.equal(sha(mapBytes),crosswalk.acceptedMapSha256);
const source=JSON.parse(sourceBytes),map=JSON.parse(mapBytes);
const sourceLatest=source.filter(row=>row.update_date===crosswalk.latestSourceSnapshotDate);
const mapAjman=map.projects.filter(project=>project.emirate==='Ajman');
assert.equal(sourceLatest.length,298);
assert.equal(mapAjman.length,10);
assert.equal(crosswalk.matches.length,4);
assert.equal(crosswalk.familyRelations.length,2);
const ids=new Set(),canonicalIds=new Set();
const norm=value=>String(value).toLowerCase().replace(/[^a-z0-9]+/g,'');
for(const match of crosswalk.matches){
  assert.ok(Number.isSafeInteger(match.sourceProjectId));
  assert.ok(!ids.has(match.sourceProjectId)&&!canonicalIds.has(match.canonicalProjectId),'Crosswalk must be one-to-one');
  ids.add(match.sourceProjectId);canonicalIds.add(match.canonicalProjectId);
  const sourceMatches=sourceLatest.filter(row=>row.project_id===match.sourceProjectId);
  const mapMatches=mapAjman.filter(project=>project.id===match.canonicalProjectId);
  assert.equal(sourceMatches.length,1);assert.equal(mapMatches.length,1);
  const row=sourceMatches[0],project=mapMatches[0];
  assert.equal(row.project_name_english,match.sourceProjectName);
  assert.equal(project.name,match.mapProjectName);
  assert.equal(row.developer_name_english,match.sourceDeveloper);
  assert.equal(project.developer,match.mapDeveloper);
  assert.equal(row.district_english,match.sourceDistrict);
  assert.equal(project.area,match.mapArea);
  if(match.nameRelation==='exact_normalized')assert.equal(norm(row.project_name_english),norm(project.name));
  else if(match.nameRelation==='official_name_plus_marketing_attribution')assert.ok(norm(project.name).startsWith(norm(row.project_name_english)));
  else assert.fail('Unknown name relation');
  assert.equal(sourceLatest.filter(candidate=>norm(candidate.project_name_english)===norm(row.project_name_english)).length,1,'Source name must be unique in latest snapshot');
  assert.ok(row.developer_name_english.toLowerCase().includes(match.sourceProjectId===528?'g j properties':'al zorah'));
  if(match.sourceProjectId===522){
    assert.equal(project.developer,'creekside','Known V48 developer corruption must remain explicit');
    assert.equal(Number(row.number_of_real_estate_units),144);
    assert.equal(match.independentIdentityEvidenceUrl,'https://www.alzorahcity.com/creekside_residence');
    assert.ok(match.reviewNote.includes('corrupted'));
  }else assert.ok(project.developer.toLowerCase().includes(match.sourceProjectId===528?'gj properties':'al zorah'));
}
let reviewedFamilySourceIds=0;
const familyIds=new Set();
for(const relation of crosswalk.familyRelations){
  const family=mapAjman.filter(project=>project.id===relation.canonicalFamilyId);
  assert.equal(family.length,1);
  assert.equal(family[0].name,relation.mapFamilyName);
  assert.equal(relation.relation,'source_villa_within_v48_family');
  assert.ok(relation.independentFamilyEvidenceUrl.startsWith('https://www.alzorahcity.com/'));
  const pattern=new RegExp(relation.sourceNamePattern);
  const sourceIds=new Set(relation.sourceProjectIds);
  assert.equal(sourceIds.size,relation.sourceProjectIds.length);
  const expected=sourceLatest.filter(row=>pattern.test(row.project_name_english)&&row.district_english===relation.sourceDistrict&&row.developer_name_english.includes(relation.sourceDeveloperContains));
  assert.deepEqual([...sourceIds].sort((a,b)=>a-b),expected.map(row=>row.project_id).sort((a,b)=>a-b),'Family source IDs must be explicitly complete for the reviewed dated snapshot');
  for(const row of expected){
    assert.ok(!ids.has(row.project_id)&&!familyIds.has(row.project_id),'Identity and family relations must be disjoint');
    assert.equal(row.number_of_real_estate_units,'1');
    familyIds.add(row.project_id);
  }
  reviewedFamilySourceIds+=expected.length;
}
assert.equal(reviewedFamilySourceIds,30);
console.log(JSON.stringify({passed:true,latestSourceProjectIds:sourceLatest.length,v48AjmanProjects:mapAjman.length,reviewedOneToOneMatches:crosswalk.matches.length,reviewedVillaFamilyRelations:reviewedFamilySourceIds,unmatchedLatestSourceProjectIds:sourceLatest.length-crosswalk.matches.length-reviewedFamilySourceIds}));
