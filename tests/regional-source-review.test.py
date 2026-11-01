"""Offline invariants; no external requests or canonical evidence mutations."""
from copy import deepcopy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('regional', ROOT / 'scripts/review_regional_sources.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
PLAN = json.loads((ROOT / 'data/historical-intelligence/research-candidates/regional-primary-20261014-v2.json').read_text())


def fixture():
    targets = sorted({i for s in PLAN['sources'] for i in s['reviewAgainstIds']})
    projects = [i for i in targets if not i.startswith('community:')]
    communities = [i for i in targets if i.startswith('community:')]
    return ([{'id': i, 'type': 'project', 'emirate': 'Test'} for i in projects + [f'fixture-project:{n}' for n in range(1645-len(projects))]] +
            [{'id': i, 'type': 'community', 'emirate': 'Test'} for i in communities + [f'fixture-community:{n}' for n in range(215-len(communities))]])


class ReviewTests(unittest.TestCase):
    def setUp(self):
        self.plan, self.rows = deepcopy(PLAN), fixture()
        self.source = deepcopy(self.plan['sources'][0])
        self.source['expectedNeedles'] = ['BAYN', 'Ghantoot']
        self.calls = []

    def collector(self, robots=(404, {'content-type': 'text/plain'}, b''), page=None):
        page = page or (200, {'Content-Type': 'text/html'}, b'<h1>BAYN Ghantoot</h1><script>SECRET_RAW_SCRIPT</script>')
        def transport(url):
            self.calls.append(url)
            return robots if url.endswith('/robots.txt') else page
        return m.Collector(self.plan, transport=transport, sleep=lambda _: None)

    def test_real_plan_and_fixed_catalogue(self):
        self.assertTrue(m.validate(self.plan, self.rows))
        self.assertEqual(len(self.plan['sources']), 13)
        self.assertEqual(len({i for s in self.plan['sources'] for i in s['reviewAgainstIds']}), 13)

    def test_lost_duplicate_added_or_retyped_ids_fail(self):
        for rows in (self.rows[:-1], self.rows+[self.rows[0]], self.rows[:-1]+[self.rows[0]]):
            with self.assertRaises(ValueError): m.validate(self.plan, rows)
        self.rows[0]['type'] = 'community'
        with self.assertRaises(ValueError): m.validate(self.plan, self.rows)

    def test_no_acceptance_fanout_or_unknown_id(self):
        for key, value in [('recordId', 'adrec:624'), ('identityVerified', True), ('reviewAgainstIds', ['nonexistent'])]:
            plan=deepcopy(self.plan);plan['sources'][0][key]=value
            with self.assertRaises(ValueError): m.validate(plan, self.rows)
        self.plan['acceptedFacts']=[{'recordId':'adrec:624','kind':'financial'}]
        with self.assertRaises(ValueError): m.validate(self.plan,self.rows)

    def test_distinct_source_ids_urls_and_page_limit(self):
        self.plan['sources'].append(deepcopy(self.source))
        with self.assertRaises(ValueError): m.validate(self.plan,self.rows)
        self.plan['sources'][-1]['id']='unique-id-same-url'
        with self.assertRaises(ValueError): m.validate(self.plan,self.rows)
        self.plan['sources']=self.plan['sources']*2
        with self.assertRaises(ValueError): m.validate(self.plan,self.rows)

    def test_rights_future_dates_and_quotations(self):
        for key,value in [('rawRetentionAllowed',True),('reuseStatus','raw_allowed'),('reportedPublishedAt','2027-01-01'),('expectedNeedles',['word '*26])]:
            plan=deepcopy(self.plan);plan['sources'][0][key]=value
            with self.assertRaises(ValueError): m.validate(plan,self.rows)

    def test_no_coverage_or_numeric_forecast(self):
        self.plan['numericForecasts']=[{'year':2080,'value':1}]
        with self.assertRaises(ValueError): m.validate(self.plan,self.rows)
        self.plan['numericForecasts']=[];self.plan['coverageLedgerDelta']['present']=1
        with self.assertRaises(ValueError): m.validate(self.plan,self.rows)

    def test_safe_https_allowlist(self):
        for url in ['http://ora-uae.com/x','https://127.0.0.1/x','https://ora-uae.com.evil.test/x','https://user:password@ora-uae.com/x','https://ora-uae.com:444/x','https://ora-uae.com/x#secret']:
            with self.assertRaises(ValueError): m.canonical(url,self.plan['domains'])

    def test_hash_availability_and_raw_exclusion(self):
        before=deepcopy(self.source);collector=self.collector();capture=collector.capture(self.source)
        self.assertEqual(capture['captureStatus'],'captured_metadata_only')
        self.assertEqual(capture['httpStatus'],200)
        self.assertEqual(capture['sha256'],m.sha(b'<h1>BAYN Ghantoot</h1><script>SECRET_RAW_SCRIPT</script>'))
        self.assertEqual(capture['firstAvailableAt'],capture['retrievedAt'])
        self.assertNotEqual(capture['firstAvailableAt'],capture['reportedPublishedAt'])
        self.assertTrue(all(capture['needleChecks'].values()))
        self.assertNotIn('SECRET_RAW_SCRIPT',json.dumps(capture))
        self.assertEqual(self.source,before)
        self.assertFalse(capture['evidenceAccepted'])
        self.assertIsNone(capture['observationStart'])

    def test_robots_rules_denial_and_error_fail_closed(self):
        cases=[(200,{'content-type':'text/plain'},b'User-agent: *\nDisallow: /\n'),(403,{},b''),(429,{},b''),(500,{},b''),(302,{'location':'/other'},b''),(200,{'content-type':'text/html'},b'<html>challenge</html>')]
        for robots in cases:
            self.calls=[];capture=self.collector(robots=robots).capture(self.source)
            self.assertEqual(capture['captureStatus'],'inaccessible')
            self.assertEqual(len(self.calls),1)
            self.assertIsNone(capture['httpStatus'])

    def test_stricter_crawl_delay_is_not_bypassed(self):
        robots=(200,{'content-type':'text/plain'},b'User-agent: *\nCrawl-delay: 5\n')
        capture=self.collector(robots=robots).capture(self.source)
        self.assertEqual(capture['captureStatus'],'inaccessible')
        self.assertEqual(len(self.calls),1)

    def test_clickthrough_gate_has_zero_requests(self):
        self.source['skipReason']='Click-through terms not accepted'
        collector=self.collector();capture=collector.capture(self.source)
        self.assertEqual(capture['captureStatus'],'not_requested_rights_boundary')
        self.assertEqual(collector.count,0)
        self.assertEqual(self.calls,[])

    def test_non_200_pdf_and_large_responses_are_not_used(self):
        cases=[(429,{},b'rate limited'),(403,{},b'login'),(200,{'content-type':'application/pdf'},b'%PDF'),(200,{'content-type':'text/html'},b'x'*2000001)]
        for page in cases:
            capture=self.collector(page=page).capture(self.source)
            self.assertEqual(capture['captureStatus'],'inaccessible')
            self.assertFalse(capture['evidenceAccepted'])

    def test_redirect_outside_domain_and_loops_stop(self):
        for location in ['https://private.example/x',self.source['url']]:
            capture=self.collector(page=(302,{'location':location},b'')).capture(self.source)
            self.assertEqual(capture['captureStatus'],'inaccessible')
            self.assertEqual(len(self.calls),2)
            self.calls=[]

    def test_request_budget(self):
        collector=self.collector();collector.count=40
        with self.assertRaises(ValueError): collector.request(self.source['url'])
        self.assertEqual(self.calls,[])

    def test_receipt_preserves_catalogue_no_promotion_or_raw(self):
        plan=deepcopy(self.plan);before=deepcopy(self.rows);collector=self.collector()
        captures=[collector.capture(s) for s in plan['sources']]
        receipt=m.make_receipt(plan,self.rows,captures,collector.count)
        self.assertEqual(self.rows,before)
        self.assertEqual(receipt['changedCatalogueRecords'],0)
        self.assertEqual(receipt['acceptedFacts'],[])
        self.assertEqual(receipt['numericForecasts'],[])
        self.assertEqual(receipt['coverageLedgerDelta'],{s:0 for s in m.STATES})
        self.assertNotIn('SECRET_RAW_SCRIPT',json.dumps(receipt))
        captures[0]['evidenceAccepted']=True
        with self.assertRaises(ValueError): m.make_receipt(plan,self.rows,captures,collector.count)

    def test_plan_names_phase_and_wrong_subject_quarantines(self):
        byid={s['id']:s for s in self.plan['sources']}
        self.assertEqual(len(byid['ora-bayn-master-launch']['reviewAgainstIds']),5)
        self.assertNotIn('adrec:439',byid['ora-bayn-master-launch']['reviewAgainstIds'])
        self.assertEqual(byid['fujairah-address-contract-wrong-subject']['reviewStatus'],'rejected_subject')
        self.assertNotEqual(byid['palm-central-2025-launch']['reportedPublishedAt'],byid['palm-central-2026-phase']['reportedPublishedAt'])


if __name__=='__main__':
    unittest.main(verbosity=2)
