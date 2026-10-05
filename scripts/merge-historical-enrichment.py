#!/usr/bin/env python3
"""Reviewable merger of public fact packets; never copies raw website bodies."""
import argparse,json,pathlib,hashlib,collections,datetime
parser=argparse.ArgumentParser();parser.add_argument('--packet',action='append',type=pathlib.Path,required=True);parser.add_argument('--retained-packet',action='append',type=pathlib.Path,default=[]);parser.add_argument('--output',type=pathlib.Path,required=True);parser.add_argument('--as-of',default='2026-10-05');parser.add_argument('--baseline-snapshot',type=pathlib.Path);args=parser.parse_args()
datetime.date.fromisoformat(args.as_of)
merged={'schemaVersion':1,'asOf':args.as_of,'sources':[],'facts':[],'seriesLinks':[],'recordResearch':[],'historyInputs':[],'licensedArchives':[],'additionalDatasets':[],'sourceCandidates':[],'collection':{'passes':[]},'methodology':'Primary registers and attributable public fact extraction. Exact identity gates precede subject links. Current-vintage historical inputs are unavailable at earlier forecast origins. Fetch coverage, lifecycle coverage and observed financial coverage remain separate. Raw pages and primary individual registers remain private.'}
seen=collections.defaultdict(dict);research={};source_urls={}
canonical=lambda url:str(url or '').split('#')[0].rstrip('/')
retained_packets={path.resolve() for path in args.retained_packet}
if not retained_packets.issubset({path.resolve() for path in args.packet}):raise ValueError('Retained packet must also be an input')
if args.baseline_snapshot:
 for row in json.loads(args.baseline_snapshot.read_text())['sources']:
  if row.get('url') and not row.get('preserveRevision'):source_urls.setdefault(canonical(row['url']),row)
for packet_index,path in enumerate(args.packet):
 packet=json.loads(path.read_text())
 if packet.get('schemaVersion')!=1 or not packet.get('asOf') or packet.get('asOf')>args.as_of:raise ValueError('Bad packet version/date')
 for key in ['sources','facts','seriesLinks','historyInputs','licensedArchives','additionalDatasets','sourceCandidates']:
  for row in packet.get(key,[]):
   row={k:v for k,v in row.items() if k not in ['excerpt','rawBody','rawHTML','rawHeaders','localPath','htmlPath','textPath','privatePath']}
   if key=='sources':row['url']=canonical(row.get('url'))
   identity=row.get('id') or (row.get('seriesId','')+':'+row.get('recordId','') if key=='seriesLinks' else json.dumps(row,sort_keys=True))
   if key=='sources' and (packet_index or args.baseline_snapshot) and path.resolve() not in retained_packets and identity not in seen[key] and not row.get('preserveRevision'):
    predecessor=source_urls.get(canonical(row.get('url')))
    if predecessor and any(row.get(k) is not None and row.get(k)!=predecessor.get(k) for k in ['retrievedAt','sha256','publishedAt','firstAvailableAt','datasetVersion']):
     row={**row,'preserveRevision':True,'revisionOfSourceId':predecessor['id']}
   prior=seen[key].get(identity)
   if prior is not None:
    if prior!=row:
     if key=='sources' and not any(prior.get(k) is not None and row.get(k) is not None and prior[k]!=row[k] for k in set(prior)&set(row)):prior.update(row)
     else:raise ValueError('Conflicting packet entry '+key+':'+identity)
    continue
   seen[key][identity]=row;merged[key].append(row)
   if key=='sources' and row.get('url'):source_urls.setdefault(canonical(row['url']),row)
 for row in packet.get('recordResearch',[]):
  rid=row['recordId'];old=research.get(rid,{})
  combined={**old,**row}
  for key in ['sourceIds','captureSourceIds']:
   combined[key]=list(dict.fromkeys(old.get(key,[])+row.get(key,[])))
  for key in ['acceptedFactCount','candidateCount','directRegisteredSaleObservationsAdded','directSignedRentObservationsAdded','validatedForecastPointsAdded']:
   if key in old or key in row:combined[key]=old.get(key,0)+row.get(key,0)
  incoming_passes=row.get('collectionPasses') or [{k:v for k,v in row.items() if k not in ['recordId','collectionPasses']}]
  combined['collectionPasses']=old.get('collectionPasses',[])+incoming_passes
  if row.get('status','').startswith('not_collected') and old.get('status'):combined['status']=old['status']
  research[rid]=combined
 collection={k:v for k,v in packet.get('collection',{}).items() if k not in ['privateRawRoot','privateRoot','rawRoot','localRoot']}
 if collection.get('passes'):
  merged['collection']['passes'].extend(collection['passes'])
 else:merged['collection']['passes'].append({'packetSHA256':hashlib.sha256(path.read_bytes()).hexdigest(),'collection':collection,'packetFile':path.name})
fact_counts=collections.Counter(row['recordId'] for row in merged['facts'] if row.get('status')=='accepted')
for row in research.values():
 row['acceptedFactCount']=fact_counts[row['recordId']]
 row['status']=row.get('status') or ' / '.join(str(row.get(x)) for x in ['externalSourceStatus','mirrorStatus'] if row.get(x)) or 'sources_reviewed'
 merged['recordResearch'].append(row)
args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(merged,ensure_ascii=False,sort_keys=True,separators=(',',':'))+'\n')
print(json.dumps({k:len(merged[k]) for k in ['sources','facts','seriesLinks','recordResearch','historyInputs','licensedArchives','sourceCandidates']}))
