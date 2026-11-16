# V48 production publisher prerequisites

This is a pre-publication preparation note, not evidence of a remote write or deployment.

The previous V47 bridge is intentionally version and root scoped. Its health endpoint will reject V48, and its adapter does not accept an unlisted URL. Before V48 publication, deploy a new short-lived publisher Worker with these exact non-secret variables:

| Variable | Required value |
| --- | --- |
| `PUBLISH_VERSION` | `20261014-enrichment-v48` |
| `PUBLISH_ROOT` | `ca1133d5169abc0bc2aec24eb193719018e47a3e9d06c773a951b9cc9a7424a0` |
| `PUBLISH_EXPIRES` | A future RFC 3339 timestamp chosen at release time |

The bridge must retain the production bindings in `wrangler.production.jsonc`: `MARKET_R2` to `psr-market-intelligence` and `DB` to `cba-property-db`. Create a fresh private authorization-header file for the new bridge. Do not reuse the V47 expiry or represent its header as valid for V48.

After deploying the bridge, copy [production-target.example.json](production-target.example.json) to an ignored release-local target file, confirm `GET /health` returns the exact V48 version and root, then run the immutable publisher with:

```sh
node scripts/publish-historical-snapshot.mjs \
  --production --apply \
  --config wrangler.production.jsonc \
  --target /absolute/path/to/v48-production-target.json \
  --adapter scripts/adapters/production-history-publisher.mjs
```

The production adapter has an allowlisted V48 endpoint, requires a private `ESPACIOS_PUBLISH_HEADER_FILE`, validates the production target, and checks the bridge's version and immutable root before any R2 or D1 operation.
