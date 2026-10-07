# V19 DLD-derived transaction history review — 7 October 2026

## Result

V19 preserves all 1,645 projects and 215 communities. Pass 42 adds 13
subject-linked transaction observations from 11 unique transaction IDs: eight
project rows for six exact identities and five Business Bay area rows. Pass 43
widened the same source to **209,291 new record-linked transaction rows** and
**6,803 monthly cohort summaries**. Across project and community geography,
the matched extract contains **198,208 unique transaction IDs**. Of these,
198,197 were new to the snapshot; 11 were already retained in pass 42. The
project and community views share 11,096 transaction IDs, so a cross-level row
link is not counted as a second transaction.

The project series covers 74,586 exact-key Flat rows across 158 projects; eight
project rows already retained from pass 42 are not duplicated. Six communities
with existing exact DLD area mappings contribute 134,718 area-level rows; five
previously retained Business Bay rows are not duplicated. The other 207
communities do not yet have an exact area-ID mapping in this pass. Two of the
eight mapped areas have no eligible rows in the extract.

Every source row retains its transaction ID, registration date, AED price,
reported AED/sqft, area, property segment, registration, procedure, quality
flag, and any source master-project or building label. Project cohorts are
separated by year to keep Worker retrieval bounded. Monthly medians are
calculated only within the same record, registration, procedure, and property
type cohort. A monthly median is withheld below 20 transactions; its native
rows and sample count remain. Of 6,803 summaries, 1,802 meet the sample gate
and 5,001 are withheld as sparse.

The resulting evidence shows registered sales; it does not establish a
continuous price series from a project's inception. Off-plan sales may occur
before construction, but a transaction row does not establish the first
announcement, first marketing, first-ever sale, project start, or unobserved
prices. No rent history, valuation, occupancy date, causal event uplift, or
forecast is inferred here.

## Source and capture

The source is a public DLD-derived secondary distribution published by Dubai
Real Estate Data. The provider attributes its rows to Dubai Land Department
open data and distributes the dataset under CC BY 4.0. The provider describes
one property per registered sale-procedure row and separates sale procedures
from mortgage and gift registrations. See the provider's [transaction
dataset](https://www.dubairealestatedata.com/transactions),
[methodology](https://www.dubairealestatedata.com/methodology), and the
[official Dubai Land Department open-data
portal](https://dubailand.gov.ae/en/open-data/real-estate-data/).

- Dataset snapshot date: 5 October 2026.
- Pinned publisher revision: `a2c9d1c447e4db0416c2badcda8c1b4011f6e677`.
- Extract: 1,372,277 rows and 1,372,277 distinct transaction IDs.
- Extract SHA-256: `73be9631af185f4ba599ea299752deecdb137cbbe36c0afb95abc5e186d8b5e1`.
- Source revision published: 5 October 2026 at 09:28:01 UTC.
- Extract retrieved: 7 October 2026 at 18:48:12 UTC.
- The raw Parquet remains in ignored local research storage. A 9.2 MB compressed
  filtered CSV is retained as an attributable CC BY history input; unrelated
  rows and the raw Parquet are not redistributed.

This is secondary DLD-derived evidence, not a fresh authenticated download
from the DLD API. The dataset is a latest-vintage capture first available on
5 October 2026. Historical rows therefore do not establish information
availability at their observed dates and are not valid as inputs to earlier
as-of backtests.

## Identity and row filters

### Pass 42: recent row review

The bounded review applies all of the following:

1. Registration dates 3–5 October 2026.
2. Procedure 102, `Sell - Pre registration`.
3. Residential usage, Unit property type, Flat subtype, Off-Plan registration,
   and `quality_flags = 0`.
4. Projects matched by exact case-insensitive source project name and numeric
   DLD area ID against a previously verified catalogue identity.
5. Communities matched by exact numeric DLD area ID and official English area
   name.

The review retained eight project row links and five Business Bay community
links. Two transaction IDs intentionally occur at both levels. Six nearby rows
with unresolved procedure IDs were excluded from this bounded pass.

### Pass 43: historical source cohorts

Project rows require quality flags zero, procedure 11, 41 or 102, Residential
usage, Unit property type, Flat subtype, and an exact case-insensitive
`project_name` plus official area-ID match. Those keys were already anchored to
official DLD project, developer, area, transaction and building evidence, with
no key fan-out across catalogue records. The source itself has no native DLD
project registration ID, so historic applicability to a marketed phase still
needs review. The extract contains 74,586 Flat rows for 158 of 238 exact keys,
with unique transaction IDs. A looser property-type query returned 74,708 rows,
but includes 122 rows with non-Flat or unspecified Unit subtypes; those rows are
excluded. No Villa row appeared in this exact project cohort.

Community rows use only the eight area IDs already mapped to catalogue
communities from official DLD evidence. A row must match that exact area ID and
the native `area_name_en`; it must also be Residential, have quality flags
zero, use an accepted sale procedure, and be Unit/Flat or Villa. The source's
native area spelling is retained. For example, the DLD label `Palm Jabal Ali`
remains attached to area ID 411 mapped to catalogue community `Palm Jebel
Ali`. This is community-area evidence only; it does not assign a transaction
to a particular project or building.

The DLD `instance_date` is stored as a registration date, not a claimed
contract-execution, transfer, or first-sale date. Monthly summaries use the
median of source-reported AED/sqft values; there is no unit-mix, inflation,
quality, or geographic adjustment. The minimum median sample is 20; sparse
medians remain null, with eligible transaction rows and counts retained.

Project observations span 9 June 2009–5 October 2026. Mapped community-area
observations span 15 December 1997–5 October 2026. These are the observation
boundaries found in this extract, not verified project start dates or proof of
complete lifetime coverage.

## Coverage status

The 42,780-cell evidence ledger now has **3,096 present, 3,434 partial,
26,950 missing and 9,300 unestablished requirements**, leaving **39,684
(92.76%) unresolved**. This is a requirements checklist, not the percentage of
missing prices.

The rebuilt snapshot contains **534,656 stored history rows and 14,563
series**: 318,562 previously retained observations, 209,291 new transaction
rows, and 6,803 monthly summaries. The 13 earlier V19 transaction facts remain
preserved. Pass 43 adds no new property or community records.

No signed rents, dated valuations, verified completion or occupancy, service
charges, or future outcomes are added by this source. Annual 2027–2080 scenario
slots remain conditional and unsupported values stay null. No infrastructure
or news event receives a mechanical price uplift.

## Next research actions

1. Expand exact project-name/official-area identity review beyond these 238
   keys, and resolve the remaining candidate names one phase at a time.
2. Resolve official DLD area IDs for the other 207 communities; the eight
   mapped communities include two with no eligible rows in this extract.
3. Seek more public primary transaction or registry observations with
   source-native dates and disclosed methodology. Keep this secondary provider
   and its publication vintage explicit.
4. Source signed-rent observations, dated valuations, verified completion and
   first-occupancy milestones, service charges and lifecycle dates by exact
   record identity.
5. Track applicable periods, source availability, and inaccessible gaps. Do
   not fill absent dates with annualized samples, broad area proxies, or
   constructed price history.
6. Keep event analysis associational until comparable controls, pre-trends,
   property mix and concurrent shocks can be tested.
