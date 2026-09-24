# Espacios / UAE Real-Estate Intelligence — Full-Stack Handoff

Last checked: 24 September 2026  
Canonical surface: <https://espacios.me/map>  
Local file: `ESPACIOS_FULLSTACK_HANDOFF_PROJECT_LEVEL_INTELLIGENCE_2026-09-24.md`  
Companion document: `ESPACIOS_FULLSTACK_HANDOFF_PROJECT_LEVEL_INTELLIGENCE_2026-09-24.docx`

Project-level historical pricing, scenario modelling, source governance, map integration, and deployment boundaries.

This document is the implementation handoff for taking Espacios from area-level historical evidence plus project-level scenarios to a rigorously sourced project-level intelligence system. It distinguishes what is live, what exists only in the workbook, what is derived, what is missing, and what must never be presented as observed fact.

## Contents

1. Executive state and non-negotiable boundaries
2. Production architecture and control plane
3. Current data estate and source hierarchy
4. Project-level workbook model and formulas
5. Required project-level source contract
6. Ingestion, reconciliation, and QA pipeline
7. Backend API and storage design
8. Frontend timeline and project-profile integration
9. Forecasting and scenario rules
10. What is missing and acquisition priority
11. Release, testing, rollback, and observability
12. Engineering work plan and acceptance gates
- Appendix A. Exact source register
- Appendix B. Current live endpoints and artifacts

## 1. Executive state and non-negotiable boundaries

Live production today. The public map is still on Cloudflare Worker version 145, UUID `bb5456b0-d558-4dba-9856-a80e19f4b5a2`, deployment `01fa63ce-ab72-4592-99aa-b211ec857dc9`, at 100% traffic. That live release publishes descriptive Dubai registered-sale history and the draggable timeline. The later Excel enrichment and project-level scenario model have not been deployed.

| Item | Current value |
|---|---|
| Canonical surface | `espacios.me/map` |
| Production Worker | `psr-portfolio-map-v2` |
| Live version | 145 / 100% traffic |
| Version UUID | `bb5456b0-d558-4dba-9856-a80e19f4b5a2` |
| Deployment UUID | `01fa63ce-ab72-4592-99aa-b211ec857dc9` |
| Workbook model | 1,382 projects |
| Mapped Dubai history | 704 projects |
| Scenario-ready | 528 projects |
| Approved project forecast | 0 |
| Current state | Scenarios only; not deployed |

The biggest missing capability is actual project-specific transaction history. The workbook can produce project-level scenarios for 528 projects that have both a current recorded ask and a mapped Dubai market history. The historical project price is still a backcast from the project's current asking price using area movement. It is not an observed historical sale of that project. The future numbers are scenarios, not approved forecasts.

- Observed historical data stays observed. Do not relabel area medians, asking benchmarks, policy targets, or scenario outputs as exact project transactions.
- Project-level current asks are separate from closed sales. A project asking price is a catalogue/offer reference, not a registered transaction or verified availability.
- The workbook historical project-equivalent price is modelled. It is a backcast from current project ask using the matched market-area price ratio. It is not an observed old project sale or old project ask.
- The workbook future prices are scenarios. They are explicit downside/base/upside paths. They are not approved forecasts, AVMs, certified valuations, or probabilities.
- Missing evidence remains missing. No Dubai series may be borrowed into Abu Dhabi, Sharjah, RAK, Ajman, UAQ, or Fujairah merely to fill cells.
- Source identity and use rights travel with the datapoint. Every published observation must retain publisher, URL, effective period, checked date, rights status, transformation, and evidence grade.
- If the exact project, building, or unit source cannot be proven, do not fabricate precision. Publish the best supported level (project, building, source area, community, emirate) and label that level explicitly.

## 2. Production architecture and control plane

Canonical architecture:

```text
Browser / MapLibre
  -> psr-portfolio-map-v2
     -> embedded HTML/CSS/JS
     -> R2 snapshots + historical partitions
     -> D1 market / forecast-readiness records
     -> PSR_PROPERTY service for project enrichment
     -> Workers AI for map-context answers
```

