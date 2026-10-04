# Historical intelligence scrape, 5 October 2026 candidate

All 1,645 projects and 215 communities remain in the catalogue. This is the reviewable `20261005-scrape-v2` source snapshot; production has not been changed. A record, fetched page, observed quote and complete price history are separate coverage measures.

| Current collection | Count | Evidence boundary |
| --- | ---: | --- |
| Official DLD transactions | 1,796,826 unique transaction IDs | Native last transaction 2 October 2026; originals private |
| Official Ejari lines | 10,560,550 / 8,812,322 distinct contracts | Lines are not independent leases; invalid/future/repeated single-property contracts excluded from aggregates |
| New primary derived history | 107,885 rows / 4,056 series | Project IDs, cadastral areas and exact native master-project labels; overlapping frequencies and subtypes |
| Total releasable historical aggregates | 248,476 rows / 9,184 series | Includes the earlier collection; never sum with raw transactions or across shared record links |
| Direct registered project sale histories | 51 | Verified exact registered identity, Unit/Villa cohorts; any retained history does not establish complete history |
| Direct registered project rental histories | 11 | Physical/virtual, usage, native subtype and New/Renew cohorts kept separate |
| Known-page collection | 2,028 URLs / 1,711 HTML captures | 1,553 records have page captures; 312 URLs robots-blocked |
| Additional first-party community retrievals | 155 attempted URLs | 181 reviewed lifecycle, advertised and descriptive facts across 81 communities |
| New accepted facts, all passes | 2,593 | 1,228 lifecycle, 1,285 financial, 80 register facts; original catalogue evidence also retained |
| Canonical source entries | 2,497 | Source references, not independent verified price feeds |
| Approved numeric forecasts to 2080 | 0 | Exactly 54 conditional annual slots remain for every record; missing inputs stay null |

The source packet is `data/historical-intelligence/scrape-enrichment.json`. Reproduce using `npm run history:build`; its two compressed derived CSV inputs have compressed and uncompressed checksums. Private original registers and website bodies are excluded from the repository. `python3 scripts/merge-historical-enrichment.py --packet … --output …` merges reviewed packets, preserves source collection passes, and rejects contradictory identities. Source metadata and cited facts do not confer permission to republish article bodies.

