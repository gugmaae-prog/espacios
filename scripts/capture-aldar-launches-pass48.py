#!/usr/bin/env python3
"""Five exact-ID historical releases; bounded capture only, never evidence promotion."""
import argparse, collections, datetime as dt, gzip, hashlib, importlib.util, json, re
from decimal import Decimal
from html.parser import HTMLParser
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
EXPECTED_IDS={'adrec:454','adrec:456','adrec:543','adrec:64','adrec:65'}
LIMITS={'sourcePages':20,'httpRequests':40,'concurrency':1,'redirectsPerUrl':2,
        'bytesPerResponse':2000000,'timeoutSeconds':15,'minimumDelaySeconds':2}
digest=lambda raw:hashlib.sha256(raw).hexdigest()

def require(ok,message):
    if not ok:raise ValueError(message)

class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True);self.parts=[];self.hidden=0
    def handle_starttag(self,tag,attrs):
        if tag in ('script','style','noscript'):self.hidden+=1
        if tag in ('p','div','section','li','br','h1','h2','h3'):self.parts.append(' ')
    def handle_endtag(self,tag):
        if tag in ('script','style','noscript') and self.hidden:self.hidden-=1
        if tag in ('p','div','section','li','h1','h2','h3'):self.parts.append(' ')
    def handle_data(self,data):
        if not self.hidden:self.parts.append(data)

def text_of(raw):
    parser=Page();parser.feed(raw.decode('utf-8',errors='replace'))
    text=' '.join(' '.join(parser.parts).split())
    for ch in ['\u2010','\u2011','\u2012','\u2013','\u2014','\u2212']:text=text.replace(ch,'-')
    return text

def validate_plan(plan,snapshot):
    require(plan['schemaVersion']==1 and plan['mode']=='capture_only','Not a reviewed capture plan')
    require(plan['limits']==LIMITS and plan['domains']==['www.aldar.com'],'Collection boundary changed')
    require(plan['asOf']=='2026-10-14' and plan['baselineVersion']==snapshot['version']=='20261014-enrichment-v47','Baseline version changed')
    records={r['id']:r for r in snapshot['records']}
    require(len(records)==len(snapshot['records'])==1860,'Fixed catalogue IDs changed')
    require(collections.Counter(r['type'] for r in records.values())=={'project':1645,'community':215},'Catalogue type count changed')
    require(len(plan['sources'])==5 and {s['reviewAgainstIds'][0] for s in plan['sources']}==EXPECTED_IDS,'Target list changed')
    require(len({s['id'] for s in plan['sources']})==len({s['url'] for s in plan['sources']})==5,'Duplicate source')
    require(plan['acceptedFacts']==[] and plan['numericForecasts']==[] and plan['automaticPriceUplift'] is None,'Capture cannot accept observations or scenarios')
    for source in plan['sources']:
        require(source['url'].startswith('https://www.aldar.com/en/news-and-media/'),'Source outside explicit domain/path')
        require(len(source['reviewAgainstIds'])==1 and source['recordId'] is None and source['identityVerified'] is False,'No name fan-out or premature acceptance')
        proof=source['authorityIdentity'];record=records[source['reviewAgainstIds'][0]]
        require(proof['recordId']==record['id'] and proof['catalogueName']==record['name'] and proof['type']==record['type'] and proof['emirate']==record['emirate']=='Abu Dhabi','Exact record identity mismatch')
        retained=[r for r in record.get('registerEvidence',[]) if r.get('identityVerified') and r.get('fields',{}).get('developerName')]
        require(any(str(r['fields']['projectNumber'])==proof['projectNumber'] and r['fields']['developerName']==proof['authorityDeveloper'] and r['fields']['districtCode']==proof['authorityArea'] and r['fields']['totalCount']==proof['authorityUnitCount']==source['expectedUnits'] and r['sourceIds']==proof['identitySourceIds'] for r in retained),'Retained authority proof mismatch')
        require(source['rawRetentionAllowed'] is False and source['reuseStatus']=='normalized_metadata_only','Raw retention forbidden')
        published=dt.date.fromisoformat(source['reportedPublishedAt']);require(published.isoformat()<=plan['asOf'],'Future publication')
        require(len({x['id'] for x in source['claims']})==len(source['claims']),'Duplicate claim IDs')
        for claim in source['claims']:
            re.compile(claim['pattern'],re.I)
            require(claim['kind'] in ['financial','lifecycle'],'Unreviewed evidence class')
            if claim['kind']=='financial':
                require(claim['metric']=='price' and claim['expectedCurrency']=='AED' and isinstance(claim['amountAED'],int) and claim['amountAED']>0,'Quote type or units invalid')
            else:
                require(claim['milestone'] in ['launch','target_construction_start','target_handover'],'Actual completion cannot be inferred')
                require(claim['eventStatus']==('reported' if claim['milestone']=='launch' else 'planned'),'Planned versus actual mismatch')
                require(claim['milestone']!='launch' or claim['period']==source['reportedPublishedAt'],'Launch date differs from reviewed dateline')
    return True

