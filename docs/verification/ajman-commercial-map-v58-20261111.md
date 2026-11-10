# Ajman commercial sales area map — 11 November 2026

## Source and join

- Sale aggregates: [Ajman Department of Land and Real Estate Regulation, Real Estate Units Sales](https://data.ajman.ae/explore/dataset/real-estate-units-sales/), CC BY 4.0. Source modified 21 August 2026, retrieved 2 November 2026. The immutable 6,075-row export has decoded SHA-256 `801cafef1f269d919ace2282f4f5cec8e7a021ce0241eba040f904a9fd672afd` and is read from private IDrive with byte and checksum checks.
- Area points: [Ajman Municipality & Planning Department, Ajman area](https://data.ajman.ae/explore/dataset/ajman-area/), CC BY 4.0. Source modified 3 October 2023, retrieved 2 November 2026. The 20-point immutable export has decoded SHA-256 `2d2f0af69c775ca7cfdaf7b8214b207c3d282506f5b96d80a9a80c4e7c1f3907` and is checksum verified before use.
- The only accepted bilingual joins are source district `Rashideya 1` / `الراشدية 1` to official point `AL RASHIDEYA 1`, and `Rashideya 2` / `الراشدية 2` to `AL RASHIDEYA 2`. The source sometimes reverses its English and Arabic district columns; both exact paired orders are accepted. No fuzzy, nearby, project-name, sector, or title joins are used. The named area point is geographic context, not a verified district centroid, building, unit, project, or cadastral coordinate.

## Reconciliation

| Period | Office/shop aggregate rows | Reported sales | Mapped aggregate rows | Mapped reported sales | Unmapped reported sales |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2019–2026 Q2 source span | 89 | 346 | 55 | 302 | 44 |
| Full calendar year 2025 | 12 | 80 | 9 | 77 | 3 |

The 2025 map's Rashideya 1 circle has five aggregate rows and 35 reported sales; Rashideya 2 has four rows and 42 reported sales. All nine mapped rows are labelled Office. The three unmapped 2025 rows are two Aamra offices and one Humaideya 1 shop, each reporting one sale; they remain available in the original API. An area circle displays a count of reported sales from quarterly aggregates, **not** a count of individual transaction records or currently available spaces. 2026 ends at Q2 and is not a full-year comparison.

`/map/api/uae-evidence/ajman/commercial-sales?view=map&year=2025` returns both source identities, the map counts, exact area references, and the unmapped balance. The existing paged commercial-sales API remains available for every source row. The `/map/commercial` control shows this as a separate historical mode; it does not alter RGEstate asking listings, Dubai registered records, forecasts, or V48 projects/history.

## Release checks

The focused tests verify both source checksums, exact join counts, the 2025 and all-period unmapped balances, invalid filters, and absence of an area source. Full preservation, production dry run, staged route, and normal-traffic checks are recorded with the release before promotion. R2 remains disabled; Data Room access remains restricted.
