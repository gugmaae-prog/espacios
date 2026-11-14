// Read-only live acceptance for the announcement/applicability distinction.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const args=process.argv.slice(2),option=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const origin=option('--origin','https://espacios.me');
const expected=[
 ['project:edge-rak-properties-raha-island-mina-ras-al-khaimah','2024-05'],
 ['project:studios-apartments-and-penthouses-skai-raha-island','2025-02'],
 ['project:mirasol-by-rak-properties-in-mina-al-arab','2025-01'],
 ['project:mirasol-2-north-harbour-mina-rak-uae','2025-09'],
 ['project:enta-mina-hive-rak-properties-uae','2025-05'],
 ['project:anantara-mina-ras-al-khaimah-residences','2024-10'],
 ['project:nura-rak-properties-mina-ras-al-khaimah-uae','2025-12'],
 ['project:buy-apartment-solera-raha-island','2025-06'],
];
const receipt={origin,checkedAt:new Date().toISOString(),version:'20261008-enrichment-v33',readOnly:true,records:[]};
try{
 for(let i=0;i<expected.length;i+=4){
  const rows=await Promise.all(expected.slice(i,i+4).map(async([id,start])=>{
   const response=await fetch(origin+'/map/api/record-history?'+new URLSearchParams({recordId:id}),{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(90000)});
   assert.equal(response.status,200,id);const body=await response.json();assert.equal(body.version,receipt.version,id);
   const coverage=body.coverage,price=coverage.metrics.price;
   assert.equal(coverage.window.start,start,id+' earliest retained evidence month');
   assert.equal(price.subjectApplicabilityKnown,false,id+' price applicability');
   assert.equal(price.statusCounts.not_applicable,0,id+' no announcement-derived exclusion');
   assert.equal(price.periods[0].status,'missing',id+' missing first financial month');
   assert.equal(coverage.summary.directObservedMonths,0,id+' no manufactured financial history');
   return{recordId:id,firstEvidenceMonth:start,priceApplicabilityKnown:false,priceNotApplicableMonths:0,firstPriceMonthStatus:price.periods[0].status};
  }));receipt.records.push(...rows);
 }
 receipt.passed=true;
}catch(error){receipt.passed=false;receipt.error=error.stack;process.exitCode=1;}
await fs.writeFile(option('--output','docs/verification/history-v33-2026-10-08/live-coverage-rule.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt));
