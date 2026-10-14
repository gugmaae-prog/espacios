#!/usr/bin/env python3
"""Write the single evidence handover from actual reconciliation; no source collection."""
import collections,json,os
from pathlib import Path
R=Path(__file__).resolve().parents[1];D=R/'data/historical-intelligence/reviewed-regional-20261014'
r=json.loads((D/'reconciliation.json').read_bytes());p=json.loads((D/'accepted-packet.json').read_bytes());s=json.loads((R/'data/historical-intelligence-20261003.json').read_bytes())
by={x['id']:x for x in s['records']};sources={x['id']:x for x in p['sources']}
assert r['acceptedFacts']==20 and len(r['changedRecords'])==16
run=os.environ.get('GITHUB_RUN_ID','local');repo='gugmaae-prog/espacios'
lines=['# Accepted regional evidence — V47 GitHub-only handover','',
'**20 accepted facts appended to 16 existing records.** This is a tested candidate archive in GitHub, not a production publication. The entire historical-evidence backlog is not complete.','',
'## Correct baseline and preservation','',
'The pinned PR #98 commit `6cb77c197d1ea6107c94f374f2bfa10c7248a043` contains **V46 (`20261013-enrichment-v46`)**, not V44 as its older description states. Its decoded canonical SHA-256 was independently verified: `'+r['priorSHA256']+'`. Earlier V25 research documents are retained as earlier-pass history, not the current evidence baseline. Main and PR #98 were not changed by this work.','',
'V47 keeps exactly 1,645 projects and 215 communities. It preserves all 3,367 prior source objects, all prior observations, lifecycle facts, register evidence, current snapshots, scenario inputs and all 633,891 native historical rows across 16,872 series. The 1,844 records outside the accepted set compare exactly before archive envelope/pointer versioning. Native series-array digests before and after are identical: `'+r['nativeSeriesDigestBefore']+'`.','',
'## Records reviewed and changed','',
'All 1,860 catalogue IDs are retained. Public-source review in this pass covers 29 distinct IDs, not all records independently.','',
'| Emirate | Exact IDs source-reviewed | Records enriched | Asking-price observations | Lifecycle facts |',
'| --- | ---: | ---: | ---: | ---: |']
reviewed=collections.defaultdict(set)
for c in p['sourceReconciliation']:
 for rid in c['reviewAgainstIds']:reviewed[by[rid]['emirate']].add(rid)
for e in ['Abu Dhabi','Dubai','Umm Al Quwain','Fujairah','Ras Al Khaimah','Sharjah','Ajman']:
 f=[f for f in p['facts'] if by[f['recordId']]['emirate']==e]
 lines.append(f"| {e} | {len(reviewed[e])} | {r['changedRecordsByEmirate'].get(e,0)} | {sum(x['kind']=='financial' for x in f)} | {sum(x['kind']=='lifecycle' for x in f)} |")
lines+=['','## Exact accepted additions','',
'Fourteen first-party asking-price observations; three developer-reported historical launch quarters; three planned completion quarters. Registered transactions: **0**. Signed rents: **0**. Valuations: **0**. Developer aggregate financial observations: **0**. Event links: **0**. Numeric forecasts: **0**. Asking prices are capture-date advertisements, not completed sales or current valuations. Planned dates do not establish actual completion, handover or occupancy.','',
'| Record ID | Name | Accepted statement | Source |','| --- | --- | --- | --- |']
for f in sorted(p['facts'],key=lambda f:(by[f['recordId']]['emirate'],f['recordId'],f['kind'])):
 src=sources[f['sourceIds'][0]]
 statement=(f"Asking AED {f['observation']['value']:,.0f}; captured 2026-10-14" if f['kind']=='financial' else f"{f['milestone']}: {f['date']['start']} ({f['eventStatus']})")
 lines.append(f"| `{f['recordId']}` | {by[f['recordId']]['name'].strip()} | {statement} | [{src['publisher']}]({src['url']}) |")
lines+=['','## Exact coverage changes','',
'| State | V46 before | V47 after | Delta |','| --- | ---: | ---: | ---: |']
for state in ['present','partial','missing','unestablished','disputed','inaccessible','pre-applicability']:
 lines.append(f"| {state} | {r['coverageBefore'].get(state,0):,} | {r['coverageAfter'].get(state,0):,} | {r['coverageDelta'].get(state,0):+,} |")
