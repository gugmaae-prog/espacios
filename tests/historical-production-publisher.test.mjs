import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import bridge,{validateStatement} from '../scripts/production-history-publisher-worker.mjs';
import {parseJSONC,validateProductionTarget} from '../scripts/publish-historical-snapshot.mjs';
import fs from 'node:fs';
import {retryReleaseTransport} from '../scripts/adapters/production-history-publisher.mjs';
test('release transport retries transient failures but preserves the final bytes and rejects exhausted retries',async()=>{
 let calls=0;const waits=[],success=Buffer.from('verified bytes\n200');
 const result=await retryReleaseTransport(async()=>{calls++;if(calls===1)throw Error('connection reset');if(calls===2)return Buffer.from('busy\n503');return success;},async ms=>waits.push(ms));
 assert.equal(result,success);assert.equal(calls,3);assert.deepEqual(waits,[1000,2000]);
 calls=0;await assert.rejects(retryReleaseTransport(async()=>{calls++;throw Error('offline');},async()=>{}),/offline/);assert.equal(calls,3);
 calls=0;const invalid=Buffer.from('invalid scope\n400');assert.equal(await retryReleaseTransport(async()=>{calls++;return invalid;},async()=>{}),invalid);assert.equal(calls,1);
});
const config=parseJSONC(fs.readFileSync(new URL('../wrangler.production.jsonc',import.meta.url),'utf8'));
const manifest={version:'version',rootIndex:{sha256:'a'.repeat(64)}};
const target={environment:'production',authorization:{kind:'explicit_user_request',scope:'publish_historical_snapshot_and_deploy_map'},workerName:config.name,accountId:config.account_id,r2:{binding:'MARKET_R2',bucketName:'psr-market-intelligence'},d1:{binding:'DB',databaseName:'cba-property-db',databaseId:'a5165cff-70a5-4685-af87-5ffdcf08652a'},snapshotVersion:manifest.version,rootSHA256:manifest.rootIndex.sha256};
const env={PUBLISH_TOKEN:'test-token',PUBLISH_EXPIRES:new Date(Date.now()+60000).toISOString(),PUBLISH_VERSION:manifest.version,PUBLISH_ROOT:manifest.rootIndex.sha256};
test('production requires explicit exact snapshot, account, bindings and restricted routes',()=>{
 assert.equal(validateProductionTarget(config,target,manifest),true);
 for(const changed of [{...target,authorization:null},{...target,accountId:'other'},{...target,rootSHA256:'b'.repeat(64)},{...target,r2:{...target.r2,bucketName:'other'}}])assert.throws(()=>validateProductionTarget(config,changed,manifest));
 assert.throws(()=>validateProductionTarget({...config,vars:{...config.vars,DATA_ROOM_PUBLIC:'true'}},target,manifest));
 assert.throws(()=>validateProductionTarget({...config,routes:['example/*']},target,manifest));
});
test('missing token or expiry prevents all storage access',async()=>{
 for(const altered of [{...env,PUBLISH_TOKEN:undefined},{...env,PUBLISH_EXPIRES:'2000-01-01'}]){
  const response=await bridge.fetch(new Request('https://bridge/r2?key=anything',{method:'PUT',headers:{Authorization:'Bearer test-token'},body:'x'}),altered);
  assert.equal(response.status,401);
 }
});
test('release bridge rejects destructive and unrelated SQL, foreign snapshot and incorrect root',()=>{
 for(const item of [{sql:'DELETE FROM hi_records WHERE snapshot_version = ?',params:['version']},{sql:'SELECT * FROM leads WHERE snapshot_version = ?',params:['version']},{sql:'SELECT count(*) AS count FROM hi_records WHERE snapshot_version = ?',params:['other']},{sql:"UPDATE hi_snapshots SET publication_state = 'complete' WHERE snapshot_version = ? AND root_sha256 = ?",params:['version','wrong']}])assert.throws(()=>validateStatement(item,env));
 assert.equal(validateStatement({sql:'SELECT count(*) AS count FROM hi_records WHERE snapshot_version = ?',params:['version']},env).params[0],'version');
});
test('R2 requires matching bytes and conditional creation, preserving a concurrent object',async()=>{
 globalThis.crypto??=webcrypto;
 const bytes=new TextEncoder().encode('immutable'),sha=Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex'),key=`research/published/2026-10-05/historical-intelligence/objects/${sha}.json.gz`;
 let writes=0;const storage={async put(k,b,options){writes++;assert.equal(k,key);assert.equal(options.onlyIf.etagDoesNotMatch,'*');assert.equal(options.customMetadata.sha256,sha);return null;}};
 const headers={Authorization:'Bearer test-token','X-Snapshot-Version':'version','X-Content-SHA256':sha};
 let response=await bridge.fetch(new Request('https://bridge/r2?key='+key,{method:'PUT',headers,body:'incorrect'}),{...env,MARKET_R2:storage});assert.equal(response.status,400);assert.equal(writes,0);
 response=await bridge.fetch(new Request('https://bridge/r2?key='+key,{method:'PUT',headers,body:bytes}),{...env,MARKET_R2:storage});assert.equal(response.status,200);assert.equal((await response.json()).created,false);assert.equal(writes,1);
});
