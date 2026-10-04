import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
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
`;
for(const mode of ['future','target','phase','fanout','asking','unproven','future_available','orphan_proof','preferred_quote'])test('source enrichment preserves evidence boundaries: '+mode,()=>{
 const result=spawnSync('python3',['-c',script,mode],{encoding:'utf8'});assert.equal(result.status,0,result.stderr||result.stdout);
});
