# Raffles component identity review

Status: unresolved component mapping; zero accepted observations and zero coverage credit.

A bounded scan of the retained October 10 transaction export found 121 rows bearing the Raffles building name, all under registered project 1382, Emerald Palace Kempinski Hotel, Palm Jumeirah. There are 94 hotel-room sales, 19 hotel-room gifts, seven residential-flat sales and one residential-flat mortgage. Hotel-room activity cannot be used as residential apartment or villa price history.

The catalogue has two distinct records: Raffles Residences & Penthouses and a villa-only Raffles record. The seven flat registrations must not be assigned to the villa-only record. The residences record is a possible owner, but its exact component continuity still needs evidence.

New [DLD public authority captures](https://dubailand.gov.ae/en/eservices/real-estate-project-status-landing/real-estate-project-status#/) identify project 1382 and Sunrise Properties Limited, developer 969. The developer register independently matches legal name, number and ID 10472556. The public authority contact uses the same business domain shown in the official project factsheet. This supports an operational group connection, not corporate equivalence.

The authority lists 383 units: 373 commercial and ten residential (eight two-bedroom, two three-bedroom). Its dated inspection reports 100% on 15 May 2019; that does not establish unit occupancy, first-ever sale or the later residential conversion history. Registration and source start fields are retained separately.

The [official factsheet, page 2](https://www.rafflespalmresidences.com/hubfs/RAFFLES%20RESIDENCES%20FACT_SHEET%20_%20ENG.pdf?hsLang=en), visually reviewed from a locally rendered PDF, distinguishes 27 apartments, three penthouses and three villas. The [official owner page](https://www.rafflespalmresidences.com/about) corroborates these categories and names Emerald Palace Group. This inventory differs from the authority's residential count; neither source establishes how particular registered units map to the marketed component. The factsheet's publication date is unknown. Marketing descriptions and area ranges do not override registered transaction scope or area measurements.

Next evidence needed: a unit/component crosswalk, floor/registration plan, or dated inventory/conversion history that reconciles the ten registered residences with the marketed residential offering. Until then, the seven rows remain candidates. No price, present valuation, rental income or forecast is inferred.

`review.json` contains minimal normalized facts, source URLs, retrieval times and checksums. Raw public captures, full contacts and transaction identifiers remain private. Reproduce the review with `python3 scripts/review-raffles-components-pass45.py` using the retained lawful inputs. This review changes the next sourcing action; it does not increase data completeness.
