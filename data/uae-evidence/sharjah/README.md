# Sharjah market aggregates

This source contains two cumulative 2026 market observations disclosed by the Sharjah Real Estate Registration Department and reported by Sharjah 24, with independent WAM reports linked per period. The facts were checked against captured article HTML on 9 November 2026. The local capture checksums are recorded in `market-aggregates-validation.json`; article text, images, and logos are not included in the published dataset.

The H1 period is contained within the January–September period. Do not sum the two rows. Sale counts by residential, industrial, commercial, and agricultural use reconcile to the period's sale total. All registration transactions include other procedures and are not sales. Reported monetary values and areas are rounded.

This is **not** a transaction-level register, a live listing feed, a price-per-square-foot series, or an authoritative project denominator. No V48 project identities or coordinates are inferred from these aggregates.

The separate [2018–2025 annual market series](ANNUAL-MARKET.md) provides full-calendar-year historical context. The cumulative 2026 periods must not be added to full-year observations or treated as individual transactions.

The selected monthly series now includes a June 2026 **value-only** observation. The [department's July disclosure](https://sharjah24.ae/en/Articles/2026/08/06/mm03) reports June's transaction value retrospectively as approximately AED 4.4 billion; it does not report June's sale or all-procedure counts. Those fields remain null. February, March, and September still have no verified monthly observation. The previous five-row version remains in `monthly-market-20261111.json`; the six-row version and its validation metadata are `monthly-market-20261114.json` and `monthly-market-validation.json`.
