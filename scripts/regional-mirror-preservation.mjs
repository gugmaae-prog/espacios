/** V47 advertisements can resolve old mirror-only gaps without erasing mirrors.
 * Exact reviewed subjects/amounts are independent of the generated ledger. */
import assert from 'node:assert/strict';

export const REVIEWED_QUOTES = Object.freeze({
 'project:apartments-and-duplexes-in-aquamarine-beach-residences-on-sobha-siniya-island':1530000,
 'project:pearlside-marina-residences-siniya-island-uaq':1400000,
 'project:canalside-by-sobha-siniya-island':1360000,
 'project:coastline-beach-residences-sobha-realty-sobha-siniya-island':1860000,
 'project:apartments-and-duplexes-in-coraline-beach-residences-on-sobha-siniya-island':2400000,
 'project:selene-beach-residences-by-sobha-realty':1590000,
 'project:palm-groove-villas-by-sobha-realty-on-sobha-siniya-island':11530000,
 'project:coral-beach-villas-by-sobha-realty-on-sobha-siniya-island':16990000,
 'project:sobha-aquamont-apartments-umm-al-quwain':1110000,
 'project:oceana-by-reportage-fujairah-uae':530000,
 'project:marlin-ii-reportage-al-reem-island-abu-dhabi':1600000,
 'adrec:609':4000000,'adrec:617':2457300,'adrec:615':1900000
});
const sorted = values => [...values].sort();
function indexed(rows) {
 const index = new Map(rows.map(row => [row.id,row]));
 assert.equal(index.size,rows.length,'Duplicate record ID');
 return index;
}
const coverage = record => record.researchStatus.itemCoverage.advertised_prices;

export function verifyRegionalQuotePromotions({baseline,current,legacy,packet}) {
 assert.equal(baseline.version,'20261013-enrichment-v46');
 assert.equal(current.version,'20261014-enrichment-v47');
 const before=indexed(baseline.records),after=indexed(current.records),old=indexed(legacy.records);
 assert.deepEqual(sorted(after.keys()),sorted(before.keys()),'Lost or added catalogue IDs');
 assert.deepEqual(sorted(old.keys()),sorted(before.keys()),'Legacy catalogue differs');
 const facts=packet.facts.filter(f=>f.kind==='financial');
 assert.equal(facts.length,14,'Exactly fourteen reviewed advertisements, not transactions');
 const expected=Object.keys(REVIEWED_QUOTES);
 assert.deepEqual(sorted(facts.map(f=>f.recordId)),sorted(expected),'Unexpected subject or identity fan-out');
 const byRecord=new Map(facts.map(f=>[f.recordId,f]));
 const sources=new Map(packet.sources.map(s=>[s.id,s]));
 const promoted=[],restoredLegacyIds=[];
 let partial=0,missing=0;
 for(const [id,prior] of before) {
  const now=after.get(id),fact=byRecord.get(id),a=coverage(prior),b=coverage(now);
  assert.deepEqual(now.observations.slice(0,prior.observations.length),prior.observations,id+': prior observations changed');
  if(!fact) {
   assert.deepEqual(b,a,id+': unreviewed advertised-price coverage changed');
   continue;
  }
  const expectedBefore=id.startsWith('adrec:')?'missing':'partial';
  assert.equal(a.status,expectedBefore,id+': baseline changed');
  assert.equal(b.status,'present',id+': reviewed quote did not close its own requirement');
  const observation=now.observations.find(o=>o.id===fact.id);
  assert.ok(observation,id+': new observation missing');
  for(const value of [fact,observation]) {
   assert.equal(value.scope,'subject');assert.equal(value.identityVerified,true);
   assert.equal(value.primaryEvidence,true);assert.equal(value.evidenceClass,'advertised_asking_price');
   assert.ok(value.identitySourceIds.length>0);
  }
  assert.equal(fact.status,'accepted');
  assert.equal(observation.recordId,id);
  assert.equal(observation.observationKind,'asking_quote');
  assert.equal(observation.value,REVIEWED_QUOTES[id]);
  assert.equal(fact.observation.value,REVIEWED_QUOTES[id]);
  assert.equal(observation.unit,'AED');assert.equal(observation.currency,'AED');
  assert.equal(observation.currentSnapshotEligible,false);
  assert.equal(observation.includeInCurrentSnapshot,false);
  assert.ok(!observation.transactionId);
  const source=sources.get(fact.sourceIds[0]);assert.ok(source,'Missing reviewed source');
  assert.equal(source.httpStatus,200);assert.match(source.sha256,/^[a-f0-9]{64}$/);
  assert.equal(source.rawBodyRedistributed,false);assert.equal(source.reuseStatus,'normalized_metadata_only');
  assert.equal(source.firstAvailableAt,source.retrievedAt);
  assert.equal(observation.firstAvailableAt,source.retrievedAt);
  assert.equal(observation.period,source.retrievedAt.slice(0,10));
  assert.ok(b.evidenceIds.includes(fact.id),id+': ledger lacks exact observation');
  assert.equal(b.contextualQuoteCount,a.contextualQuoteCount,id+': contextual quotes disappeared');
  assert.equal(b.catalogueMirrorQuoteCount,a.catalogueMirrorQuoteCount,id+': mirror quotes disappeared');
  assert.deepEqual(now.currentSnapshot,prior.currentSnapshot,id+': headline quote changed');
  promoted.push(id);if(a.status==='partial')partial++;else missing++;
  if(coverage(old.get(id)).status==='present'&&a.status==='partial')restoredLegacyIds.push(id);
 }
 assert.deepEqual(sorted(promoted),sorted(expected));
 assert.equal(partial,11);assert.equal(missing,3);
 const corrections = map => new Set([...map].filter(([id,r])=>coverage(old.get(id)).status==='present'&&coverage(r).status==='partial').map(([id])=>id));
 const oldCorrections=corrections(before),newCorrections=corrections(after);
 assert.deepEqual(sorted([...newCorrections,...restoredLegacyIds]),sorted(oldCorrections),'Every legacy demotion must remain or have its own reviewed quote');
 return {promoted:sorted(promoted),fromPartial:partial,fromMissing:missing,restoredLegacyIds:sorted(restoredLegacyIds)};
}
