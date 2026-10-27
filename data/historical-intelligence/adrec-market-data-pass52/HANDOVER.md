# ADREC registered-sales candidates V51 and V52

> Coverage accounting note: V53 applies the later `evidence-presence-v2` policy. It credits these 9,941 observations as bounded registered-sale evidence on 27 records and reports lifetime completeness and forecast validation in a separate advanced audit. See `../coverage-policy-v2/HANDOVER.md`.

## Scope

V51 and V52 append 9,941 normalized, full-share residential registered-sale observations to 27 exact Abu Dhabi project records already present in the fixed catalogue:

- V51: 7,899 observations across 13 records.
- V52: 2,042 observations across 14 records.
- API rows reviewed: 9,978; 37 rows excluded because a usable price or area was absent, the asset was not residential, or the sale represented a partial share.
- Requests recorded: 32 across the two bounded captures, including project-register and robots checks.
- Source window: 1 January 2019 through 22 October 2026. This does not establish complete lifetime transaction history.

The fixed catalogue remains 1,860 records: 1,645 projects and 215 communities. Existing lifecycle facts, events, exposures, asking prices, rents, valuations, scenarios, 16,872 native series, and 633,891 historical rows are preserved.

## V51 records

| Record | Exact ADREC project | Accepted registered sales |
| --- | --- | ---: |
| `adrec:561` | Bal Ghaiylam | 1,460 |
| `adrec:564` | Al Naseem | 999 |
| `adrec:48` | Noya - Phase 1 | 980 |
| `adrec:485` | Reeman Living | 894 |
| `adrec:620` | Al Deem Townhomes | 450 |
| `adrec:560` | Royal Park | 433 |
| `adrec:609` | Fahid Beach Residences | 426 |
| `adrec:590` | Manarat Living III | 417 |
| `adrec:581` | Mamsha Gardens B | 400 |
| `adrec:617` | Fahid Beach Terraces | 397 |
| `adrec:603` | Nawayef Village Townhouses | 376 |
| `adrec:567` | Nawayef West B | 361 |
| `adrec:540` | Mangrove Village | 306 |

## V52 records

| Record | Exact ADREC project | Accepted registered sales |
| --- | --- | ---: |
| `adrec:591` | Selina Bay | 275 |
| `adrec:534` | Sama Yas | 238 |
| `adrec:582` | The Fountain View Residences | 211 |
| `adrec:507` | Mayyas at the Bay | 185 |
| `adrec:466` | The Bay Residence | 139 |
| `adrec:555` | Icon | 135 |
| `adrec:601` | Yas Links Luxury Living | 125 |
| `adrec:580` | Bab Al Qasr Residence 25 | 116 |
| `adrec:627` | Juman 2 | 113 |
| `adrec:645` | Juman 3 | 109 |
| `adrec:596` | Bab Al Qasr Residence 31 | 105 |
| `adrec:635` | Al Sharq Heights | 100 |
| `adrec:607` | Juman 1 | 99 |
| `adrec:496` | C3 Garden | 92 |

## Remaining evidence gap

The evidence ledger remains unchanged because transaction observations from a bounded 2019 onward endpoint do not prove complete sale history, rent history, or forecast validation:

| State | Requirements |
| --- | ---: |
| Present | 3,380 |
| Partial | 3,402 |
| Missing | 26,698 |
| Unestablished | 9,300 |

The 9,300 unestablished requirements are the five strict requirements applied to all 1,860 records: complete registered-sale history, complete signed-rent history, validated price forecast, validated rent forecast, and validated net-return forecast. No status was upgraded without evidence that satisfies the full requirement.

`adrec:594` / `Nawayef Park Views` returned 183 rows during bounded discovery but was rejected from V52 because the exact retained register identity was not established. It receives no observations and no coverage credit.

## Source and publication boundary

The source is the public ADREC Market Data dashboard and its project-filtered Recent Sales endpoint. The capture stores normalized evidence and provenance only. It does not retain raw API responses, personal fields, or source transaction identifiers.

ADREC public-site terms reviewed on 22 October 2026 did not establish a data reuse licence. V51 and V52 therefore remain unmerged GitHub research candidates with publication blocked pending rights review. No R2, D1, Worker, Cloudflare traffic, or production data was changed.

## Receipts

- V51 canonical SHA-256: `b69121dd4e5718353df00b6459f94b448daabd80a17f1e5a5fdfec7586b26c54`
- V51 root SHA-256: `b114cb21f8cbdb4c7d4ef4ce57f0a32040cd0a3c533b6b62664884951182258e`
- V51 source-plan SHA-256: `f65d97860d46207e8a76bb023e665e6dd978e4463e992d7acb58b35e990e296d`
- V51 capture SHA-256: `7313e33a592161df959f904d2b5a4cf8d1947e1dce3575be375e40822c4f3242`
- V52 canonical SHA-256: `7a9a072f3f8025714615ee328afe517946bb9221463f7ce5b77395e52c6b4c46`
- V52 root SHA-256: `1792c42000ba305e5514a1981d8493a22b3fd78c3e3866240c08fbe97ba76cf2`
- V52 source-plan SHA-256: `d4d7463f5fea01741cf372d1f6826baeb76feee439510b45d359ac870a4d9a36`
- V52 capture SHA-256: `43dc9266aff38191329e9b510d54fc93e167825cf42f2ed0d129bfd82cd2aa0a`
- Publication state: `unmerged_candidate_only_reuse_rights_pending_not_published`
- Remote writes: `0`
