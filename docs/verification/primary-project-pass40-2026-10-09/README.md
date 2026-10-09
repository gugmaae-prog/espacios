# Primary project evidence — reviewed V40 packet

**Stage: prepared and tested; not activated in production.** V43 / V39 remains the live release. The packet adds seven facts from three pinned primary source captures across two exact marketed projects. All 1,645 projects and 215 communities, native series, prior observations, source vintages, current headline snapshots and scenario inputs remain unchanged in the preview except for the explicitly appended evidence and its relevant checklist items.

## Evidence prepared

- [Binghatti Wraith](https://www.binghatti.com/en/projects/binghatti-wraith): on 9 October 2026 the developer page advertised studio, one-bedroom and two-bedroom starting prices of AED 807,999, AED 1,299,999 and AED 2,099,999. Each remains a separate bedroom-specific asking quote. The separately displayed starting areas are not assumed to belong to the exact cheapest unit, so no AED/sqft is derived. No quote replaces the project-wide headline or becomes a valuation/registered sale. Original publication date is unknown.
- [DHG Premiere Week report](https://dhg.ch/posts/dhg-properties-hosts--exclusive-broker-event-for-new-dubai-islands-project): the Helvetia Marine broker event ran 8–13 December 2025. The article identifies this as preceding the broader launch, so neither an original launch date nor a first-ever sale is established. The publication date retains month precision.
- [DHG construction report](https://dhg.ch/posts/dhg-properties-breaks-ground-on-helvetia-marine-on-dubai-islands): the June 2026 article reports construction commenced, anticipates Q1 2028 handover, and describes the project as sold out before groundbreaking. The article month is not an inspection or exact construction-start day. The developer's sold-out report is not a verified count of DLD sales or evidence of current resale availability. Earlier target dates remain preserved.

Primary project names and locations establish the marketed subjects. They do not resolve DLD registration/legal-entity identities. Wraith's 49 and Marine's ten sale candidates remain unaccepted. No facts are transferred to Helvetia Verde or Helvetia Residences. Raw HTML and media are retained privately; only source metadata, hashes and minimal attributed facts are in Git.

## Preservation and chronology checks

Run `python3 scripts/prepare-primary-project-pass40.py` against the checksum-pinned captures, then `python3 tests/primary-project-pass40.py` against the V39 baseline. The five tests verify all-record preservation, separate advertisement semantics, precise event interval/report month, future-availability rejection and invalid-amount rejection. Existing events, source prefixes, financial rows, scenarios and current headline snapshots remain identical. New article bodies first become available at their 9 October retrieval times; their displayed earlier publication months cannot make them available to earlier backtests.

The preview changes Wraith advertised-price coverage from partial to present, and Marine announcement and construction-report coverage from missing to present. It retains a separate original-launch gap and unverified actual construction-start day. A new handover target is added to an already-present requirement. Candidate totals would be 3,304 present, 3,438 partial, 26,738 missing and 9,300 unestablished. **These are staged totals only. Live coverage remains 3,301 present and 39,479 unresolved of 42,780 requirements.** Neither state is complete historical price coverage.

## Remaining release work

Append the reviewed packet to an immutable V40 archive; retain every prior financial partition; build matching runtime/D1 manifests and frontend release; run archive, API and CI checks; publish under the existing deployment authorization; verify the canonical Worker route, all ledgers, desktop/mobile cards, source links, the full event interval and exact 2080 endpoint; reconcile Supabase and GitHub receipts. Do not credit the candidate before that release is verified. Fully specified annual conditional scenarios and the wider historical/present evidence goal remain incomplete.
