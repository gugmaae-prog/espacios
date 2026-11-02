# Data Hub public-read recovery

`worker.js` was downloaded read-only from the live `espacios-data-hub` Worker on 2 November 2026 using `wrangler init --from-dash`. The downloaded file had SHA-256 `607aa88af72e4c2dfd27bd0cdc4b52f1cd551de76b3fbf4535c54e589667825a`; its live production version was `f0cb76b6-87b4-495a-98b0-8dd73952c8d9`. The one missing source-map directive was removed before editing. This checked-in source is the reviewed baseline for the focused cache changes, not a new tenant database.

The unfiltered public project route uses the recorded registry count, while filtered requests still run their count query. Public page responses use the existing five-minute cache contract, with an exact URL cache key and conditional ETag handling. The developer, emirate and property-type filter list is cached by tenant and registry revision. Admin routes, tenant authentication, project detail routes, and database writes retain their existing behavior.

On 2 November D1 returned free-tier daily row-read error 7500. D1 Insights for the preceding day showed 231 filter scans reading 504,110 rows, 327 matching count queries reading 680,876, and 201 page queries reading 363,900. This change reduces repeat reads after D1 access returns; it cannot itself reset the exhausted quota. `tests/data-hub-cache.test.mjs` checks cached and uncached behavior with a mocked D1 binding.

`wrangler.data-hub.production.jsonc` omits routes and the existing admin-email value. Upload with `--keep-vars` and stage at 0% traffic. Verify the public catalogue, filtered results, tenant boundaries and authenticated admin behavior after D1 reads resume before promoting this Worker.
