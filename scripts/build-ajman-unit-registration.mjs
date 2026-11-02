import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(root,'data/uae-evidence/ajman');
const compressed=await fs.readFile(path.join(dir,'real-estate-units-registration-20260821.json.gz'));
const raw=gunzipSync(compressed),rows=JSON.parse(raw);
const metadataBytes=await fs.readFile(path.join(dir,'registration-source-metadata.json'));
const metadata=JSON.parse(metadataBytes),meta=metadata.metas?.default;
const sha=value=>createHash('sha256').update(value).digest('hex');
const fields=['project_name_english','project_name_arabic','sector_english','sector_arabic','district_english','district_arabic','unit_type_english','unit_type_arabic','rooms_count','initial_certificates_count','initial_certificates_values_in_aed','title_deeds_count','title_deeds_values_in_aed','year','quarter'];
if(metadata.dataset_id!=='real-estate-units-registration'||meta?.publisher!=='Department of Land and Real Estate Regulation'||meta?.license!=='CC BY 4.0'||meta?.license_url!=='https://creativecommons.org/licenses/by/4.0/'||meta?.modified!=='2026-08-21T04:36:00.775000+00:00'||meta?.records_count!==5124||!Array.isArray(rows)||rows.length!==5124)throw Error('Ajman registration source metadata or row count changed');
const labels=new Set(),hashes=new Set();let initialCount=0,initialValue=0,deedCount=0,deedValue=0,first='9999-99-99',last='0000-00-00';
for(const [i,row] of rows.entries()){
 if(Object.keys(row).length!==fields.length||fields.some(key=>!Object.hasOwn(row,key)))throw Error('Unexpected registration schema at '+i);
 for(const key of fields.slice(0,9))if(typeof row[key]!=='string'||!row[key].trim())throw Error('Invalid '+key+' at '+i);
 if(!Number.isInteger(row.year)||row.year<2019||row.year>2026||!Number.isInteger(row.quarter)||row.quarter<1||row.quarter>4)throw Error('Invalid period at '+i);
 for(const key of ['initial_certificates_count','title_deeds_count'])if(!Number.isInteger(row[key])||row[key]<0)throw Error('Invalid count '+key+' at '+i);
 for(const key of ['initial_certificates_values_in_aed','title_deeds_values_in_aed'])if(typeof row[key]!=='number'||!Number.isFinite(row[key])||row[key]<0)throw Error('Invalid value '+key+' at '+i);
 if((row.initial_certificates_count===0)!==(row.initial_certificates_values_in_aed===0)||(row.title_deeds_count===0)!==(row.title_deeds_values_in_aed===0)||row.initial_certificates_count+row.title_deeds_count===0)throw Error('Inconsistent registration aggregate at '+i);
 const hash=sha(JSON.stringify(row));if(hashes.has(hash))throw Error('Duplicate row at '+i);hashes.add(hash);
 labels.add(row.project_name_english);initialCount+=row.initial_certificates_count;initialValue+=row.initial_certificates_values_in_aed;deedCount+=row.title_deeds_count;deedValue+=row.title_deeds_values_in_aed;
 const start=`${row.year}-${String((row.quarter-1)*3+1).padStart(2,'0')}-01`,end=new Date(Date.UTC(row.year,row.quarter*3,0)).toISOString().slice(0,10);if(start<first)first=start;if(end>last)last=end;
}
if(labels.size!==335||initialCount!==14242||deedCount!==7852||Math.abs(initialValue-13484420391.92)>0.01||Math.abs(deedValue-4341258689.60)>0.01||first!=='2019-01-01'||last!=='2026-06-30')throw Error('Ajman registration totals differ from reviewed export');
const report={sourceId:'ajman-dlrr-20260821-unit-registration',datasetUrl:'https://data.ajman.ae/explore/dataset/real-estate-units-registration/',api:'https://data.ajman.ae/api/explore/v2.1/catalog/datasets/real-estate-units-registration',publisher:meta.publisher,licence:meta.license,licenceUrl:meta.license_url,sourceModifiedAt:meta.modified,retrievedAt:'2026-11-02T15:35:00Z',emirate:'Ajman',evidenceClass:'official_unit_registration_aggregate',grain:'source_project_label × sector × district × unit_type × rooms × quarter; tentative certificates and final title deeds are separate stages, not unique units or individual sales',storageKey:'uae/evidence/ajman/2026-08-21/real-estate-units-registration.json.gz',rawSha256:sha(raw),rawBytes:raw.length,compressedSha256:sha(compressed),compressedBytes:compressed.length,metadataSha256:sha(metadataBytes),rows:rows.length,distinctSourceProjectLabels:labels.size,initialCertificatesCountSum:initialCount,initialCertificatesValueAedSum:Number(initialValue.toFixed(2)),titleDeedsCountSum:deedCount,titleDeedsValueAedSum:Number(deedValue.toFixed(2)),firstPeriod:first,lastPeriod:last,canonicalProjectMatches:0,matchPolicy:'No name-only joins; source project labels have not been matched to accepted V48 identities or coordinates.'};
const file=path.join(dir,'registration-validation.json');
if(process.argv.includes('--check')){const saved=JSON.parse(await fs.readFile(file,'utf8'));if(JSON.stringify(saved)!==JSON.stringify(report))throw Error('Registration validation report differs from source');console.log(JSON.stringify({passed:true,rows:rows.length,labels:labels.size,rawSha256:report.rawSha256}));}
else{await fs.writeFile(file,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({rows:rows.length,labels:labels.size,rawSha256:report.rawSha256}));}
