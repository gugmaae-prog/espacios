#!/usr/bin/env python3
"""Prepare exact-key DLD-derived transaction histories without price invention."""
import argparse
import collections
import csv
import gzip
import hashlib
import io
import json
import pathlib
import statistics

import duckdb

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE_ID = 'v19-dred-sales-20261005'
SOURCE_COMMIT = 'a2c9d1c447e4db0416c2badcda8c1b4011f6e677'
SOURCE_SHA256 = '73be9631af185f4ba599ea299752deecdb137cbbe36c0afb95abc5e186d8b5e1'
SOURCE_URL = f'https://huggingface.co/datasets/dubairealestatedata/dubai-real-estate-sales-transactions/resolve/{SOURCE_COMMIT}/dld_sales_transactions.parquet'
AREA_SOURCE = 'dld-official-areas-20261002'
PROJECT_SOURCE = 'dld-official-transactions-20261003'
DATE_BASIS = 'DLD instance_date: registration date; not asserted to be contract execution, transfer, or first-sale date.'
SERIES_FIELDS = [
    'Series ID', 'Record ID', 'Metric', 'Frequency', 'Unit', 'Class', 'Source ID', 'Source URL',
    'Published date', 'Geography', 'Emirate', 'Segment', 'Label', 'Registration', 'Source area ID', 'Endpoint',
    'Period', 'Value', 'Sample rows', 'Quality', 'P25', 'P75', 'Eligible value AED', 'Gross yield pct',
    'Blocked rows', 'Raw source emirate', 'Observation basis', 'Native row JSON', 'Source observation ID',
    'Observation kind', 'Transaction kind', 'Procedure ID', 'Procedure name',
]
EMPTY_SNAPSHOT_VERSIONS = {'20261007-enrichment-v19'}


def read_json(path):
    return json.loads(path.read_text())


def digest(data):
    return hashlib.sha256(data).hexdigest()


def stable_series_id(record_id, key, dimensions, kind):
    raw = json.dumps([record_id, key, *dimensions, kind], ensure_ascii=False, separators=(',', ':')).encode()
    return 'v19-dred-' + kind + '-' + digest(raw)[:24]


def normalized_registration(value):
    return 'Off-Plan Properties' if value == 'Off-Plan' else 'Ready Properties' if value == 'Ready' else value


def flat_segment(property_type, subtype):
    return f'Residential | {property_type}' + (f' | native subtype: {subtype}' if subtype else '')


def native_transaction(row):
    (transaction_id, date, area_id, area_name, project_name, master_project, building,
     property_type, subtype, usage, rooms, parking, area_sqm, price_aed, price_psf,
     registration, procedure_id, procedure_name, quality_flags, record_id, scope, identity_basis) = row
    return {
        'transactionId': transaction_id,
        'instanceDate': str(date),
        'observationDateBasis': DATE_BASIS,
        'priceAED': int(price_aed),
        'priceAEDPerSqft': float(price_psf),
        'areaSqm': float(area_sqm),
        'roomsBucket': int(rooms) if rooms is not None else None,
        'hasParking': bool(parking) if parking is not None else None,
        'propertyType': property_type,
        'propertySubtype': subtype,
        'usage': usage,
        'registration': registration,
        'procedureId': int(procedure_id),
        'procedureName': procedure_name,
        'qualityFlags': int(quality_flags),
        'sourceAreaId': int(area_id),
        'sourceAreaName': area_name,
        'sourceProjectName': project_name,
        'sourceMasterProjectName': master_project,
        'sourceBuildingName': building,
        'recordId': record_id,
        'recordScope': scope,
        'identityBasis': identity_basis,
    }


