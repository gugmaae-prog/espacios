# V47 authority lifecycle and Map release receipt — 13 October 2026

**Release status: published and verified at [espacios.me/map](https://espacios.me/map).** The immutable V47 snapshot was written to the production R2/D1 history store, validated through an isolated Worker candidate, then activated at 100% traffic. Canonical API, desktop, mobile, Data Room, and Supabase-control-plane checks passed afterward.

V47 adds **15 dated, non-financial Dubai Land Department lifecycle facts** across five exact project identities: five registrations, five dated inspection/progress reports, and five retrieval-date authority-status snapshots. It adds one DLD source. Two malformed literal completion dates were quarantined. It adds **no** registered sales, rent contracts, asking prices, valuations, actual completion, handover, occupancy, appreciation uplift, or approved 2080 forecasts.

The paired Map V2 release preserves the selected date/basket when switching Map and Heatmap, keeps all-date density explicit, and uses the muted Espacios slate/teal interface rather than inherited gold. In density mode, the visible action is **Record history**: it opens the current selected project or community instead of invoking an unavailable price inspector. Native price Details and future assumptions continue to use their own supported views.

## Evidence identity and preservation

| Field | Verified value |
| --- | --- |
| Evidence version | `20261013-enrichment-v47` |
| Frontend release | `20261013-map-heatmap-coverage-v2` |
| Immutable archive/root SHA-256 | `66755b6af985b16b56ea331353769914dfd9cff92678c0fd8e9f0f1e6ddb1240` |
| Canonical snapshot-file SHA-256 | `f188684e8f54d9c90a3f378f0cf1bc25d3efeaf51eea1983b5f0d6ae6422108f` |
| Records | 1,860: 1,645 projects and 215 communities |
| Sources / events / exposures | 3,368 / 105 / 7,382 |
| Native historical rows / series | 633,891 / 16,872 |
| Preserved partition pairs / decoded bytes | 1,091 / 1,476,518,068 |
| Changed record identities | 5 |
| New sources / lifecycle facts | 1 / 15 |
| New financial observations / approved forecasts | 0 / 0 |

`npm run history:verify:v47-preservation` compared all retained V46/V47 native payloads after normalizing the expected evidence-version envelope. It found only that envelope change; retained native series and observations stayed intact.

## Published and independently checked

| Check | Result |
| --- | --- |
| Immutable R2/D1 publication | Complete: 2,491 objects written, 50 reused, and 42,818 D1 index statements verified |
| Candidate API | Passed at the isolated V47 Worker on `2026-10-13T20:10:21.313Z` |
| Candidate canonical-shell browser check | Passed through `espacios.me` using the zero-traffic version override |
| Production traffic | Worker `17ddb204-54ae-4450-82f0-131dfbf95981` received 100% at `2026-10-13T20:14:39.098184Z` in deployment `032d910b-a736-4cf4-a071-3e1d2d8bd3f4` |
| Canonical API | Passed at `https://espacios.me` on `2026-10-13T20:16:32.211Z` |
| Canonical browser acceptance | Passed at desktop 1440×1000 and mobile 390×844, including density Record history, native Details, future assumptions, source labels, events, 2080 endpoint, geometry, and no exceptions |
| Data Room | Remained restricted: `DATA_ROOM_PUBLIC=false`; `/map/data-room` returned `404` with `no-store` / `noindex` |
| Supabase control plane | Runtime and append-only release registry read back V47 root, frontend, Worker and deployment values; `research_complete=false` |

## Requirement accounting

V47 has **3,351 present**, **3,403 partial**, **26,726 missing**, and **9,300 unestablished** requirements. That leaves **39,429 of 42,780 unresolved (92.1669%)**. This is defined-requirement coverage accounting, not a percentage of lifetime property prices that can safely be invented, interpolated, or inferred.

The model retains annual scenario slots from 2027 through 2080, but V47 adds no annual values. A path remains unavailable until it has a valid dated anchor and fully disclosed annual inputs.

## Source synchronization

The deployed Worker and release registry are verified. At release time, the source branch had local commits pending GitHub synchronization, so this receipt deliberately records `local_commits_pending_github_push` rather than claiming a remote source SHA or CI result. That status will be reconciled only after a successful GitHub push and readback.

## Validation record

- `npm test` — full local regression suite passed.
- `npm run history:verify:v47-preservation` — 16,872 series, 1,091 partition pairs and 1,476,518,068 decoded bytes preserved.
- `node scripts/verify-v47-history-release.mjs` — isolated candidate and canonical API contracts passed.
- `node scripts/history-browser-acceptance.mjs` — canonical desktop and mobile acceptance passed.
- Supabase runtime and registry readback — passed with public-safe V47 metadata only.

See [release.json](release.json), [archive.json](archive.json), [publication.json](publication.json), [candidate API](candidate-api.json), [canonical API](canonical-api.json), [deployment.json](deployment.json), [browser acceptance](browser-acceptance.json), [control-plane readback](control-plane.json), [source integrity](source-integrity.json), [native-series preservation](native-series-preservation.json), [tests](tests.json), and the [DLD lifecycle packet](../dld-lifecycle-pass47-2026-10-13/README.md).