| Layer | Current component | Role | Handoff rule |
|---|---|---|---|
| Edge runtime | Cloudflare Worker: `psr-portfolio-map-v2` | Routes, APIs, embedded UI, source guards | Inspect active version before every release. Never assume this handoff version is still current. |
| Object storage | R2: `psr-market-intelligence` | Raw archives, snapshots, derived partitions, release evidence | Raw objects are immutable evidence. Publish new versioned prefixes rather than overwrite history. |
| Structured store | D1: `a5165cff-70a5-4685-af87-5ffdcf08652a` | Market observations / legacy forecast readiness | Do not rewrite unrelated shared records. New project observations need explicit schema and versioning. |
| Project service | `PSR_PROPERTY` service binding | Project catalogue enrichment | Dependency is not product ownership. Espacios remains the canonical surface. |
| AI | Workers AI binding | Contextual answers | Server should build trusted context from entity IDs and sources. Browser-supplied prose is not sufficient provenance. |

Production bindings: `AI`, `DB`, `MARKET_R2`, `PSR_PROPERTY`. Runtime compatibility date `2026-08-20` with `nodejs_compat`. Preserve all bindings during every candidate release.

## 3. Current data estate and source hierarchy

| Holding | Current quantity | Coverage | Status | Critical caveat |
|---|---|---|---|---|
| Project catalogue | 1,382 projects | Seven emirates | Live reference | Project records are not individual homes. 1,063 usable asks in latest inventory. |
| Dubai transaction source | 1,364,226 transaction rows | Dubai | Acquired / derived history live | Independent DLD-derived snapshot. Not a direct government export or full upstream certification. |
| Eligible residential analytical rows | 704,429 | Dubai | Live descriptive history | Apartment + villa + source-classified townhouse basket only. |
| Dubai historical periods | 92 monthly / 30 quarterly | Jan 2019–Aug 2026 / Q1 2019–Q2 2026 | Live | Changing-sample medians, not same-property appreciation. |
| Dubai historical source areas | 124 default residential | 116 accepted boundary matches | Live | Not every area has every period. n<20 is withheld from price shading. |
| Bayut benchmark table | 41 H1 2026 rows | 34 Dubai/Abu Dhabi localities | Live reference | Advertised asking-price / projected gross-yield context. Not project valuation. |
| Dubai rental charts | 180 monthly rent + 180 activity rows | Citywide publisher-defined | Collected only | No raw Ejari microdata. Not community/project rent per sqft. |
| Ajman histories | 7 source datasets / 6 published | Ajman | Live history | Strong for activity/registry. Not immediately project-level AED/sqft or yield. |
| ADREC indicators | 6 attributed indicators | Abu Dhabi emirate/type | Live reference | High-level report indicators, not property-level microdata. |

### 3.1 Source hierarchy for perfect sourcing

1. **Tier 1 — Authority / registry.** DLD / Dubai Pulse, ADREC, Ajman open data, other emirate registries. Prefer direct official raw records when access and reuse terms allow the intended use.
2. **Tier 2 — Project owner / developer.** Official developer/project pages, RERA/authority records, operator announcements, audited or dated owner publications. Use for launch price, payment plan, handover, phase and sell-out evidence.
3. **Tier 3 — Authorized commercial provider.** Property Finder, Bayut, DXB Interact, or other portals only through provider-approved access / reuse. Preserve provider methodology and do not duplicate-count DLD-origin events.
4. **Tier 4 — Independent licensed mirror / research publisher.** Current Dubai transaction history is from Dubai Real Estate Data's DLD-derived dataset. Publisher declares CC BY 4.0. Keep that attribution and never call it a direct DLD export.
5. **Tier 5 — Espacios-owned observation.** Internal captured asks, project catalogue snapshots, review decisions, mapping corrections, and derived metrics with immutable input references.
6. **Tier 6 — Derived analytics.** Medians, indices, model inputs, scenario outputs and forecasts. Every derived value must reference the exact source vintage and transformation method.

## 4. Project-level workbook model and formulas

Current workbook artifact: `ESPACIOS_PROJECT_LEVEL_PRICE_MODEL_2026-09-24.xlsx`. It is an analytical handoff, not a live API or deployed map layer. Preserve all 17 existing tabs. The project model is additive.

