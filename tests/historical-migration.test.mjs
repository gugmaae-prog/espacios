import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('actual candidate index preserves all records, foreign keys and immutable evidence', () => {
  const result = spawnSync('python3', ['-c', String.raw`
import gzip, json, sqlite3
from pathlib import Path
manifest = json.loads(Path('data/historical-intelligence/publication-manifest.json').read_text())
db = sqlite3.connect(':memory:')
db.executescript(Path('migrations/0001_historical_intelligence.sql').read_text())
sql = gzip.decompress(Path(manifest['d1Index']['path']).read_bytes()).decode()
db.executescript(sql)
db.executescript(sql)
assert db.execute('select count(*) from hi_records').fetchone()[0] == 1860
assert db.execute('select count(*) from hi_events').fetchone()[0] == manifest['counts']['events']
snapshot=json.loads(Path('data/historical-intelligence-20261003.json').read_text())
assert db.execute('select count(*) from hi_record_series').fetchone()[0] == sum(len(r['historySeries']) for r in snapshot['records'])
assert db.execute('pragma foreign_key_check').fetchall() == []
def rejected(statement):
    try:
        db.execute(statement)
    except sqlite3.IntegrityError:
        return
    raise AssertionError('Unexpected mutation accepted: ' + statement)
for table in ('hi_records', 'hi_sources', 'hi_events', 'hi_exposures', 'hi_series', 'hi_record_series'):
    rejected('update ' + table + ' set snapshot_version=snapshot_version')
    rejected('delete from ' + table)
rejected('delete from hi_snapshots')
rejected("update hi_snapshots set root_sha256='tampered'")
db.execute("update hi_snapshots set publication_state='complete'")
rejected("update hi_snapshots set publication_state='staged'")
rejected("insert into hi_records values ('absent', 'orphan', 'project', 'Orphan', 'Dubai', '{}')")
assert db.execute('select count(*) from hi_records').fetchone()[0] == 1860
print(json.dumps({'records':1860, 'foreignKeyViolations':0, 'immutable':True}))
`], {encoding:'utf8', maxBuffer: 1024 * 1024});
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(JSON.parse(result.stdout).immutable, true);
});

test('legacy candidate scope upgrade preserves links, foreign keys and immutability',()=>{
 const result=spawnSync('python3',['-c',String.raw`
import sqlite3
from pathlib import Path
db=sqlite3.connect(':memory:')
schema=Path('migrations/0001_historical_intelligence.sql').read_text().replace(",'community_context','published_reference'",'')
db.executescript(schema)
db.execute("insert into hi_snapshots values ('v','2026-10-05',1,'{}','hash','staged')")
db.execute("insert into hi_records values ('v','p','project','P','Dubai','{}')")
db.execute("insert into hi_sources values ('v','s','https://example.org','{}')")
db.execute("insert into hi_series values ('v','h','s','{}')")
db.execute("insert into hi_record_series values ('v','p','h','area_context',0)")
db.executescript(Path('migrations/0002_historical_context_scopes.sql').read_text())
assert db.execute('select count(*) from hi_record_series').fetchone()[0]==1
db.execute("insert into hi_series values ('v','new','s','{}')")
db.execute("insert into hi_record_series values ('v','p','new','community_context',0)")
assert not db.execute('pragma foreign_key_check').fetchall()
for statement in ['delete from hi_record_series','update hi_record_series set identity_verified=1']:
 try:db.execute(statement);raise AssertionError('immutability lost')
 except sqlite3.IntegrityError:pass
`],{encoding:'utf8'});assert.equal(result.status,0,result.stderr||result.stdout);
});
