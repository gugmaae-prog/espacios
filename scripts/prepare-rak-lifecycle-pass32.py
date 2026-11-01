#!/usr/bin/env python3
"""Compile reviewed primary RAK facts; captures and the PDF remain private scratch."""
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SCRATCH=ROOT/'.local-data/rak-lifecycle-pass32'
OUT=ROOT/'data/historical-intelligence/rak-properties-lifecycle-pass32-20261008.json'
ASOF='2026-10-08'
RECORDS={
 'bayviews':('project:bayviews-by-rak-properties-on-hayat-island-mina-ras-al-khaimah','Bayviews Residences Hayat Island'),
 'cape':('project:cape-hayat-by-rak-properties-on-hayat-island-mina-rak','Cape Hayat'),
 'marbella2':('project:rak-properties-marbella-villas-2-on-hayat-island-mina-ras-al-khaimah','RAK Properties Marbella Villas 2 on Hayat Island, Ras Al Khaimah'),
 'porto':('project:porto-playa-by-ellington-properties-and-rak-properties-on-hayat-island','Porto Playa'),
 'quattro':('project:quattro-del-mar-by-rak-properties-on-hayat-island','Quattro Del Mar'),
}

def main():
 captures={x['id']:x for x in json.loads((SCRATCH/'captures.json').read_text())['sources']}
 pdf=json.loads((SCRATCH/'quattro-factsheet-capture.json').read_text())
 if pdf['sha256']!='da8478e7541362adb39cba7ae4ed0dfa1f682c4449571ab6f48a65629eac443a':raise ValueError('Visually reviewed factsheet changed')
 source_ids=set(captures)-{'rak32-gateway-completion'}
 sources=[]
 for sid in sorted(source_ids):
  c=captures[sid]
  sources.append({k:c[k] for k in ['id','url','title','publishedAt','retrievedAt','sha256','bytes','httpStatus']})
  sources[-1].update(publisher='RAK Properties',primaryEvidence=True,classification='primary_developer_dated_release',firstAvailableAt=c['retrievedAt'],
   availabilityBasis='Dated developer release captured now; the original historical bytes and first online availability were not independently archived, so model availability starts at this capture.',
   publicationDateStatus='developer_archive_page_date',licence='rights_pending: minimal reviewed factual observations and citations only; no article, image or raw HTML redistribution',rawBodyRetained=False,rawBodyRedistributed=False)
 sources.append({**pdf,'title':'Quattro Del Mar factsheet, page 8','publisher':'RAK Properties','primaryEvidence':True,'classification':'primary_developer_undated_factsheet',
  'firstAvailableAt':pdf['retrievedAt'],'publicationDateStatus':'unknown','availabilityBasis':'First verified download; PDF creation/modification metadata does not establish public availability or a price-validity date.',
  'pdfMetadata':{'created':'2023-12-21T12:15:18+04:00','modified':'2023-12-21T12:15:45+04:00','publicationDateInferred':False},
  'reviewedPage':8,'pageCount':19,'visualTableChecked':True,'licence':'rights_pending: minimal factual price/type observations and citation only; PDF and artwork are not redistributed',
  'rawBodyRedistributed':False})
 sm={x['id']:x for x in sources}
 # The release was already cited as community context. Preserve that capture
 # and make the new exact-project capture an explicit revision, not a second
 # independent corroborating article.
 sm['rak32-cape-final-phase'].update(preserveRevision=True,revisionOfSourceId='community-source-0343d6726dc26c6e',canonicalSourceId='community-source-0343d6726dc26c6e')
 sm['rak32-porto-groundbreaking']['declaredReleaseDate']='2024-10-31'
 sm['rak32-porto-groundbreaking']['dateDisagreement']='Body release date is 31 October 2024; archive page date is 5 November 2024. Both are retained; exact groundbreaking day is not inferred.'
 facts=[]
 def add(key,source,code,kind,start,precision,label,note='',event='reported',scope='subject',verified=True,**extra):
  rid,name=RECORDS[key];s=sm['rak32-'+source]
  identity=f'Unique existing {name} catalogue record in Ras Al Khaimah; primary developer release identifies the same project, RAK Properties (with Ellington for Porto Playa), and Hayat Island/Mina Al Arab. Marbella evidence explicitly names Phase 2; no other phase or nearby project receives the fact.'
  facts.append({'id':'rak32-'+code,'status':'accepted','kind':'lifecycle','recordId':rid,'milestone':kind,'date':{'start':start,'precision':precision},
   'sourceIds':[s['id']],'identitySourceIds':[s['id']],'identityVerified':True,'identityBasis':identity,'scope':scope,'primaryEvidence':True,
   'publishedAt':s['publishedAt'],'firstAvailableAt':s['firstAvailableAt'],'verification':'verified' if verified else 'reported','eventStatus':event,
   'evidenceClass':'primary_developer_lifecycle_report','label':label,'note':note,'preserveAdditionalLifecycleFields':True,**extra})
 add('bayviews','bayviews-launch','bayviews-launch','announcement','2023-05-28','day','Developer announces Bayviews launch on Hayat Island.',dateBasis='dated launch announcement; original first-ever transaction remains unknown')
 add('bayviews','bayviews-launch','bayviews-sales-schedule','first_marketing','2023-05-26','day','Developer advertises public sales commencing 26 May 2023.','Scheduled sales availability is not a registered sale or proof of the first transaction.',event='planned',verified=False)
 add('bayviews','construction-202407','bayviews-progress-202407','construction_progress','2024-07-23','day','Bayviews enabling complete; substructure reported nearly 70%.','Component progress is not overall project completion. Underlying inspection date is unstated.',dateBasis='dated developer progress publication')
 add('cape','cape-launch','cape-launch','launch','2023-09-19','day','Developer announces the four-tower Cape Hayat project.','Launch release states 668 units; later developer reports state 678. The differing supply counts are retained as a source conflict, not silently resolved.',dateBasis='dated developer launch announcement')
 add('cape','cape-launch','cape-sales-schedule','first_marketing','2023-09-22','day','Developer schedules Cape Hayat public sales for 22–23 September 2023.','The schedule is not an observed sale; day shown is the announced starting day.',event='planned',verified=False)
 add('cape','cape-final-phase','cape-phase-announcement','phase_announcement','2023-10-18','day','Developer announces a final Cape Hayat sales release planned for 19 October 2023.','Publication and planned release dates remain distinct; no claim that the event occurred on the publication day.',scope='subject_phase')
 add('cape','h1-2024','cape-construction-start','construction_start','2023','year','Developer reports Cape Hayat construction began at the end of 2023.','Year precision preserves the source wording; no month or day is invented. This retrospective claim was captured in 2026.',dateBasis='retrospective developer statement: end of 2023')
 add('cape','construction-202407','cape-progress-202407','construction_progress','2024-07-23','day','Cape Hayat enabling complete; substructure reported 65%.','Component progress is not whole-project completion. Underlying inspection date is unstated.',dateBasis='dated developer progress publication')
 add('marbella2','marbella2-contract','marbella2-contract','announcement','2023-02-10','day','Developer announces the main construction contract for Marbella Villas Phase 2.','The 89-unit phase is matched to the Phase 2 catalogue record. A contract award is not actual construction commencement or original sales launch.',dateBasis='dated developer contract award announcement')
 add('marbella2','h1-2024','marbella2-progress-202408','construction_confirmation','2024-08-08','day','Developer reports the 89-unit Marbella Villas Phase 2 in the final construction stage.','Progress report in H1 results; no actual handover, completion certificate, or occupancy date is asserted.',dateBasis='report publication snapshot; exact inspection date unavailable')
 add('porto','porto-groundbreaking','porto-start-report','construction_confirmation','2024-10-31','day','Developer release reports Porto Playa construction has commenced.','Body release date is 31 October; page publication date is 5 November. This is a dated commencement report, not an invented exact groundbreaking date.',dateBasis='body release date; exact commencement date not stated')
 add('porto','porto-groundbreaking','porto-target-2026q4','target_completion','2026-Q4','quarter','Developer reports anticipated Porto Playa completion in Q4 2026.','Target retained from the dated release; no completion or occupancy evidence.',event='planned',verified=False)
 add('quattro','quattro-launch','quattro-launch','launch','2024-01-09','day','Developer announces Quattro Del Mar on Hayat Island.','The launch announcement establishes public development history, not a first registered sale.',dateBasis='dated developer launch announcement')
 add('quattro','quattro-final-phase','quattro-final-phase','phase_launch','2024-10-31','day','Developer announces release of the final Quattro Del Mar sales phase.','Sales-release scope only; neither construction completion nor a full sale-price history.',scope='subject_phase')
 add('quattro','quattro-final-phase','quattro-progress-202410','construction_confirmation','2024-10-31','day','Developer reports construction progressing on Quattro Del Mar.','No quantitative completion percentage or inspection date is given.',dateBasis='dated developer progress publication')
 add('quattro','quattro-final-phase','quattro-target-2026','target_completion','2026','year','Developer states expected Quattro Del Mar completion by 2026.','Year precision retained separately from the undated factsheet quarter and other schedules.',event='planned',verified=False)
 add('quattro','quattro-factsheet','quattro-factsheet-target','target_completion','2026-Q4','quarter','Undated developer factsheet anticipates completion in Q4 2026.','Captured 8 October 2026; original publication and validity are unknown. PDF metadata is not a publication date.',event='planned',verified=False)
 for key,code,value in [('cape','cape-progress-202606',96.37),('quattro','quattro-progress-202606',47.04),('bayviews','bayviews-progress-202606',98)]:
  add(key,'h1-2026',code,'construction_progress','2026-06-30','day',f'Developer reports {value}% overall construction progress as of 30 June 2026.','Dated developer-reported progress; not independently inspected, completed handover, occupancy, or a financial observation.',verified=False,progressPercent=value,dateBasis='Explicit as-of date in the developer H1 2026 construction section; published 7 August 2026.')
 add('bayviews','h1-2026','bayviews-certificate-status','certificate_status_report','2026-06-30','day','Developer reports a Bay Views Building Completion Certificate secured, with Taking Ownership Certificate pending.','Certificate itself and its issue date were not inspected. Developer reports handovers had not yet commenced at this status date. This is not stored as actual completion or occupancy.',verified=False,dateBasis='As-of date of the construction section; certificate issue day unknown.')
 add('bayviews','h1-2026','bayviews-progress-report-202608','construction_progress','2026-08-07','day','The same H1 release also describes Bay Views at 99% in its second-half handover outlook.','This later narrative supplies no inspection date; retained beside the explicitly June-dated 98% report without silently reconciling them. Transitioning into handovers does not establish a completed handover or occupancy.',verified=False,progressPercent=99,dateBasis='Publication-date report; underlying progress inspection date unspecified.')
 for code,segment,value,amin,amax in [('studio','Studio',875000,413.34,413.34),('1br-suite','1 BR Suite',1230000,523.13,665.22),('1br-premium','1 BR Premium',1550000,826.68,1710.40),('2br','2 BR',2220000,1241.09,3067.74),('3br','3 BR',4000000,1953.67,3433.72)]:
  s=sm['rak32-quattro-factsheet'];rid,name=RECORDS['quattro']
  facts.append({'id':'rak32-quattro-advertised-'+code,'status':'accepted','kind':'financial','recordId':rid,'sourceIds':[s['id']],
   'identitySourceIds':['rak32-quattro-launch',s['id']],'identityVerified':True,'identityBasis':'Developer factsheet names Quattro Del Mar, RAK Properties, Hayat Island and Mina Al Arab; same uniquely identified four-tower catalogue project as the dated primary launch release.',
   'scope':'subject','primaryEvidence':True,'publishedAt':None,'firstAvailableAt':s['retrievedAt'],'evidenceClass':'primary_developer_undated_advertised_price',
   'observation':{'period':ASOF,'metric':'price','unit':'AED','value':value,'segment':segment,'observationKind':'developer_advertised_price',
    'quoteQualifier':'advertised_starting_price','observationDateBasis':'capture date only; publication and price-validity date unknown','sourcePage':8,
    'areaRangeSqFt':{'min':amin,'max':amax,'includesBalconiesTerraces':True},'sourceQuoteBasis':'visually_checked_developer_factsheet_table',
    'currentMarketValidity':'unverified','historicalLaunchPriceEstablished':False,'includeInCurrentSnapshot':False,
    'note':'Starting quote for this named unit type, not a sale, valuation, period median, current available inventory quote or price per square foot. Original date remains unknown.'}})
 packet={'schemaVersion':1,'passId':'rak-primary-lifecycle-pass32-20261008','asOf':ASOF,'priorVersion':'20261008-enrichment-v31','candidateVersion':'20261008-enrichment-v32',
  'recordIdentityChecks':[{'recordId':rid,'catalogueName':name,'emirate':'Ras Al Khaimah','type':'project'} for rid,name in RECORDS.values()],
  'sources':sources,'facts':facts,'seriesLinks':[],'recordResearch':[],'historyInputs':[],
  'conflicts':[{'recordId':RECORDS['bayviews'][0],'field':'reported_overall_progress','sourceId':'rak32-h1-2026','claims':[{'asOf':'2026-06-30','value':98},{'asOf':None,'reportDate':'2026-08-07','value':99}],'resolution':'Both source statements retained with distinct date bases; no interpolation or assumed revision.'},{'recordId':RECORDS['cape'][0],'field':'reported_project_unit_count','claims':[{'sourceId':'rak32-cape-launch','value':668},{'sourceId':'rak32-h1-2024','value':678}],'resolution':'Both native claims retained; no catalogue count replacement.'},
   {'recordId':RECORDS['porto'][0],'field':'release_publication_date','bodyReleaseDate':'2024-10-31','pagePublicationDate':'2024-11-05','sourceId':'rak32-porto-groundbreaking','resolution':'Distinct dates retained; no exact groundbreaking day inferred.'}],
  'excludedCandidates':[{'recordId':'project:gateway-residences-for-sale-mina-al-arab-ras-al-khaimah-uae-by-rak-properties','sourceId':'rak32-gateway-completion','url':captures['rak32-gateway-completion']['url'],'publishedAt':'2020-04-13','sha256':captures['rak32-gateway-completion']['sha256'],'retrievedAt':captures['rak32-gateway-completion']['retrievedAt'],'status':'phase_identity_review_pending','reason':'Developer completion statement describes 144-unit Gateway Residences; catalogue identity still needs a phase/building discriminator against Gateway II. No milestone or completeness credit assigned.'}],
  'methodology':'Reviewed primary developer releases and a visually checked factsheet; exact named record/developer/island/phase identity only. Page dates, declared release dates, planned dates, retrospective event precision, capture dates and PDF metadata remain separate. No registered sales, rents, valuations, occupancy, causal price adjustments or forecast outcomes are inferred.',
  'collection':{'passId':'rak-primary-lifecycle-pass32-20261008','projectRecords':5,'communityRecords':0,'acceptedLifecycleFacts':22,'acceptedAdvertisedPriceFacts':5,'registeredSaleOrRentObservationsAdded':0,'fullLifetimeHistoriesCertified':0,'approved2080Forecasts':0,'rawBodiesRedistributed':False}}
 assert len(facts)==27 and len(sources)==11
 OUT.write_text(json.dumps(packet,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'output':str(OUT.relative_to(ROOT)),**packet['collection'],'sources':len(sources),'excludedCandidates':len(packet['excludedCandidates'])}))

if __name__=='__main__':main()
