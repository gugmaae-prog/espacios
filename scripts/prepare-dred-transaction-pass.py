#!/usr/bin/env python3
"""Prepare a small identity-reviewed extract from the public DRED/DLD dataset."""
import argparse
import collections
import hashlib
import json
import pathlib
import re

import duckdb

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE_ID = 'v19-dred-sales-20261005'
SOURCE_COMMIT = 'a2c9d1c447e4db0416c2badcda8c1b4011f6e677'
PUBLISHED_AT = '2026-10-05T09:28:01Z'
RETRIEVED_AT = '2026-10-07T18:48:12Z'
SOURCE_SHA256 = '73be9631af185f4ba599ea299752deecdb137cbbe36c0afb95abc5e186d8b5e1'
SOURCE_URL = f'https://huggingface.co/datasets/dubairealestatedata/dubai-real-estate-sales-transactions/resolve/{SOURCE_COMMIT}/dld_sales_transactions.parquet'
TARGETS = {
    'binghatti aquarise': 'project:binghatti-aquarise-business-bay',
    'binghatti haven': 'project:binghatti-haven-by-binghatti-developers-in-dubai-sports-city-dubai',
    'binghatti skyrise': 'project:studios-and-apartments-binghatti-skyrise-business-bay-dubai',
    'damac district': 'project:damac-district-damac-hills-dubai',
    'palace residences dubai hills estate': 'project:palace-residences-dubai-hills-estate-emaar-properties',
    'sobha solis': 'project:sobha-solis-by-sobha-realty-in-motor-city-dubai',
}
AREA_PROOF = 'dld-official-areas-20261002'


def read_json(path):
    return json.loads(path.read_text())


