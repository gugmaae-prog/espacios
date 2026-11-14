import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {normalizeAjmanLandMortgages} from '../src/stack-audit/ajman-land-mortgages.mjs';

const root=new URL('../',import.meta.url),dir='data/uae-evidence/ajman/';
const read=name=>fs.readFile(new URL(dir+name,root));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const compressed=await read('lands-mortgage-20260821.json.gz'),raw=gunzipSync(compressed);
const metadataBytes=await read('lands-mortgage-source-metadata.json'),metadata=JSON.parse(metadataBytes),meta=metadata.metas?.default;
const capture=JSON.parse(await read('lands-mortgage-capture.json'));
if(metadata.dataset_id!=='lands-mortgage'||meta?.license!=='CC BY 4.0'||meta?.license_url!=='https://creativecommons.org/licenses/by/4.0/'||meta?.publisher!=='Department of Land and Real Estate Regulation'||meta?.modified!=='2026-08-21T04:30:51.835000+00:00'||meta?.records_count!==1098||capture.sourceRows!==1098||capture.independentReadbackCount!==1098||capture.rawBytes!==raw.length||capture.sourceResponseSha256!==sha(raw)||capture.independentReadbackSha256!==sha(raw)||capture.metadataSha256!==sha(metadataBytes)||capture.compressedBytes!==compressed.length||capture.compressedSha256!==sha(compressed))throw Error('Unexpected Ajman mortgage source vintage');
const {quality}=normalizeAjmanLandMortgages(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw)));
if(quality.rows!==1098||quality.observedPeriods.length!==29||JSON.stringify(quality.missingPeriods)!=='["2021Q2"]'||quality.distinctEnglishDistricts!==67||quality.mortgageActionCountSum!==10584||quality.mortgageValueAedSum!==25195471849.05)throw Error('Ajman mortgage reviewed quality totals changed');
const report={sourceId:'ajman-dlrr-20260821-land-mortgage',route:'/map/api/uae-evidence/ajman/land-mortgages',datasetUrl:'https://data.ajman.ae/explore/dataset/lands-mortgage/',api:'https://data.ajman.ae/api/explore/v2.1/catalog/datasets/lands-mortgage',publisher:meta.publisher,licence:meta.license,licenceUrl:meta.license_url,sourceModifiedAt:meta.modified,retrievedAt:capture.retrievedAt,emirate:'Ajman',evidenceClass:'official_land_mortgage_quarterly_district_aggregate',grain:'one source row per sector, bilingual district and quarter; mortgage registrations and mortgage-value modifications',rawSha256:sha(raw),rawBytes:raw.length,independentReadbackSha256:capture.independentReadbackSha256,compressedSha256:sha(compressed),compressedBytes:compressed.length,metadataSha256:sha(metadataBytes),quality,canonicalProjectMatches:0,coordinatesPresent:false,limits:'Dated district-quarter land mortgage aggregate; includes mortgage registration and mortgage-value modification. These are reported actions and values, not distinct new loans, land sales, project-level prices, current inventory, or an all-UAE denominator. It overlaps the Ajman mixed land-dispositions table and must not be added to it. 2021Q2 is absent. No project or district identity merge, price estimate, or cross-source sum is inferred.'};
const path=new URL(dir+'lands-mortgage-validation.json',root),content=JSON.stringify(report,null,2)+'\n';
if(process.argv.includes('--check')){if(await fs.readFile(path,'utf8')!==content)throw Error('Ajman land mortgage report does not match the source');}
else await fs.writeFile(path,content);
console.log(JSON.stringify({passed:true,sourceId:report.sourceId,rows:quality.rows,missingPeriods:quality.missingPeriods,rawSha256:report.rawSha256}));
