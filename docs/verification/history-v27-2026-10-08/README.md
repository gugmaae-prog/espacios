# V27 Palm Jebel Ali construction evidence — production receipt

Published 8 October 2026 as `20261008-enrichment-v27`. This release preserves the V26 snapshot and appends six dated construction-progress facts to the existing `community:Dubai:palm-jebel-ali` record. It does not add financial observations or forecasts.

## Source and evidence

- Publisher: Nakheel PJSC, [Palm Jebel Ali construction progress](https://www.nakheel.com/en/construction-progress/palm-jebel-ali).
- Nakheel attributes the six percentages to an internal inspection dated **10 March 2026**. The page does not provide its publication date; first availability is therefore the retrieval timestamp, `2026-10-08T12:22:14Z`.
- The captured page body was 130,504 bytes with SHA-256 `9f5c8ccaa4ed0d9f31a5fa540eb67413c800889a7457d0d38c36b1e193d2615c`. The page text and images are not redistributed. The previous source revision `community-source-3f0086a63c58a673` is retained unchanged; V27 records a separate revision.
- The values are Nakheel-reported internal-inspection snapshots, not independent or RERA-verified measurements:

| Frond | Reported progress | Inspection date |
|---|---:|---|
| K | 27.71% | 10 March 2026 |
| L | 24.71% | 10 March 2026 |
| M | 22.10% | 10 March 2026 |
| N | 29.20% | 10 March 2026 |
| O | 37.44% | 10 March 2026 |
| P | 20.50% | 10 March 2026 |

Nakheel's page also displays 26.75% overall progress without a date. V27 excludes that undated value. Frond-level values are not averaged or generalized to the whole island, individual villas, or unlisted phases. They establish neither completion nor handover, occupancy, property prices, appreciation, or a forecast input.

## Preservation and coverage

| Measure | V26 | V27 |
|---|---:|---:|
| Projects | 1,645 | 1,645 |
| Communities | 215 | 215 |
| Historical rows | 563,675 | 563,675 |
| Series | 15,063 | 15,063 |
| Sources | 3,254 | 3,255 |
| Events / event exposures | 105 / 7,382 | 105 / 7,382 |
| Record-series links | 11,421 | 11,421 |
| Palm Jebel Ali lifecycle facts | 12 | 18 |
| New sale, rent or valuation observations | 0 | 0 |
| Approved annual scenario values through 2080 | 0 | 0 |

Palm Jebel Ali already had a present construction-evidence status in V26. V27 adds six phase-specific dated facts without changing the 42,780-item checklist. The existing ledger remains 3,163 present, 3,437 partial, 26,880 missing and 9,300 unestablished: **39,617 unresolved (92.61%)**. This is a research-requirement rate, not the percentage of price history present. This pass does not improve financial or forecast coverage.

The broader collection contains 563,891 historical rows; 216 rights-pending rows remain excluded from the published total. All 1,860 catalogue records and every previous observation remain intact.

## Publication and live verification

- Snapshot root: `fbb97f2a2dbb850bc9306b1c1126358194390b762135d655256dbfc7963e8dd2`.
- Canonical snapshot SHA-256: `cf64b5561a1f623f64d89b1cd74f908a8ffa53dcd7d86290b1f4c4147b5cfba3`.
- D1 index SHA-256: `8e938ceb623717d0580814c313f0e6e40788df7ae18636189bd7f4bb52b9b67b`.
- The publisher verified 2,179 immutable objects: 2,131 written and 48 matching objects reused. It indexed 39,086 D1 rows plus one snapshot header. Every table count matched: 1,860 records, 3,255 sources, 105 events, 7,382 exposures, 15,063 series and 11,421 record-series links. Publication state is `complete`.
- Cloudflare Worker `psr-portfolio-map-v2`, version `770fc925-5de5-4ffe-81cb-dc9ab4fc6c83`, serves 100% traffic in deployment `61d9ea83-6cc7-4b9d-a872-9204bc81822d`.
- Live `https://espacios.me/map/api/record-history?recordId=community%3ADubai%3Apalm-jebel-ali` returned V27 and all six expected progress facts. The live system and control-plane APIs report V27 and the matching Worker version. The Map returns HTTP 200 with the V29 palette; the `espacios.me/map*` route is unchanged and `DATA_ROOM_PUBLIC=false`.
- Supabase production release registry and runtime config point to V27. The source status is `pending_merge` because PR [#98](https://github.com/gugmaae-prog/espacios/pull/98) remains open. Automated checks `verify` and `public-repo-safety` passed.
- The temporary authenticated publication Worker was deleted and returns HTTP 404. Its token, target file and Wrangler config were removed from the local workspace.

## Reproduction and limits

`data/historical-intelligence/palm-jebel-ali-nakheel-progress-20261008.json` contains the reviewed source metadata and six accepted facts. `tests/historical-v27-palm-jebel-ali-progress.test.mjs` verifies the values, date precision, source revision, record identity, preservation of earlier evidence and absence of price/forecast inference. `npm run verify`, the production-config Wrangler dry run, and the local immutable-storage round-trip passed.

Next, obtain dated primary progress updates for other phases and independently sourced, phase-verified launch, sale, signed-rent, completion and occupancy observations. Palm Jebel Ali's historic quotes and community-area transactions remain insufficient to establish like-for-like villa appreciation. No lifetime price/rent history or annual 2027–2080 scenario path is complete or certified.
