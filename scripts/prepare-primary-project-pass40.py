#!/usr/bin/env python3
"""Prepare independently sourced advertisements and development reports.

This produces a reviewed packet only. It never changes the published archive,
promotes DLD candidate transactions, or treats advertisements as valuations.
"""
import hashlib
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CAP = ROOT / '.local-data/primary-project-pass40'
BASE_SHA = 'c112efc54c153338e1a1543a882a16c31894d8d4c16bc00ca66adab38fd58d98'
WRAITH = 'project:binghatti-wraith-al-jaddaf-dubai'
MARINE = 'project:helvetia-marine-dhg-properties-dubai-islands-dubai'
PINS = {
    'wraith-quotes': '08c2db823069c4f85a9e470ae7b627bc2b3758abf74b790d8da40c7546d5c875',
    'helvetia-premiere': 'e2871095992db33f7b86693e66da929c66f7dd93e8a7dfd814e1c8da890ce527',
    'helvetia-groundbreaking': 'df8317f93e2da976adf5128ed5625dd9e77600535faf1ee9e8fc2ca745cceacd',
}


def visible_text(body):
    # Do not extract claims from script payloads, navigation JSON or styling.
    text = re.sub(r'<(script|style)\b[^>]*>.*?</\1>', ' ', body, flags=re.S | re.I)
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', text)))


