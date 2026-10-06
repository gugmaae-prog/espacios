"""Per-item evidence accountability. Presence never certifies a full history."""
import datetime
import re

# A week with fewer than this many counted transactions is sparse.
# Sparse, partial and missing weeks are not labelled complete.
SPARSE_WEEK_SAMPLE = 5


def period_start(value):
    text = str(value).strip()
    week = re.fullmatch(r'(\d{4})-W(\d{2})', text)
    if week:
        return datetime.date.fromisocalendar(int(week[1]), int(week[2]), 1).isoformat()
    text = re.sub(r'-?Q([1-4])', lambda m: '-' + str((int(m[1])-1)*3+1).zfill(2), text, flags=re.I)
    text = re.sub(r'H([12])$', lambda m: '-' + ('01' if m[1] == '1' else '07'), text, flags=re.I)
    text = re.sub(r'FY$', '', text, flags=re.I)
    return text + '-01-01' if len(text) == 4 else text + '-01' if len(text) == 7 else text[:10]


def evidence_item(status, evidence, reason, **extra):
    return {'status': status, 'evidenceIds': [x['id'] for x in evidence if x.get('id')],
            'sourceIds': list(dict.fromkeys(s for x in evidence for s in (x.get('sourceIds') or [x.get('sourceId')]) if s)),
            'reason': reason, **extra}

def disputed_point(point):
    return bool(re.search(r'conflict|quarantin', str(point[3] if len(point)>3 else ''), re.I))


