"""Merge reviewed, source-backed enrichment; raw scraped pages stay outside the repo."""
import json, pathlib, csv, io, hashlib, collections, datetime, re, gzip
from copy import deepcopy
from historical_gap_ledger import refresh_research_coverage, period_start

def load_enrichment(base, sidecars=()):
 path=base/'scrape-enrichment.json'
 if not path.exists():return None
 packet=json.loads(path.read_text())
 if packet.get('schemaVersion')!=1:raise ValueError('Unsupported enrichment schema')
 for relative in sidecars:
  target=(base/relative).resolve()
  if target.parent!=base.resolve():raise ValueError('Enrichment sidecar must be a direct reviewed file under the history base')
  sidecar_bytes=target.read_bytes();supplement=json.loads(sidecar_bytes)
  if supplement.get('schemaVersion')!=1 or not supplement.get('passId') or not supplement.get('asOf'):
   raise ValueError('Unsupported enrichment sidecar schema or missing pass identity')
  if any(item.get('passId')==supplement['passId'] for item in packet.get('collection',{}).get('passes',[])):
   raise ValueError('Duplicate enrichment pass identity')
  # This reviewed pass keeps register snapshots and lifecycle milestones in
  # separate collections so their evidence classes remain explicit. Normalize
  # them into the canonical enrichment facts consumed by the reproducible build.
  if supplement.get('passId')=='dld-derived-project-register-20260901':
   for fact in supplement.get('facts',[]):
    fact.setdefault('kind','register');fact.setdefault('status','accepted')
   for item in supplement.get('lifecycleMilestones',[]):
    milestone=item['milestone']
    supplement.setdefault('facts',[]).append({
     'id':milestone['id'],'kind':'lifecycle','status':'accepted','recordId':item['recordId'],
     'sourceIds':milestone.get('sourceIds',[]),'firstAvailableAt':milestone.get('firstAvailableAt'),
     'publishedAt':milestone.get('publishedAt'),'identityBasis':milestone['identityBasis'],
     'identitySourceIds':milestone.get('identitySourceIds',[]),'identityVerified':milestone.get('identityVerified',False),'milestone':milestone['kind'],
     'date':milestone['date'],'verification':milestone.get('status','reported'),
     'scope':milestone.get('scope','subject'),'eventStatus':milestone.get('eventStatus','reported'),
     'primaryEvidence':milestone.get('primaryEvidence',False),'label':milestone['label'],
     'note':milestone.get('note'),'evidenceClass':milestone.get('evidenceClass'),
     'dateBasis':milestone.get('dateBasis'),'progressPercent':milestone.get('progressPercent'),'registerSnapshotMilestone':True,
    })
  for key in ['sources','facts','seriesLinks','historyInputs','licensedArchives','additionalDatasets','recordResearch','sourceCandidates']:
   packet.setdefault(key,[]).extend(supplement.get(key,[]))
  packet.setdefault('collection',{}).setdefault('passes',[]).append(supplement.get('collection',{}))
  packet.setdefault('supplementalPasses',[]).append({'passId':supplement['passId'],'asOf':supplement['asOf'],'path':relative,'sha256':hashlib.sha256(sidecar_bytes).hexdigest(),'bytes':len(sidecar_bytes)})
  packet['asOf']=max(packet['asOf'],supplement['asOf'])
  if supplement.get('methodology'):
   packet['methodology']=packet.get('methodology','').rstrip()+'\n\n'+supplement['methodology']
 for item in packet.get('historyInputs',[]):
  target=base/item['path']
  if target.resolve().parent!=base.resolve():raise ValueError('History input must be a direct public derived file')
  raw=target.read_bytes()
  if hashlib.sha256(raw).hexdigest()!=item['sha256']:raise ValueError('Enrichment CSV checksum mismatch')
  if item.get('compression')=='gzip':
   raw=gzip.decompress(raw)
   if item.get('uncompressedSHA256') and hashlib.sha256(raw).hexdigest()!=item['uncompressedSHA256']:raise ValueError('Uncompressed history checksum mismatch')
  item['rows']=list(csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))))
 return packet

