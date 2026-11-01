# ADREC registered-sales candidate V55

## Scope

V55 reviews 50 uniquely mapped ADREC project filters. It appends 642 genuinely new normalized full-share residential sale observations after reconciling 9,400 recaptured rows against the retained transaction multiset.

- API rows reviewed: 10,071.
- Accepted source rows after row-quality filters: 10,042.
- New observations appended after revision-aware multiplicity reconciliation: 642.
- Previously retained rows recognized and not re-added: 9,400.
- Excluded source rows: 29.
- Registered-sale coverage promotions: 54 records.
- Capture requests retained: 53.

The transaction endpoint does not expose a native transaction identifier. V55 therefore compares recaptures as a multiset of date, price, sold area, property type and layout, district and community, registration, sale sequence, and sold share. Identical registrations retain multiplicity. Changes outside those transaction dimensions are treated as source revisions and do not create another sale.

## New observations by record

| Record | New observations |
| --- | ---: |
| `adrec:33` | 7 |
| `adrec:38` | 1 |
| `adrec:435` | 2 |
| `adrec:468` | 1 |
| `adrec:483` | 34 |
| `adrec:495` | 1 |
| `adrec:508` | 74 |
| `adrec:533` | 77 |
| `adrec:554` | 63 |
| `adrec:556` | 31 |
| `adrec:568` | 35 |
| `adrec:575` | 20 |
| `adrec:587` | 55 |
| `adrec:588` | 7 |
| `adrec:589` | 4 |
| `adrec:598` | 58 |
| `adrec:604` | 68 |
| `adrec:618` | 12 |
| `adrec:625` | 45 |
| `adrec:630` | 2 |
| `adrec:689` | 27 |
| `adrec:702` | 8 |
| `adrec:726` | 1 |
| `adrec:733` | 9 |

## Withheld and zero-result subjects

- `adrec:391` / Bloom Gardens is withheld from V55 because the normalized dashboard label is shared by `adrec:389` and `adrec:391`; a name filter cannot assign rows to one authority record.
- Zero accepted rows: `adrec:710`, `adrec:641`, `adrec:42`. These remain missing.
- `Nudra Beach Villas` and `Saadiyat Beach Villas` are excluded from the source plan because each dashboard label maps to two pre-existing authority records.

## Coverage after V55

### Primary evidence ledger

| State | Requirements |
| --- | ---: |
| Present | 3,486 |
| Partial | 3,402 |
| Missing | 26,592 |
| Unestablished | 0 |
| **Total** | **33,480** |

### Advanced completeness audit

| State | Requirements |
| --- | ---: |
| Unestablished | 9,300 |
| **Total** | **9,300** |

V55 reduces primary missing requirements by 54. It does not convert the remaining valuation, rent, lifecycle, service-charge, scenario-input, or forecast gaps into transactions. The advanced lifetime-completeness and validated-forecast audit remains unchanged.

The cumulative unique ADREC registered-sale candidate now contains 34,201 observations across V49 through V55.

## Source and publication boundary

The source is the public ADREC Market Data dashboard and its exact-project Recent Sales endpoint. Raw API bodies and personal fields are not retained. Public-site terms reviewed on 27 October 2026 did not establish a data-reuse licence. V55 remains an unmerged GitHub research candidate pending rights review. No R2, D1, Worker, traffic, or production data was changed by the capture or transformation pipeline.

## Receipts

- Version: `20261027-enrichment-v55`
- Prior canonical SHA-256: `00307fd0338cf91ee14afb0e096094645850ceeb340951e7b9015f9b1c845589`
- V55 canonical SHA-256: `38daef0cbdec6ddb90ac436b2a3ea95784435fa4d288930aba9fb915ad94c2c6`
- V55 root SHA-256: `d22764029570d2030eb4939fd08d0abe6df14ce9d8fcef480fe1fd3815744904`
- V55 source-plan SHA-256: `111c6aff82b19fe20556cbba424ba0499d8b55db99459452d05f9bd9f2c01487`
- V55 capture SHA-256: `5513a636f49d7e1952599bbf8a26e46b03b0f3304b074a8c1bd233406702c20e`
- Native-series digest: `eb270ec89dd5bef9cb4402d2d21459078f2222c241cfe2c6bc11b8faef240456`
- Publication state: `unmerged_candidate_only_reuse_rights_pending_not_published`
- Remote writes from the data pipeline: `0`
