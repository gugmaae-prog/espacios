import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

const root=new URL('../',import.meta.url),dir='data/uae-evidence/ajman/';
const read=name=>fs.readFile(new URL(dir+name,root));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const months='January February March April May June July August September October November December'.split(' ');
const fields=['year','month_ar','month_en','service_ar','service_en','category_1_ar','category_1_en','category_2_ar','category_2_en','value'];
const packed=await read('new-building-use-20260923.json.gz'),raw=gunzipSync(packed),rows=JSON.parse(raw);
const metadataBytes=await read('new-building-use-source-metadata.json'),metadata=JSON.parse(metadataBytes),meta=metadata.metas?.default;
const capture=JSON.parse(await read('new-building-use-capture.json'));
if(metadata.dataset_id!=='licenses-issued-for-new-buildings-by-number-of-buildings'||meta?.license!=='CC BY 4.0'||meta?.license_url!=='https://creativecommons.org/licenses/by/4.0/'||meta?.publisher!=='Municipality & Planning Department'||meta?.modified!=='2026-09-23T10:45:14.834000+00:00'||meta?.records_count!==284)throw Error('Ajman new-building source metadata changed');
if(JSON.stringify(metadata.fields.map(field=>field.name))!==JSON.stringify(fields))throw Error('Ajman new-building source schema changed');
if(!Array.isArray(rows)||rows.length!==284||capture.totalCount!==284||capture.independentReadbackCount!==284||capture.sourceResponseSha256!==sha(raw)||capture.independentReadbackSha256!==sha(raw)||capture.rawBytes!==raw.length||capture.compressedSha256!==sha(packed)||capture.compressedBytes!==packed.length||capture.metadataSha256!==sha(metadataBytes))throw Error('Ajman new-building capture mismatch');
const groups=new Map();
for(const row of rows){
 if(JSON.stringify(Object.keys(row).sort())!==JSON.stringify([...fields].sort())||!Number.isInteger(row.year)||row.year<2015||row.year>2026||!months.includes(row.month_en)||typeof row.month_ar!=='string'||!row.month_ar||row.service_en!=='New building permission'||row.category_2_en!=='No. of buildings'||!['Residential buildings','Non-residential buildings'].includes(row.category_1_en)||!Number.isSafeInteger(row.value)||row.value<0)throw Error('Invalid Ajman new-building row');
 const key=[row.year,months.indexOf(row.month_en)+1,row.category_1_en].join('|');groups.set(key,[...(groups.get(key)||[]),row]);
}
const conflicts=[...groups.values()].filter(group=>group.length>1),usable=[...groups.values()].filter(group=>group.length===1).map(group=>group[0]);
if(groups.size!==276||conflicts.length!==8||conflicts.some(group=>group.length!==2||group[0].value===group[1].value)||usable.length!==268)throw Error('Ajman new-building quality profile changed');
const usableRowsByYear=Object.fromEntries([...new Set(usable.map(row=>row.year))].sort((a,b)=>a-b).map(year=>[year,usable.filter(row=>row.year===year).length]));
if(JSON.stringify(usableRowsByYear)!==JSON.stringify({2015:24,2016:24,2017:24,2018:24,2019:24,2020:24,2021:24,2022:24,2023:16,2024:24,2025:24,2026:12}))throw Error('Ajman new-building observed years changed');
const completeYears=Object.entries(usableRowsByYear).filter(([,count])=>count===24).map(([year])=>Number(year));
if(JSON.stringify(completeYears)!==JSON.stringify([2015,2016,2017,2018,2019,2020,2021,2022,2024,2025]))throw Error('Ajman new-building complete years changed');
const report={sourceId:'ajman-mpd-20260923-new-building-use',datasetUrl:capture.datasetUrl,recordsUrl:capture.recordsUrl,publisher:meta.publisher,licence:meta.license,licenceUrl:meta.license_url,sourceModifiedAt:meta.modified,retrievedAt:capture.retrievedAt,emirate:'Ajman',evidenceClass:'official_new_building_permission_count',grain:'calendar month × residential or non-residential use; number of buildings covered by new-building permissions',rawSha256:sha(raw),rawBytes:raw.length,compressedSha256:sha(packed),compressedBytes:packed.length,metadataSha256:sha(metadataBytes),sourceRows:rows.length,distinctDimensionGroups:groups.size,conflictingGroups:conflicts.length,conflictingSourceRows:16,usableRows:usable.length,usableRowsByYear,completeYears,latestCompleteYear:2025,latestReportedMonth:'2026-06',limits:'Eight conflicting duplicate month/use groups in 2023 are withheld, leaving that year incomplete. The 2026 series runs through June only. Non-residential includes uses beyond commercial; counts are buildings on new-building permissions, not completed or available spaces, transactions, price evidence, or a project register. Do not add these counts to the separate Ajman building-type permit series.'};
const path=new URL(dir+'new-building-use-validation.json',root);
if(process.argv.includes('--check')){const saved=JSON.parse(await fs.readFile(path,'utf8'));if(JSON.stringify(saved)!==JSON.stringify(report))throw Error('Ajman new-building validation differs from source');console.log(JSON.stringify({passed:true,sourceRows:report.sourceRows,usableRows:report.usableRows,latestCompleteYear:report.latestCompleteYear}));}
else{await fs.writeFile(path,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({sourceRows:report.sourceRows,usableRows:report.usableRows,latestCompleteYear:report.latestCompleteYear}));}
