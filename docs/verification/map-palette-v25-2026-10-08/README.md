# Espacios map palette V25 — 8 October 2026

## What changed

V25 applies the same Espacios selected state to the map mode buttons, map
navigation rail, mobile 3D control and focus-map button. Active controls now use
the theme-aware panel surface, dark slate text in light mode, light text in dark
mode, a quiet slate border and a narrow slate underline. The transition is
short and consistent across these controls.

Gold came from the inherited premium-shell selection and fallback styles. It
was a UI highlight, never a property-price or appreciation signal. The map
keeps its separate price, rent, transaction-volume, forecast and density colors
with their existing meanings.

This is a presentation-only change. It does not modify catalogue records,
historical observations, source evidence, event links or forecast data.

## Verification

- `npm run verify` passed, including all 166 repository tests.
- `npm run cf:dry-run` passed for `wrangler.production.jsonc`; the existing D1,
  R2, service and AI bindings were retained.
- [PR #83](https://github.com/gugmaae-prog/espacios/pull/83) merged as
  `56838c40cf5427de29de9cd0f6881f7d0f7e8f10`.
- Production Worker `psr-portfolio-map-v2` is deployed at 100% on version
  `1eb192f5-078f-4c6f-8389-5a210cfc76bd`; deployment
  `01941ee9-0ab1-4b11-ad5b-0c02887e9244`.
- `https://espacios.me/map` returned HTTP 200 with V25 HTML, JavaScript and
  CSS release keys. The selected-state rules are embedded in the V25 HTML
  stylesheet. `/map/api/system` still reports the Data Room as restricted and
  the existing map-shell/service-binding topology.
- After a browser refresh, the map's recoverable loading card appeared once;
  Retry restored the map and its timeline, and the V25 selected Map control
  rendered on the shared Espacios surface.
