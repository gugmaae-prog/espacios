# DLD authority lifecycle pass 46 — published V46 evidence, 13 October 2026

**Status: published as verified V46 evidence.** This packet is the evidence input for V46; its immutable publication, candidate verification and canonical verification are recorded in the V46 release receipt. Its facts are drawn from two bounded, public DLD Project Status Enquiry browser captures after exact project matching. Raw browser DOM, contact details and media remain private; the repository retains only minimal attributed facts, capture checksums and source metadata.

The pass accepts 39 non-financial authority facts over nine exact project identities: eight registrations, eight filed project starts, five scheduled completion targets, nine dated construction-progress reports and nine retrieval-date status snapshots. It adds no sale, rent, valuation, actual-completion, handover, occupancy or forecast observation.

| Project | DLD facts accepted in this pass | Schedule treatment |
| --- | --- | --- |
| Binghatti Skyrise | registration, filed start, target completion, dated 22.4% inspection, retrieval snapshot | target completion remains planned |
| Sobha One | registration, filed start, dated 86.21% inspection, retrieval snapshot | literal `01/01/1` completion quarantined |
| Sobha Orbis | registration, filed start, target completion, dated 18.2% inspection, retrieval snapshot | target completion remains planned |
| Sobha Solis | registration, filed start, target completion, dated 13.22% inspection, retrieval snapshot | target completion remains planned |
| MAG 5 Boulevard | registration, filed start, target completion, dated 100% inspection, retrieval snapshot | 100% inspection is not actual completion or occupancy |
| Address Residences Zabeel | registration, filed start, dated 14.7% inspection, retrieval snapshot | literal `01/01/1` completion quarantined |
| Binghatti Elite | registration, filed start, target completion, dated 53.25% inspection, retrieval snapshot | target completion remains planned |
| Binghatti Hills | registration, filed start, dated 90% inspection, retrieval snapshot | literal `01/01/1` completion quarantined |
| Binghatti Avenue | dated 100% inspection, retrieval snapshot | no actual completion, handover or occupancy inferred |

## Source and identity rules

Both captures originate from the public [DLD Project Status Enquiry](https://dubailand.gov.ae/en/eservices/real-estate-project-status-landing/real-estate-project-status#/). The nine identities pass exact project-number/project-ID, developer and authority-area reconciliation before lifecycle facts are attached. A matching name alone would not have been enough.

- `dld46-public-project-status-20261013`: 9,497-byte capture, retrieved `2026-10-13T09:49:37Z`, SHA-256 `4cb501e168106bba452e9291180277cee87dc63ca6465277301a84e859483808`.
- `dld46-public-project-status-binghatti-avenue-20261013`: 5,601-byte capture, retrieved `2026-10-13T09:58:46Z`, SHA-256 `f4ea61a30fd30cd4151c9dc29d5e25e72892efc017b52642f7916c3e76fc2fdd`.

The portal’s original publication time is unknown. A 2026 retrieval remains a 2026 first-known input even if the inspected lifecycle date is earlier. Filed start dates are fields reported to DLD, not proof of physical construction commencement. Completion fields are schedules unless independently shown to be actual outcomes. Dated inspection progress is not current progress at retrieval.

## Reproduction and controls

The source preparation path is:

1. `python3 scripts/prepare-dld-authority-pass46.py`
2. `python3 scripts/prepare-dld-lifecycle-pass46.py`
3. `python3 tests/dld-authority-pass46.py`
4. `python3 tests/dld-lifecycle-pass46.py`
5. `node --test --test-concurrency=2 tests/historical-v46-authority-lifecycle.test.mjs`

The local tests passed (3 authority checks, 3 lifecycle checks and 2 integration tests). The packet was then published with V46, verified at an isolated candidate Worker and verified again at the canonical site after production traffic activation. The packet carries three explicit invalid-date quarantines rather than invented repairs. It preserves all native price/rent history and does not use a register field to create a financial observation.

The V46 release remains an interim data-release receipt while an authorized later mobile-interface release is prepared; no later UI deployment can change these source facts without a distinct evidence version.

See [source-captures.json](source-captures.json), [reconciliation.json](reconciliation.json), [tests.json](tests.json), the machine-readable [authority packet](../../../data/historical-intelligence/dld-authority-pass46-20261013.json) and the [V46 local release receipt](../history-v46-2026-10-13/README.md).
