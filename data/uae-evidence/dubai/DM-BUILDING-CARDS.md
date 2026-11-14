# Dubai Municipality building cards (26 October 2026 export)

This is the complete 38-column CSV export downloaded from the [Data.Dubai Buildings Summary Information dataset](https://data.dubai/en/l/459523) on 11 November 2026. Dubai Municipality is the issuing entity. The original 211,412,452-byte CSV has SHA-256 `69a7d6a7b86c76afa45cd88d084e904941a50112d30595090b10ec696be10798` and remains outside Git. The 96 compressed shards in `dm-building-cards-20261026/` preserve all 536,946 rows and all source field values; `dm-building-cards-validation.json` records independent exact-field readback.

The source is a **permit-system building-card snapshot**. A `building_id` is not an available unit or a verified standing building. The file includes new, permit-delivered, expired and cancelled statuses. Completion date is missing in 343,489 rows. No point coordinates, asking terms, registered sales or rents are included. The map must not place a card at an inferred parcel or community centre as if it were a surveyed building coordinate.

The dataset page displays Data.Dubai's Open Data License, while its metadata says “License Not Specified.” [Dubai Municipality's open-data page](https://www.dm.gov.ae/open-data2/) permits use with source attribution. The displayed license allows commercial work products, excludes images, personal/private entity data and third-party rights, requires attribution, and prohibits resale of original information. This publication contains tabular source values only, with attribution and a source link. Check the current terms before a future refresh.

Rebuild from the pinned official download:

```sh
python3 scripts/build-dm-building-cards.py --source /path/to/building_summary_information_2026-10-26_15-45-26_0001.csv
python3 scripts/verify-dm-building-cards.py --source /path/to/building_summary_information_2026-10-26_15-45-26_0001.csv
python3 scripts/build-recovery-assets.py
```

The read-only API is `/map/api/uae-evidence/dubai/building-cards`. `?view=summary` returns source/coverage metadata; `?limit=100&cursor=...` pages every row; appending an exact `building_id` retrieves one card. Each response labels the evidence class and storage. The immutable Worker asset copy is the current serving source. An IDrive replica is not claimed until separately uploaded and checksum-read back.
