#!/usr/bin/env python3
"""Bounded public-source metadata capture. Never enriches or publishes evidence."""
import argparse
import collections
import datetime as dt
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser

USER_AGENT = 'EspaciosEvidenceReview/1.0 (+https://github.com/gugmaae-prog/espacios)'
QUEUE_SHA = 'cfc798a37365aee55fc1b5e3e9fdf15b685b4ee94b44e38c7497718d9dd5780b'
STATES = ('present', 'partial', 'missing', 'unestablished', 'disputed', 'inaccessible', 'pre-applicability')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def stamp():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def canonical(url, domains):
    p = urllib.parse.urlsplit(url)
    if (p.scheme != 'https' or p.hostname not in domains or p.username or p.password
            or p.port not in (None, 443) or p.fragment or '\\' in url
            or re.search(r'[\x00-\x20]', url)):
        raise ValueError('URL is outside the explicit public HTTPS allowlist')
    return urllib.parse.urlunsplit((p.scheme, p.netloc.lower(), p.path or '/', p.query, ''))


def validate(plan, rows):
    if plan.get('schemaVersion') != 1 or plan.get('mode') != 'metadata_review_only':
        raise ValueError('This tool cannot accept or apply property evidence')
    ids = [r['id'] for r in rows]
    if len(ids) != 1860 or len(set(ids)) != 1860:
        raise ValueError('Fixed catalogue identity mismatch')
    if collections.Counter(r['type'] for r in rows) != {'project': 1645, 'community': 215}:
        raise ValueError('Fixed catalogue type mismatch')
    if plan.get('acceptedFacts') != [] or plan.get('numericForecasts') != []:
        raise ValueError('Research captures cannot promote facts or forecasts')
    if plan.get('coverageLedgerDelta') != {s: 0 for s in STATES}:
        raise ValueError('Research captures cannot change coverage')
    sources = plan['sources']
    if not 1 <= len(sources) <= 20 or len({s['id'] for s in sources}) != len(sources):
        raise ValueError('Source page limit or duplicate source identity')
    if plan.get('limits') != {'sourcePages': 20, 'httpRequests': 40, 'concurrency': 1,
                              'redirectsPerUrl': 2, 'bytesPerResponse': 2000000,
                              'timeoutSeconds': 15, 'minimumDelaySeconds': 2}:
        raise ValueError('Collection limits changed without review')
    urls = set()
    for s in sources:
        url = canonical(s['url'], plan['domains'])
        if url in urls:
            raise ValueError('Duplicate canonical candidate URL')
        urls.add(url)
        if not s['reviewAgainstIds'] or not set(s['reviewAgainstIds']) <= set(ids):
            raise ValueError('Unknown review target; name-only joins are forbidden')
        if len(set(s['reviewAgainstIds'])) != len(s['reviewAgainstIds']):
            raise ValueError('Duplicate target ID')
        if s.get('rawRetentionAllowed') is not False or s.get('reuseStatus') != 'normalized_metadata_only':
            raise ValueError('Raw third-party retention is forbidden')
        if s.get('recordId') is not None or s.get('identityVerified') is not False:
            raise ValueError('Review targets are not accepted evidence links')
        if sum(len(x.split()) for x in s['expectedNeedles']) > 25:
            raise ValueError('Excessive retained source quotation')
        published = s.get('reportedPublishedAt')
        if published:
            dt.date.fromisoformat(published)
            if published > plan['asOf']:
                raise ValueError('Future publication candidate')
    return True


class Text(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts, self.hidden = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style', 'noscript'):
            self.hidden += 1

    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'noscript') and self.hidden:
            self.hidden -= 1

    def handle_data(self, value):
        if not self.hidden:
            self.parts.append(value)


