# Reviewed history and neutral map controls

Candidate: `20261007-enrichment-v11`, evidence cutoff `2026-10-06`.
Frontend: `20261007-history-v11-neutral-ui`.

This release reconciles main's V10 accountability and event chronology with the
reviewed primary-source packets in `enrichment/v10/pass21-primary-source.json`,
`enrichment/v11/pass22-arada-primary.json`, and
`enrichment/v11/pass23-34-reviewed.json`. It preserves the 1,645 projects and
215 communities. The last packet contributes 1,270 aggregate observations,
238 series and 136 facts; the two primary-source packets contribute 28 facts.
Aggregates overlap and must not be added together as independent transactions.

The active category and map-mode controls now share a soft, theme-aware selection
tint instead of separate gold and solid navy treatments. Text, outlines and
font weight identify selection. Event markers and source panels use the same
palette. The date selector is bounded at both timeline endpoints on mobile.
Heatmap values retain their quantitative scale and source labels.

## Preservation and publishing

Moving the cutoff forward previously caused the builder to lose selected quotes
whose observation date matched the previous release date rather than retrieval
date. The builder now reads the checksum-verified V9 immutable root and retains
its quote vintages. Segmented or explicitly ineligible quotes remain historical
evidence and cannot become the project's headline price. This does not recertify
an old advertisement as today's market price.

The two obsolete one-time V10 import workflows have been retired. They used a
literal SQL file import, which exceeds D1's 100 KB statement limit for large JSON
records. The supported publisher is `scripts/publish-historical-snapshot.mjs`,
with the production adapter and short-lived authenticated release bridge. It
binds JSON as parameters, verifies immutable R2 bytes before/after conditional
creation, rejects version/root collisions, verifies every indexed table count,
and only then marks that snapshot complete. It never changes an existing root.
The existing local D1 test round-trips headers and records larger than 100 KiB.
See [Cloudflare's limits](https://developers.cloudflare.com/d1/platform/limits/).

Release sequence: build history, run `npm run verify`, verify preservation against
the saved production snapshot, run `npm run history:verify:storage`, and dry-run
`wrangler.production.jsonc`. Create a private target manifest containing the exact
account, Worker, D1, R2, new snapshot version and root hash. Deploy the existing
release bridge with an expiry and a private token, then invoke the publisher with
`--production --apply --config wrangler.production.jsonc --target <private-target>
--adapter scripts/adapters/production-history-publisher.mjs`. The adapter reads
`ESPACIOS_PUBLISH_HEADER_FILE`, which must have mode 0600. Keep tokens and deployment
scratch outside this public repository. Deploy the map only after publication
verification, verify canonical APIs/assets and desktop/mobile interactions, then
remove the temporary bridge. Do not run a raw D1 file import or force-overwrite R2.

## Outstanding evidence work

No complete lifetime history or validated 2080 forecast is certified. Financial,
lifecycle and event coverage remain separate. Planned infrastructure and
conditional annual paths do not count as observed outcomes.

PR #46's transaction-report extraction remains a separate review: preserve its
5,651 printed sales and explicitly account for the 56,741 unprinted transactions
claimed by report summary cards. Verify original report rights, exact identities,
duplicate handling and period completeness before promoting any extraction.
Seven observed days do not prove that every transaction in that week was printed.
Do not merge overlapping drafts merely to increase the apparent coverage.

Next: resolve direct sale/rent and lifecycle gaps by record and native period,
review the pending transaction extracts, continue public-source research, and
retain all unavailable/disputed periods. Conditional scenarios through 2080 remain
separate from observed history and validated short-horizon projections.
