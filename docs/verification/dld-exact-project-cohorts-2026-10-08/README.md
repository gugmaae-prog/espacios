# DLD registered sale cohorts: eight exact project matches

This supplement adds verified DLD residential sales for eight Espacios project records that previously had no direct registered sale history. It preserves the existing catalogue, sources, observations, events, and older source vintages.

The source is the [Dubai Land Department transactions dataset](https://data.dubai/en/l/470061). Project number, area ID, and developer ID were checked against the DLD [project register](https://data.dubai/en/l/467654), [developer register](https://data.dubai/en/l/462802), and [area register](https://data.dubai/en/l/465592). Official developer pages corroborate the marketed project and developer names; the identity evidence and remaining candidate counts are retained in `data/historical-intelligence/dld-20261007-eight-project-sales-enrichment.json`.

The new snapshot contains **2,067 unique residential sale rows**, from **13 January 2022 through 6 October 2026**. They are grouped into **164 monthly** and **73 quarterly** series points. The frequencies overlap and must not be added together. Of the 237 points, 54 meet the existing minimum sample of 20 and publish a median and quartiles; 183 preserve their eligible count and date span while withholding price statistics. Rows are split by project, off-plan versus existing registration, property type, and subtype.

| Project | DLD project no. | Area ID | Sale rows | Source date span | Median-bearing points | Sparse points |
| --- | ---: | ---: | --- | --- | ---: | ---: |
| Lacina | 3336 | 466 | 331 | 2025-01-07 to 2026-06-29 | 5 | 12 |
| South Living | 1946 | 462 | 144 | 2024-09-13 to 2026-09-24 | 4 | 24 |
| South Square | 3711 | 462 | 428 | 2025-08-12 to 2026-09-25 | 10 | 9 |
| Amaal 8 | 3004 | 376 | 280 | 2025-01-22 to 2026-10-05 | 11 | 14 |
| Elle Residences | 4065 | 432 | 82 | 2025-12-16 to 2026-07-06 | 3 | 9 |
| One River Point | 2929 | 526 | 283 | 2024-03-07 to 2026-09-28 | 9 | 33 |
| Azizi Riviera Beachfront | 2297 | 412 | 500 | 2022-01-13 to 2026-10-06 | 12 | 61 |
| Signature Mansions | 2542 | 485 | 19 | 2023-05-17 to 2026-03-16 | 0 | 21 |

These ranges mean “earliest and latest matched registration dates in this snapshot,” not first-ever sale dates or continuous market coverage. DLD `instance_date` is the registration date, not a contract or transfer date. The price measure converts `actual_worth / procedure_area` from AED per square metre to AED per square foot and checks that result against the DLD `meter_sale_price` field. All 2,067 selected rows passed that check. No observation after 6 October 2026 is included.

The snapshot was first retrieved locally on 8 October 2026. Its original portal publication timestamp is unknown, so these retrospective records must not enter backtests with forecast origins before retrieval. Raw files and transaction IDs remain outside the repository. Only derived cohort counts and sufficiently sampled summaries are published, under the DLD attribution terms; the original data is not redistributed.

The eight exact project cohorts now establish some direct sale evidence. They do not complete any project’s lifetime sale history, establish signed rent history, prove actual completion or occupancy, provide a current valuation, or validate a forecast. The 2080 scenarios and the remaining project and community research still require separate evidence and validation.

The reproducible extraction entry point is `scripts/prepare-dld-exact-project-cohorts-20261007.py`. It requires the two checksum-pinned raw transaction files and checksum-pinned DLD project and developer register files as local inputs. The raw inputs are deliberately excluded from Git.
