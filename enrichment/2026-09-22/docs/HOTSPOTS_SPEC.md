# Emerging investment hotspots — Espacios UAE map

## Goal
Add an **Emerging hotspots** capability so the map can identify future investment hotspots (not just current heat).

Canonical production today: https://espacios.me/map
Worker name: psr-portfolio-map-v2
Current UI release header seen live: `20260922-auditfix-v13`

## Attached uploads
- `uploads/.../app-v2.js` — live frontend (MapLibre)
- `uploads/.../app-v2.css` — live styles
- `uploads/.../index.html` — live shell (may be Worker-rendered HTML)
- `uploads/.../map-core.json` — catalogue snapshot
- `uploads/.../hotspots-v0.json` — precomputed emerging_hotspot scores

## Product requirements
1. Serve `GET /map/api/hotspots` returning JSON shaped like hotspots-v0.json (or a cleaned GeoJSON FeatureCollection derived from it). Include disclaimer: indicative signal, not investment advice.
2. Also serve static `GET /map/hotspots.json` for cache-friendly fetch if that fits existing patterns better (`/map/map-core.json` style).
3. In the map UI (Analyze / Value / layer rail — pick the natural existing panel), add an **Emerging hotspots** toggle that:
   - Fetches the hotspots payload
   - Draws community/area markers or choropleth using existing community polygons when names match
   - Colors by band: emerging_hotspot / watchlist / monitor
   - On click, shows score, drivers, future pipeline metrics, confidence
4. Do **not** invent building footprints. Do not remove existing features.
5. Keep accessibility and theme-aware styling consistent with current Espacios chrome.
6. Mark release string in headers/UI as something like `20260922-hotspots-v1` when ready.

## Scoring model already computed (do not silently change weights without documenting)
Pipeline future share + catalyst tags + ROI/coverage gap − maturity − centroid-fallback confidence penalty.
Top emerging: Emaar South, Dubai Islands, Dubai Maritime City, Al Marjan Island, Dubai South, Dubailand, UAQ/Siniya belt.

## Constraints
- Original `src/worker.js` was blocked on the author's machine (iCloud dataless). Reconstruct a minimal Worker router that can serve the embedded assets + hotspots API, OR patch the provided frontend and document the exact Worker route snippet the human must merge into `psr-portfolio-map-v2`.
- Prefer a clean PR: frontend layer + `data/hotspots-v0.json` + Worker route fragment + README section on how to `npm run assets:embed` and Cloudflare Versions promote (zero traffic → verify → 100%).
- Do not commit secrets. Do not enable Rocket Loader. Do not call map.setStyle() for theme.

## Done when
- `/map/api/hotspots` (or `/map/hotspots.json`) returns the scored areas
- UI toggle visible and usable
- README/handover notes for release + rollback
- Clear list of files changed and any manual merge needed for production Worker bindings (AI, D1, R2 MARKET_INTEL, PSR_PROPERTY service binding)