def refresh_research_coverage(record, series, sources, asof, shared_context=None, event_links=None):
    status = record['researchStatus']
    status.setdefault('originalAuditGaps', list(status.get('gaps', [])))
    milestones = record.get('lifecycle', [])
    direct = [series[s['id']] for s in record.get('historySeries', [])
              if s.get('scope') == 'subject' and s.get('identityVerified') is True]
    observations = record.get('observations', [])
    items = {}
    for key, kind in [('original_launch', 'launch'), ('actual_completion', 'completion'), ('occupancy', 'occupancy')]:
        accepted = [x for x in milestones if x.get('kind') == kind and x.get('status') == 'verified'
                    and x.get('scope') == 'subject' and x.get('primaryEvidence') is True
                    and period_start(x.get('date', {}).get('start', '9999')) <= asof
                    and x.get('eventStatus') != 'planned']
        reported = [x for x in milestones if x.get('kind') == kind and x not in accepted]
        items[key] = evidence_item('present' if accepted else 'partial' if reported else 'missing', accepted or reported,
            'Verified whole-record milestone evidence.' if accepted else 'Reported or differently scoped evidence needs verification.' if reported else 'No verified whole-record milestone retained.')
    for key, kinds in [('construction', {'construction_start', 'construction_progress', 'construction_confirmation', 'phase_construction_start', 'phase_construction_progress'}),
                       ('construction_targets', {'target_construction_start', 'planned_construction_start'}),
                       ('handover_targets', {'target_handover', 'target_completion'}),
                       ('delivery_reports', {'delivery', 'phase_handover'}),
                       ('phase_milestones', {x.get('kind') for x in milestones if x.get('kind', '').startswith('phase_')}),
                       ('announcement_registration', {'announcement', 'registration', 'first_marketing', 'first_sale', 'masterplan_announcement', 'phase_announcement', 'land_acquisition', 'escrow_opening', 'establishment', 'opening'})]:
        facts = [x for x in milestones if x.get('kind') in kinds]
        phase_only = key == 'construction' and facts and all(x.get('kind', '').startswith('phase_') or x.get('scope') != 'subject' for x in facts)
        items[key] = evidence_item('partial' if phase_only else 'present' if facts else 'missing', facts, 'Phase/scoped construction evidence only; original whole-record construction start remains unverified.' if phase_only else 'Source precision, verification and phase scope remain attached; no financial price or whole-record completion is inferred.')
        if key == 'announcement_registration' and not facts:
            registers = [x for x in record.get('registerEvidence', []) if x.get('registeredProjectId')
                         and x.get('identityVerified') is True and x.get('scope') == 'subject'
                         and not x.get('fields', {}).get('feeComponents')]
            if registers:
                items[key] = evidence_item('partial', registers,
                    'Verified project register evidence is retained; an exact dated original announcement or registration milestone remains unverified.')
    for metric, name in [('price', 'registered_sale_history'), ('rent', 'signed_rent_history')]:
        cohorts = [x for x in direct if x.get('metric') == metric]
        points = [p for s in cohorts for p in s.get('points', [])
                  if len(p) > 1 and isinstance(p[1], (int, float)) and not isinstance(p[1], bool) and p[1] > 0]
        disputed = [p for p in points if disputed_point(p)]
        accepted = [p for p in points if not disputed_point(p)]
        items[name] = evidence_item('present' if accepted else 'partial' if disputed else 'missing', cohorts,
            'Disputed source observations are retained but excluded from usable subject coverage; dates do not establish occupancy or realised income.' if disputed else 'Verified native subject cohorts retained; presence and sparse observations do not certify complete lifetime coverage.',
            nativePointCount=len(points), nativeSeriesCount=len(cohorts), completeLifetimeHistory=False)
        if disputed:items[name].update(disputedNativePointCount=len(disputed),acceptedNativePointCount=len(accepted))
        items['complete_' + name] = evidence_item('unestablished', [],
            'Inception/applicability and every applicable native period require independent verification. Unobserved prices remain missing.', completeLifetimeHistory=False)
    asking = [x for x in observations if x.get('observationKind') in ['asking_quote', 'developer_advertised_price']]
    primary_asking = [x for x in asking if x.get('primaryEvidence') is True or sources.get(x.get('sourceId'), {}).get('primaryEvidence') is True
                      or sources.get(x.get('sourceId'), {}).get('classification', '').startswith('primary_')]
    items['advertised_prices'] = evidence_item('present' if asking else 'missing', asking,
        'Captured advertisements with native dates and qualifiers; market validity and completed-sale status are separate.',
        primaryQuoteCount=len(primary_asking), catalogueMirrorQuoteCount=sum('tenant_mirror' in sources.get(x.get('sourceId'), {}).get('classification', '') for x in asking))
    valuations = [x for x in observations if x.get('scope') == 'subject' and x.get('identityVerified') is True
                  and x.get('observationKind') == 'valuation' and x.get('period')]
    items['dated_valuation'] = evidence_item('present' if valuations else 'missing', valuations, 'Dated subject valuations retain their valid date; asking advertisements and market medians do not clear this item.')
    current_valuations = [x for x in valuations if x.get('period') == asof or
        (x.get('validity', {}).get('verified') is True and x['validity'].get('sourceIds') and
         x['validity'].get('start', '') <= asof <= x['validity'].get('end', ''))]
    items['dated_current_valuation'] = evidence_item('present' if current_valuations else 'missing', current_valuations, 'Valid at this cutoff by a same-day valuation or an explicitly sourced validity interval; dated older valuations remain historical evidence.')
    fees = [x for x in record.get('registerEvidence', []) if x.get('fields', {}).get('feeComponents')]
    items['service_charge_components'] = evidence_item('partial' if fees else 'missing', fees,
        'Native fee components are retained separately; a complete applicable property budget and denominator are not established.',
        componentCount=sum(len(x['fields']['feeComponents']) for x in fees))
    contexts = [x for x in record.get('historySeries', []) if x.get('scope') != 'subject' and x.get('recordLinkReview',{}).get('status')!='rejected']
    contexts += [x for x in shared_context or [] if x.get('scope') == 'community_context' and x['id'] not in {s['id'] for s in contexts}]
    items['shared_financial_context'] = evidence_item('present' if contexts else 'missing', contexts, 'Native area/master-project populations remain separately scoped; a contextual link does not certify subject identity.')
    links = event_links or []
    items['dated_event_context'] = evidence_item('partial' if links else 'missing', links, 'Dated geographic news and infrastructure context; exact access, existence at the event date and measured local price effects remain unestablished.')
    for name in ['price', 'rent', 'net_return']:
        items['validated_' + name + '_forecast'] = evidence_item('unestablished', [], 'No horizon-validated subject forecast is certified; conditional annual slots remain separate from observed history.')
    items['annual_scenario_inputs'] = evidence_item('partial' if record.get('scenarioInputs') else 'missing', [], '2027–2080 slots require explicit anchors, annual assumptions and applicable costs. Scenario availability does not certify accuracy.', firstYear=2027, lastYear=2080)
    status['itemCoverage'] = items
    status['itemCoverageAsOf'] = asof
    status['itemCoverageDefinition'] = 'Evidence presence per item; no aggregate percentage of complete lifetime history is asserted.'
    gaps = list(status.get('gaps', []))
    clear = {'original_launch': 'verified_launch_date', 'actual_completion': 'actual_completion_date',
             'registered_sale_history': 'direct_registered_sale_history', 'signed_rent_history': 'direct_signed_rent_history',
             'dated_current_valuation': 'dated_current_valuation'}
    for key, gap in clear.items():
        if items[key]['status'] == 'present':
            gaps = [x for x in gaps if x != gap]
    for gap in ['complete_registered_sale_history', 'complete_signed_rent_history']:
        if gap not in gaps:
            gaps.append(gap)
    status['gaps'] = gaps

    history = []
    for fact in milestones:
        if fact.get('scope') == 'subject' and fact.get('status') == 'verified' and fact.get('primaryEvidence') is True and fact.get('eventStatus') != 'planned' and period_start(fact.get('date', {}).get('start', '9999')) <= asof and not fact['kind'].startswith(('target_', 'phase_')):
            history.append({'date': fact['date'], 'basis': 'earliest_retained_verified_subject_milestone', 'evidenceIds': [fact['id']], 'sourceIds': fact['sourceIds']})
    for cohort in direct:
        for p in cohort.get('points', []):
            if disputed_point(p):continue
            precision = 'quarter' if re.search(r'Q[1-4]', str(p[0]), re.I) else 'year' if len(str(p[0])) == 4 else 'month' if len(str(p[0])) == 7 else 'day'
            history.append({'date': {'start': p[0], 'precision': precision}, 'basis': 'earliest_retained_native_subject_observation', 'evidenceIds': [cohort['id']], 'sourceIds': [cohort['sourceId']]})
    status['earliestHistoryEvidence'] = min(history, key=lambda x: period_start(x['date']['start'])) if history else None
    status['earliestHistoryDefinition'] = 'Earliest retained verifiable record evidence; first-ever transaction, inception and continuous price coverage remain unestablished.'


