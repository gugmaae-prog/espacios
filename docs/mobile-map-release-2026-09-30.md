# Mobile map interaction upgrade — 30 September 2026

Release token: `20260930-mobile-map-v1`.

## Scope

- A single pointer owner for smooth visual timeline dragging, bounded map updates,
  native evidence-period selection, previous/next and keyboard alternatives.
- The project catalogue still starts at All dates; entering the timeline explicitly
  selects cumulative dated handovers. Future and undated records remain available.
- Compact Projects / Prices / ROI controls; settings retain property types, source
  baskets, research, projections and Smart Estimates. Nothing is removed from storage.
- One mobile sheet at a time, measured against the header, timeline and navigation.
  It can expand, minimize and close. Short landscape view starts minimized.
- Exact-ID project selection, including a chooser for overlapping coordinates.
  Changing date/filter context invalidates old choices. Price/yield/scenario taps
  resolve displayed evidence geometry, not a nearby area or a smoothed heat halo.
- Semantic taps run before legacy territory selection. Subsequent double-click
  clicks do not repeat selection; the separate zoom event remains available.
- An idempotent fix to the legacy collapse icon renderer stops its own DOM changes
  from perpetually retriggering the observer. The acquired baseline stays immutable.
- No new data, invented observations, revised valuations, credentials, database
  migrations, R2 writes, route changes, tenant changes or Data Room access expansion.

## Verification

`npm run verify` runs smoke/API preservation checks plus 71 unit/integration tests.
Tests include irregular native periods, touch radius, shared coordinates, viewport
padding, actual capture callbacks, repeated-click ownership, and emitted legacy
renderer stability. `git diff --check` and strict production upload dry-run pass.

Chrome checks use the read-only localhost preview with real touch input. Verified:

- 375×812 and 390×844 portrait; light/dark; no horizontal overflow.
- Touch drag to 2036, keyboard Home to 2019, cancellation cleanup and All dates.
- An overlapping Abu Dhabi chooser selects Bada Al Jubail 2 with exact authority
  project ID `20230000157247`; a changed date dismisses obsolete choices.
- Palm Jumeirah polygon opens its registered-sale evidence inspector, rather than
  the competing legacy community sheet. Its native dates/projections are retained.
- Existing Smart Estimates remains reachable with its separate ten-year scenario.
- 844×390 coarse-pointer landscape and reduced motion: no horizontal overflow,
  timeline minimized by default and animation duration zero.
- Desktop header/panel structure retained, with no duplicate mobile sheet bars.

The local preview cannot display the absolute production-logo URL under the
production same-origin CSP. Canonical production logo acceptance is a separate
post-deployment check, not a claim based on localhost.

## Retention and release boundary

Before release, all seven read-only release-receipt checks matched the previous
release. Research catalogue: 1,691 projects / 215 communities; benchmarks: 228;
history observations: 4,882; model runs: 2,223. Heatmap population is a separate
1,690-project set, with 1,519 mapped and 171 awaiting coordinates. These populations
must not be silently forced to match.

Receipts check metadata/counts and the first requested history/model page, not every
stored partition. Smart Estimates snapshot SHA-256 must stay
`f77472b65fad63bb6dd59323ed93823fb623a193d58c8cd014c2e3f868a3c4b4`.

Authorized target: `wrangler.production.jsonc`, Worker `psr-portfolio-map-v2`,
behind the unchanged `espacios-map-shell` service and canonical `/map*` route.
Preserve AI, DB, MARKET_R2, PSR_PROPERTY and `DATA_ROOM_PUBLIC=false` bindings.

Rollback target: verified Smart Estimates v187,
`df27a1de-e51f-4477-9fec-78e1b871229c` (not the older pre-Smart version).
Upload a candidate without traffic, inspect its bindings, then promote only after
acceptance. Append actual version, deployment and canonical verification below.

## Production receipt

Pending promotion and independent canonical verification.
