import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {validateObservation,filterTrainingFold} from '../src/historical-intelligence/core.mjs';
const read=p=>JSON.parse(fs.readFileSync(p)),unpack=p=>JSON.parse(gunzipSync(fs.readFileSync(p)));
const snapshot=read('data/historical-intelligence-20261003.json'),publication=read('data/historical-intelligence/publication-manifest.json'),packet=read('data/historical-intelligence/dld-asora-pass38-20261008.json');
const before=unpack('data/historical-intelligence/objects/be31d7f61e60b822c9fc005051f958613d2cd2db0c830b69fb1366e9a3dacf75.json.gz'),after=unpack('data/historical-intelligence/objects/01b716e001347142944eda86c5c649f4a2e05b47be05df70f8302db4450d09fd.json.gz');
const rid='project:jumeirah-asora-bay-by-meraas-in-la-mer-dubai',record=snapshot.records.find(r=>r.id===rid);
test('V38 adds exactly 30 individual sales to one current project and preserves all earlier evidence',()=>{
 assert.ok(['20261008-enrichment-v38','20261009-enrichment-v39'].includes(snapshot.version));assert.equal(publication.version,snapshot.version);
 assert.equal(snapshot.records.length,1860);assert.equal(packet.facts.length,30);assert.equal(packet.sources.length,2);
 assert.equal(publication.counts.sources,snapshot.version==='20261009-enrichment-v39'?3348:3345);assert.equal(publication.counts.historicalRows,633891);assert.equal(publication.counts.series,16872);
 assert.deepEqual(snapshot.sources.slice(0,before.sources.length),before.sources);
 assert.deepEqual(snapshot.events,before.events);assert.deepEqual(snapshot.exposures,before.exposures);
 const oldRecords=new Map(before.records.map(r=>[r.id,r]));
 for(const r of after.records){const old=oldRecords.get(r.id);assert.ok(old);
  if(r.id!==rid){assert.deepEqual(r,old,r.id);continue;}
  for(const k of ['currentSnapshot','priorCurrentSnapshots','scenarioInputs','scenarioCoverage','historySeriesIds','communityId','lifecycle'])assert.deepEqual(r[k],old[k],k);
  assert.deepEqual(r.observations.slice(0,old.observations.length),old.observations);
  for(const k of Object.keys(old.researchStatus.itemCoverage))if(k!=='registered_sale_history')assert.deepEqual(r.researchStatus.itemCoverage[k],old.researchStatus.itemCoverage[k],k);
 }
 const native=root=>{const result=new Map();for(const key of new Set(root.series.map(s=>s.partition.key))){for(const s of unpack('data/historical-intelligence/objects/'+key.split('/').at(-1)).series)result.set(s.id,createHash('sha256').update(JSON.stringify(s)).digest('hex'));}return result;};
 assert.deepEqual(native(after),native(before));
});
test('stable developer keys retain both dated names; archive, hotel and Ocean Mansions receive no fan-out',()=>{
 const proof=packet.recordIdentityChecks[0];assert.deepEqual(proof.registeredDeveloperLabels.map(x=>x.developerId),[452208509,452208509]);
 assert.deepEqual(proof.registeredDeveloperLabels.map(x=>x.developerNumber),[1510,1510]);
 assert.equal(proof.registeredDeveloperLabels[0].label,'مراس العقارية (ش.ذ.م.م)');assert.equal(proof.registeredDeveloperLabels[1].label,'DHRE 2 BTS L.L.C');
 assert.match(proof.basis,/no legal rename date/);assert.equal(record.researchStatus.identityCandidateCount,0);
 assert.equal(record.researchStatus.itemCoverage.registered_sale_history.status,'present');
 assert.equal(record.researchStatus.itemCoverage.complete_registered_sale_history.status,'unestablished');
 assert.equal(snapshot.manifest.directSubjectSaleHistoryRecords,372);assert.equal(snapshot.manifest.identityCandidateProjects,246);
 assert.equal(snapshot.manifest.approved2080ForecastRecords,0);
 assert.deepEqual([...new Set(packet.facts.map(f=>f.recordId))],[rid]);
 for(const candidate of packet.excludedCandidates){assert.notEqual(candidate.recordId,rid);assert.equal(snapshot.records.find(r=>r.id===candidate.recordId).researchStatus.itemCoverage.registered_sale_history.status,'missing');}
});
test('sparse individual transactions remain visible with reconciled units and no pre-publication training access',()=>{
 const observations=record.observations.filter(o=>o.evidenceClass==='registered_sale_transaction_primary_dld');assert.equal(observations.length,30);
 assert.equal(new Set(observations.map(o=>o.transactionId)).size,30);
 assert.equal(record.coverageSummary.directSaleTransactionCount,30);
 assert.equal(observations[0].period,'2025-05-07');assert.equal(observations.at(-1).period,'2026-08-05');
 for(const o of observations){assert.match(o.transactionId,/^dld-sha256:[a-f0-9]{64}$/);assert.equal(o.sourceObservationId,o.transactionId);
  assert.equal(o.sampleCount,1);assert.equal(o.observationKind,'transaction');assert.equal(o.transactionKind,'sale');
  assert.equal(o.value,o.priceAED/o.areaSqm/10.763910416709722);assert.equal(o.sourceProjectNumber,3445);assert.equal(o.sourceBuildingName,'Jumeirah Residences Asora Bay');
  assert.equal(o.currentSnapshotEligible,false);assert.equal(o.publishedAt,null);
  const v=validateObservation(o,record,{asOf:snapshot.asOf,sources:snapshot.sources});assert.equal(v.valid,true);assert.equal(v.direct,true);assert.equal(v.displayEligible,true);
 }
 assert.equal(filterTrainingFold(observations,{asOf:'2026-10-07',sources:snapshot.sources}).retained.length,0);
 assert.equal(packet.collection.newAggregateMedians,0);
});
test('ingestion rejects duplicate ownership, synthetic prices, malformed days and transaction relabelling',()=>{
 const py=String.raw`
import sys,json,copy
sys.path.insert(0,'scripts')
from historical_enrichment import apply_enrichment
s=json.load(open('data/historical-intelligence-20261003.json'));p=json.load(open('data/historical-intelligence/dld-asora-pass38-20261008.json'))
sources={x['id']:x for x in s['sources']};base=copy.deepcopy(next(r for r in s['records'] if r['id']==p['facts'][0]['recordId']));base['observations']=[]
def run(f, records=None):
 return apply_enrichment({'asOf':s['asOf'],'facts':[f]},records or [copy.deepcopy(base)],{},sources,lambda x:x['id'],{},s['asOf'])
good=copy.deepcopy(p['facts'][0]);run(good)
for patch in [{'observationKind':'asking_quote'},{'transactionKind':'rent'},{'sampleCount':True},{'sampleCount':20},{'value':1},{'areaSqm':0},{'period':'2025-02-31'},{'propertyType':'Land'},{'includeInCurrentSnapshot':True},{'transactionId':'unverified'}]:
 bad=copy.deepcopy(good);bad['observation'].update(patch)
 try:run(bad)
 except ValueError:pass
 else:raise AssertionError(patch)
other=copy.deepcopy(base);other['id']='project:another-owner';other['observations']=[copy.deepcopy(good['observation'])]
try:run(good,[copy.deepcopy(base),other])
except ValueError:pass
else:raise AssertionError('Duplicate ownership accepted')
print('DLD transaction ingestion guards pass')
`;
 const result=spawnSync('python3',['-c',py],{encoding:'utf8'});assert.equal(result.status,0,result.stderr||result.stdout);
});
