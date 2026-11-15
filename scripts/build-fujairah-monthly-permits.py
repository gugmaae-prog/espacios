#!/usr/bin/env python3
"""Publish selected monthly permit counts from FSC Tables 2-1 and 2-2.

Selected columns are transcribed from the official 2023, 2024 and 2025
Construction and Building chapter PDFs, publication pages 47-48 (PDF pages
4-5). Monthly figures reconcile to the existing verified annual series.
"""
import hashlib
import gzip
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'data/uae-evidence/fujairah'
ANNUAL = BASE / 'building-permits-20261110.json'
ANNUAL_REPORT = BASE / 'building-permits-validation.json'
OUT = BASE / 'building-permits-monthly-20261114.json'
PACKED = BASE / 'building-permits-monthly-20261114.json.gz'
REPORT = BASE / 'building-permits-monthly-validation.json'
# Selected columns: new/renew and total. Other permit types are excluded because
# the publisher has not granted redistribution of the full source tables.
# Source: FSC Construction and Building chapter, tables 2-1 and 2-2.
TABLES = {
    2023: {
        'Fujairah': '''
125 169
129 158
111 153
67 96
105 166
83 129
112 154
110 139
103 141
116 185
129 181
96 136''',
        'Dibba': '''
38 63
44 67
33 52
27 39
46 82
28 47
44 74
48 69
42 60
56 98
37 67
59 85''',
    },
    2024: {
        'Fujairah': '''
113 171
100 143
123 155
67 102
167 221
119 157
121 175
139 195
143 184
152 207
147 215
142 197''',
        'Dibba': '''
54 72
46 73
29 46
15 30
22 46
23 35
53 76
27 55
35 51
39 67
34 58
28 48''',
    },
    2025: {
        'Fujairah': '''
129 198
119 168
112 141
120 175
134 190
124 172
167 226
116 167
142 212
109 188
128 180
81 109''',
        'Dibba': '''
35 59
47 72
30 50
33 61
43 62
36 59
34 59
43 60
30 52
26 46
32 48
42 52''',
    },
}
FIELDS = ('newAndRenew', 'total')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    annual_bytes = ANNUAL.read_bytes()
    annual_report = json.loads(ANNUAL_REPORT.read_text())
    assert digest(annual_bytes) == annual_report['dataSha256']
    annual = {row['year']: row for row in json.loads(annual_bytes)['annual']}
    pdfs = {
        2023: annual_report['earliestCapturePdf'],
        2024: annual_report['priorCapturePdf'],
        2025: annual_report['capturePdf'],
    }
    rows = []
    for year, municipalities in TABLES.items():
        for municipality, text in municipalities.items():
            numbers = [tuple(map(int, line.split())) for line in text.strip().splitlines()]
            assert len(numbers) == 12
            assert all(len(values) == len(FIELDS) for values in numbers)
            annual_row = annual[year]['fujairahMunicipality' if municipality == 'Fujairah' else 'dibbaMunicipality']
            for field in FIELDS:
                assert sum(values[FIELDS.index(field)] for values in numbers) == annual_row[field], (year, municipality, field)
            for index, values in enumerate(numbers, 1):
                values = dict(zip(FIELDS, values))
                rows.append({'month': f'{year}-{index:02}', 'municipality': municipality, **values})
        assert sum(row['total'] for row in rows if row['month'].startswith(str(year))) == annual[year]['emirateTotal']
    payload = {
        'sourceId': 'fscfuj-construction-chapter-monthly-permits-2023-2025-20261114',
        'authority': 'Fujairah Statistics Centre',
        'originalSources': ['Fujairah Municipality', 'Dibba Municipality'],
        'emirate': 'Fujairah',
        'evidenceClass': 'official_building_permit_count_aggregate',
        'grain': 'municipality-calendar-month permit type count',
        'publication': 'Construction and Building chapters, Tables 2-1 and 2-2, publication pages 47-48',
        'rightsScope': 'Only monthly total and combined new/renew permit counts plus source links; other source-table columns, chapter text, images and layout are excluded.',
        'limits': 'Issued permits are authorizations, not completed buildings, distinct projects, units, sales, rents, current availability, or project coordinates. New and renewed permits are combined. These monthly type counts reconcile to the separately published annual totals; building-use breakdowns do not exist at this monthly grain.',
        'rows': rows,
    }
    raw = (json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
    packed = gzip.compress(raw, mtime=0)
    report = {
        'sourceId': payload['sourceId'], 'parentSourceId': json.loads(annual_bytes)['sourceId'],
        'parentDataSha256': annual_report['dataSha256'],
        'sourcePdfs': [{'year': year, 'url': pdfs[year]['url'], 'sha256': pdfs[year]['sha256'], 'publicationPageNumbers': [47, 48], 'pdfPageNumbers': [4, 5]} for year in TABLES],
        'rows': len(rows), 'years': list(TABLES), 'municipalities': ['Fujairah', 'Dibba'],
        'dataBytes': len(raw), 'dataSha256': digest(raw), 'compressedBytes': len(packed), 'compressedSha256': digest(packed), 'rightsScope': payload['rightsScope'], 'limits': payload['limits'],
        'verification': 'For each year and municipality, the selected monthly totals and combined new/renew counts reconcile to the previously verified annual source; both municipality totals reconcile to the emirate annual total. Other permit types are intentionally not republished.',
    }
    report_raw = (json.dumps(report, ensure_ascii=False, indent=2) + '\n').encode()
    if '--check' in sys.argv:
        assert OUT.read_bytes() == raw
        assert PACKED.read_bytes() == packed
        assert REPORT.read_bytes() == report_raw
        print(json.dumps({'passed': True, 'rows': len(rows), 'years': list(TABLES), 'sha256': digest(raw)}))
    else:
        OUT.write_bytes(raw)
        PACKED.write_bytes(packed)
        REPORT.write_bytes(report_raw)
        print(json.dumps({'rows': len(rows), 'years': list(TABLES), 'sha256': digest(raw)}))


if __name__ == '__main__':
    main()
