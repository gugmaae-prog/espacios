#!/usr/bin/env python3
"""Prepare individually verified Divine/Inaura/Eira/SOMA sales; retain prior evidence unchanged."""
import csv,gzip,hashlib,importlib.util,json,re
from collections import Counter
from datetime import date
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];RAW=ROOT/'.local-data/identity-pass41';BASE=ROOT/'data/historical-intelligence'
spec=importlib.util.spec_from_file_location('review',ROOT/'scripts/review-dld-identity-pass38.py');review=importlib.util.module_from_spec(spec);spec.loader.exec_module(review)
SPECS=[{'recordId': 'project:divine-elements-takmeel-dubai-south', 'name': 'Divine Elements', 'buildingName': 'DIVINE ELEMENTS', 'projectNumber': 4142, 'areaId': 462, 'areaName': 'Madinat Al Mataar', 'developerNumber': 1520, 'developerId': 464678539, 'catalogueDeveloper': 'Takmeel Development', 'primarySource': 'primary42-divine', 'expectedRows': 49}, {'recordId': 'project:inaura-hotels-residences-arada-downtown-dubai', 'name': 'Inaura Hotels & Residences', 'buildingName': 'Inaura Hotels & Residences', 'projectNumber': 4226, 'areaId': 390, 'areaName': 'Burj Khalifa', 'developerNumber': 1409, 'developerId': 404647195, 'catalogueDeveloper': 'Arada', 'primarySource': 'primary42-inaura', 'expectedRows': 35}, {'recordId': 'project:eira-by-neoterra-dubai-production-city-uae', 'name': 'Eira', 'buildingName': 'EIRA', 'projectNumber': 4437, 'areaId': 485, 'areaName': "Me'Aisem First", 'developerNumber': 2612, 'developerId': 875958879, 'catalogueDeveloper': 'Neoterra Developments', 'primarySource': 'primary42-eira-project', 'expectedRows': 30}, {'recordId': 'project:soma-residences-origami-dubai-islands-dubai', 'name': 'Soma Residences', 'buildingName': 'Soma Residences', 'projectNumber': 4453, 'areaId': 432, 'areaName': 'Palm Deira', 'developerNumber': 2419, 'developerId': 782200993, 'catalogueDeveloper': 'Origami Development', 'primarySource': 'primary42-soma', 'expectedRows': 5}]
key=lambda tid:'dld-sha256:'+hashlib.sha256(('DLD:'+tid.strip()).encode()).hexdigest()
def raw_rows(path):
 with gzip.open(path,'rt',encoding='utf-8-sig',newline='') as f:yield from csv.DictReader(f)
def descriptor_mentions_project(series,sp):
 text=review.norm(json.dumps(series))
 named=re.search(r'(?<!\w)'+re.escape(review.norm(sp['name']))+r'(?!\w)',text) is not None
 numbered=any(str(series.get(field,'')) in {str(sp['projectNumber']),str(sp['projectNumber'])+'.0',str(sp['projectNumber'])+'.00'} for field in ['sourceProjectNumber','registeredProjectNumber','projectNumber','project_number'])
 return named or numbered
