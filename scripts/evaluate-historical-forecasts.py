"""Retrospective walk-forward research: no subject joins and no 2080 certification.
Requires duckdb==1.5.6. See docs/HISTORICAL-INTELLIGENCE.md.
"""
import argparse, collections, datetime as dt, hashlib, json, math
from pathlib import Path
import duckdb

EXPECTED_SHA = '336984181fdb9318376ae25cb9e290dae70bb664235a85f530e2e719d93dd7de'
FEATURE_NAMES = ['intercept', 'annual_log_change', 'quarterly_log_change', 'annual_log_volume_change', 'villa', 'off_plan', 'financial_events', 'pandemic_events', 'migration_events', 'policy_events', 'security_events']

def period_index(date):
    return date.year * 4 + (date.month - 1) // 3

def quarter_end(q):
    y, k = divmod(q, 4)
    return dt.date(y + (k == 3), (k * 3 + 3) % 12 + 1, 1) - dt.timedelta(days=1)

def bounded_date(value):
    precision = None
    if isinstance(value, dict):
        precision = value.get('precision')
        value = value.get('end') or value.get('latest') or value.get('date') or value.get('value') or value.get('start')
    if not value: return None
    s = str(value)
    try:
        if len(s) == 4: return dt.date(int(s), 12, 31)
        if len(s) in (6,7) and 'Q' in s:
            y,k=s.replace('-','').split('Q');return quarter_end(int(y)*4+int(k)-1) if 1 <= int(k) <= 4 else None
        if len(s) in (6,7) and 'H' in s:
            y,k=s.replace('-','').split('H');return dt.date(int(y),6,30) if k=='1' else dt.date(int(y),12,31) if k=='2' else None
        if s.endswith('FY'): return dt.date(int(s.replace('-','')[:-2]),12,31)
        if len(s) == 7:
            y,m=map(int,s.split('-'))
            if not 1 <= m <= 12: return None
            return dt.date(y+(m==12),m%12+1,1)-dt.timedelta(days=1)
        if 'T' in s:
            stamp=dt.datetime.fromisoformat(s.replace('Z','+00:00'))
            if stamp.tzinfo is None: return None
            date=stamp.astimezone(dt.timezone.utc).date()
        else:
            if len(s)!=10: return None
            date = dt.date.fromisoformat(s)
        if precision == 'year': return dt.date(date.year,12,31)
        if precision == 'quarter': return quarter_end(period_index(date))
        if precision == 'half_year': return dt.date(date.year,6,30) if date.month<=6 else dt.date(date.year,12,31)
        if precision == 'month': return dt.date(date.year+(date.month==12),date.month%12+1,1)-dt.timedelta(days=1)
        return date
    except (ValueError, TypeError): return None

def occurrence_date(value):
    # A documented range onset is usable without waiting for its end. Coarse
    # month/quarter/year dates remain conservatively bounded at their period end.
    if isinstance(value,dict) and value.get('precision')=='range':
        return bounded_date(value.get('start') or value.get('date'))
    return bounded_date(value)

def event_features(events, sources, q, with_audit=False):
    cutoff = quarter_end(q)
    start = quarter_end(q-4)
    counts = [0.0] * 5
    audit = {'cutoff':str(cutoff),'windowStartExclusive':str(start),'eligibleEventIds':[],'excluded':[],'policy':'All referenced sources must have known availability and publication no later than the forecast origin. Coarse dates are conservatively bounded; retrieval is never first-known publication.'}
    def excluded(event,reason): audit['excluded'].append({'eventId':event.get('id'),'reason':reason})
    for event in events:
        geography = event.get('geography') or {}
        emirates = geography.get('emirates',event.get('emirates',[])) if isinstance(geography,dict) else event.get('emirates',[])
        if emirates and 'Dubai' not in emirates and not any(x in emirates for x in ('UAE','United Arab Emirates','All UAE')):
            excluded(event,'not_Dubai_or_national_context');continue
        label = (str(event.get('id',''))+' '+str(event.get('category',''))+' '+str(event.get('name',''))+' '+str(event.get('title',''))).lower()
        # Infrastructure is not converted to an automatic price feature or uplift.
        category = next((i for i, terms in enumerate([
            ['financial','interest','rate-tight','rate-eas','oil','correction','crisis'],
            ['pandemic','covid','reopen','tourist'], ['mobilis','mobiliz','russia','migration'],
            ['ownership','residen','rental-index','regulation','policy','fatf'],
            ['security','attack','aviation','disruption','conflict']]) if any(t in label for t in terms)), None)
        if category is None:
            excluded(event,'not_a_modelled_macro_category');continue
        occurrence = occurrence_date(event.get('eventDate') or event.get('occurrenceDate') or event.get('occurrence') or event.get('date') or event.get('dates',{}).get('occurrence'))
        availability = bounded_date(event.get('firstAvailableAt') or event.get('firstKnownAvailability') or event.get('availableAt'))
        source_ids = event.get('sourceIds', [])
        source_dates=[];source_ok=bool(source_ids)
        for source_id in source_ids:
            source=sources.get(source_id)
            if not source:
                source_ok=False;break
            source_pub=bounded_date(source.get('publishedAt') or source.get('publicationDate') or source.get('published'))
            source_available=bounded_date(source.get('firstAvailableAt') or source.get('firstKnownAvailability') or source.get('availableAt')) or source_pub
            if source_available is None or source_available>cutoff or source_pub and (source_pub>cutoff or source_available<source_pub):
                source_ok=False;break
            source_dates.append(source_available)
        if not source_ok:
            excluded(event,'supporting_source_missing_future_or_conflicting_publication');continue
        published = bounded_date(event.get('publishedAt') or event.get('published'))
        if availability is None: availability = published or max(source_dates)
        if published and (published>cutoff or availability<published):
            excluded(event,'event_publication_future_or_conflicts_with_first_availability');continue
        if not occurrence or not availability:
            excluded(event,'event_occurrence_or_first_availability_unknown');continue
        if availability>cutoff:
            excluded(event,'event_not_available_at_origin');continue
        if not start < occurrence <= cutoff:
            excluded(event,'outside_trailing_four_native_quarters');continue
        counts[category] += 1;audit['eligibleEventIds'].append(event.get('id'))
    return (counts,audit) if with_audit else counts

