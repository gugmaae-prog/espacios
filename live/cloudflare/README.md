# Deployed Cloudflare modules

These files are the modules Cloudflare is serving for espacios.me. They were read from the account with the Workers script API. They were not deployed from this branch.

`wrangler.jsonc` still names `psr-portfolio-map-v2-navigation-candidate` and still points `main` at `src/worker.js` (`20260922-auditfix-v13`). Do not point Wrangler at this directory and deploy. That would publish this snapshot, and changing the Worker name to `psr-portfolio-map-v2` would replace the live script.

| Path | Worker | What it is |
| --- | --- | --- |
| `psr-portfolio-map-v2/worker.js` | `psr-portfolio-map-v2` | Bundled module modified 29 Sep 2026 04:12Z. Stamp `20260929-collapse-repair-v3`. This module is not in `src/worker.js`. |
| `psr-portfolio-map-v2/served-app-v2.js` | same | Body of `GET https://espacios.me/map/app-v2.js` during this read. The Worker builds it from a gzipped asset plus `aePatchedAppJs()`. |
| `espacios-map-shell/worker.js` | `espacios-map-shell` | Front of `/map`. Forwards to service binding `MAP`, then sets `x-espacios-map-shell: v1`. |
| `espacios-public-shell/worker.js` | `espacios-public-shell` | Front of `/`. Fetches service binding `MARKETING` and sets `x-espacios-public-shell: 2026-09-23-v1`. |
| `espacios-data-hub/index.js` | `espacios-data-hub` | `/data`. Release `espacios-data-hub-v6-developer-registry`. |

`espacios-auth-central`, which renders `/spaces`, was read and is not in this commit. The bundle contains a bypass-password constructor. It stays only on Cloudflare.
