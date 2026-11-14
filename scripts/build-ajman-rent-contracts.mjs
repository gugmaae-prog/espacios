import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {normalizeAjmanRentContracts} from '../src/stack-audit/ajman-rent-contracts.mjs';

const root=new URL('../',import.meta.url),dir='data/uae-evidence/ajman/';
const read=name=>fs.readFile(new URL(dir+name,root));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const reviewed=[
 {city:'ajman',cityName:'Ajman city',dataset:'certified-rent-contracts-in-ajman',modified:'2026-09-08T04:39:41.424000+00:00',rawSha256:'01665ba0f137654f6c45f679b7cb8b43d90fa482230f3b110dd19f198e4c7cf9',quality:{rows:948,observedMonthStart:'2016-01',observedMonthEnd:'2026-06',observedMonths:126,minimumRowsPerReportedMonth:5,maximumRowsPerReportedMonth:11,duplicateDimensionRows:3,zeroCountRows:163,unavailableTokens:{NA:24}}},
 {city:'manama',cityName:'Manama',dataset:'certified-rent-contract-in-manama',modified:'2026-09-23T10:50:20.364000+00:00',rawSha256:'f9b71bc2e612e51daf29ae3620eeb4dc464ce4736200bfb06552b5f384449bc4',quality:{rows:946,observedMonthStart:'2016-01',observedMonthEnd:'2026-06',observedMonths:126,minimumRowsPerReportedMonth:5,maximumRowsPerReportedMonth:11,duplicateDimensionRows:1,zeroCountRows:557,unavailableTokens:{NA:51,'#REF!':1}}},
 {city:'masfoot',cityName:'Masfoot',dataset:'certified-rent-contracts-in-masfoot',modified:'2025-11-26T05:57:10.257000+00:00',rawSha256:'283eb8eae1d2bc36b6012a140afb1060b5bfcdf893c4ce2e5b6a037d50b6e9a5',quality:{rows:862,observedMonthStart:'2016-01',observedMonthEnd:'2025-09',observedMonths:117,minimumRowsPerReportedMonth:5,maximumRowsPerReportedMonth:10,duplicateDimensionRows:10,zeroCountRows:478,unavailableTokens:{NA:53}}}
];
const sources=[];
for(const item of reviewed){
 const compressed=await read(`certified-rent-${item.city}.json.gz`),raw=gunzipSync(compressed),metadataBytes=await read(`certified-rent-${item.city}-metadata.json`),metadata=JSON.parse(metadataBytes),meta=metadata.metas?.default,capture=JSON.parse(await read(`certified-rent-${item.city}-capture.json`));
 if(metadata.dataset_id!==item.dataset||meta?.publisher!=='Municipality & Planning Department'||meta?.license!=='CC BY 4.0'||meta?.license_url!=='https://creativecommons.org/licenses/by/4.0/'||meta?.modified!==item.modified||meta?.records_count!==item.quality.rows||capture.datasetId!==item.dataset||capture.rawBytes!==raw.length||capture.independentReadbackSha256!==sha(raw)||sha(raw)!==item.rawSha256)throw Error(`${item.city} rent-contract source vintage changed`);
 const quality=normalizeAjmanRentContracts(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw)),item.city).quality;
 if(JSON.stringify(quality)!==JSON.stringify(item.quality))throw Error(`${item.city} rent-contract quality changed`);
 sources.push({id:`ajman-municipality-${item.city}-certified-rent-${item.modified.slice(0,10)}`,city:item.city,cityName:item.cityName,datasetUrl:`https://data.ajman.ae/explore/dataset/${item.dataset}/`,api:`https://data.ajman.ae/api/explore/v2.1/catalog/datasets/${item.dataset}`,publisher:meta.publisher,licence:meta.license,licenceUrl:meta.license_url,sourceModifiedAt:meta.modified,retrievedAt:capture.retrievedAt,rawSha256:sha(raw),rawBytes:raw.length,independentReadbackSha256:capture.independentReadbackSha256,compressedSha256:sha(compressed),compressedBytes:compressed.length,metadataSha256:sha(metadataBytes),quality});
}
const report={version:'20261103-ajman-city-certified-rent-contracts-v1',sources,scope:{emirate:'Ajman',evidenceClass:'official_certified_rent_contract_count',grain:'one reported city, month, service, contract category and channel row; duplicate dimensions remain separate source rows',cities:['Ajman city','Manama','Masfoot'],canonicalProjectMatches:0,coordinatesPresent:false,amountsPresent:false,limits:'These are published counts of certified rent contracts, not contract-level records, active leases, rents paid, asking rents, yields, project prices, or an all-Ajman denominator. Source NA and #REF! values remain null. Repeated dimensions and uneven category coverage prevent a reliable cross-city or market total; source vintages differ.'}};
const path=new URL(dir+'certified-rent-validation.json',root);
if(process.argv.includes('--check')){
 const saved=JSON.parse(await fs.readFile(path,'utf8'));
 if(JSON.stringify(saved)!==JSON.stringify(report))throw Error('Ajman certified-rent report does not match the sources');
 console.log(JSON.stringify({passed:true,rows:sources.map(source=>[source.city,source.quality.rows]),unavailable:sources.map(source=>[source.city,source.quality.unavailableTokens])}));
}else{
 await fs.writeFile(path,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({sources:sources.map(source=>[source.city,source.quality.rows]),report:path.pathname}));
}
