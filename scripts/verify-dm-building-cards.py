#!/usr/bin/env python3
"""Independently reconcile every partitioned field against the source CSV."""
import argparse
import collections
import csv
import gzip
import hashlib
import json
import pathlib

ROOT=pathlib.Path(__file__).resolve().parents[1]
DATA=ROOT/'data/uae-evidence/dubai/dm-building-cards-20261026'


def digest_file(path):
    result=hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda:stream.read(1024*1024),b''):
            result.update(block)
    return result.hexdigest()


def add_row(digest,row):
    digest.update(json.dumps(row,ensure_ascii=False,separators=(',',':')).encode('utf-8'))
    digest.update(b'\n')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',required=True,type=pathlib.Path)
    args=parser.parse_args()
    source=args.source.resolve()
    manifest_bytes=(DATA/'manifest.json').read_bytes()
    manifest=json.loads(manifest_bytes)
    assert digest_file(source)==manifest['sourceSha256']
    source_digests=collections.defaultdict(hashlib.sha256)
    source_counts=collections.Counter()
    with source.open('r',encoding='utf-8-sig',newline='') as stream:
        reader=csv.DictReader(stream)
        assert reader.fieldnames==manifest['sourceFields']
        for row in reader:
            bucket=int(row['building_id'])//manifest['bucketSize']
            add_row(source_digests[bucket],[row[field] for field in reader.fieldnames])
            source_counts[bucket]+=1
    assert sum(source_counts.values())==manifest['sourceRows']
    assert set(source_counts)=={shard['bucket'] for shard in manifest['shards']}
    for shard in manifest['shards']:
        path=DATA/shard['file']
        assert path.stat().st_size==shard['bytes'] and digest_file(path)==shard['sha256']
        with gzip.open(path,'rb') as stream: decoded=stream.read()
        assert len(decoded)==shard['decodedBytes'] and hashlib.sha256(decoded).hexdigest()==shard['decodedSha256']
        rows=json.loads(decoded)['rows']
        assert len(rows)==source_counts[shard['bucket']]==shard['rows']
        readback=hashlib.sha256()
        for row in rows: add_row(readback,row)
        assert readback.hexdigest()==source_digests[shard['bucket']].hexdigest(),shard['file']
    report={'sourceId':manifest['sourceId'],'sourceSha256':manifest['sourceSha256'],'sourceBytes':manifest['sourceBytes'],'manifestSha256':hashlib.sha256(manifest_bytes).hexdigest(),'sourceRows':manifest['sourceRows'],'uniqueBuildingIds':manifest['uniqueBuildingIds'],'fieldCount':len(manifest['sourceFields']),'shards':len(manifest['shards']),'partitionBytes':sum(shard['bytes'] for shard in manifest['shards']),'exactFieldReconciliation':'all_source_rows_and_all_38_fields_match_partition_readback','verifiedOn':'2026-11-14','sourceAccess':'local download from official Data.Dubai dataset page; original CSV is not committed'}
    (DATA.parent/'dm-building-cards-validation.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))


if __name__=='__main__':main()
