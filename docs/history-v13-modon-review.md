# Modon evidence and identity-accountability review — 7 October 2026

Snapshot candidate `20261007-enrichment-v13` preserves the fixed catalogue of
1,645 projects and 215 communities and adds five bounded public Modon sources.
The reviewed packet is
[`pass36-modon-primary.json`](../enrichment/v13/pass36-modon-primary.json).
It contains 18 facts for three existing records; it adds no record and performs
no same-name registration or phase fan-out.

| Existing record | Verified or retained evidence | Explicit limit |
| --- | --- | --- |
| Hudayriyat Golf Estates | 7 July 2026 launch and announcement; current August 2030 target; eight segmented average-price advertisements; developer-reported launch sales above AED 13 billion | Advertisements are not registered transactions or valuations; the aggregate total is not divided into unit prices |
| Bashayer Final Phase | 16 July 2026 final-phase sellout; approximately AED 1.25 billion across 300 apartments and townhomes; parent-page villa and apartment handover targets retained as published references | Parent Bashayer targets do not prove exact final-phase completion; the report supplies no unit transaction rows |
| Tara Park | 29 April 2026 sellout report for six towers and 834 apartments; aggregate sales nearing AED 2 billion | The report does not establish original launch, unit prices, registered transactions or rental history |

The exact primary pages are the
[Hudayriyat Golf Estates project page](https://www.modon.com/real-estate/hudayriyat-golf-estates),
[Golf Estates launch release](https://www.modon.com/about-modon/media-centre/details/2026/07/07/modon%27s-hudayriyat-golf-estates-sets-uae-record-with-more-than-aed-13-billion-in-sales-within-days-of-launch),
[Bashayer project page](https://www.modon.com/real-estate/bashayer),
[Bashayer final-phase release](https://www.modon.com/media-centre/details/2026/07/17/modon-sells-out-final-phase-of-bashayer-on-hudayriyat-island-within-one-day-of-launch--generating-approximately-aed-1.25-billion-in-sales)
and [Tara Park release](https://www.modon.com/about-modon/media-centre/details/2026/04/29/modon-announces-the-sell-out-of-tara-park-on-reem-island--generating-approximately-aed-2-billion-in-sales).
Each response was certificate-validated, size-bounded and SHA-256 recorded. The
packet publishes reviewed metadata and facts; source bodies are not redistributed.

## Dates, identity and financial classes

Occurrence, publication, first-known availability and retrieval remain separate.
The Bashayer article URL is dated 17 July while its body is datelined 16 July;
the retained occurrence uses the body date and records that caveat. Current project
pages have no verified original publication date, so their content is first known
at the 7 October retrieval. None of these facts may enter an earlier backtest.

Every new financial observation has exact subject identity, but its evidence class
still controls use. The eight Golf Estates prices are segmented developer
advertisements and cannot replace the selected project-wide current quote. The
three aggregate sales claims are developer-reported project or phase totals. They
are excluded from registered-sale coverage, transaction training, valuations and
automatic scenario anchors. No AED total is divided by a unit count.

## Coverage reconciliation

V13 preserves every V12 record, prior observation, lifecycle fact, register fact,
history link, source and selected current quote. It adds 5 sources and 18 facts,
taking the snapshot to 2,930 sources and 4,141 facts. Public aggregates remain
317,878 across 13,396 series; 216 rights-pending rows remain excluded. Events and
exposures remain 105 and 7,382.

Exactly three requirements move from missing to present:

- Hudayriyat Golf Estates original launch.
- Hudayriyat Golf Estates announcement/registration evidence.
- Bashayer Final Phase phase milestone.

The advertised-price ledger now requires `scope=subject` and verified identity to
count as present. Existing mirror and contextual quotes remain visible evidence,
but 1,253 corresponding cells correctly move from present to partial. This changes
accountability status without deleting data or changing selected current quotes.

The complete 42,780-cell ledger contains 2,472 present, 3,433 partial, 27,575
missing and 9,300 unestablished cells. Thus 40,308 cells, or **94.22%**, remain
unresolved. This is a requirements ratio, not a percentage of every possible
historical price observation. No complete lifetime sale/rent history or validated
forecast is certified. All records keep 54 explicit annual scenario slots for
2027–2080; unsupported values remain null.

## Validation and reproduction

`tests/historical-v13-modon-pass.test.mjs` verifies the immutable V12 root, full
record/evidence preservation, the exact three closures, all 1,253 identity-status
corrections and the new evidence-class boundaries. Runtime validation rejects
developer-reported aggregate sales from transaction training and scenario anchors.

Reproduce by merging the retained V12 enrichment with the V13 packet using
`scripts/merge-historical-enrichment.py`, then run `npm run history:build`,
`npm run history:verify:storage`, `npm run verify` and the production Wrangler
dry run. Publication must use the immutable R2/D1 publisher followed by canonical
API, asset and browser verification. Until those receipts exist, this document
describes a tested release candidate rather than a live release.

## Next evidence work

Verify exact project registrations and first-sale dates for these three records;
then seek registered sale/rent rows, construction starts and progress, delivery,
occupancy, service-charge components and dated valuations. Apply the same exact
identity gate to the 1,253 partial advertisements before any cell returns to
present. Preserve periods that remain unsupported, inaccessible or outside
applicability rather than filling them with estimates.
