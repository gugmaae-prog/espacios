#!/usr/bin/env python3
"""Reviewable merger of public fact packets; never copies raw website bodies."""
import argparse,json,pathlib,hashlib,collections
parser=argparse.ArgumentParser();parser.add_argument('--packet',action='append',type=pathlib.Path,required=True);parser.add_argument('--output',type=pathlib.Path,required=True);args=parser.parse_args()
merged={'schemaVersion':1,'asOf':'2026-10-05','sources':[],'facts':[],'seriesLinks':[],'recordResearch':[],'historyInputs':[],'licensedArchives':[],'additionalDatasets':[],'sourceCandidates':[],'collection':{'passes':[]},'methodology':'Primary registers and attributable public fact extraction. Exact identity gates precede subject links. Current-vintage historical inputs are unavailable at earlier forecast origins. Fetch coverage, lifecycle coverage and observed financial coverage remain separate. Raw pages and primary individual registers remain private.'}
seen=collections.defaultdict(dict);research={}
for path in args.packet:
 packet=json.loads(path.read_text())
 if packet.get('schemaVersion')!=1 or packet.get('asOf')>'2026-10-05':raise ValueError('Bad packet version/date')
 for key in ['sources','facts','seriesLinks','historyInputs','licensedArchives','additionalDatasets','sourceCandidates']:
  for row in packet.get(key,[]):
   row={k:v for k,v in row.items() if k not in ['excerpt','rawBody','rawHTML','rawHeaders','localPath','htmlPath','textPath','privatePath']}
   identity=row.get('id') or (row.get('seriesId','')+':'+row.get('recordId','') if key=='seriesLinks' else json.dumps(row,sort_keys=True))
   prior=seen[key].get(identity)
   if prior is not None:
    if prior!=row:
     if key=='sources' and not any(prior.get(k) is not None and row.get(k) is not None and prior[k]!=row[k] for k in set(prior)&set(row)):prior.update(row)
     else:raise ValueError('Conflicting packet entry '+key+':'+identity)
    continue
   seen[key][identity]=row;merged[key].append(row)
 for row in packet.get('recordResearch',[]):
  rid=row['recordId'];old=research.get(rid,{})
  combined={**old,**row}
  for key in ['sourceIds','captureSourceIds']:
   combined[key]=list(dict.fromkeys(old.get(key,[])+row.get(key,[])))
  for key in ['acceptedFactCount','candidateCount','directRegisteredSaleObservationsAdded','directSignedRentObservationsAdded','validatedForecastPointsAdded']:
   if key in old or key in row:combined[key]=old.get(key,0)+row.get(key,0)
  combined['collectionPasses']=old.get('collectionPasses',[])+[{k:v for k,v in row.items() if k!='recordId'}]
  if row.get('status','').startswith('not_collected') and old.get('status'):combined['status']=old['status']
  research[rid]=combined
 collection={k:v for k,v in packet.get('collection',{}).items() if k not in ['privateRawRoot','privateRoot','rawRoot','localRoot']}
 merged['collection']['passes'].append({'packetSHA256':hashlib.sha256(path.read_bytes()).hexdigest(),'collection':collection,'packetFile':path.name})
for row in research.values():
 row['status']=row.get('status') or ' / '.join(str(row.get(x)) for x in ['externalSourceStatus','mirrorStatus'] if row.get(x)) or 'sources_reviewed'
 merged['recordResearch'].append(row)
args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(merged,ensure_ascii=False,sort_keys=True,separators=(',',':'))+'\n')
print(json.dumps({k:len(merged[k]) for k in ['sources','facts','seriesLinks','recordResearch','historyInputs','licensedArchives','sourceCandidates']}))
