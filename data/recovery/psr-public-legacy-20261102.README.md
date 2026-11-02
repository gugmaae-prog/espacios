# PSR public registry fallback

The compressed object is an archived response from `/map/api/projects-all`, last modified locally on 1 November 2026. The response reports a PSR registry vintage of 22 July 2026 and contains 1,073 unique project slugs. Its top-level reported total is 1,102, so the response is not evidence of a complete current Data Hub population.

`psr-public-legacy-20261102.manifest.json` records the original and compressed byte counts and SHA-256 checksums. The build verifies the archive before embedding it in the map Worker; the Worker verifies both checksums before serving it. This fallback is used only when the newer Data Hub first page cannot be validated. The API response marks itself degraded, identifies the older source vintage, and sets `completeForCurrentDataHub` to `false`.

This PSR registry is separate from the accepted V48 map identity universe and does not establish complete UAE project coverage. Rebuild or replace the fallback only from another reviewed, source-labelled capture.
