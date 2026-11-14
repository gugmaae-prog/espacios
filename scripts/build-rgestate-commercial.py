#!/usr/bin/env python3
"""Verify RGEstate category captures and build a factual, photo-free snapshot."""
import argparse
import gzip
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CAPTURE = ROOT / 'work/rgestate-capture'
OUT = ROOT / 'data/uae-evidence/rgestate'

def digest(data):
    return hashlib.sha256(data).hexdigest()

def read(name):
    return json.loads((CAPTURE / f'{name}.json').read_text())

def build():
    broad = read('first-rows')
    assert broad == read('second-rows'), 'Independent full-index captures differ'
    full = {row['sourceListingId']: row for row in broad}
    assert len(full) == len(broad) >= 1500
    rows, pages, counts = [], [], {}
    for purpose in ('rent', 'sale'):
        name = f'commercial-{purpose}-first'
        source = read(name + '-rows')
        manifest = read(name + '-manifest')
        assert source == read(f'commercial-{purpose}-second-rows') and len(source) >= 350
        assert len(source) == manifest['sourceRows']
        assert manifest['capturedPages'] == manifest['expectedPages'] == len(manifest['pages'])
        counts[purpose] = len(source)
        assert manifest['listingIndex'] == f'https://www.rgestate.com/property-for-{purpose}/commercial'
        for pass_name in ('first', 'second'):
            capture_name = f'commercial-{purpose}-{pass_name}'
            capture_manifest = read(capture_name + '-manifest')
            assert capture_manifest['sourceRows'] == len(source) and capture_manifest['capturedPages'] == manifest['capturedPages']
            for page in capture_manifest['pages']:
                raw = gzip.decompress((CAPTURE / f'{capture_name}-page-{page["page"]:03d}.html.gz').read_bytes())
                assert len(raw) == page['bytes'] and digest(raw) == page['sha256'], 'Captured page changed'
                pages.append({'pass': pass_name, 'url': page['url'], 'sha256': page['sha256'], 'bytes': page['bytes']})
        for row in source:
            assert full.get(row['sourceListingId']) == row, 'Category and full-index facts differ'
            assert row['sourceUrl'].startswith(f'https://www.rgestate.com/{purpose}/')
            area = row['areaLabel']
            match = re.fullmatch(r'([\d,]+(?:\.\d+)?)\s+Sq\.?\s*Ft\.', area or '')
            assert not area or match, f'Unexpected area: {area}'
            price = row['priceLabel']
            amount = re.fullmatch(r'AED\s+([\d,]+)(?:\s*/\s*(Year|na))?', price)
            assert amount or price == 'Price on Request', f'Unexpected price: {price}'
            price_value = int(amount.group(1).replace(',', '')) if amount else None
            period = 'year' if purpose == 'rent' and amount and amount.group(2) == 'Year' else ('total' if purpose == 'sale' else None)
            rows.append({
                'sourceListingId': row['sourceListingId'], 'sourceUrl': row['sourceUrl'],
                'purpose': purpose, 'title': row['title'],
                'locationLabel': row['locationLabel'] or None,
                'areaSqft': float(match.group(1).replace(',', '')) if match else None,
                'priceAed': price_value if price_value and period else None,
                'pricePeriod': period if price_value else None,
                'priceLabel': price,
                'availabilityStatus': 'publisher_listed_unverified',
                'canonicalProjectId': None, 'coordinates': None,
            })
    assert len(rows) == sum(counts.values()) and len({row['sourceListingId'] for row in rows}) == len(rows)
    rows.sort(key=lambda row: (row['purpose'], -int(row['sourceListingId'])))
    previous_report = json.loads((OUT / 'commercial-listings-validation-20261111.json').read_text())
    previous_packed = (OUT / 'commercial-listings-20261111.json.gz').read_bytes()
    previous_raw = gzip.decompress(previous_packed)
    assert digest(previous_packed) == previous_report['compressedSha256'] and digest(previous_raw) == previous_report['rawSha256']
    previous = {row['sourceListingId']: row for row in json.loads(previous_raw)}
    current = {row['sourceListingId']: row for row in rows}
    comparison = {
        'previousSourceId': previous_report['sourceId'],
        'previousObservedAt': previous_report['observedAt'],
        'previousRawSha256': previous_report['rawSha256'],
        'continuingIds': len(previous.keys() & current.keys()),
        'addedIds': sorted(current.keys() - previous.keys(), key=int),
        'absentFromCurrentCategoryIds': sorted(previous.keys() - current.keys(), key=int),
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
        'limits': 'A missing publisher category ID does not establish a sale, withdrawal, or current unavailability. Price changes are advertised asks, not transactions.',
    }
    raw = (json.dumps(rows, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
    packed = gzip.compress(raw, compresslevel=9, mtime=0)
    report = {
        'sourceId': 'rgestate-commercial-category-20261114',
        'publisher': 'RGEstate', 'publisherUrl': 'https://www.rgestate.com',
        'categoryUrls': ['https://www.rgestate.com/property-for-rent/commercial', 'https://www.rgestate.com/property-for-sale/commercial'],
        'observedAt': max(read(f'commercial-{purpose}-{pass_name}-manifest')['retrievedAt'] for purpose in ('rent', 'sale') for pass_name in ('first', 'second')),
        'evidenceClass': 'brokerage_advertised_listing_facts',
        'rights': 'Owner confirmed reuse of factual details and links for all RGEstate listings, including third-party advertiser listings; photos excluded at user request.',
        'rows': len(rows), 'rentRows': counts['rent'], 'saleRows': counts['sale'],
        'comparison': comparison,
        'missingAreaRows': sum(row['areaSqft'] is None for row in rows),
        'missingLocationRows': sum(row['locationLabel'] is None for row in rows),
        'unknownPriceRows': sum(row['priceAed'] is None for row in rows),
        'rawBytes': len(raw), 'rawSha256': digest(raw), 'compressedBytes': len(packed), 'compressedSha256': digest(packed),
        'capturePages': pages, 'verification': 'Two independent full-index and category reads matched facts; every category row matched the full index and all captured HTML page checksums were verified.',
        'limits': 'Publisher-listed at capture time; current availability, asking-price accuracy, coordinates, and exact project identity are unverified. Not registered transactions or a complete UAE inventory.',
    }
    return raw, packed, report

def main():
    check = argparse.ArgumentParser()
    check.add_argument('--check', action='store_true')
    args = check.parse_args()
    if args.check:
        report = json.loads((OUT / 'commercial-listings-validation.json').read_text())
        packed = (OUT / 'commercial-listings-20261114.json.gz').read_bytes()
        raw = gzip.decompress(packed)
        rows = json.loads(raw)
        assert len(packed) == report['compressedBytes'] and digest(packed) == report['compressedSha256']
        assert len(raw) == report['rawBytes'] and digest(raw) == report['rawSha256']
        assert len(rows) == report['rows']
        assert len({r['sourceListingId'] for r in rows}) == report['rows']
        assert sum(r['purpose'] == 'rent' for r in rows) == report['rentRows']
        assert sum(r['purpose'] == 'sale' for r in rows) == report['saleRows']
    else:
        raw, packed, report = build()
        OUT.mkdir(parents=True, exist_ok=True)
        (OUT / 'commercial-listings-20261114.json.gz').write_bytes(packed)
        (OUT / 'commercial-listings-validation.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
    print(f'RGEstate commercial snapshot verified: {report["rows"]} listing facts, no photos')

if __name__ == '__main__':
    main()
