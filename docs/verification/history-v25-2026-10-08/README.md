# Historical evidence release V25 — 8 October 2026

## What this release adds

This release adds 43 community-context facts derived from the Dubai Land Department (DLD) registered project dataset, [published on Data Dubai](https://data.dubai/en/l/467654). Exact normalized `master_project_en` labels were matched to existing Espacios community records. The matched labels account for 1,829 rows in the 3,039-row source register. The other 1,210 rows were ambiguous or unmatched and were excluded.

The additions provide dated project-register status/count context for those matched communities. They do not add property prices, rents, individual project lifecycle milestones, community boundaries, or forecasts. A register row is not proof of completion, occupancy, market value, or a price trend. Source rows are not redistributed in this repository.

Existing records and historical observations were retained. The original native history partitions were re-encoded as V25 while preserving their series and points. The 43 new facts were appended as community context.

## Coverage at publication

The published snapshot contains 1,860 records: 1,645 projects and 215 communities; 563,675 historical rows across 15,063 series; 3,254 sources; 11,421 record-series links; 105 events; and 7,382 event exposures. The history checklist has 42,780 requirements: 3,148 present, 3,437 partial, 26,895 missing, and 9,300 unestablished. Thus 39,632 requirements (92.64%) remain unresolved. This is not 100% evidence coverage.

The 301,320 annual scenario slots through 2080 have zero approved forecasts. Scenario work must remain conditional, sourced, and clearly separated from observed history. Contextual proxies and research attempts do not count as observed data.

## Validation and production publication

- `npm run verify` passed all 166 tests.
- `npm run history:verify:storage` passed twice against local storage emulation, including checksum verification, repeat-publication reuse, D1 table counts, and V25 history hydration.
- The production configuration dry run passed with existing bindings retained and `DATA_ROOM_PUBLIC=false`.
- The V25 snapshot and indexes were published to the existing R2/D1 pipeline. The Worker was deployed at 100% traffic and live API checks returned the V25 snapshot, 1,860-record inventory, 105 events, 3,254 sources, 7,382 exposures, and 42,780 checklist entries.
- A live sequential detail check verified that each of the 43 matched communities exposes its exact DLD register fact. A parallel live detail verifier encountered a transient network fetch failure; it was not treated as a passing check.

The DLD source file's original publication time is unknown. The release records retrieval and source-file metadata separately; it does not claim that the register was available to a historical investor or forecasting model at an earlier date.

## Next actions

Continue sourcing direct, identity-verified historical sales, rents, lifecycle milestones, and present evidence for the remaining records and periods. Keep incomplete periods visible. Then build and validate conditional annual scenarios through 2080 with dated source availability and realistic downside cases. Do not publish unresolved fields as complete or treat the long horizon as empirically validated.
