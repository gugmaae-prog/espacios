#!/usr/bin/env python3
"""Prepare exact-label DLD-derived master-community sale context.

The source's master_project_name is a broad native label, not a community ID.
Rows are therefore linked as community_context with identityVerified=false.
"""
import argparse
import collections
import csv
import gzip
import hashlib
import json
import pathlib
import shutil
import statistics

import duckdb

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = ROOT / 'data/historical-intelligence'
SOURCE_ID = 'v19-dred-sales-20261005'
SOURCE_COMMIT = 'a2c9d1c447e4db0416c2badcda8c1b4011f6e677'
SOURCE_SHA256 = '73be9631af185f4ba599ea299752deecdb137cbbe36c0afb95abc5e186d8b5e1'
SOURCE_URL = f'https://huggingface.co/datasets/dubairealestatedata/dubai-real-estate-sales-transactions/resolve/{SOURCE_COMMIT}/dld_sales_transactions.parquet'
DATE_BASIS = 'DLD instance_date: registration date; not asserted to be contract execution, transfer, or first-sale date.'
SCOPE = 'community_context'
FIELDS = [
    'Series ID', 'Record ID', 'Metric', 'Frequency', 'Unit', 'Class', 'Source ID', 'Source URL',
    'Published date', 'Geography', 'Emirate', 'Segment', 'Label', 'Registration', 'Source area ID',
    'Endpoint', 'Period', 'Value', 'Sample rows', 'Quality', 'P25', 'P75', 'Eligible value AED',
    'Gross yield pct', 'Blocked rows', 'Raw source emirate', 'Observation basis', 'Native row JSON',
    'Source observation ID', 'Observation kind', 'Transaction kind', 'Procedure ID', 'Procedure name',
]
QUALITY_FILTER = "quality_flags=0 AND procedure_id IN (11,41,102) AND usage_label='Residential' AND ((property_type_label='Unit' AND property_sub_type='Flat') OR (property_type_label='Villa' AND (property_sub_type IS NULL OR property_sub_type='Villa'))) AND transaction_id IS NOT NULL AND instance_date IS NOT NULL AND area_id IS NOT NULL AND price_aed>0 AND area_sqm>0 AND price_psf>0"
IDENTITY_BASIS = (
    "The DRED dataset's native master_project_name exactly case-insensitively matches one unique Dubai catalogue community name. "
    "This is source-labelled master-community context, not a native DLD community ID or verified boundary, does not identify a building or project, "
    "and does not prove first-ever sale or continuous history. Rows retain each native DLD area ID/name."
)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def file_sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def stable_series_id(record_id, master_name, area_id, dimensions, kind):
    raw = json.dumps([record_id, master_name, area_id, *dimensions, kind], ensure_ascii=False, separators=(',', ':')).encode()
    return 'v20-dred-master-' + kind + '-' + sha(raw)[:24]


def normalized_registration(value):
    return 'Off-Plan Properties' if value == 'Off-Plan' else 'Ready Properties' if value == 'Ready' else value


def segment(property_type, subtype):
    return f'Residential | {property_type}' + (f' | native subtype: {subtype}' if subtype else '')


def percentile(values, p):
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    position = (len(ordered) - 1) * p
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    weight = position - lower
    return ordered[lower] * (1 - weight) + ordered[upper] * weight


