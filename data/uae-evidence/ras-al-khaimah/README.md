# Ras Al Khaimah annual market values

Selected numerical observations from the Ras Al Khaimah Statistics Centre's [Statistical Yearbook 2026](https://css.rak.ae/en/statistical-yearbook-2026/), construction Tables 7-1 and 7-2. The yearbook attributes the underlying figures to Ras Al Khaimah Municipality. The source page was captured and checked on 9 November 2026; its byte count and SHA-256 are in `market-values-validation.json`. The page body is not redistributed.

Each row is a calendar year, and each monetary field is **AED thousand** as published. Table 7-1's sales, mortgage, and waiver components reconcile to its total for all three selected years. The land and commercial unit figures come from Table 7-2. The 2025 total sales figure in Table 7-2 has an extra AED 0.42 thousand of precision relative to Table 7-1; the API preserves Table 7-1's printed figure.

The extract provides annual emirate aggregates, not transaction counts or unit records. The mixed commercial-residential land category remains separate from commercial land and commercial units. Neither the catalogue nor the commercial listing map treats these values as property locations or price comparables.

## Commercial sales history

The same yearbook's construction Table 7-2 provides selected annual sales values for commercial land, mixed commercial-residential land, and commercial units from 2015 through 2025. The three selected numerical rows were checked against two matching reads of the official page on 10 November 2026. `commercial-sales-history-20261110.json` retains the yearbook's AED-thousand units, and `commercial-sales-history-validation.json` records the source and data checksums. Commercial-unit values are reported for 2019 and 2021–2025; the source dashes for 2015–2018 and 2020 are stored as null. The six years already present in `market-values-20261109.json` match exactly.

This series is historical emirate-level monetary evidence. It does not identify a unit, map point, sale count, asking price, or current availability. The three use categories remain separate. Only selected numerical facts and a source link are published.

## Building-type permits

The same [2026 yearbook](https://css.rak.ae/en/syvb2026/), Table 7-4, reports one-storey buildings (labelled commercial in Arabic) and industrial buildings as separate permit categories for 2017–2025. Two independent reads on 10 November matched at 626,364 bytes, SHA-256 `853e7cbe3907235d287fdf8f137d76136acf9aa6615c97b3f798111dc894290a`. The selected rows are in `building-permits-20261110.json` with checksum and extraction details in `building-permits-validation.json`. The 2025 figures are 69 one-storey commercial and 41 industrial permits.

Table 7-4 has a different classification and total from Table 7-3's annual permit totals; the API keeps the series separate. These permits do not prove building completion, unit availability, a sale or rent, or a project location. Only selected numerical facts and a source link are published.
