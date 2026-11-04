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
    assert len(full) == len(broad) == 1708
    rows, pages = [], []
    for purpose, count, page_count in [('rent', 477, 23), ('sale', 417, 20)]:
        name = f'commercial-{purpose}-first'
        source = read(name + '-rows')
        manifest = read(name + '-manifest')
        assert len(source) == count and manifest['capturedPages'] == page_count
        assert manifest['sourceRows'] == count and len(manifest['pages']) == page_count
        assert manifest['listingIndex'] == f'https://www.rgestate.com/property-for-{purpose}/commercial'
        for page in manifest['pages']:
            raw = gzip.decompress((CAPTURE / f'{name}-page-{page["page"]:03d}.html.gz').read_bytes())
            assert len(raw) == page['bytes'] and digest(raw) == page['sha256'], 'Captured page changed'
            pages.append({'url': page['url'], 'sha256': page['sha256'], 'bytes': page['bytes']})
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
    assert len(rows) == 894 and len({row['sourceListingId'] for row in rows}) == 894
    rows.sort(key=lambda row: (row['purpose'], -int(row['sourceListingId'])))
    raw = (json.dumps(rows, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
    packed = gzip.compress(raw, compresslevel=9, mtime=0)
    report = {
        'sourceId': 'rgestate-commercial-category-20261103',
        'publisher': 'RGEstate', 'publisherUrl': 'https://www.rgestate.com',
        'categoryUrls': ['https://www.rgestate.com/property-for-rent/commercial', 'https://www.rgestate.com/property-for-sale/commercial'],
        'observedAt': max(read('commercial-rent-first-manifest')['retrievedAt'], read('commercial-sale-first-manifest')['retrievedAt']),
        'evidenceClass': 'brokerage_advertised_listing_facts',
        'rights': 'Owner confirmed reuse of factual details and links for all RGEstate listings, including third-party advertiser listings; photos excluded at user request.',
        'rows': len(rows), 'rentRows': 477, 'saleRows': 417,
        'missingAreaRows': sum(row['areaSqft'] is None for row in rows),
        'missingLocationRows': sum(row['locationLabel'] is None for row in rows),
        'unknownPriceRows': sum(row['priceAed'] is None for row in rows),
        'rawBytes': len(raw), 'rawSha256': digest(raw), 'compressedBytes': len(packed), 'compressedSha256': digest(packed),
        'capturePages': pages, 'verification': 'Two independent full-index reads matched exactly; every category row matched the full index and all captured HTML page checksums were verified.',
        'limits': 'Publisher-listed at capture time; current availability, asking-price accuracy, coordinates, and exact project identity are unverified. Not registered transactions or a complete UAE inventory.',
    }
    return raw, packed, report

def main():
    check = argparse.ArgumentParser()
    check.add_argument('--check', action='store_true')
    args = check.parse_args()
    if args.check:
        report = json.loads((OUT / 'commercial-listings-validation.json').read_text())
        packed = (OUT / 'commercial-listings-20261103.json.gz').read_bytes()
        raw = gzip.decompress(packed)
        rows = json.loads(raw)
        assert len(packed) == report['compressedBytes'] and digest(packed) == report['compressedSha256']
        assert len(raw) == report['rawBytes'] and digest(raw) == report['rawSha256']
        assert len(rows) == report['rows'] == 894
        assert len({r['sourceListingId'] for r in rows}) == 894
        assert sum(r['purpose'] == 'rent' for r in rows) == report['rentRows'] == 477
        assert sum(r['purpose'] == 'sale' for r in rows) == report['saleRows'] == 417
    else:
        raw, packed, report = build()
        OUT.mkdir(parents=True, exist_ok=True)
        (OUT / 'commercial-listings-20261103.json.gz').write_bytes(packed)
        (OUT / 'commercial-listings-validation.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
    print('RGEstate commercial snapshot verified: 894 listing facts, no photos')

if __name__ == '__main__':
    main()
