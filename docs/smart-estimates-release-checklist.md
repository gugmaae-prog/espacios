# Smart Estimates release checklist

This checklist is not a deployment claim. Record the actual commit, Cloudflare
version and verification receipts once promotion completes.

## Review scope

- Preserve the acquired live map/data/history handlers, collapse repairs, System
  and restricted Data Room surfaces.
- Add separately labelled 1-, 3-, 5- and 10-year conditional estimates without
  replacing observed history or experimental research predictions.
- Distinguish appreciation, gross yield, net rental income and total return;
  expose assumptions and missing evidence; never promise guaranteed returns.
- Keep compact startup and reveal research/assumptions on demand.
- Preserve tenant boundaries, route ownership and `DATA_ROOM_PUBLIC=false`.

## Automated checks

```sh
node scripts/build-smart.mjs
npm run verify
node --test src/smart-estimates/core.test.mjs
node tests/smart-api.mjs
git diff --check
```

The Smart API tests cover exact immutable R2 key, GET/HEAD/304, rejected writes,
sanitized errors, no private-binding access, checksum-protected baseline and exact
baseline-prefix preservation after documented normalization. Keep the existing CI
workflow; run a separate value-safe local secret review before publishing.

## Public data receipts

```sh
node scripts/verify-release.mjs --output data/release-verification-20260930-before.json
node scripts/verify-release.mjs \
  --before data/release-verification-20260930-before.json \
  --output data/release-verification-20260930-after.json
```

Receipts contain endpoint/status/access checks, aggregate counts and canonical
hashes, never source rows or credentials. Retained data fields are compared
separately from mutable timestamps/new System metadata. A fingerprint change
fails for review: live-feed drift may be legitimate but must not be silently
overwritten or normalized. Do not force research and heatmap population counts
to match. Prediction/history checks cover catalogue metadata and the first
requested page, not every historical partition or model run.

## Manual acceptance and promotion

- Desktop/mobile and both themes: compact startup, no overflow, readable labels,
  working collapse/expand and unchanged map navigation.
- Prices/ROI: history and latest values remain reachable; apartment/villa/mixed
  controls and future horizons behave correctly; assumptions stay clear.
- Publish reviewed scenario data only to its new immutable R2 key. Do not replace
  prior data or turn unavailable evidence into zero.
- Keep System public-safe and the room closed.
- Test a candidate before promotion, record shell identity and rollback version,
  then independently verify canonical live routes and data fingerprints.

## PR summary template

**Change:** additive Smart Estimates with live-source reconciliation and source
history preservation.

**Evidence:** exact commands/browser checks completed, before/after receipts and
the generated-source commit.

**Boundaries:** scenarios are not validated forecasts/certified valuations;
evidence gaps stay explicit; no private data or secrets; restricted Data Room.

**Release:** record actual version/deployment only after independent verification.
Code rollback does not revert mutable D1/R2 state.
