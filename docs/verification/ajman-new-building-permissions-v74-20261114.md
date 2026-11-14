# Ajman new-building permission measures — 14 November 2026

Two separate [Ajman Municipality & Planning Department datasets](https://data.ajman.ae/explore/) are now preserved as source-labelled backend evidence. Both publisher metadata records state CC BY 4.0. Independent full export reads matched exactly, and the committed gzip snapshots, metadata and validation reports pin the bytes and row grain.

| Source | Rows | Usable rows | Latest period | API |
| --- | ---: | ---: | --- | --- |
| [Number of licences](https://data.ajman.ae/explore/dataset/licenses-issued-for-new-buildings-by-number-of-licenses/) | 268 | 248 | September 2025 | `/map/api/uae-evidence/ajman/new-building-licences` |
| [Reported built-up area](https://data.ajman.ae/explore/dataset/new-licenses-issued-by-built-up-area/) | 198 | 198 | March 2023 | `/map/api/uae-evidence/ajman/new-building-built-up-area` |

Both sources use calendar month and residential/non-residential building use. The licence export has ten 2023 month/use groups with two different values each; all 20 conflicting source rows are withheld from usable counts. The built-up-area export has no duplicate dimension groups. The publisher does not specify its area unit, so the API returns `unit: null` and does not label the values as square metres. A 24-row year is complete only across the two reported use dimensions, not proof that every permission issued by the authority is represented.

These measures are **not** the existing number-of-buildings series. A licence may cover a different number of buildings. Non-residential includes uses beyond commercial; neither dataset establishes completed structures, live commercial spaces, available units, registered sales or rent, project identities, or coordinates. The API serves checksum-verified Worker snapshots and labels private IDrive E2 copies as dated replicas.

The [two-object copy plan](../../data/uae-evidence/idrive-e2-ajman-permissions-replica-plan-20261114.json) and [signed readback attestation](../../data/uae-evidence/idrive-e2-ajman-permissions-replica-readback-20261114.json) cover 5,358 stored bytes in `espacios-store-a`. Both conditional uploads passed immediate readback and a separate signed GET with matching type, length and SHA-256. The accepted V48 archive remains a separate IDrive-primary collection. Four dated replica sets now contain 200 objects and 108,329,560 stored bytes for all 40 published evidence projections; this does not prove current whole-store health or full UAE data coverage. R2 remains disabled and Data Room restricted.