lines+=['','**20 requirements moved to present; 39,418 of 42,780 remain unresolved.** This is checklist evidence presence, not complete lifetime-history coverage. Item-by-item prior/next evidence lists are retained in `reconciliation.json`.','',
'## Source decisions and exclusions','',
'Thirty-three predeclared source URLs were captured in three bounded passes using 39 total HTTP requests, concurrency one, maximum 20 source pages and 40 HTTP requests per pass. Only normalized fields and provenance are retained. Fourteen capture vintages were accepted as evidence sources. No raw third-party HTML, PDF, transaction export, personal contacts or escrow data is redistributed.','',
'| Disposition | Sources |','| --- | ---: |']
for state,count in sorted(p['collection']['sourceDispositionCounts'].items()):lines.append(f'| {state} | {count} |')
lines+=['',
'Six Ghantoot/Ghantout authority captures match exact project IDs and project numbers, but their latest inspection fields were already retained: no duplicate lifecycle credit. Palm Jebel Ali masterplan and Palm Central phase release were already retained: no duplicate or master-to-phase financial credit. Five Sobha pages show conflicting starting prices between FAQ and price panel and are withheld. Five HTTP-200 article/unit bodies did not confirm the required text; search snippets were not substituted. No source was inaccessible at the HTTP level in this pass, but body availability, identity, price consistency and coverage remain separate.','',
'All prior source identities are preserved. Repeated canonical URLs use new immutable capture IDs and predecessor references. Legal developers remain separate from marketing publishers. The Palm Grove/Palm Groove spelling crosswalk is explicit; no catalogue ID is renamed. First forecasting availability is conservatively the new capture date, never backdated to a launch event.','',
'## Verification','',
'Offline focused validation: 17 acceptance/preservation tests plus 5 capture tests. Required full checks: `npm test`, `npm run check`, `npm run build:smart`, `npm run history:verify:storage`, retained-archive verification and the existing regional queue tests. The integration workflow commits the data candidate only after all these commands succeed; failures produce no data commit or ref update.','',
f'GitHub verification run: https://github.com/{repo}/actions/runs/{run}. The workflow artifact records the resulting commit SHA and exact command logs. Storage verification is isolated local emulation with no remote bindings.','',
'## Immutable receipts','',
'Original source capture artifact: run `38544118240`, artifact `11883503196`; ZIP SHA-256 `1bac5c25b1eb9bf4bbce216cf1a115fe3f579cb1dac46a006ec2ac899dd23229`. Six original plan/capture JSON files and their checksum gates are committed for durable reproduction; they do not depend on artifact availability after expiry.','',
'Candidate canonical SHA-256: `'+r['canonicalSHA256']+'`. Root SHA-256: `'+r['rootSHA256']+'`.','',
'## Remaining work and separately authorized operator','',
'The remaining gaps require lawful exact-record sales/rents, disputed-price reconciliation, verified lifecycle applicability and continuing regional evidence work. Every 2027–2080 annual slot is preserved; no missing scenario input is filled and no numeric forecast or automatic price uplift is added.','',
'After GitHub evidence review, a separately authorized operator must handle immutable R2/D1 publication, a zero-traffic Worker candidate, candidate API/browser checks, traffic activation, canonical verification and release/control-plane reconciliation. **None was performed here.** PR #100 remains reviewable and unmerged; this candidate is not called deployed, live or 100% complete.','']
out=R/'docs/verification/regional-research-2026-10-14/ACCEPTED-PASS47.md';out.parent.mkdir(parents=True,exist_ok=True);out.write_text('\n'.join(lines))
for relative in ['docs/DATA_SOURCING_WORKFLOW.md','docs/HISTORICAL-INTELLIGENCE.md']:
 path=R/relative;text=path.read_text();heading='## Accepted regional pass V47 — 14 October 2026'
 if heading not in text:path.write_text(text+'\n\n'+heading+'\n\nThe current GitHub-only candidate extends checksum-verified V46 with 20 accepted facts on 16 records (14 asking-price observations, three launch quarters and three planned completion targets). It preserves the fixed catalogue and native history. The older queue-only figures above are earlier-pass receipts. See [the current handover](verification/regional-research-2026-10-14/ACCEPTED-PASS47.md) for exact source decisions, coverage changes, verification and the separate operator boundary. No publication or production activation is implied.\n')
print(out)
