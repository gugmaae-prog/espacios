/* Sourced history, event context and explicit user scenarios. 20261005-history-enrichment-v4 */
(() => {
  'use strict';
  const Q = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key = value => String(value ?? '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  const list = value => Array.isArray(value) ? value : [];
  const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const fmt = value => number(value) === null ? 'Unavailable' : value.toLocaleString('en', {maximumFractionDigits:2});
  function safeURL(value) {
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
  }
  function periodTime(period) {
    const p = String(period ?? '');
    let m = /^(\d{4})-?Q([1-4])$/i.exec(p);
    if (m) return Date.UTC(+m[1], +m[2] * 3, 0);
    m = /^(\d{4})-?H([12])$/i.exec(p);
    if (m) return Date.UTC(+m[1], +m[2] * 6, 0);
    if (/^\d{4}-?FY$/i.test(p)) return Date.UTC(+p.slice(0,4),11,31);
    m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(p);
    if (!m || +m[2] > 12 || +m[2] === 0 || +m[3] > 31 || +m[3] === 0) return null;
    const result=m[3] ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : m[2] ? Date.UTC(+m[1], +m[2], 0) : Date.UTC(+m[1], 11, 31);
    if(m[3]&&new Date(result).getUTCMonth()!==+m[2]-1)return null;
    return result;
  }
  function pointValue(point) {
    // Values stay in their original series. No averaging or borrowing across cohorts.
    for (const field of ['value', 'median', 'medianAEDPerSqft', 'priceAEDPerSqft', 'annualRentAED', 'count']) if (number(point?.[field]) !== null) return point[field];
    return null;
  }
  function pointPeriod(point) { return point?.period ?? point?.date ?? point?.year ?? ''; }
  function seriesRows(data, metric) {
    const history = data?.historySeries;
    let rows = Array.isArray(history) ? history : Array.isArray(history?.series) ? history.series : history?.[metric];
    if (rows && !Array.isArray(rows)) rows = [rows];
    const metricOf = value => ['price','rent','volume'].includes(value) ? value : /sale.*count|transaction.*count|volume/.test(value??'') ? 'volume' : /rent/.test(value??'')&&!/yield/.test(value??'') ? 'rent' : /price|median_sale|sale_statistics|ask.*psf/.test(value??'') ? 'price' : null;
    return list(rows).filter(row => metricOf(row.metric) === metric || (metric==='volume'&&metricOf(row.metric)==='price')).flatMap((row, i) => {
      const derived=metric==='volume'&&metricOf(row.metric)==='price';
      const normalized=list(row.points).map(point=>Array.isArray(point)?Object.fromEntries((row.columns??['period','sampleCount','value','p25','p75']).map((column,index)=>[column,point[index]??null])):point);
      let points;
      if(derived){
        // A source price basket reports its own eligible sales count, not total market volume.
        const validated=list(data.validatedObservations).filter(point=>point.seriesId===row.id&&point.metric==='volume');
        points=Array.isArray(data.validatedObservations)?validated:normalized.map(point=>({...point,value:Number.isInteger(point.sampleCount)&&point.sampleCount>=0?point.sampleCount:null,displayEligible:false}));
      }else points=normalized.map(point=>{
        if(!Array.isArray(data.validatedObservations))return {...point,displayEligible:point.displayEligible===true};
        const validated=data.validatedObservations.find(value=>value.seriesId===row.id&&value.period===point.period&&value.metric===metric);
        return validated?{...point,...validated}:{...point,displayEligible:false};
      });
      const mixed=['native_mixed','mixed'].includes(row.frequency),frequencies=mixed?[...new Set(points.map(point=>point.frequency).filter(Boolean))]:[row.frequency];
      if(!frequencies.length)frequencies.push(row.frequency);
      return frequencies.map(frequency=>({...row,metric,frequency,uiId:String(row.id??row.seriesId??i)+(derived?':eligible-count':'')+(mixed?':'+frequency:''),label:(derived?'Eligible sales in price cohort · ':'')+(row.label??row.name??[row.segment,row.registration,row.scope].filter(Boolean).join(' · '))+(mixed?' · '+frequency:''),unit:derived?'eligible sales count':row.unit,points:mixed?points.filter(point=>point.frequency===frequency):points}));
    });
  }
  function exactRecord(selection, records) {
    if (!selection) return null;
    const id = selection.id ?? selection.recordId;
    const direct = records.find(row => row.id === id);
    if (direct) return direct;
    const kind = selection.kind ?? selection.type;
    if (!['project', 'community'].includes(kind) || !selection.emirate || !selection.name) return null;
    const matches = records.filter(row => row.type === kind && key(row.name) === key(selection.name) && key(row.emirate) === key(selection.emirate));
    return matches.length === 1 ? matches[0] : null;
  }
  function scenarioPoint(data, metric, path, year) {
    return list(data?.scenarios?.metrics?.[metric]?.paths?.[path]).find(point => +point.year === +year) ?? {year:+year, value:null, status:'unavailable', reason:'No scenario point supplied for this year.'};
  }
  function lineSegments(points, x, y, frequency) {
    const segments = []; let current = [], previous=null;
    const ordinal=time=>{const date=new Date(time),year=date.getUTCFullYear(),month=date.getUTCMonth();return frequency==='quarterly'?year*4+Math.floor(month/3):frequency==='half_year'?year*2+Math.floor(month/6):['annual','yearly'].includes(frequency)?year:frequency==='monthly'?year*12+month:null;};
    for (const point of points) {
      const t = periodTime(pointPeriod(point)), v = pointValue(point);
      if (t === null || v === null || point.status === 'unavailable' || point.displayEligible === false) { if (current.length) segments.push(current); current = [];previous=null; continue; }
      const index=ordinal(t);if(index!==null&&previous!==null&&index!==previous+1){if(current.length)segments.push(current);current=[];}previous=index;
      current.push([x(t), y(v)]);
    }
    if (current.length) segments.push(current);
    return segments;
  }
  function clusterEventMarkers(rows,start,end,width) {
    const groups=[];
    for(const row of rows.slice().sort((a,b)=>a.time-b.time)){
      const position=(row.time-start)/(end-start||1)*Math.max(1,width),last=groups.at(-1);
      if(last&&position-last.position<48){last.rows.push({...row,position});last.position=last.rows.reduce((sum,item)=>sum+item.position,0)/last.rows.length;}
      else groups.push({position,rows:[{...row,position}]});
    }
    return groups;
  }
  function mapScopeWarning(record,records,mapArea) {
    const subjectArea=record?.type==='community'||record?.kind==='community'?record.name:records.find(row=>row.id===record?.communityId)?.name??record?.area??record?.community??record?.masterCommunity;
    if(!mapArea)return 'The map has no selected price area. Events here describe the selected record; no event-to-price association is implied.';
    if(!subjectArea)return 'Map values use '+mapArea+'. The event record’s price-area match is unverified; do not infer an association with those values.';
    if(key(mapArea)!==key(subjectArea))return 'Map values use '+mapArea+'; event context uses '+subjectArea+'. These events are not matched to that map price series.';
    return 'Event context and map area share the label '+subjectArea+'. A shared label does not establish a causal price effect; the sourced study checks its own record and cohort.';
  }
  async function loadCompleteSeriesPages(history,seriesId,fetchPage) {
    const descriptor=list(history.historySeries).find(series=>series.id===seriesId);
    if(!descriptor)throw Error('The selected cohort has no exact stored series identity.');
    const points=[],validated=[],sources=new Map(sourceList(history).map(source=>[source.id,source]));
    let cursor=0,complete;
    do {
      const page=await fetchPage(cursor);
      if(page.record?.id!==history.record?.id||page.version!==history.version||page.asOf!==history.asOf)throw Error('A history page belongs to another record or research snapshot.');
      const series=list(page.historySeries).find(row=>row.id===seriesId);
      if(!series||!series.partitionLoaded)throw Error('The selected native financial cohort could not be retrieved.');
      for(const field of ['sourceId','scope','identityVerified','subjectRecordId','unit','metric','frequency','segment','registration','geography','pointCount'])if(JSON.stringify(series[field]??null)!==JSON.stringify(descriptor[field]??null))throw Error('The selected history page changed its approved cohort identity.');
      if(JSON.stringify(list(series.identitySourceIds).slice().sort())!==JSON.stringify(list(descriptor.identitySourceIds).slice().sort()))throw Error('The selected history page changed its identity evidence.');
      if((series.nativePointOffset??0)!==cursor)throw Error('The selected history page did not retain its native point position.');
      points.push(...list(series.points));validated.push(...list(page.validatedObservations).filter(row=>row.seriesId===seriesId));
      for(const source of sourceList(page))sources.set(source.id,source);
      complete=series;
      const next=page.historyPagination?.nextPointCursor??null;
      if(next===null)break;
      if(!Number.isInteger(next)||next<=cursor||next!==points.length||next>=descriptor.pointCount)throw Error('The selected history page cursor is incomplete or inconsistent.');
      cursor=next;
    }while(points.length<descriptor.pointCount);
    if(points.length!==descriptor.pointCount)throw Error('The selected financial timeline remains incomplete; no points were filled in.');
    return{series:{...complete,points,pointsPartial:false,nativePointOffset:0,loadedPointCount:points.length,availability:'verified_immutable_partition',partitionLoaded:true},validatedObservations:validated,sources:[...sources.values()]};
  }
  function mergeLoadedSeries(history,loaded) {
    const rows=list(history.historySeries).map(series=>series.id===loaded.series.id?loaded.series:series);
    const historyPagination=history.historyPagination?{...history.historyPagination,loadedSeries:rows.filter(series=>list(series.points).length>0).length,loadedPoints:rows.reduce((sum,series)=>sum+list(series.points).length,0),complete:rows.every(series=>!series.partition||series.partitionLoaded&&!series.pointsPartial&&list(series.points).length===series.pointCount)}:null;
    return{...history,historySeries:rows,record:{...history.record,historySeries:rows},validatedObservations:[...list(history.validatedObservations).filter(row=>row.seriesId!==loaded.series.id),...loaded.validatedObservations],sources:loaded.sources,...(historyPagination?{historyPagination}:{})};
  }
  function historyRetrievalHTML(data,selected) {
    const page=data?.historyPagination;
    if(!page)return '';
    const native=list(data.historySeries).find(series=>series.id===selected?.id)??selected;
    return '<p class="hi-note" id="hi-retrieval-note">Retrieved '+esc(fmt(page.loadedPoints))+' of '+esc(fmt(page.totalPoints))+' stored native points across '+esc(fmt(page.loadedSeries))+' of '+esc(fmt(page.totalSeries))+' cohorts. '+(page.complete?'All stored cohorts are loaded for this record. ':'Other stored cohorts remain available when selected. ')+(native?'Selected source cohort: '+esc(fmt(list(native.points).length))+' of '+esc(fmt(native.pointCount??list(native.points).length))+' native points loaded. ':'')+'Retrieval completeness and complete lifetime financial coverage are separate. Monthly accountability below describes the retrieved record page.</p>';
  }
  window.EspaciosHistoricalUIHelpers = Object.freeze({safeURL,periodTime,pointValue,seriesRows,exactRecord,scenarioPoint,lineSegments,buildAnnualInputs,clusterEventMarkers,mapScopeWarning,lifecycleLabels,lifecycleHTML,itemCoverageHTML,loadCompleteSeriesPages,mergeLoadedSeries,historyRetrievalHTML});
  const H = {installed:false, records:[], indexPromise:null, recordId:null, pendingSelection:null, history:null, events:[], tab:'history', metric:'price', seriesId:null, selectedEvent:null, study:null, loading:false, seriesLoading:false, seriesError:'', seriesSequence:0, seriesController:null, error:'', sequence:0, studySequence:0, controller:null, scenarioMetric:'price', year:2080, assumptions:null, scenarioResult:null, scenarioPending:false, scenarioError:'', lastSelection:'', overlay:false, overlayKey:'', areaKey:'', annualForm:{}, scenarioDisplay:'nominal', pickerPinnedOpen:false};
  const metricLabel = metric => ({price:'Price',rent:'Rent',volume:'Transaction volume',netROI:'Net return'}[metric] ?? metric);
  const stageLabel = status => String(status ?? 'Status not supplied').replace(/_/g, ' ');
  function sourceList(data=H.history) { return list(data?.sources); }
  function sourceLinks(ids, data=H.history) {
    const sources = sourceList(data);
    return list(ids).map(id => {
      const source=typeof id==='object'?id:sources.find(source=>source.id===id);
      if(!source)return '<div class="hi-source"><span>Unresolved retained source reference: '+esc(id)+'</span><small>No source URL is verified for this reference.</small></div>';
      const url = safeURL(source.url), label = source.publisher ?? source.title ?? source.id ?? 'Source';
      const published = source.publishedAt ?? source.published ?? '', available = source.firstAvailableAt ?? '';
      return '<div class="hi-source">' + (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + '</a>' : esc(label)) + (published ? '<small>Published ' + esc(published) + (source.datePrecision?' · '+esc(source.datePrecision)+' precision':'') + '</small>' : '<small>Publication date not supplied</small>') + (available ? '<small>First available ' + esc(available) + '</small>' : '') + '</div>';
    }).join('') || '<span class="hi-note">No source reference supplied.</span>';
  }
  async function getJSON(url, signal) {
    const response = await fetch(url, {signal});
    if (!response.ok) {
      let message = ''; try { const body = await response.json(); message = body.error?.message ?? body.error ?? ''; } catch {}
      throw Error(typeof message === 'string' && message ? message : 'Research request unavailable (' + response.status + ').');
    }
    return response.json();
  }
  async function loadIndex() {
    if (H.records.length) return H.records;
    if (H.indexPromise) return H.indexPromise;
    H.indexPromise = getJSON('/map/api/record-history', AbortSignal.timeout(15000)).then(data => {
      if (!Array.isArray(data.records)) throw Error('The record index is unavailable.');
      H.records = data.records; return H.records;
    }).finally(() => { H.indexPromise = null; });
    return H.indexPromise;
  }
  function currentSelection() {
    try {
      if (typeof state !== 'undefined' && state.selected && ['project','community'].includes(state.selected.kind)) return state.selected;
      if (typeof state !== 'undefined' && state.selectedSpatial?.type === 'community') return {...state.selectedSpatial, kind:'community', emirate:state.selectedSpatial.emirate};
    } catch {}
    return null;
  }
  function areaSelection() {
    try { if (typeof msState !== 'undefined' && msState.area && msState.emirate) return {kind:'community',name:msState.area,emirate:msState.emirate}; } catch {}
    return null;
  }
  function mobileLayout() {
    return window.matchMedia?.('(max-width:760px), (max-width:1024px) and (max-height:560px) and (pointer:coarse)').matches??false;
  }
  function panelGeometry() {
    const panel=Q('#hi-panel');if(!panel)return;
    if(!mobileLayout()){
      const previous=panel.dataset.hiLayout,picker=Q('#hi-record-picker');panel.dataset.hiLayout='desktop';
      if(previous!=='desktop'){picker.open=true;H.pickerPinnedOpen=false;panel.dataset.hiPicker='full';}
      const dock=Q('#tl-dock')?.getBoundingClientRect();panel.style.setProperty('--hi-desktop-bottom',Math.max(166,dock?window.innerHeight-dock.top+10:166)+'px');Q('#hi-mobile-hint').hidden=true;
      if(!panel.classList.contains('hidden')&&picker.open&&!H.pickerPinnedOpen){
        const frame=panel.getBoundingClientRect(),body=Q('#hi-body').getBoundingClientRect();
        if(frame.bottom-16-body.top<120){panel.dataset.hiPicker='compact';picker.open=false;}
      }
      return;
    }
    const search=Q('.topbar .search-wrap')?.getBoundingClientRect(),header=Q('header.topbar')?.getBoundingClientRect(),dock=Q('#tl-dock')?.getBoundingClientRect();
    const top=Math.max(search?.bottom??0,header?.bottom??0,88)+10,dockTop=dock?.top??window.innerHeight-210;
    let layout=dockTop-top-10<(Q('#hi-record-picker').open?500:330)?'expanded':'compact';
    panel.dataset.hiLayout=layout;panel.style.setProperty('--hi-mobile-top',top+'px');panel.style.setProperty('--hi-mobile-bottom',Math.max(10,window.innerHeight-dockTop+10)+'px');
    // Check the clipped intersection, not an overflowing child's nominal height.
    if(layout==='compact'&&!panel.classList.contains('hidden')){
      const frame=panel.getBoundingClientRect(),body=Q('#hi-body').getBoundingClientRect();
      const visible=Math.max(0,Math.min(body.bottom,frame.bottom-12)-Math.max(body.top,frame.top+12));
      if(visible<120){layout='expanded';panel.dataset.hiLayout=layout;}
    }
    Q('#hi-mobile-hint').hidden=layout!=='expanded';
  }
  function installGeometryObservers() {
    let pending=0;
    const settle=()=>{
      panelGeometry();
      if(pending)return;
      pending=requestAnimationFrame(()=>{pending=0;panelGeometry();});
    };
    if(typeof ResizeObserver!=='undefined'){
      const observer=new ResizeObserver(settle);
      for(const element of [Q('#tl-dock'),Q('.topbar .search-wrap'),Q('header.topbar')])if(element)observer.observe(element);
    }
    if(typeof MutationObserver!=='undefined'){
      const observer=new MutationObserver(settle);
      observer.observe(document.documentElement,{attributes:true,attributeFilter:['style','class']});
      if(Q('#tl-dock'))observer.observe(Q('#tl-dock'),{attributes:true,attributeFilter:['style','class']});
    }
    window.addEventListener('resize',settle,{passive:true});window.addEventListener('orientationchange',settle,{passive:true});
    settle();
  }
  function chooser() {
    const term = key(Q('#hi-record-search')?.value);
    const rows = H.records.filter(row => !term || key(row.name + ' ' + row.emirate + ' ' + row.type + ' ' + row.id).includes(term));
    const select = Q('#hi-record-select');
    if (!select) return;
    select.innerHTML = '<option value="">Choose a project or community</option>' + rows.map(row => '<option value="' + esc(row.id) + '">' + esc(row.name) + ' · ' + esc(row.emirate) + ' · ' + esc(row.type) + '</option>').join('');
    select.value = rows.some(row => row.id === H.recordId) ? H.recordId : '';
    Q('#hi-record-count').textContent = rows.length.toLocaleString() + ' of ' + H.records.length.toLocaleString() + ' records · includes records without a map location';
  }
  function dateText(date) {
    if (!date) return 'Date unknown';
    if (typeof date === 'string') {const precision=/^\d{4}-\d{2}-\d{2}$/.test(date)?'day':/^\d{4}-\d{2}$/.test(date)?'month':/^\d{4}-?Q[1-4]$/.test(date)?'quarter':/^\d{4}-?H[12]$/.test(date)?'half-year':/^\d{4}(?:-?FY)?$/.test(date)?'year':null;return date+(precision?' · '+precision+' precision':' · precision not supplied');}
    return (date.start ?? date.date ?? 'Date unknown') + (date.end && date.end !== date.start ? ' – ' + date.end : '') + (date.precision ? ' · ' + date.precision + ' precision' : '');
  }
  function lifecycleRows(data) {
    const value = data?.lifecycle ?? data?.record?.lifecycle;
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.milestones)) return value.milestones;
    if (value && typeof value === 'object') return Object.entries(value).filter(([,v]) => v && typeof v === 'object' && (v.date || v.eventDate || v.start)).map(([name,v]) => ({name,...v}));
    return [];
  }
  function lifecycleHTML(data) {
    const rows = lifecycleRows(data);
    return '<details class="hi-section"><summary>Project / community lifecycle · ' + rows.length + ' dated milestones</summary>' + (rows.length ? rows.map(row => '<article class="hi-card"><strong>' + esc(row.title ?? row.label ?? row.name ?? row.kind ?? row.type ?? 'Milestone') + '</strong><p>' + esc(dateText(row.eventDate ?? row.date ?? row)) + '</p>' + lifecycleLabels(row).map(label=>'<span class="hi-tag">'+esc(label)+'</span>').join(' ') + (row.note ?? row.reason ? '<p>' + esc(row.note ?? row.reason) + '</p>' : '') + sourceLinks(row.sourceIds ?? (row.sourceId ? [row.sourceId] : []),data) + '</article>').join('') : '<p class="hi-note">No sourced lifecycle dates are supplied for this record. A project name or estimated delivery year alone does not establish its first market value.</p>') + '</details>';
  }
  function lifecycleLabels(row) {
    const kind=row.kind??row.type??'unspecified milestone';
    const eventStatus=row.eventStatus??(kind==='target_handover'||row.status==='planned'?'planned':'not established');
    const verification=row.status==='verified'?'Verified source':row.status==='reported'?'Reported source':'Evidence: '+stageLabel(row.status??row.classification);
    return ['Milestone: '+stageLabel(kind),'Stage: '+stageLabel(eventStatus),'Scope: '+stageLabel(row.scope??'unspecified'),verification];
  }
  function coverageHTML(data) {
    const coverage = data.coverage ?? {}, window = coverage.window ?? {};
    return '<section class="hi-section" aria-label="Financial evidence coverage"><h3>Financial coverage · monthly accountability</h3><p class="hi-note">' + esc(window.start ?? 'Unknown start') + ' – ' + esc(window.end ?? data.asOf ?? 'Unknown end') + ' · ' + esc(window.basis ?? 'Coverage window not supplied') + '</p><p class="hi-note">Counts below are calendar months. Quarterly, half-year and annual observations are retained at their native frequency below; they do not become monthly observations. Direct observations, shared area context and news are separate evidence classes.</p><div class="hi-coverage">' + ['price','rent','volume'].map(metric => {
      const row = coverage.metrics?.[metric] ?? {}, counts = row.statusCounts ?? {};
      return '<article><strong>' + esc(metricLabel(metric)) + '</strong><dl>' + [['observed','Observed'],['sparse','Sparse'],['context_only','Area context'],['missing','Missing'],['unknown','Unknown'],['conflict','Conflict'],['inaccessible','Inaccessible'],['not_applicable','Not applicable']].map(([status,label]) => '<div><dt>' + label + '</dt><dd>' + esc(counts[status] ?? list(row.periods).filter(p => p.status === status).length) + '</dd></div>').join('') + '</dl></article>';
    }).join('') + '</div><details><summary>Native frequency observations · ' + esc(metricLabel(H.metric)) + '</summary><div class="hi-period-table"><table><caption>Native periods retained without monthly resampling</caption><thead><tr><th>Period</th><th>Frequency</th><th>Evidence</th></tr></thead><tbody>' + Object.entries(coverage.metrics?.[H.metric]?.nativePeriods ?? {}).flatMap(([frequency,rows])=>list(rows).map(row=>'<tr><th scope="row">'+esc(row.period)+'</th><td>'+esc(stageLabel(frequency))+'</td><td>'+esc(stageLabel(row.status))+'<small>'+esc(row.rawCount??0)+' raw points</small></td></tr>')).join('') + '</tbody></table></div></details><p class="hi-note">Scope: ' + esc(coverage.scope ?? 'Not supplied') + '</p><details><summary>Review all ' + esc(metricLabel(H.metric).toLowerCase()) + ' months and gaps</summary><div class="hi-period-table"><table><caption>Monthly financial accountability · original availability status</caption><thead><tr><th>Month</th><th>Evidence</th><th>Reason</th></tr></thead><tbody>' + list(coverage.metrics?.[H.metric]?.periods).map(row => '<tr><th scope="row">' + esc(row.period) + '</th><td>' + esc(stageLabel(row.status)) + '<small>' + esc(row.eligibleCount ?? 0) + ' eligible / ' + esc(row.rawCount ?? 0) + ' raw</small></td><td>' + esc(row.reason ?? 'No reason supplied') + '</td></tr>').join('') + '</tbody></table></div></details></section>';
  }
  function eventList() { return H.events.length ? H.events : list(H.history?.events); }
  function eventById(id) { return eventList().find(event => String(event.id) === String(id)); }
  function eventDate(event) { return event.eventDate ?? event.date ?? {start:event.effectiveFrom ?? event.announcedAt}; }
  function exposureRows(event) { return list(H.history?.exposures).filter(row => row.eventId === event.id && (!row.recordId || row.recordId === H.recordId)); }
  function historyChart(series, events) {
    const points = list(series?.points).slice().sort((a,b) => (periodTime(pointPeriod(a)) ?? Infinity) - (periodTime(pointPeriod(b)) ?? Infinity));
    const eligible = points.filter(p => pointValue(p) !== null && periodTime(pointPeriod(p)) !== null && p.displayEligible !== false && p.status !== 'unavailable');
    const dates = [...points.map(p => periodTime(pointPeriod(p))),...events.map(e => periodTime(typeof eventDate(e) === 'string' ? eventDate(e) : eventDate(e).start))].filter(v => v !== null);
    if (!dates.length) return '<div class="hi-empty">No dated financial observations or relevant events supplied.</div>';
    const minT = Math.min(...dates), maxT = Math.max(...dates), w = 360, h = 170, left = 45, right = 345, top = 14, bottom = 130;
    const values = eligible.map(pointValue), minV = values.length ? Math.min(...values) : 0, maxV = values.length ? Math.max(...values) : 1;
    const x = t => left + (t - minT) / (maxT - minT || 1) * (right-left), y = v => bottom - (v-minV)/(maxV-minV || 1)*(bottom-top);
    const lines = lineSegments(points,x,y,series?.frequency).map(segment => '<polyline points="' + segment.map(p => p.map(v => v.toFixed(2)).join(',')).join(' ') + '" class="hi-chart-line"/>').join('');
    const dots = eligible.map(p => '<circle cx="' + x(periodTime(pointPeriod(p))).toFixed(2) + '" cy="' + y(pointValue(p)).toFixed(2) + '" r="3" class="hi-chart-point"><title>' + esc(pointPeriod(p)) + ': ' + esc(fmt(pointValue(p))) + ' ' + esc(series?.unit ?? '') + '</title></circle>').join('');
    const markers = events.map((event,i) => {
      const time = periodTime(typeof eventDate(event) === 'string' ? eventDate(event) : eventDate(event).start);
      if (time === null) return '';
      const px = x(time).toFixed(2);
      return '<g role="button" tabindex="0" data-hi-event="' + esc(event.id) + '" aria-label="Event ' + (i+1) + ': ' + esc(event.title ?? event.name) + ', ' + esc(dateText(eventDate(event))) + '" class="hi-event-marker' + (H.selectedEvent === event.id ? ' hi-selected' : '') + '"><line x1="' + px + '" x2="' + px + '" y1="' + top + '" y2="' + bottom + '"/><circle cx="' + px + '" cy="' + (bottom+14) + '" r="9"/><text x="' + px + '" y="' + (bottom+17) + '" text-anchor="middle">' + (i+1) + '</text></g>';
    }).join('');
    return '<figure class="hi-chart"><figcaption>' + (eligible.length ? eligible.length + ' eligible native points · ' + esc(series?.unit ?? 'unit not supplied') + ' · '+esc(stageLabel(series?.scope??'scope not supplied')) : 'Events only · eligible financial observations unavailable') + '</figcaption><svg viewBox="0 0 ' + w + ' ' + h + '" role="group" aria-label="' + esc(metricLabel(H.metric)) + ' history and event dates"><line x1="' + left + '" y1="' + bottom + '" x2="' + right + '" y2="' + bottom + '" class="hi-axis"/>' + (eligible.length ? '<text x="3" y="20">' + esc(fmt(maxV)) + '</text><text x="3" y="130">' + esc(fmt(minV)) + '</text>' : '') + lines + dots + markers + '<text x="' + left + '" y="166">' + new Date(minT).getUTCFullYear() + '</text><text x="' + right + '" y="166" text-anchor="end">' + new Date(maxT).getUTCFullYear() + '</text></svg><p class="hi-note">Native period values only; gaps remain gaps. Month / quarter / year points are placed at period end. Event dates with coarse precision mark a period, not an exact day. Numbered markers open sourced context.</p></figure>';
  }
  function metricControls() { return '<div class="hi-segment" role="group" aria-label="Financial metric">' + ['price','rent','volume'].map(metric => '<button type="button" data-hi-metric="' + metric + '" aria-pressed="' + (H.metric === metric) + '">' + metricLabel(metric) + '</button>').join('') + '</div>'; }
  function itemCoverageHTML(data) {
    const record=data?.record??data,items=Object.entries(record.researchStatus?.itemCoverage??{});
    if(!items.length)return '';
    return '<details class="hi-section" id="hi-item-coverage"><summary>Evidence and remaining gaps · '+items.length+' items</summary><p class="hi-note">An item marked present has supporting evidence. Complete lifetime price and rent histories require every applicable period to be verified.</p>'+items.map(([name,item])=>'<article class="hi-card"><strong>'+esc(stageLabel(name))+'</strong><p>'+esc(stageLabel(item.status))+'</p><p class="hi-note">'+esc(item.reason)+(item.nativePointCount!=null?' · '+esc(item.nativePointCount)+' retained native points':'')+'</p>'+sourceLinks(item.sourceIds,data)+'</article>').join('')+'</details>';
  }
  function presentEvidenceHTML(data) {
    const record=data?.record??data,observations=list(data?.observations??record.observations),registers=list(record.registerEvidence),research=record.researchStatus?.sourceCollection;
    if(!observations.length&&!registers.length&&!research)return '';
    const financial=observations.map(row=>'<article class="hi-card"><strong>'+esc(fmt(row.value))+' '+esc(row.unit)+'</strong><p>'+esc(stageLabel(row.evidenceClass??row.scope))+' · '+esc(row.period)+'</p><p class="hi-note">'+esc(row.observationDateBasis??'Source-native observation date')+(row.observationKind==='asking_quote'?' · Advertised price; a completed sale is not established.':'')+'</p>'+sourceLinks(row.sourceIds??[row.sourceId],data)+'</article>').join('');
    const valueHTML=value=>value==null?'Unavailable':Array.isArray(value)?value.map(valueHTML).join('<br>'):typeof value==='object'?'<dl>'+Object.entries(value).map(([k,v])=>'<div><dt>'+esc(stageLabel(k))+'</dt><dd>'+valueHTML(v)+'</dd></div>').join('')+'</dl>':esc(value);
    const feeHTML=rows=>'<p class="hi-note">Source fee components; a whole-property annual cost is not established. Parking denominators may be unverified.</p><div class="hi-period-table"><table><caption>Service-charge components</caption><thead><tr><th>Year</th><th>Property group / use</th><th>Category</th><th>Native rate</th><th>Basis</th></tr></thead><tbody>'+rows.map(row=>'<tr><td>'+esc(row.budgetYear)+'</td><td>'+esc(row.propertyGroupName)+' / '+esc(row.usage)+'</td><td>'+esc(row.serviceCategoryName)+'</td><td>'+valueHTML(row.observedNativeRate)+'</td><td>'+esc(row.categoryRateBasis)+'</td></tr>').join('')+'</tbody></table></div>';
    const registersHTML=registers.map(row=>'<article class="hi-card"><strong>'+esc(stageLabel(row.classification))+'</strong><p class="hi-note">'+esc(row.identityBasis)+' · '+(row.identityVerified?'Verified identity':'Identity under review')+'</p><dl>'+Object.entries(row.fields??{}).filter(([k])=>k!=='feeComponents').map(([k,v])=>'<div><dt>'+esc(stageLabel(k))+'</dt><dd>'+valueHTML(v)+'</dd></div>').join('')+'</dl>'+(row.fields?.feeComponents?feeHTML(row.fields.feeComponents):'')+sourceLinks(row.sourceIds,data)+'</article>').join('');
    const status=research?'<p class="hi-note">Source collection: '+esc(stageLabel(research.status??'reviewed'))+(research.reason?' · '+esc(research.reason):'')+'. Fetching a source does not establish complete financial history.</p>':'';
    return '<details class="hi-section"><summary>New sourced facts · '+(observations.length+registers.length)+'</summary>'+financial+registersHTML+status+'</details>';
  }
  function historyHTML(data) {
    const rows = seriesRows(data,H.metric), selected = rows.find(row => row.uiId === H.seriesId) ?? rows[0];
    H.seriesId = selected?.uiId ?? null;
    const availability = selected?.availability ?? (selected?.points.length ? 'available' : 'unavailable');
    const selector = rows.length ? '<label>Financial series / cohort<select id="hi-series">' + rows.map(row => '<option value="' + esc(row.uiId) + '"' + (row.uiId === H.seriesId ? ' selected' : '') + '>' + esc(row.label ?? row.name ?? [row.metric,row.segment,row.saleType,row.scope,row.unit].filter(Boolean).join(' · ') ?? row.uiId) + '</option>').join('') + '</select></label>' : '';
    const nativeURL = /^\/map\/api\//.test(selected?.nativeApiURL??'')?selected.nativeApiURL:safeURL(selected?.nativeApiURL);
    const retained=selected?.points.length?'<details class="hi-section"><summary>Retained source rows · '+selected.points.length+'</summary><p class="hi-note">Raw values remain visible here even when sparse, conflicting or withheld from the chart. They are not an eligible market median or verified subject observation merely because a number is present.</p><div class="hi-period-table"><table><caption>Selected native cohort · '+esc(selected.unit??'unit not supplied')+'</caption><thead><tr><th>Period</th><th>Retained value</th><th>Eligibility</th></tr></thead><tbody>'+selected.points.map(point=>'<tr><th scope="row">'+esc(pointPeriod(point))+'</th><td>'+esc(fmt(pointValue(point)))+(point.sampleCount!==undefined?'<small>Sample '+esc(point.sampleCount??'unknown')+'</small>':'')+'</td><td>'+(point.displayEligible?'Chart eligible':point.sparse?'Sparse · withheld':'Withheld / unavailable')+(list(point.issues).length?'<small>'+esc(point.issues.join(', '))+'</small>':'')+'</td></tr>').join('')+'</tbody></table></div></details>':'';
    return metricControls() + selector + historyRetrievalHTML(data,selected) + '<p class="hi-note">' + esc(stageLabel(availability)) + (selected?.storedPointCount != null || selected?.pointCount != null ? ' · ' + esc(selected.storedPointCount??selected.pointCount) + ' stored points' : '') + (selected?.scope ? ' · ' + esc(selected.scope) : '') + (selected?.frequency ? ' · ' + esc(stageLabel(selected.frequency)) : '') + '</p>' + (nativeURL ? '<p><a href="' + esc(nativeURL) + '" target="_blank" rel="noopener noreferrer">Open native financial source</a></p>' : '') + historyChart(selected,eventList()) + retained + presentEvidenceHTML(data) + itemCoverageHTML(data) + coverageHTML(data) + lifecycleHTML(data) + '<details class="hi-section"><summary>Sources and news context · ' + sourceList(data).length + ' references</summary>' + sourceLinks(sourceList(data),data) + '</details>';
  }
  function eventCard(event,index) {
    return '<button type="button" class="hi-event-card' + (H.selectedEvent === event.id ? ' hi-selected' : '') + '" data-hi-event="' + esc(event.id) + '" aria-pressed="' + (H.selectedEvent === event.id) + '"><span class="hi-event-number">' + (index+1) + '</span><span><strong>' + esc(event.title ?? event.name ?? event.id) + '</strong><small>' + esc(dateText(eventDate(event))) + '</small><small>' + esc(stageLabel(event.status)) + ' · ' + esc(stageLabel(event.category)) + '</small></span></button>';
  }
  function studyHTML() {
    if (H.study?.loading) return '<p role="status">Checking comparable observations around this event…</p>';
    if (!H.study) return '';
    const study = H.study.study ?? H.study;
    const change = number(study.observedChangePct);
    return '<section class="hi-section" id="hi-event-study"><h4>Before / after evidence · ' + esc(metricLabel(H.metric)) + '</h4><p><strong>' + (change === null ? 'Effect not established' : (change >= 0 ? '+' : '') + fmt(change) + '% observed change') + '</strong></p><p class="hi-note">' + esc(stageLabel(study.classification ?? study.status)) + ' · no causal attribution</p><p>' + esc(study.reason ?? '') + '</p><div class="hi-window-grid">' + [['preWindow','Before'],['postWindow','After']].map(([field,label]) => { const value=study[field] ?? {}; return '<div><strong>' + label + '</strong><p>' + esc(value.from ?? 'Unknown') + ' – ' + esc(value.to ?? 'Unknown') + '</p><small>' + esc(value.observedPeriods ?? 0) + ' / ' + esc(value.expectedPeriods ?? 0) + ' periods observed</small></div>'; }).join('') + '</div>' + (list(study.limitations).length ? '<ul>' + study.limitations.map(text => '<li>' + esc(text) + '</li>').join('') : '') + '</section>';
  }
  function eventDetailHTML(event) {
    if (!event) return '<p class="hi-note">Select a numbered event for its dates, sources and geographic relevance.</p>';
    const exposures = exposureRows(event);
    const claims = list(event.claims);
    return '<article class="hi-section" id="hi-event-detail"><h3>' + esc(event.title ?? event.name) + '</h3><p>' + esc(dateText(eventDate(event))) + '</p><p><span class="hi-tag">' + esc(stageLabel(event.status)) + '</span> <span class="hi-tag">Event evidence</span></p>' + (event.announcedAt ? '<p class="hi-note">Announced ' + esc(event.announcedAt) + '</p>' : '') + (event.effectiveFrom ? '<p class="hi-note">Effective from ' + esc(event.effectiveFrom) + '</p>' : '') + '<h4>Relevance to this record</h4>' + (exposures.length ? exposures.map(exposure => '<p>' + esc(exposure.scope ?? 'Context') + ' · ' + (exposure.verified ? 'verified relevance' : 'relevance not verified') + '</p><p class="hi-note">' + esc(exposure.basis ?? 'No spatial or economic basis supplied') + '</p>' + sourceLinks(exposure.sourceIds)).join('') : '<p class="hi-note">No verified record-specific exposure is supplied. Regional news alone does not prove a local price effect.</p>') + (claims.length ? '<h4>What the sources support</h4>' + claims.map(claim => '<p>' + esc(claim.text) + '</p><p class="hi-note">' + esc(stageLabel(claim.classification)) + '</p>' + sourceLinks(claim.sourceIds)).join('') : '') + '<h4>Event sources</h4>' + sourceLinks(event.sourceIds) + '<p class="hi-note">Announcement, construction and operation are separate stages. Event news adds no assumed appreciation percentage.</p>' + studyHTML() + '</article>';
  }
  function renderOverlay(force=false) {
    const overlay=Q('#hi-event-overlay'); if(!overlay)return;
    const unified=window.EspaciosUnifiedMap?.timeline?.(), labels=unified?.labels??{};
    const periods=list(unified?.periods).map(id=>String(labels[id]??id).split(' · ')[0]), times=periods.map(periodTime).filter(time=>time!==null);
    const selectedPeriod=String(labels[unified?.selected]??window.__ESPACIOS_UNIFIED_MAP__?.period??'').split(' · ')[0];
    const mapArea=window.__ESPACIOS_UNIFIED_MAP__?.area??'',mapReadout=Q('#vd-evidence-label')?.textContent??'';
    const events=eventList(), signature=JSON.stringify([H.overlay,H.recordId,H.metric,H.loading,H.selectedEvent,periods,selectedPeriod,events.map(event=>event.id),Q('#hi-event-track')?.clientWidth,mapArea,mapReadout]);
    if(!force&&signature===H.overlayKey)return;H.overlayKey=signature;
    const toggle=Q('#hi-overlay-toggle');toggle.setAttribute('aria-pressed',String(H.overlay));toggle.textContent=H.overlay?'Hide events':'Show events';
    Q('#hi-overlay-content').hidden=!H.overlay;
    Q('#hi-overlay-record').textContent=H.history?.record?.name?'Event context · '+H.history.record.name:'Choose a record for sourced events';
    Q('#hi-overlay-scope').textContent=H.history?.record?mapScopeWarning(H.history.record,H.records,mapArea)+(mapReadout?' Current map readout: '+mapReadout+'.':''):'';
    const selector=Q('#hi-overlay-metric');if(selector.value!==H.metric)selector.value=H.metric;
    if(!H.overlay)return;
    const dated=events.map((event,index)=>({event,index,time:periodTime(typeof eventDate(event)==='string'?eventDate(event):eventDate(event).start)})).filter(row=>row.time!==null);
    const dates=times.length?times:dated.map(row=>row.time);
    const track=Q('#hi-event-track');
    if(!dates.length){track.innerHTML='';Q('#hi-overlay-note').textContent=H.loading?'Loading matching event evidence…':'No dated events supplied for this record. Use Record to choose any project or community.';Q('#hi-overlay-dates').textContent='';return;}
    const start=Math.min(...dates),end=Math.max(...dates),position=time=>100*(time-start)/(end-start||1);
    const visible=dated.filter(row=>row.time>=start&&row.time<=end),selectedTime=periodTime(selectedPeriod);
    const clusters=clusterEventMarkers(visible,start,end,track.clientWidth||280);
    track.innerHTML=clusters.map(group=>{
      const {event,index}=group.rows[0],label=group.rows.length===1?(event.title??event.name)+', '+dateText(eventDate(event)):group.rows.length+' events between '+dateText(eventDate(group.rows[0].event))+' and '+dateText(eventDate(group.rows.at(-1).event))+'. Open the sourced event list.';
      return '<button type="button" data-hi-overlay-event="'+esc(event.id)+'" data-hi-overlay-count="'+group.rows.length+'" style="left:'+(100*group.position/(track.clientWidth||280)).toFixed(2)+'%" aria-label="'+esc(label)+'" title="'+esc(label)+'" aria-pressed="'+group.rows.some(row=>H.selectedEvent===row.event.id)+'">'+(group.rows.length===1?index+1:group.rows.length+'×')+'</button>';
    }).join('')+(selectedTime!==null&&selectedTime>=start&&selectedTime<=end?'<span class="hi-current-period" aria-hidden="true" style="left:'+position(selectedTime).toFixed(2)+'%"></span>':'');
    Q('#hi-overlay-dates').innerHTML='<span>'+new Date(start).getUTCFullYear()+'</span><span>'+new Date(end).getUTCFullYear()+'</span>';
    Q('#hi-overlay-note').textContent=visible.length+' / '+events.length+' events in '+(times.length?'the map’s displayed period range':'their source date range')+' · '+metricLabel(H.metric)+' evidence is separate from map values. '+(clusters.length<visible.length?'Nearby dates are grouped; all events remain in the sourced list. ':'')+(window.__ESPACIOS_UNIFIED_MAP__?.metric==='roi'?'Map yield remains a benchmark; it is not signed rent. ':'')+'Select a marker for dates, relevance and sources.';
  }
  function installOverlay() {
    const dock=Q('#tl-dock');if(!dock||Q('#hi-event-overlay'))return;
    const overlay=document.createElement('section');overlay.id='hi-event-overlay';overlay.setAttribute('aria-label','Sourced events on the map timeline');
    overlay.innerHTML='<div class="hi-overlay-head"><span id="hi-overlay-record">Sourced event overlay</span><button id="hi-overlay-toggle" type="button" aria-pressed="false" aria-controls="hi-overlay-content">Show events</button></div><div id="hi-overlay-content" hidden><div class="hi-overlay-options"><label>Event study metric <select id="hi-overlay-metric"><option value="price">Price</option><option value="rent">Rent</option><option value="volume">Transaction volume</option></select></label><button type="button" id="hi-overlay-choose">Record / sources</button></div><p id="hi-overlay-scope" role="status"></p><div id="hi-event-track" role="group" aria-label="Dated event markers"></div><div id="hi-overlay-dates" class="hi-overlay-dates"></div><p id="hi-overlay-note"></p></div>';
    dock.append(overlay);
    Q('#hi-overlay-toggle').onclick=async()=>{H.overlay=!H.overlay;renderOverlay(true);if(H.overlay&&!H.records.length){try{await loadIndex();const record=exactRecord(H.pendingSelection??currentSelection()??areaSelection(),H.records);if(record)await select(record.id);else open();}catch(error){Q('#hi-overlay-note').textContent=error.message;}}else if(H.overlay&&!H.recordId)open();};
    Q('#hi-overlay-choose').onclick=()=>open(H.recordId);
    Q('#hi-overlay-metric').onchange=event=>changeFinancialSelection(event.target.value);
    overlay.addEventListener('click',event=>{const button=event.target.closest('[data-hi-overlay-event]');if(button){open(H.recordId);selectEvent(button.dataset.hiOverlayEvent);}});
    renderOverlay(true);
  }
  function eventsHTML() {
    const events = eventList(), rows = seriesRows(H.history,H.metric), series = rows.find(row => row.uiId === H.seriesId) ?? rows[0];
    return metricControls() + historyRetrievalHTML(H.history,series) + historyChart(series,events) + '<p class="hi-note">' + events.length + ' relevant event records. Reported event dates and publication dates are displayed separately.</p><div class="hi-events">' + events.map(eventCard).join('') + '</div>' + eventDetailHTML(eventById(H.selectedEvent));
  }
  function input(name,label,options={}) { return '<label>' + esc(label) + '<input type="number" name="' + esc(name) + '" step="' + (options.step ?? 'any') + '"' + (options.min !== undefined ? ' min="' + options.min + '"' : '') + (options.max !== undefined ? ' max="' + options.max + '"' : '') + ' value="' + esc(options.value ?? '') + '"></label>'; }
  function assumptionForm() {
    const a = H.assumptions ?? {};
    const annual=H.annualForm;
    const baseFields=input('priceAED','2026 purchase / capital value · AED',{min:0.01,value:a.priceAED}) + input('annualRentAED','2026 annual rent · AED / year',{min:0,value:a.annualRentAED}) + input('occupancyYear','First rental year',{step:1,min:2026,max:2081,value:a.occupancyYear}) + input('vacancyPct','Vacancy · %',{min:0,max:100,value:a.vacancyPct}) + input('annualOperatingCostsAED','2026 operating costs · AED / year',{min:0,value:a.annualOperatingCostsAED}) + input('acquisitionCostsPct','Acquisition costs · %',{min:0,max:100,value:a.acquisitionCostsPct}) + input('disposalCostsPct','Disposal costs · %',{min:0,max:100,value:a.disposalCostsPct});
    const rates=['price','rent'].map(metric=>'<fieldset><legend>Annual '+(metric==='price'?'capital':'rent')+' growth · %</legend><div class="hi-input-grid hi-three">'+['downside','base','upside'].map(path=>input(metric+'Growth.'+path,stageLabel(path),{min:-99.999,max:100,value:a[metric==='price'?'annualPriceGrowthPct':'annualRentGrowthPct']?.[path]})).join('')+'</div></fieldset>').join('');
    const annualFields='<fieldset><legend>Annual purchasing power and delivery assumptions</legend><div class="hi-input-grid">'+input('inflationPct','Inflation in each year · %',{min:-99.999,max:100,value:annual.inflationPct})+input('costGrowthPct','Operating cost growth · % / year',{min:-99.999,max:100,value:annual.costGrowthPct})+'</div><p class="hi-note">These entries create explicit overrides for every year from 2027 to 2080. Real values remain unavailable without an inflation assumption for every preceding year.</p><div class="hi-input-grid hi-three">'+['downside','base','upside'].map(path=>input('delay.'+path,stageLabel(path)+' delivery delay · years',{min:0,max:54,step:1,value:annual['delay.'+path]})).join('')+'</div></fieldset>';
    const advanced='<details><summary>Year-by-year overrides · advanced</summary><label>Annual overrides · JSON<textarea name="annualInputs" id="hi-annual-inputs" rows="7" spellcheck="false">'+esc(annual.json??'')+'</textarea></label><p class="hi-note">Object with downside, base and upside arrays. Each row needs an exact year (2027–2080). Optional fields: priceGrowthPct, rentGrowthPct, inflationPct, vacancyPct, operatingCostsAED, deliveryDelayYears, supplyGrowthPct, migrationGrowthPct, ratePct. Entered year overrides replace the fixed assumptions for that year. Supply, migration and rates are disclosed context inputs; no arbitrary price coefficient is added.</p></details>';
    return '<details class="hi-section" id="hi-assumptions"><summary>Use my own assumptions through 2080</summary><p class="hi-note">Your inputs are hypothetical 2026 baseline values, not observed prices or quotes. Fixed growth applies only where no annual override is supplied. Blank inputs leave corresponding outputs unavailable; future infrastructure news adds no percentage.</p><form id="hi-scenario-form"><div class="hi-input-grid">'+baseFields+'</div>'+rates+annualFields+advanced+'<button type="submit" id="hi-scenario-apply"'+(H.scenarioPending?' disabled':'')+'>'+(H.scenarioPending?'Calculating…':'Calculate my scenarios')+'</button> <button type="button" id="hi-scenario-reset">Use supplied evidence</button><p id="hi-scenario-error" role="status">'+esc(H.scenarioError)+'</p></form></details>';
  }
  function scenarioValue(point) {return H.scenarioDisplay==='real'?point.realValue:point.value;}
  function scenarioValueHTML(point,unit) {return '<strong>'+esc(fmt(scenarioValue(point)))+'</strong> '+esc(unit??'')+'<small>'+(H.scenarioDisplay==='real'?'Real value in 2026 purchasing power. ':'Nominal value. ')+esc(H.scenarioDisplay==='real'&&number(point.realValue)===null&&number(point.value)!==null?'Inflation assumptions are incomplete or unavailable.':point.reason??stageLabel(point.status))+'</small>';}
  function scenariosHTML() {
    const data = H.scenarioResult ?? H.history, scenarios = data?.scenarios ?? {}, metric = H.scenarioMetric;
    const point = scenarioPoint(data,metric,'base',H.year), metricData = scenarios.metrics?.[metric] ?? {}, years = Array.from({length:54},(_,i)=>2027+i);
    const isManual = scenarios.classification === 'user_assumption_scenario';
    const available = years.some(year => ['downside','base','upside'].some(path => number(scenarioValue(scenarioPoint(data,metric,path,year))) !== null));
    const method=scenarios.formulas?.[metric]??scenarios.formula??scenarios.assumptions?.formula;
    const methodHTML=method?'<details><summary>Calculation method and limits</summary><p class="hi-note">'+esc(method)+'</p>'+(metric==='netROI'?'<p class="hi-note">'+esc(scenarios.netReturnDefinition??'Cumulative nominal all-cash return; not an annual yield or IRR.')+'</p>':'')+'<ul>'+list(scenarios.limitations).map(text=>'<li>'+esc(text)+'</li>').join('')+'</ul></details>':'';
    return '<section class="hi-section"><h3>Annual paths · 2027–2080</h3><p class="hi-tag">' + (isManual ? 'Your assumption scenario' : 'Conditional scenario') + '</p><p class="hi-note">These paths are conditional calculations. They are not validated forecasts. ' + (isManual ? 'Your values do not change historical coverage.' : 'No annual value is invented when an anchor or assumption is missing.') + '</p><div class="hi-input-grid"><label>Scenario metric<select id="hi-scenario-metric">' + ['price','rent','netROI'].map(m => '<option value="' + m + '"' + (m===metric?' selected':'') + '>' + metricLabel(m) + '</option>').join('') + '</select></label><label>Value basis<select id="hi-scenario-display"><option value="nominal"'+(H.scenarioDisplay==='nominal'?' selected':'')+'>Nominal</option><option value="real"'+(H.scenarioDisplay==='real'?' selected':'')+'>Real · 2026 purchasing power</option></select></label></div><label>Review year · <output id="hi-year-label">' + H.year + '</output><input id="hi-year" type="range" min="2027" max="2080" step="1" value="' + H.year + '"></label><div class="hi-scenario-value" id="hi-scenario-value" aria-live="polite">'+scenarioValueHTML(point,metricData.unit)+'</div>' + (!available ? '<p class="hi-empty" aria-disabled="true">No numerical path for this value basis. All 54 annual slots remain visible below. Enter explicit assumptions to calculate a separate user scenario.</p>' : '') + '<details><summary>All 54 annual values</summary><table class="hi-scenario-table"><caption>' + esc(metricLabel(metric)) + ' · ' + esc(metricData.unit ?? 'unit not supplied') + ' · '+esc(H.scenarioDisplay)+'</caption><thead><tr><th>Year</th><th>Downside</th><th>Base</th><th>Upside</th></tr></thead><tbody>' + years.map(year => '<tr><th scope="row">' + year + '</th>' + ['downside','base','upside'].map(path => { const p=scenarioPoint(data,metric,path,year),v=scenarioValue(p); return '<td' + (number(v) === null ? ' class="hi-unavailable" aria-disabled="true"' : '') + ' title="' + esc(p.reason ?? stageLabel(p.status)) + '">' + (number(v) === null ? 'Unavailable' : fmt(v)) + '</td>'; }).join('') + '</tr>').join('') + '</tbody></table></details>'+methodHTML+'</section>' + assumptionForm();
  }
  function render() {
    if (!H.installed) return;
    renderOverlay();
    panelGeometry();
    const record = H.history?.record ?? H.records.find(row => row.id === H.recordId);
    Q('#hi-record-name').textContent = record ? record.name + ' · ' + record.emirate : 'Choose a project or community';
    Q('#hi-date-label').textContent = H.history ? 'Research snapshot ' + (H.history.asOf ?? 'not dated') + ' · ' + (record?.type ?? '') : 'Sourced history and events';
    Q('#hi-tabs').querySelectorAll('button').forEach(button => { const selected=button.dataset.hiTab===H.tab; button.setAttribute('aria-selected',String(selected)); button.tabIndex=selected?0:-1; });
    const body = Q('#hi-body'); body.setAttribute('aria-labelledby','hi-tab-' + H.tab); body.setAttribute('aria-busy',String(H.loading||H.seriesLoading));
    if (H.loading) { body.innerHTML='<p role="status">Loading this record’s financial coverage and dated events…</p>'; return; }
    if (H.error) { body.innerHTML='<p role="alert">' + esc(H.error) + '</p><button type="button" id="hi-retry">Retry research</button>'; return; }
    if (!H.history) { body.innerHTML='<p class="hi-empty">Choose any indexed project or community above. Financial observations, lifecycle evidence, events and long-term scenario availability will be shown separately.</p>'; return; }
    body.innerHTML = (H.seriesLoading?'<p role="status">Loading all retained native points for the selected financial cohort…</p>':'')+(H.seriesError?'<p role="alert">'+esc(H.seriesError)+'</p><button type="button" id="hi-series-retry">Retry selected cohort</button>':'')+(H.tab === 'history' ? historyHTML(H.history) : H.tab === 'events' ? eventsHTML() : scenariosHTML());
    window.__ESPACIOS_HISTORICAL_INTELLIGENCE__ = {release:'20261005-history-enrichment-v3',recordId:H.recordId,recordCount:H.records.length,tab:H.tab,metric:H.metric,scenarioClassification:(H.scenarioResult??H.history).scenarios?.classification,validatedForecast:false};
  }
  async function ensureSelectedSeries(uiId=H.seriesId) {
    if(!H.history)return;
    const rows=seriesRows(H.history,H.metric),selected=rows.find(row=>row.uiId===uiId)??rows[0];
    H.seriesController?.abort();const requestSequence=++H.seriesSequence;
    H.seriesLoading=false;H.seriesError='';H.seriesId=selected?.uiId??null;
    const descriptor=list(H.history.historySeries).find(series=>series.id===selected?.id);
    if(!selected||!descriptor?.partition||descriptor.partitionLoaded&&!descriptor.pointsPartial&&list(descriptor.points).length===descriptor.pointCount){render();return;}
    const recordId=H.recordId,recordSequence=H.sequence,history=H.history,controller=new AbortController();H.seriesController=controller;H.seriesLoading=true;render();
    try{
      const loaded=await loadCompleteSeriesPages(history,selected.id,cursor=>getJSON('/map/api/record-history?recordId='+encodeURIComponent(recordId)+'&seriesId='+encodeURIComponent(selected.id)+'&pointCursor='+cursor,AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])));
      if(requestSequence!==H.seriesSequence||recordSequence!==H.sequence||recordId!==H.recordId)return;
      H.history=mergeLoadedSeries(H.history,loaded);
      const completedRows=seriesRows(H.history,H.metric);
      H.seriesId=(completedRows.find(row=>row.uiId===selected.uiId)??completedRows.find(row=>row.id===selected.id&&row.frequency===selected.frequency)??completedRows.find(row=>row.id===selected.id))?.uiId??null;
    }catch(error){if(requestSequence!==H.seriesSequence||recordSequence!==H.sequence||error.name==='AbortError')return;H.seriesError=error.message;}
    finally{if(requestSequence===H.seriesSequence&&recordSequence===H.sequence){H.seriesLoading=false;render();}}
  }
  async function changeFinancialSelection(metric,uiId=null) {
    H.metric=metric;H.seriesId=uiId;H.study=null;render();
    await ensureSelectedSeries(uiId);
    if(H.selectedEvent)selectEvent(H.selectedEvent);
  }
  async function select(recordId) {
    if (!H.records.length) await loadIndex();
    const record = H.records.find(row => row.id === recordId);
    if (!record) { H.error='This selection has no exact project or community record in the research index.'; render(); return; }
    H.seriesController?.abort();++H.seriesSequence;H.seriesLoading=false;H.seriesError='';
    H.recordId=recordId; H.history=null; H.events=[]; H.selectedEvent=null; H.study=null; H.seriesId=null; H.scenarioResult=null; H.assumptions=null; H.annualForm={}; H.scenarioPending=false; H.scenarioError=''; H.loading=true; H.error='';
    H.pickerPinnedOpen=false;
    if(mobileLayout()||Q('#hi-panel').dataset.hiPicker==='compact')Q('#hi-record-picker').open=false;
    ++H.studySequence; H.controller?.abort(); H.controller=new AbortController(); const sequence=++H.sequence;
    chooser(); render();
    try {
      const signal=AbortSignal.any([H.controller.signal,AbortSignal.timeout(15000)]);
      const [history,eventsResult] = await Promise.allSettled([getJSON('/map/api/record-history?recordId=' + encodeURIComponent(recordId),signal),getJSON('/map/api/events?recordId=' + encodeURIComponent(recordId),signal)]);
      if (sequence !== H.sequence) return;
      if (history.status !== 'fulfilled') throw history.reason;
      H.history=history.value;
      H.events=eventsResult.status==='fulfilled' ? list(Array.isArray(eventsResult.value) ? eventsResult.value : eventsResult.value.events) : list(H.history.events);
      if (eventsResult.status==='fulfilled' && Array.isArray(eventsResult.value.sources)) H.history.sources=[...sourceList(H.history),...eventsResult.value.sources.filter(source => !sourceList(H.history).some(s=>s.id===source.id))];
      H.loading=false; render();await ensureSelectedSeries();
    } catch (error) { if (sequence !== H.sequence || error.name==='AbortError') return; H.loading=false; H.error=error.message; render(); }
  }
  async function selectEvent(id) {
    const event = eventById(id); if (!event) return;
    H.selectedEvent=event.id; H.tab='events'; H.study={loading:true}; const sequence=++H.studySequence, recordId=H.recordId, metric=H.metric; render();
    const series=seriesRows(H.history,metric).find(row=>row.uiId===H.seriesId)??seriesRows(H.history,metric)[0],frequency=['monthly','quarterly','half_year','annual'].includes(series?.frequency)?series.frequency:'monthly',scope=['area_context','asking_benchmark'].includes(series?.scope)?series.scope:'subject';
    try { const data=await getJSON('/map/api/event-studies?recordId=' + encodeURIComponent(recordId) + '&eventId=' + encodeURIComponent(id) + '&metric=' + metric+'&frequency='+frequency+'&scope='+scope+(series?.id?'&seriesId='+encodeURIComponent(series.id):''),AbortSignal.timeout(15000)); if (sequence===H.studySequence&&recordId===H.recordId&&metric===H.metric) { H.study=data; render(); } }
    catch (error) { if (sequence===H.studySequence) { H.study={status:'insufficient_evidence',reason:error.message,causalAttribution:false}; render(); } }
  }
  function buildAnnualInputs(assumptions,extras={},text='') {
    const isEntered=value=>value!==undefined&&value!==null&&String(value).trim()!=='';
    const parsed=text.trim()?JSON.parse(text):{};
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||Object.keys(parsed).some(path=>!['common','downside','base','upside'].includes(path)))throw Error('Annual overrides must be an object with common, downside, base or upside arrays.');
    const result={};
    for(const path of ['common','downside','base','upside']){
      const override=parsed[path]??[];
      if(!Array.isArray(override)||override.some(row=>!row||typeof row!=='object'||!Number.isInteger(row.year)||row.year<2027||row.year>2080)||new Set(override.map(row=>row.year)).size!==override.length)throw Error('Annual overrides need unique exact years from 2027 to 2080.');
      const generated=[];
      for(let year=2027;year<=2080;year++){
        const row={year};
        if(path==='common'){
          if(isEntered(extras.inflationPct))row.inflationPct=Number(extras.inflationPct);
          if(isEntered(extras.costGrowthPct)){
            if(number(assumptions.annualOperatingCostsAED)===null)throw Error('Operating cost growth needs an explicit 2026 operating cost amount.');
            row.operatingCostsAED=assumptions.annualOperatingCostsAED*(1+Number(extras.costGrowthPct)/100)**(year-2026);
          }
        }else if(isEntered(extras['delay.'+path]))row.deliveryDelayYears=Number(extras['delay.'+path]);
        if(Object.keys(row).length>1)generated.push(row);
      }
      const combined=new Map(generated.map(row=>[row.year,row]));for(const row of override)combined.set(row.year,{...(combined.get(row.year)??{}),...row});
      if(combined.size)result[path]=[...combined.values()].sort((a,b)=>a.year-b.year);
    }
    return result;
  }
  function readAssumptions(form) {
    const result = {}, fields = ['priceAED','annualRentAED','occupancyYear','vacancyPct','annualOperatingCostsAED','acquisitionCostsPct','disposalCostsPct'];
    for (const field of fields) { const input=form.elements.namedItem(field); if(input&&input.value.trim()!=='') result[field]=Number(input.value); }
    for (const [prefix,field] of [['priceGrowth','annualPriceGrowthPct'],['rentGrowth','annualRentGrowthPct']]) {
      const growth={}; for(const path of ['downside','base','upside']) { const input=form.elements.namedItem(prefix+'.'+path); if(input&&input.value.trim()!=='') growth[path]=Number(input.value); } if(Object.keys(growth).length) result[field]=growth;
    }
    for(const field of ['inflationPct','costGrowthPct','delay.downside','delay.base','delay.upside'])H.annualForm[field]=form.elements.namedItem(field)?.value??'';
    H.annualForm.json=form.elements.namedItem('annualInputs')?.value??'';
    const annual=buildAnnualInputs(result,H.annualForm,H.annualForm.json);if(Object.keys(annual).length)result.annualInputs=annual;
    return result;
  }
  async function applyScenario(form) {
    if (!form.reportValidity()) return;
    let assumptions;try{assumptions=readAssumptions(form);}catch(error){H.scenarioError=error.message;Q('#hi-scenario-error').textContent=error.message;return;}
    const recordId=H.recordId;
    if (!Object.keys(assumptions).length) { H.scenarioError='Enter explicit assumptions. Blank inputs are not treated as zero.'; Q('#hi-scenario-error').textContent=H.scenarioError; return; }
    H.assumptions=assumptions; H.scenarioPending=true; H.scenarioError=''; const sequence=H.sequence;
    const button=Q('#hi-scenario-apply');button.disabled=true;button.textContent='Calculating…';
    try {
      let data;
      if(window.EspaciosHistoricalCore?.annualScenarios){
        window.EspaciosHistoricalCore.validateScenarioAssumptions?.(assumptions);
        data={...H.history,scenarios:window.EspaciosHistoricalCore.annualScenarios(H.history.record,{asOf:H.history.asOf,sources:sourceList(),userAssumptions:assumptions})};
      }else{
        const url='/map/api/record-history?recordId=' + encodeURIComponent(recordId) + '&assumptions=' + encodeURIComponent(JSON.stringify(assumptions));
        if(url.length>14000)throw Error('The full annual calculation module is unavailable and these overrides exceed the safe request size. Retry when the module loads, or use fewer annual overrides.');
        data=await getJSON(url,AbortSignal.timeout(15000));
      }
      if (sequence!==H.sequence) return;
      H.scenarioResult=data; H.scenarioPending=false; render(); Q('#hi-assumptions')?.setAttribute('open','');
    } catch (error) { if (sequence!==H.sequence) return; H.scenarioPending=false; H.scenarioError=error.message; Q('#hi-scenario-error').textContent=H.scenarioError; button.disabled=false;button.textContent='Calculate my scenarios'; }
  }
  function close() { Q('#hi-panel')?.classList.add('hidden');Q('#hi-launch')?.setAttribute('aria-expanded','false');Q('#hi-launch')?.focus({preventScroll:true}); }
  async function open(recordId) {
    const panel=Q('#hi-panel'); if(!panel)return;
    window.EspaciosSearchFocus?.cancel('history-drawer-opened');
    if(!Q('#vd-panel')?.classList.contains('hidden'))window.EspaciosValueDrivers?.close();
    panel.classList.remove('hidden');Q('#hi-launch').setAttribute('aria-expanded','true');window.EspaciosMobileUI?.activate(panel);
    H.error='';render();
    try {
      await loadIndex(); chooser();
      const selection=recordId ? H.records.find(row=>row.id===recordId) : exactRecord(H.pendingSelection??currentSelection(),H.records);
      if(selection&&selection.id!==H.recordId) await select(selection.id); else render();
      if(mobileLayout()){if(!H.recordId)Q('#hi-record-picker').open=true;else Q('#hi-record-picker').open=false;panelGeometry();Q('#hi-record-picker summary')?.focus({preventScroll:true});}else Q('#hi-record-search')?.focus({preventScroll:true});
    } catch(error) { H.error=error.message;render(); }
  }
  function followSelection(selection) {
    H.pendingSelection=selection;
    if(!H.records.length)return;
    const record=exactRecord(selection,H.records);
    if(record&&record.id!==H.recordId&&(H.overlay||!Q('#hi-panel')?.classList.contains('hidden'))) select(record.id);
  }
  function install() {
    if(H.installed)return true;
    if(!Q('#minimal-kind-controls')||!Q('#app')||!window.EspaciosUnifiedMap)return false;
    const launch=document.createElement('button');launch.id='hi-launch';launch.type='button';launch.textContent='History & events';launch.setAttribute('aria-expanded','false');launch.setAttribute('aria-controls','hi-panel');launch.onclick=()=>open();Q('#minimal-kind-controls').append(launch);
    const panel=document.createElement('aside');panel.id='hi-panel';panel.className='hi-drawer hidden';panel.dataset.release='20261005-history-enrichment-v3';panel.setAttribute('aria-label','Historical intelligence');
    const header='<header><div><h2>History & events</h2><p id="hi-date-label">Sourced history and events</p><small id="hi-mobile-hint" hidden>Close this drawer to use the map timeline.</small></div><button type="button" id="hi-close" aria-label="Close historical intelligence and return to map timeline">×</button></header>';
    const picker='<div class="hi-selection"><h3 id="hi-record-name">Choose a project or community</h3><details id="hi-record-picker"'+(mobileLayout()?'':' open')+'><summary>Change record</summary><label>Find any project / community<input id="hi-record-search" type="search" placeholder="Search name, emirate or record ID" autocomplete="off"></label><label class="hi-select-label">Record<select id="hi-record-select"><option>Loading record index…</option></select></label><p id="hi-record-count" role="status"></p></details></div>';
    panel.innerHTML=header+picker+'<div id="hi-tabs" role="tablist" aria-label="Historical intelligence view">' + [['history','History'],['events','Events'],['scenarios','Through 2080']].map(([tab,label])=>'<button type="button" id="hi-tab-'+tab+'" data-hi-tab="'+tab+'" role="tab" aria-controls="hi-body" aria-selected="'+(tab===H.tab)+'" tabindex="'+(tab===H.tab?0:-1)+'">'+label+'</button>').join('') + '</div><div id="hi-body" role="tabpanel" aria-labelledby="hi-tab-history"></div>';
    Q('#app').append(panel);H.installed=true;Q('#hi-close').onclick=close;Q('#hi-record-search').oninput=chooser;Q('#hi-record-select').onchange=e=>{if(e.target.value)select(e.target.value);};Q('#hi-record-picker').addEventListener('toggle',panelGeometry);Q('#hi-record-picker summary').addEventListener('click',()=>{H.pickerPinnedOpen=!Q('#hi-record-picker').open;});
    panel.addEventListener('click',event=>{
      const target=event.target.closest('button,[data-hi-event]');if(!target)return;
      if(target.dataset.hiTab){const form=Q('#hi-scenario-form');if(form){try{H.assumptions=readAssumptions(form);}catch{}}H.tab=target.dataset.hiTab;render();}
      else if(target.dataset.hiMetric)changeFinancialSelection(target.dataset.hiMetric);
      else if(target.dataset.hiEvent)selectEvent(target.dataset.hiEvent);
      else if(target.id==='hi-retry')H.recordId?select(H.recordId):open();
      else if(target.id==='hi-series-retry')ensureSelectedSeries();
      else if(target.id==='hi-scenario-reset'){H.scenarioResult=null;H.assumptions=null;H.annualForm={};H.scenarioError='';render();}
    });
    panel.addEventListener('change',event=>{
      if(event.target.id==='hi-series')changeFinancialSelection(H.metric,event.target.value);
      else if(['hi-scenario-metric','hi-scenario-display'].includes(event.target.id)){const form=Q('#hi-scenario-form');if(form){try{H.assumptions=readAssumptions(form);}catch{}}if(event.target.id==='hi-scenario-metric')H.scenarioMetric=event.target.value;else H.scenarioDisplay=event.target.value;render();}
    });
    panel.addEventListener('input',event=>{if(event.target.id==='hi-year'){H.year=+event.target.value;Q('#hi-year-label').textContent=H.year;const data=H.scenarioResult??H.history,p=scenarioPoint(data,H.scenarioMetric,'base',H.year);Q('#hi-scenario-value').innerHTML=scenarioValueHTML(p,data.scenarios?.metrics?.[H.scenarioMetric]?.unit);}});
    panel.addEventListener('submit',event=>{if(event.target.id==='hi-scenario-form'){event.preventDefault();applyScenario(event.target);}});
    panel.addEventListener('keydown',event=>{
      const marker=event.target.closest('[data-hi-event]');if(marker&&!event.target.matches('button')&&['Enter',' '].includes(event.key)){event.preventDefault();selectEvent(marker.dataset.hiEvent);}
      const tab=event.target.closest('[role="tab"]');if(tab&&['ArrowRight','ArrowLeft','Home','End'].includes(event.key)){event.preventDefault();const tabs=[...Q('#hi-tabs').querySelectorAll('button')],i=tabs.indexOf(tab),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;H.tab=tabs[next].dataset.hiTab;render();tabs[next].focus();}
    });
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.classList.contains('hidden'))close();});
    document.addEventListener('espacios:search-selection',event=>followSelection(event.detail));
    installOverlay();
    installGeometryObservers();
    setInterval(()=>{const selection=currentSelection(),signature=selection?JSON.stringify([selection.id,selection.kind,selection.name,selection.emirate]):'',selectionChanged=signature!==H.lastSelection;if(selectionChanged){H.lastSelection=signature;if(selection)followSelection(selection);}const area=areaSelection(),areaKey=area?key(area.name+'|'+area.emirate):'';if(areaKey!==H.areaKey){H.areaKey=areaKey;if(area&&H.overlay&&!selectionChanged)followSelection(area);}launch.setAttribute('aria-expanded',String(!panel.classList.contains('hidden')));renderOverlay();panelGeometry();},500);
    const publicAPI=Object.freeze({open,close,select,getState:()=>({recordId:H.recordId,recordCount:H.records.length,tab:H.tab,metric:H.metric,seriesId:H.seriesId,overlay:H.overlay,loading:H.loading||H.seriesLoading,seriesLoading:H.seriesLoading,seriesError:H.seriesError,historyPagination:H.history?.historyPagination,layout:panel.dataset.hiLayout,scenarioClassification:(H.scenarioResult??H.history)?.scenarios?.classification,validatedForecast:false}),classification:'sourced_history_and_conditional_scenarios'});
    window.EspaciosHistoricalIntelligence=publicAPI;window.EspaciosHistoricalUI=publicAPI;render();return true;
  }
  const timer=setInterval(()=>{if(install())clearInterval(timer);},150);
})();