def build_packet(snapshot):
    records = {r['id']: r for r in snapshot['records']}
    for rid, name, community in [(WRAITH, 'Binghatti Wraith', 'community:Dubai:al-jaddaf'), (MARINE, 'Helvetia Marine', 'community:Dubai:dubai-islands')]:
        r = records[rid]
        assert (r['name'], r['type'], r['emirate'], r['communityId']) == (name, 'project', 'Dubai', community)
        assert len([x for x in snapshot['records'] if x['name'].casefold() == name.casefold() and x['type'] == 'project']) == 1
    sources, texts = [], {}
    for key, pin in PINS.items():
        meta = json.loads((CAP / f'{key}-capture.json').read_text())
        body = (CAP / f'{key}.html').read_bytes()
        assert meta['status'] == 200 and len(body) == meta['bytes'] and hashlib.sha256(body).hexdigest() == meta['sha256'] == pin
        texts[key] = visible_text(body.decode())
        publication = {'helvetia-premiere': '2025-12', 'helvetia-groundbreaking': '2026-06'}.get(key)
        source = {**meta, 'id': 'primary40-' + key, 'publisher': 'Binghatti' if key == 'wraith-quotes' else 'DHG Properties',
                  'title': {'wraith-quotes': 'Binghatti Wraith available-unit advertisements', 'helvetia-premiere': 'DHG reports Helvetia Marine Premiere Week', 'helvetia-groundbreaking': 'DHG reports Helvetia Marine construction commencement'}[key],
                  'publishedAt': publication, 'publicationDatePrecision': 'month' if publication else 'unknown',
                  'firstAvailableAt': meta['retrievedAt'], 'primaryEvidence': True,
                  'classification': 'primary_developer_advertisement' if key == 'wraith-quotes' else 'primary_developer_lifecycle_report',
                  'publicationDateBasis': 'Displayed month only; current captured article body first available at retrieval' if publication else 'No publication date established; advertisement observed at capture',
                  'licence': 'Minimal attributed factual extraction; raw HTML and media are not redistributed', 'rawBodyRedistributed': False}
        same = [s for s in snapshot['sources'] if s.get('url', '').rstrip('/') == source['url'].rstrip('/')]
        if same:
            source.update(preserveRevision=True, revisionOfSourceId=same[-1]['id'])
        sources.append(source)
    quotes = texts['wraith-quotes']
    assert 'Binghatti Wraith' in quotes and 'Al Jaddaf' in quotes
    assert 'available units' in quotes
    cards = quotes.split('available units', 1)[1].split('Frequently Asked Questions', 1)[0]
    matches = re.findall(r'(Studio|1 Bedroom|2 Bedroom) Starting AED ([\d,]+) ([\d,]+) sqft', cards)
    assert matches == [('Studio', '807,999', '341'), ('1 Bedroom', '1,299,999', '662'), ('2 Bedroom', '2,099,999', '1112')], matches
    premiere = texts['helvetia-premiere']; construction = texts['helvetia-groundbreaking']
    for phrase in ['December 2025', 'December 8 to 13, 2025', 'Helvetia Marine', '63 units', 'ahead of the broader market launch']:
        assert phrase in premiere, phrase
    for phrase in ['June 2026', 'officially commenced construction of Helvetia Marine', 'Q1 2028', '63 residences', 'sold out before the groundbreaking', 'Island A of Dubai Islands']:
        assert phrase in construction, phrase
    by_id = {s['id']: s for s in sources}
    wraith_basis = 'Unique catalogue Binghatti Wraith / Al Jaddaf record, corroborated by the exact named project and bedroom cards on the Binghatti primary domain. This proves the marketed advertisement subject, not legal registration 4482, legal developer equivalence or any candidate transaction.'
    marine_basis = 'Unique catalogue Helvetia Marine / DHG Properties / Dubai Islands record. Both primary DHG articles explicitly name this project; the construction report locates it on Island A. Helvetia Residences in JVC and Helvetia Verde in Meydan remain separate. No registration-number or individual sale mapping is inferred.'
    facts = []
    def common(key, rid, source_key, kind, basis):
        source_id = 'primary40-' + source_key; src = by_id[source_id]
        return {'id': 'primary40-' + key, 'recordId': rid, 'kind': kind, 'status': 'accepted', 'sourceIds': [source_id],
                'identitySourceIds': [source_id], 'identityVerified': True, 'identityBasis': basis, 'primaryEvidence': True,
                'publishedAt': src['publishedAt'], 'firstAvailableAt': src['retrievedAt'], 'scope': 'subject'}
    for label, amount, area in matches:
        fact = common('wraith-' + label.lower().replace(' ', '-'), WRAITH, 'wraith-quotes', 'financial', wraith_basis)
        fact['evidenceClass'] = 'advertised_asking_price'
        fact['observation'] = {'period': '2026-10-09', 'observationDateBasis': 'Primary advertisement observed at retrieval; original publication and launch date unknown',
                              'metric': 'price', 'observationKind': 'asking_quote', 'unit': 'AED', 'value': int(amount.replace(',', '')),
                              'segment': label + ' apartment', 'bedrooms': label, 'quoteQualifier': 'bedroom-specific advertised starting price',
                              'sourceQuoteBasis': 'Named available-unit card on primary developer project page',
                              'advertisedStartingAreaSqft': int(area.replace(',', '')), 'areaBasis': 'Separate advertised starting area; not a verified same-unit transaction denominator',
                              'currentSnapshotEligible': False, 'includeInCurrentSnapshot': False, 'pricePerSqftDerived': False,
                              'note': 'Starting price and starting area are separately advertised bounds. No exact-unit AED/sqft, registered sale, current valuation, yield or appreciation is inferred.'}
        facts.append(fact)
    def lifecycle(key, source_key, milestone, date, label, note, event='reported'):
        fact = common(key, MARINE, source_key, 'lifecycle', marine_basis)
        fact.update(milestone=milestone, date=date, label=label, note=note, eventStatus=event, verification='reported',
                    evidenceClass='primary_source_dated_lifecycle_report', preserveAdditionalLifecycleFields=True)
        facts.append(fact)
        return fact
    lifecycle('marine-premiere', 'helvetia-premiere', 'announcement', {'start': '2025-12-08', 'end': '2025-12-13', 'precision': 'range'},
              'DHG reports Helvetia Marine broker Premiere Week, 8–13 December 2025.',
              'Explicit event interval. The article also says this preceded the broader market launch; it does not establish the first-ever sale, first marketing date or original public launch.')
    f = lifecycle('marine-construction-report', 'helvetia-groundbreaking', 'construction_confirmation', {'start': '2026-06', 'precision': 'month'},
                  'DHG reports that Helvetia Marine construction has commenced.',
                  'June 2026 is the article month, not an independently verified day of groundbreaking or an inspection. The developer reports commencement; no progress percentage, completion or occupancy is inferred.')
    f['dateBasis'] = 'Displayed June 2026 report month; exact construction-start date unestablished'
    lifecycle('marine-target', 'helvetia-groundbreaking', 'target_handover', {'start': '2028-Q1', 'precision': 'quarter'},
              'DHG anticipates Helvetia Marine handover in Q1 2028.',
              'Developer target preserved beside earlier schedules. It is not completed handover, occupancy or rental availability.', 'planned')
    lifecycle('marine-soldout-report', 'helvetia-groundbreaking', 'developer_sales_status_report', {'start': '2026-06', 'precision': 'month'},
              'DHG reports Helvetia Marine sold out before groundbreaking.',
              'June article describes a 63-residence development and a sold-out status. This is a developer marketing report, not 63 verified DLD transactions, settled revenue, individual prices or current resale availability.')
    return {'schemaVersion': 1, 'passId': 'primary-project-pass40-20261009', 'priorVersion': snapshot['version'], 'priorSHA256': BASE_SHA,
            'candidateVersion': '20261009-enrichment-v40', 'asOf': '2026-10-09', 'sources': sources, 'facts': facts,
            'recordIdentityChecks': [{'recordId': rid, 'catalogueName': records[rid]['name'], 'type': 'project', 'emirate': 'Dubai', 'communityId': records[rid]['communityId']} for rid in [WRAITH, MARINE]],
            'recordResearch': [], 'collection': {'asOf': '2026-10-09', 'acceptedLifecycleFacts': 4, 'advertisedBedroomQuotes': 3, 'newRegisteredTransactions': 0, 'newSources': 3, 'rawBodiesRedistributed': False},
            'methodology': 'Primary marketed-subject identity supports separately labelled asking quotes and lifecycle reports. It does not resolve DLD legal-entity, phase or transaction candidate identity. Native event interval and publication month precision are retained; captured bodies are unavailable to earlier backtests. Bedroom quote bounds do not establish same-unit price per area or replace the project headline snapshot.',
            'excludedCandidates': [{'recordId': WRAITH, 'reason': '49 residential-flat sale candidates remain pending primary registration/component proof.'}, {'recordId': MARINE, 'reason': '10 residential-flat sale candidates remain pending primary registration/component proof.'}]}


def main():
    raw = (ROOT / 'data/historical-intelligence-20261003.json').read_bytes()
    assert hashlib.sha256(raw).hexdigest() == BASE_SHA
    packet = build_packet(json.loads(raw))
    path = ROOT / 'data/historical-intelligence/primary-project-pass40-20261009.json'
    path.write_text(json.dumps(packet, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'packet': str(path.relative_to(ROOT)), 'sources': len(packet['sources']), 'facts': len(packet['facts']), 'productionArchiveChanged': False}))


if __name__ == '__main__':
    main()
