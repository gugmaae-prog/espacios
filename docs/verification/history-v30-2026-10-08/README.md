# V30 DLD Ejari rent refresh and V33 Map palette — production receipt

Published `20261008-enrichment-v30` on 8 October 2026. The release preserves the fixed **1,645 projects and 215 communities**, all earlier record identities, events, source evidence and non-rent series. It refreshes the latest public DLD rent vintage for 90 already represented projects; it does not claim complete lifetime financial histories or validated forecasts.

## Source and evidence limits

The input is the public [Dubai Land Department Ejari rent-contract dataset](https://data.dubai/en/l/468586) and official [DLD buildings register](https://data.dubai/en/l/459613), used under the [Dubai Open Data licence](https://data.dubai/en/terms-conditions). The public bulk-download files were captured with source snapshot date 7 October and verified on 8 October 2026 at 15:53:50 UTC. The source's original publication timestamp is unknown, so these observations cannot be treated as inputs available before retrieval. The raw exports and contract identifiers stay local; no contract-level rows or identifiers were committed or published.

The bounded extraction scanned **10,573,532 source rows** and retained **71,477 unique eligible single-property contracts** after date, amount, area, segment and identity checks. Current DLD building name plus exact area had to resolve to one DLD project ID and then exactly one identity-verified Espacios project. No fuzzy name joins, geographic fan-out or community reallocation were allowed. Sixty-four of the 90 matched projects had 180 contract starts after 3 October; that timing is recorded and not used to imply investor availability of the export before its retrieval. Eligible observation dates run from **25 January 2015 through 7 October 2026**.

V30 refreshes **1,974 existing monthly and quarterly rent series** containing **35,198 aggregate points**. It adds **84 previously absent period cells**, adds no new series or catalogue records, and changes no community evidence. The latest source vintage revises 31,770 values in periods also present in V29. These are vintage revisions from the newer bulk export, not additional independent observations; V29 remains immutable for comparison. Monthly and quarterly periods overlap and must not be added together. Rent usage, contract type, registration and subtype remain separate. Median and quartiles are suppressed below 20 contracts. October 2026 is incomplete. Sparse and incomplete coverage remains explicitly partial or missing.

## Coverage after V30

The published archive has **565,004 history rows**, **15,182 series**, **11,540 record-series links**, **3,294 sources**, **105 events**, and **7,382 event exposures**. The 42,780-item checklist is unchanged: **3,209 present, 3,438 partial, 26,833 missing and 9,300 unestablished**; **39,571 (92.50%) remain unresolved**. The checklist ratio is not the share of historical prices or rents covered. Direct signed-rent checklist status remains present for 89 records and partial for 1; complete lifetime sale and rent history remains unestablished for all 1,860 records. Dated current valuations remain absent, and approved numeric forecasts through 2080 remain **zero**. V30 adds no imputed gaps, proxy prices or forecast outcomes.

The immutable root is `cf17752fd97e3e5e930d3d100cdbec20f16f05e1f3c39ad59fef52964f944e0d`; the D1 index is `dd4a527067b0d3802858030c307b9b7a29ec659bf71f070ce19351909d13293a`. Publication conditionally wrote **2,059** objects and reused **50** byte-identical objects. It completed **39,364** index statements and verified exact table counts: 1 snapshot, 1,860 records, 3,294 sources, 105 events, 7,382 exposures, 15,182 series and 11,540 record-series links. Publication state is `complete`.

## Live verification and release

`npm run verify` passed all **163 tests**. The live acceptance scripts matched all 1,860 record ledgers and 42,780 checklist items, all 105 events and 7,382 exposures, and the bounded earlier enrichment packet. The dedicated rent readback compared every direct-subject series to production: **1,974 series, 35,198 points and 90 projects**, with exact identities and linked sources; all matched. `/map` returned HTTP 200 and served the `20261008-map-palette-v33` frontend token. The selected mobile Map control uses the Espacios slate surface and ink in light and dark themes; the contrasty gold treatment came from inherited premium-shell styling and carried no market meaning.

Production Worker `psr-portfolio-map-v2`, version `2095ca46-3f1f-40be-b107-52c833c43433`, receives **100% traffic** in deployment `154dc34e-7f6d-4196-b06c-ebefcf8bb134`. `DATA_ROOM_PUBLIC=false` remains in force, and the canonical `/map*` shell route is unchanged. The temporary publisher was scoped to the V30 root, protected by a private expiring token and removed after publication and verification. The release is recorded in Supabase; source sync remains `pending_merge` while PR [#98](https://github.com/gugmaae-prog/espacios/pull/98) is open.

## Next evidence work

1. Continue exact identity and phase reconciliation for remaining project candidates; keep ambiguous matches quarantined.
2. Expand direct sale and rent histories by exact project, building, phase and native period. Retain source revisions and mark incomplete historical periods rather than treating a new export as a complete time series.
3. Source dated valuations and lifecycle milestones, and resolve record-specific event exposure with citations and announcement, occurrence, effective, publication and retrieval dates.
4. Recompute the checklist by applicable period after each verified addition; keep financial coverage separate from lifecycle, event and source-page coverage.
5. Specify conditional annual paths through 2080 only from explicit assumptions. A scenario specification is not observed data, a validated point forecast or a claim of 54-year predictive accuracy.
