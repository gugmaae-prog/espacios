#!/usr/bin/env python3
"""Bounded public-source verification. Persist provenance, never article bodies."""
import argparse, concurrent.futures, datetime, hashlib, html, json, pathlib, re, subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = ROOT / 'data/historical-intelligence'

def capture(source):
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    result = {'sourceId': source['id'], 'url': source['url'], 'retrievedAt': started,
              'publishedAt': source.get('publishedAt'), 'firstAvailableAt': source.get('firstAvailableAt'),
              'publicationDateBasis': 'previously verified source publication; retrieval date is separate',
              'bodyRedistributed': False}
    try:
        # Native curl uses the host trust store; TLS verification remains enabled.
        response = subprocess.run(['curl', '--fail', '--silent', '--show-error', '--location',
                                   '--max-time', '10', '--max-filesize', '2097152',
                                   '--user-agent', 'Espacios source-verification/1.0',
                                   '--write-out', '\n%{http_code}\t%{url_effective}\t%{content_type}',
                                   source['url']], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=12)
        if response.returncode:
            raise RuntimeError(response.stderr.decode(errors='replace').strip())
        body, metadata = response.stdout.rsplit(b'\n', 1)
        status, resolved, content_type = metadata.decode().split('\t', 2)
        if body:
            result.update({'resolvedURL': resolved, 'httpStatus': int(status),
                           'contentType': content_type, 'bodyBytes': len(body),
                           'sha256': hashlib.sha256(body).hexdigest(), 'truncated': len(body) > 2 * 1024 * 1024,
                           'captureStatus': 'verified_metadata' if len(body) <= 2 * 1024 * 1024 else 'oversize_body_not_verified'})
            text = body.decode('utf-8', errors='replace')
            patterns = [r'<meta[^>]+(?:property|name)=["\'](?:article:published_time|datePublished|date)["\'][^>]+content=["\']([^"\']+)',
                        r'"datePublished"\s*:\s*"([^"]+)"']
            for pattern in patterns:
                match = re.search(pattern, text, re.I)
                if match:
                    result['pagePublicationMetadata'] = html.unescape(match.group(1))[:128]
                    break
    except Exception as error:
        result.update({'captureStatus': 'retrieval_failed_reference_retained', 'errorClass': type(error).__name__,
                       'error': str(error)[:240]})
    return result

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--limit', type=int, default=20)
    args = parser.parse_args()
    if not 1 <= args.limit <= 24:
        parser.error('limit must be between 1 and 24')
    seed = json.loads((BASE / 'seed-revisions-events.json').read_text())
    sources = seed['sources'][:args.limit]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(capture, sources))
    manifest = {'classification': 'bounded_public_source_provenance', 'bodyRedistributed': False,
                'maximumSources': args.limit, 'maximumConcurrentRequests': 4, 'timeoutSeconds': 10,
                'maximumBodyBytes': 2097152, 'captures': results}
    (BASE / 'event-source-captures.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'attempted': len(results), 'verified': sum(x['captureStatus'] == 'verified_metadata' for x in results),
                      'failed': sum(x['captureStatus'] != 'verified_metadata' for x in results)}))
