# Fujairah monthly permits, 14 November 2026

The Fujairah Statistics Centre Construction and Building chapters for 2023,
2024 and 2025 contain monthly issued-permit counts for Fujairah and Dibba
municipalities. The three official PDFs were retrieved again and matched the
SHA-256 values pinned in the existing annual-permit validation. Their source
URLs and checksums are in
`data/uae-evidence/fujairah/building-permits-monthly-validation.json`.

Espacios publishes 72 municipality-month rows from those chapters, selecting
only total permits and combined new/renew permits. It does not republish the
other source-table columns or the PDFs. Every selected column sums to the
previously verified annual municipality series, and the two municipality
totals sum to each annual emirate total. The API is
`/map/api/uae-evidence/fujairah/building-permits-monthly`; it supports year,
municipality and month filters. These are authorizations, not completed
buildings, available spaces, sales, rents, or monthly commercial-use counts.

The 1,172-byte versioned gzip snapshot was uploaded to the private
`espacios-store-a` IDrive E2 bucket under `espacios-map/uae-evidence/`.
Conditional upload and immediate readback succeeded, followed by a separate
signed GET with matching length and SHA-256. The public, credential-free
readback attestation is
`data/uae-evidence/idrive-e2-fujairah-monthly-readback-20261114.json`.
The API serves a checksum-verified Worker snapshot and identifies IDrive as
a dated private replica, not as its runtime primary. The UAE inventory now
has 41 published source snapshots and 41 verified replicas.

`npm run verify` passed, including the 16,872-series V48 history preservation
gate. Source commit `4366bb284073f174e78016c97f7e310b60c7b7f7` produced
the provenance-pinned Worker in commit
`9d22bc0ba207b0698ff8d35c2a5fea804e3f8297` on draft PR #102.
Worker version `4769b547-bb8a-43cd-881c-78710f8cf5d6` was staged at 0%,
verified through the canonical version override, then promoted to 100%.
Three consecutive normal-traffic passes returned the promoted version,
the July 2025 Fujairah and Dibba counts (226 and 59 total permits), the
41/41 replica inventory, a direct IDrive archive proof read, `/map` and
`/map/commercial` at 200, and `/map/data-room` at 404. The accepted V48
baseline remains 1,645 projects, 1,860 records and 16,872 native series.

Cloudflare R2 stays disabled. The source inventory is not a complete UAE
property census; missing project coordinates, original official-history
bundles, some registered transaction feeds and current unit availability
remain explicitly unresolved.
