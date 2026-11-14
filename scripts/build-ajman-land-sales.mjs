import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {normalizeAjmanLandSales} from '../src/stack-audit/ajman-land-sales.mjs';

const root=new URL('../',import.meta.url),dir='data/uae-evidence/ajman/';
const read=name=>fs.readFile(new URL(dir+name,root));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const compressed=await read('lands-sales-20260821.json.gz'),raw=gunzipSync(compressed);
const metadataBytes=await read('lands-sales-source-metadata.json'),metadata=JSON.parse(metadataBytes),meta=metadata.metas?.default;
const capture=JSON.parse(await read('lands-sales-capture.json'));
if(metadata.dataset_id!=='lands-sales'||meta?.license!=='CC BY 4.0'||meta?.license_url!=='https://creativecommons.org/licenses/by/4.0/'||meta?.publisher!=='Department of Land and Real Estate Regulation'||meta?.modified!=='2026-08-21T04:22:34.886000+00:00'||meta?.records_count!==1554||capture.rawBytes!==raw.length||capture.independentReadbackSha256!==sha(raw))throw Error('Unexpected Ajman land-sales source vintage');
const {quality}=normalizeAjmanLandSales(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw)));
if(quality.rows!==1554||quality.observedPeriods.length!==29||JSON.stringify(quality.missingPeriods)!=='["2021Q2"]'||quality.distinctEnglishDistricts!==73||quality.distinctArabicDistricts!==72||quality.duplicateEnglishDimensionRows!==1||JSON.stringify(quality.districtLabelConflicts)!=='["Humaideya 2"]'||quality.unavailableValueRows!==1||quality.salesCountSum!==44279||quality.knownValueAedSum!==61872495981.8)throw Error('Ajman land-sales reviewed quality totals changed');
const report={sourceId:'ajman-dlrr-20260821-land-sales',datasetUrl:'https://data.ajman.ae/explore/dataset/lands-sales/',api:'https://data.ajman.ae/api/explore/v2.1/catalog/datasets/lands-sales',publisher:meta.publisher,licence:meta.license,licenceUrl:meta.license_url,sourceModifiedAt:meta.modified,retrievedAt:capture.retrievedAt,emirate:'Ajman',evidenceClass:'official_land_sale_quarterly_district_aggregate',grain:'one source row per reported sector, bilingual district and quarter; one English district-period tuple repeats with conflicting Arabic labels',rawSha256:sha(raw),rawBytes:raw.length,independentReadbackSha256:capture.independentReadbackSha256,compressedSha256:sha(compressed),compressedBytes:compressed.length,metadataSha256:sha(metadataBytes),quality,canonicalProjectMatches:0,coordinatesPresent:false,limits:'This is a dated Ajman district-level land-sales aggregate, not unit sales, registered individual transactions, project-level prices, a current valuation, or an all-UAE denominator. One value is reported as Unavailable; 2021Q2 is absent. A duplicated English district-period has conflicting Arabic labels, so no project or district identity merge, price-per-area estimate, or cross-source summation is inferred.'};
const path=new URL(dir+'lands-sales-validation.json',root);
if(process.argv.includes('--check')){
 const saved=JSON.parse(await fs.readFile(path,'utf8'));
 if(JSON.stringify(saved)!==JSON.stringify(report))throw Error('Ajman land-sales report does not match the source');
 console.log(JSON.stringify({passed:true,sourceId:report.sourceId,rows:quality.rows,missingPeriods:quality.missingPeriods,unavailableValueRows:quality.unavailableValueRows,rawSha256:report.rawSha256}));
}else{
 await fs.writeFile(path,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({sourceId:report.sourceId,rows:quality.rows,missingPeriods:quality.missingPeriods,unavailableValueRows:quality.unavailableValueRows,rawSha256:report.rawSha256}));
}
