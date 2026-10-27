#!/usr/bin/env python3
"""Append exact-project ADREC registered sales to V54; preserve the prior snapshot."""
import argparse, collections, copy, gzip, hashlib, importlib.util, json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'data/historical-intelligence'
PASS = BASE / 'adrec-market-data-pass55'
PRIOR = '20261027-enrichment-v54'
VERSION = '20261027-enrichment-v55'
PRIOR_SHA = '00307fd0338cf91ee14afb0e096094645850ceeb340951e7b9015f9b1c845589'
CAPTURE_SHA = '5513a636f49d7e1952599bbf8a26e46b03b0f3304b074a8c1bd233406702c20e'
PLAN_SHA = '111c6aff82b19fe20556cbba424ba0499d8b55db99459452d05f9bd9f2c01487'
canonical = lambda x: json.dumps(x, ensure_ascii=False, separators=(',', ':'), sort_keys=True).encode()
sha256 = lambda x: hashlib.sha256(x).hexdigest()
norm_name = lambda x: ' '.join(str(x).split()).casefold()
STATES = ('present', 'partial', 'missing', 'unestablished', 'disputed', 'inaccessible', 'pre-applicability')

def require(ok, message):
    if not ok:
        raise ValueError(message)

def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def source_records(capture):
    result = []
    for project in capture['projects']:
        reqs = [capture['requests'][i] for i in project['requestIndexes']]
        require(all(x['httpStatus'] == 200 for x in reqs), 'Non-200 ADREC response in accepted project filter')
        require(sum(x['rowCount'] for x in reqs) == project['totalElements'], 'ADREC page rows do not reconcile')
        project_name = project['projectName']
        identifier = project['recordId'].split(':', 1)[1]
        result.append({
            'id': f'adrec-marketdata-pass55-{identifier}',
            'url': reqs[0]['url'],
            'title': f'ADREC public Market Data Recent Sales API, exact project filter {project_name}',
            'publisher': 'Abu Dhabi Real Estate Centre (ADREC)',
            'classification': 'official_primary_registered_sales_dashboard_extract',
            'datePrecision': 'day',
            'publishedAt': None,
            'publicationDateStatus': 'not_published_as_a_fixed_snapshot',
            'retrievedAt': reqs[-1]['retrievedAt'],
            'firstAvailableAt': reqs[0]['retrievedAt'],
            'sourceSnapshotDate': capture['asOf'],
            'sourceSnapshotBasis': 'first retained current-vintage exact-project API response; historical public availability not established',
            'licence': 'No public data-reuse licence identified in ADREC portal terms; normalized records retained in an unmerged research candidate pending rights review',
            'licenceURL': 'https://adrec.gov.ae/en/terms_and_conditions',
            'termsReviewStatus': 'reuse_rights_unresolved_candidate_only',
            'urlPublicDashboard': 'https://adrec.gov.ae/en/market-data',
            'query': {'projectName': project_name, 'fromDate': capture['dateWindow']['from'], 'toDate': capture['dateWindow']['to'],
                      'saleApplicationType': 'all', 'saleSequence': 'all', 'assetClass': 'all', 'propertyType': 'all',
                      'district': 'all', 'municipality': 'all', 'propertyLayout': 'all'},
            'totalElements': project['totalElements'],
            'includedFullShareResidentialRows': project['includedFullShareResidentialRows'],
            'excludedRows': project['excluded'],
            'snapshotFiles': [{'page': r['page'], 'bytes': r['responseBytes'], 'sha256': r['sha256'],
                               'retrievedAt': r['retrievedAt'], 'rowCount': r['rowCount']}
                              for r in reqs],
            'rawTransactionRowsRetained': False,
            'rawTransactionIdsAvailable': False,
            'personalFieldsRetained': False,
            'redirectsFollowed': 0
        })
    return result

