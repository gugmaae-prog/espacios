# V29 verified DLD project-sale cohorts — release receipt

V29 (`20261008-enrichment-v29`) preserves all **1,645 projects and 215 communities** and adds exact-identity Dubai Land Department registered-sale aggregates for **11 existing Dubai projects**. It does not create individual transaction records, valuations, rent history, complete lifetime histories, or approved forecasts.

## Source and identity checks

The primary source is the [official DLD transactions dataset](https://data.dubai/en/l/470061), used under the [Dubai Open Data Licence](https://data.dubai/en/terms-conditions). Project, developer and area identity was checked against the pinned [DLD projects register](https://data.dubai/en/l/467654), [developers register](https://data.dubai/en/l/462802) and [areas register](https://data.dubai/en/l/465592). The captured native exports are recorded in `data/historical-intelligence/dld-verified-project-sales-enrichment-20261008.json` with byte counts and SHA-256 checksums.

The source export contains 1,798,873 scanned rows. Eleven catalogue project names matched an exact official `building_name` value and were resolved through a unique DLD project number/project ID, area ID and developer ID. Seven registered parent project numbers cover the eleven separately named buildings. No fuzzy or nearby-area matching was used; transaction IDs were checked across records to prevent fan-out. Ten of these projects move from missing to present registered-sale evidence; one remains partial because its pre-existing evidence status is still partial. No community record was changed.

The eligible population contains **4,781 unique registered residential sales** from 22 December 2016 through 5 October 2026. DLD `instance_date` is the registration date, not the contract or transfer date. Sale-price and AED/sqft observations are monthly and quarterly medians with inclusive P25/P75. Cells with fewer than 20 transactions retain their dates and counts while price statistics are withheld. Out of **1,182 aggregate cells**, 166 meet the display threshold and 1,016 remain sparse. Monthly and quarterly groups overlap. The public aggregate file does not include transaction IDs or individual sale prices.

The capture was first retrieved on 8 October 2026; the source publication timestamp is unknown. It is not admissible in earlier point-in-time backtests. These records show observations found in this export, not first-ever transactions or continuous history. No appreciation rate or event uplift is inferred.

## Coverage after V29

| Measure | V28 | V29 |
|---|---:|---:|
| Projects / communities | 1,645 / 215 | 1,645 / 215 |
| Historical aggregate rows | 563,738 | 564,920 |
| Series | 15,126 | 15,182 |
| Sources | 3,291 | 3,292 |
| Events / event exposures | 105 / 7,382 | 105 / 7,382 |
| Direct subject sale-history records | 361 | 371 |
| New sale-history series | 0 | 56 |
| New sale aggregate cells | 0 | 1,182 |
| Approved annual forecast records through 2080 | 0 | 0 |

All 1,860 records still carry annual scenario slots for **2027–2080**, but unsupported values remain null. Complete lifetime sale and signed-rent histories remain unestablished across the catalogue. This batch improves observed sale coverage; it does not establish that every applicable historical period is complete.

The 42,780-item research checklist now has **3,209 present, 3,438 partial, 26,833 missing and 9,300 unestablished** requirements. **39,571 (92.50%) remain unresolved.** This is a checklist status ratio, not the percent of financial data, price history, project milestones or events covered. Project identity candidates fall from 258 to 247; the unresolved identity work remains open.

## Validation and publication

`scripts/prepare-dld-verified-project-cohorts-20261008.py` verifies the pinned source checksums, exact register identities, unique transaction IDs, positive amounts and areas, DLD price formula, minimum sample rule, quarantine counts and aggregate-only output. `tests/historical-v29-dld-verified-project-sales.test.mjs` checks identity, source vintage, sparse suppression, immutable row counts, no transaction-level redistribution, preservation of all 1,860 catalogue records, and the unapproved 2080 forecast state.

The release process is documented in [HISTORICAL_PRODUCTION_RELEASE.md](../../HISTORICAL_PRODUCTION_RELEASE.md). The V29 snapshot was published to production R2/D1 from an expiring, authenticated, version-scoped publisher. It wrote **2,137 immutable objects**, reused **49 checksum-identical objects**, and verified **39,361 D1 index statements** plus the snapshot header. Exact published table counts are 1,860 records, 3,292 sources, 105 events, 7,382 exposures, 15,182 series and 11,540 record-series links; publication state is `complete`. The local immutable-storage round-trip independently passed with the same counts and confirmed that a repeat publication reuses all 2,186 archive objects.

The exact Worker preview passed `scripts/verify-history-release.mjs`: 1,860 records and all 42,780 checklist entries, 105 events, 3,292 sources, 7,382 exposures and all 56 new series / 1,182 native aggregate points matched the V29 snapshot. Production Worker `psr-portfolio-map-v2`, version `02cdc3bb-f93a-47de-9b4d-701d7dc553be`, now serves **100% traffic** in deployment `077623cf-582e-4d70-9c88-dc9e7f524773`. Live `/map` returns HTTP 200 with the V32 palette assets; the live historical API reports V29 and passed the same full ledger/event/new-series verification. The `/map*` shell route remains unchanged and `DATA_ROOM_PUBLIC=false`.

`npm run verify`, the production Wrangler dry run and `npm run history:verify:storage` passed. The temporary publisher was scoped to this snapshot root, protected by a short-lived token and deleted after verification. The Supabase control-plane release registry is reconciled separately; source sync remains `pending_merge` until PR #98 merges.

## Next research actions

1. Continue exact DLD-name and project/developer/area reconciliation for the 247 remaining project identity candidates; keep every ambiguous title quarantined.
2. Expand subject-specific sale coverage beyond these 11 Dubai projects and preserve sparse observations even when they do not meet the display threshold.
3. Source signed rents, dated valuations, completion/occupancy milestones and all applicable event exposures separately; keep asking prices, registered sales and valuations in distinct evidence classes.
4. Resolve source-period gaps per record and report genuine pre-applicability only where dated evidence supports it. Where records or lawful public sources are inaccessible, leave the gap open.
5. Specify annual downside/base/upside assumptions through 2080, then validate only the periods supported by historical inputs. A specified scenario is not a verified outcome or a long-horizon accuracy claim.
