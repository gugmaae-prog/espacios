# V28 DLD-derived project sales aggregates — production receipt

V28 (`20261008-enrichment-v28`) preserves the fixed catalogue of 1,645 projects and 215 communities and adds a narrowly scoped, current sales summary for 36 existing Dubai projects. It does not create monthly history, transaction-level records, lifetime price histories, valuations, rents, or a forecast.

## Source and evidence

The source is [Dubai Data's project pages](https://datadubai.ae/sources/), an independent publisher of aggregates derived from Dubai Land Department open data. Its [methodology](https://datadubai.ae/methodology/) states that project transactions are joined by DLD project number and that project pages cover the last 12 complete months. The underlying published dataset and license are documented in the publisher's [versioned GitHub repository](https://github.com/datadubai/dubai-real-estate-dld); the aggregates are offered under CC BY 4.0. Dubai Data is not DLD and these results are not official DLD project valuations.

For reproducibility, the research pass pinned source commit `56d6613fe0ebefa18eac21b727a8f22657f9d9ff`. The captured projects file SHA-256 is `e2f8da656f3b0e164daf6009eb0c4e2c402cab2df5e34d8eefb6a5f3b200baca`. Each accepted project was matched to one unique catalogue name, DLD project number, and exact-number source page. Each source page reports the window **October 2025–September 2026**, a data-through date of **6 October 2026**, an accepted price sample of at least 50 sales, and an `ok` quality status.

The pass adds **36 pooled median sale-price summaries** and **27 price-per-square-foot summaries**. The source's minimum project sample was 57. Nine projects had no accepted price-per-square-foot value and received no such series. The 63 values are each a single trailing-12-complete-month statistic, labelled at September 2026 for window indexing; they are not 12 monthly observations. They cannot establish price appreciation, a trend, a comparable repeat-sale return, or an individual-unit value. The source's off-plan share is retained in source-level evidence and was not used to adjust the prices. No individual transaction records or identifiers were republished.

The publisher was first retrieved for this research pass on **8 October 2026**. The data is not admissible in earlier backtests. Source rows retain the dataset commit, retrieval time, source page, project number, population/window, units, sample counts, evidence class and checksums.

## Preservation and coverage

| Measure | V27 | V28 |
|---|---:|---:|
| Projects / communities | 1,645 / 215 | 1,645 / 215 |
| Historical rows | 563,675 | 563,738 |
| Series | 15,063 | 15,126 |
| Sources | 3,255 | 3,291 |
| Events / event exposures | 105 / 7,382 | 105 / 7,382 |
| Record-series links | 11,421 | 11,484 |
| New current project aggregates | 0 | 63 |
| New individual transaction records | 0 | 0 |
| Approved annual scenario values through 2080 | 0 | 0 |

V28 retains all previous evidence. Registered-sale history is present for **313 projects and 48 communities**, partial for **1 project and 2 communities**, and missing for **1,331 projects and 165 communities**. These counts include the new current project summaries; they do not mean those projects have complete histories. Signed-rent evidence is present for 89 records and partial for 1. Complete lifetime sale and rent histories remain unestablished for all 1,860 records, dated current valuations remain missing for all, and approved forecasts through 2080 remain at zero.

The 42,780-item research checklist is now **3,199 present, 3,437 partial, 26,844 missing and 9,300 unestablished**, leaving **39,581 (92.52%) unresolved**. This is a requirement checklist rate, not financial-history coverage or the percentage of usable price data. The new batch closes 36 applicable present-data requirements; it does not close the periods or metrics that still lack evidence.

## Publication and verification

The immutable V28 snapshot retains 1,860 records, 3,291 sources, 105 events, 7,382 event exposures, 15,126 series and 11,484 record-series links. The root index SHA-256 is `56bfa34d020bdfbc76440333971ded5ce65c2025f4a1efe3414469929b3e123f`; the canonical snapshot SHA-256 is `593b8ff827421c197ba5914f34a7e1b32762e3f31d8ecce2c37274efa2f55681`; and the D1 index SHA-256 is `f25155a8931ab9a4a0c11ec2cfd8b9f0c2769aa3df861c6c6b647a0ce4b6dec0`.

The production publisher verified 2,181 objects, wrote 2,133 and reused 48 matching objects. It indexed 39,248 generated statements plus the snapshot header and verified exact table counts: 1,860 records, 3,291 sources, 105 events, 7,382 exposures, 15,126 series and 11,484 record-series links. Publication state is `complete`. The separate local immutable-storage round-trip also passed with the same counts. `npm run verify`, the production Wrangler dry run, targeted V28 history and publisher tests passed.

Cloudflare Worker `psr-portfolio-map-v2`, version `827ee1fc-8f6e-4138-b9c6-2914c5ecaa5a`, serves 100% traffic in deployment `8fadbf7d-7ebe-4cf2-868f-2159a6d7b7a2`. Live `https://espacios.me/map` returned HTTP 200 with the V29 assets. `/map/api/control-plane` reports the V28 root and `/map/api/record-history?recordId=project%3Aterra-gardens-emaar-expo-city-dubai` returned V28 and the two exact-ID project summaries: one AED 1,640,410 pooled sale median and one AED 2,114.43/sqft summary, each from 543 source sales and one trailing-year point. The live response labels them as Oct 2025–Sep 2026, not monthly history. Palm Jebel Ali's record-history route remains HTTP 200. Supabase runtime config and the V28 production-registry row match the Worker version, deployment and V28 root; `DATA_ROOM_PUBLIC=false` and source sync is `pending_merge`.

The temporary token-protected V28 publisher Worker was deleted after publication, and its private token, target and config files were removed. Its `/health` endpoint now returns HTTP 404. The deployed V28 implementation is commit `92f5d4d3`; its source and receipt are in open PR [#98](https://github.com/gugmaae-prog/espacios/pull/98). The PR has not been merged. `/map*` routing remains unchanged and no public Data Room access was enabled.

## Next work and limits

Obtain source-authorized transaction rows with exact DLD project IDs and full period coverage, then independently source rents, valuations, supply/completion, occupancy and dated local-event exposure. Continue the 263 project-name identity review without name fan-out. Keep sparse or unavailable time windows visible. Long-run 2027–2080 paths remain conditional scenarios until assumptions and validation are specified; this V28 batch supplies no price-growth coefficient.
