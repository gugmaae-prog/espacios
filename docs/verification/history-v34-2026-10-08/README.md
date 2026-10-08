# V34 primary developer monthly progress — 9 October 2026 (Dubai)

This pass adds 102 month-labelled construction reports and 13 reported completion/schedule statements across 13 existing RAK Properties projects. It uses 13 new captured profile vintages (12 new URLs and a versioned EDGE recapture). The entire 1,645-project, 215-community inventory remains. No sale, rent, valuation, occupancy, community-financial or forecast observations are added.

## Source and identity

| Primary developer profile | Monthly reports | Completion/schedule statement |
| --- | ---: | --- |
| [Marbella II](https://www.rakproperties.ae/our-properties/marbella-ii-villas/) | 5 | Reported Q4 2024 completion, not certified |
| [Bayviews](https://www.rakproperties.ae/our-properties/bayviews/) | 21 | Q3 2026 target |
| [Cape Hayat](https://www.rakproperties.ae/our-properties/cape-hayat/) | 21 | Q3 2026 target |
| [Quattro Del Mar](https://www.rakproperties.ae/our-properties/quattro-del-mar/) | 16 | Q2 2027 target |
| [Porto Playa](https://www.rakproperties.ae/our-properties/porto-playa/) | 0 | Q4 2026 target |
| [EDGE](https://www.rakproperties.ae/our-properties/edge/) | 7 | Q2 2027 target |
| [SKAI](https://www.rakproperties.ae/our-properties/skai/) | 6 | Q2 2028 target |
| [Mirasol](https://www.rakproperties.ae/our-properties/mirasol/) | 6 | Q1 2028 target |
| [Mirasol II](https://www.rakproperties.ae/our-properties/mirasol-ii/) | 1 | Q3 2028 target |
| [ENTA Mina](https://www.rakproperties.ae/our-properties/enta-mina/) | 5 | Q1 2028 target |
| [Anantara residences](https://www.rakproperties.ae/our-properties/anantara-residences/) | 10 separately scoped apartment/villa reports | Q2 2028 target |
| [Nura](https://www.rakproperties.ae/our-properties/nura/) | 0 | Q1 2029 target |
| [SOLERA](https://www.rakproperties.ae/our-properties/solera/) | 4 | Q2 2028 target |

Observed progress labels span March 2024–August 2026, with gaps retained. Profile publication dates are unknown. First model availability is the October 2026 capture, not each tab's historical month. The extractor joins tabs to panels by explicit DOM IDs; flattening the whole page would lose those associations. Components are stored separately in the reviewed packet and described in lifecycle notes. A component at 100% is not whole-project completion.

The 339-home original Mirasol and 280-home Mirasol II profiles resolve these page-specific histories. Generic corporate Mirasol reports remain unassigned. Anantara's ten reports retain apartment/residence versus villa scope; none establishes a whole-record percentage or describes the separate hotel.

## Conflicts and excluded assignments

- Marbella II's page reports completed status and Q4 2024; its October tab reports 100%. These are developer reports, not completion certificates or proof of occupancy. Its completion requirement becomes partial, not present.
- Bayviews reports 100% in August 2026 while its profile still says under development. Its Q3 target remains planned. No automatic actual completion is inferred.
- Solera reports 0.1% in May/June and 0% in July/August. The original values remain, without monotonic smoothing.
- Quattro's December 2025 tab reports 28.6%; the previously retained FY2025 release reports 25% without an inspection date. Both vintages remain; the difference is unexplained.
- ENTA's profile says 120 units and Hayat Island, differing from earlier 119-unit/Raha wording. No canonical inventory or geography is overwritten.
- Mirasol's earlier H1 2028 and current Q1 2028 schedules remain separate; the revision's effective day is unknown.
- The generic Gateway catalogue record lacks a phase/island/unit-count discriminator. Primary pages distinguish Gateway I (144 units, Raha) from Gateway II (146, Hayat); neither history is assigned to the generic record in this pass.
- Bay Residences' page combines phases and mixes phase-labelled and unlabelled progress. No Phase I or generic progress is assigned to South Bay. An explicit captured South Bay-to-Phase-II identifier remains necessary.
- A Q1 2023 news page displays 27 March 2023 despite describing full-quarter results and a subsequently announced contract. It is retained only in private research scratch pending date review; no corrected date is invented.

## Preservation and coverage

V34 preserves all 633,891 financial-history rows, 16,872 series, 13,230 record-series links, 105 events and 7,382 exposures. Sources total 3,333, including the explicitly linked EDGE revision. Repeated page vintages are not independent corroboration. Existing financial observations, current snapshots, scenarios and unrelated records remain byte-equivalent in the semantic preservation tests.

The 42,780-item checklist contains 3,292 present, 3,437 partial, 26,751 missing and 9,300 unestablished. **39,488 (92.30%) remain unresolved**, three fewer than V33; one completion item gains only partial evidence. This is checklist accounting, not a percentage of missing financial observations. Complete lifetime sale/rent histories and approved annual forecasts through 2080 remain unestablished.

## Reproduction and validation

- `scripts/capture-rak-profiles-pass34.mjs` fetches a fixed list of 16 public project profiles into ignored private scratch. Three profiles support exclusions, not accepted additions.
- `scripts/capture-rak-phase-pass34.mjs` performs the bounded six-release phase/date investigation. Those news captures do not count as accepted V34 sources or facts.
- `scripts/extract-rak-construction-panels.py` joins explicit month labels to unique panel IDs and validates percentage bounds. It rejects missing/duplicate panel mappings, missing overall values and malformed percentages instead of inventing observations.
- `scripts/prepare-rak-profiles-pass34.py` performs the explicit 13-record identity map, preserves conflicts and creates the [reviewed packet](../../../data/historical-intelligence/rak-properties-profiles-pass34-20261008.json).
- `scripts/append-rak-profiles-pass34.py` requires the preserved V33 snapshot and appends V34 without replacing prior evidence. Earlier transition tests remain frozen to their original roots.
- Fourteen focused extraction and V32–V34 preservation tests passed. Full-suite and live publication results will be recorded below.

## Publication

Local candidate only until independent publication and live checks are recorded. Current production remains V33/V37.

## Next evidence actions

Resolve the Gateway and South Bay phase identifiers through original brochures or official registers. Correct the documented Nura catalogue developer field through an explicit audited revision. Continue exact-subject registered sales, signed rents, current valuation inputs and occupancy evidence. Establish disclosed annual scenario assumptions through 2080; construction progress alone cannot fill financial gaps.
