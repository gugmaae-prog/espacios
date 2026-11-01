# ADREC registered-sales candidates V49 and V50

## Scope

V49 and V50 append 13,047 normalized, full-share residential registered-sale observations to 40 exact Abu Dhabi project records already present in the fixed catalogue:

- V49: 5,247 observations across 20 records, captured 15 October 2026.
- V50: 7,800 observations across 20 records, captured 22 October 2026.
- API rows reviewed: 13,077; 30 rows excluded because a usable price or area was absent, or the sale represented a partial share.
- Source date windows: 1 January 2019 through each capture date. These windows do not establish complete lifetime transaction history.

The fixed catalogue remains 1,860 records: 1,645 projects and 215 communities. Existing lifecycle facts, events, exposures, asking prices, rents, valuations, scenarios, 16,872 native series, and 633,891 historical rows are preserved.

## V50 records

| Record | Project | Accepted registered sales |
| --- | --- | ---: |
| `adrec:33` | Water's Edge - Precinct B | 1,755 |
| `adrec:23` | Mayan | 837 |
| `adrec:487` | Sea La Vie | 805 |
| `adrec:435` | Al Reeman 2 - Phase 2 | 758 |
| `adrec:38` | Al Raha Gardens | 573 |
| `adrec:495` | Reeman Living 2 | 520 |
| `adrec:34` | Al Zeina | 441 |
| `adrec:21` | Al Bandar | 314 |
| `adrec:513` | Manarat Living II | 289 |
| `adrec:10` | Leonardo Residences | 199 |
| `adrec:68` | Yas Acres - The Dahlias | 194 |
| `adrec:410` | Al Mahra Residence | 182 |
| `adrec:464` | Jubail Terraces | 160 |
| `adrec:367` | Bawabat Al Sharq - Phase 2 | 145 |
| `adrec:20` | Al Hadeel | 140 |
| `adrec:37` | Golf Gardens | 135 |
| `adrec:452` | Perla 1 | 119 |
| `adrec:365` | Yas Beach Residence | 108 |
| `adrec:391` | Bloom Gardens | 63 |
| `adrec:453` | Perla 2 | 63 |

## Remaining research gap

The V50 evidence ledger still contains 42,780 tracked requirements:

| State | Requirements |
| --- | ---: |
| Present | 3,380 |
| Partial | 3,402 |
| Missing | 26,698 |
| Unestablished | 9,300 |

There are 39,400 requirements that are not marked present, or 92.1% of the tracked requirement ledger. This count measures evidence fields and time requirements rather than catalogue records. Transaction rows in V49 and V50 do not automatically upgrade broad lifetime-history requirements, so the coverage states remain unchanged until the relevant requirement can be proven complete.

An exact ADREC query for `Ghantoot Hotel and Resort` returned no registered-sale rows for the 2019 to 2026 window. No synthetic transaction history was added. Palm Jebel Ali, Umm Al Quwain, Fujairah, rents, valuations, lifecycle applicability, and older exact-record history remain priority gaps.

## Source and publication boundary

The source is the public ADREC Market Data dashboard and its project-filtered Recent Sales endpoint. The capture stores normalized evidence and provenance only. It does not retain raw API responses, personal fields, or source transaction identifiers.

ADREC public-site terms reviewed on 22 October 2026 did not establish a data reuse licence. Both batches therefore remain unmerged GitHub research candidates with publication blocked pending rights review. No R2, D1, Worker, Cloudflare traffic, or production data was changed.

## Receipts

- V49 canonical SHA-256: `c37f5dee81d941dfcd80b9a93812db65357ca2425f0222cc3eaf4a07a997dde0`
- V49 root SHA-256: `ef5b50cda572a9c06e6c4d1dcf5cde1730e1acd96bd8f2fc9d2ce346d73cf692`
- V50 canonical SHA-256: `2c65717829e77b1d1874885d1898ee4b1c8ba81745762e8798993e7d4457f1c0`
- V50 root SHA-256: `7208834ffe9e9a1dbcaa7c6c3fd201acf3695d3d69b8e84508aa18f0e40785be`
- V50 source-plan SHA-256: `07fd4a108f9f7a8ca9175d96e8e4c5cbceb1d6494590fd0531463629f006da48`
- V50 capture SHA-256: `56b41db499e4531b5a531bb7a0d71d58e27869e6a2836fb4ba9288aa9b50b2c6`
- Publication state: `unmerged_candidate_only_reuse_rights_pending_not_published`
- Remote writes: `0`
