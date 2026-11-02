# V46 authority lifecycle release receipt — 13 October 2026

**Release status: published and verified as an interim V46 data release.** The immutable V46 snapshot was published to the production R2/D1 history store, a dedicated Worker candidate was verified, and that exact Worker version received 100% production traffic. The canonical API and browser checks then passed at `https://espacios.me`.

This is deliberately an **interim data-release receipt**, not a claim about a later combined mobile-interface deployment. The active V46 Worker/version fields below may be superseded by the authorized mobile-only release; that follow-on release must preserve the V46 immutable evidence root and receive its own candidate, canonical and traffic receipts.

V46 adds 39 dated, non-financial DLD authority facts across nine exact project identities. It contributes eight registrations, eight filed project-start dates, five scheduled completion dates, nine dated construction-progress reports and nine retrieval-date authority-status snapshots. Two DLD source revisions are added. The three literal `01/01/1` completion values for Sobha One, Address Residences Zabeel and Binghatti Hills are quarantined rather than repaired.

The release does **not** add registered sales, rent contracts, asking prices, valuations, actual completion, handover, occupancy, a price uplift, or an approved 2080 forecast. A 100% dated inspection and a current DLD status display remain source evidence with their stated scope; neither is converted into an actual-completion or occupancy claim.

## Evidence identity and preservation

| Field | Verified value |
| --- | --- |
| Evidence version | `20261013-enrichment-v46` |
| Immutable archive/root SHA-256 | `9912e0a2c673160168f5f223ec67c482e230db5bca51a532d4fe0d2e64eea672` |
| Canonical snapshot-file SHA-256 | `9e32d607d01b6e9e0a6d4ce2da5f689f7df6bb8ecb50d5adb0283d1f8ea005b8` |
| Records | 1,860 (1,645 projects and 215 communities) |
| Sources / events / exposures | 3,367 / 105 / 7,382 |
| Native historical rows / series | 633,891 / 16,872 |
| Changed record identities | 9 |
| New sources / facts | 2 / 39 |
| New registered sales / rents | 0 / 0 |
| Approved annual 2080 forecasts added | 0 |

`npm run history:verify:v46-preservation` compared every V45/V46 native-series payload after normalizing the release version string in the partition envelope. It verified 16,872 series, 1,091 partition pairs and 1,476,518,068 combined decoded bytes. All payload differences were the expected top-level V45-to-V46 version replacement; no native observation or series metadata changed.

## Published and independently checked

| Check | Result |
| --- | --- |
| Immutable R2/D1 publication | Complete: 2,491 objects written, 50 reused and all declared D1 indexes verified |
| Candidate API | Passed at the isolated V46 Worker URL on `2026-10-13T11:24:10.677Z` |
| Candidate scope | Exact root, 1,860-record ledger, global events/exposures, nine selected records and 39 lifecycle facts verified |
| Production traffic | V46 Worker version received 100% traffic at `2026-10-13T11:25:58.190882Z` |
| Canonical API | Passed at `https://espacios.me` on `2026-10-13T11:26:06.569Z` |
| Canonical browser acceptance | Desktop and mobile history views passed, including source links, event labels, 2080 scenario endpoints, responsive geometry and no page exceptions |
| Data Room | Remained restricted (`DATA_ROOM_PUBLIC=false`); `/map/data-room` returned `404` during API verification |
| Supabase control plane | Production runtime and append-only release registry read back with V46 history/root and `research_complete=false` |

The active interim V46 Worker version is `56d24e27-4c41-4d2a-be13-2fde1e7ce889`; its traffic deployment is `5976084d-c5fd-4d70-b382-1de452a1a8f5`. Its pre-existing frontend marker was `20261012-map-evidence-v48`. The evidence release remains V46 even when a later frontend-only release changes the Worker/deployment marker.

## Requirement accounting

The V46 checklist is 3,342 present, 3,413 partial, 26,725 missing and 9,300 unestablished requirements. That leaves 39,438 of 42,780 requirements unresolved (92.1879%). This is coverage accounting for defined requirements; it is not a percentage of lifetime prices that can be inferred from the data.

Annual scenario slots retain the exact 2080 endpoint, but V46 does not fill unavailable annual values or present unapproved conditional assumptions as observations.

## Validation record

- `python3 tests/dld-authority-pass46.py` — 3 checks passed.
- `python3 tests/dld-lifecycle-pass46.py` — 3 checks passed.
- `node --test --test-concurrency=2 tests/historical-v46-authority-lifecycle.test.mjs` — 2 tests passed.
- `node scripts/verify-historical-archive.mjs` — 1,860 records and all 2,542 retained immutable objects verified against the canonical snapshot-file SHA above, with no remote writes.
- `npm run history:verify:v46-preservation` — native-series preservation check passed.
- `npm run verify` — local full verification suite passed after the V46 preservation guard was added.
- V46 source CI and public-repository safety checks passed: [verification run](https://github.com/gugmaae-prog/espacios/actions/runs/38386782396) and [safety run](https://github.com/gugmaae-prog/espacios/actions/runs/38386782414).

See [archive.json](archive.json), [native-series-preservation.json](native-series-preservation.json), [tests.json](tests.json), [source-integrity.json](source-integrity.json), [publication.json](publication.json), [candidate-api.json](candidate-api.json), [canonical-api.json](canonical-api.json), [deployment.json](deployment.json), [control-plane.json](control-plane.json), and the [DLD lifecycle packet](../dld-lifecycle-pass46-2026-10-13/README.md).
