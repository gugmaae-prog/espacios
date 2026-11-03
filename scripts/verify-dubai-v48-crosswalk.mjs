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
assert.equal(crosswalk.districtAliasEvidence?.jvcAlBarshaSouthFourth,'https://dubailand.gov.ae/en/eservices/old-and-new-area-names/old-and-new-area-names-list/');
assert.equal(crosswalk.districtAliasEvidence?.jvcPlotPlan,'https://cdn.emiratesauction.com/media/2e5ozhhqvdf6n4xkjjz3gcvyrjujynriotwq0erotla426mmhy/doc7914.pdf/12834_Affection_Plan.pdf');
assert.equal(crosswalk.districtAliasEvidence?.marsaDubaiDubaiMarina,'https://dubailand.gov.ae/media/c5ejvvoe/annual_report_2024_english.pdf');
const projectIdentityEvidence={
  emaarSouth:'https://www.emaar.com/en/our-communities/emaar-south',
  townSquare:'https://nshama.ae/properties/town-square-dubai/',
  evelyn:'https://nshama.ae/properties/evelyn/'
};
assert.deepEqual(crosswalk.projectIdentityEvidence,projectIdentityEvidence);
const additionalIdentityEvidence={
  '430':'https://www.damacproperties.com/sites/default/files/documents/financial-statements/annualreport2016english.pdf',
  '2166':'https://sobharealty.com/properties-in-dubai/sobha-hartland/one-park-avenue',
  '2239':'https://sobharealty.com/properties-in-dubai/sobha-hartland/waves',
  '2305':'https://sobharealty.com/properties-in-dubai/sobha-hartland/waves-grande',
  '2447':'https://sobharealty.com/properties-in-dubai/sobha-hartland/the-crest',
  '2482':'https://sobharealty.com/properties-in-dubai/sobha-hartland/crest-grande',
  '2564':'https://sobharealty.com/properties-in-dubai/sobha-hartland/waves-opulence',
  '2797':'https://londongate.ae/projects/aeternitas'
};
assert.deepEqual(crosswalk.additionalIdentityEvidence,additionalIdentityEvidence);
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
    (norm(project.area)==='aljaddaf'&&norm(row.community)==='aljadaf')||
    (row.community==='Al Barsha South Fourth'&&/^(?:Dubai, )?Jumeirah Village Circle \(JVC\)$/.test(project.area))||
    (row.community==='Marsa Dubai'&&project.area==='Dubai Marina'&&match.identityEvidenceUrl===additionalIdentityEvidence[match.sourceProjectNumber])||
    (row.community==='Al Merkadh'&&project.area==='Sobha Hartland'&&match.identityEvidenceUrl===additionalIdentityEvidence[match.sourceProjectNumber])||
    (row.community==='Madinat Al Mataar'&&project.area==='Emaar South'&&project.developer==='Emaar'&&match.identityEvidenceUrl===projectIdentityEvidence.emaarSouth)||
    (row.community==='Al Yelayiss 2'&&project.area==='Town Square Dubai'&&project.developer==='NSHAMA'&&match.identityEvidenceUrl===(row.name==='Evelyn On The Park'?projectIdentityEvidence.evelyn:projectIdentityEvidence.townSquare));
  assert.ok(compatibleDistrict,'District must agree or use a documented alias');
  if(row.community==='Madinat Al Mataar'||row.community==='Al Yelayiss 2')assert.ok(match.identityEvidenceUrl,'Cross-district project identity needs developer evidence');
  if(additionalIdentityEvidence[match.sourceProjectNumber])assert.equal(match.identityEvidenceUrl,additionalIdentityEvidence[match.sourceProjectNumber]);
  assert.equal(row.coordinates,null);
}
console.log(JSON.stringify({passed:true,sourceProjects:source.length,v48DubaiProjects:map.length,reviewedOneToOneMatches:crosswalk.matches.length,unmatchedSourceProjects:source.length-crosswalk.matches.length}));
