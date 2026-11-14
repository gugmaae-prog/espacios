#!/usr/bin/env python3
"""Review pinned primary Asora lifecycle evidence without resolving source conflicts by guesswork."""
import csv, hashlib, json, html, re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'data/historical-intelligence'
CAP=ROOT/'.local-data/asora-lifecycle-next'
RID='project:jumeirah-asora-bay-by-meraas-in-la-mer-dubai'
PINS={'jumeirah-announcement':'ca74565087180a86e8f36ebb4177b5c581d372c4a16731dc8490707e5e39ab3e','meraas-launch':'352879c9efffb8595a281c517045383375e7060f61ca80f37532f398a223a7f2','meraas-target':'5b747d30b09a5a546c2c027855916fc3a8edc4a3d4aa67a2ae03dabff4cf1a17'}
DATES={'jumeirah-announcement':'2025-04-28','meraas-launch':'2025-07-07','meraas-target':'2025-06-30'}
LABELS={'jumeirah-announcement':'Jumeirah announces Asora Bay hotel and residences','meraas-launch':'Meraas article reports the launch of Jumeirah Residences Asora Bay','meraas-target':'Meraas reports an early-2029 residential handover target'}
BASIS='Current Jumeirah Asora Bay / Meraas / La Mer catalogue record; primary operator and developer releases explicitly name the same residences and La Mer South. Exact DLD project 3445 / ID 691710228 is the parent hotel-and-residences registration. Parent register and hotel-only facts retain separate scope; no fan-out to the archived record, hotel rooms or Ocean Mansions.'