def clean_id(value):
    return re.sub(r'[^A-Za-z0-9-]+', '-', str(value)).strip('-').lower()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=pathlib.Path, default=ROOT / '.local-data/dld-sales-refresh-20261007/dld_sales_transactions.parquet')
    parser.add_argument('--snapshot', type=pathlib.Path, default=ROOT / 'data/historical-intelligence-20261003.json')
    parser.add_argument('--output', type=pathlib.Path, default=ROOT / 'enrichment/v19/pass42-dred-registered-sales.json')
    args = parser.parse_args()
    if not args.source.is_file():
        raise SystemExit(f'Missing public dataset snapshot: {args.source}')
    raw = args.source.read_bytes()
    source_hash = hashlib.sha256(raw).hexdigest()
    if source_hash != SOURCE_SHA256:
        raise SystemExit('Source parquet checksum differs from the reviewed HF snapshot.')

    snapshot = read_json(args.snapshot)
    record_map = {record['id']: record for record in snapshot['records']}
    if len(record_map) != 1860 or snapshot['version'] not in ['20261007-enrichment-v18', '20261007-enrichment-v19']:
        raise SystemExit('Identity baseline changed; review and update the pinned baseline before extraction.')

    # The source's DLD project name plus numeric area ID must match one existing,
    # exact project identity proof. Ambiguous project-name/area keys are rejected.
    verified_keys = collections.defaultdict(set)
    proof_by_record = {}
    for record in snapshot['records']:
        if record['type'] != 'project':
            continue
        for series in record.get('historySeries', []):
            if (series.get('scope') == 'subject' and series.get('identityVerified') is True
                    and series.get('sourceId') == 'dld-official-transactions-20261003'
                    and series.get('metric') == 'price' and series.get('sourceAreaId') is not None
                    and series.get('geography') and series.get('registration') == 'Off-Plan Properties'
                    and series.get('segment') == 'Residential | Unit | native subtype: Flat'):
                key = (str(series['geography']).strip().casefold(), int(series['sourceAreaId']))
                verified_keys[key].add(record['id'])
                proof_by_record[record['id']] = series
    collisions = [key for key, ids in verified_keys.items() if len(ids) != 1]
    if collisions:
        raise SystemExit('Existing verified project identities contain a name/area collision.')
    db = duckdb.connect(':memory:')
    db.execute('CREATE TEMP TABLE verified_identities(project_name VARCHAR, area_id INTEGER, record_id VARCHAR)')
    db.executemany('INSERT INTO verified_identities VALUES (?, ?, ?)', [
        (name, area_id, next(iter(record_ids))) for (name, area_id), record_ids in verified_keys.items()
    ])

    source_path = str(args.source).replace("'", "''")
    table = f"read_parquet('{source_path}')"
    global_stats = db.execute(f"""SELECT count(*),count(distinct transaction_id),min(instance_date),max(instance_date),
        sum(CASE WHEN quality_flags=0 THEN 1 ELSE 0 END),
        sum(CASE WHEN quality_flags=0 AND procedure_id IN (11,41,102) AND usage_label='Residential'
                 AND property_type_label IN ('Unit','Villa') THEN 1 ELSE 0 END)
        FROM {table}""").fetchone()
    if tuple(map(str, global_stats[:2])) != ('1372277', '1372277') or str(global_stats[3]) != '2026-10-05':
        raise SystemExit(f'Unexpected published dataset shape: {global_stats}')
    audit = db.execute(f"""SELECT
        count(DISTINCT CASE WHEN p.quality_flags=0 THEN i.record_id END),
        count(DISTINCT CASE WHEN p.quality_flags=0 AND p.procedure_id IN (11,41,102) THEN i.record_id END),
        count(DISTINCT CASE WHEN p.quality_flags=0 AND p.procedure_id IN (11,41,102)
             AND p.usage_label='Residential' AND p.property_type_label IN ('Unit','Villa') THEN i.record_id END),
        count(DISTINCT CASE WHEN p.quality_flags=0 AND p.procedure_id IN (11,41,102)
             AND p.usage_label='Residential' AND p.property_type_label IN ('Unit','Villa') THEN p.transaction_id END)
        FROM {table} p JOIN verified_identities i
          ON lower(trim(p.project_name))=i.project_name AND p.area_id=i.area_id
        WHERE p.project_name IS NOT NULL""").fetchone()

    targets = ','.join("'" + value.replace("'", "''") + "'" for value in TARGETS)
    rows = db.execute(f"""SELECT transaction_id,instance_date,area_id,area_name_en,project_name,
        property_type_label,property_sub_type,usage_label,rooms_bucket,area_sqm,price_aed,price_psf,
        reg_type_label,procedure_id,procedure_name_en,quality_flags
        FROM {table}
        WHERE instance_date BETWEEN '2026-10-03' AND '2026-10-05'
          AND lower(trim(project_name)) IN ({targets})
          AND property_type_label='Unit' AND property_sub_type='Flat' AND usage_label='Residential'
          AND reg_type_label='Off-Plan' AND procedure_id=102 AND quality_flags=0
        ORDER BY instance_date,transaction_id""").fetchall()
    if len(rows) != 8:
        raise SystemExit(f'Expected eight reviewed subject rows, received {len(rows)}.')
    if len({row[0] for row in rows}) != 8:
        raise SystemExit('Transaction IDs are not unique in the reviewed project extract.')

    facts = []
    affected = collections.Counter()
    for row in rows:
        (transaction_id, date, area_id, area_name, project_name, property_type, subtype,
         usage, rooms, area_sqm, price_aed, price_psf, registration, procedure_id,
         procedure_name, quality_flags) = row
        record_id = TARGETS.get(str(project_name).strip().casefold())
        if not record_id or record_id not in record_map:
            raise SystemExit(f'No exact fixed-catalogue project for source name {project_name!r}.')
        series = proof_by_record.get(record_id)
        if not series or int(series['sourceAreaId']) != int(area_id):
            raise SystemExit(f'Official area identity mismatch for {transaction_id}.')
        if str(series['geography']).strip().casefold() != str(project_name).strip().casefold():
            raise SystemExit(f'Official project name identity mismatch for {transaction_id}.')
        if not price_psf or not area_sqm or not price_aed or quality_flags != 0:
            raise SystemExit(f'Incomplete or quality-flagged transaction {transaction_id}.')
        record = record_map[record_id]
        observation = {
            'metric': 'price', 'value': float(price_psf), 'unit': 'AED/sqft', 'period': str(date),
            'frequency': 'daily', 'observationKind': 'transaction', 'transactionKind': 'sale',
            'transactionId': transaction_id, 'sourceObservationId': transaction_id,
            'observationDateBasis': 'DLD instance_date: registration date; it is not asserted to be the contract execution or transfer date.',
            'priceAED': int(price_aed), 'areaSqm': float(area_sqm), 'roomsBucket': rooms,
            'bedroomsLabel': 'Studio' if rooms == 0 else f'{rooms}BR' if rooms is not None else 'Unspecified',
            'propertyType': property_type, 'propertySubtype': subtype, 'usage': usage,
            'registration': registration, 'procedureId': int(procedure_id), 'procedureName': procedure_name,
            'qualityFlags': int(quality_flags), 'sourceAreaId': int(area_id), 'sourceAreaName': area_name,
            'sourceProjectName': project_name,
        }
        fact_id = f"v19-dred-subject-{clean_id(record_id)}-{clean_id(transaction_id)}"
        facts.append({
            'id': fact_id, 'status': 'accepted', 'recordId': record_id, 'kind': 'financial',
            'scope': 'subject', 'identityVerified': True, 'primaryEvidence': False,
            'evidenceClass': 'registered_sale_transaction_secondary_distribution',
            'sourceIds': [SOURCE_ID], 'identitySourceIds': list(series['identitySourceIds']),
            'identityBasis': (
                f"The DRED transaction row's exact DLD project_name {project_name!r} and numeric area_id {area_id} "
                f"match existing catalogue record {record_id} and its previously verified subject cohort {series['id']}; "
                'the cohort is anchored to DLD project/developer/area/transaction/building sources. The row is an exact '
                'Residential | Unit | Flat, Off-Plan, Sell - Pre registration match; no fuzzy name or phase fan-out is used.'
            ),
            'publishedAt': PUBLISHED_AT, 'firstAvailableAt': PUBLISHED_AT, 'retrievedAt': RETRIEVED_AT,
            'observation': observation,
        })
        affected[record_id] += 1

    # Exact area-key evidence supports Business Bay community history. These
    # facts intentionally remain separate from project identity claims.
    business_bay = record_map['community:Dubai:business-bay']
    community_facts = []
    area_rows = db.execute(f"""SELECT transaction_id,instance_date,area_id,area_name_en,project_name,
        property_type_label,property_sub_type,usage_label,rooms_bucket,area_sqm,price_aed,price_psf,
        reg_type_label,procedure_id,procedure_name_en,quality_flags
        FROM {table} WHERE instance_date BETWEEN '2026-10-03' AND '2026-10-05'
          AND area_id=526 AND area_name_en='Business Bay' AND usage_label='Residential'
          AND property_type_label='Unit' AND property_sub_type='Flat' AND reg_type_label='Off-Plan' AND procedure_id=102
          AND quality_flags=0 ORDER BY instance_date,transaction_id""").fetchall()
    if len(area_rows) != 5:
        raise SystemExit(f'Expected five exact Business Bay registered-sale rows, received {len(area_rows)}.')
    for row in area_rows:
        transaction_id, date, area_id, area_name, project_name, property_type, subtype, usage, rooms, area_sqm, price_aed, price_psf, registration, procedure_id, procedure_name, quality_flags = row
        observation = {
            'metric': 'price', 'value': float(price_psf), 'unit': 'AED/sqft', 'period': str(date),
            'frequency': 'daily', 'observationKind': 'transaction', 'transactionKind': 'sale',
            'transactionId': transaction_id, 'sourceObservationId': transaction_id,
            'observationDateBasis': 'DLD instance_date: registration date; it is not asserted to be the contract execution or transfer date.',
            'priceAED': int(price_aed), 'areaSqm': float(area_sqm), 'roomsBucket': rooms,
            'bedroomsLabel': 'Studio' if rooms == 0 else f'{rooms}BR' if rooms is not None else 'Unspecified',
            'propertyType': property_type, 'propertySubtype': subtype, 'usage': usage,
            'registration': registration, 'procedureId': int(procedure_id), 'procedureName': procedure_name,
            'qualityFlags': int(quality_flags), 'sourceAreaId': int(area_id), 'sourceAreaName': area_name,
            'sourceProjectName': project_name,
        }
        community_facts.append({
            'id': f"v19-dred-community-{clean_id(business_bay['id'])}-{clean_id(transaction_id)}",
            'status': 'accepted', 'recordId': business_bay['id'], 'kind': 'financial',
            'scope': 'subject', 'identityVerified': True, 'primaryEvidence': False,
            'evidenceClass': 'registered_sale_transaction_secondary_distribution',
            'sourceIds': [SOURCE_ID], 'identitySourceIds': [AREA_PROOF],
            'identityBasis': (
                f"The transaction row's numeric DLD area_id {area_id} and native area_name_en {area_name!r} match "
                f"the official DLD area lookup and the fixed catalogue community {business_bay['id']}. This establishes "
                'a Business Bay community-level observation only; the associated project_name is not used to create or infer another project link.'
            ),
            'publishedAt': PUBLISHED_AT, 'firstAvailableAt': PUBLISHED_AT, 'retrievedAt': RETRIEVED_AT,
            'observation': observation,
        })
    facts.extend(community_facts)

    ambiguous_rows = db.execute(f"""SELECT transaction_id,instance_date,area_id,area_name_en
        FROM {table} WHERE instance_date BETWEEN '2026-10-03' AND '2026-10-05'
          AND area_id IN (526,343) AND usage_label='Residential' AND property_type_label='Unit'
          AND procedure_id IS NULL AND procedure_name_en IS NULL AND quality_flags=0
        ORDER BY transaction_id""").fetchall()
    if len(ambiguous_rows) != 6:
        raise SystemExit(f'Unexpected unresolved-procedure review set: {len(ambiguous_rows)}')

    source = {
        'id': SOURCE_ID, 'url': SOURCE_URL, 'publisher': 'Dubai Real Estate Data',
        'classification': 'independent_dld_derived_transactions', 'primaryEvidence': False,
        'publishedAt': PUBLISHED_AT, 'firstAvailableAt': PUBLISHED_AT, 'retrievedAt': RETRIEVED_AT,
        'publicationDateStatus': 'exact_Hugging_Face_dataset_version_commit',
        'availabilityBasis': 'First public availability of this exact dataset file version is the pinned Hugging Face dataset commit timestamp; source values are DLD-derived, not a direct DLD response capture.',
        'datasetVersion': SOURCE_COMMIT, 'sourceSnapshotDate': '2026-10-05',
        'sourceDatasetRows': int(global_stats[0]), 'sourceUniqueTransactionIds': int(global_stats[1]),
        'sourceRawObservationRange': {'start': str(global_stats[2]), 'end': str(global_stats[3])},
        'qualityZeroRowCount': int(global_stats[4]), 'qualityZeroResidentialSaleRows': int(global_stats[5]),
        'bytes': len(raw), 'sha256': source_hash, 'licence': 'CC BY 4.0',
        'licenceURL': 'https://creativecommons.org/licenses/by/4.0/',
        'attribution': 'Dubai Real Estate Data (dubairealestatedata.com), based on Dubai Land Department open data.',
        'methodologyURL': 'https://www.dubairealestatedata.com/methodology',
        'sourcePageURL': 'https://www.dubairealestatedata.com/transactions',
        'methodologyVersion': '2.1 (updated 2026-08-13)',
        'rawDatasetRedistributed': False, 'localRawSnapshotExcludedFromRepository': True,
        'extractionVersion': 'reviewed-dred-pass42-v1',
        'note': 'Thirteen quality_flags=0 DLD procedure 102 sale observations are included in this pass (eight exact project links and five exact Business Bay community links). Two transaction IDs intentionally appear once at project level and once at area level. No median or price trend is inferred from these sparse rows. Six nearby unit rows with missing procedure IDs remain excluded from sale coverage.',
    }
    record_research = []
    for record_id, count in sorted(affected.items()):
        record_research.append({'recordId': record_id, 'collectionPass': 'pass42-dred-registered-sales',
                                'collectionStatus': 'exact_project_transaction_observations', 'sourceIds': [SOURCE_ID],
                                'acceptedTransactionObservationCount': count})
    record_research.append({'recordId': business_bay['id'], 'collectionPass': 'pass42-dred-registered-sales',
                            'collectionStatus': 'exact_area_transaction_observations', 'sourceIds': [SOURCE_ID, AREA_PROOF],
                            'acceptedTransactionObservationCount': len(community_facts)})
    packet = {
        'schemaVersion': 1, 'asOf': '2026-10-07', 'sources': [source], 'facts': facts,
        'seriesLinks': [], 'recordResearch': record_research, 'historyInputs': [], 'licensedArchives': [],
        'additionalDatasets': [{
            'sourceId': SOURCE_ID, 'rowCount': int(global_stats[0]), 'rowCountVerified': True,
            'attribution': source['attribution'], 'scope': 'Public DLD-derived registered transaction dataset; this reviewed extract links ten rows to six projects and Business Bay only.',
            'sourceSnapshotDate': '2026-10-05', 'sourceDatasetSHA256': source_hash,
        }],
        'sourceCandidates': [],
        'collection': {
            'passId': 'pass42-dred-registered-sales', 'sourceId': SOURCE_ID,
            'sourceCommit': SOURCE_COMMIT, 'sourceFileSHA256': source_hash,
            'sourceRows': int(global_stats[0]), 'sourceUniqueTransactionIds': int(global_stats[1]),
            'exactProjectIdentityKeysReviewed': len(verified_keys), 'projectIdentityKeyCollisions': len(collisions),
            'exactProjectRecordsWithQualityZeroRows': int(audit[0]),
            'exactProjectRecordsWithSaleProcedureRows': int(audit[1]),
            'exactProjectRecordsWithResidentialUnitOrVillaSales': int(audit[2]),
            'exactResidentialUnitOrVillaSaleRowsInSource': int(audit[3]),
            'projectRowsAdded': len(rows), 'projectRecordsAffected': len(affected),
            'communityRowsAdded': len(community_facts), 'communityRecordsAffected': 1,
            'uniqueTransactionIdsAdded': len({fact['observation']['transactionId'] for fact in facts}),
            'overlapBetweenProjectAndCommunityFacts': len({fact['observation']['transactionId'] for fact in community_facts} & {fact['observation']['transactionId'] for fact in facts[:len(rows)]}),
            'unresolvedProcedureRowsExcluded': len(ambiguous_rows),
            'excludedTransactionIds': [row[0] for row in ambiguous_rows],
            'filter': {'dateStart': '2026-10-03', 'dateEnd': '2026-10-05', 'procedureId': 102,
                       'procedureName': 'Sell - Pre registration', 'usage': 'Residential',
                       'propertyType': 'Unit', 'propertySubtype': 'Flat', 'registration': 'Off-Plan',
                       'qualityFlags': 0, 'projectMatch': 'exact case-insensitive source project_name plus official area ID',
                       'communityMatch': 'exact numeric DLD area_id and official area_name_en'},
            'sampleMediansOrForecastsAdded': 0, 'projectOrCommunityRecordsAdded': 0,
            'rawDatasetRedistributed': False,
        },
        'methodology': 'One fact per quality-accepted registered sale row. Price is the source-reported AED/sqft ratio; exact AED price and registered area are retained. DLD instance_date is registration date. Off-plan and ready are never blended. Project identity uses the existing exact verified DLD project/area cohort; community identity uses the official DLD numeric area lookup. No aggregation, appreciation claim, or forecast is made from this sparse pass.',
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(packet, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n')
    print(json.dumps({'output': str(args.output), 'facts': len(facts), 'projects': len(affected),
                      'communities': 1, 'uniqueTransactions': packet['collection']['uniqueTransactionIdsAdded'],
                      'unresolvedProcedureRowsExcluded': len(ambiguous_rows), 'sourceSHA256': source_hash}))


if __name__ == '__main__':
    main()
