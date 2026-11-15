import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

const root=new URL('../',import.meta.url),dir='data/uae-evidence/ajman/';
const read=name=>fs.readFile(new URL(dir+name,root));
const compressed=await read('real-estate-units-transactions-20260821.json.gz');
const raw=gunzipSync(compressed),rows=JSON.parse(raw);
const metadataBytes=await read('transactions-source-metadata.json');
const metadata=JSON.parse(metadataBytes),meta=metadata.metas?.default;
const capture=JSON.parse(await read('transactions-capture.json'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
if(metadata.dataset_id!=='real-estate-units-transactions'||meta?.license!=='CC BY 4.0'||meta?.license_url!=='https://creativecommons.org/licenses/by/4.0/'||meta?.publisher!=='Department of Land and Real Estate Regulation'||meta?.modified!=='2026-08-21T04:40:00.945000+00:00'||meta?.records_count!==6299||!Array.isArray(rows)||rows.length!==6299||capture.independentReadbackSha256!==sha(raw)||capture.rawBytes!==raw.length)throw Error('Unexpected Ajman unit-disposition source vintage');
const fields=['project_name_english','project_name_arabic','sector_english','sector_arabic','district_english','district_arabic','unit_type_english','unit_type_arabic','rooms_count','total_transactions_values_in_aed','transactions_count','max_transaction_value_in_aed','year','quarter'];
const labels=new Set(),periods=new Set(),dimensions=new Set();
let unknownPeriodRows=0,unknownPeriodTransactions=0,unknownValueRows=0,unknownValueTransactions=0,transactionCountSum=0,knownValueSum=0,duplicateDimensionRows=0;
for(const [index,row] of rows.entries()){
 if(Object.keys(row).length!==fields.length||fields.some(field=>!Object.hasOwn(row,field)))throw Error('Unexpected transaction schema at row '+index);
 if(typeof row.project_name_english!=='string'||!row.project_name_english.trim()||typeof row.district_english!=='string'||!row.district_english.trim()||!Number.isSafeInteger(row.transactions_count)||row.transactions_count<0)throw Error('Invalid transaction identity or count at row '+index);
 if((row.year===null)!==(row.quarter===null)||row.year!==null&&(!Number.isSafeInteger(row.year)||row.year<2019||row.year>2026||!Number.isSafeInteger(row.quarter)||row.quarter<1||row.quarter>4))throw Error('Invalid native period at row '+index);
 if((row.total_transactions_values_in_aed===null)!==(row.max_transaction_value_in_aed===null)||row.total_transactions_values_in_aed!==null&&(!Number.isFinite(row.total_transactions_values_in_aed)||row.total_transactions_values_in_aed<0||!Number.isFinite(row.max_transaction_value_in_aed)||row.max_transaction_value_in_aed<0||row.max_transaction_value_in_aed>row.total_transactions_values_in_aed))throw Error('Invalid or inconsistent value at row '+index);
 labels.add(row.project_name_english);transactionCountSum+=row.transactions_count;
 if(row.year===null){unknownPeriodRows++;unknownPeriodTransactions+=row.transactions_count;}else periods.add(row.year+'Q'+row.quarter);
 if(row.total_transactions_values_in_aed===null){unknownValueRows++;unknownValueTransactions+=row.transactions_count;}else knownValueSum+=row.total_transactions_values_in_aed;
 const dimension=JSON.stringify([row.project_name_english,row.sector_english,row.district_english,row.unit_type_english,row.rooms_count,row.year,row.quarter]);
 if(dimensions.has(dimension))duplicateDimensionRows++;dimensions.add(dimension);
}
const observedPeriods=[...periods].sort(),allPeriods=[];for(let year=2019;year<=2026;year++)for(let quarter=1;quarter<=4;quarter++){if(year===2026&&quarter>2)break;allPeriods.push(year+'Q'+quarter);}
const missingPeriods=allPeriods.filter(period=>!periods.has(period));
const report={sourceId:'ajman-dlrr-20260821-unit-dispositions',datasetUrl:'https://data.ajman.ae/explore/dataset/real-estate-units-transactions/',api:'https://data.ajman.ae/api/explore/v2.1/catalog/datasets/real-estate-units-transactions',publisher:meta.publisher,licence:meta.license,licenceUrl:meta.license_url,sourceModifiedAt:meta.modified,retrievedAt:capture.retrievedAt,emirate:'Ajman',evidenceClass:'official_mixed_unit_disposition_aggregate',grain:'source project label × sector × district × unit type × rooms × reported quarter; some periods unknown and one duplicate dimension tuple retained',storageKey:'uae/evidence/ajman/2026-08-21/real-estate-units-transactions.json.gz',rawSha256:sha(raw),rawBytes:raw.length,compressedSha256:sha(compressed),compressedBytes:compressed.length,metadataSha256:sha(metadataBytes),rows:rows.length,distinctSourceProjectLabels:labels.size,observedPeriods,missingPeriods,unknownPeriodRows,unknownPeriodTransactions,unknownValueRows,unknownValueTransactions,transactionCountSum,knownValueAedSum:Number(knownValueSum.toFixed(2)),duplicateDimensionRows,canonicalProjectMatches:0,coordinatesPresent:false,limits:'The publisher mixes real-estate-unit dispositions, mortgage registration and mortgage-value changes without transaction-type fields. This is not a sale-only source and overlaps the separate unit-sales dataset. Missing period or value is unknown, not zero; the known-value sum is incomplete.'};
if(report.distinctSourceProjectLabels!==249||report.observedPeriods.length!==28||JSON.stringify(report.missingPeriods)!=='["2021Q2","2025Q4"]'||report.unknownPeriodRows!==318||report.unknownPeriodTransactions!==1108||report.unknownValueRows!==4594||report.unknownValueTransactions!==14626||report.transactionCountSum!==18057||report.knownValueAedSum!==1071629933.53||report.duplicateDimensionRows!==1)throw Error('Unit-disposition quality totals differ from reviewed export');
const reportPath=new URL(dir+'transactions-validation.json',root);
if(process.argv.includes('--check')){
 const saved=JSON.parse(await fs.readFile(reportPath,'utf8'));
 if(JSON.stringify(saved)!==JSON.stringify(report))throw Error('Unit-disposition report does not match official source');
 console.log(JSON.stringify({passed:true,sourceId:report.sourceId,rows:report.rows,unknownPeriodRows,unknownValueRows,rawSha256:report.rawSha256}));
}else{
 await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({sourceId:report.sourceId,rows:report.rows,unknownPeriodRows,unknownValueRows,rawSha256:report.rawSha256}));
}
