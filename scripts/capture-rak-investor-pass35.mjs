import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base=new URL('../.local-data/rak-identity-pass35/',import.meta.url),file=new URL('investor-q2-2024.pdf',base),receipt=new URL('investor-q2-2024-capture.json',base);
const url='https://www.rakproperties.ae/wp-content/uploads/2024/08/RAKP-Investor-Relations-2024_new.pdf';
await fs.mkdir(base,{recursive:true});
try{const old=JSON.parse(await fs.readFile(receipt,'utf8')),bytes=await fs.readFile(file);if(old.sha256!==createHash('sha256').update(bytes).digest('hex'))throw Error('Existing capture checksum mismatch');console.log(JSON.stringify({retained:true,...old}));}
catch(error){
 if(error.code!=='ENOENT')throw error;
 const r=await fetch(url,{signal:AbortSignal.timeout(60000)}),bytes=Buffer.from(await r.arrayBuffer());
 if(!r.ok||bytes.subarray(0,4).toString()!=='%PDF'||new URL(r.url).hostname!=='www.rakproperties.ae')throw Error('Unexpected primary report response');
 const meta={id:'rak35-investor-q2-2024',url,finalUrl:r.url,retrievedAt:new Date().toISOString(),sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,httpStatus:r.status};
 await fs.writeFile(file,bytes,{flag:'wx',mode:0o600});await fs.writeFile(receipt,JSON.stringify(meta,null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify(meta));
}
