#!/usr/bin/env python3
"""Fill a heavy daily research requirement with an ISO-week series.

Native daily observations stay the requirement grain when the extract is
small enough to retain exactly. A daily series is too heavy at or above
HEAVY_DAILY_POINT_THRESHOLD daily points, or when the retained snapshot
cannot fill the daily requirement losslessly because the source's own
transaction count is larger than the retained rows.

Weekly means an ISO week labelled YYYY-Www, Monday through Sunday.
Transaction counts are sums of daily counts. A weekly price is the
source's own weekly figure when one is published; otherwise it is the
count-weighted mean of daily medians, and only when every included day
has a sample count. Missing weights do not become a price. Rent and
yield are copied only when the source states them for that week.

Quarterly, half-year, annual and monthly grains are not rewritten.
A weekly fill does not certify a complete lifetime history, and it does
not turn a community aggregate into a project transaction.
"""
from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import re
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_EVEN
from pathlib import Path

from historical_gap_ledger import weekly_week_requirement

# At or above this many daily points, one area series is too heavy to keep
# as the embedded requirement-fill grain. Below it, daily rows stay daily
# when the snapshot also retains that daily population losslessly.
HEAVY_DAILY_POINT_THRESHOLD = 400

PRICE_QUANTUM = Decimal('0.0001')
ISO_WEEK = re.compile(r'^(\d{4})-W(\d{2})$')
QUARTER = re.compile(r'^\d{4}-?Q[1-4]$', re.I)


def native_frequency(label):
    """Keep the source grain.

    Quarterly, half-year and annual labels stay at that grain. They are
    not rewritten as monthly. Weekly is not rewritten as daily.
    """
    return {
        'quarter': 'quarterly',
        'half-year': 'half-year',
        'native annual / half-year': 'native_mixed',
    }.get(label, label)


def observation_frequency(stated, period):
    """Resolve a stored frequency without relabelling the grain."""
    period = str(period or '')
    weekly_label = ISO_WEEK.fullmatch(period) is not None
    quarterly_label = QUARTER.fullmatch(period) is not None
    if stated in (None, ''):
        return 'weekly' if weekly_label else 'daily'
    frequency = str(stated)
    if frequency == 'daily' and weekly_label:
        raise ValueError('Daily frequency cannot relabel an ISO week')
    if frequency == 'weekly' and not weekly_label:
        raise ValueError('Weekly frequency requires an ISO week label')
    if frequency == 'monthly' and quarterly_label:
        raise ValueError('Quarterly periods are not stored as monthly')
    return frequency


def iso_week(value):
    day = value if isinstance(value, datetime.date) else datetime.date.fromisoformat(str(value))
    year, week, _weekday = day.isocalendar()
    start = datetime.date.fromisocalendar(year, week, 1)
    end = datetime.date.fromisocalendar(year, week, 7)
    return {
        'period': f'{year}-W{week:02d}',
        'weekStart': start.isoformat(),
        'weekEnd': end.isoformat(),
    }


