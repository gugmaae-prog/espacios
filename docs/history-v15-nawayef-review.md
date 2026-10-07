# Nawayef current-page and initial-release review — 7 October 2026

Snapshot candidate `20261007-enrichment-v15` preserves the fixed catalogue of
1,645 projects and 215 communities and adds three checksum-recorded Modon sources
with six facts for two exact existing records. Five public pages were reviewed;
two dated releases already preserved in V12 were not added again. Raw source
bodies remain outside the repository.

| Existing record | Verified additions | Explicit limit |
| --- | --- | --- |
| Nawayef Park Views | Current AED 2 million one-bedroom starting advertisement and current Q1 2028 handover target | The price is an advertisement, not a sale or valuation. The target is planned, not delivery or occupancy. |
| Nawayef East | Current AED 6.6 million Homes and AED 19.3 million Heights starting advertisements; current December 2028 handover target; initial 7 November 2024 release limited to Homes and Heights types 5–8 | Mansions remain TBC and receive no invented value. Later types receive no launch date. The retained joint East/West AED 5 billion contract remains combined and is not construction-start evidence. |

The sources are the [Nawayef Park Views current page](https://www.modon.com/real-estate/nawayef-parkviews),
the [Nawayef East current page](https://www.modon.com/real-estate/nawayef-east),
and the [Nawayef East launch release](https://www.modon.com/about-modon/media-centre/details/2024/11/07/modon-unveils-luxury-residences-on-the-east-hill-at-nawayef-on-hudayriyat-island).
Each response was certificate validated, capped at two megabytes and SHA-256
recorded. Facts and capture metadata are published without redistributing source
bodies.

Exactly one requirement moves from missing to present: Nawayef East phase
milestones. The launch source explicitly defines the initial release population.
The fixed 42,780-cell ledger now contains 2,480 present, 3,433 partial, 27,567
missing and 9,300 unestablished cells. Thus 40,300 cells, or **94.20%**, remain
unresolved.

No construction start, completion, delivery, occupancy, registered transaction,
signed rent, dated valuation or validated forecast is added. Every record retains
54 annual 2027–2080 scenario slots; unsupported values remain null.

Validate with `tests/historical-v15-nawayef-pass.test.mjs`, the complete historical
suite, deterministic local R2/D1 publication and the production Wrangler dry run.
Publication requires review, merged GitHub source and the authorized immutable
release process.
