# V18 ADREC project-detail pass

As of **7 October 2026**, V18 reviews the official Abu Dhabi Real Estate Centre (ADREC) detail endpoint for the **305 project IDs already matched exactly** to the fixed V17 catalogue. It adds no catalogue records and preserves all **1,645 projects and 215 communities**.

The bounded, throttled pass completed all 305 requests. **291 responses** matched both the existing numeric directory ID and project number. Their registration dates all agreed with the V17 listing evidence. Fourteen HTTP-success responses contained no usable project-detail record and remain documented as `detail_missing`; no name-based or fuzzy matches were attempted.

For the 291 exact records, V18 retains an allowlisted register snapshot: directory ID and project number, registration date, current progress percentage, latest-report date and report completion percentage. It adds **145 dated construction-progress observations** from latest reports with an inspection date at or before the cutoff. One other response reported an inspection date of **28 July 2028**, beyond the cutoff. That report date and its completion percentage are flagged and excluded from lifecycle facts; the dated-as-retrieved register fields remain distinct from that excluded report. A project progress value does not prove completion, handover or occupancy.

| Check | V17 | V18 addition | Interpretation |
| --- | ---: | ---: | --- |
| Existing projects / communities | 1,645 / 215 | 1,645 / 215 | Fixed catalogue retained |
| Exact detail records accepted | — | 291 | Both ADREC ID and project number matched |
| Dated inspection-progress observations | — | 145 | Source date and retrieval availability retained separately |
| Detail records with no usable response body | — | 14 | Remain missing; attempts are not evidence |
| Future-dated report metrics excluded | — | 1 | Report date is after the 7 October 2026 cutoff |
| Sale, rent, valuation or transaction facts added | 0 | 0 | This endpoint supplies no such observations |
| Validated annual forecasts through 2080 | 0 | 0 | Unsupported scenario values remain null |

The 42,780-requirement evidence ledger is unchanged: **3,090 present, 3,434 partial, 26,956 missing and 9,300 unestablished**. **39,690 (92.78%) remain unresolved.** This is requirement-level evidence coverage, not the percentage of historical price data. The snapshot continues to retain **318,562 aggregate historical observations, 13,401 series, 3,239 sources, 105 events and 7,382 event exposures**. The 145 progress observations do not establish lifetime financial history.

## Identity, dates and source controls

- The pass starts only from the 305 V17 exact-ID register facts. It accepts an endpoint response only when both numeric ADREC ID and project number agree with that existing record.
- The official detail endpoint is linked through each source record. The client response was reduced to the approved fields; raw JSON, personal contact fields, escrow identifiers, report identifiers and image URLs/content were not retained. No images were requested.
- Source availability is the capture time in 2026. An older registration date or inspection date does not mean the fact was available to a model at that earlier date. The future-dated report remains a conflict rather than history.
- The source licence is recorded as rights pending. A public detail page is not treated as a general dataset-reuse licence; no complete official response is redistributed.
- Research attempts, unusable detail responses and the future-date conflict remain visible as collection statuses. They do not count as verified financial observations or as requirement coverage.

Official context: [ADREC Project Development](https://adrec.gov.ae/en/sectors/regulatory-services/project-development), [ADREC project detail example](https://adrec.gov.ae/en/Directory/ProjectsDetails?projectId=505), and [ADREC FAQs](https://adrec.gov.ae/en/faqs). ADREC describes a lifecycle service with project-registration and progress reporting; a dated report is still distinct from a completion certificate, unit delivery or actual occupancy.

## Remaining priorities

1. Find public or already-authorized records for direct sale prices, signed rents, dated valuations and unit-level transaction identifiers. Retain the 14 missing detail cases as gaps unless an exact, verifiable source is found.
2. Continue project lifecycle research for actual physical construction start, completion certificate, handover and occupancy; do not infer these from registration or a progress percentage.
3. Link government-project and disruption events only to verified local exposure and measure observed price/rent responses with controls for concurrent shocks and supply.
4. Keep all 2080 annual paths conditional until each record has defensible observed anchors, dated assumptions, delivery/supply and cost inputs, and a validation design. A specified endpoint is not a validated forecast.
