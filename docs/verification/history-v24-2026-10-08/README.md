# V24 Palm Jebel Ali historical references — production receipt, 8 October 2026

## Release identity

- Snapshot: `20261008-enrichment-v24`
- As-of date: 8 October 2026
- Canonical snapshot SHA-256: `a62f29a1c6e2ffb7c4c1d3c8be66a3baefb319a2262504dd68673521e42eb2aa`
- Root index SHA-256: `9e4581704a848a309c5ca3c408f47a97f415bb92cc262486446841be61cdef6c`
- D1 index SHA-256: `3090105c565bf91a8301d9861920657e94b65764b54dcbe9f6b313972f4c0df4`
- GitHub: [PR #89](https://github.com/gugmaae-prog/espacios/pull/89), merge `919218cf7821650610afa31d775d74318e7471a4`; [PR #90](https://github.com/gugmaae-prog/espacios/pull/90), merge `71f088169ca8765bb3181daeeefe0bc529edfac4`.
- Production publication: complete; **2,179** immutable R2 objects verified (**2,131 written, 48 reused**) and **39,085** D1 index statements applied with every table count verified.
- Map Worker: `psr-portfolio-map-v2`, version `4305aa61-e0ee-40f8-ac5f-23d10e003f1b`, deployment `9053e1d4-ab2f-4751-8145-5692f14977e9`, serving **100% traffic**.
- Frontend: `20261008-map-palette-v27`; live HTML, JavaScript and CSS use the same cache key.
- Route: `espacios.me/map*` → `espacios-map-shell` → `MAP` service binding → `psr-portfolio-map-v2`. The route and service binding were checked directly in Cloudflare.
- Data Room: `DATA_ROOM_PUBLIC=false`

## What changed

V24 preserves all **1,860 records** (1,645 projects and 215 communities), all prior sources, native series, history rows, links, events and event exposures. It adds one public Gulf News source and five dated price references attached only to the Palm Jebel Ali community record. It adds no registered transactions and no new DLD series.

The [Gulf News report](https://gulfnews.com/business/property/realty-talk-an-in-depth-view-of-the-palm-projects-1.282042) displays “Last updated: March 25, 2005.” It says Palm Jebel Ali launched in May 2003 and reports these original launch quotes:

| Reported product | Reported period | Quote | Classification |
|---|---|---:|---|
| Garden Homes | May 2003 | AED 2.86m | Broker-reported launch asking quote |
| Signature Villas | May 2003 | AED 5.115m | Broker-reported launch asking quote |
| Waterhomes, exact product distinction unknown | May 2003 | AED 2m | Broker-reported launch asking quote |
| Waterhomes, exact product distinction unknown | May 2003 | AED 3m | Broker-reported launch asking quote |
| Waterhomes, exact product distinction unknown | March 2005 | AED 2.9m and above | Broker-reported resale quote floor |

The report is a contemporaneous broker-authored market article, not an official developer price list. Its visible update date is retained as the earliest supported source-availability date; its original publication timestamp is not separately exposed. The 2003 launch period is the event period described retrospectively by the article. The source body and images are not redistributed.

These references do **not** establish a like-for-like appreciation rate. In particular, the AED 2m–3m Waterhomes launch quotes do not identify the exact product type or unit underlying the reported AED 2.9m-and-above resale quote. No quote is mapped to a current project phase, and no CAGR, uplift or current value is calculated.

## Palm Jebel Ali evidence boundary

The preserved community record has **415 DLD-registered sale rows** matched to the official Palm Jabal Ali area. Their location evidence is community-area level and does not assign them to individual villas, buildings or current project phases. The record retains 57 distinct native period labels and 52 exact registration-date values across the linked sale evidence; overlapping monthly, quarterly and daily frequencies are not continuous monthly coverage. No signed-rent history is present. The five V24 references are separate from those registered-sale rows.

For the Palm Jebel Ali community record, the advertised-price requirement moves from missing to partial. Complete lifetime sale history remains unestablished; complete signed-rent history remains missing; the project's exact current-phase identity and direct villa transaction history remain unresolved.

## Preservation and validation

The V23-to-V24 preservation audit passed with zero losses:

- 1,860 records, 3,252 prior sources, 15,063 native series and 563,675 prior history rows preserved.
- 11,421 record-series links, 105 events and 7,382 exposure links preserved.
- One new source and no new native series added.
- The published snapshot contains 3,253 sources, 563,675 history rows, 15,063 series and 216 rights-pending rows excluded from publication.
- Local immutable-storage verification wrote 2,179 objects on its first pass and reused all 2,179 on repeat. Its D1 index comprised 39,085 statements and verified all table counts: 1 snapshot, 1,860 records, 3,253 sources, 105 events, 7,382 exposures, 15,063 series and 11,421 record-series links.
- Production publication completed with 2,131 R2 writes and 48 verified reuses. The active live `/map/api/record-history` response is V24 and exposes the five Palm Jebel Ali references; `/map/api/events` is V24 with 105 events and 7,382 exposure links.
- The live Palm Jebel Ali history response reports 55 linked aggregate series and 855 total native points, but returns only the first eight series page and 41 points (`complete=false`). This does not mean all 415 area-matched DLD sales are individually returned by that response or that periods are continuous.
- The V27 Map returned HTTP 200 with matching V27 asset tokens. The selected Map control uses a pale slate fill; nearby-place cards use light slate surfaces in light theme. The 332px mobile layout was checked. No gold value signal exists; gold was inherited interface styling.
- `npm run verify` passed all 166 tests; the production Wrangler dry run retained the existing bindings and restricted Data Room.

The canonical V24 snapshot SHA-256 is `a62f29a1c6e2ffb7c4c1d3c8be66a3baefb319a2262504dd68673521e42eb2aa`. The new source body was reviewed but not stored or redistributed. The sidecar retains source URL, visible date, source classification, retrieval time, source-body checksum and each quote's separate observation and availability dates.

## Coverage remains incomplete

The 42,780-item evidence checklist has 3,148 present, 3,437 partial, 26,895 missing and 9,300 unestablished requirements. **39,632 items (92.64%) remain unresolved.** This is a checklist rate, not the share of missing prices. The five Palm references change a source-status item; they do not fill every historical period.

The 2027–2080 horizon contains 301,320 record/metric/year slots across 1,860 records, 54 years and three metrics. The snapshot has **zero approved annual forecasts**. No 2080 market outcome is observed, and this release adds no validated forecast.

## Next best research actions

1. Reconcile Palm Jebel Ali phase names, developer identities and authority identifiers before attaching any individual transaction or price list.
2. Search public developer and authority archives for dated phase brochures, original price lists, registration records, construction revisions, handovers and actual occupancy. Keep original dates, publication dates and retrieval dates distinct.
3. Continue signed-rent and direct-sale research for all 1,860 records, retaining sparse observations and exact period gaps.
4. Expand event research only with dated source availability and defensible record-level exposure; report observed changes before attribution.
5. Specify conditional annual 2027–2080 paths only after local dated anchors, supply, delivery, rates, migration, costs and downside assumptions are documented and evaluated without future-information leakage.

The full-history goal remains incomplete. Do not infer Palm Jebel Ali appreciation or mark unresolved periods complete from these quotes.
