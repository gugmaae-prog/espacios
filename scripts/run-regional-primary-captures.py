#!/usr/bin/env python3
"""Three bounded, exact-ID public passes. No raw retention or evidence acceptance."""
import gzip,hashlib,importlib.util,json,sys,time,subprocess
from pathlib import Path
from urllib.parse import urlsplit
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('capture',ROOT/'scripts/capture-regional-primary-pass.py');cap=importlib.util.module_from_spec(spec);spec.loader.exec_module(cap)
def run(snapshot_path,out_dir):
 raw=Path(snapshot_path).read_bytes();raw=gzip.decompress(raw) if str(snapshot_path).endswith('.gz') else raw;snapshot=json.loads(raw)
 if hashlib.sha256(raw).hexdigest()!='9e32d607d01b6e9e0a6d4ce2da5f689f7df6bb8ecb50d5adb0283d1f8ea005b8':raise ValueError('Pinned V46 baseline mismatch')
 sources=json.loads((ROOT/'data/historical-intelligence/reviewed-regional-20261014/source-targets.json').read_text());out_dir=Path(out_dir);out_dir.mkdir(parents=True,exist_ok=True)
 for region in ['abu-dhabi','umm-al-quwain','pja-fujairah']:
  expanded=[]
  for ident,url,publisher,ids,needles,published,phrases,mode in sources[region]:
   expanded.append(dict(id=ident,url=url,publisher=publisher,reviewAgainstIds=ids,expectedNeedles=needles,identityNeedles=needles,reportedPublishedAt=published,reviewedPhrases=phrases,extractMode=mode,rawRetentionAllowed=False,reuseStatus='normalized_metadata_only',recordId=None,identityVerified=False))
  plan=dict(schemaVersion=1,mode='capture_only',passId='primary-'+region+'-20261014-v47',baselineVersion=snapshot['version'],baselineSHA256=hashlib.sha256(raw).hexdigest(),baselineCommit='6cb77c197d1ea6107c94f374f2bfa10c7248a043',domains=sorted({urlsplit(x['url']).hostname for x in expanded}),limits=dict(sourcePages=20,httpRequests=40,concurrency=1,redirectsPerUrl=2,bytesPerResponse=2000000,timeoutSeconds=15,minimumDelaySeconds=2),sources=expanded);cap.validate(plan,snapshot['records']);plan_path=out_dir/(region+'-plan.json')
  with plan_path.open('x') as f:json.dump(plan,f,indent=2);f.write('\n')
  subprocess.run([sys.executable,str(ROOT/'scripts/capture-regional-primary-pass.py'),'--plan',str(plan_path),'--snapshot',str(snapshot_path),'--output',str(out_dir/(region+'-capture.json'))],check=True);time.sleep(2)
if __name__=='__main__':run(sys.argv[1],sys.argv[2])
