import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {SCAD_STOCK_SOURCE,SCAD_STOCK_ROWS} from '../src/stack-audit/scad-stock.mjs';

const DATA=new URL('../data/uae-evidence/abu-dhabi/scad-stock-selected-20261114.json',import.meta.url);
const REPORT=new URL('../data/uae-evidence/abu-dhabi/scad-stock-selected-validation.json',import.meta.url);
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');

async function run(write){
 const data={sourceId:SCAD_STOCK_SOURCE.id,source:SCAD_STOCK_SOURCE,evidenceClass:'official_rounded_census_stock',grain:'region_year',rows:SCAD_STOCK_ROWS};
 const dataBytes=Buffer.from(JSON.stringify(data)+'\n');
 const report={sourceId:SCAD_STOCK_SOURCE.id,projectionDate:'2026-11-14',sourceUrl:SCAD_STOCK_SOURCE.url,sourceResponseSha256:SCAD_STOCK_SOURCE.sourceResponseSha256,sourceRetrievedAt:SCAD_STOCK_SOURCE.retrievedAt,rightsScope:'Selected numerical facts with SCAD attribution under the official open-data policy; source web pages and graphics are not copied.',policyUrl:SCAD_STOCK_SOURCE.policyUrl,dataBytes:dataBytes.length,dataSha256:sha(dataBytes),rows:SCAD_STOCK_ROWS.length,limits:'Rounded census stock totals for 2023 and 2024; not projects, sales, prices, current listings or all-UAE data.'};
 const reportBytes=Buffer.from(JSON.stringify(report,null,2)+'\n');
 for(const [file,expected] of [[DATA,dataBytes],[REPORT,reportBytes]]){
  try{const current=await fs.readFile(file);if(!current.equals(expected))throw Error('SCAD selected-facts artifact changed: '+file.pathname);}
  catch(error){if(error.code!=='ENOENT')throw error;if(!write)throw Error('SCAD selected-facts artifact missing: '+file.pathname);await fs.writeFile(file,expected,{flag:'wx'});}
 }
 return {sourceId:report.sourceId,rows:report.rows,dataBytes:report.dataBytes,dataSha256:report.dataSha256,checked:!write};
}

export const verifyScadSelected=()=>run(false);
if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3||!['--write','--check'].includes(process.argv[2]))throw Error('Use --write or --check');
 run(process.argv[2]==='--write').then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error.message);process.exitCode=1;});
}
