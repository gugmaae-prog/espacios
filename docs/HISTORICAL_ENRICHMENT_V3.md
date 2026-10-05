# Additive history enrichment and item coverage

The `20261005-enrichment-v3` candidate retains all 1,645 project and 215 community IDs. It expands verified official register cohorts and reviewed primary project/community facts. This is a draft review candidate. It has not been merged, deployed or published to remote storage.

## Evidence and coverage

Every record now has 23 separate coverage items. Launch, construction, phase progress, target schedules, actual delivery, occupancy, observed sales, signed rents, advertisements, valuations, fees, shared context, event context and scenarios have separate statuses. `present` establishes supporting evidence for that item; it does not establish an uninterrupted lifetime history. `partial`, `missing` and `unestablished` remain visible, with source IDs and reasons. Original audit gaps remain in `originalAuditGaps`.

Earlier native financial evidence can precede a public launch or confirmed occupancy report. Such evidence remains retained, and the start of applicability stays unresolved. Planned occupancy and retrospective completion announcements qualified `by_date` do not establish a first-ever occupancy date. Incomplete native periods, small samples, uncertain identity and inaccessible sources remain explicit. Sparse observations are retained independently of display/modelling sample gates.

Construction and delivery reports establish lifecycle history, not a property price. Original dated launch advertisements remain historical observations; retrieving an old advertisement today cannot replace the selected present asking quote. Current advertisements remain distinct from a dated market valuation. Source-native Land, Building, Unit and Villa cohorts stay separate. An exact marketed/native project identity is required before subject ownership is approved; a shared master-project or cadastral label remains contextual evidence.

Fee components retain native budget years, usage and denominators. Unknown Parking bases and negative Adjustment credits are retained. Components are not automatically summed into whole-property annual costs or net returns.

## Sources and revisions

The merged packet and compressed derived CSV inputs are committed. Private individual registers and captured article bodies remain outside the repository. Public source facts preserve occurrence/announcement/effective dates, publication dates, first known availability, retrieval timestamps and native date precision. Syndicated or reused sources remain attributed.

An updated capture of an existing canonical URL is an explicit source revision rather than an overwrite. `preserveRevision` and `revisionOfSourceId` retain the predecessor, while `canonicalSourceId` groups versions. Contradictory versions cannot silently replace prior source metadata. Existing source collection and research passes remain preserved.

Point-in-time financial validation independently checks the financial observation source and every identity proof source. A backtest cannot use a financial page merely because its identity proof was available earlier. Microsecond capture timestamps retain their original precision while comparisons use parsed dates. Latest-vintage official historical registers remain unavailable at earlier forecast origins.

## Local event context

Reviewed primary infrastructure, amenity and policy milestones can create sourced event entries. Named community relationships preserve the exact source evidence. Inherited project links require exact catalogue community/emirate membership and remain unverified for historical project existence and exact access. Planned commissioning and revised schedules remain planned until actual operation is verified. No event or news item receives an automatic appreciation coefficient.

Before/after studies retain the default 12-month windows and report associations with incomplete windows and concurrent-event limitations. Controlled attribution requires appropriate comparison groups, pre-trends and property-mix adjustment. All records retain conditional annual slots from 2027 through 2080; missing numerical inputs remain null. User assumptions produce labelled scenarios, not validated forecasts.

## Read-only interfaces and map

`/map/api/record-history?recordId=…` returns the selected record's item ledger with its financial/lifecycle/context history. Inventory requests omit the large item dictionary by default and include `itemCoverageAvailable`; `?includeItemCoverage=1` returns it for the whole inventory. Existing history, events, event-studies and value-driver contracts remain compatible.

The history drawer exposes a collapsed “Evidence and remaining gaps” section, with each item's status, reason and linked sources. Native financial timelines, event overlays and conditional scenarios retain their existing controls. Desktop and mobile acceptance explicitly checks all 23 items, source links and the exact 2080 endpoint.

## Reproduction and preservation

```sh
npm run history:build
npm run verify
node scripts/verify-local-history-storage.mjs
node scripts/export-historical-coverage.mjs --output /absolute/path/record-coverage.csv --items-output /absolute/path/item-coverage.csv
```

These operations build/read the committed candidate and use local emulated storage. No remote publication follows from a successful build or test.

For a baseline audit, run `scripts/check-historical-preservation.py` with `--before` pointing to an immutable earlier snapshot and `--before-publication` to its manifest. It checks exact catalogue identities, all earlier source field values, retained lifecycle/register/financial facts and quotes, native numeric tuples, approved series owners/proofs, record-series links, events/exposures and immutable object hashes. Newly added evidence cannot erase the earlier snapshot.

The collection's period envelope is not any subject's lifetime. Native aggregate totals overlap frequencies, cohorts and underlying transactions. Shared record links also repeat canonical context; do not add them to count unique observations. Precise missing lifetime percentages remain unknown until inception, applicability and identities are established. Future observed prices through 2080 do not exist to scrape.
