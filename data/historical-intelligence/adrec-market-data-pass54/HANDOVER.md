# ADREC registered-sales candidate V54

## Scope

V54 adds 10,571 normalized, full-share residential registered-sale observations to 25 exact Abu Dhabi project records already present in the fixed catalogue. A twenty-sixth reviewed record, `adrec:474`, remains without usable sale evidence.

- API rows reviewed: 11,219.
- Accepted observations: 10,571.
- Excluded rows: 648.
- Projects reviewed: 26; projects promoted from missing to present sale-history evidence: 25.
- Requests recorded: 30, including the robots and exact project-label lookup checks.
- Capture date: 27 October 2026.
- Transaction window: 1 January 2019 through 22 October 2026. This bounded window does not establish complete lifetime history.

The ADREC dashboard standardized several labels after the earlier 22 October review. V54 uses the current exact dashboard labels and retains an explicit legacy-to-current alias check against the pre-existing ADREC authority records. It does not use name-only fan-out.

The fixed catalogue remains 1,860 records: 1,645 projects and 215 communities. Existing lifecycle facts, events, exposures, asking prices, rents, valuations, scenarios, 16,872 native series, and 633,891 historical rows are preserved.

## Accepted observations by record

| Record | Current exact ADREC dashboard project | Accepted sales |
| --- | --- | ---: |
| `adrec:29` | Water's Edge - Precinct A | 1,387 |
| `adrec:478` | The Sustainable City - Yas Island - Phase 1 | 1,236 |
| `adrec:465` | Saadiyat Lagoons - Wilds - Phase 1 | 775 |
| `adrec:470` | Saadiyat Lagoons - Phase 2 - Al Sidr | 751 |
| `adrec:695` | Hudayriyat Golf Estates - Townhomes | 685 |
| `adrec:455` | Bloom Living - Toledo | 577 |
| `adrec:547` | Bloom Living - Granada 1 | 545 |
| `adrec:505` | Bloom Living - Casares | 529 |
| `adrec:694` | Hudayriyat Golf Estates - Villas | 527 |
| `adrec:559` | Bloom Living - Seville | 508 |
| `adrec:619` | Bloom Living - Granada 2 | 446 |
| `adrec:621` | Bloom Living - Carmona | 379 |
| `adrec:442` | Bloom Living - Cordoba | 371 |
| `adrec:573` | Bloom Living - Olvera | 350 |
| `adrec:471` | Saadiyat Lagoons - Phase 2 - Ethir | 251 |
| `adrec:469` | Saadiyat Lagoons - Wilds - Phase 2 | 226 |
| `adrec:49` | West Yas (Plots) | 193 |
| `adrec:628` | Bayn - Lagoon 2 | 149 |
| `adrec:623` | Bayn - Waterway | 141 |
| `adrec:638` | Fay Hills - Fay Gardens | 120 |
| `adrec:586` | Merito | 90 |
| `adrec:578` | Mamsha Gardens A | 86 |
| `adrec:600` | Brabus Island | 84 |
| `adrec:613` | Perla 3 | 83 |
| `adrec:394` | The View | 82 |
| `adrec:474` | Al Reeman 2 - Phase 3 - Fay Al Reeman II | 0 |

`adrec:474` returned 633 rows, but all lacked a usable positive sold area. They were excluded and the record remains `missing` for registered-sale evidence.

## Coverage after V54

### Primary evidence ledger

| State | Requirements |
| --- | ---: |
| Present | 3,432 |
| Partial | 3,402 |
| Missing | 26,646 |
| Unestablished | 0 |
| **Total** | **33,480** |

### Advanced completeness audit

| State | Requirements |
| --- | ---: |
| Unestablished | 9,300 |
| **Total** | **9,300** |

The 9,300 advanced items are complete sale history, complete rent history, and validated price, rent, and net-return forecasts across all 1,860 records. V54 establishes evidence presence for bounded observed transactions; it does not claim lifetime completeness or forecast validation.

The cumulative ADREC transaction candidate now contains 33,559 accepted observations across V49 through V54.

## Source and publication boundary

The source is the public ADREC Market Data dashboard and its project-filtered Recent Sales endpoint. The capture retains normalized evidence and provenance, without raw API bodies or personal fields. The endpoint does not provide native transaction identifiers; V54 uses stable hashes of normalized rows plus duplicate ordinals.

ADREC public-site terms reviewed on 27 October 2026 did not establish a data reuse licence. V54 therefore remains an unmerged GitHub research candidate with publication blocked pending rights review. No R2, D1, Worker, Cloudflare traffic, or production data was changed.

## Receipts

- Version: `20261027-enrichment-v54`
- Prior canonical SHA-256: `87cfb51494a1fb68692280598e282531a2556ccdea221e1554d7461c0f49bddb`
- V54 canonical SHA-256: `00307fd0338cf91ee14afb0e096094645850ceeb340951e7b9015f9b1c845589`
- V54 root SHA-256: `c9249822ae074ed6cd5393e1e6475161a3cda5d5effae9543e35659c651eb5d3`
- V54 source-plan SHA-256: `1016efcedb3fae2c6a9fb2d7308c475f5ae6c26b7e0a06dd166060bc7a77ec5c`
- V54 capture SHA-256: `96345cb161c894fb55abd4fd29312dfd3268ceeede1a043e81dbcb049797549c`
- Native-series digest: `eb270ec89dd5bef9cb4402d2d21459078f2222c241cfe2c6bc11b8faef240456`
- Publication state: `unmerged_candidate_only_reuse_rights_pending_not_published`
- Remote writes from the data pipeline: `0`