Primary datasets: [transactions](https://data.dubai/en/l/470061), [Ejari](https://data.dubai/en/l/468586), [projects](https://data.dubai/en/l/467654), [areas](https://data.dubai/en/l/465592), [buildings](https://data.dubai/en/l/459613), [developers](https://data.dubai/en/l/462802), [service charges](https://data.dubai/en/l/466633), [residential sale index](https://data.dubai/en/l/468732). The public Data Dubai download index returned ordinary permitted gzip downloads. Dubai Open Data Licence permits attributed derivatives; originals remain private. All 19 gzip originals were independently rehashed. Supporting register vintages differ: the project register is July 2026 with a June load, while transactions/rent/buildings are October snapshots.

52 official project-number identities passed project, developer and geographic review. One has only underlying Land history, leaving 51 with residential-unit/built-property subject price evidence. 128 Land/Building aggregate series stay `published_reference`; they never establish the price of a later apartment or villa. 49 unique native master-project names provide community sale context (45 rental context); eight cadastral-area community links overlap that set. Known catalogue community membership can expose exact native-master context on a project, with `identityVerified:false` and historical project existence explicitly unverified.

Mollak supplies 641 fee components for six exact projects, not whole-property annual costs. 24 Parking components have an unverified denominator and no per-sqft value; negative Adjustment credits remain. Rent dates are native contract-start dates, not invented registration dates. 5,467 repeated single-property contract IDs, 11,887 future-start rows and source date anomalies are quarantined in originals.

Most captured advertised prices come from Espacios tenant pages. They are labelled `catalogue_advertised_asking_quote` and do not independently corroborate the catalogue. All quotes survive; the preferred quote is chosen deterministically by source authority, capture time and stable observation ID. Capture dates establish when an advertisement was observed, not when a market valuation was valid. Historical developer launch quotes remain separate from today's selected advertisement.

Palm Jebel Ali has 2,102 official area sales: 1,685 Commercial Land, 415 Residential Unit and two Commercial Building rows; no native Villa or rental rows were found. Source-native cohorts and frond contexts remain separate. First-party villa launch, construction progress and phased 2026–2027 handover targets add lifecycle evidence, not actual completion, registered villa prices or measured appreciation.

Current retrieval availability is retained separately from event dates and source snapshot/load timestamps. These latest-vintage registers cannot support point-in-time historical backtests. The five newly downloaded CertifiedPoor CC BY 4.0 CSVs contain 2,088 native rows; their exact-name candidates remain unverified without official project IDs. Two publisher manifest row counts differ from the actual CSVs and are disclosed. These archives overlap other sources and are not additive transactions.

Complete applicable historical coverage remains unestablished. Unknown inception, occupancy, identity, financial periods and source-access gaps remain visible per record. Future prices through 2080 cannot be scraped as observed facts.

---

# Retained 3 October 2026 collection baseline

The snapshot evaluates every catalogue record: **1,645 projects and 215 communities**. Index coverage is 100%; individual financial-history completeness is not. It preserves context, uncertainty and source dates without creating property values, completion dates or appreciation coefficients.

## Collected and releasable evidence

| Evidence | Count | Meaning |
| --- | ---: | --- |
| Catalogue records | 1,860 | Exact catalogue IDs, including records with no financial observations |
| Original collected historical rows | 122,268 | Source-native aggregate and benchmark rows; overlapping cohorts are not independent transactions |
| Extended collected historical rows | 140,807 | Original collection plus 18,539 distinct earlier native points; includes 216 excluded rights-pending rows |
| Releasable historical rows | 140,591 | 127,854 DLD-derived area snapshots from an independent publisher, 12,509 Ajman official aggregates, 228 previously released advertised benchmarks |
| Pre-2019 supplemental rows | 18,539 | 430 monthly/quarterly residential apartment/villa area cohorts; 13,060 sparse points retained and withheld from display, 5,479 meet sample 20 |
| Excluded rights-pending rows | 216 | 164 ADREC report aggregates and 52 ADREC published rent-range references; source metadata remains available |
| Releasable native context series | 5,128 | Monthly, quarterly, annual and other source-native frequencies retained |
| Exact legacy series reconciliations | 15 series / 350 rows | Identical native numeric tuples; no fuzzy identity matching |
| Records linked to retained context series | 532 | Area context or asking benchmarks, never verified individual prices |
| Records with exact earlier-cohort links | 76 | 71 projects and 5 communities; no subject identity promotion |
| Reported target handovers | 802 | Catalogue-reported targets; not actual completions |
| Reported asking quotes | 1,048 | Publication dates are unknown; not dated current valuations |
| Events and milestone revisions | 50 | Macro events, policy, transport, culture, development and disruption evidence |
| Explicit geographic context links | 5,061 | Community membership or candidate marketed-area matches; no automatic measured uplift |
| Compact project macro exposure rules | 31 | Materialized by the API with scope and at-event existence uncertainty |
| Canonical sources | 797 | URL deduplication prevents repeated citations being counted as independent evidence |
| Approved individual sale/rent histories | 0 | Registry identity reconciliation is still required |
| Approved forecasts through 2080 | 0 | Missing anchors, costs, assumptions and validation remain explicit nulls |

The underlying independent transaction source records 1,364,226 raw Dubai transactions and 1,335,922 clean rows. The unchanged 22,543,456-byte parquet is retained as a content-addressed publication object and is not embedded in the Worker. Its immutable checksum, publication timestamp, source URL and quality-flag distribution are retained. Those transactions and the 127,854 derived context rows must not be added together as distinct observations.

The collected release envelope spans **1993-01-01–2026-08-31** at source-native precision. It is not the start date of any project or community. The raw transaction source advertises a wider 1975–2026 range; that does not establish a complete, individually matched historical series for any record. `manifest.historyWindow.start` remains null until inception or first-sale evidence establishes an appropriate subject window.

| Emirate | Projects | Communities | Releasable context rows |
| --- | ---: | ---: | ---: |
| Dubai | 1,119 | 147 | 127,900 |
| Abu Dhabi | 347 | 22 | 120 |
| Sharjah | 59 | 18 | 19 |
| Ajman | 10 | 6 | 12,535 |
| Ras Al Khaimah | 89 | 15 | 17 |
| Umm Al Quwain | 20 | 5 | 0 |
| Fujairah | 1 | 2 | 0 |

Counts describe the source collection, not unique verified prices for each catalogue entity. Sparse observations retain source quality flags and raw descriptive medians, but their sample size makes them ineligible for display as reliable price evidence. Missing rows are never interpolated into observed history. The earlier supplement uses the publisher's zero quality flags and static price/area checks. Its earliest eligible transaction is 27 January 1993; the earliest sample-eligible monthly period is May 1998 and quarterly period is 1998 Q2. This latest-vintage descriptive history cannot be used as a point-in-time forecast training set because the publisher's full-year outlier flags include later information.

## Source and event chronology

Each source stores its URL, publisher, publication/first-availability date where known, last retrieval, date precision, evidence class and licence status. Observation dates, publication dates and collection dates remain separate. Missing publication dates stay null. A present-day retrieval cannot establish that a source was available to a historical forecaster.

The macro seed includes the financial crisis, regional capital inflows, oil/currency and financing changes, COVID restrictions and reopening, remote work, the invasion of Ukraine, partial mobilisation, FATF status changes, residency rules and monetary policy. The government and revision seeds include rail, airports, metro lines, drainage, Expo, museums, district development, Palm Jebel Ali, the Abu Dhabi attack and the 2026 regional aviation disruption.

Key chronology safeguards:

- Russia's partial mobilisation is dated **21 September 2022**. The Betterhomes third-quarter buyer report was published **19 October 2022** and changed its denominator to non-resident buyers. Its ranking is not a comparable national market share or proof that mobilisation caused whole-quarter Dubai appreciation.
- The Abu Dhabi attack occurred **17 January 2022**; the retained official statement was published **18 January**. The 2026 aviation report published **4 May** describes disruption beginning **28 February**. Transport disruption is not a measured local property-price coefficient.
- The flood occurred **16 April 2024**; the retained report was published **17 April**. Tasreef was approved **24 June** with a phased target through 2033. Flood vulnerability and future drainage benefits require parcel-level exposure evidence.
- Expo ran **1 October 2021–31 March 2022** after the date change published **29 May 2020**. The opening-ceremony report published **30 September 2021** is retained separately.
- Guggenheim's **2025** target, announced **29 September 2021**, remains as superseded planning evidence. The **28 July 2026** announcement targets opening on **11 December 2026**; it is still planned as of this snapshot.
- Wynn's **2026** target, announced **25 January 2022**, remains superseded. The **4 August 2026** financial announcement targets **September 2027**.
- Palm Jebel Ali masterplan approval (**31 May 2023**) and villa relaunch (**18 September 2023**) are separate. June/August 2026 announcements retain phased handover targets without declaring completed villas. The June Nakheel article republishes a Gulf News interview and is identified as syndicated evidence.
- Etihad Rail's **30 June 2026** initial service is linked to its reported Fujairah–Abu Dhabi operating geography. Network-wide future benefits remain separate planned context.

Three selected official CBUAE decisions supplement the existing tightening/easing events: +25 basis points effective 17 March 2022 (absolute levels unstated), 5.15% to 5.40% effective 27 July 2023, and 5.40% to 4.90% effective 19 September 2024. Each nested observation has its own source and publication/availability date; July 2023 evidence does not change the 2022 parent event's availability. These are Overnight Deposit Facility Base Rates, not EIBOR, retail mortgage quotes, a continuous rate series or a current-rate claim. The September economic review provides corroboration with unknown publication timing and cannot establish historical feature availability.

All events have `priceUpliftPct: null`. Geographic links establish context, not causality. Direct effects require matched observations, credible controls and evidence that the subject existed and was exposed at the time. Marketed-area label matches remain unverified candidates.

Twenty bounded primary-source retrievals were attempted for the revision seed: 19 yielded checksum metadata; the BIE date-change URL returned HTTP 403, so its previously verified reference remains with an explicit capture failure. Article bodies and media are not redistributed. The capture script keeps TLS verification enabled and caps request count, concurrency, duration and body size.

## Rights and identity gates

Independent Dubai source licensing follows the publisher's CC BY 4.0 declaration. Ajman open-data provenance remains in the source register. Advertised benchmarks were already released in the retained Espacios API; they keep `asking_benchmark` scope and are not registered sales or signed rents.

ADREC and RAK restricted datasets in `data/source-review-20260930.json` remain metadata-only. Their numeric authority feeds, rental indices and conflicting index variants are not imported into committed inputs or publication objects. The 216 ADREC report rows in the wider collection are also excluded conservatively. Private first-pass captures are retained under gitignored `.local-data/` rather than published.

The 263 project and 59 community registry candidates are quarantined. Candidate aliases do not create `identityVerified: true` observations. Registry joins must reconcile authoritative identifiers, scope, segment and lifecycle before approval.

## Reproducible local build

```sh
node scripts/build-historical-data.mjs
node --test tests/historical-storage.test.mjs
node scripts/publish-historical-snapshot.mjs
```

The default build uses committed normalized inputs and performs no network requests. Future revisions can use `--version 20261004-history-v2 --as-of 2026-10-04`; both arguments are validated and the as-of date cannot precede the retained collection. The wrapper passes these arguments through. Changing as-of does not refresh retained source retrieval dates. `data/historical-intelligence/inputs/manifest.json` records both original capture and normalized input checksums. Gzip uses deterministic timestamps; object keys are SHA-256 addresses of the compressed bytes. `series-aliases.json` records exact comparisons and both source hashes.

The one-time workspace import accepts `--import-workspace PATH`. It sanitizes catalogue fields and filters rights-pending history before producing repository inputs. It is not required by CI. The one-time `scripts/extend-licensed-history.py --transactions PATH` uses pinned DuckDB to derive the pre-2019 supplement. CI consumes the resulting normalized CSV and does not need DuckDB for the standard build. `early-history-manifest.json` retains source and input hashes, exact cohort links, sparse-point counts and the unchanged raw archive pointer. The independent bounded verification command is `python3 scripts/capture-historical-event-sources.py --limit 20`; running it produces a new provenance capture and therefore a new snapshot checksum.

## Storage and API contract

`data/historical-intelligence-20261003.json` is the compact `HI_DATA` index. It contains all 1,860 records, lifecycle targets, evidence sources, events, geographic links, gap declarations and at most 12 latest native points per linked context series. The embedded tail is explicitly partial; full partition counts and periods are declared independently.

Full numeric context histories live in 84 compressed, content-addressed partitions, plus a separate unchanged licensed parquet archive. Each partition is `{version, asOf, classification, series:[...]}`; series retain native tuples, columns, source identity, scope, quality and native endpoint. Pointers include key, SHA-256, byte length and compression. The immutable archival index retains record `historySeriesIds` and current snapshots, with global series descriptors, so record-series relations are recoverable independently of D1. Keys begin `research/published/2026-10-03/historical-intelligence/objects/` and use `MARKET_R2` when available. A missing binding exposes partial embedded context and a retrieval limitation; it does not imply full history is loaded.

The D1 migration separates snapshots, records, sources, events, geographic exposures, series and record-series joins. Keys include snapshot version. The publisher verifies all incoming and existing object checksums before writing, uses R2 conditional create (`etagDoesNotMatch: '*'`), never overwrites evidence, preserves old published objects when new versions build, and marks a D1 snapshot complete only after indexing succeeds. Failure preserves immutable orphan objects or staged indexes without activating a mutable latest pointer.

The publisher defaults to local dry run. Apply requires explicit isolated candidate config, matching candidate resource manifest and an adapter exporting `connectCandidate({target, config})`. Current production resources and routed configs are refused. Only unpublished local build objects were moved to gitignored `.local-data/` before the initial release; this is not a deletion policy for published snapshots. No candidate resource provisioning, remote publication or production deployment has occurred.

## Remaining coverage work

For each record, verify launch/first-sale and actual completion dates; approve registry identities; obtain date-stamped current prices and signed-rent histories; add service charges, vacancy, financing and transaction-cost evidence; then validate forecast methods on contemporaneously available sources. Wider raw coverage can guide research but must not masquerade as matched subject history.

Annual 2027–2080 scenario slots exist for price, rent and net return (54 years, 301,320 record-metric slots). They remain null until required inputs and validation are present. Scenarios through 2080 are conditional assumptions with explicit uncertainty, not observed data or guaranteed forecasts.
