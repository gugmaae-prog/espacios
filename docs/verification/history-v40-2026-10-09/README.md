# V40 primary project evidence integration

Status: integrated locally; production is still V43 / V39 until release verification succeeds.

The [reviewed source packet](../primary-project-pass40-2026-10-09/README.md) adds three bedroom-specific Binghatti Wraith advertised quotes and four Helvetia Marine development reports. No DLD candidate, unit sale, rent, valuation or forecast coefficient is accepted by this pass. Earlier source vintages, lifecycle schedules, headline snapshots and all 633,891 native rows in 16,872 series remain unchanged. All 1,645 projects and 215 communities are preserved.

The immutable V40 root is `498a797f39e12ce9d702ec6ed364f1f874c730e376cb98f2fdd096e75cc1cae9`. Canonical SHA256: `5d6c571612601f728bad900f5659a9b6c0581bef93943e620164eb927f98ef22`. All 2,542 archive objects including the D1 index verify. The candidate frontend is `20261009-map-evidence-v44`.

Candidate checklist counts: 3,304 present, 3,438 partial, 26,738 missing and 9,300 unestablished. There are 39,476 unresolved requirements out of 42,780 (92.28%). This is a checklist rate, not a percentage of missing lifetime prices. Three requirements close; exact first launch, actual construction-start day and full historical financial observations remain unresolved.

## Verification

Seven focused JavaScript tests and five source-packet Python tests pass. They compare all records and native series to the pinned V39 archive, preserve source availability dates, reject future inputs, and keep asking quotes outside project headline prices. Full suite, remote publication, preview/canonical API checks, desktop/mobile evidence cards, source links and deployment metadata are required before reporting this release as live.

## Next work

Resolve the remaining legal-entity and component identities in the 246-project DLD review, especially the ten no-sale projects with candidate rows. Continue direct sales, signed rents, occupancy and dated valuation sourcing. Specify all annual conditional assumptions through 2080 and evaluate short horizons without claiming long-horizon predictive certainty. Unresolved requirements keep the wider goal incomplete.

## Release recovery, 12 October

Production was rechecked and still serves V43 / V39. The first V40 publication stopped on a transport error before any D1 snapshot header was created. Its verified immutable R2 objects remain available for reuse; no production activation occurred. The first uploaded preview is superseded and must not be activated.

The V40 startup index exceeded the existing 9 MiB guard by 2,173 bytes. The runtime builder now replaces only the detailed collection audit metadata with a checksum and JSON pointer into the unchanged canonical archive. It preserves all records, source vintages, observations, series, events and exposures. Runtime JSON falls from 9,439,357 to 9,177,691 bytes; a regression check resolves and compares the archived collection metadata. The size guard remains unchanged.

Repeated macOS iCloud hydration failures affected repository metadata, test fixtures and dependencies. Release verification is being moved to a fresh checkout outside iCloud at the same Git base, with an explicit list of pending files and checksum verification. No incomplete or failed test run is treated as a passing release gate.
