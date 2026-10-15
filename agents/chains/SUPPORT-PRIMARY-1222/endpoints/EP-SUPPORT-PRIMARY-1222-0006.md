CHAIN_STATE_VERSION: 3
HANDOVER_PROTOCOL_VERSION: 2
CHAIN_ID: SUPPORT-PRIMARY-1222
ENDPOINT_ID: EP-SUPPORT-PRIMARY-1222-0006
PREVIOUS_ENDPOINT: EP-SUPPORT-PRIMARY-1222-0005
WORK_ITEM_SOURCE: GITHUB_ISSUE
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1222
WORK_ITEM_MODE: EXCLUSIVE
COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: fed57820909f4984a97d67437340df952b73a5ab
ISSUE_BASIS_ID: IB-SUPPORT-PRIMARY-1222-0001
MAIN_OBSERVED: 242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581
BRANCH: feature/support-primary-assembly-graph
PR: 1223
MATERIAL_LEG: LEG-003
MATERIAL_BASE: 4e741841296b643413f047b05b5a52ba0d89e513
MATERIAL_HEAD: bc0fdb6f4582ccdfcbef301d7abbb458fa5d179c
MATERIAL_RECEIPT: agents/chains/SUPPORT-PRIMARY-1222/material-legs/LEG-003.md
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

LEG-003 implements the final count-consumer seam for Primary Support Assembly evidence without changing the underlying bore-axis geometry grouper.

Implemented:
- `SupportPrimaryCountProjection.v1`;
- optional `primaryRelationshipBundle` input to Support Report engine;
- explicit family assembly count + geometry-only fallback composition;
- explicit assembly deduplication across multiple geometry groups;
- inclusion of countable explicit assemblies not observed in current Support Report groups;
- DATUM/reference non-countability;
- partial/conflict ambiguity floor that cannot reduce below legacy geometry count;
- unsupported relationship schema non-authority;
- row/top-level assembly provenance;
- `Multiple primary support` now keyed to final family count >1 while legacy `multipleLocationsOnPipe` remains audit evidence.

# Acceptance delta

- TASK-001: IMPLEMENTED_PENDING_REPO_QUALIFICATION — display string and family-count semantic trigger are now wired.
- TASK-002: PARTIAL — parser seam done; real Owner relationship XML still unpinned.
- TASK-003: PASS_LEG_001_002_003 — #1216 carrier/steel producer authority untouched.
- TASK-004: OPEN — zone discovery + two-column multiselect/UI plumbing remains.
- TASK-005: IMPLEMENTED_FOR_EXPLICIT_RECONCILIATION — topology + reconciliation + count projection exist; orphan recovery remains separate.
- TASK-006: OPEN — orphan resolver not implemented.
- TASK-007: IMPLEMENTED_PENDING_REPO_QUALIFICATION — final count migration code is wired.
- TASK-008: OPEN — Column 22 unchanged.
- TASK-009: IN_PROGRESS — synthetic count policy covered; real repository benchmark execution remains NOT_RUN.
- TASK-010: IN_PROGRESS — PR #1223 remains draft; merge Owner-only.

# Validation truth

PASS:
- prework-first ordering under EP-0005;
- material scope review `966ff3ce... -> bc0fdb6f...`;
- isolated count-policy harness for legacy preservation, explicit dedupe, unobserved explicit component and ambiguity floor;
- engine patch review: count projection occurs before row field projection, existing Support/Steel relationship bundle remains separate;
- row-enrichment patch review: `Multiple primary support` uses final family count while `multipleLocationsOnPipe` remains intact.

NOT_RUN:
- committed `support-primary-counting.test.mjs` under repository runner;
- committed `support-primary-count-engine.test.mjs` under repository runner;
- protected real benchmark suite PS-12060/12877/12860/12120;
- browser/deployed validation;
- real PS-11167/PS-11236 relationship benchmark.

Infrastructure evidence:
- workflow `34965697692`: focused-node and browser jobs fail with `steps=null`;
- workflow `34965697685`: benchmark job fails with `steps=null`;
- therefore workflows supplied no product test result.

# Protected controls

The no-explicit-input count path is deliberately defined as `locationGroups.length` per family, preserving the existing geometry output contract. This is the governing code-level preservation for PS-12060=1, PS-12877=4, PS-12860=6 and PS-12120=14 until the real suite executes.

# Current blocker

Real Owner Clash-within-Supports XML for 1835 is still not pinned. PS-11167=6 and PS-11236=4 cannot be claimed as real-input PASS.

# Next material boundary

Stop LEG-003 here. Recommended next bounded leg is WP-PSA-003: exact zone-scope discovery + two-column multi-select and optional relationship XML/bundle UI plumbing so real users can supply the new structural evidence path. Keep orphan resolver as a subsequent bounded fallback leg. Column 22 remains untouched until the input/zone/count path is auditable end-to-end.

No merge.