def weekly_week_requirement(week_start, week_end, observed_dates, metrics):
    """Count one ISO week in the requirement ledger.

    A weekly observation may be present for that week. Every calendar day from
    Monday through Sunday that is absent from the retained daily dates stays
    not independently observed. Partial weeks (fewer than 7 observed days),
    sparse weeks and missing weeks are not labelled complete. Presence does
    not certify a complete lifetime history. Quarterly and monthly grains are
    not produced here.
    """
    start = datetime.date.fromisoformat(str(week_start))
    end = datetime.date.fromisoformat(str(week_end))
    if start.weekday() != 0 or end.weekday() != 6 or (end - start).days != 6:
        raise ValueError('ISO week must run Monday through Sunday')
    observed_dates = set(observed_dates)
    span = [start + datetime.timedelta(days=i) for i in range(7)]
    observed = [day.isoformat() for day in span if day.isoformat() in observed_dates]
    absent = [day.isoformat() for day in span if day.isoformat() not in observed_dates]
    count = metrics.get('transactionCount')
    sparse_sample = count is not None and count < SPARSE_WEEK_SAMPLE
    if not observed:
        coverage = 'missing'
    elif len(observed) < 7:
        coverage = 'partial'
    elif sparse_sample:
        coverage = 'sparse'
    else:
        coverage = 'complete'
    present = {}
    missing = {}
    for key, value in metrics.items():
        if coverage == 'missing':
            missing[key] = 'missing_week'
        elif value is None:
            missing[key] = 'metric_absent'
        else:
            present[key] = {
                'weekCoverage': coverage,
                'independentlyObservedDays': observed,
            }
    return {
        'coverage': coverage,
        'completeLifetimeHistory': False,
        'observedDayCount': len(observed),
        'observedDates': observed,
        'notIndependentlyObservedDates': absent,
        'sparseSample': sparse_sample and coverage != 'missing',
        'present': present,
        'missing': missing,
    }
