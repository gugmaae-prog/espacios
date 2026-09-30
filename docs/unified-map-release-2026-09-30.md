# Unified map timeline and controls — 30 September 2026

Release token: `20260930-unified-map-v2`.

Status: **verified local candidate; production receipt pending**. Source changes
and search camera acceptance have passed local checks. Production is not changed
until the explicit release and canonical verification below are completed.

## Scope

This candidate brings Density, Prices and ROI into one map control surface. Native
historical evidence, released research projections and conditional future estimates
share a navigable timeline without being treated as the same evidence class. It
does not replace the existing catalogue, source history or stored model runs.

The ten annotated requests are addressed as follows:

| Request | Candidate implementation and boundary |
| --- | --- |
| 1. Remove Play | Playback buttons are removed from the unified visible surface. Previous/next, native date selection, keyboard navigation and direct dragging remain. |
| 2. Align Settings and Collapse | Settings and collapse are paired in `#um-actions`, with consistent 44px controls beside the date. Collapsing keeps the selected date, evidence label, usable range and readout. |
| 3. Projects means density | The metric is labeled **Density**. Points/heatmap switching appears only for project density. Reported handovers and catalogue density are not represented as price growth. |
| 4. Different apartment, villa and townhouse prices | Apartments, Villas, Townhouses and **Both · A + V** are separate choices. Both means an apartment/villa capital split, not townhouse inclusion or an unweighted mean. A missing townhouse basket is not filled with villa observations. |
| 5. ROI means profitability | Future ROI uses the existing audited after-cost cash-flow calculation. Native historical rental-yield observations remain explicitly labeled **Yield history · not profit**; they are not relabeled as realized investment returns. |
| 6. Remove the separate 10-year-scenario button | Future selections are inline on the same date control and range. Settings offer 10-, 20- and 30-year conditional horizons from the source anchor, plus lower/reference/higher paths. |
| 7. No separate Smart Estimates tab | Duplicate metric/horizon tabs and scenario launch buttons are hidden in unified mode. The calculation, history, source and investment-assumption controls remain reachable through Details/Assumptions; they are not deleted. |
| 8. Remove the initial PORTFOLIO banner | The initial Explore panel is suppressed through the controller-owned `data-um-explore` flag. Explicit Explore navigation can reopen its existing content. The redundant panel-title banner remains hidden. |
| 9. Search should focus the selected area | Exact record identity, source geometry and measured camera padding share one owner. Palm Jumeirah and Yas Island boundaries, plus the Yas Riva project coordinate, were verified in Chrome. Mobile details begin as an expandable compact card. |
| 10. System should match the theme | The System/Data Room-access link uses the existing Espacios theme tokens and touch-target sizing. Its destination and access restrictions are unchanged. |

## Timeline, estimates and interpretation

- Source-native monthly, quarterly, half-year and annual labels remain distinct.
  Existing records, revisions, explicit missing source values and released
  projections are retained; synthetic empty future months are not presented as
  historical observations. Shared end dates do not merge different evidence classes.
- Density retains the All dates catalogue, including future and undated projects.
  Entering the dated handover view remains a separate selection, not data deletion.
- A price or yield is displayed only for the selected native period and matching
  source frame. An earlier rendered value must not survive under a newly selected
  date. Rapid changes invalidate pending future calculations.
- The existing ten-year conditional paths remain unchanged. The 20/30-year choices
  continue the same disclosed rate seed and annual damping; they do not refit a
  model, alter earlier outcomes, add observations or bridge an old anchor to today.
  Longer horizons are increasingly assumption-dependent.
- **Conditional estimates are not validated forecasts, probability intervals,
  certified valuations or guaranteed returns.** Their target periods are relative
  to the source anchor, not automatically ten/twenty/thirty years from today's date.
  Flat and negative paths remain possible. Infrastructure uplift is not imposed.
- Net ROI is nominal all-cash cumulative holding-period return after explicit
  purchase, exit, vacancy and operating-cost assumptions. Rental growth and the
  first income year are editable. Financing, tax, staged off-plan payments and
  unit-specific differences remain excluded. Gross-yield benchmarks are not
  observed collected rent or realized profit.
- Mixed apartment/villa results require compatible source anchors, area,
  registration and price basis. Cash flows are capital-weighted; percentages are
  not simply averaged. Incompatible mixed results are withheld, with individual
  evidence still accessible.
- Future polygon shading uses the comparable same-anchor cohort and a fixed colour
  scale over the selected horizon. Unknown/unmatched areas are not assigned zero.
  Editing the selected investment's rent must not transfer that rent to other areas;
  other areas use their own available starting gross-yield benchmark.
- A selected community without a compatible anchor remains a coverage gap. It is
  not silently replaced by Palm Jumeirah, Yas Island or a neighbouring community.
- If the estimate endpoint is unavailable, retained historical and released-
  projection selections remain usable. Future shading exits honestly; recovery
  restores scenario choices without replacing the user's historical selection.

