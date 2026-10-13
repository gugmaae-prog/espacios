# V26: September DLD-derived project-register evidence

V26 appends a newer, publicly available DLD-derived project-register snapshot to eight existing Dubai project records. It preserves the V25 catalogue and every prior observation. The retained source is the publisher's public CSV already present in the repository; this pass rechecked its decompressed byte count and SHA-256 rather than claiming a new web scrape.

## Source and identity checks

- Publisher: Certified Poor, independent publisher of DLD-derived project-register data.
- Source: [Dubai project register CSV](https://certifiedpoor.com/open-data/dubai-project-register-2026.csv), published 1 September 2026. The publisher declares [CC BY 4.0](https://certifiedpoor.com/open-data/).
- Source snapshot: 373 rows; decompressed size 46,867 bytes; SHA-256 `4f5365e88b5016edd9e157dac10b99d06fb8d4ca4579c9b4e1012e3fd84c92d7`.
- Reconciliation: 55 rows had one unique exact normalized project-name match in the 1,645-project catalogue. Eight passed the complete identity check: exact project name, plus exact developer and area agreement with an existing identity-verified DLD project-register fact carrying the stable DLD project ID. The eight IDs remain attached to both the source fact and DLD identity evidence.
- Exclusions: 47 exact-title rows remain quarantined (46 lack a single verified DLD project ID/developer/area record; one, `Kaia`, conflicts on developer). The other 318 source rows had no unique exact project-name match. None was auto-joined by fuzzy title, proximity, or developer brand.

## Evidence added

Each of the eight records gains one separately dated DLD-derived register snapshot with its project status, progress percentage, registered unit count, declared project value, escrow status, expected start/end dates, and identity crosswalk. Each also gains a reported progress snapshot and a target construction-start milestone. The progress date is the dataset's 1 September publication snapshot because the underlying site-inspection date is not included.

The official DLD project-register schema defines the start and end dates as expected dates, describes completion percentage as inspection-request based, and defines its completion date as an expected project termination date. See the [DLD project data page](https://dubailand.gov.ae/en/open-data/real-estate-data/) and [DLD project-register schema](https://gslb.dubaipulse.gov.ae/data/dld-registration/dld_projects-open?page=8). Accordingly:

- Expected dates remain targets; they do not establish actual construction start, completion, or handover.
- Progress percentages remain reported snapshots; missing inspection dates are explicit.
- `declaredProjectValueAED` is a DLD-derived register value, not a property valuation or sale price.
- Conflicting source snapshots are preserved beside each other. No earlier status, progress, expected date, or unit count is overwritten or silently treated as corrected.

All eight records now carry this dated progress snapshot; seven had been missing construction evidence and now have a reported construction-progress item, while one already had other construction evidence. All eight retain incomplete lifetime sale/rent coverage. All eight now also have a DLD-derived expected construction-start target; none is presented as an actual start date.

## Source-to-source differences retained

Comparing this 1 September snapshot with the earlier official DLD register capture (native source load timestamp 15 June 2026):

- Project status differs on all eight records (`ACTIVE` in the DLD-derived snapshot versus `NOT_STARTED` or `PENDING` in the earlier DLD capture).
- Progress differs on four records: 0.1% for Akala Hotels and Residences, 0.12% for Damac District, 2.14% for Derby Heights, and 0.62% for Helvetia Verde. The other four rows report 0%.
- Eltiera Views has a later expected start date in the September snapshot (16 April 2026 versus 19 September 2025).
- Registered unit counts differ for Eltiera Views (1,185 versus 0) and Damac District (1,197 versus 1,008).
- The expected end dates agree across these eight rows.

These are recorded as source differences, not proven corrections or evidence of a market-price effect.

## Coverage and limits

| Measure | Before V26 | After V26 |
|---|---:|---:|
| Projects | 1,645 | 1,645 |
| Communities | 215 | 215 |
| Historical rows | 563,675 | 563,675 |
| Native history series | 15,063 | 15,063 |
| Project register snapshots added | 0 | 8 |
| Direct sale/rent observations added | 0 | 0 |
| Current property valuations added | 0 | 0 |
| Actual completions or occupancy claims added | 0 | 0 |
| Approved annual scenario records through 2080 | 0 | 0 |

This pass improves dated project-register evidence for eight records; it does not fill their financial histories or constitute a 100% completeness claim. All 1,860 records remain in the catalogue. No government-context record, nearby-area proxy, or register-declared value is substituted for a project's own prices, rent, valuation, or validated forecast.

The V26 checklist contains 42,780 requirements: 3,163 present, 3,437 partial, 26,880 missing, and 9,300 unestablished. That leaves **39,617 requirements (92.61%) unresolved**. This is requirement-status coverage, not a percentage of historical prices. Every record still has zero approved annual scenario values for 2027–2080; unsupported estimates remain null.

## Production publication and live checks

- V26 manifest root: `8ef9fa8b190548c9252c94c9e3ae7206614b97388b0de58682dc8167d53db5c7`.
- The production publisher created 2,131 immutable R2 objects and reused 48 matching objects. It indexed 39,085 D1 rows plus one snapshot header; every table count matched the manifest before the snapshot state changed to `complete`: 1,860 records, 3,254 sources, 105 events, 7,382 exposures, 15,063 series and 11,421 record-series links.
- Production Worker `psr-portfolio-map-v2`, version `84559aa7-bd39-4502-8aae-b110324c5455`, is serving **100% traffic** in deployment `c662764d-d187-4605-afa1-889f0efd0816`. The existing map route and `DATA_ROOM_PUBLIC=false` remain in place.
- Live `https://espacios.me/map` returns HTTP 200 with the V29 palette asset token. All eight accepted project record-history APIs returned HTTP 200 and `20261008-enrichment-v26`; each exposed its expected DLD-derived fact and dated milestones.
- `npm run verify` passed all 166 tests on the deployed source tree. The selected mobile Map control remains on the softer slate Espacios palette. Gold was inherited UI styling and never represented appreciation or property value.

- Git source and this receipt are in [PR #98](https://github.com/gugmaae-prog/espacios/pull/98), commit `f4c9c7010f8b446c70dbd44a74ec9b7d174f836a`. Supabase points to V26 and records `pending_merge` until the source PR is merged.
- The temporary release bridge was scoped to this root, expiring, and has been deleted; its health endpoint returns HTTP 404. Its private bearer token and target manifest were removed and never committed.

## Reproduction and verification

- `scripts/append-dld-derived-project-register-pass-20261008.py` validates the pinned source, locked record-to-DLD-ID mappings, developer/area match, and append-only invariants before regenerating V26 indexes.
- `tests/historical-v26-dld-derived-project-register.test.mjs` verifies the record inventory, source checksum, exact matches, quarantines, field semantics, no price/valuation/occupancy additions, and no 2080 forecast certification.
- Run `python3 scripts/append-dld-derived-project-register-pass-20261008.py` only from the V25 baseline; the script fails if the baseline, source, or identity mapping has changed.
