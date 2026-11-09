#!/usr/bin/env python3
"""Derive explicitly labelled commercial-space candidates from the verified full index."""
import gzip
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'data/uae-evidence/rgestate'
SOURCE = BASE / 'full-index-20261109.json.gz'
SOURCE_REPORT = BASE / 'full-index-validation.json'
OUT = BASE / 'commercial-title-candidates-20261109.json.gz'
REPORT = BASE / 'commercial-title-candidates-validation.json'
PATTERN = re.compile(r'\b(?:retail|shop|showroom|office|warehouse|factory|workshop|commercial (?:unit|space)|industrial (?:unit|complex)|business centre|business center)\b', re.I)
EXCLUDE = re.compile(r'\b(?:plot|land|yard|residential|project|plor)\b', re.I)

def sha(data):
    return hashlib.sha256(data).hexdigest()

def main():
    source_report = json.loads(SOURCE_REPORT.read_text())
    compressed = SOURCE.read_bytes()
    source_raw = gzip.decompress(compressed)
    assert sha(compressed) == source_report['compressedSha256']
    assert sha(source_raw) == source_report['rawSha256']
    source = json.loads(source_raw)
    assert len(source) == source_report['rows']
    candidates = []
    for row in source:
        if row['commercialCategoryMember'] or row['listingPathClass'] not in ('sale', 'rent'):
            continue
        title = row['title']
        if not PATTERN.search(title) or EXCLUDE.search(title):
            continue
        candidates.append({
            'sourceListingId': row['sourceListingId'],
            'sourceUrl': row['sourceUrl'],
            'purpose': row['listingPathClass'],
            'title': title,
            'locationLabel': row['locationLabel'],
            'areaLabel': row['areaLabel'],
            'areaSqft': row['areaSqft'],
            'priceLabel': row['priceLabel'],
            'priceAed': row['priceAed'],
            'pricePeriod': row['pricePeriod'],
            'availabilityStatus': row['availabilityStatus'],
            'canonicalProjectId': None,
            'coordinates': None,
            'sourceCategory': 'title_matched_candidate',
        })
    assert len(candidates) == 137, len(candidates)
    assert len({r['sourceListingId'] for r in candidates}) == len(candidates)
    raw = json.dumps(candidates, ensure_ascii=False, separators=(',', ':')).encode()
    packed = gzip.compress(raw, mtime=0)
    report = {
        'sourceId': 'rgestate-commercial-title-candidates-20261109',
        'parentSourceId': source_report['sourceId'],
        'parentRawSha256': source_report['rawSha256'],
        'publisher': 'RGEstate',
        'sourceUrl': source_report['sourceUrl'],
        'observedAt': source_report['observedAt'],
        'evidenceClass': 'brokerage_advertised_listing_title_candidate',
        'classification': 'Explicit commercial built-space title term, excluding plot, land, yard, residential, project, and typo plor; publisher commercial-category membership is false.',
        'classificationRule': {'include': PATTERN.pattern, 'exclude': EXCLUDE.pattern},
        'rows': len(candidates),
        'rentRows': sum(r['purpose'] == 'rent' for r in candidates),
        'saleRows': sum(r['purpose'] == 'sale' for r in candidates),
        'sourceListingIds': [r['sourceListingId'] for r in candidates],
        'rawBytes': len(raw), 'rawSha256': sha(raw),
        'compressedBytes': len(packed), 'compressedSha256': sha(packed),
        'limits': 'Title-based candidates outside the publisher commercial category. Space type, current availability, asking-price accuracy, and whether IDs describe distinct physical units are unverified. No unit coordinates or property photos.',
    }
    report_bytes = (json.dumps(report, ensure_ascii=False, indent=2) + '\n').encode()
    if '--check' in sys.argv:
        assert OUT.read_bytes() == packed, 'Candidate snapshot changed'
        assert REPORT.read_bytes() == report_bytes, 'Candidate report changed'
        print(f'Checked {len(candidates)} title candidates against full-index source')
    else:
        OUT.write_bytes(packed)
        REPORT.write_bytes(report_bytes)
        print(f'Wrote {len(candidates)} title candidates')

if __name__ == '__main__':
    main()