def eligible_sale_observations(record):
    return [item for item in record.get('observations', [])
            if item.get('scope') == 'subject'
            and item.get('identityVerified') is True
            and item.get('metric') == 'price'
            and item.get('observationKind') == 'transaction'
            and item.get('transactionKind') == 'sale'
            and item.get('status') == 'source_observed'
            and isinstance(item.get('value'), (int, float))
            and not isinstance(item.get('value'), bool)
            and item['value'] > 0
            and item.get('sourceId')]

def build_packet(snapshot, capture, plan):
    require(snapshot['version'] == PRIOR, 'Exact V54 baseline required')
    require(capture['passId'] == plan['passId'] and capture['baseVersion'] == PRIOR, 'Pass identity mismatch')
    require(capture['counts']['projects'] == len(plan['projects']) and capture['counts']['apiRows'] >= 0 and
            capture['counts']['includedTransactions'] + capture['counts']['excludedRows'] == capture['counts']['apiRows'],
            'Unexpected capture counts')
    records = {x['id']: x for x in snapshot['records']}
    projects = {x['recordId']: x for x in plan['projects']}
    require(len(projects) == 50 and len(projects) == len(plan['projects']), 'Unexpected target ID count')
    sources = source_records(capture)
    source_by_record = {p['recordId']: s for p, s in zip(capture['projects'], sources)}
    old_source_ids = {x['id'] for x in snapshot['sources']}
    require(not old_source_ids.intersection(x['id'] for x in sources), 'ADREC source ID already exists')
    old_fact_ids = {o.get('id') for r in snapshot['records'] for o in r.get('observations', [])}
    def retained_transaction_key(item):
        return (item.get('period'), item.get('priceAED'), item.get('areaSqm'),
                item.get('sourcePropertyType'), item.get('sourcePropertyLayout'),
                item.get('sourceDistrict'), item.get('sourceCommunityCode'),
                item.get('registration'), item.get('saleSequence'), item.get('soldShare'))
    def captured_transaction_key(item):
        return (item.get('period'), item.get('priceAED'), item.get('areaSqm'),
                item.get('propertyType'), item.get('layout'), item.get('district'),
                item.get('community'), item.get('saleApplicationType'),
                item.get('saleSequence'), item.get('soldShare'))
    old_transaction_counts = {
        record['id']: collections.Counter(
            retained_transaction_key(item) for item in record.get('observations', [])
            if item.get('evidenceClass') == 'registered_sale_transaction_primary_adrec_dashboard')
        for record in snapshot['records']
    }
    facts = []
    deduplicated_source_rows = 0
    for item in capture['transactions']:
        rid = item['recordId']
        row = records.get(rid)
        project = projects.get(rid)
        require(row and row['type'] == 'project' and row['emirate'] == 'Abu Dhabi', 'Target record is not an Abu Dhabi project')
        require(project['projectName'] == item['projectName'], 'Capture project mapping changed')
        current_name = norm_name(project['projectName'])
        native_names = [norm_name(e.get('fields', {}).get('nativeName', '')) for e in row.get('registerEvidence', [])]
        require(current_name in native_names,
                f'Exact ADREC native-name crosswalk not established for {rid}: {project["projectName"]!r}')
        owners = {
            candidate['id'] for candidate in snapshot['records']
            for evidence in candidate.get('registerEvidence', [])
            if norm_name(evidence.get('fields', {}).get('nativeName', '')) == current_name
            and str(evidence.get('registeredProjectId') or '').startswith('ADREC:')
        }
        require(owners == {rid}, f'ADREC dashboard label is not unique to {rid}: {sorted(owners)}')
        source = source_by_record[rid]
        require(item['sourceObservationId'].startswith('adrec-sha256:'), 'ADREC source row lacks a stable normalized hash')
        require(item['soldShare'] == 1.0, 'Partial transfer cannot be compared as a full unit sale')
        require(item['period'] <= capture['asOf'] and item['period'] >= capture['dateWindow']['from'], 'Transaction date outside captured window')
        require(item['projectName'] == source['query']['projectName'], 'Exact filtered project name mismatch')
        register_sources = [x for x in row.get('registerEvidence', []) if x.get('registeredProjectId') == f'ADREC:{rid.split(":")[1]}']
        identity_sources = list(dict.fromkeys([x for evidence in register_sources for x in evidence.get('sourceIds', [])]))
        require(identity_sources and all(x in old_source_ids for x in identity_sources), 'Exact authority register identity proof missing')
        transaction_key = captured_transaction_key(item)
        if old_transaction_counts[rid][transaction_key]:
            old_transaction_counts[rid][transaction_key] -= 1
            deduplicated_source_rows += 1
            continue
        identity_sources.append(source['id'])
        identity_basis = (f"ADREC authority project ID {rid.split(':')[1]} is the pre-existing exact subject record {rid} with a retained native project register. "
                          f"The public ADREC Market Data API query filters the exact project label '{project['projectName']}', and every returned row repeats that exact project_name. "
                          'The endpoint provides no native transaction ID; no name-only phase fan-out or transaction-ID claim is made.')
        obs_id = 'adrec55-sale-' + hashlib.sha256((rid + ':' + item['sourceObservationId']).encode()).hexdigest()[:40]
        require(obs_id not in old_fact_ids, 'ADREC observation already exists in the V54 baseline')
        obs = {
            'id': obs_id,
            'recordId': rid,
            'period': item['period'],
            'observationKind': 'transaction',
            'transactionKind': 'sale',
            'metric': 'price',
            'value': item['value'],
            'unit': 'AED/sqft',
            'priceAED': item['priceAED'],
            'areaSqm': item['areaSqm'],
            'sampleCount': 1,
            'frequency': 'daily',
            'observationDateBasis': 'ADREC sale_application_datetime registration date as shown on the current public dashboard; not contract execution date or first-ever sale',
            'transactionId': item['sourceObservationId'],
            'sourceObservationId': item['sourceObservationId'],
            'sourceObservationHashAlgorithm': 'SHA-256 of the canonical normalized ADREC API row; duplicate ordinal preserved when identical rows recur',
            'sourceProjectName': item['projectName'],
            'sourceAssetClass': item['assetClass'],
            'sourcePropertyType': item['propertyType'],
            'sourcePropertyLayout': item['layout'],
            'sourceDistrict': item['district'],
            'sourceCommunityCode': item['community'],
            'registration': item['saleApplicationType'],
            'saleSequence': item['saleSequence'],
            'soldShare': item['soldShare'],
            'sourceReportedRateAEDPerSqm': item['reportedRateAEDPerSqm'],
            'sourcePlotAreaSqm': item['plotAreaSqm'],
            'currentSnapshotEligible': False,
            'includeInCurrentSnapshot': False
        }
        facts.append({'id': obs_id, 'status': 'accepted', 'kind': 'financial', 'recordId': rid,
                      'sourceIds': [source['id']], 'firstAvailableAt': item['retrievedAt'], 'publishedAt': None,
                      'scope': 'subject', 'identityVerified': True, 'identityBasis': identity_basis,
                      'identitySourceIds': identity_sources, 'primaryEvidence': True,
                      'evidenceClass': 'registered_sale_transaction_primary_adrec_dashboard', 'observation': obs})
    require(len(facts) == 642 and deduplicated_source_rows == 9400 and
            len(facts) + deduplicated_source_rows == capture['counts']['includedTransactions'] and
            len({x['id'] for x in facts}) == len(facts),
            'Transaction observation count or IDs do not reconcile')
    require(not old_fact_ids.intersection(x['id'] for x in facts), 'Duplicate V54 observation ID')
    return {'schemaVersion': 1, 'passId': plan['passId'], 'baseVersion': PRIOR, 'baseSHA256': PRIOR_SHA,
            'asOf': capture['asOf'], 'sources': sources, 'facts': facts, 'seriesLinks': [], 'historyInputs': [],
            'recordResearch': [{'recordId': rid, 'status': 'Exact ADREC registered-sale dashboard window reviewed; 2019 onward only; complete lifetime coverage not established; source reuse rights pending.',
                               'sourceIds': [source_by_record[rid]['id']], 'collectionPasses': [{'passId': plan['passId'],
                               'reviewedAt': capture['asOf'], 'identityMethod': 'exact existing ADREC authority ID plus reviewed legacy-to-current label alias and exact current dashboard projectName filter',
                               'financialHistory': 'registered residential full-share sales returned by public dashboard endpoint; source transaction IDs unavailable; reuse licence unresolved'}]}
                              for rid in sorted(projects)],
            'methodology': (capture['methodology'] + ' Previously retained rows are reconciled as a multiset using '
                            'date, price, area, property type/layout, district/community, registration, sequence and sold share. '
                            'This preserves identical-row multiplicity while treating full-row hash changes outside those '
                            'transaction dimensions as source revisions rather than new sales.'),
            'captureSHA256': CAPTURE_SHA,
            'rightsStatus': 'candidate_only_not_published_reuse_rights_unresolved', 'numericForecasts': [],
            'deduplicatedSourceRows': deduplicated_source_rows,
            'withheldRows': {key: sum(p['excluded'][key] for p in capture['projects']) for key in ('partialShare', 'nonResidential', 'missingPriceOrArea')}}

