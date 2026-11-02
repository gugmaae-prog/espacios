# Ajman official quarterly unit-sales aggregates

Source: [Real Estate Units Sales, Ajman Open Data](https://data.ajman.ae/explore/dataset/real-estate-units-sales/), published by the Department of Land and Real Estate Regulation. The source metadata reports a [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) licence and a last modification time of 2026-08-21T04:37:58.396000+00:00. This package attributes the source and retains its export, metadata and exact checksums.

The export contains 6,075 quarterly aggregate rows for 2019 Q1 through 2026 Q2. It reports 15,991 unit sales and AED 6,218,360,220.16 in total value across those rows, grouped under 239 distinct source project labels. These are aggregates at source project label, sector, district, unit type, rooms and quarter grain. They are **not** individual transaction records, 239 verified map projects, complete Ajman project coverage or a coordinate source.

`validation.json` records the source URL, licence, hashes, row count and limitations. `scripts/build-ajman-open-data.mjs --check` verifies the package against the full official export. The immutable compressed object is served through a separate, private IDrive E2 prefix and a strict one-key allowlist. `/map/api/uae-evidence` reports the source and limits; `/map/api/uae-evidence/ajman/projects` exposes source labels without canonical joins; `/map/api/uae-evidence/ajman/sales` pages the native aggregates.

No name-only links to accepted V48 identities or map coordinates have been made. The existing 1,645-project map and 1,860-record V48 history remain separate from this Ajman source. A broader UAE catalogue and the missing original history and model bundles still require exact, licensed source recovery.

## Official development-project register

The [Real Estate Projects dataset](https://data.ajman.ae/explore/dataset/real-estate-projects/) is a separate CC BY 4.0 source from the same department. Its 3,457 rows represent 16 dated snapshots, covering 364 distinct source project IDs over time. The latest 2026-06-30 snapshot contains 298 IDs; 66 older IDs are absent from that snapshot, so their present status is not asserted. The source has no coordinate fields. Fifty-eight historical unit-count cells are nonnumeric, including three in the latest snapshot; those are returned as unknown. Thirty-five historical rows have an anomalous city field. `projects-validation.json` records these bounds and both raw and compressed checksums.

`/map/api/uae-evidence/ajman/register` searches the latest source snapshot by default and can list the latest known row for all 364 source IDs with `scope=all`. `/map/api/uae-evidence/ajman/register/{sourceProjectId}` returns that ID's dated source history. The public API omits escrow account numbers and does not manufacture V48 identities, current status for absent IDs, or map pins.
