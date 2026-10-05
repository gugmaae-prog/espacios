# Historical snapshot production release

The default publisher remains restricted to isolated candidate resources. A production release requires `--production`, explicit user authorization, and an exact account, Worker, R2 bucket, D1 database, snapshot version and archival-root checksum in the supplied target manifest. The production map configuration retains the restricted Data Room and the separately managed map-shell routes.

Publication creates content-addressed R2 objects conditionally and verifies their SHA-256 values before indexing. Existing evidence is reused, never overwritten. D1 indexes are version scoped and append only. All expected table counts and the immutable root must match before publication changes from staged to complete. A failure can leave verified orphan objects or staged rows; it does not change a latest pointer or activate the map release.

For the initial production release, first verify that no `hi_*` tables exist, then apply only the additive `0001_historical_intelligence.sql` schema. The candidate legacy-rebuild migration must not run against production. Existing property tables remain independent.

The production adapter uses a temporary authenticated release Worker, with no custom routes, an expiring token, the two historical-storage bindings, and a narrow statement allowlist. Its token and authorization header file live outside the repository with mode 0600. It can create verified content-addressed objects and index only its authorized snapshot. Delete the bridge after successful publication; retain the immutable archive and indexes.

## Runtime retrieval

The full archived snapshot remains the authority. The embedded runtime inventory is smaller, and record evidence and large native histories are split into content-addressed objects. A default history request retrieves a bounded page while retaining every series descriptor, evidence ledger item and relevant source. `seriesCursor` and `nextPointCursor` identify additional stored data. Selecting a cohort fetches its exact `seriesId` and follows native point cursors until that selected cohort is fully retrieved. Page counts describe retrieval, separately from evidence coverage. Missing history is never represented as an observed value.

## Release verification

Run the build, syntax checks and complete existing test suite, including production publication guards. Upload a Worker version before changing traffic. Verify its real Cloudflare preview against the published archive, especially large community pages, selected native cohorts, the evidence ledger, source classifications and conditional annual 2027–2080 slots. Promote that exact version only after those checks pass. Independently verify the canonical map, desktop/mobile layouts, legacy API fingerprints, unchanged shell routing and restricted Data Room. Retain the prior version for rollback and record the version, deployment, Git revision and all verification receipts.