def main():
 s=json.loads((ROOT/'data/historical-intelligence-20261003.json').read_text());assert s['version']=='20261008-enrichment-v38'
 r=next(r for r in s['records'] if r['id']==RID);assert (r['name'],r['emirate'],r['communityId'])==('Jumeirah Asora Bay','Dubai','community:Dubai:la-mer')
 sources=[]
 for name,pin in PINS.items():
  c=json.loads((CAP/f'{name}-capture.json').read_text());b=(CAP/f'{name}.html').read_bytes()
  assert c['status']==200 and c['sha256']==pin==hashlib.sha256(b).hexdigest() and len(b)==c['bytes']
  text=re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',html.unescape(b.decode('utf-8'))))
  for phrase in ({'jumeirah-announcement':['28 April 2025','launched with Meraas','29 residences','six ocean villas'],'meraas-launch':['7th July 2025','35 exclusive residences'],'meraas-target':['30th June 2025','early 2029','35 ultra-premium properties']}[name]):assert phrase in text
  source={**c,'id':'asora39-'+name,'title':LABELS[name],'publisher':'Jumeirah' if name.startswith('jumeirah') else 'Meraas','publishedAt':DATES[name],'firstAvailableAt':c['retrievedAt'],'classification':'primary_operator_developer_lifecycle_report','primaryEvidence':True,'publicationDateBasis':'Date displayed on captured article; current body vintage first available at retrieval, not proven unchanged since publication','licence':'Minimal attributed factual extraction; raw webpage and media not redistributed','rawBodyRedistributed':False}
  same=[x for x in s['sources'] if x.get('url','').rstrip('/')==source['url'].rstrip('/')]
  if same:source.update(preserveRevision=True,revisionOfSourceId=same[-1]['id'])
  sources.append(source)
 raw=ROOT/'.local-data/dld-open-20261008/projects_2026-07-06_16-25-21_0001.csv.gz'
 assert hashlib.sha256(raw.read_bytes()).hexdigest()=='ffee59d637b1383e62ea24dab5be77e957090abf3860ce26b00b873fbdda6078'
 with raw.open(encoding='utf-8-sig') as f:rows=[x for x in csv.DictReader(f) if float(x['project_number'])==3445]
 assert len(rows)==1;p=rows[0]
 for k,v in {'project_id':'691710228','area_id':'317','developer_id':'452208509','project_start_date':'2025-05-01','project_end_date':'2029-03-31','project_status':'NOT_STARTED','project_status_ar':'تحت الانشاء','load_timestamp':'2026-06-15 15:24:01.000','no_of_units':'30'}.items():assert p[k]==v
 assert float(p['percent_completed'])==0 and '29 no. units' in p['project_description_en'] and '103 Rooms' in p['project_description_en']
 dld=next(x for x in s['sources'] if x['id']=='dld-official-projects-20260706')
 allsources={x['id']:x for x in sources+[dld]};facts=[]
 def fact(key,source,milestone,start,precision,label,note,scope='subject',event='reported',verification='reported',**extra):
  src=allsources[source]
  f={'id':'asora39-'+key,'recordId':RID,'status':'accepted','kind':'lifecycle','sourceIds':[source],'identitySourceIds':['dld38-meraas-asora-page','dld-official-projects-20260706'],'identityVerified':True,'identityBasis':BASIS,'primaryEvidence':True,'publishedAt':src.get('publishedAt'),'firstAvailableAt':max(src.get('firstAvailableAt') or src['retrievedAt'],'2026-10-08T23:48:12.944Z'),'milestone':milestone,'date':{'start':start,'precision':precision},'scope':scope,'eventStatus':event,'verification':verification,'evidenceClass':'primary_source_dated_lifecycle_report','label':label,'note':note,'preserveAdditionalLifecycleFields':True,**extra}
  facts.append(f);return f
 fact('announcement','asora39-jumeirah-announcement','announcement','2025-04-28','day','Jumeirah announces the Asora Bay development; residences already described as launched.','Dated operator announcement, not the first-ever launch or first marketing date. The article describes 29 residences including six ocean villas; later Meraas articles describe 35 properties. Preserve the differing populations without inventing a reconciliation.','subject','reported','verified',dateBasis='Explicit 28 April 2025 article dateline')
 fact('later-launch-report','asora39-meraas-launch','announcement','2025-07-07','day','Meraas publishes a launch report for the residences.','Article publication date, not established launch day. The earlier 28 April operator announcement already describes the residences as launched. Meraas states 35 residences; differing earlier inventory wording remains unresolved.',dateBasis='Displayed article date, not first-ever launch',relatedMilestoneIds=['asora39-announcement'])
 f=fact('residential-target','asora39-meraas-target','target_handover','2029','year','Meraas targets residential handover in early 2029.','The source says early 2029 without an exact day or quarter. Year precision retains that qualifier without converting it into Q1. Earlier Q1 2029 catalogue targets remain separate; no completion or occupancy is established.',event='planned',dateBasis='Developer target reported in article dated 30 June 2025',relatedMilestoneIds=[x['id'] for x in r['lifecycle'] if x['kind']=='target_handover'])
 f['date']['rawLabel']='early 2029';f['date']['qualifier']='early; intra-year bounds unspecified'
 fact('hotel-target','asora39-jumeirah-announcement','target_hotel_opening','2029','year','Jumeirah targets the associated hotel opening in 2029.','Hotel-only target. It does not establish residential handover, completed amenities, occupancy, rental income or appreciation.','hotel_component','planned',dateBasis='Hotel opening schedule in 28 April 2025 operator announcement')
 parent='parent_project';source=dld['id']
 fact('register-start',source,'register_declared_start','2025-05-01','day','Parent DLD register lists a declared project start of 1 May 2025.','Declared register date, not confirmed construction commencement. Parent project includes hotel and residential building; the same register vintage has conflicting status labels and zero completion.',parent,'planned',dateBasis='project_start_date in parent register; loaded 2026-06-15')
 fact('register-end',source,'register_target_completion','2029-03-31','day','Parent DLD register lists a planned end date of 31 March 2029.','Parent-project schedule, not confirmed completion or an independently verified residential handover. Retain beside the developer early-2029 target and earlier catalogue Q1 label.',parent,'planned',dateBasis='project_end_date in parent register; loaded 2026-06-15')
 fact('register-conflict',source,'register_status_report','2026-06-15','day','Parent register reports zero completion with conflicting construction-status labels.','English NOT_STARTED conflicts with Arabic تحت الانشاء (under construction). Native percent_completed is 0.00000. Load date is not an inspection date. The parent includes hotel and residential buildings; no dwelling-level progress or actual construction date is established. Generic no_of_units=30 also differs from the 29 residential units in the description; no unit count is inferred.',parent,'reported','disputed',dateBasis='load_timestamp 2026-06-15 15:24:01.000; timezone not supplied')
 packet={'schemaVersion':1,'passId':'asora-primary-lifecycle-pass39-20261009','priorVersion':s['version'],'candidateVersion':'20261009-enrichment-v39','asOf':'2026-10-09','sources':sources,'facts':facts,'recordIdentityChecks':[{'recordId':RID,'catalogueName':r['name'],'type':r['type'],'emirate':r['emirate'],'basis':BASIS}], 'recordResearch':[], 'collection':{'asOf':'2026-10-09','acceptedLifecycleFacts':7,'newFinancialObservations':0,'newSources':3,'rawBodiesRedistributed':False},'conflicts':[{'field':'inventory','status':'unresolved','values':['Jumeirah: 29 residences including six ocean villas','Meraas: 35 residences/properties','DLD description: 29 residential-building units','DLD generic no_of_units: 30'],'resolution':'No common reconciled unit total or individual-unit mapping inferred'},{'field':'construction_status','status':'unresolved','values':['NOT_STARTED','تحت الانشاء','percent_completed 0.00000'],'resolution':'Preserved parent-register report; actual residential start and progress unverified'}],'methodology':'Pinned primary source reports retain occurrence, publication and availability dates; report dates are not automatically launch dates. Uncertain early-2029 timing stays year precision with its raw qualifier. Parent/hotel facts do not establish residential prices or occupancy. Prior source vintages, observations and schedules remain unchanged.','excludedCandidates':[{'recordId':'project:jumeirah-asora-bay-la-mer-dubai','reason':'Archived candidate remains unverified; no lifecycle or financial fan-out'}]}
 (BASE/'asora-lifecycle-pass39-20261009.json').write_text(json.dumps(packet,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'facts':len(facts),'sources':len(sources),'financialObservations':0,'conflicts':len(packet['conflicts'])}))
if __name__=='__main__':main()
