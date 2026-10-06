# Historical enrichment v11

Candidate snapshot `20261006-enrichment-v11` is replayed onto the current main builder, whose snapshot version is `20261005-enrichment-v10` as of `2026-10-05`. The committed snapshot file on main was still the V9 artifact. Rebuilding that builder first materializes the v10 structural-event seed already in the repository: 105 events, 7,382 exposures, and 2,860 sources, with the same 316,608 public native points and 13,158 series. Preservation below uses that rebuilt v10 snapshot as the baseline.

The candidate then merges two reviewed primary-source packets that were already in the repository and not yet in the snapshot:

- `enrichment/v10/pass21-primary-source.json` — Avenue Park Towers, Woodland Crest, Regent Residences Dubai Sankari Place, Trussardi Residences, Derby Heights, and an identity-only review of Elemental 22.
- `enrichment/v11/pass22-arada-primary.json` — Kaya, Robinia, and Vida Residences Aljada.

The packets add 11 sources and 28 accepted facts. They add no native aggregate rows and no events. Public observations remain 316,608, with the same 216 rights-pending rows withheld. Two Arada press-release URLs already had source captures (`project-nondubai-pass3-b1c5c5cfa2d20e1f` and `project-nondubai-pass3-f874a8151f226b0f`). Those milestones use the existing source IDs. The stored capture metadata is unchanged. A second merge of the same packets fails closed on source and fact ID collisions.

The quote guard keeps the Trussardi AED 3.5 million “2 BR with pool” advertisement as evidence. It does not replace that project’s headline asking price, which stays the existing AED 1.4 million observation `fact-83ce7284f3d8131bc2728873`. No headline asking price changed between the v10 baseline and this candidate. A published 2026-10-05 asking quote remains headline-eligible on the 2026-10-06 snapshot until a newer eligible quote replaces it. Elemental 22 has an official identity review and no promoted dated fact.

Checklist movement from the rebuilt v10 ledger is 22 requirements, from missing to present:

- original launch and announcement evidence for Avenue Park Towers, Woodland Crest, Regent Residences Dubai Sankari Place, Trussardi Residences, Derby Heights, Kaya, Robinia, and Vida Residences Aljada
- construction for Trussardi Residences, Kaya, and Robinia
- phase milestones for Kaya and Robinia
- the Vida delivery report

The resulting ledger is 3,666 present, 2,153 partial, 27,661 missing, and 9,300 unestablished. Completion and occupancy already on the Arada records stay as they were. Dated events stay at 105, including the 13 structural events from the v10 seed, and none carries a price uplift. These lifecycle facts are not new event studies. Conditional annual slots remain 54 years, 2027 through 2080, with zero approved points.

A separate packet of 1,270 aggregates was described in the V9 release note and is not stored in this repository. It is not part of this candidate.

`data/historical-intelligence/coverage-preservation-v11.json` records the check against the rebuilt v10 baseline: 1,860 records, 2,860 sources, 13,158 native series, 316,608 native points, 105 events, and 7,382 exposures preserved, with 11 new sources and 0 new series.

This document is not a production release receipt. Production remains the reviewed V9 Worker until a separate deployment.
