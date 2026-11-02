import test from 'node:test';
import assert from 'node:assert/strict';
import {REVIEWED_QUOTES,verifyRegionalQuotePromotions} from '../scripts/regional-mirror-preservation.mjs';
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture() {
 const records=[],facts=[],sources=[];
 for(const [id,value] of Object.entries(REVIEWED_QUOTES)) {
  const partial=!id.startsWith('adrec:'),factId='new:'+id,sourceId='source:'+id;
  const item={status:partial?'partial':'missing',evidenceIds:partial?['old:'+id]:[],contextualQuoteCount:partial?1:0,catalogueMirrorQuoteCount:partial?1:0};
  records.push({id,observations:partial?[{id:'old:'+id,value:1,scope:'asking_benchmark'}]:[],currentSnapshot:{unchanged:true},researchStatus:{itemCoverage:{advertised_prices:item}}});
  const observation={id:factId,recordId:id,value,unit:'AED',currency:'AED',observationKind:'asking_quote',scope:'subject',identityVerified:true,primaryEvidence:true,evidenceClass:'advertised_asking_price',identitySourceIds:[sourceId],firstAvailableAt:'2026-10-14T09:00:00Z',period:'2026-10-14',currentSnapshotEligible:false,includeInCurrentSnapshot:false};
  facts.push({id:factId,recordId:id,kind:'financial',status:'accepted',scope:'subject',identityVerified:true,primaryEvidence:true,evidenceClass:'advertised_asking_price',identitySourceIds:[sourceId],sourceIds:[sourceId],observation});
  sources.push({id:sourceId,httpStatus:200,sha256:'a'.repeat(64),rawBodyRedistributed:false,reuseStatus:'normalized_metadata_only',firstAvailableAt:observation.firstAvailableAt,retrievedAt:observation.firstAvailableAt});
 }
 records.push({id:'untouched',observations:[{id:'legacy',value:2}],currentSnapshot:{},researchStatus:{itemCoverage:{advertised_prices:{status:'partial',evidenceIds:['legacy'],contextualQuoteCount:1,catalogueMirrorQuoteCount:1}}}});
 const baseline={version:'20261013-enrichment-v46',records},legacy=clone(baseline),current=clone(baseline);
 current.version='20261014-enrichment-v47';
 for(const r of legacy.records)r.researchStatus.itemCoverage.advertised_prices.status='present';
 for(const fact of facts){const r=current.records.find(r=>r.id===fact.recordId);r.observations.push(clone(fact.observation));r.researchStatus.itemCoverage.advertised_prices.status='present';r.researchStatus.itemCoverage.advertised_prices.evidenceIds.push(fact.id);}
 return {baseline,legacy,current,packet:{facts,sources}};
}
test('reviewed exact-ID promotions explain the legacy threshold without dropping mirrors',()=>{
 const data=fixture(),before=clone(data);const result=verifyRegionalQuotePromotions(data);
 assert.equal(result.fromPartial,11);assert.equal(result.fromMissing,3);assert.equal(result.restoredLegacyIds.length,11);assert.deepEqual(data,before);
});
test('a formerly partial legacy source is not credited as a restored mirror demotion',()=>{
 const data=fixture();data.legacy.records[0].researchStatus.itemCoverage.advertised_prices.status='partial';
 assert.equal(verifyRegionalQuotePromotions(data).restoredLegacyIds.length,10);
});
const mutations={
 'lost catalogue record':d=>d.current.records.pop(),
 'duplicate catalogue ID':d=>d.current.records.push(clone(d.current.records[0])),
 'unreviewed coverage promotion':d=>d.current.records.at(-1).researchStatus.itemCoverage.advertised_prices.status='present',
 'missing quote':d=>d.current.records[0].observations.pop(),
 'source body rights violation':d=>d.packet.sources[0].rawBodyRedistributed=true,
 'backdated availability':d=>d.packet.sources[0].firstAvailableAt='2020-01-01T00:00:00Z',
 'quote masquerades as registered sale':d=>d.current.records[0].observations.at(-1).observationKind='transaction',
 'wrong advertised amount':d=>d.current.records[0].observations.at(-1).value++,
 'identity fanout':d=>d.packet.facts[0].recordId=d.packet.facts[1].recordId,
 'old quote deletion':d=>d.current.records[0].observations.shift(),
 'mirror count erased':d=>d.current.records[0].researchStatus.itemCoverage.advertised_prices.catalogueMirrorQuoteCount=0,
 'unreviewed headline change':d=>d.current.records[0].currentSnapshot={new:true},
 'missing ledger evidence':d=>d.current.records[0].researchStatus.itemCoverage.advertised_prices.evidenceIds=[],
 'invalid source checksum':d=>d.packet.sources[0].sha256='unverified'
};
for(const [name,mutate] of Object.entries(mutations))test('rejects '+name,()=>{const d=fixture();mutate(d);assert.throws(()=>verifyRegionalQuotePromotions(d));});
