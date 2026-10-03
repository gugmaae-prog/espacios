# Government projects, Palm Jebel Ali and property outlook

Research cutoff and catalogue retrieval: 3 October 2026. Owner: Espacios.

Palm Jebel Ali has a credible long-term appreciation thesis. The size and timing of any appreciation are unproven. Waterfront positioning, delivered amenities and southern Dubai employment/access can support demand; phased supply, entry valuation, delayed occupation, costs and resale liquidity can offset it. Missing local forecasts do not imply low potential.

The government-linked island delivery packages have different horizons: the June 2025 road/utility awards target Q4 2026, while the April 2026 award for 544 villas across Fronds A–F targets Q4 2028. These are package targets, not universal island handover dates. Existing catalogue phase dates are preserved rather than overwritten.

The airport’s older ten-year first-phase horizon is superseded by the June 2026 update targeting 2032 and September 2026 CEO commentary describing the early 2030s. The second runway targets end 2027. DEC Phase 1 completion is reported in April 2026; the remaining expansion has later stages. These southern Dubai programmes are regional demand hypotheses for Palm Jebel Ali, not evidence of measured local uplift. The eastern Dubai Metro Blue Line is not a confirmed Palm Jebel Ali connection.

Sources are registered with publisher, publication date, retrieval date, URL and evidence class in `data/value-drivers-20261003.json`. The register retains older publications to document changed targets. It contains 13 distinct reviewed catalysts, 22 sources and a seven-emirate coverage matrix. Cross-emirate rail appears under each served emirate; per-emirate counts therefore sum above 13.

| Emirate | Reviewed catalysts | Evidence limitations |
| --- | ---: | --- |
| Dubai | 7 | No validated Palm Jebel Ali price forecast; station/site geometry not acquired |
| Abu Dhabi | 2 | Cultural amenity and rail evidence do not imply local price forecasts |
| Sharjah | 2 | Airport target is last reported July 2025; rail station opening remains scheduled |
| Ajman | 1 | Open road asset; travel-time estimates are not appreciation measurements |
| Ras Al Khaimah | 1 | Wastewater agreement; commissioning/service catchment not verified |
| Umm Al Quwain | 1 | Strategy and guidelines, not a completed construction project |
| Fujairah | 2 | Port concession and rail; local housing-demand spillover is analytical |

This is a reviewed subset. All existing map initiatives, property records, communities, histories and scenarios remain available. Planned opening dates that have passed are not automatically relabelled operational; the rail operator’s June operation is supported separately from its later station schedule.

## Forecast and history boundaries

Knight Frank’s reported 40 Palm Jebel Ali sales above US$10m in H1 2026 support evidence of luxury demand, not repeat-sales appreciation. Its July commentary gives a later market caution. The earlier February calendar-2026 prime/mainstream forecast is displayed with its date and scope, alongside that later caution; it is neither a Palm Jebel Ali estimate nor a ten-year growth rate.

The retained local research series is classified by its source as Off-Plan apartments, with eligible counts of 86, 126 and 1 in 2025Q4, 2026Q1 and 2026Q2 respectively. The last quarter fails the map’s minimum sample of 20, so its price is withheld in the drawer and no local forecast is fabricated. It must not be used as villa evidence. The underlying source is a derived research snapshot, not an independently reconciled government export.

The separate sensitivity calculator starts at index 100 on the research date and uses `100 × (1 + annual input / 100)^years`. Editable −5%, 0% and +5% inputs are illustrative, not fitted forecasts or probability intervals. Five- and ten-year outputs include capital value only; rent, financing, fees, inflation and taxes are excluded. Catalysts never mechanically add a growth percentage or modify the existing price/ROI models.

## Counts and geography

The current core response has 1,645 property records: 1,380 active and 265 archived. There are 215 community records; 195 have a positive source `indexedProjects` field. There are 351 distinct raw area labels and 353 emirate/area pairs. Compound labels and aliases are retained separately; they are not 351 independently identified communities. These are catalogue/project-phase records, not unique homes or future delivered units.

Community indexed counts are source metadata. Exact-area counts are calculated from the current project array using an exact emirate/name pair, so the two measures can differ. Palm Jebel Ali has six indexed records: five current records using its exact area name, plus one archived record under `Dubai, Palm Jebel Ali`. Searchable area counts preserve that distinction.

Every reviewed catalyst has a delivery status, source dates, demand mechanism, risks and relationship to Palm Jebel Ali. No asset coordinates were acquired from surveyed plans. The optional purple markers use an exact named community from the existing core catalogue and are labelled community context, not project sites or distance measures. Unmatched programmes remain in the list without an invented pin. No causal price-uplift percentage or station walk-time is computed.

## Schema and reproducibility

- `sources`: stable source ID, publisher, publication/retrieval dates, URL, classification and citation-use note.
- `drivers`: ownership, emirates, status, package timing, sources, context areas, demand mechanism and risk. `priceUpliftPct` and `geometry` are null by design.
- `palmJebelAli`: qualitative assessment, direct/regional catalyst IDs, reported demand evidence, retained source history and sample gate.
- `publishedOutlooks`: third-party forecasts/commentary with date, geographic scope and limitations.
- `sensitivity`: index baseline, disclosed input examples, formula and unavailable calibration/confidence interval.
- `catalogue`: current area partitions and original community indexed counts, source URL and SHA-256.
- `coverage`: reviewed catalyst counts per emirate; geographic coverage does not establish usable price/rent/yield or forecast coverage.

Capture `GET https://espacios.me/map/map-core.json` into a dated local file, then run `node scripts/build-community-counts.mjs <saved-response>`. The captured response hash is retained. Run `node scripts/build-value-drivers.mjs` to assemble the reviewed sources, catalogue and unchanged Smart Estimates evidence. The Smart Estimates input hash is also retained. `npm run build:smart` bundles the versioned research and browser modules; builds do not fetch live market data.

The new `/map/api/value-drivers` endpoint supports GET, HEAD and ETag conditional requests, rejects writes, accesses no runtime bindings and returns 404 on PSR Homes. D1, R2 and Supabase market records are not copied or altered by this addition. The Data Room remains restricted.

## Verification and release

Run `npm run verify` and the explicit production-config dry run. Existing CI checks the candidate manifest; the production manifest is checked explicitly before release. The previously malformed production JSONC newline escapes are repaired. Frontend cache tokens and preload Link headers use `20261003-value-drivers-v1`; the generated Worker includes the current source modules.

Browser acceptance covers government filtering, correct catalogue area search, editable flat/downside sensitivity, Palm Jebel Ali camera focus and mobile geometry. The drawer has a dedicated class to avoid the legacy floating-panel manager closing it, while the current mobile owner handles mutually exclusive panels. The header’s containing block is removed so the mobile search and category row occupy separate measured positions.

Live release status is recorded separately in the handoff output; a local build or dry run is not a production verification.
