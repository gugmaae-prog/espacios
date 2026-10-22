#!/usr/bin/env python3
"""Capture bounded public numerical metadata. Does not accept facts or publish data."""
import argparse, collections, gzip, hashlib, importlib.util, json, re
from html.parser import HTMLParser
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.hidden=0;self.parts=[];self.title=[];self.in_title=False
    def handle_starttag(self,tag,attrs):
        if tag in ('script','style','noscript'):self.hidden+=1
        if tag=='title':self.in_title=True
        if tag in ('h1','h2','h3','h4','h5','h6','p','li','div','section','br'):self.parts.append(' ')
    def handle_endtag(self,tag):
        if tag in ('script','style','noscript') and self.hidden:self.hidden-=1
        if tag=='title':self.in_title=False
        if tag in ('h1','h2','h3','h4','h5','h6','p','li','div','section'):self.parts.append(' ')
    def handle_data(self,text):
        if not self.hidden:self.parts.append(text)
        if self.in_title:self.title.append(text)
def normalize(raw,source):
    if source['extractMode']=='adrec':
        envelope=json.loads(raw);obj=envelope.get('Data',{}).get('Result') or {};latest=obj.get('LatestReport') or {}
        return {'authorityId':obj.get('Id'),'projectNumber':obj.get('ProjectNumber'),'registration':obj.get('ProjectCreateDate'),'progressPercent':obj.get('ProgressPercentage'),'inspectionDate':latest.get('InspectionDate'),'inspectionPercent':latest.get('CompletionPercentage'),'successEnvelope':envelope.get('Success') is True,'excludedPrivateFields':True}
    page=Page();page.feed(raw.decode('utf-8',errors='replace'));text=' '.join(' '.join(page.parts).split())
    out={'title':' '.join(' '.join(page.title).split())[:180],'identityChecks':{x:x.casefold() in text.casefold() for x in source.get('identityNeedles',[])},'numericMentions':[],'cards':[],'reviewedPhraseChecks':{x:x.casefold() in text.casefold() for x in source.get('reviewedPhrases',[])}}
    for m in re.finditer(r'(?:Starting\s+Prices?|Starts?\s+at|From)\s*:?\s*(?:AED|د\.إ)\s*([\d,]+(?:\.\d+)?)\s*(million|[mMkK])?\b',text,re.I):
        number,scale=m.groups();out['numericMentions'].append({'amount':number,'scale':scale or None,'currency':'AED','characterOffset':m.start(),'qualifier':'starting_or_from_advertisement'})
    out['numericMentions']=out['numericMentions'][:30]
    out['unitFields']={'advertisedAED':[m[1] for m in re.finditer(r'AED\s*([\d,]+(?:\.\d+)?)',text)][:30],'advertisedAreaSqft':[m[1] for m in re.finditer(r'([\d,]+(?:\.\d+)?)\s*sq\s*\.?\s*ft',text,re.I)][:10]}
    if source['id']=='reportage-directory':
        for label in ('Oceana','Marlin 2'):
            for m in re.finditer(re.escape(label),text,re.I):
                tail=text[m.end():m.end()+220];found=re.search(r'From\s+AED\s*([\d,.]+)\s*([mMkK])?\b',tail)
                if found:out['cards'].append({'sourceName':label,'amount':found[1],'scale':found[2],'currency':'AED'})
    if source['id']=='aldar-fahid-listings':
        source=dict(source,targets=[{'recordId':i,'sourceName':n} for i,n in [('adrec:609','Fahid Beach Residences'),('adrec:617','Fahid Beach Terraces'),('adrec:615','The Beach House Fahid')]])
    for target in source.get('targets',[]):
        found=[]
        for m in re.finditer(re.escape(target['sourceName']),text,re.I):
            tail=text[m.end():m.end()+900];amount=re.search(r'Starts?\s+at\s+(AED|USD|EGP)\s*([\d,]+(?:\.\d+)?)',tail,re.I);completion=re.search(r'Completion\s+Date\s*:\s*(Q[1-4])\s*[-–]\s*(20\d{2})',tail,re.I)
            if amount and completion and completion.start()<amount.start():found.append({'recordId':target['recordId'],'sourceName':target['sourceName'],'currency':amount[1],'amount':amount[2],'targetCompletion':completion[2]+'-'+completion[1].upper(),'dateStatus':'planned_not_actual','inventoryScope':'developer_platform_starting_quote_segment_not_established'})
        out['cards'].extend([json.loads(x) for x in sorted({json.dumps(x,sort_keys=True) for x in found})])
    return out
def validate(plan,records):
    if plan['schemaVersion']!=1 or plan['mode']!='capture_only':raise ValueError('Not a capture plan')
    if len(records)!=1860 or len({r['id'] for r in records})!=1860:raise ValueError('Catalogue count')
    byid={r['id']:r for r in records}
    if collections.Counter(r['type'] for r in records)!={'project':1645,'community':215}:raise ValueError('Catalogue types')
    if len(plan['sources'])>20 or len({s['url'] for s in plan['sources']})!=len(plan['sources']):raise ValueError('Page limit/duplicate')
    for source in plan['sources']:
        if len(' '.join(source.get('reviewedPhrases',[])).split())>25:raise ValueError('Quotation limit')
        if not source['reviewAgainstIds'] or not set(source['reviewAgainstIds'])<=byid.keys():raise ValueError('Unknown targets')
        if source.get('rawRetentionAllowed') is not False:raise ValueError('No raw retention')
    return True
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--plan',type=Path,required=True);p.add_argument('--snapshot',type=Path,required=True);p.add_argument('--output',type=Path,required=True);args=p.parse_args()
    raw=args.snapshot.read_bytes()
    if args.snapshot.suffix=='.gz':raw=gzip.decompress(raw)
    snapshot=json.loads(raw);plan=json.loads(args.plan.read_text());validate(plan,snapshot['records'])
    if hashlib.sha256(raw).hexdigest()!=plan['baselineSHA256']:raise ValueError('Baseline checksum')
    if args.output.exists():raise ValueError('Immutable output exists')
    spec=importlib.util.spec_from_file_location('collector',ROOT/'scripts/review_regional_sources.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    collector=module.Collector(plan);actual_get=collector.transport;observations={};source_urls={s['url']:s for s in plan['sources']}
    def capture_metadata(url):
        status,headers,body=actual_get(url)
        if status==200 and url in source_urls and len(body)<=2000000:
            try:observations[url]=normalize(body,source_urls[url])
            except (ValueError,TypeError,AttributeError) as error:observations[url]={'normalizationError':str(error)[:100]}
        return status,headers,body
    collector.transport=capture_metadata;captures=[]
    for source in plan['sources']:
        receipt=collector.capture(source);receipt['normalizedReview']=observations.get(receipt.get('finalUrl'),{});captures.append(receipt)
    result={'schemaVersion':1,'passId':plan['passId'],'baselineSHA256':plan['baselineSHA256'],'baselineVersion':snapshot['version'],'planSHA256':hashlib.sha256(args.plan.read_bytes()).hexdigest(),'httpRequests':collector.count,'sources':captures,'acceptedFacts':[],'rawRetained':False}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    with args.output.open('x') as f:json.dump(result,f,indent=2,ensure_ascii=False);f.write('\n')
    print(json.dumps({'passId':plan['passId'],'requests':collector.count,'outcomes':dict(collections.Counter(s['captureStatus'] for s in captures))}))
if __name__=='__main__':main()
