# Espacios UAE Intelligence Map — Full-Stack Handover

Last verified: 22 September 2026, Asia/Dubai  
Canonical production URL: <https://espacios.me/map>  
Local project root: `/Users/keifferjapeth/Documents/Codex/2026-09-19/cloudflare-plugin-dev-6aad368491c481918f56ee1ec8955165-created-by/outputs/espacios-map-navigable-v2`

This is the canonical handover for the currently deployed map. It supersedes the older v10 release metadata still present in `README.md`, `VERIFICATION.md`, and the existing smoke-test assertions.

## 1. Current production state

| Item | Current value |
|---|---|
| Product | Espacios UAE Intelligence Map |
| Canonical URL | `https://espacios.me/map` |
| Cloudflare Worker | `psr-portfolio-map-v2` |
| Application release marker | `20260921-seamless-v12` |
| Cloudflare version UUID | `5e6422af-061b-4b81-ab1c-8b7998358570` |
| Production deployment UUID | `62177d9c-9ce6-4987-8127-19dfaa2c3844` |
| Production traffic | 100% to the version above |
| Deployment time | 21 September 2026 at 14:08:58 UTC |
| Compatibility date | `2026-08-20` |
| Compatibility flag | `nodejs_compat` |
| Usage model | `standard` |
| Current catalogue snapshot | 1,337 projects and 215 communities |

Do not confuse the application marker `seamless-v12` with the older Cloudflare numeric Worker version `112` documented in `README.md`. The UUID and deployment UUID in the table above are the authoritative production identifiers.

`https://psr.espacios.me/map` is not the canonical map URL. At handover time it returns a `301` redirect to `https://ae.espacios.me/`.

## 2. User-visible release scope

The current production release includes:

- The official Espacios wordmark and an interface aligned with `espacios.me`.
- Light and dark themes for both the interface and the semantic map style—not only the surrounding cards.
- Theme-aware land, water, roads, parks, labels, boundaries, markers, clusters, territories, selection states, and 3D buildings.
- Theme changes applied in place, avoiding a destructive `map.setStyle()` reload that would discard custom data sources and layers.
- Fixed-size navigation, tabs, side panels, and cards while wheel, trackpad, pinch, and control zoom change only the map camera.
- Deterministic project search that opens the selected record and moves to building scale, normally zoom `15.2`.
- Real MapLibre 3D building extrusion at city/building scale.
- Keyboard navigation, map-focus mode, accessible labels, live announcements, reduced-motion behavior, and mobile touch targets.
- Deferred deep-data hydration so large map and verification datasets do not block the first interaction.
- An idempotent building-footprint update path with the former `idle` feedback loop removed.
- Reuse of the existing OpenMapTiles vector source instead of downloading a second building vector source.
- Espacios AI, market history/forecast, valuation evidence, unit inventory, places, transport, route summaries, spatial boundaries, and project/community exploration.

Some catalogue projects still have area-level coordinates rather than an exact surveyed footprint. They remain searchable and selectable, but may show a point/area selection state until an exact building polygon is matched. Never invent a building footprint to make the 3D selection appear exact.

## 3. System architecture

```text
Browser
  |
  v
Cloudflare Worker: psr-portfolio-map-v2
  |-- embedded HTML/CSS/JavaScript and verification assets
  |-- Cloudflare edge cache
  |-- semantic OpenFreeMap basemap proxy
  |-- R2 snapshot and write-through media/vendor delivery
  |-- D1 market, valuation, comparable, history, and unit queries
  |-- Workers AI response generation
  `-- service binding to psr-property for project/API data