def current_snapshot_eligible(obs):
 # Unit/bedroom-specific advertisements remain evidence but cannot replace
 # the project's headline starting-price snapshot.
 if 'currentSnapshotEligible' in obs and not isinstance(obs['currentSnapshotEligible'],bool):raise ValueError('currentSnapshotEligible must be boolean')
 if obs.get('currentSnapshotEligible') is False:return False
 segmented_keys=['bedrooms','bedroom','unitType','unit_type','unitSubtype','unit_subtype','floorplan','floorPlan']
 if any(str(obs.get(k,'')).strip() for k in segmented_keys):return False
 qualifier=' '.join(str(obs.get(k,'') or '') for k in ['quoteQualifier','sourceQuoteBasis']).lower()
 if re.search(r'\b(?:studio|\d+\s*(?:bed|bedroom|br)|bedroom-specific|unit-specific|floorplan)\b',qualifier):return False
 return True
def retain_published_quotes(records, retained, packet, asof):
 # A new research cutoff must not erase previously published quote vintages.
 if retained['asOf']>asof:raise ValueError('Retained quote snapshot is from the future')
 old={r['id']:r for r in retained['records']}
 if set(old)!={r['id'] for r in records}:raise ValueError('Retained quote catalogue differs')
 facts={(f.get('id') or hashlib.sha256(json.dumps(f,sort_keys=True).encode()).hexdigest()[:24]):f for f in packet.get('facts',[]) if f.get('status')=='accepted'}
 for record in records:
  previous=old[record['id']]
  vintages=deepcopy(previous.get('priorCurrentSnapshots',[]))
  current=previous['currentSnapshot']
  fact=facts.get(current.get('observationId'))
  eligible=not current.get('observationId') or (fact and fact.get('recordId')==record['id'] and current_snapshot_eligible(fact.get('observation',{})))
  if eligible:
   if record['currentSnapshot']!=current and record['currentSnapshot'] not in vintages:vintages.append(deepcopy(record['currentSnapshot']))
   record['currentSnapshot']=deepcopy(current)
  elif current not in vintages:vintages.append(deepcopy(current))
  if vintages:record['priorCurrentSnapshots']=vintages