| Metric / field | Current coverage | Computation | Publication label |
|---|---|---|---|
| Current project ask | 1,063 projects with usable ask in inventory | Recorded catalogue amount | Recorded asking price; not closed-sale price |
| Mapped Dubai history | 704 projects | Conservative project/community to Dubai source-area crosswalk | Market-area history supporting context |
| Scenario-ready projects | 528 projects | Requires current ask + mapped Dubai history | Project-level scenario eligible |
| Historical project-equivalent price | Only where ask + matched history exist | current ask × first area PSF ÷ latest area PSF | Modelled backcast; never "historical project sale" |
| Historical area CAGR | Mapped Dubai projects | (latest area PSF / first area PSF)^(1/years) − 1 | Historical market-area trend |
| 2027–2030 downside/base/upside | 528 projects | Current ask compounded with scenario rates | Scenario, not approved forecast |

The workbook currently has 0 verified project-specific numeric AED/sqft. The existing 912 project PSF fields are reference text, not verified subject-project PSF.

### 4.1 Current workbook scenario contract

```text
base_rate = clamp(area_CAGR × 0.50, −3%, +8%)
downside_rate = max(−10%, base_rate − 4 percentage points)
upside_rate = min(+15%, base_rate + 4 percentage points)
project_price(year+n) = current_project_ask × (1 + scenario_rate)^n
historical_project_equivalent = current_project_ask × first_area_PSF / latest_area_PSF
```

These constants are editable scenario design settings, not learned model parameters. They must not be published as a forecast methodology until the project-level model passes time-ordered validation against later observations and a baseline.

Do not deploy the current Excel scenario outputs as predicted prices.

### 4.2 Evidence tiers

- **Tier A.** Current project ask + mapped Dubai market history. Eligible for current workbook backcast and scenario paths.
- **Tier B.** Mapped Dubai market history but no current project ask. History context exists. Project-price scenario remains blank.
- **Tier C.** Current project ask only. No defensible historical project mapping. Future scenario remains blank.
- **Tier D.** No project price anchor and no mapped Dubai history. Keep all project-price cells blank.

## 5. Required project-level source contract

Goal: replace area-level backcasts with actual project/building/unit evidence while preserving every source and transformation.

| Entity / record | Required fields | Acceptance requirement |
|---|---|---|
| Source document | `source_id`, publisher, authority, URL, licence URL, publication/effective date, `checked_at`, rights status, content hash | No publication unless reuse rights and intended use are recorded. |
| Project identity | `project_id`, authority/RERA ID, legal/project name, aliases, developer vehicle, parent developer, emirate, source area, community | Do not merge by similar name alone. Preserve raw source labels and match decision. |
| Unit / property identity | Stable unit/property ID where available, building/tower, floor, bedrooms, area basis, ownership share | Required for same-property repeat sales and exact project history. |
| Sale event | Transaction ID, registration type, transaction date, amount, matching area, property type/subtype, project/building label | Transaction amount and denominator must refer to the same registered subject. |
| Ask observation | Stable offer ID, first/last seen, effective date, asking amount, incentives, payment terms, availability | A changed unit, area, bedrooms, incentives, or payment timing is a changed offer until identity is resolved. |
| Rent contract | Contract ID, new/renewal, start/end dates, annual amount, property/unit count, compatible area, project identity | Needed before rent/sqft or observed yield can be published. |
| Operating cost | Service charge, OPEX, vacancy/collection loss, finance assumptions, acquisition/exit costs, dated basis | Required for net yield, cash flow and IRR. Assumptions must not masquerade as observed costs. |
| Delivery event | Original promised date, revised dates, construction progress, completion/operating date, delivered units | Needed for actual completion flow and developer on-time performance. |

Every new project match must carry source IDs and match basis. Ambiguous remains ambiguous. Do not rewrite the Dubai historical source-area series into project history. Do not invent project-level rents, yields, service charges, available units, or delivery outcomes.

## 6. Ingestion, reconciliation, and QA pipeline

1. **Acquire.** Use official/authorized source where possible. Save raw bytes and source metadata before transformation.
2. **Archive immutable raw.** R2 path by source + acquisition date + dataset version. Record SHA-256/size and licence/rights note.
3. **Normalize.** Standardize dates, amounts, units, property types, registration type, source area names, project/building names. Preserve raw values in parallel.
4. **Entity resolution.** Resolve project, developer, building, and unit identities using authority IDs first, exact aliases second, explicit manual review third. No fuzzy auto-merge for publication.
5. **Crosswalk geography.** Map registrar/source area to map polygon with match type and confidence. Do not treat a community centroid or strategy marker as a cadastral site.
6. **Quality gates.** Unique IDs, amount/area arithmetic, positive values, date completeness, property-type consistency, duplicate lineage, sample thresholds, missing-value semantics.
7. **Derived metrics.** Compute pooled medians/distributions from raw eligible records. Do not average medians when raw records exist.
8. **Publication candidate.** Create versioned partitions + manifest + source cutoffs + counts + hashes + exclusions + rights summary.
9. **Candidate QA.** Run backend contract tests, browser interaction tests, source inspector checks, no-data states, exports, mobile layout, stale-response protection.
10. **Promote + smoke.** Deploy 0% candidate, verify, promote to 100%, rerun public smoke, write rollback record. Never delete raw evidence during rollback.

