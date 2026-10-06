# Sourced record histories, events and annual scenarios

This additive release accounts for the existing 1,645 project/phase records and 215 communities. It preserves their identifiers, archived phases and original evidence. An accounted-for record is not a record with a complete historical price series. The API and interface report unresolved identity, date, financial and access gaps separately.

`npm run history:build` rebuilds the reviewed data package from committed, checksummed inputs. `npm run build:smart` assembles the Worker and interface. Builds perform no remote collection or writes. The default release target remains the candidate Worker; production bindings and tenant boundaries remain separately managed.

## Read APIs

- `/map/api/events?recordId=…` returns dated events, source cards and explicit exposure links. Omitting the record returns the inventory and event register.
- `/map/api/record-history?recordId=…` returns lifecycle evidence, retained native observations, coverage and annual scenario availability.
- `/map/api/event-studies?recordId=…&eventId=…&metric=price|rent|volume` returns descriptive pre/post comparisons and window completeness.

All three support GET and HEAD, reject writes, and stay unavailable on PSR Homes. Existing history, value-driver, Data Room and Smart Estimates interfaces remain compatible. Conditional requests use representation-specific ETags. Unknown IDs, invalid assumptions and unsupported metrics fail explicitly.

The record-history endpoint also accepts a JSON `assumptions` query for a separate user calculation. This changes neither stored observations nor evidence coverage. The interface discloses acquisition, rental start/occupancy, annual growth, vacancy, costs and disposal inputs. Values derived from these inputs are marked user assumptions.

## Evidence and date semantics

Development milestones and prices are different observations. A reported handover target is not confirmed completion or occupancy. Registration/marketing can precede construction; land prices are not apartment or villa prices. Each event or milestone retains its date precision and source, including revised targets and supersession.

Occurrence, announcement, effective date, publication, first-known availability and retrieval are separate fields. Unknown first publication is not substituted with a retrieval timestamp. A retrospective source can support a historical event account while being ineligible for a forecasting origin before publication. Month/year availability uses the end of the interval conservatively. “Earliest evidence retained” does not mean “first-ever transaction.”

Financial observations retain currency/unit, segment, registration type, geography, native frequency and evidence class. Raw sparse rows survive sample gating. Area transaction aggregates, asking-price benchmarks, valuations and signed leases remain separate. The 263 project-name candidates from the older independent publisher remain quarantined: that export has no registered project ID or unique property ID. The new primary DLD register supplies independently reviewed official identities for 52 catalogue projects; underlying Land/Building histories remain separate, leaving 51 with subject Unit/Villa price history.

Monthly accountability does not turn quarterly, half-year or annual reports into monthly prices. Native periods are retained separately. Missing, sparse, disputed/conflicting, inaccessible, unknown applicability and pre-applicability periods remain visible. A recorded zero transaction count differs from missing counts. A gap before an unverified launch or occupancy date cannot be certified pre-applicability.

Daily transaction observations stay the requirement grain when the extract is small enough to retain exactly. A daily area series is too heavy at or above 400 daily points, or when the retained snapshot's stated transaction count is larger than the rows kept, so the daily requirement cannot be filled losslessly. In that case the observed rows stay in a daily manifest and the requirement grain becomes an ISO week, labelled `YYYY-Www`, from Monday through Sunday. The week's transaction count is the sum of the daily counts. A weekly price or price per square foot is the source's own weekly figure when it publishes one; otherwise it is the count-weighted mean of the daily medians, and only when every included day has a sample count. Missing weights do not become a price. Rent and yield are stored for a week only when the source states them for that week. A card-level yield is not copied onto every week. The series frequency is `weekly`. A weekly observation can count as present for that week, while the other days inside the week stay not independently observed. Sparse weeks, missing weeks and partial weeks (fewer than seven observed days) stay partial, sparse or missing. A weekly fill does not certify a complete lifetime history, and a community aggregate is not relabelled as a project transaction. `python3 scripts/weekly_requirement_fill.py` writes that packet from the retained transaction-snapshot extracts.

## Storage and publication

Normalized observations and source registers are partitioned into immutable, content-addressed R2 objects. D1 indexes snapshot versions, stable record IDs, evidence, lifecycle, events and event-to-record exposure links separately. Exposures describe the support for local relevance; they are not price-uplift coefficients or surveyed catchments. Publication keeps revised versions rather than modifying earlier history.

`npm run history:publish:plan` prints a dry-run manifest. Actual publication requires an explicit candidate configuration, candidate resource manifest and bound R2/D1 adapter. The publisher refuses the repository's production resources. It verifies checksums and uses conditional R2 writes; existing identical objects are reusable, while mismatched objects fail. D1 inserts are append-only and version scoped. The reference APIs are documented by [Cloudflare R2](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/) and [D1](https://developers.cloudflare.com/d1/worker-api/d1-database/).

