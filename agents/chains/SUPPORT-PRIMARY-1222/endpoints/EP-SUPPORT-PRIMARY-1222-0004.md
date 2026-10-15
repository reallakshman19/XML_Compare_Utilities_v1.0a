CHAIN_STATE_VERSION: 3
HANDOVER_PROTOCOL_VERSION: 2
CHAIN_ID: SUPPORT-PRIMARY-1222
ENDPOINT_ID: EP-SUPPORT-PRIMARY-1222-0004
PREVIOUS_ENDPOINT: EP-SUPPORT-PRIMARY-1222-0003
WORK_ITEM_SOURCE: GITHUB_ISSUE
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1222
WORK_ITEM_MODE: EXCLUSIVE
AGENT_INSTANCE_ID: chatgpt:dc64d516-9c68-47d5-98f5-64cc74bb093c
COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: fed57820909f4984a97d67437340df952b73a5ab
COMMON_PROTOCOL_STATUS: CURRENT
ISSUE_BASIS_ID: IB-SUPPORT-PRIMARY-1222-0001
MAIN_OBSERVED: 242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581
BRANCH: feature/support-primary-assembly-graph
PR: 1223
PR_STATE: OPEN_DRAFT
PR_MERGEABLE: TRUE
REVIEWS: NONE
UNRESOLVED_REVIEW_THREADS: NONE
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE

ENGINEERING_STATE: ACTIVE
CUSTODY_STATE: HELD
QUALIFICATION_STATE: NOT_REQUIRED
WRITE_AUTHORITY: WRITE_ALLOWED
AUTO_STATE: NOT_APPLICABLE
COORDINATION_STATE: SAFE

QUALIFICATION_SCOPE_ID: QSCOPE-SUPPORT-PRIMARY-1222-ASSEMBLY-SEAM
QUESTION_SET_ID: QS-SUPPORT-PRIMARY-1222-0001
QUESTION_SET_STATUS: CURRENT
QUESTION_PACK_ACTION: REUSED

MATERIAL_LEG: LEG-002
MATERIAL_BASE: cc074770646882ccb9c8852bb72755e106eae9ae
MATERIAL_HEAD: ddbc793ab8b7a96fb152549015a23c330795d763
MATERIAL_LEG_RECEIPT: agents/chains/SUPPORT-PRIMARY-1222/material-legs/LEG-002.md

# Material result

LEG-002 adds a pure reconciliation seam between the existing Support Report geometry/location groups and the explicit `SupportPrimaryRelationshipBundle.v1` topology introduced in LEG-001.

`support-primary-reconciliation.js` produces these fail-visible states:

- `EXPLICIT_ASSEMBLY`: every observed concrete member maps to one explicit assembly; stable explicit ID is countable.
- `CONFLICT`: observed concrete members span more than one explicit assembly; no ID is selected.
- `PARTIAL_EXPLICIT`: only part of the observed concrete membership maps to one explicit assembly; no countable ID is emitted.
- `GEOMETRY_ONLY`: no explicit mapping exists; existing geometry evidence receives a deterministic provisional ID.
- `SYMBOLIC_ONLY`: DATUM/reference-only evidence remains non-countable.

Wrong/unversioned relationship bundle schemas are ignored for explicit authority and therefore fall back to geometry-only evidence.

No existing location grouping, axial/lateral tolerance, report count, typicality matcher, zone UI, worker/parser intake, or #1216 Support/Steel producer behavior changed.

# Validation truth

PASS:
- LEG-002 prework endpoint committed and issue-synchronized before product changes;
- current main stayed at `242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581`;
- PR #1223 remained draft/open/mergeable with no reviews or threads;
- material diff scope inspection found only the reconciliation module + focused test beyond relay state;
- isolated Node syntax/behavior harness for the committed reconciliation logic passed explicit deduplication, conflict, partial withholding, DATUM non-countability, and unsupported-schema fallback.

NOT_RUN:
- committed repository `tests/support-primary-reconciliation.test.mjs` under repository test runner;
- existing legacy PS/SL regression suite;
- Support Report benchmark suite;
- browser/deployed qualification;
- real PS-11167=6 / PS-11236=4 relationship benchmark because INPUT-002 is still unpinned.

GitHub Actions evidence on PR head `3904f369712ffb907ac43bda54d750bf4a68afd5`:
- Typicality Qualification run `34962373854`: both jobs complete/failure with `steps=[]`, `runner_id=0`.
- ZIP Benchmark run `34962374274`: benchmark job complete/failure with `steps=[]`, `runner_id=0`.
These runs did not execute tests; validation remains NOT_RUN rather than product FAIL.

# Acceptance delta

- TASK-005: advanced from topology-only seam to topology/location reconciliation seam.
- TASK-006: orphan resolver still OPEN; no widened second-pass geometry implemented.
- TASK-007: final `TOTAL SUPPORT POINTS ON SECONDARY` migration remains OPEN and intentionally unchanged.
- TASK-008: Column 22 relationship matcher/consensus remains OPEN and unchanged.
- TASK-009: synthetic reconciliation tests exist; repository execution remains NOT_RUN.

# Code-quality disposition

New reconciliation production module is 236 physical lines and owns one pure responsibility. No hidden state, global mutation, I/O, UI behavior or duplicate geometry calculation was introduced. The provisional geometry ID consumes already-computed group evidence; it does not recompute grouping.

# Falsifier / rollback

Any partial/conflicting explicit evidence becoming countable, unsupported schema acquiring explicit authority, or reconciliation changing the underlying geometry clusters is a failure of this leg and must be reverted before integration.

# Exact next action

Update PR/current Issue handover for LEG-002. The next material boundary is final count migration from distinct countable reconciled assembly IDs, but it requires a new prework endpoint and explicit preservation tests for PS-12060=1, PS-12877=4, PS-12860=6 and PS-12120=14. Do not merge.