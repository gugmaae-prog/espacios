# Map palette V34 — production receipt, 8 October 2026

## Release identity

- Frontend asset token: `20261008-map-palette-v34`
- Source branch: `data/history-v26-dld-project-register`, open PR [#98](https://github.com/gugmaae-prog/espacios/pull/98)
- Cloudflare Worker: `psr-portfolio-map-v2`
- Worker version: `455caa85-97a3-410c-8643-1f46ecca8a23`
- Deployment: `0af2802e-905b-465f-94de-7f7daec85c71`, serving **100% traffic**
- Production route: `espacios.me/map*`, unchanged
- Data Room: `DATA_ROOM_PUBLIC=false`

## Change

The high-contrast selected Map pill came from inherited premium-shell styling. Gold was an interface accent, not a property-value, appreciation, or forecast signal. V34 reduces the selected fill to a 2% theme-accent tint over the shared panel surface, with a muted border and no shadow, and applies the rule to the desktop map-mode selector, mobile Map/3D rail, and layer rail. It uses the existing Espacios light/dark theme tokens.

## Verification

- `node --test tests/minimal-map-ui.test.mjs tests/mobile-build.test.mjs` passed after V34.
- `npm run check` and Wrangler production dry run passed; bindings and route configuration remain unchanged.
- The live `/map` and `/map/app-v2.js` return HTTP 200 and include `20261008-map-palette-v34`.
- The desktop was locked during this release, so a live screenshot and computed-color check were unavailable. The production CSS and cache token were verified over HTTP; rerun desktop and 390-pixel mobile visual acceptance when the desktop is unlocked.

The change preserves selection behavior, map modes, keyboard/touch operation, and data/API behavior. Gold has no analytical meaning.
