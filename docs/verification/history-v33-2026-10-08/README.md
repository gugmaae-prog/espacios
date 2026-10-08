# V33 RAK development history and dated advertisements — 8 October 2026

## Evidence added

This pass adds 40 lifecycle facts and four dated advertised prices across 11 exact project records, using 14 new primary developer releases. It reuses the existing H1 2026 capture and V32 identity sources without counting them as new independent corroboration. All 1,645 projects and 215 communities remain.

| Project | Lifecycle facts | Historical advertised prices |
| --- | ---: | ---: |
| EDGE | 6 | 0 |
| SKAI | 5 | 1 |
| Mirasol by RAK Properties in Mina, Ras Al Khaimah | 3 | 0 |
| Mirasol II | 2 | 1 |
| ENTA Mina | 2 | 0 |
| Anantara Mina Ras Al Khaimah Residences | 5 | 0 |
| Nura by RAK Properties | 3 | 1 |
| SOLERA | 4 | 1 |
| Bayviews Residences Hayat Island | 4 | 0 |
| Cape Hayat | 3 | 0 |
| Quattro Del Mar | 3 | 0 |

The newly retained announcements span October 2024 to December 2025 for Anantara, SKAI, Mirasol, Mirasol II, ENTA, SOLERA and Nura; EDGE's earlier announcement is dated 30 May 2024. The scope includes dated progress reports published in August/October 2025 and February 2026, plus explicit Q1 or 30 June 2026 milestones. No earliest-found announcement is called a first-ever transaction.

## Financial evidence boundaries

| Project | Advertisement date | Starting price, AED | Scope |
| --- | --- | ---: | --- |
| SKAI | 26 February 2025 | 762,000 | Launch residence; exact unit type unstated |
| Mirasol II | 25 September 2025 | 861,000 | Studio |
| Nura | 8 December 2025 | 800,000 | Apartment; exact unit type unstated |
| SOLERA | 17 June 2025 | 768,000 | Apartment; exact unit type unstated |

These are primary developer advertisements at historical publication dates, not registered sales, medians, valuations, current inventory quotes or appreciation rates. They cannot replace current snapshots or forecast anchors. Their first verified model-availability dates remain October 2026. Corporate revenue, sales backlog, hotel occupancy and developer claims about investment gains are not assigned to property-level prices or causal uplift.

## Identity and temporal review

- EDGE's 2024 launch announcement is retained alongside the FY2025 report's grouping of EDGE among 2025 launches. The later grouping does not replace the earlier date or prove a new phase.
- SKAI's February announcement, immediate expression-of-interest invitation, planned March sales opening, Q1 2026 contract award and June construction report remain distinct. A contract is not a construction-start day.
- Original Mirasol's 339-home introduction and the separately named 280-home Mirasol II are distinct. H1 2028 remains a bounded half-year target. A first-phase sellout report lacks an inventory denominator and registered transactions. Generic later Mirasol mobilisation is excluded from both records until its phase is identified.
- Anantara's 2024 release describes approximately 94 apartments and 20 villas; its 2025 release describes 84 and 19. The reason for the change is unestablished. An April sales-commencement report and the 6 May announcement are retained separately. June villa mobilisation and apartment piling remain phase-scoped, separate from the operating hotel.
- EDGE's 25.8% and SKAI's 8.3% are reported overall progress as of 30 June 2026. Their 76% superstructure and above-55% substructure figures are components, not whole-project completion.
- Earlier annual/half-year results do not establish an exact inspection day. Where absent, a milestone explicitly uses the report publication date and retains its reporting-period explanation.
- Nura's retained record title and slug name RAK Properties, agreeing with the primary launch release. An archived map-core developer field instead contains `nura`. That malformed catalogue field is flagged for correction separately; this pass does not silently overwrite it.
- SOLERA's scheduled April 2026 construction start remains planned even though that date is now past. The April 2028 and Q1 2029 handover schedules remain targets.

## Coverage-rule correction

A verified public launch announcement does not establish the first possible private sale or marketing date. The runtime now requires explicit price-applicability evidence before labelling earlier periods not applicable. Earlier unknown periods remain unknown; periods from the earliest verified history onward remain missing when no financial observation exists. Verified occupancy rules and direct observations remain intact. A regression test covers an ordinary announcement, an explicitly established boundary, and an earlier transaction contradicting that boundary.

The first publication attempt was stopped during object validation, before data writes, when this issue was found. The immutable V33 evidence root did not change. The uploaded candidate Worker was superseded before production activation; see [correction record](pre-publication-correction.json).

## Preservation and coverage

All 633,891 native history rows, 16,872 series, 13,230 record-series links, 105 events and 7,382 exposures are preserved. Source captures increase from 3,306 to 3,320. Tests compare every native financial series to V32, every unaffected compact record exactly, and every prior lifecycle/financial observation by prefix. Current snapshots, scenario inputs, financial-coverage states, completion and occupancy states remain unchanged.

The 42,780-item checklist contains 3,289 present, 3,436 partial, 26,755 missing and 9,300 unestablished items. 39,491 (92.31%) remain unresolved, 24 fewer than V32. This is item-presence accounting, not the percentage of financial history missing. Complete lifetime histories, dated current valuations and approved annual forecasts remain unestablished. No community-level evidence or registered-sale/rent observation is added in this pass.

## Reproduction and validation

- `scripts/capture-rak-lifecycle-pass33.mjs` captures a fixed set of 14 public developer releases into private scratch. Public packets retain minimal reviewed facts, URLs, dates and checksums; full HTML, article text and images are not redistributed.
- `scripts/prepare-rak-lifecycle-pass33.py` compiles the reviewed source and identity decisions.
- `scripts/append-rak-lifecycle-pass33.py` requires the materialized V32 archive and its hash-verified objects, then appends V33 and rebuilds immutable R2/D1/runtime artifacts.
- `tests/historical-v33-rak-lifecycle.test.mjs` checks exact preservation, identity, phase exclusions, timing, historical price classification and D1 numeric types. The preceding V32 preservation comparison remains frozen to its own immutable root; V33 separately verifies the new transition.
- Build, syntax checks and full `npm test` passed. All eight focused V32/V33 tests passed. The full suite passed again after the coverage-rule correction; 56 map tests passed after the V37 asset-token bump. The palette and panel layout are unchanged from V36. See [test summary](test-summary.json), [focused checks](focused-tests.txt), [reconciliation](reconciliation.json) and the [reviewed packet](../../../data/historical-intelligence/rak-properties-lifecycle-pass33-20261008.json).

## Publication

Candidate validated locally; production publication and independent live verification are pending.

## Next evidence actions

Correct the documented Nura developer field through the map catalogue's existing correction path. Resolve Gateway/Gateway II, Marbella Extension and generic Mirasol/Bay Residences phase names against explicit property identity. Continue exact-subject sale/rent and dated current-value sourcing; development progress alone cannot close financial gaps. Annual scenarios require disclosed inputs and validation, with every unsupported field retained as a gap through 2080.