def visible(raw):
    parser = Text()
    parser.feed(raw.decode('utf-8', errors='replace'))
    return ' '.join(' '.join(parser.parts).split())


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class Collector:
    def __init__(self, plan, transport=None, sleep=time.sleep):
        self.plan, self.count, self.robots, self.sleep = plan, 0, {}, sleep
        self.transport = transport or self._get
        self.opener = urllib.request.build_opener(NoRedirect())

    def _get(self, url):
        req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT,
                    'Accept': 'text/html, application/json;q=0.5, text/plain;q=0.5',
                    'Accept-Encoding': 'identity'}, method='GET')
        try:
            response = self.opener.open(req, timeout=15)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            data = response.read(2000001)
            return response.status, dict(response.headers), data

    def request(self, url):
        canonical(url, self.plan['domains'])
        if self.count >= 40:
            raise ValueError('Total HTTP request budget exhausted')
        if self.count:
            self.sleep(2)
        self.count += 1
        status, headers, raw = self.transport(url)
        headers = {k.lower(): v for k, v in headers.items()}
        if len(raw) > 2000000:
            raise ValueError('Response size exceeds permitted bound')
        return status, headers, raw

    def permit(self, url):
        p = urllib.parse.urlsplit(url)
        origin = p.scheme + '://' + p.netloc
        if origin not in self.robots:
            status, headers, raw = self.request(origin + '/robots.txt')
            receipt = {'url': origin + '/robots.txt', 'httpStatus': status,
                       'sha256': sha(raw), 'retrievedAt': stamp(),
                       'rawRetained': False}
            parser = urllib.robotparser.RobotFileParser()
            if status in (404, 410):
                parser.parse([])
                receipt['policy'] = 'no_robots_file_404_or_410'
            elif status == 200 and 'text' in headers.get('content-type', '') and b'<html' not in raw.lower():
                parser.parse(raw.decode('utf-8', errors='replace').splitlines())
                receipt['policy'] = 'parsed_robots_rules'
            else:
                parser.disallow_all = True
                receipt['policy'] = 'fail_closed_unavailable_or_invalid_robots'
            self.robots[origin] = (parser, receipt)
        parser, receipt = self.robots[origin]
        delay = parser.crawl_delay(USER_AGENT)
        rate = parser.request_rate(USER_AGENT)
        # A stricter policy is not ignored or worked around by this small collector.
        rate_too_fast = rate and rate.seconds / max(rate.requests, 1) > 2
        return parser.can_fetch(USER_AGENT, url) and not (delay and delay > 2) and not rate_too_fast, receipt

    def capture(self, source):
        out = dict(source)
        out.update(httpStatus=None, finalUrl=None, contentType=None, sha256=None,
                   retrievedAt=None, attemptedAt=stamp(), firstAvailableAt=None,
                   firstAvailabilityBasis='not_established', publicationDatePrecision='day' if source.get('reportedPublishedAt') else 'unknown',
                   datasetVersionId=None, observationStart=None, observationEnd=None,
                   frequency=None, unit=None, currency=None, segment=None,
                   methodology='Bounded metadata review; no accepted observation extracted.',
                   captureMethod='bounded_https_get_robots_checked_no_raw_retention',
                   rawRetained=False, evidenceAccepted=False, coverageCredit=0,
                   redirectChain=[], robotsReceipts=[], needleChecks={})
        if source.get('skipReason'):
            out.update(captureStatus='not_requested_rights_boundary', reason=source['skipReason'])
            return out
        url = source['url']
        try:
            for hop in range(3):
                allowed, robots = self.permit(url)
                out['robotsReceipts'].append(robots)
                if not allowed:
                    out.update(captureStatus='inaccessible', reason='robots_or_conservative_rate_policy')
                    return out
                status, headers, raw = self.request(url)
                out.update(httpStatus=status, finalUrl=url, contentType=headers.get('content-type'),
                           sha256=sha(raw), retrievedAt=stamp(), responseBytes=len(raw),
                           lastModified=headers.get('last-modified'), etag=headers.get('etag'))
                if status in (301, 302, 303, 307, 308):
                    target = urllib.parse.urljoin(url, headers.get('location', ''))
                    canonical(target, self.plan['domains'])
                    out['redirectChain'].append({'from': url, 'to': target, 'httpStatus': status})
                    if hop == 2 or target == url:
                        raise ValueError('Redirect limit or loop')
                    url = target
                    continue
                if status != 200:
                    out.update(captureStatus='inaccessible', reason='http_non_200_no_retry')
                    return out
                if not any(x in headers.get('content-type', '').lower() for x in ('text/html', 'text/plain', 'application/json')):
                    out.update(captureStatus='inaccessible', reason='unsupported_content_type_no_pdf_or_binary_capture')
                    return out
                text = visible(raw).casefold()
                out['needleChecks'] = {needle: needle.casefold() in text for needle in source['expectedNeedles']}
                out.update(captureStatus='captured_metadata_only', firstAvailableAt=out['retrievedAt'],
                           firstAvailabilityBasis='this_capture_only_not_historical_first_publication')
                return out
        except (ValueError, OSError, urllib.error.URLError) as error:
            out.update(captureStatus='inaccessible', reason=type(error).__name__ + ': ' + str(error)[:180])
        return out


def make_receipt(plan, rows, captures, requests):
    validate(plan, rows)
    if {s['id'] for s in captures} != {s['id'] for s in plan['sources']} or len(captures) != len(plan['sources']):
        raise ValueError('Capture manifest mismatch')
    if any(s.get('evidenceAccepted') is not False or s.get('coverageCredit') != 0 or s.get('rawRetained') is not False for s in captures):
        raise ValueError('Capture promoted evidence or raw retention')
    return {'schemaVersion': 1, 'passId': plan['passId'], 'capturedAt': stamp(),
            'base': plan['base'], 'reviewOnly': True, 'queueSha256': QUEUE_SHA,
            'inventoryByEmirate': {e: dict(collections.Counter(r['type'] for r in rows if r['emirate'] == e)) for e in sorted({r['emirate'] for r in rows})},
            'sourceOutcomes': dict(collections.Counter(s['captureStatus'] for s in captures)),
            'sourceCount': len(captures), 'httpRequests': requests,
            'rawRetained': False, 'acceptedFacts': [], 'numericForecasts': [],
            'coverageLedgerDelta': {s: 0 for s in STATES}, 'changedCatalogueRecords': 0,
            'sources': captures}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--plan', required=True, type=Path)
    p.add_argument('--queue', required=True, type=Path)
    p.add_argument('--output', type=Path)
    p.add_argument('--collect', action='store_true', help='Explicit bounded public GET collection; no publishing')
    args = p.parse_args()
    raw = args.queue.read_bytes()
    if sha(raw) != QUEUE_SHA:
        raise SystemExit('Pinned V25 queue checksum mismatch; reconcile before reuse')
    rows = [json.loads(line) for line in raw.splitlines()]
    plan = json.loads(args.plan.read_text())
    validate(plan, rows)
    if not args.collect:
        print(json.dumps({'valid': True, 'records': len(rows), 'sources': len(plan['sources']), 'networkRequests': 0}))
        return
    if not args.output or args.output.exists():
        raise SystemExit('A new, non-existing output file is required')
    collector = Collector(plan)
    captures = [collector.capture(source) for source in plan['sources']]
    receipt = make_receipt(plan, rows, captures, collector.count)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('x', encoding='utf-8') as f:
        json.dump(receipt, f, ensure_ascii=False, sort_keys=True, indent=2)
        f.write('\n')
    print(json.dumps({'sources': len(captures), 'httpRequests': collector.count, 'outcomes': receipt['sourceOutcomes'], 'acceptedFacts': 0}))


if __name__ == '__main__':
    main()
