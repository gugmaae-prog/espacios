import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

const root=new URL('../',import.meta.url),dir='data/uae-evidence/ajman/';
const read=name=>fs.readFile(new URL(dir+name,root));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const months='January February March April May June July August September October November December'.split(' ');
const commonFields=['year','month_ar','month_en','service_ar','service_en','category_1_ar','category_1_en','category_2_ar','category_2_en'];
const sources=[
 {stem:'new-building-licences-20260901',dataset:'licenses-issued-for-new-buildings-by-number-of-licenses',sourceId:'ajman-mpd-20260901-new-building-licences',route:'/map/api/uae-evidence/ajman/new-building-licences',modified:'2026-09-01T09:56:43.758000+00:00',rawSha:'0ffefea58b2d8f97b11a71525935a14c35bc257d7c881a9bf8d18100819e8339',sourceRows:268,field:'number_of_licenses_lssuedvfor_new_buildings_by_type_of_use_in_the_emirate_of_ajman',category:'No. of Licenses',measure:'new_building_permission_licence_count',usableRows:248,groups:258,conflicts:10,latest:'2025-09',unit:'licences',limits:'Ten conflicting duplicate month/use groups in 2023 are withheld, leaving that year incomplete. The 2025 source stops at September. This is a count of new-building permissions, not buildings completed, commercial spaces available, transactions, prices, or an all-Ajman project register. Non-residential includes uses beyond commercial. Do not add licence counts to the separate building counts.'},
 {stem:'new-building-area-20240709',dataset:'new-licenses-issued-by-built-up-area',sourceId:'ajman-mpd-20240709-new-building-area',route:'/map/api/uae-evidence/ajman/new-building-built-up-area',modified:'2024-07-09T20:38:37.413000+00:00',rawSha:'b89f0c43709e7cb8c9bdf031ec85b7683b2b20d25930b6517d441d01794d4fd8',sourceRows:198,field:'value',category:'Built-up area',measure:'reported_new_building_permission_built_up_area',usableRows:198,groups:198,conflicts:0,latest:'2023-03',unit:null,limits:'The publisher does not specify the area unit in this dataset, so values must not be labelled square metres or converted. The series ends in March 2023. This is reported built-up area associated with permissions, not completed floor area, available commercial spaces, transactions, prices, or an all-Ajman project register. Non-residential includes uses beyond commercial.'}
];

export async function buildAjmanNewBuildingMeasures({check=false}={}){
 const reports=[];
 for(const spec of sources){
  const [packed,metadataBytes,captureBytes]=await Promise.all([read(spec.stem+'.json.gz'),read(spec.stem+'-source-metadata.json'),read(spec.stem+'-capture.json')]);
  const raw=gunzipSync(packed),rows=JSON.parse(raw),metadata=JSON.parse(metadataBytes),capture=JSON.parse(captureBytes),meta=metadata.metas?.default;
  const fields=[...commonFields,spec.field];
  if(metadata.dataset_id!==spec.dataset||JSON.stringify(metadata.fields.map(field=>field.name))!==JSON.stringify(fields)||meta?.license!=='CC BY 4.0'||meta?.license_url!=='https://creativecommons.org/licenses/by/4.0/'||meta?.publisher!=='Municipality & Planning Department'||meta?.modified!==spec.modified||meta?.records_count!==spec.sourceRows)throw Error(`${spec.dataset}: source metadata changed`);
  if(!Array.isArray(rows)||rows.length!==spec.sourceRows||sha(raw)!==spec.rawSha||capture.sourceResponseSha256!==spec.rawSha||capture.independentReadbackSha256!==spec.rawSha||capture.rawBytes!==raw.length||capture.compressedSha256!==sha(packed)||capture.compressedBytes!==packed.length||capture.metadataSha256!==sha(metadataBytes)||capture.totalCount!==spec.sourceRows||capture.independentReadbackCount!==spec.sourceRows)throw Error(`${spec.dataset}: source capture changed`);
  const groups=new Map();
  for(const row of rows){
   if(JSON.stringify(Object.keys(row).sort())!==JSON.stringify([...fields].sort())||!Number.isInteger(row.year)||row.year<2015||row.year>2026||!months.includes(row.month_en)||typeof row.month_ar!=='string'||!row.month_ar||row.service_en!=='New building permission'||row.category_2_en!==spec.category||!['Residential buildings','Non-residential buildings'].includes(row.category_1_en)||typeof row.category_1_ar!=='string'||!row.category_1_ar||typeof row[spec.field]!=='number'||!Number.isFinite(row[spec.field])||row[spec.field]<0||spec.unit==='licences'&&!Number.isSafeInteger(row[spec.field]))throw Error(`${spec.dataset}: invalid source row`);
   const key=[row.year,months.indexOf(row.month_en)+1,row.category_1_en].join('|');groups.set(key,[...(groups.get(key)||[]),row]);
  }
  const conflicts=[...groups.values()].filter(group=>group.length>1),usable=[...groups.values()].filter(group=>group.length===1).map(group=>group[0]);
  if(groups.size!==spec.groups||conflicts.length!==spec.conflicts||conflicts.some(group=>group.length!==2||group[0][spec.field]===group[1][spec.field])||usable.length!==spec.usableRows)throw Error(`${spec.dataset}: quality profile changed`);
  const usableRowsByYear=Object.fromEntries([...new Set(usable.map(row=>row.year))].sort((a,b)=>a-b).map(year=>[year,usable.filter(row=>row.year===year).length]));
  const completeReportedDimensionYears=Object.entries(usableRowsByYear).filter(([,count])=>count===24).map(([year])=>Number(year));
  const latest=rows.map(row=>`${row.year}-${String(months.indexOf(row.month_en)+1).padStart(2,'0')}`).sort().at(-1);
  if(latest!==spec.latest)throw Error(`${spec.dataset}: latest period changed`);
  const report={sourceId:spec.sourceId,route:spec.route,datasetUrl:capture.datasetUrl,recordsUrl:capture.recordsUrl,publisher:meta.publisher,licence:meta.license,licenceUrl:meta.license_url,sourceModifiedAt:meta.modified,retrievedAt:capture.retrievedAt,emirate:'Ajman',evidenceClass:spec.measure,grain:'calendar month × residential or non-residential use',sourceValueField:spec.field,sourceUnit:spec.unit,rawSha256:sha(raw),rawBytes:raw.length,compressedSha256:sha(packed),compressedBytes:packed.length,metadataSha256:sha(metadataBytes),sourceRows:rows.length,distinctDimensionGroups:groups.size,conflictingGroups:conflicts.length,conflictingSourceRows:conflicts.reduce((n,group)=>n+group.length,0),usableRows:usable.length,usableRowsByYear,completeReportedDimensionYears,latestReportedMonth:latest,limits:spec.limits};
  const path=new URL(dir+spec.stem+'-validation.json',root);
  if(check){const saved=JSON.parse(await fs.readFile(path,'utf8'));if(JSON.stringify(saved)!==JSON.stringify(report))throw Error(`${spec.dataset}: validation differs from source`);}
  else await fs.writeFile(path,JSON.stringify(report,null,2)+'\n');
  reports.push(report);
 }
 return reports;
}

if(process.argv[1]===new URL(import.meta.url).pathname)buildAjmanNewBuildingMeasures({check:process.argv.includes('--check')}).then(reports=>console.log(JSON.stringify({passed:true,sources:reports.map(report=>({id:report.sourceId,sourceRows:report.sourceRows,usableRows:report.usableRows,latestReportedMonth:report.latestReportedMonth}))}))).catch(error=>{console.error(error);process.exitCode=1;});
