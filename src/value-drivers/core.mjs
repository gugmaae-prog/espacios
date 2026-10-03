export function sensitivity(ratePct,years){
 if(!Number.isFinite(ratePct)||ratePct<=-100||ratePct>100||!Number.isInteger(years)||years<1||years>30)return null;
 const index=100*(1+ratePct/100)**years;
 return {classification:'user_assumption_sensitivity',index,capitalChangePct:index-100,ratePct,years};
}
export function isPalmJebelAli(record){
 if(record?.emirate!=='Dubai')return false;
 const aliases=['palm jebel ali','palm jabal ali','the palm jebel ali'];
 return [record.name,record.area,record.masterCommunity,record.community].some(v=>typeof v==='string'&&aliases.includes(v.trim().toLowerCase()));
}
export function visibleDrivers(data,emirate='all',status='all'){
 return data.drivers.filter(d=>(emirate==='all'||d.emirates.includes(emirate))&&(status==='all'||d.status===status));
}
export function contextFeatures(drivers,communities){
 // Unique exact catalogue name only. These are community context markers,
 // never surveyed government assets, station catchments or distance measures.
 const features=[];
 for(const d of drivers){
  const matches=d.areas.flatMap(name=>communities.filter(c=>c.name===name&&d.emirates.includes(c.emirate)));
  const unique=[...new Map(matches.map(c=>[c.id,c])).values()];
  if(!unique.length)continue;
  const c=unique[0],p=c.coordinates;
  if(!p||typeof p.lng!=='number'||typeof p.lat!=='number'||!Number.isFinite(p.lng)||!Number.isFinite(p.lat))continue;
  features.push({type:'Feature',id:d.id,geometry:{type:'Point',coordinates:[p.lng,p.lat]},properties:{id:d.id,name:d.name,area:c.name,emirate:c.emirate,basis:'Community context; not project site'}});
 }
 return {type:'FeatureCollection',features};
}