The local preview reads the same reviewed snapshot objects from disk. Storage publication, a Worker deployment and independent live verification remain separate steps.

`npm run history:verify:storage` exercises the full snapshot with Wrangler's local R2/D1 emulator: schema migration, checksum verification, conditional object creation, repeat publication and API hydration. It disables remote bindings and environment-file loading and discards that test's storage at exit. The dedicated `wrangler.history-local.jsonc` has isolated local resource names. For persistent local publication, pass that config, `data/historical-intelligence/local-candidate-target.json`, and `scripts/adapters/local-history-candidate.mjs` to the publisher explicitly; a later revision needs a new `--version`.

`node scripts/export-historical-coverage.mjs --output /absolute/path/coverage.csv` exports all 1,860 records with context endpoints, approved subject observations, inception/occupancy status, current-source dates, quarantined identities and remaining gaps. A shared source may support several records, so its per-record totals are not independent observations. The JSON companion records the source snapshot checksum.

## Event analysis

The initial window is 12 months before and 12 months after an event. Native quarterly and annual measurements retain their frequency. Missing post-event periods, sparse samples and incomplete source windows are shown explicitly. A news announcement supplies timing and a hypothesis, not a numerical uplift.

Reported changes are descriptive associations. Causal attribution requires comparison controls, pre-trend checks, adjustment for property composition and analysis of concurrent shocks. This release does not claim to have completed those checks for every community. Event effects are not added mechanically to forecasts or historical prices.

## Short-term evaluation

The optional reproducible evaluator uses the licensed, checksummed Dubai Real Estate Data transaction export:

```sh
python3 -m venv .local-data/history-venv
.local-data/history-venv/bin/pip install -r scripts/requirements-history.txt
.local-data/history-venv/bin/python scripts/evaluate-historical-forecasts.py \
  --transactions /absolute/path/dld_sales_transactions.parquet \
  --events data/historical-intelligence-20261003.json \
  --output data/historical-intelligence/forecast-evaluation.json
```

It evaluates four-quarter targets across separate cadastral areas, apartments/villas and Ready/Off-Plan cohorts. Each origin fits outlier bands using only its training observations. It ignores the publisher's full-calendar-year PSF flag, which could include future registrations. Target observations use frozen training-year bands. Twenty eligible observations are required for a cohort median; the underlying source file remains unchanged.

Carry-forward and damped-trend baselines are compared with a pooled ridge model using past returns, sample-count changes, property/registration indicators and dated macro event features. A training target is admitted only after its four-quarter outcome has ended by the origin. Events without known source availability at that origin are excluded. Fixed regularisation and return clipping are disclosed; this is research, with neither property-mix adjustment nor causal interpretation.

The export retains latest transaction amendments and lacks historic publication vintages. Results are therefore labelled **retrospective latest-vintage research**, not a contemporaneous replay. Its area identities do not certify the catalogue's marketing communities or project-name candidates. Benchmark error at twelve months does not validate a price prediction through 2080.

`--strict-point-in-time` rejects this snapshot before evaluation because historical publication vintages are unavailable. The research result explicitly has `backtestAccepted: false` and `releaseAcceptancePassed: false`; it does not satisfy the requirement to prove every transaction input was available at its forecast origin.

The retained run evaluates 1,451 twelve-month targets across 22 origins. Mean absolute percentage errors are 13.73% for carry-forward, 12.65% for damped trend and 13.76% for dated-event ridge. The event model does not improve on the trend baseline and is not promoted to a released forecast. CBUAE decision stages supplement the Fed chronology with their own source and effective dates; they do not substitute for a complete UAE mortgage/EIBOR history.

## Annual scenarios through 2080

Every record exposes exactly 54 annual target slots, 2027–2080 inclusive, for price, rent and cumulative net return, with downside/base/upside paths. Missing inputs produce null values with reasons. Dates, units, anchors and source scope remain explicit. Area benchmarks cannot silently become project valuations. No price, rent or positive growth is invented to make coverage read 100%.

User calculations use disclosed assumptions and allow capital losses, negative real growth and negative total returns. Occupancy/delivery timing gates rental income. Vacancy, operating costs, acquisition/disposal fees, inflation and annual assumptions affect results; they are not observed evidence. Scenario ranges have no assigned probability or calibrated confidence interval. These annual paths are conditional scenarios, not certified 54-year forecasts.

## Research completion

The retained inventory, source partitions, queue and coverage matrix make every record accountable. Completion still requires evidence for its own earliest verifiable history, explicit identification of each applicable period, current unit/segment facts, and matching financial observations. Missing sources remain sourcing work. Rights-pending numeric sources remain unreleased; a public link or metadata entry is not permission to redistribute a full dataset.
