/* Search identity, selected geography and camera placement share one owner. */
const EspaciosSearchFocusCore = (() => {
  const key = value => String(value || '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  function groupedEntries(entries, labelOf) {
    const groups = new Map();
    for (const entry of entries || []) {
      const label = labelOf(entry);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(entry);
    }
    return [...groups.values()].flat();
  }
  function coordinate(record) {
    const c = record?.coordinates;
    if (!c || c.lng === '' || c.lat === '' || c.lng == null || c.lat == null) return null;
    const lng = Number(c.lng), lat = Number(c.lat);
    return Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lng) <= 180 && Math.abs(lat) <= 90 ? [lng, lat] : null;
  }
  function bounds(geometries) {
    let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
    const visit = value => {
      if (!Array.isArray(value)) return;
      if (typeof value[0] === 'number') {
        const [x, y] = value;
        if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 180 || Math.abs(y) > 90) return;
        west = Math.min(west, x);south = Math.min(south, y);east = Math.max(east, x);north = Math.max(north, y);
      } else value.forEach(visit);
    };
    for (const geometry of geometries || []) if (geometry && ['Point', 'MultiPoint', 'Polygon', 'MultiPolygon', 'LineString', 'MultiLineString'].includes(geometry.type)) visit(geometry.coordinates);
    return Number.isFinite(west) ? [[west, south], [east, north]] : null;
  }
  function exactFeatures(record, features) {
    const name = key(record?.name), emirate = key(record?.emirate);
    if (!name || !emirate) return [];
    return (features || []).filter(feature => {
      const p = feature.properties || {};
      return key(p.emirate) === emirate && [p.name, p.canonicalName, p.psrName, p.psrBoundaryName].some(value => key(value) === name);
    });
  }
  function target(entry, sources = {}) {
    if (entry?.type === 'developer') {
      const points = (entry.projects || []).map(coordinate).filter(Boolean);
      const box = bounds(points.map(coordinates => ({type: 'Point', coordinates})));
      return box ? {bounds: box, maxZoom: 12.5, basis: 'catalogue-project-coordinates'} : null;
    }
    const record = entry?.record;
    if (!record) return null;
    if (record.geometry) {
      const box = bounds([record.geometry]);
      if (box) return {bounds: box, maxZoom: record.kind === 'project' ? 16 : 13, basis: 'record-geometry'};
    }
    if (record.kind === 'community') {
      let features = exactFeatures(record, sources.territories);
      if (!features.length) features = exactFeatures(record, sources.surfaces).filter(f => f.properties?.level !== 'emirate');
      if (!features.length) features = exactFeatures(record, sources.communities);
      const box = bounds(features.map(f => f.geometry));
      if (box) return {bounds: box, maxZoom: 13, basis: 'exact-source-boundary'};
    }
    const center = coordinate(record);
    return center ? {center, zoom: record.kind === 'project' ? 15.2 : record.kind === 'community' ? 12.6 : 14, basis: 'catalogue-record-coordinate'} : null;
  }
  function marketArea(record, rows) {
    const emirate = key(record?.emirate);
    const names = new Set((record?.kind === 'community' ? [record.name] : [record?.area, record?.community, record?.masterCommunity]).map(key).filter(Boolean));
    if (!emirate || !names.size) return null;
    const matches = (rows || []).filter(row => key(row.emirate) === emirate && names.has(key(row.name)));
    const unique = new Map(matches.map(row => [key(row.emirate) + '|' + key(row.name), row]));
    return unique.size === 1 ? [...unique.values()][0] : null;
  }
  function padding(viewport, rectangles) {
    const width = viewport.width, height = viewport.height, gap = 12;
    const out = {top: gap, bottom: gap, left: gap, right: gap};
    for (const {rect, side} of rectangles || []) {
      if (!rect || rect.right <= 0 || rect.left >= width || rect.bottom <= 0 || rect.top >= height || rect.width <= 0 || rect.height <= 0) continue;
      if (side === 'top') out.top = Math.max(out.top, rect.bottom + gap);
      if (side === 'bottom') out.bottom = Math.max(out.bottom, height - rect.top + gap);
      if (side === 'left') out.left = Math.max(out.left, rect.right + gap);
      if (side === 'right') out.right = Math.max(out.right, width - rect.left + gap);
    }
    // Never ask MapLibre to fit into an empty viewport, even with a keyboard open.
    for (const [a, b, size] of [['left', 'right', width], ['top', 'bottom', height]]) {
      const available = Math.max(0, size - Math.min(96, size / 2));
      if (out[a] + out[b] > available) {
        const ratio = available / (out[a] + out[b]);out[a] *= ratio;out[b] *= ratio;
      }
      out[a] = Math.round(out[a]);out[b] = Math.round(out[b]);
    }
    return out;
  }
  return {key, groupedEntries, coordinate, bounds, exactFeatures, target, marketArea, padding};
})();

