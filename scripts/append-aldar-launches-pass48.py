#!/usr/bin/env python3
"""Append 23 independently reviewed historical statements to exact V47. No network."""
import argparse,collections,copy,datetime as dt,gzip,hashlib,json,math,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];D=ROOT/'data/historical-intelligence/aldar-launches-20261014'
PRIOR='20261014-enrichment-v47';VERSION='20261014-enrichment-v48'
PRIOR_SHA='8be3cc4975d2c23dae8d2d5a370cb4ea1bb317061de12be72fc77ac072a86228'
CAPTURE_SHA='702497892c4cc0a15895ceebda25ca72fe1aa5901b61690cda497eed1fb70081'
PLAN_SHA='50eddf193fbb4d7b2c235507b2c83551a3ba56aa8e1bffdd834546d578118e74'
# Reviewed independently of extraction: one failed bedroom-specific claim stays withheld.
APPROVED={
 'adrec:454':{'launch':'2022-08-24','townhouses-2-3br':1740000,'villas-4br':3200000,'construction-target':'2023-Q1','handover-target':'2026-Q1'},
 'adrec:456':{'launch':'2022-11-21','villas-3br':2840000,'villas-4br':3430000,'villas-5br':4100000,'construction-target':'2023-Q2','handover-target':'2026-Q2'},
 'adrec:543':{'launch':'2024-03-13','apartments-starting':750000,'construction-target':'2024-Q4','handover-target':'2027-Q4'},
 'adrec:64':{'launch':'2021-05-25','villas-4br':2770000,'villas-5br':3270000,'construction-target':'2021-11','handover-target':'2024-02'},
 'adrec:65':{'launch':'2021-06-30','villas-4br':6490000,'villas-5br':7990000}}
STATES=('present','partial','missing','unestablished','disputed','inaccessible','pre-applicability')
canonical=lambda v:json.dumps(v,ensure_ascii=False,separators=(',',':'),sort_keys=True).encode()
digest=lambda raw:hashlib.sha256(raw).hexdigest()
def require(ok,message):
 if not ok:raise ValueError(message)
def ledger(s):return dict(collections.Counter(i['status'] for r in s['records'] for i in r['researchStatus']['itemCoverage'].values()))
def read(path):
 raw=path.read_bytes();return gzip.decompress(raw) if path.suffix=='.gz' else raw
