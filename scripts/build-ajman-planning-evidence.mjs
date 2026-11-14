import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

const root=new URL('../',import.meta.url),dir='data/uae-evidence/ajman/';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=name=>fs.readFile(new URL(dir+name,root));
const months='January February March April May June July August September October November December'.split(' ');
const sources=[
 {stem:'licence-types-20260901',dataset:'building-licenses-by-license-type',sourceId:'ajman-mpd-20260901-licence-types',route:'/map/api/uae-evidence/ajman/licence-types',modified:'2026-09-01T07:25:20.960000+00:00',rawSha:'4e29f729a4ad9e797c354054acd6e9105a063115379bc9828e6356f2a46434a2',sourceRows:572,fields:['year','month_ar','month_en','type_of_license_ar','type_of_license_en','building_licenses_issued_classified_by_license_type_in_the_emirate_of_ajman'],valueField:'building_licenses_issued_classified_by_license_type_in_the_emirate_of_ajman',evidenceClass:'official_building_licence_count_by_licence_type',grain:'calendar month × licence type; issued building licences',latest:'2026-06',limits:'Twenty conflicting 2023 month/type groups (40 source rows) are withheld, leaving 2023 incomplete. The 2026 series runs through June. Source language suffixes for licence type are reversed: the _ar field is English and _en is Arabic. Licence categories overlap other Ajman permit measures; do not add them together. These are licences, not completed buildings, project identities, sale/rent evidence, or available commercial spaces.'},
 {stem:'site-plans-by-use-20240709',dataset:'number-of-site-plans-according-to-use',sourceId:'ajman-mpd-20240709-site-plans-by-use',route:'/map/api/uae-evidence/ajman/site-plans-by-use',modified:'2024-07-09T20:35:48.401000+00:00',rawSha:'38b366008e3f38657855172071f543689bbb9b74b3623a8cb2ee4191e4ca14dd',sourceRows:126,fields:['year','service_ar','service_en','contract_category_ar','contract_category_en','number_of_land_plots_according_to_the_main_use_in_ajman_city'],valueField:'number_of_land_plots_according_to_the_main_use_in_ajman_city',evidenceClass:'official_historical_land_plot_count_by_main_use',grain:'calendar year × city × main land use; reported site-plan/land-plot count',latest:'2019',limits:'The publisher field name mentions Ajman City, but source rows also identify Masfout and Manama; preserve the row city. These are 2013–2019 historical site-plan/land-plot counts, not unique standing parcels, completed buildings, project identities, sale/rent evidence, or currently available commercial spaces. Do not add them to building-permit or transaction counts.'}
];
const cities=new Map([
 ['number of land plots according to the main use in ajman city','Ajman City'],
 ['number of land plots according to the main use in masfout city','Masfout'],
 ['number of land plots according to the main use in manama city','Manama']
]);
const uses=['agricultural use','commercial use','industrial use','multi-use','recrational and touristic use','residential use'];
const types=['Annexes','New','Others','Renewal'];

