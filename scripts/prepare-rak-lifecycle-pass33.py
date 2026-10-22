#!/usr/bin/env python3
"""Compile reviewed launch, schedule, progress and dated-advertisement evidence."""
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'data/historical-intelligence'
OUT=BASE/'rak-properties-lifecycle-pass33-20261008.json'
RECORDS={
 'edge':'project:edge-rak-properties-raha-island-mina-ras-al-khaimah',
 'skai':'project:studios-apartments-and-penthouses-skai-raha-island',
 'mirasol':'project:mirasol-by-rak-properties-in-mina-al-arab',
 'mirasol2':'project:mirasol-2-north-harbour-mina-rak-uae',
 'enta':'project:enta-mina-hive-rak-properties-uae',
 'anantara':'project:anantara-mina-ras-al-khaimah-residences',
 'nura':'project:nura-rak-properties-mina-ras-al-khaimah-uae',
 'solera':'project:buy-apartment-solera-raha-island',
 'bayviews':'project:bayviews-by-rak-properties-on-hayat-island-mina-ras-al-khaimah',
 'cape':'project:cape-hayat-by-rak-properties-on-hayat-island-mina-rak',
 'quattro':'project:quattro-del-mar-by-rak-properties-on-hayat-island',
}
IDENTITY={
 'edge':('rak33-edge-launch','Exact EDGE name, RAK Properties developer and Raha Island location match the retained catalogue; not another developer\'s Edge.'),
 'skai':('rak33-skai-launch','Exact SKAI name, RAK Properties developer and Raha Island location match; primary release describes the 272-home project.'),
 'mirasol':('rak33-mirasol-launch','The retained RAK Properties Mirasol record is distinct from the explicitly named Mirasol II record. The January release identifies the original 339-home, two-tower introduction; the September release explicitly identifies the later 280-home Phase II. Generic later Mirasol progress is not assigned to either phase.'),
 'mirasol2':('rak33-mirasol2-launch','Exact Mirasol II catalogue identity, RAK Properties and North Harbour agree with the explicitly named 280-home second-phase release; original Mirasol facts are not copied here.'),
 'enta':('rak33-enta-launch','Exact ENTA Mina name, RAK Properties and HIVE identity agree; release also identifies A.R.M Holding and the 119-residence product.'),
 'anantara':('rak33-anantara-sales','Exact Anantara Mina Residences name, RAK Properties, Hayat Island and apartment/villa product agree with the catalogue. The operating Anantara hotel is a separate asset; apartment and villa construction reports remain phase-scoped.'),
 'nura':('rak33-nura-launch','Retained record title and slug explicitly name Nura by RAK Properties; the developer release identifies that unique Nura project on Raha Island. The archived map-core developer field contains the malformed value nura; no developer correction or geographic precision is inferred from that field.'),
 'solera':('rak33-solera-launch','Exact SOLERA name, RAK Properties and Raha Island agree with the catalogue; release identifies a 451-home apartment project.'),
 'bayviews':('rak32-bayviews-launch','Exact Bayviews/Bay Views developer and Hayat Island identity retained from V32; Bay Residences is a separate development.'),
 'cape':('rak32-cape-launch','Exact Cape Hayat, RAK Properties and Hayat Island identity retained from V32.'),
 'quattro':('rak32-quattro-launch','Exact Quattro Del Mar, RAK Properties and Hayat Island identity retained from V32.'),
}

