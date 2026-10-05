"""Merge reviewed, source-backed enrichment; raw scraped pages stay outside the repo."""
import json, pathlib, csv, io, hashlib, collections, datetime, re, gzip

def load_enrichment(base):
 path=base/'scrape-enrichment.json'
 if not path.exists():return None
 packet=json.loads(path.read_text())
 if packet.get('schemaVersion')!=1:raise ValueError('Unsupported enrichment schema')
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
   if milestone in ['completion','occupancy'] and date['start'][:10]>asof:raise ValueError('Future actual completion/occupancy')
   verification=fact.get('verification','reported')
   if verification=='verified' and not fact.get('primaryEvidence'):raise ValueError('Verified lifecycle requires primary evidence')
   record['lifecycle'].append({**common,'kind':milestone,'date':date,'status':verification,'scope':fact.get('scope','published_reference'),'eventStatus':fact.get('eventStatus','planned' if milestone.startswith('target_') else 'reported'),'primaryEvidence':fact.get('primaryEvidence',False),'label':fact['label'],'note':fact.get('note'),'evidenceClass':fact.get('evidenceClass','source_reported_milestone')})
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
   record['observations'].append({**common,**obs,'recordId':record['id'],'emirate':record['emirate'],'scope':scope,'identityVerified':fact.get('identityVerified',False),'sourceId':sourceids[0],'status':'source_observed','evidenceClass':evidence_class,'sourceEvidenceClass':sources[sourceids[0]].get('classification'),'independentUpstreamEvidence':not mirrored,'frequency':obs.get('frequency','daily')})
   incoming_rank=3 if fact.get('primaryEvidence') else 1 if mirrored else 2
   incoming_key=(incoming_rank,common['retrievedAt'],ident)
   current=record['currentSnapshot'];current_key=(current.get('sourceRank',0),current.get('retrievedAt',''),current.get('observationId',''))
   if obs.get('observationKind')=='asking_quote' and obs['unit']=='AED' and obs.get('metric')=='price' and incoming_key>current_key:
    previous=dict(record['currentSnapshot']);record.setdefault('priorCurrentSnapshots',[]).append(previous)
    record['currentSnapshot'].update({'askingPriceAED':value,'scope':'source_observed_asking_quote','sourceId':sourceids[0],'publishedAt':common['publishedAt'],'firstAvailableAt':available,'retrievedAt':common['retrievedAt'],'freshness':'advertisement captured on retrieval; current market validity unverified; publication date '+('known' if common['publishedAt'] else 'unknown'),'observationId':ident,'sourceRank':incoming_rank,'selectionReason':'Preferred by primary evidence, external source, tenant mirror, then capture time and stable observation ID; all other quotes retained','quoteQualifier':obs.get('quoteQualifier'),'sourceQuoteBasis':obs.get('sourceQuoteBasis'),'sourceEvidenceClass':sources[sourceids[0]].get('classification'),'independentUpstreamEvidence':not mirrored})
   counters['financialFacts']+=1
  elif kind=='register':
   record.setdefault('registerEvidence',[]).append({**common,'fields':fact['fields'],'classification':fact.get('evidenceClass','published_register_snapshot'),'registeredProjectId':fact.get('registeredProjectId'),'scope':fact.get('scope','published_reference'),'identityVerified':fact.get('identityVerified',False)})
   counters['registerFacts']+=1
  else:raise ValueError('Unsupported enrichment fact '+kind)
  counters['acceptedFacts']+=1
 for status in packet.get('recordResearch',[]):
  if status.get('recordId') not in known:raise ValueError('Research status orphan record')
  safe={k:v for k,v in status.items() if k!='recordId'}
  safe['sourceIds']=list(dict.fromkeys(sid(x) for x in (safe.get('sourceIds',[])+safe.get('captureSourceIds',[]))))
  known[status['recordId']]['researchStatus']['sourceCollection']=safe
 for record in records:
  status=record['researchStatus'];launch=any(x['kind']=='launch' and x['status']=='verified' for x in record['lifecycle']);complete=any(x['kind']=='completion' and x['status']=='verified' for x in record['lifecycle'])
  subjects=[s for s in record['historySeries'] if s.get('scope')=='subject' and s.get('identityVerified') is True]
  status['originalAuditSourceScope']=status.get('sourceScope')
  status['sourceScope']='Verified registered subject cohorts and separately scoped context; full financial history unestablished' if subjects else 'Shared/published context and advertised evidence only; no verified direct subject financial history'
  summary=record['coverageSummary']
  for metric,field in [('price','directSalePeriods'),('rent','directRentPeriods')]:
   if field in summary:summary['originalAudit'+field[0].upper()+field[1:]]=summary[field]
   summary[field]=len({str(p[0]) for s in subjects if s.get('metric')==metric for p in series[s['id']]['points'] if isinstance(p[1],(float,int)) and p[1]>0})
  summary['directPeriodCountBasis']='Distinct retained native period labels across verified subject cohorts; overlapping frequencies and sparse/incomplete periods are included, not monthly coverage or independent transactions'
  if launch:status['launchDateStatus']='verified';status['gaps']=[x for x in status['gaps'] if x!='verified_launch_date']
  if complete:status['completionDateStatus']='verified';status['gaps']=[x for x in status['gaps'] if x!='actual_completion_date']
  if launch or complete or record.get('registerEvidence') or record['observations']:status['status']='partially_sourced; complete financial coverage not established'
  record['coverageSummary']['newFinancialEvidencePoints']=len(record['observations']);record['coverageSummary']['lifecycleEvidencePoints']=len(record['lifecycle'])
 return {'asOf':packet['asOf'],'counts':dict(counters),'collection':packet.get('collection',{}),'methodology':packet.get('methodology'),'rawBodiesRedistributed':False,'additionalDatasets':packet.get('additionalDatasets',[]),'sourceCandidateRecords':len({x['recordId'] for x in packet.get('sourceCandidates',[]) if x.get('recordId')}),'incompleteFinancialCoverageRemainsExplicit':True}
