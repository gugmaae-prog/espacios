# V24 Map palette production receipt — 8 October 2026 (Dubai)

## Release identity

- Pull request: [#80](https://github.com/gugmaae-prog/espacios/pull/80), mobile palette refinement
- Cache-coherence pull request: [#81](https://github.com/gugmaae-prog/espacios/pull/81), merged
- PR #81 source commit: `41f7cdd352b528e30014f4ba1a8f66871571ad1d`; merge commit: `5ffb8c973cf8cff14e81201a150c536446dad437`
- Frontend release token: `20261008-map-palette-v24`
- Cloudflare Worker: `psr-portfolio-map-v2`
- Worker version: `489b88f0-aa94-4ed6-8448-5bffa1e599c3`
- Deployment: `405b7e44-a309-47fe-94e9-13494048bfc3`, serving 100% traffic
- Preserved evidence snapshot: `20261008-enrichment-v21`
- Data Room: `DATA_ROOM_PUBLIC=false`

## Change and preservation

Gold was inherited from legacy premium-shell selection and fallback styling. It
was not a property-value signal. PR #80 softened the mobile Map controls in
both the pre-hydration and hydrated states: a theme-aware panel, quiet slate
border and restrained active underline replace the high-contrast navy fill.
PR #81 aligns the HTML, JavaScript and CSS immutable cache keys on V24 so a
normal refresh retrieves the published styles.

This is a presentation-only release. It preserves all 1,860 catalogue records
and the V21 history snapshot. It adds no financial observations, lifecycle
milestones, event evidence or forecasts. The `/map*` route remains on the
existing `espacios-map-shell` to `psr-portfolio-map-v2` service path, and the
Data Room remains restricted.

## Verification

- All 166 repository tests passed; `npm run verify` and `npm run cf:dry-run`
  passed for the production configuration with existing bindings preserved.
- GitHub CI passed for PRs #80 and #81.
- The deployed Worker version is assigned 100% traffic. The canonical
  `https://espacios.me/map` route returned HTTP 200 and serves V24 HTML, CSS
  and JavaScript tokens without stale V23 asset keys.
- `/map/api/system` reports V24 as the expected frontend release and latest
  release, Worker version `489b88f0-aa94-4ed6-8448-5bffa1e599c3`, the V21
  evidence snapshot, all 1,645 projects and 215 communities, and a restricted
  Data Room. The Supabase runtime config and append-only release registry now
  match those production identifiers.
- The in-browser page was refreshed after deployment. Existing route and map
  behavior remain on the same application boundary.

## Evidence coverage remains incomplete

The V21 ledger has 3,099 present, 3,433 partial, 26,948 missing and 9,300
unestablished requirements: 39,681 of 42,780 (92.76%) remain unresolved. This
is a checklist measure, not the percentage of missing prices. V21 retains
548,242 historical aggregate rows, 14,771 series, 3,244 sources, 105 events
and 7,382 event exposures. Complete lifetime sale and rent histories remain
unestablished, and there are zero approved annual forecasts through 2080.

The fresh [Data Dubai project-register download](https://data.dubai/en/l/467654)
did not add lifecycle evidence. It returned 6,078 rows, with each of the 3,039
unique project rows duplicated exactly twice; its June 2026 data vintage
matches the register already captured in V21. It is not counted as additional
coverage. Continue from the open evidence ledger, preserve earlier
observations, verify identities and periods, and leave unavailable financial
observations and unsupported future scenarios unresolved rather than filling
them with proxies.
