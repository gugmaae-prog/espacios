#!/usr/bin/env python3
"""Classify only explicit emirate labels in the retained RGEstate snapshot."""
import argparse
import gzip
import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/uae-evidence/rgestate/full-index-20261110.json.gz'
SOURCE_REPORT = ROOT / 'data/uae-evidence/rgestate/full-index-validation.json'
OUT = ROOT / 'data/uae-evidence/rgestate/emirate-label-validation.json'
LABELS = {
    'Abu Dhabi': 'Abu Dhabi',
    'Ajman': 'Ajman',
    'Dubai': 'Dubai',
    'Fujairah': 'Fujairah',
    'Ras Al Khaimah': 'Ras Al Khaimah',
    'Sharjah': 'Sharjah',
    'Umm Al Quwain': 'Umm Al Quwain',
    'Emirate of Umm Al Quwain': 'Umm Al Quwain',
}
EMIRATES = ('Abu Dhabi', 'Ajman', 'Dubai', 'Fujairah', 'Ras Al Khaimah', 'Sharjah', 'Umm Al Quwain')
KINDS = ('sale', 'rent', 'off-plan', 'business-sale')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def build():
    report = json.loads(SOURCE_REPORT.read_text())
    packed = SOURCE.read_bytes()
    raw = gzip.decompress(packed)
    assert len(packed) == report['compressedBytes'] and sha(packed) == report['compressedSha256']
    assert len(raw) == report['rawBytes'] and sha(raw) == report['rawSha256']
    rows = json.loads(raw)
    assert len(rows) == report['rows']
    assert len({row['sourceListingId'] for row in rows}) == len(rows)
    by_emirate = {}
    for emirate in EMIRATES:
        subset = [row for row in rows if LABELS.get(row['locationLabel']) == emirate]
        kinds = Counter(row['listingPathClass'] for row in subset)
        by_emirate[emirate] = {
            'rows': len(subset),
            'byPathClass': {kind: kinds[kind] for kind in KINDS},
            'commercialCategoryRows': sum(row['commercialCategoryMember'] for row in subset),
        }
    explicit = sum(item['rows'] for item in by_emirate.values())
    assert explicit + (len(rows) - explicit) == report['rows']
    return {
        'version': '20261110-rgestate-emirate-labels-v3',
        'sourceId': report['sourceId'],
        'sourceRawSha256': report['rawSha256'],
        'sourceObservedAt': report['observedAt'],
        'method': 'Exact equality against the publisher location label; no title, URL, nearby district, or coordinate inference.',
        'labelMap': LABELS,
        'byEmirate': by_emirate,
        'explicitEmirateRows': explicit,
        'unassignedRows': len(rows) - explicit,
        'evidenceClass': report['evidenceClass'],
        'geographyStatus': 'publisher_label_unverified',
        'availabilityStatus': 'publisher_listed_at_capture_unverified_now',
        'limits': 'These are dated asking-listing facts, not registered transactions, project identities, project coordinates, or complete emirate inventories. Unassigned rows may still be located in one of the seven emirates; their location labels are not exact emirate names.',
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    expected = json.dumps(build(), ensure_ascii=False, indent=2) + '\n'
    if args.check:
        assert OUT.read_text() == expected, 'Derived emirate label report changed'
    else:
        OUT.write_text(expected)
    report = build()
    print(f'RGEstate explicit emirate labels verified: {report["explicitEmirateRows"]} assigned, {report["unassignedRows"]} unassigned')


if __name__ == '__main__':
    main()
