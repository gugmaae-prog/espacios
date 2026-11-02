# UAE map data coverage — 2 November 2026

This is a release audit, not a claim that every UAE development or transaction is present. Counts below are from the deployed accepted V48 `/map/api/uae-heatmap` population on Worker v15. They describe that snapshot only; no authoritative all-UAE denominator has been established.

| Emirate | V48 projects | Mapped in V48 | Searchable without coordinates | Local registered-sale history in V48 |
| --- | ---: | ---: | ---: | --- |
| Abu Dhabi | 347 | 220 | 127 | No |
| Ajman | 10 | 10 | 0 | No |
| Dubai | 1,119 | 1,119 | 0 | Yes, DLD-derived area history with sample safeguards |
| Fujairah | 1 | 1 | 0 | No |
| Ras Al Khaimah | 89 | 89 | 0 | No |
| Sharjah | 59 | 59 | 0 | No |
| Umm Al Quwain | 20 | 20 | 0 | No |
| **Total** | **1,645** | **1,518** | **127** | Scope varies by emirate |

The V48 record archive has 1,860 project and community records and 16,872 native history series. Its 2,717 approved recovery objects are verified in private IDrive E2 with immutable fallback. This archive does not establish complete current UAE market coverage or recover the original history and saved model bundles.

## Additional source-backed backend data

- [Ajman Real Estate Projects](https://data.ajman.ae/explore/dataset/real-estate-projects/): 3,457 dated snapshot rows, 364 distinct source IDs ever and 298 in the latest 2026-06-30 snapshot. It has no coordinates. Source IDs remain separate from V48 map identities.
- [Ajman Real Estate Units Sales](https://data.ajman.ae/explore/dataset/real-estate-units-sales/): 6,075 quarterly aggregate rows under 239 source project labels. These are not individual transactions.
- [Ajman Real Estate Units Registration](https://data.ajman.ae/explore/dataset/real-estate-units-registration/): 5,124 quarterly aggregate rows under 335 source project labels. Tentative certificates and final title deeds are separate stages and are not added into a unique-unit count.

These three Ajman sources are stored as separate, checksum-verified private IDrive objects and exposed through read-only, source-labelled APIs. Neither their row counts nor their project labels can be added to the V48 project total without a reviewed identity crosswalk. Their metadata reports CC BY 4.0. The published APIs are `/map/api/uae-evidence/ajman/register`, `/map/api/uae-evidence/ajman/sales`, and `/map/api/uae-evidence/ajman/registrations`.

The newer PSR Data Hub public registry currently returns 503 after the Cloudflare D1 account exceeded its free-tier daily row-read limit. `/map/api/projects-all` serves an exact reviewed older public snapshot during that outage, labelled degraded with `completeForCurrentDataHub:false`. Its 1,073 unique slugs have a 22 July 2026 registry vintage and represent a separate PSR population, not current UAE completeness.

## Work needed for full UAE coverage

1. Establish an authoritative per-emirate project denominator, publication rights, update cadence, and identity fields. Record what each authority publishes and what remains inaccessible. Do not infer completeness from seven named emirates or from V48 snapshot totals.
2. Prioritize official project registers for Fujairah, Umm Al Quwain, Sharjah, and Ras Al Khaimah, then validate IDs, dates, status and coordinates before adding any pins. Current V48 project counts are especially thin in Fujairah and Ajman. The Ajman register is available now but cannot be converted into 298 pins without verified coordinates.
3. Resolve Abu Dhabi ADREC V55 reuse rights before publishing its separate registered-sale candidate. The 127 Abu Dhabi V48 records without verified coordinates remain searchable.
4. Recover the missing original history and saved model bundles from exact, approved backups. Preserve V48 native history and conditional scenarios as distinct evidence classes until then.
5. Restore a current PSR Data Hub source after D1 capacity recovers and reduce repeated row reads or arrange a reviewed paid capacity change. Retire the older fallback only after all current pages and source totals reconcile.
6. For each new source, capture publisher metadata and licence, preserve immutable source bytes and checksums, validate row grain and quality, publish a source-labelled API, stage at 0%, verify live readback and restrictions, then promote and recheck normal traffic.
