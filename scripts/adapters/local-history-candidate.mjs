import {getPlatformProxy} from 'wrangler';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs/promises';
import {validateCandidateTarget} from '../publish-historical-snapshot.mjs';

// Uses an isolated local emulator only. Remote bindings and env-file loading are disabled.
export async function connectCandidate({target,config,ephemeral=false}) {
  validateCandidateTarget(config,target);
  if(config.name!=='espacios-history-local-candidate'||(config.d1_databases||[]).some(x=>x.remote)||(config.r2_buckets||[]).some(x=>x.remote))throw new Error('This adapter supports the explicit local candidate only.');
  const proxy=await getPlatformProxy({configPath:fileURLToPath(new URL('../../wrangler.history-local.jsonc',import.meta.url)),remoteBindings:false,envFiles:[],persist:ephemeral?false:{path:fileURLToPath(new URL('../../.wrangler/history-local',import.meta.url))}});
  try {
    const sql=await fs.readFile(new URL('../../migrations/0001_historical_intelligence.sql',import.meta.url),'utf8');
    const withoutComments=sql.replace(/^--.*$/gm,'');
    const statements=withoutComments.match(/CREATE TRIGGER[\s\S]*?END;|(?:PRAGMA|CREATE TABLE|CREATE INDEX)[\s\S]*?;/g)||[];
    for(const statement of statements)await proxy.env.DB.prepare(statement).run();
    return {r2:proxy.env.MARKET_R2,d1:proxy.env.DB,dispose:proxy.dispose};
  } catch(error) {await proxy.dispose();throw error;}
}
