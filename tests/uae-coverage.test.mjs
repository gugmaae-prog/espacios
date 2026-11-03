import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {mapUaeCoverage} from '../src/stack-audit/uae-coverage.mjs';
import worker from '../src/worker.js';

const root=new URL('../',import.meta.url),report=JSON.parse(await fs.readFile(new URL('data/uae-evidence/coverage-validation.json',root)));
const request=(suffix='',method='GET')=>new Request(`https://espacios.me/map/api/uae-evidence/coverage${suffix}`,{method});

test('coverage inventory is tied to the accepted map and source reports',async()=>{
 assert.equal(report.emirates.length,7);assert.equal(report.acceptedSnapshot.projectRecords,1645);
 assert.equal(report.acceptedSnapshot.mappedProjectRecords,1518);assert.equal(report.acceptedSnapshot.approximateCommunityCentrePoints,360);
 assert.equal(report.acceptedSnapshot.searchableWithoutCoordinates,127);assert.equal(report.allUaeProjectDenominator,null);assert.equal(report.projectCompletenessPercent,null);
 assert.equal(report.emirates.reduce((sum,item)=>sum+item.acceptedV48.projectRecords,0),1645);
 assert.equal(report.emirates.reduce((sum,item)=>sum+item.publishedSources.length,0),17);
 assert.deepEqual(report.emirates.filter(item=>item.publishedSources.length===0).map(item=>item.name),['Fujairah','Ras Al Khaimah','Sharjah','Umm Al Quwain']);
 const sourcePaths={heatmap:'data/recovery/accepted-uae-heatmap-20261102.json',developerProjects:'data/uae-evidence/abu-dhabi/sdi-developer-projects-validation.json',developerGeometry:'data/uae-evidence/abu-dhabi/sdi-developer-projects-geometry-validation.json',ajmanRegister:'data/uae-evidence/ajman/projects-validation.json',ajmanBuildingPermits:'data/uae-evidence/ajman/building-permits-validation.json',ajmanLandDispositions:'data/uae-evidence/ajman/lands-transactions-validation.json',ajmanUnitMortgages:'data/uae-evidence/ajman/real-estate-units-mortgage-validation.json',ajmanRents:'data/uae-evidence/ajman/certified-rent-validation.json',dubaiStatus:'data/uae-evidence/dubai/dld-project-status-validation.json'};
 for(const [key,path] of Object.entries(sourcePaths)){const bytes=await fs.readFile(new URL(path,root));assert.equal(createHash('sha256').update(bytes).digest('hex'),report.basisSha256[key]);}
 const abuDhabi=report.emirates.find(item=>item.name==='Abu Dhabi'),ajman=report.emirates.find(item=>item.name==='Ajman'),dubai=report.emirates.find(item=>item.name==='Dubai');
 assert.equal(abuDhabi.publishedSources.find(item=>item.route.endsWith('/developer-projects')).sourceRows,411);
 assert.equal(abuDhabi.publishedSources.find(item=>item.route.endsWith('/developer-projects')).sourceGeometryAvailable,true);
 assert.equal(ajman.publishedSources.find(item=>item.route.endsWith('/register')).latestSourceProjectIds,298);
 assert.equal(ajman.publishedSources.find(item=>item.route.endsWith('/register')).reviewedV48IdentityLinks,3);
 assert.equal(ajman.publishedSources.find(item=>item.route.endsWith('/land-dispositions')).sourceRows,1646);
 assert.equal(ajman.publishedSources.find(item=>item.route.endsWith('/building-permits')).sourceRows,741);
 assert.equal(ajman.publishedSources.find(item=>item.route.endsWith('/building-permits')).usableRows,537);
 assert.equal(ajman.publishedSources.find(item=>item.route.endsWith('/unit-mortgages')).sourceRows,651);
 assert.equal(dubai.publishedSources[0].reviewedV48IdentityLinks,79);assert.equal(dubai.publishedSources[0].unmatchedSourceProjectIds,3792);
 assert.ok(report.emirates.every(item=>item.authoritativeAllProjectDenominator===null&&item.gaps.length>0));
});

test('read-only API selects an emirate without inventing completeness or source health',async()=>{
 const all=await mapUaeCoverage(request(),report),body=await all.json();
 assert.equal(all.status,200);assert.equal(body.emirates.length,7);assert.equal(body.projectCompletenessPercent,null);
 const chosen=await (await mapUaeCoverage(request('?emirate=Ras%20Al%20Khaimah'),report)).json();
 assert.equal(chosen.emirates.length,1);assert.equal(chosen.emirates[0].name,'Ras Al Khaimah');assert.deepEqual(chosen.emirates[0].publishedSources,[]);
 assert.ok(body.emirates.flatMap(item=>item.publishedSources).every(item=>item.liveRouteHealth==='not_asserted_by_inventory'));
 assert.equal((await mapUaeCoverage(request('?emirate=Unknown'),report)).status,400);
 assert.equal((await mapUaeCoverage(request('','POST'),report)).status,405);
 assert.equal((await mapUaeCoverage(request('','HEAD'),report)).body,null);
});

test('compiled Worker serves the seven-emirate inventory',async()=>{
 const response=await worker.fetch(request(),{DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'coverage-test'}},{}),body=await response.json();
 assert.equal(response.status,200);assert.equal(response.headers.get('x-espacios-evidence-source'),'accepted-v48-and-published-source-inventory');
 assert.equal(body.emirates.length,7);assert.equal(body.allUaeProjectDenominator,null);
});
