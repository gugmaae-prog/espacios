import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('a later cutoff preserves published quote vintages without promoting segmented or future quotes',()=>{
 const code=String.raw`
import sys,copy
sys.path.insert(0,'scripts')
from historical_enrichment import retain_published_quotes,current_snapshot_eligible
original={'askingPriceAED':100,'retrievedAt':'2026-10-03'}
selected={'askingPriceAED':120,'observationId':'q','retrievedAt':'2026-10-04'}
old={'asOf':'2026-10-05','records':[{'id':'p','currentSnapshot':selected,'priorCurrentSnapshots':[original]}]}
packet={'facts':[{'id':'q','recordId':'p','status':'accepted','observation':{'observationKind':'asking_quote'}}]}
records=[{'id':'p','currentSnapshot':copy.deepcopy(original)}]
retain_published_quotes(records,old,packet,'2026-10-06')
assert records[0]['currentSnapshot']==selected and original in records[0]['priorCurrentSnapshots']
packet['facts'][0]['observation']['currentSnapshotEligible']=False
records=[{'id':'p','currentSnapshot':copy.deepcopy(original)}]
retain_published_quotes(records,old,packet,'2026-10-06')
assert records[0]['currentSnapshot']==original and selected in records[0]['priorCurrentSnapshots']
try:retain_published_quotes(records,old,packet,'2026-10-04');raise AssertionError('future quote accepted')
except ValueError:pass
for value in ['false',0,1,None]:
 try:current_snapshot_eligible({'currentSnapshotEligible':value});raise AssertionError('non-boolean accepted')
 except ValueError:pass
`;
 const r=spawnSync('python3',['-c',code],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
});
test('sourced community corrections preserve rejected observations and refuse unproven reassignment',()=>{
 const code=String.raw`
import sys,copy
sys.path.insert(0,'scripts')
from historical_enrichment import apply_enrichment
p={'id':'p','type':'project','emirate':'Dubai','communityId':'wrong','lifecycle':[],'observations':[],'historySeries':[{'id':'old','scope':'area_context','sourceId':'s','points':[['2020',100,30]]}],'researchStatus':{'gaps':[]},'coverageSummary':{},'currentSnapshot':{}}
c={'id':'right','type':'community','emirate':'Dubai','lifecycle':[],'observations':[],'historySeries':[],'researchStatus':{'gaps':[]},'coverageSummary':{}}
s={'id':'s','url':'https://example.org/primary','retrievedAt':'2026-10-05'}
f={'id':'fix','recordId':'p','kind':'community_association','fromCommunityId':'wrong','toCommunityId':'right','rejectedSeriesIds':['old'],'sourceId':'s','identitySourceIds':['s'],'identityBasis':'Exact native and primary location','primaryEvidence':True,'verification':'verified','status':'accepted','label':'Correct community','reason':'Primary location contradicts old link'}
def apply(f,p,c):apply_enrichment({'asOf':'2026-10-05','facts':[f]},[p,c],{'old':p['historySeries'][0]},{'s':s},lambda x:None,{},'2026-10-05')
before=copy.deepcopy(p);apply(f,p,c)
assert p['communityId']=='right' and p['communityAssociationRevisions'][0]['fromCommunityId']=='wrong'
assert p['historySeries'][0]['points']==before['historySeries'][0]['points']
assert p['historySeries'][0]['recordLinkReview']['status']=='rejected'
assert p['researchStatus']['itemCoverage']['shared_financial_context']['status']=='missing'
for delta in [{'primaryEvidence':False},{'fromCommunityId':'unrelated'},{'identitySourceIds':['absent']},{'rejectedSeriesIds':['missing']}]:
 try:apply({**f,**delta},copy.deepcopy(before),copy.deepcopy(c));raise AssertionError('Unsafe association accepted')
 except ValueError:pass
 `;
 const out=spawnSync('python3',['-c',code],{encoding:'utf8'});assert.equal(out.status,0,out.stderr||out.stdout);
});
test('disputed rents remain evidence without clearing coverage or earliest-history gaps',()=>{
 const code=String.raw`
import sys
sys.path.insert(0,'scripts')
from historical_gap_ledger import refresh_research_coverage
s={'id':'rent','metric':'rent','scope':'subject','identityVerified':True,'sourceId':'source','points':[['2025-06',10000,50,'conflict: occupancy chronology']]}
r={'id':'p','type':'project','historySeries':[s],'researchStatus':{'gaps':['direct_signed_rent_history']}}
refresh_research_coverage(r,{'rent':s},{'source':{}},'2026-10-05')
x=r['researchStatus'];assert x['itemCoverage']['signed_rent_history']['status']=='partial';assert x['itemCoverage']['signed_rent_history']['disputedNativePointCount']==1
assert x['earliestHistoryEvidence'] is None and 'direct_signed_rent_history' in x['gaps']
assert s['points'][0][1]==10000
 `;
 const out=spawnSync('python3',['-c',code],{encoding:'utf8'});assert.equal(out.status,0,out.stderr||out.stdout);
});
const script=String.raw`
import sys
sys.path.insert(0,'scripts')
from historical_enrichment import apply_enrichment
src={'s':{'id':'s','url':'https://example.org/evidence','retrievedAt':'2026-10-04T22:00:00Z','firstAvailableAt':'2026-10-04T22:00:00Z'}}
def rec(id):return {'id':id,'emirate':'Dubai','type':'project','name':id,'lifecycle':[],'observations':[],'historySeries':[],'researchStatus':{'gaps':['verified_launch_date','actual_completion_date'],'status':'research_pending'},'currentSnapshot':{'askingPriceAED':100},'coverageSummary':{}}
def apply(packet,records,series={}):return apply_enrichment({'schemaVersion':1,'asOf':'2026-10-05',**packet},records,series,src,lambda s:None,{},'2026-10-05')
mode=sys.argv[1]
fact={'id':'claim','recordId':'p','kind':'lifecycle','milestone':'completion','date':{'start':'2027-01-01','precision':'day'},'label':'Completed','verification':'verified','primaryEvidence':True,'identityBasis':'Exact phase and developer','sourceId':'s','status':'accepted'}
if mode=='future':
 try:apply({'facts':[fact]},[rec('p')]);raise AssertionError('future actual accepted')
 except ValueError as e:assert 'Future actual' in str(e)
if mode=='target':
 fact['milestone']='target_handover';fact['verification']='reported';p=rec('p');apply({'facts':[fact]},[p]);assert p['lifecycle'][0]['kind']=='target_handover';assert 'actual_completion_date' in p['researchStatus']['gaps']
if mode=='phase':
 fact.update({'milestone':'phase_launch','date':{'start':'2023','precision':'year'}});p=rec('p');apply({'facts':[fact]},[p]);assert 'verified_launch_date' in p['researchStatus']['gaps']
if mode=='fanout':
 full={'id':'x','scope':'subject','identityVerified':True,'points':[]};links=[{'recordId':i,'seriesId':'x','scope':'subject','identityVerified':True,'identityBasis':'ID proof','identitySourceIds':['s']} for i in ['p','q']]
 try:apply({'seriesLinks':links},[rec('p'),rec('q')],{'x':full});raise AssertionError('fan-out accepted')
 except ValueError as e:assert 'fan-out' in str(e)
if mode=='asking':
 p=rec('p');f={'id':'ask','recordId':'p','kind':'financial','status':'accepted','identityBasis':'Exact source page','sourceId':'s','scope':'asking_benchmark','observation':{'value':400000,'metric':'price','unit':'AED','period':'2026-10-05','observationKind':'asking_quote'}};apply({'facts':[f]},[p]);assert p['currentSnapshot']['askingPriceAED']==400000;assert p['priorCurrentSnapshots'][0]['askingPriceAED']==100;assert p['observations'][0]['scope']=='asking_benchmark';assert p['observations'][0]['firstAvailableAt']=='2026-10-04T22:00:00Z'
if mode=='unproven':
 fact['date']={'start':'2020','precision':'year'};fact['primaryEvidence']=False
 try:apply({'facts':[fact]},[rec('p')]);raise AssertionError('unproven primary accepted')
 except ValueError as e:assert 'primary evidence' in str(e)
if mode in ['future_available','orphan_proof']:
 f={'id':'ask','recordId':'p','kind':'financial','status':'accepted','identityBasis':'Exact registered ID','sourceId':'s','scope':'subject','identityVerified':True,'identitySourceIds':['s'],'observation':{'value':400000,'metric':'price','unit':'AED','period':'2026-10-05','observationKind':'asking_quote'}}
 if mode=='future_available':f['firstAvailableAt']='2027-01-01'
 else:f['identitySourceIds']=['nonexistent-proof']
 try:apply({'facts':[f]},[rec('p')]);raise AssertionError('bad provenance accepted')
 except ValueError as e:assert ('after snapshot' if mode=='future_available' else 'orphan source') in str(e)
if mode=='preferred_quote':
 src['m']={**src['s'],'id':'m','classification':'public_tenant_mirror'}
 def quote(id,source,value):return {'id':id,'recordId':'p','kind':'financial','status':'accepted','identityBasis':'Exact named source page','sourceId':source,'scope':'asking_benchmark','observation':{'value':value,'metric':'price','unit':'AED','period':'2026-10-05','observationKind':'asking_quote'}}
 a,b=rec('p'),rec('p');external=quote('z','s',400000);mirror=quote('a','m',900000)
 apply({'facts':[external,mirror]},[a]);apply({'facts':[mirror,external]},[b]);assert a['currentSnapshot']==b['currentSnapshot'];assert a['currentSnapshot']['askingPriceAED']==400000;assert len(a['observations'])==2
if mode=='gap_ledger':
 p=rec('p');p['researchStatus']['gaps']+=['direct_registered_sale_history','direct_signed_rent_history']
 full={'id':'x','scope':'subject','identityVerified':True,'metric':'price','sourceId':'s','points':[['2014Q1',100,1]]}
 link={'recordId':'p','seriesId':'x','scope':'subject','identityVerified':True,'identityBasis':'Exact phase proof','identitySourceIds':['s']}
 apply({'seriesLinks':[link]},[p],{'x':full});state=p['researchStatus']
 assert 'direct_registered_sale_history' not in state['gaps'] and 'direct_signed_rent_history' in state['gaps']
 assert 'complete_registered_sale_history' in state['gaps']
 assert state['itemCoverage']['registered_sale_history']['status']=='present'
 assert state['itemCoverage']['registered_sale_history']['completeLifetimeHistory'] is False
 assert 'direct_registered_sale_history' in state['originalAuditGaps']
 assert state['earliestHistoryEvidence']['date']['start']=='2014Q1'
if mode=='transaction_ledger':
 p=rec('p');p['researchStatus']['gaps']+=['direct_registered_sale_history']
 p['observations']=[{'id':'tx','sourceIds':['s'],'sourceId':'s','scope':'subject','identityVerified':True,'metric':'price','value':1200,'unit':'AED/sqft','period':'2026-10-03','observationKind':'transaction','transactionKind':'sale','transactionId':'dld-1','status':'source_observed'}]
 from historical_gap_ledger import refresh_research_coverage
 refresh_research_coverage(p,{},src,'2026-10-05')
 state=p['researchStatus'];assert state['itemCoverage']['registered_sale_history']['status']=='present'
 assert state['itemCoverage']['registered_sale_history']['transactionObservationCount']==1
 assert state['itemCoverage']['registered_sale_history']['completeLifetimeHistory'] is False
 assert 'direct_registered_sale_history' not in state['gaps'] and 'complete_registered_sale_history' in state['gaps']
 assert state['earliestHistoryEvidence']['date']['start']=='2026-10-03'
 p['observations'][0]['transactionKind']='lease'
 refresh_research_coverage(p,{},src,'2026-10-05')
 assert p['researchStatus']['itemCoverage']['registered_sale_history']['status']=='missing'
if mode=='whole_scope':
 fact.update(date={'start':'2020-01-01','precision':'day'},scope='published_reference');p=rec('p');apply({'facts':[fact]},[p]);assert 'actual_completion_date' in p['researchStatus']['gaps']
 fact.update(id='whole',scope='subject');q=rec('q');fact['recordId']='q';apply({'facts':[fact]},[q]);assert 'actual_completion_date' not in q['researchStatus']['gaps']
if mode=='source_revision':
 from historical_sources import register_source
 from copy import deepcopy
 stored={};urls={};aliases={};canonical=lambda url:url
 original={'id':'old','url':'https://example.org/evidence','retrievedAt':'2026-10-03','sha256':'oldhash','publishedAt':'2020-01-01'}
 register_source(original,stored,urls,aliases,canonical,'2026-10-03');saved=deepcopy(stored['old'])
 revised={**original,'id':'new','retrievedAt':'2026-10-05','sha256':'newhash','preserveRevision':True,'revisionOfSourceId':'old'}
 assert register_source(revised,stored,urls,aliases,canonical,'2026-10-05')=='new';assert stored['old']==saved;assert stored['new']['canonicalSourceId']=='old'
 assert register_source({'id':'new','url':original['url']},stored,urls,aliases,canonical,'2026-10-05')=='new'
 try:register_source({**revised,'sha256':'changed'},stored,urls,aliases,canonical,'2026-10-05');raise AssertionError('revision overwritten')
 except ValueError as e:assert 'cannot be overwritten' in str(e)
`;
for(const mode of ['future','target','phase','fanout','asking','unproven','future_available','orphan_proof','preferred_quote','gap_ledger','transaction_ledger','whole_scope','source_revision'])test('source enrichment preserves evidence boundaries: '+mode,()=>{
 const result=spawnSync('python3',['-c',script,mode],{encoding:'utf8'});assert.equal(result.status,0,result.stderr||result.stdout);
});

test('packet merge preserves source revisions outside the prior enrichment and avoids nested collection passes',()=>{
 const code=String.raw`
import json,pathlib,tempfile,subprocess
with tempfile.TemporaryDirectory() as tmp:
 p=pathlib.Path(tmp)
 old={'id':'seed','url':'https://example.org/source','retrievedAt':'2026-10-03','sha256':'old','publishedAt':None}
 (p/'baseline.json').write_text(json.dumps({'sources':[old]}))
 first={'schemaVersion':1,'asOf':'2026-10-05','sources':[],'facts':[{'id':'fact','recordId':'p','status':'accepted'}],'recordResearch':[{'recordId':'p','sourceIds':[],'acceptedFactCount':7,'collectionPasses':[{'status':'first'}]}],'collection':{'passes':[{'packetFile':'retained'}]}}
 second={'schemaVersion':1,'asOf':'2026-10-05','sources':[{**old,'id':'revision','url':old['url']+'/','retrievedAt':'2026-10-05','sha256':'new'}],'facts':[],'recordResearch':[{'recordId':'p','sourceIds':['revision'],'status':'reviewed'}]}
 for i,x in enumerate([first,second]):(p/str(i)).write_text(json.dumps(x))
 subprocess.run(['python3','scripts/merge-historical-enrichment.py','--baseline-snapshot',str(p/'baseline.json'),'--retained-packet',str(p/'0'),'--packet',str(p/'0'),'--packet',str(p/'1'),'--output',str(p/'out')],check=True,capture_output=True)
 out=json.loads((p/'out').read_text());s=out['sources'][0]
 assert s['preserveRevision'] is True and s['revisionOfSourceId']=='seed'
 assert len(out['collection']['passes'])==2 and out['collection']['passes'][0]['packetFile']=='retained'
 assert out['recordResearch'][0]['acceptedFactCount']==1
 assert len(out['recordResearch'][0]['collectionPasses'])==2
 `;
 const result=spawnSync('python3',['-c',code],{encoding:'utf8'});assert.equal(result.status,0,result.stderr||result.stdout);
});

test('preservation check rejects lost evidence and retains superseded current snapshots',()=>{
 const code=String.raw`
import importlib.util,pathlib,copy
spec=importlib.util.spec_from_file_location('preserve','scripts/check-historical-preservation.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
record={'id':'p','type':'project','name':'P','emirate':'Dubai','currentSnapshot':{'askingPriceAED':1},'observations':[{'id':'quote','value':1}],'lifecycle':[],'historySeries':[]}
old={'version':'old','records':[record],'sources':[{'id':'s','url':'https://example.org','sha256':'old'}],'events':[],'exposures':[],'exposureRules':[],'manifest':{'objects':[]}}
new=copy.deepcopy(old);new['version']='new';new['records'][0]['currentSnapshot']={'askingPriceAED':2};new['records'][0]['priorCurrentSnapshots']=[record['currentSnapshot']];new['records'][0]['observations'].append({'id':'q2','value':2})
assert mod.check(old,new,pathlib.Path('.'))['passed']
new['records'][0]['observations']=[];assert not mod.check(old,new,pathlib.Path('.'))['passed']
new=copy.deepcopy(old);new['sources'][0]['sha256']='changed';assert not mod.check(old,new,pathlib.Path('.'))['passed']
 `;
 const result=spawnSync('python3',['-c',code],{encoding:'utf8'});assert.equal(result.status,0,result.stderr||result.stdout);
});

test('local context preserves planned stages and verified named communities without inventing project access',()=>{
 const code=String.raw`
import sys
sys.path.insert(0,'scripts')
from historical_local_events import local_event_context
sources={'s':{'firstAvailableAt':'2026-10-05'}}
fact={'id':'f','kind':'infrastructure_opening','date':{'start':'2021-01-01','precision':'day'},'label':'Scheduled service','eventStatus':'planned','status':'verified','primaryEvidence':True,'sourceIds':['s']}
community={'id':'c','type':'community','emirate':'Dubai','lifecycle':[fact]};project={'id':'p','type':'project','emirate':'Dubai','communityId':'c','lifecycle':[]};other={'id':'o','type':'project','emirate':'Dubai','communityId':'other','lifecycle':[]}
events,links=local_event_context([community,project,other],sources,'2026-10-05')
assert len(events)==1 and events[0]['status']=='planned' and events[0]['priceUpliftPct'] is None
assert len(links)==2 and next(x for x in links if x['recordId']=='p')['verified'] is False
assert all(x['exactAccessVerified'] is False for x in links)
second={**community,'id':'c2','lifecycle':[{**fact,'id':'f2'}]};assert len(local_event_context([community,second],sources,'2026-10-05')[0])==1
fact.update(eventStatus='actual',date={'start':'2027','precision':'year'})
try:local_event_context([community],sources,'2026-10-05');raise AssertionError('Future actual accepted')
except ValueError as e:assert 'Future actual' in str(e)
 `;
 const result=spawnSync('python3',['-c',code],{encoding:'utf8'});assert.equal(result.status,0,result.stderr||result.stdout);
});

test('developer advertised quote kinds are counted while planned launches retain their research gap',()=>{
 const code=String.raw`
import sys
sys.path.insert(0,'scripts')
from historical_gap_ledger import refresh_research_coverage
record={'id':'p','lifecycle':[{'id':'planned','kind':'launch','date':{'start':'2020','precision':'year'},'status':'verified','primaryEvidence':True,'scope':'subject','eventStatus':'planned','sourceIds':['s']}],'observations':[{'id':'quote','observationKind':'developer_advertised_price','sourceId':'s','primaryEvidence':True,'scope':'subject','identityVerified':True}],'historySeries':[],'researchStatus':{'gaps':['verified_launch_date']}}
refresh_research_coverage(record,{}, {'s':{'id':'s'}},'2026-10-05')
assert record['researchStatus']['itemCoverage']['advertised_prices']['status']=='present'
assert record['researchStatus']['itemCoverage']['advertised_prices']['primaryQuoteCount']==1
assert 'verified_launch_date' in record['researchStatus']['gaps']
assert record['researchStatus']['earliestHistoryEvidence'] is None
 `;
 const result=spawnSync('python3',['-c',code],{encoding:'utf8'});assert.equal(result.status,0,result.stderr||result.stdout);
});

test('contextual asking evidence remains visible without closing exact advertised-price coverage',()=>{
 const code=String.raw`
import sys
sys.path.insert(0,'scripts')
from historical_gap_ledger import refresh_research_coverage
record={'id':'p','lifecycle':[],'observations':[{'id':'mirror','observationKind':'asking_quote','sourceId':'s','scope':'asking_benchmark','identityVerified':False}],'historySeries':[],'researchStatus':{'gaps':[]}}
refresh_research_coverage(record,{}, {'s':{'id':'s','classification':'tenant_mirror_catalogue'}},'2026-10-07')
item=record['researchStatus']['itemCoverage']['advertised_prices']
assert item['status']=='partial'
assert item['evidenceIds']==['mirror']
assert item['contextualQuoteCount']==1
assert item['primaryQuoteCount']==0
 `;
 const result=spawnSync('python3',['-c',code],{encoding:'utf8'});assert.equal(result.status,0,result.stderr||result.stdout);
});

test('a single new packet against a baseline creates an immutable source revision',()=>{
 const code=String.raw`
import json,pathlib,tempfile,subprocess
with tempfile.TemporaryDirectory() as tmp:
 p=pathlib.Path(tmp);source={'id':'old','url':'https://example.org/source','retrievedAt':'2026-10-03','sha256':'old'}
 (p/'base').write_text(json.dumps({'sources':[source]}));(p/'packet').write_text(json.dumps({'schemaVersion':1,'asOf':'2026-10-05','sources':[{**source,'id':'new','retrievedAt':'2026-10-05','sha256':'new'}]}))
 subprocess.run(['python3','scripts/merge-historical-enrichment.py','--baseline-snapshot',str(p/'base'),'--packet',str(p/'packet'),'--output',str(p/'out')],check=True,capture_output=True)
 new=json.loads((p/'out').read_text())['sources'][0];assert new['preserveRevision'] is True and new['revisionOfSourceId']=='old'
 `;
 const result=spawnSync('python3',['-c',code],{encoding:'utf8'});assert.equal(result.status,0,result.stderr||result.stdout);
});

test('phase construction evidence is accounted for without certifying an original whole-record start',()=>{
 const code=String.raw`
import sys
sys.path.insert(0,'scripts')
from historical_gap_ledger import refresh_research_coverage
record={'id':'c','lifecycle':[{'id':'phase','kind':'phase_construction_progress','date':{'start':'2024-02','precision':'month'},'status':'verified','primaryEvidence':True,'scope':'community_context','eventStatus':'actual','sourceIds':['s']}],'observations':[],'historySeries':[],'researchStatus':{'gaps':[]}}
refresh_research_coverage(record,{}, {'s':{'id':'s'}},'2026-10-05')
assert record['researchStatus']['itemCoverage']['construction']['status']=='partial'
assert record['researchStatus']['itemCoverage']['phase_milestones']['status']=='present'
assert record['researchStatus']['itemCoverage']['construction']['evidenceIds']==['phase']
 `;
 const result=spawnSync('python3',['-c',code],{encoding:'utf8'});assert.equal(result.status,0,result.stderr||result.stdout);
});

test('an original historical launch advertisement remains history and cannot replace the present asking quote',()=>{
 const code=String.raw`
import sys
sys.path.insert(0,'scripts')
from historical_enrichment import apply_enrichment
record={'id':'p','emirate':'Dubai','type':'project','lifecycle':[],'observations':[],'historySeries':[],'researchStatus':{'gaps':[]},'currentSnapshot':{'askingPriceAED':900000},'coverageSummary':{}}
source={'id':'s','url':'https://example.org/old-launch','retrievedAt':'2026-10-05','publishedAt':'2019-04-29','firstAvailableAt':'2026-10-05'}
fact={'id':'quote','recordId':'p','kind':'financial','status':'accepted','primaryEvidence':True,'identityBasis':'Exact named project','sourceId':'s','scope':'asking_benchmark','observation':{'value':740828,'metric':'price','unit':'AED','period':'2019-04-29','observationKind':'asking_quote'}}
apply_enrichment({'asOf':'2026-10-05','sources':[],'facts':[fact]},[record],{}, {'s':source},lambda x:None,{},'2026-10-05')
assert record['observations'][0]['value']==740828 and record['observations'][0]['period']=='2019-04-29'
assert record['currentSnapshot']['askingPriceAED']==900000
 `;
 const result=spawnSync('python3',['-c',code],{encoding:'utf8'});assert.equal(result.status,0,result.stderr||result.stdout);
});

test('verified register evidence clears a wholly missing register item without inventing its original date',()=>{
 const result=spawnSync('python3',['-c',String.raw`
import sys
sys.path.insert(0,'scripts')
from historical_gap_ledger import refresh_research_coverage
record={'id':'p','type':'project','researchStatus':{'gaps':[]},'registerEvidence':[{'id':'registered','registeredProjectId':'1404','identityVerified':True,'scope':'subject','sourceIds':['s'],'fields':{'nativeProjectName':'P'}}]}
refresh_research_coverage(record,{}, {'s':{'id':'s'}},'2026-10-05')
entry=record['researchStatus']['itemCoverage']['announcement_registration']
assert entry['status']=='partial' and entry['evidenceIds']==['registered']
assert record['researchStatus']['earliestHistoryEvidence'] is None
assert record['researchStatus']['itemCoverage']['original_launch']['status']=='missing'
`],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr||result.stdout);
});

test('bedroom and unit-specific asking quotes stay as evidence without replacing headline current snapshot',()=>{
 const code=String.raw`
import sys
sys.path.insert(0,'scripts')
from historical_enrichment import apply_enrichment,current_snapshot_eligible
source={'id':'s','url':'https://developer.example/project','retrievedAt':'2026-10-06T00:00:00Z','firstAvailableAt':'2026-10-06T00:00:00Z'}
def rec():return {'id':'p','emirate':'Dubai','type':'project','name':'P','lifecycle':[],'observations':[],'historySeries':[],'researchStatus':{'gaps':[]},'currentSnapshot':{'askingPriceAED':900000},'coverageSummary':{}}
def fact(id,value,**obs):return {'id':id,'recordId':'p','kind':'financial','status':'accepted','identityBasis':'Exact named developer page','sourceId':'s','scope':'asking_benchmark','observation':{'value':value,'metric':'price','unit':'AED','period':'2026-10-06','observationKind':'asking_quote',**obs}}
for segmented in [
 {'bedrooms':'1'},
 {'unitType':'1BR'},
 {'quoteQualifier':'From AED 1.2M for 2 bedroom residences'},
 {'sourceQuoteBasis':'studio unit-specific price'},
 {'currentSnapshotEligible':False}
]:
 p=rec();apply_enrichment({'asOf':'2026-10-06','facts':[fact('seg',1200000,**segmented)]},[p],{}, {'s':source},lambda x:None,{},'2026-10-06')
 assert p['currentSnapshot']['askingPriceAED']==900000
 assert p['observations'][0]['value']==1200000
 assert current_snapshot_eligible(p['observations'][0]) is False
p=rec();apply_enrichment({'asOf':'2026-10-06','facts':[fact('headline',1000000,quoteQualifier='Project starting from price')]},[p],{}, {'s':source},lambda x:None,{},'2026-10-06')
assert p['currentSnapshot']['askingPriceAED']==1000000
assert p['currentSnapshot']['observationId']=='headline'
 `;
 const out=spawnSync('python3',['-c',code],{encoding:'utf8'});assert.equal(out.status,0,out.stderr||out.stdout);
});