The most important next engineering move is project-name/building matching against the 1,364,226 Dubai transaction records. Once that crosswalk is reliable, stop backcasting from area prices and start building real historical curves for individual projects.

## 7. Backend API and storage design

Live historical APIs already in production:

- `/map/api/dubai-history-catalogue`
- `/map/api/dubai-history?frequency=monthly&segment=all&registration=All`
- `/map/api/history-catalogue`
- `/map/api/research`
- `/map/api/forecast-readiness`

### 7.1 Proposed additive project-level endpoints — not live yet

| Endpoint | Purpose | Rules |
|---|---|---|
| `GET /map/api/project-intelligence-catalogue` | Versions, metric IDs, source cutoffs, rights, project coverage, supported periods | No values. Manifest only. |
| `GET /map/api/project-history?project_id=…` | Observed project/building sale, ask, rent, supply and delivery history | Observed-only endpoint. No modelled backcast mixed in. |
| `GET /map/api/project-scenario?project_id=…` | Explicit downside/base/upside scenarios | Return assumptions and issue date. Label scenario, not forecast. |
| `GET /map/api/project-forecast?project_id=…` | Future model estimate after validation | Return null until the model is commercially approved for that metric/project/horizon. |
| `GET /map/api/source/:source_id` | Source card with URL, rights, checked date, hashes and transformations | Must be linkable from every displayed metric. |

### 7.2 Storage layout

```text
research/acquisition/YYYY-MM-DD/<source>/<dataset-version>/raw.*
research/normalized/YYYY-MM-DD/<dataset-version>/...
research/crosswalks/YYYY-MM-DD/project-entity-crosswalk.json
research/derived/YYYY-MM-DD/project-history-vN/...
research/published/YYYY-MM-DD/project-intelligence-vN/...
releases/YYYY-MM-DD/project-intelligence-vN/...
```

Existing relevant R2 roots:

- `research/acquisition/2026-09-23/historical-pull-v2/`
- `research/derived/2026-09-23/dubai-price-history-v1/`
- `research/published/2026-09-23/dubai-derived-history-v1/`
- `releases/2026-09-23/dubai-history-research-v1/`

## 8. Frontend timeline and project-profile integration

Target structure for each project:

```text
2019 -> 2020 -> ... -> 2026 actual transactions / asks / rents
  -> Today
  -> 2027 scenario or approved forecast
  -> 2028
  -> 2029
  -> 2030
```

Under every date, publish a metric only when that metric has actual support: sale AED/sqft, asking AED/sqft, average sale price, transaction count, transaction value, rent AED/sqft, gross yield, net yield, available units, absorption, days to sell, price cuts, service charges, and construction/delivery status. Missing periods remain blank.

- **Project profile header.** Show project name, developer, project status, evidence date, project ask, and evidence tier.
- **Metric selector.** Sale AED/sqft, asking AED/sqft, rent AED/sqft/year, gross yield, net yield, sales count, transaction value, available units, absorption, days to sell, service charges, delivery status.
- **Timeline.** Dates only where the selected metric has actual support. Missing periods remain blank. Separate HISTORY / FORECAST / SCENARIO / DELIVERY.
- **Observed history.** Use project/building history when source identity supports it. Fall back to area context only with an explicit "market-area reference" label.
- **Scenario path.** Dashed/secondary treatment with assumption panel. Never visually merge it into observed history.
- **Forecast path.** Only after approval. Show issue date, training cutoff, horizon, empirical error band, and model version.
- **Evidence inspector.** Every point opens source, period, sample, entity-match basis, transformation, rights/use status, and raw-vs-derived classification.
- **Map gradient.** Only color project geometry/point using a project-specific metric when verified. Area values stay on area polygons/surfaces.

Selected project, date, and metric must map to the same evidence in the UI, the API, and the export.

