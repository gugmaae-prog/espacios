import {DurableObject} from 'cloudflare:workers';
/** One coordination atom for this product's deliberately small shared daily
 * allowance. Each reservation commits all three limits before inference. */
export class MapAIQuota extends DurableObject {
 constructor(ctx,env){super(ctx,env);this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS quota (quota_key TEXT PRIMARY KEY, requests INTEGER NOT NULL, expires_at INTEGER NOT NULL)');}
 reserve(actor){
  if(typeof actor!=='string'||!/^[a-f0-9]{64}$/.test(actor))throw new TypeError('Invalid quota actor.');
  const now=Date.now(),day=new Date(now).toISOString().slice(0,10),minute=Math.floor(now/60000),keys=['actor:'+minute+':'+actor,'minute:'+minute,'day:'+day],limits=[3,10,40];
  return this.ctx.storage.transactionSync(()=>{
   const rows=this.ctx.storage.sql.exec('SELECT quota_key,requests FROM quota WHERE quota_key IN (?, ?, ?)',...keys).toArray(),counts=new Map(rows.map(row=>[row.quota_key,row.requests]));
   const blocked=keys.findIndex((key,i)=>(counts.get(key)||0)>=limits[i]);
   if(blocked!==-1)return{allowed:false,reason:blocked===0?'actor_minute':blocked===1?'global_minute':'global_day',retryAfter:blocked===2?Math.max(1,Math.ceil((Date.parse(day+'T00:00:00Z')+86400000-now)/1000)):60};
   for(const key of keys)this.ctx.storage.sql.exec('INSERT INTO quota (quota_key,requests,expires_at) VALUES (?,1,?) ON CONFLICT(quota_key) DO UPDATE SET requests=requests+1',key,Math.floor(now/1000)+172800);
   this.ctx.storage.sql.exec('DELETE FROM quota WHERE expires_at < ?',Math.floor(now/1000));
   return{allowed:true,limits:{actorMinute:3,globalMinute:10,globalDay:40}};
  });
 }
}
