#!/usr/bin/env python3
"""Compile exact-project monthly progress and schedule vintages, preserving gaps."""
import importlib.util,json,hashlib,collections
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'data/historical-intelligence'
SCRATCH=ROOT/'.local-data/rak-phase-pass34'
spec=importlib.util.spec_from_file_location('rak_panels',ROOT/'scripts/extract-rak-construction-panels.py');extractor=importlib.util.module_from_spec(spec);spec.loader.exec_module(extractor)
P33=json.loads((BASE/'rak-properties-lifecycle-pass33-20261008.json').read_text())
P32=json.loads((BASE/'rak-properties-lifecycle-pass32-20261008.json').read_text())
# Explicit reviewed mapping; no fuzzy names, generic phase fan-out or new records.
MAP={
 'marbella-ii-villas':('project:rak-properties-marbella-villas-2-on-hayat-island-mina-ras-al-khaimah','rak32-marbella2-contract',89,'2024-Q4'),
 'bayviews':('project:bayviews-by-rak-properties-on-hayat-island-mina-ras-al-khaimah','rak32-bayviews-launch',344,'2026-Q3'),
 'cape-hayat':('project:cape-hayat-by-rak-properties-on-hayat-island-mina-rak','rak32-cape-launch',678,'2026-Q3'),
 'quattro-del-mar':('project:quattro-del-mar-by-rak-properties-on-hayat-island','rak32-quattro-launch',888,'2027-Q2'),
 'porto-playa':('project:porto-playa-by-ellington-and-rak-on-hayat-island',None,282,'2026-Q4'),
 'edge':('project:edge-rak-properties-raha-island-mina-ras-al-khaimah','rak33-edge-launch',237,'2027-Q2'),
 'skai':('project:studios-apartments-and-penthouses-skai-raha-island','rak33-skai-launch',272,'2028-Q2'),
 'mirasol':('project:mirasol-by-rak-properties-in-mina-al-arab','rak33-mirasol-launch',339,'2028-Q1'),
 'mirasol-ii':('project:mirasol-2-north-harbour-mina-rak-uae','rak33-mirasol2-launch',280,'2028-Q3'),
 'enta-mina':('project:enta-mina-hive-rak-properties-uae','rak33-enta-launch',120,'2028-Q1'),
 'anantara-residences':('project:anantara-mina-ras-al-khaimah-residences','rak33-anantara-sales','84 Apartments and 19 Villas','2028-Q2'),
 'nura':('project:nura-rak-properties-mina-ras-al-khaimah-uae','rak33-nura-launch',312,'2029-Q1'),
 'solera':('project:buy-apartment-solera-raha-island','rak33-solera-launch',451,'2028-Q2'),
}

