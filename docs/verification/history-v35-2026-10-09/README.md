# V35 developer sales snapshots and earlier Mina history — 9 October 2026 (Dubai)

The reviewed [RAK Properties Q2 2024 investor report](https://www.rakproperties.ae/wp-content/uploads/2024/08/RAKP-Investor-Relations-2024_new.pdf), pages 10 and 26, supplies six cumulative developer sales snapshots and fourteen lifecycle milestones for seven exact existing projects and the Mina Al Arab community record. The report was downloaded and its table/timeline visually checked. Only minimal attributed facts and source metadata are published; the PDF and page images stay in ignored research scratch.

## Native project financial data

All values below are the developer's snapshot **as of 30 June 2024**, not transactions occurring only during June or Q2. AED figures retain the native million scale. No sale-price average is calculated and no transaction IDs, cash collections, rent, valuation or source-date validity are inferred.

| Exact project | Units launched | Units sold | Net sales, AED million | Revenue backlog, AED million | Reported construction |
| --- | ---: | ---: | ---: | ---: | --- |
| Bayviews | 344 | 344 | 421 | 323 | 23% |
| Marbella Phase 2 / 89-home Extension | 89 | 84 | 220 | 18 | 92% |
| Cape Hayat | 678 | 586 | 799 | 680 | 15% |
| Quattro Del Mar | 631 | 366 | 484 | 484 | NIL |
| EDGE | 237 | 70 | 77 | 77 | NIL |
| Porto Playa — 50% JV reporting basis | 141 | 138 | 357 | 357 | NIL |

Porto Playa's values retain the report's 50% share/equity-accounting footnote; nothing is doubled or silently presented as a whole-project total. Launched units are a sales population, not canonical total inventory. `NIL` is retained literally; no numeric construction percentage or start date is inferred. Sold percentages are kept as reported rounded values. The source's exact publication date remains unknown. Q2 2024 is its reporting period; first verified availability is the actual 8 October 2026 UTC capture. Its historical-looking numbers cannot enter a 2024 backtest.

## Historical lifecycle and identities

The retrospective timeline reports Mina Al Arab prepared for development in 2006; Granada delivery in 2010, Malibu in 2011, 808 apartments in 2012, Bermuda and Flamingo communities in 2017, and Gateway residences in 2020 are component deliveries within Mina. They do not establish whole-community completion or occupancy. The 2006 year extends the earliest retained verified development evidence, not a first-ever price or market-inception boundary. Flamingo's exact project separately gains a reported 2017 delivery, without inferring legal completion or occupancy. Other Mina catalogue aliases receive no automatic fan-out.

Gateway, South Bay and generic Granada project phase identities remain unresolved. The original Gateway and South-labelled Bay brochures were retrieved but do not supply a reliable bridge from those catalogue IDs to numeric phases. Their phases' table financials remain excluded. The developer table's Gateway 2 launch year differs from older announcements; it is not substituted for an original launch. The municipal September 2024 PDF returns 404. These attempts do not close evidence gaps.

## Preservation and coverage

V35 preserves all 1,645 projects, 215 communities, 633,891 history-series rows, 16,872 series, 13,230 record-series links, 105 events and 7,382 exposures. It has 3,334 source vintages and 6,672 facts (lifecycle, observations, register evidence and community revisions); six of the new observations are developer aggregate snapshots, not registered sale/rent observations. Current snapshots, scenarios, prior source rows, unrelated records and every native history series remain intact. V38's reviewed Nura developer correction remains active.

The 42,780-item checklist contains 3,293 present, 3,437 partial, 26,750 missing and 9,300 unestablished: **39,487 remain unresolved (92.30%)**. Only Flamingo's delivery-report item closes. This is not a price-data completeness percentage. Complete lifetime histories, current valuations, occupancy and approved annual forecasts remain incomplete. The endpoint remains 2080; no forecast is certified by these additions.

## Reproduction and validation

The bounded `capture-rak-investor-pass35.mjs` captures the single primary report privately. `prepare-rak-investor-pass35.py` pins the visually reviewed SHA-256 and exact row/record mapping. `append-rak-investor-pass35.py` requires V34, preserves all existing arrays and builds V35. The new UI card labels developer totals, native AED million units, cumulative scope and JV share. Unit and preservation tests exclude these snapshots from registered-sale coverage and model training, preserve NIL, and check source availability. The production and final test receipts below record the completed checks.

## Next actions

Continue phase-identity resolution, direct sale/rent and current-valuation evidence, occupancy dates and disclosed annual scenario inputs through 2080. This release does not complete the research goal.

Local validation: production build and syntax checks pass. The complete suite exercised 355 JavaScript tests plus the smoke/API and Python checks. After updating stale version expectations, the affected seven-test data suite passes; the new V34/V35 preservation checks also pass. All 2,542 immutable objects (including the D1 index) verify by checksum. Clean GitHub CI and production checks subsequently passed.

Follow-up captured during publication: the [2016 annual report](https://www.rakproperties.ae/wp-content/uploads/2024/03/2016-Annual-report.pdf), pages 27 and 29, separately reports Flamingo Phase I handover in 2015 and Phase II in October 2016. These earlier phase scopes require reconciliation with the later retrospective community-delivery year 2017. V35 retains the 2017 statement as reported, not a resolved first-ever or whole-project completion. The new capture is queued for the next additive pass; it receives no extra coverage credit here. See `phase-followup.json`.

## Verified publication and deployment

Source commit `4593f7c7c056395ee7d31201cfb19c2ee7dab837` passed [clean CI](https://github.com/gugmaae-prog/espacios/actions/runs/37847542443) and repository guardrails. Publication created 2,491 immutable objects, reused 50 and checked 42,784 D1 statements and exact table counts. Root: `9ddb117034ebb4012b4c1669fa75e7774967aef17e600d3e1d680388b780372d`; D1 checksum: `d7b0bdd661238e3d4e31b28b04676613f0cbeea361dc91ffd1eacee305d998b6`.

Worker `psr-portfolio-map-v2`, version `2166ff53-d490-40b7-9930-c51f3f6fda34`, was activated at 100% in deployment `9ee506ff-fd50-4d4d-ac1a-868278262265`, UTC 8 October 2026 at 21:50:21 (9 October Dubai). Frontend: `20261009-map-evidence-v39`. Preview and canonical APIs match all 1,860 coverage ledgers, all eight changed records including nested developer figures, source/event counts and the exact 2080 endpoint. Live HTML, JS and CSS return 200. The catalogue is deep-equal to its prior live state, including Nura's reviewed correction. Data Room remains 404/restricted.

Browser verification displays Porto Playa's six retained lifecycle milestones and the new developer sales card with the 50% basis, native money scale and first availability. Desktop width is 1,280px; mobile viewport and page width are both 390px, with a 366px drawer. The selected Map control has background `rgb(248, 250, 252)` and text `rgb(32, 48, 68)`. Screenshots: `live-map.png`, `live-developer-sales.png`, `live-mobile-sales.png`. Temporary viewport was reset.

Cloudflare route/service readback confirms `espacios.me/map* -> espacios-map-shell -> MAP -> psr-portfolio-map-v2`. Supabase runtime config and release registry independently match V35/V39, Worker, root and coverage counts. The temporary publisher and its local authentication files were removed. The source is in open PR #98; deployment does not imply merge. Research remains incomplete.