## UI and implementation

The new `src/unified-map/` controller, adapters and scoped stylesheet are appended
by `scripts/build-smart.mjs`. The acquired baseline remains immutable. Supporting
changes connect the existing mobile pointer owner and Smart Estimates calculator
to the shared date domain. `src/mobile-map/search-focus.js` owns search identity,
source geometry, measured placement and camera cancellation.

The compact dock uses existing Espacios light/dark tokens. It has 44px controls,
clear selected states, visible keyboard focus and reduced-motion handling. The
small future legend sits at the map's bottom right above the measured dock, clear
of mobile navigation. Duplicate legacy toolbars, the old date title/settings/play
controls and the initial banner are hidden only when unified mode is active.
Explicit specificity guards are required because acquired styles use high-specificity
`!important` rules, including ID selectors inside `:not()`.

Date labels use normal flex spacing instead of stale absolute offsets. Both the
unified three-label rail and the preserved density date labels remain usable.
Details/Assumptions keeps supporting material off the main map surface without
removing evidence or source access. The search input and System link share the
existing theme treatment; the official logo is unchanged.

No new library, animation dependency, tracking service or remote media dependency
was added for these interface changes. A smoother interaction design is not a
measured Core Web Vitals or latency improvement claim.

## Verification status

`npm run verify` passes smoke/API checks and **130 unit/integration tests**.
The strict production-config version-upload dry run passes, with unchanged
bindings. The generated Worker SHA-256 is
`f811504ebd095ea5941ccd2aa0c4010093a3eaf51bd1071a6cdc6ce8128471d5`.

Current test coverage includes native-period preservation, same-label evidence
classes, unchanged retained scenario rows, 10/20/30-year extension policy, negative
outcomes, missing profitability inputs, future-to-history cancellation, exact
anchor anniversaries, period-matched readouts, conditional exports, historical
tooltip/layer restoration and estimate-endpoint failure/recovery. Search tests
cover exact names plus emirate, geometry precedence, grouped option order,
unlocated records, measured padding, asynchronous geometry and camera ownership.

Chrome checks verified **375×812, 390×844, 936×707 and 1440×900**, light/dark,
zero horizontal overflow and aligned 44×44 Settings/Collapse targets. The initial
banner and duplicate playback/scenario controls are absent. Keyboard Home restores
history; a touch drag selected the 2036 ROI endpoint and released cleanly. A
30-year price path reaches 2056Q2 with a long-term-assumptions label. Collapsing
retains date and slider. Reduced-motion transitions are zero-duration. A real
touch on Palm Jumeirah's rendered 2036Q2 polygon opens Price estimate evidence
for that same area, period and apartment basket.

Final settled live selection verification identified an API-overload bug in the
first candidate: MapLibre interprets a plain `{x,y}` as query options, selecting
from the entire viewport. Native hit-tests now pass `[x,y]` for unified forecasts,
benchmarks and the retained Smart layer. Three regressions assert exact coordinates
and empty-space behavior. Local v2 touch QA confirms Palm Jumeirah remains selected
after the delayed touch click; an ocean tap leaves its panel closed and selection
unchanged. The v1 instantaneous post-touch check was insufficient and is superseded.

Palm Jumeirah search fits its exact boundary at zoom 11.846; Yas Island fits its
exact boundary at zoom 11.486. Yas Riva's normal-motion search settles on its own
catalogue coordinate at zoom 15.2. MapLibre's current global padding and fitBounds
padding must not both receive the same inset: that double subtraction caused the
mobile camera no-op. Regression tests now cover it and explicit fit failures.

Browser numerical checks: Palm Jumeirah apartment registered-sale evidence is
2,298 AED/sqft in Aug 2026 and 1,317 in Jan 2019. The reference conditional price
is 3,197 at 2036Q2 and 3,319 at 2056Q2, anchored at 2026Q2. ROI defaults permit a
-5.4% first-year net result. Changing the starting rent to 7% persists across the
date change and yields 44.4% cumulative ten-year net return under the displayed
assumptions. Returning to 2026H1 displays the native 4.48% gross-yield benchmark,
not profit. Townhouses remain separate, without borrowing villa evidence.

Still open at the time of this draft:

- Production candidate upload, binding parity inspection and explicit promotion.
- Canonical production route, logo, asset-parity and before/after retention checks.

Static CSS whitespace/structure checks passed during the scoped styling work.
No physical iOS/Android-device test or fresh quantitative performance claim is made.
The localhost preview's production-absolute logo/CSP limitation remains a separate
canonical post-deployment check, not evidence that the production logo failed.

## Preservation baseline

The pre-release receipt is `.wrangler/unified-release-before.json`, captured at
`2026-09-30T15:26:12.432Z` from `https://espacios.me`. It contains hashes/counts and
HTTP/access observations, not raw source records. This is a **before** snapshot;
after-release parity has not yet been established for this candidate.

