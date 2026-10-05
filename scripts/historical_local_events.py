"""Turn reviewed local infrastructure/amenity milestones into dated context."""
import hashlib, json
from historical_gap_ledger import period_start


def local_event_context(records, sources, asof):
    groups = {}
    for record in records:
        for fact in record.get('lifecycle', []):
            kind = fact.get('kind', '')
            if not any(word in kind for word in ['infrastructure', 'amenity', 'policy']):
                continue
            if fact.get('status') != 'verified' or fact.get('primaryEvidence') is not True or not fact.get('date') or not fact.get('sourceIds'):
                continue
            stage = fact.get('eventStatus', 'reported')
            if stage == 'actual' and period_start(fact['date']['start']) > asof:
                raise ValueError('Future actual local event')
            key = json.dumps([kind, fact['date'], fact.get('label'), stage, sorted(fact['sourceIds'])], sort_keys=True)
            group = groups.setdefault(key, {'fact': fact, 'records': [], 'evidenceIds': []})
            if record['id'] not in [r['id'] for r in group['records']]:
                group['records'].append(record)
            group['evidenceIds'].append(fact['id'])
    events, exposures = [], []
    for key, group in sorted(groups.items()):
        fact = group['fact']; stage = fact.get('eventStatus', 'reported')
        source_ids = fact['sourceIds']
        available = [sources[s].get('firstAvailableAt') for s in source_ids]
        event_id = 'local-evidence-' + hashlib.sha256(key.encode()).hexdigest()[:24]
        events.append({'id': event_id, 'title': fact['label'], 'category': 'policy' if 'policy' in fact['kind'] else 'infrastructure' if 'infrastructure' in fact['kind'] else 'amenity',
            'eventDate': fact['date'], 'eventStatus': stage, 'status': 'planned' if stage == 'planned' else 'verified_event_context',
            'classification': 'event_evidence', 'evidenceStrength': 'primary_source_reported',
            'sourceIds': source_ids, 'firstAvailableAt': max(available) if all(available) else None,
            'publishedAt': fact.get('publishedAt'), 'announcedAt': fact.get('publishedAt'),
            'retrievedAt': fact.get('retrievedAt'), 'lifecycleEvidenceIds': group['evidenceIds'],
            'geography': {'emirates': sorted({r['emirate'] for r in group['records']}), 'recordIds': [r['id'] for r in group['records']]},
            'priceUpliftPct': None, 'claims': [{'text': fact['label'], 'classification': 'reported_context', 'sourceIds': source_ids}],
            'note': fact.get('note'), 'limits': 'Named local context only; exact property access, at-event existence and a causal financial effect are not established.'})
        named_ids = {r['id'] for r in group['records']}
        named_communities = {r['id']: r for r in group['records'] if r['type'] == 'community'}
        linked_records = [(r, True) for r in group['records']]
        linked_records += [(r, False) for r in records if r['id'] not in named_ids and r['type'] == 'project' and r.get('communityId') in named_communities and r['emirate'] == named_communities[r['communityId']]['emirate']]
        for record, named in linked_records:
            exposures.append({'id': hashlib.sha256(json.dumps([event_id, record['id'], 'community']).encode()).hexdigest()[:24], 'eventId': event_id, 'recordId': record['id'],
                'scope': 'community', 'sourceIds': source_ids, 'verified': named,
                'basis': 'Reviewed primary source names this community or project; no parcel catchment or price effect inferred.' if named else 'Catalogue community membership only; project existence and exact infrastructure access at the event date remain unverified.',
                'existenceAtEvent': 'named_context_only' if named else 'research_pending', 'exactAccessVerified': False, 'priceUpliftPct': None})
    return events, exposures
