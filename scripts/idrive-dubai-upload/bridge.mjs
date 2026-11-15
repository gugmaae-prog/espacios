import manifest from './manifest.mjs';

// Temporary preview only. Both the key and its bytes must match the reviewed
// Dubai copy set; no source-export, listing, deletion or production route.
const HOST='s3.us-west-2.idrivee2.com';
const REGION='us-east-1';
const BUCKET='espacios-store-a';
const encoder=new TextEncoder();
const hex=bytes=>[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
const digest=async value=>hex(await crypto.subtle.digest('SHA-256',value));
const emptyHash='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const response=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});

async function hmac(key,message){
 const k=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return new Uint8Array(await crypto.subtle.sign('HMAC',k,encoder.encode(message)));
}
function authenticated(request,env){
 const supplied=request.headers.get('authorization')||'';
 const expected=String(env.PUBLISH_TOKEN||'');
 const expires=Number(env.EXPIRES_AT);
 if(!supplied.startsWith('Bearer ')||supplied.length>512||expected.length<32||!Number.isFinite(expires)||expires<=Date.now())return false;
 const token=supplied.slice(7);
 if(token.length!==expected.length)return false;
 let difference=0;for(let i=0;i<token.length;i++)difference|=token.charCodeAt(i)^expected.charCodeAt(i);
 return difference===0;
}
async function signedFetch(env,method,key,payload=null){
 if(!env.E2A_KEY||!env.E2A_SECRET)throw Error('storage_unconfigured');
 const path='/'+BUCKET+'/'+key.split('/').map(encodeURIComponent).join('/');
 const stamp=new Date().toISOString().replace(/[:-]/g,'').replace(/\.\d{3}/,'');
 const day=stamp.slice(0,8),scope=`${day}/${REGION}/s3/aws4_request`;
 const payloadHash=payload===null?emptyHash:await digest(payload);
 const additional=method==='PUT'?{'content-type':'application/gzip','if-none-match':'*','x-amz-acl':'private','x-amz-meta-sha256':payloadHash}:{};
 const headers={host:HOST,...additional,'x-amz-content-sha256':payloadHash,'x-amz-date':stamp};
 const names=Object.keys(headers).sort();
 const canonicalHeaders=names.map(name=>`${name}:${headers[name]}\n`).join('');
 const canonical=`${method}\n${path}\n\n${canonicalHeaders}\n${names.join(';')}\n${payloadHash}`;
 let signing=await hmac(encoder.encode('AWS4'+env.E2A_SECRET),day);
 for(const part of [REGION,'s3','aws4_request'])signing=await hmac(signing,part);
 const signature=hex(await hmac(signing,`AWS4-HMAC-SHA256\n${stamp}\n${scope}\n${await digest(encoder.encode(canonical))}`));
 delete headers.host;
 headers.authorization=`AWS4-HMAC-SHA256 Credential=${env.E2A_KEY}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`;
 if(method==='GET')headers['accept-encoding']='identity';
 return fetch(`https://${HOST}${path}`,{method,headers,body:payload,redirect:'manual',signal:AbortSignal.timeout(90000)});
}
async function boundedBody(message,limit){
 const declared=message.headers.get('content-length');
 if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>limit))throw Error('size_mismatch');
 const chunks=[];let size=0;
 const reader=message.body?.getReader();
 if(reader){try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>limit)throw Error('size_mismatch');chunks.push(part.value);}}finally{reader.releaseLock();}}
 if(declared!==null&&Number(declared)!==size)throw Error('size_mismatch');
 const bytes=new Uint8Array(size);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 return bytes;
}
async function verify(env,key,item){
 const found=await signedFetch(env,'GET',key);
 if(found.status!==200){await found.body?.cancel();throw Error(found.status===404?'object_missing':'readback_unavailable');}
 if(found.headers.get('content-encoding')){await found.body?.cancel();throw Error('unexpected_encoding');}
 const declared=found.headers.get('content-length');
 if(declared!==String(item.bytes)){await found.body?.cancel();throw Error('readback_size_mismatch');}
 const bytes=await boundedBody(found,item.bytes);
 if(bytes.length!==item.bytes||await digest(bytes)!==item.sha256)throw Error('readback_checksum_mismatch');
 return {bytes:bytes.length,sha256:item.sha256};
}
export default {async fetch(request,env){
 const url=new URL(request.url),pathname=url.pathname;
 if(!((request.method==='GET'&&pathname==='/verify')||(request.method==='POST'&&pathname==='/upload')))return response({error:'not_found'},404);
 if(!authenticated(request,env))return response({error:'unauthorized'},401);
 const key=url.searchParams.get('key')||'';
 const item=Object.hasOwn(manifest,key)?manifest[key]:null;
 if(!item)return response({error:'key_not_approved'},404);
 try{
  if(pathname==='/verify')return response({ok:true,verified:true,key,...await verify(env,key,item)});
  const bytes=await boundedBody(request,item.bytes);
  if(bytes.length!==item.bytes||await digest(bytes)!==item.sha256)return response({error:'source_checksum_mismatch'},422);
  const put=await signedFetch(env,'PUT',key,bytes);
  const status=put.status;await put.body?.cancel();
  if(status!==200&&status!==412)throw Error('write_unavailable');
  return response({ok:true,verified:true,alreadyExists:status===412,key,...await verify(env,key,item)});
 }catch(error){return response({error:String(error?.message||'storage_unavailable')},503);}
}};
