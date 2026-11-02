# UAE map data coverage — 2 November 2026

This is a release audit, not a claim that every UAE development or transaction is present. Counts below are from the accepted V48 `/map/api/uae-heatmap` population served by Worker v18. They describe that snapshot only; no authoritative all-UAE denominator has been established.

| Emirate | V48 projects | Reported project/source points | Approximate community-centre points | Searchable without coordinates | Local registered-sale history in V48 |
| --- | ---: | ---: | ---: | ---: | --- |
| Abu Dhabi | 347 | 199 | 21 | 127 | No |
| Ajman | 10 | 2 | 8 | 0 | No |
| Dubai | 1,119 | 825 | 294 | 0 | Yes, DLD-derived area history with sample safeguards |
| Fujairah | 1 | 0 | 1 | 0 | No |
| Ras Al Khaimah | 89 | 68 | 21 | 0 | No |
| Sharjah | 59 | 49 | 10 | 0 | No |
| Umm Al Quwain | 20 | 15 | 5 | 0 | No |
| **Total** | **1,645** | **1,158** | **360** | **127** | Scope varies by emirate |

The 1,158 project/source points are retained as reported, not all independently surveyed project sites. The 360 community-centre points indicate approximate areas and must not be used as project-site locations. Together these 1,518 points are renderable on the map; the other 127 records remain searchable.

The V48 record archive has 1,860 project and community records and 16,872 native history series. Its 2,717 approved recovery objects are verified in private IDrive E2 with immutable fallback. This archive does not establish complete current UAE market coverage or recover the original history and saved model bundles.

## Additional source-backed backend data

- [Ajman Real Estate Projects](https://data.ajman.ae/explore/dataset/real-estate-projects/): 3,457 dated snapshot rows, 364 distinct source IDs ever and 298 in the latest 2026-06-30 snapshot. It has no coordinates. Source IDs remain separate from V48 map identities.
- [Ajman Real Estate Units Sales](https://data.ajman.ae/explore/dataset/real-estate-units-sales/): 6,075 quarterly aggregate rows under 239 source project labels. These are not individual transactions.
- [Ajman Real Estate Units Registration](https://data.ajman.ae/explore/dataset/real-estate-units-registration/): 5,124 quarterly aggregate rows under 335 source project labels. Tentative certificates and final title deeds are separate stages and are not added into a unique-unit count.
- [Ajman Real Estate Units Transactions](https://data.ajman.ae/explore/dataset/real-estate-units-transactions/): 6,299 aggregate rows under 249 source labels. This mixes dispositions and mortgage activity without a transaction-type field. It overlaps unit sales, so reported counts cannot be summed. The 318 rows without a reported period and 4,594 rows without monetary values retain nulls. It is served from a checksum-verified immutable Worker asset at `/map/api/uae-evidence/ajman/dispositions`.
- [Ajman Completed Real Estate Development Projects](https://data.ajman.ae/explore/dataset/completed-real-estate-projects/): 496 dated rows and 191 IDs, all already in the Ajman project register with matching dated completed status. It adds zero distinct project identities and is not ingested again.
- [Ajman Management Companies for Real Estate Development Projects](https://data.ajman.ae/explore/dataset/management-companies-for-real-estate-development-projects/): 451 annual appointment rows for 153 exact official Ajman source project IDs, all linked to the separate Ajman project register. Thirteen office IDs appear; three projects have changed offices across 2024–2026. These appointments do not establish developer or owner identity, V48 joins, map coordinates, or current status beyond the latest reported year.

The Ajman register, unit sales, and unit registrations are stored as separate, checksum-verified private IDrive objects and exposed through read-only, source-labelled APIs. Unit dispositions use a separate immutable Worker asset. The management appointments use a checksum-verified embedded snapshot, with a matching independent API readback. Neither row counts nor project labels can be added to the V48 project total without a reviewed identity crosswalk. The portal's [terms](https://data.ajman.ae/terms/terms-and-conditions.pdf) license its open datasets CC BY 4.0. The APIs are `/map/api/uae-evidence/ajman/register`, `/map/api/uae-evidence/ajman/sales`, `/map/api/uae-evidence/ajman/registrations`, `/map/api/uae-evidence/ajman/dispositions`, and `/map/api/uae-evidence/ajman/management`.

The newer PSR Data Hub public registry currently returns 503 because Cloudflare D1 rejects reads with free-tier daily row-read error 7500. Read-only D1 exports of the `projects`, `tenant_project_publications`, and `project_registry_state` tables shared bookmark `00000436-00000000-00005117`. The public Data Hub projection from those exports contains 1,091 published PSR projects and unique slugs, matching the recorded registry count and revision 2, updated 27 September 2026. The public projection and its exact checksums are packaged in `data/recovery/psr-public-d1-export-20261102.*`; raw SQL exports remain private. The recorded registry content hash did not reproduce under the current Worker algorithm, so the fallback is labelled degraded with `registryHashReconciled:false` and `completeForCurrentDataHub:false`. If this newer export cannot be verified, the exact older 1,073-slug July snapshot remains a separate degraded fallback. Neither population is the accepted V48 map identity universe or an all-UAE census.

## Work needed for full UAE coverage

1. Establish an authoritative per-emirate project denominator, publication rights, update cadence, and identity fields. Record what each authority publishes and what remains inaccessible. Do not infer completeness from seven named emirates or from V48 snapshot totals.
2. Prioritize official project registers for Fujairah, Umm Al Quwain, Sharjah, and Ras Al Khaimah, then validate IDs, dates, status and coordinates before adding any pins. Current V48 project counts are especially thin in Fujairah and Ajman. The Ajman register is available now but cannot be converted into 298 pins without verified coordinates.
3. Resolve Abu Dhabi ADREC V55 reuse rights before publishing its separate registered-sale candidate. The 127 Abu Dhabi V48 records without verified coordinates remain searchable.
4. Recover the missing original history and saved model bundles from exact, approved backups. Preserve V48 native history and conditional scenarios as distinct evidence classes until then.
5. Restore a current PSR Data Hub source after D1 capacity recovers and reduce repeated row reads, especially the full project-filter scan repeated on every page. Reconcile all live pages, registry totals, and content hash before treating the D1 export as superseded. A paid capacity change requires a separate cost decision.
6. For each new source, capture publisher metadata and licence, preserve immutable source bytes and checksums, validate row grain and quality, publish a source-labelled API, stage at 0%, verify live readback and restrictions, then promote and recheck normal traffic.
