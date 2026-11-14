#!/usr/bin/env python3
"""Append manually accepted regional facts to the pinned V46 evidence, locally only."""
import argparse,collections,datetime,gzip,hashlib,json,math,re
from copy import deepcopy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'data/historical-intelligence'
PRIOR='20261013-enrichment-v46';VERSION='20261014-enrichment-v47'
PRIOR_SHA='9e32d607d01b6e9e0a6d4ce2da5f689f7df6bb8ecb50d5adb0283d1f8ea005b8'
PACKET_REL='data/historical-intelligence/reviewed-regional-20261014/accepted-packet.json'
canonical=lambda x:json.dumps(x,ensure_ascii=False,separators=(',',':'),sort_keys=True).encode()
digest=lambda x:hashlib.sha256(x).hexdigest()
STATES=('present','partial','missing','unestablished','disputed','inaccessible','pre-applicability')
def require(condition,message):
 if not condition:raise ValueError(message)
def ledger(snapshot):return dict(collections.Counter(i['status'] for r in snapshot['records'] for i in r['researchStatus']['itemCoverage'].values()))
def instant(value):
 d=datetime.datetime.fromisoformat(value.replace('Z','+00:00'));require(d.tzinfo is not None,'Explicit timezone required');return d

def validate(packet,snapshot,captures):
 require(snapshot['version']==packet['priorVersion']==PRIOR,'Prior version mismatch')
 require(packet['candidateVersion']==VERSION and packet['priorSHA256']==PRIOR_SHA,'Pinned candidate mismatch')
 require(packet['asOf']=='2026-10-14','Fixed evidence cutoff required')
 records={r['id']:r for r in snapshot['records']}
 require(len(records)==len(snapshot['records'])==1860,'Catalogue IDs changed')
 require(collections.Counter(r['type'] for r in records.values())=={'project':1645,'community':215},'Catalogue types changed')
 sources={s['id']:s for s in snapshot['sources']};incoming={s['id']:s for s in packet['sources']}
 require(len(incoming)==len(packet['sources']) and not sources.keys()&incoming.keys(),'Duplicate source identity')
 require(not packet.get('numericForecasts') and not packet.get('scenarioAssumptions') and packet.get('automaticPriceUplift') is None,'No new numeric scenarios or uplift')
 checks={r['recordId']:r for r in packet['recordIdentityChecks']}
 require(len(checks)==len(packet['recordIdentityChecks']),'Duplicate identity checks')
 for ident,check in checks.items():
  require(ident in records,'Unknown exact record ID');r=records[ident]
  require((r['name'],r['type'],r['emirate'])==(check['catalogueName'],check['type'],check['emirate']),'Record identity changed')
  require(check['matchMethod'] in ['official_project_page_name_developer_geography','authority_id_name_developer_geography'],'Unapproved identity method')
  require(check['legalDeveloperChanged'] is False and bool(check['identityBasis']),'Legal/marketing role boundary')
  if ident.startswith('adrec:'):
   ids={str(x.get('fields',{}).get('projectNumber')) for x in r.get('registerEvidence',[]) if x.get('identityVerified') is True}
   require(check['authorityProjectNumber'] in ids,'Authority project number mismatch')
 for s in incoming.values():
  require(s['url'].startswith('https://') and s['httpStatus']==200,'Source capture missing')
  require(re.fullmatch('[a-f0-9]{64}',s['sha256']) and isinstance(s['bytes'],int) and s['bytes']>0,'Capture checksum/size missing')
  require(s['rawBodyRetained'] is False and s['rawBodyRedistributed'] is False and s['reuseStatus']=='normalized_metadata_only','Source rights boundary')
  require(s['firstAvailableAt']==s['retrievedAt'] and instant(s['retrievedAt']).date().isoformat()<=packet['asOf'],'Availability cannot be backdated')
  require(not s.get('publishedAt') or s['publishedAt']<=packet['asOf'],'Future publication')
  c=captures[s['captureId']]
  require(c['httpStatus']==200 and c['sha256']==s['sha256'] and c['responseBytes']==s['bytes'] and c['retrievedAt']==s['retrievedAt'],'Capture provenance mismatch')
  require(c['rawRetained'] is False and c['captureStatus']=='captured_metadata_only','Unavailable source cannot become accepted evidence')
  same=[x for x in sources.values() if x.get('url','').rstrip('/')==s['url'].rstrip('/')]
  if same:require(s.get('preserveRevision') is True and s.get('revisionOfSourceId') in {x['id'] for x in same},'Existing source must retain immutable revision')
 facts=packet['facts'];ids={f['id'] for f in facts}
 require(len(ids)==len(facts) and facts,'Duplicate or empty fact packet')
 existing={x['id'] for r in records.values() for field in ['lifecycle','observations','registerEvidence'] for x in r.get(field,[]) if x.get('id')}
 require(not ids&existing,'Fact ID already exists')
 require({f['recordId'] for f in facts}==checks.keys(),'Orphan fact/identity check')
 for f in facts:
  r=records[f['recordId']]
  require(f['status']=='accepted' and f['primaryEvidence'] is True and f['identityVerified'] is True and f['scope']=='subject','Exact primary subject evidence required')
  require(f['identityBasis']==checks[r['id']]['identityBasis'],'Identity proof differs')
  require(f['sourceIds'] and set(f['sourceIds'])<=incoming.keys(),'Fact source not in reviewed pass')
  require(f['identitySourceIds'] and set(f['identitySourceIds'])<=(sources.keys()|incoming.keys()),'Orphan identity proof')
  s=incoming[f['sourceIds'][0]];c=captures[s['captureId']]
  require(f['firstAvailableAt']==s['firstAvailableAt'],'Fact availability backdated')
  require(f['recordId'] in c['reviewAgainstIds'],'No attachment outside predeclared exact targets')
  require(not any(x.get('scope')=='subject' and x.get('identityVerified') for x in r['historySeries']),'Financial native cohorts must be hydrated before touching this record')
  if f['kind']=='financial':
   o=f['observation'];v=o['value'];require(isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v) and v>0,'Invalid amount')
   require(o['metric']=='price' and o['unit']==o['currency']=='AED' and o['observationKind']=='asking_quote' and f['evidenceClass']=='advertised_asking_price','Do not promote quotes to transactions or valuations')
   require(o['period']==s['retrievedAt'][:10] and o['frequency']=='daily','Advertisement capture date must be native period')
   require(o['currentSnapshotEligible'] is False and o['includeInCurrentSnapshot'] is False,'Keep existing headline snapshots unchanged')
   require(o['segment'] and o['areaBasis'] and o['tenureRegistrationClass']=='advertisement_not_registered_transaction','Units and segment semantics required')
   proof=f['numericProof'];row=c['normalizedReview'][proof['array']][proof['index']]
   amount=float(row['amount'].replace(',',''));scale=(row.get('scale') or '').lower();mult=1000000 if scale in ['m','million'] else 1000 if scale=='k' else 1
   require(abs(amount*mult-v)<0.001,'Quote arithmetic does not match captured amount')
   if proof['array']=='cards':require(row['sourceName']==proof['sourceName'],'Multi-project source card mismatch')
   require(not o.get('transactionId') and not o.get('forecast'),'No transaction/forecast masquerading')
  elif f['kind']=='lifecycle':
   require(f['milestone'] in ['launch','first_marketing','target_completion'] and f['verification']=='verified','Only reviewed launch/marketing or planned completion milestones')
   require(f['eventStatus']==('planned' if f['milestone']=='target_completion' else 'reported'),'Planned versus actual status mismatch')
   date=f['date'];require(date['precision'] in ['day','month','quarter','range'],'Native date precision required')
   require(f['eventStatus']=='planned' or date['start'][:4]<='2026','No future actual outcomes')
   if f['milestone']=='target_completion':
    proof=f['targetProof'];row=c['normalizedReview']['cards'][proof['index']]
    require(row['recordId']==f['recordId'] and row['targetCompletion']==date['start'] and row['dateStatus']=='planned_not_actual','Planned target/source card mismatch')
   if f.get('phraseProof'):require(c['normalizedReview']['reviewedPhraseChecks'].get(f['phraseProof']) is True,'Captured launch statement missing')
   else:require(all(c['normalizedReview']['identityChecks'].values()),'Captured named project evidence absent')
  else:raise ValueError('Unsupported regional evidence class')
 return True

