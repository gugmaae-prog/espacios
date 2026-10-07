# V19 production release receipt — 8 October 2026

## Release identity

- GitHub PR: [#72](https://github.com/gugmaae-prog/espacios/pull/72)
- Merge commit: `939ef659c01c254639304a9f3baf72f9e1bd1f36`
- Cloudflare Worker: `psr-portfolio-map-v2`
- Worker version: `81b60821-2f69-4582-a403-c45da4180a28`
- Deployment: `cde7d05a-3e36-4bec-af87-9b42cd5f8e72` at 100% traffic
- Data Room: `DATA_ROOM_PUBLIC=false`

## Published history snapshot

V19 (`20261007-enrichment-v19`) is complete in production D1. The immutable
archive root is
`5d2b451187dc838ce1e5198281dce16cdacb702e58fd42c52e296f5556d50fcf`.
Publication verified all **2,073** R2 objects (**2,029 written, 44 reused**)
and **38,072** D1 statements. Final table counts are 1,860 records, 3,240
sources, 105 events, 7,382 event exposures, 14,563 series and 10,921
record-series links. The snapshot keeps all 1,645 projects and 215 communities.

The new pass adds 209,291 exact record-linked DLD-derived transaction rows and
6,803 monthly cohort summaries. The source is a public secondary distribution
under CC BY 4.0, first available on 5 October 2026; its `instance_date` is a
registration date. Monthly medians use exact project/area and transaction
cohorts; 5,001 medians below the 20-transaction threshold remain withheld.
Sparse source rows and their counts are preserved. These latest-vintage data
are not point-in-time inputs for historical investment backtests.

## Release checks

- GitHub CI and Repository Guardrails passed; all **165** repository tests pass.
- `npm run history:verify:storage` verified the full archive, D1 counts, repeat
  publication reuse and paged record retrieval in the local emulator.
- The production-config Wrangler dry run used the verified map Worker, D1 and
  R2 bindings and kept the Data Room closed.
- Production D1 readback confirmed V19 `complete` with the expected root and
  1,860-record catalogue. R2 readback independently checked the root and runtime
  index bytes against their SHA-256 values.
- The uploaded Worker version served a 28-point exact series for project
  `360 Riverside Crescent` and a 184-point area series for `Business Bay`.
  These were paged series checks, not certification of complete record history;
  sparse community months remain explicitly withheld.
- The live event endpoint returned 33 dated event/exposure links for Business
  Bay and retained the `event_evidence_not_causal_price_effects` classification.
- The canonical `espacios.me/map` page returned 200 and reached “Map ready”.
  Visual review confirmed the selected Map control uses the restrained slate
  treatment; gold was an inherited fallback-evidence/decorative accent, not a
  price or appreciation signal. Text and selection remain visible.
- The Supabase production release registry row was inserted and read back with
  the Git SHA, Cloudflare version/deployment, archive root and incomplete-data
  status.
- The temporary history-publisher Worker and its private token/header files
  were removed after publication.

## Evidence limits

This release does not complete lifetime sale/rent histories or certify a
forecast through 2080. Of the 42,780 evidence-ledger requirements, 3,096 are
present, 3,434 partial, 26,950 missing and 9,300 unestablished: **39,684
(92.76%) remain unresolved**. This is a checklist measure, not a percentage of
missing prices. There are **zero approved annual 2080 forecasts**; unsupported
2027–2080 scenarios remain null. The new sale records establish dated
registration evidence only, not first-ever sales, project starts, completions,
occupancy, rents or causal event effects.
