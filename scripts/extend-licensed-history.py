#!/usr/bin/env python3
"""One-time licensed pre-2019 aggregation; normal builds use the committed output."""
import argparse, collections, csv, gzip, hashlib, io, json, pathlib
import duckdb

ROOT=pathlib.Path(__file__).resolve().parents[1]
BASE=ROOT/'data/historical-intelligence'
EXPECTED_SHA='336984181fdb9318376ae25cb9e290dae70bb664235a85f530e2e719d93dd7de'
PUBLISHED='2026-09-19T05:40:30.462Z'
SOURCE_URL='https://huggingface.co/datasets/dubairealestatedata/dubai-real-estate-sales-transactions/resolve/main/dld_sales_transactions.parquet'
def sha(blob):return hashlib.sha256(blob).hexdigest()
def encoded(value):return json.dumps(value,ensure_ascii=False,separators=(',',':'),sort_keys=True).encode()

if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--transactions',type=pathlib.Path,required=True);args=parser.parse_args()
 raw=args.transactions.read_bytes()
 if sha(raw)!=EXPECTED_SHA:raise ValueError('Unreviewed parquet: checksum mismatch')
 con=duckdb.connect();con.read_parquet(str(args.transactions)).create_view('raw_source')
 count,unique=con.execute('SELECT count(*),count(distinct transaction_id) FROM raw_source').fetchone()
 if count!=1364226 or count!=unique:raise ValueError('Unexpected row count or duplicate transaction identifiers')
 history=json.loads((BASE/'inputs/manifest.json').read_text())['history']
 original=list(csv.DictReader(io.StringIO(gzip.decompress((ROOT/history['path']).read_bytes()).decode())))
 columns=list(original[0]);cohorts=collections.defaultdict(set)
 for row in original:
  if row['Source ID']=='dred-sale-snapshot-20260919' and row['Source area ID']:
   cohorts[(int(row['Source area ID']),row['Geography'],row['Segment'],row['Registration'],row['Frequency'])].add(row['Series ID'])
 con.execute("""CREATE TABLE eligible AS SELECT * FROM raw_source
  WHERE instance_date < DATE '2019-01-01' AND quality_flags=0
  AND price_aed>10000 AND area_sqm BETWEEN 5 AND 100000
  AND isfinite(price_psf) AND price_psf>0
  AND property_type_label IN ('Unit','Villa') AND usage_label='Residential'
  AND reg_type_label IN ('Ready','Off-Plan') AND area_id IS NOT NULL AND area_name_en IS NOT NULL""")
 first,last,eligible=con.execute('SELECT min(instance_date),max(instance_date),count(*) FROM eligible').fetchone()
 output=[];links={};sparse=0;eligible_points=0;first_display={}
 for frequency,date_sql in [('monthly',"strftime(instance_date,'%Y-%m')"),('quarterly',"cast(year(instance_date) AS VARCHAR)||'Q'||cast(quarter(instance_date) AS VARCHAR)")]:
  points=con.execute(f"""SELECT area_id,area_name_en,property_type_label,reg_type_label,{date_sql} period,
   count(*) n,median(price_psf),quantile_cont(price_psf,0.25),quantile_cont(price_psf,0.75),sum(price_aed),
   min(instance_date),max(instance_date) FROM eligible GROUP BY 1,2,3,4,5 ORDER BY 1,2,3,4,5""").fetchall()
  for area_id,name,kind,registration,period,n,median,p25,p75,total,min_date,max_date in points:
   segment='apartment' if kind=='Unit' else 'villa';identity=[area_id,name,segment,registration,frequency]
   ident='early-dred-'+sha(encoded([EXPECTED_SHA,identity,'before-2019-flags-zero-v1']))[:24]
   matching=sorted(cohorts.get(tuple(identity),set()))
   links[ident]={'sourceAreaId':area_id,'sourceAreaName':name,'segment':segment,'registration':registration,'frequency':frequency,'existingSeriesIds':matching,'basis':'Exact source area ID/name, native type, registration and frequency; Residential scope explicitly retained','identityVerified':False,'scope':'area_context'}
   display=n>=20;eligible_points+=display;sparse+=not display
   if display:first_display[frequency]=min(first_display.get(frequency,period),period)
   native={'period':period,'sampleCount':n,'medianAEDSqft':median,'p25':p25,'p75':p75,'eligibleValueAED':total,'firstObservationDate':str(min_date),'lastObservationDate':str(max_date),'qualityFlagsRequired':0,'displayEligible':display,'displayStatus':'eligible_aggregate_context' if display else 'withheld_sparse_aggregate','propertyType':kind,'usage':'Residential','observationKind':'aggregate'}
   row={key:'' for key in columns}
   row.update({'Series ID':ident,'Emirate':'Dubai','Geography':name,'Scope':'source_area','Segment':segment,'Registration':registration,'Period':period,'Frequency':frequency,'Metric':'median_sale_aed_sqft','Value':median,'Unit':'AED/sqft','Sample rows':n,'P25':p25,'P75':p75,'Eligible value AED':total,'Quality':'sample >=20 and positive median' if display else 'withheld median: sparse/invalid','Class':'independent DLD-derived pre-2019 area snapshot','Source ID':'dred-sale-snapshot-20260919','Source URL':SOURCE_URL,'Raw source emirate':'Dubai','Published date':PUBLISHED,'Observation basis':'Historical descriptive area aggregate; latest-vintage publisher flags, not point-in-time forecast training','Source area ID':area_id,'Native row JSON':encoded(native).decode()})
   output.append(row)
 out=io.StringIO();writer=csv.DictWriter(out,fieldnames=columns);writer.writeheader();writer.writerows(output);csv_bytes=out.getvalue().encode();blob=gzip.compress(csv_bytes,mtime=0)
 path=BASE/'inputs'/('early-history-'+sha(csv_bytes)+'.csv.gz');path.write_bytes(blob)
 parquet=BASE/'objects'/(EXPECTED_SHA+'.parquet');parquet.parent.mkdir(parents=True,exist_ok=True)
 if parquet.exists() and parquet.read_bytes()!=raw:raise ValueError('Immutable parquet collision')
 if not parquet.exists():parquet.write_bytes(raw)
 flags=[{'qualityFlags':flag,'rows':n,'firstDate':str(start),'lastDate':str(end)} for flag,n,start,end in con.execute('SELECT quality_flags,count(*),min(instance_date),max(instance_date) FROM raw_source GROUP BY 1 ORDER BY 1').fetchall()]
 manifest={'version':'pre-2019-flags-zero-v1','classification':'licensed_independent_derived_area_context','input':{'path':str(path.relative_to(ROOT)),'sha256':sha(csv_bytes),'compressedSha256':sha(blob),'bytes':len(csv_bytes),'compressedBytes':len(blob)},'source':{'url':SOURCE_URL,'sha256':EXPECTED_SHA,'bytes':len(raw),'rows':count,'publishedAt':PUBLISHED,'firstAvailableAt':PUBLISHED,'licence':'CC BY 4.0; publisher declaration verified','qualityFlagDistribution':flags},'rawArchive':{'key':'research/published/2026-10-03/historical-intelligence/objects/'+parquet.name,'path':str(parquet.relative_to(ROOT)),'sha256':EXPECTED_SHA,'bytes':len(raw),'kind':'licensed_raw_transaction_parquet','compression':None,'contentType':'application/vnd.apache.parquet'},'methodology':{'dateFilter':'instance_date < 2019-01-01','staticFilters':'price_aed>10000; area_sqm between 5 and 100000; finite positive price_psf','propertyTypes':['Unit','Villa'],'usage':'Residential','registration':['Ready','Off-Plan'],'publisherQualityFlagsRequired':0,'minimumDisplaySample':20,'sparseRowsRetained':True,'pointInTimeReplay':False,'forecastTrainingAllowed':False,'warning':'Publisher full-calendar-year outlier flags are valid only for retrospective descriptive history; they must not be used as historical forecast-training information.'},'counts':{'supplementRows':len(output),'series':len(links),'eligibleTransactionRows':eligible,'sparseNativePoints':sparse,'displayEligibleNativePoints':eligible_points,'linkedSeries':sum(bool(x['existingSeriesIds']) for x in links.values())},'coverage':{'firstEligibleTransaction':str(first),'lastEligibleTransaction':str(last),'firstDisplayEligiblePeriodByFrequency':first_display},'seriesLinks':links}
 (BASE/'early-history-manifest.json').write_bytes(encoded(manifest)+b'\n')
 print(json.dumps({'counts':manifest['counts'],'coverage':manifest['coverage'],'parquetBytes':len(raw)}))
