# V23 Map palette production receipt — 8 October 2026 (Dubai)

## Release identity

- Pull request: [#78](https://github.com/gugmaae-prog/espacios/pull/78), merged
- Source commit: `8f21092036037ff5f3964c5717a32ab8775cb60b`
- Merge commit: `3f2f8abe7a523b7c6dfd46406a8cd14adaa143a4`
- Frontend release token: `20261008-map-palette-v23`
- Cloudflare Worker: `psr-portfolio-map-v2`
- Worker version: `410efa3b-a79b-4f32-a505-6dcd86bd298b`
- Deployment: `1c8e24aa-2ae5-49ff-8cee-5364ae4519c1`, serving 100% traffic
- Preserved evidence snapshot: `20261008-enrichment-v21`
- Data Room: `DATA_ROOM_PUBLIC=false`

## Change and preservation

The older premium shell supplied the legacy gold selection/fallback color, while
the mobile mode control retained an opaque navy selected fill. These colors were
presentation choices, not price or appreciation signals. V23 uses the shared
theme-aware panel surface, a muted slate border and a narrow slate underline for
the selected state. Fallback, hotspot and badge treatments remain in the muted
slate/teal palette. Selection remains an orientation cue.

This release changes presentation only. It preserves all 1,860 catalogue
records, the V21 immutable evidence snapshot and its D1/R2 publication. It adds
no transaction, price, rent, lifecycle, event or forecast evidence. The Supabase
runtime config and release registry were reconciled to V23 after deployment;
the registry retains the V21 evidence snapshot's coverage metadata.

## Verification

- All **166 repository tests** passed; `npm run check`, `npm run cf:dry-run`,
  `npm run build:smart` and `git diff --check` passed.
- The production-config dry run listed the existing D1, R2, service and AI
  bindings, with the Data Room closed. The uploaded V23 version's binding
  metadata also matched the expected production bindings and control URL.
- The isolated Workers.dev preview returned 404 because the Map accepts only
  its canonical hostnames. The mobile controls were visually checked in the
  local 390-pixel preview; the canonical live route was then independently
  checked after promotion.
- `https://espacios.me/map` returned HTTP 200 with the V23 token. Its HTML and
  preload links use V23 cache tokens, and the inline Map CSS contains the new
  subdued selected-state rule. The live system API reports 1,645 projects,
  215 communities and a restricted Data Room.
- The live control-plane route reports V23 as both the expected frontend release
  and latest release, the matching Worker version and deployment, and
  `source_sync_state=reconciled`.

## Data coverage remains unchanged

The preserved V21 ledger has 3,099 present, 3,433 partial, 26,948 missing and
9,300 unestablished requirements: **39,681 of 42,780 (92.76%) remain
unresolved**. This is a requirement checklist measure, not a percentage of
missing prices. The snapshot has 548,242 historical rows, 14,771 series, 3,244
sources, 105 events and 7,382 event exposures. Complete lifetime sale/rent
history is not established, and there are zero approved annual forecasts
through 2080. The V23 palette release does not change these figures.
