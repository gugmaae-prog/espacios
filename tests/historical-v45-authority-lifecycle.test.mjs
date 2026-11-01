import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';

const read=(path)=>JSON.parse(fs.readFileSync(path));
const unpack=(path)=>JSON.parse(gunzipSync(fs.readFileSync(path)));
const snapshot=unpack('data/historical-intelligence/objects/1c17824d39f4399e1fb1088bb52c2a0e761cb2e935286c617e25c883b4afa2c0.json.gz');
const packet=read('data/historical-intelligence/dld-lifecycle-pass45-20261013.json');
const before=unpack('data/historical-intelligence/objects/b87232342eabc47776b97277cc7cc8a63dc59846264eb406e816ff2c97bcab4d.json.gz');

test('V45 appends only reviewed authority lifecycle facts to eight verified project identities',()=>{
  assert.equal(snapshot.version,'20261013-enrichment-v45');
  assert.equal(snapshot.asOf,'2026-10-13');
  assert.equal(packet.publicationStatus,'prepared_not_integrated');
  assert.equal(packet.financialObservationsAdded,0);
  assert.equal(packet.sources.length,0);
  assert.equal(packet.facts.length,31);
  assert.equal(new Set(packet.facts.map((fact)=>fact.recordId)).size,8);
  assert.deepEqual(snapshot.sources,before.sources);
  assert.deepEqual(snapshot.events,before.events);
  assert.deepEqual(snapshot.exposures,before.exposures);
  assert.equal(snapshot.manifest.historicalObservationRows,633891);
  assert.equal(snapshot.manifest.historicalSeriesCount,16872);

  const oldRecords=new Map(before.records.map((record)=>[record.id,record]));
  const changed=new Set(packet.facts.map((fact)=>fact.recordId));
  for(const record of snapshot.records){
    const prior=oldRecords.get(record.id);
    assert.ok(prior,record.id);
    for(const key of ['currentSnapshot','scenarioInputs','scenarioCoverage','observations'])assert.deepEqual(record[key],prior[key],`${record.id}:${key}`);
    if(!changed.has(record.id)){
      assert.deepEqual(record.lifecycle,prior.lifecycle,`${record.id}:lifecycle`);
      continue;
    }
    assert.deepEqual(record.lifecycle.slice(0,prior.lifecycle.length),prior.lifecycle,`${record.id}:lifecycle prefix`);
    const additions=record.lifecycle.slice(prior.lifecycle.length);
    const expected=packet.facts.filter((fact)=>fact.recordId===record.id);
    assert.equal(additions.length,expected.length,record.id);
    assert.deepEqual(additions.map((item)=>item.id).sort(),expected.map((fact)=>fact.id).sort(),record.id);
    assert.ok(additions.every((item)=>item.scope==='subject'&&item.primaryEvidence&&item.identityVerified),record.id);
    assert.ok(additions.every((item)=>!['actual_completion','occupancy','delivery'].includes(item.kind)),record.id);
  }
});

test('V45 retains planned, filed and reported meanings without inventing future outcomes',()=>{
  const facts=new Map(packet.facts.map((fact)=>[fact.id,fact]));
  const retained=snapshot.records.flatMap((record)=>record.lifecycle).filter((item)=>facts.has(item.id));
  assert.equal(retained.length,31);
  assert.equal(retained.filter((item)=>item.kind==='construction_progress').length,7);
  assert.equal(retained.filter((item)=>item.kind==='construction_progress'&&item.progressPercent===0).length,4);
  assert.equal(retained.filter((item)=>item.kind==='target_completion'&&item.eventStatus==='planned').length,8);
  assert.equal(retained.filter((item)=>item.kind==='filed_project_start'&&item.eventStatus==='planned').length,1);
  const future=retained.filter((item)=>item.date.start>'2026-10-13');
  assert.equal(future.length,8);
  assert.ok(future.every((item)=>item.eventStatus==='planned'));
  assert.ok(packet.excluded.some((item)=>item.reason.toLowerCase().includes('future-dated inspection')));
});
