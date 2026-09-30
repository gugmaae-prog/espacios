# Espacios Map — live architecture

**Verified:** 30 September 2026  
**Canonical URL:** https://espacios.me/map  
**Live system view:** https://espacios.me/map/system  
**Live system JSON:** https://espacios.me/map/api/system

This document describes the **current Cloudflare production topology**. It supersedes older version IDs and direct-route diagrams in earlier handovers. It does not mean every live production patch has already been reconciled back into `src/worker.js`.

## 1. Request path

```text
Browser
  |
  v
Cloudflare route: espacios.me/map*
  |
  v
Worker: espacios-map-shell
  |  - canonical SEO/title/meta
  |  - small /map/api/v1 façade
  |  - MAP service binding
  v
Worker: psr-portfolio-map-v2
  |-- embedded map HTML/CSS/JavaScript
  |-- catalogue / research / history / prediction APIs
  |-- Data Room route and access gate
  |-- D1 binding: DB
  |-- R2 binding: MARKET_R2
  |-- service binding: PSR_PROPERTY -> psr-property production
  `-- Workers AI binding: AI
```

The secondary route `psr.espacios.me/map*` currently points directly to `psr-portfolio-map-v2`. The canonical product remains `espacios.me/map`.

## 2. Production identity

| Layer | Live state |
| --- | --- |
| Route owner | `espacios-map-shell` |
| Shell version | `64c324d5-e107-43e6-b897-90f2f0f6d565` |
| Shell deployment | `79c246e1-6284-409b-8972-3fead00a1223` |
| Map Worker | `psr-portfolio-map-v2` |
| Map version | `7d080ba3-0e36-4d2f-bb8b-134e9c720f83` |
| Map deployment | `09be2751-a039-4b34-9f21-a90d53ab4c77` |
| Release marker | `20260930-system-map-v1` |
| Compatibility date | `2026-08-20` |
| Compatibility flag | `nodejs_compat` |
| Usage model | `standard` |

## 3. Bindings and responsibilities

| Binding | Type | Responsibility |
| --- | --- | --- |
| `AI` | Workers AI | Map AI endpoint |
| `DB` | D1 | Market observations, history/prediction indexes, spatial/identity registry, valuation-related tables |
| `MARKET_R2` | R2 | Current snapshots, research releases, media/cache, geography, historical partitions and model artefacts |
| `PSR_PROPERTY` | Service | Internal project/property feed from `psr-property` production |
| `DATA_ROOM_PUBLIC` | Plain text gate | Controls whether the read-only Data Room can be served |

The route shell has one binding:

| Binding | Type | Target |
| --- | --- | --- |
| `MAP` | Service | `psr-portfolio-map-v2` production |

## 4. Data Room access

The Data Room already exists at:

```text
/map/data-room
```

Current access state:

```text
DATA_ROOM_PUBLIC=false
status: RESTRICTED
```

While restricted, the Worker returns the Data Room as unavailable with:

- no-store caching
- noindex/nofollow
- no public read access

When the binding is explicitly set to `true`, the room is still **read-only** and accepts only GET/HEAD. Its assets are served with restrictive security headers and remain noindex/nofollow.

The map now exposes the access state at:

- `/map/system`
- `/map/api/system`

Opening the Data Room publicly is a separate access decision; do not silently change the binding.

## 5. Public-safe system surfaces

| Surface | Purpose |
| --- | --- |
| `/map/system` | Human-readable topology, source authority and Data Room state |
| `/map/api/system` | Machine-readable topology and access state |
| `/map/map-core.json` | Fast map catalogue |
| `/map/map-data.json` | Deeper catalogue snapshot |
| `/map/api/research` | Research catalogue/context |
| `/map/api/history-catalogue` | Historical library metadata |
| `/map/api/prediction-catalogue` | Experimental prediction catalogue |
| `/map/api/data-coverage` | Data coverage / availability |
| `/map/api/intelligence` | Intelligence sidecar |

Direct D1 SQL, raw R2 access, secrets and private tenant data are **not** exposed by the system page.

## 6. Data plane

### R2 — `psr-market-intelligence`

Important families include:

- `snapshots/current/*`
- `research/published/2026-09-23/dubai-derived-history-v1/*`
- `research/published/2026-09-27/history-predictions-v1/*`
- `research/published/2026-09-27/uae-project-coverage-v3-adrec.json`
- release/rollback artefacts under `releases/*`

### D1 — `DB`

Current map/intelligence table families include:

- `ae_*` spatial/index/identity tables
- `espacios_history_*`
- `espacios_prediction_runs`
- `espacios_authority_project_snapshots`
- `psr_market_data_sources`
- `psr_market_observations`
- valuation/comparable/fact-history tables

The D1 database is shared with other application workloads, so map changes must stay scoped to map/intelligence tables.

### PSR property service

`PSR_PROPERTY` is a service binding, not a public HTTP hop. It supplies current project/property data used in catalogue reconciliation.

## 7. Catalogue populations

Different surfaces intentionally describe different record populations. Do not force them to one number without reconciling record grain.

Recent observed examples:

- map-core records: 1,645
- UAE heatmap/reconciled coverage: 1,690
- live PSR aggregation: 1,093
- communities: 215
- initiatives: 72

Authority/project-phase records and marketing catalogue records are not automatically one unique-development population.

## 8. GitHub source authority

Repository:

```text
gugmaae-prog/espacios
branch: main
visibility: public
```

`wrangler.jsonc` deliberately uses the non-production Worker name:

```text
psr-portfolio-map-v2-navigation-candidate
```

and declares no production route. This is a safety boundary.

Production has received later additive Cloudflare releases after the last full GitHub source sync, including:

- historical/prediction enrichment
- UAE coverage additions
- Data Room
- collapsible workspace/card repairs
- live System/Data Room topology surface

Therefore **do not deploy `main` blindly over production**. First reconcile the live Worker back into editable source/assets, run the embed step and acceptance suite, then publish a candidate version.

## 9. Current map UX ownership

- MapLibre owns the map camera and spatial interaction.
- The DOM shell owns fixed search, rail, panels and cards.
- Main workspace panels launch collapsed/peek so the map remains visible.
- Nested intelligence cards are collapsible and repaired after dynamic rerenders.
- `System` is now exposed from the map and opens the live topology surface.

## 10. Release / rollback discipline

Before any production change:

1. capture the active shell and map deployments;
2. preserve bindings and compatibility settings;
3. back up the current Worker/research artefacts;
4. upload a candidate version;
5. verify desktop/mobile and critical APIs;
6. promote the candidate to 100%;
7. record the final version/deployment in the system snapshot.

A Worker code rollback does not automatically roll back mutable R2/D1 state.
