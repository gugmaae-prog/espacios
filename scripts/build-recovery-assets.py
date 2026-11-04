#!/usr/bin/env python3
"""Build a worker-only immutable recovery asset subset; exclude raw archives."""
import pathlib,json,hashlib,os
ROOT=pathlib.Path(__file__).resolve().parents[1];out=ROOT/'work/archive-assets/__map_archive';out.mkdir(parents=True,exist_ok=True)
publication=json.loads((ROOT/'data/historical-intelligence/publication-manifest.json').read_text())
assert publication['version']=='20261014-enrichment-v48'
allowed_kinds={'runtime_record_shard','runtime_history_partition','history_partition'}
repacking=json.loads((ROOT/'data/recovery/recovery-native-shards.manifest.json').read_text())
replaced=set(repacking['replacedOriginalKeys'])
entries=[item for item in publication['objects'] if item['kind'] in allowed_kinds and item['key'] not in replaced]+repacking['objects']
extra=[('recovery/accepted-map-20261013/map-data.json','data/recovery/accepted-map-20261013.json','recovered_public_map_response'),('research/published/2026-09-30/smart-estimates-v1/scenarios.json','data/smart-estimates-20260930.json','approved_conditional_scenario_snapshot'),('market-segments/20260928-v3/observations.json','data/recovery/recovered-market-segments.json','unchanged_published_asking_rows')]
derived=json.loads((ROOT/'data/recovery/accepted-uae-heatmap-20261102.manifest.json').read_text())
derived_raw=(ROOT/'data/recovery/accepted-uae-heatmap-20261102.json').read_bytes()
assert derived['sourceBodySHA256']=='b662672fb72cdcbaf62aa5df248c7373105a8f4ca514028188f91315c8fc6b56'
assert len(derived_raw)==derived['bytes'] and hashlib.sha256(derived_raw).hexdigest()==derived['sha256']
extra.append(('recovery/accepted-map-20261013/uae-heatmap-derived.json','data/recovery/accepted-uae-heatmap-20261102.json','derived_ui_heatmap_from_accepted_v48_catalogue'))
extra.append(('uae/evidence/ajman/2026-08-21/real-estate-units-transactions.json.gz','data/uae-evidence/ajman/real-estate-units-transactions-20260821.json.gz','official_ajman_mixed_unit_disposition_aggregate'))
for key,path,kind in extra:
 raw=(ROOT/path).read_bytes();entries.append({'key':key,'path':path,'kind':kind,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
for key,path,kind in [('recovery/accepted-history-library-20261003/series-metadata.json','data/recovery/legacy-history-series-metadata.json','accepted_legacy_history_metadata'),('recovery/accepted-v48/area-evidence.json','data/recovery/recovered-area-evidence.json','accepted_native_area_availability'),('recovery/accepted-intelligence-20261013/context.json','data/recovery/intelligence-public-20261013.json','accepted_public_intelligence_response'),('recovery/accepted-model-catalogue-20261013/published-first-page.json','data/recovery/predictions-public-page-20261013.json','partial_accepted_prediction_catalogue_response')]:
 raw=(ROOT/path).read_bytes();entries.append({'key':key,'path':path,'kind':kind,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
index=json.loads((ROOT/'data/recovery/v48-native-history-index.manifest.json').read_text());entries.append(index)
inventory=json.loads((ROOT/'data/recovery/full-item-inventory.manifest.json').read_text());entries.append(inventory)
result={};files=set();total=0
for item in entries:
 assert item['kind'] not in {'licensed_raw_transaction_parquet','lossless_historical_csv','d1_append_only_index','full_snapshot_index'}
 p=ROOT/item['path'];raw=p.read_bytes();assert len(raw)==item['bytes'] and hashlib.sha256(raw).hexdigest()==item['sha256']
 assert len(raw)<25*1024*1024
 name=item['sha256']+'.bin';dest=out/name
 if not dest.exists():os.link(p,dest)
 files.add(name);result[item['key']]={'path':'/__map_archive/'+name,'sha256':item['sha256'],'bytes':item['bytes'],'kind':item['kind'],'contentType':'application/octet-stream'};total+=len(raw)
for old in out.iterdir():
 if old.name not in files:
  assert old.name.endswith('.bin') and len(old.name)==68
  old.unlink()
assert len(files)<20000
manifest={'version':publication['version'],'classification':'private_worker_binding_recovery_subset','entries':result,'files':len(files),'logicalKeys':len(result),'evidenceLogicalKeys':len(result)-1,'derivedUIAssets':1,'bytes':total,'exclusions':['raw transaction parquet','lossless source CSV','SQL index','full canonical archive'],'publicRawAccess':False}
(ROOT/'data/recovery/static-archive-manifest.json').write_text(json.dumps(manifest,separators=(',',':'))+'\n')
print(json.dumps({k:v for k,v in manifest.items() if k!='entries'}))
