# Palm Jebel Ali evidence update · 3 November 2026

## Public routes

- `/map/api/palm-jebel-ali` exposes the focused source-backed record.
- `/map/api/value-drivers` retains the full catalyst dataset and the same Palm record.
- `/map/api/record-history?recordId=community%3ADubai%3Apalm-jebel-ali` remains the accepted V48 native archive. The focused record is a compact view of selected native cohorts; it does not replace the archive.

## Registered-sale history

The focused quarterly snapshot comes from exact DLD cadastral area 411, native name `Palm Jabal Ali`, in the accepted V48 derived archive as of 14 October 2026. Each selected series was fetched by its exact ID from the versioned record-history API, required a verified immutable partition, and was reconciled to the stored point count and partition SHA-256. The focused series payload has its own SHA-256. DLD's [source dataset](https://data.dubai/en/l/470061) is retained in the record.

| Native cohort | Distinct sales | Available periods | Meaning |
| --- | ---: | --- | --- |
| Commercial land, existing | 1,685 | 2023 Q4–2026 Q3 | Area land context; not a villa price |
| Residential unit, off-plan | 415 | 2025 Q4–2026 Q4 | Area unit context; 2026 Q4 is partial and sparse |
| Commercial building, existing | 2 | 2008 Q3 | Count only; median withheld |

These categories total 2,102 distinct source sales. Native frond subseries and monthly views overlap these rows and are not added again. Quarterly median and P25–P75 are shown only when at least 20 sales pass the accepted gate. Medians are mix-sensitive and do not measure repeat-sale appreciation. The original source publication vintage is not established, so these latest-vintage aggregates are descriptive history, not point-in-time backtest inputs.

The focused view now also exposes 19 named native project cohorts from the same V48 archive: 17 commercial-land cohorts with 1,573 sales and two Palm Central residential-unit cohorts with 415 sales. The remaining 112 land sales have no native project name. The named cohort counts reconcile to the area totals; they add **zero** distinct sales. Every local compressed partition is checked against its retained byte length and SHA-256 by `scripts/enrich-palm-jebel-ali-phases.mjs`. Low-sample and partial-quarter prices stay withheld. A DLD project name is presented as a source-native label, not proof of historical marketed project identity; land medians are not villa values.

Five earlier 2003–05 whole-price quotes remain a separate [published-reference capture](../data/historical-intelligence/palm-jebel-ali-historical-quotes-20261008.json). They describe the original launch or a broker-reported resale floor. They are neither registered sales nor prices for current phases. Eight dated developer milestone cards now trace the [2023 first villa launch](https://www.nakheel.com/en/media-centre/press-releases/news-detail/2023/09/18/nakheel-launches-first-villas-on-new-futuristic-palm-jebel-ali), [2024 access-road contract](https://www.nakheel.com/en/media-centre/press-releases/news-detail/2024/05/26/nakheel-awards-contracts-for-the-commencement-of-infrastructure-works-on-palm-jebel-ali), [Fronds K–P contracts](https://www.nakheel.com/en/media-centre/press-releases/news-detail/2024/10/05/nakheel-awards-aed-5-billion-in-contracts-for-luxury-villa-construction-on-palm-jebel-ali), [2024 Beach Collection release](https://www.nakheel.com/en/media-centre/press-releases/news-detail/2024/11/11/nakheel-reveals-latest-release-of-exclusive-waterfront-villas-on-palm-jebel-ali), [2025 Beach and Coral release](https://www.nakheel.com/en/media-centre/press-releases/news-detail/2025/10/23/nakheel-unveils-exclusive-collection-of-premium-waterfront-villas-at-palm-jebel-ali), [2026 Fronds A–F award](https://www.nakheel.com/en/media-centre/press-releases/news-detail/2026/04/27/nakheel-awards-contracts-worth-over-aed-3.5-billion-to-build-544-villas-on-dubai-s-palm-jebel-ali), [222-residence Palm Central release](https://www.nakheel.com/en/media-centre/press-releases/news-detail/2026/06/24/nakheel-releases-next-phase-of-palm-central-private-residences-amid-accelerating-demand-for-beachfront-living-on-palm-jebel-ali), and [Frond F product release](https://www.nakheel.com/en/media-centre/press-releases/news-detail/2026/08/20/nakheel-unveils-limited-collection-of-44-beachfront-villas-on-palm-jebel-ali-s-frond-f). Design styles, released residences, contract awards and handover targets are not completed homes or registered sales. These additions contribute zero sales to the DLD cohorts.

## Conditional estimate

The Palm drawer uses the latest complete residential-unit quarter with at least 20 sales: 2026 Q3, 197 sales, median AED 3,564.89/sqft. User-editable −5%, 0%, and +5% annual inputs produce one-, three-, five-, and ten-year nominal paths using `anchor × (1 + input / 100)^years`. The ten-year column is an explicitly long-horizon assumption, not a backtested model. These are assumption scenarios from a dated area-unit cohort, without fitted probabilities or confidence intervals. They are not current appraisals, villa prices, validated forecasts, or ROI. A separate index starts at 100 for unanchored assets. No regional catalyst is converted into a price uplift.

The Palm drawer now also offers a separate **villa capital scenario**. Its purchase price is blank until the user enters one; entry and exit costs and annual holding costs are user-editable and initially zero. For each annual assumption and horizon, it shows an assumed gross exit value and capital gain or loss after those costs. It does not borrow the residential-unit median as a villa price. Rental income, financing, inflation, tax, interim payment timing and liquidity are excluded. The scenario has no fitted probabilities or confidence interval.

## Construction inspection history

The focused Palm API now includes six [Nakheel-reported RERA inspection observations](https://www.nakheel.com/en/construction-progress/palm-jebel-ali) dated **18 June 2026**, one for each Frond A–F: A 4.39%, B 4.36%, C 4.05%, D 4.23%, E 4.03%, F 4.31%. The page was retrieved 3 November 2026; it does not state its publication date. The captured HTML was 143,946 bytes with SHA-256 `0d3f2f02c40398e395a634473726107c8bbce94df7bb16452ff987ce6a9bb71a`. Structured facts and provenance are in `data/palm-jebel-ali-progress-20261103.json`; the full page and photographs are not republished.

These are dated, phase-specific construction observations, separate from the accepted V48 DLD sale archive and the earlier six **Nakheel internal** Fronds K–P snapshots from March 2026. They are neither completed homes nor a price forecast. The page's group-level construction components are excluded because their date and denominator are less explicit.

Registered Palm villa prices, villa rents, and a validated Palm price forecast remain unavailable. R2 remains disabled. The accepted V48 history archive, IDrive readback, fixed catalogue, and Data Room restrictions remain the release baseline.
