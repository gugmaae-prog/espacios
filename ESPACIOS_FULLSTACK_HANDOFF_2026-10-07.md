# Espacios full-stack handoff — 7 October 2026

Last written: 7 October 2026  
Canonical surface: <https://espacios.me/map>  
Repository: <https://github.com/gugmaae-prog/espacios>  
This file: `ESPACIOS_FULLSTACK_HANDOFF_2026-10-07.md`

This is the current handoff for the map, historical evidence, and the 6 October transaction prints. It does not replace the older workbook contract in `ESPACIOS_FULLSTACK_HANDOFF_PROJECT_LEVEL_INTELLIGENCE_2026-09-24.md`. That September file still describes the Excel scenario model. The live identifiers in `HANDOVER.md` and `docs/architecture.md` are older than the history release recorded below. Read `/map/api/system` before any production change.

## 1. What is live, what is only in git

| Holding | State on 7 October 2026 |
|---|---|
| Public map | Last recorded live history release is snapshot `20261005-enrichment-v9` on Worker `psr-portfolio-map-v2`, version `45c1fc27-420d-4b9c-b276-d1b8c97cd466`, deployment `5248c438-7a04-4e31-9f2c-4d232a8b3dfc`, 100% traffic. Route: `https://espacios.me/map`. Source of that record: `README.md` and merged PR #34. |
| Earlier shell wiring | `docs/architecture.md` records a 3 October map release `20261003-minimal-map-supabase-v2`, version `68e26acc-5fd6-4c2f-8a50-08d11e03156d`, deployment `d5dea762-e3d6-4420-8608-3ac72ea625fb`. Treat that as the prior topology receipt, not the later history receipt. |
| V10 publisher on `main` | `main` contains `.github/workflows/publish-history-v10.yml`, a one-time publisher aimed at snapshot `20261005-enrichment-v10`. This handoff does not record a confirmed live promotion of that snapshot. Re-read `/map/api/system` before assuming v9 is still the served history. |
| Transaction prints | Draft PR [#46](https://github.com/gugmaae-prog/espacios/pull/46), branch `cursor/complete-found-transaction-data-e8cc`, commit `e6df09d`. Not merged. Not deployed. |
| Reviewed pass 21 and pass 22 candidate | Separate draft work for snapshot `20261006-enrichment-v11`. Not the live map. |

The transaction-print packet does not change production by being pushed. `wrangler.jsonc` uses the non-production name `psr-portfolio-map-v2-navigation-candidate` and declares no routes. Production deploys go through `wrangler.production.jsonc` and an explicit Versions and Deployments release. Do not deploy `main` over the live Worker until the served version, bindings, and Data Room gate are re-checked.

## 2. Request path

```text
Browser
  |
  v
Cloudflare route: espacios.me/map*
  |
  v
Worker: espacios-map-shell
  |  canonical title/meta
  |  small /map/api/v1 façade
  |  MAP service binding
  v
Worker: psr-portfolio-map-v2
  |-- embedded map HTML, CSS, and JavaScript
  |-- catalogue, research, history, and scenario APIs
  |-- Data Room gate
  |-- D1 binding DB
  |-- R2 binding MARKET_R2
  |-- service binding PSR_PROPERTY -> psr-property production
  |-- Workers AI binding AI
  `-- /map/api/control-plane
        |
        v
Supabase Edge Function espacios-map-control
        |
        v
espacios_map_runtime_config
espacios_map_release_registry
```

`psr.espacios.me/map*` can point directly at `psr-portfolio-map-v2`. The product URL is `https://espacios.me/map`.

Supabase is the control and audit plane. It does not replace D1 or R2 market evidence. The control function URL in `wrangler.production.jsonc` is `https://ypkfganbwdvcjrcxygta.supabase.co/functions/v1/espacios-map-control`.

## 3. Bindings

Account `b1b843ec85bc39a3a4d370ba4f84f17a`. Compatibility date `2026-08-20`. Flag `nodejs_compat`.

| Binding | Type | Target |
|---|---|---|
| `AI` | Workers AI | Account AI catalogue |
| `DB` | D1 | `cba-property-db` / `a5165cff-70a5-4685-af87-5ffdcf08652a` |
| `MARKET_R2` | R2 | `psr-market-intelligence` |
| `PSR_PROPERTY` | Service | `psr-property` production |
| `DATA_ROOM_PUBLIC` | Var | `false` |
| `MAP` on the shell | Service | `psr-portfolio-map-v2` production |

`DATA_ROOM_PUBLIC=false` keeps `/map/data-room` restricted: no-store, noindex, no public read. Opening it is a separate access decision.

D1 is shared with other workloads. Map changes stay on map and intelligence tables. Historical publication uses append-only `hi_*` indexes and content-addressed R2 objects. A Worker rollback does not roll back R2 or D1.

## 4. Catalogue and history that the committed snapshot holds

The JSON committed on this branch is still snapshot `20261005-enrichment-v9`, as of `2026-10-05`.

| Measure | Value |
|---|---|
| Records | 1,860 (1,645 projects, 215 communities) |
| Public aggregate observations | 316,608 |
| Collected rows including rights-pending | 316,824 |
| Rights-pending rows withheld | 216 |
| Sources | 2,846 |
| Sourced facts | 3,946 |
| Dated events | 92 |
| Event exposures | 5,682 |
| History series | 13,158 |
| Projects with direct subject sale history | 239 |
| Projects with direct subject rent history | 89 |
| Approved forecasts through 2080 | 0 |

Checklist across 42,780 requirement items:

| Status | Items |
|---|---|
| Present | 3,644 |
| Partial | 2,153 |
| Missing | 27,683 |
| Unestablished | 9,300 |

39,136 items are unresolved. That is 91.48% of the checklist. It is a requirements ledger, not a claim that 91.48% of prices are absent. The 316,608 observations are real retained aggregates. They do not certify a complete lifetime history for any record.

No record has a dated valuation. Verified completion is present on 3 projects. Verified occupancy is present on 1. Annual 2027–2080 slots exist as conditional scenarios with null values where the anchor is missing. A scenario is not a validated forecast.

## 5. Transaction prints found on 6 October 2026

User-supplied DXB Interact area prints. Publisher pages are `https://dxbinteract.com/` with per-sale `https://dxb.is/` links where the PDF contains them. Retrieval date `2026-10-06`. Raw PDF bodies stay outside the public repo. The structured extract is in git.

| Measure | Value |
|---|---|
| PDF files hashed | 33 |
| Distinct SHA-256 values | 21 |
| Areas | 20 |
| Printed sales, Downtown Dubai counted once | 5,651 |
| Transactions stated on the cards, Downtown counted once | 62,392 |
| Stated sales that are not on the pages | 56,741 |

Pages whose printed rows equal the card count:

- Arancia Yards By Beyond, City of Arabia: 247 sales
- Nad Al Sheba: 4 sales

The other 18 areas stop at 300 printed rows while the card count is higher. Those missing sales were not invented. Identical PDF bytes share one extract. The two Downtown Dubai files differ in bytes and match on every sale, so both extracts are kept and are not added together.

Rent amounts are not on these pages. A rental yield is kept only where the card prints a number. A percent sign with no number stays null.

Grain rule, in `scripts/weekly_requirement_fill.py`:

- Keep daily rows when the series is under 400 points and the printed rows match the stated count.
- Otherwise store ISO weeks (`YYYY-Www`, Monday–Sunday) for the retained rows.
- A week with fewer than 7 observed days is partial. Days inside it are not independent daily observations.
- A weekly price is not written when the sample weight is missing.
- Weekly fill does not create the 56,741 sales that were never printed.

Receipts:

- `enrichment/transaction-snapshots-20261006/completion.json`
- `enrichment/transaction-snapshots-20261006/manifest.json`
- `enrichment/transaction-snapshots-20261006/analysis.json`
- `enrichment/weekly-requirement-fill-20261006/packet.json`
- `docs/TRANSACTION_SNAPSHOT_TRENDS_20261006.md`

These rows are area or named-development context. They are not copied onto a catalogue project as subject transactions unless the print names that project and the community on the row agrees. Bedroom or unit quotes do not replace a project headline asking price. `currentSnapshotEligible=false`, or a bedroom, unit, or floorplan qualifier, keeps the quote as evidence only.

## 6. Source rules

1. Registry and official project records outrank portals.
2. A developer or government page can support a dated launch, announcement, construction, or delivery fact for the named subject.
3. Area medians, card year-over-year percents, and printed sale lists stay at the geography the page names.
4. A similar name is not an identity. Town Square is not Town Square Dubai. The Oasis (All Phases) is not the catalogue record The Oasis. Arancia Yards By Beyond is not the whole of City of Arabia.
5. A handover target is not completion or occupancy.
6. A year-over-year percent on a card is one stated comparison. The year-ago level is not printed, so it is not back-calculated.
7. Missing periods stay missing. Do not borrow Dubai prices into another emirate, and do not turn a community aggregate into a project sale.

## 7. Repository map

| Path | Role |
|---|---|
| `src/worker.js` | Worker with embedded assets. Regenerated by `npm run build:smart`. |
| `src/historical-intelligence/` | History API, coverage, event studies, and 2027–2080 scenario slots. |
| `src/assets/` | Editable map shell. |
| `scripts/build-historical-data.py` | Rebuilds the reviewed snapshot from checksummed inputs. No network. |
| `scripts/extract_transaction_snapshots.py` | Parses the DXB Interact prints. `--check` compares a re-parse to the packet. |
| `scripts/weekly_requirement_fill.py` | Daily versus weekly requirement fill. |
| `scripts/historical_enrichment.py` | Reviewed fact merge and headline-quote guard. |
| `scripts/historical_gap_ledger.py` | Per-item coverage. Presence is not a complete history. |
| `data/historical-intelligence-20261003.json` | Committed canonical snapshot. On this branch it is still v9. |
| `data/historical-intelligence/` | Publication manifest, runtime index, and content-addressed objects. |
| `wrangler.jsonc` | Candidate Worker. No production routes. |
| `wrangler.production.jsonc` | Production name and bindings. No routes in the file. The shell owns the public route. |
| `migrations/0001_historical_intelligence.sql` | Additive `hi_*` schema. Do not run the legacy rebuild against production. |

## 8. Commands

Node 22 or newer.

```sh
npm ci
npm run verify
npx wrangler deploy --config wrangler.production.jsonc --dry-run --outdir .wrangler/dry-run
```

History, still local and non-publishing:

```sh
npm run history:build
npm run history:weekly-fill
npm run history:publish:plan
python3 scripts/extract_transaction_snapshots.py --check \
  --pdf-dir /absolute/path/to/pdfs \
  --out enrichment/transaction-snapshots-20261006 \
  --doc docs/TRANSACTION_SNAPSHOT_TRENDS_20261006.md
```

`npm run verify` runs `build:smart`, syntax checks, and the test suite, including the transaction-print and weekly-fill tests. `history:publish:plan` prints a dry-run manifest. It does not write production R2 or D1.

Local preview, when used, is `node scripts/preview-smart.mjs` and `http://localhost:8798/map`. It must not call production mutation endpoints.

## 9. Release gate

Before a production promotion:

1. Read the active shell and map version from `/map/api/system`.
2. Preserve bindings, compatibility date, and `DATA_ROOM_PUBLIC=false` unless a separate decision opens the Data Room.
3. Build the candidate snapshot and run preservation against the snapshot that is actually committed, not an older baseline.
4. Run `npm run verify` and a production Wrangler dry run.
5. Upload a candidate Worker version with inherited bindings. Send no traffic first.
6. Check desktop and mobile history, the new-cohort rows, the item ledger, assets, geography, and the existing API fingerprints.
7. Promote that exact version. Record version UUID, deployment UUID, git SHA, and the snapshot id.
8. Keep the previous version for rollback.

The transaction prints are not ready for that gate until PR #46 is reviewed. Merging the packet into git is not a deployment. Publishing it also requires the preservation and preview checks above. The 56,741 unprinted sales cannot be part of that release.

## 10. What the next engineer still has to find

In order:

1. The sales named on the cards and absent from the 300-row prints. That is 56,741 transactions across 18 areas. A new export has to include those rows. Do not estimate them from the median.
2. Subject sale and rent histories for the 1,406 projects with no direct sale history and the 1,556 projects with no direct rent history.
3. Verified launch, completion, and occupancy dates. Launch is missing on 1,605 projects. Completion is missing on 1,634. Occupancy is missing on 1,644.
4. Dated valuations and service-charge budgets. None of the current records has a dated valuation.
5. Rent amounts. The prints have yields, not rents.
6. A forecast evaluation that can be accepted. The retained backtest stays `backtestAccepted: false`. The 2027–2080 slots stay scenarios.

Identity-gated primary pages remain the way to add launch and construction facts. Area prints remain area context. Weekly series are the fill grain when a daily list is too heavy to retain losslessly. Neither one closes a lifetime history by itself.
