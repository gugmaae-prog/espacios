#!/usr/bin/env python3
"""Normalize bounded DLD browser captures; no contact details or invented observations."""
import argparse,csv,gzip,hashlib,json,re
from datetime import date,datetime
from decimal import Decimal
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
EXPECTED={'wraith':(4482,'Binghatti Wraith'),'helvetia':(4157,'Helvetia Marine'),'divine':(4142,'Divine Elements'),'oakmont':(4337,'Oakmont'),'inaura':(4226,'Inaura Hotels & Residences'),'eira':(4437,'Eira'),'cresswell':(4359,'Cresswell Plaza'),'soma':(4453,'Soma Residences')}

def digest(b):return hashlib.sha256(b).hexdigest()
def next_value(text,label):
 lines=[x.strip() for x in text.splitlines() if x.strip()]
 i=lines.index(label);return lines[i+1]
def native_date(s):return datetime.strptime(s,'%d/%m/%Y').date().isoformat()
def integer(s):
 n=Decimal(s);assert n.is_finite() and n==n.to_integral_value() and n>0;return int(n)
def parse_capture(slug,parts):
 no,name=EXPECTED[slug];sheet=parts['fact-sheet'];t=sheet['text'];d=parts['developer']['text'];i=parts['inspection']['text']
 assert integer(next_value(t,'Project Number'))==no and name in t.splitlines()
 assert name in d.splitlines() and name in i.splitlines()
 inspection=native_date(next_value(i,'Inspection Date'));available=max(x['retrievedAt'] for x in parts.values())
 progress=float(re.search(r'\n([\d.]+) %\nCurrent Progress',i).group(1));assert 0<=progress<=100
 location=next(x for x in sheet['links'] if x['text']=='View on map')
 result={'projectNumber':no,'authorityName':name,'registeredDeveloperName':next_value(d,'Developer Name'),'registeredDeveloperNumber':integer(next_value(d,'Developer Number')),'registeredDate':native_date(next_value(t,'Registered')),'registerStartDate':native_date(next_value(t,'Started')),'scheduledCompletionDate':native_date(next_value(t,'Completion')),'registeredUnits':integer(next_value(t,'Units')),'registerAreaSqm':float(next_value(t,'Sq.Mt')),'locationLabel':location['title'],'mapURL':location['href'],'mapCoordinatesEligible':False,'mapCoordinatesReason':'The same coordinate pair occurs on distinct DLD project pages; no exact property geometry inferred.','inspection':{'date':inspection,'percent':progress,'status':'quarantined_future_dated' if inspection>available[:10] else 'dated_authority_report','currentProgressEligible':False,'reason':'Future-dated source field' if inspection>available[:10] else 'Dated inspection, not proof of progress on retrieval day'},'buildingBreakdown':t.split('Building Details\n',1)[1].splitlines(),'firstAvailableAt':available,'publicationDate':None,'classification':'authority_project_register_snapshot','priceObservationCreated':False,'catalogueIdentityStatus':'component_or_marketing_legal_bridge_review_required','dateSemantics':'Registration is not first marketing/sale. Registry Started is a source schedule field, not independently verified commencement. Completion is scheduled, not actual completion or occupancy. Inspection date remains distinct from retrieval.'}
 return result

def prepare(raw,output):
 captures=[];records=[]
 receipt=json.loads((raw/'download-receipt.json').read_text())
 developerFile=next(x for x in receipt if x['dataset']=='developers')
 developerBytes=(raw/developerFile['fileName']).read_bytes()
 assert len(developerBytes)==developerFile['bytes'] and digest(developerBytes)==developerFile['sha256']
 for slug in EXPECTED:
  parts={}
  for part in ['fact-sheet','inspection','developer']:
   path=raw/(slug+'-'+part+'.json');b=path.read_bytes();j=json.loads(b);parts[part]=j
   assert j['url'].startswith('https://dubailand.gov.ae/en/eservices/real-estate-project-status-landing/real-estate-project-status')
   captures.append({'id':slug+'-'+part,'publisher':'Dubai Land Department','url':j['url'],'retrievedAt':j['retrievedAt'],'captureSHA256':digest(b),'bytes':len(b),'captureMethod':'visible public browser DOM after search by project number','rawCaptureRedistributed':False})
  records.append(parse_capture(slug,parts))
 # Compare legal developer number and name against independent downloadable register.
 with gzip.open(raw/'developers_2026-10-01_23-34-28_0001.csv.gz','rt',encoding='utf-8-sig') as f:developers=list(csv.DictReader(f))
 norm=lambda s:' '.join(re.findall(r'\w+',s.casefold()))
 for r in records:
  matches=[d for d in developers if integer(d['developer_number'])==r['registeredDeveloperNumber']]
  assert len(matches)==1 and norm(matches[0]['developer_name_en'])==norm(r['registeredDeveloperName'])
  r['downloadRegisterDeveloperId']=integer(matches[0]['developer_id']);r['developerRegisterCrosscheck']='exact_number_and_normalized_name'
 assert len({r['mapURL'] for r in records})==1,'Review coordinate anomaly if source changes'
 data={'schemaVersion':1,'asOf':'2026-10-12','publicationStatus':'review_packet_not_production','sourceCaptures':captures,'developerRegisterSource':developerFile,'records':records,'recordsReviewed':len(records),'financialObservationsAdded':0,'coverageCredit':0,'limitations':['Catalogue component ownership and existing transaction deduplication remain release gates.','Reported source schedules and dated inspection percentages do not create prices, occupancy, valuations or forecast coefficients.','Cresswell future inspection is quarantined.','Identical map URLs are not accepted as project coordinates.']}
 output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(data,indent=2)+'\n');print(json.dumps({'records':len(records),'captures':len(captures),'futureInspectionQuarantines':sum(r['inspection']['status']=='quarantined_future_dated' for r in records)}))
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--raw',type=Path,required=True);a.add_argument('--output',type=Path,required=True);args=a.parse_args();prepare(args.raw,args.output)
