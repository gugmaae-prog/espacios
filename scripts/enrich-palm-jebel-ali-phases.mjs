import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

const root=new URL('../',import.meta.url);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=async path=>JSON.parse(await fs.readFile(new URL(path,root)));
const history=await read('data/palm-jebel-ali-history-20261103.json');
const index=await read('data/historical-intelligence/runtime-index.json');
if(index.version!==history.acceptedV48Version||history.aggregateDistinctSaleCounts.total!==2102)throw Error('Accepted Palm baseline changed');
const ref=index.records.find(r=>r.id===history.recordId);
if(!ref)throw Error('Palm record missing from V48 index');
async function partition(descriptor){
 const bytes=await fs.readFile(new URL('data/historical-intelligence/objects/'+descriptor.sha256+'.json.gz',root));
 if(bytes.length!==descriptor.bytes||digest(bytes)!==descriptor.sha256)throw Error('Immutable partition checksum mismatch: '+descriptor.sha256);
 return JSON.parse(gunzipSync(bytes));
}
const recordPartition=await partition(ref.recordPartition);
const record=recordPartition.records.find(r=>r.id===history.recordId);
if(!record||!Array.isArray(record.historySeries))throw Error('Palm record partition missing');
const pointers=record.historySeries.filter(s=>s.frequency==='quarterly'&&s.classification==='official DLD derived primary snapshot'&&s.sourceAreaId===411&&s.scope==='area_context'&&s.segment?.includes('native project: Palm ')&&(/Commercial \| Land|Residential \| Unit/.test(s.segment)));
const phaseSeries=[];
for(const pointer of pointers){
 const stored=(await partition(pointer.partition)).series.find(s=>s.id===pointer.id);
 if(!stored||stored.pointCount!==pointer.pointCount||stored.points.length!==pointer.pointCount||stored.segment!==pointer.segment||stored.frequency!=='quarterly')throw Error('Native phase series changed: '+pointer.id);
 const label=pointer.segment.split('native project: ')[1];
 const kind=pointer.segment.startsWith('Commercial | Land')?'land':'unit';
 const points=stored.points.map(row=>{
  const [period,value,saleCount,, , , ,p25,p75,,,,,,native]=row;
  if(!/^[0-9]{4}Q[1-4]$/.test(period)||!Number.isInteger(saleCount)||saleCount<0||native.sourceAreaId!==411||native.nativeProjectName!==label||native.displayEligible!==(saleCount>=history.minimumDisplaySales&&Number.isFinite(value)))throw Error('Native phase row invalid: '+pointer.id+' '+period);
  const display=native.displayEligible&&native.periodComplete;
  return {period,saleCount,medianAEDPerSqft:display?Math.round(value*100)/100:null,p25AEDPerSqft:display?Math.round(p25*100)/100:null,p75AEDPerSqft:display?Math.round(p75*100)/100:null,withheldReason:display?null:!native.periodComplete?'partial_period':'fewer_than_20_sales',periodComplete:native.periodComplete};
 });
 phaseSeries.push({id:pointer.id,label,kind,scope:'native_project_label_within_dld_area_411',identityVerified:false,segment:pointer.segment,registration:pointer.registration,sourceId:pointer.sourceId,sourceAreaId:411,archivePartitionSHA256:pointer.partition.sha256,observedPeriodStart:points[0]?.period,observedPeriodEnd:points.at(-1)?.period,points});
}
phaseSeries.sort((a,b)=>a.kind.localeCompare(b.kind)||a.label.localeCompare(b.label));
if(phaseSeries.length!==19)throw Error('Expected 19 named Palm project cohorts, found '+phaseSeries.length);
const land=phaseSeries.filter(s=>s.kind==='land').reduce((n,s)=>n+s.points.reduce((sum,p)=>sum+p.saleCount,0),0);
const units=phaseSeries.filter(s=>s.kind==='unit').reduce((n,s)=>n+s.points.reduce((sum,p)=>sum+p.saleCount,0),0);
if(land!==1573||units!==415)throw Error('Named phase counts do not reconcile with V48: '+land+'/'+units);
history.version='20261103-palm-jebel-ali-history-v2';
history.phaseSeries=phaseSeries;
history.phaseSeriesSHA256=digest(JSON.stringify(phaseSeries));
history.phaseReconciliation={namedCommercialLandSales:land,unassignedCommercialLandSales:history.aggregateDistinctSaleCounts.commercialLand-land,namedResidentialUnitSales:units,additiveToAreaTotal:false,basis:'The native project-name cohorts subdivide the same DLD area 411 sales. Do not add them to area aggregates; project names and historical marketed identity are not independently verified.'};
history.scenarioPolicy.horizonsYears=[1,3,5,10];
const output=JSON.stringify(history,null,2)+'\n';
const target=new URL('data/palm-jebel-ali-history-20261103.json',root);
if(process.argv.includes('--check')){
 if(await fs.readFile(target,'utf8')!==output)throw Error('Palm phase history output differs; run node scripts/enrich-palm-jebel-ali-phases.mjs');
}else await fs.writeFile(target,output);
console.log(JSON.stringify({version:history.version,phaseSeries:phaseSeries.length,namedCommercialLandSales:land,unassignedCommercialLandSales:112,namedResidentialUnitSales:units,sha256:history.phaseSeriesSHA256}));
