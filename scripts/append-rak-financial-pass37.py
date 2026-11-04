#!/usr/bin/env python3
"""Append reviewed dated profile evidence to V37 without replacing any prior evidence."""
import collections
import gzip
import hashlib
import importlib.util
import json
from copy import deepcopy
from pathlib import Path
from historical_enrichment import apply_enrichment

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'data/historical-intelligence'
SNAPSHOT_PATH=ROOT/'data/historical-intelligence-20261003.json'
PUBLICATION_PATH=BASE/'publication-manifest.json'
PACKET_PATH=BASE/'rak-properties-financial-pass37-20261008.json'
VERSION='20261008-enrichment-v37'
PRIOR='20261008-enrichment-v36'
canonical=lambda x:json.dumps(x,ensure_ascii=False,separators=(',',':'),sort_keys=True).encode()
sha=lambda x:hashlib.sha256(x).hexdigest()
lit=lambda x:"'"+str(x).replace("'","''")+"'"

def immutable(blob,suffix,kind):
 digest=sha(blob);path=BASE/'objects'/f'{digest}{suffix}'
 if path.exists() and path.read_bytes()!=blob:raise ValueError('Immutable collision')
 if not path.exists():path.write_bytes(blob)
 return {'key':f'research/published/2026-10-08/historical-intelligence/objects/{path.name}','path':str(path.relative_to(ROOT)),'sha256':digest,'bytes':len(blob),'kind':kind,'compression':'gzip'}

