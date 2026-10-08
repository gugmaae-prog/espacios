# V32 RAK Properties lifecycle and advertised evidence — 8 October 2026

## Evidence increment

This pass preserves all 1,645 projects and 215 communities and adds 22 lifecycle facts and five segmented developer-advertised starting prices to five exact Ras Al Khaimah projects: Bayviews Residences Hayat Island, Cape Hayat, Marbella Villas Phase 2, Porto Playa, and Quattro Del Mar. Eleven primary-source captures are retained as minimal factual extracts and citations. One Cape Hayat page already existed as community context; its new capture is an explicit revision, not independent corroboration.

The earliest newly retained project announcement is Marbella Phase 2's construction-contract award on 10 February 2023. A contract award does not establish construction commencement or launch. Bayviews' 28 May 2023 announcement is stored as an announcement, with its separately advertised sales-start schedule of 26 May; neither becomes an original first-ever transaction.

The developer's H1 2026 release explicitly dates Cape Hayat (96.37%), Quattro Del Mar (47.04%), and Bay Views (98%) construction progress to 30 June 2026. A separate paragraph calls Bay Views 99% without an inspection date; both claims remain, with the latter using the 7 August publication date as the report date. The reported Bay Views BCC and pending TOC remain certificate-status evidence, not a verified certificate issue date, actual completion, completed handover, or occupancy.

Porto Playa preserves the release-body date of 31 October 2024 separately from the archive page date of 5 November. Cape Hayat's 668 versus 678 reported unit counts are unresolved. Earlier schedule vintages remain visible.

Quattro's factsheet page 8 was visually checked. It lists starting advertisements of AED 875,000 (Studio), 1,230,000 (1 BR Suite), 1,550,000 (1 BR Premium), 2,220,000 (2 BR), and 4,000,000 (3 BR). Publication and price-validity dates are unknown; 8 October 2026 is only the capture date. Area ranges include balconies/terraces and are not divided into a spurious price per square foot. No TBC prices are made numeric. These observations do not replace current headline values or forecast anchors.

## Scope and source limits

- Gateway Residences is excluded pending a phase/building discriminator against Gateway II.
- Marbella Extension Phase 2's newer handover narrative is not ingested without resolving that alias to the catalogue's Villas Phase 2 identity.
- No corporate aggregate sales, hotel occupancy, developer market forecasts, or news-implied appreciation is assigned to individual property prices.
- All source first-available dates use the verified 2026 capture, conservatively preventing retrospective releases from leaking into earlier backtests.
- Full HTML/PDF/artwork is not redistributed. Source URLs, hashes, retrieval/publication dates, source precision and rights limits are in the reviewed packet.

## Preservation and coverage

All 16,872 native series and 633,891 history rows remain unchanged. Source captures increase from 3,295 to 3,306. All 105 events, 7,382 exposures and prior facts remain unchanged. The new tests compare every native financial series to V31 and compare every unaffected record exactly.

The checklist changes from 3,252 to 3,265 present items, from 3,440 to 3,439 partial, and from 26,788 to 26,776 missing; 9,300 stay unestablished. That leaves 39,515 of 42,780 requirements unresolved (92.37%). This is item-presence accounting, not the fraction of historical prices missing. Complete lifetime histories, current valuations, and independently validated 2080 forecasts remain unestablished; no new financial-history completeness is claimed.

## Reproduction

The append step requires the materialized V31 snapshot and its content-addressed objects. Immutable objects are published to R2; this public Git repository does not embed every generated partition. Local regression checks use those exact hash-verified archive files.

- `scripts/capture-rak-lifecycle-pass32.mjs`: bounded official source capture into private scratch.
- `scripts/prepare-rak-lifecycle-pass32.py`: compile reviewed facts and conflicts.
- `scripts/append-rak-lifecycle-pass32.py`: append V32, preserve V31, rebuild content-addressed R2 objects, D1 indexes, runtime and lossless canonical gzip.
- `tests/historical-v32-rak-lifecycle.test.mjs`: preservation, identity, temporal and evidence-class acceptance.
- Reviewed packet: `data/historical-intelligence/rak-properties-lifecycle-pass32-20261008.json`.

Publication status and verification receipts are recorded below after release.

## New evidence by exact record

| Project | Lifecycle reports / schedules | Advertised quotes | Earliest new retained report/milestone |
| --- | ---: | ---: | --- |
| Bayviews Residences Hayat Island | 6 | 0 | 2023-05-28 |
| Cape Hayat | 6 | 0 | 2023 |
| RAK Properties Marbella Villas 2 on Hayat Island, Ras Al Khaimah | 2 | 0 | 2023-02-10 |
| Porto Playa | 2 | 0 | 2024-10-31 |
| Quattro Del Mar | 6 | 5 | 2024-01-09 |

These are retained evidence dates, not first-ever property transactions or continuous price histories. Dates of original publication and verified availability remain separate in the packet.

## Next evidence priorities

1. Verify the exact EDGE and SKAI catalogue identities against their developer pages before attaching the H1 2026 component and overall progress reports. Preserve the explicit 30 June reporting date and the later publication/availability dates.
2. Resolve Gateway versus Gateway II, Marbella Villas Phase 2 versus Marbella Extension, Mirasol versus Mirasol II, and individual Bay Residences phases before assigning broader developer reports. Similar names do not authorize identity fan-out.
3. Seek dated, lawful registered-sale and signed-rent evidence for the exact subjects. This release adds no such financial history. Keep native observations and sparse samples separate from aggregate estimates.
4. Establish dated current valuation inputs and scenario assumptions, then validate annual conditional paths through 2080. The existing 54 annual slots do not constitute approved forecasts or observed future data.

An inaccessible source or unresolved identity remains a gap. None of these follow-up candidates is counted as verified coverage in V32.
