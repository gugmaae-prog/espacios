#!/usr/bin/env python3
"""Storage-only index/repacking of accepted immutable V48 native evidence.
Original archive digests remain provenance; new gzip envelope digests are separate.
"""
import json,gzip,hashlib,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
manifest=json.loads((ROOT/'data/historical-intelligence/publication-manifest.json').read_text())
assert manifest['version']=='20261014-enrichment-v48'
def encode(value):return json.dumps(value,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()
def canonical(value):return json.dumps(value,ensure_ascii=False,separators=(',',':'),sort_keys=True,allow_nan=False).encode()
def sha(b):return hashlib.sha256(b).hexdigest()
series={};native_points=0;partitions=[];new_objects=[];replaced=[];proof=[];max_decoded=0
out=ROOT/'data/recovery/native-shards';out.mkdir(exist_ok=True)
fields=['id','geography','emirate','metric','sourceMetric','unit','frequency','segment','registration','scope','identityVerified','sourceId','classification','pointCount']
for item in manifest['objects']:
 if item['kind']!='history_partition':continue
 raw=(ROOT/item['path']).read_bytes();assert len(raw)==item['bytes'] and sha(raw)==item['sha256']
 decoded=gzip.decompress(raw);part=json.loads(decoded)
 assert part['version']==manifest['version'] and part['asOf']==manifest['asOf']
 batches=[]
 if len(decoded)>4*1024*1024:
  replaced.append(item['key']);batch=[];batch_bytes=0
  for original in part['series']:
   size=len(encode(original));assert size<16*1024*1024,('one series requires point sharding',original['id'],size)
   if batch and batch_bytes+size>2*1024*1024:batches.append(batch);batch=[];batch_bytes=0
   batch.append(original);batch_bytes+=size
  if batch:batches.append(batch)
 else:batches=[part['series']]
 for batch in batches:
  if item['key'] in replaced:
   envelope={k:v for k,v in part.items() if k!='series'};envelope['series']=batch
   envelope['recoveryEnvelope']={'classification':'storage_only_bounded_repacking','originalSourceArchiveKey':item['key'],'originalSourceArchiveSHA256':item['sha256'],'valuesRecalculated':False,'nativeObjectsUnchanged':True}
   b=encode(envelope);z=gzip.compress(b,compresslevel=9,mtime=0);digest=sha(z);path=out/(digest+'.json.gz');path.write_bytes(z)
   pointer={'key':'research/published/2026-10-14/recovery-native-v48/'+digest+'.json.gz','sha256':digest,'bytes':len(z),'compression':'gzip','decodedBytes':len(b),'originalSourceArchiveKey':item['key'],'originalSourceArchiveSHA256':item['sha256'],'recoveryEnvelopeSHA256':digest}
   assert len(z)<=8*1024*1024 and len(b)<=32*1024*1024
   reread=json.loads(gzip.decompress(path.read_bytes()));assert reread['series']==batch
   new_objects.append({**pointer,'path':str(path.relative_to(ROOT)),'kind':'recovery_native_history_partition','seriesCount':len(batch),'pointCount':sum(s['pointCount'] for s in batch)})
   for original,recovered in zip(batch,reread['series']):
    original_points_sha=sha(canonical(original['points']));assert original_points_sha==sha(canonical(recovered['points']))
    original_series_sha=sha(canonical(original));assert original_series_sha==sha(canonical(recovered))
    proof.append({'id':original['id'],'pointCount':original['pointCount'],'originalSourceArchiveSHA256':item['sha256'],'originalNativePointsCanonicalSHA256':original_points_sha,'originalSeriesCanonicalSHA256':original_series_sha,'recoveryEnvelopeSHA256':digest})
   max_decoded=max(max_decoded,len(b))
  else:pointer={k:item[k] for k in ['key','sha256','bytes','compression']};pointer['decodedBytes']=len(decoded);max_decoded=max(max_decoded,len(decoded))
  partition_id=len(partitions);partitions.append(pointer)
  for original in batch:
   sid=original['id'];assert sid not in series
   points=original.get('points',[]);assert len(points)==original['pointCount']
   series[sid]=[original.get(k) for k in fields]+[original.get('periodCoverage',{}).get('start'),original.get('periodCoverage',{}).get('end'),partition_id];native_points+=len(points)
assert len(series)==16872 and native_points==633891,(len(series),native_points)
shards={'version':manifest['version'],'classification':'bounded_storage_envelopes_only','objects':new_objects,'replacedOriginalKeys':replaced,'counts':{'repackedSeries':len(proof),'repackedNativePoints':sum(p['pointCount'] for p in proof),'recoveryShards':len(new_objects),'originalPartitionsRepacked':len(replaced),'indexedSeries':len(series),'retainedNativePoints':native_points,'largestDecodedPartitionBytes':max_decoded},'hashMethod':'Canonical parsed JSON using sorted object keys, UTF-8, no whitespace. These are preservation verification digests, not original archive byte digests.','seriesVerification':proof}
(ROOT/'data/recovery/recovery-native-shards.manifest.json').write_text(json.dumps(shards,separators=(',',':'))+'\n')
result={'version':manifest['version'],'asOf':manifest['asOf'],'schema':'espacios_v48_native_history_library_v1','classification':'metadata_index_of_accepted_native_partitions','columns':fields+['firstPeriod','lastPeriod','partitionId'],'rows':list(series.values()),'partitions':partitions,'counts':{'indexedSeries':len(series),'retainedNativePoints':native_points},'population':'Native source series and overlapping aggregate points; not unique transactions, complete subject lifetimes, model trials or validated forecasts.','legacyCompatibility':{'modelArchiveRestored':False,'oldOfficialHistoryArchiveRestored':False,'valuesRecalculated':False},'storageRecovery':shards['counts'],'sourceManifestSHA256':sha((ROOT/'data/historical-intelligence/publication-manifest.json').read_bytes())}
encoded=encode(result);path=ROOT/'data/recovery/v48-native-history-index.json.gz';compressed=gzip.compress(encoded,compresslevel=9,mtime=0);path.write_bytes(compressed)
entry={'key':'recovery/accepted-v48/native-history-index.json.gz','path':str(path.relative_to(ROOT)),'sha256':sha(compressed),'bytes':len(compressed),'compression':'gzip','decodedBytes':len(encoded),'kind':'recovery_native_history_metadata_index','sourceVersion':manifest['version']}
(ROOT/'data/recovery/v48-native-history-index.manifest.json').write_text(json.dumps(entry,indent=2)+'\n')
print(json.dumps({'index':entry,'storageRecovery':shards['counts']}))
