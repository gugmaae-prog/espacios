# Nura catalogue developer correction — 9 October 2026

The Map catalogue previously labelled Nura's developer as `nura`. A reviewed correction now identifies RAK Properties using the retained exact project title/slug and the developer's [8 December 2025 launch announcement](https://www.rakproperties.ae/news/downtown-minas-cityscape-continues-to-evolve-with-the-launch-of-nura-rak-properties-newest-contemporary-luxury-development-on-raha-island/). The source vintage, URL and SHA-256 are pinned to the existing V33 source register, with first verified availability on 8 October 2026. This does not establish historical online availability in 2025.

`data/map-catalogue-revisions.json` retains the old value, corrected value, record identity, reason and source reference. The builder rejects missing or mismatched primary sources and premature availability dates. The runtime applies revisions only to a unique exact ID (or slug when no ID exists), name, emirate and expected old value. Same-name phases, duplicate identities, conflicting upstream values and other tenants are excluded. The returned record carries `catalogueMetadataReviews` with its original value; the archived source is unchanged.

The correction covers Map core, map-data, all-project and batch-project feeds when the exact subject is present. Nura is an archived catalogue entry; a live-only feed need not contain it. New V38 asset URLs refresh Map request cache keys while retaining the existing soft Espacios surfaces and layout.

## Evidence boundary

This is a metadata revision, not a new financial observation or requirement completion. The V34 history root remains `d0fec5b56923a727846875e2daecdc6aa324d20377375319d347951a645668be`. All 1,645 projects, 215 communities, 633,891 history rows, 16,872 series, 3,333 sources and 6,652 historical facts remain. No D1/R2 evidence publication or new archive is necessary. The 42,780-item checklist remains 3,292 present, 3,437 partial, 26,751 missing and 9,300 unestablished; 39,488 (92.30%) are unresolved. Annual 2027–2080 scenarios remain conditional with zero approved forecasts. No geography, coordinates, handover status, prices, rents or occupancy is inferred from the developer correction.

## Validation

Build, syntax checks and the full suite passed before release. Seventeen focused API/correction tests verify original-value preservation, source checksums and availability, duplicates, same-name phases, upstream drift, tenant boundaries, GET/HEAD and conditional ETags. Full-suite final history/API group: 168 passing, zero failures. Styling remains unchanged; this release does not claim a new desktop/mobile visual audit.

## Publication

Candidate prepared under the existing deployment authorization; production identifiers and independent live receipts will be appended after deployment.

## Next actions

Continue exact Gateway and South Bay phase identity research, attributable sale/rent and current-valuation sourcing, occupancy verification, and disclosed annual scenario assumptions through 2080. The research goal remains incomplete.