def output_row(series_id, record_id, registration, procedure_id, procedure_name, segment, label,
               geography, area_id, period, value, sample_count, quality, p25, p75, total_aed,
               raw_emirate, observation_basis, native, observation_kind, source_observation_id=''):
    return {
        'Series ID': series_id, 'Record ID': record_id, 'Metric': 'price',
        'Frequency': 'daily' if observation_kind == 'transaction' else 'monthly', 'Unit': 'AED/sqft',
        'Class': 'registered transaction', 'Source ID': SOURCE_ID, 'Source URL': SOURCE_URL,
        'Published date': '2026-10-05T09:28:01Z', 'Geography': geography, 'Emirate': 'Dubai',
        'Segment': segment, 'Label': label, 'Registration': registration, 'Source area ID': area_id, 'Endpoint': SOURCE_URL,
        'Period': period, 'Value': '' if value is None else value,
        'Sample rows': '' if sample_count is None else sample_count, 'Quality': quality,
        'P25': '' if p25 is None else p25, 'P75': '' if p75 is None else p75,
        'Eligible value AED': '' if total_aed is None else total_aed, 'Gross yield pct': '', 'Blocked rows': 0,
        'Raw source emirate': raw_emirate, 'Observation basis': observation_basis,
        'Native row JSON': json.dumps(native, ensure_ascii=False, separators=(',', ':'), sort_keys=True),
        'Source observation ID': source_observation_id,
        'Observation kind': observation_kind, 'Transaction kind': 'sale' if observation_kind == 'transaction' else '',
        'Procedure ID': procedure_id, 'Procedure name': procedure_name,
    }


