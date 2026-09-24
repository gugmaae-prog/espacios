# Initiative enrichment — 2026-09-22

## Blocker (read first)
This executor subagent **could not route Shell/Read to Keiffer’s laptop** (`machineId b3750ded-c58d-4e6c-97ca-5e4fca899b49`). Calls always executed on the box VM (`grok-bot-vm-*`). Primary path  
`/Users/keifferjapeth/Documents/Codex/2026-09-19/.../outputs/espacios-map-navigable-v2`  
and Downloads handover `.docx` files were **unreachable**.

Work was done on a **box-local mirror** rebuilt from live https://espacios.me/map assets + live `map-data.json` (72 initiatives):

`/workspace/espacios-map-navigable-v2/`

Parent should copy these edits onto the laptop source tree (or re-run with machine-routed Shell) before any Versions upload.

## Must-fix (stale vs official)
1. **Dubai Metro Gold Line** — summary no longer says 34.2 km. Now official RTA **42 km / 18 stations**, tender 2026, award 2027, open **9 Sep 2032**. Source: RTA 22 Apr 2026.
2. **Harry Potter themed land** — timing was “Opening date not announced”. Now **construction completion target 2029**; **~63,000 m²**; three lands (Diagon Alley, Hogwarts, Forbidden Forest) at Warner Bros. World AD. Source: Miral / Abu Dhabi Media Office 7 Sep 2026. Status → Under construction.
3. **Dubai Exhibition Centre expansion** — notes **Phase 1 completed/operating 2025–2026**; Phase 2 **~2028**; final **~2031**. Sources: DWTC / WAM Sep 2026 + DEC media hub.

## Enrichment schema (backward compatible)
Additive fields on priority initiatives:
- `linkedCommunities` / `linkedProjectCounts` — **area-name match only** from map-data (never geo-distance from strategy markers)
- `deliveryCertainty` — `construction` > `procurement` > `announced` > `strategy`
- `accessibilityNote` / `demandNote` / `supplyRiskNote`
- `researchNotes` / `officialSourceUrl`
- `catalystScore`: `{delivery, accessibility, demand, supplyRisk, asOf:'2026-09-22'}`  
  **Scale: 0–100 integers per dimension.** `supplyRisk` higher = *more* risk.

`meta.initiativesEnrichment` documents scale + linking method.

## Priority initiatives enriched: **17**
Blue Line; Al Maktoum terminal; DEC; Gold Line; UAE passenger rail; AD–Dubai HSR; Wynn Al Marjan; Al Marjan pipeline; Sharjah airport; Midline drainage; Hamriyah IWP; Emirates Road Al Badee–UAQ; Sobha Siniya; Guggenheim; Harry Potter; Disney Yas; Sphere AD.

## UI surfaces touched
- `src/assets/app-v2.js` — initiative detail panel: linked project counts, delivery certainty, coordinate-basis warning, catalyst score breakdown, enrichment notes; prefers `officialSourceUrl` for Source link.
- `src/assets/app-v2.css` — light-theme styles for catalyst grid, linked list, coord warning.
- Emerging Hotspots naming: see `docs/INITIATIVES_VS_HOTSPOTS.md` (no duplicate overlay).

## Files changed (box mirror)
- `data/map-data.json` — enriched
- `data/map-core.json` — initiative fields synced
- `data/initiatives-enriched-2026-09-22.json` — review export
- `src/assets/app-v2.js` / `app-v2.css`
- `scripts/enrich_initiatives_2026_09_22.py`
- `docs/INITIATIVES_VS_HOTSPOTS.md`
- `INITIATIVE_ENRICHMENT_2026-09-22.md` (this file)
- `docs/VERSIONS_UPLOAD_DRYRUN.md`

## Deploy readiness
**NOT deployed. NOT promoted.** Dry-run commands only — see `docs/VERSIONS_UPLOAD_DRYRUN.md`.

Requires laptop copy + Worker asset embed (`psr-portfolio-map-v2`) that serves `/map/map-data.json` from R2/snapshot or embedded assets. Confirm how production loads map-data before uploading.
