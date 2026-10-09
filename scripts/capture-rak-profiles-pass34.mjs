import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(root,'.local-data/rak-phase-pass34');
const slugs=['marbella-ii-villas','bay-residences','gateway-i-residences','gateway-ii-residences','bayviews','cape-hayat','quattro-del-mar','porto-playa','edge','skai','mirasol','mirasol-ii','enta-mina','anantara-residences','nura','solera'];
await fs.mkdir(dir,{recursive:true});
const out=path.join(dir,'developer-profiles.json');
const sources=await fs.readFile(out,'utf8').then(s=>JSON.parse(s).sources).catch(e=>{if(e.code!=='ENOENT')throw e;return [];});
for(const slug of slugs){
 if(sources.some(s=>s.slug===slug))continue;
 const url=`https://www.rakproperties.ae/our-properties/${slug}/`;
 const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
 if(response.status!==200||response.url!==url)throw Error(`${slug}: unexpected ${response.status} ${response.url}`);
 const body=Buffer.from(await response.arrayBuffer());const html=body.toString('utf8');
 const title=html.match(/<title>([\s\S]*?)<\/title>/i)?.[1];if(!title)throw Error(`${slug}: no title`);
 const row={id:`rak34-profile-${slug}`,slug,url,finalUrl:response.url,title,publishedAt:null,retrievedAt:new Date().toISOString(),sha256:createHash('sha256').update(body).digest('hex'),httpStatus:response.status,bytes:body.length};
 await fs.writeFile(path.join(dir,`profile-${slug}.html`),body,{mode:0o600});
 sources.push(row);await fs.writeFile(out,JSON.stringify({version:1,rawBodiesRedistributed:false,sources},null,2)+'\n',{mode:0o600});
 console.log(JSON.stringify({slug,title,bytes:body.length}));await new Promise(resolve=>setTimeout(resolve,600));
}
