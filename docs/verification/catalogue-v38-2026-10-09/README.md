# Nura catalogue developer correction — 9 October 2026

The Map catalogue previously labelled Nura's developer as `nura`. A reviewed correction now identifies RAK Properties using the retained exact project title/slug and the developer's [8 December 2025 launch announcement](https://www.rakproperties.ae/news/downtown-minas-cityscape-continues-to-evolve-with-the-launch-of-nura-rak-properties-newest-contemporary-luxury-development-on-raha-island/). The source vintage, URL and SHA-256 are pinned to the existing V33 source register, with first verified availability on 8 October 2026. This does not establish historical online availability in 2025.

`data/map-catalogue-revisions.json` retains the old value, corrected value, record identity, reason and source reference. The builder rejects missing or mismatched primary sources and premature availability dates. The runtime applies revisions only to a unique exact ID (or slug when no ID exists), name, emirate and expected old value. Same-name phases, duplicate identities, conflicting upstream values and other tenants are excluded. The returned record carries `catalogueMetadataReviews` with its original value; the archived source is unchanged.

The correction covers Map core, map-data, all-project and batch-project feeds when the exact subject is present. Nura is an archived catalogue entry; a live-only feed need not contain it. New V38 asset URLs refresh Map request cache keys while retaining the existing soft Espacios surfaces and layout.

## Evidence boundary

This is a metadata revision, not a new financial observation or requirement completion. The V34 history root remains `d0fec5b56923a727846875e2daecdc6aa324d20377375319d347951a645668be`. All 1,645 projects, 215 communities, 633,891 history rows, 16,872 series, 3,333 sources and 6,652 historical facts remain. No D1/R2 evidence publication or new archive is necessary. The 42,780-item checklist remains 3,292 present, 3,437 partial, 26,751 missing and 9,300 unestablished; 39,488 (92.30%) are unresolved. Annual 2027–2080 scenarios remain conditional with zero approved forecasts. No geography, coordinates, handover status, prices, rents or occupancy is inferred from the developer correction.

## Validation

Build, syntax checks and the full suite passed before release. Seventeen focused API/correction tests verify original-value preservation, source checksums and availability, duplicates, same-name phases, upstream drift, tenant boundaries, GET/HEAD and conditional ETags. Full-suite final history/API group: 168 passing, zero failures. Styling remains unchanged. An independent desktop browser refresh verified the soft Map selection and the Nura search result showing RAK Properties; screenshots are retained as [Map](live-map.png) and [search](live-nura-search.png). Mobile layouts were not re-audited in this metadata-only release.

## Publication

V38 is live at 100% on `psr-portfolio-map-v2`, Worker version `13672ae7-9267-4b55-b1e1-0d2bbce1a20b`, deployment `ca2fd72f-12c1-4d88-91f0-1508ddf1fb5d`, activated 8 October 2026 at 21:09 UTC (9 October in Dubai). Frontend `20261009-map-catalogue-v38` serves V34 history. The existing canonical route `espacios.me/map* -> espacios-map-shell -> MAP -> psr-portfolio-map-v2` was independently read from Cloudflare; no routing changes were made.

Live Map core and map-data show Nura as RAK Properties. All other 1,644 project records and 215 communities were compared with the pre-release core and are unchanged. The live-only all-project feed contains 1,098 records and the sampled batch 24; neither includes this archived Nura entry, so no completeness claim is made from them. All four feeds returned HTTP 200. HTML and linked V38 JS/CSS returned 200; the restricted Data Room returned 404. See [catalogue preservation](live-catalogue-verification.json), [HTTP checks](http-verification.json), and [deployment](deployment.json).

Preview and canonical history APIs matched every one of 1,860 research ledgers, all 13 V34 changed record payloads, 3,333 sources, 105 events, 7,382 exposures and the 2080 endpoint. The version-preview Map HTML returns 404 because the retained shell only allows its configured public hostnames; canonical HTML, assets and browser rendering were verified after activation. See [preview API checks](preview-history-verification.json) and [canonical API checks](live-history-verification.json).

Supabase readback agrees with V38, the Worker version, deployment and retained V34 root. See [control plane](control-plane-verification.json). Source commit `d506828afff88dcc33d0799f46f149d5d9006123` is pushed to open [PR #98](https://github.com/gugmaae-prog/espacios/pull/98); [clean GitHub CI](https://github.com/gugmaae-prog/espacios/actions/runs/37844496536) and guardrails passed. This publication does not imply PR merge.

## Next actions

Continue exact Gateway and South Bay phase identity research, attributable sale/rent and current-valuation sourcing, occupancy verification, and disclosed annual scenario assumptions through 2080. The research goal remains incomplete.
