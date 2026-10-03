import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {publishImmutableSnapshot,parseJSONC} from './publish-historical-snapshot.mjs';
import {connectCandidate} from './adapters/local-history-candidate.mjs';
import * as core from '../src/historical-intelligence/core.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=async p=>fs.readFile(path.join(root,p));
const config=parseJSONC((await read('wrangler.history-local.jsonc')).toString());
const target=JSON.parse(await read('data/historical-intelligence/local-candidate-target.json'));
const manifest=JSON.parse(await read('data/historical-intelligence/publication-manifest.json'));
const data=JSON.parse(await read('data/historical-intelligence-20261003.json'));
const bindings=await connectCandidate({target,config,ephemeral:true});
try {
  const publication=await publishImmutableSnapshot({...bindings,target,config,manifest,readObject:o=>read(o.path)});
  const repeated=await publishImmutableSnapshot({...bindings,target,config,manifest,readObject:o=>read(o.path)});
  if(repeated.written!==0||repeated.reused!==manifest.objects.length)throw new Error('Repeated publication changed immutable objects');
  const count=await bindings.d1.prepare('SELECT count(*) AS count FROM hi_records').first();
  if(count.count!==1860)throw new Error('Local D1 lost catalogue records');
  const worker={fetch:async()=>new Response('existing')};
  vm.runInNewContext((await read('src/historical-intelligence/worker-extension.js')).toString(),{worker_default:worker,HI_DATA:data,HI_CORE:core,crypto:webcrypto,Response,Request,URL,TextEncoder,TextDecoder,DecompressionStream,TypeError,RangeError,Map,Set,Date,JSON,Uint8Array});
  const record=data.records.filter(r=>r.historySeries.length).sort((a,b)=>b.historySeries.reduce((n,s)=>n+s.pointCount,0)-a.historySeries.reduce((n,s)=>n+s.pointCount,0))[0];
  const response=await worker.fetch(new Request('https://espacios.me/map/api/record-history?recordId='+encodeURIComponent(record.id)),{DB:bindings.d1,MARKET_R2:bindings.r2},{});
  const payload=await response.json();
  if(response.status!==200||payload.historySeries.some(s=>!s.partitionLoaded))throw new Error('API did not hydrate all immutable local R2 partitions');
  if(payload.scenarios.targetYears.at(-1)!==2080)throw new Error('Annual endpoint changed');
  console.log(JSON.stringify({mode:'local_emulator',remoteWrites:0,publication,repeated,records:count.count,hydratedRecordId:record.id,collection:payload.coverage.collection,verifiedEndpoint:2080}));
} finally {await bindings.dispose();}