def main():
 snapshot=json.loads(SNAPSHOT_PATH.read_bytes());publication=json.loads(PUBLICATION_PATH.read_bytes());packet=json.loads(PACKET_PATH.read_bytes())
 assert snapshot['version']==publication['version']==packet['priorVersion']==PRIOR
 assert packet['candidateVersion']==VERSION
 original=deepcopy(snapshot)
 prior_root=json.loads(gzip.decompress((ROOT/publication['rootIndex']['path']).read_bytes()))
 assert sha((ROOT/publication['rootIndex']['path']).read_bytes())==publication['rootIndex']['sha256']
 backup=ROOT/'.local-data/rak-financial-pass37/baseline';backup.mkdir(parents=True,exist_ok=True)
 for file in [SNAPSHOT_PATH,PUBLICATION_PATH]:
  target=backup/file.name
  if not target.exists():target.write_bytes(file.read_bytes())
 known={r['id']:r for r in snapshot['records']};changed={f['recordId'] for f in packet['facts']}
 assert len(changed)==8 and len(packet['facts'])==17 and len(packet['sources'])==3
 for check in packet['recordIdentityChecks']:
  r=known[check['recordId']]
  assert (r['name'],r['type'],r['emirate'])==(check['catalogueName'],check['type'],check['emirate'])
  assert not any(x.get('scope')=='subject' and x.get('identityVerified') for x in r['historySeries']), 'This pass must not recalculate subject financial cohorts'
 sources={s['id']:s for s in snapshot['sources']}
 def add_source(s):
  assert s['id'] not in sources
  same=[x for x in sources.values() if x.get('url','').rstrip('/')==s['url'].rstrip('/')]
  if same:assert s.get('preserveRevision') and s.get('revisionOfSourceId') in {x['id'] for x in same}
  sources[s['id']]=deepcopy(s);snapshot['sources'].append(sources[s['id']]);return s['id']
 affected=[r for r in snapshot['records'] if r['id'] in changed]
 result=apply_enrichment(packet,affected,{},sources,add_source,{},snapshot['asOf'])
 # No event links or inherited community context changed in this pass. Keep
 # their exact existing ledger evidence instead of refreshing with empty input.
 allowed_items={'announcement_registration','construction','construction_targets','handover_targets','delivery_reports','phase_milestones','advertised_prices'}
 before_by_id={r['id']:r for r in original['records']}
 for r in affected:
  before=before_by_id[r['id']]
  for key,item in before['researchStatus']['itemCoverage'].items():
   if key not in allowed_items:r['researchStatus']['itemCoverage'][key]=deepcopy(item)
  assert r['currentSnapshot']==before['currentSnapshot']
  assert r['scenarioInputs']==before['scenarioInputs'] and r['scenarioCoverage']==before['scenarioCoverage']
  assert r['lifecycle'][:len(before['lifecycle'])]==before['lifecycle']
  assert r['observations'][:len(before['observations'])]==before['observations']
 for before,after in zip(original['records'],snapshot['records']):
  if before['id'] not in changed:assert before==after
 assert len(snapshot['records'])==1860 and sum(r['type']=='project' for r in snapshot['records'])==1645
 assert snapshot['sources'][:len(original['sources'])]==original['sources']
 assert snapshot['events']==original['events'] and snapshot['exposures']==original['exposures']
 snapshot['version']=VERSION;snapshot['manifest']['version']=VERSION
 snapshot['manifest']['rakPrimaryFinancialPass37']={**packet['collection'],'sourcesAdded':3,'conflicts':packet['conflicts'],'excludedCandidates':packet['excludedCandidates'],'packetSHA256':sha(PACKET_PATH.read_bytes()),'packetPath':str(PACKET_PATH.relative_to(ROOT))}
 snapshot['manifest']['sourceEnrichment'].setdefault('supplementalPasses',[]).append({'passId':packet['passId'],**result})
 manifest=snapshot['manifest']
 new_history=[];pointers={}
 for prior in publication['objects']:
  if prior['kind']!='history_partition':continue
  blob=(ROOT/prior['path']).read_bytes();assert sha(blob)==prior['sha256']
  archive=json.loads(gzip.decompress(blob));assert archive['version']==PRIOR
  archive['version']=VERSION
  obj=immutable(gzip.compress(canonical(archive),mtime=0),'.json.gz','history_partition');new_history.append(obj)
  pointer={k:obj[k] for k in ['key','sha256','bytes','compression']}
  for series in archive['series']:
   assert series['id'] not in pointers;pointers[series['id']]=pointer
 assert len(pointers)==len(prior_root['series'])
 for r in snapshot['records']:
  for s in r.get('historySeries',[]):
   if s.get('partition'):s['partition']=pointers[s['id']]
 for s in prior_root['series']:s['partition']=pointers[s['id']]
 compact=[]
 for r in prior_root['records']:
  if r['id'] in changed:
   full=known[r['id']]
   for key in ['lifecycle','observations','researchStatus','coverageSummary']:
    r[key]=deepcopy(full[key])
  compact.append(r)
 prior_root.update(version=VERSION,manifest=manifest,sources=snapshot['sources'],records=compact)
 root_obj=immutable(gzip.compress(canonical(prior_root),mtime=0),'.json.gz','full_snapshot_index')
 replaced={'runtime_history_partition','runtime_record_shard','runtime_index','history_partition','full_snapshot_index'}
 objects=[o for o in publication['objects'] if o['kind'] not in replaced]+new_history+[root_obj]
 counts=dict(publication['counts']);counts['sources']=len(snapshot['sources'])
 new_publication={'version':VERSION,'asOf':snapshot['asOf'],'rootIndex':root_obj,'objects':objects,'counts':counts}
 sql=['PRAGMA foreign_keys = ON;']
 def insert(table,columns,values):sql.append(f"INSERT OR IGNORE INTO {table}({','.join(columns)}) VALUES({','.join(str(v) if isinstance(v,int) else lit(v) for v in values)});")
 insert('hi_snapshots',['snapshot_version','as_of','record_count','manifest_json','root_sha256'],[VERSION,snapshot['asOf'],1860,canonical(manifest).decode(),root_obj['sha256']])
 for r in compact:insert('hi_records',['snapshot_version','record_id','record_type','name','emirate','record_json'],[VERSION,r['id'],r['type'],r['name'],r['emirate'],canonical({k:v for k,v in r.items() if k!='historySeriesIds'}).decode()])
 for s in snapshot['sources']:insert('hi_sources',['snapshot_version','source_id','url','source_json'],[VERSION,s['id'],s.get('url',''),canonical(s).decode()])
 for e in snapshot['events']:insert('hi_events',['snapshot_version','event_id','event_json'],[VERSION,e['id'],canonical(e).decode()])
 for e in snapshot['exposures']:insert('hi_exposures',['snapshot_version','exposure_id','event_id','record_id','scope','verified','exposure_json'],[VERSION,e['id'],e['eventId'],e['recordId'],e['scope'],int(e['verified']),canonical(e).decode()])
 descriptors={s['id']:s for s in prior_root['series']}
 for s in prior_root['series']:insert('hi_series',['snapshot_version','series_id','source_id','series_json'],[VERSION,s['id'],s['sourceId'],canonical(s).decode()])
 for r in compact:
  for sid in r.get('historySeriesIds',[]):
   s=descriptors[sid];insert('hi_record_series',['snapshot_version','record_id','series_id','scope','identity_verified'],[VERSION,r['id'],sid,s.get('scope','area_context'),int(s.get('identityVerified',False))])
 new_publication['d1Index']=immutable(gzip.compress(('\n'.join(sql)+'\n').encode(),mtime=0),'.sql.gz','d1_append_only_index')
 SNAPSHOT_PATH.write_bytes(canonical(snapshot)+b'\n');SNAPSHOT_PATH.with_suffix('.json.gz').write_bytes(gzip.compress(SNAPSHOT_PATH.read_bytes(),compresslevel=9,mtime=0))
 PUBLICATION_PATH.write_bytes(canonical(new_publication)+b'\n')
 spec=importlib.util.spec_from_file_location('build_historical_data',ROOT/'scripts/build-historical-data.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);module.build_runtime_index(snapshot,new_publication)
 ledger=collections.Counter(item['status'] for r in snapshot['records'] for item in r['researchStatus']['itemCoverage'].values())
 receipt={'version':VERSION,'changedRecords':sorted(changed),'newLifecycleFacts':10,'newRegisteredSalesOrRents':0,'newDeveloperSalesSnapshots':7,'newSources':3,'historicalRowsPreserved':counts['historicalRows'],'seriesPreserved':counts['series'],'ledger':dict(ledger),'rootSHA256':root_obj['sha256']}
 (BASE/'rak-pass37-reconciliation.json').write_bytes(canonical(receipt)+b'\n');print(json.dumps(receipt))

if __name__=='__main__':main()
