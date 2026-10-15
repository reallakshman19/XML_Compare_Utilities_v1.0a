CHAIN_STATE_VERSION: 3
HANDOVER_PROTOCOL_VERSION: 2
CHAIN_ID: SUPPORT-PRIMARY-1222
ENDPOINT_ID: EP-SUPPORT-PRIMARY-1222-0010
PREVIOUS_ENDPOINT: EP-SUPPORT-PRIMARY-1222-0009
WORK_ITEM_SOURCE: GITHUB_ISSUE
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1222
WORK_ITEM_MODE: EXCLUSIVE
COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: fed57820909f4984a97d67437340df952b73a5ab
ISSUE_BASIS_ID: IB-SUPPORT-PRIMARY-1222-0001
MAIN_OBSERVED: 242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581
BRANCH: feature/support-primary-assembly-graph
PR: 1223
MATERIAL_LEG: LEG-005
MATERIAL_BASE: e45dc55d17df8f83846d7ad86b5f0f4b5a2339fc
MATERIAL_HEAD: 26c512ecc62585735a18ed82649a33fab0c3e2da
MATERIAL_RECEIPT: agents/chains/SUPPORT-PRIMARY-1222/material-legs/LEG-005.md
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
TAKEOVER_QUALIFICATION_READY: TRUE

# Material result

LEG-005 implements WP-PSA-005 conservative orphan recovery as a second pass without widening normal location grouping.

Default policy:
- enabled;
- 1.0x axial;
- 2.0x lateral;
- Same Family / Same PIPE / Same Bore ON;
- unique target fixed ON.

Implemented safety:
- only `GEOMETRY_ONLY` sources are recoverable;
- explicit/partial/conflict/symbolic assignments are immutable;
- distinct explicit assemblies cannot be joined;
- multiple target identities => `ORPHAN_AMBIGUOUS`, no merge;
- provisional-to-provisional requires reciprocal uniqueness;
- enabled missing gate evidence fails closed;
- branch mismatch override requires all three guards enabled+passing;
- branch override cannot be authorized by a two-point orphan/target pair; pipe-wide model requires >=3 points.

Count projection now consumes recovered effective assembly IDs while preserving unrelated legacy occurrences and the existing ambiguity floor. The UI exposes the configurable recovery profile, and the engine exposes report/row audit for recovery status, targets, residuals, thresholds and axis evidence.

# Acceptance delta

- TASK-001: IMPLEMENTED_PENDING_REPO_QUALIFICATION — `Multiple primary support` remains driven by final family count.
- TASK-002: IMPLEMENTED_INPUT_PATH / REAL_INPUT_NOT_RUN — optional relationship XML path remains available; real 1835 relationship file unpinned.
- TASK-003: PASS_LEG_001_002_003_004_005 — #1216 carrier/steel authority untouched.
- TASK-004: IMPLEMENTED_PENDING_BROWSER_QUALIFICATION — zone UI retained unchanged.
- TASK-005: IMPLEMENTED_EXPLICIT_PLUS_FALLBACK — explicit topology/reconciliation/count plus conservative orphan fallback now exist.
- TASK-006: IMPLEMENTED_PENDING_REPO_QUALIFICATION — orphan resolver implemented with governed defaults/safety.
- TASK-007: IMPLEMENTED_PENDING_REPO_QUALIFICATION — final count consumes assembly and recovery evidence.
- TASK-008: OPEN — Column 22 relationship matcher/consensus remains untouched.
- TASK-009: IN_PROGRESS — focused orphan tests committed; repository/browser/real benchmark execution remains NOT_RUN.
- TASK-010: IN_PROGRESS — PR #1223 remains draft; merge Owner-only and unauthorized.

# Validation truth

PASS by material/source review:
- EP-0009 prework and Issue mirror existed before product mutation;
- material compare stayed inside frozen paths;
- normal grouping acceptance/tolerances did not change;
- explicit components remain immutable;
- unique-target/reciprocal rules are fail-closed;
- count fallback preserves unrelated legacy occurrences;
- engine row/debug audit surface is present;
- PR was open/draft/mergeable with no reviews or unresolved review threads at material review.

NOT_RUN:
- committed orphan Node tests under an executing repository runner;
- browser/deployed qualification;
- protected real count benchmark suite;
- real PS-11167/PS-11236 relationship benchmark.

Infrastructure evidence:
- workflow `34978272498`: browser/focused-node jobs `steps=null`;
- workflow `34978272204`: benchmark job `steps=null`;
- no product test result exists from these runs.

# Protected controls

No real-suite PASS is claimed. Required expected values remain:
- PS-12060=1;
- PS-12877=4;
- PS-12860=6;
- PS-12120=14;
- PS-11167=6;
- PS-11236=4.

Column 22 11168->14168 behavior is untouched.

# Current blocker / technical debt

- real 1835 Clash-within-Supports XML is still unpinned;
- GitHub Actions runner remains non-executing;
- browser interaction qualification remains NOT_RUN;
- shared location geometry is currently consumed through the location grouper `_test` namespace; promote to production-named exports before release hardening;
- normal UI mirrors orphan config through module-global runtime state; engine has explicit config support, so popup-scoped passing is a cleanup opportunity;
- nested engine/count browser query tokens need release cache-hardening;
- field-level count provenance remains older than detailed assembly/orphan audit.

# Exact next action

Stop at EP-0010 and synchronize Issue #1222 / ACTIVE / CURRENT / PR. Do not merge.

On a future Owner `proceed`, prework one bounded leg before product mutation. Recommended immediate leg is release hardening for the Primary Support Assembly path (production-named shared geometry exports, popup-scoped orphan config, count provenance and nested cache tokens). After that, implement Column 22 `RELATIONSHIP_TOPOLOGY_V1` as an independent matcher + consensus evidence without rewriting the existing typicality matcher.
