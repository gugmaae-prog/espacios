// Bounded public-source capture. Raw bodies remain in ignored private scratch.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base=new URL('../.local-data/rak-annual-pass36/',import.meta.url);
const entries=[
 ['annual-2014','https://www.rakproperties.ae/wp-content/uploads/2024/03/2014-Annual-Report.pdf','pdf'],
 ['annual-2015','https://www.rakproperties.ae/wp-content/uploads/2024/03/2015-Annual-Report.pdf','pdf'],
 ['annual-2016','https://www.rakproperties.ae/wp-content/uploads/2024/03/2016-Annual-report.pdf','pdf'],
 ['annual-2017','https://www.rakproperties.ae/wp-content/uploads/2024/03/2017-Annual-report.pdf','pdf'],
 ['annual-2018','https://www.rakproperties.ae/wp-content/uploads/2024/03/Annual-Report-2018-EN_V2_low.pdf','pdf'],
 ['annual-2019','https://www.rakproperties.ae/wp-content/uploads/2024/03/Annual-Report-2019-EN_final.pdf','pdf'],
 ['flamingo-launch-2013','https://www.thenationalnews.com/business/emirati-and-indian-buyers-snap-up-rak-waterfront-properties-1.480574','html']
];
await fs.mkdir(base,{recursive:true});
async function capture([id,url,ext]){
 const file=new URL(id+'.'+ext,base),receipt=new URL(id+'-capture.json',base);
 try{const m=JSON.parse(await fs.readFile(receipt,'utf8')),b=await fs.readFile(file);if(m.url!==url||m.sha256!==createHash('sha256').update(b).digest('hex'))throw Error('Existing capture differs: '+id);return {id,retained:true,...m};}
 catch(e){if(e.code!=='ENOENT')throw e;}
 const r=await fetch(url,{signal:AbortSignal.timeout(90000)});if(!r.ok||new URL(r.url).hostname!==new URL(url).hostname)throw Error(id+' unexpected HTTP response '+r.status);
 const b=Buffer.from(await r.arrayBuffer());if(b.length>40*1024*1024||ext==='pdf'&&b.subarray(0,4).toString()!=='%PDF')throw Error(id+' unexpected body');
 const m={url,finalUrl:r.url,retrievedAt:new Date().toISOString(),sha256:createHash('sha256').update(b).digest('hex'),bytes:b.length,httpStatus:r.status};
 await fs.writeFile(file,b,{flag:'wx',mode:0o600});await fs.writeFile(receipt,JSON.stringify(m,null,2)+'\n',{flag:'wx',mode:0o600});return {id,...m};
}
for(let i=0;i<entries.length;i+=2){const results=await Promise.allSettled(entries.slice(i,i+2).map(capture));for(const r of results){if(r.status==='fulfilled')console.log(JSON.stringify(r.value));else{console.error(String(r.reason));process.exitCode=1;}}}
