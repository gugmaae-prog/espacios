# V20 production release receipt — 8 October 2026 (Dubai)

## Release identity

- History snapshot: `20261008-enrichment-v20`
- Archive root SHA-256: `98d686ca18d6e887cb9dff2eed58c6ac9dfe6a781901f4cc9731e6a3f158fa28`
- Source code commit for the V20 history bundle: `3178c6c64f5a38da5dc2ef140f6ae738347dc81e`
- Cloudflare Worker: `psr-portfolio-map-v2`
- Original V20 worker version: `6aaaebd9-53b7-47e7-b138-2b6f0794d443`
- Original V20 deployment: `9d3e21b5-b72c-44cb-8002-b407c9082e1f`
- Current palette source commit: `5d04164e7632789e93f21bf56be53ee379188b2b`
- Current frontend token: `20261008-map-palette-v21`
- Current worker version: `129a681a-5172-4b25-90cc-44951560d72b`
- Current deployment: `4849e07c-e488-4133-8a41-0d69dfdf1fb2`, serving 100% traffic
- Data Room: `DATA_ROOM_PUBLIC=false`

## Seamless Map palette follow-up

Gold was inherited as a selection and fallback-evidence accent, and old helper
copy explicitly described it as selection-only. It never represented price
growth or investment value. Separately, the mobile Map mode button retained an
opaque navy active fill, creating a contrast jump against the Espacios shell.

The current mobile and desktop controls use a subtle panel surface and slate
border; a restrained teal underline identifies the selected mode. Fallback
locations and watchlist/hotspot indicators use muted slate and teal. Copy now
describes selection as orientation only and states that color is not a value
signal. Light and dark themes use corresponding muted variants. Legacy gold
variable names remain only as aliases to the palette for compatibility with
the acquired shell styles.

## Published snapshot

Production publication verified **2,109** immutable R2 objects: **2,108
written and one reused after its bytes matched**. The publisher indexed and
verified **38,488** D1 statements. Final table counts are one snapshot, 1,860
records, 3,240 sources, 105 events, 7,382 event exposures, 14,771 history
series and 11,129 record-series links. The fixed catalogue still contains all
**1,645 projects and 215 communities**.

The map Worker serves V20 from its rebuilt V20 runtime bundle. The canonical
Map and read-only history/event endpoints were independently checked after the
deployment. Production D1 readback reports V20 as `complete` with the root
above. The private, short-lived publication bridge and its token were removed
after verification.

## Community-context addition

V20 adds **13,586 monthly sale-price context points for 44 Dubai communities**.
The source is a pinned **5 October 2026** snapshot of [Dubai Real Estate
Data](https://www.dubairealestatedata.com/transactions), derived from Dubai
Land Department open data and published under [CC BY
4.0](https://creativecommons.org/licenses/by/4.0/). The raw Parquet is kept in
local ignored storage and is not redistributed.

The source contains **561,282 eligible unit/flat and villa sale rows**, dated
**2 June 2003–31 July 2026** by DLD `instance_date` registration date. A
free-text `master_project_name` was matched only where it exactly identifies
one unique Dubai catalogue community after trimming and case-folding. This
does not verify an official DLD community ID, boundary or project identity.
Every added link is `scope=community_context` and
`identityVerified=false`.

The 44 monthly series summarize **539,872 source rows**. This is a
latest-vintage cohort view, not 539,872 new project sales. **45,858 Business
Bay rows overlap an existing narrower area cohort** and must not be added to
that count. Existing V19 series and their 67,268 record/transaction pairs were
preserved. Palm Jumeirah gets no redundant V20 series because its exact-area
series already exists and this pass found no new links for it. Median prices
for cohorts with fewer than 20 rows are withheld: **8,912 of 13,586** points
retain sample counts without a median.

The 44 communities receiving this context are:

Al Barari, Al Furjan, Arjan, Barsha Heights, Bluewaters Island, Business Bay,
City Walk, City of Arabia, DAMAC Hills, DAMAC Hills 2, DAMAC Lagoons,
Discovery Gardens, Downtown Dubai, Dubai Creek Harbour, Dubai Harbour, Dubai
Hills Estate, Dubai Land Residence Complex, Dubai Marina, Dubai Maritime City,
Dubai Science Park, Dubai South Residential District, Dubai Sports City, Dubai
Studio City, Dubai Water Canal, Emirates Hills, Jumeira Bay, Jumeirah Garden
City, Jumeirah Golf Estates, Jumeirah Islands, Jumeirah Park, Jumeirah Village
Circle, Jumeirah Village Triangle, La Mer, Madinat Badr, Majan, Mina Rashid,
Mudon, Nad Al Sheba Gardens, Sobha Hartland, The Valley, The Villa, Tilal Al
Ghaf, Wasl 1 and Wasl Gate.

**Palm Jebel Ali receives no V20 transaction series.** Its live record history
still contains no V20 master-community series; its events endpoint returns 43
dated exposures labelled `event_evidence_not_causal_price_effects`. Government
projects and news remain contextual evidence, not automatic price uplift.

## Live and repository checks

- `npm run verify`: build, syntax checks and all **165 tests passed**.
- `npm run history:verify:storage`: local immutable-storage round-trip verified
  all 2,109 objects, all indexed table counts, paged record history and repeat
  publication reuse.
- `npm run cf:dry-run`: the production Worker bundled with the intended D1,
  R2, service, AI and restricted Data Room bindings.
- `https://espacios.me/map`: HTTP 200; response headers and asset URLs carry
  `20261008-map-palette-v21`. The selected Map control uses the soft Espacios
  slate surface and muted teal accent; selection does not signal value.
- Business Bay record history returned V20. Selecting a V20 community series
  loaded one immutable partition with **194 monthly points**; the API labels
  the response as a retrieved page, not complete history.
- Palm Jebel Ali events returned V20, 43 exposures and the non-causal
  classification above.
- The later V21 source PR and production deployment reconciled the Supabase
  release registry and runtime config; readback is recorded in the [V21
  production receipt](../history-v21-2026-10-08/README.md).

## Remaining gaps and next actions

This release does **not** complete lifetime financial or lifecycle histories.
The V20 snapshot reports **275 records with at least one direct subject-sale
observation** and **89 with at least one direct subject-rent observation**;
sparse observations do not establish continuous or lifetime coverage. The
evidence checklist remains at **39,684 of 42,780 requirements unresolved
(92.76%)**. That is checklist coverage, not a percentage of missing prices.

There are **zero approved annual 2080 forecasts**. Conditional annual slots
through 2080 remain separate from observed history, with unsupported values
null. The public Map timeline currently exposes future ticks only through 2036;
displaying record-level annual scenarios through 2080 remains unfinished.

Next work:

1. Verify official community identifiers and geographic boundaries; keep the
   44 free-text matches in contextual scope until that review is done.
2. Continue exact project/phase identity review beyond 263 project candidates
   and source dated sale, rent, valuation, lifecycle and occupancy evidence for
   every applicable period.
3. Research Palm Jebel Ali with phase-level launch and sales evidence, actual
   infrastructure milestones, costs and delays; do not infer appreciation from
   its announced masterplan or events.
4. Extend the public forecast interface to 2080 only with explicit annual
   assumptions, downside paths, supply and delivery schedules, rates, vacancy
   and costs. Evaluate shorter horizons separately; 54-year paths remain
   conditional, not certified predictions.
5. Test event associations with local exposure, comparable controls,
   pre-trends, property mix and concurrent supply before making attribution.