def main():
 snapshot=json.loads((ROOT/'data/historical-intelligence-20261003.json').read_bytes());assert snapshot['version']=='20261008-enrichment-v33'
 records={r['id']:r for r in snapshot['records']};old_sources={s['id']:s for s in snapshot['sources']}
 # Discover the already reviewed exact Porto Playa identity, not a guessed slug.
 porto=next(c for c in P32['recordIdentityChecks'] if 'porto-playa' in c['recordId'])
 MAP['porto-playa']=(porto['recordId'],'rak32-porto-groundbreaking',282,'2026-Q4')
 assert all(rid in records and not records[rid]['historySeries'] for rid,_,_,_ in MAP.values())
 captures={c['slug']:c for c in json.loads((SCRATCH/'developer-profiles.json').read_text())['sources']}
 sources=[];facts=[];checks=[];panels=[]
 for slug,(rid,priorproof,units,target) in MAP.items():
  c=captures[slug];html=(SCRATCH/f'profile-{slug}.html').read_bytes();assert hashlib.sha256(html).hexdigest()==c['sha256']
  parser=extractor.Document();parser.feed(html.decode());text=' '.join(parser.root.text().split())
  expected_units=f'Total Units {units} Units available';assert expected_units in text,(slug,'unit identity changed')
  assert priorproof in old_sources,(slug,priorproof)
  s={k:v for k,v in c.items() if k!='slug'}
  s.update(publisher='RAK Properties',primaryEvidence=True,classification='primary_developer_project_profile',firstAvailableAt=c['retrievedAt'],availabilityBasis='First verified capture of this page vintage; dated progress tabs are observation months, not historical publication or inspection dates.',publicationDateStatus='unknown',licence='rights_pending: minimal reviewed facts and citations only; no HTML, article text or imagery redistribution',rawBodyRedistributed=False)
  prior_versions=[x for x in old_sources.values() if x.get('url','').rstrip('/')==s['url'].rstrip('/')]
  if prior_versions:
   assert slug=='edge' and len(prior_versions)==1
   s.update(preserveRevision=True,revisionOfSourceId=prior_versions[0]['id'],revisionBasis='New captured profile vintage with explicit dated progress tabs; previous source and all facts retained. Same publisher/page is not independent corroboration.')
  sources.append(s)
  identity=f"Exact named {records[rid]['name']} record and RAK Properties primary profile agree with the previously reviewed identity source. Profile inventory: {units}."
  if slug=='mirasol':identity+=' This profile explicitly has 339 homes, distinct from the separately named 280-home Mirasol II page; generic corporate Mirasol reports remain excluded.'
  if slug=='mirasol-ii':identity+=' Explicit II phase and 280-home profile; no original-Mirasol progress copied.'
  if slug=='anantara-residences':identity+=' Apartment/residence and villa tabs remain separate portions; no hotel evidence or whole-project percentage inferred.'
  if slug=='enta-mina':identity+=' The profile reports 120 homes and Hayat Island, differing from the 119-home launch release and earlier Raha attribution; no inventory or geographic overwrite.'
  proof=[priorproof,s['id']];available=max(s['firstAvailableAt'],old_sources[priorproof]['firstAvailableAt'])
  def add(code,kind,period,precision,label,note='',scope='subject',event='reported',**extra):
   facts.append(dict(id=f'rak34-{slug}-{code}',kind='lifecycle',status='accepted',recordId=rid,milestone=kind,date={'start':period,'precision':precision},sourceIds=[s['id']],identitySourceIds=proof,identityVerified=True,identityBasis=identity,scope=scope,primaryEvidence=True,publishedAt=None,firstAvailableAt=available,verification='reported',eventStatus=event,evidenceClass='primary_developer_progress_profile',label=label,note=note,preserveAdditionalLifecycleFields=True,**extra))
  rows=extractor.extract(html.decode())
  for row in rows:
   assert row['period']<='2026-10'
   phase=row['phaseLabel'];assert not phase or slug=='anantara-residences',(slug,phase)
   code=row['period']+('-'+phase.lower().replace(' ','-') if phase else '')
   portion=f' {phase} portion' if phase else ''
   components='; '.join(f'{k}: {v:g}%' for k,v in row['components'].items())
   add('progress-'+code,'phase_construction_progress' if phase else 'construction_progress',row['period'],'month',f"Developer reports {row['overallPercent']:g}% construction progress for{portion or ' the project'} in {row['sourceTabLabel']}.",
    'Dated page tab, not a dated inspection certificate. '+components+'. No legal completion, actual handover, occupancy or rental-income commencement inferred.',scope='subject_phase' if phase else 'subject',progressPercent=row['overallPercent'],dateBasis='Explicit month-labelled construction tab '+row['panelId'])
   panels.append({'recordId':rid,'sourceId':s['id'],**row})
  # Profile status plus completion label is retained as reported, not certified.
  q=target[-1];year=target[:4]
  assert any(v in text for v in [f'Completion date Q{q} - {year}',f'Completion date Q{q} {year}']),(slug,'target changed')
  completed=slug=='marbella-ii-villas'
  if completed:assert 'Status Completed Total Units 89' in text
  add('completion-label','completion' if completed else 'target_completion',target,'quarter',f"Developer profile {'reports completion in' if completed else 'lists a completion schedule of'} {target}.",
   'Undated current page vintage; exact publication and actual completion day unknown. '+('No completion certificate, all-unit handover or occupancy evidence supplied.' if completed else 'Schedule remains planned even if its quarter has passed; no actual completion inferred.'),event='reported' if completed else 'planned',dateBasis='Profile completion-date label; first captured October 2026')
  checks.append({'recordId':rid,'catalogueName':records[rid]['name'],'type':records[rid]['type'],'emirate':records[rid]['emirate'],'identityVerified':True,'sourceIds':proof,'basis':identity})
 packet={'version':1,'passId':'rak-primary-profiles-pass34-20261008','asOf':snapshot['asOf'],'priorVersion':snapshot['version'],'candidateVersion':'20261008-enrichment-v34','sources':sources,'facts':facts,'recordIdentityChecks':checks,'seriesLinks':[],
  'constructionPanels':panels,'conflicts':[
   {'recordId':MAP['enta-mina'][0],'field':'units_and_island','sourceIds':['rak33-enta-launch','rak34-profile-enta-mina'],'resolution':'119 versus 120 units and earlier Raha versus current Hayat wording retained; no canonical geography or count overwritten.'},
   {'recordId':MAP['quattro-del-mar'][0],'field':'december_2025_progress','sourceIds':['rak33-fy2025','rak34-profile-quattro-del-mar'],'resolution':'FY2025 report gives 25% without inspection day; profile December tab gives 28.6%. Different vintages retained; reason unestablished.'},
   {'recordId':MAP['solera'][0],'field':'reported_progress_decline','sourceIds':['rak34-profile-solera'],'resolution':'May/June 0.1% and July/August 0% are retained as published; no monotonic smoothing or invented construction date.'},
   {'recordId':MAP['mirasol'][0],'field':'completion_schedule','sourceIds':['rak33-mirasol-launch','rak34-profile-mirasol'],'resolution':'Earlier H1 2028 and current Q1 2028 schedule retained separately; exact revision date unknown.'}],
  'excludedCandidates':[
   {'recordId':'project:gateway-residences-for-sale-mina-al-arab-ras-al-khaimah-uae-by-rak-properties','status':'phase_identity_review_pending','reason':'Generic catalogue identity lacks unit count/island/phase discriminator; Gateway I 144 units on Raha and II 146 on Hayat remain distinct. No phase histories assigned.'},
   {'recordId':'project:south-bay-residences-by-rak-properties-on-hayat-island-mina-al-arab-ras-al-khaimah','status':'phase_identity_review_pending','reason':'Generic Bay page combines phases; South Bay-to-Phase-II mapping requires independently captured explicit identifier. No first-phase or unlabelled monthly progress assigned.'},
   {'sourceId':'rak34-q1-2023','status':'publication_date_disputed','reason':'Page dated 27 March 2023 describes full Q1 results and a later contract announcement; no assumed corrected day or use in historical backtests.'}],
  'methodology':'DOM ID links pair each explicit month tab to its own panel; overall and components remain distinct. Exact project/phase mapping only. Zero and declines preserved. Developer-reported progress and schedules are not independent completion certification, occupancy or financial observations. All first availability dates use current captures.',
  'collection':{'passId':'rak-primary-profiles-pass34-20261008','projectRecords':len(MAP),'communityRecords':0,'acceptedLifecycleFacts':len(facts),'acceptedProgressFacts':len(panels),'acceptedAdvertisedPriceFacts':0,'registeredSaleOrRentObservationsAdded':0,'fullLifetimeHistoriesCertified':0,'approved2080Forecasts':0,'rawBodiesRedistributed':False}}
 assert len(panels)==102 and len(facts)==115 and len(sources)==13
 path=BASE/'rak-properties-profiles-pass34-20261008.json';path.write_text(json.dumps(packet,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps(packet['collection']))
if __name__=='__main__':main()
