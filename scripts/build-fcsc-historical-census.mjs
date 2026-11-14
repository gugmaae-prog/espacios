import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';

const root=new URL('../',import.meta.url);
const dir='data/uae-evidence/federal/';
const sourcePath=dir+'fcsc-census-selected-source.json';
const dataPath=dir+'fcsc-census-selected-20261114.json';
const validationPath=dir+'fcsc-census-selected-validation.json';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=name=>fs.readFile(new URL(name,root));
const names=['Abu Dhabi','Dubai','Sharjah','Ajman','Umm Al Quwain','Ras Al Khaimah','Fujairah'];
const totals={buildings:[75504,150603,181686,237480,335487],housingUnits:[272791,413178,722859]};
const years={buildings:[1975,1980,1985,1995,2005],housingUnits:[1985,1995,2005]};
const sourceBytes=await read(sourcePath),source=JSON.parse(sourceBytes);
if(source.sourceId!=='fcsc-emirates-in-figures-2009-historical-building-housing'||source.evidenceClass!=='official_historical_census_stock_count'||JSON.stringify(source.emirates.map(row=>row.name))!==JSON.stringify(names)||JSON.stringify(source.buildingYears)!==JSON.stringify(years.buildings)||JSON.stringify(source.housingYears)!==JSON.stringify(years.housingUnits)||JSON.stringify(source.officialNationalTotals)!==JSON.stringify(totals)||source.primaryEdition.pdfSha256!=='7f23a54f8cae8857238db82539f5275adbe6dc362315267e2d2a9980083225db'||source.crossCheckEdition.pdfSha256!=='a7bce34a4f45553ac7321974de82b2a8769cfa513e44f5f26d889ac3c630025f')throw Error('FCSC source selection changed');
const rows=[];
for(const [metric,selectedYears] of Object.entries(years)){
 for(const emirate of source.emirates){
  const values=emirate[metric];
  if(!Array.isArray(values)||values.length!==selectedYears.length||values.some(value=>!Number.isSafeInteger(value)||value<0))throw Error('Invalid FCSC census value');
  selectedYears.forEach((year,index)=>rows.push({metric,year,emirate:emirate.name,count:values[index]}));
 }
 selectedYears.forEach((year,index)=>{
  const actual=rows.filter(row=>row.metric===metric&&row.year===year).reduce((sum,row)=>sum+row.count,0);
  if(actual!==totals[metric][index])throw Error(`${metric} ${year} does not sum to the official national total`);
 });
}
if(rows.length!==56||new Set(rows.map(row=>[row.metric,row.year,row.emirate].join('|'))).size!==56)throw Error('FCSC row grain changed');
const data={version:'20261114-fcsc-historical-census-v1',sourceId:source.sourceId,rows};
const dataBytes=Buffer.from(JSON.stringify(data,null,2)+'\n');
const report={sourceId:source.sourceId,publisher:source.publisher,evidenceClass:source.evidenceClass,grain:source.grain,sourceUrl:source.primaryEdition.url,crossCheckUrl:source.crossCheckEdition.url,sourcePdfSha256:source.primaryEdition.pdfSha256,crossCheckPdfSha256:source.crossCheckEdition.pdfSha256,sourcePdfPage:source.primaryEdition.pdfPage,crossCheckPdfPage:source.crossCheckEdition.pdfPage,sourceSelectionSha256:sha(sourceBytes),dataSha256:sha(dataBytes),dataBytes:dataBytes.length,rows:rows.length,emirates:names.length,emirateNames:names,years,nationalTotals:totals,observationStatus:'historical_census_table_selected_numerical_facts',crossCheck:'The selected tables in the official 2007 and 2009 editions were independently read and visually matched. Values from the conflicting 2006 edition and the disputed oldest housing-unit year are excluded.',sourceDiscrepancies:source.excludedSourceDiscrepancies,limits:'Census-era building and housing-unit counts only. These are not current stock, project or unit identities, coordinates, available spaces, sale/rent observations, prices, or forecasts.'};
const reportBytes=Buffer.from(JSON.stringify(report,null,2)+'\n');
if(process.argv.includes('--check')){
 if(!(await read(dataPath)).equals(dataBytes)||!(await read(validationPath)).equals(reportBytes))throw Error('FCSC census build differs from selected source');
}else{
 await fs.writeFile(new URL(dataPath,root),dataBytes);
 await fs.writeFile(new URL(validationPath,root),reportBytes);
}
console.log(JSON.stringify({passed:true,rows:rows.length,emirates:names.length,dataSha256:report.dataSha256,check:process.argv.includes('--check')}));
