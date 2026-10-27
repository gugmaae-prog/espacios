# Map palette V33 — production receipt, 8 October 2026

## Release identity

- Frontend asset token: `20261008-map-palette-v33`
- Source commit: `340ddaf8c2d7` (`Unify mobile map selected states with Espacios palette`), open PR [#98](https://github.com/gugmaae-prog/espacios/pull/98)
- Cloudflare Worker: `psr-portfolio-map-v2`
- Worker version: `7d02ebd0-c127-46c7-a0bf-f540e54c07ec`
- Deployment: `b29b182c-1a40-49fd-a522-233a31b60465`, serving **100% traffic**
- Production route: `espacios.me/map*`, unchanged
- Data Room: `DATA_ROOM_PUBLIC=false`

## Change

The dark selected “Map” pill came from a legacy mobile rail with its own active-state styling. Gold was an inherited theme accent used by that older shell; it did not represent a real-estate metric or investment signal. V33 applies the same restrained Espacios slate tint, muted border and ink text to the newer map-mode selector, the legacy Map/3D control and the layer rail, including during hydration. The selected state remains visible without a dark pill, gold accent or shadow.

## Verification

- `node --test tests/minimal-map-ui.test.mjs tests/mobile-build.test.mjs`: **15 passed**.
- `node --check src/worker.js` passed; Wrangler production dry run retained D1, R2, AI, `PSR_PROPERTY` and `DATA_ROOM_PUBLIC=false`.
- Cloudflare deployment `b29b182c-1a40-49fd-a522-233a31b60465` assigns version `7d02ebd0-c127-46c7-a0bf-f540e54c07ec` **100% traffic**.
- Live `/map` returns HTTP 200 and serves V33 HTML, JavaScript and CSS cache tokens.
- Chrome at **390 × 844** hydrated the V33 map in both themes. In light mode the selected control computed to `rgb(248, 250, 252)` with ink `rgb(32, 48, 68)`, a subdued slate border and no shadow; dark mode retained its dark theme surface and pale ink.

The change is presentation-only. It preserves map modes, search, timeline, data, API behavior, keyboard and touch interaction, Worker bindings, route mapping and the restricted Data Room.
