# Development impact method · 15 November 2026

This method extends the Espacios Map value-driver dataset (`20261115-value-drivers-v8`). The source register and catalyst facts retain their 3 November 2026 research cutoff; this document and the method were updated on 15 November. Project announcements, registered transactions, asking benchmarks, and user scenarios remain separate.

## What enters the analysis

For each area and property segment, review five factors: destination demand, usable amenities, access and employment, delivery timing, and offsets. Every driver has a publisher, date, status, demand mechanism, risk, and named area context. An operational museum has a different status from an announced museum. Contracts and inspection progress do not establish handover, occupancy, or a property-price effect.

Palm Jebel Ali is a **direct destination driver** as well as the site of separately dated road, utility, villa, and amenity packages. The [Dubai masterplan](https://www.mediaoffice.ae/en/news/2023/may/31-05/mohammed-bin-rashid-approves-new-futuristic-masterplan-for-palm-jebel-ali), [Nakheel's Frond F release](https://www.nakheel.com/en/media-centre/press-releases/news-detail/2026/08/20/nakheel-unveils-limited-collection-of-44-beachfront-villas-on-palm-jebel-ali-s-frond-f), and the preserved luxury-sale cohort support an emerging destination and demand thesis. They do not establish a repeat-sales appreciation rate or future villa rent. Villa delivery also adds competing supply.

Jebel Ali, Downtown Jebel Ali, Dubai South, and Expo City Dubai are **spillover candidates**, not a measured radius. The mechanism may include visitors, services, employment, or access. Their actual connection must be checked through routes, travel times, completed assets, same-segment sale and rent records, and competing supply. Airport and exhibition programmes are separate drivers in the southern corridor; changes there cannot automatically be credited to Palm Jebel Ali.

Saadiyat's operating cultural venues, including [Zayed National Museum](https://www.mediaoffice.abudhabi/en/arts-culture/zayed-national-museum-opens-to-the-public-in-saadiyat-cultural-district/), provide a direct amenity and visitor channel. The map keeps the announced Guggenheim separate from operating venues. Ras Al Khaimah's Wynn Al Marjan Island is likewise a destination and employment hypothesis with delivery, visitor, infrastructure, and new-supply checks. None receives an automatic uplift percentage.

## Conditional calculation

The new drawer compares a baseline index with a development-adjusted index. The user supplies the baseline annual change `b`, signed development effect `d`, offset for additional supply or already-priced demand `o`, activation year `a`, and horizon `h`. All three annual inputs start blank. With index 100 at the selected starting point:

```
baseline = 100 × (1 + b/100)^h
activeYears = max(0, h − a + 1)
scenario = 100 × (1 + b/100)^(h − activeYears) × (1 + (b+d−o)/100)^activeYears
```

The displayed difference is scenario minus baseline **index points**, not an observed price change, confidence interval, or probability-weighted forecast. The effect starts only in the entered year. Negative development effects and losses are allowed. The selected area changes the scenario label and evidence caveat; it does not insert an unverified default coefficient. The calculation does not modify historical observations, asking benchmarks, the heatmap's price colours, or Palm's separate registered-unit area series.

## When a measured impact could be published

Use same-segment registered sales or signed rents before and after a verified opening, a matched comparison area, stable source geography, sufficient sample, checked pre-trends, and controls for broad market changes, other nearby developments, and changing supply. Report the window, transaction count, segment, uncertainty, and sensitivity to comparison choices. If those conditions fail, retain the development as a sourced exposure and user scenario only. No causal or calibrated Palm-specific uplift is published in this release.

The focused value-driver suite and local API check pass after rebuilding the Worker bundle. The candidate drawer was exercised at 1280×800 and 390×844 against normal public map data through a local proxy: Palm and nearby-area scenarios rendered, and the narrow layout had no horizontal overflow. This document does not assert production publication.
