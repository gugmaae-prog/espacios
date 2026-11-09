# Ras Al Khaimah annual market values

Selected numerical observations from the Ras Al Khaimah Statistics Centre's [Statistical Yearbook 2026](https://css.rak.ae/en/statistical-yearbook-2026/), construction Tables 7-1 and 7-2. The yearbook attributes the underlying figures to Ras Al Khaimah Municipality. The source page was captured and checked on 9 November 2026; its byte count and SHA-256 are in `market-values-validation.json`. The page body is not redistributed.

Each row is a calendar year, and each monetary field is **AED thousand** as published. Table 7-1's sales, mortgage, and waiver components reconcile to its total for all three selected years. The land and commercial unit figures come from Table 7-2. The 2025 total sales figure in Table 7-2 has an extra AED 0.42 thousand of precision relative to Table 7-1; the API preserves Table 7-1's printed figure.

The extract provides annual emirate aggregates, not transaction counts or unit records. The mixed commercial-residential land category remains separate from commercial land and commercial units. Neither the catalogue nor the commercial listing map treats these values as property locations or price comparables.

## Building-type permits

The same [2026 yearbook](https://css.rak.ae/en/syvb2026/), Table 7-4, reports one-storey buildings (labelled commercial in Arabic) and industrial buildings as separate permit categories for 2017–2025. Two independent reads on 10 November matched at 626,364 bytes, SHA-256 `853e7cbe3907235d287fdf8f137d76136acf9aa6615c97b3f798111dc894290a`. The selected rows are in `building-permits-20261110.json` with checksum and extraction details in `building-permits-validation.json`. The 2025 figures are 69 one-storey commercial and 41 industrial permits.

Table 7-4 has a different classification and total from Table 7-3's annual permit totals; the API keeps the series separate. These permits do not prove building completion, unit availability, a sale or rent, or a project location. Only selected numerical facts and a source link are published.
