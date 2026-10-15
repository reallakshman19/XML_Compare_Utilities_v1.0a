CHAIN_STATE_VERSION: 3
HANDOVER_PROTOCOL_VERSION: 2
CHAIN_ID: SUPPORT-PRIMARY-1222
ENDPOINT_ID: EP-SUPPORT-PRIMARY-1222-0002
PREVIOUS_ENDPOINT: EP-SUPPORT-PRIMARY-1222-0001
WORK_ITEM_SOURCE: GITHUB_ISSUE
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1222
WORK_ITEM_MODE: EXCLUSIVE
AGENT_INSTANCE_ID: chatgpt:dc64d516-9c68-47d5-98f5-64cc74bb093c
COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: fed57820909f4984a97d67437340df952b73a5ab
COMMON_PROTOCOL_STATUS: CURRENT
ISSUE_BASIS_ID: IB-SUPPORT-PRIMARY-1222-0001
ISSUE_CURRENT_STATE_FILE: agents/chains/SUPPORT-PRIMARY-1222/issue-state/CURRENT.md
MAIN_OBSERVED: 242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581
BRANCH: feature/support-primary-assembly-graph
MATERIAL_LEG: LEG-001
MATERIAL_BASE: 54a088f478b69d8b0412f36db3558083446aec06
MATERIAL_HEAD: 2c065b69ed94dae63d531c0660103486d5447691
MATERIAL_LEG_RECEIPT: agents/chains/SUPPORT-PRIMARY-1222/material-legs/LEG-001.md
ENGINEERING_STATE: ACTIVE
CUSTODY_STATE: HELD
QUALIFICATION_STATE: NOT_REQUIRED
WRITE_AUTHORITY: WRITE_ALLOWED
AUTO_STATE: NOT_APPLICABLE
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
COORDINATION_STATE: SAFE

# Material result

First structural seam is implemented without migrating Support Report count or Column 22 authority.

Production changes:

1. `ps-family-psclash-xml-parser.js`
   - existing `parseSupportChangeXml()` remains pipe-required;
   - new `parseSupportMemberRelationshipXml()` retains only SupportChain/member-to-member rows with or without pipe context;
   - raw object paths remain available for future exact zone ancestry;
   - new rows retain `EXPLICIT_SUPPORT_CLASH`, evidence ID and `pipeContextStatus`.

2. `support-primary-relationship.js`
   - introduces `SupportPrimaryRelationshipBundle.v1` / `SUPPORT_PRIMARY_REL_V1`;
   - deterministic family-scoped connected components;
   - deterministic assembly IDs such as `PSA::PS-11167::M-2+11`;
   - DATUM / STRUCTURAL_REFERENCE symbolic and non-countable;
   - cross-family edges excluded with diagnostics;
   - source XYZ retained but never used to connect components.

3. `support-report-location-grouping.js`
   - user-facing remark value becomes `Multiple primary support`;
   - existing `SUPPORT_REPORT_MULTI_LOCATION_REMARK` remains an alias for compatibility;
   - no grouping/tolerance/count rule changed.

4. `tests/support-primary-relationship.test.mjs`
   - covers no-pipe edge retention vs legacy gate;
   - resolved pipe-context preservation;
   - deterministic PS-11167 component;
   - PS-11236 DATUM non-countability;
   - coincident explicit component non-merge;
   - cross-family fail-visible behavior;
   - renamed remark contract.

# Task / acceptance delta

- TASK-001: PARTIAL — display string implemented; final assembly-count semantic trigger awaits count migration.
- TASK-002: PARTIAL — parser seam implemented; real Owner 1835 relationship XML not yet pinned/qualified.
- TASK-003: PASS for this leg — #1216 producer authority untouched.
- TASK-005: PARTIAL — canonical explicit-relationship assembly bundle exists; staged/geometry reconciliation remains later.
- TASK-004/006/007/008: OPEN; intentionally not started in this leg.
- TASK-009: OPEN; benchmark expectations frozen, repository execution not yet performed.
- TASK-010: IN_PROGRESS; first material receipt and endpoint now durable.

# Input / benchmark delta

INPUT-002 remains `UNRESOLVED_FILE_LOCATOR`; no real 1835 relationship XML is claimed.

All governed family-count and typicality benchmarks remain `NOT_RUN` under this chain. The new synthetic topology tests are committed but repository execution is still `NOT_RUN` until actual test/CI execution occurs.

# Validation truth

PASS:
- exact main re-grounded immediately before this endpoint: still `242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581`;
- branch is ahead with merge base exactly current main;
- diff scope review: only three production paths + one focused test plus relay/control-plane files;
- isolated Node v22 parser smoke confirms new no-pipe edge seam while legacy pipe gate remains.

NOT_RUN:
- repository focused test;
- legacy PS/SL regression suite;
- Support Report benchmark suite;
- browser test;
- CI checks.

# Code-quality / staged-prerequisite disposition

The new assembly module is 237 lines and intentionally has no final runtime count/typicality consumer in this leg. Issue #1222 §17 explicitly authorizes this staged prerequisite to establish and qualify the structural seam before decision migration.

# Current falsifier

If actual repository tests reveal that legacy XML report semantics changed, revert the legacy wrapper to byte-equivalent behavior and retain the new relationship path below/alongside it. If assembly IDs vary with relationship row ordering, the ID contract must be fixed before integration.

# Exact next action

Synchronize this endpoint/current Active Handover to issue #1222, open a draft PR, and inspect whether GitHub Actions jobs actually execute. Do not promote NOT_RUN to PASS. No merge. Next material leg begins only after first-slice qualification evidence is reconciled.