## 9. Forecasting and scenario rules

- Forecasts must be trained only on information available before the forecast origin. Retrospective full-vintage filters cannot be treated as point-in-time inputs without redesign.
- Use rolling-origin / horizon-specific validation. Evaluate the same horizon that will be displayed to users.
- Every complex model must beat a simple baseline (no-change / seasonal-naive / damped drift as appropriate).
- Separate price, rent, supply, liquidity and delivery models. Do not use transaction-value growth as a property price forecast.
- Project model should condition on property type, bedroom / size bands, lifecycle, project/building identity, location, and material quality attributes when available.
- Catalyst/infrastructure effects require defensible treatment/control design. Never add a fixed metro/airport/museum uplift because an initiative exists.
- Published output must expose model version, training cutoff, source vintage, horizon, sample support, interval/error definition, and approval status.
- Until those gates pass, future numeric project values remain SCENARIOS, not PREDICTIONS or VALUATIONS.

## 10. What is missing and acquisition priority

| Priority | Missing capability | Why it matters | Required evidence |
|---|---|---|---|
| P0 | Verified project-specific AED/sqft | Replaces area-level backcast with actual project evidence | Project/building transaction match + compatible area denominator + project identity. |
| P0 | Same-property repeat-sales identity | Allows true same-asset appreciation | Stable unit/property ID, repeated eligible sales, ownership-share/material-change review. |
| P0 | Raw Ejari / project rents | Enables project-level rent PSF and observed yield | Authorized rental microdata with project/unit identity and compatible area. |
| P0 | Authorized PF/Bayut/DXB feeds | Adds listing/resale liquidity and corroboration | Provider-approved access, terms, stable listing identity, dated observations. |
| P1 | Same-offer price revision ledger | Measures launch-to-current ask and price cuts | Stable offer ID, revisions, incentives, availability, terms. |
| P1 | Unit inventory / absorption | Measures competing supply and sell-through | Units launched, available, reserved/sold, completions, cancellations, dates. |
| P1 | Service charges / OPEX | Converts gross yield into net yield | Dated charges, denominator, vacancy/collection loss, operating costs. |
| P1 | Developer delivery history | Measures delivery performance | Original promise, revised dates, actual completion, units, project cohort. |
| P1 | Non-Dubai project history | Creates UAE-wide project coverage | Equivalent local sales/rent evidence for Abu Dhabi, Sharjah, RAK, Ajman, UAQ, Fujairah. |
| P2 | Constant-quality index / hedonic controls | Separates market movement from changing mix | Stable attributes, fixed-mix or hedonic/repeat-sales methodology. |
| P2 | Causal catalyst effect research | Makes infrastructure impact defensible | Verified geometry, treatment/control cohorts, transaction history, competing supply controls. |

### 10.1 Gap detail the next engineer must not collapse

1. **Actual project-level historical transactions.** Each DLD transaction must be reliably matched to the exact project/building, with transaction date, price, registered area, property type, bedrooms and project identity. Verified project-specific numeric AED/sqft is currently 0.
2. **Same-property / same-unit repeat sales.** Transaction IDs exist. Stable property identities linking repeated sales do not. The system cannot yet say "Unit X sold for a recorded amount in year A and a recorded amount in year B."
3. **Historical project asking-price revisions.** Current project asks and an archived baseline exist. A launch, revision, sold-out, and resale price ledger does not. The 1,063 current asks are not 1,063 historical price series.
4. **Project-level rental history.** The 180-month Dubai rental history is aggregate. It is not raw project-level Ejari. Project rent AED/sqft requires contract-level annual rent, new versus renewal, unit size, and date.
5. **Real project yields.** Historical gross and net yields need matched rents, sale prices, service charges, vacancy, operating expenses and recurring costs. Current holdings are projected gross-yield references for selected areas.
6. **Unit supply and absorption per project.** Required: units launched, units sold, available units, resale listings, cancellations and actual take-up through time. Project count is not available inventory. Transaction count is not net absorption.
7. **Liquidity measures.** Missing project-level days-to-sell, days-to-let, listing age, price reductions, asking-to-sale discount and resale velocity. These require a stable listing/event ledger.
8. **Developer delivery history.** Original promised completion versus actual completion, construction-progress observations and delivered units. Lifetime deliveries and on-time-delivery rate fields are currently unpopulated.
9. **A proper project forecasting model.** The 2027–2030 downside/base/upside values are transparent scenarios. Predictions require chronological training, out-of-sample testing, project attributes, local history, forecast-error statistics and uncertainty ranges. No calibrated project/community price forecast is approved.
10. **Financial history outside Dubai.** Dubai is the strongest pricing dataset. Ajman has useful activity/registry history. Abu Dhabi, Sharjah, RAK, UAQ and Fujairah still lack comparable project-level historical price/rent coverage. Do not fill those cells from Dubai.
11. **Better project attributes for quality adjustment.** Consistent unit size, bedrooms, floor, view, furnishing, waterfront/golf exposure, building age, branded status, unit type and construction stage. Without these, a changing unit mix can be misread as price growth.
12. **Infrastructure impact evidence.** The catalyst register and future milestones exist. Defensible causal price-uplift percentages for "near metro", "near airport", or "near Wynn" do not. Those require geographic exposure plus treatment/control transaction analysis.
13. **Authorized portal feeds.** Property Finder, Bayut and DXB Interact remain references/corroboration. They are not connected bulk feeds. Every external provider acquisition must document access and rights before commercial publication.

