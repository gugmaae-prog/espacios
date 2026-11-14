# Reviewed RGEstate area geography, 14 November 2026

## Scope and source

Three exact RGEstate `locationLabel` values now resolve to reviewed OpenStreetMap
area references: International City, Nad Al Sheba, and JVT. Their OSM IDs,
coordinates, and Dubai classification are recorded in
`src/stack-audit/rgestate-commercial.mjs` and linked from
`data/uae-evidence/rgestate/commercial-area-references-20261104.md`.
The 1,660-row publisher index and 996-row commercial snapshot are unchanged;
their existing dated private IDrive E2 replicas remain separate from the area
crosswalk, which is bundled in the Worker. No unit coordinates or current
availability have been inferred. OpenStreetMap attribution remains visible on
the commercial map. Nominatim was used for a one-time small review, not as a
runtime search dependency.

## Verification

- Source commit `e58a685977ebba91067ef2e2c260a9dd5b9099ab`; built Worker
  commit `27cfd24966b452fd31d1ca8daa70651dd6cac8dc` on draft PR #102.
- `npm run verify` exited 0, including the 16,872 native history series
  preservation gate. The focused commercial, publisher-index, coverage, and
  IDrive inventory tests passed again after the source commit was pinned into
  the Worker artifact.
- `scripts/build-rgestate-area-geography.mjs --check` reconciled 922 reviewed
  area rows and 135 unresolved rows from the unchanged publisher index.
  `scripts/build-uae-coverage.mjs --check` retained seven emirates and 40
  published source snapshots. The IDrive inventory verifier retained 40
  source-matched replica attestations.

## Cloudflare release

Worker `psr-portfolio-map-v2` version
`40d8d8ea-e648-4bd0-9855-741812d70d85` was uploaded with the production
configuration, staged at 0% beside prior version
`c8b9a0de-60e2-4ced-bf03-a9cab980e944` at 100%, then promoted to 100%
after canonical version-override checks. The stage returned:

- `/map/api/health?storage=idrive`: the candidate version, `idrive_e2`, and
  `readVerified: true` for one bounded proof object.
- `/map/api/uae-evidence/coverage`: v46, 1,645 accepted V48 projects, 922
  reviewed area listing rows, 135 unresolved.
- `/map/api/uae-evidence/rgestate/index?locationEmirate=Dubai`: 925 rows from
  explicit publisher emirate labels or reviewed Dubai area references.
- `/map/api/uae-evidence/commercial/areas`: 936 area-grouped rows of 996;
  60 without an area point. The International City group returns two
  title-matched commercial candidates.
- `/map` returned 200 and `/map/data-room` returned 404.

Three independent normal-traffic production passes returned the promoted
version, an IDrive proof read, v46 coverage, 936/996 grouped commercial rows,
and 40/40 dated source replica attestations. The accepted V48 baseline stayed
at 1,645 projects, 1,860 records, and 16,872 native series. A further normal
route check returned `/map` 200 and `/map/data-room` 404. `Al Layan` still has
17 searchable publisher rows without a reviewed area match.

The area references are approximate neighbourhood or suburb locations, not
unit pins. The proof object does not establish current health for every IDrive
object, and the source inventory is not a complete UAE property census.
