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
indexed historical series: 4,882; model runs: 2,223. Heatmap population is a separate
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

Published after user approval and verification. PR #17 merged at 14:46:50 UTC.

- Implementation commit: `3228913d3b8f733ce60eb23a52c9914e8bc4613e`.
- Merge commit: `891c95023b16455086fcd5433f73dd1b100d0761`.
- Production version: `0dbf52e2-30b6-4906-ac6e-dd5460eb712f`, 100% traffic.
- Deployment: `115e1f9e-d6f0-448d-8ebe-76f9bb409c12`.
- Canonical `/map`: HTTP 200; `x-espacios-mobile` and HTML asset version
  `20260930-mobile-map-v1`.
- Live JavaScript SHA-256 equals the tested local candidate:
  `724f64b2068d56ccbb56a96ed0834217318cff4b0e2367f48124b7e3166dc9e9`.
- Live CSS SHA-256 equals the tested local candidate:
  `59f827700b01039dfc60c534e0675afa4cf7d310b3ea0e4e0d596212d1d3fa70`.
  All seven inline style blocks also match.
- All seven before/after retention checks have unchanged fingerprints, counts
  and HTTP/access statuses. Smart Estimates hash above is unchanged.
- Shell version remains `64c324d5-e107-43e6-b897-90f2f0f6d565`;
  its deployment, route ownership, bindings and compatibility settings are unchanged.
- Canonical Chrome mobile acceptance: real touch drag selects 2036 and releases
  cleanly; All dates restores the chooser; Bada Al Jubail 2 retains exact ID;
  2032-pixel source logo loads successfully; horizontal overflow is zero.
- GitHub verify and public-repo-safety checks pass. CodeRabbit explicitly skipped
  automated review; it is not counted as a substantive code review.
- The version-preview hostname returns the existing deliberate 404 because it
  is outside the acquired hostname allowlist. That restriction was not weakened.

Local detailed before/after receipts and a live 390×844 JPEG are under `.wrangler/`:
`mobile-release-before.json`, `mobile-release-after.json`, and
`mobile-map-live-20260930.jpg`. Browser emulation/cache overrides were reset after QA.
No physical-iOS/Android-device test or quantitative Core Web Vitals claim is made.
