#!/usr/bin/env python3
"""Normalize bounded primary identity evidence; raw captures stay private."""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];RAW=ROOT/'.local-data/identity-pass42'
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 receipts={x['id']:x for x in json.loads((RAW/'capture-receipt.json').read_text())}
 definitions=[
 ('divine','Takmeel Development',['Divine Elements','Takmeel Developments','Dubai South'],{'project':'Divine Elements','developerBrand':'Takmeel Developments','marketedLocation':'Dubai South','residentialTypes':['studio','1 bedroom','2 bedroom']}),
 ('soma','Origami Development',['SOMA','Origami','44 residences'],{'project':'SOMA Residences','developerBrand':'Origami Development','marketedLocation':'Dubai Islands','reportedResidences':44}),
 ('inaura','Arada',['Inaura Residences Downtown','Hotel and branded residences'],{'project':'Inaura Residences Downtown','developerBrand':'Arada','marketedLocation':'Downtown Dubai','component':'hotel and branded residences; no hotel-room sale linkage inferred'}),
 ('inaura-announcement','Arada',['14 January 2026','114 branded residences'],{'project':'Inaura Downtown','developerBrand':'Arada','marketedLocation':'Downtown Dubai','reportedResidences':114,'announcementDate':'2026-01-14','salesStart':'planned by end of January 2026; actual first sale not established'})]
 sources=[]
 for slug,publisher,needles,facts in definitions:
  r=receipts[slug];p=RAW/(slug+'.html');assert digest(p)==r['sha256'] and p.stat().st_size==r['bytes']
  html=p.read_text();assert all(n in html for n in needles),(slug,needles)
  sources.append({'id':'primary42-'+slug,'url':r['url'],'publisher':publisher,'title':facts['project']+' — primary marketed identity','classification':'primary_developer_identity_capture','primaryEvidence':True,'publishedAt':'2026-01-14' if slug=='inaura-announcement' else None,'firstAvailableAt':r['retrievedAt'],'retrievedAt':r['retrievedAt'],'captureSHA256':r['sha256'],'captureBytes':r['bytes'],'captureMethod':'Public HTML retrieval','normalizedFacts':facts,'rawCaptureRedistributed':False,'note':'Minimal factual identity extract. Marketing location is not a cadastral boundary. No geometry, occupancy, sale or present valuation inferred from the page.'})
 for slug,url,needles,facts in [
 ('eira-developer','https://www.neoterra.ae/',['Eira','Production city, dubai','https://eiradubai.com/'],{'project':'EIRA','developerBrand':'Neoterra Developments','marketedLocation':'Dubai Production City','officialProjectLink':'https://eiradubai.com/'}),
 ('eira-project','https://eiradubai.com/',['EIRA is developed by Neoterra Developments','Dubai Production City'],{'project':'EIRA','developerBrand':'Neoterra Developments','marketedLocation':'Dubai Production City','residentialTypes':['studio','1 bedroom'],'developerDisplayedSchedule':{'launch':'2026-05','groundBreaking':'2026-09','toppingOut':'2028-06','handover':'2029-04'},'scheduleSemantics':'Month-precision marketing timeline; not independently verified actual commencement or completion'})]:
  p=RAW/(slug+'.json');r=json.loads(p.read_text());assert r['url']==url and all(n in r['text'] for n in needles)
  sources.append({'id':'primary42-'+slug,'url':url,'publisher':'Neoterra Developments','title':'EIRA — primary marketed identity','classification':'primary_developer_identity_capture','primaryEvidence':True,'publishedAt':None,'firstAvailableAt':r['retrievedAt'],'retrievedAt':r['retrievedAt'],'captureSHA256':digest(p),'captureBytes':p.stat().st_size,'captureMethod':'Visible public browser DOM','normalizedFacts':facts,'rawCaptureRedistributed':False,'note':'Neoterra page links the exact Eira project domain. Schedule facts do not establish actual construction or occupancy; no inferred appreciation.'})
 next(s for s in sources if s['id']=='primary42-divine').update(revisionOfSourceId='scrape-0df611d17d5a0dd7563b09e1',preserveRevision=True)
 out={'passId':'primary-identity-pass42-20261012','asOf':'2026-10-12','sources':sources,'coverageCredit':0,'methodology':'Developer-owned identity pages supplement DLD project/developer authority. Full HTML and DOM captures are kept privately with checksums; only minimal attributed factual extracts are published.'}
 (ROOT/'data/historical-intelligence/primary-identity-pass42-20261012.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'sources':len(sources),'coverageCredit':0}))
if __name__=='__main__':main()
