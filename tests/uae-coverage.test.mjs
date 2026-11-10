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
 assert.equal(report.emirates.reduce((sum,item)=>sum+item.publishedSources.length,0),27);
 assert.deepEqual(report.emirates.filter(item=>item.publishedSources.length===0).map(item=>item.name),[]);
 assert.equal(report.publisherListingInventory.snapshotRows,1670);
 assert.equal(report.publisherListingInventory.explicitEmirateLocationLabelRows,603);
 assert.equal(report.publisherListingInventory.unassignedLocationLabelRows,1067);
 assert.equal(report.publisherListingInventory.reviewedAreaLocationRows,886);
 assert.equal(report.publisherListingInventory.unresolvedLocationRows,181);
 const sourcePaths={heatmap:'data/recovery/accepted-uae-heatmap-20261102.json',developerProjects:'data/uae-evidence/abu-dhabi/sdi-developer-projects-validation.json',developerGeometry:'data/uae-evidence/abu-dhabi/sdi-developer-projects-geometry-validation.json',ajmanRegister:'data/uae-evidence/ajman/projects-validation.json',ajmanBuildingPermits:'data/uae-evidence/ajman/building-permits-validation.json',ajmanNewBuilding:'data/uae-evidence/ajman/new-building-use-validation.json',ajmanLandDispositions:'data/uae-evidence/ajman/lands-transactions-validation.json',ajmanUnitMortgages:'data/uae-evidence/ajman/real-estate-units-mortgage-validation.json',ajmanRents:'data/uae-evidence/ajman/certified-rent-validation.json',rgeIndex:'data/uae-evidence/rgestate/full-index-validation.json',rgeLabels:'data/uae-evidence/rgestate/emirate-label-validation.json',rgeAreas:'data/uae-evidence/rgestate/area-geography-validation.json',dubaiStatus:'data/uae-evidence/dubai/dld-project-status-validation.json',dubaiBuildingStock:'data/uae-evidence/dubai/commercial-building-stock-validation.json',sharjahMarket:'data/uae-evidence/sharjah/market-aggregates-validation.json',sharjahAnnual:'data/uae-evidence/sharjah/annual-market-validation.json',rakMarket:'data/uae-evidence/ras-al-khaimah/market-values-validation.json',rakCommercialHistory:'data/uae-evidence/ras-al-khaimah/commercial-sales-history-validation.json',rakPermits:'data/uae-evidence/ras-al-khaimah/building-permits-validation.json',fujairahPermits:'data/uae-evidence/fujairah/building-permits-validation.json',uaqIndustrialGuide:'data/uae-evidence/umm-al-quwain/industrial-plot-guide-validation.json'};
 for(const [key,path] of Object.entries(sourcePaths)){const bytes=await fs.readFile(new URL(path,root));assert.equal(createHash('sha256').update(bytes).digest('hex'),report.basisSha256[key]);}
 const abuDhabi=report.emirates.find(item=>item.name==='Abu Dhabi'),ajman=report.emirates.find(item=>item.name==='Ajman'),dubai=report.emirates.find(item=>item.name==='Dubai'),sharjah=report.emirates.find(item=>item.name==='Sharjah'),rak=report.emirates.find(item=>item.name==='Ras Al Khaimah');
 assert.equal(abuDhabi.publishedSources.find(item=>item.route.endsWith('/developer-projects')).sourceRows,411);
 assert.equal(abuDhabi.publishedSources.find(item=>item.route.endsWith('/developer-projects')).sourceGeometryAvailable,true);
 assert.equal(abuDhabi.publishedSources.find(item=>item.route.endsWith('/building-uses')).layerFeatureCount,392495);
 assert.equal(abuDhabi.publishedSources.find(item=>item.route.endsWith('/building-uses')).unknownUseFeatures,249177);
 assert.equal(ajman.publishedSources.find(item=>item.route.endsWith('/register')).latestSourceProjectIds,298);
 assert.equal(ajman.publishedSources.find(item=>item.route.endsWith('/register')).reviewedV48IdentityLinks,4);
 assert.equal(ajman.publishedSources.find(item=>item.route.endsWith('/register')).reviewedVillaFamilyRelations,30);
 assert.equal(ajman.publishedSources.find(item=>item.route.endsWith('/land-dispositions')).sourceRows,1646);
 assert.equal(ajman.publishedSources.find(item=>item.route.endsWith('/building-permits')).sourceRows,741);
 assert.equal(ajman.publishedSources.find(item=>item.route.endsWith('/building-permits')).usableRows,537);
 assert.equal(ajman.publishedSources.find(item=>item.route.endsWith('/new-building-use')).usableRows,268);
 assert.equal(ajman.publishedSources.find(item=>item.route.endsWith('/unit-mortgages')).sourceRows,651);
 assert.equal(dubai.publishedSources[0].reviewedV48IdentityLinks,83);assert.equal(dubai.publishedSources[0].unmatchedSourceProjectIds,3788);assert.equal(dubai.publishedSources[1].selectedRows,30);assert.equal(dubai.publishedSources[1].ambiguousKeyRowsWithheld,403);
 assert.equal(sharjah.publishedSources[0].sourceRows,2);assert.equal(sharjah.publishedSources[0].notTransactionLevel,true);assert.equal(sharjah.publishedSources[1].sourceRows,4);assert.equal(sharjah.publishedSources[1].notCommercialOnly,true);
 assert.equal(rak.publishedSources[0].sourceRows,6);assert.equal(rak.publishedSources[0].notTransactionCounts,true);assert.equal(rak.publishedSources[1].sourceRows,11);assert.deepEqual(rak.publishedSources[1].commercialUnitReportedYears,[2019,2021,2022,2023,2024,2025]);assert.equal(rak.publishedSources[2].sourceRows,9);assert.equal(rak.publishedSources[2].buildingTypeRows,9);assert.equal(rak.publishedSources[2].notAvailableUnits,true);
 const fujairah=report.emirates.find(item=>item.name==='Fujairah');assert.equal(fujairah.publishedSources[0].sourceRows,5);assert.equal(fujairah.publishedSources[0].buildingUseRows2023,3);assert.equal(fujairah.publishedSources[0].buildingUseRows2024,3);assert.equal(fujairah.publishedSources[0].buildingUseRows2025,3);assert.equal(fujairah.publishedSources[0].notAvailableUnits,true);
 const uaq=report.emirates.find(item=>item.name==='Umm Al Quwain');assert.equal(uaq.publishedSources[0].sourceRows,4);assert.equal(uaq.publishedSources[0].notCurrentOffer,true);assert.equal(uaq.publishedSources[0].notAvailableUnits,true);
 assert.deepEqual(Object.fromEntries(report.emirates.map(item=>[item.name,item.publisherListingSnapshot.explicitLocationLabelRows])),{'Abu Dhabi':9,Ajman:32,Dubai:5,Fujairah:3,'Ras Al Khaimah':7,Sharjah:354,'Umm Al Quwain':193});
 assert.equal(dubai.publisherListingSnapshot.reviewedAreaLocationRows,884);
 assert.equal(abuDhabi.publisherListingSnapshot.reviewedAreaLocationRows,2);
 assert.equal(report.emirates.filter(item=>!['Dubai','Abu Dhabi'].includes(item.name)).reduce((n,item)=>n+item.publisherListingSnapshot.reviewedAreaLocationRows,0),0);
 assert.ok(report.emirates.every(item=>item.publisherListingSnapshot.geographyStatus==='publisher_label_unverified'));
 assert.ok(report.emirates.every(item=>item.authoritativeAllProjectDenominator===null&&item.gaps.length>0));
});

