# V21 production release receipt — 8 October 2026 (Dubai)

## Release identity

- GitHub source PR: [#76](https://github.com/gugmaae-prog/espacios/pull/76), merged
- Source commit: `f83170ed2a69a5a710b6947ce3ab83b20aab24dc`
- Merge commit: `d337ab18290faa63549c595c70a1822216ce02db`
- History snapshot: `20261008-enrichment-v21`
- Archive root SHA-256: `d690dac8b2ac109e20f18122d17f0b84e16409ef944ca26546a467317c5e124a`
- Cloudflare Worker: `psr-portfolio-map-v2`
- Worker version: `cc56d503-df92-42bc-a252-1d0ce549ef93`
- Deployment: `1c91639f-0b5b-4e8d-9f00-a7ba6d998440`, serving 100% traffic
- Frontend release token: `20261008-map-palette-v21`
- Data Room: `DATA_ROOM_PUBLIC=false`

## Published snapshot and preservation

V21 preserves the catalogue's **1,645 projects and 215 communities**. It adds an
evidence pass for 113 Residences by IMAN Developers: **46 individual
DLD-derived sale registrations**, four separately labelled developer
starting-price quotes, one project-register snapshot, and planned construction
and handover milestones. The new exact-name/developer/area identity resolution
reduces the review queue to 262 project and 59 community candidates. See the
[source review](../../history-v21-113-residences-review.md) for provenance,
date precision and limits.

The immutable history archive contains **2,109 objects**: **2,063 written**
for V21 and **46 byte-identical objects reused**. Publication applied **38,492
index statements**. Production D1 readback verified V21 complete and returned
1,860 records, 3,244 sources, 105 events, 7,382 event exposures, 14,771
history series and 11,129 record-series links. The snapshot retains **548,242
published historical rows**; the collected input includes 216 rights-pending
rows, for 548,458 total. V20 remains preserved as its own complete snapshot.

The earliest financial evidence added for this record is dated 30 July 2026 by
source registration date. It is not a first-ever sale date. The 46 sale records
are registrations, not contract or transfer dates; the four starting-price
quotes are not transactions. The register and developer handover dates remain
planned evidence, not confirmed physical construction or completion.

## Verification and live behavior

- GitHub CI and repository safety checks passed for PR #76; all **166 local
  repository tests passed** with `npm run verify`.
- `npm run history:verify:storage` checked all 2,109 immutable objects, indexed
  table counts, paged record history and repeat-publication reuse in the local
  emulator. Repeating the local publication reused the 2,109 stored objects.
- `npm run cf:dry-run` completed with the production manifest and its restricted
  Data Room binding.
- A read-only production D1 check confirmed V20 and V21 complete, with the
  expected V21 root and catalogue count. Production record-history and event
  routes returned V21.
- [The live Map](https://espacios.me/map) returned HTTP 200 and the expected
  frontend token. The 113 Residences record-history route returned 51
  observations (46 sales and five asking-price observations); its event route
  returned 34 event records/exposures. Those response counts do not establish
  lifetime history.
- The current controls use a low-contrast theme-aware slate surface and muted
  teal accent. Gold was a legacy selection/fallback accent, not a price or
  appreciation signal. The production Supabase registry and runtime config
  now match the V21 release and Worker version.
- The temporary authenticated history-publisher Worker was deleted after
  publication; its public health route returned 404. Its token, header and
  private target manifest were removed locally.

## Coverage limits and next work

The fixed evidence ledger contains 3,099 present, 3,433 partial, 26,948
missing and 9,300 unestablished requirements: **39,681 of 42,780 (92.76%)
remain unresolved**. This is a checklist measure, not the percentage of
missing prices. Complete lifetime sale/rent histories remain unestablished;
there are **zero approved annual forecasts through 2080**. The API's page
completion flag describes retrieval of its available page, not complete
property lifetime coverage.

Continue sourcing direct authority identifiers, wider exact-phase transaction
histories, signed rents, actual construction and occupancy, costs, and current
valuations while preserving existing evidence. Keep contextual community data,
asking prices, transactions, lifecycle evidence and forecasts distinct. Do not
fill missing periods with inferred prices or turn news and project milestones
into automatic price adjustments.
