# Map palette V29 — production receipt, 8 October 2026

## Release identity

- Palette refinement: [PR #95](https://github.com/gugmaae-prog/espacios/pull/95), merged as `cb3d4b86e060b808ef4612e5d36bb2e1730d4260`
- Cache-token update: [PR #96](https://github.com/gugmaae-prog/espacios/pull/96), merged as `af72eff4696cb6435ec0f0734fb3ff80754e0c72`
- Frontend asset token: `20261008-map-palette-v29`
- Cloudflare Worker: `psr-portfolio-map-v2`
- Worker version: `c992c2c4-d155-4dc2-bc20-28ffd1013c7f`
- Deployment: `f4e36b9a-02ab-4515-980a-7d349bd7f034`, serving **100% traffic**
- Supabase release-registry row: `ed1db734-47bf-4ded-bd9a-ebd55c13ede4`, reconciled
- Data Room: `DATA_ROOM_PUBLIC=false`

## Change

The mobile Map-mode selection used a separate, high-contrast pill against a translucent mode-control surface. V29 gives the selected mode the same theme-aware panel mix as its container and uses a soft slate border and label weight to indicate selection. The mode remains keyboard and touch operable. Gold was inherited styling from the older premium shell; it did not represent price, appreciation or a forecast.

The Worker upload retained the existing AI, D1, R2, service and plain-text control bindings. V29 changes only the visual treatment and frontend asset token. It adds no price, rent, lifecycle, event or forecast evidence and does not change the V25 historical snapshot.

## Verification

- `npm run verify` passed all **166 tests** on the merged V29 source.
- The production-config Wrangler dry run passed with the existing bindings.
- Live `https://espacios.me/map` returned HTTP 200 with V29 HTML, JavaScript and CSS asset URLs.
- At mobile viewport **390 × 844**, live browser checks confirmed the active mode has the same computed background as the control group in both themes, a soft border, no shadow and zero horizontal overflow.
- Cloudflare reports Worker version `c992c2c4-d155-4dc2-bc20-28ffd1013c7f` at 100% traffic in deployment `f4e36b9a-02ab-4515-980a-7d349bd7f034`.
- The live system API and Supabase release registry report V29 with matching Worker version and deployment IDs. The V25 history snapshot, 1,645 projects, 215 communities and restricted Data Room remain intact.

## Evidence coverage remains incomplete

The preserved checklist still has **39,632 of 42,780 requirements unresolved (92.64%)**; this is not a percentage of missing prices. The V25 release has 563,675 published historical rows, 15,063 series, 3,254 sources, 105 events and 7,382 event exposures. No approved annual forecasts exist through 2080. Continue sourcing and keep missing, disputed and unavailable periods explicit.
