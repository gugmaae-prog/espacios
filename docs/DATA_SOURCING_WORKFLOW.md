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
