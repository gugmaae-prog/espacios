#!/usr/bin/env python3
"""Pin Dubai Data's licensed Ejari rent aggregates without inventing missing rents."""

import csv
import hashlib
import json
import pathlib
import sys
from decimal import Decimal
from urllib.parse import urlparse


ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/uae-evidence/dubai'
COMMUNITIES = OUT / 'ejari-community-rents-source-20261101.csv'
BEDROOMS = OUT / 'ejari-community-bedrooms-source-20261101.csv'
DATA = OUT / 'ejari-community-rents-20261101.json'
REPORT = OUT / 'ejari-community-rents-validation.json'
SOURCE_COMMIT = '28fcfe459d3bf135a2e266dcdacdbe9575cf2ea7'
SOURCE_ID = 'datadubai-dld-ejari-community-rents-20261101'
EXPECTED_SOURCE_HASHES = {
    'communities': '0d0ef0d66da68a45867b8219c0be1efb8b83299ef3e1658f0eb6e2f60cdff213',
    'bedrooms': '623a99aec05b8959ab698ec742d45d18e5b58851a7b96396a4ca13cc72423b79',
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def source_rows(path, expected_hash, columns):
    raw = path.read_bytes()
    if digest(raw) != expected_hash:
        raise ValueError(f'Source checksum changed: {path}')
    reader = csv.DictReader(raw.decode('utf-8-sig').splitlines())
    if reader.fieldnames != columns:
        raise ValueError(f'Source columns changed: {path}')
    return raw, list(reader)


def money(value):
    if not value:
        return None
    parsed = Decimal(value)
    if not parsed.is_finite() or parsed <= 0 or parsed > 10_000_000 or parsed.as_tuple().exponent < -2:
        raise ValueError(f'Invalid annual rent median: {value}')
    return int(parsed) if parsed == parsed.to_integral_value() else float(parsed)


def source_url(url, allow_blank=False):
    if not url and allow_blank:
        return None
    parsed = urlparse(url)
    if parsed.scheme != 'https' or parsed.netloc != 'datadubai.ae' or not parsed.path.startswith('/communities/'):
        raise ValueError(f'Unexpected publisher URL: {url}')
    return url


community_raw, community_input = source_rows(
    COMMUNITIES, EXPECTED_SOURCE_HASHES['communities'],
    ['name', 'url', 'contracts', 'rent_median', 'yield_pct'],
)
bedroom_raw, bedroom_input = source_rows(
    BEDROOMS, EXPECTED_SOURCE_HASHES['bedrooms'],
    ['community', 'community_slug', 'code', 'label', 'slug', 'n', 'quality',
     'price_median', 'psf_median', 'sqft_median', 'rent_median', 'n_rents', 'yield_pct', 'url'],
)

communities = []
for row in community_input:
    url = source_url(row['url'])
    slug = urlparse(url).path.strip('/').split('/')[-1]
    count = int(row['contracts'])
    median = money(row['rent_median'])
    if not row['name'].strip() or count < 20 or median is None or not slug:
        raise ValueError('Invalid community rent row')
    communities.append({
        'communityName': row['name'], 'communitySlug': slug,
        'contractCount': count, 'medianAnnualRentAed': median, 'publisherUrl': url,
    })

bedrooms = []
for row in bedroom_input:
    count = int(row['n_rents'])
    median = money(row['rent_median'])
    if not row['community'].strip() or not row['community_slug'].strip() or row['code'] not in {'Studio', '1 B/R', '2 B/R', '3 B/R', '4 B/R', '5 B/R'} or count < 0:
        raise ValueError('Invalid bedroom rent row')
    if (count < 5) != (median is None):
        raise ValueError('Bedroom rent threshold mismatch')
    bedrooms.append({
        'communityName': row['community'], 'communitySlug': row['community_slug'],
        'bedroomCode': row['code'], 'publisherBedroomLabel': row['label'],
        'contractCount': count, 'medianAnnualRentAed': median,
        'sampleStatus': 'withheld_below_5' if count < 5 else 'low_5_to_19' if count < 20 else 'published_20_plus',
        'publisherUrl': source_url(row['url'], allow_blank=True),
    })

if len(communities) != 102 or len(bedrooms) != 418:
    raise ValueError('Source population changed')
if len({row['communitySlug'] for row in communities}) != 102:
    raise ValueError('Duplicate community rent identity')
if len({(row['communitySlug'], row['bedroomCode']) for row in bedrooms}) != 418:
    raise ValueError('Duplicate bedroom rent identity')
if sum(row['contractCount'] for row in communities) != 304464 or sum(row['contractCount'] for row in bedrooms) != 286628:
    raise ValueError('Rent contract totals changed')
if sum(row['medianAnnualRentAed'] is None for row in bedrooms) != 66:
    raise ValueError('Suppressed bedroom rent total changed')
if any(row['contractCount'] or row['medianAnnualRentAed'] is not None for row in bedrooms if row['communitySlug'] == 'palm-jabal-ali'):
    raise ValueError('Palm Jabal Ali rent evidence changed')

data = {
    'sourceId': SOURCE_ID,
    'sourceCommit': SOURCE_COMMIT,
    'communityRows': communities,
    'bedroomRows': bedrooms,
}
data_bytes = (json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
report = {
    'sourceId': SOURCE_ID,
    'publisher': 'Dubai Data / Continental Club Property; based on Dubai Land Department Ejari open data',
    'sourceUrl': f'https://huggingface.co/datasets/datadubai/dubai-real-estate-dld/tree/{SOURCE_COMMIT}',
    'methodologyUrl': 'https://datadubai.ae/methodology/',
    'originalSourceUrl': 'https://dubailand.gov.ae/en/open-data/real-estate-data/',
    'license': 'CC BY 4.0; derived subset with attribution',
    'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/',
    'sourceCommit': SOURCE_COMMIT,
    'sourceRepositoryUpdatedAt': '2026-11-01T22:06:05Z',
    'sourceDataThrough': '2026-10-29',
    'sourceWindow': 'Publisher trailing 12 complete months; inferred October 2025–September 2026 from source data-through date. CSV has no explicit observation dates.',
    'sourceCsvSha256': EXPECTED_SOURCE_HASHES,
    'sourceCsvBytes': {'communities': len(community_raw), 'bedrooms': len(bedroom_raw)},
    'dataSha256': digest(data_bytes), 'dataBytes': len(data_bytes),
    'communityRows': len(communities), 'bedroomRows': len(bedrooms),
    'communityContracts': sum(row['contractCount'] for row in communities),
    'bedroomContracts': sum(row['contractCount'] for row in bedrooms),
    'bedroomMediansWithheld': sum(row['medianAnnualRentAed'] is None for row in bedrooms),
    'bedroomLowSampleMedians': sum(row['sampleStatus'] == 'low_5_to_19' for row in bedrooms),
    'palmJabalAliBedroomRows': sum(row['communitySlug'] == 'palm-jabal-ali' for row in bedrooms),
    'palmJabalAliRentContracts': sum(row['contractCount'] for row in bedrooms if row['communitySlug'] == 'palm-jabal-ali'),
    'excludedSourceColumns': ['yield_pct', 'n', 'quality', 'price_median', 'psf_median', 'sqft_median'],
    'limits': 'Publisher community aggregates mix unspecified home types and include renewals. The two views overlap and their contract counts must not be summed. These are registered single-property Ejari contract rents, not current asking rents, commercial-space rents, unit availability, valuations, forecasts, or exact property coordinates. Bedroom labels are publisher labels; the CSV does not encode property class. Null medians mean fewer than five contracts, not zero rent. Source window dates are inferred from the publisher rule, not carried in the CSV.',
}
report_bytes = (json.dumps(report, ensure_ascii=False, indent=2) + '\n').encode()

if '--check' in sys.argv:
    if DATA.read_bytes() != data_bytes or REPORT.read_bytes() != report_bytes:
        raise ValueError('Dubai Ejari rent output changed')
else:
    DATA.write_bytes(data_bytes)
    REPORT.write_bytes(report_bytes)
print(json.dumps({'passed': True, 'communities': len(communities), 'bedrooms': len(bedrooms), 'mediansWithheld': report['bedroomMediansWithheld']}))
