# Full pending-project identity queue review — 9 October 2026

This reproducible review covers all **246 project records with a pending identity-candidate flag** in the exact V39 snapshot. It scans all **1,798,873 rows** in the retained 7 October DLD transaction export, then scans the full export again to quarantine duplicate IDs whose revisions change names or financial fields. Source checksums, exact native registration dates, stable register keys and exclusions are retained. No raw transactions, native transaction IDs, signed download URLs or party data are published.

The scan changes the research priority: **218 queued projects already have some verified sale evidence**, while **28 have none**. A pending candidate flag is therefore not a count of projects without sale history. Of those 28, ten have financially eligible residential-flat candidates. The remaining 18 have no eligible flat candidates under this exact-name filter; this does not establish the absence of villa/land history, aliases or other evidence. Across the full queue, 207 have eligible flat candidates.

## Ten missing-sale priorities

| Catalogue project | Candidate associations | DLD project number | Project-register check |
| --- | ---: | --- | --- |
| Binghatti Wraith | 49 | 4482 | Absent from this register vintage |
| Divine Elements | 49 | 4142 | Absent from this register vintage |
| Belmont | 42 | 4337 | Absent from this register vintage |
| Avida Residences | 40 | 4066 | Present; role/component review needed |
| Inaura Hotels & Residences | 35 | 4226 | Absent from this register vintage |
| EIRA | 30 | 4437 | Absent from this register vintage |
| Cresswell Plaza | 23 | 4359 | Absent from this register vintage |
| Helvetia Marine | 10 | 4157 | Absent from this register vintage |
| Raffles The Palm Dubai | 7 | 1382 | Present; role/component review needed |
| SOMA Residences | 3 | 4453 | Absent from this register vintage |

These **288 associations are not newly accepted observations** or proof of complete history. Counts are discovery candidates; never sum overlapping catalogue/project populations as unique sales. The full JSON retains all 246 records, including already-covered subjects, multi-building populations, exclusions, exact name owners, and ambiguous links. Belmont illustrates why a name match is insufficient: its building name appears under parent project OAKMONT. All project/phase, developer, geography and transaction ownership checks must pass before promotion.

The retained project register contains 3,039 rows and was loaded in June 2026. Eight of the ten candidate project numbers are absent from that vintage, despite later transaction records. Avida and Raffles have register rows but still need marketing/legal entity and exact component review. A fresh public portal download check at 01:59 UTC on 9 October returned exactly one version, the same 6 July file, with no further page. The receipt records this availability limit; absence from that file must not be described as a nonexistent project.

A newly captured [Binghatti primary project page](https://www.binghatti.com/en/projects/binghatti-wraith) corroborates the marketed Wraith name and Al Jaddaf location. It does not by itself prove the legal developer key or establish the 4482 registration crosswalk. Publication date is unknown; the current capture becomes available at retrieval. Its advertised prices are not transaction observations. Avida's primary marketing pages still do not establish the Serene Marina corporate bridge. Secondary website repetition receives no identity credit.

## Reproduction and limits

Run `python3 tests/dld-pending-queue-review.py`, then `python3 scripts/review-pending-dld-identities.py` with the retained lawful captures. The script requires the exact V39 baseline SHA and validates every source-file hash. Three focused tests cover duplicate revisions outside the original name set, multiple owners/same-name phases, invalid keys, missing building labels, gifts, villas, future dates and invalid prices. Financial eligibility is distinct from identity verification and aggregate-sample sufficiency.

The priority filter is deliberately labelled **Residential / Unit / Flat sales**. Other uses and transaction types remain separate exclusions. No financial values, medians, current valuations, forecast coefficients or observed-coverage credits are generated. Native quarter/year evidence, earlier source vintages and all 1,860 published records remain intact. This review does not alter the production archive; **V43 / V39 remains live** and **39,479 of 42,780 checklist requirements (92.28%) remain unresolved**.

Next: obtain a newer primary project-register vintage or equivalent public authority proof for the eight absent registrations; establish primary legal/component evidence for Avida and Raffles; then compare proposed transactions against every existing verified source and record before enriching the immutable release. Do not import the 218 already-covered projects again without a verified new-period/revision reconciliation. Continue the broader seven-emirate historical, present-value and 2080 scenario work independently of this Dubai queue.