def materialize(snapshot,plan,capture):
 records={r['id']:r for r in snapshot['records']};sources=[];facts=[];checks=[]
 captures={s['id']:s for s in capture['sources']}
 for source in plan['sources']:
  rid=source['reviewAgainstIds'][0];proof=source['authorityIdentity'];c=captures[source['id']];doc=c['documentCapture'];sid='aldar48-'+source['id']+'-'+doc['sha256'][:12]
  basis=f"Exact retained ID {rid}; authority project {proof['projectNumber']}; native name {proof['catalogueName'].strip()}; retained legal developer {proof['authorityDeveloper']}; district {proof['authorityArea']}; {proof['authorityUnitCount']} units. Official publisher page links this specific PDF, whose title, geography, dateline and unit count match. Marketing publisher is not substituted for the retained legal developer. Claims map to this record only."
  checks.append({**proof,'identityBasis':basis,'officialPublisherURL':source['url'],'capturedDocumentURL':c['url'],'legalDeveloperChanged':False})
  sources.append(dict(id=sid,url=c['url'],canonicalPublisherURL=source['url'],publisher='Aldar',classification='primary_developer_historical_launch_release',primaryEvidence=True,publishedAt=source['reportedPublishedAt'],datePrecision='day',publicationDateStatus='publisher_dateline_matched_in_official_download',firstAvailableAt=doc['retrievedAt'],retrievedAt=doc['retrievedAt'],availabilityBasis='First independently retained download capture; older dateline is not proof of historical publication vintage.',historicalFirstAvailability=None,httpStatus=doc['httpStatus'],finalUrl=doc['finalUrl'],contentType=doc['contentType'],sha256=doc['sha256'],bytes=doc['responseBytes'],captureMethod=c['captureMethod'],captureId=c['id'],parentCapture=c['parentCapture'],officialDownloadLinkVerified=True,robotsReceipts=doc['robotsReceipts'],rawBodyRetained=False,rawBodyRedistributed=False,reuseStatus='normalized_metadata_only',licence='Minimal normalized factual fields and provenance only; no redistribution of raw documents, page bodies, images, contact details or transaction exports.',datasetVersionId=None,observationStart=source['reportedPublishedAt'],observationEnd=source['reportedPublishedAt'],frequency='dated_release_with_native_day_month_and_quarter_statements',currency='AED',unit='total_advertised_AED_separate_from_lifecycle_dates',segment='Separate bedroom and property-type starting advertisements; not a pooled price',methodology='Manually selected exact-record historical statements checked against immutable download capture; native periods and asking-price classes preserved.'))
  for claim in source['claims']:
   if claim['id'] not in APPROVED[rid]:continue
   f=dict(id='aldar48-'+rid.replace(':','-')+'-'+claim['id'],status='accepted',recordId=rid,sourceIds=[sid],identitySourceIds=[sid]+proof['identitySourceIds'],identityBasis=basis,identityVerified=True,primaryEvidence=True,scope='subject',publishedAt=source['reportedPublishedAt'],firstAvailableAt=doc['retrievedAt'],captureClaimId=claim['id'])
   if claim['kind']=='financial':
    f.update(kind='financial',evidenceClass='historical_developer_advertised_price',observation=dict(metric='price',value=claim['amountAED'],currency='AED',unit='AED',period=source['reportedPublishedAt'],observationStart=source['reportedPublishedAt'],observationEnd=source['reportedPublishedAt'],frequency='daily',observationKind='asking_quote',sampleCount=None,segment=claim['segment'],bedrooms=claim['bedrooms'],areaBasis='total_advertised_price_no_area_conversion',tenure='unestablished',tenureRegistrationClass='advertisement_not_registered_transaction',methodology='Historical starting advertisement reported in the dated developer release; not a registered transaction, current offer or valuation.',currentSnapshotEligible=False,includeInCurrentSnapshot=False,quoteQualifier='Historical starting-price statement with native bedroom/property segment; availability at a particular unit and completed-sale status unestablished.',sourceQuoteBasis='Official publisher-linked release; dateline matched. Later retrieval does not establish the document vintage at the historical forecast origin.',revisionStatus='append_only_historical_statement_no_existing_observation_superseded'))
   else:
    f.update(kind='lifecycle',milestone=claim['milestone'],date={'start':claim['period'],'precision':claim['precision']},eventStatus=claim['eventStatus'],verification='verified',evidenceClass='primary_developer_reported_launch' if claim['milestone']=='launch' else 'primary_developer_historical_planned_target',label=f"Aldar's {source['reportedPublishedAt']} release reports {claim['milestone']} for {records[rid]['name'].strip()} at {claim['period']}.",note='Publisher-reported marketing launch or historical planned target. No physical completion, handover, occupancy or registered sale is inferred. Past target dates remain planned.')
   facts.append(f)
 return dict(schemaVersion=1,passId='aldar-historical-launches-pass48-20261014',asOf='2026-10-14',priorVersion=PRIOR,candidateVersion=VERSION,priorSHA256=PRIOR_SHA,sources=sources,facts=facts,recordIdentityChecks=checks,seriesLinks=[],recordResearch=[],historyInputs=[],licensedArchives=[],additionalDatasets=[],sourceCandidates=[],numericForecasts=[],scenarioAssumptions=[],automaticPriceUplift=None,methodology='Five exactly identified Abu Dhabi records; append historical developer advertisements, launch dates and planned construction/handover dates at native precision. One unmatched Noya Luma 3-bedroom quote and the Dunes cross-language completion-year discrepancy remain withheld.',withheldClaims=[{'recordId':'adrec:64','claimId':'villas-3br','reason':'Captured document did not match the predeclared bedroom-specific statement; numeric mentions alone are not segment proof.','coverageCredit':0},{'recordId':'adrec:65','claimId':'completion-target','reason':'English and Arabic parsed completion years differ; browser screenshot retrieval failed. No completion target or actual delivery fact accepted.','coverageCredit':0}],collection={'sourceDocuments':5,'documentPassHTTPRequests':capture['httpRequests'],'originalHTMLPassHTTPRequests':6,'rawRetained':False,'sourceDisposition':{'accepted_document_sources':5,'headline_only_html_bodies':5},'acceptedFacts':23})