(() => {
  const K = EspaciosSearchFocusCore, Q = selector => document.querySelector(selector);
  let sequence = 0, pending = 0, cameraOwner = null, releaseTimer = 0;
  const sourceGeometry = () => ({territories: state.masterTerritoryData?.features, surfaces: sgState.data?.features, communities: state.spatial?.dubaiPolygonData?.features});
  const shown = element => element && !element.hidden && !element.classList.contains('hidden') && getComputedStyle(element).display !== 'none' && getComputedStyle(element).visibility !== 'hidden';
  function measurePadding() {
    const container = map.getContainer().getBoundingClientRect(), width = container.width, height = container.height, rectangles = [];
    const mobile = matchMedia('(max-width:760px), (max-width:1024px) and (max-height:560px) and (pointer:coarse)').matches;
    for (const element of document.querySelectorAll('.topbar, .layer-rail, #tl-dock, .floating-panel, #detail, #ms-inspect, #se-panel, #mm-picker')) {
      if (!shown(element)) continue;
      const r = element.getBoundingClientRect();
      const rect = {left: r.left - container.left, right: r.right - container.left, top: r.top - container.top, bottom: r.bottom - container.top, width: r.width, height: r.height};
      const side = element.matches('.topbar') ? 'top' : element.id === 'tl-dock' || (mobile && !element.matches('.layer-rail')) ? 'bottom' : element.matches('.layer-rail') ? (mobile ? 'bottom' : 'left') : rect.left + rect.width / 2 < width / 2 ? 'left' : 'right';
      rectangles.push({rect, side});
    }
    return K.padding({width, height}, rectangles);
  }
  function withoutLegacyCamera(action) {
    // Rendering the existing dossier is preserved, but its synchronous fixed-padding
    // camera calls cannot race the measured search camera below.
    const originals = new Map();
    for (const name of ['easeTo', 'flyTo', 'jumpTo', 'fitBounds', 'setPadding']) if (typeof map[name] === 'function') {
      originals.set(name, map[name]);map[name] = () => map;
    }
    try { return action(); } finally { for (const [name, fn] of originals) map[name] = fn; }
  }
  function releaseCamera() {clearTimeout(releaseTimer);releaseTimer = 0;cameraOwner = null;}
  function cameraDiagnostic(event) {
    const diagnostic=window.__ESPACIOS_SEARCH_FOCUS__;if(!diagnostic)return;
    const center=map.getCenter?.();
    diagnostic.actualCamera={center:center?[center.lng,center.lat]:null,zoom:map.getZoom?.()??null,pitch:map.getPitch?.()??null,padding:map.getPadding?.()||null};
    diagnostic.events=[...(diagnostic.events||[]),event].slice(-8);
  }
  function cancelFocus(reason='new-search') {++sequence;cancelAnimationFrame(pending);pending = 0;releaseCamera();if(window.__ESPACIOS_SEARCH_FOCUS__){window.__ESPACIOS_SEARCH_FOCUS__.status='cancelled';cameraDiagnostic(typeof reason==='string'?reason:reason.type||'user-navigation');}}
  // Legacy detail observers schedule padding-only and 3D pitch-only transitions.
  // Those must not replace a search flight halfway through. Explicit navigation
  // and real canvas gestures always release ownership immediately.
  for (const name of ['easeTo', 'flyTo', 'jumpTo', 'fitBounds', 'setPadding']) {
    const original = map[name];if (typeof original !== 'function') continue;
    map[name] = function(...args) {
      if (cameraOwner && !cameraOwner.applying) {
        const options = args[0] || {}, correction = name === 'setPadding' || (name !== 'fitBounds' && !('center' in options) && !('zoom' in options) && !('around' in options));
        if (correction) {cameraDiagnostic('ignored-legacy-'+name);return map;}
        cancelFocus('new-camera-destination');
      }
      return original.apply(this, args);
    };
  }
  for (const event of ['pointerdown', 'wheel', 'keydown']) map.getCanvas?.()?.addEventListener(event, cancelFocus, {capture: true, passive: true});
  for(const event of ['movestart','moveend'])map.on?.(event,()=>{if(cameraOwner)cameraDiagnostic(event);});
  function focusTarget(target, token) {
    cancelAnimationFrame(pending);
    // The first frame allows the selected detail sheet and virtual keyboard to
    // settle. The second reads their actual boxes, not their expanded defaults.
    pending = requestAnimationFrame(() => {
      if(token!==sequence)return;
      const panel=[Q('#ms-inspect'),Q('#detail')].find(shown);
      if(panel)window.EspaciosMobileUI?.activate(panel,true);
      pending = requestAnimationFrame(() => {
      pending = 0;if (token !== sequence || !target) return;
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const options = {padding: measurePadding(), duration: reduced ? 0 : 480, essential: false, pitch: state.is3d ? 50 : 0, bearing: 0};
      map.stop();
      cameraOwner = {token, applying: true};
      window.__ESPACIOS_SEARCH_FOCUS__.status = 'focusing';
      try {
        // MapLibre 6.8 subtracts transform.padding AND fitBounds.padding. Apply
        // the measured inset once globally; passing it twice yields a negative
        // viewport and a silent no-op on narrow/mobile layouts.
        map.setPadding(options.padding);
        if (target.bounds) {
          const fitOptions={...options,padding:0,maxZoom:target.maxZoom,linear:true};
          if(typeof map.cameraForBounds==='function'&&!map.cameraForBounds(target.bounds,fitOptions))throw Error('Exact boundary could not fit the visible map viewport.');
          map.fitBounds(target.bounds,fitOptions);
        }
        else map.easeTo({...options, center: target.center, zoom: target.zoom});
        cameraDiagnostic('camera-requested');
      } catch(error) {
        window.__ESPACIOS_SEARCH_FOCUS__.status='fit-unavailable';window.__ESPACIOS_SEARCH_FOCUS__.error=error.message;cameraDiagnostic('fit-unavailable');releaseCamera();
      } finally {
        if (cameraOwner?.token === token) cameraOwner.applying = false;
        if(cameraOwner?.token===token)releaseTimer = setTimeout(() => {if (cameraOwner?.token === token) {releaseCamera();window.__ESPACIOS_SEARCH_FOCUS__.status = 'settled';cameraDiagnostic('settled');}}, options.duration + 120);
      }
      // Existing map moveend listeners reconcile 3D layers. Calling their pitch
      // transition here would cancel this just-started center/bounds movement.
    });});
  }
  async function resolveAndFocus(entry, token) {
    const record = entry.record, diagnostic = {status: 'resolving', targetBasis: null, recordName: entry.name || (record ? recordTitle(record) : ''), token};
    window.__ESPACIOS_SEARCH_FOCUS__ = diagnostic;
    if (record?.kind === 'community' && !sgState.data && typeof sgLoad === 'function') {
      try {await sgLoad();} catch { /* Retain only this record's existing coordinates if source loading fails. */ }
      if (token !== sequence) return false;
    }
    const target = K.target(entry, sourceGeometry());
    if (token !== sequence) return false;
    Object.assign(diagnostic, {status: target ? 'ready' : 'unlocated', targetBasis: target?.basis || null, ...(target?.center ? {center: target.center} : {}), ...(target?.bounds ? {bounds: target.bounds} : {})});
    if (target) focusTarget(target, token);
    else if (typeof toast === 'function') toast('Selected record retained. A verified map location is not available yet.');
    return !!target;
  }
  function focusRecord(record) {
    cancelFocus();const token = sequence;map.stop();return resolveAndFocus({type: 'record', record}, token);
  }
  function marketRows() {
    return [...(msState.data?.rows || []).map(row => ({name: row.community, emirate: row.emirate})), ...(tlState.series || []).map(row => ({name: row.geography, emirate: row.emirate || (ppActive() ? 'Dubai' : '')}))];
  }
  function synchronizeMarket(record) {
    if (!msVisible()) return null;
    const area = K.marketArea(record, marketRows());
    if (!area) return null;
    const changed = msState.emirate !== area.emirate;
    msState.area = area.name;msState.emirate = area.emirate;msState.forecastNotice = false;
    // Keep project dossiers visible on a project search; an area search opens
    // the exact market inspector. Prices never become project-density or ROI.
    msState.open = record.kind === 'community';
    if (changed) msOpen(msState.kind, false);else msSync();
    if (msState.open) Q('#detail')?.classList.add('hidden');
    return area;
  }
  const previousRender = renderSearch;
  renderSearch = function() {
    const result = previousRender(...arguments), box = Q('#search-results');
    const options = [...(box?.querySelectorAll('[data-search-pos]') || [])];
    if (options.length && options.length === state.searchResults?.length) {
      state.searchResults = K.groupedEntries(state.searchResults, aeSearchKindLabel);
      options.forEach((button, index) => {button.dataset.searchId = String(state.searchResults[index].id);});
    }
    return result;
  };
  aeActivateSearchPosition = function(position) {
    const entry = state.searchResults?.[position];if (!entry) return;
    cancelFocus();const token = sequence, input = Q('#search'), box = Q('#search-results');
    map.stop();cancelAnimationFrame(pending);
    box?.classList.add('hidden');input?.setAttribute('aria-expanded', 'false');box?.replaceChildren();
    if (input) {input.value = entry.type === 'developer' ? entry.name : recordTitle(entry.record);input.blur();}
    let area = null;
    withoutLegacyCamera(() => {
      if (entry.type === 'developer') aeShowDeveloperSearch(entry);
      else if (entry.record) {
        showDetail(entry.record);
        if (typeof psrSetSelectedPoint === 'function') psrSetSelectedPoint(entry.record);
        area = synchronizeMarket(entry.record);
      }
    });
    resolveAndFocus(entry, token);
    const record = entry.record || {};
    document.dispatchEvent(new CustomEvent('espacios:search-selection', {detail: {id: entry.id, kind: record.kind || entry.type, name: entry.name || recordTitle(record), emirate: record.emirate || '', area: area?.name || (record.kind === 'community' ? record.name : record.area || ''), exactMarketMatch: !!area}}));
  };
  // Native keyboard activation of a result button emits click, not mousedown.
  Q('#search-results')?.addEventListener('click', event => {
    const button = event.target.closest?.('[data-search-pos]');if (!button) return;
    event.preventDefault();aeActivateSearchPosition(Number(button.dataset.searchPos));
  });
  window.EspaciosSearchFocus = Object.freeze({focusRecord, focusArea: area => focusRecord({kind: 'community', ...area}), measurePadding});
})();
