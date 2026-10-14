# GitHub-only regional source review — 14 October 2026

## Outcome and boundary

This is a source-review and collection batch, not a completed regional history enrichment. The fixed catalogue remains 1,645 projects plus 215 communities. No canonical record, existing source identity, native observation, lifecycle fact, coverage label, scenario input or runtime file was changed. No accepted financial observation or numeric forecast was added.

Continue PR #100, branch `research/all-emirates-evidence-queue-20261014`. Implementation commit: `f9e488d13fa47c02ca9e7fff0386f3de41db0f9a`. The prior queue head was `7b1e39c800936f6d84c74255864d2f5f2d018e96`; main was independently verified at `0361b0409c3fe688baa6c06787f9341cf5c17cff`. The working queue is explicitly V25, `20261008-enrichment-v25`, not a representation of the newer unmerged PR #98.

PR #98 was independently pinned at `6cb77c197d1ea6107c94f374f2bfa10c7248a043`. Its newer manifest was not available as decoded content through the file connector, so its PR description is not treated as an independently re-audited snapshot or proof of production state. Reconciliation remains a merge gate; this batch does not overwrite, merge or retarget that branch.

## Verified capture and CI receipt

All three implementation-commit workflows passed: [CI 38537563277](https://github.com/gugmaae-prog/espacios/actions/runs/38537563277), [repository guardrails 38537563278](https://github.com/gugmaae-prog/espacios/actions/runs/38537563278), and [regional review/storage 38537563345](https://github.com/gugmaae-prog/espacios/actions/runs/38537563345). All four requested npm checks passed, including isolated local storage verification. These results belong to implementation commit `f9e488d`, not an untested later runtime change.

The bounded collector used **20 total HTTP requests**. Eleven sources returned HTTP 200 metadata, nine passed all expected content needles, two WAM responses did not expose readable article text, one AYA request failed TLS certificate verification and one AMRA catalogue was deliberately not requested. TLS verification was not disabled. HTTP 200, a checksum and matching needles are not accepted record evidence.

The full source capture and unchanged 1,860-record queue are in [artifact 11881062700](https://github.com/gugmaae-prog/espacios/actions/runs/38537563345/artifacts/11881062700), created at 08:54 UTC on 14 October 2026, expiring 13 November 2026. Archive SHA-256: `b4f77eefd268072bd1dd2f89c00a2d0d55fcd64beac40d225b9bc86c6d6e11b7`. Original capture receipt SHA-256: `160fe135e63b01c213f00b744c39065b597e75d70417f7bdae292812e2430319`.

Durable normalized capture and reconciliation: `data/historical-intelligence/research-captures/regional-primary-20261014-v2.json`. It retains actual capture metadata, checksums, rights/identity references, exact zero coverage deltas, and the two publication-date disputes without redistributing raw source bodies. Original captures are not rewritten. The workflow skips new collection once this immutable receipt exists, avoiding a fresh crawl merely to update documentation.

## Inventory versus public-source screening

| Emirate | Projects inventoried | Communities inventoried | Distinct IDs screened against this source packet | Canonical records changed |
| --- | ---: | ---: | ---: | ---: |
| Abu Dhabi | 347 | 22 | 5 | 0 |
| Dubai | 1,119 | 147 | 2 | 0 |
| Umm Al Quwain | 20 | 5 | 4 | 0 |
| Fujairah | 1 | 2 | 2 | 0 |
| Ras Al Khaimah | 89 | 15 | 0 | 0 |
| Sharjah | 59 | 18 | 0 | 0 |
| Ajman | 10 | 6 | 0 | 0 |
| Total | 1,645 | 215 | 13 | 0 |

Inventory enumeration is not independent historical research completion. The regional queue accounts for all 347 Abu Dhabi projects (six Ghantoot/Ghantout flags), seven Palm Jebel Ali records, all 25 Umm Al Quwain records, all three Fujairah records and 1,478 remainder records. The six Ghantoot flags include five BAYN phases and a separate hotel/resort. The hotel is deliberately excluded from the ORA master-development candidate.

The exact queue SHA-256 is `cfc798a37365aee55fc1b5e3e9fdf15b685b4ee94b44e38c7497718d9dd5780b`. Existing snapshot SHA-256 is `c48c614b0c1e71fb7d0baf687c02890f64b84da06139b5cd39885f2f82d00110`. The 36 duplicate-normalized-name records and 1,059 project records lacking an accepted exact authority ID remain flagged, not silently resolved.

## Source and identity reconciliation

Thirteen selected primary-source candidates are in `data/historical-intelligence/research-candidates/regional-primary-20261014-v2.json`. They supplement rather than replace the seven earlier discovery leads. Review dispositions are five identity reviews, four asking-quote reviews, two event/scope reviews, one rejected subject match and one rights-gated catalogue. HTTP accessibility is a separate dimension, not an acceptance status.

BAYN: ORA's master announcement is compared with `adrec:624`, `adrec:628`, `adrec:650`, `adrec:646` and `adrec:623`. It is not an exact registered-phase crosswalk and produces no phase launch or price credit. `adrec:439` Ghantoot Hotel and Resort remains a different subject.

Palm Central: the 29 October 2025 and 24 June 2026 announcements describe different releases. The catalogue's generic Palm Central ID does not justify combining their residence counts, prices or delivery dates. The Palm Jebel Ali masterplan candidate is reviewed only against the community ID, never all villas or fronds.

Umm Al Quwain: Aquamarine, Aquamont and AYA advertisements require quote, unit and segment review. Advertised starting prices are not registered sales or signed leases. AMRA's catalogue terms were not accepted and no catalogue was downloaded. The two Sobha Siniya community IDs remain distinct, pending a reviewed identity reconciliation.

Fujairah: the Reportage Oceana project and catalogue pages are exact-name/marketer/emirate candidates, not legal-developer certification. The Address Fujairah construction article concerns Sharm and is rejected as evidence of Fujairah Beach's completion or occupancy. An incidental reference to both developments in one article is not identity proof.

The WAM article datelines and rendered header dates conflict: Address's article dateline is 15 November 2017 while the reviewed header showed 9 May 2026; AYA's dateline is 12 May 2025 while the reviewed header showed 30 July 2026. The source-plan `reportedPublishedAt` values are candidates, not certified first publication. Their publication dates remain disputed for this review. No forecast origin before actual proven source availability may use these sources. Planned completion remains planned.

## Additions and exact coverage changes

Accepted and applied additions are zero for lifecycle facts, registered transactions, signed rents, asking-price observations, valuations, developer aggregate sales-status observations, event exposures, scenario assumptions and numeric forecasts. Four asking-price source candidates are not four accepted observations.

V25 checklist totals are unchanged: 3,148 present; 3,437 partial; 26,895 missing; 9,300 unestablished; zero disputed, inaccessible and pre-applicability items in this particular aggregate. The total is 42,780 requirements, of which 39,632 are unresolved. Net change is zero in every state. A source access failure or publication dispute is not promoted to a canonical record coverage change.

The scenario core is unchanged: 54 annual slots for 2027–2080. Missing anchors and assumptions remain unavailable. No numeric path, event uplift or before/after causal result was generated.

## Collection methodology

The collector is explicit-run, allowlisted and bounded: 13 planned sources, at most 20 source pages, 40 total HTTP requests including robots/redirects, concurrency one, two-second minimum delay, two redirect hops, 15-second request timeouts and two-megabyte response bounds. It stops on inaccessible or invalid robots policies, stricter crawl delays, HTTP errors, unapproved redirects, binary/PDF responses and catalogue acceptance gates. It does not retry around access restrictions.

Only normalized metadata is retained: source ID, canonical/final URL, publisher/class, rights restriction, reported date precision, retrieval and conservative availability timestamps, actual HTTP metadata, body checksum, robots receipt and bounded needle-check booleans. No raw HTML, PDF, images, transaction export, cookies or credentials are stored. A successful HTTP response or string match does not establish record identity or accept a fact.

No append-only enrichment script is supplied because no new fact passed the integration and provenance gates. The committed collector does not import or invoke the enrichment or publication modules. No ingestion schedule was configured.

## Verification and remaining work

Sixteen new offline tests passed before the implementation commit, plus validation against the real 1,860-ID queue. Exact-commit CI, repository guardrails and the read-only research workflow provide the authoritative full-suite receipts. The research workflow checks snapshot and manifest checksums before/after collection, then runs the existing regional tests, history build, npm test, npm run check, npm run build:smart and npm run history:verify:storage.

The remaining regional backlog is not complete: resolve the newer PR #98 snapshot and source crosswalks first, then obtain lawful exact-record registered sales and signed rents, verify lifecycle applicability, retain sparse native observations and validate new sidecars before any coverage credit. Do not reclassify the present source captures as financial history.

## Separately authorized operator work

After GitHub evidence review and PR #98 reconciliation, an operator must separately authorize and perform immutable versioned R2/D1 publication, stage a zero-traffic Worker candidate, verify candidate APIs and browser behavior, authorize traffic activation, independently verify the canonical endpoint and reconcile the Supabase release registry/control plane. None of those operations was performed in this batch. This is not deployed, activated or 100% complete.
