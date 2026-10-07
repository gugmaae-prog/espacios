# Modon historical evidence review — 7 October 2026

Snapshot `20261007-enrichment-v12` adds verified developer launch evidence for
four existing project records and a masterplan announcement for one community.
All 1,645 projects and 215 communities remain. The exact reviewed inputs are in
[`pass35-modon-primary.json`](../enrichment/v12/pass35-modon-primary.json).

| Existing record | Dated evidence added | Historical advertised starting price |
| --- | --- | --- |
| Muheira | Launch/announcement, 22 May 2025 | AED 1,200,000, apartments |
| Nawayef Park Views | Launch/announcement, 10 December 2024 | AED 2,000,000, apartments |
| Nawayef Village | Launch/announcement, 6 May 2025 | No price added |
| Nawayef East | Initial launch/announcement, 7 November 2024; joint construction contract award, 19 December 2025 | AED 6,600,000, initial Homes/Heights release |
| Hudayriyat Island community | Masterplan announcement, 13 June 2023 | No price added |

The [Muheira release](https://www.modon.com/about-modon/media-centre/details/2025/05/22/modon-unveils-muheira--the-first-modon-freehold-residential-towers-on-reem-island),
[Park Views release](https://www.modon.com/about-modon/media-centre/details/2024/12/10/modon-launches-nawayef-park-views--the-first-apartments-release-on-hudayriyat-island),
[Village release](https://www.modon.com/about-modon/media-centre/details/2025/05/06/modon-launches-first-townhouses-on-hudayriyat-island-at-nawayef-village)
and [East release](https://www.modon.com/about-modon/media-centre/details/2024/11/07/modon-unveils-luxury-residences-on-the-east-hill-at-nawayef-on-hudayriyat-island)
identify their own project and location. East's initial release did not include
all planned home types. Its price does not describe later Mansions or all villas.

The [contract announcement](https://www.modon.com/about-modon/media-centre/details/2025/12/19/modon-awards-the-largest-residential-construction-contract-in-abu-dhabi-in-2025-for-nawayef-east-and-nawayef-west-on-hudayriyat-island)
is an award covering East and West together. No share of the contract value or
unit count is assigned to East. An award is not proof of site commencement, so
the actual-construction requirement remains missing. The [masterplan release](https://www.modon.com/about-modon/media-centre/details/2023/06/13/in-line-with-directives-of-mohamed-bin-zayed-modon-properties-reveals-hudayriyat-island-masterplan)
establishes that announcement only; old amenity targets are not promoted to actual
openings. The [official newsroom index](https://www.modon.com/about-modon/media-centre)
corroborates publication dates absent from extracted article body text.

## Evidence and identity boundaries

Seven public pages were fetched with certificate validation, bounded response
sizes, and SHA-256 checksums. Only citations, metadata and reviewed factual
extractions enter the public packet; website bodies are not redistributed.
The 13 fact entries include separate launch and announcement facets of four
events, three asking quotes, one contract award and one masterplan announcement.
They are not 13 independent transactions.

Publication, observation and retrieval dates remain separate. Publication dates
come from Modon's dated releases/index. Because no contemporaneous archived
capture was verified, first-known availability is conservatively 7 October 2026.
These facts cannot enter earlier backtests. The three launch advertisements are
explicitly ineligible to replace today's selected quote and cannot become
registered transactions, valuations or automatic scenario anchors.

No launch evidence is copied to same-name ADREC registrations or other phases.
Muheira's exact project and Reem Island location are verified; its catalogue
association with Maysan still needs independent checking. The existing association
is preserved, and this source is not counted as confirming it.

## Coverage reconciliation

The increment preserves every V11 record, observation, lifecycle fact, selected
quote, history link and source. Public aggregate rows remain 317,878, with 13,396
series; 216 rights-pending rows remain excluded. Sources increase from 2,918 to
2,925 and fact entries from 4,110 to 4,123. Events and exposures remain 105 and
7,382.

Eleven checklist cells move from missing to present: four original-launch,
five announcement/masterplan, and two advertised-price requirements. Park Views
already had advertised-price evidence. The 42,780-cell ledger now contains
3,722 present, 2,180 partial, 27,578 missing and 9,300 unestablished cells: **91.30%
unresolved**. This is checklist accountability, not a percentage of all possible
historical prices. No complete lifetime sale/rent history or validated 2080
forecast is certified. Annual slots remain 2027–2080, with unavailable inputs
and values left explicit.

Runtime validation now also prevents exact-identity advertisements and valuations
from counting as registered history or entering transaction training/event
studies. Advertisements cannot supply automatic price-scenario anchors. They
remain visible, dated evidence with their original classes.

## Next evidence work

Continue exact-registration identities, original sale/rent observations, costs,
verified construction progress and delivery dates by record/native period. Public
developer releases close lifecycle and advertised-price gaps; they do not supply
missing registered sale/rent histories. Preserve all unverified and unavailable
periods while researching lawful public and already-authorized sources.

PR #46 remains an independent review at head
`12a5128d8cfd08a86593299f837299cb5ed3c47d`. Its packet reports 5,651 deduplicated
printed sales against card counts of 62,392, leaving 56,741 unprinted rows. These
are extraction claims, not independently re-parsed originals in this review.
Original PDFs were not available in the local paths checked. Confirm originals,
reuse rights, exact report windows and identities before any promotion. The live
[DXB Interact methodology](https://dxbinteract.com/dubai-house-prices/elash)
describes changes relative to the selected comparison window; do not assume all
printed card changes are year-over-year. The retrieved page also rendered a
different locality, so none of its numbers is accepted as Elash-specific evidence.

Reproduction: merge the retained V11 packet with the reviewed V12 packet using
`scripts/merge-historical-enrichment.py`, then run `npm run history:build` and
`npm run verify`. `tests/historical-v12-modon-pass.test.mjs` compares against the
checksum-verified immutable V11 root. Publication uses the existing immutable
R2/D1 publisher, then a map deployment, followed by exact canonical API readback.

Generated immutable publication objects are stored in R2 and remain identified by
SHA-256 in the Git publication manifest. Git retains the reviewed packets, all
input data, transformations and existing archive vintages. New generated objects
are ignored to avoid duplicating the full compressed history on each snapshot.
A fresh checkout must run `npm run history:build` before tests/publication; CI
already does so. Clean-checkout reproduction must match the reviewed root hash.
