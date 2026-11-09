#!/usr/bin/env python3
"""Capture factual, photo-free RGEstate index rows twice with page receipts.

The output is local review material. Publication is performed by the separate
snapshot builders after both passes and the commercial subset reconcile.
"""
import argparse
import concurrent.futures
import gzip
import hashlib
import html
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlsplit

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'work/rgestate-capture'
BASE = 'https://www.rgestate.com'
CARD = re.compile(r'<div\s+class="[^"]*\blst-prop\b[^"]*"\s+id="sale_item(\d+)"', re.I)
TAG = re.compile(r'<[^>]*>')


def clean(value):
    return re.sub(r'\s+', ' ', html.unescape(TAG.sub(' ', value or ''))).strip()


def part(card, pattern):
    match = re.search(pattern, card, re.I | re.S)
    return clean(match.group(1)) if match else None


def parse(raw):
    page = raw.decode('utf-8', errors='replace')
    matches = list(CARD.finditer(page))
    rows = []
    for index, match in enumerate(matches):
        card = page[match.start():matches[index + 1].start() if index + 1 < len(matches) else len(page)]
        href = re.search(r'<a\s+href="(/[^"]+)"', card)
        if not href:
            raise ValueError('Listing link missing: ' + match.group(1))
        url = urljoin(BASE, html.unescape(href.group(1)))
        parsed = urlsplit(url)
        if parsed.scheme != 'https' or parsed.netloc != 'www.rgestate.com' or parsed.path.split('/')[1] not in ('rent', 'sale', 'business-sale', 'off-plan'):
            raise ValueError('Unexpected listing URL: ' + url)
        price = part(card, r'<span\s+class="fp_price"[^>]*>(.*?)</span>(?:</span>)?')
        # The rent period is a nested span. Capture the complete outer content.
        price_match = re.search(r'<span\s+class="fp_price"[^>]*>(.*?)(?=\s*<p\s+class="add")', card, re.I | re.S)
        if price_match:
            price = clean(price_match.group(1))
        area_group = re.search(r'<ul\s+class="prop_detailss"[^>]*>(.*?)</ul>', card, re.I | re.S)
        area_item = next((item for item in re.findall(r'<li\b[^>]*>(.*?)</li>', area_group.group(1), re.I | re.S) if '#new_area' in item), None) if area_group else None
        row = {
            'sourceListingId': match.group(1),
            'sourceUrl': url,
            'title': part(card, r'<h2\s+class="prce"[^>]*>(.*?)</h2>'),
            'locationLabel': part(card, r'<p\s+class="add"[^>]*>(.*?)</p>') or None,
            'areaLabel': clean(area_item) or None,
            'priceLabel': price,
        }
        if not row['title'] or not row['priceLabel']:
            raise ValueError('Listing facts missing: ' + match.group(1))
        rows.append(row)
    results = re.search(r'([\d,]+)\s+results found', page, re.I)
    if not results:
        raise ValueError('Result total missing')
    last = re.findall(r'data-page="(\d+)"[^>]*id="last_page"|id="last_page"[^>]*data-page="(\d+)"', page, re.I)
    if not last:
        raise ValueError('Pagination end missing')
    return rows, int(results.group(1).replace(',', '')), max(int(x) for pair in last for x in pair if x)


def fetch(task):
    name, page = task
    path = '/properties' if name in ('first', 'second') else '/property-for-' + name.split('-')[1] + '/commercial'
    url = BASE + path + ('?page=' + str(page) if page > 1 else '')
    raw = subprocess.check_output(['curl', '-fLsS', '--retry', '2', '--max-time', '35', url], timeout=90)
    rows, count, total_pages = parse(raw)
    if not rows:
        raise ValueError('No listing cards on ' + url)
    receipt = {'page': page, 'url': url, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(), 'rows': len(rows)}
    return page, raw, rows, count, total_pages, receipt


