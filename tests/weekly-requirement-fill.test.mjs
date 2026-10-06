import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

function run(mode){
  const result = spawnSync('python3', ['-c', script, mode], {encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

const script = String.raw`
import datetime, json, sys
sys.path.insert(0, 'scripts')
from historical_enrichment import apply_enrichment
from historical_gap_ledger import period_start
from weekly_requirement_fill import HEAVY_DAILY_POINT_THRESHOLD, build_packet, fill_series, observation_frequency

mode = sys.argv[1]

def day(offset, count=1, price=100, psf=10, sample=1):
    period = (datetime.date(2024, 1, 1) + datetime.timedelta(days=offset)).isoformat()
    return {'period': period, 'frequency': 'daily', 'sampleCount': sample, 'transactionCount': count, 'medianPriceAed': price, 'medianPricePerSqftAed': psf, 'rowNumbers': [offset + 1]}

if mode == 'daily':
    points = [day(0, count=2, sample=2), day(1, count=1, sample=1)]
    result = fill_series(points, scope='community_context', stated_transactions=2, retained_rows=2)
    assert result['frequency'] == 'daily' and result['requirementFillGrain'] == 'daily'
    assert result['resampledToWeekly'] is False
    assert all(point['frequency'] == 'daily' for point in result['points'])
    assert all('W' not in point['period'] for point in result['points'])
    assert result['scope'] == 'community_context' and result['promotedToProjectTransaction'] is False
    assert HEAVY_DAILY_POINT_THRESHOLD == 400

if mode == 'heavy':
    points = [day(i, count=1, price=10, psf=1, sample=1) for i in range(HEAVY_DAILY_POINT_THRESHOLD)]
    result = fill_series(points, scope='area_community_transaction_context', stated_transactions=400, retained_rows=400)
    assert result['frequency'] == 'weekly' and result['requirementFillGrain'] == 'weekly'
    assert result['heaviness']['reasons'] == ['daily_point_threshold']
    assert result['scope'] == 'area_community_transaction_context'
    assert result['promotedToSubject'] is False and result['completeLifetimeHistory'] is False
    week = result['points'][0]
    assert week['period'] == '2024-W01' and week['frequency'] == 'weekly'
    assert week['weekStart'] == '2024-01-01' and week['weekEnd'] == '2024-01-07'
    assert datetime.date.fromisoformat(week['weekStart']).weekday() == 0
    assert datetime.date.fromisoformat(week['weekEnd']).weekday() == 6
    assert week['transactionCount'] == 7
    assert all(point['frequency'] == 'daily' and point['requirementFill'] is False for point in result['dailyManifest'])
    assert sum(point['transactionCount'] for point in result['dailyManifest']) == 400
    below = fill_series(points[:-1], scope='community_context', stated_transactions=399, retained_rows=399)
    assert below['frequency'] == 'daily'
    assert all(point['frequency'] == 'daily' for point in below['points'])

if mode == 'unweighted':
    points = [day(0, count=2, sample=2, price=100), day(1, count=1, sample=None, price=900)]
    published = [{'period': '2024-W01', 'medianPriceAed': 250}]
    withheld = fill_series(points, scope='community_context', stated_transactions=50, retained_rows=2)
    week = withheld['points'][0]
    assert week['medianPriceAed'] is None and week['medianPricePerSqftAed'] is None
    assert week['priceBasis'] == 'sample_count_missing'
    assert week['transactionCount'] == 2
    assert week['rent'] is None and week['requirementsMissing']['rent'] == 'metric_absent'
    stated = fill_series(points, scope='community_context', stated_transactions=50, retained_rows=2, published_weekly=published)
    assert stated['points'][0]['medianPriceAed'] == 250
    assert stated['points'][0]['priceBasis'] == 'source_weekly_figure'
    assert stated['points'][0]['medianPricePerSqftAed'] is None

if mode == 'partial':
    points = [day(0, count=1, sample=1, price=100, psf=10), day(1, count=3, sample=3, price=200, psf=20)]
    result = fill_series(points, scope='community_context', stated_transactions=80, retained_rows=4, snapshot_yield=7)
    week = next(point for point in result['points'] if point['weekCoverage'] != 'missing')
    assert week['weekCoverage'] == 'partial' and week['observedDayCount'] == 2
    assert week['transactionCount'] == 4 and week['medianPriceAed'] == 175
    assert week['medianPricePerSqftAed'] == 17.5
    assert '2024-01-07' in week['notIndependentlyObservedDates']
    assert week['completeLifetimeHistory'] is False
    assert result['snapshotYieldPct'] == 7 and result['snapshotYieldAppliedToWeeks'] is False
    assert week['yieldPct'] is None and week['requirementsMissing']['yield'] == 'metric_absent'
    gapped = fill_series([day(0), day(14)], scope='community_context', stated_transactions=20, retained_rows=2)
    missing = next(point for point in gapped['points'] if point['period'] == '2024-W02')
    assert missing['weekCoverage'] == 'missing' and missing['medianPriceAed'] is None and missing['requirementFill'] is False

if mode == 'scope':
    result = fill_series([day(0)], scope='community_context', stated_transactions=1, retained_rows=1)
    assert result['scope'] == 'community_context' and result['identityVerified'] is False
    assert result['promotedToProjectTransaction'] is False and result['promotedToSubject'] is False
    try:
        fill_series([day(0)], scope='area_community_transaction_context', identity_verified=True, stated_transactions=1, retained_rows=1)
        raise AssertionError('community aggregate accepted as a project transaction')
    except ValueError as error:
        assert 'Community scope' in str(error)
    native = fill_series([{'period': '2024Q1', 'frequency': 'quarterly', 'value': 10}], frequency='quarterly', scope='community_context')
    assert native['frequency'] == 'quarterly' and native['resampledToWeekly'] is False and native['resampledToMonthly'] is False
    assert native['points'][0]['period'] == '2024Q1'
    assert observation_frequency('daily', '2024-01-01') == 'daily'
    try:
        observation_frequency('daily', '2024-W01')
        raise AssertionError('daily relabel accepted')
    except ValueError:
        pass
    try:
        observation_frequency('monthly', '2024Q1')
        raise AssertionError('quarterly stored as monthly')
    except ValueError:
        pass
    assert observation_frequency(None, '2024-W01') == 'weekly'
    assert period_start('2024-W01') == '2024-01-01'
    src = {'s': {'id': 's', 'url': 'https://example.org/evidence', 'retrievedAt': '2026-10-04T00:00:00Z', 'firstAvailableAt': '2026-10-04T00:00:00Z'}}
    def rec():
        return {'id': 'p', 'emirate': 'Dubai', 'type': 'project', 'name': 'p', 'lifecycle': [], 'observations': [], 'historySeries': [], 'researchStatus': {'gaps': []}, 'currentSnapshot': {}, 'coverageSummary': {}}
    def apply(observation):
        record = rec()
        fact = {'id': 'price', 'recordId': 'p', 'kind': 'financial', 'status': 'accepted', 'identityBasis': 'Exact community print', 'sourceId': 's', 'scope': 'community_context', 'observation': observation}
        apply_enrichment({'schemaVersion': 1, 'asOf': '2026-10-05', 'facts': [fact]}, [record], {}, src, lambda item: None, {}, '2026-10-05')
        return record
    stored = apply({'value': 175, 'metric': 'price', 'unit': 'AED/sqft', 'period': '2024-W01', 'frequency': 'weekly', 'observationKind': 'aggregate'})
    assert stored['observations'][0]['frequency'] == 'weekly' and stored['observations'][0]['scope'] == 'community_context'
    try:
        apply({'value': 175, 'metric': 'price', 'unit': 'AED/sqft', 'period': '2024-W01', 'frequency': 'daily', 'observationKind': 'aggregate'})
        raise AssertionError('weekly period stored as daily')
    except ValueError as error:
        assert 'ISO week' in str(error)

if mode == 'packet':
    packet = build_packet('enrichment/transaction-snapshots-20261006/extracts', 'enrichment/transaction-snapshots-20261006/scope.json')
    counts = packet['counts']
    assert packet['rule']['heavyDailyPointThreshold'] == 400
    assert packet['forecastsThrough2080'] is None and packet['pricesInvented'] is False
    assert counts['stayedDaily'] == 2 and counts['movedToWeekly'] == 19 and counts['sourceSeries'] == 21
    stayed = {item['areaId'] for item in packet['series'] if item['requirementFillGrain'] == 'daily'}
    assert stayed == {'arancia-yards-by-beyond', 'nad-al-sheba'}
    for item in packet['series']:
        assert item['completeLifetimeHistory'] is False and item['forecastsThrough2080'] is None
        assert item['promotedToProjectTransaction'] is False and item['identityVerified'] is False
        assert item['snapshotYieldAppliedToWeeks'] is False
        assert sum(point['transactionCount'] for point in item['dailyManifest']) == item['observedRowCount']
        rows = [number for point in item['dailyManifest'] for number in point['rowNumbers']]
        assert sorted(rows) == list(range(1, item['observedRowCount'] + 1))
        if item['requirementFillGrain'] == 'daily':
            assert item['frequency'] == 'daily'
            assert all(point['frequency'] == 'daily' for point in item['dailyManifest'])
            continue
        assert item['frequency'] == 'weekly'
        assert all(point['frequency'] == 'daily' and point['requirementFill'] is False for point in item['dailyManifest'])
        filled = [point for point in item['points'] if point['requirementFill']]
        assert filled and all(point['frequency'] == 'weekly' and point['weekCoverage'] in ('partial', 'sparse', 'complete') for point in filled)
        assert all(point['rent'] is None and point['yieldPct'] is None for point in item['points'])
        assert all(point['weekCoverage'] != 'complete' or point['observedDayCount'] == 7 for point in item['points'])
        assert all(point['weekCoverage'] != 'partial' or point['observedDayCount'] < 7 for point in item['points'])
    print(json.dumps({'counts': counts, 'moved': packet['requirementMovement']['moved'], 'missingBecauseMetricAbsent': packet['requirementMovement']['missingBecauseMetricAbsent'], 'missingWeeks': packet['requirementMovement']['missingWeeks'], 'daysNotIndependentlyObserved': packet['requirementMovement']['daysNotIndependentlyObserved'], 'presentPartialWeeks': packet['requirementMovement']['presentPartialWeeks'], 'presentCompleteWeeks': packet['requirementMovement']['presentCompleteWeeks']}, sort_keys=True))
`;

for (const mode of ['daily', 'heavy', 'unweighted', 'partial', 'scope']) {
  test('weekly requirement fill keeps the source grain: ' + mode, () => {
    run(mode);
  });
}

test('uploaded snapshot series stay daily under the threshold and move to weekly when the daily file is not lossless', () => {
  const output = run('packet');
  const summary = JSON.parse(output);
  assert.equal(summary.counts.stayedDaily, 2);
  assert.equal(summary.counts.movedToWeekly, 19);
  assert.equal(summary.moved.rent, 0);
  assert.equal(summary.moved.yield, 0);
  assert.ok(summary.moved.transaction_count > 0);
  assert.ok(summary.moved.price > 0);
  assert.equal(summary.missingBecauseMetricAbsent.rent, summary.moved.transaction_count);
  assert.equal(summary.missingBecauseMetricAbsent.yield, summary.moved.transaction_count);
});
