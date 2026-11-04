import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const script=`import importlib.util,json,sys
spec=importlib.util.spec_from_file_location('parser','scripts/extract-rak-construction-panels.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
print(json.dumps(m.extract(sys.stdin.read())))`;
const parse=html=>{const r=spawnSync('python3',['-c',script],{input:html,encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);return JSON.parse(r.stdout);};
const tab=(id,label)=>`<a role="tab" id="${id}-tab" data-bs-target="#${id}">${label}</a>`;
const stat=(label,value)=>`<div class="stat-block"><div class="sb-title"><h3>${label}</h3><h3>${value}%</h3></div></div>`;
const panel=(id,stats)=>`<div id="${id}" role="tabpanel">${stats}</div>`;
test('month tabs follow explicit IDs, preserve phases, zero, decreases and component separation',()=>{
 const html=tab('v','July 2026 - Villas')+tab('a','June 2026 - Residences')+panel('a',stat('Enabling',100)+stat('Overall',0.1))+panel('v',stat('Enabling',100)+stat('Total',0));
 const rows=parse(html);assert.deepEqual(rows.map(r=>[r.period,r.phaseLabel,r.overallPercent]),[['2026-07','Villas',0],['2026-06','Residences',0.1]]);
 assert.equal(rows[0].components.Enabling,100);assert.equal(rows[0].panelId,'v');assert.equal(rows[1].panelId,'a');
});
test('ambiguous panel mapping and malformed percentages fail instead of silently assigning dates',()=>{
 assert.throws(()=>parse(tab('a','June 2026')+panel('a',stat('Overall',20))+panel('a',stat('Overall',30))),/ambiguous tab panel/);
 assert.throws(()=>parse(tab('missing','June 2026')),/Missing or ambiguous/);
 assert.throws(()=>parse(tab('a','June 2026')+panel('a',stat('Overall',''))),/Unrecognized progress/);
 assert.throws(()=>parse(tab('a','June 2026')+panel('a',stat('Enabling',100))),/Components without overall/);
 assert.throws(()=>parse(tab('a','June 2026')+panel('a',stat('Overall',101))),/Out-of-range/);
});
test('undated or year-only tabs cannot invent an observation month',()=>{
 assert.deepEqual(parse(tab('a','Latest')+panel('a',stat('Overall',20))),[]);
 assert.deepEqual(parse(tab('a','2026')+panel('a',stat('Overall',20))),[]);
});
