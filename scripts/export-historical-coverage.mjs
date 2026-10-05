import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {monthlyCoverage, expandRecordObservations, validateObservation, recordExposures, parseEvidenceDate,resolveRecordCommunityHistory} from '../src/historical-intelligence/core.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2), option=name=>args.includes(name)?args[args.indexOf(name)+1]:null;
const output=option('--output');
const itemOutput=option('--items-output');
if(!output)throw new Error('Provide --output /absolute/path/coverage.csv');
const bytes=await fs.readFile(path.join(root,'data/historical-intelligence-20261003.json'));
const data=JSON.parse(bytes), partitions=new Map(),sourceIndex=new Map(data.sources.map(s=>[s.id,s]));
const digest=x=>createHash('sha256').update(x).digest('hex');
for(const record of data.records)for(const series of record.historySeries||[]){
  if(partitions.has(series.partition.key))continue;
  const object=await fs.readFile(path.join(root,'data/historical-intelligence/objects',path.basename(series.partition.key)));
  if(digest(object)!==series.partition.sha256)throw new Error('Partition checksum failed');
  partitions.set(series.partition.key,JSON.parse(gunzipSync(object)));
}
const rows=[],itemRows=[];
const wholeMilestone=(record,kind)=>record.lifecycle.find(m=>m.kind===kind&&m.status==='verified'&&m.scope==='subject'&&m.primaryEvidence===true);
for(const savedRecord of data.records){
  const sourceRecord=resolveRecordCommunityHistory(data,savedRecord);
  const record={...sourceRecord,historySeries:sourceRecord.historySeries.map(pointer=>{
    const series=partitions.get(pointer.partition.key).series.find(s=>s.id===pointer.id);
    if(!series||series.points.length!==pointer.pointCount)throw new Error('Record series count mismatch');
    return {...pointer,...series,...(pointer.contextCommunityId?{contextCommunityId:pointer.contextCommunityId,linkBasis:pointer.linkBasis}:{}),partitionLoaded:true,availability:'verified_immutable_partition'};
  })};
  const coverage=monthlyCoverage(record,{asOf:data.asOf,sources:data.sources,manifest:data.manifest});
  const observations=expandRecordObservations(record).map(o=>validateObservation(o,record,{asOf:data.asOf,sources:data.sources,sourceIndex}));
  const contexts=observations.filter(o=>o.valid&&!o.direct&&o.metric!=='volume');
  const sorted=contexts.slice().sort((a,b)=>parseEvidenceDate(a.period).start.localeCompare(parseEvidenceDate(b.period).start));
  rows.push({record_id:record.id,type:record.type,name:record.name,emirate:record.emirate,
    subject_inception_verified:!!wholeMilestone(record,'launch'),subject_history_start:wholeMilestone(record,'launch')?.date?.start??null,earliest_retained_context_period:sorted[0]?.period||null,
    latest_retained_context_period:sorted.at(-1)?.period||null,
    accountability_window_start:coverage.window.start,accountability_window_end:coverage.window.end,
    accountability_window_basis:coverage.window.basis,native_context_series:record.historySeries.filter(s=>s.scope!=='subject').length,
    subject_history_series:record.historySeries.filter(s=>s.scope==='subject').length,
    native_context_rows:record.historySeries.filter(s=>s.scope!=='subject').reduce((n,s)=>n+s.points.length,0),
    eligible_context_financial_observations:contexts.filter(o=>o.displayEligible).length,
    sparse_context_financial_observations:contexts.filter(o=>o.sparse).length,
    approved_subject_price_observations:observations.filter(o=>o.direct&&o.valid&&o.metric==='price').length,
    approved_subject_rent_observations:observations.filter(o=>o.direct&&o.valid&&o.metric==='rent').length,
    subject_price_observed_months:coverage.metrics.price.statusCounts.observed,
    subject_rent_observed_months:coverage.metrics.rent.statusCounts.observed,
    price_applicability_known:coverage.metrics.price.subjectApplicabilityKnown,
    rent_applicability_known:coverage.metrics.rent.subjectApplicabilityKnown,
    reported_handover_targets:record.lifecycle.filter(m=>m.kind==='target_handover').length,
    sourced_lifecycle_milestones:record.lifecycle.filter(m=>m.identityBasis).length,
    sourced_financial_facts:record.observations.length,
    primary_register_facts:record.registerEvidence?.length??0,
    source_collection_status:record.researchStatus.sourceCollection?.status??'not_collected',
    verified_completion:!!wholeMilestone(record,'completion'),
    verified_occupancy:!!wholeMilestone(record,'occupancy'),
    reported_asking_price_aed:record.currentSnapshot.askingPriceAED,
    asking_quote_publication:record.currentSnapshot.publishedAt,
    current_freshness:record.currentSnapshot.freshness,
    quarantined_identity_candidates:record.researchStatus.identityCandidateCount,
    event_context_links:recordExposures(data,record).length,
    first_scenario_year:2027,last_scenario_year:2080,annual_slots_per_metric:54,
    approved_numeric_forecast_points:0,research_status:record.researchStatus.status,
    remaining_gaps:record.researchStatus.gaps.join('|')});
  const evidence=new Map([...record.lifecycle,...record.observations,...(record.registerEvidence??[]),...record.historySeries].map(x=>[x.id,x]));
  for(const [item,entry] of Object.entries(record.researchStatus.itemCoverage??{})){
    const dates=(entry.evidenceIds??[]).flatMap(id=>{
      const row=evidence.get(id);return row?.date?.start?[row.date.start]:row?.period?[row.period]:row?.points?.map(p=>p[0])??[];
    }).filter(Boolean).sort((a,b)=>parseEvidenceDate(a).start.localeCompare(parseEvidenceDate(b).start));
    itemRows.push({record_id:record.id,type:record.type,name:record.name,emirate:record.emirate,
      item,status:entry.status,reason:entry.reason,evidence_ids:(entry.evidenceIds??[]).join('|'),
      source_ids:(entry.sourceIds??[]).join('|'),source_urls:(entry.sourceIds??[]).map(id=>sourceIndex.get(id)?.url??'').filter(Boolean).join('|'),
      earliest_retained_native_date:dates[0]??null,latest_retained_native_date:dates.at(-1)??null,
      native_point_count:entry.nativePointCount??null,native_series_count:entry.nativeSeriesCount??null,
      complete_lifetime_history:entry.completeLifetimeHistory??false,
      primary_asking_quotes:entry.primaryQuoteCount??null,catalogue_mirror_quotes:entry.catalogueMirrorQuoteCount??null,
      original_audit_gaps:(record.researchStatus.originalAuditGaps??[]).join('|'),
      current_remaining_gaps:record.researchStatus.gaps.join('|'),
      source_collection_status:record.researchStatus.sourceCollection?.status??'not_collected',
      audited_as_of:record.researchStatus.itemCoverageAsOf??data.asOf});
  }
}
const fields=Object.keys(rows[0]), quote=x=>'"'+String(x??'').replaceAll('"','""')+'"';
await fs.mkdir(path.dirname(path.resolve(output)),{recursive:true});
await fs.writeFile(output,[fields.join(','),...rows.map(r=>fields.map(f=>quote(r[f])).join(','))].join('\n')+'\n');
if(itemOutput){
  if(!itemRows.length)throw new Error('Per-item ledger unavailable');
  const columns=Object.keys(itemRows[0]);
  await fs.mkdir(path.dirname(path.resolve(itemOutput)),{recursive:true});
  await fs.writeFile(itemOutput,[columns.join(','),...itemRows.map(row=>columns.map(key=>quote(row[key])).join(','))].join('\n')+'\n');
}
const summary={version:data.version,asOf:data.asOf,snapshotSHA256:digest(bytes),records:rows.length,
  projects:rows.filter(r=>r.type==='project').length,communities:rows.filter(r=>r.type==='community').length,
  contextLinkedRecords:rows.filter(r=>r.native_context_series>0).length,
  earliestContext:rows.map(r=>r.earliest_retained_context_period).filter(Boolean).sort()[0],
  approvedSubjectHistoryRecords:rows.filter(r=>r.approved_subject_price_observations>0||r.approved_subject_rent_observations>0).length,approved2080ForecastRecords:0,
  subjectSaleHistoryRecords:data.manifest.directSubjectSaleHistoryRecords,subjectRentHistoryRecords:data.manifest.directSubjectRentHistoryRecords,
  sourcedLifecycleRecords:data.records.filter(r=>r.lifecycle.some(m=>m.identityBasis)).length,
  freshlySourcedFinancialRecords:data.records.filter(r=>r.observations.length>0).length,
  scope:'Per-record accountability and shared context; row totals across records are not unique source observations. Unknown inception prevents certification of complete historical period coverage.',
  evidenceCounts:data.manifest.historicalObservationRows,sourceCount:data.sources.length,eventCount:data.events.length,
  auditedItemRows:itemRows.length,itemCoverage:Object.fromEntries([...new Set(itemRows.map(r=>r.item))].map(item=>[item,Object.fromEntries(['project','community'].map(type=>[type,Object.fromEntries(['present','partial','missing','unestablished'].map(status=>[status,itemRows.filter(r=>r.item===item&&r.type===type&&r.status===status).length]))]))]))};
await fs.writeFile(output.replace(/\.csv$/i,'.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary));
