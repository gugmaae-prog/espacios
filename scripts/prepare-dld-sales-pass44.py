#!/usr/bin/env python3
"""Prepare individually verified Avida Residences sales; retain prior evidence unchanged."""
import csv,gzip,hashlib,importlib.util,json,re
from collections import Counter
from datetime import date
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];RAW=ROOT/'.local-data/identity-pass41';BASE=ROOT/'data/historical-intelligence'
spec=importlib.util.spec_from_file_location('review',ROOT/'scripts/review-dld-identity-pass38.py');review=importlib.util.module_from_spec(spec);spec.loader.exec_module(review)
SPECS=[{'recordId':'project:avida-residences-iquna-properties-dubai-islands','name':'Avida Residences','buildingName':'Avida Residences','projectNumber':4066,'areaId':432,'areaName':'Palm Deira','developerNumber':2139,'developerId':685297965,'catalogueDeveloper':'IQUNA Properties','primarySource':'primary44-iquna-avida','expectedRows':40}]
key=lambda tid:'dld-sha256:'+hashlib.sha256(('DLD:'+tid.strip()).encode()).hexdigest()
def raw_rows(path):
 with gzip.open(path,'rt',encoding='utf-8-sig',newline='') as f:yield from csv.DictReader(f)
def descriptor_mentions_project(series,sp):
 text=review.norm(json.dumps(series))
 named=re.search(r'(?<!\w)'+re.escape(review.norm(sp['name']))+r'(?!\w)',text) is not None
 numbered=any(str(series.get(field,'')) in {str(sp['projectNumber']),str(sp['projectNumber'])+'.0',str(sp['projectNumber'])+'.00'} for field in ['sourceProjectNumber','registeredProjectNumber','projectNumber','project_number'])
 return named or numbered
