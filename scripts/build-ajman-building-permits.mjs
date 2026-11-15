import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

const root=new URL('../',import.meta.url),dir='data/uae-evidence/ajman/';
const read=name=>fs.readFile(new URL(dir+name,root));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const months='January February March April May June July August September October November December'.split(' ');
const packed=await read('building-permits-20260901.json.gz'),raw=gunzipSync(packed),rows=JSON.parse(raw);
const metadataBytes=await read('building-permits-source-metadata.json'),metadata=JSON.parse(metadataBytes),meta=metadata.metas?.default;
const capture=JSON.parse(await read('building-permits-capture.json'));
if(metadata.dataset_id!=='building-licenses-by-building-type'||meta?.license!=='CC BY 4.0'||meta?.license_url!=='https://creativecommons.org/licenses/by/4.0/'||meta?.publisher!=='Municipality & Planning Department'||meta?.modified!=='2026-09-01T08:11:41.069000+00:00'||meta?.records_count!==741)throw Error('Unexpected Ajman building-permit source metadata');
if(JSON.stringify(metadata.fields.map(field=>field.name))!==JSON.stringify(['year','month_ar','month_en','building_type_en','building_type_ar','number_of_building_permits_issued_by_type_of_building']))throw Error('Ajman building-permit schema changed');
if(!Array.isArray(rows)||rows.length!==741||capture.totalCount!==rows.length||capture.independentReadbackCount!==rows.length||capture.sourceResponseSha256!==sha(raw)||capture.independentReadbackSha256!==sha(raw)||capture.rawBytes!==raw.length||capture.compressedSha256!==sha(packed)||capture.compressedBytes!==packed.length)throw Error('Ajman building-permit capture mismatch');
const groups=new Map();
for(const row of rows){
 if(JSON.stringify(Object.keys(row).sort())!==JSON.stringify(['year','month_ar','month_en','building_type_en','building_type_ar','number_of_building_permits_issued_by_type_of_building'].sort()))throw Error('Unexpected permit row fields');
 if(!Number.isInteger(row.year)||row.year<2015||row.year>2026||!months.includes(row.month_en)||typeof row.month_ar!=='string'||!row.month_ar.trim()||row.building_type_en!==null&&typeof row.building_type_en!=='string'||row.building_type_ar!==null&&typeof row.building_type_ar!=='string')throw Error('Invalid Ajman permit dimensions');
 const count=row.number_of_building_permits_issued_by_type_of_building;
 if(count!==null&&(!Number.isSafeInteger(count)||count<0)||count!==null&&(!row.building_type_en||!row.building_type_ar))throw Error('Invalid Ajman permit count');
 const key=[row.year,months.indexOf(row.month_en)+1,row.building_type_en].join('|');groups.set(key,[...(groups.get(key)||[]),row]);
}
const conflicts=[...groups.values()].filter(group=>group.length>1),clean=[...groups.values()].filter(group=>group.length===1).map(group=>group[0]),numeric=clean.filter(row=>row.number_of_building_permits_issued_by_type_of_building!==null);
if(groups.size!==708||conflicts.length!==33||conflicts.reduce((n,group)=>n+group.length,0)!==66||conflicts.some(group=>group.length!==2||group[0].number_of_building_permits_issued_by_type_of_building===group[1].number_of_building_permits_issued_by_type_of_building)||clean.length!==675||numeric.length!==537||clean.length-numeric.length!==138)throw Error('Ajman permit quality profile changed');
const byYear=Object.fromEntries([...new Set(numeric.map(row=>row.year))].sort((a,b)=>a-b).map(year=>[year,numeric.filter(row=>row.year===year).length]));
if(JSON.stringify(byYear)!==JSON.stringify({2015:60,2016:60,2017:60,2018:60,2019:60,2020:60,2021:60,2022:52,2023:36,2024:29}))throw Error('Ajman permit observed years changed');
const report={sourceId:'ajman-mpd-20260901-building-permits-by-type',datasetUrl:capture.datasetUrl,recordsUrl:capture.recordsUrl,publisher:meta.publisher,licence:meta.license,licenceUrl:meta.license_url,portalTermsUrl:'https://data.ajman.ae/terms/terms-and-conditions.pdf',sourceModifiedAt:meta.modified,retrievedAt:capture.retrievedAt,emirate:'Ajman',evidenceClass:'official_building_permit_count',grain:'building type by calendar month; not completions, housing units, projects or sales',rawSha256:sha(raw),rawBytes:raw.length,compressedSha256:sha(packed),compressedBytes:packed.length,metadataSha256:sha(metadataBytes),sourceRows:rows.length,distinctDimensionGroups:groups.size,conflictingGroups:conflicts.length,conflictingSourceRows:66,nullCountRows:138,usableRows:numeric.length,usableRowsByYear:byYear,completeYears:[2015,2016,2017,2018,2019,2020,2021],limits:'Conflicting duplicate month/type groups and blank counts are withheld. 2022–2024 are incomplete after withholding; 2025–2026 contain only blank rows. No sum across incomplete years is asserted. Building permits are not completed homes, transactions, or price evidence.'};
const path=new URL(dir+'building-permits-validation.json',root);
if(process.argv.includes('--check')){const saved=JSON.parse(await fs.readFile(path,'utf8'));if(JSON.stringify(saved)!==JSON.stringify(report))throw Error('Ajman permit validation differs from source');console.log(JSON.stringify({passed:true,sourceRows:report.sourceRows,usableRows:report.usableRows,conflictingGroups:report.conflictingGroups}));}
else{await fs.writeFile(path,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({sourceRows:report.sourceRows,usableRows:report.usableRows,conflictingGroups:report.conflictingGroups}));}
