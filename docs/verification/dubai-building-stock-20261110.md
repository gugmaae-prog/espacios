# Dubai historical building counts, 2015–2019

This source extends the separate historical evidence API. It does not change the accepted V48 project catalogue, listing snapshot, native history, or forecasts.

- Publisher: Dubai Statistics Centre; secondary export and Public Domain licence label: [KAPSARC Data Portal](https://data.kapsarc.org/explore/dataset/housing-and-building-statistics-of-emirate-of-dubai/).
- Source export: [Opendatasoft CSV](https://data.kapsarc.org/api/explore/v2.1/catalog/datasets/housing-and-building-statistics-of-emirate-of-dubai/exports/csv?delimiter=%2C), captured 2026-11-10; 54,720 decoded bytes, SHA-256 `2ea02dc39e6a158b2c626072822315c9fb9703868646ef42d3f08bba7c9a7bcd`.
- KAPSARC catalogue metadata last modified 2024-03-11; source observations used here end in 2019. The [official DSC 2019 building-type table](https://www.dsc.gov.ae/Report/DSC_SYB_2019_02%20_%2001.pdf) corroborates the six 2019 type and area counts.
- Raw export: 966 rows, 718 distinct `(year, area, frequency, indicator, unit)` keys. 403 rows participate in duplicate-key groups and are not published as observations.
- Published selection: 30 unique-key `Number` rows, for `Commercial Building` and `Industrial Building`, 2015–2019, each with `All Area`, `Urban`, and `Rural`. Every all-area count equals urban plus rural. The 2019 commercial count is 10,405; industrial is 1,055.
- API: `/map/api/uae-evidence/dubai/commercial-building-stock`, with optional `year`, `type`, and `area` filters. The commercial page reads the API for its historical card.

These are published building counts by type, not annual new completions, permits, units, currently available spaces, prices, or transactions. Do not calculate new completions by subtracting stock years: classification and geographic definitions may change. The secondary export has data-quality defects, so its other rows remain withheld pending source-level reconciliation.
