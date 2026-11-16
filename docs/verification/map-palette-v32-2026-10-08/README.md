# Map palette V32 — production receipt, 8 October 2026

## Release identity

- Frontend asset token: `20261008-map-palette-v32`
- Source commit: `9893a95d` (`Fix mobile map mode tint cascade`), open PR [#98](https://github.com/gugmaae-prog/espacios/pull/98)
- Cloudflare Worker: `psr-portfolio-map-v2`
- Worker version: `48aa90bd-02f8-4141-9dc5-8f64a00cb14b`
- Deployment: `c9bb3961-68a5-45b6-a93d-933e26ee99b0`, serving **100% traffic**
- Production route: `espacios.me/map*`, unchanged
- Data Room: `DATA_ROOM_PUBLIC=false`

## Change

The selected mobile Map mode had inherited a dark premium-shell treatment that stood out against the light Espacios surface. Its gold alias was legacy theme styling; it was not a price, appreciation, project-value, or forecast signal. V32 normalizes the selected control to the shared theme surface with a restrained slate outline, no shadow, and the existing selected label weight. The state remains distinct without the dark pill.

The change is visual only. It preserves map modes, timeline, map data, existing history, API behavior, keyboard and touch interaction, Worker bindings, route mapping, and the restricted Data Room.

## Verification

- `npm run verify` passed all **163 tests**; the production Wrangler dry run retained D1, R2, AI and `PSR_PROPERTY` bindings plus `DATA_ROOM_PUBLIC=false`.
- GitHub verification and public-repository safety checks passed for PR #98.
- Cloudflare Worker version `48aa90bd-02f8-4141-9dc5-8f64a00cb14b` serves 100% traffic in deployment `c9bb3961-68a5-45b6-a93d-933e26ee99b0`.
- Live `/map`, `/map/app-v2.js?v=20261008-map-palette-v32`, and `/map/app-v2.css?v=20261008-map-palette-v32` return HTTP 200. The HTML and JavaScript carry the V32 cache token; the injected style contains the V32 mode selector.
- A fresh Chrome run at **390 × 844** reached the ready state in light theme. The selected mode uses the same pale surface as the control, a muted slate border, and no shadow. A mobile screenshot was captured at `/tmp/espacios-v32-mobile.png`.
- `/map/api/record-history?recordId=community%3ADubai%3Apalm-jebel-ali` returns HTTP 200 and continues to report historical snapshot `20261008-enrichment-v28`.

The general browser-acceptance script still targets the older map readiness markers and timed out against the current map shell; the live route was instead checked in Chrome with a 390 × 844 device viewport and by direct HTTP/API checks.
