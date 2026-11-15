import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';

const root=new URL('../',import.meta.url);
const read=path=>fs.readFile(new URL(path,root));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const canonicalBytes=await read('data/historical-intelligence-20261003.json');
const mapBytes=await read('data/recovery/accepted-map-20261013.json');
const canonical=JSON.parse(canonicalBytes),catalogue=JSON.parse(mapBytes);
if(canonical.records.length!==1860||catalogue.projects.length!==1645)throw Error('Accepted V48 identity changed');
const projectById=new Map(catalogue.projects.map(project=>[project.id,project]));
const source=canonical.sources.find(item=>item.id==='dld-official-transactions-20261003');
if(!source||!source.licence?.includes('Dubai Open Data Licence'))throw Error('Reviewed DLD source is unavailable');
const segmentOf={'Residential | Unit | native subtype: Flat':'apartment','Residential | Villa | native subtype: Villa':'villa'};
const periodEnd=period=>{
 const quarter=/^(\d{4})Q([1-4])$/.exec(period);
 if(quarter)return `${quarter[1]}-${String(Number(quarter[2])*3).padStart(2,'0')}-${[31,30,30,31][Number(quarter[2])-1]}`;
 const month=/^(\d{4})-(\d{2})$/.exec(period);
 if(month)return new Date(Date.UTC(Number(month[1]),Number(month[2]),0)).toISOString().slice(0,10);
 throw Error('Unexpected native period '+period);
};
const observations=[];
for(const record of canonical.records){
 if(record.type!=='project')continue;
 const project=projectById.get(record.id);
 if(!project||project.coordinateBasis!=='Project coordinate recorded in the PSR catalogue')continue;
 const lat=Number(project.coordinates?.lat),lng=Number(project.coordinates?.lng);
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<24||lat>26||lng<54||lng>57)throw Error('Invalid reviewed project coordinate '+record.id);
 for(const series of record.historySeries||[]){
  const segment=segmentOf[series.segment];
  if(!segment||series.scope!=='subject'||series.identityVerified!==true||series.metric!=='price'||series.unit!=='AED/sqft'||series.classification!=='official DLD derived primary snapshot'||series.sourceId!==source.id)continue;
  for(const point of series.points||[]){
   const [period,value,sampleCount,qualityStatus]=point;
   if(qualityStatus!=='sample >=20 and positive median')continue;
   if(!Number.isFinite(value)||value<=0||!Number.isInteger(sampleCount)||sampleCount<20)throw Error('Published quality claim failed '+series.id+' '+period);
   const end=periodEnd(period);
   if(end>'2026-09-30')throw Error('Observation after reviewed source cutoff '+period);
   observations.push({id:point[6],projectId:record.id,projectName:record.name,emirate:'Dubai',coordinates:[lng,lat],coordinateBasis:project.coordinateBasis,segment,registration:series.registration,period,periodEnd:end,frequency:series.frequency,medianAedSqft:Math.round(value*100)/100,eligibleSaleCount:sampleCount,qualityStatus,scope:'identity_verified_project_subject',sourceId:series.sourceId,sourceSeriesId:series.id});
  }
 }
}
observations.sort((a,b)=>a.projectId.localeCompare(b.projectId)||a.periodEnd.localeCompare(b.periodEnd)||a.segment.localeCompare(b.segment)||a.registration.localeCompare(b.registration)||a.id.localeCompare(b.id));
const identities=new Set(observations.map(row=>row.id));
if(identities.size!==observations.length)throw Error('Duplicate source observation identity');
if(observations.length!==175||new Set(observations.map(row=>row.projectId)).size!==96)throw Error('Unexpected qualified project evidence count');
const output={version:'20261115-v48-qualified-project-heat-v1',classification:'registered_sale_project_subject_supplement',asOf:'2026-10-04',source:{id:source.id,title:source.title,publisher:source.publisher,url:source.url,licence:source.licence,licenceUrl:source.licenceURL,retrievedAt:source.retrievedAt,publicationDateStatus:source.publicationDateStatus,canonicalSHA256:sha(canonicalBytes),catalogueSHA256:sha(mapBytes)},method:{identity:'Exact accepted V48 project ID; DLD subject series has identityVerified=true',coordinate:'Recorded PSR project coordinate only; approximate community centres excluded',qualification:'Official DLD subject median with at least 20 eligible sales and positive AED/sqft value',deduplication:'Only native Flat and Villa subtype series; overlapping parent Residential Unit/Villa and shared area-context series excluded',time:'Native monthly or quarterly period end; source snapshot is retrospective latest vintage',interpretation:'Supplemental project observations, not additive to area sales counts or the area median raster'},counts:{observations:observations.length,projects:new Set(observations.map(row=>row.projectId)).size,apartments:observations.filter(row=>row.segment==='apartment').length,villas:observations.filter(row=>row.segment==='villa').length},observations};
const target=new URL('data/recovery/verified-project-heat-observations.json',root);
const serialized=JSON.stringify(output)+'\n';
if(process.argv.includes('--check')){
 const existing=await fs.readFile(target,'utf8');
 if(existing!==serialized)throw Error('Verified project heat projection is stale');
}else await fs.writeFile(target,serialized);
process.stdout.write(JSON.stringify({version:output.version,...output.counts,bytes:Buffer.byteLength(serialized),sha256:sha(Buffer.from(serialized))})+'\n');
