# Abu Dhabi source relationship review, 14 November 2026

The accepted V48 catalogue has 127 Abu Dhabi project records without verified
coordinates. A bounded comparison against all 411 features in the Abu Dhabi
Spatial Data Infrastructure Developer Projects layer found two exact normalized
project-name candidates. `Rawdhat Abu Dhabi` also has an aligned developer
label, so the source feature now reports a reviewed relationship to `adrec:395`.
`The Villages` has a conflicting developer and remains unlinked. Neither is a
canonical identity match or an accepted V48 project point. All 127 projects
remain searchable without a verified point. The input hashes and decisions are
recorded in
`data/uae-evidence/abu-dhabi/sdi-v48-relation-review-20261114.json`.

`npm run verify` passed, including preservation of 16,872 V48 native history
series. A provenance-pinned Worker was built from source commit
`d8a33b0f3709ca9a3ad747b4d765a767e1e626ba` and pushed to draft PR #102
in generated commit `f17b83b2cda854818b6c090f7aa878cb94a928ab`.

Worker version `e4fb1b84-dfbe-448c-94cb-0fe3e151a30b` was uploaded and
staged at 0% beside `40d8d8ea-e648-4bd0-9855-741812d70d85` at 100%.
Canonical version-override checks confirmed:

- The new version and its private IDrive E2 primary policy.
- A direct, checksum-matching IDrive archive proof read with no fallback.
- Source feature 200 linked to `adrec:395` with no canonical match or project
  coordinate; source feature 737 unlinked; feature 200's official polygon still
  available only as source geometry.
- 40 published UAE source snapshots and 40 dated verified private IDrive
  replicas. These attestations are not a claim that every endpoint reads IDrive
  at request time.
- The accepted 1,645 projects, 1,860 records, 16,872 native series, and 127
  unlocated Abu Dhabi records; commercial area endpoint at 996 publisher rows.
- `/map` returned 200 and `/map/data-room` returned 404.

The Worker was promoted to 100%. Three normal-traffic passes repeated the
version, IDrive proof, accepted counts, replica inventory, commercial endpoint,
map route, and Data Room checks. The first immediate post-promotion health
request briefly returned the previous version during propagation; subsequent
checks returned the promoted version. Cloudflare R2 remains disabled. The
original official-history bundle and missing saved model captures remain
unavailable; V48 native history and conditional scenarios stay separately
labeled.
