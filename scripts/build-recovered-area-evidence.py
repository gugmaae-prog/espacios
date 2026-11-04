#!/usr/bin/env python3
"""Summarize retained DRED source baskets, never average or fabricate medians."""
import json,pathlib,gzip,re,calendar
ROOT=pathlib.Path(__file__).resolve().parents[1];manifest=json.loads((ROOT/'data/historical-intelligence/publication-manifest.json').read_text());rows=[];early=[]
source_cutoff='2026-09-14'
def complete(period):
 m=re.fullmatch(r'(\d{4})Q([1-4])',period)
 if m:y=int(m[1]);month=int(m[2])*3;return f'{y:04d}-{month:02d}-{calendar.monthrange(y,month)[1]:02d}'<=source_cutoff
 m=re.fullmatch(r'(\d{4})-(\d{2})',period)
 if m:y=int(m[1]);month=int(m[2]);return f'{y:04d}-{month:02d}-{calendar.monthrange(y,month)[1]:02d}'<=source_cutoff
 return False
for entry in manifest['objects']:
 if entry['kind']!='history_partition':continue
 part=json.loads(gzip.decompress((ROOT/entry['path']).read_bytes()))
 for s in part['series']:
  if not(s.get('sourceId')=='dred-sale-snapshot-20260919' and s.get('metric')=='price' and s.get('unit')=='AED/sqft' and s.get('sourceAreaId') is not None and s.get('frequency') in ['monthly','quarterly']):continue
  points=[dict(zip(s['columns'],p)) if isinstance(p,list) else p for p in s['points']]
  eligible=[p for p in points if isinstance(p.get('sampleCount'),(int,float)) and p['sampleCount']>=20 and isinstance(p.get('value'),(int,float)) and p['value']>0 and str(p.get('qualityStatus','')).startswith('sample >=20 and positive median') and complete(p['period'])]
  eligible.sort(key=lambda p:p['period']);latest=eligible[-1] if eligible else None
  target=rows if points and all(isinstance(p.get('nativeRow'),list) and len(p['nativeRow'])==8 for p in points) else early
  target.append({'name':s['geography'],'sourceAreaId':s['sourceAreaId'],'frequency':s['frequency'],'segment':s['segment'],'registration':s['registration'],'seriesId':s['id'],'periods':len(points),'eligiblePeriods':len(eligible),'first':min((p['period'] for p in points),default=None),'last':max((p['period'] for p in points),default=None),'maxPeriodCount':max((p.get('sampleCount') or 0 for p in points),default=0),'latest':{'period':latest['period'],'count':latest['sampleCount'],'medianPsf':latest['value']} if latest else None,'scope':s['scope'],'sourceId':s['sourceId'],'classification':'DLD-derived source-area context; not an individual property valuation'})
assert len(rows)==3924 and len(early)==430,(len(rows),len(early))
assert len({(r['sourceAreaId'],r['frequency'],r['segment'],r['registration']) for r in rows})==len(rows)
areas=[{'sourceAreaId':a,'name':n} for a,n in sorted({(r['sourceAreaId'],r['name']) for r in rows})]
result={'version':'20261102-area-evidence-recovery-v1','asOf':manifest['asOf'],'rows':rows,'additionalEarlyNativeSeries':early,'earlyHistoryUrl':'/map/history','areas':areas,'recovery':{'classification':'accepted_native_availability_summary','sourceVersion':manifest['version'],'originalLegacyIndexRestored':False,'valuesRecalculated':False,'primaryCohorts':3924,'additionalEarlyCohorts':430,'cohortPolicy':'Pre2019 cohorts retain a different original source-row schema and remain separate in Native History; periods and medians are never pooled across these cohorts.','minimumSample':20,'sourceObservationCutoff':source_cutoff,'policy':'Retained native monthly/quarterly area/type/registration baskets. Only full periods by the source cutoff with source-qualified sample>=20 and positive median are eligible. Sparse and partial periods remain in the native history; never zero-fill.'}}
(ROOT/'data/recovery/recovered-area-evidence.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n');print(json.dumps({'rows':len(rows),'additionalEarlyNativeSeries':len(early),'areas':len(areas),'latestGate':source_cutoff}))
