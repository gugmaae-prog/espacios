# Espacios data sourcing workflow

This is the operating workflow for every project and community record. It is designed to add useful public evidence without turning sparse, contextual or planned information into an invented property price, rent, valuation or forecast.

## 1. Define the target before collecting

Each incoming item is assigned to one of the 1,645 project or 215 community records only after its intended use is known. The research ledger tracks separate requirements for lifecycle, registered sales, signed rents, advertised prices, valuations, occupancy, events and scenario inputs. A construction date closes only a lifecycle requirement. It never supplies a historical value.

For financial history, the target also includes the property segment, unit/bedroom scope, currency, measurement, native frequency and period. Project evidence is not promoted from a community series, and community context is not promoted from a project series.

## 2. Collect lawful source vintages

The collection order is:

1. Official public authority data, registers, planning/project-status records, open-data exports and published statistics.
2. Primary developer material: registered project pages, dated announcements, investor reports, sales brochures and price lists.
3. Official government, regulator and operator announcements for infrastructure, policy and market events.
4. Contemporaneous reputable reporting and method-disclosed market reports, used as secondary evidence or to locate an original source.
5. Existing lawfully retained Espacios source snapshots, which are rechecked before reuse.

For each usable vintage, the source record retains its URL, publisher, source class, licence or terms where available, retrieval time, first-known availability, publication time when known and a content checksum. Where retention is lawful, the original response or a bounded capture packet is preserved with its byte size, capture method and checksum; where it cannot be retained or redistributed, that boundary is recorded and the checksummed normalized extraction is the reproducible artefact. Syndicated copies are linked to the originating material rather than counted as independent corroboration. Private captures, tokens, contact details and unlicensed raw exports are not published.

No scraping bypasses authentication, access controls, rate limits, robots restrictions or licence terms. A source that is inaccessible, paid, withdrawn or lacks a lawful reusable path is logged as unavailable; it is not backfilled with an estimate.

## 3. Resolve identity before admission

Every candidate must resolve to exactly one catalogue record. Matching uses the strongest available combination of authority project/developer/area IDs, official name, phase/tower/component, geographic scope and developer evidence. For a project-status record, the authority project number and ID, developer number and area ID must agree with the retained register crosswalk before its name is accepted as a confirmation. The review rejects name-only fan-out, parent-to-component inference, generic map coordinates and legal/marketing developer substitution.

Candidates with the same project name, disputed phase boundaries, conflicting inventory or unresolved developer roles remain in an identity-review queue. They receive no observation, coverage credit or price series until the link is proven.

## 4. Classify the evidence

Admitted evidence is kept in distinct classes:

| Class | Examples | What it cannot establish |
| --- | --- | --- |
| Registered transaction | Authority-recorded sale or signed rent | Asking price, current valuation or full-period median |
| Advertised/quoted price | Brochure or dated launch price | A completed sale or realised rent |
| Valuation | Dated, scoped valuation with methodology | Transaction price or a forecast |
| Lifecycle | Registration, filed start, inspection progress, planned handover, actual completion | A financial value or occupancy unless explicitly evidenced |
| Event/context | Policy, infrastructure, disruption, macroeconomic event | A local price uplift or causal effect by itself |
| Scenario input | Disclosed rate, supply, migration, cost or other assumption | An observed historical fact or validated outcome |

The fact stores its date precision, source ID, identity basis, evidence class, scope and whether it is planned, reported, confirmed or disputed. It keeps occurrence, announcement, effective, publication, first-known-availability and retrieval dates separately when applicable: a 2026 retrieval of a 2022 inspection is not evidence that the inspection was available to a 2022 investor or backtest. A current authority status or 100% progress field is a retrieval-time snapshot unless separately supported as actual completion, handover or occupancy. Superseded schedules are retained rather than overwritten.

## 5. Preserve the native history and mark gaps

Observed values retain their source date and native daily, monthly, quarterly or annual frequency. Individual verified sales remain visible even with a small sample. Aggregated medians or model inputs use an explicit minimum-sample rule, so a sparse month does not become a market-level estimate.

For every applicable period, the ledger distinguishes present, partial, missing, unestablished, disputed, inaccessible and pre-applicability states. “Earliest record found” never becomes “first-ever transaction” without evidence. Pre-launch prices, pre-occupancy rents and future outcomes are rejected.

## 6. Attach events without inventing an effect

Government projects, policy changes, infrastructure, climate events, security incidents and macro disruptions are recorded separately from property observations. An event-to-record link states its geographic exposure, mechanism, planned/actual status, source and evidence strength.

The first analysis window is 12 months before and after an event, at the data's native frequency. It reports observed changes and data gaps before any explanatory claim. Attribution needs suitable controls, pre-trend checks, property-mix adjustment and concurrent-event review. A news item never supplies an appreciation coefficient.

## 7. Build conditional paths through 2080

The interface contains annual 2027–2080 slots for every record. A numerical path is published only when the starting value and the full disclosed annual assumptions are present. Inputs such as delivery timing, supply, migration, rates, inflation, vacancy and costs are versioned and dated. Delays, downside and losses remain possible.

Short-horizon backtesting measures short-horizon performance only. It does not validate a 54-year prediction. Where required inputs are absent, the slot remains unavailable instead of using a contextual proxy or an invented value.

## 8. Validate before release

Each evidence batch runs identity, duplicate, date, arithmetic, source-availability, source-licence, preservation and schema checks. The release compares all unaffected records, financial observations and native history partitions against the previous immutable snapshot. It also verifies that planned milestones have not been relabelled as actual completion or occupancy.

The verified snapshot is written append-only to immutable R2 objects with checksums, indexed in D1, and first checked against preview APIs. Prior source revisions and roots remain addressable; a failed candidate is not relabelled as production. Production promotion then requires canonical API checks, selected record-history checks, source-link/evidence-label checks and desktop/mobile map validation. Deployment metadata records the source revision and immutable root. Temporary publisher credentials are removed after release.

## 9. Cadence and reporting

Espacios does not currently run a daily automatic source feed. Sources are checked and ingested in reviewable batches because different authoritative publishers refresh at different intervals and every addition needs identity and provenance validation. A future daily job would report source-last-checked, source-published-at, latest-observation-at and review status separately; a daily check is neither a daily observation nor a daily publication. It would not claim daily data where the publisher does not supply it.

The completeness report is requirement-level, not a claim that every record has a full lifetime price series. It reports the count and percentage of unresolved requirements alongside the financial, lifecycle, event and scenario coverage. Research attempts, contextual proxies, unpublished private records and future outcomes remain excluded from observed-data completeness.
