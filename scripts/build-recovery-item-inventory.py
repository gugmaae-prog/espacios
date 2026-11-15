#!/usr/bin/env python3
"""Pack the existing full public item-ledger response as one immutable stream.
Every record/ledger comes unchanged from checksum-verified accepted V48 shards.
"""
import json,gzip,pathlib,hashlib
R=pathlib.Path(__file__).resolve().parents[1]
m=json.loads((R/'data/historical-intelligence/publication-manifest.json').read_text());index=json.loads((R/'data/historical-intelligence/runtime-index.json').read_text());records={};sources=[]
for obj in m['objects']:
 if obj['kind']!='runtime_record_shard':continue
 raw=(R/obj['path']).read_bytes();assert len(raw)==obj['bytes'] and hashlib.sha256(raw).hexdigest()==obj['sha256']
 shard=json.loads(gzip.decompress(raw));assert shard['version']==m['version'] and shard['asOf']==m['asOf']
 sources.append({k:obj[k] for k in ['key','sha256','bytes']})
 for rec in shard['records']:
  assert rec['id'] not in records
  records[rec['id']]={k:rec.get(k) for k in ['id','type','name','emirate','communityId','researchStatus']};records[rec['id']]['communityId']=rec.get('communityId') or None
assert len(records)==1860 and set(records)==set(r['id'] for r in index['records'])
payload={'version':index['version'],'asOf':index['asOf'],'records':[records[r['id']] for r in index['records']],'manifest':index['manifest']}
raw=json.dumps(payload,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode();z=gzip.compress(raw,compresslevel=9,mtime=0)
path=R/'data/recovery/full-item-inventory.json.gz';path.write_bytes(z);decoded=json.loads(gzip.decompress(z));assert decoded==payload
entry={'key':'research/published/2026-10-14/recovery-native-v48/full-item-inventory.json.gz','path':str(path.relative_to(R)),'sha256':hashlib.sha256(z).hexdigest(),'bytes':len(z),'compression':'gzip','decodedBytes':len(raw),'decodedSHA256':hashlib.sha256(raw).hexdigest(),'kind':'recovery_public_item_inventory_stream','records':1860,'sourceShards':sources,'valuesRecalculated':False,'format':'Exact existing public full-ledger response fields; no native points or licensed raw archives are added.'}
(R/'data/recovery/full-item-inventory.manifest.json').write_text(json.dumps(entry,indent=2)+'\n')
print(json.dumps({k:v for k,v in entry.items() if k!='sourceShards'}))
