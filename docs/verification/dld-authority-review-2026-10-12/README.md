# DLD authority identity review — 12 October 2026 (Dubai)

The public [DLD Project Status Enquiry](https://dubailand.gov.ae/en/eservices/real-estate-project-status-landing/real-estate-project-status#/) supplies primary register evidence for all eight priority project numbers absent from the retained downloadable project register. Search each number in the public browser form, open Full Fact Sheet, Inspection Details and Developer Details. No login, CAPTCHA bypass, credential extraction or private endpoint was used. Direct HTTP retrieval returned 403; the ordinary public browser service worked. The open-data download listing still offers the same July project-register vintage.

The [normalized authority packet](../../../data/historical-intelligence/dld-authority-pass41-20261012.json) retains 24 timestamped, checksummed DOM-capture references and eight minimal factual register extracts. Original captures remain private under `.local-data/identity-pass41`; developer contact details are excluded from published data. Legal developer numbers and names match the independently downloaded 1 October DLD developer register. These are authority identity and schedule observations, not accepted property transactions or completed lifetime coverage.

| Project number | Authority project | Developer number | Registered | Registry start field | Scheduled completion | Inspection report |
|---|---|---:|---|---|---|---|
| 4482 | Binghatti Wraith | 1051 | 23 Jul 2026 | 1 Jul 2026 | 30 Dec 2027 | 0%, 20 May 2026 |
| 4157 | Helvetia Marine | 1619 | 26 Nov 2025 | 23 Jan 2026 | 15 Mar 2028 | 0%, 27 Jul 2026 |
| 4142 | Divine Elements | 1520 | 6 Nov 2025 | 1 Jan 2026 | 31 Dec 2027 | 0.04%, 8 Jul 2026 |
| 4337 | Oakmont | 1162 | 9 Feb 2026 | 20 Jul 2026 | 30 Apr 2029 | 0%, 22 Jan 2026 |
| 4226 | Inaura Hotels & Residences | 1409 | 21 Nov 2025 | 15 Dec 2026 | 14 Jun 2030 | 1.32%, 1 Oct 2026 |
| 4437 | Eira | 2612 | 23 Jun 2026 | 10 Sep 2026 | 30 Jun 2029 | 0%, 7 Apr 2026 |
| 4359 | Cresswell Plaza | 2475 | 30 Jan 2026 | 29 Apr 2025 | 28 Sep 2026 | **60.09%, 20 Jul 2027 — future-dated, quarantined** |
| 4453 | Soma Residences | 2419 | 19 Jun 2026 | 1 Aug 2026 | 1 Sep 2028 | 0%, 16 Jul 2026 |

The source's “Started” field is retained as a register schedule, not proof of actual construction commencement. Completion remains scheduled, even where already elapsed. A dated inspection is not current progress at retrieval. Inaura's inspection predates its registry start field; preserve that chronology rather than silently changing either date. Helvetia's July authority report remains separate from the previously retained June developer construction narrative. The 881 Wraith units include commercial and residential components; transactions must remain scoped to the residential building and usage. Counts are not unique sales or occupied units.

All eight map links contain the same coordinates despite different named areas. These coordinates are explicitly ineligible as project geometry. Cresswell's legal developer is Essa Bokhowa Properties, while the catalogue uses Merath; a legal/marketing bridge remains required. Oakmont is the authority parent name for the Belmont candidates, so the component relationship remains under review. Avida and Raffles remain separate unresolved legal/component cases.

## New transaction vintage

The lawful public [DLD transaction download](https://data.dubai/en/l/470061) now provides two 10 October 2026 CSV gzip objects. Checksums, retrieval timestamps and dataset URLs are retained; signed URLs and raw transaction identifiers are not published. The [review](transaction-review.json) scans **1,800,588 rows twice**, including revisions whose project number changes outside the candidate set.

| Candidate project | Eligible residential-flat associations | Native registration coverage |
|---|---:|---|
| Wraith | 54 | 12 Aug–9 Oct 2026 |
| Divine Elements | 49 | 2 Mar–9 Sep 2026 |
| Belmont / Oakmont | 42 | 17 Mar–16 Jun 2026 |
| Avida | 40 | 30 Oct 2025–10 Sep 2026 |
| Inaura | 35 | 30 Mar–30 Sep 2026 |
| Eira | 30 | 10 Aug–2 Oct 2026 |
| Cresswell | 24 | 23 Apr–8 Oct 2026 |
| Helvetia Marine | 10 | 8 Jan–2 Sep 2026 |
| Raffles candidate / Emerald Palace Kempinski | 7 | 2 Jul 2024–7 May 2026 |
| Soma | 5 | 17 Aug–8 Oct 2026 |

There are **296 candidate associations**, eight more than the previous vintage. They remain unaccepted pending exact catalogue identity, component ownership, previously accepted transaction comparisons and revision reconciliation. No price, current valuation or model anchor is promoted by this review. Earliest retained registration is not first-ever sale. New source availability starts at capture, not historical registration day.

## Reproduce and next action

Run `python3 scripts/prepare-dld-authority-pass41.py --raw .local-data/identity-pass41 --output data/historical-intelligence/dld-authority-pass41-20261012.json`, then `python3 scripts/review-dld-authority-pass41.py --raw .local-data/identity-pass41 --output docs/verification/dld-authority-review-2026-10-12/transaction-review.json`. Run `python3 tests/dld-authority-pass41.py` and the existing identity-review suite. Four new checks cover strict integer keys, invalid calendar dates, future inspection quarantine, repeated geometry exclusion and native candidate coverage; they do not certify unresolved identity links.

Next: prepare explicit identity decisions using the authority number, developer register, named area, primary marketed-project source and exact residential building. Start with Wraith and Helvetia, whose developer captures are already retained. Compare eligible rows against all accepted observations before appending an immutable evidence release. Keep parent/component ambiguities and future-dated inspection data out of observed coverage. Continue the remaining seven-emirate evidence and 2080 scenario requirements.

**Production remains V44 / V40.** This committed research packet adds no live coverage credit. All 1,860 records remain intact, and 39,476 of 42,780 checklist requirements remain unresolved.
