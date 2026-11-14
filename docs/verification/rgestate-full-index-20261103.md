# RGEstate full-index facts — 3 November 2026

The owner authorized Espacios to reuse factual details and source links from all [RGEstate listings](https://www.rgestate.com/properties), including third-party advertisers. Photos are excluded at the owner's request. This release adds a separate, read-only publisher-index API at `/map/api/uae-evidence/rgestate/index`; it does not change the accepted V48 Map catalogue or publish property photographs.

Two independent ordered captures of all 82 full-index pages returned the same **1,708 distinct source listing IDs**. The builder verifies every captured page against its recorded byte length and SHA-256 and checks that all 894 separately captured commercial-category rows are byte-for-byte equal to their full-index facts. The committed normalized gzip is decoded and SHA-256 checked at build and Worker read time. The source capture and validation code is `scripts/build-rgestate-index.py`; the immutable normalized snapshot and checksum report are in `data/uae-evidence/rgestate/`.

| Publisher URL path class | Rows | Interpretation |
| --- | ---: | --- |
| `sale` | 831 | Publisher sale-path asks; not registered sales |
| `rent` | 756 | Publisher rent-path asks; only explicit annual prices are normalized |
| `business-sale` | 106 | May sell an operating business; monetary labels are not property prices |
| `off-plan` | 15 | Path class only; sale/rent terms remain unverified |
| **Full index** | **1,708** | **894** also appear in the verified commercial category; **814** do not |

The 814 outside the commercial category are **not labelled residential** because the index does not prove that category for each row. A URL path class is not a property-use class. The API preserves title, source URL, location label, area and price labels, source listing ID, path class, and verified commercial-category membership. It exposes a numeric AED price only where the source amount and period are interpretable. It adds no coordinates, V48 project identity, sale transaction, or availability confirmation. At capture, 602 rows lacked an interpretable area, 23 lacked a location label, and 144 had no normalized numeric price. The API supports bounded `kind`, `commercial`, `emirate`, `q`, `limit`, and `offset` filters; writes and invalid filters are rejected.

The existing `/map/api/uae-evidence/commercial/listings` remains the focused 894-row commercial-category API. Its rows overlap the new publisher index and **must not be added** to the 1,708 total. Neither API is an authoritative UAE project denominator or a live availability feed. No R2 binding or ADREC candidate is needed for this snapshot.

## Explicit publisher emirate labels

The `emirate` filter classifies only eight exact source location labels into the seven emirates. It does not infer an emirate from a title, URL, district, or nearby place. The 1,104 rows without one of those exact labels remain available through `emirate=unassigned` and the unfiltered index. The derived report is reproducible with `python3 scripts/build-rgestate-emirate-labels.py --check`; it is tied to the immutable index SHA-256.

| Source location label mapped to emirate | Rows | Verified commercial-category rows |
| --- | ---: | ---: |
| Abu Dhabi | 9 | 8 |
| Ajman | 32 | 16 |
| Dubai | 5 | 3 |
| Fujairah | 3 | 2 |
| Ras Al Khaimah | 7 | 4 |
| Sharjah | 355 | 130 |
| Umm Al Quwain or Emirate of Umm Al Quwain | 193 | 144 |
| **Explicitly labelled** | **604** | **307** |

The per-emirate counts describe a brokerage snapshot, not all listings in any emirate. Publisher labels and current availability are unverified. A live spot-check found that Fujairah source ID 52140 redirects to the RGEstate home page, while IDs 53944 and 47886 still opened their listing URLs; this is why the API does not claim current availability. `business-sale` prices remain separate from property asks. The coverage API exposes these counts as `publisherListingSnapshot`, separate from each emirate's authority/source inventory, and retains the missing official-project-register gaps.