def solve(a,b):
    n=len(b); rows=[a[i][:]+[b[i]] for i in range(n)]
    for i in range(n):
        pivot=max(range(i,n),key=lambda j:abs(rows[j][i]));rows[i],rows[pivot]=rows[pivot],rows[i]
        if abs(rows[i][i])<1e-12: return None
        div=rows[i][i];rows[i]=[x/div for x in rows[i]]
        for j in range(n):
            if j==i: continue
            div=rows[j][i];rows[j]=[x-div*y for x,y in zip(rows[j],rows[i])]
    return [row[-1] for row in rows]

def ridge(samples, penalty=10):
    n=len(FEATURE_NAMES); a=[[0.0]*n for _ in range(n)];b=[0.0]*n
    for x,y in samples:
        for i in range(n):
            b[i]+=x[i]*y
            for j in range(n): a[i][j]+=x[i]*x[j]
    for i in range(1,n): a[i][i]+=penalty
    return solve(a,b)

def features(series, q, kind, reg, event_vector):
    if not all(k in series for k in (q,q-1,q-4)): return None
    a,b,c=series[q],series[q-1],series[q-4]
    if min(a['n'],b['n'],c['n'])<20: return None
    return [1.0, math.log(a['price']/c['price']),math.log(a['price']/b['price']),math.log(a['n']/c['n']),float(kind=='Villa'),float(reg=='Off-Plan'),*event_vector]

def score(errors):
    if not errors: return {'evaluations':0,'meanAbsolutePercentageError':None,'meanSignedPercentageError':None}
    return {'evaluations':len(errors),'meanAbsolutePercentageError':sum(abs(x) for x in errors)/len(errors),'meanSignedPercentageError':sum(errors)/len(errors)}

