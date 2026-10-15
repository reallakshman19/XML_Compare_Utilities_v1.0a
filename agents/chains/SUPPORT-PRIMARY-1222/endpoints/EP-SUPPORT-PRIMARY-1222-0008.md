CHAIN_STATE_VERSION: 3
HANDOVER_PROTOCOL_VERSION: 2
CHAIN_ID: SUPPORT-PRIMARY-1222
ENDPOINT_ID: EP-SUPPORT-PRIMARY-1222-0008
PREVIOUS_ENDPOINT: EP-SUPPORT-PRIMARY-1222-0007
WORK_ITEM_SOURCE: GITHUB_ISSUE
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1222
WORK_ITEM_MODE: EXCLUSIVE
COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: fed57820909f4984a97d67437340df952b73a5ab
ISSUE_BASIS_ID: IB-SUPPORT-PRIMARY-1222-0001
MAIN_OBSERVED: 242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581
BRANCH: feature/support-primary-assembly-graph
PR: 1223
MATERIAL_LEG: LEG-004
MATERIAL_BASE: 73461e4f0f02d6cf64bdd4b12155e126984e72ef
MATERIAL_HEAD: b58b1a223f2992d46646b6779705067d7631d947
MATERIAL_RECEIPT: agents/chains/SUPPORT-PRIMARY-1222/material-legs/LEG-004.md
ENGINEERING_STATE: ACTIVE
CUSTODY_STATE: HELD
QUALIFICATION_STATE: NOT_REQUIRED
WRITE_AUTHORITY: WRITE_ALLOWED
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
COORDINATION_STATE: SAFE
QUALIFICATION_SCOPE_ID: QSCOPE-SUPPORT-PRIMARY-1222-ASSEMBLY-SEAM
QUESTION_SET_ID: QS-SUPPORT-PRIMARY-1222-0001
QUESTION_SET_STATUS: CURRENT
QUESTION_PACK_ACTION: REUSED

# Material result

LEG-004 completes the current-area Support Report input plane for the explicit Primary Support Assembly path.

Implemented:
- `SupportReportZoneScope.v1` exact ancestor discovery/scoping;
- raw parser (`primaryPath` / `secondaryPath`) and grouped-path compatibility;
- searchable two-column Primary/piping-support vs Secondary/support multi-select UI;
- empty selections as backward-compatible no restriction;
- conjunctive primary+secondary report-row scope when both sides are active;
- optional Primary Support Relationship / Clash-within-Supports XML input;
- exact relationship source-path scoping before `SupportPrimaryRelationshipBundle.v1` authority;
- `SupportPrimaryInput.v1` parsed/scoped/excluded counts and diagnostics;
- zone scope retained in relationship/report audit metadata;
- existing `primaryRelationshipBundle` count seam wired end-to-end from UI;
- Support Report addon/bootstrap cache routing advanced for the new input plane.

An integration review found and corrected an initial raw-vs-grouped path-shape mismatch before endpoint closure.

# Acceptance delta

- TASK-001: IMPLEMENTED_PENDING_REPO_QUALIFICATION — `Multiple primary support` remains keyed to final family assembly count.
- TASK-002: IMPLEMENTED_INPUT_PATH / REAL_INPUT_NOT_RUN — optional relationship XML can now be loaded, parsed, scoped and built into the typed relationship bundle; real 1835 file remains unpinned.
- TASK-003: PASS_LEG_001_002_003_004 — #1216 Support/Steel producer authority untouched.
- TASK-004: IMPLEMENTED_PENDING_BROWSER_QUALIFICATION — exact zone discovery + two-column searchable multiselect + scope invalidation/UI plumbing implemented.
- TASK-005: IMPLEMENTED_EXPLICIT_PATH — topology + reconciliation + count + user input path exist; orphan fallback remains separate.
- TASK-006: OPEN_NEXT — configurable orphan resolver not implemented.
- TASK-007: IMPLEMENTED_PENDING_REPO_QUALIFICATION — final count seam remains active.
- TASK-008: OPEN — Column 22 relationship matcher/consensus unchanged.
- TASK-009: IN_PROGRESS — focused zone/input/UI tests committed; isolated zone harness PASS; repository/browser/real benchmarks NOT_RUN.
- TASK-010: IN_PROGRESS — PR #1223 remains draft/open/mergeable; merge Owner-only.

# Validation truth

PASS:
- EP-0007 immutable prework file was committed before product mutation;
- material scope compare `73461e4f... -> b58b1a22...` contains only approved zone/input/UI/cache/test/relay files;
- isolated exact-zone Node harness passes raw-row discovery, exact conjunctive filtering, no-scope preservation and exact relationship path filtering;
- source review confirms relationship XML is support-member connectivity only and remains separate from Support/Steel carrier authority;
- PR #1223 observed open/draft/mergeable at material head;
- review submissions: none;
- unresolved review threads: none.

PROCEDURAL NOTE:
- the branch-local prework endpoint existed before product mutation;
- the GitHub issue Active Handover mirror lagged during material work and must be synchronized as part of this endpoint closeout. No claim of pre-mutation issue-comment sync is made.

NOT_RUN:
- committed zone/input/UI Node tests under an executing repository runner;
- browser interaction qualification of the multi-select/file flow;
- real relationship benchmark PS-11167/PS-11236;
- full Support Report benchmark suite.

Infrastructure evidence:
- workflow `34968126821`: browser/focused-node jobs fail with `steps=null`;
- workflow `34968126902`: benchmark job fails with `steps=null`;
- workflows supplied no product test result.

# Protected controls

- empty zone scope preserves all current primary Support Report evidence;
- absent relationship XML preserves geometry fallback;
- bore-axis grouping/tolerances are unchanged;
- orphan recovery is unchanged/not implemented;
- Column 22 is unchanged;
- typical-reference XML is not current-area zone-scoped in LEG-004.

# Current blocker

Real Owner Clash-within-Supports XML for 1835 is still not pinned. PS-11167=6 and PS-11236=4 cannot be claimed as real-input PASS. GitHub Actions remains non-executing.

# Exact next material boundary

Stop LEG-004 here. Recommended next bounded leg is WP-PSA-005 conservative orphan recovery:
- feature enabled by default;
- 1.0x axial tolerance multiplier;
- 2.0x lateral tolerance multiplier;
- Same PS/SL Family, Same PIPE and Same Bore gates configurable and ON by default;
- unique qualifying target required;
- explicit distinct assembly IDs may never be joined;
- ambiguity remains unmerged and auditable.

Column 22 remains deferred. No merge.