def main():
 snapshot=json.loads((ROOT/'data/historical-intelligence-20261003.json').read_bytes())
 assert snapshot['version']=='20261008-enrichment-v32'
 records={r['id']:r for r in snapshot['records']}
 captures=json.loads((ROOT/'.local-data/rak-lifecycle-pass33/captures.json').read_text())['sources']
 sources=[]
 for c in captures:
  s={k:c[k] for k in ['id','url','title','publishedAt','retrievedAt','sha256','bytes','httpStatus']}
  s.update(publisher='RAK Properties',primaryEvidence=True,classification='primary_developer_dated_release',firstAvailableAt=c['retrievedAt'],
   availabilityBasis='First verified capture of this release; historical online availability and historical bytes are not established.',
   publicationDateStatus='developer_archive_page_date',licence='rights_pending: minimal reviewed facts and citations only; no article, imagery or raw HTML redistribution',rawBodyRedistributed=False)
  sources.append(s)
 sm={s['id']:s for s in snapshot['sources']+sources};facts=[]
 def add(key,source,code,kind,start,precision,label,note='',planned=False,scope='subject',verified=False,**extra):
  sid=source if source.startswith('rak32-') else 'rak33-'+source;s=sm[sid];proof,basis=IDENTITY[key]
  date={'start':start,'precision':precision}
  if 'end' in extra:date['end']=extra.pop('end')
  facts.append({'id':'rak33-'+code,'status':'accepted','kind':'lifecycle','recordId':RECORDS[key],'milestone':kind,'date':date,
   'sourceIds':[sid],'identitySourceIds':[proof],'identityVerified':True,'identityBasis':basis,'scope':scope,'primaryEvidence':True,
   'publishedAt':s['publishedAt'],'firstAvailableAt':max(s['firstAvailableAt'],sm[proof]['firstAvailableAt']),
   'verification':'verified' if verified else 'reported','eventStatus':'planned' if planned else 'reported',
   'evidenceClass':'primary_developer_lifecycle_report','label':label,'note':note,'preserveAdditionalLifecycleFields':True,**extra})
 def announcement(key,source,date):
  add(key,source,key+'-launch','launch',date,'day','Developer publishes the project launch announcement.','Announcement establishes public development history, not a first registered transaction.',verified=True,dateBasis='Dated primary launch announcement')
 announcement('edge','edge-launch','2024-05-30')
 add('edge','edge-launch','edge-sales-schedule','first_marketing','2024-05-31','day','Developer schedules public EDGE sales for 31 May 2024.','Publication and scheduled sales-opening dates remain distinct.',planned=True)
 add('edge','edge-launch','edge-target','target_completion','2027-Q2','quarter','Developer targets EDGE completion in Q2 2027.',planned=True)
 announcement('skai','skai-launch','2025-02-26')
 add('skai','skai-launch','skai-expression-of-interest','first_marketing','2025-02-26','day','Developer invites SKAI expressions of interest immediately.','An invitation is not an observed sale.',dateBasis='Dated invitation publication')
 add('skai','skai-launch','skai-sales-schedule','first_marketing','2025-03-11','day','Developer schedules SKAI sales from 11 March 2025.',planned=True)
 add('skai','q1-2026','skai-main-contract','announcement','2026-Q1','quarter','Developer reports awarding the SKAI main contract during Q1 2026.','Contract award is not the construction-start day.',dateBasis='Explicit quarter in retrospective release')
 announcement('mirasol','mirasol-launch','2025-01-22')
 add('mirasol','mirasol-launch','mirasol-target','target_handover','2028-01-01','range','Developer schedules original Mirasol handover in H1 2028.','Half-year interval retained; no quarter or exact handover day inferred.',planned=True,end='2028-06-30')
 add('mirasol','mirasol-sellout','mirasol-phase-sales-report','phase_sales_status_report','2025-01-29','day','Developer reports the first Mirasol sales phase sold out.','Released inventory denominator, cancellations, registered sales and prices are not supplied. This marketing report is not transaction evidence.',scope='subject_phase',dateBasis='Report publication; exact individual sale dates unknown')
 announcement('mirasol2','mirasol2-launch','2025-09-25')
 add('mirasol2','mirasol2-launch','mirasol2-sales-schedule','first_marketing','2025-09-27','day','Developer schedules Mirasol Phase II sales for 27 September 2025.',planned=True)
 announcement('enta','enta-launch','2025-05-23')
 add('anantara','anantara-announcement','anantara-partnership','announcement','2024-10-01','day','RAK Properties announces expanded Minor Hotels partnership for Anantara residences.','The 2024 report describes about 94 apartments and 20 villas; the 2025 sales release describes 84 and 19. Both source vintages remain; no unit-count overwrite.',verified=True)
 add('anantara','anantara-sales','anantara-sales-announcement','announcement','2025-05-06','day','Developer announces Anantara Mina Residences sales are open.','This is the sales-announcement publication date, not a first-ever transaction date. Another release reports April sales commencement.',verified=True)
 add('anantara','enta-launch','anantara-sales-report-april','first_marketing','2025-04','month','A later developer release reports Anantara Mina Residences sales commenced in April 2025.','Retrospective month precision; retained alongside the 6 May sales announcement. Neither establishes registered transactions.',dateBasis='Retrospective April statement in 23 May ENTA release')
 announcement('nura','nura-launch','2025-12-08')
 add('nura','nura-launch','nura-sales-schedule','first_marketing','2025-12-11','day','Developer schedules Nura sales for 11 December 2025.',planned=True)
 add('nura','nura-launch','nura-target','target_handover','2029-Q1','quarter','Developer anticipates Nura completion and handover in Q1 2029.',planned=True)
 announcement('solera','solera-launch','2025-06-17')
 add('solera','solera-launch','solera-sales-schedule','first_marketing','2025-06-21','day','Developer schedules SOLERA sales for 21 June 2025.',planned=True)
 add('solera','solera-launch','solera-construction-target','target_construction_start','2026-04','month','Developer anticipates SOLERA construction starting in early April 2026.','A past scheduled date is not confirmation that construction began.',planned=True)
 add('solera','solera-launch','solera-handover-target','target_handover','2028-04','month','Developer anticipates SOLERA completion and handover by end-April 2028.','Month precision retained; no exact day inferred.',planned=True)
 for key in ['edge','bayviews','cape','quattro']:
  add(key,'h1-2025',key+'-progress-report-202508','construction_confirmation','2025-08-14','day','Developer reports construction progressing.','No quantitative percentage or inspection date supplied; corporate financial totals are not project prices.',dateBasis='Publication-date report in H1 results')
 for key in ['bayviews','cape','quattro']:
  add(key,'q3-2025',key+'-progress-report-202510','construction_confirmation','2025-10-23','day','Developer reports further construction milestones.','Underlying milestone dates and percentage are unspecified.',dateBasis='Publication-date report in nine-month results')
 for key,value in [('edge',6.5),('bayviews',92.7),('cape',86.5),('quattro',25)]:
  add(key,'fy2025',key+'-progress-report-202602','construction_progress','2026-02-06','day',f'Developer FY2025 release reports {value}% construction progress.','Annual reporting period is 2025; an exact inspection day is not given. This is a report-date observation, not an invented 31 December inspection.',progressPercent=value,dateBasis='FY2025 report publication; inspection date unknown')
 add('bayviews','q1-2026','bayviews-target-2026q2','target_handover','2026-Q2','quarter','Developer reports Bay Views being prepared for Q2 2026 handover.','A target does not override later certificate, completion or occupancy gaps.',planned=True)
 for key,value,component in [('edge',25.8,'Superstructure reported at 76%; component progress is not overall completion.'),('skai',8.3,'Substructure reported above 55%; component progress is not overall completion.')]:
  add(key,'rak32-h1-2026',key+'-progress-202606','construction_progress','2026-06-30','day',f'Developer reports {value}% overall construction progress.',component+' No independent inspection or completion is established.',progressPercent=value,dateBasis='Explicit 30 June 2026 construction-section as-of date')
 add('enta','rak32-h1-2026','enta-mobilisation-202606','construction_confirmation','2026-06-30','day','Developer reports main contract awarded and mobilisation underway for ENTA Mina.','Enabling works reported complete; exact start day and whole-project completion are not established.',dateBasis='Explicit 30 June 2026 section as-of date')
 add('anantara','rak32-h1-2026','anantara-villas-202606','phase_construction_progress','2026-06-30','day','Developer reports villa main contract awarded and mobilisation underway.','Villa portion only; enabling works reported complete. No whole-record progress percentage.',scope='subject_phase',dateBasis='Explicit 30 June 2026 section as-of date')
 add('anantara','rak32-h1-2026','anantara-apartments-202606','phase_construction_progress','2026-06-30','day','Developer reports soil improvement and piling underway for the apartments.','Apartment portion only; exact commencement day unknown. Not copied to the separate hotel or villas.',scope='subject_phase',dateBasis='Explicit 30 June 2026 section as-of date')
 for key,source,value,segment in [('skai','skai-launch',762000,'Unspecified launch residence'),('mirasol2','mirasol2-launch',861000,'Studio'),('nura','nura-launch',800000,'Apartment; unit type unspecified'),('solera','solera-launch',768000,'Apartment; unit type unspecified')]:
  s=sm['rak33-'+source];proof,basis=IDENTITY[key]
  facts.append({'id':'rak33-'+key+'-dated-advertisement','kind':'financial','status':'accepted','recordId':RECORDS[key],
   'sourceIds':[s['id']],'identitySourceIds':[proof],'identityVerified':True,'identityBasis':basis,'scope':'subject','primaryEvidence':True,
   'publishedAt':s['publishedAt'],'firstAvailableAt':s['firstAvailableAt'],'evidenceClass':'primary_developer_dated_advertised_price',
   'observation':{'period':s['publishedAt'],'metric':'price','unit':'AED','value':value,'segment':segment,'observationKind':'developer_advertised_price',
    'quoteQualifier':'advertised_starting_price','sourceQuoteBasis':'dated_developer_launch_release','observationDateBasis':'Dated launch advertisement; individual transaction and later validity unknown',
    'currentSnapshotEligible':False,'includeInCurrentSnapshot':False,'currentMarketValidity':'not_established','historicalLaunchPriceEstablished':True,
    'note':'Historical advertised starting price, not a registered sale, valuation, median, per-square-foot measure or current forecast anchor.'}})
 packet={'schemaVersion':1,'passId':'rak-primary-lifecycle-pass33-20261008','asOf':'2026-10-08','priorVersion':snapshot['version'],'candidateVersion':'20261008-enrichment-v33',
  'recordIdentityChecks':[{'recordId':rid,'catalogueName':records[rid]['name'],'emirate':'Ras Al Khaimah','type':'project','basis':IDENTITY[key][1],'sourceId':IDENTITY[key][0]} for key,rid in RECORDS.items()],
  'sources':sources,'facts':facts,'seriesLinks':[],'recordResearch':[],'historyInputs':[],
  'reusedSourceIds':['rak32-h1-2026','rak32-bayviews-launch','rak32-cape-launch','rak32-quattro-launch'],
  'conflicts':[
   {'recordId':RECORDS['edge'],'field':'launch_timing','sourceIds':['rak33-edge-launch','rak33-fy2025'],'resolution':'2024 dated launch retained; FY2025 grouping of EDGE among 2025 launches cannot overwrite it or establish a new phase.'},
   {'recordId':RECORDS['anantara'],'field':'announced_residence_counts','claims':[{'sourceId':'rak33-anantara-announcement','apartments':94,'villas':20,'qualifier':'about'},{'sourceId':'rak33-anantara-sales','apartments':84,'villas':19}],'resolution':'Announcement vintages retained; reason for the change is not established.'},
   {'recordId':RECORDS['anantara'],'field':'sales_timing','sourceIds':['rak33-enta-launch','rak33-anantara-sales'],'resolution':'Reported April commencement and 6 May announcement retained separately; no first registered sale inferred.'}],
  'excludedCandidates':[{'recordIds':[RECORDS['mirasol'],RECORDS['mirasol2']],'sourceId':'rak32-h1-2026','status':'phase_identity_review_pending','reason':'Generic Mirasol mobilisation has no phase discriminator. No progress fact assigned to either phase.'},
   {'recordId':RECORDS['nura'],'field':'catalogue_developer','status':'catalogue_field_review_pending','reason':'Archived map-core field contains nura while title and primary release name RAK Properties. This history pass does not rewrite the map catalogue field.'}],
  'methodology':'Exact named developer/project/place/phase review. Native temporal precision retained; planned dates never promoted to actual events. Date of report is used where an inspection date is unavailable. New identities and historical financial advertisements use first verified 2026 availability, preventing retrospective look-ahead. Existing H1 2026 capture is reused, not counted as independent corroboration.',
  'collection':{'passId':'rak-primary-lifecycle-pass33-20261008','projectRecords':len(RECORDS),'communityRecords':0,'acceptedLifecycleFacts':sum(f['kind']=='lifecycle' for f in facts),'acceptedAdvertisedPriceFacts':sum(f['kind']=='financial' for f in facts),'registeredSaleOrRentObservationsAdded':0,'fullLifetimeHistoriesCertified':0,'approved2080Forecasts':0,'rawBodiesRedistributed':False}}
 assert len(facts)==44 and len(sources)==14
 OUT.write_text(json.dumps(packet,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'output':str(OUT.relative_to(ROOT)),**packet['collection'],'sources':len(sources)}))

if __name__=='__main__':main()
