import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';

const root=new URL('../',import.meta.url);
const read=path=>fs.readFile(new URL(path,root));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const oldBytes=await read('data/uae-evidence/sharjah/monthly-market-20261114.json');
const oldReport=JSON.parse(await read('data/uae-evidence/sharjah/monthly-market-validation.json'));
if(sha(oldBytes)!==oldReport.dataSha256||oldReport.sourceId!=='sharjah-rerd-reported-monthly-market-20261114'||oldReport.rows!==6)throw Error('Original Sharjah monthly snapshot changed');

const tableSha256='be52a1d5be9d4e15aafc5f450942bb923ec68eabdbfbba4ac22616c5d25b4f79';
const argaamUrl='https://www.argaam.com/en/article/articledetail/id/1943896';
const tableFrom=html=>{
 const marker=html.indexOf('Feb.');
 if(marker<0)throw Error('Argaam table is missing');
 const start=html.lastIndexOf('<table',marker),end=html.indexOf('</table>',marker)+8;
 if(start<0||end<8)throw Error('Argaam table boundaries are missing');
 return html.slice(start,end);
};
let verifiedCaptures=0;
for(const name of ['a','b']){
 const file=new URL(`work/sharjah-argaam-${name}.html`,root);
 try{
  const table=tableFrom((await fs.readFile(file,'utf8')).replace(/\r\n/g,'\n'));
  if(Buffer.byteLength(table)!==15804||sha(Buffer.from(table))!==tableSha256||!table.includes('rowspan="2"')||!table.includes('September'))throw Error('Argaam merged-month table changed');
  verifiedCaptures++;
 }catch(error){if(error.code!=='ENOENT')throw error;}
}
if(!process.argv.includes('--check')&&verifiedCaptures!==2)throw Error('Both independent Argaam table captures are required to regenerate the supplement');

const previous=JSON.parse(oldBytes);
const sourceId='sharjah-rerd-reported-monthly-market-20261114-supplement';
const september={month:'2026-09',publishedAt:'2026-10-13',sourceUrl:argaamUrl,reportingBasis:'secondary_compilation_of_department_nine_month_report',reportedTransactionValueAedApprox:5700000000,valuePrecision:'reported_rounded_to_aed_0_1_billion',allProcedureTransactions:null,reportedAllProcedureTransactionsApprox:13700,countPrecision:'reported_rounded_to_0_1_thousand',salesTransactions:null,officeUnitSales:null,shopUnitSales:null};
const combined={startMonth:'2026-02',endMonth:'2026-03',sourceUrl:argaamUrl,publishedAt:'2026-10-13',reportingBasis:'secondary_table_cells_span_february_and_march',reportedTransactionValueAedApprox:9200000000,valuePrecision:'reported_rounded_to_aed_0_1_billion',reportedAllProcedureTransactionsApprox:18900,countPrecision:'reported_rounded_to_0_1_thousand',salesTransactions:null};
const data={...previous,sourceId,publication:'Sharjah 24 department disclosures and Argaam nine-month table',sourceMethod:'Six prior selected monthly facts are preserved. Argaam reports a department nine-month table: September is a separate rounded month; February and March share merged cells and remain a separate two-month observation. WAM H1 and nine-month totals cross-check the rounded values. Only numerical facts and links are retained.',missingMonths:['2026-02','2026-03'],observations:[...previous.observations,september],combinedPeriodObservations:[combined],incompleteMonths:['2026-06','2026-09'],limits:'Seven selected monthly observations; June and September lack exact procedure and sale counts. February and March have only a combined rounded value and approximate procedure count, so neither is represented as an individual month. Rounded monetary values and mixed exact/approximate procedure counts must not be summed into a precise January–September total. All-procedure counts include registrations other than sales. Figures are not commercial-only, transaction-level, unit prices, locations, or current availability.'};
const bytes=Buffer.from(JSON.stringify(data,null,2)+'\n');
const packed=gzipSync(bytes,{mtime:0});
const report={sourceId,evidenceClass:data.evidenceClass,method:'Two independent direct reads of Argaam HTML had an identical 15,804-byte normalized table; its February–March numeric cells span two table rows. The prior six-month source remains pinned by checksum.',retrievedAtDate:'2026-11-14',sourceArticles:[...oldReport.sourceArticles,{period:'2026-02/2026-03 and 2026-09',url:argaamUrl,publishedAt:'2026-10-13',tableBytes:15804,tableSha256,secondaryReport:true}],crossChecks:[{period:'2026-H1',sourceUrl:'https://www.wam.ae/en/article/c18fnby-sharjah-real-estate-transactions-reach-aed295',reportedTransactionValueAedApprox:29500000000},{period:'2026-01/2026-09',sourceUrl:'https://www.wam.ae/en/article/c2q0o4j-sharjah-real-estate-transactions-hit-aed-468bn',reportedTransactionValueAedApprox:46800000000,allProcedureTransactions:91560}],rows:data.observations.length,combinedPeriodRows:data.combinedPeriodObservations.length,missingMonths:data.missingMonths,incompleteMonths:data.incompleteMonths,dataBytes:bytes.length,dataSha256:sha(bytes),compressedBytes:packed.length,compressedSha256:sha(packed),rightsScope:'Selected reported numerical facts and source links only; Sharjah 24, Argaam, and WAM article content excluded.',reconciliation:{previousSourceId:previous.sourceId,previousDataSha256:oldReport.dataSha256,retainedOriginalObservations:6,addedMonth:'2026-09',addedCombinedPeriod:'2026-02/2026-03',roundedValueSumAedApprox:46800000000,roundedValueSumMatchesNineMonthReport:true}};
const values=data.observations.reduce((sum,row)=>sum+row.reportedTransactionValueAedApprox,0)+combined.reportedTransactionValueAedApprox;
if(values!==report.reconciliation.roundedValueSumAedApprox||data.observations.length!==7||data.observations.some(row=>['2026-02','2026-03'].includes(row.month)))throw Error('Sharjah period reconciliation failed');
const outputs=[['data/uae-evidence/sharjah/monthly-market-20261114-supplement.json',bytes],['data/uae-evidence/sharjah/monthly-market-20261114-supplement.json.gz',packed],['data/uae-evidence/sharjah/monthly-market-20261114-supplement-validation.json',Buffer.from(JSON.stringify(report,null,2)+'\n')]];
for(const [path,content] of outputs){const file=new URL(path,root);if(process.argv.includes('--check')){if(!(await fs.readFile(file)).equals(content))throw Error('Sharjah supplement changed: '+path);}else await fs.writeFile(file,content);}
console.log(JSON.stringify({passed:true,monthlyRows:report.rows,combinedPeriodRows:report.combinedPeriodRows,sourceId}));
