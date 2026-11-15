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


---

## Retained earlier V25 queue-only workflow

The following is historical queue-pass documentation, not the current snapshot baseline. Both independently authored workflows are preserved.

# Data sourcing workflow — GitHub-only research

This workflow defines **research and source review**, not publication or live deployment.

## Current repository baseline

The branch is pinned to the verified `main` commit `0361b0409c3fe688baa6c06787f9341cf5c17cff`. Its committed publication manifest is `20261008-enrichment-v25` with **1,645 projects, 215 communities and 1,860 stable IDs**. PR #98 is open and includes later unmerged history work. It must be rebased/reconciled before any future evidence merge; no PR #98 material is presumed to be in `main`.

The requested `docs/DATA_SOURCING_WORKFLOW.md` did not exist at this branch base. This document creates it without modifying existing evidence. The historical snapshot, source packets, native series and all source provenance remain unchanged.

## 1 — Inventory and priority

Run `python3 scripts/build-regional-review-queue.py --verify-only` first. Then run without `--verify-only` to generate deterministic queue artifacts. The script reads the **committed canonical record snapshot**, its corresponding publication manifest, and a checksum-verified pinned catalogue inventory. It refuses lost, duplicate or added record IDs. It never downloads or publishes anything.

Review priority:
1. **Abu Dhabi** — every project/phase, with the spelling variants Ghantoot/Ghantout flagged first. Community records are retained in the all-emirates remainder unless geographically selected separately.
2. **Palm Jebel Ali** — its Dubai community and matching project/phase records, without parent/phase promotion.
3. **Umm Al Quwain** — all projects and communities.
4. **Fujairah** — all projects and communities.
5. **Remainder** — every other catalogue record, including Abu Dhabi communities.

The JSONL queue preserves each stable ID, name, raw marketed developer (not legal validation), source IDs, verified native authority IDs where already present, lifecycle claims, identity-review flags and every existing item-coverage state. The CSV exposes a concise analyst worklist. Duplicate normalized names are flagged, not consolidated.

## 2 — Bounded research and provenance

Only independently permitted public authority/developer sources, public regulatory materials, official reports and properly licensed aggregates may be considered. The reviewed URL leads in `data/historical-intelligence/research-candidates/regional-20261014.json` are **discovery leads**, not captures or accepted facts. They have deliberately null HTTP status, final URL, checksum, first-known availability and retrieval date because none of those facts was verified by the GitHub workflow. Source text is not redistributed.

Future collectors must have an explicit target list, allowlisted domains, **maximum 20 URLs per regional pass**, **concurrency at most 2**, and conservative rate limits; obey robots, licences, account permissions and access controls. For each genuine capture, retain canonical URL, final URL, publisher, status, content type, checksum, capture method, licence/reuse boundary, publication precision, earliest proven availability, retrieval time and the native observation basis. An old event date does not establish old forecast availability.

## 3 — Identity and financial evidence gates

Attach accepted facts only to **one exact** stable catalogue ID. Prefer official project/developer/area/tower/phase numbers. Crosswalk a verified legal developer separately from the catalogue marketer. Name-only, nearby, master-development or shared-area labels are review candidates, never verified subject financial history.

Do not combine registered sales, signed rents, asking prices, valuations, aggregate developer sales, construction, opening, transport and government events. Retain source-native periods and unit/segment/transaction-type semantics; preserve sparse underlying transactions and gate only displayed aggregates. Do not turn registrations into physical construction starts, planned targets into handovers, an area average into a project valuation, or a reported gross sales figure into price per residence.

Record state per checklist item: present, partial, missing, unestablished, disputed, inaccessible or pre-applicability. If source rights or identity are unclear, do not promote coverage.

## 4 — Historical events and 2080 scenarios

Dates for occurrence, announcement, effective status, publication, first availability and retrieval remain separate. Exposure requires geographic evidence and does not imply property existed at event time. Automatic price uplift stays null. Event studies use 12 months on each side only where native observations, proper controls and completeness permit.

Preserve 54 annual slots for **2027–2080**. Price, rent and net-return scenarios require subject anchors and explicit supply, delivery/occupancy, migration, rates, inflation, vacancy, costs and exit assumptions. Null is the correct response when unavailable. No unapproved value is described as a validated forecast.

## 5 — Review and handoff gates

Use `python3 tests/regional-research-queue.test.py`, the real-snapshot `--verify-only` check, `npm test`, `npm run check`, `npm run build:smart`, and `npm run history:verify:storage`. The GitHub workflow exports the queue as a review artifact. The artifact is **not** an immutable data release.

For this evidence-neutral batch: **0 changed catalogue records; 0 accepted observations or source captures; 0 new forecasts; 0 change to coverage totals.** The V25 reported checklist baseline remains 3,148 present, 3,437 partial, 26,895 missing and 9,300 unestablished (42,780 total, 39,632 unresolved). These are checklist requirements, not missing monthly-price percentages.

A separately authorized Cloudflare operator must later handle immutable R2/D1 publication, zero-traffic Worker candidate, candidate API/browser verification, traffic activation, canonical-site checks and Supabase control-plane reconciliation. No action in this PR does that.


## Accepted regional pass V47 — 14 October 2026

The current GitHub-only candidate extends checksum-verified V46 with 20 accepted facts on 16 records (14 asking-price observations, three launch quarters and three planned completion targets). It preserves the fixed catalogue and native history. The older queue-only figures above are earlier-pass receipts. See [the current handover](verification/regional-research-2026-10-14/ACCEPTED-PASS47.md) for exact source decisions, coverage changes, verification and the separate operator boundary. No publication or production activation is implied.
