# V31 DLD community Ejari cohorts — 8 October 2026

## Candidate state

V31 is a locally built, verified candidate based on the published V30 snapshot. Production publication and live API verification are pending.

## Source and identity

The pass uses the public [Dubai Land Department Ejari rent-contract export](https://data.dubai/en/l/468586), with attribution under the [Dubai Open Data terms](https://data.dubai/en/terms-conditions). It reads the official bulk-file snapshot dated 7 October 2026, first verified in this capture on 8 October at 15:53:50 UTC; the original publication timestamp is unknown.

A native `master_project_en` label is retained only when it matches exactly one unique Dubai community catalogue name after Unicode/case/spacing/punctuation normalization. Each DLD `area_id` and `area_name_en` stays a separate cohort. The DLD master-project label is the observation geography, not a legal boundary. Residential use, business/property type, subtype, and registration type remain separated. These aggregates can overlap the exact-building project-rent cohorts, so the two levels are non-additive.

## Reconciliation

- Preserves all **1,645 projects, 215 communities, and 1,860 records**.
- Adds **45 exact-match community records**, **1,690 series**, and **68,887 monthly/quarterly aggregate points**.
- Retains **1,447,212 unique eligible residential contracts** from 10,573,532 source rows; **2,631 duplicate contract IDs** and their repeated rows are quarantined.
- Uses **37 native DLD area IDs**. **23,604 cells** meet the n ≥ 20 median/quartile threshold; **45,283 sparse cells** preserve counts and dates with financial statistics withheld.
- Contract-start coverage in the retained source spans **2007-12-30–2026-10-07**. The first date is not evidence of first-ever lease activity or complete lifetime history. October and Q4 2026 are partial through the source cutoff.
- Adds **43 present** and **2 partial** direct signed-rent checklist records among communities. Overall status moves from 89 present + 1 partial to **132 present + 3 partial**, with **1,725 still missing**. Complete lifetime rent history remains unestablished for all 1,860 records.
- Retains **0 approved numeric forecasts through 2080**; this pass changes no scenario outcomes.

The privacy-safe packet is `data/historical-intelligence/dld-community-ejari-rent-pass31-20261007.json.gz`. Original CSV files and temporary contract-key database stay in ignored `.local-data` and are removed from scratch after aggregation. No contract IDs, tenant fields, raw rows, or individual rent amounts are emitted.

## Validation

`node --test tests/historical-data.test.mjs tests/historical-v25-dld-community-register.test.mjs tests/historical-v26-dld-derived-project-register.test.mjs tests/historical-v29-dld-verified-project-sales.test.mjs tests/historical-v30-dld-ejari-refresh.test.mjs tests/historical-v31-community-ejari-rent.test.mjs` passed **18 tests**. This covers the full record universe, immutable V30 evidence and events, exact DLD labels/areas, unique source IDs, sparse-statistic withholding, contract-ID exclusion, and unchanged incomplete-history/2080-forecast status. Full `npm run verify`, remote publication, and live API parity are still pending.
