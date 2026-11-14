# V38 exact Asora Bay registered sales

## Evidence and identity

This release adds 30 individual residential flat sales registered from 7 May 2025 to 5 August 2026 to the current Jumeirah Asora Bay record. The primary Dubai Land Department project register identifies project 3445 (stable ID 691710228), area 317, master development LA MER and developer ID 452208509 / number 1510. The project vintage names Meraas in Arabic; the later developer register uses DHRE 2 BTS L.L.C against the same keys. Both labels remain dated source facts. No legal rename date or corporate ownership is inferred. The [official developer page](https://meraas.com/en/project/jumeirah-asora-bay) supports the named project and location.

All 30 transactions name the exact Jumeirah Residences Asora Bay residential building. The register distinguishes this G+11 / 29-unit building from the hotel and hotel villas. Sales are transactions, not a count of distinct dwellings: 30 registrations do not imply 30 units. No facts are assigned to the hotel, Ocean Mansions, the archived catalogue candidate or another community. The archive remains unchanged.

Each observation preserves registration day, native AED price and square-metre area; AED/sqft is explicitly derived with 10.763910416709722 square feet per square metre. Individual evidence is retained with sampleCount 1. No aggregate median, current valuation, rent, occupancy or future outcome is inferred. Stable public transaction keys hash the original DLD IDs; party information and raw exports remain private. The full DLD source scans contain 1,798,873 rows, but only these 30 verified subject observations are accepted in this pass.

Dataset attribution: Dubai Land Department via Dubai Pulse / data.dubai: [transactions](https://data.dubai/en/l/470061), [projects](https://data.dubai/en/l/467654), [developers](https://data.dubai/en/l/462802), [areas](https://data.dubai/en/l/465592). The minimal normalized extract is adapted source material under the linked [Open Data License](https://data.dubai/documents/20117/0/Open+Data+License+-+English+%284%29.pdf/b4116590-0abb-ee75-5d74-ca33eca79b64?version=1.0&t=1762239598209&download=true); source checksums, availability and method are retained in the packet. Source-vintage availability is October 2026, not the earlier transaction day, so backtests cannot use it prematurely.

## Preservation and coverage

All 1,645 projects and 215 communities remain. Prior 633,891 native history rows, 16,872 series, 13,230 links, 105 events and 7,382 exposures remain unchanged. The 30 new inline observations are separate from that native-row count. Sources become 3,345 and evidence facts 6,748. Some direct-sale evidence is now present for 324 projects and 48 communities; this does not establish full lifetime histories.

The 42,780-item ledger has 3,300 present, 3,439 partial, 26,741 missing and 9,300 unestablished items. **39,480 (92.29%) remain unresolved.** One direct-sale evidence requirement closes; full period-by-period price coverage remains unestablished. This is checklist accounting, not a missing-price percentage. Dated current valuations and approved annual forecasts remain incomplete. Annual scenario slots through 2080 are not verified future observations.

Avida's 40 financially eligible candidate sales remain excluded pending an explicit primary legal-developer identity bridge. Three other Avida rows (land sale and gifts) are excluded from the residential-sales candidate population. The earlier pending review is preserved as an immutable research receipt; this later pass resolves only Asora.

## Reproduction and safeguards

Run scripts/prepare-dld-asora-pass38.py against the checksum-pinned captures and V37 baseline, then scripts/append-dld-asora-pass38.py. Ingestion rejects duplicate ownership, native unprotected IDs, asking/rent relabelling, invalid dates, non-residential populations, invalid sample counts, non-finite prices and inconsistent unit conversion. Tests preserve all earlier evidence and unaffected records and exclude premature source availability. Frozen source snapshots remain immutable.

## Publication batching

The temporary release bridge now validates every incoming row before preparing any SQL, then groups adjacent identical allowed INSERTs into statements with at most 100 bound parameters. Its 50-row request limit, snapshot/root restrictions, parameterization, transaction boundaries and final table-count verification remain intact. It preserves row order and INSERT OR IGNORE behavior. SQLite comparisons cover duplicates, quoted/non-ASCII data, row checks and foreign keys; bridge tests reject a bad final row before any database preparation. A live idempotent replay of 50 previously indexed source rows executed as two queries with zero changes. The map Worker and evidence bytes do not change for this publication-only improvement. See batch-compaction-verification.json; helper source commit be6525ddba33e358bf3e17f411c9677de819e2d4.

## Release status

V38 / frontend V42 is live at 100% traffic on Worker version `9ddd509f-2f75-4dc9-a5cd-c25fd512fe70`, deployment `d75ce6a2-91aa-46a1-99bb-83d14964128a`, activated at 2026-10-09T00:58:31.774448Z. Immutable root: `01b716e001347142944eda86c5c649f4a2e05b47be05df70f8302db4450d09fd`.

Publication verified all 2,541 R2 objects and 42,795 D1 index statements with exact table counts; the reconnect reused existing objects idempotently. Preview and canonical APIs match all 1,860 record ledgers and the 30 individual observations. Annual slots end exactly in 2080; no forecast is thereby approved. Live HTML/JS/CSS return 200 and all catalogue records match the previous release. Desktop and 390px mobile show 30 sale cards plus the existing asking quote, primary source links and no horizontal page overflow. Daily individual observations remain separate from native monthly-accountability cohorts. Selected Map controls use background rgb(248,250,252) and slate text rgb(32,48,68).

Cloudflare route/service bindings and the Supabase runtime/registry now agree with V38/V42. The Data Room remains restricted. The temporary publisher and its authentication files are removed. See deployment.json, publication-result.json, live-api.json, http-verification.json, browser-verification.json, control-plane-verification.json and cleanup.json.

Source commit `5dcaf96801d4711f58053a374bf61aece0f25290` passed [clean CI](https://github.com/gugmaae-prog/espacios/actions/runs/37863928324). The helper improvement passed [clean CI](https://github.com/gugmaae-prog/espacios/actions/runs/37866542542), including 374 JavaScript tests in the combined suite. All 2,542 local archive objects including D1 pass checksums. Source and receipts are in [open PR #98](https://github.com/gugmaae-prog/espacios/pull/98), not merged.

The October 9 lifecycle and Avida source captures in next-lifecycle-sources.json and next-identity-review.json are pending review, outside this snapshot cutoff and excluded from evidence coverage.

Next: continue exact project and phase identity resolution, lawful direct rent/sale sourcing, historical period requirements, dated current valuations, occupancy proof and disclosed annual scenario assumptions through 2080. The overall research goal remains incomplete.
