import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

const root=new URL('../',import.meta.url),dir='data/uae-evidence/ajman/';
const read=name=>fs.readFile(new URL(dir+name,root));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const compressed=await read('management-companies-20260609.json.gz');
const raw=gunzipSync(compressed),rows=JSON.parse(raw);
const metadataBytes=await read('management-source-metadata.json');
const metadata=JSON.parse(metadataBytes),meta=metadata.metas?.default;
const capture=JSON.parse(await read('management-capture.json'));
const register=JSON.parse(gunzipSync(await read('real-estate-projects-20260826.json.gz')));
const sourceId='ajman-dlrr-20260609-project-management';
const dataset='management-companies-for-real-estate-development-projects';
const fields=['project_id','project_name_english','project_name_arabic','management_company_name_in_arabic','management_company_name_in_english','office_id','year'];
if(metadata.dataset_id!==dataset||meta?.license!=='CC BY 4.0'||meta?.license_url!=='https://creativecommons.org/licenses/by/4.0/'||meta?.publisher!=='Department of Land and Real Estate Regulation'||meta?.modified!=='2026-06-09T04:23:49.791000+00:00'||meta?.records_count!==451||!Array.isArray(rows)||rows.length!==451||capture.rawSha256!==sha(raw)||capture.rawBytes!==raw.length||capture.compressedSha256!==sha(compressed)||capture.compressedBytes!==compressed.length||capture.independentReadbackSha256!==sha(raw)||capture.independentReadbackRows!==451)throw Error('Unexpected Ajman management source vintage');
if(JSON.stringify(metadata.fields.map(field=>field.name))!==JSON.stringify(fields))throw Error('Management schema changed');
const registerById=new Map();for(const row of register){let list=registerById.get(row.project_id)||[];list.push(row);registerById.set(row.project_id,list);}
const ids=new Set(),offices=new Set(),years=new Map(),projectYears=new Set(),changedCompany=new Map();let nameMismatchRows=0,nonCompletedRegisterRows=0;
for(const [index,row] of rows.entries()){
 if(Object.keys(row).length!==fields.length||fields.some(field=>!Object.hasOwn(row,field)))throw Error('Unexpected management row schema '+index);
 if(!Number.isSafeInteger(row.project_id)||row.project_id<1||!Number.isSafeInteger(row.office_id)||row.office_id<1||!Number.isSafeInteger(row.year)||row.year<2024||row.year>2026||fields.slice(1,5).some(field=>typeof row[field]!=='string'||!row[field].trim()))throw Error('Invalid management row '+index);
 const key=row.project_id+'|'+row.year;if(projectYears.has(key))throw Error('Duplicate management project-year '+key);projectYears.add(key);
 const linked=registerById.get(row.project_id);if(!linked?.length)throw Error('Management source ID absent from official Ajman register: '+row.project_id);
 if(!linked.some(item=>item.project_name_english?.trim().toLowerCase()===row.project_name_english.trim().toLowerCase()))nameMismatchRows++;
 if(!linked.some(item=>item.project_status_english==='Completed'))nonCompletedRegisterRows++;
 ids.add(row.project_id);offices.add(row.office_id);years.set(row.year,(years.get(row.year)||0)+1);
 const prior=changedCompany.get(row.project_id)||new Set();prior.add(row.office_id);changedCompany.set(row.project_id,prior);
}
const changedCompanyIds=[...changedCompany].filter(([,set])=>set.size>1).map(([id])=>id).sort((a,b)=>a-b);
const yearRows=Object.fromEntries([...years].sort((a,b)=>a[0]-b[0]));
if(ids.size!==153||offices.size!==13||JSON.stringify(yearRows)!=='{"2024":149,"2025":149,"2026":153}'||nameMismatchRows!==3||nonCompletedRegisterRows!==0||JSON.stringify(changedCompanyIds)!=='[197,207,415]')throw Error('Management quality totals differ from reviewed source');
const report={sourceId,datasetUrl:'https://data.ajman.ae/explore/dataset/'+dataset+'/',api:'https://data.ajman.ae/api/explore/v2.1/catalog/datasets/'+dataset,publisher:meta.publisher,licence:meta.license,licenceUrl:meta.license_url,portalTermsUrl:'https://data.ajman.ae/terms/terms-and-conditions.pdf',sourceModifiedAt:meta.modified,retrievedAt:capture.retrievedAt,emirate:'Ajman',evidenceClass:'official_project_management_appointment',grain:'source project ID × reported year; annual management-company appointment, not developer identity or title ownership',rawSha256:sha(raw),rawBytes:raw.length,compressedSha256:sha(compressed),compressedBytes:compressed.length,metadataSha256:sha(metadataBytes),sourceMetadataSha256:metadata.sourceMetadataSha256,rows:rows.length,distinctSourceProjectIds:ids.size,linkedOfficialRegisterIds:ids.size,distinctOfficeIds:offices.size,yearRows,latestReportedYear:2026,latestYearProjectIds:yearRows[2026],changedCompanyProjectIds:changedCompanyIds,registerNameMismatchRows:nameMismatchRows,canonicalProjectMatches:0,coordinatesPresent:false,matchPolicy:'Exact Ajman source project IDs link to the official Ajman register; no automatic V48 identity joins or map coordinates. One register English-name field contains Arabic text.'};
const reportPath=new URL(dir+'management-validation.json',root);
if(process.argv.includes('--check')){
 const saved=JSON.parse(await fs.readFile(reportPath,'utf8'));
 if(JSON.stringify(saved)!==JSON.stringify(report))throw Error('Management validation report differs from source');
 console.log(JSON.stringify({passed:true,rows:report.rows,sourceProjectIds:ids.size,linkedOfficialRegisterIds:ids.size,rawSha256:report.rawSha256}));
}else{
 await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({rows:report.rows,sourceProjectIds:ids.size,linkedOfficialRegisterIds:ids.size,rawSha256:report.rawSha256}));
}
