# ADREC Nawayef register and registered-sales review — 7 October 2026

Snapshot candidate `20261007-enrichment-v16` preserves the fixed catalogue of
1,645 projects and 215 communities. It adds seven checksum-recorded public ADREC
API captures, nine bounded facts and 684 registered-sale row occurrences for two
existing Nawayef records. Source bodies remain outside the repository. The
published derivative retains the factual fields needed for review and excludes
public contact, escrow and account details.

| Existing Espacios record | Exact ADREC identities | Verified observations | Explicit limit |
| --- | --- | --- | --- |
| Nawayef Park Views | Directory 594; project `20240000383164`; registered 20 March 2025 | 8.87% progress inspected 7 May 2026; 181 registered-sale rows from 25 June 2025 to 27 July 2026, comprising 177 primary and 4 secondary rows | The progress report establishes a dated construction state, not a construction-start date. The sale endpoint exposes neither a transaction ID nor a unit ID. |
| Nawayef East | Phase A directory 595, project `20240000407514`, registered 4 April 2025; Phase B directory 597, project `20240000407520`, registered 10 April 2025 | Phase A: 23.73% progress inspected 13 April 2026 and 17 primary-sale rows from 26 November 2025 to 5 October 2026. Phase B: 23.53% progress inspected 13 April 2026 and 486 rows from 20 May 2025 to 25 September 2026, comprising 473 primary and 13 secondary rows. | These are two verified phases within the broader Espacios record. Their progress gives partial construction coverage for Nawayef East, not whole-record completion. |

The authority sources are the ADREC public project directory and its public
project-detail and recent-sales APIs. The project pages remain directly
reviewable at [directory 594](https://adrec.gov.ae/Directory/ProjectsDetails?projectId=594),
[directory 595](https://adrec.gov.ae/Directory/ProjectsDetails?projectId=595) and
[directory 597](https://adrec.gov.ae/Directory/ProjectsDetails?projectId=597).
Every captured response was certificate validated, capped at two megabytes and
SHA-256 recorded. The listing contained 320 records when captured.

The 684 sale rows are preserved as source row occurrences. Twenty-seven rows
share all attributes exposed by the endpoint with at least one other row. They
are not deleted as duplicates because the endpoint supplies no unique
transaction or unit identifier, and ADREC's current sold counts agree exactly
with the 177 Park Views and 473 East B primary rows. Each derivative row retains
its source index, attribute fingerprint and occurrence ordinal. This supports
reproducibility without making a unique-transaction claim. East A returns 17
primary rows while the point-in-time directory snapshot reports 16 sold; both
authority observations are retained rather than forced to agree.

The release moves Park Views registered-sale history and construction from
missing to present. It moves Nawayef East registered-sale history from missing
to present and construction from missing to partial. The fixed 42,780-cell
ledger therefore contains 2,483 present, 3,434 partial, 27,563 missing and 9,300
unestablished cells. Thus 40,297 cells, or **94.20%**, remain unresolved.

The sales endpoints were queried from 1 January 2019 through 7 October 2026, but
that request and a current API response do not prove complete lifetime history.
The separate `complete_registered_sale_history` requirement remains
unestablished. Signed rent, completion, occupancy and dated valuation remain
missing. The first verified source availability is 7 October 2026, so the rows
cannot enter an earlier point-in-time backtest. No validated forecast value is
added; all 54 annual 2027–2080 scenario slots remain present with unsupported
values null.

Validate with `tests/historical-v16-adrec-nawayef-pass.test.mjs`, the complete
historical suite, deterministic local R2/D1 publication and the production
Wrangler dry run. Publication requires merged GitHub source and the authorized
immutable release process.