## 11. Release, testing, rollback, and observability

1. Before any deployment, re-read the currently active Worker deployment and bindings. Do not deploy from a stale handoff assumption.
2. Create a new versioned R2 publication prefix. Never overwrite raw acquisition files or the existing Dubai historical partitions.
3. Stage a candidate at 0% traffic. Verify exact asset version / response headers so tests cannot accidentally hit production.
4. Backend contract tests: parameter validation, source preservation, rights/approval flags, missing partitions, project identity, no cross-emirate fallback, and cache versioning.
5. Frontend tests: direct drag, period switching, source inspector, project detail, no-data states, historical vs scenario styling, mobile, theme, export, stale-request cancellation, fixed camera.
6. Public smoke after promotion: live HTML asset, project endpoint, source endpoint, timeline state, sample project arithmetic, map counts, no console/runtime errors.
7. Observability: deployment ID, source manifest hash, data version, project coverage count, rejected/missing matches, API latency/error rate, stale source count, model approval count.
8. Rollback code by assigning traffic to a known-good Worker version. Rollback data by manifest/prefix selection. Code rollback does not automatically restore mutable R2/D1 data.

## 12. Engineering work plan and acceptance gates

| Phase | Engineering work | Definition of done | May be called live when |
|---|---|---|---|
| 1. Source foundation | Acquire/authorize project/building sales, raw rents, listing histories. Create source registry and rights ledger. | Raw archives hashed. Dataset-specific rights reviewed. Source IDs immutable. | No source is represented beyond its actual authority, period, scope, or reuse rights. |
| 2. Identity crosswalk | Project/building/unit entity resolution across catalogue, transaction, rent and listing sources. | Authority IDs where available. Aliases reviewed. Unmatched/ambiguous explicit. | A project timeline never inherits another project's records through fuzzy matching. |
| 3. Observed project history | Publish exact project-level sales/asks/rents/supply where identity supports it. | Observed-only API + evidence inspector. No modelled values mixed into history. | Historical project curves are backed by exact source records or clearly labelled project-group aggregates. |
| 4. Model research | Build and validate price/rent/supply/liquidity models. | Rolling-origin tests, baseline comparison, horizon errors, model versioning, approval matrix. | Only eligible project/metric/horizon combinations return non-null forecast. |
| 5. Frontend integration | Add project-level timeline, source cards, observed/scenario/forecast separation. | Desktop/mobile QA. Exports retain source IDs and dates. | Selected project/date/metric maps to the same evidence in UI, API and export. |
| 6. Production release | 0% candidate, then acceptance, then 100%, then smoke + handoff. | Version manifest, rollback pointer, source cutoff, QA report and hashes recorded. | Current deployment and published data manifest are reproducible from the handoff. |

### Handoff checklist for the next engineer

- [ ] Confirm Cloudflare active Worker version before touching source.
- [ ] Open the latest workbook and preserve all 17 existing tabs. Project model is additive.
- [ ] Do not deploy the current Excel scenario outputs as predicted prices.
- [ ] Do not rewrite the Dubai historical source-area series into project history.
- [ ] Do not invent project-level rents, yields, service charges, available units, or delivery outcomes.
- [ ] Every new project match must carry source IDs and match basis. Ambiguous remains ambiguous.
- [ ] Every external provider acquisition must document access/rights before commercial publication.
- [ ] Every deployment must create a release manifest tying code version to data version and QA results.

