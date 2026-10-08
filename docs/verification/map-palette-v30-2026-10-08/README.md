# Map palette V30 — production receipt, 8 October 2026

## Release identity

- Frontend asset token: `20261008-map-palette-v30`
- Source patch: `b75779e4` (`Soften mobile map mode selection`), open PR [#98](https://github.com/gugmaae-prog/espacios/pull/98)
- Cloudflare Worker: `psr-portfolio-map-v2`
- Worker version: `c2617bf6-434d-4857-9445-0abd01b1a943`
- Deployment: `1d38e324-aa28-49ee-8151-e29af8cdae8f`, serving **100% traffic**
- Production route: `espacios.me/map*`, unchanged
- Data Room: `DATA_ROOM_PUBLIC=false`

## Change

The attached mobile Map control showed a dark, high-contrast selected pill on a light surface. V30 normalizes the selected state across the legacy and current controls, including active, `aria-pressed`, `aria-current` and `aria-selected` signals. The selected mode now uses the same theme surface as the surrounding control, a quiet slate border, and no shadow. The button retains its selected label weight and existing keyboard and touch behavior.

Gold was inherited premium-shell styling. It did not encode price, appreciation, project value or a forecast. This patch only changes the mobile mode control and its frontend cache token; it does not change Map data, the V28 history snapshot, bindings, routes, or the restricted Data Room.

## Verification

- `npm run verify` passed all **163 tests**; the three focused mobile/map UI suites passed all **25 tests**.
- GitHub CI for PR #98 passed, including immutable history rebuild, `npm run verify`, and the production Wrangler dry run.
- The production Wrangler dry run retained the existing D1, R2, AI and `PSR_PROPERTY` bindings plus `DATA_ROOM_PUBLIC=false`.
- Live `/map`, `/map/app-v2.js?v=20261008-map-palette-v30`, and `/map/app-v2.css?v=20261008-map-palette-v30` returned HTTP 200; HTML and JavaScript carry V30 response markers.
- `/map/api/record-history?recordId=community%3ADubai%3Apalm-jebel-ali` remains HTTP 200 and reports V28, confirming the visual release retained the published evidence.
- Wrangler reports version `c2617bf6-434d-4857-9445-0abd01b1a943` at 100% traffic in deployment `1d38e324-aa28-49ee-8151-e29af8cdae8f`.

The CSS selector and theme-surface behavior are covered by automated tests. A fresh device screenshot with computed color sampling was not captured for this deployment.
