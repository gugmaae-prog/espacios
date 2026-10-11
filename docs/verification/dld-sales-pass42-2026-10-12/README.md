# Reviewed individual sale packet — pass 42

Status: source packet prepared and tested against the immutable V41 baseline; not yet integrated into the live snapshot. Production remains V45 / V41. This packet adds no live coverage credit until the full archive and release verification completes.

## Accepted records

| Exact catalogue project | DLD project | New individual residential sales | Retained registration dates |
|---|---:|---:|---|
| Divine Elements | 4142 | 49 | 2 March–9 September 2026 |
| Inaura Hotels & Residences | 4226 | 35 | 30 March–30 September 2026 |
| EIRA | 4437 | 30 | 10 August–2 October 2026 |
| SOMA Residences | 4453 | 5 | 17 August–8 October 2026 |

The seven-source packet combines six minimal primary developer captures with a normalized transaction-source revision. The existing DLD authority capture and developer/area registers remain referenced rather than duplicated. The 10 October DLD export contains 1,800,588 rows, scanned twice to find changed duplicate transaction IDs even outside the selected project numbers. Six non-residential-flat rows and one non-sale are excluded. All 119 accepted transaction keys are distinct and absent from prior individual observations; existing exact subject-series descriptors are checked for overlapping ownership.

Each sale keeps its registration day, AED price, square metres, derived AED/sqft, bedroom label and registration type. Native transaction IDs are hashed. Raw source rows, party information, signed download URLs and full developer-page captures are not redistributed. Individual sales do not establish a comparable monthly median, complete population, current valuation, rent or forecast. The earliest retained sale is not claimed as the first-ever sale.

## Primary identity evidence

- [Takmeel's Divine Elements page](https://www.takmeeldevelopment.com/divine-elements-page) names the project, developer and Dubai South residential offering.
- [Arada's Inaura project page](https://www.arada.com/en/inaura-downtown/) and [14 January 2026 announcement](https://www.arada.com/en/latest-news/arada-introduces-inaura-a-dynamic-fitness-led-hospitality-and-branded-residences-concept-with-a-debut-location-in-downtown-dubai/) identify the development and its hotel/residential composition. The 114 residences align with the residential component of the DLD authority record; its five commercial units are excluded from sale selection. The announcement planned sales by the end of January; it does not establish the actual first sale.
- [Neoterra's developer site](https://www.neoterra.ae/) explicitly links [EIRA's project site](https://eiradubai.com/). Both identify EIRA in Dubai Production City and the studio/one-bedroom offering. The registry's Neoterra DPC legal entity remains named separately from the marketing brand. Eira is matched as a complete name token, so it cannot accidentally match the substring in Jumeirah.
- [Origami's SOMA page](https://www.origamidevelopment.ae/soma-residences) identifies the Dubai Islands project and 44 residences, matching the authority inventory. Devmark is the sales/marketing partner, not substituted as the legal developer.

The primary packet also retains EIRA's month-precision marketing timeline (May 2026 launch, September 2026 groundbreaking, June 2028 topping-out, April 2029 handover). These are not added as verified actual construction milestones. The registry's June 2029 completion schedule remains separate. Inaura's future register start versus earlier inspection remains a source chronology conflict. No map geometry is inferred from the authority's repeated coordinates.

## Preservation and validation

The pinned V41 archive root is `eea871f5edf732a1ec1c041d1e85ae4dd24d876b1cb4455fdef8908723ab1e79`. Preparation reads this immutable index and restores series descriptors by ID; it does not depend on whichever snapshot later becomes current. Existing advertised quotes, context series, headline values, lifecycle schedules, scenario inputs and unresolved legacy identity flags are preserved.

Five regression checks cover exact counts/IDs and financial arithmetic, source vintage/availability and private-field exclusion, append-only in-memory application, component/source proof and incomplete-history boundaries, and the Eira/Jumeirah name collision. Run `python3 tests/dld-sales-pass42.py`; the test does not need private raw files. Reproduction of extraction needs the previously retained lawful DLD CSV captures and new private primary captures: run `python3 scripts/prepare-primary-identity-pass42.py`, then `python3 scripts/prepare-dld-sales-pass42.py`.

Next: integrate the reviewed packet into immutable V42, verify all original records/native histories and coverage changes, build/test the candidate, and publish under the existing authorization. Remaining priority cases are Belmont/Oakmont, Avida/Serene Marina, Cresswell/Merath and Raffles/Emerald Palace; their 113 candidate associations remain unresolved. Continue the wider historical, present-data and annual conditional scenario requirements through 2080.
