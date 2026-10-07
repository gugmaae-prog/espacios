#!/usr/bin/env python3
"""Reproducible, lossless context-history snapshot. No network or remote writes."""
import argparse, csv, gzip, hashlib, io, json, pathlib, re, calendar, collections, datetime
from historical_enrichment import load_enrichment, apply_enrichment, retain_published_quotes
from historical_sources import register_source
from historical_gap_ledger import refresh_research_coverage
from historical_local_events import local_event_context

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = ROOT / 'data/historical-intelligence'
VERSION = '20261008-enrichment-v20'
ASOF = '2026-10-08'
ENRICHMENT_SIDECARS = ['community-master-context-enrichment.json']
SOURCE_CAPTURE_DATE = '2026-10-03'
EMIRATES = ['Abu Dhabi','Dubai','Sharjah','Ajman','Umm Al Quwain','Ras Al Khaimah','Fujairah']
COLUMNS = ['period','value','sampleCount','qualityStatus','publishedAt','firstAvailableAt','sourceObservationId','p25','p75','eligibleValueAED','grossYieldPct','blockedRows','rawSourceEmirate','observationBasis','nativeRow']
INPUTS = {
 'inventory': 'outputs/ESPACIOS_PROJECT_COMMUNITY_DATAPOINTS_2026-10-03.json',
 'profiles': 'outputs/ESPACIOS_RECORD_HISTORY_CURRENT_FORECAST_COVERAGE_2080.csv',
 'history': 'outputs/ESPACIOS_HISTORICAL_DATAPOINTS_COMPLETE_SOURCE_COLLECTION_2026-10-03.csv',
 'sources': 'outputs/ESPACIOS_DATAPOINT_SOURCE_REGISTER_2026-10-03.json',
 'projectCandidates': 'outputs/ESPACIOS_PROJECT_TRANSACTION_MATCH_CANDIDATES_2026-10-03.csv',
 'communityCandidates': 'outputs/ESPACIOS_COMMUNITY_TRANSACTION_MATCH_CANDIDATES_2026-10-03.csv',
 'expansion': 'outputs/ESPACIOS_COVERAGE_EXPANSION_VERIFICATION_2026-10-03.json',
 'partitions': 'work/coverage-expansion/manifest.json',
 'transactionSource': 'work/coverage-expansion/transaction-source.json',
 'transactionManifest': 'work/coverage-expansion/export-manifest.json',
}
def encoded(value): return json.dumps(value, ensure_ascii=False, separators=(',',':'), sort_keys=True).encode()
def sha(value): return hashlib.sha256(value).hexdigest()
def read_json(path): return json.loads(path.read_text())
def dump_json(path,value): path.parent.mkdir(parents=True,exist_ok=True); path.write_bytes(encoded(value)+b'\n')
def number(value):
 try: return float(value) if str(value).strip() else None
 except (ValueError,TypeError): return None
def usable_subject(record,metric,series):
 series_observed=any(s.get('scope')=='subject' and s.get('identityVerified') and s.get('metric')==metric and any(not re.search(r'conflict|quarantin',str(p[3] if len(p)>3 else ''),re.I) for p in series[s['id']]['points']) for s in record['historySeries'])
 transaction_observed=any(o.get('scope')=='subject' and o.get('identityVerified') is True and o.get('metric')==metric and o.get('observationKind')=='transaction' and o.get('transactionKind')=='sale' and o.get('status')=='source_observed' for o in record.get('observations',[]))
 return series_observed or transaction_observed
def rows(value): return list(csv.DictReader(io.StringIO(value.decode('utf-8-sig'))))
def period_date(period,end=False):
 s=str(period or '')
 m=re.fullmatch(r'(\d{4})-(\d{2})(?:-(\d{2}))?',s)
 if m:
  y,mo=int(m[1]),int(m[2]); day=int(m[3]) if m[3] else calendar.monthrange(y,mo)[1] if end else 1
  return f'{y:04d}-{mo:02d}-{day:02d}'
 m=re.fullmatch(r'(\d{4})-?Q([1-4])',s,re.I)
 if m:
  y,q=int(m[1]),int(m[2]); mo=q*3 if end else (q-1)*3+1
  return f'{y:04d}-{mo:02d}-{calendar.monthrange(y,mo)[1] if end else 1:02d}'
 m=re.fullmatch(r'(\d{4})(?:FY|H([12]))?',s,re.I)
 if m:
  y=int(m[1]); half=int(m[2]) if m[2] else None; mo=(half*6 if end else (half-1)*6+1) if half else (12 if end else 1)
  return f'{y:04d}-{mo:02d}-{calendar.monthrange(y,mo)[1] if end else 1:02d}'
 return None
def date_object(text):
 s=str(text or '').strip()
 m=re.search(r'Q([1-4])\s*(20\d{2})',s,re.I)
 if m: return {'start':f'{m[2]}-Q{m[1]}','precision':'quarter'}
 m=re.fullmatch(r'20\d{2}-\d{2}-\d{2}',s)
 if m:return {'start':s,'precision':'day'}
 m=re.search(r'\b(20\d{2})\b',s)
 if m:return {'start':m[1],'precision':'year'}
 return None
def immutable(blob,suffix,kind):
 digest=sha(blob); rel=f'objects/{digest}{suffix}'; path=BASE/rel
 if path.exists():
  if path.read_bytes()!=blob: raise ValueError('Immutable object collision: '+rel)
 else: path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(blob)
 return {'key':f'research/published/{ASOF}/historical-intelligence/{rel}','path':str(path.relative_to(ROOT)),'sha256':digest,'bytes':len(blob),'kind':kind,'compression':'gzip' if suffix.endswith('.gz') else None}
