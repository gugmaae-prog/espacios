# Commercial map emirate and asking-rate review — 10 November 2026

The source remains the owner-authorized, photo-free [9 November RGEstate capture](../../data/uae-evidence/rgestate/commercial-listings-validation.json): 863 commercial-category listing IDs (452 rent, 411 sale). The captured facts and their checksums are unchanged. The map aggregates 808 listings into 50 previously reviewed OpenStreetMap area references; 55 lack one and remain visible under **All UAE**. An area centre is not a unit coordinate. Current availability and whether different listing IDs describe distinct physical units are unverified.

The `/map/commercial` emirate selector and both commercial APIs use the reviewed area-to-emirate relation. The filtered areas and listing rows reconcile to the same counts:

| Emirate | Listings with reviewed area reference |
| --- | ---: |
| Abu Dhabi | 9 |
| Ajman | 16 |
| Dubai | 504 |
| Fujairah | 2 |
| Ras Al Khaimah | 4 |
| Sharjah | 129 |
| Umm Al Quwain | 144 |
| **Total** | **808** |

The listing API returns `reviewedAreaEmirate`, never a verified unit address or project pin. An emirate filter excludes the 55 unresolved locations; **All UAE** retains them. This is the geographic coverage of this publisher snapshot, not an all-UAE commercial inventory denominator.

For 731 of the 863 rows, the API computes `askingAedPerSqft = round(priceAed / areaSqft, 2)` where the publisher supplied a usable positive price and explicit area field. `askingRatePeriod` preserves `year` for rent or `total` for sale. Other rates stay `null`; title text is not parsed as a missing area. The values are advertised asking rates, not registered sale prices, rent contracts, comparable valuations, or market estimates. The page displays the rate only on eligible cards and keeps the source listing link and capture date visible.

The snapshot, existing UAE evidence routes, accepted 1,645 V48 projects, 1,860 record histories, 16,872 native series, and restricted Data Room remain separate. Verification covers API count reconciliation, all 863 rate calculations, browser desktop/mobile filters and theme, full repository checks, and staged plus normal-traffic readback.