def apply(snapshot, packet):
    out = copy.deepcopy(snapshot)
    before = {x['id']: x for x in snapshot['records']}
    known = {x['id']: x for x in out['records']}
    sources = {x['id']: x for x in out['sources']}
    def add_source(item):
        require(item['id'] not in sources, 'Source overwrite refused')
        sources[item['id']] = copy.deepcopy(item)
        out['sources'].append(sources[item['id']])
        return item['id']
    enricher = load_module('historical_enrichment', ROOT / 'scripts/historical_enrichment.py')
    affected = {f['recordId'] for f in packet['facts']} | {x['recordId'] for x in packet['recordResearch']}
    counters = enricher.apply_enrichment(packet, [known[x] for x in sorted(affected)], {},
                                         sources, add_source, {}, packet['asOf'])
    for rid in affected:
        prior, current = before[rid], known[rid]
        # Preserve unrelated event/lifecycle coverage exactly as previously reviewed.
        current['researchStatus']['itemCoverage'] = copy.deepcopy(prior['researchStatus']['itemCoverage'])
        prior_collection = prior.get('researchStatus', {}).get('sourceCollection')
        added_collection = current.get('researchStatus', {}).get('sourceCollection', {})
        if prior_collection:
            merged_collection = copy.deepcopy(prior_collection)
            prior_passes = merged_collection.get('collectionPasses', [])
            added_passes = added_collection.get('collectionPasses', [])
            seen_passes = {sha256(canonical(item)) for item in prior_passes}
            merged_collection['collectionPasses'] = prior_passes + [
                copy.deepcopy(item) for item in added_passes
                if sha256(canonical(item)) not in seen_passes
            ]
            merged_collection['sourceIds'] = list(dict.fromkeys(
                merged_collection.get('sourceIds', []) + added_collection.get('sourceIds', [])
            ))
            current['researchStatus']['sourceCollection'] = merged_collection
        require(current['observations'][:len(prior['observations'])] == prior['observations'], 'V54 observations removed or edited')
        require(current['lifecycle'] == prior['lifecycle'] and current['registerEvidence'] == prior['registerEvidence'], 'Protected ADREC evidence changed')

    promoted = []
    credited_observations = 0
    for rid, current in known.items():
        item = current['researchStatus']['itemCoverage']['registered_sale_history']
        if item['status'] != 'missing' or rid == 'adrec:391':
            continue
        observations = eligible_sale_observations(current)
        if not observations:
            continue
        periods = sorted({observation['period'] for observation in observations if observation.get('period')})
        current['researchStatus']['itemCoverage']['registered_sale_history'] = {
            'status': 'present',
            'evidenceIds': [observation['id'] for observation in observations],
            'sourceIds': list(dict.fromkeys(observation['sourceId'] for observation in observations)),
            'reason': ('Verified exact-subject authority transactions establish bounded registered-sale evidence '
                       'under the evidence-presence policy. The observed window does not certify lifetime completeness.'),
            'nativePointCount': 0,
            'nativeSeriesCount': 0,
            'transactionObservationCount': len(observations),
            'distinctTransactionDateCount': len(periods),
            'observationStart': periods[0],
            'observationEnd': periods[-1],
            'coverageBasis': 'bounded_exact_subject_authority_transactions',
            'completeLifetimeHistory': False,
            'sparseNativePointCount': 0,
            'sparseObservedPeriodCount': 0,
        }
        gaps = current['researchStatus'].get('gaps', [])
        current['researchStatus']['gaps'] = [gap for gap in gaps if gap != 'direct_registered_sale_history']
        require('complete_registered_sale_history' in current['researchStatus']['gaps'],
                f'Lifetime completeness gap was lost for {rid}')
        promoted.append(rid)
        credited_observations += len(observations)
    require(len(promoted) == 54, f'Expected 54 exact-subject sale-history promotions, got {len(promoted)}')
    changed = affected | set(promoted)
    for old, new in zip(snapshot['records'], out['records']):
        require(old['id'] == new['id'], 'Catalogue order changed')
        if old['id'] not in changed:
            require(old == new, 'Unchanged catalogue record mutated')
    require(out['sources'][:len(snapshot['sources'])] == snapshot['sources'], 'Prior source identities changed')
    require(out['events'] == snapshot['events'] and out['exposures'] == snapshot['exposures'], 'Events/exposures changed')
    out['version'] = out['manifest']['version'] = VERSION
    out['asOf'] = out['manifest']['asOf'] = packet['asOf']
    out['manifest']['reviewedAdrecMarketDataPass55'] = {'packetPath': str((PASS / 'accepted-packet.json').relative_to(ROOT)),
        'packetSemanticSHA256': sha256(canonical(packet)), 'acceptedFacts': len(packet['facts']), 'changedRecords': len(changed),
        'sourcesAdded': len(packet['sources']), 'rawResponsesRetained': False, 'reuseRightsStatus': packet['rightsStatus']}
    out['manifest'].setdefault('sourceEnrichment', {}).setdefault('supplementalPasses', []).append(
        {'passId': packet['passId'], 'asOf': packet['asOf'], **counters})
    def coverage(snapshot):
        counts = collections.Counter(item.get('status') for record in snapshot['records']
                                     for item in record.get('researchStatus', {}).get('itemCoverage', {}).values())
        return {state: counts.get(state, 0) for state in STATES}
    coverage_before, coverage_after = coverage(snapshot), coverage(out)
    coverage_delta = {state: coverage_after[state] - coverage_before[state] for state in STATES}
    require(coverage_delta == {'present': 54, 'partial': 0, 'missing': -54, 'unestablished': 0, 'disputed': 0, 'inaccessible': 0, 'pre-applicability': 0}, 'V55 coverage promotion did not match accepted transaction evidence')
    policy = out['manifest']['coveragePolicy']
    primary_keys, advanced_keys = set(policy['primaryItems']), set(policy['advancedAuditItems'])
    def scoped_coverage(keys):
        counts = collections.Counter(item.get('status') for record in out['records']
                                     for key, item in record.get('researchStatus', {}).get('itemCoverage', {}).items()
                                     if key in keys)
        return {'total': sum(counts.values()), **{state: counts.get(state, 0) for state in STATES}}
    primary_coverage, advanced_coverage = scoped_coverage(primary_keys), scoped_coverage(advanced_keys)
    all_coverage = {state: primary_coverage[state] + advanced_coverage[state] for state in STATES}
    out['manifest']['coverageSummary'] = {
        'primary': primary_coverage,
        'advancedAudit': advanced_coverage,
        'allItems': {'total': primary_coverage['total'] + advanced_coverage['total'], **all_coverage},
    }
    out['manifest']['directSubjectSaleHistoryRecords'] = sum(
        record.get('researchStatus', {}).get('itemCoverage', {}).get('registered_sale_history', {}).get('status') == 'present'
        for record in out['records']
    )
    require(out['manifest']['directSubjectSaleHistoryRecords'] == 486, 'Direct subject sale-history record count mismatch')
    receipt = {'schemaVersion': 1, 'version': VERSION, 'priorVersion': PRIOR, 'priorSHA256': PRIOR_SHA,
        'changedRecords': sorted(changed), 'changedRecordsByEmirate': {'Abu Dhabi': len(changed)},
        'recordsReviewedByEmirate': {'Abu Dhabi': len(packet['recordResearch'])}, 'sourcesAdded': len(packet['sources']),
        'acceptedFacts': len(packet['facts']), 'registeredTransactionsAdded': len(packet['facts']),
        'registeredTransactionsCredited': credited_observations,
        'registeredSaleRecordsPromoted': len(promoted),
        'deduplicatedSourceRows': packet['deduplicatedSourceRows'],
        'signedRentsAdded': 0, 'valuationsAdded': 0, 'askingPriceObservationsAdded': 0,
        'lifecycleFactsAdded': 0, 'numericForecastsAdded': 0, 'remoteWrites': 0,
        'rawResponsesRetained': False, 'sourceReuseRightsStatus': packet['rightsStatus'],
        'sourceCaptureSHA256': CAPTURE_SHA, 'priorSourcesPreserved': len(snapshot['sources']),
        'unaffectedRecordsPreserved': len(snapshot['records']) - len(changed),
        'transactionDateWindow': packet['asOf'] + ' capture; source API date range 2019-01-01 through 2026-10-22',
        'coverageBefore': coverage_before, 'coverageAfter': coverage_after, 'coverageDelta': coverage_delta,
        'countsByRecord': {rid: sum(1 for f in packet['facts'] if f['recordId'] == rid) for rid in sorted(changed)},
        'methodology': ('Registered sale rows are current-vintage dashboard observations. No source transaction identifiers or personal fields were returned. '
                        'Full-share residential rows only; AED/sqft reconciles to sale price and sold area. Prior rows are deduplicated as a multiset on stable '
                        'transaction dimensions so repeated identical registrations retain multiplicity while source revisions do not inflate transaction counts. '
                        'Public reuse terms remain unresolved and publication is blocked pending review.')}
    return out, receipt

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise SystemExit('New output directory required')
    raw = gzip.decompress(args.snapshot.read_bytes()) if args.snapshot.suffix == '.gz' else args.snapshot.read_bytes()
    require(sha256(raw) == PRIOR_SHA, 'Exact V54 snapshot SHA-256 required')
    plan_path = PASS / 'source-plan.json'
    plan_raw = plan_path.read_bytes()
    require(sha256(plan_raw) == PLAN_SHA, 'Frozen source plan changed')
    capture_raw = (PASS / 'capture.json').read_bytes()
    require(sha256(capture_raw) == CAPTURE_SHA, 'Frozen ADREC capture changed')
    snapshot = json.loads(raw)
    capture = json.loads(capture_raw)
    plan = json.loads(plan_raw)
    packet = build_packet(snapshot, capture, plan)
    out, receipt = apply(snapshot, packet)
    args.output.mkdir(parents=True)
    (args.output / 'candidate-snapshot.json').write_bytes(canonical(out) + b'\n')
    (args.output / 'reconciliation.json').write_bytes(canonical(receipt) + b'\n')
    target = PASS / 'accepted-packet.json'
    rendered_packet = json.dumps(packet, ensure_ascii=False, indent=2, sort_keys=True) + '\n'
    if target.exists():
        require(target.read_text() == rendered_packet, 'Append-only accepted packet changed')
    else:
        target.write_text(rendered_packet)
    print(json.dumps({'version': VERSION, 'acceptedFacts': len(packet['facts']), 'changedRecords': receipt['changedRecords'],
                      'countsByRecord': receipt['countsByRecord'], 'sourcesAdded': len(packet['sources']),
                      'rightsStatus': packet['rightsStatus'], 'candidateOnly': True}))

if __name__ == '__main__':
    main()
