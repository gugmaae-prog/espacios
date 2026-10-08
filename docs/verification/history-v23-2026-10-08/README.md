# V23 community DLD history — production receipt, 8 October 2026

## Release identity

- Snapshot: `20261008-enrichment-v23`
- As-of date: 8 October 2026
- Root index SHA-256: `d5fec2bb098c8ecacd5e40174fb130e66f0dbf9f520fae368e72f0c442cefa36`
- Canonical snapshot SHA-256: `05933d8071ab64d828c50ed346521420b6db9ffdc9daebd056f80828429467ca`
- Source commit: `10b1efb3a282a3f6d884eeb3d1dfed860e08b746` (PR [#87](https://github.com/gugmaae-prog/espacios/pull/87))
- Production Worker: `psr-portfolio-map-v2`, version `379cffef-0769-4834-be08-c937fd3cb24c`, deployment `3b5ab3a6-cc74-4697-a3e7-854d4d6610f3` (100% traffic)
- Frontend: `20261008-map-palette-v25`
- Data Room: `DATA_ROOM_PUBLIC=false`

## Published contents

V23 preserves all **1,860 catalogue records** (1,645 projects and 215 communities) and prior evidence. Its immutable snapshot contains:

- 563,675 published history rows; 563,891 collected rows including 216 rights-pending rows excluded from publication.
- 15,063 history series, 11,421 record-series links, 3,252 sources, 105 events and 7,382 event-exposure links.
- 2,179 immutable R2 objects (2,132 newly written and 47 reused) and 39,084 D1 index statements. D1 row counts were checked before the snapshot was marked complete.

Pass 46 adds **274 exact DLD master-label series across 44 Dubai community records**. They contain 10,995 monthly and 4,201 quarterly points, totaling 15,196 points; the frequencies overlap. The selected source extract contains **556,639 unique eligible registered sales** dated through **6 October 2026**. It yields price statistics for 7,193 points at the minimum sample threshold; 8,003 sparse points preserve counts and date spans without a published median.

The public DLD dataset is [Dubai Land Department property transactions](https://data.dubai/en/l/470061); its [terms](https://data.dubai/en/terms-conditions) govern reuse. V23 retains the source URL, retrieval time, aggregation method and exact label/area scope with the evidence. Raw transaction identifiers and the full source extract are not redistributed. A DLD registration date is not a contract execution or transfer date. The source publication timestamp is unknown; this vintage was first retrieved on 8 October 2026 and must not be used as information available in earlier backtests. A `master_project_en` match does not establish a legal boundary or a broader community boundary.

## Live verification

- Production `/map/api/events` and `/map/api/record-history` returned `20261008-enrichment-v23` after deployment.
- Independently queried each of the 274 new record/series pairs through the live record-history API. All 274 returned the expected immutable partition and all 15,196 points; no missing series, truncated points or identity mismatch.
- `npm run cf:dry-run -- --config wrangler.production.jsonc` retained D1, R2, service, AI and Supabase-control bindings with `DATA_ROOM_PUBLIC=false`.
- Production deployment is on the existing map Worker. The existing route remains managed by `espacios-map-shell` and its `MAP` service binding.
- The refreshed map renders its Map controls in the existing subdued slate palette. The V25 selection color is presentation only; it has no appreciation or valuation meaning.

## Coverage still missing

V23 improves one bounded community transaction source. It does **not** establish complete price, rent or lifecycle history.

| Evidence measure | Present | Partial | Missing or unestablished |
|---|---:|---:|---:|
| Registered-sale evidence — 1,645 projects | 277 | 1 | 1,367 missing |
| Registered-sale evidence — 215 communities | 48 | 2 | 165 missing |
| Signed-rent evidence — all 1,860 records | 89 | 1 | 1,770 missing |
| Complete lifetime sale and rent history | 0 | — | Unestablished for all 1,860 records |
| Dated current valuations | 0 | — | Missing for all 1,860 records |

Across the 42,780 applicable research checklist items, 3,148 are present, 3,436 partial, 26,896 missing and 9,300 unestablished. **39,632 items (92.64%) remain unresolved.** This checklist percentage is not a price-history coverage percentage. Unsupported periods remain gaps rather than invented observations.

The 2027–2080 horizon spans 54 years and three metrics for each of 1,860 records (301,320 record/metric/year slots). The evidence ledger contains **zero validated 2080 forecast records** and zero approved forecasts. Scenario outputs must remain conditional and must not be described as realized prices or guaranteed returns.

## Next research pass

1. Resolve exact project, phase, developer and authority identities before attaching transactions; begin with Palm Jebel Ali project phases, where community context does not substitute for project sales.
2. Source additional public primary transaction and launch evidence, preserving sparse observations and separating sales, advertised prices, valuations, rents and community context.
3. Find dated occupancy, construction and completion evidence and signed-rent histories; keep target handover dates separate from actual completion.
4. Continue the event ledger with publication/availability dates and local exposure; treat news and infrastructure as context unless a controlled, mix-adjusted study supports an association.
5. Populate annual 2027–2080 conditional scenarios only after dated anchors, delivery, supply, migration, rates, costs and downside assumptions are specified and backtested without future-data leakage.

The overall research goal remains incomplete. All existing verified evidence stays in the immutable archive; unresolved requirements remain explicit.