def apply_enrichment(packet,records,series,sources,source,aliases,asof):
 if not packet:return {}
 if packet.get('asOf','')>asof:raise ValueError('Enrichment not yet available as of snapshot')
 known={r['id']:r for r in records}
 for item in packet.get('sources',[]):
  if not str(item.get('url','')).startswith('https://'):raise ValueError('Enrichment requires HTTPS source')
  if not item.get('retrievedAt') or item['retrievedAt'][:10]>asof:raise ValueError('Source retrieval after snapshot')
  if item.get('publishedAt') and item['publishedAt'][:10]>asof:raise ValueError('Source publication after snapshot')
  source(item)
 def sid(identifier):
  identifier=aliases.get(identifier,identifier)
  if identifier not in sources:raise ValueError('Enrichment orphan source '+str(identifier))
  return identifier
 counters=collections.Counter(); seen=set();subject_owner={}
 for link in packet.get('seriesLinks',[]):
  record=known.get(link['recordId']); full=series.get(link['seriesId'])
  if not record or not full:raise ValueError('Enrichment orphan record/series')
  identity=link.get('identityVerified') is True;scope=link.get('scope')
  if scope not in ['subject','area_context','community_context','published_reference','asking_benchmark']:raise ValueError('Bad link scope')
  if scope=='subject':
   if not identity or not link.get('identityBasis') or not link.get('identitySourceIds'):raise ValueError('Unproven subject identity')
   owner=subject_owner.setdefault(full['id'],record['id'])
   if owner!=record['id']:raise ValueError('Subject series identity fan-out')
   if full.get('identityVerified') is not True or full.get('scope')!='subject':raise ValueError('Subject partition descriptor disagrees with approved link')
  if any(s['id']==full['id'] for s in record['historySeries']):raise ValueError('Repeated record series link')
  small={k:v for k,v in full.items() if k!='points'}
  small.update({'points':[p[:-1]+[None] for p in full['points'][-3:]],'embeddedPointCount':min(len(full['points']),3),'availability':'partial_embedded_context','scope':scope,'identityVerified':identity,'linkBasis':link['identityBasis'],'identitySourceIds':[sid(x) for x in link.get('identitySourceIds',[])]})
  record['historySeries'].append(small);counters['seriesLinks']+=1
 for fact in packet.get('facts',[]):
  if fact.get('status')!='accepted':continue
  record=known.get(fact.get('recordId'))
  if not record:raise ValueError('Fact orphan record')
  ident=fact.get('id') or hashlib.sha256(json.dumps(fact,sort_keys=True).encode()).hexdigest()[:24]
  if ident in seen:raise ValueError('Duplicate enrichment fact')
  seen.add(ident);sourceids=[sid(x) for x in (fact.get('sourceIds') or [fact['sourceId']])]
  if not fact.get('identityBasis'):raise ValueError('Fact identity basis absent')
  available=fact.get('firstAvailableAt') or sources[sourceids[0]].get('firstAvailableAt') or sources[sourceids[0]]['retrievedAt']
  published=fact.get('publishedAt') or sources[sourceids[0]].get('publishedAt')
  if str(available)[:10]>asof or (published and str(published)[:10]>asof):raise ValueError('Fact availability/publication after snapshot')
  proofids=[sid(x) for x in fact.get('identitySourceIds',[])]
  common={'id':ident,'sourceIds':sourceids,'publishedAt':published,'firstAvailableAt':available,'retrievedAt':sources[sourceids[0]]['retrievedAt'],'identityBasis':fact['identityBasis'],'identitySourceIds':proofids}
  kind=fact['kind']
  if kind=='lifecycle':
   milestone=fact['milestone'];date=fact['date'];precision=date.get('precision') if isinstance(date,dict) else None
   if precision not in ['day','month','quarter','year','range']:raise ValueError('Lifecycle date precision absent')
   if (milestone in ['completion','occupancy'] or fact.get('eventStatus')=='actual') and period_start(date['start'])>asof:raise ValueError('Future actual lifecycle event')
   verification=fact.get('verification','reported')
   if verification=='verified' and not fact.get('primaryEvidence'):raise ValueError('Verified lifecycle requires primary evidence')
   lifecycle_row={**common,'kind':milestone,'date':date,'status':verification,'scope':fact.get('scope','published_reference'),'eventStatus':fact.get('eventStatus','planned' if milestone.startswith('target_') else 'reported'),'primaryEvidence':fact.get('primaryEvidence',False),'label':fact['label'],'note':fact.get('note'),'evidenceClass':fact.get('evidenceClass','source_reported_milestone')}
   if fact.get('registerSnapshotMilestone') or fact.get('preserveAdditionalLifecycleFields'):
    for optional in ['dateBasis','progressPercent','identityVerified']:
     if optional in fact:lifecycle_row[optional]=fact[optional]
   record['lifecycle'].append(lifecycle_row)
   counters['lifecycleFacts']+=1
  elif kind=='financial':
   scope=fact.get('scope');obs=fact['observation'];value=obs.get('value')
   if scope not in ['subject','area_context','community_context','published_reference','asking_benchmark']:raise ValueError('Financial scope missing or invalid')
   period=str(obs.get('period','')); match=re.fullmatch(r'(\d{4})-?Q([1-4])',period,re.I)
   start=f'{match[1]}-{(int(match[2])-1)*3+1:02d}-01' if match else period+'-01-01' if len(period)==4 else period+'-01' if len(period)==7 else period
   if start[:10]>asof:raise ValueError('Financial observation after snapshot')
   if not isinstance(value,(int,float)) or value<=0 or not obs.get('unit') or not obs.get('period'):raise ValueError('Invalid financial fact')
   if scope=='subject' and not (fact.get('identityVerified') is True and proofids):raise ValueError('Unproven subject financial fact')
   evidence_class=fact.get('evidenceClass')
   mirrored='tenant_mirror' in sources[sourceids[0]].get('classification','')
   if mirrored and evidence_class=='advertised_asking_price':evidence_class='catalogue_advertised_asking_quote'
   record['observations'].append({**common,**obs,'recordId':record['id'],'emirate':record['emirate'],'scope':scope,'identityVerified':fact.get('identityVerified',False),'sourceId':sourceids[0],'status':'source_observed','evidenceClass':evidence_class,'primaryEvidence':fact.get('primaryEvidence',False),'sourceEvidenceClass':sources[sourceids[0]].get('classification'),'independentUpstreamEvidence':not mirrored,'frequency':obs.get('frequency','daily')})
   incoming_rank=3 if fact.get('primaryEvidence') else 1 if mirrored else 2
   incoming_key=(incoming_rank,common['retrievedAt'],ident)
   current=record['currentSnapshot'];current_key=(current.get('sourceRank',0),current.get('retrievedAt',''),current.get('observationId',''))
   captured_quote_period=str(obs.get('period','')) in [asof,str(common['retrievedAt'])[:10]]
   if obs.get('observationKind')=='asking_quote' and current_snapshot_eligible(obs) and captured_quote_period and obs['unit']=='AED' and obs.get('metric')=='price' and incoming_key>current_key:
    previous=dict(record['currentSnapshot']);record.setdefault('priorCurrentSnapshots',[]).append(previous)
    record['currentSnapshot'].update({'askingPriceAED':value,'scope':'source_observed_asking_quote','sourceId':sourceids[0],'publishedAt':common['publishedAt'],'firstAvailableAt':available,'retrievedAt':common['retrievedAt'],'freshness':'advertisement captured on retrieval; current market validity unverified; publication date '+('known' if common['publishedAt'] else 'unknown'),'observationId':ident,'sourceRank':incoming_rank,'selectionReason':'Preferred by primary evidence, external source, tenant mirror, then capture time and stable observation ID; all other quotes retained','quoteQualifier':obs.get('quoteQualifier'),'sourceQuoteBasis':obs.get('sourceQuoteBasis'),'sourceEvidenceClass':sources[sourceids[0]].get('classification'),'independentUpstreamEvidence':not mirrored})
   counters['financialFacts']+=1
  elif kind=='community_association':
   previous=fact.get('fromCommunityId');target=known.get(fact.get('toCommunityId'))
   if record.get('communityId')!=previous or not target or target.get('type')!='community' or target.get('emirate')!=record.get('emirate'):raise ValueError('Community correction does not match exact existing association and emirate')
   if not fact.get('primaryEvidence') or fact.get('verification')!='verified' or not proofids:raise ValueError('Community correction requires reviewed primary identity evidence')
   affected=fact.get('rejectedSeriesIds',[]);linked={s['id']:s for s in record['historySeries']}
   if len(affected)!=len(set(affected)) or any(x not in linked or linked[x].get('scope')=='subject' for x in affected):raise ValueError('Community correction cannot reject absent or subject series')
   revision={**common,'fromCommunityId':previous,'toCommunityId':target['id'],'fromSharedCommunityHistoryId':record.get('sharedCommunityHistoryId',previous),'verification':'verified','primaryEvidence':True,'label':fact['label'],'reason':fact['reason'],'rejectedSeriesIds':affected}
   record.setdefault('communityAssociationRevisions',[]).append(revision);record['communityId']=target['id']
   for ident in affected:linked[ident]['recordLinkReview']={'status':'rejected','reason':fact['reason'],'sourceIds':sourceids,'revisionId':revision['id'],'firstAvailableAt':available}
   counters['communityAssociationCorrections']+=1
  elif kind=='register':
   record.setdefault('registerEvidence',[]).append({**common,'fields':fact['fields'],'classification':fact.get('evidenceClass','published_register_snapshot'),'registeredProjectId':fact.get('registeredProjectId'),'scope':fact.get('scope','published_reference'),'identityVerified':fact.get('identityVerified',False)})
   counters['registerFacts']+=1
  else:raise ValueError('Unsupported enrichment fact '+kind)
  counters['acceptedFacts']+=1
 for status in packet.get('recordResearch',[]):
  if status.get('recordId') not in known:raise ValueError('Research status orphan record')
  safe={k:v for k,v in status.items() if k!='recordId'}
  safe['sourceIds']=list(dict.fromkeys(sid(x) for x in (safe.get('sourceIds',[])+safe.get('captureSourceIds',[]))))
  research=known[status['recordId']]['researchStatus']
  review=safe.get('identityReview')
  if review:
   if review.get('status')!='verified_exact_name_developer_and_area' or not review.get('identityBasis'):
    raise ValueError('Identity candidate review requires verified exact-name, developer, and area evidence')
   identity_sources=list(dict.fromkeys(sid(x) for x in review.get('identitySourceIds',[])))
   resolved=review.get('resolvedCandidateCount');remaining=review.get('remainingCandidateCount')
   current=research.get('identityCandidateCount',0)
   if not identity_sources or not isinstance(resolved,int) or not isinstance(remaining,int) or resolved<1 or remaining<0 or resolved+remaining!=current:
    raise ValueError('Identity candidate review does not reconcile with the quarantined candidate count')
   prior=research.get('identityCandidateReview')
   if prior and prior!=review:raise ValueError('Identity candidate review cannot overwrite an earlier review')
   research['identityCandidateReview']={**review,'identitySourceIds':identity_sources,'reviewedAt':safe.get('asOf',packet.get('asOf'))}
   research['identityCandidateCount']=remaining
   research['identityCandidates']='quarantined' if remaining else 'resolved_by_verified_identity_review'
  previous=research.get('sourceCollection')
  if previous and previous!=safe:
   history=research.setdefault('sourceCollectionHistory',[])
   if previous not in history:history.append(previous)
  research['sourceCollection']=safe
 for record in records:
  status=record['researchStatus'];status.setdefault('originalAuditGaps',list(status.get('gaps',[])))
  whole=lambda x,kind:x['kind']==kind and x['status']=='verified' and x.get('scope')=='subject' and x.get('primaryEvidence') is True and x.get('eventStatus')!='planned' and period_start(x['date']['start'])<=asof
  launch=any(whole(x,'launch') for x in record['lifecycle']);complete=any(whole(x,'completion') for x in record['lifecycle'])
  subjects=[s for s in record['historySeries'] if s.get('scope')=='subject' and s.get('identityVerified') is True]
  status['originalAuditSourceScope']=status.get('sourceScope')
  direct_transactions=[o for o in record.get('observations',[]) if o.get('scope')=='subject' and o.get('identityVerified') is True and o.get('observationKind')=='transaction' and o.get('transactionKind')=='sale' and o.get('status')=='source_observed']
  status['sourceScope']='Verified registered subject cohorts or transactions and separately scoped context; full financial history unestablished' if subjects or direct_transactions else 'Shared/published context and advertised evidence only; no verified direct subject financial history'
  summary=record['coverageSummary']
  for metric,field in [('price','directSalePeriods'),('rent','directRentPeriods')]:
   if field in summary:summary['originalAudit'+field[0].upper()+field[1:]]=summary[field]
   periods={str(p[0]) for s in subjects if s.get('metric')==metric for p in series[s['id']]['points'] if isinstance(p[1],(float,int)) and p[1]>0 and not re.search(r'conflict|quarantin',str(p[3] if len(p)>3 else ''),re.I)}
   transactions=[o for o in record.get('observations',[]) if o.get('scope')=='subject' and o.get('identityVerified') is True and o.get('metric')==metric and o.get('observationKind')=='transaction' and o.get('transactionKind')=='sale' and o.get('status')=='source_observed' and o.get('period') and isinstance(o.get('value'),(float,int)) and o.get('value')>0]
   transaction_series=[s for s in subjects if s.get('metric')==metric and s.get('observationKind')=='transaction' and s.get('transactionKind')=='sale']
   transaction_points=[p for s in transaction_series for p in series[s['id']]['points'] if len(p)>1 and isinstance(p[1],(float,int)) and p[1]>0]
   transaction_periods={str(p[0]) for p in transaction_points if p[0]}
   transaction_periods.update(str(o['period']) for o in transactions)
   periods.update(str(o['period']) for o in transactions)
   periods.update(str(p[0]) for p in transaction_points if p[0])
   summary[field]=len(periods)
   summary['directSaleTransactionCount' if metric=='price' else 'directRentTransactionCount']=len(transactions)+len(transaction_points)
   if metric=='price':summary['directSaleTransactionDateCount']=len(transaction_periods)
  summary['directPeriodCountBasis']='Distinct retained native period labels plus exact transaction dates across verified subject cohorts; overlapping frequencies and sparse/incomplete periods are included, not monthly coverage or a completeness claim'
  if launch:status['launchDateStatus']='verified';status['gaps']=[x for x in status['gaps'] if x!='verified_launch_date']
  if complete:status['completionDateStatus']='verified';status['gaps']=[x for x in status['gaps'] if x!='actual_completion_date']
  if launch or complete or record.get('registerEvidence') or record['observations']:status['status']='partially_sourced; complete financial coverage not established'
  record['coverageSummary']['newFinancialEvidencePoints']=len(record['observations']);record['coverageSummary']['lifecycleEvidencePoints']=len(record['lifecycle'])
  refresh_research_coverage(record,series,sources,asof)
 return {'asOf':packet['asOf'],'counts':dict(counters),'collection':packet.get('collection',{}),'methodology':packet.get('methodology'),'supplementalPasses':packet.get('supplementalPasses',[]),'rawBodiesRedistributed':False,'additionalDatasets':packet.get('additionalDatasets',[]),'sourceCandidateRecords':len({x['recordId'] for x in packet.get('sourceCandidates',[]) if x.get('recordId')}),'incompleteFinancialCoverageRemainsExplicit':True}
