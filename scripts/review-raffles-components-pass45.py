#!/usr/bin/env python3
"""Record a component conflict without promoting transactions or coverage."""
import json,hashlib,csv,gzip
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];RAW=ROOT/'.local-data/identity-pass45'
def main():
 receipts=json.loads((RAW/'capture-receipts.json').read_text())
 for r in receipts:
  p=RAW/r['file'];assert hashlib.sha256(p.read_bytes()).hexdigest()==r['sha256'] and p.stat().st_size==r['bytes']
 captures=[];by={}
 for slug in ['raffles-fact-sheet','raffles-developer','raffles-inspection']:
  p=RAW/(slug+'.json');c=json.loads(p.read_text());by[slug]=c
  captures.append({'id':slug,'url':c['url'],'retrievedAt':c['retrievedAt'],'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size})
 sheet=by['raffles-fact-sheet']['text'];dev=by['raffles-developer']['text'];inspection=by['raffles-inspection']['text']
 assert all(t in sheet for t in ['Emerald Palace Kempinski Hotel','Project Number\n1382','Units\n383','Commercial (373)','Residential (10)','2 B/R (8)','3 B/R (2)','Registered\n22/10/2013','Started\n25/09/2013','Completion\n15/05/2019'])
 assert all(t in dev for t in ['Sunrise Properties Limited','Developer Number\n969','@epghotelsresorts.com'])
 assert 'Inspection Date\n15/05/2019' in inspection and '100 %' in inspection
 exports=[r for r in json.loads((ROOT/'.local-data/identity-pass41/download-receipt.json').read_text()) if r['dataset']=='transactions'];rows=[];scanned=0
 for export in exports:
  path=ROOT/'.local-data/identity-pass41'/export['fileName'];assert hashlib.sha256(path.read_bytes()).hexdigest()==export['sha256'] and path.stat().st_size==export['bytes']
  with gzip.open(path,'rt',encoding='utf-8-sig',newline='') as f:
   for row in csv.DictReader(f):
    scanned+=1
    if 'raffles' in (row.get('project_name_en','')+' '+row.get('building_name_en','')).lower():rows.append(row)
 assert scanned==1800588
 counts=Counter((r['trans_group_en'],r['property_usage_en'],r['property_sub_type_en']) for r in rows)
 assert counts=={('Sales','Hospitality','Hotel Rooms'):94,('Gifts','Hospitality','Hotel Rooms'):19,('Sales','Residential','Flat'):7,('Mortgages','Residential','Flat'):1}
 assert all(r['project_number']=='1382.00' and r['building_name_en']=='Raffles The Palm Dubai' and r['area_id']=='410' for r in rows)
 out={'passId':'raffles-component-review-20261012','status':'component_identity_unresolved','authorityProject':{'number':1382,'name':'Emerald Palace Kempinski Hotel','registeredDeveloper':'Sunrise Properties Limited','developerNumber':969,'developerRegisterId':10472556,'publicBusinessContactDomain':'epghotelsresorts.com','statusAtCapture':'Finished','registeredDate':'2013-10-22','sourceStartDate':'2013-09-25','sourceCompletionField':'2019-05-15','inspection':{'date':'2019-05-15','percent':100,'kind':'dated_authority_inspection','occupancyInferred':False},'inventory':{'total':383,'commercial':373,'residential':10,'residentialBedrooms':{'2':8,'3':2}}},'primaryMarketingInventory':{'apartments':27,'penthouses':3,'villas':3,'sourceFile':'raffles-factsheet.pdf','sourcePage':2,'visualInspectionCompleted':True,'publicationDate':None},'candidateRows':[{'transactionGroup':k[0],'usage':k[1],'subtype':k[2],'rows':v} for k,v in sorted(counts.items())],'catalogueRecordsConsidered':['project:raffles-residences-penthouses-the-palm-dubai-for-sale-on-palm-jumeirah','project:raffles-the-palm-dubai-villas-on-palm-jumeirah-for-sale'],'decision':'Do not assign residential flats to villa-only record. The residences record is a possible owner, but authority residential inventory and marketed inventory are not yet reconciled. Shared building name and group contact domain do not establish exact unit/component continuity. Need unit-level mapping or dated inventory/redevelopment reconciliation. Exclude hotel-room sales from residential histories.','acceptedFinancialObservations':0,'coverageCredit':0,'geometryAccepted':False,'rawRowsAndCapturesRedistributed':False,'captureReceipts':receipts,'authorityCaptures':captures,'transactionSourceCaptures':exports,'transactionSourceRowsScanned':scanned}
 path=ROOT/'docs/verification/raffles-component-review-2026-10-12/review.json';path.write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({'capturedRows':len(rows),'residentialSaleCandidates':7,'accepted':0,'coverageCredit':0}))
if __name__=='__main__':main()