def validate(snapshot,packet,plan,capture):
 require(snapshot['version']==packet['priorVersion']==PRIOR and packet['candidateVersion']==VERSION,'Wrong versions')
 require(packet['priorSHA256']==PRIOR_SHA and packet['asOf']=='2026-10-14','Wrong cutoff/baseline')
 records={r['id']:r for r in snapshot['records']};require(len(records)==len(snapshot['records'])==1860,'Fixed IDs changed')
 require(collections.Counter(r['type'] for r in records.values())=={'project':1645,'community':215},'Fixed types changed')
 require(not packet.get('numericForecasts') and not packet.get('scenarioAssumptions') and packet['automaticPriceUplift'] is None,'No invented scenarios/uplift')
 incoming={s['id']:s for s in packet['sources']};old={s['id']:s for s in snapshot['sources']};require(len(incoming)==len(packet['sources'])==5 and not incoming.keys()&old.keys(),'Source duplicate')
 checks={p['recordId']:p for p in packet['recordIdentityChecks']};require(checks.keys()==APPROVED.keys(),'Identity target set differs')
 planned={s['reviewAgainstIds'][0]:s for s in plan['sources']};captured={s['id']:s for s in capture['sources']}
 for rid,p in checks.items():
  r=records[rid];require((p['catalogueName'],p['emirate'],p['type'])==(r['name'],r['emirate'],r['type']),'Record metadata mismatch')
  require(p['legalDeveloperChanged'] is False and p['identityBasis'],'Legal identity overwritten')
  require(any(x.get('identityVerified') is True and str(x.get('fields',{}).get('projectNumber'))==p['projectNumber'] and x['fields'].get('developerName')==p['authorityDeveloper'] and x['fields'].get('districtCode')==p['authorityArea'] and x['fields'].get('totalCount')==p['authorityUnitCount']==planned[rid]['expectedUnits'] and x['sourceIds']==p['identitySourceIds'] for x in r['registerEvidence']),'Authority crosswalk mismatch')
  require(not any(s.get('scope')=='subject' and s.get('identityVerified') for s in r['historySeries']),'Hydrate subject cohorts before modifying their records')
 for s in incoming.values():
  c=captured[s['captureId']];doc=c['documentCapture'];n=c['normalizedReview']
  require(c['officialDownloadLinkVerified'] is True and c['captureStatus']=='captured_normalized_document' and n['identityContentConfirmed'] is True,'Exact document/identity unavailable')
  require(s['url']==c['url'] and s['canonicalPublisherURL']==c['parentUrl'],'Source URL mismatch')
  require(s['httpStatus']==doc['httpStatus']==200 and s['contentType']==doc['contentType']=='application/pdf','Source HTTP/MIME mismatch')
  require(s['sha256']==doc['sha256'] and re.fullmatch('[a-f0-9]{64}',s['sha256']) and s['bytes']==doc['responseBytes'],'Source hash/length mismatch')
  require(s['rawBodyRetained'] is False and s['rawBodyRedistributed'] is False and s['reuseStatus']=='normalized_metadata_only','Rights boundary')
  require(s['firstAvailableAt']==s['retrievedAt']==doc['retrievedAt'] and s['retrievedAt'][:10]==packet['asOf'],'Backdated source availability')
  require(s['publishedAt']==n['reportedPublishedAt'] and n['publicationDateMatched'] is True and s['publishedAt']<=s['retrievedAt'][:10],'Publication proof missing')
  require(not any(x.get('url')==s['url'] for x in old.values()),'Existing canonical URL needs immutable revision')
 facts=packet['facts'];require(len(facts)==23 and len({f['id'] for f in facts})==23,'Fact count/duplicates')
 require({(f['recordId'],f['captureClaimId']) for f in facts}=={(rid,k) for rid,claims in APPROVED.items() for k in claims},'Unapproved fact or fan-out')
 existing={x.get('id') for r in records.values() for field in ['observations','lifecycle','registerEvidence'] for x in r.get(field,[])}
 require(not {f['id'] for f in facts}&existing,'Fact identity already retained')
 for f in facts:
  rid=f['recordId'];require(f['scope']=='subject' and f['identityVerified'] is True and f['primaryEvidence'] is True and f['status']=='accepted','Exact primary subject required')
  require(f['identityBasis']==checks[rid]['identityBasis'] and set(f['identitySourceIds'])<=old.keys()|incoming.keys(),'Identity proof changed')
  s=incoming[f['sourceIds'][0]];c=captured[s['captureId']];p=planned[rid];claim=next(x for x in p['claims'] if x['id']==f['captureClaimId']);review=next(x for x in c['normalizedReview']['claimChecks'] if x['claimId']==claim['id'])
  require(c['recordReviewIds']==[rid] and review['matched'] is True and review['matchCount']>=1 and all(re.fullmatch('[a-f0-9]{64}',h) for h in review['matchSHA256']),'Claim unconfirmed or wrong subject')
  require(f['firstAvailableAt']==s['firstAvailableAt'] and f['publishedAt']==s['publishedAt'],'Fact dates differ from source')
  require(f['kind']==claim['kind'],'Evidence class changed')
  if f['kind']=='financial':
   o=f['observation'];v=o['value'];require(isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v) and v==APPROVED[rid][claim['id']]==claim['amountAED'] and all(n==v for n in review['observedAmountsAED']),'Price arithmetic or segment changed')
   require(o['observationKind']=='asking_quote' and o['metric']=='price' and f['evidenceClass']=='historical_developer_advertised_price' and not o.get('transactionId'),'Not a registered sale/rent/valuation')
   require(o['currency']==o['unit']=='AED' and o['frequency']=='daily' and o['period']==s['publishedAt'] and o['period']==APPROVED[rid]['launch'],'Native date/currency differs or pre-launch quote')
   require(o['segment']==claim['segment'] and o['bedrooms']==claim['bedrooms'] and o['areaBasis']=='total_advertised_price_no_area_conversion','Property/bedroom/area basis changed')
   require(o['currentSnapshotEligible'] is False and o['includeInCurrentSnapshot'] is False,'Historical quote must not replace current snapshot')
  else:
   require(f['milestone']==claim['milestone'] and f['date']=={'start':claim['period'],'precision':claim['precision']} and f['date']['start']==APPROVED[rid][claim['id']],'Native milestone period changed')
   require(f['eventStatus']==claim['eventStatus']==('reported' if f['milestone']=='launch' else 'planned') and f['verification']=='verified','Target promoted to actual outcome')
 return True

