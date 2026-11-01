# Evidence-presence coverage policy V2

## Decision

The primary coverage ledger now measures whether exact, source-backed evidence exists for each core item. A bounded authority window qualifies as evidence coverage without claiming that every lifetime period is complete.

Five stricter requirements remain available in a separate advanced audit:

- Complete registered-sale history.
- Complete signed-rent history.
- Validated price forecast.
- Validated rent forecast.
- Validated net-return forecast.

These advanced checks no longer reduce the primary evidence-presence score. Conditional scenario slots remain separate from validated forecasts.

## ADREC correction

V51 and V52 retained 9,941 exact-subject registered-sale observations across 27 Abu Dhabi projects. Their stored `registered_sale_history` items had been copied unchanged from the earlier snapshot, leaving those projects marked `missing` despite the accepted observations.

V53 corrects those 27 items from `missing` to `present`. Each item stores its observation count, distinct transaction dates, observed start and end dates, source IDs, and the bounded coverage basis. The separate lifetime-completeness item remains `unestablished`.

## Revised counts

### Primary evidence ledger

| State | Requirements |
| --- | ---: |
| Present | 3,407 |
| Partial | 3,402 |
| Missing | 26,671 |
| Unestablished | 0 |
| **Total** | **33,480** |

### Advanced completeness audit

| State | Requirements |
| --- | ---: |
| Unestablished | 9,300 |
| **Total** | **9,300** |

The all-item audit remains available for reconciliation: 3,407 present, 3,402 partial, 26,671 missing, and 9,300 unestablished across 42,780 items.

## Preservation and publication boundary

- Catalogue: 1,860 records, including 1,645 projects and 215 communities.
- Sources: 3,453, unchanged.
- Native series: 16,872, unchanged.
- Historical rows: 633,891, unchanged.
- New observations: 0. V53 changes coverage accounting only.
- Numeric forecasts added: 0.
- Production publication: none.
- ADREC reuse rights remain unresolved, so the candidate remains blocked from R2, D1, Worker, traffic, and production publication.

## V54 follow-up

V54 adds 10,571 exact-subject ADREC registered-sale observations across 25 additional records. Under this policy, those records move from `missing` to `present` for the bounded registered-sale evidence item. Primary coverage becomes 3,432 present, 3,402 partial, and 26,646 missing. The 9,300 advanced lifetime-completeness and forecast-validation items remain unestablished.

## V55 follow-up

V55 reconciles a 10,042-row current-vintage ADREC capture against the retained transaction multiset. It recognizes 9,400 prior rows without duplicating them, appends 642 genuinely new observations, and promotes 54 exact-subject records with accepted bounded sale evidence. Primary coverage becomes 3,486 present, 3,402 partial, and 26,592 missing. Ambiguous shared dashboard labels remain withheld, and the 9,300 advanced lifetime-completeness and forecast-validation items remain unestablished.
