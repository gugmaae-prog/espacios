#!/usr/bin/env python3
"""Build the independently captured RGEstate full-index facts, without photos."""
import argparse
import gzip
import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
CAPTURE = ROOT / 'work/rgestate-capture'
OUT = ROOT / 'data/uae-evidence/rgestate'
KINDS = {'sale', 'rent', 'business-sale', 'off-plan'}
AREA = re.compile(r'([\d,]+(?:\.\d+)?)\s+Sq\.?\s*Ft\.?', re.I)
PRICE = re.compile(r'AED\s+([\d,]+)(?:\s*/\s*(Year|na))?')

def sha(data):
    return hashlib.sha256(data).hexdigest()

def read(name):
    return json.loads((CAPTURE / f'{name}.json').read_text())

def build():
    first, second = read('first-rows'), read('second-rows')
    assert first == second and len(first) >= 1500
    assert len({row['sourceListingId'] for row in first}) == len(first)
    captures = []
    for name in ('first', 'second'):
        manifest = read(name + '-manifest')
        assert manifest['listingIndex'] == 'https://www.rgestate.com/properties'
        assert manifest['sourceRows'] == manifest['distinctSourceIds'] == len(first)
        assert manifest['expectedPages'] == manifest['capturedPages'] == len(manifest['pages'])
        for page in manifest['pages']:
            raw = gzip.decompress((CAPTURE / f'{name}-page-{page["page"]:03d}.html.gz').read_bytes())
            assert len(raw) == page['bytes'] and sha(raw) == page['sha256']
        captures.append({'pass': name, 'retrievedAt': manifest['retrievedAt'],
                         'pages': len(manifest['pages']),
                         'pageManifestSha256': sha(json.dumps(manifest['pages'], sort_keys=True).encode())})

    commercial = {row['sourceListingId']: row for kind in ('rent', 'sale')
                  for row in read(f'commercial-{kind}-first-rows')}
    assert len(commercial) >= 800
    for source_id, row in commercial.items():
        assert next(item for item in first if item['sourceListingId'] == source_id) == row

    rows = []
    for row in first:
        assert set(row) == {'sourceListingId', 'sourceUrl', 'title', 'locationLabel', 'areaLabel', 'priceLabel'}
        parsed = urlsplit(row['sourceUrl'])
        kind = parsed.path.strip('/').split('/')[0]
        assert parsed.scheme == 'https' and parsed.netloc == 'www.rgestate.com' and kind in KINDS
        assert row['sourceListingId'].isdigit() and row['title'].strip() and parsed.path.count('/') >= 2
        area = AREA.fullmatch(row['areaLabel'] or '')
        assert area or row['areaLabel'] is None
        price = PRICE.fullmatch(row['priceLabel'] or '')
        assert price or row['priceLabel'] == 'Price on Request'
        amount = int(price.group(1).replace(',', '')) if price else None
        period = ('year' if kind == 'rent' and price and price.group(2) == 'Year'
                  else 'total' if kind == 'sale' and price and not price.group(2) else None)
        rows.append({
            'sourceListingId': row['sourceListingId'], 'sourceUrl': row['sourceUrl'],
            'listingPathClass': kind, 'commercialCategoryMember': row['sourceListingId'] in commercial,
            'title': row['title'], 'locationLabel': row['locationLabel'] or None,
            'areaLabel': row['areaLabel'],
            'areaSqft': float(area.group(1).replace(',', '')) if area else None,
            'priceLabel': row['priceLabel'],
            'priceAed': amount if amount and period else None, 'pricePeriod': period,
            'availabilityStatus': 'publisher_listed_unverified',
            'canonicalProjectId': None, 'coordinates': None,
        })
    kinds = Counter(row['listingPathClass'] for row in rows)
    assert set(kinds) <= KINDS and sum(kinds.values()) == len(first)
    assert sum(row['commercialCategoryMember'] for row in rows) == len(commercial)
    rows.sort(key=lambda row: -int(row['sourceListingId']))
    previous_report = json.loads((OUT / 'full-index-validation-20261110.json').read_text())
    previous_packed = (OUT / 'full-index-20261110.json.gz').read_bytes()
    previous_raw = gzip.decompress(previous_packed)
    assert sha(previous_packed) == previous_report['compressedSha256'] and sha(previous_raw) == previous_report['rawSha256']
    previous = {row['sourceListingId']: row for row in json.loads(previous_raw)}
    current = {row['sourceListingId']: row for row in rows}
    comparison = {
        'previousSourceId': previous_report['sourceId'],
        'previousObservedAt': previous_report['observedAt'],
        'previousRawSha256': previous_report['rawSha256'],
        'continuingIds': len(previous.keys() & current.keys()),
        'addedIds': sorted(current.keys() - previous.keys(), key=int),
        'absentFromCurrentIndexIds': sorted(previous.keys() - current.keys(), key=int),
        'changedAskingPrices': [
            {'sourceListingId': key, 'previousPriceLabel': previous[key]['priceLabel'], 'currentPriceLabel': current[key]['priceLabel']}
            for key in sorted(previous.keys() & current.keys(), key=int)
            if previous[key]['priceLabel'] != current[key]['priceLabel']
        ],
        'changedTitles': [
            {'sourceListingId': key, 'previousTitle': previous[key]['title'], 'currentTitle': current[key]['title']}
            for key in sorted(previous.keys() & current.keys(), key=int)
            if previous[key]['title'] != current[key]['title']
        ],
        'limits': 'A missing publisher index ID does not establish a sale, withdrawal, or current unavailability. Price changes are advertised asks, not transactions.',
    }
    raw = (json.dumps(rows, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
    packed = gzip.compress(raw, compresslevel=9, mtime=0)
    report = {
        'sourceId': 'rgestate-full-index-20261111', 'publisher': 'RGEstate',
        'sourceUrl': 'https://www.rgestate.com/properties',
        'observedAt': captures[-1]['retrievedAt'], 'captures': captures,
        'evidenceClass': 'brokerage_advertised_listing_facts',
        'rights': 'Owner confirmed reuse of factual details and links for all RGEstate listings, including third-party advertisers; photos excluded.',
        'rows': len(rows), 'pathClassCounts': dict(kinds),
        'comparison': comparison,
        'commercialCategoryRows': len(commercial), 'notInCommercialCategoryRows': len(rows)-len(commercial),
        'missingAreaRows': sum(row['areaSqft'] is None for row in rows),
        'missingLocationRows': sum(row['locationLabel'] is None for row in rows),
        'unknownPriceRows': sum(row['priceAed'] is None for row in rows),
        'rawBytes': len(raw), 'rawSha256': sha(raw),
        'compressedBytes': len(packed), 'compressedSha256': sha(packed),
        'verification': f'Two independent {len(first)}-row full-index reads matched facts; each captured HTML page checksum passed; all {len(commercial)} commercial-category rows match the full index.',
        'limits': 'Publisher-listed at capture only. Current availability, category for rows outside the verified commercial pages, asking-price accuracy, coordinates, and exact project identity are unverified. Business-sale asks can include operating businesses and are not property prices. Off-plan path entries have no verified sale/rent classification. Not registered transactions or a complete UAE inventory.',
    }
    return packed, report

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if args.check:
        report = json.loads((OUT / 'full-index-validation.json').read_text())
        packed = (OUT / 'full-index-20261111.json.gz').read_bytes()
        raw = gzip.decompress(packed)
        rows = json.loads(raw)
        assert len(packed) == report['compressedBytes'] and sha(packed) == report['compressedSha256']
        assert len(raw) == report['rawBytes'] and sha(raw) == report['rawSha256']
        assert len(rows) == report['rows'] == len({row['sourceListingId'] for row in rows})
        assert Counter(row['listingPathClass'] for row in rows) == report['pathClassCounts']
        assert sum(row['commercialCategoryMember'] for row in rows) == report['commercialCategoryRows']
    else:
        packed, report = build()
        OUT.mkdir(parents=True, exist_ok=True)
        (OUT / 'full-index-20261111.json.gz').write_bytes(packed)
        (OUT / 'full-index-validation.json').write_text(json.dumps(report, indent=2) + '\n')
    print(f'RGEstate full index verified: {report["rows"]} listing facts, no photos')

if __name__ == '__main__':
    main()