def main():
 baseline=BASE/'objects/999760c4e7fade1d3f6f5398f19f0521a96dd403cbcc51ac1d2e242188061998.json.gz'
 assert review.digest(baseline)=='999760c4e7fade1d3f6f5398f19f0521a96dd403cbcc51ac1d2e242188061998'
 baseline_bytes=gzip.decompress(baseline.read_bytes());s=json.loads(baseline_bytes)
 baseline_sha='3518014dd687c1290f31eaaecf60555ffba7ae940de3fa96801dcd2df2a8a4b1'
 series_by_id={x['id']:x for x in s['series']}
 for record in s['records']:record['historySeries']=[series_by_id[x] for x in record['historySeriesIds']]
 assert s['version']=='20261012-enrichment-v43'
 capture_dir=ROOT/'.local-data/identity-pass44';capture=json.loads((capture_dir/'primary-capture.json').read_text());html=capture_dir/'iquna-avida.html'
 assert review.digest(html)==capture['sha256'] and html.stat().st_size==capture['bytes'] and capture['status']==200
 assert all(x in html.read_text() for x in ['Avida Residences','Dubai Islands','Developed by IQUNA'])
 authority=json.loads((BASE/'dld-authority-pass44-20261012.json').read_text());a=authority['record']
 for c in authority['sourceCaptures']:
  p=capture_dir/(c['id']+'.json');assert review.digest(p)==c['captureSHA256'] and p.stat().st_size==c['bytes']
 sheet=json.loads((capture_dir/'avida-fact-sheet.json').read_text())['text']
 assert all(x in sheet for x in ['Project Number\n4066','Sq.Mt\n5652.37','Units\n50','Registered\n11/09/2025','Started\n02/01/2026','Completion\n01/12/2027','Residential (50)','1 B/R (28)','2 B/R (10)','3 B/R (12)'])
 assert (a['registeredDate'],a['registerStartDate'],a['scheduledCompletionDate'],a['registerAreaSqm'])==('2025-09-11','2026-01-02','2027-12-01',5652.37)
 inspection=json.loads((capture_dir/'avida-inspection.json').read_text())['text']
 assert 'Inspection Date\n25/08/2026' in inspection and '6.81 %' in inspection and a['inspection']['percent']==6.81
 location=json.loads((capture_dir/'avida-location.json').read_text())['mapLink'];assert a['locationLabel']==location['title'] and a['mapURL']==location['href'] and a['mapCoordinatesEligible'] is False
 dev=json.loads((capture_dir/'avida-developer.json').read_text())['text']
 assert all(x in dev for x in ['Serene Marina Real Estate Development L.L.C','2139','@iqunaproperties.com'])
 source={'id':'dld44-public-avida-status-20261012','url':authority['sourceCaptures'][0]['url'],'publisher':'Dubai Land Department','title':'Avida Residences — exact authority project, developer and dated inspection','classification':'authority_project_register_snapshot','primaryEvidence':True,'publishedAt':None,'firstAvailableAt':a['firstAvailableAt'],'retrievedAt':a['firstAvailableAt'],'sourceCaptures':authority['sourceCaptures'],'normalizedFacts':a,'rawCaptureRedistributed':False,'fullContactDetailsRedistributed':False,'revisionOfSourceId':'dld41-public-project-status-20261012','preserveRevision':True}
 primary=[{'id':'primary44-iquna-avida','url':capture['url'],'publisher':'IQUNA Properties','title':'Avida Residences — primary marketed project identity','classification':'primary_developer_identity_capture','primaryEvidence':True,'publishedAt':None,'firstAvailableAt':capture['retrievedAt'],'retrievedAt':capture['retrievedAt'],'captureSHA256':capture['sha256'],'captureBytes':capture['bytes'],'captureMethod':'Public HTML retrieval','normalizedFacts':{'project':'Avida Residences','developerBrand':'IQUNA Properties','marketedLocation':'Dubai Islands','residentialTypes':['1 bedroom','2 bedroom','3 bedroom','penthouses'],'registeredDeveloper':'Serene Marina Real Estate Development L.L.C','authorityProjectNumber':4066,'authorityDeveloperNumber':2139,'publicAuthorityContactDomain':'iqunaproperties.com','corporateEquivalenceInferred':False},'rawCaptureRedistributed':False,'note':'Exact project identity corroborated by authority project/developer and public business contact domain; no subsidiary relationship or legal-entity equivalence inferred.'},source]
 for src in primary:
  same=[x for x in s['sources'] if x.get('url','').rstrip('/')==src['url'].rstrip('/')]
  if same:src.update(revisionOfSourceId=same[-1]['id'],preserveRevision=True)
 records={r['id']:r for r in s['records']};sources={x['id']:x for x in s['sources']+primary}
 ar={a['projectNumber']:a}
 receipt=json.loads((RAW/'download-receipt.json').read_text())
 for f in receipt:
  p=RAW/f['fileName'];assert review.digest(p)==f['sha256'] and p.stat().st_size==f['bytes']
 catalogue=json.loads((ROOT/'.local-data/history-v40-release/catalogue-before.json').read_text())['projects']
 for sp in SPECS:
  a=ar[sp['projectNumber']];r=records[sp['recordId']]
  assert (review.norm(a['authorityName']),a['registeredDeveloperNumber'],a['downloadRegisterDeveloperId'])==(review.norm(sp['name']),sp['developerNumber'],sp['developerId'])
  assert a['locationLabel'].endswith(', '+sp['areaName'])
  assert a['registeredUnits']==50 and a['buildingBreakdown']==['Residential (50)','1 B/R (28)','2 B/R (10)','3 B/R (12)']
  assert a['inspection']['currentProgressEligible'] is False and a['inspection']['date']=='2026-08-25'
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
   assert row['area_name_en']==sp['areaName'] and row['rooms_en'] in {'1 B/R','2 B/R','3 B/R'};accepted.append((tid,row,sp))
 for sp in SPECS:assert sum(x[2]==sp for x in accepted)==sp['expectedRows']
 proposed={key(t) for t,_,_ in accepted};assert len(proposed)==40
 for r in s['records']:
  for o in r.get('observations',[]):
   existing=[o.get('transactionId'),o.get('sourceObservationId')]
   assert not proposed.intersection(existing+[key(x) for x in existing if x and not str(x).startswith('dld-sha256:')]),'Individual transaction already owned'
  for se in r.get('historySeries',[]):
   if se.get('scope')=='subject' and se.get('identityVerified'):
    descriptor=json.dumps(se).casefold()
    assert not any(descriptor_mentions_project(se,sp) for sp in SPECS),'Existing subject cohort requires reconciliation'
 authority_id='dld44-public-avida-status-20261012';transaction_id='dld44-normalized-project-sales-20261010'
 availability=max([x['retrievedAt'] for x in receipt]+[x['retrievedAt'] for x in authority['sourceCaptures']]+[x['retrievedAt'] for x in primary])
 authority_source=sources[authority_id]
 parent=sources['dld43-normalized-project-sales-20261010'];transaction_source={**parent,'id':transaction_id,'revisionOfSourceId':parent['id'],'preserveRevision':True,'title':'DLD normalized Avida Residences individual residential sales, 10 October export','classification':'official_primary_registered_sale_normalized_extract','primaryEvidence':True,'publishedAt':None,'retrievedAt':availability,'firstAvailableAt':availability,'captureManifest':receipt,'rawTransactionRowsRedistributed':False,'rawTransactionIdsRedistributed':False,'derivedIndividualObservationsPublished':True,'observationCoverage':{'start':min(r['instance_date'][:10] for _,r,_ in accepted),'end':max(r['instance_date'][:10] for _,r,_ in accepted),'basis':'40 individually identified residential flat sale registrations; incomplete lifetime history'},'note':'Source registration dates, normalized prices and areas only; no raw identifiers, party data, medians, current valuations or automatic appreciation. Evidence first known no earlier than the full source/identity capture.'}
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
  basis="Unique non-archived Avida Residences catalogue record in Dubai Islands, corroborated by IQUNA's official project page. DLD public status identifies Avida Residences project 4066 in Palm Deira with 50 residential units, legal developer Serene Marina Real Estate Development L.L.C, developer number 2139; the downloadable developer register confirms ID 685297965. DLD's developer contact uses the official iqunaproperties.com business domain. This corroborates the project association without inferring corporate aliases or a subsidiary relationship. Only Residential/Unit/Flat sales with exact project number 4066, area 432 and project/building Avida Residences are included. Advertised prices, planned schedules, dated progress and transaction values remain separate. Generic map coordinates are excluded."
  checks.append({'recordId':sp['recordId'],'catalogueName':records[sp['recordId']]['name'],'type':'project','emirate':'Dubai','basis':basis,'sourceIds':proof,'authorityProjectNumber':sp['projectNumber'],'authorityDeveloperNumber':sp['developerNumber']})
  research.append({'recordId':sp['recordId'],'asOf':'2026-10-12','sourceIds':[transaction_id]+proof,'status':'Verified individual residential sale evidence; complete lifetime history and other legacy candidate associations remain under review','acceptedTransactionObservationCount':sp['expectedRows'],'identityDecision':{'scope':'these exact individual source registrations only','basis':basis,'unrelatedLegacyCandidateFlagsRetained':True}})
  for tid,row,owner in sorted(accepted,key=lambda x:(x[1]['instance_date'],x[0])):
   if owner!=sp:continue
   worth,area=float(row['actual_worth']),float(row['procedure_area']);tk=key(tid)
   facts.append({'id':'dld44-sale-'+tk.split(':')[1],'recordId':sp['recordId'],'status':'accepted','kind':'financial','scope':'subject','sourceIds':[transaction_id],'identitySourceIds':proof,'identityBasis':basis,'identityVerified':True,'primaryEvidence':True,'publishedAt':None,'firstAvailableAt':availability,'evidenceClass':'registered_sale_transaction_primary_dld','observation':{'metric':'price','value':worth/area/10.763910416709722,'unit':'AED/sqft','priceAED':worth,'areaSqm':area,'period':row['instance_date'][:10],'frequency':'daily','observationKind':'transaction','transactionKind':'sale','transactionId':tk,'sourceObservationId':tk,'transactionKeyAlgorithm':'sha256(UTF8("DLD:" + native_transaction_id))','sampleCount':1,'usage':'Residential','propertyType':'Unit','propertySubtype':'Flat','registration':row['reg_type_en'],'procedureId':review.integer(row['procedure_id']),'procedureName':row['procedure_name_en'],'bedroomsLabel':row['rooms_en'],'sourceProjectNumber':sp['projectNumber'],'registeredDeveloperId':sp['developerId'],'sourceAreaId':sp['areaId'],'sourceBuildingName':sp['buildingName'],'observationDateBasis':'DLD instance_date registration day; not first-ever sale, contract execution or current valuation','currentSnapshotEligible':False,'includeInCurrentSnapshot':False}})
 packet={'schemaVersion':1,'passId':'dld-sales-pass44-20261012','asOf':'2026-10-12','priorVersion':s['version'],'priorSHA256':baseline_sha,'priorArchiveSHA256':review.digest(baseline),'candidateVersion':'20261012-enrichment-v44','sources':primary+[transaction_source],'facts':facts,'seriesLinks':[],'recordIdentityChecks':checks,'recordResearch':research,'collection':{'sourceRowsScanned':scanned,'duplicateReconciliationRowsScanned':rescanned,'acceptedTransactionRows':40,'newSources':3,'excludedRows':dict(excluded),'newAggregateMedians':0,'currentValuationsAdded':0,'approved2080Forecasts':0,'completeLifetimeHistory':False,'rawRowsAndNativeTransactionIdsRedistributed':False,'legacyCandidateFlagsRetained':True},'methodology':'Authority project number and developer register crosscheck, primary marketed identity, exact area and residential building, full-vintage duplicate reconciliation and comparison against all existing individual ownership and subject-series descriptors. Retain sparse transactions, source availability, asking quotes and prior headline values separately.'}
 (BASE/'dld-sales-pass44-20261012.json').write_text(json.dumps(packet,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'facts':len(facts),'sources':3,'scanned':scanned,'excluded':dict(excluded),'firstAvailableAt':availability}))
if __name__=='__main__':main()