```

### Cloudflare bindings

| Binding | Type | Target |
|---|---|---|
| `AI` | Workers AI | Account AI catalogue |
| `DB` | D1 | `a5165cff-70a5-4685-af87-5ffdcf08652a` |
| `MARKET_R2` | R2 bucket | `psr-market-intelligence` |
| `PSR_PROPERTY` | Service binding | `psr-property`, production environment |

Cloudflare account ID: `b1b843ec85bc39a3a4d370ba4f84f17a`.

### Data and media flow

- `/map/map-core.json` serves the fast first-interaction snapshot. The current response identifies itself as `x-ae-data-source: r2-core-snapshot`.
- `/map/map-data.json` serves the deeper catalogue snapshot from R2 and hydrates after the initial map is interactive.
- `/map/media?url=...` is an HTTPS-only, allowlisted, R2-backed media path. A cache miss retrieves an allowed upstream asset and stores it for subsequent delivery.
- `/map/vendor/*` serves MapLibre assets from R2/edge cache, with upstream retrieval only when the stored copy is missing.
- `/map/basemap/*` proxies and caches OpenFreeMap assets and transforms the style into the Espacios light or dark semantic palette.
- OpenFreeMap tiles, glyphs, and sprites remain basemap-provider assets. They are intentionally not treated as Espacios-owned catalogue media.
- D1 supplies published market observations, forecasts, valuation samples/evidence, comparable evidence, fact history, and inventory units.
- `PSR_PROPERTY` supplies project data without a public network round trip between Workers.

## 4. Important routes

### Application and static assets

- `GET /map`
- `GET /map/app-v2.css`
- `GET /map/app-v2.js`
- `GET /map/verification.json`
- `GET /map/vendor/*`

### Catalogue and contextual data

- `GET /map/map-core.json`
- `GET /map/map-data.json`
- `GET /map/amenities.json`
- `GET /map/transport-network.json`
- `GET /map/api/projects-batch`
- `GET /map/api/projects-all`

### Spatial and navigation data

- `GET /map/spatial/emirates-lite.geojson`
- `GET /map/spatial/emirates.geojson`
- `GET /map/spatial/master-territories.geojson`
- `GET /map/spatial/dubai-communities.geojson`
- `GET /map/spatial/official.geojson`
- `GET /map/api/route-summary`
- `GET /map/api/route`

### Intelligence APIs

- `GET /map/api/market-series`
- `GET /map/api/market-coverage`
- `GET /map/api/market-forecast`
- `GET /map/api/valuation-samples`
- `GET /map/api/valuation-evidence`
- `GET /map/api/units`
- `POST /map/api/ai`

### Media and basemap

- `GET /map/media?url=<encoded-https-url>`
- `GET /map/basemap/*`

All other Worker paths return `404`.

## 5. Local source map

| Path | Responsibility |
|---|---|
| `src/worker.js` | Cloudflare Worker router, bindings, edge cache, API logic, media proxy, basemap proxy, and embedded production assets |
| `src/assets/index.html` | Editable application shell and early theme bootstrap |
| `src/assets/app-v2.css` | Primary Espacios map UI, responsive, accessibility, and theme styles |
| `src/assets/app-v2.js` | MapLibre application, search, layers, 3D, UI state, theme behavior, hydration, and analytics panels |
| `src/assets/premium.css` | Additional premium shell styling embedded into the Worker |
| `src/assets/premium.js` | Additional premium shell behavior embedded into the Worker |
| `src/assets/verification.json` | Verification metadata packaged with the application |
| `scripts/embed-assets.mjs` | Gzip-embeds editable assets back into `src/worker.js` |
| `scripts/extract-assets.mjs` | Extracts embedded assets for editing/recovery |
| `scripts/browser-acceptance.mjs` | Desktop/mobile browser acceptance suite |
| `scripts/debug-startup.mjs` | Targeted startup and main-thread debugging |
| `tests/smoke.mjs` | Static Worker smoke assertions; currently stale—see Known Issues |
| `wrangler.jsonc` | Safe candidate Worker manifest; deliberately not the production route owner |
| `PRODUCTION_SNAPSHOT.json` | Older pre-release snapshot, not the current deployment record |

The Worker embeds the editable frontend assets. Editing only `src/assets/*` is not enough for a release; run the embed step before compiling or uploading the Worker.

## 6. Local setup

Use Node.js 22 or newer.

```sh
cd /Users/keifferjapeth/Documents/Codex/2026-09-19/cloudflare-plugin-dev-6aad368491c481918f56ee1ec8955165-created-by/outputs/espacios-map-navigable-v2
npm ci
npm run assets:embed
node --check src/worker.js
node --check src/assets/app-v2.js
npm run cf:dry-run
```

Local Worker preview:

```sh
npx wrangler@4.135.0 dev --local --ip 127.0.0.1 --port 8792
```

Browser acceptance against production:

```sh
AE_MAP_URL=https://espacios.me/map npm run browser:acceptance
```

Bindings such as D1, R2, Workers AI, and the service binding are not automatically equivalent in a local-only preview. A successful static local page is not proof that the production data paths work.

### macOS/iCloud file-offloading warning

This project is stored under `Documents`, and macOS may mark files as `compressed,dataless`. Check before building:

```sh
ls -lO package.json wrangler.jsonc src/worker.js src/assets/index.html src/assets/app-v2.js
```

If a required file is `dataless`, download/materialize it through Finder/iCloud or try `brctl download <path>` and verify the flag is gone before reading, patching, embedding, or deploying. Never deploy after a command has stalled on an unmaterialized placeholder.

## 7. Safe change workflow

1. Confirm the active local project path and inspect any unrelated edits.
2. Materialize all required source/configuration files.
3. Edit the source asset in `src/assets/*` or the Worker logic in `src/worker.js`.
4. Run `npm run assets:embed` after every frontend-asset change.
5. Run JavaScript syntax checks and the updated smoke suite.
6. Run the Wrangler dry run and inspect the declared bindings.
7. Upload a version to `psr-portfolio-map-v2` while preserving all four production bindings, the compatibility date, and `nodejs_compat`.
8. Create a zero-traffic deployment for smoke testing.
9. Verify the candidate directly and compare its bindings with production.
10. Promote the verified version to 100% traffic.
11. Verify the live HTML, immutable JS, R2 snapshot, one R2 media object, both semantic themes, search, fixed-interface zoom, and 3D.
12. Record the final version and deployment UUIDs in this file.

`wrangler.jsonc` intentionally uses a candidate name and declares no production routes. Do not add the production routes to that manifest or assume an ordinary `wrangler deploy` updates the live Worker. Production releases have been performed with the Cloudflare Versions and Deployments workflow and explicit binding inheritance.

## 8. Release verification

### Live headers checked on 22 September 2026

The canonical page returned:

```text
HTTP 103 Early Hints
HTTP 200
x-ae-navigation: 20260921-seamless-v12
x-psr-map-ui: espacios-seamless-v12
x-psr-map-version: 2026-09-17-edgeassets-live-v1
alt-svc: h3=":443"
```

The immutable application JavaScript returned:

```text
cache-control: public, max-age=31536000, immutable
x-espacios-performance: idle-loop-removed;vector-source-reused;hydration-deferred
x-psr-map-navfix: 20260921-seamless-v12
x-psr-map-navfix-count: 15
```

The current R2 core snapshot returned:

```text
projects: 1337
communities: 215
x-ae-data-source: r2-core-snapshot
cache-control: public,max-age=300,s-maxage=1800,stale-while-revalidate=7200
```

Current semantic basemap colors:

| Theme | Land | Water | Buildings |
|---|---|---|---|
| Light | `#e8edf6` | `#cbd8ec` | `#d0d8e6` |
| Dark | `#0d1320` | `#121c2f` | `#2d374a` |

Release acceptance also confirmed:

- The top bar, rail, and information panels retained identical CSS-pixel rectangles while the map zoom changed.
- Searching for Avenue Park Towers II moved to zoom `15.2`, opened its detail record, and displayed surrounding 3D buildings.
- The footprint resolver settled without the former continuous idle/render loop.
- A live catalogue image returned `x-ae-asset-cache: R2-HIT` with an image content type.
- Light and dark mode changed the rendered basemap, not only the HTML interface.
- No new console errors appeared during the final v12 Chrome acceptance pass.

Previously recorded performance evidence—useful as a release comparison, not an SLA:

- Worker startup: approximately `2 ms`.
- First Contentful Paint: `508 ms`.
- DOM interactive: `389 ms`.
- DOM complete/load: `647 ms`.
- Initial HTML transfer: `18,222` compressed bytes in the recorded HTTP/3 run.

## 9. Known issues and cautions

1. **The existing smoke assertions are stale.** `node tests/smoke.mjs` currently fails at `tests/smoke.mjs:24` because it expects `premium-20260920-v4` while the source correctly returns `espacios-seamless-v12`. Update all old v4 asset keys, headers, patch counts, and marker assertions before using `npm run verify` as a release gate.
2. **The older README release record is stale.** It describes the previous v10/Worker-112 release (`2743f633-...`), not the current production version.
3. **Some documentation/configuration files may be iCloud placeholders.** Verify materialization before build or deploy.
4. **The HTML Early Hints response currently preloads the CSS.** The final `200` Link header also advertises the module assets. Do not claim JavaScript was included in the `103` response unless a fresh trace proves it.
5. **The CSS cache key still contains `20260920-3d-zoom-v4`.** That is acceptable while the bytes are unchanged. Any CSS change requires a new immutable cache key.
6. **Exact 3D selection depends on footprint evidence.** Area-level projects must remain labelled/handled as area-level rather than being snapped to an invented building.
7. **Do not replace the theme by calling `map.setStyle()` without rebuilding all custom sources/layers.** The current release intentionally recolors the loaded semantic style in place.
8. **Do not enable Rocket Loader for this app.** The MapLibre module bootstrap and deterministic load order should remain untouched.
9. **Do not treat an R2 upload alone as a completed media migration.** Confirm catalogue references route through `/map/media`, the Worker serves the stored object, and production returns an R2-hit header.

## 10. Rollback information

Current production:

- Version: `5e6422af-061b-4b81-ab1c-8b7998358570`
- Deployment: `62177d9c-9ce6-4987-8127-19dfaa2c3844`

Immediate predecessor with the seamless theme/render-path changes:

- Version: `c13a9c26-2291-468d-ab03-702ce8ea5ba3`
- Deployment: `993ee149-eb22-4821-b37a-f2fa1cd00512`
- Caveat: this version predates the final cleanup of missing basemap sprite references.

Older verified navigation/media fallback:

- Version: `2743f633-6499-4080-bd3d-ca049989b22f`
- Deployment: `ad3b2312-81a7-416b-a857-a69a5e52cb9d`

Rollback should be performed as a new Cloudflare deployment assigning 100% traffic to the selected existing version. After rollback, recheck all bindings, the canonical URL, search, theme, R2 data/media, and 3D behavior. A version existing in Cloudflare is not proof that it is receiving traffic.

## 11. Minimum acceptance checklist for the next release

- [ ] `/map` returns `200` from the intended version.
- [ ] HTML headers contain the new release marker and correct asset keys.
- [ ] Light mode changes both the UI and the actual map palette.
- [ ] Dark mode changes both the UI and the actual map palette.
- [ ] Wheel, trackpad, pinch, and controls zoom only the map.
- [ ] Top bar, rail, tabs, and cards remain fixed in CSS pixels during zoom.
- [ ] Drag, keyboard navigation, reset, and map-focus mode work.
- [ ] Exact project search opens details and reaches building scale.
- [ ] 3D buildings appear at the intended zoom without a render loop.
- [ ] Core data reports the expected project/community counts.
- [ ] Deep data hydrates after the first interaction rather than blocking it.
- [ ] One catalogue image returns an R2-hit header.
- [ ] Market, valuation, unit, route, Places, Transport, and AI panels fail gracefully if a dependency is unavailable.
- [ ] Desktop and mobile browser acceptance passes.
- [ ] No new console errors or missing sprite/glyph warnings appear.
- [ ] Candidate and production binding manifests match exactly.
- [ ] Final deployment UUID and version UUID are recorded here.

## 12. Security and ownership boundaries

- No production secret should be committed to this project.
- The removed temporary upload/admin route must remain absent.
- Media fetching must remain HTTPS-only and host-allowlisted.
- D1/R2 writes or catalogue migrations require explicit authorization and post-write production verification.
- The UAE intelligence map is an Espacios-owned product surface. Tenant-specific applications may consume its controlled APIs/data but should not silently become the canonical owner of the map.

