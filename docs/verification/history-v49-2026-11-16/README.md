# V49 public-primary lifecycle candidate — 16 November 2026

**Release status: locally verified candidate; not yet published to remote R2/D1 or deployed to Cloudflare traffic.** This receipt deliberately separates local evidence validation from a production claim.

V49 (`20261116-enrichment-v49`) appends five public-primary lifecycle/status facts and three source records to the immutable V48 evidence snapshot:

- **The Beach Collection on Palm Jebel Ali:** Nakheel's 11 November 2024 dated release and its planned end-of-2027 first-residences target. The retained Q4 2029 catalogue target is not removed or reconciled into a false actual date.
- **AYA, Umm Al Quwain:** Deyaar's FY2025 reported enabling-works status, H2 2027 planned completion target, and aggregate project sales-status table.

The AYA aggregate table remains developer lifecycle/status evidence. It is not an individual registered transaction, a unit price, a valuation, rent evidence, actual completion, handover, occupancy or a forecast. V49 does not add any financial observation or approved annual value through 2080.

## Local candidate ledger

| Field | Value |
| --- | --- |
| Evidence version / cutoff | `20261116-enrichment-v49` / `2026-11-16` |
| Immutable archive root | `ad181fc0413731a3d3d8b720e442ab92934ce43bdf97551131b2e4a916ed8aae` |
| Canonical snapshot SHA-256 | `67810ba711305f779d7d39ecf5ea19f719d824d17c99fab5fa8a70e7b83cba4d` |
| Records | 1,860: 1,645 projects and 215 communities |
| Sources / events / exposures | 3,374 / 105 / 7,382 |
| Native historical rows / series | 633,891 / 16,872 |
| Changed records | 2 |
| Added lifecycle facts / financial observations | 5 / 0 |
| Scenario horizon | 2027–2080 slots; 0 approved annual values |
| Requirement ledger | 3,354 present; 3,404 partial; 26,722 missing; 9,300 unestablished |

The requirement ledger leaves 39,426 of 42,780 requirements unresolved (92.1599%). It is not a percentage of prices, rents or future values that may safely be estimated.

## Checks passed locally

- `npm test` — passed the complete JavaScript, historical-chain and identity-review suite.
- `npm run history:verify:v48-preservation` — retained V47/V48 root evidence and all 16,872 native series.
- `npm run history:verify:v49-preservation` — compared V48/V49 across 1,091 partition pairs and 1,476,518,068 decoded bytes; only the permitted release envelopes and V49 lifecycle additions differ.
- `npm run build:smart && npm run check` — regenerated the Worker and passed syntax checks.
- `git diff --check` — passed.

## Still required before a production statement

1. Immutable remote R2/D1 publication and index verification.
2. Isolated candidate Worker/API contract verification.
3. Canonical-shell browser verification with a version override.
4. Explicit traffic activation, then normal canonical API and desktop/mobile browser readback.
5. Public-safe control-plane/registry reconciliation.

See the [V49 source packet](../../../data/historical-intelligence/public-primary-lifecycle-pass49-20261116.json), its [reconciliation receipt](../../../data/historical-intelligence/public-primary-pass49-reconciliation.json), and the [data sourcing workflow](../../DATA_SOURCING_WORKFLOW.md).
