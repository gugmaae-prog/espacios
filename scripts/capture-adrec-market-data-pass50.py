#!/usr/bin/env python3
"""Capture a bounded, normalized ADREC sales batch. Raw API bodies are not retained."""
import argparse, datetime as dt, hashlib, json, math, subprocess, time, urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLAN = ROOT / 'data/historical-intelligence/adrec-market-data-pass50/source-plan.json'
ENDPOINT = 'https://adrec.gov.ae/api/feature/MarketData/RecentSales'
MAX_REQUESTS = 40
MAX_RESPONSE_BYTES = 5_000_000
PAGE_SIZE = 1000
SQM_PER_SQFT = 10.763910416709722
canonical = lambda x: json.dumps(x, ensure_ascii=False, separators=(',', ':'), sort_keys=True).encode()
sha256 = lambda x: hashlib.sha256(x).hexdigest()

def utc_now():
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')

def request(url):
    cmd = ['curl', '--silent', '--show-error', '--location', '--max-redirs', '2', '--max-time', '30',
           '--user-agent', 'Espacios historical-data research (bounded public source review)',
           '--header', 'Accept: application/json,text/plain,*/*',
           '--write-out', '\n__ADREC_STATUS__%{http_code}\n__ADREC_URL__%{url_effective}', url]
    result = subprocess.run(cmd, check=True, capture_output=True)
    body, trailer = result.stdout.rsplit(b'\n__ADREC_STATUS__', 1)
    status_text, final_url = trailer.split(b'\n__ADREC_URL__', 1)
    status = int(status_text.decode().strip())
    final_url = final_url.decode().strip()
    if len(body) > MAX_RESPONSE_BYTES:
        raise ValueError('ADREC response exceeds the configured byte limit')
    return body, status, final_url

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise SystemExit('Refusing to overwrite an existing capture')
    plan = json.loads(PLAN.read_bytes())
    if plan['passId'] != 'adrec-market-data-transactions-pass50-20261022' or len(plan['projects']) > 20:
        raise ValueError('Unexpected pass plan')
    requests = []
    robots_url = 'https://adrec.gov.ae/robots.txt'
    body, status, final = request(robots_url)
    requests.append({'url': robots_url, 'finalUrl': final, 'httpStatus': status,
                     'responseBytes': len(body), 'sha256': sha256(body), 'retrievedAt': utc_now()})
    if status not in (200, 404, 410):
        raise ValueError(f'Unexpected robots response: {status}')
    time.sleep(2)
    lookup_url = 'https://adrec.gov.ae/api/feature/MarketData/ProjectNames?language=en'
    body, status, final = request(lookup_url)
    if status != 200 or final != lookup_url:
        raise ValueError(f'Unexpected ADREC project-name lookup response: {status}')
    try:
        lookup = json.loads(body)
    except Exception as exc:
        raise ValueError('ADREC project-name lookup returned invalid JSON') from exc
    if not isinstance(lookup, list) or not all(isinstance(x, dict) and isinstance(x.get('value'), str) for x in lookup):
        raise ValueError('ADREC project-name lookup shape changed')
    available_names = {x['value'] for x in lookup}
    requests.append({'url': lookup_url, 'finalUrl': final, 'httpStatus': status,
                     'responseBytes': len(body), 'sha256': sha256(body), 'retrievedAt': utc_now(),
                     'kind': 'exact_project_name_lookup', 'rowCount': len(lookup)})
    if any(p['projectName'] not in available_names for p in plan['projects']):
        raise ValueError('A plan project name is not an exact option in the ADREC dashboard lookup')
    if len(requests) >= MAX_REQUESTS:
        raise ValueError('ADREC pass would exceed its request limit')
    time.sleep(2)
    projects = []
    transactions = []
    for pi, project in enumerate(plan['projects']):
        page = 0
        total = None
        project_request_indexes = []
        included = 0
        exclusions = {'partialShare': 0, 'nonResidential': 0, 'missingPriceOrArea': 0}
        while True:
            params = {
                'fromDate': plan['dateWindow']['from'], 'toDate': plan['dateWindow']['to'],
                'saleApplicationType': 'all', 'saleSequence': 'all', 'municipality': 'all',
                'district': 'all', 'projectName': project['projectName'], 'assetClass': 'all',
                'propertyType': 'all', 'page': page, 'size': PAGE_SIZE,
                'propertyLayout': 'all', 'language': 'en'
            }
            url = ENDPOINT + '?' + urllib.parse.urlencode(params)
            captured_at = utc_now()
            raw, status, final = request(url)
            if status != 200 or final.split('?', 1)[0] != ENDPOINT:
                raise ValueError(f'Unexpected ADREC endpoint response {status}: {final}')
            try:
                doc = json.loads(raw)
            except Exception as exc:
                raise ValueError('ADREC returned invalid JSON') from exc
            rows = doc.get('content')
            if not isinstance(rows, list) or not isinstance(doc.get('totalElements'), int):
                raise ValueError('ADREC response omitted content or totalElements')
            if total is None:
                total = doc['totalElements']
            if total != doc['totalElements'] or total != len(rows) and doc.get('totalPages') == 1:
                raise ValueError('ADREC pagination metadata is inconsistent')
            if len(rows) > PAGE_SIZE:
                raise ValueError('ADREC exceeded the requested page size')
            request_index = len(requests)
            project_request_indexes.append(request_index)
            requests.append({'url': url, 'finalUrl': final, 'httpStatus': status,
                             'responseBytes': len(raw), 'sha256': sha256(raw),
                             'retrievedAt': captured_at, 'page': page, 'pageSize': PAGE_SIZE,
                             'rowCount': len(rows), 'totalElements': total,
                             'totalPages': doc.get('totalPages')})
            for row in rows:
                if row.get('project_name') != project['projectName']:
                    raise ValueError('Exact project filter returned a different project name')
                date = str(row.get('sale_application_datetime') or '')[:10]
                try:
                    dt.date.fromisoformat(date)
                except ValueError as exc:
                    raise ValueError('Transaction registration date is invalid') from exc
                if not plan['dateWindow']['from'] <= date <= plan['dateWindow']['to']:
                    raise ValueError('Transaction date fell outside the requested window')
                if str(row.get('asset_class', '')).lower() != 'residential':
                    exclusions['nonResidential'] += 1
                    continue
                share = row.get('property_sold_share')
                if not isinstance(share, (int, float)) or isinstance(share, bool) or not math.isclose(float(share), 1.0, abs_tol=1e-9):
                    exclusions['partialShare'] += 1
                    continue
                price, area = row.get('property_sale_price_aed'), row.get('property_sold_area_sqm')
                if any(not isinstance(v, (int, float)) or isinstance(v, bool) or not math.isfinite(v) or v <= 0 for v in (price, area)):
                    exclusions['missingPriceOrArea'] += 1
                    continue
                rate = float(price) / float(area) / SQM_PER_SQFT
                reported_sqm_rate = row.get('rate_aed_per_sqm')
                if not isinstance(reported_sqm_rate, (int, float)) or not math.isclose(
                        float(reported_sqm_rate), float(price) / float(area), rel_tol=1e-8, abs_tol=0.02):
                    raise ValueError('ADREC rate does not reconcile to the full-share price and area')
                row_hash = sha256(canonical(row))
                transactions.append({
                    'recordId': project['recordId'], 'projectName': project['projectName'],
                    'sourceObservationId': 'adrec-sha256:' + row_hash,
                    'observationHash': row_hash, 'duplicateOrdinal': 0,
                    'period': date, 'priceAED': float(price), 'areaSqm': float(area),
                    'value': rate, 'propertyType': row.get('property_type'),
                    'assetClass': row.get('asset_class'), 'layout': row.get('property_layout'),
                    'district': row.get('district'), 'community': row.get('community'),
                    'saleApplicationType': row.get('sale_application_type'),
                    'saleSequence': row.get('sale_sequence'), 'soldShare': float(share),
                    'reportedRateAEDPerSqm': float(reported_sqm_rate),
                    'plotAreaSqm': row.get('land_plot_ground_area_sqm'),
                    'retrievedAt': captured_at, 'requestIndex': request_index
                })
                included += 1
            page += 1
            if page >= int(doc.get('totalPages') or 1):
                break
            if len(requests) >= MAX_REQUESTS:
                raise ValueError('ADREC pass would exceed its request limit')
            time.sleep(2)
        observed_total = sum(1 for x in transactions if x['recordId'] == project['recordId']) + sum(exclusions.values())
        if observed_total != total:
            raise ValueError('Captured and excluded row counts do not reconcile to ADREC totalElements')
        projects.append({'recordId': project['recordId'], 'projectName': project['projectName'],
                         'totalElements': total, 'includedFullShareResidentialRows': included,
                         'excluded': exclusions, 'requestIndexes': project_request_indexes})
        if pi < len(plan['projects']) - 1:
            time.sleep(2)
    # Identical rows can represent distinct registrations. Preserve their multiplicity explicitly.
    seen = {}
    for item in transactions:
        key = (item['recordId'], item['observationHash'])
        item['duplicateOrdinal'] = seen.get(key, 0)
        seen[key] = item['duplicateOrdinal'] + 1
        if item['duplicateOrdinal']:
            item['sourceObservationId'] += ':duplicate-' + str(item['duplicateOrdinal'])
    capture = {
        'schemaVersion': 1, 'passId': plan['passId'], 'baseVersion': plan['baseVersion'],
        'asOf': plan['asOf'], 'dateWindow': plan['dateWindow'], 'endpoint': ENDPOINT,
        'rawResponsesRetained': False, 'personalFieldsRetained': False,
        'termsReview': plan['termsReview'], 'requestCount': len(requests), 'requests': requests,
        'projects': projects, 'transactions': transactions,
        'counts': {'projects': len(projects), 'apiRows': sum(x['totalElements'] for x in projects),
                   'includedTransactions': len(transactions),
                   'excludedRows': sum(sum(x['excluded'].values()) for x in projects)},
        'methodology': 'Exact ADREC project-name filter; residential full-share sale rows only. Individual transaction identifiers are not returned by the endpoint; stable hashes cover normalized source rows and duplicate ordinal. Price per square foot is computed only from full-share sale price / sold area. This is a 2019 onward endpoint window, not complete lifetime history.'
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(capture, ensure_ascii=False, indent=2, sort_keys=True) + '\n')
    print(json.dumps(capture['counts'] | {'requestCount': len(requests), 'capturePath': str(args.output)}))

if __name__ == '__main__':
    main()
