# V19 DLD-derived registered-sale review — 7 October 2026

## Result

V19 preserves the existing 1,645-project and 215-community catalogue. It adds 13
subject-linked row observations from 11 unique transaction IDs: eight
project-level observations for six exact project identities and five community
observations for Business Bay. Two transactions are linked to both an exact
project and its verified community, so the row-observation count is not the
unique transaction count.

Every accepted row is residential, Unit / Flat, Off-Plan, procedure 102
(Sell - Pre registration), and has zero quality flags. Registration dates are
3–5 October 2026. The source instance_date is retained as its registration
date, not as contract execution, transfer or first-sale date. No median,
aggregate price series, causal uplift or forecast is generated from these
sparse rows.

## Source and capture

The source is a public, DLD-derived secondary distribution published by Dubai
Real Estate Data. It attributes its rows to Dubai Land Department open data and
is distributed under CC BY 4.0. The provider describes one property per
registered sale-procedure row and separates sale procedures from mortgage and
gift registrations. See the provider's [transaction dataset](https://www.dubairealestatedata.com/transactions),
[methodology](https://www.dubairealestatedata.com/methodology), and the
[official Dubai Land Department open-data portal](https://dubailand.gov.ae/en/open-data/real-estate-data/).

- Dataset snapshot date: 5 October 2026.
- Pinned publisher revision: a2c9d1c447e4db0416c2badcda8c1b4011f6e677.
- Extract: 1,372,277 rows and 1,372,277 distinct transaction IDs.
- Extract SHA-256: 73be9631af185f4ba599ea299752deecdb137cbbe36c0afb95abc5e186d8b5e1.
- Source revision published: 5 October 2026 at 09:28:01 UTC.
- Extract retrieved: 7 October 2026 at 18:48:12 UTC.
- Raw dataset is retained only in ignored local research storage and is not
  redistributed in the repository.

This is secondary DLD-derived evidence, not a fresh authenticated download from
the DLD API. It is labeled accordingly in the evidence store. Earlier exact DLD
project, developer, area, transaction and building lookups were required to
match a project row; a row is not linked from name similarity alone.

## Identity and row filters

The V19 pass is bounded to registration dates 3–5 October 2026 and applies all
of the following:

1. procedure_id = 102 and provider procedure name Sell - Pre registration;
2. Residential usage, Unit property type, Flat subtype, Off-Plan registration,
   and quality_flags = 0;
3. Projects: exact case-insensitive source project_name plus the numeric DLD
   area ID against an already verified catalogue identity; and
4. Communities: exact numeric DLD area ID plus the official English area name.

The bounded review added eight project row links and five Business Bay row
links. The overlap is two unique transactions, leaving 11 unique IDs. There
were no project identity-key collisions. Six rows in the inspected
project/community area window had unresolved procedure IDs and were excluded;
they are not counted as sales. The raw source contains other procedure types;
they do not become sale evidence without an accepted sale-procedure ID.

The wider extract audit covered 238 existing exact project identity keys, not
the full project catalogue. Of those, 158 had at least one eligible
Residential Unit / Flat or Villa sale row and 74,708 such rows appeared in the
source. This is an extract-level scope check; it does not verify identity or
historical completeness for every one of those rows or every catalog record.

## Coverage status

The 42,780-cell evidence ledger contains 3,091 present, 3,434 partial, 26,955
missing and 9,300 unestablished requirements. Thus 39,689 (92.78%) are still
unresolved. This is checklist status, not the percentage of missing prices.
Aggregate-history counts remain 318,562 observations and 13,401 series; the
V19 rows are retained as individual transaction observations instead of being
folded into aggregated quarterly values.

Direct transaction observations remain sparse: the V19 file covers six project
records and one community record; their presence does not establish complete
lifetime sale histories. No rent, valuation, completion, occupancy, or
2080-outcome evidence is added in this pass. The annual 2027–2080 scenario slots
remain conditional; unsupported values stay null.

## Next research actions

1. Reconcile the broader extract against every existing exact DLD subject key,
   retaining procedure, quality, registration, unit and native-date filters.
   Inspect remaining candidate names individually; never fan one row into
   ambiguous phases.
2. Obtain additional public primary transaction or registry data where
   available, with full date coverage and methodology. Keep secondary rows
   attributable and separate.
3. Source signed-rent observations, dated valuations, verified completion and
   first-occupancy milestones, service charges and lifecycle dates by exact
   record identity.
4. Track the applicable period and source-access gap for each record. Do not
   fill missing dates with annualized transaction samples, broad community
   proxies or constructed price history.
5. Keep event analysis associational until comparable controls, pre-trends,
   property mix and concurrent shocks can be tested. No infrastructure or news
   event receives a mechanical price uplift.
