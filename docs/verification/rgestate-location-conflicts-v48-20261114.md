# RGEstate location conflict review — 14 November 2026

The immutable 1,660-row RGEstate index and 996-row commercial subset retain the publisher's listing facts and source links. Three rows have a publisher location label that conflicts with the row's own title or source URL:

| Source listing ID | Publisher location label | Conflicting text | Treatment |
| --- | --- | --- | --- |
| 49428 | Al Qusais | Title says Sajja, Sharjah; source URL says Al Qusais | No reviewed area or emirate assignment |
| 43139 | Al Baraha | Title and source URL say Al Barsha 2, Dubai | No reviewed area or emirate assignment |
| 49066 | Al Ain | Title and source URL say Margham, Dubai | No reviewed area or emirate assignment |

The exact snapshot rows are identified by ID, publisher location label and a title fragment. They remain searchable with their original facts and links. The commercial cards and both APIs disclose `publisher_fields_conflict`; the commercial area aggregation excludes them. No unit or building coordinate is inferred from a title, URL, or area reference. This is a review of internal source consistency, not independent proof of the correct address.

The reviewed-area total in the full index changes from 922 to 919, and unresolved rows from 135 to 138. The commercial map groups 934 of its 996 snapshot rows and leaves 62 unlocated. The seven-emirate inventory remains 41 separately classified published source snapshots; the accepted V48 baseline remains 1,645 projects, 1,860 history records and 16,872 native series. The 195-object private IDrive runtime allowlist still contains the same keys, lengths and object checksums. Its inventory-version metadata is now `20261114-uae-evidence-coverage-v48`, and its file SHA-256 is `f135823e1698b03ea713939ea2382244f77ce677f809173f8425f357117166fc`. The previous undeployed auth Worker candidate is tied to the previous manifest file hash and remains inactive. These APIs still read the packaged checksum-verified Worker snapshots; IDrive is a dated verified replica for newer evidence.

No new registered transaction, rent, current availability, or project-coordinate claim is made by this review. R2 remains disabled, and the Data Room remains restricted.

## Release verification

`npm run verify` passed, including the V48 native-series preservation gate. Source commit `1e8372f0f4690b0f9b7c68186d2aa22a3d872cf1` produced the provenance-pinned Worker in generated commit `ae208cff`. Both were pushed to draft PR #102. Cloudflare Worker version `1acaf24f-f826-4ca2-8756-00dea00a29fe` was staged at 0% and verified on the canonical route with a version override. Deployment `c8d49f83-8951-47a6-9efd-e256433a9d67` then promoted it to 100%.

Three ordinary-traffic passes confirmed the promoted version, direct verified IDrive read of the accepted archive, 41 published source routes in the inventory, 1,645 accepted projects, 1,860 history records, 16,872 native series, 996 commercial listings with 934 area-mapped and 62 unlocated, and the three flagged source conflicts. `/map` and `/map/commercial` returned 200; `/map/data-room` returned 404. The newer source APIs still identify their runtime as immutable Worker snapshots and IDrive as a dated private replica.