def capture(name):
    page, raw, rows, count, total_pages, receipt = fetch((name, 1))
    if total_pages > 100 or count > 3000:
        raise ValueError('Capture bounds exceeded')
    results = [(page, raw, rows, count, total_pages, receipt)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results += list(pool.map(fetch, [(name, p) for p in range(2, total_pages + 1)]))
    results.sort(key=lambda value: value[0])
    if any(total != count or pages != total_pages for _, _, _, total, pages, _ in results):
        raise ValueError('Publisher pagination changed during capture')
    all_rows = [row for _, _, part_rows, _, _, _ in results for row in part_rows]
    ids = {row['sourceListingId'] for row in all_rows}
    if len(all_rows) != count or len(ids) != count:
        raise ValueError(f'Pagination mismatch: {name}: {len(all_rows)} rows, {len(ids)} ids, {count} results')
    OUT.mkdir(parents=True, exist_ok=True)
    for page, raw, _, _, _, _ in results:
        (OUT / f'{name}-page-{page:03d}.html.gz').write_bytes(gzip.compress(raw, mtime=0))
    manifest = {
        'listingIndex': BASE + ('/properties' if name in ('first', 'second') else '/property-for-' + name.split('-')[1] + '/commercial'),
        'retrievedAt': datetime.now(timezone.utc).isoformat(),
        'sourceRows': count,
        'distinctSourceIds': len(ids),
        'expectedPages': total_pages,
        'capturedPages': len(results),
        'pages': [receipt for *_, receipt in results],
    }
    (OUT / (name + '-rows.json')).write_text(json.dumps(all_rows, ensure_ascii=False, indent=2) + '\n')
    (OUT / (name + '-manifest.json')).write_text(json.dumps(manifest, indent=2) + '\n')
    print(name, count, 'rows', total_pages, 'pages', flush=True)
    return all_rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--scope', choices=('all', 'full', 'commercial'), default='all')
    parser.add_argument('--reparse', action='store_true', help='Reparse the already receipted local HTML without refetching')
    args = parser.parse_args()
    names = (['first', 'second'] if args.scope in ('all', 'full') else []) + ([f'commercial-{kind}-{pass_name}' for kind in ('rent', 'sale') for pass_name in ('first', 'second')] if args.scope in ('all', 'commercial') else [])
    if args.reparse:
        data = {}
        for name in names:
            manifest = json.loads((OUT / (name + '-manifest.json')).read_text())
            rows = []
            for receipt in manifest['pages']:
                raw = gzip.decompress((OUT / f'{name}-page-{receipt["page"]:03d}.html.gz').read_bytes())
                if len(raw) != receipt['bytes'] or hashlib.sha256(raw).hexdigest() != receipt['sha256']:
                    raise ValueError('Captured HTML checksum failed')
                page_rows, count, pages = parse(raw)
                if count != manifest['sourceRows'] or pages != manifest['expectedPages']:
                    raise ValueError('Captured HTML pagination changed')
                rows.extend(page_rows)
            if len(rows) != manifest['sourceRows'] or len({r['sourceListingId'] for r in rows}) != len(rows):
                raise ValueError('Reparsed row count mismatch')
            (OUT / (name + '-rows.json')).write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n')
            data[name] = rows
            print('reparsed', name, len(rows), flush=True)
    else:
        data = {name: capture(name) for name in names}
    for prefix in ('', 'commercial-rent-', 'commercial-sale-'):
        first, second = prefix + 'first', prefix + 'second'
        if first in data and data[first] != data[second]:
            raise ValueError(first + ' and ' + second + ' facts differ')
    if 'first' in data and 'commercial-rent-first' in data:
        full = {row['sourceListingId']: row for row in data['first']}
        for kind in ('rent', 'sale'):
            for row in data[f'commercial-{kind}-first']:
                if full.get(row['sourceListingId']) != row:
                    raise ValueError('Category and full index differ: ' + row['sourceListingId'])
    print('Independent factual captures matched; no images retained', flush=True)


if __name__ == '__main__':
    main()
