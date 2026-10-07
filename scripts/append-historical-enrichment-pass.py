#!/usr/bin/env python3
"""Append an immutable reviewed pass without replacing existing source evidence."""
import argparse
import json
import pathlib
from copy import deepcopy

ROOT = pathlib.Path(__file__).resolve().parents[1]


def read(path):
    return json.loads(path.read_text())


def index_rows(rows, key):
    return {row[key]: row for row in rows if row.get(key)}


def append_unique(existing, incoming, key, label):
    index = index_rows(existing, key)
    for row in incoming:
        ident = row.get(key)
        if not ident:
            raise ValueError(f'{label} item lacks {key}')
        previous = index.get(ident)
        if previous is None:
            existing.append(deepcopy(row))
            index[ident] = existing[-1]
        elif previous != row:
            raise ValueError(f'Conflicting {label} item: {ident}')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--pass-file', type=pathlib.Path, required=True)
    parser.add_argument('--base', type=pathlib.Path, default=ROOT / 'data/historical-intelligence/scrape-enrichment.json')
    args = parser.parse_args()
    base = read(args.base)
    packet = read(args.pass_file)
    if base.get('schemaVersion') != 1 or packet.get('schemaVersion') != 1:
        raise ValueError('Unsupported enrichment packet schema')
    if packet.get('asOf', '') > base.get('asOf', ''):
        raise ValueError('Enrichment base cutoff must be advanced through the normal release review')

    before_sources = deepcopy(base.get('sources', []))
    before_facts = deepcopy(base.get('facts', []))
    for key in ['sources', 'facts', 'seriesLinks', 'historyInputs', 'licensedArchives', 'sourceCandidates']:
        unique_key = 'id' if key in ['sources', 'facts'] else 'seriesId' if key == 'seriesLinks' else 'id' if key == 'sourceCandidates' else 'path' if key == 'historyInputs' else 'id'
        base.setdefault(key, [])
        append_unique(base[key], packet.get(key, []), unique_key, key)

    base.setdefault('additionalDatasets', [])
    dataset_sources = {x.get('sourceId') for x in base['additionalDatasets']}
    for item in packet.get('additionalDatasets', []):
        if item.get('sourceId') in dataset_sources:
            old = next(x for x in base['additionalDatasets'] if x.get('sourceId') == item.get('sourceId'))
            if old != item:
                raise ValueError('Conflicting additional dataset provenance: ' + str(item.get('sourceId')))
        else:
            base['additionalDatasets'].append(deepcopy(item))
            dataset_sources.add(item.get('sourceId'))

    research = index_rows(base.setdefault('recordResearch', []), 'recordId')
    for row in packet.get('recordResearch', []):
        ident = row.get('recordId')
        if not ident:
            raise ValueError('Research row lacks recordId')
        old = research.get(ident)
        if old is None:
            copy = deepcopy(row)
            copy['collectionPasses'] = [{k: v for k, v in row.items() if k != 'recordId'}]
            base['recordResearch'].append(copy)
            research[ident] = copy
        else:
            for source_id in row.get('sourceIds', []):
                if source_id not in old.setdefault('sourceIds', []):
                    old['sourceIds'].append(source_id)
            old['acceptedFactCount'] = old.get('acceptedFactCount', 0) + row.get('acceptedTransactionObservationCount', 0)
            old['directRegisteredSaleObservationsAdded'] = old.get('directRegisteredSaleObservationsAdded', 0) + row.get('acceptedTransactionObservationCount', 0)
            old.setdefault('collectionPasses', []).append({k: v for k, v in row.items() if k != 'recordId'})

    base.setdefault('collection', {}).setdefault('passes', [])
    pass_summary = packet.get('collection', {})
    if not any(item.get('passId') == pass_summary.get('passId') for item in base['collection']['passes']):
        base['collection']['passes'].append(deepcopy(pass_summary))
    elif next(item for item in base['collection']['passes'] if item.get('passId') == pass_summary.get('passId')) != pass_summary:
        raise ValueError('Conflicting collection pass ID')

    if index_rows(before_sources, 'id') != index_rows(base['sources'][:len(before_sources)], 'id'):
        raise ValueError('Existing source evidence changed')
    if index_rows(before_facts, 'id') != index_rows(base['facts'][:len(before_facts)], 'id'):
        raise ValueError('Existing accepted facts changed')
    args.base.write_text(json.dumps(base, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n')
    print(json.dumps({'sources': len(base['sources']), 'facts': len(base['facts']),
                      'recordResearch': len(base['recordResearch']), 'passId': pass_summary.get('passId')}))


if __name__ == '__main__':
    main()