def normalize(raw,source):
    text=text_of(raw);published=dt.date.fromisoformat(source['reportedPublishedAt'])
    dates=[published.strftime('%B')+r'\s+'+str(published.day)+r',?\s+'+str(published.year),str(published.day)+r'\s+'+published.strftime('%B')+r'\s+'+str(published.year)]
    identity={needle:needle.casefold() in text.casefold() for needle in source['identityNeedles']}
    units=bool(re.search(r'\b'+str(source['expectedUnits'])+r'\b.{0,65}?\b(?:homes|villas|studios|apartments)\b',text,re.I))
    out={'publicationDateMatched':any(re.search(p,text,re.I) for p in dates),'reportedPublishedAt':source['reportedPublishedAt'],
         'identityChecks':identity,'authorityUnitCountMatched':units,'expectedUnits':source['expectedUnits'],'claimChecks':[],
         'rawTextRetained':False,'methodology':'Exact pre-reviewed claim patterns; numbers and match digests only. No source text or snippets retained.'}
    for claim in source['claims']:
        found=list(re.finditer(claim['pattern'],text,re.I));item={'claimId':claim['id'],'kind':claim['kind'],'matchCount':len(found),'matched':bool(found),'matchSHA256':[digest(m[0].encode()) for m in found[:10]]}
        if claim['kind']=='financial':
            values=[]
            for match in found:
                amount=Decimal(match['amount'].replace(',',''));scale=(match['scale'] or '').lower();value=amount*(1000000 if scale=='million' else 1)
                values.append(int(value) if value==value.to_integral_value() else float(value))
            item.update(observedAmountsAED=values,expectedAmountAED=claim['amountAED'],matched=bool(values) and all(v==claim['amountAED'] for v in values),unit='AED')
        else:item.update(period=claim['period'],precision=claim['precision'],eventStatus=claim['eventStatus'])
        out['claimChecks'].append(item)
    out['identityContentConfirmed']=bool(out['publicationDateMatched'] and units and all(identity.values()))
    return out

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--plan',type=Path,required=True);p.add_argument('--snapshot',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--verify-only',action='store_true');a=p.parse_args()
    raw=a.snapshot.read_bytes();raw=gzip.decompress(raw) if a.snapshot.suffix=='.gz' else raw
    plan=json.loads(a.plan.read_bytes());snapshot=json.loads(raw)
    require(digest(raw)==plan['baselineSHA256'],'Pinned V47 canonical checksum differs')
    validate_plan(plan,snapshot)
    if a.verify_only:print(json.dumps({'records':1860,'targets':5,'sources':5,'networkRequests':0,'valid':True}));return
    require(not a.output.exists(),'Capture must have a new immutable output')
    spec=importlib.util.spec_from_file_location('bounded_collector',ROOT/'scripts/review_regional_sources.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
    collector=m.Collector(plan);actual=collector.transport;normalized={};by_url={s['url']:s for s in plan['sources']}
    def transport(url):
        status,headers,body=actual(url);kind=next((v for k,v in headers.items() if k.lower()=='content-type'),'').lower()
        if status==200 and url in by_url and len(body)<=LIMITS['bytesPerResponse'] and 'text/html' in kind:normalized[url]=normalize(body,by_url[url])
        return status,headers,body
    collector.transport=transport;captures=[]
    for source in plan['sources']:
        receipt=collector.capture(source);receipt['normalizedReview']=normalized.get(receipt.get('finalUrl'),{})
        receipt['publishedAt']=source['reportedPublishedAt'] if receipt['normalizedReview'].get('publicationDateMatched') else None
        receipt['historicalForecastAvailability']=None;receipt['acceptedFacts']=[];captures.append(receipt)
    out={'schemaVersion':1,'passId':plan['passId'],'baselineVersion':snapshot['version'],'baselineSHA256':digest(raw),'planSHA256':digest(a.plan.read_bytes()),'httpRequests':collector.count,'sources':captures,'acceptedFacts':[],'rawRetained':False,'numericForecasts':[]}
    a.output.parent.mkdir(parents=True,exist_ok=True)
    with a.output.open('x') as f:json.dump(out,f,ensure_ascii=False,indent=2);f.write('\n')
    print(json.dumps({'sources':len(captures),'requests':collector.count,'outcomes':dict(collections.Counter(s['captureStatus'] for s in captures)),'acceptedFacts':0}))
if __name__=='__main__':main()
