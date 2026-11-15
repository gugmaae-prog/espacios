# Dubai project-status source refresh — 14 November 2026

The published `/map/api/uae-evidence/dubai/project-status` snapshot is a licensed **secondary** copy of Dubai Land Department project-status records from [Continental Club Property](https://continentalclub.ae/en/project-status/). The publisher states CC BY 4.0 and provides the [CSV](https://continentalclub.ae/data/project-status.csv) and an attribution line. This is not a direct extract from the [DLD open-data form](https://dubailand.gov.ae/en/open-data/real-estate-data/), which presents a CAPTCHA for project searches, or a complete UAE project census.

Two independent downloads of the 14 November CSV matched byte for byte and SHA-256 (`e27ecc33ef7bb065b499a5395188c448dff4c2943d593a0157cdbca7ffbcee03`). The versioned gzip input and normalized gzip output are pinned by `dld-project-status-validation.json`; the previous 1 November source, validation, and reviewed crosswalk are retained. `dld-project-status-20261114-reconciliation.json` records the exact old/new population and field changes.

| Measure | 1 November | 14 November |
| --- | ---: | ---: |
| Distinct project numbers / CSV rows | 3,871 | 3,882 |
| New source project numbers | — | 11 |
| Removed source project numbers | — | 0 |
| Existing rows with any changed field | — | 684 |
| Retained reviewed V48 identity links | 83 | 83 |

Of the existing rows, 535 have a different `land_number` display. This field often shows a truncated list with a `+N` suffix and its displayed order changes between captures; it is **not used as an identity key**. The 83 reviewed links retain the same project number, name, developer number/name and source district. Inspection dates and percentages may change with a new inspection. They remain dated source claims, and declared handover dates do not establish delivery or change V48 map status. The source has no verified project coordinates, unit-level sales, rents or available spaces.

The publisher page's prose says **3,883 rows and 16 fields**. Its metadata says **3,882 projects**, and the downloaded CSV has **3,882 rows and 14 fields**. The API reports the actual CSV population and exposes the page claims separately. This mismatch remains unresolved.

At the v71 release, the new source was served from a checksum-verified Worker snapshot and had **not** been copied to IDrive E2. The [subsequent v72 replica](uae-current-idrive-replica-v72-20261114.md) copied and independently read back its source and normalized snapshot without changing the runtime primary. The accepted V48 archive remains IDrive-primary, and the separate Dubai Municipality snapshots retain their verified IDrive replicas. R2 remains disabled.
