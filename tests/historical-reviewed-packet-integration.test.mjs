import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

test('reviewed packets add sources and facts without rewriting saved source captures',()=>{
 const code=String.raw`
import json, sys
sys.path.insert(0,'scripts')
from historical_enrichment import merge_reviewed_packets
base=json.load(open('data/historical-intelligence/scrape-enrichment.json'))
seed={'schemaVersion':1,'asOf':'2026-10-05','sources':base['sources'],'facts':base['facts'],'seriesLinks':base['seriesLinks'],'recordResearch':base['recordResearch'],'historyInputs':[],'licensedArchives':[],'additionalDatasets':[],'sourceCandidates':[],'collection':{'passes':[]}}
before={s['id']:json.dumps(s,sort_keys=True) for s in seed['sources']}
merged=merge_reviewed_packets(seed,'2026-10-06')
after={s['id']:json.dumps(s,sort_keys=True) for s in merged['sources']}
assert len(merged['sources'])==len(before)+11
assert all(after[i]==v for i,v in before.items())
new_facts=[f for f in merged['facts'] if str(f.get('id','')).startswith(('v10-','v11-'))]
assert len(new_facts)==28
handover=next(f for f in new_facts if f['id']=='v11-kaya-phase-handover')
assert handover['sourceId']=='project-nondubai-pass3-b1c5c5cfa2d20e1f'
quote=next(f for f in new_facts if f['id']=='v10-trussardi-2br-asking')
assert quote['observation']['currentSnapshotEligible'] is False
assert quote['observation']['bedrooms']=='2'
avenue=next(r for r in merged['recordResearch'] if r['recordId']=='project:apartments-and-duplexes-avenue-park-towers-wasl-1-dubai')
assert avenue['status']=='no_attached_external_source_url / fetched_html'
assert any(p.get('collectionPass')=='v10-primary-pass21' for p in avenue['collectionPasses'])
try:
 merge_reviewed_packets(merged,'2026-10-06')
 raise AssertionError('second merge must fail closed')
except ValueError as exc:
 assert 'collision' in str(exc)
`;
 const out=spawnSync('python3',['-c',code],{encoding:'utf8'});
 assert.equal(out.status,0,out.stderr||out.stdout);
});

test('integrated snapshot keeps headline prices and moves only sourced checklist items',async()=>{
 const data=JSON.parse(await fs.readFile('data/historical-intelligence-20261003.json','utf8'));
 assert.equal(data.version,'20261006-enrichment-v11');
 assert.equal(data.asOf,'2026-10-06');
 assert.equal(data.records.length,1860);
 assert.equal(data.manifest.historicalObservationRows,316608);
 assert.equal(data.manifest.approved2080ForecastRecords,0);
 assert.equal(data.events.length,105);
 assert.equal(data.sources.length,2871);
 assert.equal(data.events.every(event=>event.priceUpliftPct==null),true);
 const counts={};
 for(const record of data.records)for(const item of Object.values(record.researchStatus.itemCoverage))counts[item.status]=(counts[item.status]||0)+1;
 assert.deepEqual(counts,{present:3666,partial:2153,missing:27661,unestablished:9300});
 const by=Object.fromEntries(data.records.map(record=>[record.id,record]));
 const expect={
  'project:apartments-and-duplexes-avenue-park-towers-wasl-1-dubai':{original_launch:'present',announcement_registration:'present',construction:'missing',asking:9200000,observationId:'fact-3a4a6ad347563c76a4621ef8'},
  'project:woodland-crest-amis-meydan-dubai':{original_launch:'present',announcement_registration:'present',construction:'missing',asking:1400000,observationId:'fact-be646c7411b334f112d1a57a'},
  'project:regent-residences-dubai-sankari-place':{original_launch:'present',announcement_registration:'present',construction:'missing',asking:39000000,observationId:'fact-14a0a7f5819b99981f445c1e'},
  'project:trussardi-residences-by-luxury-living-group-and-mira-developments':{original_launch:'present',announcement_registration:'present',construction:'present',asking:1400000,observationId:'fact-83ce7284f3d8131bc2728873'},
  'project:derby-heights-amis-meydan-dubai':{original_launch:'present',announcement_registration:'present',construction:'missing',asking:1200000,observationId:'fact-a9cfa8d8c357d988b406366a'},
  'project:apartments-elemental-22-jumeirah-garden-city-dubai':{original_launch:'missing',announcement_registration:'missing',construction:'missing',asking:1700000,observationId:'fact-de7f1055eb9e0f33470c1630'},
  'project:arada-masaar-kaya-villas-and-townhouses-for-sale-in-sharjah':{original_launch:'present',announcement_registration:'present',construction:'present',asking:1300000,observationId:'fact-4262361aacc8510502c21a12'},
  'project:arada-masaar-robinia-villas-and-townhouses-in-sharjah-for-sale-uae':{original_launch:'present',announcement_registration:'present',construction:'present',asking:1400000,observationId:'fact-702cd4a5ae5cc9b155618be4'},
  'project:arada-vida-residences-aljada-sharjah-for-sale-in-uae':{original_launch:'present',announcement_registration:'present',construction:'missing',asking:1320000,observationId:'fact-7dbf6c64abc2aa678faf6e5a'}
 };
 for(const [id,expected] of Object.entries(expect)){
  const record=by[id];
  const coverage=record.researchStatus.itemCoverage;
  assert.equal(coverage.original_launch.status,expected.original_launch,id);
  assert.equal(coverage.announcement_registration.status,expected.announcement_registration,id);
  assert.equal(coverage.construction.status,expected.construction,id);
  assert.equal(coverage.validated_price_forecast.status,'unestablished',id);
  assert.equal(record.currentSnapshot.askingPriceAED,expected.asking,id);
  assert.equal(record.currentSnapshot.observationId,expected.observationId,id);
  assert.equal(record.scenarioCoverage.approvedAnnualPoints,0,id);
 }
 const trussardi=by['project:trussardi-residences-by-luxury-living-group-and-mira-developments'];
 const quote=trussardi.observations.find(row=>row.id==='v10-trussardi-2br-asking');
 assert.equal(quote.value,3500000);
 assert.equal(quote.bedrooms,'2');
 assert.equal(quote.currentSnapshotEligible,false);
 assert.notEqual(trussardi.currentSnapshot.observationId,'v10-trussardi-2br-asking');
 const kaya=by['project:arada-masaar-kaya-villas-and-townhouses-for-sale-in-sharjah'];
 assert.equal(kaya.researchStatus.itemCoverage.phase_milestones.status,'present');
 assert.equal(kaya.researchStatus.itemCoverage.actual_completion.status,'present');
 const vida=by['project:arada-vida-residences-aljada-sharjah-for-sale-in-uae'];
 assert.equal(vida.researchStatus.itemCoverage.delivery_reports.status,'present');
 assert.equal(data.sources.some(source=>source.id==='v11-src-arada-kaya-robinia-handover'),false);
 assert.equal(data.sources.some(source=>source.id==='v11-src-arada-vida-completion'),false);
 assert.equal(data.sources.some(source=>source.id==='v10-src-wasl-avenue-park'),true);
});