| Population or access check | Baseline |
| --- | --- |
| Research catalogue | 1,691 projects; 215 communities; 428 developers; 72 initiatives |
| Market-segment benchmarks | 228 rows; 15 sources; 7 available periods; 5 represented emirates |
| Historical library | 4,882 indexed series; 109,315 Dubai historical cells with 5 measures per cell |
| Official/context history | 699 official series; 12,673 official points; 415 context observations |
| Stored research runs | 2,223 runs: 1,945 insufficient evidence, 185 experimental projections, 93 validation failed; 0 project valuations |
| Heatmap catalogue | 1,690 projects across 7 emirates; 1,519 mapped features; 171 awaiting coordinates |
| System endpoint | HTTP 200; 6 topology entries; `no-store`; `noindex, nofollow` |
| Restricted Data Room | HTTP 404; `no-store`; `noindex, nofollow` |

The research and heatmap populations are intentionally separate; 1,691 and 1,690
must not be silently normalized to claim parity. Historical-library and
prediction-catalogue checks cover catalogue metadata and the first requested page,
not every stored partition. Different-frequency cells must not be counted as
independent transactions.

The existing Smart Estimates object remains
`research/published/2026-09-30/smart-estimates-v1/scenarios.json` in the
`psr-market-intelligence` R2 bucket. Its local source snapshot SHA-256 was checked
while preparing this draft and remains:

`f77472b65fad63bb6dd59323ed93823fb623a193d58c8cd014c2e3f868a3c4b4`.

That snapshot retains 246 exact sales series / 4,978 native quarterly points and
all 228 asking/yield rows in 96 groups, with 153 eligible ten-year scenario sets.
Longer UI calculations are conditional extensions in browser memory, not new
published historical records or overwritten R2 paths. Edited assumptions can be
exported; this change does not silently save them as facts or approved forecasts.

No project records, observations, private candidates or model runs are deleted.
No new source observations are acquired or approved by this UI release. Private
ADREC/RAK candidates retain their prior rights/quality gates; public discovery
metadata is not permission to publish their numerical payloads or train on them.
There is no D1/Supabase migration, credential expansion, R2 data write, tenant
transfer or Data Room-access expansion in this candidate's scope.

## Release boundary and rollback

Authorized target: **`wrangler.production.jsonc`**, Worker
**`psr-portfolio-map-v2`**, behind the unchanged `espacios-map-shell` service and
canonical `/map*` route. The default Wrangler manifest remains a candidate target.
The explicit production manifest has no route definitions; do not move ownership
away from the separately managed shell.

Preserve `AI`, `DB`, `MARKET_R2`, `PSR_PROPERTY`, `DATA_ROOM_PUBLIC=false`,
compatibility date `2026-08-20` and `nodejs_compat`. Do not infer a need for new
secrets or source-data permissions from the new controls.

Rollback target: the currently recorded mobile-map production version
**`0dbf52e2-30b6-4906-ac6e-dd5460eb712f`**. Do not substitute the older Smart
Estimates or pre-Smart version. Its prior deployment record is
`115e1f9e-d6f0-448d-8ebe-76f9bb409c12`, documented in the mobile release handover.

Before promotion, resolve the search acceptance item, freeze the tested candidate,
rerun `npm run verify` and `git diff --check`, and complete the production-config
dry-run. Upload a candidate without changing traffic, inspect its bindings and
version identity, then promote only after acceptance. Preserve the shell, source
snapshot and access gates. This document does not execute any of those actions.

After an authorized promotion, run the read-only preservation comparison:

```sh
node scripts/verify-release.mjs --before .wrangler/unified-release-before.json --output .wrangler/unified-release-after.json
```

Review any fingerprint/count change rather than overwriting or normalizing it.
Live source-feed changes may require explanation; they are not automatically an
application regression or automatically acceptable. Independently verify canonical
HTML, JavaScript/CSS parity, release marker, source snapshot hash, unchanged shell
and the restricted Data Room response.

## Production receipt — pending

**No production deployment is recorded for this candidate in this draft.** The
release owner will replace the pending fields only after obtaining evidence.

- Final implementation commit / PR / merge: pending.
- Final verification command, timestamp and executed test count: pending.
- Search camera fit-bounds acceptance: pending.
- Final browser viewport/theme/interaction matrix and evidence paths: pending.
- Production-config dry-run and candidate binding review: pending.
- Candidate Worker version: pending.
- Promoted version, deployment ID and traffic percentage: pending.
- Canonical `/map` status and `x-espacios-mobile: 20260930-unified-map-v1`: pending.
- Canonical JavaScript/CSS hashes versus the frozen local candidate: pending.
- Official logo, source snapshot hash and restricted Data Room checks: pending.
- Before/after retention receipt comparison: pending.
- Shell/version/route/binding parity: pending.
- Browser overrides reset and final rollback readiness: pending.

Keep `.wrangler/` receipts and browser evidence local according to the existing
repository safety rules; do not publish private browser/session material with the
handover.
