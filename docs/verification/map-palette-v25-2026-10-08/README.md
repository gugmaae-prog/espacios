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
- The live map is still on V24 pending publication of this change.
