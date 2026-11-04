#!/usr/bin/env python3
"""Review authority UI captures and a new lawful DLD vintage; never promote name matches.
Raw transaction rows, identifiers, signed URLs and developer contacts stay private.
"""
import argparse,csv,gzip,hashlib,importlib.util,json
from collections import Counter,defaultdict
from datetime import date,datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
mod=importlib.util.spec_from_file_location('prior',ROOT/'scripts/review-dld-identity-pass38.py')
prior=importlib.util.module_from_spec(mod);mod.loader.exec_module(prior)

def digest(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()

def rows(path):
 with gzip.open(path,'rt',encoding='utf-8-sig',newline='') as f:yield from csv.DictReader(f)

def review(raw,out):
 receipt=json.loads((raw/'download-receipt.json').read_text())
 for f in receipt:
  path=raw/f['fileName'];assert path.stat().st_size==f['bytes'] and digest(path)==f['sha256']
 old=json.loads((ROOT/'docs/verification/dld-queue-review-2026-10-09/review.json').read_text())
 specs={}
 for record in old['records']:
  if record['existingSaleCoverage']=='missing':
   for g in record['candidateGroups']:
    if g['financiallyEligibleCandidates']:
     no=prior.integer(g['projectNumber'])
     specs[no]={'recordId':record['recordId'],'name':g['projectName'],'buildingName':g['buildingName'],'projectNumber':no,'areaId':prior.integer(g['areaId'])}
 assert len(specs)==10
 files=[raw/f['fileName'] for f in receipt if f['dataset']=='transactions']
 candidates={};count=0;selected=Counter()
 for path in files:
  for row in rows(path):
   count+=1
   try:no=prior.integer(row.get('project_number'))
   except ValueError:continue
   if no not in specs:continue
   selected[no]+=1
   key=row.get('transaction_id','').strip()
   # Missing identifiers get distinct keys and remain rejected by candidate_reason.
   key=key or '__missing_'+str(count)
   fingerprint=hashlib.sha256(json.dumps(row,sort_keys=True).encode()).hexdigest()
   if key not in candidates:candidates[key]={'row':row,'fingerprint':fingerprint,'copies':0,'conflict':False}
   item=candidates[key];item['conflict']|=fingerprint!=item['fingerprint']
 # Full second pass also catches revisions whose project number moved outside the target set.
 rescanned=0
 for path in files:
  for row in rows(path):
   rescanned+=1;key=row.get('transaction_id','').strip()
   if key in candidates:
    item=candidates[key];item['copies']+=1
    item['conflict']|=hashlib.sha256(json.dumps(row,sort_keys=True).encode()).hexdigest()!=item['fingerprint']
 groups=defaultdict(list)
 for item in candidates.values():groups[prior.integer(item['row']['project_number'])].append(item)
 results=[]
 for no,spec in specs.items():
  rejected=Counter();eligible=[];duplicates=0
  for item in groups[no]:
   duplicates+=max(0,item['copies']-1)
   reason='conflicting_duplicate_transaction_id' if item['conflict'] else prior.candidate_reason(item['row'],spec,date(2026,10,10))
   if reason:rejected[reason]+=1
   else:eligible.append(item['row'])
  dates=sorted(r['instance_date'][:10] for r in eligible)
  results.append({**spec,'sourceRows':selected[no],'duplicateRows':duplicates,'financiallyEligibleCandidates':len(eligible),'firstCandidateRegistration':dates[0] if dates else None,'lastCandidateRegistration':dates[-1] if dates else None,'nativeMonthlyCandidateCounts':dict(sorted(Counter(d[:7] for d in dates).items())),'exclusions':dict(rejected),'acceptedObservations':0,'coverageCredit':0,'status':'authority_component_and_existing_ownership_reconciliation_required'})
 result={'reviewedAt':datetime.now(timezone.utc).isoformat(),'baselineVersion':'20261009-enrichment-v40','sourceFiles':receipt,'sourceRowsScanned':count,'duplicateReconciliationRowsScanned':rescanned,'records':results,'acceptedObservations':0,'coverageCredit':0,'methodology':'Exact authority project number, area and project/building names identify candidate residential flat sales. Full-vintage duplicate revisions are quarantined. Financial eligibility does not establish catalogue/component ownership. Dates are source registration dates; earliest retained is not first-ever sale. Source vintage availability begins at capture, not transaction date.'}
 out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps({'scanned':count,'records':len(results),'candidates':sum(r['financiallyEligibleCandidates'] for r in results),'output':str(out)}))
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--raw',type=Path,required=True);a.add_argument('--output',type=Path,required=True);args=a.parse_args();review(args.raw,args.output)