def main():
 baseline=BASE/'objects/eea871f5edf732a1ec1c041d1e85ae4dd24d876b1cb4455fdef8908723ab1e79.json.gz'
 assert review.digest(baseline)=='eea871f5edf732a1ec1c041d1e85ae4dd24d876b1cb4455fdef8908723ab1e79'
 baseline_bytes=gzip.decompress(baseline.read_bytes());s=json.loads(baseline_bytes)
 baseline_sha='6ac6381c517b47b8c779c83f36c62f221393c25016cebf3d54ae7601c6574fb4'
 series_by_id={x['id']:x for x in s['series']}
 for record in s['records']:record['historySeries']=[series_by_id[x] for x in record['historySeriesIds']]
 assert s['version']=='20261012-enrichment-v41'
 primary=json.loads((BASE/'primary-identity-pass42-20261012.json').read_text())['sources']
 for src in primary:
  slug=src['id'].removeprefix('primary42-');suffix='.json' if slug.startswith('eira-') else '.html'
  p=ROOT/'.local-data/identity-pass42'/(slug+suffix)
  assert review.digest(p)==src['captureSHA256'] and p.stat().st_size==src['captureBytes']
 records={r['id']:r for r in s['records']};sources={x['id']:x for x in s['sources']+primary}
 authority=json.loads((BASE/'dld-authority-pass41-20261012.json').read_text());ar={x['projectNumber']:x for x in authority['records']}
 # Revalidate all 24 private browser captures against the committed public pins.
 for capture in authority['sourceCaptures']:
  p=RAW/(capture['id']+'.json');assert review.digest(p)==capture['captureSHA256'] and p.stat().st_size==capture['bytes']
 receipt=json.loads((RAW/'download-receipt.json').read_text())
 for f in receipt:
  p=RAW/f['fileName'];assert review.digest(p)==f['sha256'] and p.stat().st_size==f['bytes']
 catalogue=json.loads((ROOT/'.local-data/history-v40-release/catalogue-before.json').read_text())['projects']
 for sp in SPECS:
  a=ar[sp['projectNumber']];r=records[sp['recordId']]
  assert (review.norm(a['authorityName']),a['registeredDeveloperNumber'],a['downloadRegisterDeveloperId'])==(review.norm(sp['name']),sp['developerNumber'],sp['developerId'])
  assert a['locationLabel'].endswith(', '+sp['areaName'])
  matches=[c for c in catalogue if review.norm(c['name'])==review.norm(sp['name'])]
  assert len(matches)==1 and matches[0]['id']==sp['recordId'] and matches[0]['developer']==sp['catalogueDeveloper'] and matches[0]['archived'] is False
  assert review.norm(r['name'])==review.norm(sp['name']) and r['emirate']=='Dubai' and r['type']=='project'
  assert not any(x.get('scope')=='subject' and x.get('identityVerified') for x in r.get('historySeries',[]))
  assert sp['primarySource'] in sources
 files=[RAW/f['fileName'] for f in receipt if f['dataset']=='transactions'];targets={x['projectNumber']:x for x in SPECS};picked={};scanned=0
 for f in files:
  for row in raw_rows(f):
   scanned+=1
   try:no=review.integer(row.get('project_number'))
   except ValueError:continue
   if no not in targets:continue
   tid=row.get('transaction_id','').strip()
   if not tid:continue
   picked.setdefault(tid,{'row':row,'copies':0,'conflict':False})
   picked[tid]['conflict']|=row!=picked[tid]['row']
 rescanned=0
 for f in files:
  for row in raw_rows(f):
   rescanned+=1;tid=row.get('transaction_id','').strip()
   if tid in picked:
    picked[tid]['copies']+=1;picked[tid]['conflict']|=row!=picked[tid]['row']
 assert scanned==rescanned==1800588
 accepted=[];excluded=Counter()
 for tid,item in picked.items():
  row=item['row'];sp=targets[review.integer(row['project_number'])]
  reason='conflicting_duplicate_transaction_id' if item['conflict'] else review.candidate_reason(row,sp,date(2026,10,10))
  if reason:excluded[reason]+=1
  else:
   assert row['area_name_en']==sp['areaName'];accepted.append((tid,row,sp))
 for sp in SPECS:assert sum(x[2]==sp for x in accepted)==sp['expectedRows']
 proposed={key(t) for t,_,_ in accepted};assert len(proposed)==119
 for r in s['records']:
  for o in r.get('observations',[]):
   existing=[o.get('transactionId'),o.get('sourceObservationId')]
   assert not proposed.intersection(existing+[key(x) for x in existing if x and not str(x).startswith('dld-sha256:')]),'Individual transaction already owned'
  for se in r.get('historySeries',[]):
   if se.get('scope')=='subject' and se.get('identityVerified'):
    descriptor=json.dumps(se).casefold()
    assert not any(descriptor_mentions_project(se,sp) for sp in SPECS),'Existing subject cohort requires reconciliation'
 authority_id='dld41-public-project-status-20261012';transaction_id='dld42-normalized-project-sales-20261010'
 availability=max([x['retrievedAt'] for x in receipt]+[x['retrievedAt'] for x in authority['sourceCaptures']]+[x['retrievedAt'] for x in primary])
 authority_source=sources[authority_id]
 parent=sources['dld41-normalized-project-sales-20261010'];transaction_source={**parent,'id':transaction_id,'revisionOfSourceId':parent['id'],'preserveRevision':True,'title':'DLD normalized Divine Elements, Inaura, Eira and SOMA individual residential sales, 10 October export','classification':'official_primary_registered_sale_normalized_extract','primaryEvidence':True,'publishedAt':None,'retrievedAt':availability,'firstAvailableAt':availability,'captureManifest':receipt,'rawTransactionRowsRedistributed':False,'rawTransactionIdsRedistributed':False,'derivedIndividualObservationsPublished':True,'observationCoverage':{'start':min(r['instance_date'][:10] for _,r,_ in accepted),'end':max(r['instance_date'][:10] for _,r,_ in accepted),'basis':'119 individually identified residential flat sale registrations; incomplete lifetime history'},'note':'Source registration dates, normalized prices and areas only; no raw identifiers, party data, medians, current valuations or automatic appreciation. Evidence first known no earlier than the full source/identity capture.'}
 # Clear inherited recapture fields that describe the older export.
 for field in ['sha256','bytes','sourceFiles','files','sourceSnapshotDate','rawFiles','sourceCaptureManifest','snapshotFiles']:
  transaction_source.pop(field,None)
 transaction_source['snapshotFiles']=[{**f,'representation':'gzip-compressed CSV payload'} for f in receipt if f['dataset']=='transactions']
 transaction_source['sourceSnapshotDate']='2026-10-10'
 transaction_source['availabilityBasis']='Conservative availability: latest retained source and authority identity capture; original export publication time not established'
 facts=[];checks=[];research=[]
 for sp in SPECS:
  a=ar[sp['projectNumber']]
  proof=[authority_id,'dld-official-developers-20261001','dld-official-areas-20261002',sp['primarySource']]
  if sp['projectNumber']==4226:proof.append('primary42-inaura-announcement')
  if sp['projectNumber']==4437:proof.append('primary42-eira-developer')
  basis=f"Unique non-archived {sp['name']} / {sp['catalogueDeveloper']} catalogue record, corroborated by its retained primary developer page. DLD public project status names project {sp['projectNumber']}, legal developer number {sp['developerNumber']} and {sp['areaName']}; the downloadable developer register independently confirms developer ID {sp['developerId']}. Only Residential/Unit/Flat sale registrations with exact project number, area ID {sp['areaId']}, project name and building name {sp['buildingName']} are included. Commercial, land, gifts and mortgages are excluded. Generic DLD map coordinates are not used."
  checks.append({'recordId':sp['recordId'],'catalogueName':records[sp['recordId']]['name'],'type':'project','emirate':'Dubai','basis':basis,'sourceIds':proof,'authorityProjectNumber':sp['projectNumber'],'authorityDeveloperNumber':sp['developerNumber']})
  research.append({'recordId':sp['recordId'],'asOf':'2026-10-12','sourceIds':[transaction_id]+proof,'status':'Verified individual residential sale evidence; complete lifetime history and other legacy candidate associations remain under review','acceptedTransactionObservationCount':sp['expectedRows'],'identityDecision':{'scope':'these exact individual source registrations only','basis':basis,'unrelatedLegacyCandidateFlagsRetained':True}})
  for tid,row,owner in sorted(accepted,key=lambda x:(x[1]['instance_date'],x[0])):
   if owner!=sp:continue
   worth,area=float(row['actual_worth']),float(row['procedure_area']);tk=key(tid)
   facts.append({'id':'dld42-sale-'+tk.split(':')[1],'recordId':sp['recordId'],'status':'accepted','kind':'financial','scope':'subject','sourceIds':[transaction_id],'identitySourceIds':proof,'identityBasis':basis,'identityVerified':True,'primaryEvidence':True,'publishedAt':None,'firstAvailableAt':availability,'evidenceClass':'registered_sale_transaction_primary_dld','observation':{'metric':'price','value':worth/area/10.763910416709722,'unit':'AED/sqft','priceAED':worth,'areaSqm':area,'period':row['instance_date'][:10],'frequency':'daily','observationKind':'transaction','transactionKind':'sale','transactionId':tk,'sourceObservationId':tk,'transactionKeyAlgorithm':'sha256(UTF8("DLD:" + native_transaction_id))','sampleCount':1,'usage':'Residential','propertyType':'Unit','propertySubtype':'Flat','registration':row['reg_type_en'],'procedureId':review.integer(row['procedure_id']),'procedureName':row['procedure_name_en'],'bedroomsLabel':row['rooms_en'],'sourceProjectNumber':sp['projectNumber'],'registeredDeveloperId':sp['developerId'],'sourceAreaId':sp['areaId'],'sourceBuildingName':sp['buildingName'],'observationDateBasis':'DLD instance_date registration day; not first-ever sale, contract execution or current valuation','currentSnapshotEligible':False,'includeInCurrentSnapshot':False}})
 packet={'schemaVersion':1,'passId':'dld-sales-pass42-20261012','asOf':'2026-10-12','priorVersion':s['version'],'priorSHA256':baseline_sha,'priorArchiveSHA256':review.digest(baseline),'candidateVersion':'20261012-enrichment-v42','sources':primary+[transaction_source],'facts':facts,'seriesLinks':[],'recordIdentityChecks':checks,'recordResearch':research,'collection':{'sourceRowsScanned':scanned,'duplicateReconciliationRowsScanned':rescanned,'acceptedTransactionRows':119,'newSources':7,'excludedRows':dict(excluded),'newAggregateMedians':0,'currentValuationsAdded':0,'approved2080Forecasts':0,'completeLifetimeHistory':False,'rawRowsAndNativeTransactionIdsRedistributed':False,'legacyCandidateFlagsRetained':True},'methodology':'Authority project number and developer register crosscheck, primary marketed identity, exact area and residential building, full-vintage duplicate reconciliation and comparison against all existing individual ownership and subject-series descriptors. Retain sparse transactions, source availability, asking quotes and prior headline values separately.'}
 (BASE/'dld-sales-pass42-20261012.json').write_text(json.dumps(packet,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'facts':len(facts),'sources':7,'scanned':scanned,'excluded':dict(excluded),'firstAvailableAt':availability}))
if __name__=='__main__':main()
