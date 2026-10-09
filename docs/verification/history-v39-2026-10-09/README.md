# V39 Asora lifecycle and conflicting source reports

The reviewed pass adds seven dated lifecycle reports and three primary source vintages to the current Asora Bay record. All 1,645 projects, 215 communities, previous observations, lifecycle reports, 633,891 native financial rows, 16,872 series and 13,230 links are preserved. The 30 previously verified individual residential sales remain unchanged. No new financial observations, valuations, rent, occupancy or forecast coefficients are added.

## Sources and chronology

- [Jumeirah announcement, 28 April 2025](https://mediahub.jumeirah.com/jumeirah-drives-portfolio-expansion-with-three-new-developments-in-dubai/?lang=eng): earlier verified announcement evidence, already describing the residences as launched. It does not establish first-ever launch or marketing. Its hotel opening target is 2029 and stays hotel-component context.
- [Meraas launch article, 7 July 2025](https://meraas.com/en/latest-post/news/dubais-meraas-debuts-ultra-luxury-waterfront-address-jumeirah-residences-asora-bay): retained as a later publication, not a first-launch date that would exclude earlier sales.
- [Meraas target article, 30 June 2025](https://meraas.com/en/latest-post/news/jumeirah-residences-asora-bay-meraas-pinnacle-luxury-coastal-living-dubai): early 2029 residential handover. The date remains year precision with the original qualifier; no exact quarter is invented. Existing Q1 2029 catalogue targets remain separate.
- [DLD project register](https://data.dubai/en/l/467654): exact parent project 3445 / ID 691710228, area 317. Declared start 1 May 2025 and scheduled end 31 March 2029 remain planned parent-register dates. The loaded vintage is dated 15 June 2026; this is not an inspection date. English NOT_STARTED and Arabic تحت الانشاء (under construction) conflict; the native zero-completion report is retained as disputed parent evidence, not confirmed residential progress.

Inventory populations also differ: Jumeirah describes 29 residences including six ocean villas; Meraas describes 35 properties; DLD describes a 29-unit residential building beside the hotel, but its generic unit field is 30. No reconciled inventory count or individual-unit mapping is inferred. No new facts are assigned to the archived catalogue candidate.

The three article captures were retrieved on 9 October 2026. Their displayed 2025 publication dates do not prove that the current body was available unchanged in 2025. The new snapshot advances its research cutoff to 9 October; historical source vintages and per-record review dates remain intact. Neither news nor a schedule creates a price or an uplift coefficient.

## Coverage and verification

Some announcement evidence now exists, moving one requirement from missing to present. The 42,780-item checklist has 3,301 present, 3,439 partial, 26,740 missing and 9,300 unestablished items: **39,479 (92.28%) remain unresolved**. This is checklist accounting, not lifetime-price completeness. Original launch, actual construction start, completion, occupancy, current valuation and fully specified annual scenario inputs remain missing for this record. All annual slots still end in 2080; zero long-horizon forecasts are approved.

Reproduction: run scripts/prepare-asora-lifecycle-pass39.py against the pinned private captures and V38 snapshot, then scripts/append-asora-lifecycle-pass39.py. Raw webpages, media and transaction exports are not redistributed. Tests compare all prior records and native series, retain contradictory populations and schedules, and reject future availability and planned-to-actual completion relabelling.

Release checks: 379 JavaScript tests, Python checks and all 2,542 immutable objects pass. An additional guard verifies that every native/runtime partition carries the research release cutoff. A pre-activation mismatch was corrected without changing any financial observation; the unactivated candidate and partial immutable uploads remain separate from production.

Release status: local V39 candidate; production activation and independent verification pending. Production remains V38 / frontend V42 until those checks succeed. The research goal remains incomplete.
