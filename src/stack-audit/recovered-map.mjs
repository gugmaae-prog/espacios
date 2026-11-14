/** Recovery of an actually served public catalogue, not a new source ingestion.
 * Original bytes/ETag were captured from HTTP200 on 13 October2026. */
export const MAP_RECOVERED_KEY='recovery/accepted-map-20261013/map-data.json';
export const MAP_RECOVERED_SHA256='b662672fb72cdcbaf62aa5df248c7373105a8f4ca514028188f91315c8fc6b56';
let recoveredMapData;
export async function mapRecoveredSnapshot(store,inventory){
 if(!store?.get)return null;
 if(!recoveredMapData){
  const object=await store.get(MAP_RECOVERED_KEY);if(!object)return null;
  const bytes=await object.arrayBuffer();if(bytes.byteLength!==1580538)throw new Error('Recovered map snapshot size mismatch.');
  const digest=await crypto.subtle.digest('SHA-256',bytes),hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==MAP_RECOVERED_SHA256)throw new Error('Recovered map snapshot checksum mismatch.');
  const data=JSON.parse(new TextDecoder().decode(bytes));
  const ids=new Set((data.projects||[]).map(p=>p.id)),expected=new Set((inventory.records||[]).filter(r=>r.type==='project').map(r=>r.id));
  if(ids.size!==1645||data.projects.length!==1645||expected.size!==ids.size||[...expected].some(id=>!ids.has(id))||data.communities?.length!==215||data.initiatives?.length!==72)throw new Error('Recovered map catalogue identity mismatch.');
  recoveredMapData=data;
 }
 const data=structuredClone(recoveredMapData);
 for(const project of data.projects){const c=project.coordinates;if(Array.isArray(c)){const [lng,lat]=c;project.coordinates=typeof lng==='number'&&typeof lat==='number'&&Number.isFinite(lng)&&Number.isFinite(lat)?{lng,lat}:null;}}
 const located=record=>{const c=record.coordinates;return c&&Number.isFinite(c.lng)&&Number.isFinite(c.lat)&&c.lng>=51&&c.lng<=57&&c.lat>=22&&c.lat<=27;};
 data.meta={...data.meta,projects:data.projects.length,currentProjects:data.projects.filter(p=>!p.archived).length,archivedProjects:data.projects.filter(p=>p.archived).length,geocodedProjects:data.projects.filter(located).length,communities:data.communities.length,geocodedCommunities:data.communities.filter(located).length,initiatives:data.initiatives.length,recovery:{classification:'recovered_accepted_public_response',capturedAt:'2026-10-13T08:01:44Z',originalBodySHA256:MAP_RECOVERED_SHA256,originalResponseETag:'community-reviewed-'+MAP_RECOVERED_SHA256,sourceEvidenceDatesPreserved:true,liveFeedIncluded:false,note:'Catalogue and authority project/phase records retained, including unmapped records. Recovery timestamp is not observation freshness. No financial history is inferred from map coordinates.'}};
 return data;
}
