# V17 ADREC project register pass

As of 2026-10-07, V17 adds an exact-ID review of the public Abu Dhabi Real Estate Centre (ADREC) project directory to the fixed Espacios catalogue. It retains all **1,645 projects and 215 communities** and creates no catalogue records.

The reviewed capture contains 320 directory rows. Of those, 308 have an exact `adrec:<ID>` catalogue match; three matched authority IDs (594, 595 and 597) are already assigned to reviewed canonical Nawayef subjects and are excluded from duplicate publication. The resulting pass adds **305 register snapshots, 305 registration-date milestones and 302 point-in-time completion-percentage snapshots**. Three accepted rows have no completion percentage. Twelve rows have no exact catalogue record and stay unlinked; no fuzzy name matches are made.

Registration dates are normalized to the Asia/Dubai calendar day from the native `ProjectCreateDate` value. The conversion is cross-checked against the directory detail page's “Registered on” value for IDs 594, 595 and 597. This milestone establishes project registration only; it is not an announcement, first marketing, first sale, physical construction start, handover or occupancy date. Progress is the value in the directory capture retrieved at `2026-10-07T11:16:47.507Z`; it is not a dated inspection report or proof of completion. Source availability is therefore the capture date, even when the register date is older.

V17 changes the 42,780-row evidence coverage ledger as follows:

| Status | V16 | V17 | Meaning |
| --- | ---: | ---: | --- |
| Present | 2,483 | 3,090 | A qualifying, sourced requirement is present |
| Partial | 3,434 | 3,434 | Some scoped evidence exists; coverage remains incomplete |
| Missing | 27,563 | 26,956 | Required evidence is still absent |
| Unestablished | 9,300 | 9,300 | Applicability or validation is not established |
| Unresolved | 40,297 (94.20%) | 39,690 (92.78%) | Partial + missing + unestablished |

These are requirement counts, not percentages of historical prices. The pass adds no sale or rent observations and does not prove complete lifetime financial history. The aggregate history remains **318,562 observations**, with its existing identity, geography, frequency and source limitations. No record has a validated annual price, rent or net-return forecast through 2080; the 2027–2080 scenario slots remain conditional and null when no supported anchors exist.

## Source and identity controls

- Source: public ADREC project directory capture, checksum recorded in the V16 source registry; raw response body remains private and is not redistributed.
- Join: exact numeric ADREC directory ID to an existing `adrec:<ID>` project only. The native project number is retained as register evidence. Names are not used to join or create records.
- Availability: `2026-10-07T11:16:47.507Z`; observations from this current-vintage capture are not treated as known to earlier forecast origins.
- Register aggregates such as sold counts and percentages are retained as register fields, never expanded into transactions.
- The official directory detail page identifies “Registered on” and “Completion percentage”; ADREC's project-development service describes registration and construction-progress reporting across the project lifecycle.

Official references: [ADREC Project Development](https://adrec.gov.ae/en/sectors/regulatory-services/project-development), [ADREC project detail example](https://adrec.gov.ae/Directory/ProjectsDetails?projectId=611), and [ADREC FAQs](https://adrec.gov.ae/en/faqs).

## Next evidence priorities

1. Obtain row-level signed lease/rent data and dated valuations from public authority sources or existing lawful access, retaining missing dates and segment definitions.
2. Review official project-detail pages for the remaining exact-ID matches to strengthen registration dates and collect actual completion, inspection and delivery milestones where they are published.
3. Identify a public, stable source for historical unit-level sale data and transaction identifiers; preserve the three Nawayef cohorts and test duplicates before linking any new rows.
4. Source school, transport, healthcare and government-project dates at actual community access/catchment level, then measure local price/rent response against suitable controls.
5. Build conditional annual scenarios only after record-specific observed anchors, supply and cost inputs are available. Keep validated forecasts distinct from scenario paths; a 2080 endpoint alone is not validation.