def even_median(values):
    numbers = sorted(value for value in values if value is not None)
    if not numbers:
        return None
    count = len(numbers)
    if count % 2 == 1:
        return numbers[count // 2]
    return (Decimal(str(numbers[count // 2 - 1])) + Decimal(str(numbers[count // 2]))) / 2


def _number(value):
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value.quantize(PRICE_QUANTUM, rounding=ROUND_HALF_EVEN))
    return value


def weighted_mean(days, field):
    """Count-weighted mean of daily medians, or None when a weight is missing."""
    if any(day.get('sampleCount') is None for day in days):
        return None, 'sample_count_missing'
    pairs = []
    for day in days:
        weight = day['sampleCount']
        value = day.get(field)
        if weight > 0 and value is None:
            return None, 'daily_median_missing'
        if weight > 0:
            pairs.append((Decimal(str(value)), Decimal(weight)))
    if not pairs:
        return None, 'no_weighted_samples'
    numerator = sum(value * weight for value, weight in pairs)
    denominator = sum(weight for _value, weight in pairs)
    return _number(numerator / denominator), 'count_weighted_mean_of_daily_medians'


def lossless_daily_retention(stated_transactions, retained_rows):
    """True when the retained rows are the source's stated transaction count.

    A larger stated count means the daily file cannot fill that requirement
    losslessly. An absent stated count is not treated as evidence of a
    hidden population; the daily-point threshold still applies.
    """
    if stated_transactions is None:
        return True
    return int(stated_transactions) == int(retained_rows)


def heaviness(daily_points, stated_transactions, retained_rows):
    reasons = []
    if len(daily_points) >= HEAVY_DAILY_POINT_THRESHOLD:
        reasons.append('daily_point_threshold')
    if not lossless_daily_retention(stated_transactions, retained_rows):
        reasons.append('daily_requirement_not_lossless')
    return {
        'tooHeavy': bool(reasons),
        'reasons': reasons,
        'dailyPointCount': len(daily_points),
        'threshold': HEAVY_DAILY_POINT_THRESHOLD,
        'thresholdComparison': 'at_or_above',
        'statedTransactions': stated_transactions,
        'retainedRows': retained_rows,
        'losslessDailyRetention': lossless_daily_retention(stated_transactions, retained_rows),
    }


def _metric_from_published(published, field):
    if not published or published.get(field) is None:
        return None, None
    return published[field], 'source_weekly_figure'


def derive_weekly(daily_points, published_weekly=None):
    """Collapse retained daily points into ISO weeks. No day is dropped."""
    published = {item['period']: item for item in published_weekly or []}
    grouped = defaultdict(list)
    for point in daily_points:
        if point.get('frequency') not in (None, 'daily'):
            raise ValueError('Weekly derivation accepts daily points only')
        label = iso_week(point['period'])
        grouped[label['period']].append(point)
    def week_record(period, days):
        if days:
            bounds = iso_week(days[0]['period'])
        else:
            year, week = (int(part) for part in period.split('-W'))
            bounds = iso_week(datetime.date.fromisocalendar(year, week, 1))
        known_counts = [day['sampleCount'] for day in days if day.get('sampleCount') is not None]
        transaction_count = sum(known_counts) if known_counts else None
        source_week = published.get(period)
        price, price_basis = _metric_from_published(source_week, 'medianPriceAed')
        if price is None and days:
            price, price_basis = weighted_mean(days, 'medianPriceAed')
        elif price is None:
            price_basis = 'missing_week'
        psf, psf_basis = _metric_from_published(source_week, 'medianPricePerSqftAed')
        if psf is None and days:
            psf, psf_basis = weighted_mean(days, 'medianPricePerSqftAed')
        elif psf is None:
            psf_basis = 'missing_week'
        rent, rent_basis = _metric_from_published(source_week, 'rent')
        yield_pct, yield_basis = _metric_from_published(source_week, 'yieldPct')
        if rent is None and not days:
            rent_basis = 'missing_week'
        if yield_pct is None and not days:
            yield_basis = 'missing_week'
        observed_dates = [day['period'] for day in days]
        ledger = weekly_week_requirement(bounds['weekStart'], bounds['weekEnd'], observed_dates, {
            'transactionCount': transaction_count,
            'price': price,
            'pricePerSqft': psf,
            'rent': rent,
            'yield': yield_pct,
        })
        return {
            'period': period,
            'frequency': 'weekly',
            'requirementFill': ledger['coverage'] != 'missing',
            'weekStart': bounds['weekStart'],
            'weekEnd': bounds['weekEnd'],
            'transactionCount': transaction_count,
            'sampleCount': transaction_count,
            'medianPriceAed': price,
            'medianPricePerSqftAed': psf,
            'rent': rent,
            'yieldPct': yield_pct,
            'priceBasis': price_basis,
            'pricePerSqftBasis': psf_basis,
            'rentBasis': rent_basis,
            'yieldBasis': yield_basis,
            'observedDayCount': ledger['observedDayCount'],
            'observedDates': ledger['observedDates'],
            'notIndependentlyObservedDates': ledger['notIndependentlyObservedDates'],
            'weekCoverage': ledger['coverage'],
            'sparseSample': ledger['sparseSample'],
            'completeLifetimeHistory': False,
            'requirementsPresent': sorted(ledger['present']),
            'requirementsMissing': ledger['missing'],
        }

    periods = sorted(grouped)
    if not periods:
        return []
    first = datetime.date.fromisoformat(iso_week(grouped[periods[0]][0]['period'])['weekStart'])
    last = datetime.date.fromisoformat(iso_week(grouped[periods[-1]][0]['period'])['weekStart'])
    weeks = []
    cursor = first
    while cursor <= last:
        label = iso_week(cursor)['period']
        days = sorted(grouped.get(label, []), key=lambda point: point['period'])
        if days and any(iso_week(day['period'])['period'] != label for day in days):
            raise ValueError('Daily point fell outside its ISO week')
        weeks.append(week_record(label, days))
        cursor += datetime.timedelta(days=7)
    return weeks


def daily_points_from_rows(rows):
    """One daily point per observed date. Every input row is accounted for."""
    grouped = defaultdict(list)
    for index, row in enumerate(rows):
        if not row.get('date'):
            raise ValueError('Observed row has no date and cannot be omitted')
        grouped[row['date']].append((index, row))
    points = []
    seen_rows = []
    for day in sorted(grouped):
        items = grouped[day]
        prices = [row.get('priceAed') for _index, row in items]
        psfs = [row.get('pricePerSqftAed') for _index, row in items]
        row_numbers = [row.get('row', index + 1) for index, row in items]
        seen_rows.extend(row_numbers)
        points.append({
            'period': day,
            'frequency': 'daily',
            'requirementFill': False,
            'transactionCount': len(items),
            'sampleCount': len(items),
            'medianPriceAed': _number(even_median(prices if all(value is not None for value in prices) else [])),
            'medianPricePerSqftAed': _number(even_median(psfs if all(value is not None for value in psfs) else [])),
            'rent': None,
            'yieldPct': None,
            'rowNumbers': row_numbers,
        })
    expected = [row.get('row', index + 1) for index, row in enumerate(rows)]
    if sorted(seen_rows) != sorted(expected) or len(seen_rows) != len(rows):
        raise ValueError('Daily manifest omitted an observed row')
    return points


def fill_series(daily_points, *, frequency='daily', scope, identity_verified=False,
                stated_transactions=None, retained_rows=None, published_weekly=None,
                snapshot_yield=None):
    """Choose the requirement grain and derive weekly points only when heavy."""
    if identity_verified is True and scope in ('community_context', 'area_community_transaction_context'):
        raise ValueError('Community scope cannot be verified as a subject project transaction')
    retained_rows = len(daily_points) if retained_rows is None else retained_rows
    if frequency != 'daily':
        return {
            'frequency': native_frequency(frequency),
            'requirementFillGrain': native_frequency(frequency),
            'scope': scope,
            'identityVerified': identity_verified is True,
            'promotedToSubject': False,
            'promotedToProjectTransaction': False,
            'resampledToWeekly': False,
            'resampledToMonthly': False,
            'completeLifetimeHistory': False,
            'points': daily_points,
            'dailyManifest': None,
            'heaviness': None,
            'reason': 'Native frequency retained. Quarterly, half-year, annual and monthly grains are not rewritten as another grain.',
        }
    decision = heaviness(daily_points, stated_transactions, retained_rows)
    manifest = [{**point, 'frequency': 'daily', 'requirementFill': not decision['tooHeavy']} for point in daily_points]
    if any(point['frequency'] != 'daily' for point in manifest):
        raise ValueError('Daily rows were relabelled')
    base = {
        'scope': scope,
        'identityVerified': False if identity_verified is not True else True,
        'promotedToSubject': False,
        'promotedToProjectTransaction': False,
        'resampledToMonthly': False,
        'completeLifetimeHistory': False,
        'snapshotYieldPct': snapshot_yield,
        'snapshotYieldAppliedToWeeks': False,
        'heaviness': decision,
    }
    if not decision['tooHeavy']:
        return {
            **base,
            'frequency': 'daily',
            'requirementFillGrain': 'daily',
            'resampledToWeekly': False,
            'points': manifest,
            'dailyManifest': manifest,
            'reason': 'Daily extract is under the heaviness threshold and matches the stated transaction count, so the daily grain is retained exactly.',
        }
    weekly = derive_weekly(daily_points, published_weekly)
    if any(point['frequency'] != 'weekly' for point in weekly):
        raise ValueError('Weekly fill must stay weekly')
    return {
        **base,
        'frequency': 'weekly',
        'requirementFillGrain': 'weekly',
        'resampledToWeekly': True,
        'points': weekly,
        'dailyManifest': [{**point, 'frequency': 'daily', 'requirementFill': False} for point in daily_points],
        'reason': 'Daily series is too heavy for exact requirement fill. Observed rows stay in the daily manifest; the requirement grain is the ISO week.',
    }


def _movement_for_series(result):
    """Count week requirements the weekly grain fills, and what stays missing."""
    if result['requirementFillGrain'] != 'weekly':
        return {
            'moved': {key: 0 for key in ('transaction_count', 'price', 'price_per_sqft', 'rent', 'yield')},
            'presentPartialWeeks': {key: 0 for key in ('transaction_count', 'price', 'price_per_sqft', 'rent', 'yield')},
            'presentCompleteWeeks': {key: 0 for key in ('transaction_count', 'price', 'price_per_sqft', 'rent', 'yield')},
            'missingBecausePartialUnobservedDays': 0,
            'missingDayRequirementsBecauseWeekIsPartialOrNotIndependent': 0,
            'missingBecauseMetricAbsent': {key: 0 for key in ('transaction_count', 'price', 'price_per_sqft', 'rent', 'yield')},
            'missingWeeks': 0,
            'daysNotIndependentlyObserved': 0,
        }
    moved = defaultdict(int)
    partial = defaultdict(int)
    complete = defaultdict(int)
    absent = defaultdict(int)
    name = {
        'transactionCount': 'transaction_count',
        'price': 'price',
        'pricePerSqft': 'price_per_sqft',
        'rent': 'rent',
        'yield': 'yield',
    }
    missing_weeks = 0
    unobserved_day_requirements = 0
    unobserved_days = 0
    for week in result['points']:
        if week['weekCoverage'] == 'missing':
            missing_weeks += 1
            continue
        if week['notIndependentlyObservedDates']:
            unobserved_days += len(week['notIndependentlyObservedDates'])
        for key, label in name.items():
            if key in week['requirementsPresent']:
                moved[label] += 1
                if week['weekCoverage'] == 'partial':
                    partial[label] += 1
                elif week['weekCoverage'] == 'complete':
                    complete[label] += 1
            elif week['requirementsMissing'].get(key) == 'metric_absent':
                absent[label] += 1
        # Days inside a filled week stay out of the daily requirement grain.
        if week['weekCoverage'] == 'partial' and week['requirementsPresent']:
            unobserved_day_requirements += len(week['notIndependentlyObservedDates']) * len(week['requirementsPresent'])
    return {
        'moved': {key: moved[key] for key in name.values()},
        'presentPartialWeeks': {key: partial[key] for key in name.values()},
        'presentCompleteWeeks': {key: complete[key] for key in name.values()},
        'missingBecausePartialUnobservedDays': unobserved_days,
        'missingDayRequirementsBecauseWeekIsPartialOrNotIndependent': unobserved_day_requirements,
        'missingBecauseMetricAbsent': {key: absent[key] for key in name.values()},
        'missingWeeks': missing_weeks,
        'daysNotIndependentlyObserved': unobserved_days,
    }


def _requirement_name(key):
    return {
        'transactionCount': 'transaction_count',
        'price': 'price',
        'pricePerSqft': 'price_per_sqft',
        'rent': 'rent',
        'yield': 'yield',
    }.get(key, key)


def _add_counts(total, part):
    for key, value in part.items():
        if isinstance(value, dict):
            bucket = total.setdefault(key, {})
            for name, count in value.items():
                bucket[name] = bucket.get(name, 0) + count
        else:
            total[key] = total.get(key, 0) + value


def build_packet(extract_dir, scope_path):
    extract_dir = Path(extract_dir)
    scope = json.loads(Path(scope_path).read_text())
    areas = scope['areas']
    series = []
    movement = {}
    for path in sorted(extract_dir.glob('*.json')):
        payload = json.loads(path.read_text())
        area_id = payload['areaId']
        if area_id not in areas:
            raise ValueError('Extract has no scope record: ' + area_id)
        identity = areas[area_id]
        rows = payload['rows']
        daily = daily_points_from_rows(rows)
        stated = payload.get('summary', {}).get('transactions')
        result = fill_series(
            daily,
            frequency='daily',
            scope=identity['scope'],
            identity_verified=False,
            stated_transactions=stated,
            retained_rows=len(rows),
            snapshot_yield=payload.get('summary', {}).get('rentalYieldPct'),
        )
        if result['scope'] != identity['scope']:
            raise ValueError('Scope changed during weekly fill')
        if result['promotedToProjectTransaction'] or result['promotedToSubject']:
            raise ValueError('Community or development aggregate was promoted')
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        entry = {
            'sourceId': payload['sourceId'],
            'areaId': area_id,
            'title': payload.get('title') or identity['title'],
            'scope': result['scope'],
            'scopeNote': identity.get('scopeNote'),
            'catalogue': identity.get('catalogue'),
            'notUsedAsThisSeries': identity.get('notUsedAsThisSeries') or [],
            'identityVerified': False,
            'promotedToSubject': False,
            'promotedToProjectTransaction': False,
            'filenames': payload.get('filenames') or [],
            'extractFile': str(path.name),
            'extractSha256': digest,
            'sourceSha256': payload.get('sha256'),
            'frequency': result['frequency'],
            'requirementFillGrain': result['requirementFillGrain'],
            'heaviness': result['heaviness'],
            'reason': result['reason'],
            'completeLifetimeHistory': False,
            'forecastsThrough2080': None,
            'observedRowCount': len(rows),
            'dailyPointCount': len(daily),
            'dailyManifest': result['dailyManifest'],
            'weeklyPointCount': len(result['points']) if result['requirementFillGrain'] == 'weekly' else 0,
            'points': result['points'] if result['requirementFillGrain'] == 'weekly' else None,
            'snapshotYieldPct': result['snapshotYieldPct'],
            'snapshotYieldAppliedToWeeks': False,
            'requirementMovement': _movement_for_series(result),
        }
        _assert_rows_retained(entry, rows)
        series.append(entry)
        _add_counts(movement, entry['requirementMovement'])
    printed = {}
    for entry in series:
        signature = json.dumps([
            {key: point.get(key) for key in ('period', 'transactionCount', 'medianPriceAed', 'medianPricePerSqftAed')}
            for point in entry['dailyManifest']
        ], sort_keys=True)
        prior = printed.get(signature)
        if prior:
            entry['samePrintedRowsAs'] = prior
            entry['requirementsAdditive'] = False
        else:
            printed[signature] = entry['sourceId']
            entry['samePrintedRowsAs'] = None
            entry['requirementsAdditive'] = True
    deduped = {}
    for entry in series:
        if entry['requirementsAdditive']:
            _add_counts(deduped, entry['requirementMovement'])
    stayed = [item for item in series if item['requirementFillGrain'] == 'daily']
    moved = [item for item in series if item['requirementFillGrain'] == 'weekly']
    duplicate_names = []
    for item in series:
        if len(item['filenames']) > 1:
            duplicate_names.append({'sourceId': item['sourceId'], 'filenames': item['filenames'], 'sha256': item['sourceSha256']})
    differing = _differing_same_area(series)
    return {
        'schemaVersion': 1,
        'asOf': '2026-10-06',
        'classification': 'weekly_requirement_fill',
        'productionDeployed': False,
        'forecastsThrough2080': None,
        'pricesInvented': False,
        'rule': {
            'preferredGrain': 'daily',
            'heavyDailyPointThreshold': HEAVY_DAILY_POINT_THRESHOLD,
            'thresholdComparison': 'at_or_above',
            'losslessRule': 'A retained daily extract is lossless only when its row count equals the source transaction count printed on the snapshot. A larger stated count cannot be filled day by day from the retained rows, so the requirement grain becomes the ISO week. Observed rows stay in the daily manifest.',
            'week': 'ISO week YYYY-Www, Monday through Sunday',
            'price': 'Source weekly figure when published; otherwise the count-weighted mean of daily even-medians, and only when every included day has a sample count.',
            'rentAndYield': 'Copied onto a week only when that week states them. A snapshot card yield is retained separately and is not spread across weeks.',
            'partialWeeks': 'Fewer than 7 observed days stay partial. Missing weeks stay missing. Sparse weeks stay sparse. None of these are complete, and a weekly fill does not certify a lifetime history.',
            'nativeFrequency': 'Quarterly, half-year, annual and monthly series are not rewritten. Daily rows are not relabelled weekly.',
        },
        'counts': {
            'sourceSeries': len(series),
            'areas': len({item['areaId'] for item in series}),
            'stayedDaily': len(stayed),
            'movedToWeekly': len(moved),
            'stayedDailySourceIds': [item['sourceId'] for item in stayed],
            'movedToWeeklySourceIds': [item['sourceId'] for item in moved],
            'observedRows': sum(item['observedRowCount'] for item in series),
            'identicalFilenameGroups': duplicate_names,
            'differingFilesRetained': differing,
        },
        'requirementMovement': movement,
        'requirementMovementExcludingRepeatedPrints': deduped,
        'repeatedPrintsAreNotAdditive': [item['sourceId'] for item in series if item['samePrintedRowsAs']],
        'series': series,
    }


def _assert_rows_retained(entry, rows):
    manifest_rows = [number for point in entry['dailyManifest'] for number in point['rowNumbers']]
    expected = [row.get('row', index + 1) for index, row in enumerate(rows)]
    if sorted(manifest_rows) != sorted(expected):
        raise ValueError('Daily manifest does not retain every observed row for ' + entry['sourceId'])
    if sum(point['transactionCount'] for point in entry['dailyManifest']) != len(rows):
        raise ValueError('Daily counts do not match observed rows for ' + entry['sourceId'])
    if entry['requirementFillGrain'] == 'daily':
        if any(point.get('frequency') != 'daily' for point in entry['dailyManifest']):
            raise ValueError('Daily series was relabelled for ' + entry['sourceId'])
        return
    for point in entry['points']:
        if point['frequency'] != 'weekly' or not ISO_WEEK.fullmatch(point['period']):
            raise ValueError('Weekly point lost its weekly grain for ' + entry['sourceId'])
        if point['weekCoverage'] == 'partial' and point['observedDayCount'] >= 7:
            raise ValueError('Partial week was miscounted for ' + entry['sourceId'])
        if point['weekCoverage'] == 'complete' and point['observedDayCount'] != 7:
            raise ValueError('Complete week does not have 7 observed days for ' + entry['sourceId'])
        start = datetime.date.fromisoformat(point['weekStart'])
        end = datetime.date.fromisoformat(point['weekEnd'])
        if start.weekday() != 0 or end.weekday() != 6:
            raise ValueError('Week bounds are not Monday through Sunday')


def _differing_same_area(series):
    grouped = defaultdict(list)
    for item in series:
        grouped[item['areaId']].append(item['sourceId'])
    return {area: ids for area, ids in grouped.items() if len(ids) > 1}


def main():
    parser = argparse.ArgumentParser(description='Derive weekly requirement fills for heavy daily snapshot series')
    parser.add_argument('--extracts', default='enrichment/transaction-snapshots-20261006/extracts')
    parser.add_argument('--scope', default='enrichment/transaction-snapshots-20261006/scope.json')
    parser.add_argument('--output', default='enrichment/weekly-requirement-fill-20261006/packet.json')
    args = parser.parse_args()
    packet = build_packet(args.extracts, args.scope)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(packet, indent=2, sort_keys=True) + '\n')
    counts = packet['counts']
    print(json.dumps({
        'output': str(output),
        'stayedDaily': counts['stayedDaily'],
        'movedToWeekly': counts['movedToWeekly'],
        'sourceSeries': counts['sourceSeries'],
        'requirementMovement': packet['requirementMovement']['moved'],
    }, sort_keys=True))


if __name__ == '__main__':
    main()
