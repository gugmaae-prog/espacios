# V22 DLD exact-project sales — production receipt, 8 October 2026

## Release identity

- Source PR: [#85](https://github.com/gugmaae-prog/espacios/pull/85), merged
- Merge commit: `fd7e9993a60abcf63402f31527d2e6b79ca77ae5`
- Snapshot: `20261008-enrichment-v22`
- Snapshot root SHA-256: `b0d09d29026776ac15bfb28b4f7d5857f8c927d38eab6135a5c71122f1898375`
- Frontend palette release: `20261008-map-palette-v25`
- Cloudflare Worker: `psr-portfolio-map-v2`
- Worker version: `14de53a0-553e-4213-8819-d849ff15a381`
- Deployment: `70d73cb8-b9e3-4a28-9060-500a4c49c12b`, serving 100% traffic
- Supabase release registry and runtime config: reconciled to V22/V25
- Data Room: `DATA_ROOM_PUBLIC=false`

## Sourced additions

The source is the [Dubai Land Department transactions dataset](https://data.dubai/en/l/470061), with project, developer and area identities checked against the official [project register](https://data.dubai/en/l/467654), [developer register](https://data.dubai/en/l/462802) and [area register](https://data.dubai/en/l/465592). Exact source IDs and project-by-project evidence are recorded in `data/historical-intelligence/dld-20261007-eight-project-sales-enrichment.json`.

The pass adds **2,067 unique sale registrations** for eight exact projects: Lacina, South Living, South Square, Amaal 8, Elle Residences, One River Point, Azizi Riviera Beachfront and Signature Mansions. The registration-date span is 13 January 2022 through 6 October 2026. DLD `instance_date` is a registration date, not a contract or transfer date.

The additions comprise **164 monthly** and **73 quarterly** cohort points. The frequencies overlap and cannot be added as independent transactions. **54** cells meet the existing minimum sample size of 20 and publish medians/quartiles; **183** sparse cells retain counts and date spans while withholding price statistics. Signature Mansions has only sparse cells. The source publication timestamp is unknown; the data was first retrieved on 8 October 2026 and is not admissible in backtests dated before that retrieval.

Raw transaction IDs and transaction-level prices are not redistributed. The transformation, price formula, filters, source checksums and reproducible extraction requirements are documented in [the cohort method note](../dld-exact-project-cohorts-2026-10-08/README.md). The source count and date range describe this retrieved snapshot, not continuous market coverage or a first-ever sale.

## Preservation and publication

V22 preserves all **1,860 records** (1,645 projects and 215 communities), 105 events and 7,382 event-exposure links. Against V21 it retains 3,244 prior sources, 14,771 prior series, 548,242 prior history rows and 11,129 prior record-series links, then adds seven sources, 18 series, 237 points and 18 record-series links. The final snapshot has 3,251 sources, 14,789 series, 548,479 published history rows and 11,147 record-series links. The 216 rights-pending input rows remain excluded.

The authenticated publisher wrote **2,070** immutable objects and reused **46** byte-identical objects. It applied **38,535** index statements and read back exact D1 counts for records, sources, events, exposures, series and record-series links before marking V22 complete. The earlier V21 snapshot remains preserved. The temporary authenticated publisher Worker, token and local release files were removed after the release.

## Validation and live acceptance

- `npm run verify` passed all **166 repository tests**; the V22 cohort check passed.
- Preservation comparison passed with no loss of prior records, sources, series, points, event links or record-series links.
- `npm run history:verify:storage` passed full local immutable-storage publication, indexed counts, API hydration and repeat-publication reuse.
- Production Wrangler dry-run passed with the existing D1, R2 and service bindings and the Data Room still restricted.
- The production history publisher verified the exact snapshot root, object bytes, D1 indexes and complete publication state.
- Live `/map` returned HTTP 200 with V25 assets. The Cloudflare route remains `espacios.me/map*` to `espacios-map-shell`; its `MAP` service binding targets `psr-portfolio-map-v2` in production.
- Live record history returned V22. All **18** new exact series were loaded through their native-series API paths: **237/237** points, comprising 54 price-statistic and 183 sparse points. Large records use explicit series and point pagination; a default page does not imply full-history retrieval.
- Supabase runtime config and its newest release registry row match V25, the V22 root, Worker version/deployment, coverage limits and restricted Data Room.

## Coverage and limits

The 42,780-item evidence checklist marks **3,106 present, 3,433 partial, 26,941 missing and 9,300 unestablished**. Therefore **39,674 items (92.74%) remain unresolved**. This is a requirement checklist measure, not a percentage of missing prices.

V22 provides some direct sale evidence for the eight projects but does not establish their complete histories, signed rent histories, actual completion or occupancy, current valuations, or causal event effects. The catalogue's complete lifetime financial history remains unestablished and **zero annual forecasts through 2080 are approved**. Annual scenario slots through 2080 are not observed data or validated predictions. Keep missing and unavailable periods visible and continue sourcing the remaining records.
