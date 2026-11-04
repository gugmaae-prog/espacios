import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {normalizeAjmanLandDispositions} from '../src/stack-audit/ajman-land-dispositions.mjs';

const root=new URL('../',import.meta.url),dir='data/uae-evidence/ajman/';
const read=name=>fs.readFile(new URL(dir+name,root));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const compressed=await read('lands-transactions-20260821.json.gz'),raw=gunzipSync(compressed);
const metadataBytes=await read('lands-transactions-source-metadata.json'),metadata=JSON.parse(metadataBytes),meta=metadata.metas?.default;
const capture=JSON.parse(await read('lands-transactions-capture.json'));
if(metadata.dataset_id!=='lands-transactions'||meta?.license!=='CC BY 4.0'||meta?.license_url!=='https://creativecommons.org/licenses/by/4.0/'||meta?.publisher!=='Department of Land and Real Estate Regulation'||meta?.modified!=='2026-08-21T04:29:59.419000+00:00'||meta?.records_count!==1646||capture.rawBytes!==raw.length||capture.independentReadbackBytes!==raw.length||capture.independentReadbackSha256!==sha(raw))throw Error('Unexpected Ajman land-disposition source vintage');
const {quality}=normalizeAjmanLandDispositions(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw)));
if(quality.rows!==1646||quality.observedPeriods.length!==27||JSON.stringify(quality.missingPeriods)!=='["2019Q3","2019Q4","2021Q2"]'||quality.distinctEnglishDistricts!==99||quality.distinctArabicDistricts!==74||quality.duplicateDimensionRows!==0||quality.transactionCountSum!==57651||quality.transactionValueAedSum!==96144467000.85)throw Error('Ajman land-disposition reviewed quality totals changed');
const report={sourceId:'ajman-dlrr-20260821-land-dispositions',datasetUrl:'https://data.ajman.ae/explore/dataset/lands-transactions/',api:'https://data.ajman.ae/api/explore/v2.1/catalog/datasets/lands-transactions',publisher:meta.publisher,licence:meta.license,licenceUrl:meta.license_url,sourceModifiedAt:meta.modified,retrievedAt:capture.retrievedAt,emirate:'Ajman',evidenceClass:'official_land_disposition_quarterly_district_aggregate',grain:'one source row per reported sector, bilingual district and quarter; includes mortgage registration and mortgage-value modification',rawSha256:sha(raw),rawBytes:raw.length,independentReadbackSha256:capture.independentReadbackSha256,compressedSha256:sha(compressed),compressedBytes:compressed.length,metadataSha256:sha(metadataBytes),quality,canonicalProjectMatches:0,coordinatesPresent:false,limits:'This is a dated district-quarter land-disposition aggregate, including mortgage activity, not individual transactions, unit sales, project-level prices, sale-only volume, a current valuation, or an all-UAE denominator. It overlaps the separate Ajman land-sales dataset and cannot be added to it. The publisher excludes transactions without land value; 2019Q3, 2019Q4 and 2021Q2 are absent. No project or district identity merge, price-per-area estimate, or cross-source sum is inferred.'};
const path=new URL(dir+'lands-transactions-validation.json',root);
if(process.argv.includes('--check')){
 const saved=JSON.parse(await fs.readFile(path,'utf8'));
 if(JSON.stringify(saved)!==JSON.stringify(report))throw Error('Ajman land-disposition report does not match the source');
 console.log(JSON.stringify({passed:true,sourceId:report.sourceId,rows:quality.rows,missingPeriods:quality.missingPeriods,rawSha256:report.rawSha256}));
}else{
 await fs.writeFile(path,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({sourceId:report.sourceId,rows:quality.rows,missingPeriods:quality.missingPeriods,rawSha256:report.rawSha256}));
}
