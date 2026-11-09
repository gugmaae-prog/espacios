import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

const root=new URL('../',import.meta.url);
const rawPath='data/uae-evidence/dubai/dsc-housing-building-2019.csv.gz';
const dataPath='data/uae-evidence/dubai/commercial-building-stock-20261110.json';
const reportPath='data/uae-evidence/dubai/commercial-building-stock-validation.json';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const packed=await fs.readFile(new URL(rawPath,root));
const raw=gunzipSync(packed);
if(raw.length!==54720||sha(raw)!=='2ea02dc39e6a158b2c626072822315c9fb9703868646ef42d3f08bba7c9a7bcd')throw Error('KAPSARC source export changed');
const lines=raw.toString('utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/);
if(lines.shift()!=='date,area_name,frequency,indicator_name,indicator_unit,value')throw Error('Unexpected KAPSARC columns');
const rows=lines.map(line=>{
 const match=line.match(/^([^,]*),([^,]*),([^,]*),(?:"([^"]*)"|([^,]*)),([^,]*),([^,]*)$/);
 if(!match)throw Error('Unexpected CSV structure');
 const [,date,area,frequency,quotedIndicator,plainIndicator,unit,value]=match;
 const indicator=quotedIndicator??plainIndicator;
 return {date,area,frequency,indicator,unit,value};
});
if(rows.length!==966)throw Error('Unexpected KAPSARC population');
const keys=new Map();
for(const row of rows){const key=[row.date,row.area,row.frequency,row.indicator,row.unit].join('\u0000');keys.set(key,(keys.get(key)||0)+1);}
const ambiguousRows=[...keys.values()].reduce((n,count)=>n+(count>1?count:0),0);
if(keys.size!==718||ambiguousRows!==403)throw Error('Source duplicate-key quality changed');
const types={'Commercial Building':'commercial_building','Industrial Building':'industrial_building'};
const areas={'All Area':'all','Urban':'urban','Rural':'rural'};
const selected=rows.filter(row=>Number(row.date)>=2015&&Number(row.date)<=2019&&types[row.indicator]&&areas[row.area]&&row.frequency==='Annual'&&row.unit==='Number');
if(selected.length!==30||selected.some(row=>keys.get([row.date,row.area,row.frequency,row.indicator,row.unit].join('\u0000'))!==1))throw Error('Selected rows are incomplete or ambiguous');
const observations=selected.map(row=>({year:Number(row.date),buildingType:types[row.indicator],area:areas[row.area],buildingCount:Number(row.value)})).sort((a,b)=>a.year-b.year||a.buildingType.localeCompare(b.buildingType)||['all','urban','rural'].indexOf(a.area)-['all','urban','rural'].indexOf(b.area));
for(const year of [2015,2016,2017,2018,2019])for(const buildingType of Object.values(types)){
 const group=observations.filter(row=>row.year===year&&row.buildingType===buildingType);
 if(group.length!==3||group.some(row=>!Number.isSafeInteger(row.buildingCount)||row.buildingCount<0)||group.find(row=>row.area==='all').buildingCount!==group.find(row=>row.area==='urban').buildingCount+group.find(row=>row.area==='rural').buildingCount)throw Error('Dubai building counts do not reconcile');
}
const check=(type,area,value)=>{if(observations.find(row=>row.year===2019&&row.buildingType===type&&row.area===area)?.buildingCount!==value)throw Error('2019 DSC table cross-check changed');};
check('commercial_building','all',10405);check('commercial_building','urban',9867);check('commercial_building','rural',538);
check('industrial_building','all',1055);check('industrial_building','urban',1045);check('industrial_building','rural',10);
const data={sourceId:'dsc-dubai-housing-building-kapsarc-public-domain-2019',emirate:'Dubai',publisher:'Dubai Statistics Centre (DSC)',host:'KAPSARC Data Portal',sourceUrl:'https://data.kapsarc.org/explore/dataset/housing-and-building-statistics-of-emirate-of-dubai/',officialCrossCheckUrl:'https://www.dsc.gov.ae/Report/DSC_SYB_2019_02%20_%2001.pdf',evidenceClass:'historical_published_completed_building_count_by_type',sourceObservationYears:[2015,2016,2017,2018,2019],grain:'calendar year × building type × all/urban/rural Dubai',unit:'buildings',limits:'Historical published building counts. Classification and rural geography follow the source vintage. These are not annual new completions, permits, units, available spaces, transactions, prices, or project locations. Do not use year-to-year differences as completion counts.',observations};
const dataBytes=Buffer.from(JSON.stringify(data,null,2)+'\n');
const report={sourceId:data.sourceId,sourceRows:rows.length,sourceDistinctKeys:keys.size,ambiguousKeyRowsWithheld:ambiguousRows,selectedRows:observations.length,selectedYears:data.sourceObservationYears,sourceExportUrl:'https://data.kapsarc.org/api/explore/v2.1/catalog/datasets/housing-and-building-statistics-of-emirate-of-dubai/exports/csv?delimiter=%2C',sourceRawBytes:raw.length,sourceRawSha256:sha(raw),sourcePackedBytes:packed.length,sourcePackedSha256:sha(packed),sourceMetadataUrl:'https://data.kapsarc.org/api/explore/v2.1/catalog/datasets/housing-and-building-statistics-of-emirate-of-dubai',sourceMetadataLicense:'Public Domain (KAPSARC catalogue label)',sourceMetadataPublisher:data.publisher,sourceMetadataModified:'2024-03-11T10:29:16.212000+00:00',sourceDataProcessed:'2023-11-02T12:05:56.635000+00:00',capturedAt:'2026-11-10',official2019CrossCheck:data.officialCrossCheckUrl,dataBytes:dataBytes.length,dataSha256:sha(dataBytes),exclusionRule:'Only unique-key Number rows for Commercial Building and Industrial Building in complete 2015–2019 all/urban/rural groups; all other source rows excluded.'};
if(process.argv.includes('--check')){
 if(!dataBytes.equals(await fs.readFile(new URL(dataPath,root)))||JSON.stringify(report)!==JSON.stringify(JSON.parse(await fs.readFile(new URL(reportPath,root)))))throw Error('Dubai building stock artifacts are out of date');
 console.log(JSON.stringify({passed:true,sourceRows:rows.length,ambiguousRows,selectedRows:observations.length}));
}else{
 await fs.writeFile(new URL(dataPath,root),dataBytes);
 await fs.writeFile(new URL(reportPath,root),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({sourceRows:rows.length,ambiguousRows,selectedRows:observations.length}));
}
