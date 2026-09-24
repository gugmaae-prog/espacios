# Espacios map navigation and 3D v4 architecture

This source is deployed as Cloudflare Worker version `105` for `psr-portfolio-map-v2`.

## Request flow

1. Cloudflare routes `espacios.me/map*` and `psr.espacios.me/map*` to `psr-portfolio-map-v2`.
2. The Worker serves embedded HTML, CSS, JavaScript, and verification data.
3. `/map` injects the premium/navigation overlays and stamps v4 response markers.
4. `/map/app-v2.js` applies three preserved legacy hot-path substitutions before serving the embedded module.
5. The browser imports MapLibre from `/map/vendor/*`; the Worker checks edge cache, then R2, then controlled upstream fallbacks.
6. The initial UAE view installs 85 layers and 19 sources. Spatial interaction layers hydrate at city scale, full emirate geometry at zoom 10.5, and Places/Transport only when selected. 3D mode starts enabled, but its vector tiles remain deferred until zoom 9.7; crossing that threshold automatically pitches the camera and reveals building extrusions.
7. Large context responses use browser caching plus Cloudflare cache controls; D1, R2, the `psr-property` service, Workers AI, and public geospatial sources remain behind the Worker.

## Interaction ownership

- MapLibre owns pointer, touch, ordinary wheel, double-click, and box-zoom behavior.
- The application captures Chromium's `ctrl+wheel` trackpad-pinch gesture at the map workspace boundary, prevents browser viewport scaling, and applies the delta to the map camera. Map and canvas touch-action isolation gives mobile pinch the same ownership.
- The top bar, layer rail, and cards remain fixed-position DOM surfaces outside the isolated map rendering boundary.
- The focusable `#map` region owns keyboard pan, zoom, reset, focus exit, and help shortcuts. MapLibre's parallel keyboard handler is disabled to prevent doubled movement.
- Search builds its index only on first use and owns result keyboard navigation.
- Map focus mode changes interface visibility and map padding without discarding map state.
- Resize and panel observers are guarded so callbacks do not mutate their own observed state repeatedly.

## Binding topology

| Binding | Live resource | Responsibility |
| --- | --- | --- |
| `DB` | D1 `cba-property-db` | Market, inventory, and valuation queries |
| `MARKET_R2` | R2 `psr-market-intelligence` | Snapshots, media, geometry, and vendor assets |
| `PSR_PROPERTY` | Service `psr-property` production | Full project/property data |
| `AI` | Workers AI | Map AI endpoint |

The release inherited these bindings strictly from version `104`; compatibility date `2026-08-20`, `nodejs_compat`, and the standard usage model were preserved.

## Editable and embedded assets

The Worker stores four gzip/base64 assets and two premium overlays. Human-editable copies live under `src/assets/`.

- `npm run assets:extract` regenerates editable files from `src/worker.js`.
- `npm run assets:embed` rebuilds the bundle from editable files.
- `npm run verify` checks syntax and self-contained response paths.
- `npm run browser:acceptance` validates desktop/mobile navigation and records screenshots plus synthetic timing evidence.

## Remaining debt

- The single-file Worker still combines application code, data access, proxies, caching, and asset delivery.
- Three legacy navigation substitutions still run when serving `app-v2.js`; they should eventually be folded into the editable asset and removed from response generation.
- The amenities registry is about 4.49 MB. It is deferred and cached, but should ultimately be split by viewport or category.
- Long-term performance decisions should use field RUM or a formal trace series rather than one synthetic run.
