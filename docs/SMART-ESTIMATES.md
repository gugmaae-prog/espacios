# Espacios Smart Estimates

## What this release changes

The existing map, source history, saved research models, collapse repair and restricted Data Room are the baseline, not replacements. `src/baseline/worker-20260930.js` is the complete production Worker acquired on 30 September 2026. `scripts/build-smart.mjs` adds the reviewed estimate engine, compact panel and read-only endpoint to that baseline.

Prices and ROI now expose separate 1-, 3-, 5- and 10-year conditional scenarios. Observed history and short-term saved research projections remain on their original routes. An estimate is not an observed future price, a certified property valuation, a probability interval or a guaranteed investment return.

## Data and storage

- Cloudflare R2 bucket: `psr-market-intelligence`.
- New immutable object: `research/published/2026-09-30/smart-estimates-v1/scenarios.json`.
- SHA-256: `f77472b65fad63bb6dd59323ed93823fb623a193d58c8cd014c2e3f868a3c4b4`.
- Public read-only route: `/map/api/smart-estimates`.
- Reviewed snapshot cutoff: `2026-09-30T00:00:00Z`; source observation dates remain distinct.
- Existing D1 tables, R2 objects, project catalogue and model trials are unchanged.
- No Supabase keys, new credentials, database migration or access-policy change is needed. The available Supabase project did not contain a populated map catalogue.
- Individual edited ROI calculations are calculated in browser memory and can be exported. They are not silently saved as historical facts or approved forecasts.

The additive snapshot retains 246 exact sales series with 4,978 native quarterly points, and all 228 asking/yield rows in 96 area/type groups. It contains 153 eligible price scenario sets, each with three paths and ten annual outcomes. This is 4,590 conditional outcomes, not 4,590 independent forecasts. The complete 4,882-series history library remains available separately.

## Method

History-informed scenarios use an exact area, property type, registration and source basket. At least 20 contiguous native quarters, each with at least 20 sales, and a sufficiently recent anchor are required. Starting rates use the 25th/50th/75th percentiles of overlapping annual log changes, shrunk by 50%, capped at ±10%, and damped toward zero nominal annual growth by a factor of 0.8 each subsequent year. The shrinkage, caps and damping are transparent policy choices, not statistically fitted probabilities. Changing transaction mix means a median is not a repeat-sale appreciation index.

When a valid recent local anchor exists but the historical calibration gate does not pass, paths explicitly assume −3%, 0% and +3% initial annual growth with the same damping. Older dated anchors remain available only with explicit opt-in. There is no nowcast bridge from an old source date to today, no interpolation of history, and no borrowed nearby price. All paths show their source anchor and target dates.

ROI is nominal all-cash net holding-period return, not annualized yield or IRR. It accounts for purchase and exit costs, vacancy, annual operating costs, rental growth and an income-start year. Default costs are illustrative inputs, not jurisdictional fee advice. Gross rental benchmarks remain distinct from actual collected rent. Financing, taxes, staged off-plan payments and unit-specific differences are excluded. Combined apartment/villa calculations aggregate allocated cash flows and require compatible dates/bases; they do not average two percentage returns.

No Etihad Rail, museum, airport or other infrastructure uplift is automatically imposed. Their effects require evidence and can be uncertain, delayed or offset by supply and financing conditions. The product supports investment investigation, not a universal “best investment” ranking.

## Historical enrichment discovered, not yet released

`data/source-review-20260930.json` and `/map/api/smart-estimates/sources` publish metadata and quality gates only. New official Abu Dhabi feeds were found: 560 monthly sale-index points and 24,131 annual-rent rolling-average records across 90 districts. Their complete raw rent snapshot is retained privately outside this public repository. Bulk reuse terms, rolling-window definitions and revision methodology need resolution before public numeric redistribution or training. The rent-index feed additionally has 711 conflicting duplicate keys. RAK official transaction statistics also require reuse review. These are not silently averaged, filled or called approved data.

The discovery queue is additive. Existing approved history is not removed because a newer candidate feed is pending review.

## Build and test

```sh
npm ci
npm run verify
npm run cf:dry-run
node scripts/preview-smart.mjs
```

`build-estimate-data.mjs --source-root PATH_TO_RETAINED_RECOVERED_ARCHIVES` regenerates the fixed snapshot and verifies archived input hashes. Native monthly and quarterly partitions overlap; their observations must not be counted as independent transactions.

The default Wrangler manifest remains a candidate Worker. Production promotion requires the explicit `wrangler.production.jsonc`, preservation comparison, independent browser checks and an authorized release. Rollback baseline: Worker version `7d080ba3-0e36-4d2f-bb8b-134e9c720f83`. The separate map shell and Data Room access gate must remain unchanged.
