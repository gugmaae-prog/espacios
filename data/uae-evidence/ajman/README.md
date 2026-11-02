# Ajman official quarterly unit-sales aggregates

Source: [Real Estate Units Sales, Ajman Open Data](https://data.ajman.ae/explore/dataset/real-estate-units-sales/), published by the Department of Land and Real Estate Regulation. The source metadata reports a [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) licence and a last modification time of 2026-08-21T04:37:58.396000+00:00. This package attributes the source and retains its export, metadata and exact checksums.

The export contains 6,075 quarterly aggregate rows for 2019 Q1 through 2026 Q2. It reports 15,991 unit sales and AED 6,218,360,220.16 in total value across those rows, grouped under 239 distinct source project labels. These are aggregates at source project label, sector, district, unit type, rooms and quarter grain. They are **not** individual transaction records, 239 verified map projects, complete Ajman project coverage or a coordinate source.

`validation.json` records the source URL, licence, hashes, row count and limitations. `scripts/build-ajman-open-data.mjs --check` verifies the package against the full official export. The immutable compressed object is served through a separate, private IDrive E2 prefix and a strict one-key allowlist. `/map/api/uae-evidence` reports the source and limits; `/map/api/uae-evidence/ajman/projects` exposes source labels without canonical joins; `/map/api/uae-evidence/ajman/sales` pages the native aggregates.

No name-only links to accepted V48 identities or map coordinates have been made. The existing 1,645-project map and 1,860-record V48 history remain separate from this Ajman source. A broader UAE catalogue and the missing original history and model bundles still require exact, licensed source recovery.
