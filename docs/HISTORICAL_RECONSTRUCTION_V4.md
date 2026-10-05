# Historical reconstruction and event context v4

As of 2026-10-05, the map catalogue contains **1,645 project records and 215 community records (1,860 total)**. This release defines 100% **record accountability**, not a false claim that every record has a complete observed sale/rent history.

## Evidence hierarchy

For each project/community and each metric, use the highest available tier and expose the tier in the UI/API:

1. **Tier 1 — verified subject observations:** exact registered sales/rents or authority-linked subject series.
2. **Tier 2 — dated subject facts:** launch/asking values, official register facts and handover/fee evidence.
3. **Tier 3 — verified master-community context:** official community/master-project cohorts.
4. **Tier 4 — area/property-type context:** cadastral/area cohorts matched to the record geography and property segment.
5. **Tier 5 — emirate/UAE context:** emirate benchmarks, financing conditions, population, supply and macro conditions.
6. **Tier 6 — lifecycle/event-only context:** where no numeric cohort exists, show dated lifecycle/news context with numeric values unavailable.

Never relabel tiers 2–6 as an observed project sale or rent.

## Historical values

- Preserve every native observed point and its source/sample/quality metadata.
- Do not fill a missing AED or AED/sqft observation with a guessed absolute number.
- A normalized contextual index may be shown for comparison only when its source cohort is explicit. It must be labelled **modeled/context index**, not valuation.
- Interpolation/extrapolation must be optional, separately classified, and carry widening uncertainty.
- Projects cannot have a genuine subject price history before they existed. Earlier area/emirate evidence remains context only.

## Event and news model

Events are dated features and explanatory context, never automatic +/-% adjustments. Event windows may be compared descriptively only when compatible evidence exists before and after the event. The existing event-model validation did not establish that a news-event model beats simpler trend baselines, so no event coefficient is forced into forecasts.

v4 adds/clarifies:
- 2006 Dubai foreign-ownership areas (including Palm Jebel Ali)
- 2009 Dubai World liquidity shock
- 2013 Expo host award and 2015 BIE registration
- 2019 Golden Residency operational milestone
- 2021 Dubai 2040 Urban Master Plan
- 2023 D33 and UAE Corporate Tax
- 2024 Wynn Al Marjan gaming-licence milestone
- 2025 Disney Yas announcement and Dubai population milestone
- 2026 Iranian missile attacks and latest CBUAE rate-cycle context

Existing event families remain: GFC/property correction, oil cycle, COVID restrictions/reopening, remote-work policy, Ukraine invasion, Russian mobilisation/capital inflows, FATF changes, extreme rainfall, Etihad Rail, airports, metro, museums, Expo delivery, Palm Jebel Ali delivery and other infrastructure.

## Financing context

CBUAE states that EIBOR is a reference rate used for UAE loans including mortgages and publishes historical files from **October 2009** onward. `cbuae-eibor-source-manifest.json` enumerates the official native files through 2026 and records the 2026-10-05 current fixing. These files must be checksum-captured and parsed before continuous EIBOR numbers enter an immutable evidence snapshot.

## Palm Jebel Ali

Palm Jebel Ali should show:
- 2006 foreign-ownership eligibility as a structural investability milestone.
- retained official area-level history (including pre-2010 evidence where available) as **area context**.
- 2023 relaunch/master-plan milestones.
- roads/utilities, villa awards, frond releases and phased handover milestones.
- DWC/Expo/Dubai 2040/D33 as regional/structural context.
- current luxury-demand evidence and construction progress as separate sourced facts.
- no single unsupported "Palm Jebel Ali appreciation %" applied to every villa/plot.

## Present state

Present asking prices remain asking quotes unless verified as a dated market valuation. Community yield benchmarks are gross benchmarks unless expenses/service charges/occupancy are measured. The UI must preserve the distinction.

## Forecasts through 2080

- Short horizon: backtested statistical forecasts only where enough native evidence exists.
- Medium horizon: conditional scenarios tied to explicit supply/demand/rate/catalyst assumptions.
- 2027–2080: annual **downside / base / upside scenarios**, not validated predictions.
- Every scenario point must expose inputs, horizon, uncertainty and whether it is unavailable.
- Unsupported numeric points stay null; a requested horizon is not evidence.

## Coverage objective

100% means every one of the 1,860 records has:
- identity/reconciliation status,
- lifecycle status,
- current evidence status,
- historical evidence tier,
- relevant dated events/catalysts,
- missing-evidence flags,
- and 2027–2080 scenario slots.

It does **not** mean 100% of historical prices were observed. That distinction is required for an auditable map.