def apply_packet(snapshot,packet,captures):
 validate(packet,snapshot,captures)
 from historical_enrichment import apply_enrichment
 original=deepcopy(snapshot);snapshot=deepcopy(snapshot);known={r['id']:r for r in snapshot['records']};before={r['id']:r for r in original['records']}
 changed={f['recordId'] for f in packet['facts']};sources={s['id']:s for s in snapshot['sources']}
 def add_source(s):
  require(s['id'] not in sources,'Source overwrite');sources[s['id']]=deepcopy(s);snapshot['sources'].append(sources[s['id']]);return s['id']
 affected=[known[x] for x in sorted(changed)]
 result=apply_enrichment(packet,affected,{},sources,add_source,{},packet['asOf'])
 changes=[]
 for r in affected:
  prior=before[r['id']];allowed=set()
  kinds={f['kind'] for f in packet['facts'] if f['recordId']==r['id']}
  if 'financial' in kinds:allowed.add('advertised_prices')
  if any(f['recordId']==r['id'] and f.get('milestone')=='launch' for f in packet['facts']):allowed.add('original_launch')
  if any(f['recordId']==r['id'] and f.get('milestone')=='first_marketing' for f in packet['facts']):allowed.add('announcement_registration')
  if any(f['recordId']==r['id'] and f.get('milestone')=='target_completion' for f in packet['facts']):allowed.add('handover_targets')
  for key,old in prior['researchStatus']['itemCoverage'].items():
   if key not in allowed:r['researchStatus']['itemCoverage'][key]=deepcopy(old)
   new=r['researchStatus']['itemCoverage'][key]
   if old!=new:changes.append(dict(recordId=r['id'],emirate=r['emirate'],item=key,before=old,after=deepcopy(new)))
  require(r['observations'][:len(prior['observations'])]==prior['observations'] and r['lifecycle'][:len(prior['lifecycle'])]==prior['lifecycle'],'Prior facts mutated')
  for k in ['historySeries','registerEvidence','currentSnapshot','scenarioInputs','scenarioCoverage','communityId']:
   require(r.get(k)==prior.get(k),'Protected field changed: '+k)
  for k,v in prior['coverageSummary'].items():
   if k not in {'newFinancialEvidencePoints','lifecycleEvidencePoints'}:r['coverageSummary'][k]=deepcopy(v)
  r['researchStatus']['originalAuditSourceScope']=prior['researchStatus'].get('originalAuditSourceScope')
 for old,new in zip(original['records'],snapshot['records']):
  require(old['id']==new['id'],'Catalogue reordering')
  if old['id'] not in changed:require(old==new,'Unaffected record changed')
 require(snapshot['sources'][:len(original['sources'])]==original['sources'],'Source identity mutated')
 require(snapshot['events']==original['events'] and snapshot['exposures']==original['exposures'],'Events mutated')
 snapshot['version']=VERSION;snapshot['asOf']=packet['asOf'];snapshot['manifest']['version']=VERSION;snapshot['manifest']['asOf']=packet['asOf']
 snapshot['manifest']['reviewedRegionalPass47']={'passId':packet['passId'],'packetPath':PACKET_REL,'packetSemanticSHA256':digest(canonical(packet)),'acceptedFacts':len(packet['facts']),'changedRecords':len(changed),'numericForecastsAdded':0,'rawBodiesRedistributed':False}
 snapshot['manifest']['sourceEnrichment'].setdefault('supplementalPasses',[]).append({'passId':packet['passId'],**result})
 before_ledger=ledger(original);after_ledger=ledger(snapshot)
 receipt=dict(schemaVersion=1,version=VERSION,priorVersion=PRIOR,priorSHA256=PRIOR_SHA,changedRecords=sorted(changed),changedRecordsByEmirate=dict(collections.Counter(known[x]['emirate'] for x in changed)),sourcesAdded=len(packet['sources']),acceptedFacts=len(packet['facts']),lifecycleFactsAdded=sum(f['kind']=='lifecycle' for f in packet['facts']),askingPriceObservationsAdded=sum(f['kind']=='financial' for f in packet['facts']),registeredTransactionsAdded=0,signedRentsAdded=0,valuationsAdded=0,eventLinksAdded=0,numericForecastsAdded=0,coverageBefore=before_ledger,coverageAfter=after_ledger,coverageDelta={k:after_ledger.get(k,0)-before_ledger.get(k,0) for k in STATES},itemChanges=changes,unaffectedRecordsPreserved=1860-len(changed),priorSourcesPreserved=len(original['sources']),priorNativeHistoryUnchanged=True,remoteWrites=0)
 return snapshot,receipt

