import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

// A fixed, bounded set of public developer releases. Full article text stays
// in ignored research scratch; only reviewed facts enter the public packet.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'.local-data/rak-phase-pass34/captures.json');
const pages=[
  [
    "gateway-2019",
    "rak-propertys-gateway-apartments-draw-new-interest-through-further-developments-in-region"
  ],
  [
    "gateway2-groundbreaking",
    "rak-properties-begins-construction-on-gateway-residence-ii"
  ],
  [
    "bay-groundbreaking",
    "rak-properties-begins-construction-on-bay-residences"
  ],
  [
    "bay2-contract",
    "rak-properties-appoints-gulf-asia-as-main-contractor-for-second-phase-of-bay-residences"
  ],
  [
    "q1-2023",
    "rak-properties-more-than-doubles-revenues-on-back-of-new-residential-launches"
  ],
  [
    "construction-202407",
    "rak-properties-announces-major-construction-updates"
  ]
];
function text(html){return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ').replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n))).replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&quot;/g,'"').replace(/&rsquo;|&lsquo;/g,"'").replace(/&[lr]dquo;/g,'"').replace(/\s+/g,' ').trim();}
const results=await fs.readFile(out,'utf8').then(s=>JSON.parse(s).sources).catch(e=>{if(e.code!=='ENOENT')throw e;return [];});
await fs.mkdir(path.dirname(out),{recursive:true});
for(const [id,slug] of pages){
 if(results.some(row=>row.id===`rak34-${id}`))continue;
 const url=`https://www.rakproperties.ae/news/${slug}/`;
 const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
 const bytes=Buffer.from(await response.arrayBuffer());const html=bytes.toString('utf8');
 const match=/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
 if(response.status!==200||!match||!['www.rakproperties.ae','rakproperties.ae'].includes(new URL(response.url).hostname))throw Error(`Unexpected response for ${id}: ${response.status}`);
 const dates=[...text(html.slice(0,match.index)).matchAll(/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/g)];
 const date=dates.at(-1);if(!date)throw Error(`No explicit publication date for ${id}`);
 const month=['January','February','March','April','May','June','July','August','September','October','November','December'].indexOf(date[2])+1;
 const publishedAt=`${date[3]}-${String(month).padStart(2,'0')}-${date[1].padStart(2,'0')}`;
 const article=text(html.slice(match.index)).split('Newsletter signup')[0].trim();
 const row={id:`rak34-${id}`,url,finalUrl:response.url,title:text(match[1]),publishedAt,retrievedAt:new Date().toISOString(),httpStatus:response.status,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,articleText:article};
 results.push(row);await fs.writeFile(out,JSON.stringify({captureVersion:1,rawHtmlRetained:false,publicRedistribution:false,sources:results},null,2)+'\n',{mode:0o600});
 console.log(JSON.stringify({id:row.id,publishedAt,title:row.title,characters:article.length}));
 await new Promise(resolve=>setTimeout(resolve,600));
}
