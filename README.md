# Espacios Platform Source Authority

> **Repository status — 24 September 2026**
>
> This is a **public source repository**. Never commit credentials, customer/lead data, private CRM exports, OAuth tokens, Supabase service-role keys, Cloudflare API tokens, or other secrets.
>
> **Current scope:** the repository is authoritative for the Espacios UAE Intelligence Map and its supporting source. It is **not yet a complete source mirror of every production surface on `espacios.me`**. Cloudflare production should not be switched to GitHub-driven automatic deployment for the entire domain until the remaining live application source is reconciled.
>
> **Tenant boundary:** Espacios remains separate from Haus & Grace and PSR Homes. Shared public catalogue/intelligence data may be reused deliberately, but private leads, CRM records, staff data, messages, agent memory, and credentials must not cross tenant boundaries.
>
> See [the platform audit](docs/platform-audit-2026-09-24.md) and [security policy](SECURITY.md).

This package is the verified source for the site-aligned navigation, performance, 3D, and media release active at `https://espacios.me/map`. Cloudflare Worker version `112` was deployed at 100% on 21 September 2026 UTC after live dark/light visual, search, 3D, fixed-interface, mobile, catalogue-media, and asset acceptance.

## What changed

- Isolated scroll, trackpad-pinch, and touch-pinch gestures to the map camera. The top bar, left rail, and information cards remain at fixed CSS-pixel dimensions while the map zoom changes.
- Replaced the temporary AE mark with the official Espacios HD PNG wordmark.
- Aligned the complete map shell to `espacios.me`: its exact light/dark colour tokens, 22-pixel Liquid Glass framing, system typography, indigo/lavender accents, pill controls, quiet borders, and responsive spacing.
- Added the same `espacios_theme_v1` preference used by the main site, with accessible light/dark radio controls and the correct dark or white official wordmark for each theme.
- Renamed the visible assistant surface to **Espacios AI** and restyled project details, verification evidence, drive-time cards, search results, help, and MapLibre controls for consistent contrast in both themes.
- Made search selection deterministic after detail-panel layout: exact projects jump to building scale and pitch into 3D without the dock-padding race cancelling the camera move.
- Enabled 3D by default while retaining lazy loading: the camera automatically pitches to 54° and loads real building extrusions only after the user reaches city scale.
- Fixed the earlier browser freeze: a mobile-sheet `MutationObserver` updated the same subtree it observed, retriggering itself continuously and saturating Chrome's main thread.
- Reduced initial map work to 85 layers and 19 sources. Universal spatial geometry, full emirate geometry, Places, Transport, and 3D buildings now load only when the user asks for them or reaches the relevant zoom.
- Throttled hover queries, deferred search indexing until first use, and parallelized deep-data hydration.
- Added a dedicated **Map focus** mode, visible navigation help, keyboard pan/zoom/reset controls, and dependable drag, wheel, pinch, and touch behavior.
- Added mobile focus behavior, 44-pixel controls, reduced-motion handling, a skip link, a focusable map region, live announcements, and synchronized control state.
- Moved MapLibre imports to `/map/vendor/*`, backed by R2 and Cloudflare edge caching.
- Rewrote all 1,392 unique project, community, and initiative image references through the same-origin `/map/media` route, pre-warmed the complete catalogue, and verified 1,392/1,392 responses as Cloudflare R2 hits.
- Replaced the catalogue's one dead upstream image for **Sobha Hartland Villas Plots** with its valid matching Creatium asset. The Worker normalizes both the stored data snapshot and any older cached request for the broken URL.
- Kept OpenFreeMap's tiles, fonts, and sprites on its own Cloudflare-backed CDN; these global basemap assets are not map-owned catalogue media and are intentionally not duplicated into the Espacios R2 bucket.
- Added on-demand Places/Transport loading with retry status and cache-aware Worker responses.
- Normalized app-added map labels to OpenFreeMap's available Noto font stack, eliminating a repeated glyph 404.
- Removed the temporary token-gated Azizi upload route and its source-embedded credential.

## Live performance evidence

- Worker startup: `2 ms`.
- First Contentful Paint: `508 ms`.
- DOM interactive: `389 ms`; DOM complete/load: `647 ms`.
- HTML response start/end: `239 ms` / `245 ms`.
- Initial document transfer: `18,222 bytes` compressed over HTTP/3.
- Catalogue pre-warm covered `1,392` unique media references (`594,480,627` declared source bytes); the post-warm verification returned `R2-HIT` for every reference.

## Release record

- Worker: `psr-portfolio-map-v2`
- Version: `112` — `2743f633-6499-4080-bd3d-ca049989b22f`
- Deployment: `ad3b2312-81a7-416b-a857-a69a5e52cb9d`
- Zero-traffic smoke deployment: `b30c954f-c7ff-408c-8f78-c008cca02e20`
- Immediate predecessor: `111` — `3246300b-e766-4ee1-b0fb-0f1753ce95b5`
- Known-stable navigation rollback: `109` — `cbecca0c-4b89-4091-8e3d-d799afa5e749`
- Live routes: `espacios.me/map*` and `psr.espacios.me/map*`

The release inherited and re-verified the existing `AI`, `DB`, `MARKET_R2`, and `PSR_PROPERTY` bindings. Compatibility date, `nodejs_compat`, and the standard usage model were unchanged.

## Project guide

- `src/worker.js` — deployed Worker source with editable assets embedded.
- `src/assets/` — editable HTML, CSS, JavaScript, verification data, and premium overlays.
- `tests/smoke.mjs` — route, accessibility, caching, security-boundary, and response checks.
- `scripts/browser-acceptance.mjs` — Chrome desktop/mobile interaction and synthetic performance acceptance.
- `scripts/debug-startup.mjs` — targeted startup debugger used to isolate main-thread loops.
- `CANDIDATE_SNAPSHOT.json` — release metadata, validation results, and checksums.
- `PRODUCTION_SNAPSHOT.json` — read-only pre-release baseline.
- `VERIFICATION.md` — performed checks and live evidence.
- `docs/architecture.md` — request flow and release topology.

## Verify locally

Use Node.js 22 or newer:

```sh
npm ci
npm run assets:embed
npm run verify
npm run cf:dry-run
```

For browser acceptance:

```sh
npx wrangler@4.135.0 dev --local --ip 127.0.0.1 --port 8792
npm run browser:acceptance
```

Set `AE_MAP_URL=https://espacios.me/map` to run the same matrix against production.

## Deployment safety

`wrangler.jsonc` deliberately retains the non-production name `psr-portfolio-map-v2-navigation-candidate` and declares no routes, preventing an accidental ordinary Wrangler deploy from replacing production. The production release was performed explicitly through Cloudflare's Versions and Deployments API with strict binding inheritance.

The previous production version remains available for rollback. Do not attach production routes to the candidate manifest or exercise data-mutation endpoints during local testing without separate authorization.
