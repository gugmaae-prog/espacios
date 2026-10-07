# V20 DRED master-community context

V20 adds monthly, source-derived sale-price context to **44 Dubai community records**. It does not promote the source's free-text `master_project_name` to a verified DLD community ID, exact boundary, or project identity.

The source is the pinned Dubai Real Estate Data distribution of Dubai Land Department transactions, snapshot date **2026-10-05**, published **2026-10-05 09:28 UTC** under **CC BY 4.0**. Attribution is “Dubai Real Estate Data (dubairealestatedata.com), based on Dubai Land Department open data.” The source extract remains in local ignored storage; raw transaction rows are not redistributed in this pass.

The identity join is exact after trimming and case-folding: one source `master_project_name` must match one unique Dubai catalogue community name. There are **45 exact-name candidates**, covering **561,282** eligible Residential Unit/Flat or Villa transactions dated **2003-06-02 through 2026-07-31**. Dates are DLD `instance_date` registration dates. This is a latest-vintage extract, not a point-in-time archive and not proof of first-ever sale or continuous history.

Existing V19 community series already retain **67,268 record/transaction pairs** in these candidates. Those native individual rows remain untouched and are not linked a second time. One candidate, Palm Jumeirah, has no new transaction links and is already represented by its exact official-area series, so it receives no redundant V20 series. The other 44 records gain **13,586 monthly cohort points**. Their monthly cohorts summarize **539,872 source rows**: 494,014 not previously linked to those records plus 45,858 overlapping Business Bay rows. The source-native area ID remains separate, and the app warns that overlapping cohort counts must not be added together.

Monthly medians are split by master label, DLD area ID, registration type, procedure, property type/subtype and month. The median is visible only for cohorts with at least 20 eligible rows. **8,912 of 13,586** monthly medians are withheld as sparse; their sample counts remain visible. No rental observations, price uplift coefficients or annual forecasts are added.

These points improve dated community context while keeping `scope=community_context` and `identityVerified=false`. They do not establish exact project performance, full community lifetime coverage, all historical periods, or verified forecasts through 2080. Unresolved records and periods remain open requirements.

Rebuild the additional pass explicitly with:

```sh
python3 scripts/prepare-dred-master-community-context-pass.py
python3 scripts/build-historical-data.py \
  --version 20261008-enrichment-v20 \
  --as-of 2026-10-08 \
  --enrichment-sidecar community-master-context-enrichment.json
```
