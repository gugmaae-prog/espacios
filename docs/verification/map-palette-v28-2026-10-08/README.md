# Map palette V28 — 8 October 2026

V28 keeps the selected mobile Map mode on Espacios' subdued slate surface, even when an older mobile-shell rule runs after hydration. The active state uses the theme's panel and ink colors with a light slate tint, a soft border, and no heavy shadow. Gold was inherited UI styling; it was not a property-value or appreciation signal.

## Release identity

- GitHub PR: [#93](https://github.com/gugmaae-prog/espacios/pull/93)
- Merge commit: `f5d0b96fe7ecdd7d3646152a13dab711b7c26a4e`
- Frontend token: `20261008-map-palette-v28`
- Cloudflare Worker: `psr-portfolio-map-v2`
- Worker version: `fd19c785-03f8-4a2e-b2c8-ed8feddfd0ae`
- Deployment: `de5b5f11-5396-4fa7-bcd9-305b5479f553` at **100% traffic**
- Data Room: `DATA_ROOM_PUBLIC=false`

## Verification

- `npm run verify` passed all 166 tests on the merged production source, including the V25 register-context preservation checks.
- A strict Wrangler production-config dry run passed with the existing D1, R2, Worker service, AI, and Supabase-control bindings.
- The live `/map` returned HTTP 200 with V28 HTML, JavaScript, and a stylesheet rule for the subdued selected state.
- The live browser's selected Map control computed to a pale slate background, dark slate text, a soft slate border, and no shadow.
- Cloudflare reported the V28 version at 100% traffic. The live system API and Supabase release registry both report V28 and the matching Worker IDs.
- The live system API still reports V25 history, `research_complete=false`, 92.64% unresolved checklist requirements, no approved forecasts through 2080, and a restricted Data Room. This visual release did not change the evidence snapshot.
