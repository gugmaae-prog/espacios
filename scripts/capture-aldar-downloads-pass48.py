#!/usr/bin/env python3
"""Read only exact public downloads linked by Aldar; never save raw documents."""
import argparse,copy,datetime as dt,gzip,hashlib,html,importlib.util,io,json,re,subprocess,urllib.parse,zipfile
from html.parser import HTMLParser
from pathlib import Path
from xml.etree import ElementTree
ROOT=Path(__file__).resolve().parents[1]
def load(name,path):
 s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
m=load('aldar_capture',ROOT/'scripts/capture-aldar-launches-pass48.py')
sha=lambda raw:hashlib.sha256(raw).hexdigest()
now=lambda:dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds').replace('+00:00','Z')
class Links(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=True);self.links=[]
 def handle_starttag(self,tag,attrs):
  if tag=='a':
   for key,value in attrs:
    if key=='href' and value:self.links.append(value)
def link_present(raw,parent,target):
 parser=Links();parser.feed(raw.decode('utf-8',errors='replace'))
 canon=lambda u:urllib.parse.unquote(urllib.parse.urljoin(parent,u))
 return canon(target) in {canon(x) for x in parser.links}
def document_text(raw,kind,pdf_reader=None):
 if raw.startswith(b'%PDF') and 'pdf' in kind.lower():
  if pdf_reader:return pdf_reader(raw)
  result=subprocess.run(['pdftotext','-enc','UTF-8','-','-'],input=raw,capture_output=True,timeout=25,check=True)
  m.require(len(result.stdout)<=2000000,'Extracted text size exceeds bound');return result.stdout.decode('utf-8')
 if raw.startswith(b'PK') and any(x in kind.lower() for x in ['officedocument.wordprocessingml','application/octet-stream','application/zip']):
  with zipfile.ZipFile(io.BytesIO(raw)) as z:
   m.require(sum(i.file_size for i in z.infolist())<=5000000,'Office archive exceeds expanded bound')
   data=z.read('word/document.xml');m.require(len(data)<=2000000,'Document XML exceeds bound')
   root=ElementTree.fromstring(data)
   return ' '.join((x.text or '') for x in root.iter() if x.tag.endswith('}t'))
 raise ValueError('Unsupported public document type')
def get(collector,url):
 redirects=[];robots=[]
 for hop in range(3):
  allowed,policy=collector.permit(url);robots.append(policy)
  if not allowed:raise ValueError('Robots or rate policy blocks this URL')
  status,headers,raw=collector.request(url)
  receipt={'httpStatus':status,'finalUrl':url,'contentType':headers.get('content-type'),'sha256':sha(raw),'responseBytes':len(raw),'retrievedAt':now(),'redirectChain':redirects.copy(),'robotsReceipts':robots.copy(),'rawRetained':False}
  if status in [301,302,303,307,308]:
   target=urllib.parse.urljoin(url,headers.get('location',''))
   m.require(hop<2 and target!=url,'Redirect loop or limit');redirects.append({'from':url,'to':target,'httpStatus':status});url=target;continue
  return receipt,raw
 raise ValueError('Redirect limit')
def capture_one(collector,source,asset):
 out={'id':source['id'],'recordReviewIds':source['reviewAgainstIds'],'parentUrl':source['url'],'url':asset,'publisher':'Aldar','attemptedAt':now(),'captureStatus':'unconfirmed','acceptedFacts':[],'rawRetained':False,'normalizedReview':{}}
 try:
  parent,raw=get(collector,source['url']);out['parentCapture']=parent
  m.require(parent['httpStatus']==200 and 'text/html' in (parent['contentType'] or '').lower(),'Publisher page unavailable')
  out['officialDownloadLinkVerified']=link_present(raw,source['url'],asset)
  m.require(out['officialDownloadLinkVerified'],'Asset not linked by the publisher page')
  receipt,raw=get(collector,asset);out['documentCapture']=receipt
  m.require(receipt['httpStatus']==200,'Public download unavailable')
  text=document_text(raw,receipt['contentType'] or '')
  out['normalizedReview']=m.normalize(('<p>'+html.escape(text)+'</p>').encode(),source)
  out['normalizedReview']['extractedTextSHA256']=sha(text.encode())
  out['normalizedReview']['nativeQuarterMentions']=sorted(set(re.findall(r'Q[1-4]\s+20[0-9]{2}',text)))
  out['normalizedReview']['nativePriceMentions']=re.findall(r'AED\s*[0-9,]+(?:\.[0-9]+)?(?:\s*million)?',text)[:30]
  out.update(captureStatus='captured_normalized_document',firstAvailableAt=receipt['retrievedAt'],firstAvailabilityBasis='first_retained_download_capture_only_no_historical_publication_vintage',captureMethod='bounded_https_link_verified_pdf_or_docx_text_in_memory_no_raw_retention')
 except (ValueError,OSError,subprocess.SubprocessError,zipfile.BadZipFile,KeyError,ElementTree.ParseError) as error:
  out.update(captureStatus='unavailable_or_unconfirmed',reason=type(error).__name__+': '+str(error)[:180])
 return out
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--plan',type=Path,required=True);p.add_argument('--downloads',type=Path,required=True);p.add_argument('--snapshot',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 raw=a.snapshot.read_bytes();raw=gzip.decompress(raw) if a.snapshot.suffix=='.gz' else raw;plan=json.loads(a.plan.read_bytes());snapshot=json.loads(raw);assets=json.loads(a.downloads.read_bytes())
 m.require(sha(raw)==plan['baselineSHA256'],'V47 canonical SHA mismatch');m.validate_plan(plan,snapshot)
 m.require(assets['schemaVersion']==1 and assets['publisherDomain']=='www.aldar.com' and assets['downloadDomain']=='vazeno.files.cmp.optimizely.com' and assets['rawRetentionAllowed'] is False,'Download boundary changed')
 m.require(set(assets['downloads'])=={s['id'] for s in plan['sources']},'Exact download target mismatch')
 for url in assets['downloads'].values():m.require(url.startswith('https://vazeno.files.cmp.optimizely.com/download/assets/'),'Unapproved public asset domain')
 m.require(not a.output.exists(),'Immutable capture output already exists')
 bounded=load('bounded',ROOT/'scripts/review_regional_sources.py');network_plan=copy.deepcopy(plan);network_plan['domains'].append(assets['downloadDomain']);collector=bounded.Collector(network_plan)
 captures=[capture_one(collector,s,assets['downloads'][s['id']]) for s in plan['sources']]
 version=subprocess.run(['pdftotext','-v'],capture_output=True,text=True,check=True).stderr.splitlines()[0]
 output={'schemaVersion':1,'passId':'aldar-official-downloads-20261014','baseVersion':snapshot['version'],'baseSHA256':sha(raw),'planSHA256':sha(a.plan.read_bytes()),'assetMapSHA256':sha(a.downloads.read_bytes()),'httpRequests':collector.count,'sourcePagesLimit':20,'requestLimit':40,'concurrency':1,'decoderVersion':version,'rawRetained':False,'acceptedFacts':[],'numericForecasts':[],'sources':captures}
 a.output.parent.mkdir(parents=True,exist_ok=True)
 with a.output.open('x') as f:json.dump(output,f,ensure_ascii=False,indent=2);f.write('\n')
 print(json.dumps({'sources':len(captures),'httpRequests':collector.count,'captured':sum(s['captureStatus']=='captured_normalized_document' for s in captures),'acceptedFacts':0}))
if __name__=='__main__':main()