def apply(snapshot,packet,plan,capture):
 validate(snapshot,packet,plan,capture)
 from historical_enrichment import apply_enrichment
 out=copy.deepcopy(snapshot);known={r['id']:r for r in out['records']};before={r['id']:r for r in snapshot['records']};sources={s['id']:s for s in out['sources']}
 def source(s):require(s['id'] not in sources,'Source overwrite');sources[s['id']]=copy.deepcopy(s);out['sources'].append(sources[s['id']]);return s['id']
 counters=apply_enrichment(packet,[known[i] for i in sorted(APPROVED)],{},sources,source,{},packet['asOf'])
 changes=[]
 for rid in APPROVED:
  prior,r=before[rid],known[rid];allowed={'original_launch','advertised_prices'}|({'construction_targets','handover_targets'} if rid!='adrec:65' else set())
  for key,item in prior['researchStatus']['itemCoverage'].items():
   if key not in allowed:r['researchStatus']['itemCoverage'][key]=copy.deepcopy(item)
   new=r['researchStatus']['itemCoverage'][key]
   if new!=item:changes.append({'recordId':rid,'emirate':'Abu Dhabi','item':key,'before':item,'after':copy.deepcopy(new)})
  for key,v in prior['coverageSummary'].items():
   if key not in {'newFinancialEvidencePoints','lifecycleEvidencePoints'}:r['coverageSummary'][key]=copy.deepcopy(v)
  r['researchStatus']['originalAuditSourceScope']=prior['researchStatus'].get('originalAuditSourceScope')
  for key in ['observations','lifecycle']:require(r[key][:len(prior[key])]==prior[key],'Prior evidence removed/edited')
  for key in set(prior)-{'observations','lifecycle','researchStatus','coverageSummary'}:require(r.get(key)==prior[key],'Protected record field changed: '+key)
 for old,new in zip(snapshot['records'],out['records']):
  require(old['id']==new['id'],'Record order changed')
  if old['id'] not in APPROVED:require(old==new,'Unchanged record mutated')
 require(out['sources'][:len(snapshot['sources'])]==snapshot['sources'] and out['events']==snapshot['events'] and out['exposures']==snapshot['exposures'],'Source/event preservation failed')
 out['version']=out['manifest']['version']=VERSION
 out['manifest']['reviewedAldarPass48']={'packetPath':str((D/'accepted-packet.json').relative_to(ROOT)),'packetSemanticSHA256':digest(canonical(packet)),'acceptedFacts':23,'changedRecords':5,'numericForecastsAdded':0}
 out['manifest']['sourceEnrichment'].setdefault('supplementalPasses',[]).append({'passId':packet['passId'],**counters})
 a,b=ledger(snapshot),ledger(out);delta={k:b.get(k,0)-a.get(k,0) for k in STATES}
 require(delta==dict(present=18,partial=0,missing=-18,unestablished=0,disputed=0,inaccessible=0,**{'pre-applicability':0}),'Unexpected ledger changes')
 require(len(changes)==18 and all(x['before']['status']=='missing' and x['after']['status']=='present' for x in changes),'Unexpected requirement promotion')
 receipt=dict(schemaVersion=1,version=VERSION,priorVersion=PRIOR,priorSHA256=PRIOR_SHA,changedRecords=sorted(APPROVED),changedRecordsByEmirate={'Abu Dhabi':5},recordsReviewedByEmirate={'Abu Dhabi':5},sourcesAdded=5,acceptedFacts=23,askingPriceObservationsAdded=10,lifecycleFactsAdded=13,launchDatesAdded=5,plannedConstructionTargetsAdded=4,plannedHandoverTargetsAdded=4,registeredTransactionsAdded=0,signedRentsAdded=0,valuationsAdded=0,eventLinksAdded=0,numericForecastsAdded=0,coverageBefore=a,coverageAfter=b,coverageDelta=delta,itemChanges=changes,priorSourcesPreserved=len(snapshot['sources']),unaffectedRecordsPreserved=1855,remoteWrites=0,sourceReceiptSHA256=CAPTURE_SHA,withheldClaims=packet['withheldClaims'])
 return out,receipt

def inputs():
 raw=(D/'download-capture.json').read_bytes();require(digest(raw)==CAPTURE_SHA,'Frozen capture receipt mismatch');capture=json.loads(raw)
 raw=(D/'source-plan.json').read_bytes();require(digest(raw)==PLAN_SHA,'Frozen plan mismatch');plan=json.loads(raw)
 return plan,capture

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--snapshot',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 raw=read(a.snapshot);require(digest(raw)==PRIOR_SHA,'Exact V47 archive required');require(not a.output.exists(),'New output required')
 s=json.loads(raw);plan,capture=inputs();packet=materialize(s,plan,capture);out,receipt=apply(s,packet,plan,capture)
 a.output.mkdir(parents=True);(a.output/'candidate-snapshot.json').write_bytes(canonical(out)+b'\n');(a.output/'reconciliation.json').write_bytes(canonical(receipt)+b'\n')
 target=D/'accepted-packet.json';require(not target.exists(),'Append-only packet already exists');target.write_text(json.dumps(packet,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({k:v for k,v in receipt.items() if k!='itemChanges'}))
if __name__=='__main__':main()
