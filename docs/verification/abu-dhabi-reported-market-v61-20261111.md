# Abu Dhabi reported market context · v61

## Source and scope

Selected numerical facts were checked against four official ADREC press pages on 2026-11-11. Each page was read twice with matching source HTML checksums recorded in `data/uae-evidence/abu-dhabi/adrec-reported-market-validation.json`. The published dataset includes the numbers and source links only. It excludes article text, report pages, images, API records, and the unpublished V55 sale-observation candidate.

| Native period | Published context | Official source |
| --- | --- | --- |
| Calendar 2025 | AED 142bn overall transactions; AED 99.4bn sales across 25,604 transactions; AED 42.7bn mortgages across 17,210 transactions | [ADREC 2025 release](https://adrec.gov.ae/en/News/News-item-1---Abu-Dhabi-Real-Estate-Centre-Releases-2025-Real-Estate) |
| 2026 Q1 | AED 66bn overall; AED 50.97bn sales across 8,940 transactions; AED 15.03bn mortgages across 4,578 transactions | [ADREC Q1 release](https://adrec.gov.ae/en/news/press-release1-abudhabi) |
| 2026 H1 | AED 117bn overall; AED 86.1bn sales across 16,838 transactions; AED 26.7bn mortgages across 8,876 transactions | [ADREC H1 transactions](https://adrec.gov.ae/en/news/press-release-27---adrec-h1-2026-transaction-report) |
| 2026 H1 segments | Retail 3.85m sqm GLA with occupancy described as mid-nineties; office 3.4m sqm GLA with 95% occupancy; residential stock approximately 409,000 units | [ADREC H1 market report](https://adrec.gov.ae/en/news/press-29---adrec-releases-the-abu-dhabi-real-estate-market-report-for-h1-2026) |

The same market report projects about 71,000 additional residential units by 2030, with peak deliveries in 2028. The API returns this in `publishedProjections`, separately from observed `segmentObservations`. It is an ADREC projection, not completed supply or an Espacios validated forecast.

## Backend and display

`/map/api/uae-evidence/abu-dhabi/reported-market` supports `period` and `segment` filters and returns market observations, segment observations, and published projections as separate arrays. `/map/commercial` shows retail and office supply cards linked to the official source. The map continues to show publisher asking-listing area references and separately mapped Dubai/Ajman registered sales; these ADREC emirate-wide aggregates have no unit coordinates.

The H1 figures include Q1 and must not be added to Q1. Rounded AED totals may not sum. Retail occupancy has no precise reported percentage. The new-lease price-change comparison period is not stated in the press summary. None of these aggregates establish live availability, commercial-unit sale prices, or transaction-level records. ADREC V55 candidate sale rows remain unpublished because redistribution approval was not provided.

## Coverage boundary

The seven-emirate inventory now lists 33 separate published source snapshots, including this one. It still has no authoritative UAE project denominator. The accepted V48 baseline remains 1,645 projects, 1,860 history records, and 16,872 native series. R2 stays disabled and the Data Room remains restricted.
