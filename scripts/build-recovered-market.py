#!/usr/bin/env python3
"""Recover unchanged published benchmark rows from the approved scenario pack."""
import json,pathlib,hashlib
ROOT=pathlib.Path(__file__).resolve().parents[1];path=ROOT/'data/smart-estimates-20260930.json';raw=path.read_bytes();sha=hashlib.sha256(raw).hexdigest();assert sha=='f77472b65fad63bb6dd59323ed93823fb623a193d58c8cd014c2e3f868a3c4b4'
source=json.loads(raw);rows=[row for cohort in source['asking'] for row in cohort['history']['rows']];assert len(rows)==228 and len({r['id'] for r in rows})==228
ids={r['sourceId'] for r in rows};sources=[s for s in source['sources'] if s['id'] in ids];assert len(sources)==15
result={'version':'20260928-market-segments-v3','asOf':source['asOf'],'rows':rows,'sources':sources,'recovery':{'classification':'unchanged_published_rows_recovered_from_approved_snapshot','sourceSnapshotSHA256':sha,'valuesRecalculated':False},'periodPolicy':'Native annual and half-year reporting windows remain separate; asking benchmarks and projected gross yield are not registered prices or net returns.'}
(ROOT/'data/recovery/recovered-market-segments.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n');print(json.dumps({'rows':len(rows),'sources':len(sources)}))