export async function buildAjmanPlanningEvidence({check=false}={}){
 const reports=[];
 for(const spec of sources){
  const [packed,metadataBytes,captureBytes]=await Promise.all([read(spec.stem+'.json.gz'),read(spec.stem+'-source-metadata.json'),read(spec.stem+'-capture.json')]);
  const raw=gunzipSync(packed),rows=JSON.parse(raw),metadata=JSON.parse(metadataBytes),capture=JSON.parse(captureBytes),meta=metadata.metas?.default;
  if(metadata.dataset_id!==spec.dataset||JSON.stringify(metadata.fields?.map(field=>field.name))!==JSON.stringify(spec.fields)||meta?.license!=='CC BY 4.0'||meta?.license_url!=='https://creativecommons.org/licenses/by/4.0/'||meta?.publisher!=='Municipality & Planning Department'||meta?.modified!==spec.modified||meta?.records_count!==spec.sourceRows)throw Error(`${spec.dataset}: source metadata changed`);
  if(!Array.isArray(rows)||rows.length!==spec.sourceRows||sha(raw)!==spec.rawSha||capture.sourceId!==spec.sourceId||capture.sourceResponseSha256!==spec.rawSha||capture.independentReadbackSha256!==spec.rawSha||capture.totalCount!==spec.sourceRows||capture.independentReadbackCount!==spec.sourceRows||capture.rawBytes!==raw.length||capture.compressedSha256!==sha(packed)||capture.compressedBytes!==packed.length||capture.metadataSha256!==sha(metadataBytes))throw Error(`${spec.dataset}: independent source capture changed`);
  const groups=new Map();
  for(const row of rows){
   if(JSON.stringify(Object.keys(row).sort())!==JSON.stringify([...spec.fields].sort())||!Number.isInteger(row.year)||!Number.isSafeInteger(row[spec.valueField])||row[spec.valueField]<0)throw Error(`${spec.dataset}: invalid source row`);
   let key;
   if(spec.dataset==='building-licenses-by-license-type'){
    if(row.year<2015||row.year>2026||!months.includes(row.month_en)||!row.month_ar||!types.includes(row.type_of_license_ar)||!row.type_of_license_en)throw Error(`${spec.dataset}: invalid licence dimension`);
    key=[row.year,months.indexOf(row.month_en)+1,row.type_of_license_ar].join('|');
   }else{
    if(row.year<2013||row.year>2019||!cities.has(row.service_en)||!row.service_ar||!uses.includes(row.contract_category_en)||!row.contract_category_ar)throw Error(`${spec.dataset}: invalid site-plan dimension`);
    key=[row.year,row.service_en,row.contract_category_en].join('|');
   }
   groups.set(key,[...(groups.get(key)||[]),row]);
  }
  const conflicts=[...groups.values()].filter(group=>group.length>1),usable=[...groups.values()].filter(group=>group.length===1).map(group=>group[0]);
  if(spec.dataset==='building-licenses-by-license-type'){
   if(groups.size!==552||conflicts.length!==20||conflicts.some(group=>group.length!==2||group[0][spec.valueField]===group[1][spec.valueField])||usable.length!==532)throw Error('Ajman licence-type conflict profile changed');
  }else if(groups.size!==126||conflicts.length!==0||usable.length!==126||[...new Set(rows.map(row=>row.service_en))].length!==3)throw Error('Ajman site-plan dimension profile changed');
  const usableRowsByYear=Object.fromEntries([...new Set(usable.map(row=>row.year))].sort((a,b)=>a-b).map(year=>[year,usable.filter(row=>row.year===year).length]));
  const latest=spec.dataset==='building-licenses-by-license-type'?rows.map(row=>`${row.year}-${String(months.indexOf(row.month_en)+1).padStart(2,'0')}`).sort().at(-1):String(Math.max(...rows.map(row=>row.year)));
  if(latest!==spec.latest)throw Error(`${spec.dataset}: latest period changed`);
  const report={sourceId:spec.sourceId,route:spec.route,datasetUrl:capture.datasetUrl,recordsUrl:capture.recordsUrl,publisher:meta.publisher,licence:meta.license,licenceUrl:meta.license_url,sourceModifiedAt:meta.modified,retrievedAt:capture.retrievedAt,emirate:'Ajman',evidenceClass:spec.evidenceClass,grain:spec.grain,valueField:spec.valueField,rawSha256:sha(raw),rawBytes:raw.length,compressedSha256:sha(packed),compressedBytes:packed.length,metadataSha256:sha(metadataBytes),sourceRows:rows.length,distinctDimensionGroups:groups.size,conflictingGroups:conflicts.length,conflictingSourceRows:conflicts.reduce((n,group)=>n+group.length,0),usableRows:usable.length,usableRowsByYear,latestReportedPeriod:latest,limits:spec.limits};
  const output=new URL(dir+spec.stem+'-validation.json',root),content=JSON.stringify(report,null,2)+'\n';
  if(check){if(await fs.readFile(output,'utf8')!==content)throw Error(`${spec.dataset}: validation changed`);}else await fs.writeFile(output,content);
  reports.push(report);
 }
 return reports;
}
if(process.argv[1]===new URL(import.meta.url).pathname)buildAjmanPlanningEvidence({check:process.argv.includes('--check')}).then(reports=>console.log(JSON.stringify({passed:true,sources:reports.map(report=>({id:report.sourceId,sourceRows:report.sourceRows,usableRows:report.usableRows,latest:report.latestReportedPeriod}))}))).catch(error=>{console.error(error);process.exitCode=1;});