def percentile(values, p):
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    position = (len(ordered) - 1) * p
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    weight = position - lower
    return ordered[lower] * (1 - weight) + ordered[upper] * weight


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=pathlib.Path, default=ROOT / '.local-data/dld-sales-refresh-20261007/dld_sales_transactions.parquet')
    parser.add_argument('--snapshot', type=pathlib.Path, default=ROOT / 'data/historical-intelligence-20261003.json')
    parser.add_argument('--packet', type=pathlib.Path, default=ROOT / 'enrichment/v19/pass43-dred-cohort-history.json')
    parser.add_argument('--csv-gz', type=pathlib.Path)
    args = parser.parse_args()
    if not args.source.is_file():
        raise SystemExit(f'Missing reviewed public dataset snapshot: {args.source}')
    source_bytes = args.source.read_bytes()
    if digest(source_bytes) != SOURCE_SHA256:
        raise SystemExit('Parquet checksum differs from the pinned public dataset snapshot.')

    snapshot = read_json(args.snapshot)
    if snapshot.get('version') not in EMPTY_SNAPSHOT_VERSIONS or len(snapshot.get('records', [])) != 1860:
        raise SystemExit('Review the fixed 1,860-record identity baseline before this pass.')
    records = {row['id']: row for row in snapshot['records']}
    sources = {row['id']: row for row in snapshot['sources']}
    source = sources.get(SOURCE_ID)
    if not source or source.get('datasetVersion') != SOURCE_COMMIT or source.get('sha256') != SOURCE_SHA256:
        raise SystemExit('Pinned DRED provenance is absent or differs from the approved snapshot.')
    if AREA_SOURCE not in sources or PROJECT_SOURCE not in sources:
        raise SystemExit('Required official project/area identity proof sources are missing.')

    proof_candidates = collections.defaultdict(list)
    for record in snapshot['records']:
        if record.get('type') != 'project':
            continue
        for series in record.get('historySeries', []):
            if (series.get('scope') == 'subject' and series.get('identityVerified') is True
                    and series.get('sourceId') == PROJECT_SOURCE and series.get('metric') == 'price'
                    and series.get('sourceAreaId') is not None and series.get('geography')
                    and series.get('registration') == 'Off-Plan Properties'
                    and series.get('segment') == 'Residential | Unit | native subtype: Flat'):
                key = (str(series['geography']).strip().casefold(), int(series['sourceAreaId']))
                proof_candidates[key].append((record['id'], tuple(series.get('identitySourceIds', [])), series.get('identityBasis', '')))
    project_proofs = {}
    for key, candidates in proof_candidates.items():
        record_ids = {candidate[0] for candidate in candidates}
        proof_ids = {candidate[1] for candidate in candidates}
        bases = {candidate[2] for candidate in candidates}
        if len(record_ids) != 1 or len(proof_ids) != 1 or len(bases) != 1:
            raise SystemExit('Existing exact project-name/area identity key collides or has inconsistent official proof.')
        project_proofs[key] = (next(iter(record_ids)), list(next(iter(proof_ids))), next(iter(bases)))
    if len(project_proofs) != 238:
        raise SystemExit(f'Expected 238 exact project identity keys, received {len(project_proofs)}.')

    community_areas = {}
    for record in snapshot['records']:
        if record.get('type') != 'community':
            continue
        for series in record.get('historySeries', []):
            if (series.get('sourceId') == PROJECT_SOURCE and series.get('sourceAreaId') is not None
                    and series.get('geography')):
                area_id = int(series['sourceAreaId'])
                item = (record['id'], str(series['geography']), record['name'])
                previous = community_areas.get(area_id)
                if previous and previous != item:
                    raise SystemExit(f'Official DLD area ID {area_id} maps to multiple catalogue communities.')
                community_areas[area_id] = item
    if len(community_areas) != 8:
        raise SystemExit(f'Expected eight exact official community area IDs, received {len(community_areas)}.')

    db = duckdb.connect(':memory:')
    db.execute('CREATE TEMP TABLE verified_identities(project_name VARCHAR, area_id INTEGER, record_id VARCHAR)')
    db.executemany('INSERT INTO verified_identities VALUES (?, ?, ?)', [
        (name, area_id, proof[0]) for (name, area_id), proof in project_proofs.items()
    ])
    path = str(args.source).replace("'", "''")
    table = f"read_parquet('{path}')"
    columns = """transaction_id, instance_date, area_id, area_name_en, project_name, master_project_name,
        building_name, property_type_label, property_sub_type, usage_label, rooms_bucket, has_parking,
        area_sqm, price_aed, price_psf, reg_type_label, procedure_id, procedure_name_en, quality_flags"""
    type_filter = "((property_type_label='Unit' AND property_sub_type='Flat') OR property_type_label='Villa')"
    quality_filter = f"quality_flags=0 AND procedure_id IN (11,41,102) AND usage_label='Residential' AND {type_filter}"

    project_rows = db.execute(f"""SELECT p.{columns.replace(', ', ', p.')} , i.record_id
        FROM {table} p JOIN verified_identities i
          ON lower(trim(p.project_name))=i.project_name AND p.area_id=i.area_id
        WHERE p.{quality_filter} AND p.property_type_label='Unit' AND p.property_sub_type='Flat'
        ORDER BY i.record_id,p.project_name,p.area_id,p.reg_type_label,p.procedure_id,p.instance_date,p.transaction_id""").fetchall()
    project_key_count = len(project_proofs)
    project_record_counts = collections.Counter(row[-1] for row in project_rows)
    if len(project_rows) != 74586 or len({row[0] for row in project_rows}) != len(project_rows):
        raise SystemExit(f'Unexpected exact Flat project cohort: {len(project_rows)} rows.')

    community_ids = sorted(community_areas)
    community_rows = db.execute(f"""SELECT {columns},area_id,area_name_en FROM {table}
        WHERE area_id IN ({','.join(map(str, community_ids))}) AND {quality_filter}
        ORDER BY area_id,reg_type_label,procedure_id,property_type_label,coalesce(property_sub_type,''),instance_date,transaction_id""").fetchall()
    expected_names = {area_id: name.casefold() for area_id, (_, name, _) in community_areas.items()}
    if any(str(row[-1]).strip().casefold() != expected_names[int(row[-2])] for row in community_rows):
        raise SystemExit('An official DLD area ID returned an unexpected native area name.')
    if len(community_rows) != 134718 or len({row[0] for row in community_rows}) != len(community_rows):
        raise SystemExit(f'Unexpected exact mapped-community cohort: {len(community_rows)} rows.')

    existing_ids = collections.defaultdict(set)
    for record in snapshot['records']:
        for observation in record.get('observations', []):
            if observation.get('sourceId') == SOURCE_ID and observation.get('transactionId'):
                existing_ids[record['id']].add(observation['transactionId'])
    existing_project_rows = sum(row[0] in existing_ids[row[-1]] for row in project_rows)
    existing_community_rows = sum(row[0] in existing_ids[community_areas[int(row[2])][0]] for row in community_rows)
    if (existing_project_rows, existing_community_rows) != (8, 5):
        raise SystemExit(f'Unexpected already retained DRED rows by record: {(existing_project_rows, existing_community_rows)}.')

    identity_links = {}
    data_rows = []
    row_counts_by_record = collections.Counter()
    unique_project_ids = set()
    group_values = collections.defaultdict(list)

    def add_raw_rows(rows, record_type):
        for row in rows:
            (transaction_id, date, area_id, area_name, project_name, master_project, building,
             property_type, subtype, usage, rooms, parking, area_sqm, price_aed, price_psf,
             reg_type, procedure_id, procedure_name, quality_flags, *tail) = row
            record_id = tail[-1] if record_type == 'project' else community_areas[int(area_id)][0]
            scope = 'subject'
            registration = normalized_registration(reg_type)
            segment = flat_segment(property_type, subtype)
            if record_type == 'project':
                key = (str(project_name).strip().casefold(), int(area_id))
                proof = project_proofs.get(key)
                if not proof or proof[0] != record_id:
                    raise SystemExit(f'Exact project key not verified for transaction {transaction_id}.')
                identity_ids = proof[1]
                identity_basis = (
                    f"The row's exact DLD-derived project_name {project_name!r} and numeric area_id {area_id} match one of "
                    f"{project_key_count} existing official project identity keys for catalogue record {record_id}. "
                    'That key is anchored to previously reviewed DLD project/developer/area/transaction/building evidence. '
                    'The secondary distribution has no native project registration ID; historical applicability and first-ever sale remain unestablished.'
                )
                geography = project_name
                unique_project_ids.add(transaction_id)
            else:
                community_id, official_area_name, community_name = community_areas[int(area_id)]
                if record_id != community_id or str(area_name).strip().casefold() != official_area_name.casefold():
                    raise SystemExit(f'Exact official community area identity not verified for {transaction_id}.')
                identity_ids = [AREA_SOURCE]
                alias_note = ' The official native spelling is retained as the geography label.' if official_area_name.casefold() != community_name.casefold() else ''
                identity_basis = (
                    f"The row's numeric DLD area_id {area_id} and native area_name_en {area_name!r} match the official "
                    f"DLD area lookup and fixed catalogue community {record_id}.{alias_note} This proves community-area geography only; "
                    'it does not assign the sale to a particular building or project.'
                )
                geography = area_name
            if not all([transaction_id, date, area_id, price_aed, area_sqm, price_psf]) or min(float(price_aed), float(area_sqm), float(price_psf)) <= 0 or quality_flags != 0:
                raise SystemExit(f'Quality-zero eligible transaction is missing a usable price/size/date: {transaction_id}.')
            dimensions = (str(reg_type), int(procedure_id), property_type, subtype or '')
            cohort_source_name = str(project_name if record_type == 'project' else area_name)
            cohort_key = (record_id, cohort_source_name, int(area_id), dimensions)
            group_values[cohort_key].append((str(date)[:7], float(price_psf), row))
            year_dimension = ('year:' + str(date)[:4],)
            series_id = stable_series_id(record_id, (cohort_source_name, int(area_id)), dimensions + year_dimension, 'transactions')
            native = native_transaction((*row[:19], record_id, scope, identity_basis))
            if transaction_id not in existing_ids[record_id]:
                if series_id not in identity_links:
                    identity_links[series_id] = {
                        'seriesId': series_id, 'recordId': record_id, 'scope': scope, 'identityVerified': True,
                        'identitySourceIds': identity_ids, 'identityBasis': identity_basis,
                    }
                data_rows.append(output_row(
                    series_id, record_id, registration, int(procedure_id), procedure_name, segment,
                    f'DRED registered transactions · {str(date)[:4]} · {procedure_name}',
                    geography, int(area_id), str(date), float(price_psf), None,
                    'quality_flags=0; source-reported registered transaction; no aggregation or adjustment',
                    None, None, int(price_aed), 'Dubai', DATE_BASIS, native, 'transaction', transaction_id,
                ))
                row_counts_by_record[record_id] += 1

    add_raw_rows(project_rows, 'project')
    add_raw_rows(community_rows, 'community')

    monthly_groups = collections.defaultdict(list)
    for cohort_key, values in group_values.items():
        for period, price, row in values:
            monthly_groups[(cohort_key, period)].append((price, row))
    for (cohort_key, period), monthly_rows in sorted(monthly_groups.items(), key=lambda item: (str(item[0][0]), item[0][1])):
        record_id, source_name, area_id, dimensions = cohort_key
        reg_type, procedure_id, property_type, subtype = dimensions
        values = [item[0] for item in monthly_rows]
        source_rows = [item[1] for item in monthly_rows]
        count = len(values)
        median_value = statistics.median(values) if count >= 20 else None
        p25 = percentile(values, .25) if count >= 20 else None
        p75 = percentile(values, .75) if count >= 20 else None
        total_aed = sum(int(row[13]) for row in source_rows)
        registration = normalized_registration(reg_type)
        geography = source_name
        segment = flat_segment(property_type, subtype)
        monthly_id = stable_series_id(record_id, (source_name, area_id), dimensions, 'monthly')
        # The transaction cohort and its monthly summary share one exact identity proof.
        raw_id = stable_series_id(record_id, (source_name, area_id), dimensions + ('year:' + period[:4],), 'transactions')
        link = identity_links.get(raw_id)
        if not link:
            # All transactions may already be represented as individual facts; recover the same proof.
            if record_id.startswith('project:'):
                proof = project_proofs.get((source_name.strip().casefold(), int(area_id)))
                if not proof or proof[0] != record_id:
                    raise SystemExit('Monthly project summary has no exact identity proof.')
                ids = proof[1]
                basis = f"Exact DLD-derived project_name {source_name!r} and area_id {area_id} match one previously verified project identity key for {record_id}; monthly values summarize source transactions and do not establish first-ever sale or complete lifetime history."
            else:
                ids = [AREA_SOURCE]
                community_id, official_name, community_name = community_areas[int(area_id)]
                basis = f"Exact DLD area_id {area_id} and native area name {official_name!r} match official DLD area evidence for {community_name}; this is community-area evidence, not a building assignment."
            link = {'recordId': record_id, 'scope': 'subject', 'identityVerified': True, 'identitySourceIds': ids, 'identityBasis': basis}
        identity_links[monthly_id] = {'seriesId': monthly_id, **{k: v for k, v in link.items() if k != 'seriesId'}}
        native = {
            'aggregation': 'median of DRED source-reported AED/sqft transaction rows',
            'minimumMedianSample': 20,
            'transactionCount': count,
            'registration': registration,
            'procedureId': int(procedure_id),
            'procedureName': source_rows[0][17] if source_rows else None,
            'propertyType': property_type,
            'propertySubtype': subtype or None,
            'sourceAreaId': int(area_id),
            'sourceGeography': geography,
            'publishedVintageOnly': True,
            'firstAvailableAt': source['firstAvailableAt'],
        }
        data_rows.append(output_row(
            monthly_id, record_id, registration, int(procedure_id), native['procedureName'], segment,
            f'DRED monthly median · {registration} · {native["procedureName"]}',
            geography, int(area_id), period, median_value, count,
            'sample >=20 and positive median' if count >= 20 and median_value and median_value > 0 else 'withheld median: sparse/invalid',
            p25, p75, total_aed, 'Dubai',
            'Monthly median of individual registered sale rows in one exact project/area, registration, procedure and property-type cohort; no quality adjustment or mix adjustment. Median withheld below 20 rows.',
            native, 'aggregate',
        ))

    data_rows.sort(key=lambda row: (row['Record ID'], row['Series ID'], row['Period'], row['Source observation ID']))
    output = io.StringIO(newline='')
    writer = csv.DictWriter(output, fieldnames=SERIES_FIELDS, lineterminator='\n')
    writer.writeheader()
    writer.writerows(data_rows)
    csv_bytes = output.getvalue().encode('utf-8')
    compressed = gzip.compress(csv_bytes, compresslevel=9, mtime=0)
    compressed_sha = digest(compressed)
    csv_path = args.csv_gz or ROOT / 'data/historical-intelligence' / f'v19-dred-registered-history-{compressed_sha}.csv.gz'
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    if csv_path.exists() and csv_path.read_bytes() != compressed:
        raise SystemExit('Immutable compressed transaction history already exists with different bytes.')
    csv_path.write_bytes(compressed)
    relative = csv_path.resolve().relative_to((ROOT / 'data/historical-intelligence').resolve()).as_posix()
    if '/' in relative:
        raise SystemExit('The historical series loader requires a direct immutable input under data/historical-intelligence/.')

    actual_series_rows = sum(1 for row in data_rows if row['Observation kind'] == 'transaction')
    aggregate_rows = len(data_rows) - actual_series_rows
    aggregate_withheld = sum(row['Quality'] == 'withheld median: sparse/invalid' for row in data_rows if row['Observation kind'] == 'aggregate')
    project_matches = set(unique_project_ids)
    community_matches = {row[0] for row in community_rows}
    project_community_overlap = len(project_matches & community_matches)
    existing_unique = {transaction for ids in existing_ids.values() for transaction in ids}
    union_ids = project_matches | community_matches
    project_additions = sum(row_counts_by_record[rid] for rid in row_counts_by_record if rid.startswith('project:'))
    community_additions = sum(row_counts_by_record[rid] for rid in row_counts_by_record if rid.startswith('community:'))
    by_record = collections.defaultdict(dict)
    for link in identity_links.values():
        record_id = link['recordId']
        by_record[record_id].setdefault('sourceIds', set()).update(link['identitySourceIds'])
    for row in project_rows:
        by_record[row[-1]].setdefault('acceptedTransactionObservationCount', 0)
    for record_id, count in row_counts_by_record.items():
        by_record[record_id]['acceptedTransactionObservationCount'] = count

    research = []
    for record_id, info in sorted(by_record.items()):
        record = records[record_id]
        status = 'exact_project_registered_sale_series' if record['type'] == 'project' else 'exact_dld_community_area_registered_sale_series'
        research.append({
            'recordId': record_id, 'collectionPass': 'pass43-dred-cohort-history',
            'collectionStatus': status, 'sourceIds': [SOURCE_ID, *sorted(info.get('sourceIds', set()))],
            'acceptedTransactionObservationCount': int(info.get('acceptedTransactionObservationCount', 0)),
        })

    collection = {
        'passId': 'pass43-dred-cohort-history', 'sourceId': SOURCE_ID, 'sourceCommit': SOURCE_COMMIT,
        'sourceFileSHA256': SOURCE_SHA256, 'sourceRows': 1372277, 'sourceUniqueTransactionIds': 1372277,
        'exactProjectIdentityKeysReviewed': project_key_count,
        'exactProjectRecordsWithResidentialUnitOrVillaSales': len(project_record_counts),
        'exactResidentialUnitOrVillaSaleRowsInSource': len(project_rows),
        'projectRowsRetainedBeforePass': existing_project_rows,
        'projectTransactionRowsAddedAsNativeSeries': project_additions,
        'exactCommunityAreaKeysReviewed': len(community_areas),
        'communityAreasWithEligibleResidentialRows': len({row[-2] for row in community_rows}),
        'exactCommunityAreaSaleRowsInSource': len(community_rows),
        'communityRowsRetainedBeforePass': existing_community_rows,
        'communityTransactionRowsAddedAsNativeSeries': community_additions,
        'projectCommunityTransactionIdOverlap': project_community_overlap,
        'combinedUniqueTransactionIds': len(union_ids),
        'uniqueTransactionIdsPreviouslyRetained': len(existing_unique & union_ids),
        'newUniqueTransactionIdsAcrossMatchedRecords': len(union_ids - existing_unique),
        'newTransactionObservationRows': actual_series_rows,
        'monthlyAggregateSeriesRows': aggregate_rows,
        'monthlyMedianWithheldForSparseSamples': aggregate_withheld,
        'recordsWithNewNativeTransactionRows': len(row_counts_by_record),
        'projectRecordsWithNewNativeTransactionRows': sum(record_id.startswith('project:') for record_id in row_counts_by_record),
        'communityRecordsWithNewNativeTransactionRows': sum(record_id.startswith('community:') for record_id in row_counts_by_record),
        'projectObservedDateRange': {'start': str(min(row[1] for row in project_rows)), 'end': str(max(row[1] for row in project_rows))},
        'communityObservedDateRange': {'start': str(min(row[1] for row in community_rows)), 'end': str(max(row[1] for row in community_rows))},
        'sourceAvailability': source['firstAvailableAt'], 'sourceSnapshotDate': '2026-10-05',
        'rowFilters': {'qualityFlags': 0, 'procedureIds': [11, 41, 102], 'usage': 'Residential',
                       'projectPropertyType': 'Unit', 'projectSubtype': 'Flat',
                       'communityPropertyTypes': ['Unit / Flat', 'Villa'],
                       'projectIdentity': 'exact case-insensitive DLD-derived project_name plus official area_id against unique previously verified project key',
                       'communityIdentity': 'exact DLD area_id plus native area_name_en against existing official DLD area mapping',
                       'dateBasis': DATE_BASIS},
        'monthlyMethod': {'statistic': 'median AED/sqft', 'minimumSample': 20,
                          'cohort': 'record + registration + procedure + property type/subtype',
                          'sparseMedian': 'withheld; all eligible individual rows and counts remain',
                          'mixAdjustment': False, 'forecastPointsAdded': 0},
        'seriesInput': {'path': relative, 'compressedSHA256': compressed_sha, 'uncompressedSHA256': digest(csv_bytes),
                        'compressedBytes': len(compressed), 'uncompressedBytes': len(csv_bytes), 'rows': len(data_rows)},
        'rawParquetRedistributed': False,
    }
    packet = {
        'schemaVersion': 1, 'asOf': '2026-10-07', 'sources': [], 'facts': [],
        'seriesLinks': list(identity_links.values()),
        'historyInputs': [{
            'id': 'v19-dred-registered-history', 'sourceId': SOURCE_ID, 'path': relative,
            'sha256': compressed_sha, 'uncompressedSHA256': digest(csv_bytes), 'compression': 'gzip',
            'format': 'csv', 'rowCount': len(data_rows), 'firstAvailableAt': source['firstAvailableAt'],
            'note': 'Row-level transaction cohorts and monthly medians; exact native transaction fields remain in the immutable history partitions.',
        }],
        'licensedArchives': [], 'additionalDatasets': [], 'recordResearch': research,
        'collection': collection,
        'methodology': (
            'A pinned CC BY 4.0 secondary DLD-derived distribution is matched by exact existing project-name/official-area keys '
            'or exact official community-area ID/name. Individual registered sales remain separate at native daily precision; '
            'monthly medians are source-row summaries within registration/procedure/property cohorts and are withheld below 20 rows. '
            'The extract is a latest 2026 vintage published 2026-10-05, not a historic as-of feed; no point-in-time backtest availability, '
            'first-ever sale, continuous coverage, causal uplift, rent evidence, or forecast is inferred.'
        ),
    }
    args.packet.parent.mkdir(parents=True, exist_ok=True)
    args.packet.write_text(json.dumps(packet, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n')
    print(json.dumps({
        'packet': str(args.packet), 'seriesInput': str(csv_path), 'recordsWithRows': len(row_counts_by_record),
        'projectRowsAdded': project_additions, 'communityRowsAdded': community_additions,
        'newTransactionObservationRows': actual_series_rows, 'monthlyAggregateSeriesRows': aggregate_rows,
        'monthlyMedianWithheldForSparseSamples': aggregate_withheld, 'compressedBytes': len(compressed),
        'uniqueProjectTransactions': len(project_matches), 'uniqueCommunityTransactions': len(community_matches),
        'projectCommunityOverlap': project_community_overlap, 'unionUniqueTransactions': len(union_ids),
    }, sort_keys=True))


if __name__ == '__main__':
    main()