def load_captures(directory):
 captures={}
 for f in sorted(directory.glob('*-capture.json')):
  for c in json.loads(f.read_bytes())['sources']:
   require(c['id'] not in captures,'Duplicate capture ID');captures[c['id']]=c
 return captures

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--snapshot',type=Path,default=ROOT/'data/historical-intelligence-20261003.json');p.add_argument('--packet',type=Path,default=ROOT/PACKET_REL);p.add_argument('--captures',type=Path,default=BASE/'reviewed-regional-20261014/captures');p.add_argument('--output',type=Path,required=True)
 a=p.parse_args();raw=a.snapshot.read_bytes();raw=gzip.decompress(raw) if a.snapshot.suffix=='.gz' else raw;require(digest(raw)==PRIOR_SHA,'Snapshot checksum mismatch');require(not a.output.exists(),'New output directory required')
 snapshot,receipt=apply_packet(json.loads(raw),json.loads(a.packet.read_bytes()),load_captures(a.captures));a.output.mkdir(parents=True)
 (a.output/'candidate-snapshot.json').write_bytes(canonical(snapshot)+b'\n');(a.output/'reconciliation.json').write_bytes(canonical(receipt)+b'\n');print(json.dumps({k:v for k,v in receipt.items() if k!='itemChanges'}))
if __name__=='__main__':main()