## Appendix A. Exact source register

| ID | Source / file | What it supports | Important boundary |
|---|---|---|---|
| S1 | `ESPACIOS_PROJECT_LEVEL_PRICE_MODEL_2026-09-24.xlsx` | Current project inventory, project-level evidence tiers, scenario inputs, 2027–2030 scenario paths | Workbook only. 528 scenario-ready projects. No approved forecast. |
| S2 | `ESPACIOS_DUBAI_HISTORY_DEPLOYMENT_2026-09-23.md` | Live version 145 historical release behavior, APIs, tests, rollback context | Historical release. Not the later workbook enrichment. |
| S3 | `ESPACIOS_HISTORICAL_RESEARCH_2026-09-23.md` | Source decisions, classification QA, 704,429 residential analytical rows, geography rules | Independent DLD-derived source. Not a direct government export. |
| S4 | `ESPACIOS_HISTORICAL_DATA_PULL_RECEIPT_2026-09-23.md` | Raw acquisition counts, hashes, storage prefixes | Publication/use rights remain dataset-specific. |
| S5 | `ESPACIOS_DATA_ENRICHMENT_PLAN_2026-09-23.md` | Metric catalogue, identity/price-history rules, acquisition plan | Planning document. Not proof that every metric is populated. |
| S6 | `ESPACIOS_MAP_MASTER_BRIEF_2026-09-22.md` | Full-stack architecture, bindings, route inventory, product ownership, QA cautions | Older deployment numbers are superseded by current Cloudflare state. |
| S7 | `ESPACIOS_FORECAST_RELEASE_2026-09-22.md` | Forecast readiness gates, evidence workspace, model validation boundaries | No project price/rent forecast published. Version 145 supersedes its deployment state. |
| S8 | Dubai Real Estate Data — DLD-derived sales dataset | 1,364,226 sale rows and descriptive price history | Independent publisher. Publisher declares CC BY 4.0. Not a direct DLD export or certified valuation. |
| S9 | Bayut H1 2026 Dubai / Abu Dhabi sales reports | 41 stored asking-PSF / gross-yield reference rows | Advertised/area-type reference. Not project-level closed-sale valuation. |
| S10 | Ajman Open Data datasets | Official registry/activity histories | Grouped/snapshot data. Do not infer missing values as zero or convert activity into PSF without a denominator. |
| S11 | ADREC H1 2026 report | Abu Dhabi report indicators and supply outlook | Emirate/type context only. Not microdata or a project forecast. |

Primary source names retained in the evidence layer. Exact URLs, licence text, content hashes, and checked dates must travel with each published datapoint. Do not replace a named source below with a guessed URL.

- DLD open data
- Dubai Real Estate Data sales dataset
- Dubai Real Estate Data methodology
- Dubai rental charts
- Bayut Dubai H1 2026
- Bayut Abu Dhabi H1 2026
- ADREC H1 2026 report
- Forecast validation reference

## Appendix B. Current live endpoints and artifacts

- <https://espacios.me/map>
- <https://espacios.me/map/api/research>
- <https://espacios.me/map/api/dubai-history-catalogue>
- <https://espacios.me/map/api/dubai-history?frequency=monthly&segment=all&registration=All>
- <https://espacios.me/map/api/history-catalogue>
- <https://espacios.me/map/api/history>
- <https://espacios.me/map/api/price-events>
- <https://espacios.me/map/api/forecast-readiness>
- <https://espacios.me/map/api/intelligence>
- <https://espacios.me/map/api/forecast-evidence>

Current production deployment checked 24 Sep 2026: Worker `psr-portfolio-map-v2`, version 145 / `bb5456b0-d558-4dba-9856-a80e19f4b5a2`, deployment `01fa63ce-ab72-4592-99aa-b211ec857dc9`, 100% traffic.

Current workbook handoff file: `ESPACIOS_PROJECT_LEVEL_PRICE_MODEL_2026-09-24.xlsx`. This workbook is not yet deployed into production APIs or the map UI.

Final implementation rule: if the exact project/building/unit source cannot be proven, do not fabricate precision. Publish the best supported level (project, building, source area, community, emirate) and label that level explicitly.