def gzip_object(value,kind):return immutable(gzip.compress(encoded(value),mtime=0),'.json.gz',kind)
def build_runtime_index(snapshot,publication):
 """Append bounded runtime objects without changing the canonical evidence snapshot."""
 if snapshot['version']!=publication['version'] or snapshot['asOf']!=publication['asOf']:raise ValueError('Runtime source version differs from publication')
 objects=[x for x in publication['objects'] if x['kind'] not in ['runtime_history_partition','runtime_record_shard','runtime_index']]
 runtime_objects=[];pointers={};maximum_native=512*1024
 def native_chunk(items):
  if not items:return
  value={'version':snapshot['version'],'asOf':snapshot['asOf'],'classification':'runtime_native_history_partition','series':items}
  obj=gzip_object(value,'runtime_history_partition');obj['decodedBytes']=len(encoded(value));runtime_objects.append(obj)
  for item in items:pointers[item['id']]={k:obj[k] for k in ['key','sha256','bytes','compression','decodedBytes']}
 for obj in objects:
  if obj['kind']!='history_partition':continue
  original=gzip.decompress((ROOT/obj['path']).read_bytes());partition=json.loads(original)
  if len(original)<=maximum_native:
   for item in partition['series']:pointers[item['id']]={k:obj[k] for k in ['key','sha256','bytes','compression']};pointers[item['id']]['decodedBytes']=len(original)
   continue
  chunk=[];size=0
  for item in partition['series']:
   item_size=len(encoded(item))
   if chunk and size+item_size>maximum_native:native_chunk(chunk);chunk=[];size=0
   chunk.append(item);size+=item_size
  native_chunk(chunk)
 inventory=[];record_group=[];record_group_bytes=0
 def record_chunk(items):
  if not items:return
  value={'version':snapshot['version'],'asOf':snapshot['asOf'],'classification':'runtime_record_evidence_shard','records':items}
  obj=gzip_object(value,'runtime_record_shard');obj['decodedBytes']=len(encoded(value));runtime_objects.append(obj)
  pointer={k:obj[k] for k in ['key','sha256','bytes','compression','decodedBytes']}
  for item in items:
   native=next(row for row in inventory if row['id']==item['id']);native['recordPartition']=pointer;native['runtimeRecordSHA256']=sha(encoded(item))
 for original in snapshot['records']:
  record={**original,'historySeries':[{**series,'points':[],'archivePartition':series.get('partition'),'partition':pointers[series['id']]} for series in original.get('historySeries',[])]}
  research=original.get('researchStatus') or {}
  compact={k:v for k,v in research.items() if v is None or isinstance(v,(str,int,float,bool)) or k=='gaps'}
  compact['itemCoverageAvailable']=bool(research.get('itemCoverage'));compact['fullEvidenceAvailable']=True
  inventory.append({k:original.get(k) for k in ['id','type','name','emirate','communityId','sharedCommunityHistoryId']})
  inventory[-1]['researchStatus']=compact
  inventory[-1]['canonicalRecordSHA256']=sha(encoded(original))
  record_size=len(encoded(record))
  if record_group and (len(record_group)>=16 or record_group_bytes+record_size>2*1024*1024):record_chunk(record_group);record_group=[];record_group_bytes=0
  record_group.append(record);record_group_bytes+=record_size
 record_chunk(record_group)
 compact_manifest={k:v for k,v in snapshot['manifest'].items() if k not in ['objects','rawSourcePartitions','inputProvenance','rightsPendingSourceMetadata']}
 compact_manifest['r2']={**{k:publication['rootIndex'][k] for k in ['key','sha256','bytes','compression']},'binding':'MARKET_R2','classification':'archival_only; not inflated by bounded runtime'}
 compact_manifest['runtime']={'classification':'bounded_manifest_backed_runtime','recordCount':len(inventory),'recordShardCount':sum(x['kind']=='runtime_record_shard' for x in runtime_objects),'recordShardMaximumDecodedBytes':max(x['decodedBytes'] for x in runtime_objects if x['kind']=='runtime_record_shard'),'nativePartitionMaximumDecodedBytes':max([x.get('decodedBytes',0) for x in runtime_objects if x['kind']=='runtime_history_partition']+[maximum_native]),'canonicalSnapshotSHA256':sha((ROOT/'data/historical-intelligence-20261003.json').read_bytes()),'canonicalArchiveSHA256':publication['rootIndex']['sha256'],'historyRetrieval':'Selected record evidence plus native immutable partitions; full archive retained separately'}
 runtime={**snapshot,'records':inventory,'manifest':compact_manifest}
 dump_json(BASE/'runtime-index.json',runtime)
 obj=gzip_object(runtime,'runtime_index');obj['decodedBytes']=len(encoded(runtime));runtime_objects.append(obj)
 publication['runtimeIndex']=obj;publication['objects']=objects+runtime_objects;publication['runtime']=compact_manifest['runtime'];dump_json(BASE/'publication-manifest.json',publication)
 return runtime
def canonical_url(url):
 if isinstance(url,dict):url=url.get('url') or ''
 return str(url or '').split('#')[0].rstrip('/')
def import_inputs(folder):
 manifest={}
 for key,rel in INPUTS.items():
  path=folder/rel;original=path.read_bytes();raw=original;excluded=0
  if key=='inventory':
   inv=json.loads(raw);keep=['Reported handover','Numeric asking price AED','Community ID','Source URL','Authority issues']
   for group in ['projects','communities']:
    inv[group]=[{'id':x['id'],'mapRecord':{k:v for k,v in x['mapRecord'].items() if k in ['id','kind','name','emirate','area','sourceUrl','sourceLabel','source','handover','status','archived']},'facts':{k:v for k,v in x.get('facts',{}).items() if k in keep}} for x in inv[group]]
   raw=encoded(inv)
  if key=='history':
   data=rows(raw);safe=[x for x in data if not x['Source ID'].startswith('adrec') and 'adrec.gov.ae' not in x['Source URL'] and 'mun.rak.ae' not in x['Source URL'] and x['Class']!='official published rent-range reference']
   excluded=len(data)-len(safe);out=io.StringIO();writer=csv.DictWriter(out,fieldnames=list(data[0]));writer.writeheader();writer.writerows(safe);raw=out.getvalue().encode()
  blob=gzip.compress(raw,mtime=0);target=BASE/'inputs'/f'{key}-{sha(raw)}.gz'
  if target.exists() and gzip.decompress(target.read_bytes())!=raw:raise ValueError('Immutable input changed')
  target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(blob)
  manifest[key]={'path':str(target.relative_to(ROOT)),'sha256':sha(raw),'compressedSha256':sha(blob),'bytes':len(raw),'originalPath':rel,'originalSHA256':sha(original),'originalBytes':len(original),'excludedRightsPendingRows':excluded,'format':'csv' if rel.endswith('.csv') else 'json','retrievedAt':SOURCE_CAPTURE_DATE,'datePrecision':'day','normalization':'public catalogue subset' if key=='inventory' else 'licensed/prior-released source rows only' if key=='history' else 'lossless original'}
 dump_json(BASE/'inputs/manifest.json',manifest)
