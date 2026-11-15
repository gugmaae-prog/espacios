const AJMAN_DISPOSITIONS_PATH='/map/api/uae-evidence/ajman/dispositions';
const dispositionDigest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
const dispositionInt=(value,min,max)=>/^\d+$/.test(value||'')&&Number.isSafeInteger(Number(value))&&Number(value)>=min&&Number(value)<=max?Number(value):null;
const dispositionReply=(request,body,status=200)=>new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public,max-age=60,s-maxage=300':'no-store','x-content-type-options':'nosniff','x-espacios-evidence-source':'ajman-dlrr-20260821-unit-dispositions'}});

async function verifiedDispositionRows(store,report,manifest){
 const entry=manifest?.entries?.[report.storageKey];
 if(!store||entry?.sha256!==report.compressedSha256||entry.bytes!==report.compressedBytes)throw Error('Verified disposition asset is not configured');
 const object=await store.get(report.storageKey);
 if(!object||object.sha256!==report.compressedSha256||object.size!==report.compressedBytes)throw Error('Disposition object metadata mismatch');
 const compressed=await object.arrayBuffer();
 if(compressed.byteLength!==report.compressedBytes||await dispositionDigest(compressed)!==report.compressedSha256)throw Error('Disposition compressed checksum mismatch');
 const raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 if(raw.byteLength!==report.rawBytes||await dispositionDigest(raw)!==report.rawSha256)throw Error('Disposition decoded checksum mismatch');
 const rows=JSON.parse(new TextDecoder().decode(raw));
 if(!Array.isArray(rows)||rows.length!==report.rows)throw Error('Disposition row count mismatch');
 const labels=new Set();let unknownPeriodRows=0,unknownValueRows=0,countSum=0;
 for(const row of rows){
  if(typeof row.project_name_english!=='string'||!row.project_name_english||!Number.isSafeInteger(row.transactions_count)||row.transactions_count<0||row.year!==null&&(!Number.isSafeInteger(row.year)||!Number.isSafeInteger(row.quarter))||(row.year===null)!==(row.quarter===null)||(row.total_transactions_values_in_aed===null)!==(row.max_transaction_value_in_aed===null))throw Error('Disposition row invalid');
  labels.add(row.project_name_english);countSum+=row.transactions_count;
  if(row.year===null)unknownPeriodRows++;
  if(row.total_transactions_values_in_aed===null)unknownValueRows++;
 }
 if(labels.size!==report.distinctSourceProjectLabels||unknownPeriodRows!==report.unknownPeriodRows||unknownValueRows!==report.unknownValueRows||countSum!==report.transactionCountSum)throw Error('Disposition population mismatch');
 return {rows,origin:object.storageSource||'verified_private_asset'};
}

export async function mapAjmanDispositions(request,report,store,manifest){
 const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'');
 if(path!==AJMAN_DISPOSITIONS_PATH)return null;
 if(!['GET','HEAD'].includes(request.method))return dispositionReply(request,{error:'Read-only endpoint'},405);
 if(!report?.storageKey||!report.compressedSha256)return dispositionReply(request,{error:'Verified Ajman dispositions are not configured.'},503);
 const params=url.searchParams,year=params.has('year')?dispositionInt(params.get('year'),2019,2026):null,quarter=params.has('quarter')?dispositionInt(params.get('quarter'),1,4):null,limit=params.has('limit')?dispositionInt(params.get('limit'),1,100):50,offset=params.has('offset')?dispositionInt(params.get('offset'),0,report.rows):0,project=params.get('project'),period=params.get('period')||'all',value=params.get('value')||'all';
 if((params.has('year')&&year===null)||(params.has('quarter')&&quarter===null)||limit===null||offset===null||(project!==null&&(!project.trim()||project.length>180))||!['all','known','unknown'].includes(period)||!['all','known','unknown'].includes(value)||(period==='unknown'&&(year!==null||quarter!==null)))return dispositionReply(request,{error:'Invalid year, quarter, project, period, value, limit, or offset.'},400);
 try{
  const {rows,origin}=await verifiedDispositionRows(store,report,manifest),matches=[];
  let reportedDispositionCount=0,knownValueAedSum=0,knownValueRows=0,unknownValueRows=0,unknownPeriodRows=0;
  for(let i=0;i<rows.length;i++){
   const row=rows[i],hasPeriod=row.year!==null,hasValue=row.total_transactions_values_in_aed!==null;
   if(year!==null&&row.year!==year||quarter!==null&&row.quarter!==quarter||project!==null&&row.project_name_english!==project||period==='known'&&!hasPeriod||period==='unknown'&&hasPeriod||value==='known'&&!hasValue||value==='unknown'&&hasValue)continue;
   matches.push({...row,sourceRowIndex:i,periodStatus:hasPeriod?'reported':'unreported',valueStatus:hasValue?'reported':'unreported',canonicalProjectId:null,matchStatus:'unmatched'});
   reportedDispositionCount+=row.transactions_count;
   if(hasValue){knownValueRows++;knownValueAedSum+=row.total_transactions_values_in_aed;}else unknownValueRows++;
   if(!hasPeriod)unknownPeriodRows++;
  }
  matches.sort((a,b)=>(b.year??-1)-(a.year??-1)||(b.quarter??-1)-(a.quarter??-1)||a.project_name_english.localeCompare(b.project_name_english)||a.sourceRowIndex-b.sourceRowIndex);
  const source={id:report.sourceId,publisher:report.publisher,datasetUrl:report.datasetUrl,licence:report.licence,licenceUrl:report.licenceUrl,sourceModifiedAt:report.sourceModifiedAt,retrievedAt:report.retrievedAt,rawSha256:report.rawSha256,compressedSha256:report.compressedSha256,rows:report.rows,distinctSourceProjectLabels:report.distinctSourceProjectLabels,unknownPeriodRows:report.unknownPeriodRows,unknownValueRows:report.unknownValueRows,missingPeriods:report.missingPeriods,grain:report.grain,storage:origin};
  const scope={emirate:'Ajman',evidenceClass:report.evidenceClass,canonicalProjectMatches:0,limits:report.limits};
  return dispositionReply(request,{source,scope,filters:{year,quarter,project,period,value},totalRows:matches.length,totals:{reportedDispositionCount,knownValueRows,unknownValueRows,unknownPeriodRows,knownValueAedSum:Number(knownValueAedSum.toFixed(2)),knownValueIncomplete:unknownValueRows>0},limit,offset,rows:matches.slice(offset,offset+limit)});
 }catch{return dispositionReply(request,{error:'The verified Ajman unit-disposition source is temporarily unavailable.'},503);}
}
