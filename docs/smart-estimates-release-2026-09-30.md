# Smart Estimates — verified release

Released 30 September 2026 at 08:38:47 UTC to `https://espacios.me/map`.

- Pull request: https://github.com/gugmaae-prog/espacios/pull/16 (merged).
- Application source commit: `3d111b90451145e2cd7eb0704fd47f4ce7bc2b3a`.
- Generated source Worker SHA-256 before Wrangler bundling: `d35b3672a7d24b12a02dc5b22bd16860ddd3300d1de0c43f74173cb36de25863`.
- Worker: `psr-portfolio-map-v2`, version `df27a1de-e51f-4477-9fec-78e1b871229c` at 100%.
- Deployment: `04060558-04ed-4c9e-9e7e-0dcce12219a3`.
- Rollback code version: `7d080ba3-0e36-4d2f-bb8b-134e9c720f83`.
- Unchanged shell: `espacios-map-shell`, version `64c324d5-e107-43e6-b897-90f2f0f6d565`.

## Verification

`npm run verify` passed the smoke/API checks and all 42 core/integration tests.
GitHub CI `verify` and `public-repo-safety` passed before merge. The CodeRabbit
automated review was skipped by its OSS configuration; a separate agent performed
a read-only release/security review and found no P1/P2 issues. `npm audit` reported
zero vulnerabilities, including development dependencies.

Production-config dry run and deploy retained AI, DB, MARKET_R2, PSR_PROPERTY and
`DATA_ROOM_PUBLIC=false`. Read-back confirmed compatibility date/flags, usage
model, bindings, subdomain settings and the unchanged shell deployment.

Independent canonical checks confirmed the new release marker and exact public
snapshot SHA `f77472b65fad63bb6dd59323ed93823fb623a193d58c8cd014c2e3f868a3c4b4`.
The source register exposes metadata only. The Data Room still returns 404 with
`no-store` and `noindex`.

The before/after receipts under `data/release-verification-20260930-*.json` have
identical retained-field fingerprints and counts across all seven checked
endpoints: research, market segments, prediction catalogue, history library,
heatmap, system access/topology and restricted Data Room. They retain 1,691
research project records, 215 communities, 228 benchmark rows, 4,882 history
series and 2,223 saved model runs. The heatmap's distinct population remains
1,690 projects, with 1,519 geocoded. Catalogue/history checks verify metadata and
the first requested page, not every underlying partition. Existing objects and
observations were not mutated.

Chrome acceptance covered desktop and 390×844 layouts, light/dark themes,
no horizontal overflow, 1/10-year switching, ten-year price and net-return
results, separate and combined Yas Island apartment/villa calculations, all 30
captured Palm Jumeirah quarters, scenario-map toggling and close/focus restoration.
Live checks reconfirmed Palm Jumeirah targets through 2036 and a loaded official
logo. No captured JavaScript errors occurred during these checks. No fresh Core
Web Vitals claim is made.

## Scope and remaining evidence gates

153 scenario sets produce 4,590 conditional annual outcomes. Those are scenarios,
not validated forecasts, probabilities, certified valuations or recommendations.
ROI is nominal all-cash net holding-period return with explicit editable costs,
vacancy and rental assumptions. Future infrastructure uplift is not imposed.

New ADREC/RAK historical candidates remain in a metadata review queue pending
reuse rights, definition/revision review and duplicate-conflict resolution. They
are not published as approved numerical observations or used in training. No
Supabase migration, credential expansion, tenant transfer or public Data Room
access change was required.

The original Documents checkout remains untouched. A durable clean checkout was
created at `/Users/keifferjapeth/Developer/espacios-map` to avoid cloud-offloaded
working files. GitHub is the recovery source for this released map code.