def load_inputs():
 manifest=read_json(BASE/'inputs/manifest.json');data={}
 for key,meta in manifest.items():
  blob=(ROOT/meta['path']).read_bytes();raw=gzip.decompress(blob)
  if sha(raw)!=meta['sha256'] or sha(blob)!=meta['compressedSha256']:raise ValueError('Input checksum mismatch '+key)
  data[key]=rows(raw) if meta['format']=='csv' else json.loads(raw)
 return data,manifest
def build():
 data,inputs=load_inputs();inv=data['inventory'];profiles={x['Record ID']:x for x in data['profiles']}
 capture_asof=inv.get('asOf') or SOURCE_CAPTURE_DATE
 if ASOF<capture_asof:raise ValueError('Snapshot as-of cannot precede the retained source collection; this is not a point-in-time replay')
 original_public_rows=len(data['history']);enrichment=load_enrichment(BASE,ENRICHMENT_SIDECARS);new_history_rows=[]
 if enrichment:
  for item in enrichment.get('historyInputs',[]):new_history_rows.extend(item['rows'])
 early_path=BASE/'early-history-manifest.json';early=None
 if early_path.exists():
  early=read_json(early_path);meta=early['input'];blob=(ROOT/meta['path']).read_bytes();raw=gzip.decompress(blob)
  if sha(blob)!=meta['compressedSha256'] or sha(raw)!=meta['sha256']:raise ValueError('Supplement checksum mismatch')
  supplement=rows(raw)
  if any((period_date(x['Period']) or '9999')>='2019-01-01' for x in supplement):raise ValueError('Early supplement overlaps modern history')
  data['history'].extend(supplement)
 data['history'].extend(new_history_rows)
 reviewed_links=collections.defaultdict(list)
 if enrichment:
  for link in enrichment.get('seriesLinks',[]):reviewed_links[link['seriesId']].append(link)
 grouped=collections.defaultdict(list)
 for row in data['history']:grouped[row['Series ID']].append(row)
 sources={};url_ids={};source_aliases={}
 def source(item):
  return register_source(item,sources,url_ids,source_aliases,canonical_url,capture_asof)
 for entry in data['sources']['sources']:source(entry)
 for entry in data['sources']['retrievals']:
  source({'id':'capture-'+sha(entry['url'].encode())[:16],**entry,'classification':'retained_api_capture','licence':'retained first-party API snapshot; underlying source licences retained separately'})
 dld=data['transactionSource'];dld_id=source({'id':'dred-sale-snapshot-20260919',**dld,'publishedAt':data['transactionManifest'].get('generated_at'),'firstAvailableAt':data['transactionManifest'].get('generated_at'),'classification':'independent_dld_derived_transactions','licenseVerifiedByPublisher':True,'rawTransactionRows':dld['rawRows'],'rawObservationRange':data['transactionManifest']['coverage']})
 source({'id':'catalogue-core','url':'https://espacios.me/map/map-core.json','publisher':'Espacios retained catalogue','retrievedAt':next(x['retrievedAt'] for x in inv['sourceManifest'] if x['key']=='core'),'classification':'catalogue_snapshot','publishedAt':None,'firstAvailableAt':None,'licence':'Espacios catalogue; upstream project-source rights retained separately'})
 seeds=[]
 for path in sorted(BASE.glob('seed-*-events.json')):
  seed=read_json(path)
  for s in seed.get('sources',[]):source(s)
  seeds.extend(seed.get('events',[]))
 rates_path=BASE/'uae-rates-supplement.json';rates=read_json(rates_path) if rates_path.exists() else {'sources':[],'observations':[]}
 for item in rates['sources']:source(item)
 capture_path=BASE/'event-source-captures.json'
 captures=read_json(capture_path) if capture_path.exists() else {'captures':[]}
 for entry in captures['captures']:
  ident=source_aliases.get(entry['sourceId'])
  if ident in sources:
   sources[ident]['verificationHistory']=[entry]
   sources[ident]['retrievedAt']=entry['retrievedAt']
   sources[ident]['captureStatus']=entry['captureStatus']
 if enrichment:
  for item in enrichment.get('sources',[]):source(item)
 # A shared source ID may have several endpoint captures. All retain independent hashes.
 series={};partition_groups=collections.defaultdict(list)
 for ident,items in sorted(grouped.items()):
  first=items[0];sid=source({'id':first['Source ID'] or 'history-'+sha(first['Source URL'].encode())[:16],'url':first['Source URL'],'publisher':'Dubai Real Estate Data' if first['Source ID']=='dred-sale-snapshot-20260919' else sources.get(first['Source ID'],{}).get('publisher','Source publisher not established'),'publishedAt':first['Published date'] or sources.get(first['Source ID'],{}).get('publishedAt'),'classification':first['Class'],'licence':'CC BY 4.0; publisher declaration verified' if first['Source ID']=='dred-sale-snapshot-20260919' else sources.get(first['Source ID'],{}).get('licence','rights_pending: retained existing aggregate context; no new third-party numeric redistribution')})
  metric='rent' if 'rent' in first['Metric'].lower() else 'volume' if any(t in first['Metric'].lower() for t in ['count','units','projects']) else 'price'
  scope='asking_benchmark' if first['Class']=='advertised benchmark' else 'area_context'
  links=reviewed_links.get(ident,[])
  subject_links=[x for x in links if x.get('scope')=='subject']
  if subject_links and (len(subject_links)!=1 or not subject_links[0].get('identityVerified') or not subject_links[0].get('identitySourceIds') or not subject_links[0].get('identityBasis')):raise ValueError('Unproven or duplicate subject series identity')
  if subject_links:scope='subject'
  elif links:
   scopes={x['scope'] for x in links}
   if len(scopes)!=1:raise ValueError('One source series cannot carry incompatible scopes')
   scope=next(iter(scopes))
  frequency={'quarter':'quarterly','half-year':'half-year','native annual / half-year':'native_mixed'}.get(first['Frequency'],first['Frequency'])
  points=[]
  for i,row in enumerate(items):
   quality=row['Quality'];v=number(row['Value'])
   # Sparse source medians retained as evidence, never accepted as a price anchor.
   points.append([row['Period'],v,number(row['Sample rows']),quality,row['Published date'] or sources[sid].get('publishedAt'),sources[sid].get('firstAvailableAt'),row.get('Source observation ID') or ident+':'+sha(encoded(row))[:16],number(row['P25']),number(row['P75']),number(row['Eligible value AED']),number(row['Gross yield pct']),number(row['Blocked rows']),row['Raw source emirate'],row['Observation basis'],json.loads(row['Native row JSON']) if row['Native row JSON'] else None])
  points.sort(key=lambda p:(period_date(p[0]) or '',p[6]))
  dates=[(period_date(p[0]),period_date(p[0],True),p[0]) for p in points if period_date(p[0])]
  coverage={'start':min(dates)[2] if dates else None,'end':max(dates,key=lambda x:x[1])[2] if dates else None,'startDate':min(dates)[0] if dates else None,'endDate':max(x[1] for x in dates) if dates else None,'observedPeriodCount':len({p[0] for p in points}),'rowCount':len(points),'nativeFrequency':first['Frequency'],'completeness':'not_claimed'}
  item={'id':ident,'sourceSeriesId':ident,'metric':metric,'sourceMetric':first['Metric'],'frequency':frequency,'unit':first['Unit'],'scope':scope,'identityVerified':bool(subject_links),'sourceId':sid,'geography':first['Geography'],'emirate':first['Emirate'],'segment':first['Segment'],'label':first.get('Label') or None,'registration':first['Registration'],'sourceAreaId':int(first['Source area ID']) if str(first.get('Source area ID') or '').isdigit() else None,'observationKind':first.get('Observation kind') or 'aggregate','transactionKind':first.get('Transaction kind') or None,'procedureId':int(first['Procedure ID']) if str(first.get('Procedure ID') or '').isdigit() else None,'procedureName':first.get('Procedure name') or None,'observationDateBasis':first.get('Observation basis') or None,'classification':first['Class'],'columns':COLUMNS,'points':points,'pointCount':len(points),'periodCoverage':coverage,'nativeEndpoint':first['Endpoint'] or None,'qualityStatus':'context_only; source-native quality flags retained','availability':'partition_available'}
  if links:
   proof=links[0]
   if any(x.get('identitySourceIds',[])!=proof.get('identitySourceIds',[]) or x.get('identityBasis')!=proof.get('identityBasis') for x in links):raise ValueError('Conflicting canonical source-cohort proofs')
   item['identitySourceIds']=[source_aliases.get(x,x) for x in proof.get('identitySourceIds',[])];item['identityBasis']=proof['identityBasis'];item['linkBasis']=proof['identityBasis']
   if subject_links:item['subjectRecordId']=proof['recordId']
   if any(x not in sources for x in item['identitySourceIds']):raise ValueError('Orphan identity proof source')
  if early and ident in early['seriesLinks']:item['usage']='Residential';item['retrospectivePublisherFlags']=True;item['forecastTrainingAllowed']=False
  series[ident]=item;partition_groups[(first['Class'],first['Emirate'],first['Frequency'],first['Segment'],first['Registration'])].append(item)
 objects=[]
 for key,items in sorted(partition_groups.items()):
  obj=gzip_object({'version':VERSION,'asOf':ASOF,'classification':'context_history_partition','series':items},'history_partition');objects.append(obj)
  for item in items:item['partition']={k:obj[k] for k in ['key','sha256','bytes','compression']}
 # Original CSV bytes retain every native field, including currently unsupported metrics.
 raw=gzip.decompress((ROOT/inputs['history']['path']).read_bytes());objects.append(immutable(gzip.compress(raw,mtime=0),'.csv.gz','lossless_historical_csv'))
 if early:
  supplement_blob=(ROOT/early['input']['path']).read_bytes();objects.append(immutable(supplement_blob,'.csv.gz','licensed_early_context_csv'))
  archive=dict(early['rawArchive']);archive_bytes=(ROOT/archive['path']).read_bytes()
  if sha(archive_bytes)!=archive['sha256'] or len(archive_bytes)!=archive['bytes']:raise ValueError('Licensed parquet archive does not verify')
  objects.append(archive)
 if enrichment:
  for archive in enrichment.get('licensedArchives',[]):
   if archive.get('licence')!='CC BY 4.0':raise ValueError('Raw archive redistribution permission absent')
   archive_bytes=(BASE/archive['path']).read_bytes()
   if sha(archive_bytes)!=archive['sha256']:raise ValueError('Archive checksum mismatch')
   objects.append(immutable(archive_bytes,'.csv.gz','licensed_published_csv'))
  for item in enrichment.get('historyInputs',[]):
   blob=(BASE/item['path']).read_bytes();objects.append(immutable(blob if item.get('compression')=='gzip' else gzip.compress(blob,mtime=0),'.csv.gz','public_primary_derived_history'))
 objects.append(gzip_object({'projectCandidates':data['projectCandidates'],'communityCandidates':data['communityCandidates'],'classification':'identity_candidates_quarantined','identityVerified':False,'counts':{'projects':len({x['Record ID'] for x in data['projectCandidates']}),'communities':len({x['Community ID'] for x in data['communityCandidates']})}},'quarantined_identity_candidates'))
 candidate_p=collections.Counter(x['Record ID'] for x in data['projectCandidates']);candidate_c=collections.Counter(x['Community ID'] for x in data['communityCandidates'])
 records=[];known_ids={x['id'] for k in ['projects','communities'] for x in inv[k]}
 alias_path=BASE/'series-aliases.json'
 aliases=read_json(alias_path) if alias_path.exists() else {'aliases':[]}
 series_aliases={x['legacySeriesId']:x['sourceSeriesId'] for x in aliases['aliases']}
 early_by_existing=collections.defaultdict(list)
 if early:
  for early_id,link in early['seriesLinks'].items():
   for existing_id in link['existingSeriesIds']:early_by_existing[existing_id].append(early_id)
 for typ,key in [('project','projects'),('community','communities')]:
  for item in inv[key]:
   m=item['mapRecord'];f=item.get('facts',{});profile=profiles[item['id']];source_ref=f.get('Source URL') or m.get('sourceUrl') or m.get('source') or 'https://espacios.me/map/map-core.json';source_meta=source_ref if isinstance(source_ref,dict) else {}
   sid=source({'url':canonical_url(source_ref),'publisher':m.get('sourceLabel') or source_meta.get('label') or 'Catalogue-reported project source','previouslyVerifiedAt':source_meta.get('verifiedAt'),'classification':'project_source_reference','publishedAt':None,'firstAvailableAt':None,'captureStatus':'reference_only; underlying page not freshly verified'})
   lifecycle=[];handover=date_object(f.get('Reported handover') or m.get('handover'))
   if handover:lifecycle.append({'id':item['id']+':reported-handover','kind':'target_handover','date':handover,'sourceIds':[sid,'catalogue-core'],'status':'reported','publishedAt':None,'firstAvailableAt':None,'retrievedAt':capture_asof,'label':'Reported target handover; actual completion not established','rawLabel':f.get('Reported handover') or m.get('handover')})
   context=[];missingrefs=[]
   for col in ['Monthly context series IDs','Quarterly context series IDs','Asking context series IDs']:
    for ident in filter(None,[s.strip() for s in profile[col].split(';')]):
     legacy_ident=ident;ident=series_aliases.get(ident,ident)
     if ident in series:
      full=series[ident];small={k:v for k,v in full.items() if k!='points'};small['points']=full['points'][-12:];small['availability']='partial_embedded_context';small['embeddedPointCount']=len(small['points']);small['linkBasis']=profile['Context relation']
      if ident!=legacy_ident:small['legacySeriesId']=legacy_ident;small['aliasBasis']='Exact native numeric tuples match; geographic context only'
      context.append(small)
     else:missingrefs.append(ident)
   existing_context=list(context)
   for modern in existing_context:
    for early_id in early_by_existing.get(modern['id'],[]):
     if any(x['id']==early_id for x in context):continue
     full=series[early_id];small={k:v for k,v in full.items() if k!='points'};small['points']=full['points'][-12:];small['availability']='partial_embedded_context';small['embeddedPointCount']=len(small['points']);small['linkBasis']='Exact reviewed source area ID/name and property cohort; retrospective historical context';small['linkedExistingSeriesId']=modern['id'];context.append(small)
   community=f.get('Community ID') or profile.get('Research community link') or None
   quote=number(f.get('Numeric asking price AED'))
   gaps=['verified_launch_date','actual_completion_date','direct_registered_sale_history','direct_signed_rent_history','dated_current_valuation','service_charges','validated_price_forecast','validated_rent_forecast','validated_net_return_forecast','long_term_scenario_assumptions']
   rec={'id':item['id'],'type':typ,'name':m['name'],'emirate':m['emirate'],'communityId':community if community in known_ids and typ=='project' else None,'lifecycle':lifecycle,'observations':[],'historySeries':context,'historyStartPeriod':None,'coverageWindowBasis':'unknown_subject_start; earliest shared context is not subject history','researchStatus':{'status':'research_pending','identityCandidateCount':candidate_p[item['id']] if typ=='project' else candidate_c[item['id']],'identityCandidates':'quarantined' if (candidate_p[item['id']] if typ=='project' else candidate_c[item['id']]) else 'none_found_in_captured_source','gaps':gaps,'unresolvedSeriesIds':missingrefs,'sourceScope':'shared area context only; no verified individual subject histories','launchDateStatus':'research_pending','completionDateStatus':'research_pending'},'scenarioInputs':None,'scenarioCoverage':{'firstYear':2027,'lastYear':2080,'annualSlotsPerMetric':54,'approvedAnnualPoints':0,'price':None,'rent':None,'netROI':None,'status':'unavailable_required_inputs_and_validation'},'currentSnapshot':{'askingPriceAED':quote if quote and quote>0 else None,'scope':'reported_asking_quote','publishedAt':None,'firstAvailableAt':None,'retrievedAt':capture_asof,'sourceId':sid,'freshness':'unverified_source_date','reportedHandover':f.get('Reported handover') or m.get('handover'),'authorityIssues':f.get('Authority issues') or None},'coverageSummary':{'directSalePeriods':0,'directRentPeriods':0,'saleContextRows':int(profile['Monthly sale-context rows'])+int(profile['Quarterly sale-context rows']),'askingContextRows':int(profile['Asking benchmark rows']),'originalAuditAsOf':capture_asof,'referenceReconciliationPending':len(missingrefs)}}
   records.append(rec)
 # The last verified production root is immutable; retain its quote vintages
 # even when later review cutoffs make the original selection rule inapplicable.
 retained_hash='6c5c0219d3293786dd9a3c2aebb9ab828cb6600ab2d33782d83a997215060138'
 retained_bytes=(BASE/'objects'/f'{retained_hash}.json.gz').read_bytes()
 if sha(retained_bytes)!=retained_hash:raise ValueError('Retained production quote snapshot checksum mismatch')
 retain_published_quotes(records,json.loads(gzip.decompress(retained_bytes)),enrichment,ASOF)
 enrichment_summary=apply_enrichment(enrichment,records,series,sources,source,source_aliases,ASOF)
 communities_by_id={r['id']:r for r in records if r['type']=='community'}
 for rec in records:
  community=communities_by_id.get(rec.get('communityId'))
  if rec['type']=='project' and community and any(s['scope']=='community_context' for s in community['historySeries']):rec['sharedCommunityHistoryId']=community['id']
 events=[]
 for event in seeds:
  event=dict(event);event.setdefault('classification','event_evidence');event['priceUpliftPct']=None
  event.setdefault('firstAvailableAt',event.get('publishedAt'));event.setdefault('status','verified_event_context');event.setdefault('geography',{'emirates':EMIRATES,'areas':[]})
  event['sourceIds']=[source_aliases.get(s,url_ids.get(canonical_url(s),s)) for s in event.get('sourceIds',[])]
  for claim in event.get('claims',[]):claim['sourceIds']=[source_aliases.get(s,url_ids.get(canonical_url(s),s)) for s in claim.get('sourceIds',event['sourceIds'])]
  policy=[]
  for observation in rates['observations']:
   if observation.get('eventId')!=event['id']:continue
   observation=dict(observation);observation['sourceIds']=[source_aliases.get(s,s) for s in observation['sourceIds']]
   if observation.get('rateBeforePct') is None:text=f"CBUAE announced a {observation['changeBasisPoints']}-basis-point change effective {observation['effectiveFrom']}; absolute levels were not stated."
   else:text=f"CBUAE changed the Overnight Deposit Facility Base Rate from {observation['rateBeforePct']}% to {observation['rateAfterPct']}% effective {observation['effectiveFrom']}. This is policy-rate context, not a retail mortgage rate or measured property-price effect."
   observation['claims']=[{'text':text,'classification':'reported_context','sourceIds':observation['sourceIds']}]
   policy.append(observation)
  if policy:event['policyRateObservations']=policy;event['supportingEvidencePolicy']='Each dated policy stage carries its own source availability; later stages do not alter original event availability'
  events.append(event)
 # Context exposures are geographic, not proof an individual project existed then or its price changed.
 exposures=[];exposure_rules=[]
 for event in events:
  geo=event['geography'];areas=geo.get('areas') or []
  if not areas:exposure_rules.append({'eventId':event['id'],'scope':'emirate' if len(geo['emirates'])==1 else 'national','emirates':geo['emirates'],'basis':'Geographic macro context only; project existence at event date is not established','sourceIds':event['sourceIds'],'verified':False,'appliesTo':'project','existenceAtEvent':'research_pending','priceUpliftPct':None})
  for rec in records:
   if not areas and rec['type']=='project':continue
   if rec['emirate'] not in geo.get('emirates',[]):continue
   if areas:
    link=next((x for x in inv['projects' if rec['type']=='project' else 'communities'] if x['id']==rec['id']),None)
    text=' '.join([rec['name'],str((link or {}).get('mapRecord',{}).get('area',''))]).lower()
    if not any(str(area).lower() in text for area in areas):continue
    scope='community';verified=False;basis='Candidate marketed-area label link; geographic extent and at-event existence need validation'
   else:scope='emirate' if len(geo['emirates'])==1 else 'national';verified=rec['type']=='community';basis='Emirate-wide macro context; no subject price effect asserted; project existence at event date research pending' if rec['type']=='project' else 'Community emirate membership; contextual exposure only, no measured local causal price effect'
   ident=sha(encoded([event['id'],rec['id'],scope]))[:24];exposures.append({'id':ident,'eventId':event['id'],'recordId':rec['id'],'scope':scope,'basis':basis,'sourceIds':event['sourceIds'],'verified':verified,'priceUpliftPct':None})
 local_events,local_exposures=local_event_context(records,sources,ASOF)
 events.extend(local_events);exposures.extend(local_exposures)
 exposure_by_record=collections.defaultdict(list)
 for link in exposures:exposure_by_record[link['recordId']].append(link)
 for rec in records:
  community=communities_by_id.get(rec.get('sharedCommunityHistoryId'))
  event_links=exposure_by_record[rec['id']]+[rule for rule in exposure_rules if rec['type']==rule['appliesTo'] and rec['emirate'] in rule['emirates']]
  refresh_research_coverage(rec,series,sources,ASOF,community['historySeries'] if community else None,event_links)
 assert len(records)==1860 and len({x['id'] for x in records})==1860
 assert sum(x['type']=='project' for x in records)==1645 and sum(x['type']=='community' for x in records)==215
 public_rows=len(data['history']);original_collected_rows=data['expansion']['completeCollectedHistoricalRows'];supplement_rows=public_rows-original_public_rows-len(new_history_rows);collected_rows=original_collected_rows+supplement_rows+len(new_history_rows)
 assert original_public_rows+inputs['history'].get('excludedRightsPendingRows',0)==original_collected_rows==122268
 assert public_rows+inputs['history'].get('excludedRightsPendingRows',0)==collected_rows
 record_counts={e:{'projects':sum(x['type']=='project' and x['emirate']==e for x in records),'communities':sum(x['type']=='community' and x['emirate']==e for x in records),'historicalContextRows':sum(x['Emirate']==e for x in data['history']),'subjectHistoryRecords':sum(x['emirate']==e and any(s['scope']=='subject' and s.get('identityVerified') for s in x['historySeries']) for x in records)} for e in EMIRATES}
 dates=[period_date(x['Period']) for x in data['history'] if period_date(x['Period'])]
 manifest={'version':VERSION,'asOf':ASOF,'recordCount':1860,'projectCount':1645,'communityCount':215,'historyWindow':{'start':None,'end':ASOF[:7],'basis':'Unknown subject inception; no common invented history start'},'collectionEnvelope':{'start':min(dates),'end':ASOF[:7],'basis':'Collected source observation envelope, not any subject lifecycle'},'historicalObservationRows':public_rows,'collectedHistoricalObservationRows':collected_rows,'rightsPendingObservationRows':inputs['history'].get('excludedRightsPendingRows',0),'historicalSeriesCount':len(series),'recordIdsSHA256':sha(encoded(sorted(known_ids))),'directSubjectSaleHistoryRecords':sum(usable_subject(r,'price',series) for r in records),'directSubjectRentHistoryRecords':sum(usable_subject(r,'rent',series) for r in records),'approved2080ForecastRecords':0,'requiredAnnualMetricSlots':301320,'sevenEmirateCoverage':record_counts,'identityCandidateProjects':len(candidate_p),'identityCandidateCommunities':len(candidate_c),'inputProvenance':inputs,'rawSourcePartitions':data['partitions'],'rawTransactionSource':dld,'partitionBinding':'MARKET_R2','objects':objects,'rightsPendingSourceMetadata':read_json(ROOT/'data/source-review-20260930.json'),'historicalRowsWarning':'Overlapping native aggregates; not independent transactions and not additive with underlying raw transaction rows','completionDefinition':'Every record evaluated; observed financial coverage remains incomplete','publicationPolicy':'No production writes. Candidate-only append-only snapshots; source rights metadata retained.'}
 manifest['directSubjectHistoryCountBasis']='Records with at least one retained non-disputed native subject observation; sparse observations count as evidence, not reliable medians or complete lifetime histories'
 manifest['disputedFinancialObservationRows']=sum(bool(re.search(r'conflict|quarantin',str(row['Quality']),re.I)) for row in data['history'])
 manifest['rejectedGeographicContextLinks']=sum(x.get('recordLinkReview',{}).get('status')=='rejected' for r in records for x in r['historySeries'])
 if enrichment:
  manifest['sourceEnrichment']={**enrichment_summary,'path':str((BASE/'scrape-enrichment.json').relative_to(ROOT)),'sha256':sha((BASE/'scrape-enrichment.json').read_bytes()),'additionalHistoricalRows':len(new_history_rows)}
 if capture_path.exists():manifest['eventSourceVerification']={'path':str(capture_path.relative_to(ROOT)),'sha256':sha(capture_path.read_bytes()),'attempted':len(captures['captures']),'verified':sum(x['captureStatus']=='verified_metadata' for x in captures['captures']),'bodyRedistributed':False}
 native_ends=[]
 for row in data['history']:
  native=json.loads(row['Native row JSON']) if row.get('Native row JSON') else {}
  end=(native.get('lastObservedDate') if isinstance(native,dict) else None) or period_date(row['Period'],True)
  if end:native_ends.append(min(end,ASOF))
 manifest['collectionEnvelope']['end']=max(native_ends)
 manifest['collectionEnvelope']['endBasis']='Latest native observation date where available; incomplete period boundaries do not extend into future dates'
 manifest['collectionEnvelope']['snapshotAsOf']=ASOF
 if alias_path.exists():manifest['seriesIdReconciliation']={'path':str(alias_path.relative_to(ROOT)),'sha256':sha(alias_path.read_bytes()),'matchedSeries':len(aliases['aliases']),'matchedNativeRows':sum(x['matchedRows'] for x in aliases['aliases']),'classification':'exact_area_context_tuple_match'}
 if rates_path.exists():manifest['uaePolicyRateEvidence']={'path':str(rates_path.relative_to(ROOT)),'sha256':sha(rates_path.read_bytes()),'version':rates['version'],'coverage':rates['coverage'],'observations':len(rates['observations']),'classification':rates['classification'],'limits':rates['limitations']}
 eibor_path=BASE/'cbuae-eibor-source-manifest.json'
 if eibor_path.exists():
  eibor=read_json(eibor_path);manifest['cbuaeEiborArchive']={'path':str(eibor_path.relative_to(ROOT)),'sha256':sha(eibor_path.read_bytes()),'version':eibor['version'],'coverage':eibor['coverage'],'currentFixing':eibor.get('currentFixing'),'classification':eibor['classification'],'numericIngestionStatus':'source_indexed; continuous native file parsing pending checksum capture'}
 manifest['originalCollectionRows']=original_collected_rows;manifest['originalReleasableObservationRows']=original_public_rows;manifest['supplementHistoricalObservationRows']=supplement_rows;manifest['extendedTotalObservationRows']=collected_rows
 if early:
  manifest['earlyHistoricalEnrichment']={'path':str(early_path.relative_to(ROOT)),'sha256':sha(early_path.read_bytes()),'counts':early['counts'],'coverage':early['coverage'],'methodology':early['methodology'],'source':early['source'],'rawArchive':early['rawArchive'],'linkedRecords':sum(any(s['id'].startswith('early-dred-') for s in r['historySeries']) for r in records),'classification':'retrospective_area_context; no subject identity promotion'}
  manifest['inputProvenance']={**inputs,'earlyHistory':{**early['input'],'format':'csv','normalization':'retrospective source-area Unit/Villa Residential aggregate','sourceSHA256':early['source']['sha256']}}
 evaluation=BASE/'forecast-evaluation.json'
 if evaluation.exists():manifest['forecastEvaluation']={'path':str(evaluation.relative_to(ROOT)),'sha256':sha(evaluation.read_bytes()),'classification':'research_validation_not_production_approval'}
 snapshot={'version':VERSION,'asOf':ASOF,'records':records,'sources':list(sources.values()),'events':events,'exposures':exposures,'exposureRules':exposure_rules,'manifest':manifest}
 dump_json(ROOT/'data/historical-intelligence-20261003.json',snapshot)
 index={**snapshot,'records':[{**{k:v for k,v in x.items() if k!='historySeries'},'historySeriesIds':[s['id'] for s in x['historySeries']]} for x in records],'series':[ {k:v for k,v in s.items() if k!='points'} for s in series.values()]}
 indexobj=gzip_object(index,'full_snapshot_index');dump_json(BASE/'publication-manifest.json',{'version':VERSION,'asOf':ASOF,'rootIndex':indexobj,'objects':objects+[indexobj],'counts':{'records':1860,'projects':1645,'communities':215,'historicalRows':public_rows,'collectedHistoricalRows':collected_rows,'originalCollectionRows':original_collected_rows,'supplementHistoricalRows':supplement_rows,'rightsPendingRows':collected_rows-public_rows,'series':len(series),'events':len(events),'exposures':len(exposures),'sources':len(sources)}})
 # Append-only SQL index; values are complete JSON literals, not shell interpolations.
 def lit(value):return "'"+str(value).replace("'","''")+"'"
 sql=['PRAGMA foreign_keys = ON;',f'INSERT OR IGNORE INTO hi_snapshots(snapshot_version,as_of,record_count,manifest_json,root_sha256) VALUES({lit(VERSION)},{lit(ASOF)},1860,{lit(encoded(manifest).decode())},{lit(indexobj["sha256"])});']
 for r in records:sql.append(f'INSERT OR IGNORE INTO hi_records(snapshot_version,record_id,record_type,name,emirate,record_json) VALUES({lit(VERSION)},{lit(r["id"])},{lit(r["type"])},{lit(r["name"])},{lit(r["emirate"])},{lit(encoded({k:v for k,v in r.items() if k!="historySeries"}).decode())});')
 for s in sources.values():sql.append(f'INSERT OR IGNORE INTO hi_sources(snapshot_version,source_id,url,source_json) VALUES({lit(VERSION)},{lit(s["id"])},{lit(s["url"])},{lit(encoded(s).decode())});')
 for e in events:sql.append(f'INSERT OR IGNORE INTO hi_events(snapshot_version,event_id,event_json) VALUES({lit(VERSION)},{lit(e["id"])},{lit(encoded(e).decode())});')
 for e in exposures:sql.append(f'INSERT OR IGNORE INTO hi_exposures(snapshot_version,exposure_id,event_id,record_id,scope,verified,exposure_json) VALUES({lit(VERSION)},{lit(e["id"])},{lit(e["eventId"])},{lit(e["recordId"])},{lit(e["scope"])},{int(e["verified"])},{lit(encoded(e).decode())});')
 for s in series.values():sql.append(f'INSERT OR IGNORE INTO hi_series(snapshot_version,series_id,source_id,series_json) VALUES({lit(VERSION)},{lit(s["id"])},{lit(s["sourceId"])},{lit(encoded({k:v for k,v in s.items() if k!="points"}).decode())});')
 for r in records:
  for s in r['historySeries']:sql.append(f'INSERT OR IGNORE INTO hi_record_series(snapshot_version,record_id,series_id,scope,identity_verified) VALUES({lit(VERSION)},{lit(r["id"])},{lit(s["id"])},{lit(s["scope"])},{int(s.get("identityVerified",False))});')
 indexsql=immutable(gzip.compress(('\n'.join(sql)+'\n').encode(),mtime=0),'.sql.gz','d1_append_only_index')
 publication=read_json(BASE/'publication-manifest.json');publication['d1Index']=indexsql;dump_json(BASE/'publication-manifest.json',publication)
 build_runtime_index(snapshot,publication)
 print(json.dumps({'version':VERSION,**publication['counts'],'partitions':len(partition_groups),'embeddedBytes':(ROOT/'data/historical-intelligence-20261003.json').stat().st_size,'sourceCandidateProjects':len(candidate_p),'sourceCandidateCommunities':len(candidate_c),'unresolvedLegacySeriesIds':len({s for r in records for s in r['researchStatus']['unresolvedSeriesIds']}),'approvedSubjectHistoryRecords':sum(any(s['scope']=='subject' and s.get('identityVerified') for s in r['historySeries']) for r in records),'approvedSubjectHistoryRecordMetricPairs':manifest['directSubjectSaleHistoryRecords']+manifest['directSubjectRentHistoryRecords'],'approved2080Forecasts':0,'objectsBytes':sum(x['bytes'] for x in publication['objects'])}))

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--runtime-only',action='store_true');parser.add_argument('--import-workspace',type=pathlib.Path);parser.add_argument('--version',default=VERSION);parser.add_argument('--as-of',default=ASOF);parser.add_argument('--enrichment-sidecar',action='append',default=None);args=parser.parse_args()
 if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,79}',args.version):parser.error('version must be 1–80 letters, digits, dots, underscores or hyphens; start with a letter or digit')
 try:
  parsed=datetime.date.fromisoformat(args.as_of)
  if parsed.isoformat()!=args.as_of:raise ValueError('Use YYYY-MM-DD')
 except ValueError:parser.error('as-of must be a valid date in YYYY-MM-DD format')
 VERSION=args.version;ASOF=args.as_of;ENRICHMENT_SIDECARS=args.enrichment_sidecar if args.enrichment_sidecar is not None else ENRICHMENT_SIDECARS
 if args.runtime_only:
  runtime=build_runtime_index(read_json(ROOT/'data/historical-intelligence-20261003.json'),read_json(BASE/'publication-manifest.json'))
  print(json.dumps(runtime['manifest']['runtime']));raise SystemExit(0)
 if args.import_workspace:import_inputs(args.import_workspace)
 build()
