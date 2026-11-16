# DLD authority lifecycle pass 47 — local V47 candidate, 13 October 2026

**Status: prepared and locally verified; not yet published to production R2/D1 or served by the canonical site.** This bounded DLD public-browser pass accepts 15 dated, non-financial lifecycle facts across five exact project identities. It adds five registrations, five dated inspection-progress reports and five retrieval-date authority-status snapshots. It adds no registered sale, rent, asking-price, valuation, actual completion, handover, occupancy or conditional forecast observation.

| Project | DLD project number | Accepted facts | Schedule treatment |
| --- | ---: | --- | --- |
| Sobha Hartland One Park Avenue | 2166 | registration; dated 100% inspection; retrieval status snapshot | previously retained filed start and scheduled date reconciled, not duplicated |
| Montiva | 3744 | registration; dated 5.85% inspection; retrieval status snapshot | previously retained filed start and planned date reconciled, not duplicated |
| Albero | 3609 | registration; dated 11% inspection; retrieval status snapshot | previously retained filed start and planned date reconciled, not duplicated |
| Parkside Views | 2728 | registration; dated 100% inspection; retrieval status snapshot | `01/01/1` displayed completion quarantined |
| ARLO | 3104 | registration; dated 35.42% inspection; retrieval status snapshot | `01/01/1` displayed completion quarantined |

## Source and identity controls

The source is the public [DLD Project Status Enquiry](https://dubailand.gov.ae/en/eservices/real-estate-project-status-landing/real-estate-project-status#/). Each record passed reconciliation using its DLD project number and project ID, registered developer number, authority area ID, official English project/phase identity and the Espacios record identity. A name-only match was never admitted.

The capture used the visible browser page after an exact project-number search, then the Full Fact Sheet and Inspection Details tabs. It used no login, API bypass, download or raw-media redistribution. Raw browser DOM remains outside the repository; this repository retains minimal attributed facts and checksums.

- Source capture: `dld-status-five-project-visible-capture-20261013`
- Retrieved and first known available: `2026-10-13T15:32:17Z`
- Capture: 6,099 bytes, SHA-256 `47653de5aba54b9d391b24ab104449996005a8964b3eeabc64236ba5cd097f7d`
- Normalized payload SHA-256: `e1474113fdc56c1e7f5484a144b73accc9c731134ce902cc64d435a6fc3b47e0`
- Normalized authority packet SHA-256: `5a88c276772db154e85aeae06a1773d4fb58660cac61878d8582b08529f1bb8a`

The portal’s displayed page-update text is not a source publication date. A 2026 retrieval is therefore retained as a 2026 first-known input even where the reported lifecycle date is earlier.

## Evidence boundaries

A `Finished` status or 100% inspection is an authority status/progress snapshot, not proof of actual completion, handover, occupancy, rent commencement, price, valuation or forecast. Filed starts are register fields, not proven physical construction starts. Valid target dates remain planned schedules. Parkside Views and ARLO retain the literal `01/01/1` completion field in the quarantine record rather than receiving an invented date.

All five matching prior filed-start/scheduled fields were reconciled against retained DLD register lifecycle evidence and were not duplicated. This candidate creates zero financial observations and zero conditional annual values.

## Local reproduction

1. `python3 scripts/prepare-dld-authority-pass47.py`
2. `python3 scripts/prepare-dld-lifecycle-pass47.py`
3. `python3 tests/dld-authority-pass47.py`
4. `python3 tests/dld-lifecycle-pass47.py`
5. `node --test --test-concurrency=2 tests/historical-v47-authority-lifecycle.test.mjs`

Publication, candidate API, canonical API, traffic, Data Room, and browser verification will receive separate evidence only after they occur. See [source-captures.json](source-captures.json), [reconciliation.json](reconciliation.json), [tests.json](tests.json), the machine-readable [authority packet](../../../data/historical-intelligence/dld-authority-pass47-20261013.json), [lifecycle packet](../../../data/historical-intelligence/dld-lifecycle-pass47-20261013.json), and the [V47 candidate receipt](../history-v47-2026-10-13/README.md).