test('read-only API selects an emirate without inventing completeness or source health',async()=>{
 const all=await mapUaeCoverage(request(),report),body=await all.json();
 assert.equal(all.status,200);assert.equal(body.emirates.length,7);assert.equal(body.projectCompletenessPercent,null);
 const chosen=await (await mapUaeCoverage(request('?emirate=Ras%20Al%20Khaimah'),report)).json();
 assert.equal(chosen.emirates.length,1);assert.equal(chosen.emirates[0].name,'Ras Al Khaimah');assert.equal(chosen.emirates[0].publishedSources.length,3);assert.equal(chosen.emirates[0].publishedSources[0].notTransactionCounts,true);
 assert.equal(chosen.emirates[0].publisherListingSnapshot.explicitLocationLabelRows,7);
 assert.equal(chosen.publisherListingInventory.unassignedLocationLabelRows,1067);
 assert.equal(chosen.publisherListingInventory.unresolvedLocationRows,181);
 assert.ok(body.emirates.flatMap(item=>item.publishedSources).every(item=>item.liveRouteHealth==='not_asserted_by_inventory'));
 assert.equal((await mapUaeCoverage(request('?emirate=Unknown'),report)).status,400);
 assert.equal((await mapUaeCoverage(request('','POST'),report)).status,405);
 assert.equal((await mapUaeCoverage(request('','HEAD'),report)).body,null);
});

test('compiled Worker serves the seven-emirate inventory',async()=>{
 const response=await worker.fetch(request(),{DATA_ROOM_PUBLIC:'false',MAP_VERSION:{id:'coverage-test'}},{}),body=await response.json();
 assert.equal(response.status,200);assert.equal(response.headers.get('x-espacios-evidence-source'),'accepted-v48-and-published-source-inventory');
 assert.equal(body.emirates.length,7);assert.equal(body.allUaeProjectDenominator,null);
 assert.equal(body.publisherListingInventory.explicitEmirateLocationLabelRows,603);
 assert.equal(body.publisherListingInventory.reviewedAreaLocationRows,886);
 const ajman=body.emirates.find(item=>item.name==='Ajman').publishedSources.find(item=>item.route.endsWith('/register'));
 assert.equal(ajman.reviewedV48IdentityLinks,4);assert.equal(ajman.reviewedVillaFamilyRelations,30);
});
