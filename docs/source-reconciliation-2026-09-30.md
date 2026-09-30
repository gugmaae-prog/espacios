# Espacios map source reconciliation — 30 September 2026

GitHub `main` at `3e6532ed9f4a8851ddf5d26d71eb6d3f73721da7`
documented current architecture but still held an older Worker. Later live
releases added historical/prediction enrichment, UAE coverage, the restricted
Data Room, collapse repairs and the System surface. Deploying old source would
remove those additions.

The current Worker was acquired unchanged into
`src/baseline/worker-20260930.js`. Its adjacent manifest records version
`7d080ba3-0e36-4d2f-bb8b-134e9c720f83`, deployment
`09be2751-a039-4b34-9f21-a90d53ab4c77`, 843,642 bytes and SHA-256
`b9aab494d2297e7208f5257c069a54c2a6f9eb3762ff79224350ae4006357e06`.
The original local checkout was not reset or overwritten. A separate clone was
used; after cloud-storage placeholders interrupted local reads, work continued
in a fresh local temporary checkout of the same main commit.

## Preservation contract

- Keep the acquired baseline immutable. The generated Worker composes additions
  with it; the complete baseline remains a prefix after documented cache-token
  and source-map normalization.
- Preserve existing data/history/research endpoints, map interaction/theme,
  September 29 collapse repair, September 30 System routes and removed invite CTA.
- Preserve `DATA_ROOM_PUBLIC=false`, tenant boundaries and route ownership.
- Add conditional estimates alongside observations and experimental predictions.
  Missing evidence is not zero; estimates are not verified valuations or
  guaranteed returns. Do not replace historical observations with scenarios.
- Do not overwrite D1 observations or existing R2 source objects in a code release.
- Preserve different record grains: catalogue rows, authority/project-phase
  records and unique developments are not automatically the same population.

`wrangler.jsonc` remains the candidate. `wrangler.production.jsonc` explicitly
identifies the existing production Worker, AI/D1/R2/property-service bindings and
closed Data Room. No routes are declared: `espacios-map-shell` continues to own
the canonical route through its `MAP` service binding.

The old asset-extract/embed scripts understand the original bundle, not all later
appended UI layers. Build Smart Estimates with `scripts/build-smart.mjs`; do not
replace the reconciled Worker with old assets.

## Verification

Existing functional smoke assertions are retained; release-header consistency
replaces the obsolete September 22 cache-key requirement. Additional tests cover
the preserved history hooks, collapse repair, System routes and fail-closed room.

```sh
ESPACIOS_TEST_WORKER_MODULE=../src/baseline/worker-20260930.js node tests/smoke.mjs
node scripts/build-smart.mjs
node tests/smart-api.mjs
```

Promotion requires tests, candidate and live desktop/mobile checks, retained data
fingerprints and a recorded rollback version. Worker rollback does not revert
mutable D1/R2 changes.

## Public repository security

Every committed byte is public. Publish reviewed code, methodology, aggregate
verification and non-secret resource identifiers only. Keep credentials, private
tenant/CRM data, raw authority exports and private evidence outside the repo.
The source acquisition adds no runtime credential exports or private raw data.

Ignore rules exclude environment/runtime-secret files, common credentials,
private keys and local evidence/export directories. Example files may contain
placeholders only. The existing CI workflow is unchanged because the current
GitHub OAuth login cannot edit workflows. A separate local review scanned tracked
and compressed content without publishing values. CI and ignore rules are
supplementary; they do not replace that review.
Actual credentials belong in runtime or appropriately scoped Actions secret
stores, not files, logs, PR text or documentation.
