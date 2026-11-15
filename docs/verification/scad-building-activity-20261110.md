# Abu Dhabi quarterly building activity — 10 November 2026

## Source and extraction

Five [SCAD building-completion statistical workbooks](https://www.scad.gov.ae/industry-construction?ThemeID=3294937&tab=Publications) cover 2025 Q1–Q4 and 2026 Q2. Their publication dates, direct workbook URLs, byte counts, and SHA-256 hashes are in [`building-activity-validation.json`](../../data/uae-evidence/abu-dhabi/building-activity-validation.json). Each workbook was independently fetched twice; bytes and hashes matched. The extractor [`build-scad-building-activity.py`](../../scripts/build-scad-building-activity.py) checks every regional sum, the two alternative permit breakdown totals, and the separate completion table. It retains only selected numerical facts and links, not workbook files. SCAD is credited under its [open-data policy](https://scad.gov.ae/documents/d/guest/scad-open-data-policy).

| Quarter | Commercial-use permits | Industrial-use permits | All-use completions |
| --- | ---: | ---: | ---: |
| 2025 Q1 | 607 | 148 | 5,767 |
| 2025 Q2 | 585 | 208 | 6,542 |
| 2025 Q3 | 751 | 217 | 7,797 |
| 2025 Q4 | 781 | 200 | 7,249 |
| 2026 Q2 | 689 | 172 | 6,967 |

The read-only `/map/api/uae-evidence/abu-dhabi/building-activity` endpoint preserves SCAD's three regions and emirate totals for each permit type, building use, and completion construction type. These are preliminary quarterly counts. Permit type and building use are **two breakdowns of the same permits**, so they must not be added. The completion table is for all building uses; it does not identify completed commercial spaces. Q1 2026 is not in the verified set and is not interpolated. These figures are separate from property sales, rents, project identities, and available units. The commercial page shows only the source-labelled 2026 Q2 commercial-permit figure, 689.

## RAK project-register discovery

The [RAK Municipality regulator page](https://mun.rak.ae/home/rak-municipality/organizational-structure/lands-properties-sector/real-estate-regulatory-administration/) links a [September 2024 project-status PDF](https://mun.rak.ae/wp-content/uploads/2024/09/6-%D9%82%D8%A7%D8%A6%D9%85%D8%A9-%D8%A7%D9%84%D9%85%D8%B4%D8%A7%D8%B1%D9%8A%D8%B9-2024Sep.pdf). The PDF remains accessible, but the municipality's [copyright notice](https://mun.rak.ae/home/open-data/website/copyrights/) prohibits unauthorized reproduction. A search-indexed May 2025 list URL under `/Documents/Lands%20and%20Properties%20Sector/2025/` returned HTTP 404 on 10 November 2026. No source project rows or coordinates were imported, and this list is not counted as a published Espacios data source. It remains a candidate for a licensed or explicitly cleared project-register feed.
