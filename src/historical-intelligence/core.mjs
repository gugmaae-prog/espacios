/** Historical accountability, descriptive event studies and explicit scenarios.
 * Source observations survive unchanged. Context and user inputs never become
 * subject observations; an event never adds an automatic price premium. */
export const HISTORICAL_VERSION = 'espacios-historical-intelligence-v1';
export const TARGET_YEARS = Object.freeze(Array.from({length:54}, (_,i)=>2027+i));
const DAY=86400000, METRICS=['price','rent','volume'], CASES=['downside','base','upside'];
const EVIDENCE_DATE_CACHE=new Map();
function rememberDate(key,value){if(EVIDENCE_DATE_CACHE.size>=8192)EVIDENCE_DATE_CACHE.delete(EVIDENCE_DATE_CACHE.keys().next().value);EVIDENCE_DATE_CACHE.set(key,value);return{...value};}
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const clone=x=>JSON.parse(JSON.stringify(x));
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);
function day(y,m,d){
 const text=`${String(y).padStart(4,'0')}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
 const stamp=Date.parse(text+'T00:00:00Z');
 if(y<1000||y>9999||!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==text)throw new TypeError('Invalid calendar date.');
 return text;
}
function monthEnd(y,m){return day(y,m,new Date(Date.UTC(y,m,0)).getUTCDate());}
function oneDate(value){
 if(typeof value!=='string'||!value.trim())throw new TypeError('A dated evidence value is required.');
 const s=value.trim();let m;
 if(EVIDENCE_DATE_CACHE.has(s))return{...EVIDENCE_DATE_CACHE.get(s)};
 if((m=/^(\d{4})-(\d{2})-(\d{2})(T.*)?$/.exec(s))){
  const date=day(+m[1],+m[2],+m[3]);
  if(m[4]){if(!/^T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(m[4])||!Number.isFinite(Date.parse(s)))throw new TypeError('Timestamp requires an explicit timezone.');return rememberDate(s,{start:date,end:date,precision:'instant',instant:Date.parse(s)});}
  return rememberDate(s,{start:date,end:date,precision:'day'});
 }
 if((m=/^(\d{4})-(0[1-9]|1[0-2])$/.exec(s)))return rememberDate(s,{start:day(+m[1],+m[2],1),end:monthEnd(+m[1],+m[2]),precision:'month'});
 if((m=/^(\d{4})-?Q([1-4])$/.exec(s)))return rememberDate(s,{start:day(+m[1],(+m[2]-1)*3+1,1),end:monthEnd(+m[1],+m[2]*3),precision:'quarter'});
 if((m=/^(\d{4})-?H([12])$/.exec(s)))return rememberDate(s,{start:day(+m[1],m[2]==='1'?1:7,1),end:monthEnd(+m[1],m[2]==='1'?6:12),precision:'half_year'});
 if((m=/^(\d{4})(?:-?FY)?$/.exec(s)))return rememberDate(s,{start:day(+m[1],1,1),end:day(+m[1],12,31),precision:'year'});
 throw new TypeError('Use a native month, quarter, half year, year, ISO day or timestamp.');
}
/** Date precision is retained; a month/year never becomes a guessed exact day. */
export function parseEvidenceDate(value){
 if(typeof value==='string')return oneDate(value);
 if(!value||typeof value!=='object')throw new TypeError('Date or date interval required.');
 const start=oneDate(value.start||value.date||value.value),finish=value.end?oneDate(value.end):start;
 const precision=value.precision||((value.end&&start.start!==finish.end)?'range':start.precision);
 if(!['instant','day','month','quarter','half_year','year','range'].includes(precision))throw new TypeError('Unsupported date precision.');
 const rank={instant:0,day:1,month:2,quarter:3,half_year:4,year:5};
 if(precision!=='range'&&rank[precision]<rank[start.precision])throw new TypeError('Evidence cannot claim finer date precision than its source date.');
 let end=finish.end;
 if(!value.end&&precision!==start.precision&&precision!=='range'){
  const y=+start.start.slice(0,4),m=+start.start.slice(5,7);
  if(precision==='year')end=day(y,12,31);
  else if(precision==='month')end=monthEnd(y,m);
  else if(precision==='quarter')end=monthEnd(y,Math.ceil(m/3)*3);
  else if(precision==='half_year')end=monthEnd(y,m<=6?6:12);
 }
 if(end<start.start)throw new TypeError('Date interval ends before it starts.');
 return{start:start.start,end,precision,...(start.instant!==undefined?{instant:start.instant}:{})};
}
function lastInstant(value){const d=parseEvidenceDate(value);return d.instant??Date.parse(d.end+'T23:59:59.999Z');}
function firstInstant(value){const d=parseEvidenceDate(value);return d.instant??Date.parse(d.start+'T00:00:00Z');}
function availabilityOf(value,source){return value.firstAvailableAt??value.availableAt??value.publishedAt??value.published??source?.firstAvailableAt??source?.availableAt??source?.publishedAt??source?.published??null;}
/** Unknown availability fails closed. Retrieval time is not first publication. */
export function isAvailableAsOf(value,asOf,source=null){
 const available=availabilityOf(value||{},source);if(!available)return false;
 try{
  const cutoff=lastInstant(asOf),known=lastInstant(available);
  const pub=value?.publishedAt??value?.published??source?.publishedAt??source?.published;
  if(pub&&lastInstant(pub)>cutoff)return false;
  if(pub&&value?.firstAvailableAt&&lastInstant(pub)>lastInstant(value.firstAvailableAt))return false;
  return known<=cutoff;
 }catch{return false;}
}
function observationAvailableAsOf(value,asOf,byId){
 const source=byId.get(value.sourceId);
 if(!source||!isAvailableAsOf(source,asOf)||!isAvailableAsOf(value,asOf,source))return false;
 return(value.identitySourceIds||[]).every(id=>{const proof=byId.get(id);return proof&&isAvailableAsOf(proof,asOf);});
}
export function eligibleFeaturesAsOf(features,{asOf,sources=[]}={}){
 const byId=new Map(sources.map(s=>[s.id,s])),eligible=[],withheld=[];
 for(const feature of features||[]){
  const ids=feature.sourceIds||[feature.sourceId].filter(Boolean),linked=ids.map(id=>byId.get(id));
  const source=linked[0],supportKnown=ids.length>0&&linked.every(s=>s&&isAvailableAsOf(s,asOf));
  if(supportKnown&&isAvailableAsOf(feature,asOf,source))eligible.push(clone(feature));
  else withheld.push({feature:clone(feature),reason:'Feature publication/availability is unknown, invalid, conflicting or after the forecast origin.'});
 }
 return{eligible,withheld,asOf};
}
function metric(value){
 if(METRICS.includes(value))return value;
 if(/sale.*count|transaction.*count|volume/.test(value||''))return'volume';
 if(/rent/.test(value||'')&&!/yield/.test(value))return'rent';
 if(/price|median_sale|sale_statistics|ask.*psf/.test(value||''))return'price';
 return null;
}
function pointObject(point,series){
 if(!Array.isArray(point))return {...point};
 const cols=series.columns||['period','sampleCount','value','p25','p75'];
 return Object.fromEntries(cols.map((k,i)=>[k,point[i]===undefined?null:point[i]]));
}
function inferFrequency(period,fallback){
 if(fallback!=='native_mixed'&&fallback!=='mixed'&&fallback)return fallback;
 const s=String(period||'');return /^\d{4}-?Q[1-4]$/.test(s)?'quarterly':/^\d{4}-?H[12]$/.test(s)?'half_year':/^\d{4}(?:-?FY)?$/.test(s)?'annual':/^\d{4}-\d{2}$/.test(s)?'monthly':fallback||'daily';
}
/** Expand a presentation view without editing any native tuple or source row. */
export function expandRecordObservations(record){
 const out=(record.observations||[]).map(o=>({...clone(o),recordId:o.recordId||record.id}));
 for(const series of record.historySeries||[]){
  for(const native of series.points||[]){
   const p=pointObject(native,series);
   const expanded={...clone(p),id:p.id||`${series.id}:${p.period}`,recordId:p.recordId||record.id,metric:metric(p.metric||series.metric),frequency:inferFrequency(p.period,p.frequency||series.frequency),unit:p.unit||series.unit,sourceId:p.sourceId||series.sourceId,scope:p.scope||series.scope,identityVerified:p.identityVerified??series.identityVerified??false,seriesId:series.id,fromHistorySeries:true,seriesScope:series.scope,seriesIdentityVerified:series.identityVerified??false,subjectRecordId:series.subjectRecordId||null,identitySourceIds:clone(series.identitySourceIds||[]),contextCommunityId:series.contextCommunityId||null,linkBasis:series.linkBasis||null,geography:series.geography,segment:series.segment,registration:series.registration,observationKind:p.observationKind||series.observationKind||'aggregate',publishedAt:p.publishedAt||series.publishedAt,firstAvailableAt:p.firstAvailableAt||series.firstAvailableAt,native:clone(native)};
   if(series.recordLinkReview)expanded.recordLinkReview=clone(series.recordLinkReview);
   out.push(expanded);
   if(expanded.metric==='price'&&['subject','area_context','community_context'].includes(expanded.scope)&&Number.isInteger(p.sampleCount)&&p.sampleCount>=0)out.push({...expanded,id:expanded.id+':eligible-count',metric:'volume',value:p.sampleCount,unit:'eligible sales count',observationKind:'source_count',derivedFromNativeCount:true,medianQualityStatus:p.qualityStatus,qualityStatus:/^withheld median: sparse\/invalid$/.test(p.qualityStatus||'')?'Native eligible count retained; median sample gate does not apply.':p.qualityStatus});
  }
 }
 return out;
}
/** Apply only reviewed exact-record geographic revisions, preserving raw fields. */
export function applyCommunityCorrections(payload,corrections){
 if(!Array.isArray(payload?.projects))return payload;
 return {...payload,projects:payload.projects.map(project=>{
  const correction=corrections.find(c=>c.recordId===project.id||c.recordId==='project:'+project.slug);
  if(!correction||project.emirate&&project.emirate!==correction.emirate)return project;
  return {...project,area:correction.area,communityId:correction.communityId,communityAssociationReview:{...clone(correction),priorArea:project.area??null,priorCommunityId:project.communityId??null}};
 })};
}
function observationKey(o){
 if(o.transactionId||o.sourceObservationId)return`${o.sourceId}|${o.transactionId||o.sourceObservationId}|${metric(o.metric)||o.metric}`;
 return [o.sourceId,o.seriesId||o.id||'',o.recordId,o.period,metric(o.metric)||o.metric,o.segment||'',o.registration||''].join('|');
}
/** Duplicate/conflicting source rows remain in raw output; none are summed twice. */
export function deduplicateObservations(observations){
 const retained=[],duplicates=[],conflicts=[],seen=new Map();
 for(const item of observations||[]){
  const o=clone(item),key=observationKey(o),old=seen.get(key);
  if(!old){seen.set(key,o);retained.push(o);continue;}
  const signature=x=>JSON.stringify([x.recordId,x.period,x.value,x.unit,x.sampleCount,x.scope,x.identityVerified]);
  if(signature(old)===signature(o))duplicates.push({...o,duplicateOf:old.id||key});
  else{old.duplicateConflict=true;o.duplicateConflict=true;conflicts.push(o);}
 }
 return{retained,duplicates,conflicts,rawCount:(observations||[]).length};
}
export function validateObservation(observation,record,{asOf,sources=[],minimumSample=20,sourceIndex=null}={}){
 const o=clone(observation),issues=[],m=metric(o.metric),scope=o.scope==='project'?'subject':o.scope;
 if(!m)issues.push('unsupported_metric');
 if(o.recordId&&o.recordId!==record.id)issues.push('record_identity_mismatch');
 if(o.emirate&&record.emirate&&o.emirate!==record.emirate)issues.push('emirate_identity_mismatch');
 if(!['subject','area_context','asking_benchmark','community_context','published_reference'].includes(scope))issues.push('unknown_evidence_scope');
 if(scope==='subject'&&o.identityVerified!==true)issues.push('unverified_subject_identity');
 if(o.fromHistorySeries&&(o.scope!==o.seriesScope||o.identityVerified!==o.seriesIdentityVerified))issues.push('series_identity_override');
 if(scope==='subject'&&o.subjectRecordId&&o.subjectRecordId!==record.id)issues.push('subject_series_owner_mismatch');
 if(scope==='subject'&&o.fromHistorySeries&&!o.subjectRecordId)issues.push('unverified_subject_series_owner');
 const byId=sourceIndex||new Map(sources.map(s=>[s.id,s])),source=byId.get(o.sourceId);
 if(scope==='subject'&&o.fromHistorySeries&&(!Array.isArray(o.identitySourceIds)||!o.identitySourceIds.length||o.identitySourceIds.some(id=>!byId.has(id))))issues.push('missing_subject_identity_proof');
 if(!source)issues.push('missing_source');
 if(!o.unit||typeof o.unit!=='string')issues.push('missing_unit');
 let date=null;try{date=parseEvidenceDate(o.period);}catch{issues.push('invalid_native_period');}
 if(date&&lastInstant(date)>lastInstant(asOf))issues.push('incomplete_or_future_period');
 if(o.duplicateConflict)issues.push('conflicting_source_revision');
 if(o.recordLinkReview?.status==='rejected')issues.push('rejected_record_geography_link');
 const medianSampleOnly=/^withheld median: sparse\/invalid$/.test(o.qualityStatus||'')&&finite(o.value)&&o.value>0&&Number.isInteger(o.sampleCount)&&o.sampleCount>=0&&o.sampleCount<minimumSample;
 if(o.qualityStatus&&!medianSampleOnly&&/conflict|invalid|withheld|quarantin|unverified/.test(o.qualityStatus))issues.push('source_quality_review');
 if(o.status&&/conflict|invalid|quarantin/.test(o.status))issues.push('source_quality_review');
 const goodValue=finite(o.value)&&(m==='volume'?Number.isInteger(o.value)&&o.value>=0:m==='rent'?o.value>=0:o.value>0);
 if(!goodValue)issues.push('missing_or_invalid_value');
 if(o.sampleCount!==null&&o.sampleCount!==undefined&&(!Number.isInteger(o.sampleCount)||o.sampleCount<0))issues.push('invalid_sample_count');
 const aggregate=o.observationKind!=='transaction'&&o.observationKind!=='asking_quote';
 const sparse=aggregate&&['subject','area_context','community_context','published_reference'].includes(scope)&&m!=='volume'&&(!Number.isInteger(o.sampleCount)||o.sampleCount<minimumSample);
 const direct=scope==='subject',valid=issues.length===0;
 return{...o,metric:m,scope,date,issues,valid,direct,displayEligible:valid&&!sparse,sparse,availability:observationAvailableAsOf(o,asOf,byId)?'known_as_of':'unknown_or_later',coverageStatus:!valid?'conflict':sparse?'sparse':direct?'observed':'context_only'};
}
function monthIndex(p){const d=parseEvidenceDate(p);return +d.start.slice(0,4)*12+(+d.start.slice(5,7)-1);}
function monthText(i){return`${Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}`;}
function lastCompleteMonth(asOf){const d=parseEvidenceDate(asOf);return +d.end.slice(0,4)*12+(+d.end.slice(5,7)-1)-1;}
function applicableStart(record,m){
 const explicit=record.metricApplicability?.[m];
 if(explicit?.verified===true&&explicit.start&&explicit.sourceIds?.length)return{date:parseEvidenceDate(explicit.start),basis:'verified_metric_applicability'};
 const kinds=m==='rent'?['occupancy']:['launch'];
 const milestones=(record.lifecycle||[]).filter(x=>kinds.includes(x.kind)&&x.status==='verified'&&x.eventStatus!=='planned'&&x.date?.qualifier!=='by_date'&&x.establishesApplicabilityStart!==false&&(!x.scope||x.scope==='subject')&&x.primaryEvidence!==false&&x.sourceIds?.length&&x.date);
 if(!milestones.length)return null;
 try{return{date:parseEvidenceDate(milestones.sort((a,b)=>firstInstant(a.date)-firstInstant(b.date))[0].date),basis:m==='rent'?'verified_occupancy':'verified_launch'};}catch{return null;}
}
function nativeCoverage(points,frequency,asOf){
 const names={monthly:'month',quarterly:'quarter',half_year:'half_year',annual:'year'},buckets=new Map(),starts=new Map();
 for(const o of points)if(o.date&&(o.frequency===frequency||(frequency==='annual'&&['yearly','year','FY'].includes(o.frequency)))){
  if(!buckets.has(o.period)){buckets.set(o.period,[]);starts.set(o.period,firstInstant(o.period));}buckets.get(o.period).push(o);
 }
 const periods=[...buckets.keys()].sort((a,b)=>starts.get(a)-starts.get(b));
 return periods.map(period=>{
  const matches=buckets.get(period),direct=matches.filter(o=>o.direct),eligible=direct.filter(o=>o.displayEligible),context=matches.filter(o=>!o.direct&&o.valid),sparse=direct.filter(o=>o.valid&&o.sparse),bad=direct.filter(o=>!o.valid);
  const status=eligible.length?'observed':sparse.length?'sparse':bad.length?'conflict':context.length?'context_only':'conflict';
  return{period,frequency,datePrecision:names[frequency],status,rawCount:matches.length,eligibleCount:eligible.length,contextCount:context.length,eligibleContextCount:context.filter(o=>o.displayEligible).length,sparseContextCount:context.filter(o=>o.sparse).length,sparseCount:sparse.length,completeAtCutoff:lastInstant(period)<=lastInstant(asOf),units:[...new Set(matches.map(o=>o.unit).filter(Boolean))]};
 });
}
function observationEvidence(record,{asOf,sources=[],minimumSample=20}={}){
 const raw=expandRecordObservations(record),dedup=deduplicateObservations(raw),sourceIndex=new Map(sources.map(s=>[s.id,s]));
 return{raw,dedup,validated:dedup.retained.map(o=>validateObservation(o,record,{asOf,sources,minimumSample,sourceIndex}))};
}
export function monthlyCoverage(record,options={}){return coverageFromEvidence(record,options,observationEvidence(record,options));}
function coverageFromEvidence(record,{asOf,sources=[],manifest={},minimumSample=20}={}, {raw,dedup,validated}){
 const earliest=raw.flatMap(o=>{try{return[monthIndex(o.period)];}catch{return[];}}),declaredStarts=(record.historySeries||[]).flatMap(s=>{const p=s.periodCoverage?.start||s.periodCoverage?.first||s.periodCoverage?.firstPeriod;try{return p?[monthIndex(p)]:[];}catch{return[];}});
 const explicit=record.historyStartPeriod||record.coverageWindow?.start,global=manifest.historyWindow?.start;
 const lifecycleStarts=(record.lifecycle||[]).flatMap(m=>{if(m.status!=='verified'||m.scope!=='subject'||m.primaryEvidence!==true||m.eventStatus==='planned'||!m.date||m.kind.startsWith('target_')||m.kind.startsWith('phase_'))return[];try{return firstInstant(m.date)<=lastInstant(asOf)?[monthIndex(m.date)]:[];}catch{return[];}});
 const knownStarts=[...earliest,...declaredStarts,...lifecycleStarts],candidateStart=explicit?monthIndex(explicit):global?monthIndex(global):knownStarts.length?Math.min(...knownStarts):lastCompleteMonth(asOf);
 const end=lastCompleteMonth(asOf),currentOnly=!explicit&&!global&&candidateStart>end,start=currentOnly?end:candidateStart,metrics={};
 if(start>end||end-start>2400)throw new RangeError('Historical coverage window must contain at most 200 years and no future start.');
 for(const m of METRICS){
  let applicability=applicableStart(record,m);
  const points=validated.filter(o=>o.metric===m),periods=[],monthly=new Map();
  if(applicability&&points.some(o=>o.direct&&o.valid&&o.date&&firstInstant(o.date)<firstInstant(applicability.date)))applicability=null;
  for(const o of points)if(o.frequency==='monthly'){if(!monthly.has(o.period))monthly.set(o.period,[]);monthly.get(o.period).push(o);}
  for(let i=start;i<=end;i++){
   const period=monthText(i),matching=monthly.get(period)||[],direct=matching.filter(o=>o.direct),context=matching.filter(o=>!o.direct&&o.valid),eligible=direct.filter(o=>o.displayEligible),sparse=direct.filter(o=>o.valid&&o.sparse),bad=direct.filter(o=>!o.valid);
   let status='missing',reason='No verified subject observation in this native month.';
   if(applicability&&Date.parse(monthEnd(+period.slice(0,4),+period.slice(5,7))+'T23:59:59.999Z')<firstInstant(applicability.date)){status='not_applicable';reason=`Before ${applicability.basis}; underlying land/area context remains separate.`;}
   else if(eligible.length){status='observed';reason='Verified subject evidence in the native month.';}
   else if(sparse.length){status='sparse';reason='Subject rows retained; aggregate sample gate fails.';}
   else if(bad.length){status='conflict';reason='Subject evidence needs identity, source or quality reconciliation.';}
   else if(context.length){status='context_only';reason='Area/published context exists; it is not subject transaction history.';}
   else if(record.historyAccess?.[m]?.status==='inaccessible'){status='inaccessible';reason=record.historyAccess[m].reason||'Applicable source access has not been obtained.';}
   else if(!applicability&&i<(earliest.length?Math.min(...earliest):end+1)){status='unknown';reason='Subject launch/applicability and earlier observation availability are not verified.';}
   periods.push({period,status,rawCount:matching.length,eligibleCount:eligible.length,contextCount:context.length,sparseCount:sparse.length,reason});
  }
  const statusCounts=Object.fromEntries(['observed','sparse','context_only','missing','not_applicable','conflict','unknown','inaccessible'].map(s=>[s,periods.filter(p=>p.status===s).length]));
  metrics[m]={unit:[...new Set(points.map(o=>o.unit).filter(Boolean))],firstApplicablePeriod:applicability?.date.start.slice(0,7)||null,applicabilityBasis:applicability?.basis||'not_verified',subjectApplicabilityKnown:!!applicability,lastCompletePeriod:monthText(end),statusCounts,periods,nativePeriods:Object.fromEntries(['monthly','quarterly','half_year','annual'].map(f=>[f,nativeCoverage(points,f,asOf)])),nonMonthlyObservationCount:points.filter(o=>o.frequency!=='monthly').length,storedNativePoints:points.length,scope:'subject monthly coverage; quarterly and annual context is retained without monthly resampling'};
 }
 const union=status=>Array.from({length:end-start+1},(_,i)=>METRICS.some(m=>metrics[m].periods[i].status===status)).filter(Boolean).length;
 const history=record.historySeries||[],collection={storedSeries:history.length,declaredNativePointCount:history.reduce((n,s)=>n+(s.pointCount??s.points?.length??0),0),loadedNativePointCount:history.reduce((n,s)=>n+(s.points?.length||0),0),completeLoadedSeries:history.filter(s=>s.partitionLoaded||(!s.partition&&s.points?.length===(s.pointCount??s.points?.length))).length,partialOrUnavailableSeries:history.filter(s=>s.partition&&!s.partitionLoaded).length,availabilityStates:[...new Set(history.map(s=>s.availability||'not_declared'))],note:'Full source collection and points currently loaded by this API are distinct.'};
 return{window:{start:monthText(start),end:monthText(end),basis:explicit?'record_declared_window':global?'source_collection_window_not_subject_launch':currentOnly?'last_complete_month; earliest retained observations are in a current/incomplete month':'earliest_retained_observation_or_last_complete_month'},metrics,collection,summary:{totalMonths:end-start+1,directObservedMonths:union('observed'),contextMonths:union('context_only'),sparseMonths:union('sparse'),missingMonths:union('missing'),unknownMonths:union('unknown'),conflictMonths:union('conflict'),inaccessibleMonths:union('inaccessible'),notApplicableMonths:union('not_applicable'),rawObservationCount:raw.length,duplicateRows:dedup.duplicates.length,conflictingRows:dedup.conflicts.length,storedSeriesCount:history.length},scope:'Period accountability is distinct from complete financial observation coverage.',originalHistoryPreserved:true};
}
function quantile(values,p){const a=values.slice().sort((a,b)=>a-b),i=(a.length-1)*p;return a[Math.floor(i)]+(a[Math.ceil(i)]-a[Math.floor(i)])*(i%1);}
/** Bands are fitted solely on training-fold values; publisher full-year flags are not reused. */
export function filterTrainingFold(observations,{asOf,sources=[],lowerQuantile=.01,upperQuantile=.99}={}){
 if(!finite(lowerQuantile)||!finite(upperQuantile)||lowerQuantile<0||upperQuantile>1||lowerQuantile>=upperQuantile)throw new TypeError('Invalid fold quantiles.');
 const eligible=[],withheld=[],byId=new Map(sources.map(s=>[s.id,s]));
 for(const raw of observations||[]){
  const o=clone(raw);let complete=false;try{complete=lastInstant(o.period)<=lastInstant(asOf);}catch{}
  const ownerMismatch=o.subjectRecordId&&o.subjectRecordId!==o.recordId,unprovenSeries=o.fromHistorySeries&&(!o.subjectRecordId||!Array.isArray(o.identitySourceIds)||!o.identitySourceIds.length||o.identitySourceIds.some(id=>!byId.has(id))||o.scope!==o.seriesScope||o.identityVerified!==o.seriesIdentityVerified);
  if(!complete||!observationAvailableAsOf(o,asOf,byId)||!finite(o.value)||o.value<=0||o.identityVerified!==true||o.scope!=='subject'||ownerMismatch||unprovenSeries||o.duplicateConflict||(Number.isInteger(o.qualityFlags)&&(o.qualityFlags&~4)!==0))withheld.push({observation:o,reason:'Origin availability, period, identity proof availability or non-outlier quality gate failed.'});
  else eligible.push(o);
 }
 const dedup=deduplicateObservations(eligible),groups=new Map();
 for(const o of dedup.retained){const key=[o.sourceId,o.recordId,o.metric,o.unit,o.segment,o.registration,o.period?.slice(0,4)].join('|');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(o);}
 const retained=[],bands=[];
 for(const [group,rows] of groups){const values=rows.map(o=>o.value),low=quantile(values,lowerQuantile),high=quantile(values,upperQuantile);bands.push({group,low,high,trainingRows:rows.length});
  for(const o of rows){if(o.duplicateConflict||o.value<low||o.value>high)withheld.push({observation:o,reason:o.duplicateConflict?'Conflicting fold source revision.':'Outside training-fold-only outlier band.'});else retained.push(o);}
 }
 return{asOf,retained,withheld,duplicates:dedup.duplicates,bands,policy:'Full-calendar-year publisher PSF_OUTLIER bit is ignored; other publisher flags remain blocking. Fit preprocessing within each training origin.',historicalVintage:'Latest stored source vintage; not contemporaneous replay unless dated vintages are supplied.'};
}
function nativeIndex(period,frequency){const d=parseEvidenceDate(period),y=+d.start.slice(0,4),m=+d.start.slice(5,7);return frequency==='annual'?y:frequency==='half_year'?y*2+Math.floor((m-1)/6):frequency==='quarterly'?y*4+Math.floor((m-1)/3):y*12+m-1;}
function nativeText(i,frequency){return frequency==='annual'?String(i):frequency==='half_year'?`${Math.floor(i/2)}H${i%2+1}`:frequency==='quarterly'?`${Math.floor(i/4)}Q${i%4+1}`:monthText(i);}
function emptyStudy(reason,extra={}){return{classification:'descriptive_association',causalAttribution:false,status:'insufficient_evidence',observedChangePct:null,reason,...extra};}
/** Twelve months either side, no resampling, no automatic causal attribution. */
export function eventStudy(record,event,{metric:selected='price',frequency='monthly',scope='subject',seriesId=null,asOf,sources=[],minimumSample=20,exposures=[]}={}){
 if(!METRICS.includes(selected)||!['monthly','quarterly','half_year','annual'].includes(frequency)||!['subject','area_context','community_context','published_reference','asking_benchmark'].includes(scope))throw new TypeError('Unsupported study metric, native frequency or evidence scope.');
 let when;try{when=parseEvidenceDate(event.eventDate||event.effectiveFrom||event.date);}catch{return emptyStudy('Event occurrence date is missing or invalid.',{metric:selected,frequency});}
 const windowCount=frequency==='annual'?1:frequency==='half_year'?2:frequency==='quarterly'?4:12,anchor=nativeIndex(when.start,frequency),eventPeriod=nativeText(anchor,frequency),base={metric:selected,frequency,scope,seriesId,subjectEvidence:scope==='subject',eventPeriod,eventDate:when,windowMonths:12,attributionGate:'A news timeline and before/after change alone do not establish causation.'};
 if((frequency==='monthly'&&!['day','instant','month'].includes(when.precision))||(frequency==='quarterly'&&!['day','instant','month','quarter'].includes(when.precision)))return emptyStudy('Event date precision is too coarse for the selected native event window.',base);
 const source=sources.find(s=>s.id===event.sourceIds?.[0]);
 if(!isAvailableAsOf(event,asOf,source)||eligibleFeaturesAsOf([event],{asOf,sources}).eligible.length!==1)return emptyStudy('Event publication/availability or supporting source availability is unknown or after the study cutoff.',base);
 const sourceIndex=new Map(sources.map(s=>[s.id,s])),raw=deduplicateObservations(expandRecordObservations(record)).retained,rows=raw.map(o=>validateObservation(o,record,{asOf,sources,minimumSample,sourceIndex})).filter(o=>o.metric===selected&&o.frequency===frequency&&o.displayEligible&&o.scope===scope&&(!seriesId||o.seriesId===seriesId)&&o.availability==='known_as_of');
 const signatures=[...new Set(rows.map(o=>[o.unit,o.sourceId,o.seriesId||'',o.segment||'',o.registration||''].join('|')))];
 if(signatures.length>1)return emptyStudy('Multiple incompatible subject baskets are present; select a single comparable series before estimating an association.',base);
 function window(start,end){const expected=Array.from({length:end-start+1},(_,i)=>nativeText(start+i,frequency)),points=expected.map(period=>{const matching=rows.filter(o=>nativeIndex(o.period,frequency)===nativeIndex(period,frequency));return{period,sourcePeriod:matching.length===1?matching[0].period:null,value:matching.length===1?matching[0].value:null,sampleCount:matching.length===1?matching[0].sampleCount:null,status:matching.length===1?'observed':matching.length>1?'conflict':'missing'};});return{from:expected[0],to:expected.at(-1),expectedPeriods:expected.length,observedPeriods:points.filter(p=>p.status==='observed').length,points};}
 const preWindow=window(anchor-windowCount,anchor-1),postWindow=window(anchor+1,anchor+windowCount),result={...base,preWindow,postWindow,unit:rows[0]?.unit||null,excludedEventPeriod:true};
 if(preWindow.observedPeriods!==windowCount||postWindow.observedPeriods!==windowCount)return emptyStudy('Complete matched subject evidence for twelve months before and after the event is unavailable; gaps and partial post-event windows are not filled.',result);
 const exposure=exposures.find(x=>x.recordId===record.id&&x.eventId===event.id);
 if(!exposure||exposure.scope==='unverified')return emptyStudy('Event-to-record exposure has not been established.',result);
 const pre=preWindow.points.reduce((n,p)=>n+p.value,0)/windowCount,post=postWindow.points.reduce((n,p)=>n+p.value,0)/windowCount;
 return{...result,classification:scope==='subject'?'descriptive_association':'descriptive_context_association',status:'descriptive_association',causalAttribution:false,observedChangePct:pre>0?100*(post/pre-1):null,preMean:pre,postMean:post,exposureScope:exposure.scope,contextGeography:scope==='subject'?null:rows[0]?.geography||null,reason:'Descriptive before/after mean change in one native evidence basket; no causal uplift or subject-history promotion inferred.',limitations:['Transaction mix, simultaneous shocks, supply and anticipation can explain changes.','No control group, counterfactual or significance claim is provided.','Latest-vintage historical data may include later revisions.',...(scope!=='subject'?['This is area/published context, not project-specific price performance.']:[]),...(frequency==='annual'?['Annual windows contain only one native observation each; no statistical significance is inferred.']:[])]};
}
const ASSUMPTION_KEYS=['priceAED','annualRentAED','occupancyYear','annualPriceGrowthPct','annualRentGrowthPct','vacancyPct','annualOperatingCostsAED','acquisitionCostsPct','disposalCostsPct','annualInputs'];
export function validateScenarioAssumptions(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Scenario assumptions must be an object.');
 for(const key of Object.keys(input))if(!ASSUMPTION_KEYS.includes(key))throw new TypeError(`Unknown scenario assumption: ${key}`);
 for(const key of ['priceAED','annualRentAED','annualOperatingCostsAED'])if(own(input,key)&&(!finite(input[key])||input[key]<0||(key==='priceAED'&&input[key]===0)))throw new TypeError(`${key} must be a ${key==='priceAED'?'positive':'non-negative'} finite amount.`);
 for(const key of ['vacancyPct','acquisitionCostsPct','disposalCostsPct'])if(own(input,key)&&(!finite(input[key])||input[key]<0||input[key]>100))throw new TypeError(`${key} must be between 0 and 100.`);
 if(own(input,'occupancyYear')&&(!Number.isInteger(input.occupancyYear)||input.occupancyYear<1900||input.occupancyYear>2100))throw new TypeError('occupancyYear must be a year from 1900 to 2100.');
 for(const key of ['annualPriceGrowthPct','annualRentGrowthPct'])if(own(input,key)){
  const growth=input[key];if(!growth||typeof growth!=='object'||Object.keys(growth).some(k=>!CASES.includes(k)))throw new TypeError(`${key} requires downside/base/upside cases.`);
  for(const c of CASES)if(!finite(growth[c])||growth[c]<=-100||growth[c]>100)throw new TypeError(`${key}.${c} must be greater than -100 and at most 100.`);
  if(!(growth.downside<=growth.base&&growth.base<=growth.upside))throw new TypeError(`${key} cases must be ordered downside <= base <= upside.`);
 }
 if(own(input,'annualInputs')){
  if(!input.annualInputs||typeof input.annualInputs!=='object'||Array.isArray(input.annualInputs)||Object.keys(input.annualInputs).some(k=>![...CASES,'common'].includes(k)))throw new TypeError('annualInputs must contain common/downside/base/upside arrays.');
  const allowed=['year','priceGrowthPct','rentGrowthPct','inflationPct','vacancyPct','operatingCostsAED','supplyGrowthPct','migrationGrowthPct','ratePct','deliveryDelayYears'];
  for(const [name,rows] of Object.entries(input.annualInputs)){
   if(!Array.isArray(rows)||rows.length>54||new Set(rows.map(r=>r?.year)).size!==rows.length)throw new TypeError(`annualInputs.${name} requires unique target years.`);
   for(const row of rows){
    if(!row||typeof row!=='object'||Object.keys(row).some(k=>!allowed.includes(k))||!TARGET_YEARS.includes(row.year))throw new TypeError('Annual inputs require years 2027–2080 and supported fields.');
    for(const [key,value] of Object.entries(row))if(key!=='year'){
     if(!finite(value))throw new TypeError(`${key} must be finite.`);
     if(['priceGrowthPct','rentGrowthPct','inflationPct','supplyGrowthPct','migrationGrowthPct'].includes(key)&&(value<=-100||value>100))throw new TypeError(`${key} must be greater than -100 and at most 100.`);
     if(['vacancyPct','ratePct'].includes(key)&&(value<0||value>100))throw new TypeError(`${key} must be between 0 and 100.`);
     if(key==='operatingCostsAED'&&value<0)throw new TypeError('Annual operating costs must be non-negative.');
     if(key==='deliveryDelayYears'&&(!Number.isInteger(value)||value<0||value>54))throw new TypeError('Delivery delay requires 0–54 whole years.');
    }
   }
  }
 }
 return clone(input);
}
function eligibleAnchor(anchor,record,sources,asOf){
 if(anchor?.recordLinkReview?.status==='rejected'||/conflict|quarantin|unverified|invalid/i.test([anchor?.qualityStatus,anchor?.status].filter(Boolean).join(' ')))return false;
 if(!anchor||!finite(anchor.value)||anchor.value<=0||!anchor.unit||!anchor.period||anchor.scope!=='subject'||anchor.identityVerified!==true)return false;
 if(anchor.recordId&&anchor.recordId!==record.id)return false;
 const source=sources.find(s=>s.id===anchor.sourceId);if(!source)return false;
 try{return lastInstant(anchor.period)<=lastInstant(asOf)&&observationAvailableAsOf(anchor,asOf,new Map(sources.map(s=>[s.id,s])));}catch{return false;}
}
function unavailableSlots(reason){return TARGET_YEARS.map(year=>({year,value:null,status:'unavailable',reason}));}
/** Calendar 2027–2080 conditional outputs; missing inputs remain null for every slot. */
export function annualScenarios(record,{asOf,sources=[],userAssumptions=null}={}){
 const input=record.scenarioInputs||{},provided=userAssumptions!==null,assumptions=validateScenarioAssumptions(provided?userAssumptions:input.assumptions||{}),priceAnchor=input.priceAnchor,rentAnchor=input.rentAnchor;
 const price=provided?assumptions.priceAED:eligibleAnchor(priceAnchor,record,sources,asOf)&&priceAnchor.unit==='AED'?priceAnchor.value:undefined;
 const rent=provided?assumptions.annualRentAED:eligibleAnchor(rentAnchor,record,sources,asOf)&&['AED/year','AED per year'].includes(rentAnchor.unit)?rentAnchor.value:undefined;
 function anchorYearOf(anchor){try{return anchor?.period?+parseEvidenceDate(anchor.period).end.slice(0,4):2026;}catch{return 2026;}}
 const anchorYear=provided?2026:anchorYearOf(priceAnchor),rentYear=provided?2026:anchorYearOf(rentAnchor);
 const occupancyYear=own(assumptions,'occupancyYear')?assumptions.occupancyYear:input.occupancyYear;
 const metrics={price:{unit:'AED',paths:{}},rent:{unit:'AED/year',paths:{}},netROI:{unit:'%',paths:{}}};
 const priceReady=finite(price)&&price>0&&anchorYear<=2026;
 const rentReady=finite(rent)&&rent>=0&&Number.isInteger(occupancyYear)&&rentYear===2026;
 const roiReady=priceReady&&rentReady&&anchorYear===2026&&rentYear===2026&&['acquisitionCostsPct','disposalCostsPct'].every(k=>own(assumptions,k));
 for(const c of CASES){
  const yearly=new Map((assumptions.annualInputs?.common||[]).map(row=>[row.year,row]));
  for(const row of assumptions.annualInputs?.[c]||[])yearly.set(row.year,{...(yearly.get(row.year)||{}),...row});
  const annual=[];let capital=priceReady?price:null,currentRent=rentReady?rent:null,inflationIndex=1,occupied=rentReady&&occupancyYear<=2026,firstIncomeYear=occupied?2026:null,accumulated=0,realAccumulated=0;
  if(priceReady&&anchorYear<2026){capital=finite(assumptions.annualPriceGrowthPct?.[c])?price*(1+assumptions.annualPriceGrowthPct[c]/100)**(2026-anchorYear):null;}
  const outlay=roiReady?price*(1+assumptions.acquisitionCostsPct/100):null;
  metrics.price.paths[c]=[];metrics.rent.paths[c]=[];metrics.netROI.paths[c]=[];
  for(const year of TARGET_YEARS){
   const row=yearly.get(year)||{},priceGrowth=row.priceGrowthPct??assumptions.annualPriceGrowthPct?.[c],rentGrowth=row.rentGrowthPct??assumptions.annualRentGrowthPct?.[c],vacancy=row.vacancyPct??assumptions.vacancyPct,cost=row.operatingCostsAED??assumptions.annualOperatingCostsAED,delay=row.deliveryDelayYears??0;
   const inflation=row.inflationPct;
   inflationIndex=finite(inflation)&&finite(inflationIndex)?inflationIndex*(1+inflation/100):null;
   capital=finite(capital)&&finite(priceGrowth)?capital*(1+priceGrowth/100):null;
   const couldOccupy=rentReady&&year>=occupancyYear+delay;
   if(!occupied&&couldOccupy){occupied=true;firstIncomeYear=year;}
   let scheduled=null;
   if(rentReady&&!occupied)scheduled=0;
   else if(rentReady){
    if(year>firstIncomeYear)currentRent=finite(currentRent)&&finite(rentGrowth)?currentRent*(1+rentGrowth/100):null;
    scheduled=currentRent;
   }
   const status=provided?'user_assumption':'conditional',realCapital=finite(capital)&&finite(inflationIndex)&&inflationIndex>0?capital/inflationIndex:null,realRent=finite(scheduled)&&finite(inflationIndex)&&inflationIndex>0?scheduled/inflationIndex:null;
   metrics.price.paths[c].push({year,value:capital,realValue:realCapital,inflationIndex,status:finite(capital)?status:'unavailable',reason:finite(capital)?null:'Verified/user capital anchor or explicit growth for an intervening year is missing.'});
   metrics.rent.paths[c].push({year,value:scheduled,realValue:realRent,assumedOccupancyYear:firstIncomeYear,status:scheduled===0&&!occupied?'pre_occupancy':finite(scheduled)?status:'unavailable',reason:scheduled===0&&!occupied?'No rental income before assumed occupancy, including explicit delivery delays.':finite(scheduled)?null:rentYear<2026&&!provided?'An older rental anchor requires explicit dated rebasing to 2026; future annual inputs do not supply missing historical rent growth.':'Rent anchor, occupancy or intervening annual growth is missing.'});
   const flowReady=roiReady&&finite(scheduled)&&finite(vacancy)&&finite(cost)&&finite(capital)&&finite(accumulated);
   let roi=null,realROI=null;
   if(flowReady){const flow=scheduled*(1-vacancy/100)-cost;accumulated+=flow;const disposal=capital*(1-assumptions.disposalCostsPct/100);roi=100*(accumulated+disposal-outlay)/outlay;
    if(finite(realAccumulated)&&finite(inflationIndex)&&inflationIndex>0){realAccumulated+=flow/inflationIndex;realROI=100*(realAccumulated+disposal/inflationIndex-outlay)/outlay;}else realAccumulated=null;
   }else{accumulated=null;realAccumulated=null;}
   metrics.netROI.paths[c].push({year,value:roi,realValue:realROI,status:finite(roi)?status:'unavailable',reason:finite(roi)?null:'2026 capital/rent basis and explicit vacancy/acquisition/annual operating/disposal inputs are required for every holding year.'});
   annual.push({year,priceGrowthPct:priceGrowth??null,rentGrowthPct:rentGrowth??null,inflationPct:inflation??null,vacancyPct:vacancy??null,operatingCostsAED:cost??null,deliveryDelayYears:delay,supplyGrowthPct:row.supplyGrowthPct??null,migrationGrowthPct:row.migrationGrowthPct??null,ratePct:row.ratePct??null,inputBasis:yearly.has(year)?'explicit_annual_override_with_disclosed_scalar_fallbacks':'explicit_scalar_assumptions',unmodelledMacroMechanisms:['Supply, migration and rates are context assumptions; no fitted coefficients or automatic price adjustments are applied.']});
  }
  metrics[c+'AnnualInputs']=annual;
 }
 const appliedAnnualInputs=Object.fromEntries(CASES.map(c=>{const rows=metrics[c+'AnnualInputs'];delete metrics[c+'AnnualInputs'];return[c,rows];}));
 for(const m of Object.values(metrics))for(const path of Object.values(m.paths))for(const point of path)if(point.value!==null&&!finite(point.value)){point.value=null;point.realValue=null;point.status='unavailable';point.reason='Assumed path exceeds finite numeric range.';}
 return{classification:provided?'user_assumption_scenario':'conditional_scenario',targetYears:[...TARGET_YEARS],baselineYear:2026,metrics,assumptions,appliedAnnualInputs,annualInputPolicy:'Explicit annual rows may override disclosed scalar inputs. Missing growth breaks the linked value path; missing inflation prevents real outputs; missing costs prevent net return. Macro context has no automatic coefficient.',validatedForecast:false,causalPriceUplift:false,originalCoverageUnchanged:true,anchorScope:provided?'user_inputs_not_observations':'verified_subject_anchors_required',priceAnchor:provided?null:priceAnchor||null,rentAnchor:provided?null:rentAnchor||null,netReturnDefinition:'Cumulative nominal/real all-cash holding-period total return after explicit vacancy, acquisition, annual operating and disposal costs; before tax. Not an annual yield or IRR.',formulas:{price:'Prior annual value * (1 + explicit annual price growth / 100)',rent:'0 before occupancy and stated delays; annual rent at first income year, growth from following year',realValue:'Nominal value / cumulative explicitly supplied inflation index from 2026',netROI:'100 * (accumulated collected rent less operating costs + net disposal value - initial outlay) / initial outlay'},limitations:['Scenario rates are explicit assumptions, not calibrated event effects or probabilities.','No financing, staged payment, tax or unit-specific valuation model is asserted.','News and infrastructure do not mechanically add price growth.','Supply, migration and rates remain unmodelled context unless an independently evaluated model supplies coefficients.','Scenario availability is not historical or validated forecast coverage.']};
}
/** Compact rules are contextual exposures, never independent event observations. */
export function recordExposures(data,record){
 const explicit=(data.exposures||[]).filter(x=>x.recordId===record.id),seen=new Set(explicit.map(x=>x.eventId));
 for(const rule of data.exposureRules||[]){
  if(seen.has(rule.eventId)||rule.appliesTo&&rule.appliesTo!==record.type)continue;
  if(rule.emirates?.length&&!rule.emirates.includes(record.emirate))continue;
  if(!['national','emirate','regional'].includes(rule.scope))continue;
  explicit.push({...clone(rule),recordId:record.id,derivedFromRule:true,existenceAtEvent:rule.existenceAtEvent||'research_pending',priceUpliftPct:null});seen.add(rule.eventId);
 }
 return explicit;
}
export function relevantSources(data,record,events=[],exposures=[]){
 const ids=new Set();
 function visit(value){
  if(!value||typeof value!=='object')return;
  if(Array.isArray(value)){for(const v of value)visit(v);return;}
  if(value.sourceId)ids.add(value.sourceId);for(const id of [...(value.sourceIds||[]),...(value.identitySourceIds||[])])ids.add(id);
  for(const [key,v] of Object.entries(value))if(!['native','points'].includes(key)&&v&&typeof v==='object')visit(v);
 }
 visit(record);visit(events);visit(exposures);
 return(data.sources||[]).filter(s=>ids.has(s.id)).map(s=>clone(s));
}
/** Share native community context without duplicating it or promoting subject prices. */
export function resolveRecordCommunityHistory(data,record){
 if(record.type!=='project'||!record.sharedCommunityHistoryId||record.sharedCommunityHistoryId!==record.communityId)return record;
 const community=(data.records||[]).find(r=>r.id===record.sharedCommunityHistoryId&&r.type==='community'&&r.emirate===record.emirate);
 if(!community)return record;
 const original=record.historySeries||[],ids=new Set(original.map(s=>s.id));
 const context=(community.historySeries||[]).filter(s=>s.scope==='community_context'&&s.identityVerified===false&&!ids.has(s.id)).map(s=>({...s,contextCommunityId:community.id,linkBasis:'Catalogue community membership; native official master-project context. Project existence at earlier dates is unverified.'}));
 return{...record,historySeries:[...original,...context]};
}
export function recordHistory(data,record,{userAssumptions=null}={}){
 record=resolveRecordCommunityHistory(data,record);
 const exposures=recordExposures(data,record),eventIds=new Set(exposures.map(x=>x.eventId)),events=(data.events||[]).filter(e=>eventIds.has(e.id));
 const options={asOf:data.asOf,sources:data.sources||[],manifest:data.manifest||{}},evidence=observationEvidence(record,options);
 return{version:data.version,asOf:data.asOf,record:clone(record),observations:clone(record.observations||[]),validatedObservations:evidence.validated,historySeries:clone(record.historySeries||[]),coverage:coverageFromEvidence(record,options,evidence),scenarios:annualScenarios(record,{asOf:data.asOf,sources:data.sources||[],userAssumptions}),events:clone(events),exposures:clone(exposures),sources:relevantSources(data,record,events,exposures),manifest:clone(data.manifest||{})};
}
