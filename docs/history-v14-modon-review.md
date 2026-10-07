# Modon phase, sales-status and current-price review — 7 October 2026

Snapshot candidate `20261007-enrichment-v14` preserves the fixed catalogue of
1,645 projects and 215 communities and adds eight bounded public Modon sources.
The reviewed packet is
[`pass37-modon-primary.json`](../enrichment/v14/pass37-modon-primary.json).
It contains 15 facts for four existing records and creates no new record,
registration or phase identity.

| Existing record | Verified additions | Explicit limit |
| --- | --- | --- |
| Tara Park | First launch phase reported for mid-March 2026; second phase reported for mid-April; three current bedroom-segment average-price advertisements | Month precision remains month precision. Current two-tower page configuration differs from the six-tower total sell-out report, so the advertisements remain segmented evidence rather than one project-wide transaction population. |
| Maysan, Al Reem Island | Dated phase-one announcement and launch; phase-one sell-out; AED 1 billion main-contract award for Mayar and Thoraya | Contract award is a phase milestone, not physical construction start, construction progress, completion or delivery. |
| Muheira | Complete sell-out reported on launch day; approximately AED 1 billion across 475 apartments | Aggregate sales value is not a set of registered transactions and is never divided into an inferred unit price. |
| Nawayef Village | Current AED 4.1 million advertised starting price; launch-batch sell-out; approximately AED 2 billion across 378 units | The asking price is not a valuation or completed sale. The developer total remains aggregate sales evidence. |

The primary pages are the
[Tara Park project page](https://www.modon.com/real-estate/tara-park),
[Modon H1 2026 results](https://www.modon.com/about-modon/media-centre/details/2026/07/29/modon-delivers-record-first-half-results-with-aed-2.2-billion-in-net-profit-and-aed-65.4-billion-revenue-backlog),
[Maysan phase-one launch](https://www.modon.com/about-modon/media-centre/details/2024/10/21/modon-launches-phase-one-of-maysan--a-freehold-development-on-reem-island),
[Maysan phase-one sell-out](https://www.modon.com/about-modon/media-centre/details/2024/10/30/modon-sells-out-phase-one-of-maysan-within-a-few-hours),
[Maysan contract award](https://www.modon.com/about-modon/media-centre/details/2025/12/12/modon-awards-aed-1-billion-main-construction-contract-for-maysan-project-on-reem-island),
[Muheira sell-out](https://www.modon.com/about-modon/media-centre/details/2025/05/23/muheira--the-first-modon-freehold-residential-towers-on-reem-island--sell-out-on-launch-day),
[Nawayef Village project page](https://www.modon.com/real-estate/nawayef-village) and
[Nawayef Village sell-out](https://www.modon.com/about-modon/media-centre/details/2025/05/08/modon-sells-out-nawayef-village-the-first-townhouses-on-hudayriyat-island-with-a-total-value-of-aed-2-billion--within-a-few-hours).
Each response was certificate-validated, size-bounded and SHA-256 recorded. Only
facts and capture metadata are published; source bodies are not redistributed.

## Dates, identity and financial classes

Occurrence, publication, first-known availability and retrieval remain separate.
The H1 report was published on 29 July 2026 and describes Tara Park launches in
mid-March and mid-April. Those launch months cannot enter a March or April
point-in-time backtest because the evidence first became available later.

The Maysan contract body is datelined 11 December 2025 while its URL and newsroom
card show 12 December. The Nawayef Village sell-out body is datelined 9 May 2025
while its URL and newsroom card show 8 May. Both versions remain documented; the
body date is used for the reported occurrence.

All four current prices are developer advertisements. The two sales totals are
developer-reported aggregates. None is registered transaction history, a dated
valuation, a rent, an appreciation coefficient or a forecast anchor.

## Coverage reconciliation

V14 preserves every V13 record, prior observation, lifecycle fact, register fact,
history link, source and selected current quote. It adds eight sources and 15
facts, taking the snapshot to 2,938 sources and 4,156 sourced facts. Public
aggregates remain 317,878 across 13,396 series; 216 rights-pending rows remain
excluded. Events and exposures remain 105 and 7,382.

Exactly seven requirements move from missing to present:

- Tara Park original launch, phase milestones and advertised prices.
- Maysan announcement/registration and phase milestones.
- Nawayef Village phase milestones and advertised prices.

The complete 42,780-cell ledger contains 2,479 present, 3,433 partial, 27,568
missing and 9,300 unestablished cells. Thus 40,301 cells, or **94.21%**, remain
unresolved. This is a requirements ratio, not a percentage of all possible
historical price observations. No complete lifetime sale/rent history or
validated forecast is certified. All records retain 54 explicit annual scenario
slots for 2027–2080; unsupported values remain null.

## Validation and release boundary

`tests/historical-v14-modon-pass.test.mjs` verifies the immutable reviewed base,
all current record identities, eight source hashes, 15 fact links, seven exact
coverage closures, date availability and the exclusion of advertisements and
aggregate totals from transaction, valuation and forecast use. The V13 tests
continue to pass against V14.

Reproduce with `npm run history:build`, `npm run history:verify:storage`,
`npm run verify` and the production Wrangler dry run. Publication requires the
immutable R2/D1 publisher followed by canonical API, exact-asset, control-plane
and live-browser verification. Until those receipts exist, this document
accurately describes a tested candidate rather than a live release.

## Next evidence work

Prioritize exact registered sale and signed-rent cohorts, service-charge
components, physical construction progress, confirmed delivery, occupancy and
dated valuations. Continue current-page price review only where the exact
project/phase population is clear. Preserve inaccessible or unsupported periods
as gaps, and keep conditional 2027–2080 scenarios outside observed history.
