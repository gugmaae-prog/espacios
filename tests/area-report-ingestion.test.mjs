import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const packetPath='enrichment/area-reports-20261006/packet.json';

test('area-report packet keeps every printed row out of project transactions and headline prices', ()=>{
 const code=String.raw`
import json, pathlib, sys
sys.path.insert(0,'scripts')
from historical_enrichment import current_snapshot_eligible
from extract_dxb_area_reports import extract_pdf
from build_area_report_packet import FILES, UPLOADS, row_hash, canonical_sale
packet=json.loads(pathlib.Path('enrichment/area-reports-20261006/packet.json').read_text())
assert packet['status']=='reviewed_packet_not_integrated_or_published'
assert packet['snapshotIntegration']['wiredIntoSnapshotBuild'] is False
assert len(packet['sources'])==15
assert len(packet['documents'])==15
assert [source['localFilename'] for source in packet['sources']]==FILES
names=set()
rows_total=0
for filename in FILES:
    document=next(item for item in packet['documents'] if item['localFilename']==filename)
    body=json.loads(pathlib.Path(document['extractPath']).read_text())
    assert document['sourceId'] not in names
    names.add(document['sourceId'])
    assert body['sourceId']==document['sourceId']
    assert len(body['rows'])==document['saleRowCount']
    assert len(body['summaryMetrics'])==4
    assert row_hash(body['rows'])==document['saleRowSha256']
    rows_total += len(body['rows'])
    yield_metric=next(metric for metric in body['summaryMetrics'] if metric['metric']=='rental_yield_percent')
    count_metric=next(metric for metric in body['summaryMetrics'] if metric['metric']=='transaction_count')
    assert yield_metric['yoyStated'] is False and yield_metric['yoyPercent'] is None
    if count_metric['yoyPercent'] not in (None, 0):
        assert yield_metric['yoyPercent']!=count_metric['yoyPercent']
    assert document['identity']['ledgerCommunityId'] is None or document['identity']['ledgerCommunityId'].startswith('community:')
    assert document['identity']['ledgerAttachment'] in ('exact_full_title','not_attached')
    for row in body['rows']:
        assert row['scope']=='area_report_printed_sale'
        assert row['subjectTransaction'] is False
        assert row['currentSnapshotEligible'] is False
        assert row['projectIdentity']['subjectTransaction'] is False
        if str(row['projectIdentity'].get('catalogueProjectId') or '').startswith('project:'):
            assert row['projectIdentity']['status']=='exact_project_name'
        else:
            assert row['projectIdentity']['status']!='exact_project_name'
        if row['locationTruncated']:
            assert row['projectIdentity']['catalogueProjectId'] is None
            assert row['projectIdentity']['status']=='truncated_printed_name'
        qualifier=row['bedroomsPrinted'] or 'unit-specific sale'
        blocked={'value':row['priceAed'],'unit':'AED','metric':'price','observationKind':'asking_quote','bedrooms':row['bedroomsPrinted'] or '','quoteQualifier':qualifier}
        assert current_snapshot_eligible(blocked) is False
        assert current_snapshot_eligible({**blocked,'currentSnapshotEligible':False,'bedrooms':'','quoteQualifier':''}) is False
assert rows_total==sum(item['saleRowCount'] for item in packet['documents'])==4447
by_title={item['title']:item for item in packet['documents']}
jvc=by_title['Jumeirah Village Circle (JVC)']
assert jvc['identity']['ledgerCommunityId']=='community:Dubai:jumeirah-village-circle-jvc'
similar={item['id'] for item in jvc['identity']['similarNamesNotAttached']}
assert 'community:Dubai:jvc' in similar
assert 'community:Dubai:jumeirah-village-circle' in similar
assert by_title['Jebel Ali']['identity']['ledgerCommunityId']=='community:Dubai:jebel-ali'
jebel_similar={item['id'] for item in by_title['Jebel Ali']['identity']['similarNamesNotAttached']}
assert 'community:Dubai:jebel-ali-village' in jebel_similar
assert 'community:Dubai:downtown-jebel-ali' in jebel_similar
assert 'community:Dubai:palm-jebel-ali' in jebel_similar
damac=by_title['Damac Hills, Al Hebiah Third']
assert damac['identity']['ledgerCommunityId'] is None
longer={item['id'] for component in damac['identity']['titleComponents'] for item in component['longerCommunityNamesNotAttached']}
assert 'community:Dubai:damac-hills-2' in longer
sobha=by_title['Sobha Hartland, Al Merkadh']
assert 'community:Dubai:sobha-hartland-ii' in {item['id'] for component in sobha['identity']['titleComponents'] for item in component['longerCommunityNamesNotAttached']}
assert sobha['identity']['ledgerCommunityId'] is None
assert 'Phase 1' in sobha['phaseLabelsPrinted'] and 'Phase 2' in sobha['phaseLabelsPrinted'] and 'Phase 3' in sobha['phaseLabelsPrinted']
town=by_title['Town Square, Al Yelayiss 2']
assert town['identity']['ledgerCommunityId'] is None
assert any(item['id']=='community:Dubai:town-square-dubai' for component in town['identity']['titleComponents'] for item in component['nearCommunityMatches'])
arancia=by_title['Arancia Yards By Beyond (All Buildings), City of Arabia']
assert arancia['saleRowCount']==247
assert arancia['summaryTransactionCount']==247
assert arancia['exactProjectSaleCount']==0
assert any(item['id']=='project:arancia-yards-beyond-city-of-arabia-dubai' for component in arancia['identity']['titleComponents'] for item in component['shorterProjectNamesNotAttached'])
assert all(hit['catalogueProjectId']!='project:arancia-yards-beyond-city-of-arabia-dubai' and hit['subjectTransaction'] is False for hit in packet['exactProjectSales'])
beach=by_title['Emaar Beachfront, Dubai Harbour']
assert beach['identity']['ledgerCommunityId'] is None
assert {item['id'] for component in beach['identity']['titleComponents'] for item in component['exactCommunityMatches']}=={'community:Dubai:emaar-beachfront','community:Dubai:dubai-harbour'}
oasis=by_title['The Oasis (All Phases), Me\'Aisem Second']
assert oasis['identity']['ledgerCommunityId'] is None
assert any(item['id']=='community:Dubai:the-oasis' for component in oasis['identity']['titleComponents'] for item in component['nearCommunityMatches'])
downtown=json.loads(pathlib.Path(by_title['Downtown Dubai']['extractPath']).read_text())
building=[row for row in downtown['rows'] if row['priceAed']==725000000]
assert len(building)==1 and building[0]['propertyType']=='Building' and building[0]['subjectTransaction'] is False
assert by_title['Downtown Dubai']['saleRowCount']==300
assert by_title['Downtown Dubai']['summaryTransactionCount']==2861
business=json.loads(pathlib.Path(by_title['Business Bay']['extractPath']).read_text())
assert any(row['propertyType']=='Office' and row['propertyTypeRecovery']=='text_layer_null_is_fi_ligature_office' for row in business['rows'])
bay=by_title['Business Bay']
assert next(metric['yoyPercent'] for metric in bay['summaryMetrics'] if metric['metric']=='transaction_count')==-40
assert next(metric['yoyPercent'] for metric in bay['summaryMetrics'] if metric['metric']=='rental_yield_percent') is None
for name in ('scripts/build-historical-data.py','scripts/historical_enrichment.py'):
    assert 'area-reports-20261006' not in pathlib.Path(name).read_text()
missing=[name for name in FILES if not (UPLOADS/name).exists()]
if missing:
    raise SystemExit('PDFs missing; packet consistency passed but source recount did not run: '+', '.join(missing))
for filename in FILES:
    extracted=extract_pdf(str(UPLOADS/filename))
    document=next(item for item in packet['documents'] if item['localFilename']==filename)
    body=json.loads(pathlib.Path(document['extractPath']).read_text())
    assert extracted['unparsedTextLines']==[]
    assert len(extracted['rows'])==len(body['rows'])==document['saleRowCount']
    assert row_hash(extracted['rows'])==document['saleRowSha256']
    assert [canonical_sale(row) for row in extracted['rows']]==[canonical_sale(row) for row in body['rows']]
    assert extracted['summaryMetrics']==body['summaryMetrics']
print(json.dumps({'documents':15,'rows':rows_total,'exactProjectSales':len(packet['exactProjectSales']),'recountedFromPdfs':True}))
`;
 const out=spawnSync('python3',['-c',code],{encoding:'utf8',maxBuffer:20*1024*1024});
 assert.equal(out.status,0,out.stderr||out.stdout);
 const summary=JSON.parse(out.stdout.trim().split('\n').at(-1));
 assert.equal(summary.documents,15);
 assert.equal(summary.rows,4447);
 assert.equal(summary.recountedFromPdfs,true);
});

test('area-report analysis and source records cover all fifteen files', async()=>{
 const packet=JSON.parse(await fs.readFile(packetPath,'utf8'));
 const analysis=await fs.readFile('enrichment/area-reports-20261006/ANALYSIS.md','utf8');
 assert.equal(packet.sources.length,15);
 for(const source of packet.sources){
  assert.equal(source.publisher,'DXB Interact');
  assert.equal(source.retrievedAt,'2026-10-06');
  assert.equal(source.publishedAt,null);
  assert.equal(source.url,'https://dxbinteract.com/');
  assert.match(source.bodyProvenance,/user-supplied/);
  assert.ok(analysis.includes(source.localFilename),source.localFilename);
 }
 assert.match(analysis,/not part of the V9 snapshot/);
 assert.match(analysis,/2027-2080/);
 assert.doesNotMatch(analysis,/validated forecast of/);
});