def main():
    p=argparse.ArgumentParser();p.add_argument('--transactions',type=Path,required=True);p.add_argument('--events',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--strict-point-in-time',action='store_true');args=p.parse_args()
    if args.strict_point_in_time:
        raise ValueError('Point-in-time backtest rejected: this September2026 amended snapshot has no historic publication vintages. Retrospective research mode cannot satisfy contemporaneous-input acceptance.')
    raw=args.transactions.read_bytes();sha=hashlib.sha256(raw).hexdigest()
    if sha!=EXPECTED_SHA: raise ValueError('Unreviewed transaction snapshot; update provenance before evaluating.')
    data=json.loads(args.events.read_text());events=data.get('events',[]);sources=data.get('sources',[])
    sources={s['id']:s for s in sources} if isinstance(sources,list) else sources
    con=duckdb.connect();con.read_parquet(str(args.transactions)).create_view('source')
    rows, unique=con.execute('SELECT count(*),count(distinct transaction_id) FROM source').fetchone()
    if rows!=unique: raise ValueError('Duplicate transaction identifiers; stop before modelling.')
    # Publisher's full-calendar-year PSF flag is deliberately not consulted.
    con.execute("""CREATE TABLE base AS SELECT *,year(instance_date)*4+floor((month(instance_date)-1)/3)::INTEGER q FROM source
      WHERE instance_date >= DATE '1990-01-01' AND instance_date <= DATE '2026-09-14'
        AND price_aed > 10000 AND area_sqm BETWEEN 5 AND 100000 AND isfinite(price_psf) AND price_psf > 0
        AND property_type_label IN ('Unit','Villa') AND usage_label='Residential'""")
    forecasts=[];folds=[];all_errors=collections.defaultdict(list);max_complete_q=period_index(dt.date(2026,6,30))
    for origin in range(period_index(dt.date(2020,3,31)),max_complete_q-3):
        cutoff=quarter_end(origin);target_q=origin+4
        con.execute('DROP TABLE IF EXISTS bands')
        con.execute("""CREATE TABLE bands AS SELECT year(instance_date) y,property_type_label kind,reg_type_label reg,
          quantile_cont(price_psf,0.01) lo,quantile_cont(price_psf,0.99) hi FROM base WHERE instance_date<=?
          GROUP BY 1,2,3""",[cutoff])
        # Training bands use only registrations through this origin; targets use
        # the last training-year bands, frozen before target outcomes are seen.
        stats=con.execute("""SELECT b.area_id,b.area_name_en,b.property_type_label,b.reg_type_label,b.q,
          count(*) n,median(b.price_psf) price FROM base b JOIN bands t
          ON t.kind=b.property_type_label AND t.reg=b.reg_type_label
          AND t.y=CASE WHEN b.q<=? THEN year(b.instance_date) ELSE ? END
          WHERE b.q<=? AND b.price_psf BETWEEN t.lo AND t.hi GROUP BY 1,2,3,4,5""",[origin,cutoff.year,target_q]).fetchall()
        cohorts=collections.defaultdict(dict)
        for area_id,name,kind,reg,q,n,price in stats:
            if n>=20: cohorts[(area_id,name,kind,reg)][q]={'n':n,'price':price}
        vectors={q:event_features(events,sources,q) for q in range(period_index(dt.date(1990,1,1)),origin+1)}
        _,event_audit=event_features(events,sources,origin,with_audit=True)
        train=[];targets=[]
        for identity,series in cohorts.items():
            _,_,kind,reg=identity
            for q in sorted(series):
                if q+4>origin: continue
                x=features(series,q,kind,reg,vectors[q]); future=series.get(q+4)
                if x and future: train.append((x,math.log(future['price']/series[q]['price'])))
            x=features(series,origin,kind,reg,vectors[origin]);target=series.get(target_q)
            if x and target: targets.append((identity,series[origin],target,x))
        coefficients=ridge(train) if len(train)>=200 else None;errors=collections.defaultdict(list)
        for identity,baseline,target,x in targets:
            prediction={'carry_forward':baseline['price'],'damped_trend':baseline['price']*math.exp(max(-.1,min(.1,x[1]*.5)))}
            if coefficients: prediction['dated_event_ridge']=baseline['price']*math.exp(max(-.5,min(.5,sum(a*b for a,b in zip(x,coefficients)))))
            result={'areaId':identity[0],'area':identity[1],'segment':identity[2],'registration':identity[3],'origin':str(cutoff),'target':str(quarter_end(target_q)),'anchor':baseline['price'],'targetObserved':target['price'],'anchorCount':baseline['n'],'targetCount':target['n'],'features':dict(zip(FEATURE_NAMES,x)),'predictions':prediction}
            for model,value in prediction.items():
                error=(value/target['price']-1)*100;errors[model].append(error);all_errors[model].append(error)
            forecasts.append(result)
        folds.append({'cutoff':str(cutoff),'target':str(quarter_end(target_q)),'trainingLabels':len(train),'eligibleTargets':len(targets),'featureTrainingStatus':'fit' if coefficients else 'insufficient_training_labels','eventFeatureAudit':event_audit,'coefficients':dict(zip(FEATURE_NAMES,coefficients)) if coefficients else None,'metrics':{k:score(v) for k,v in errors.items()}})
    out={'version':'20261003-walk-forward-v1','classification':'retrospective_latest_vintage_research','horizonMonths':12,'validatedLongTermForecast':False,'pointInTimeReplay':False,'backtestAccepted':False,'releaseAcceptancePassed':False,'reason':'The September 2026 snapshot retains current amendments; historic publication vintages are unavailable. Errors assess latest-vintage research, not contemporaneous investment performance or 2080 accuracy.','source':{'url':'https://huggingface.co/datasets/dubairealestatedata/dubai-real-estate-sales-transactions/resolve/main/dld_sales_transactions.parquet','sha256':sha,'rows':rows,'uniqueTransactionIds':unique,'attribution':'Dubai Real Estate Data (dubairealestatedata.com), based on Dubai Land Department open data','licence':'CC BY 4.0, publisher declaration','latestRegistration':'2026-09-14'},'policy':{'nativeFrequency':'quarterly','minimumSample':20,'identity':'area_id + property_type_label + reg_type_label; no project-name candidates promoted','outliers':'P1/P99 by calendar year/type/registration, recomputed inside each training window. Publisher quality_flags bit 4 ignored. Target uses frozen last-training-year band.','trainingTargets':'A four-quarter-ahead label is admitted only when its quarter has ended by the fold cutoff.','features':'Dated macro regime indicators with source first-known availability by each origin. No infrastructure uplift coefficients.','model':'Pooled ridge regression on log returns, penalty10 fixed before evaluation, intercept unpenalised, predicted log return clipped [-0.5,0.5]. Contextual statistical research; no causal attribution.','propertyMixAdjusted':False,'costsIncluded':False,'licensedSnapshotUnchanged':True},'metrics':{k:score(v) for k,v in all_errors.items()},'folds':folds,'forecasts':forecasts,'scenarioApprovalChanged':False}
    args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(out,separators=(',',':'))+'\n')
    print(json.dumps({'folds':len(folds),'evaluations':len(forecasts),'metrics':out['metrics'],'output':str(args.output)}))

if __name__=='__main__': main()
