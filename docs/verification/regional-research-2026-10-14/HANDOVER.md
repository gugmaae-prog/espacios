# GitHub-only regional research handover — 14 October 2026

**Status:** evidence-neutral regional inventory, provenance-gated discovery leads and deterministic queue generator. **NOT deployed, published, merged or 100% complete.**

## Branch / base

Repository: `gugmaae-prog/espacios`. Branch: `research/all-emirates-evidence-queue-20261014`; base commit: `0361b0409c3fe688baa6c06787f9341cf5c17cff`; fixed manifest `20261008-enrichment-v25`. PR #98 is open and carries a newer, unmerged historical branch: do not overwrite or silently treat it as accepted `main`.

## Deliverables

- `scripts/build-regional-review-queue.py` reads the exact current committed catalogue and snapshot, verifies SHA-256 and the 1,860-record invariant, and emits exhaustive machine-readable JSONL plus review CSV, each grouped by priority and stable ID.
- `data/historical-intelligence/research-candidates/regional-20261014.json` contains seven bounded authority/developer discovery leads. They are **unattached and unaccepted**, with null capture/availability/checksum fields, not fabricated evidence.
- `tests/regional-research-queue.test.py` tests identity, spelling, phase scope, duplicate names and no invented forecasts. The read-only GitHub Actions job generates the entire queue as an artifact.
- `docs/DATA_SOURCING_WORKFLOW.md` documents sourcing, rights, identity and 2080 rules.

## Verified preservation contract

Exactly **1,645 projects + 215 communities**, stable IDs and all native observations untouched. No source packet is appended into `scrape-enrichment.json`, no candidate is credited as a registered sale, rent, valuation, asking price or lifecycle fact, and none of the 54 annual scenario slots for each metric receives an invented numeric value.

## Reviewed/changed and source disposition

All 1,860 records are **enumerated for review**, not individually newly researched. The GitHub Action receipt reports exact counts by priority region, including every Abu Dhabi project and Ghantoot-name/area flag, PJA community/projects, UAQ, Fujairah and all remaining records. **Changed record identities: 0 in every emirate.** Seven leads discovered; zero captured/accepted/rejected/inaccessible through this batch; seven still await direct HTTP capture and exact identity review. New lifecycle facts, sales, rents, asking prices, valuations and event links: **0 each**. New forecasts: **0**. Checklist net changes: **zero in every state**.

Existing V25 checklist: 3,148 present, 3,437 partial, 26,895 missing, 9,300 unestablished, 42,780 total. No completeness claim.

## Outstanding regional evidence work

Abu Dhabi/Ghantoot: exact subject registry and Ghantout geographical link, title/transaction/rent record access, progress-versus-handover distinction and legal developer/marketed developer separation. Palm Jebel Ali: phase/frond-specific IDs, scope of Nakheel releases, realized villa sales versus land, completions, signed rents and site geometry. Umm Al Quwain: verify official land/lease availability and source permissions, exact phases, title and rental registers. Fujairah: EJAAR is a registration system with access control, not a public transaction export; verify any lawful project and rent access without logging in or bypassing service controls. Extend the same standards to other emirates.

## Explicit handoff — Cloudflare operator only

1. Review and merge this PR with PR #98 reconciliation (never overwrite its newer branch).
2. Accept exact-ID source facts only after rights, dates, evidence and checksum review.
3. Rebuild from pinned inputs; compare all prior native series and stable IDs.
4. Publish a newly versioned immutable R2/D1 snapshot only with separate authorization.
5. Stage a zero-traffic Worker candidate preserving Data Room and tenant protections.
6. Verify candidate APIs and desktop/mobile browser behavior.
7. Activate traffic only after acceptance, then independently verify canonical URL.
8. Reconcile Supabase release registry and control plane, preserving audit history.

No remote publication or activation has been requested or performed here.
