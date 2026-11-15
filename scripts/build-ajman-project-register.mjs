import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(root,'data/uae-evidence/ajman');
const compressed=await fs.readFile(path.join(dir,'real-estate-projects-20260826.json.gz'));
const raw=gunzipSync(compressed),rows=JSON.parse(raw);
const metadataBytes=await fs.readFile(path.join(dir,'projects-source-metadata.json'));
const metadata=JSON.parse(metadataBytes),meta=metadata.metas?.default;
const sha=value=>createHash('sha256').update(value).digest('hex');
const sourceId='ajman-dlrr-20260826-project-register';
const api='https://data.ajman.ae/api/explore/v2.1/catalog/datasets/real-estate-projects';
if(metadata.dataset_id!=='real-estate-projects'||meta?.license!=='CC BY 4.0'||meta?.license_url!=='https://creativecommons.org/licenses/by/4.0/'||meta?.publisher!=='Department of Land and Real Estate Regulation'||meta?.modified!=='2026-08-26T05:23:52.872000+00:00'||meta?.records_count!==3457||!Array.isArray(rows)||rows.length!==3457)throw Error('Unexpected official project-register vintage');
const fields=['project_id','project_name_english','project_name_arabic','project_registration_number','project_status_english','project_status_arabic','account_trustee_english','account_trustee_arabic','escrow_account_number','number_of_real_estate_units','city_english','city_arabic','sector_english','sector_arabic','district_english','district_arabic','project_description_english','project_description_arabic','developer_name_english','developer_name_arabic','main_project_name_english','main_project_name_arabic','update_date'];
const byId=new Map(),idsDates=new Set(),names=new Set(),dates=new Set();
let unknownUnitRows=0,cityFieldAnomalyRows=0;
for(const [index,row] of rows.entries()){
 if(Object.keys(row).length!==fields.length||fields.some(key=>!Object.hasOwn(row,key)))throw Error('Unexpected schema at row '+index);
 if(!Number.isSafeInteger(row.project_id)||row.project_id<1||typeof row.project_name_english!=='string'||!row.project_name_english.trim()||typeof row.project_status_english!=='string'||!row.project_status_english.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(row.update_date))throw Error('Invalid project identity at row '+index);
 if(!['Completed','Under Construction','Under construction'].includes(row.project_status_english))throw Error('Unexpected status at row '+index);
 const idDate=row.project_id+'|'+row.update_date;
 if(idsDates.has(idDate))throw Error('Duplicate project id and snapshot date '+idDate);
 idsDates.add(idDate);names.add(row.project_name_english);dates.add(row.update_date);
 const list=byId.get(row.project_id)||[];list.push(row);byId.set(row.project_id,list);
 if(!/^\d+$/.test(String(row.number_of_real_estate_units)))unknownUnitRows++;
 if(row.city_english!=='Ajman')cityFieldAnomalyRows++;
}
const periods=[...dates].sort(),latestSnapshotDate=periods.at(-1),latest=rows.filter(row=>row.update_date===latestSnapshotDate);
const staleIds=[...byId].filter(([,list])=>!list.some(row=>row.update_date===latestSnapshotDate));
const latestUnknownUnitRows=latest.filter(row=>!/^\d+$/.test(String(row.number_of_real_estate_units))).length;
if(byId.size!==364||names.size!==365||periods.length!==16||latestSnapshotDate!=='2026-06-30'||latest.length!==298||staleIds.length!==66||unknownUnitRows!==58||cityFieldAnomalyRows!==35||latestUnknownUnitRows!==3)throw Error('Project-register quality totals differ from reviewed export');
const report={sourceId,datasetUrl:'https://data.ajman.ae/explore/dataset/real-estate-projects/',api,publisher:meta.publisher,licence:meta.license,licenceUrl:meta.license_url,sourceModifiedAt:meta.modified,retrievedAt:'2026-11-02T14:59:08Z',metadataRetrievedAt:'2026-11-02T14:59:08Z',emirate:'Ajman',evidenceClass:'official_project_register_snapshot',grain:'source_project_id × snapshot_date; repeated snapshots, not one row per distinct project',storageKey:'uae/evidence/ajman/2026-08-26/real-estate-projects.json.gz',rawSha256:sha(raw),rawBytes:raw.length,compressedSha256:sha(compressed),compressedBytes:compressed.length,metadataSha256:sha(metadataBytes),rows:rows.length,distinctSourceProjectIds:byId.size,distinctSourceNames:names.size,snapshotDates:periods,latestSnapshotDate,latestSnapshotProjectIds:latest.length,notInLatestSnapshotProjectIds:staleIds.length,unknownUnitRows,cityFieldAnomalyRows,latestUnknownUnitRows,canonicalProjectMatches:0,coordinatesPresent:false,matchPolicy:'Official source IDs are separate from accepted V48 project identities; no name-only joins or fabricated coordinates.'};
const reportPath=path.join(dir,'projects-validation.json');
if(process.argv.includes('--check')){
 const saved=JSON.parse(await fs.readFile(reportPath,'utf8'));
 if(JSON.stringify(saved)!==JSON.stringify(report))throw Error('Project-register report does not match official source');
 console.log(JSON.stringify({passed:true,sourceId,rows:rows.length,sourceIds:byId.size,latest:latest.length,rawSha256:report.rawSha256}));
}else{
 await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({sourceId,rows:rows.length,sourceIds:byId.size,latest:latest.length,rawSha256:report.rawSha256}));
}