def output_row(series_id, record_id, registration, procedure_id, procedure_name, property_type,
               subtype, master_name, area_id, period, value, sample_count, quality, p25, p75,
               total_aed, native, kind, source_observation_id=''):
    return {
        'Series ID': series_id, 'Record ID': record_id, 'Metric': 'price',
        'Frequency': 'daily' if kind == 'transaction' else 'monthly', 'Unit': 'AED/sqft',
        'Class': 'registered transaction', 'Source ID': SOURCE_ID, 'Source URL': SOURCE_URL,
        'Published date': '2026-10-05T09:28:01Z', 'Geography': master_name, 'Emirate': 'Dubai',
        'Segment': segment(property_type, subtype),
        'Label': f'DRED master-community context · area {area_id} · {registration} · {procedure_name}',
        'Registration': normalized_registration(registration), 'Source area ID': area_id, 'Endpoint': SOURCE_URL,
        'Period': period, 'Value': '' if value is None else value,
        'Sample rows': '' if sample_count is None else sample_count, 'Quality': quality,
        'P25': '' if p25 is None else p25, 'P75': '' if p75 is None else p75,
        'Eligible value AED': '' if total_aed is None else total_aed, 'Gross yield pct': '', 'Blocked rows': 0,
        'Raw source emirate': 'Dubai',
        'Observation basis': (DATE_BASIS + ' Monthly medians retain this DRED master-community label and one native DLD area ID. '
                              'Community-context series may overlap a narrower official-area history; do not sum cross-scope counts.')
                             if kind == 'aggregate' else DATE_BASIS,
        'Native row JSON': json.dumps(native, ensure_ascii=False, separators=(',', ':'), sort_keys=True),
        'Source observation ID': source_observation_id,
        'Observation kind': kind, 'Transaction kind': 'sale' if kind == 'transaction' else '',
        'Procedure ID': procedure_id, 'Procedure name': procedure_name,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=pathlib.Path, default=ROOT / '.local-data/dld-sales-refresh-20261007/dld_sales_transactions.parquet')
    parser.add_argument('--snapshot', type=pathlib.Path, default=ROOT / 'data/historical-intelligence-20261003.json')
    parser.add_argument('--existing-pass43', type=pathlib.Path, default=BASE / 'v19-dred-registered-history-e51d54df3c446b169ca24d1bd821f5308f795c07385aba0c3cc50b5c966febb2.csv.gz')
    parser.add_argument('--output', type=pathlib.Path, default=BASE / 'v20-dred-master-community-monthly-history.csv.gz')
    parser.add_argument('--sidecar', type=pathlib.Path, default=BASE / 'community-master-context-enrichment.json')
    args = parser.parse_args()
    if sha(args.source.read_bytes()) != SOURCE_SHA256:
        raise SystemExit('Source parquet checksum differs from the pinned CC BY 4.0 dataset snapshot.')

    snapshot = json.loads(args.snapshot.read_text())
    if snapshot.get('version') != '20261007-enrichment-v19' or len(snapshot.get('records', [])) != 1860:
        raise SystemExit('The source identity baseline must be the fixed production V19 snapshot.')
    sources = {source['id']: source for source in snapshot['sources']}
    source = sources.get(SOURCE_ID)
    if not source or source.get('datasetVersion') != SOURCE_COMMIT or source.get('sha256') != SOURCE_SHA256:
        raise SystemExit('Pinned DRED publisher, version or checksum is absent from the reviewed source register.')

    communities = [record for record in snapshot['records'] if record.get('type') == 'community' and record.get('emirate') == 'Dubai']
    by_label = collections.defaultdict(list)
    for record in communities:
        by_label[record['name'].strip().casefold()].append(record)
    if any(len(rows) != 1 for rows in by_label.values()):
        raise SystemExit('Dubai community names are not unique for an exact source-label join.')

    existing = set()
    if not args.existing_pass43.is_file():
        raise SystemExit(f'Missing previous immutable DRED pass: {args.existing_pass43}')
    with gzip.open(args.existing_pass43, 'rt', encoding='utf-8', newline='') as stream:
        for row in csv.DictReader(stream):
            if row['Observation kind'] == 'transaction' and row['Record ID'].startswith('community:'):
                existing.add((row['Record ID'], row['Source observation ID']))
    for record in communities:
        for observation in record.get('observations', []):
            if observation.get('sourceId') == SOURCE_ID and observation.get('transactionId'):
                existing.add((record['id'], observation['transactionId']))

    db = duckdb.connect(':memory:')
    db.execute('CREATE TEMP TABLE community_labels(master_label VARCHAR, record_id VARCHAR)')
    db.executemany('INSERT INTO community_labels VALUES (?,?)', [(key, rows[0]['id']) for key, rows in by_label.items()])
    source_path = str(args.source).replace("'", "''")
    query = f"""SELECT n.record_id, d.transaction_id, d.instance_date, d.area_id, d.area_name_en,
        d.project_name, d.master_project_name, d.building_name, d.property_type_label,
        d.property_sub_type, d.usage_label, d.rooms_bucket, d.has_parking, d.area_sqm,
        d.price_aed, d.price_psf, d.reg_type_label, d.procedure_id, d.procedure_name_en, d.quality_flags
        FROM read_parquet('{source_path}') d
        JOIN community_labels n ON lower(trim(d.master_project_name))=n.master_label
        WHERE {QUALITY_FILTER}
        ORDER BY n.record_id, d.area_id, d.reg_type_label, d.procedure_id,
                 d.property_type_label, coalesce(d.property_sub_type,''), d.instance_date, d.transaction_id"""

    identity_links = {}
    monthly_groups = collections.defaultdict(list)
    matched_pairs = set()
    prior_overlap = collections.Counter()
    added_by_record = collections.Counter()
    matched_by_record = collections.Counter()
    all_dates = []
    all_area_ids = set()
    record_names = {record['id']: record['name'] for record in communities}
    output_csv = args.output.with_name(args.output.name + '.tmp.csv')
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    output_stream = output_csv.open('w', encoding='utf-8', newline='')
    writer = csv.DictWriter(output_stream, fieldnames=FIELDS, lineterminator='\n')
    writer.writeheader()
    cursor = db.execute(query)
    while True:
        batch = cursor.fetchmany(5000)
        if not batch:
            break
        for row in batch:
            (record_id, transaction_id, date, area_id, area_name, project_name, master_name,
             building, property_type, subtype, usage, rooms, parking, area_sqm, price_aed,
             price_psf, registration, procedure_id, procedure_name, quality_flags) = row
            name = record_names[record_id]
            if str(master_name).strip().casefold() != name.strip().casefold():
                raise SystemExit(f'Non-exact native master label in transaction {transaction_id}.')
            if not transaction_id or not date or int(quality_flags) != 0 or usage != 'Residential':
                raise SystemExit(f'Invalid transaction {transaction_id} passed the source filter.')
            if property_type == 'Unit' and subtype != 'Flat':
                raise SystemExit(f'Unexpected unit subtype in transaction {transaction_id}.')
            if property_type == 'Villa' and subtype not in (None, 'Villa'):
                raise SystemExit(f'Unexpected villa subtype in transaction {transaction_id}.')
            pair = (record_id, str(transaction_id))
            if pair in matched_pairs:
                raise SystemExit('One DLD transaction fans out to multiple matching community records.')
            matched_pairs.add(pair)
            matched_by_record[record_id] += 1
            all_dates.append(str(date))
            all_area_ids.add(int(area_id))
            dimensions = (str(registration), int(procedure_id), str(procedure_name), str(property_type), subtype or '')
            cohort = (record_id, str(master_name), int(area_id), str(area_name), dimensions)
            month = str(date)[:7]
            monthly_groups[(cohort, month)].append((float(price_psf), int(price_aed)))
            if pair in existing:
                prior_overlap[record_id] += 1
                continue
            added_by_record[record_id] += 1

    if len(matched_pairs) != 561282 or len(existing & matched_pairs) != 67268:
        raise SystemExit(f'Unexpected exact-label/source overlap counts: {(len(matched_pairs), len(existing & matched_pairs))}.')
    if len({transaction_id for _, transaction_id in matched_pairs}) != 561282:
        raise SystemExit('Source transaction IDs are duplicated within the matched community population.')
    new_pairs = matched_pairs - existing
    if len(new_pairs) != 494014 or len(added_by_record) != 44:
        raise SystemExit(f'Unexpected new community-context additions: {(len(new_pairs), len(added_by_record))}.')

    monthly_rows = 0
    monthly_withheld = 0
    monthly_by_record = collections.Counter()
    for ((record_id, master_name, area_id, area_name, dimensions), period), observations in sorted(monthly_groups.items(), key=lambda item: (item[0][0], item[0][1])):
        # A master label that adds no distinct transaction link (Palm Jumeirah)
        # is already represented by the exact official-area series and is omitted.
        if record_id not in added_by_record:
            continue
        registration, procedure_id, procedure_name, property_type, subtype = dimensions
        values = [value for value, _ in observations]
        count = len(values)
        med = statistics.median(values) if count >= 20 else None
        p25 = percentile(values, .25) if count >= 20 else None
        p75 = percentile(values, .75) if count >= 20 else None
        total_aed = sum(total for _, total in observations)
        monthly_id = stable_series_id(record_id, master_name, area_id, dimensions, 'monthly')
        native = {
            'aggregation': 'median of DRED source-reported AED/sqft registered sale rows',
            'minimumMedianSample': 20,
            'transactionCount': count,
            'registration': normalized_registration(registration),
            'procedureId': int(procedure_id),
            'procedureName': procedure_name,
            'propertyType': property_type,
            'propertySubtype': subtype or None,
            'sourceAreaId': int(area_id),
            'sourceAreaName': area_name,
            'sourceMasterProjectName': master_name,
            'publishedVintageOnly': True,
            'firstAvailableAt': source['firstAvailableAt'],
            'geographyOverlapWarning': 'This source-label community context can overlap a narrower exact official-area history; do not sum counts across scopes.',
        }
        identity_links[monthly_id] = {
            'seriesId': monthly_id, 'recordId': record_id, 'scope': SCOPE,
            'identityVerified': False, 'identitySourceIds': [SOURCE_ID], 'identityBasis': IDENTITY_BASIS,
        }
        writer.writerow(output_row(
            monthly_id, record_id, registration, int(procedure_id), procedure_name,
            property_type, subtype, master_name, area_id, period, med, count,
            'sample >=20 and positive median' if med and med > 0 else 'withheld median: sparse/invalid',
            p25, p75, total_aed, native, 'aggregate',
        ))
        monthly_rows += 1
        monthly_by_record[record_id] += 1
        monthly_withheld += int(med is None or med <= 0)

    output_stream.flush()
    output_stream.close()
    uncompressed_hash = file_sha(output_csv)
    uncompressed_bytes = output_csv.stat().st_size
    compressed_tmp = args.output.with_name(args.output.name + '.tmp.gz')
    with output_csv.open('rb') as input_stream, compressed_tmp.open('wb') as compressed_stream:
        with gzip.GzipFile(filename='', fileobj=compressed_stream, mode='wb', compresslevel=9, mtime=0) as gz:
            shutil.copyfileobj(input_stream, gz, length=1024 * 1024)
    output_hash = file_sha(compressed_tmp)
    if args.output.exists():
        if file_sha(args.output) != output_hash:
            raise SystemExit('Immutable pass44 history file exists with different bytes.')
        compressed_tmp.unlink()
    else:
        compressed_tmp.replace(args.output)
    output_csv.unlink()
    compressed_bytes = args.output.stat().st_size
    relative = args.output.resolve().relative_to(BASE.resolve()).as_posix()
    if '/' in relative:
        raise SystemExit('The history loader requires an immutable direct input under data/historical-intelligence/.')

    record_research = []
    for record_id, count in sorted(added_by_record.items()):
        record_research.append({
            'recordId': record_id,
            'collectionPass': 'pass44-dred-master-community-context',
            'collectionStatus': 'exact_native_master_project_label_community_context',
            'sourceIds': [SOURCE_ID],
            'identityVerified': False,
            'newSourceTransactionsAtRecord': count,
            'matchedSourceTransactionsForFullMasterLabel': matched_by_record[record_id],
            'monthlyCohortPointCount': monthly_by_record[record_id],
            'masterLabelMatched': record_names[record_id],
        })
    # The sorted source date range is global and remains an observation window,
    # not a claim that any record has continuous or complete history.
    first_date, last_date = min(all_dates), max(all_dates)
    sidecar = {
        'schemaVersion': 1,
        'passId': 'pass44-dred-master-community-context',
        'asOf': '2026-10-08',
        'sources': [],
        'facts': [],
        'seriesLinks': [identity_links[key] for key in sorted(identity_links)],
        'historyInputs': [{
            'id': 'v20-dred-master-community-history', 'sourceId': SOURCE_ID, 'path': relative,
            'sha256': output_hash, 'uncompressedSHA256': uncompressed_hash, 'compression': 'gzip',
            'format': 'csv', 'rowCount': monthly_rows,
            'firstAvailableAt': source['firstAvailableAt'],
            'note': 'Exact native DRED master_project_name matches are retained as unverified community context; individual duplicate transaction links are omitted while full master-label monthly summaries preserve their full sample.',
        }],
        'licensedArchives': [], 'additionalDatasets': [], 'recordResearch': record_research,
        'collection': {
            'passId': 'pass44-dred-master-community-context', 'sourceId': SOURCE_ID,
            'sourceCommit': SOURCE_COMMIT, 'sourceFileSHA256': SOURCE_SHA256,
            'matchedExactNameCommunities': len({row[0] for row in matched_pairs}),
            'matchedSourceTransactionRows': len(matched_pairs),
            'existingRecordTransactionPairsDeduplicated': len(existing & matched_pairs),
            'newSourceTransactionsAtRecordNotPreviouslyLinked': len(new_pairs),
            'sourceTransactionsRepresentedInFullMasterLabelCohorts': len(matched_pairs),
            'transactionLevelRowsReAdded': 0,
            'newCommunityRecords': len(added_by_record),
            'communityRowsWithUsablePriceAndSize': len(matched_pairs),
            'monthlyAggregateRows': monthly_rows,
            'monthlyMedianWithheldForSparseSamples': monthly_withheld,
            'recordObservedDateEnvelope': {'start': first_date, 'end': last_date},
            'qualityFilters': {
                'qualityFlags': 0, 'procedures': [11, 41, 102], 'usage': 'Residential',
                'propertyTypes': ['Unit / Flat', 'Villa / subtype Villa or missing'],
                'validPriceAndAreaRequired': True,
            },
            'communityIdentity': 'exact case-insensitive trimmed DRED master_project_name to one unique Dubai catalogue community; context only; not a native DLD community ID or verified boundary',
            'matchedExactNameCommunities': len({record_id for record_id, _ in matched_pairs}),
            'dateBasis': DATE_BASIS,
            'monthlyMethod': {'statistic': 'median AED/sqft', 'minimumSample': 20, 'sparseMedian': 'withheld; source rows and counts remain', 'mixAdjustment': False},
            'overlapPolicy': 'Exact record + transaction-ID duplicates from prior community series are not re-added as individual transactions. Monthly master-label summaries use the full eligible master-label population and are flagged as potentially overlapping narrower official-area community series.',
            'rawParquetRedistributed': False,
            'rawTransactionRowsRedistributed': False,
        },
        'methodology': (
            'A pinned CC BY 4.0 secondary DLD-derived transaction snapshot is joined only where its native master_project_name exactly matches one unique Dubai catalogue community name. '
            'This produces community_context (identityVerified=false), never a project or exact-boundary sale history. Each row retains the native DLD area ID/name, project/building labels, property and registration fields. '
            'Quality-zero Residential Unit/Flat and Villa sale rows with usable prices and areas are summarized; DLD instance_date is registration date. Monthly medians are split by master label, cadastral area, property type, registration and procedure; median hidden below 20 rows. '
            'Exact transaction IDs already represented by a narrower official-area history are not re-added; their values remain part of a broader master-label monthly sample where applicable. Raw transaction-level rows are not redistributed by this pass. '
            'Histories are latest-vintage descriptive evidence, not first-ever/continuous history, point-in-time forecast inputs, or causal event effects.'
        ),
    }
    args.sidecar.parent.mkdir(parents=True, exist_ok=True)
    rendered = json.dumps(sidecar, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n'
    if args.sidecar.exists() and args.sidecar.read_text() != rendered:
        raise SystemExit('Pass44 sidecar exists with different reviewed content.')
    args.sidecar.write_text(rendered)
    print(json.dumps({
        'sidecar': str(args.sidecar), 'historyInput': str(args.output), 'communityRecords': len(added_by_record),
        'matchedSourceTransactions': len(matched_pairs), 'priorPairsDeduplicated': len(existing & matched_pairs),
        'newTransactions': len(new_pairs), 'monthlyRows': monthly_rows, 'monthlySparseWithheld': monthly_withheld,
        'dateEnvelope': {'start': first_date, 'end': last_date}, 'identityScope': SCOPE,
        'gzipBytes': compressed_bytes, 'uncompressedBytes': uncompressed_bytes,
    }, sort_keys=True))


if __name__ == '__main__':
    main()
