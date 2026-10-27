#!/usr/bin/env python3
"""Materialize accepted V48 as a new immutable local archive. No network or deployment."""
import argparse,gzip,hashlib,importlib.util,json
from copy import deepcopy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'data/historical-intelligence'
canonical=lambda v:json.dumps(v,ensure_ascii=False,separators=(',',':'),sort_keys=True).encode()
digest=lambda b:hashlib.sha256(b).hexdigest()
PRIOR='20261014-enrichment-v47';VERSION='20261014-enrichment-v48'
def require(ok,msg):
 if not ok:raise ValueError(msg)
def immutable(blob,suffix,kind):
 h=digest(blob);p=BASE/'objects'/(h+suffix)
 if p.exists():require(p.read_bytes()==blob,'Immutable collision')
 else:p.write_bytes(blob)
 return dict(key='research/published/2026-10-14/historical-intelligence/objects/'+p.name,path=str(p.relative_to(ROOT)),sha256=h,bytes=len(blob),kind=kind,compression='gzip')
def pack(directory):
 target=ROOT/'data/historical-intelligence-20261003.json';manifest_path=BASE/'publication-manifest.json'
 snapshot=json.loads((directory/'candidate-snapshot.json').read_bytes());receipt=json.loads((directory/'reconciliation.json').read_bytes());publication=json.loads(manifest_path.read_bytes());original=json.loads(target.read_bytes())
 require(snapshot['version']==receipt['version']==VERSION and original['version']==publication['version']==PRIOR,'Version mismatch')
 require(digest(target.read_bytes())==receipt['priorSHA256'],'Baseline checksum mismatch')
 rootbytes=(ROOT/publication['rootIndex']['path']).read_bytes();require(digest(rootbytes)==publication['rootIndex']['sha256'],'Root checksum mismatch');root=json.loads(gzip.decompress(rootbytes))
 require(root['version']==PRIOR,'Root baseline mismatch')
 changed=set(receipt['changedRecords']);known={r['id']:r for r in snapshot['records']}
 require(len(known)==1860 and {r['id'] for r in original['records']}==known.keys(),'Catalogue changed')
 for old,new in zip(original['records'],snapshot['records']):
  if old['id'] not in changed:require(old==new,'Unaffected record changed before packaging')
 require(snapshot['sources'][:len(original['sources'])]==original['sources'],'Source identities changed')
 require(snapshot['events']==original['events'] and snapshot['exposures']==original['exposures'],'Event mutation')
 new_history=[];pointers={};native_before=hashlib.sha256();native_after=hashlib.sha256();native_count=0
 for obj in publication['objects']:
  if obj['kind']!='history_partition':continue
  raw=(ROOT/obj['path']).read_bytes();require(digest(raw)==obj['sha256'],'Prior native partition checksum');archive=json.loads(gzip.decompress(raw));require(archive['version']==PRIOR,'Prior native version')
  native_before.update(canonical(archive['series']));native_count+=len(archive['series']);archive['version']=VERSION;archive['asOf']=snapshot['asOf']
  new=immutable(gzip.compress(canonical(archive),mtime=0),'.json.gz','history_partition');new_history.append(new);native_after.update(canonical(archive['series']))
  pointer={k:new[k] for k in ['key','sha256','bytes','compression']}
  for series in archive['series']:require(series['id'] not in pointers,'Duplicate native series');pointers[series['id']]=pointer
 require(native_before.digest()==native_after.digest(),'Native observations changed')
 require(native_count==len(root['series']),'Series lost')
 for record in snapshot['records']:
  for series in record.get('historySeries',[]):
   if series.get('partition'):series['partition']=pointers[series['id']]
 for series in root['series']:series['partition']=pointers[series['id']]
 for record in root['records']:
  if record['id'] in changed:
   full=known[record['id']]
   for key in ['lifecycle','observations','researchStatus','coverageSummary']:record[key]=deepcopy(full[key])
 root.update(version=VERSION,asOf=snapshot['asOf'],manifest=snapshot['manifest'],sources=snapshot['sources'])
 rootobj=immutable(gzip.compress(canonical(root),mtime=0),'.json.gz','full_snapshot_index')
 replaced={'runtime_history_partition','runtime_record_shard','runtime_index','history_partition','full_snapshot_index'}
 objects=[o for o in publication['objects'] if o['kind'] not in replaced]+new_history+[rootobj];counts=dict(publication['counts']);counts['sources']=len(snapshot['sources'])
 new_manifest=dict(version=VERSION,asOf=snapshot['asOf'],rootIndex=rootobj,objects=objects,counts=counts)
 sql=['PRAGMA foreign_keys = ON;'];literal=lambda x:"'"+str(x).replace("'","''")+"'"
 def insert(table,cols,vals):sql.append(f"INSERT OR IGNORE INTO {table}({','.join(cols)}) VALUES({','.join(str(v) if isinstance(v,int) else literal(v) for v in vals)});")
 insert('hi_snapshots',['snapshot_version','as_of','record_count','manifest_json','root_sha256'],[VERSION,snapshot['asOf'],1860,canonical(snapshot['manifest']).decode(),rootobj['sha256']])
 for r in root['records']:insert('hi_records',['snapshot_version','record_id','record_type','name','emirate','record_json'],[VERSION,r['id'],r['type'],r['name'],r['emirate'],canonical({k:v for k,v in r.items() if k!='historySeriesIds'}).decode()])
 for s in snapshot['sources']:insert('hi_sources',['snapshot_version','source_id','url','source_json'],[VERSION,s['id'],s.get('url',''),canonical(s).decode()])
 for e in snapshot['events']:insert('hi_events',['snapshot_version','event_id','event_json'],[VERSION,e['id'],canonical(e).decode()])
 for e in snapshot['exposures']:insert('hi_exposures',['snapshot_version','exposure_id','event_id','record_id','scope','verified','exposure_json'],[VERSION,e['id'],e['eventId'],e['recordId'],e['scope'],int(e['verified']),canonical(e).decode()])
 descriptors={s['id']:s for s in root['series']}
 for s in root['series']:insert('hi_series',['snapshot_version','series_id','source_id','series_json'],[VERSION,s['id'],s['sourceId'],canonical(s).decode()])
 for r in root['records']:
  for sid in r.get('historySeriesIds',[]):
   s=descriptors[sid];insert('hi_record_series',['snapshot_version','record_id','series_id','scope','identity_verified'],[VERSION,r['id'],sid,s.get('scope','area_context'),int(s.get('identityVerified',False))])
 new_manifest['d1Index']=immutable(gzip.compress(('\n'.join(sql)+'\n').encode(),mtime=0),'.sql.gz','d1_append_only_index')
 target.write_bytes(canonical(snapshot)+b'\n');target.with_suffix('.json.gz').write_bytes(gzip.compress(target.read_bytes(),compresslevel=9,mtime=0));manifest_path.write_bytes(canonical(new_manifest)+b'\n')
 spec=importlib.util.spec_from_file_location('builder',ROOT/'scripts/build-historical-data.py');builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder);builder.ASOF=snapshot['asOf'];builder.build_runtime_index(snapshot,new_manifest)
 receipt.update(nativeSeriesDigestBefore=native_before.hexdigest(),nativeSeriesDigestAfter=native_after.hexdigest(),nativeSeriesCount=native_count,historicalRowsPreserved=counts['historicalRows'],rootSHA256=rootobj['sha256'],canonicalSHA256=digest(target.read_bytes()),publicationState='local_candidate_only_not_published',remoteWrites=0)
 (BASE/'aldar-launches-20261014/reconciliation.json').write_bytes(canonical(receipt)+b'\n');print(json.dumps({k:v for k,v in receipt.items() if k!='itemChanges'}))
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--candidate-dir',type=Path,required=True);pack(p.parse_args().candidate_dir)
