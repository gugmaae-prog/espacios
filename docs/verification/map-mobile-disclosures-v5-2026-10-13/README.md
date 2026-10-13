# Map V5 mobile disclosures release receipt — 13 October 2026

**Status: deployed at 100% traffic and verified at [espacios.me/map](https://espacios.me/map).** This is a frontend-only Map release. It preserves the V46 immutable evidence root and does not add, alter or infer any financial, lifecycle, event or scenario observation.

## Delivered Map behavior

- Replaced inherited gold/high-contrast map selection accents with the muted Espacios slate/teal system in the visible Map controls and map selection palette.
- Kept the mobile Map Tools control above the History drawer and reset the horizontal category menu to its visible start when it opens.
- Verified direct phone navigation from History to Explore and from Map Tools to Amenities.
- Added explicit runtime and immutable asset markers: `20261013-map-mobile-disclosures-v5`.

## Preserved historical evidence

| Field | Verified value |
| --- | --- |
| Evidence version | `20261013-enrichment-v46` |
| Immutable archive/root SHA-256 | `9912e0a2c673160168f5f223ec67c482e230db5bca51a532d4fe0d2e64eea672` |
| Canonical snapshot-file SHA-256 | `9e32d607d01b6e9e0a6d4ce2da5f689f7df6bb8ecb50d5adb0283d1f8ea005b8` |
| Records | 1,860: 1,645 projects and 215 communities |
| Native historical rows / series | 633,891 / 16,872 |
| Sources / events / exposures | 3,367 / 105 / 7,382 |
| V46 lifecycle facts / exact identities | 39 / 9 |
| New financial observations in this release | 0 |
| Research-complete status | `false` |

The V46 ledger remains 3,342 present, 3,413 partial, 26,725 missing and 9,300 unestablished requirements. That is 39,438 unresolved requirements of 42,780 (92.1879%). It is not a measure of missing lifetime prices and does not establish complete historical, present or forecast coverage.

This release does not certify full historical prices or rents, actual completion or occupancy where evidence is absent, causal event effects, observed post-cutoff outcomes, or a validated 54-year forecast. Those fields remain explicitly missing, conditional or unvalidated until evidence supports them.

## Deployment and validation

| Check | Result |
| --- | --- |
| Source revision | `f1b54bbaf29ff88e1d26ae39e34ceef073c8b05e` |
| Worker version / traffic | `9f4b75e8-802d-49a6-84a8-79b679709145` / 100% |
| Cloudflare deployment | `54a7542c-a49c-4230-9edc-4210a8cc4893` |
| Candidate tag | `map-mobile-disclosures-20261013-v5` |
| Candidate API | Passed with the V46 evidence version and immutable root |
| Canonical API | Passed at `https://espacios.me`; V46 root and release metadata match |
| Browser acceptance | Passed at desktop and 390×844 mobile: runtime markers, immutable asset URLs, History, Explore, Map Tools, Amenities, evidence labels and 2080 endpoint |
| UI hit test | At 390px, Amenities is visible, starts at horizontal scroll `0`, is above the History drawer, and receives the trusted pointer target |
| Source CI / safety | Passed: [CI](https://github.com/gugmaae-prog/espacios/actions/runs/38399288446) and [guardrails](https://github.com/gugmaae-prog/espacios/actions/runs/38399288385) |
| Supabase control plane | Production runtime and append-only release registry reconcile to V5 / V46; `research_complete=false` |
| Data Room | Still restricted: `DATA_ROOM_PUBLIC=false`; `/map/data-room` returned `404` and is not indexed |

The post-release browser acceptance guard also asserts both runtime V5 markers and the versioned JS/CSS URLs, so a cached older frontend cannot pass as this release. Its only purpose is verification; it does not change the published data snapshot.

Evidence is recorded in [release.json](release.json), [canonical API record history](canonical-record-history.json), [canonical UI acceptance](canonical-ui.json), [asset headers](http-headers.json), and [control-plane readback](control-plane.json). See the [V46 authority-history receipt](../history-v46-2026-10-13/README.md) for the separate evidence-publication record and the [data sourcing workflow](../../DATA_SOURCING_WORKFLOW.md) for collection, identity, preservation and release rules.
