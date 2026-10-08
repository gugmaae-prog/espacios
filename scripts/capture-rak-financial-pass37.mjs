// Bounded public primary-source captures. Raw bodies stay in ignored local research.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir='.local-data/rak-financial-pass37';await fs.mkdir(dir,{recursive:true});
const requests=[
 ['rak-fy2024','https://www.rakproperties.ae/wp-content/uploads/2025/02/RAKP-Investor-PPT-2024-Digital_new.pdf'],
 ['ihg-opening-2022','https://www.ihgplc.com/en/news-and-media/news-releases/2022/intercontinental-ras-ai-khaimah-mina-ai-arab-resort-and-spa-opens-its-doors'],
 ['financial-2024','https://www.rakproperties.ae/wp-content/uploads/2025/02/RAKP-Consolidated-financial-statement-Eng-Dec-2024.pdf'],
 ['annual-2023','https://www.rakproperties.ae/wp-content/uploads/2024/05/Annual-Report-2023_EN.pdf'],
 ['annual-2025','https://www.rakproperties.ae/wp-content/uploads/2026/02/RAKP-X-ADX-ANNUAL-REPORT-2025-EN.pdf'],
 ['news-index','https://www.rakproperties.ae/news/'],
 ['nb-launch','https://www.rakproperties.ae/news/rak-properties-launches-exclusive-beachfront-villas-on-hayat-island-ras-al-khaimah/']
];
const receipts=[];
for(let i=0;i<requests.length;i+=2){await Promise.all(requests.slice(i,i+2).map(async([id,url])=>{
 const existing=dir+'/'+id+'-capture.json';try{receipts.push(JSON.parse(await fs.readFile(existing,'utf8')));return;}catch(e){if(e.code!=='ENOENT')throw e;}
 const r=await fetch(url,{signal:AbortSignal.timeout(120000)});const data=Buffer.from(await r.arrayBuffer());if(data.length>64*1024*1024)throw Error('Capture exceeds reviewed size bound');
 const receipt={id,url,finalUrl:r.url,httpStatus:r.status,retrievedAt:new Date().toISOString(),bytes:data.length,sha256:createHash('sha256').update(data).digest('hex'),contentType:r.headers.get('content-type')};
 if(r.ok)await fs.writeFile(dir+'/'+id+(receipt.contentType?.includes('pdf')?'.pdf':'.html'),data);
 await fs.writeFile(existing,JSON.stringify(receipt,null,2)+'\n');receipts.push(receipt);
}));}
console.log(JSON.stringify(receipts));
