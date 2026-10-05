#!/usr/bin/env python3
"""Verify append-only evidence and immutable objects against a saved snapshot."""
import argparse, collections, gzip, hashlib, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]


def retained(old, new):
    if isinstance(old, dict):
        return isinstance(new, dict) and all(k in new and retained(v, new[k]) for k, v in old.items())
    if isinstance(old, list):
        return isinstance(new, list) and all(any(retained(v, candidate) for candidate in new) for v in old)
    return old == new


def check(before, after, root, publication=None):
    errors = []
    def require(condition, message):
        if not condition:
            errors.append(message)
    old_records = {x['id']: x for x in before['records']}
    new_records = {x['id']: x for x in after['records']}
    require(len(new_records) == len(after['records']), 'Duplicate new record IDs')
    require(set(old_records) == set(new_records), 'Record IDs changed')
    for rid, old in old_records.items():
        new = new_records.get(rid, {})
        for key in ['type', 'name', 'emirate', 'communityId', 'sharedCommunityHistoryId']:
            if key in old:
                corrected = key in ['communityId','sharedCommunityHistoryId'] and any(
                    r.get('verification')=='verified' and r.get('primaryEvidence') is True and r.get('sourceIds') and r.get('identitySourceIds')
                    and all(s in {x['id'] for x in after['sources']} for s in r['sourceIds']+r['identitySourceIds'])
                    and r.get('fromCommunityId' if key=='communityId' else 'fromSharedCommunityHistoryId')==old[key]
                    and r.get('toCommunityId')==new.get(key) and new_records.get(new.get(key),{}).get('type')=='community'
                    and new_records[new[key]].get('emirate')==old.get('emirate') for r in new.get('communityAssociationRevisions',[]))
                require(old[key] == new.get(key) or corrected, rid + ': changed ' + key + ' without verified retained correction')
        for key in ['lifecycle', 'observations', 'registerEvidence', 'priorCurrentSnapshots','communityAssociationRevisions']:
            for row in old.get(key, []):
                require(any(retained(row, x) for x in new.get(key, [])), rid + ': lost ' + key + ':' + str(row.get('id', 'snapshot')))
        require(any(retained(old['currentSnapshot'], x) for x in [new.get('currentSnapshot', {})] + new.get('priorCurrentSnapshots', [])), rid + ': previous current quote not retained')
        links = {x['id']: x for x in new.get('historySeries', [])}
        for pointer in old.get('historySeries', []):
            require(pointer['id'] in links, rid + ': lost series link ' + pointer['id'])
            if pointer['id'] in links and pointer.get('scope') == 'subject':
                require(links[pointer['id']].get('scope') == 'subject' and links[pointer['id']].get('identityVerified') is True, rid + ': demoted approved subject history')
                for key in ['subjectRecordId', 'identitySourceIds', 'linkBasis']:
                    if key in pointer:require(retained(pointer[key],links[pointer['id']].get(key)), rid + ': changed approved ' + key)
    for key in ['sources', 'events', 'exposures', 'exposureRules']:
        identity = lambda x: x.get('id') or x.get('ruleId') or x.get('eventId')
        new_by_id = {identity(x): x for x in after.get(key, [])}
        for row in before.get(key, []):
            ident = identity(row)
            require(ident in new_by_id and retained(row, new_by_id[ident]), 'Lost or changed ' + key + ':' + str(ident))

    def all_series(snapshot):
        result = {}
        for obj in snapshot['manifest']['objects']:
            target = root / obj['path']
            require(target.exists(), 'Missing immutable object ' + obj['path'])
            if not target.exists():
                continue
            raw = target.read_bytes()
            require(hashlib.sha256(raw).hexdigest() == obj['sha256'], 'Changed immutable object ' + obj['path'])
            if obj['kind'] == 'history_partition':
                for series in json.loads(gzip.decompress(raw))['series']:
                    require(series['id'] not in result, 'Duplicate series partition ' + series['id'])
                    result[series['id']] = series
        return result
    old_series, new_series = all_series(before), all_series(after)
    point_count = 0
    for sid, old in old_series.items():
        new = new_series.get(sid)
        require(new is not None, 'Lost native series ' + sid)
        if new is None:
            continue
        for key in ['sourceId', 'metric', 'sourceMetric', 'unit', 'frequency', 'geography', 'segment', 'registration']:
            if key in old:
                require(old[key] == new.get(key), 'Changed native series identity ' + sid + ':' + key)
        if old.get('scope')=='subject' and old.get('identityVerified') is True:
            for key in ['subjectRecordId','identitySourceIds','identityBasis']:
                if key in old:require(retained(old[key],new.get(key)), 'Changed approved native cohort '+sid+':'+key)
        old_points = collections.Counter(json.dumps(x, sort_keys=True) for x in old['points'])
        new_points = collections.Counter(json.dumps(x, sort_keys=True) for x in new['points'])
        require(not (old_points - new_points), 'Lost or changed native observations ' + sid)
        point_count += len(old['points'])
    if publication:
        for obj in publication['objects']:
            target = root / obj['path']
            require(target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == obj['sha256'], 'Previous publication object missing/changed ' + obj['path'])
    return {'passed': not errors, 'errors': errors, 'preservedRecords': len(old_records), 'preservedSources': len(before['sources']), 'preservedNativeSeries': len(old_series), 'preservedNativePoints': point_count, 'preservedRecordSeriesLinks': sum(len(r.get('historySeries', [])) for r in before['records']), 'preservedEvents': len(before.get('events', [])), 'preservedExposureLinks': len(before.get('exposures', [])), 'newSources': len(after['sources']) - len(before['sources']), 'newNativeSeries': len(new_series) - len(old_series), 'beforeVersion': before['version'], 'afterVersion': after['version']}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--before', type=pathlib.Path, required=True)
    parser.add_argument('--after', type=pathlib.Path, default=ROOT / 'data/historical-intelligence-20261003.json')
    parser.add_argument('--before-publication', type=pathlib.Path)
    parser.add_argument('--output', type=pathlib.Path, required=True)
    args = parser.parse_args()
    result = check(json.loads(args.before.read_text()), json.loads(args.after.read_text()), ROOT, json.loads(args.before_publication.read_text()) if args.before_publication else None)
    result['beforeSHA256'] = hashlib.sha256(args.before.read_bytes()).hexdigest()
    result['afterSHA256'] = hashlib.sha256(args.after.read_bytes()).hexdigest()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))
    if not result['passed']:
        raise SystemExit(1)
