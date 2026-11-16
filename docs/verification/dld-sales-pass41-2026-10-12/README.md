# Reviewed Wraith and Helvetia individual sales — 12 October 2026

Status: prepared evidence packet; production remains V44 / V40. Do not report this packet as deployed or count it in live coverage until immutable publication and canonical verification succeed.

The [packet](../../../data/historical-intelligence/dld-sales-pass41-20261012.json) contains **64 individually verified residential-flat sale registrations**: 54 for Binghatti Wraith (12 August–9 October 2026) and ten for Helvetia Marine (8 January–2 September 2026). They are source registration dates, not first-ever sales, unit-occupancy dates or present valuations. Earlier Wraith asking quotes and headline values stay separate.

## Identity and ownership

The public DLD Project Status service identifies Wraith as project 4482 in Al Jadaf, developer number 1051 (Binghatti Developers FZE), and Helvetia Marine as project 4157 in Palm Deira, developer number 1619 (D H G Property Development L.L.C). The independently downloaded developer register confirms stable developer IDs 15782130 and 505325856. The retained Binghatti and DHG primary captures corroborate each marketed name and location. All 24 authority capture hashes in the prior review are revalidated before preparation.

Each transaction must match the exact authority project number, area ID, project name and residential building name. Only Residential / Unit / Flat sales are accepted. Wraith's commercial component and land remain excluded. All 1,800,588 rows are scanned twice, including revisions whose project number moves outside the target set. Seven non-sale records and five non-flat records are excluded. Stable derived transaction identifiers are compared against all existing individual observations; verified subject-series names and source project-number fields are checked for prior ownership. Hash substrings and financial values are not project identifiers.

The two exact catalogue records are unique, current and non-archived. No transaction is assigned to another Helvetia development, a nearby community or a similarly named building. Legacy candidate flags remain pending because this decision resolves only the exact new source registrations; it does not pretend to resolve unrelated earlier candidate associations.

## Financial and temporal boundaries

The normalized extract retains individual total AED price, square-metre area, derived AED/sqft, registration type, bedroom label and procedure. It publishes neither raw transaction identifiers nor party/contact data. The source includes the lawful open-data attribution and checksums for the new compressed 10 October export. Earlier source vintages remain intact.

First-known availability is conservatively the latest retained transaction/authority capture, 11 October 2026 at 22:14:49.465 UTC (12 October Dubai). The source has no independently established publication timestamp and is excluded from earlier backtests. Sparse observations survive; no median, current headline replacement, valuation, rent, yield or appreciation coefficient is inferred.

The source authority packet's future-dated Cresswell inspection and repeated map coordinates are quarantined and do not enter these financial facts. Existing schedules and all 1,860 records remain unchanged.

## Verification and release gate

`python3 scripts/prepare-dld-sales-pass41.py` revalidates the pinned V40 baseline, source hashes, exact identities, full-vintage duplicate revisions and existing ownership. `python3 tests/dld-sales-pass41.py` checks individual price/area consistency, source-vintage dates, no raw identifiers, and an in-memory append preserving earlier observations, current snapshots, lifecycle reports, native series and scenario inputs. Complete sale history and direct rent gaps remain explicit.

Next: append this packet to an immutable V41 archive, regenerate matching runtime and D1 indexes, run the full release suite, publish and verify canonical APIs and browser cards. Until then, live checklist totals remain unchanged and the wider history/present/2080 goal is incomplete.
