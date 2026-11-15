# Dubai Municipality project applications and building links

The 26 October 2026 [Projects Information](https://data.dubai/en/l/467616) and [Projects Buildings Information](https://data.dubai/en/l/467604) exports were downloaded on 14 November 2026. Dubai Municipality is the publisher. The source CSVs remain outside Git. Their byte sizes and SHA-256 checksums are pinned in the manifest, and the independent verifier reconstructs every public field from the originals.

The public projection contains 481,358 unique municipal project numbers and 208,946 project-to-building rows. All referenced building IDs occur in the separately published [building-card snapshot](./DM-BUILDING-CARDS.md). Two building IDs, 87836 and 144968, have conflicting project-number relations; the API flags these and does not collapse them. Nine applicant, consultant, contractor, licence and related-entity fields are withheld from the public projection.

These are municipal permit/application records, not confirmed DLD real-estate development identities or accepted V48 map records. Administrative Open/Closed status and entered completion dates do not prove physical completion. Building cost is a publisher construction-cost field, not a sale price. There are no verified coordinates, available units, sales or rents in these two exports.

The dataset pages display a Data.Dubai Open Data License and [Dubai Municipality's open-data page](https://www.dm.gov.ae/open-data2/) requires attribution. This projection includes tabular public fields and source attribution, and excludes the source's personal or private-entity values. Check current terms before refreshing the export.

The read-only endpoint is /map/api/uae-evidence/dubai/municipal-projects. Its summary gives source and scope labels; cursor pages return project rows; an exact municipal project number returns its record and paged building links. Each of the 49 gzip shards is checked against compressed and decoded checksums on read. Immutable Worker assets are the serving copy. No IDrive replica is claimed until independently uploaded and checksum-read back.

Rebuild from the pinned official CSVs:

~~~sh
python3 scripts/build-dm-municipal-projects.py --projects /path/to/project_information.csv --links /path/to/project_building_information.csv
python3 scripts/verify-dm-municipal-projects.py --projects /path/to/project_information.csv --links /path/to/project_building_information.csv
python3 scripts/build-recovery-assets.py
~~~
