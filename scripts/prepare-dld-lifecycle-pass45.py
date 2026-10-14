#!/usr/bin/env python3
"""Prepare dated authority milestones only for previously verified project identities."""
import gzip,hashlib,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'data/historical-intelligence'
ROOT_SHA='b87232342eabc47776b97277cc7cc8a63dc59846264eb406e816ff2c97bcab4d'
SLUGS={4482:'wraith',4157:'helvetia',4142:'divine',4226:'inaura',4437:'eira',4359:'cresswell',4453:'soma',4066:'avida'}
sha=lambda b:hashlib.sha256(b).hexdigest()
def prepare():
 blob=(BASE/'objects'/f'{ROOT_SHA}.json.gz').read_bytes()
 assert sha(blob)==ROOT_SHA
 snapshot=json.loads(gzip.decompress(blob));records={r['id']:r for r in snapshot['records']};sources={s['id']:s for s in snapshot['sources']}
 a=json.loads((BASE/'dld-authority-pass41-20261012.json').read_text());av=json.loads((BASE/'dld-authority-pass44-20261012.json').read_text())
 authorities={r['projectNumber']:r for r in a['records']};authorities[4066]=av['record']
 checks=[];inputs=[]
 for n in [41,42,43,44]:
  path=BASE/f'dld-sales-pass{n}-20261012.json';packet=json.loads(path.read_text());checks+=packet['recordIdentityChecks'];inputs.append({'path':str(path.relative_to(ROOT)),'sha256':sha(path.read_bytes())})
 assert len(checks)==8 and len({c['recordId'] for c in checks})==8
 facts=[];captures=[];excluded=[]
 for c in checks:
  number=c['authorityProjectNumber'];r=records[c['recordId']];a=authorities[number];slug=SLUGS[number]
  assert r['name']==c['catalogueName'] and r['type']=='project' and a['registeredDeveloperNumber']==c['authorityDeveloperNumber']
  sourceid='dld44-public-avida-status-20261012' if number==4066 else 'dld41-public-project-status-20261012'
  assert sourceid in sources and all(s in sources for s in c['sourceIds'])
  capture_dir=ROOT/'.local-data'/('identity-pass44' if number==4066 else 'identity-pass41')
  for kind in ['fact-sheet','inspection','developer']:
   name=f'{slug}-{kind}';p=capture_dir/(name+'.json');raw=p.read_bytes();capture=json.loads(raw)
   meta=next(x for x in (av['sourceCaptures'] if number==4066 else json.loads((BASE/'dld-authority-pass41-20261012.json').read_text())['sourceCaptures']) if x['id']==name)
   assert sha(raw)==meta['captureSHA256'] and len(raw)==meta['bytes']
   captures.append({'id':name,'sha256':sha(raw),'bytes':len(raw),'retrievedAt':capture['retrievedAt'],'url':capture['url']})
  sheet=json.loads((capture_dir/(slug+'-fact-sheet.json')).read_text())['text']
  assert str(number) in sheet and a['authorityName'] in sheet
  available=max([a['firstAvailableAt'],*[sources[s]['firstAvailableAt'] for s in c['sourceIds'] if sources[s].get('firstAvailableAt')]])
  def add(field,kind,label,event_status,note,progress=None):
   d=a[field] if field!='inspection' else a['inspection']['date']
   assert len(d)==10 and d[4]==d[7]=='-'
   if field=='registerStartDate' and d>'2026-10-13':
    event_status='planned';label='Future filed project start target; physical commencement not established'
   if field!='inspection':assert '/'.join(reversed(d.split('-'))) in sheet
   fact={'id':f'dld45-{number}-{field}','recordId':r['id'],'status':'accepted','kind':'lifecycle','milestone':kind,'date':{'start':d,'precision':'day'},'sourceId':sourceid,'identityBasis':c['basis'],'identitySourceIds':c['sourceIds'],'firstAvailableAt':available,'publishedAt':None,'primaryEvidence':True,'verification':'reported','scope':'subject','identityVerified':True,'eventStatus':event_status,'label':label,'note':note,'evidenceClass':'primary_authority_dated_project_report','preserveAdditionalLifecycleFields':True,'dateBasis':f'DLD public project-status {field}; source capture retained with checksum'}
   if progress is not None:fact['progressPercent']=progress
   facts.append(fact)
  add('registeredDate','registration','Authority-reported project registration','reported','Registration date is not first announcement, marketing, sale or construction commencement.')
  add('registerStartDate','filed_project_start','Filed project start date; physical commencement not established','reported','Registry Started field retained as filed; not promoted to actual construction start or used to create pre-launch prices.')
  add('scheduledCompletionDate','target_completion','Authority scheduled completion; actual completion not established','planned','Scheduled date retains day precision and does not supersede earlier developer/catalogue schedules or establish occupancy.')
  inspection=a['inspection']
  if inspection['date']>'2026-10-13' or inspection['status']=='quarantined_future_dated':
   excluded.append({'recordId':r['id'],'field':'inspection','date':inspection['date'],'reason':'Future-dated inspection remains quarantined; no actual progress inferred.'})
  else:
   text=json.loads((capture_dir/(slug+'-inspection.json')).read_text())['text']
   assert '/'.join(reversed(inspection['date'].split('-'))) in text
   percent=re.search(r'Download Report\s+([0-9.]+)\s*%\s*Current Progress',text)
   assert percent and float(percent.group(1))==inspection['percent']
   add('inspection','construction_progress',f"Authority inspection reports {inspection['percent']:g}% on its dated report",'reported','Dated inspection only, not present progress. Zero is retained as zero and does not prove physical commencement. Conflicting developer reports remain separate.',inspection['percent'])
 assert len(facts)==31 and len(excluded)==1
 return {'schemaVersion':1,'passId':'dld-lifecycle-pass45-20261013','priorVersion':snapshot['version'],'priorRootSHA256':ROOT_SHA,'asOf':'2026-10-13','publicationStatus':'prepared_not_integrated','sources':[],'facts':facts,'recordIdentityChecks':checks,'sourceCaptures':captures,'inputPackets':inputs,'excluded':excluded,'financialObservationsAdded':0,'limitations':['No actual completion or occupancy inferred.','No corporate alias inferred from marketed brand.','Filed start is not actual construction commencement.','No new source capture claimed; retained captures reused after identity verification.','Conflicting schedules and developer/authority progress reports remain separate.','No observed prices or conditional scenario values created.']}
if __name__=='__main__':
 packet=prepare();out=BASE/'dld-lifecycle-pass45-20261013.json';out.write_text(json.dumps(packet,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'facts':len(packet['facts']),'records':len(packet['recordIdentityChecks']),'excluded':packet['excluded'],'status':packet['publicationStatus']}))
