"""Review staged evidence without modifying the live V39 snapshot."""
import hashlib
import json
import sys
import unittest
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from historical_enrichment import apply_enrichment

WRAITH = 'project:binghatti-wraith-al-jaddaf-dubai'
MARINE = 'project:helvetia-marine-dhg-properties-dubai-islands-dubai'


def preview(snapshot, packet):
    after = deepcopy(snapshot)
    changed = {f['recordId'] for f in packet['facts']}
    old = {r['id']: r for r in snapshot['records']}
    sources = {s['id']: s for s in after['sources']}
    def add_source(source):
        assert source['id'] not in sources
        sources[source['id']] = deepcopy(source)
        after['sources'].append(sources[source['id']])
        return source['id']
    affected = [r for r in after['records'] if r['id'] in changed]
    for r in affected:
        assert not any(s.get('scope') == 'subject' and s.get('identityVerified') for s in r['historySeries'])
    result = apply_enrichment(packet, affected, {}, sources, add_source, {}, after['asOf'])
    # Shared series and event exposures were not reloaded for this bounded pass.
    # Their exact ledger states must remain, not refresh against an empty map.
    allowed = {WRAITH: {'advertised_prices'}, MARINE: {'announcement_registration', 'construction', 'handover_targets'}}
    for r in affected:
        for key, item in old[r['id']]['researchStatus']['itemCoverage'].items():
            if key not in allowed[r['id']]:
                r['researchStatus']['itemCoverage'][key] = deepcopy(item)
    return after, result


class PrimaryProjectPass40Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        raw = (ROOT / 'data/historical-intelligence-20261003.json').read_bytes()
        cls.snapshot = json.loads(raw)
        cls.packet = json.loads((ROOT / 'data/historical-intelligence/primary-project-pass40-20261009.json').read_text())
        assert hashlib.sha256(raw).hexdigest() == cls.packet['priorSHA256']
        cls.after, cls.result = preview(cls.snapshot, cls.packet)

    def test_all_prior_records_series_sources_and_observations_are_preserved(self):
        self.assertEqual(len(self.after['records']), 1860)
        self.assertEqual(self.after['sources'][:len(self.snapshot['sources'])], self.snapshot['sources'])
        self.assertEqual(self.after['events'], self.snapshot['events'])
        self.assertEqual(self.after['exposures'], self.snapshot['exposures'])
        for before, after in zip(self.snapshot['records'], self.after['records']):
            if before['id'] not in {WRAITH, MARINE}:
                self.assertEqual(before, after)
            for key in ['currentSnapshot', 'scenarioInputs', 'scenarioCoverage', 'historySeries']:
                self.assertEqual(before[key], after[key])
            self.assertEqual(after['observations'][:len(before['observations'])], before['observations'])
            self.assertEqual(after['lifecycle'][:len(before['lifecycle'])], before['lifecycle'])

    def test_advertised_bedroom_bounds_do_not_become_transactions_or_headline(self):
        r = next(r for r in self.after['records'] if r['id'] == WRAITH)
        quotes = [x for x in r['observations'] if x['id'].startswith('primary40-')]
        self.assertEqual([x['value'] for x in quotes], [807999, 1299999, 2099999])
        for x in quotes:
            self.assertEqual((x['unit'], x['observationKind'], x['period']), ('AED', 'asking_quote', '2026-10-09'))
            self.assertFalse(x['currentSnapshotEligible'])
            self.assertFalse(x['pricePerSqftDerived'])
            self.assertNotIn('transactionId', x)
        self.assertEqual(r['researchStatus']['itemCoverage']['registered_sale_history']['status'], 'missing')

    def test_report_and_event_precision_preserve_uncertainty(self):
        r = next(r for r in self.after['records'] if r['id'] == MARINE)
        facts = {x['id']: x for x in r['lifecycle']}
        self.assertEqual(facts['primary40-marine-premiere']['date'], {'start': '2025-12-08', 'end': '2025-12-13', 'precision': 'range'})
        self.assertEqual(facts['primary40-marine-construction-report']['date']['precision'], 'month')
        self.assertEqual(facts['primary40-marine-construction-report']['kind'], 'construction_confirmation')
        self.assertEqual(facts['primary40-marine-target']['eventStatus'], 'planned')
        self.assertNotIn('progressPercent', facts['primary40-marine-construction-report'])
        for key in ['original_launch', 'actual_completion', 'occupancy', 'registered_sale_history']:
            self.assertEqual(r['researchStatus']['itemCoverage'][key]['status'], 'missing')

    def test_future_source_availability_is_rejected(self):
        packet = deepcopy(self.packet)
        packet['facts'][0]['firstAvailableAt'] = '2026-10-10T00:00:00Z'
        with self.assertRaisesRegex(ValueError, 'availability/publication after snapshot'):
            preview(self.snapshot, packet)

    def test_invalid_quote_amount_is_rejected(self):
        packet = deepcopy(self.packet)
        packet['facts'][0]['observation']['value'] = 0
        with self.assertRaisesRegex(ValueError, 'Invalid financial fact'):
            preview(self.snapshot, packet)


if __name__ == '__main__':
    unittest.main()
