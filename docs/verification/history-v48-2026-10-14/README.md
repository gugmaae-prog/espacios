# V48 Emaar lifecycle release receipt — 14 October 2026

**Release status: published and verified on [espacios.me/map](https://espacios.me/map) on 14 October 2026.** This is a historical release receipt; it records that date's verified deployment and does not assert which Worker version is serving traffic now.

V48 preserves the fixed inventory of **1,860 records** and adds **five dated, non-financial lifecycle/context facts** from three public Emaar sources to three exact DLD-matched Dubai projects:

- **Terra Heights** — one exact-day launch statement dated 14 November 2024.
- **Palace Residences Dubai Hills Estate** — a reported bounded launch window and two developer aggregate sales-status reports.
- **Address Residences Zabeel** — one developer aggregate sales-status report.

The aggregate reports remain lifecycle/context evidence. They do not become individual registered sales, unit prices, rent observations, valuations, actual completion, handover, occupancy facts, appreciation claims, or approved forecasts.

## Evidence identity and preservation

| Field | Verified value |
| --- | --- |
| Evidence version | `20261014-enrichment-v48` |
| Frontend release | `20261013-map-heatmap-coverage-v2` |
| Immutable archive/root SHA-256 | `ca1133d5169abc0bc2aec24eb193719018e47a3e9d06c773a951b9cc9a7424a0` |
| Canonical snapshot-file SHA-256 | `bbb7c8037a11221e94843d6be0882d073a9fea7550aa0748435c9a806e89ecc7` |
| Records | 1,860: 1,645 projects and 215 communities |
| Sources / events / exposures | 3,371 / 105 / 7,382 |
| Native historical rows / series | 633,891 / 16,872 |
| Preserved partition pairs / decoded bytes | 1,091 / 1,476,518,068 |
| Changed record identities | 3 |
| New primary sources / lifecycle facts | 3 / 5 |
| New financial observations / approved forecasts | 0 / 0 |
| Retained V47 authority facts | 15 |
| Target scenario slots | 2027–2080; no approved annual values |

`npm run history:verify:v48-preservation` compared all retained V47/V48 native payloads after normalizing only the intended evidence-version and as-of envelope. The 16,872 retained series stayed intact.

## Published and independently checked

| Check | Result |
| --- | --- |
| Immutable R2/D1 publication | Complete: 2,491 objects written, 50 reused, and 42,821 D1 index statements verified |
| Candidate API | Passed at isolated V48 Worker on `2026-10-14T03:11:06.333Z` |
| Candidate canonical-shell browser check | Passed through `espacios.me` using the zero-traffic version override |
| Production traffic | Worker `f3dc3db9-4796-4856-9b01-e2198319eae6` received 100% at `2026-10-14T03:13:58.482396Z` in deployment `c29153a2-7e59-46e2-9854-b6f5b952a168` |
| Canonical API | Passed at `https://espacios.me` on `2026-10-14T03:14:08.351Z` |
| Canonical browser acceptance | Passed at desktop 1440×1000 and mobile 390×844, including evidence labels, events, conditional 2080 scenarios, geometry, and no browser exceptions |
| Data Room | Remained restricted: `DATA_ROOM_PUBLIC=false`; `/map/data-room` returned `404` with `no-store` / `noindex` |
| Supabase control plane | Runtime config and append-only registry reconciled to V48; `research_complete=false` |

## Requirement accounting

V48 has **3,352 present**, **3,404 partial**, **26,724 missing**, and **9,300 unestablished** requirements. That leaves **39,428 of 42,780 unresolved (92.1646%)**. This is defined-requirement accounting; it is not a percentage of property prices or rents that can safely be invented, interpolated, or inferred.

The model retains annual scenario slots from 2027 through 2080. V48 adds no annual forecast values. A numerical path remains unavailable until it has a valid dated anchor and complete disclosed annual inputs.

## Source synchronization

The Worker release and control-plane registry were reconciled. At release time, source changes were still pending GitHub synchronization, so the release records `local_commits_pending_github_push` rather than inventing a remote source SHA or CI result. GitHub synchronization and production deployment are separate controls.

## Validation record

- `npm test` — full local regression suite passed.
- `npm run history:verify:v48-preservation` — 16,872 series, 1,091 partition pairs and 1,476,518,068 decoded bytes preserved.
- `node scripts/verify-v48-history-release.mjs` — isolated candidate and canonical API contracts passed.
- `node scripts/history-browser-acceptance.mjs` — canonical desktop and mobile acceptance passed.
- Supabase runtime and registry readback — reconciled with public-safe V48 metadata only.

See [release.json](release.json), [archive.json](archive.json), [publication.json](publication.json), [candidate API](candidate-api.json), [canonical API](canonical-api.json), [deployment.json](deployment.json), [browser acceptance](browser-acceptance.json), [control-plane readback](control-plane.json), [source integrity](source-integrity.json), [native-series preservation](native-series-preservation.json), [tests](tests.json), and the [Emaar lifecycle packet](../../../data/historical-intelligence/emaar-primary-lifecycle-pass48-20261014.json).
